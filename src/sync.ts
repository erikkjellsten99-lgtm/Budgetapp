import { createClient, type Session } from '@supabase/supabase-js';
import {
  applyMergedBudgets,
  applyRemote,
  clearOutbox,
  getAllRecords,
  getBudgetBase,
  getMeta,
  getOutbox,
  onDataChange,
  saveSyncedBudgetBases,
  setMeta,
  type OutboxEntry,
  type RemoteRecord,
} from './db';
import { mergeBudget } from './budgetMerge';
import type { MonthBudget } from './types';

// Synk med servern (Supabase), så att du och Cassandra ser samma siffror.
// Appen fungerar som förut utan internet: allt sparas på telefonen och ändringarna köas.
// När det finns nät skickas kön upp och ändringar från den andra telefonen hämtas ner.
// Om båda har ändrat samma post vinner den som ändrades sist.

// Den publika nyckeln får ligga i appen. Säkerheten sköts av reglerna i databasen:
// bara inloggade medlemmar i hushållet kan läsa eller ändra hushållets data.
const SUPABASE_URL = 'https://gnmbtioxwgzdooswpwxy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WouDt4r7MqW-uJUCy32IvA_GcqHO9o4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  // Länkar i mejl loggar inte in automatiskt. Annars blir man inloggad i den webbläsare där
  // länken råkar öppnas (t.ex. Safari eller datorn) och inte i appen på hemskärmen.
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/** Hur många sekunder bakåt varje hämtning tittar, så att inget missas om två ändringar sker samtidigt. */
const PULL_OVERLAP_MS = 5000;
const PULL_INTERVAL_MS = 30000;

export type SyncStatus = 'utloggad' | 'synkar' | 'synkad' | 'offline' | 'fel';

export interface SyncState {
  status: SyncStatus;
  email: string | null;
  householdId: string | null;
  /** Senaste lyckade synk. */
  lastSynced: Date | null;
  error: string | null;
  /** Användaren har öppnat länken för nytt lösenord och ska välja ett. */
  recovering: boolean;
  /** Ett meddelande efter att en länk i mejlet har öppnats, t.ex. att mejladressen är bekräftad. */
  notice: string | null;
  /** Antal ändringar på den här enheten som inte har skickats än. */
  pending: number;
}

let state: SyncState = { status: 'utloggad', email: null, householdId: null, lastSynced: null, error: null, recovering: false, notice: null, pending: 0 };
const listeners = new Set<(state: SyncState) => void>();

export function getSyncState(): SyncState {
  return state;
}

/** Lyssnar på synkens status. Svarar med en funktion som slutar lyssna. */
export function onSyncState(listener: (state: SyncState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(change: Partial<SyncState>) {
  state = { ...state, ...change };
  for (const listener of listeners) listener(state);
}

interface HouseholdMeta {
  userId: string;
  householdId: string;
  /** Tidsstämpel (från servern) för den senaste hämtade ändringen. */
  lastPull: string | null;
}

let session: Session | null = null;
let running: Promise<void> | null = null;
let again = false;

/** Startar synken. Anropas en gång när appen startar. */
export function startSync() {
  handleEmailLink();
  updatePending();
  supabase.auth.getSession().then(({ data }) => handleSession(data.session));
  supabase.auth.onAuthStateChange((event, next) => {
    if (event === 'PASSWORD_RECOVERY') setState({ recovering: true });
    // Supabase rekommenderar att inte vänta på andra anrop inne i den här callbacken.
    setTimeout(() => handleSession(next), 0);
  });

  let pushTimer: number | undefined;
  onDataChange((kind) => {
    if (kind === 'local') updatePending();
    if (kind !== 'local' || !session) return;
    clearTimeout(pushTimer);
    pushTimer = window.setTimeout(syncNow, 1500);
  });

  window.addEventListener('online', () => syncNow());
  // iPhone pausar appen när den läggs i bakgrunden. Skicka ändringarna direkt i stället för att vänta.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') syncNow();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') syncNow();
  }, PULL_INTERVAL_MS);
}

