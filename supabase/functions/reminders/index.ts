// Påminnelser för Vanor (web push). Körs var 5:e minut av pg_cron, och anropas av appen
// för att hämta den publika nyckeln (?action=key) och skicka en testnotis (?action=test).
//
// Vad som ska skickas räknas i plan.ts med samma kod som appen och morgonbeskedet (../inbox/priority.ts):
// - Påminnelse för en vana: vid vald tid, om den går att göra idag och inte är bockad (inte pausad dag,
//   inte nått veckomål). Efter-vanor bara om en kopplad vana är bockad idag.
// - Kvällspåminnelse: vid vald tid, Att göra (idag och försenat) plus vanorna som måste göras idag.
// - Att göra-saker med tid: vid tiden den dagen, om de inte är bockade (även pausade dagar).
// - Rapport på söndagkvällen (en timme efter kvällspåminnelsen, annars 21:00): veckans procent och vad som drog ner.
//   Är det månadens sista vecka blir det en månadsrapport (report.ts).
// Samma påminnelse skickas högst en gång per dag (tabellen push_sent).
//
// Utläggning: funktionen importerar filer från ../inbox, så de måste följa med när den läggs ut
// (priority, habits, tasks, dates, health), precis som report.ts och plan.ts.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { addDays } from './report.ts';
import { asHabit, asTask, plannedReminders, type Check } from './plan.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const APP_URL = 'https://budgetapp-orpin.vercel.app/';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

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
    const habits = mine.filter((r) => r.store === 'habits').map((r) => asHabit(r.data));
    const checks = mine.filter((r) => r.store === 'checks').map((r) => r.data as Check);
    const paused = new Set(mine.filter((r) => r.store === 'pauses').map((r) => (r.data as { date: string }).date));
    const tasks = mine.filter((r) => r.store === 'tasks').map((r) => asTask(r.data)).filter((t) => !t.doneOn);

    const outgoing = plannedReminders({ habits, checks, paused, tasks, date, minutes, evening: sub.evening }).map(
      ({ key, ...payload }) => ({ key, payload: { ...payload, url: APP_URL } }),
    );

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
