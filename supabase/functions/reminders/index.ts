// Påminnelser för Vanor (web push). Körs var 5:e minut av pg_cron, och anropas av appen
// för att hämta den publika nyckeln (?action=key) och skicka en testnotis (?action=test).
//
// Logiken speglar appen (src/vanor/habits.ts) i förenklad form:
// - Påminnelse för en vana: vid vald tid, om den inte är bockad idag, dagen inte är pausad
//   och veckomålet inte redan är nått. Efter-vanor bara om en kopplad vana är bockad idag.
// - Kvällspåminnelse: vid vald tid, om det finns vanor som måste göras idag för att hinna veckomålet.
// - Att göra-saker med tid: vid tiden den dagen, om de inte är bockade (även pausade dagar).
// - Rapport på söndagkvällen (en timme efter kvällspåminnelsen, annars 21:00): veckans procent och vad som drog ner.
//   Är det månadens sista vecka blir det en månadsrapport (report.ts).
// Samma påminnelse skickas högst en gång per dag (tabellen push_sent).

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { addDays, sundayReport, weekday, type ReportHabit } from './report.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const APP_URL = 'https://budgetapp-orpin.vercel.app/';
/** Hur länge efter vald tid en missad påminnelse fortfarande skickas (om cron var sen). */
const LATE_MINUTES = 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

interface Habit {
  id: string;
  name: string;
  goal: number;
  after?: string[];
  archived?: boolean;
  minimum?: string;
  remind?: string;
  /** 0 = måndag … 6 = söndag. Saknas = alla dagar. */
  remindDays?: number[];
  /** Planerade dagar. Finns de gäller påminnelsen bara de dagarna. */
  days?: number[];
}
interface Task {
  id: string;
  title: string;
  date: string;
  time?: string;
  doneOn?: string;
}
interface Sub {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
  tz: string;
  evening: string | null;
}

/** Nyckelparet skapas första gången och sparas i push_keys (bara servern kommer åt den). */
async function getKeys(): Promise<{ public_key: string; private_key: string }> {
  const { data } = await admin.from('push_keys').select('public_key, private_key').eq('id', 1).maybeSingle();
  if (data) return data;
  const k = webpush.generateVAPIDKeys();
  await admin.from('push_keys').upsert({ id: 1, public_key: k.publicKey, private_key: k.privateKey }, { ignoreDuplicates: true });
  const { data: saved, error } = await admin.from('push_keys').select('public_key, private_key').eq('id', 1).single();
  if (error) throw error;
  return saved;
}