async function handleSession(next: Session | null) {
  const changedUser = next?.user.id !== session?.user.id;
  session = next;
  if (!next) {
    setState({ status: 'utloggad', email: null, householdId: null, error: null });
    return;
  }
  setState({ email: next.user.email ?? null });
  if (changedUser) await syncNow();
}

/** Synkar direkt: skickar köade ändringar och hämtar nya. Körs aldrig två gånger samtidigt. */
export async function syncNow(): Promise<void> {
  if (!session) return;
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runSync();
    } while (again);
  })();
  try {
    await running;
  } finally {
    running = null;
  }
}

async function runSync() {
  if (!session) return;
  if (!navigator.onLine) {
    setState({ status: 'offline' });
    return;
  }
  setState({ status: 'synkar', error: null });
  try {
    const meta = await ensureHousehold(session.user.id);
    setState({ householdId: meta.householdId });
    await push(meta.householdId);
    await pull(meta);
    // Ett misslyckat engångsförsök ska inte göra hela synken till ett fel; flaggan sätts inte, så det görs om.
    await backfillInvestments(meta.householdId).catch((error) => console.error(error));
    await saveSyncedBudgetBases();
    setState({ status: 'synkad', lastSynced: new Date() });
    await updatePending();
  } catch (error) {
    console.error(error);
    const offline = !navigator.onLine || (error instanceof TypeError && /fetch/i.test(error.message));
    setState({
      status: offline ? 'offline' : 'fel',
      error: offline ? null : error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Ser till att användaren hör till ett hushåll.
 * - Nytt hushåll: allt som finns på telefonen laddas upp.
 * - Befintligt hushåll med data (t.ex. Cassandra, eller en ny telefon): telefonen får hushållets data.
 * - Befintligt hushåll utan data: telefonens data laddas upp.
 */
async function ensureHousehold(userId: string): Promise<HouseholdMeta> {
  const saved = await getMeta<HouseholdMeta>('household');
  if (saved && saved.userId === userId) return saved;

  const { data, error } = await supabase.rpc('join_household');
  if (error) throw error;
  const householdId = (data as { household_id: string; status: string }[])[0].household_id;

  const { count, error: countError } = await supabase
    .from('records')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId);
  if (countError) throw countError;

  const meta: HouseholdMeta = { userId, householdId, lastPull: null };
  if (!count) {
    const records = await getAllRecords();
    const now = Date.now();
    await pushRows(records.map((record) => ({ ...record, household_id: householdId, deleted: false, client_ts: now })));
  } else {
    // Skydd: byt inte ut riktiga siffror på den här enheten utan att fråga.
    if (await hasOwnData()) {
      const ok = confirm(
        'Hushållet har redan data på servern. Vill du byta ut datan på den här enheten mot hushållets?\n\n' +
          'Tryck Avbryt för att logga ut utan att något ändras.',
      );
      if (!ok) {
        await supabase.auth.signOut();
        throw new Error('Inloggningen avbröts. Ingen data ändrades.');
      }
    }
    const rows = await fetchSince(householdId, null);
    await applyRemote(rows, true);
    meta.lastPull = rows.length ? rows[rows.length - 1].updated_at : null;
  }
  await setMeta('household', meta);
  return meta;
}

/** Har den här enheten egna siffror, alltså ändringar eller ifyllda saldon, utöver startvärdena? */
async function hasOwnData(): Promise<boolean> {
  if ((await getOutbox()).length) return true;
  const records = await getAllRecords();
  return records.some((record) => record.store === 'assets' && Number((record.data as { amount?: number }).amount) > 0);
}

async function updatePending() {
  setState({ pending: (await getOutbox()).length });
}

/**
 * Hanterar länkar från mejlet (bekräfta mejladress, nytt lösenord). Bekräftelsen loggar inte in,
 * den visar bara att adressen är bekräftad. Länken för nytt lösenord loggar in här så att man kan välja lösenord.
 */
async function handleEmailLink() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const type = hash.get('type');
  const error = hash.get('error_description');
  if (!type && !error) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (error) {
    setState({ notice: `Länken fungerade inte: ${error}. Försök igen.` });
  } else if (type === 'recovery') {
    const access_token = hash.get('access_token');
    const refresh_token = hash.get('refresh_token');
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
      setState({ recovering: true });
    }
  } else if (type === 'signup' || type === 'email' || type === 'magiclink') {
    setState({ notice: 'Mejladressen är bekräftad! Öppna appen på hemskärmen och logga in med mejl och lösenord.' });
  }
}

async function push(householdId: string) {
  const outbox = await getOutbox();
  if (!outbox.length) return;
  const { entries, budgetTs } = await mergeWithServer(householdId, outbox);
  await pushRows(
    entries.map((entry) => ({
      household_id: householdId,
      store: entry.store,
      id: entry.id,
      data: entry.data,
      deleted: entry.deleted,
      client_ts: budgetTs.get(entry.key) ?? entry.ts,
    })),
  );
  // Servern sparar bara en ändring som är nyare än den den redan har. Hann den andra telefonen
  // spara samma månad precis nu ligger månaden kvar i kön och slås ihop igen vid nästa synk
  // (inom 30 sekunder, eller direkt vid nästa ändring).
  const kept = await budgetsNotStored(householdId, entries, budgetTs);
  await clearOutbox(entries.filter((entry) => !kept.has(entry.key)));
  await updatePending();
}

/**
 * Månadsbudgetar i kön slås ihop med serverns version innan de skickas, så att ingen av
 * telefonernas ändringar försvinner (budgetMerge.ts). Svarar med kön som ska skickas och
 * tidsstämpeln varje budget skickas med (minst serverns, annars sparar servern den inte).
 */
async function mergeWithServer(householdId: string, outbox: OutboxEntry[]) {
  const budgetTs = new Map<string, number>();
  const budgets = outbox.filter((entry) => entry.store === 'budgets' && !entry.deleted && entry.data);
  if (!budgets.length) return { entries: outbox, budgetTs };

  const { data, error } = await supabase
    .from('records')
    .select('id, data, deleted, client_ts')
    .eq('household_id', householdId)
    .eq('store', 'budgets')
    .in('id', budgets.map((entry) => entry.id));
  if (error) throw error;
  const server = new Map((data as { id: string; data: MonthBudget | null; deleted: boolean; client_ts: number }[]).map((row) => [row.id, row]));

  const merged: { key: string; ts: number; data: MonthBudget }[] = [];
  for (const entry of budgets) {
    const remote = server.get(entry.id);
    if (!remote || remote.deleted || !remote.data) continue;
    const local = entry.data as MonthBudget;
    const categories = mergeBudget(await getBudgetBase(entry.id), local.categories, remote.data.categories);
    merged.push({ key: entry.key, ts: entry.ts, data: { ...local, categories } });
    budgetTs.set(entry.key, Math.max(entry.ts, Number(remote.client_ts) + 1));
  }
  // Har något ändrats här under tiden skickas inget för den månaden nu, den tas vid nästa synk.
  const applied = await applyMergedBudgets(merged);
  const byKey = new Map(merged.map((m) => [m.key, m.data]));
  const entries = outbox
    .filter((entry) => !budgetTs.has(entry.key) || applied.has(entry.key))
    .map((entry) => (applied.has(entry.key) ? { ...entry, data: byKey.get(entry.key) } : entry));
  for (const key of budgetTs.keys()) if (!applied.has(key)) budgetTs.delete(key);
  return { entries, budgetTs };
}

/** Månadsbudgetar som servern inte sparade (en nyare version hann före). */
async function budgetsNotStored(householdId: string, sent: OutboxEntry[], budgetTs: Map<string, number>): Promise<Set<string>> {
  const budgets = sent.filter((entry) => entry.store === 'budgets');
  if (!budgets.length) return new Set();
  const { data, error } = await supabase
    .from('records')
    .select('id, client_ts')
    .eq('household_id', householdId)
    .eq('store', 'budgets')
    .in('id', budgets.map((entry) => entry.id));
  if (error) throw error;
  const stored = new Map((data as { id: string; client_ts: number }[]).map((row) => [row.id, Number(row.client_ts)]));
  return new Set(budgets.filter((entry) => stored.get(entry.id) !== (budgetTs.get(entry.key) ?? entry.ts)).map((entry) => entry.key));
}

async function pushRows(rows: object[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.rpc('push_records', { rows: rows.slice(i, i + 500) });
    if (error) throw error;
  }
}

const INVESTMENTS_BACKFILLED = 'investmentsBackfilled';

async function pull(meta: HouseholdMeta) {
  const since = meta.lastPull ? new Date(new Date(meta.lastPull).getTime() - PULL_OVERLAP_MS).toISOString() : null;
  const rows = await fetchSince(meta.householdId, since);
  if (!rows.length) return;
  await applyRemote(rows);
  meta.lastPull = rows[rows.length - 1].updated_at;
  await setMeta('household', meta);
}

/**
 * En telefon som körde den äldre appen hoppade över innehav och affärer men flyttade ändå fram lastPull
 * förbi dem. Första synken efter uppgraderingen hämtar därför alla sådana poster en gång, oavsett lastPull.
 * Misslyckas hämtningen sätts ingen flagga, så det görs om vid nästa synk.
 */
async function backfillInvestments(householdId: string) {
  if (await getMeta<boolean>(INVESTMENTS_BACKFILLED)) return;
  const rows = await fetchSince(householdId, null, ['holdings', 'trades']);
  await applyRemote(rows);
  await setMeta(INVESTMENTS_BACKFILLED, true);
}

type ServerRow = RemoteRecord & { updated_at: string };

async function fetchSince(householdId: string, since: string | null, stores?: string[]): Promise<ServerRow[]> {
  const all: ServerRow[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase
      .from('records')
      .select('store, id, data, deleted, updated_at')
      .eq('household_id', householdId)
      .order('updated_at')
      .range(from, from + 999);
    if (since) query = query.gt('updated_at', since);
    if (stores) query = query.in('store', stores);
    const { data, error } = await query;
    if (error) throw error;
    all.push(...(data as ServerRow[]));
    if (data.length < 1000) return all;
  }
}

// Inloggning med mejl och lösenord. Fungerar även i appen på hemskärmen.
// Mejladressen bekräftas en gång via en länk, så att ingen annan kan registrera sig med någons adress.

const appUrl = () => location.origin + location.pathname;

/** Skapar ett konto. Svarar true om mejladressen måste bekräftas innan man kan logga in. */
export async function signUp(email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: appUrl() },
  });
  if (error) throw error;
  // Finns adressen redan returnerar Supabase en användare utan identiteter.
  if (data.user && data.user.identities?.length === 0) throw new Error('Det finns redan ett konto med den mejladressen. Logga in i stället.');
  return !data.session;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
}

/** Skickar en länk för att välja nytt lösenord. */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: appUrl() });
  if (error) throw error;
}

export async function setNewPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  setState({ recovering: false });
}

/** Loggar ut. Datan ligger kvar på telefonen. */
export async function signOut(): Promise<void> {
  await setMeta('household', undefined);
  await supabase.auth.signOut();
}

// Hushållet

export interface Member {
  email: string;
}

export async function getMembers(householdId: string): Promise<{ members: Member[]; invites: string[] }> {
  const [members, invites] = await Promise.all([
    supabase.from('household_members').select('email').eq('household_id', householdId).order('created_at'),
    supabase.from('household_invites').select('email').eq('household_id', householdId).is('accepted_at', null),
  ]);
  if (members.error) throw members.error;
  if (invites.error) throw invites.error;
  return { members: members.data, invites: invites.data.map((invite) => invite.email) };
}

/** Bjuder in någon till hushållet. Hon går med automatiskt när hon loggar in med den mejladressen. */
export async function invite(householdId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from('household_invites')
    .upsert({ household_id: householdId, email: email.trim().toLowerCase() }, { ignoreDuplicates: true });
  if (error) throw error;
}