/** Datum och klockslag i telefonens tidszon. */
function localNow(tz: string, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const isDue = (hhmm: string | null | undefined, minutes: number) => {
  if (!hhmm || !/^\d\d:\d\d$/.test(hhmm)) return false;
  const diff = minutes - toMinutes(hhmm);
  return diff >= 0 && diff < LATE_MINUTES;
};

/** Rapporten kommer en timme efter kvällspåminnelsen (högst 23:00), eller 21:00 om den är avstängd. */
function reportTime(evening: string | null): string {
  const m = Math.min(23 * 60, (evening && /^\d\d:\d\d$/.test(evening) ? toMinutes(evening) : 20 * 60) + 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const nameList = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} och ${names[names.length - 1]}`;

async function send(keys: { public_key: string; private_key: string }, sub: Sub, payload: object) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      {
        TTL: 60 * 60,
        urgency: 'normal',
        vapidDetails: { subject: APP_URL, publicKey: keys.public_key, privateKey: keys.private_key },
      },
    );
    return 'ok';
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    // Prenumerationen finns inte längre (notiser avstängda eller appen borttagen).
    if (status === 404 || status === 410) {
      await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      return 'gone';
    }
    console.error('push misslyckades', status, String(e));
    return 'error';
  }
}

async function runReminders(keys: { public_key: string; private_key: string }) {
  const { data: subs, error } = await admin.from('push_subscriptions').select('endpoint, user_id, p256dh, auth, tz, evening');
  if (error) throw error;
  if (!subs?.length) return { subs: 0, sent: 0 };

  const users = [...new Set(subs.map((s) => s.user_id))];
  // Bockningar från de senaste tio veckorna räcker (veckan hittills, och månaden plus förra månaden för rapporten).
  const since = addDays(new Date().toISOString().slice(0, 10), -75);
  const [habitRows, checkRows, taskRows] = await Promise.all([
    admin
      .from('personal_records')
      .select('user_id, store, data')
      .in('user_id', users)
      .in('store', ['habits', 'pauses'])
      .eq('deleted', false)
      .limit(5000),
    admin
      .from('personal_records')
      .select('user_id, store, data')
      .in('user_id', users)
      .eq('store', 'checks')
      .eq('deleted', false)
      .gte('data->>date', since)
      .limit(5000),
    // Att göra: bara det som inte är bockat (äldre försenade saker behövs för kvällens lista).
    admin
      .from('personal_records')
      .select('user_id, store, data')
      .in('user_id', users)
      .eq('store', 'tasks')
      .eq('deleted', false)
      .is('data->>doneOn', null)
      .limit(5000),
  ]);
  if (habitRows.error) throw habitRows.error;
  if (checkRows.error) throw checkRows.error;
  if (taskRows.error) throw taskRows.error;
  const rows = [...(habitRows.data ?? []), ...(checkRows.data ?? []), ...(taskRows.data ?? [])];

  let sent = 0;
  for (const sub of subs as Sub[]) {
    const { date, minutes } = localNow(sub.tz || 'Europe/Stockholm');
    const mine = (rows ?? []).filter((r) => r.user_id === sub.user_id);
    const habits = mine.filter((r) => r.store === 'habits').map((r) => r.data as Habit).filter((h) => !h.archived);
    const checks = mine.filter((r) => r.store === 'checks').map((r) => r.data as { date: string; habitId: string });
    const paused = new Set(mine.filter((r) => r.store === 'pauses').map((r) => (r.data as { date: string }).date));
    const pausedToday = paused.has(date);
    const tasks = mine.filter((r) => r.store === 'tasks').map((r) => r.data as Task).filter((t) => !t.doneOn);
    const tasksDue = tasks.filter((t) => t.date <= date);

    const monday = addDays(date, -weekday(date));
    const doneToday = new Set(checks.filter((c) => c.date === date).map((c) => c.habitId));
    const weekCount = (id: string) => checks.filter((c) => c.habitId === id && c.date >= monday && c.date <= date).length;
    const active = new Set(habits.map((h) => h.id));
    const linked = (h: Habit) => (h.after ?? []).filter((id) => active.has(id));
    // Efter-vanor (t.ex. Stretching efter Gym) gäller bara dagar då en kopplad vana är bockad.
    const relevant = (h: Habit) => !linked(h).length || linked(h).some((id) => doneToday.has(id));
    const open = (h: Habit) => !doneToday.has(h.id) && weekCount(h.id) < Math.min(7, h.goal) && relevant(h);

    const outgoing: { key: string; payload: object }[] = [];
    for (const t of tasks) {
      if (t.date !== date || !isDue(t.time, minutes)) continue;
      outgoing.push({
        key: `task:${t.id}`,
        payload: { title: t.title, body: `Att göra idag ${t.time}.`, tag: `task-${t.id}`, url: APP_URL },
      });
    }
    for (const h of habits) {
      if (pausedToday || !isDue(h.remind, minutes) || !open(h)) continue;
      const remindOn = h.days?.length ? h.days : h.remindDays;
      if (remindOn?.length && !remindOn.includes(weekday(date))) continue;
      outgoing.push({
        key: `habit:${h.id}`,
        payload: {
          title: `Dags för ${h.name}`,
          body: h.minimum ? `En dålig dag räcker ${h.minimum}.` : 'Tryck för att bocka av när du är klar.',
          tag: `habit-${h.id}`,
          url: APP_URL,
        },
      });
    }

    if (isDue(sub.evening, minutes)) {
      const daysLeft = 7 - weekday(date);
      const must = pausedToday
        ? []
        : habits.filter((h) => open(h) && (h.goal >= 7 || h.goal - weekCount(h.id) >= daysLeft));
      const names = [...tasksDue.map((t) => t.title), ...must.map((h) => h.name)];
      if (names.length) {
        outgoing.push({
          key: 'evening',
          payload: {
            title: names.length === 1 ? '1 sak kvar idag' : `${names.length} saker kvar idag`,
            body: must.length ? `${nameList(names)} – annars hinns veckomålet inte.` : `${nameList(names)}.`,
            tag: 'evening',
            url: APP_URL,
          },
        });
      }
    }

    if (isDue(reportTime(sub.evening), minutes)) {
      const report = sundayReport(habits as ReportHabit[], checks, paused, date);
      if (report) outgoing.push({ key: report.key, payload: { title: report.title, body: report.body, tag: 'report', url: APP_URL } });
    }

    for (const o of outgoing) {
      // Markera först: blir det en dubblett (annan körning hann före) skickas inget.
      const { data: inserted } = await admin
        .from('push_sent')
        .upsert({ endpoint: sub.endpoint, key: o.key, day: date }, { onConflict: 'endpoint,key,day', ignoreDuplicates: true })
        .select();
      if (!inserted?.length) continue;
      const result = await send(keys, sub, o.payload);
      if (result === 'ok') sent++;
      if (result === 'gone') break;
    }
  }
  return { subs: subs.length, sent };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const action = new URL(req.url).searchParams.get('action');
    const keys = await getKeys();
    if (action === 'key') return json({ publicKey: keys.public_key });
    if (action === 'test') {
      const { endpoint } = await req.json();
      const { data: sub } = await admin.from('push_subscriptions').select('*').eq('endpoint', endpoint).maybeSingle();
      if (!sub) return json({ ok: false, error: 'Ingen prenumeration' }, 404);
      const result = await send(keys, sub as Sub, {
        title: 'Påminnelser är på',
        body: 'Så här ser det ut när Groundwork påminner dig.',
        tag: 'test',
        url: APP_URL,
      });
      return json({ ok: result === 'ok', result });
    }
    return json(await runReminders(keys));
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: String(e) }, 500);
  }
});
