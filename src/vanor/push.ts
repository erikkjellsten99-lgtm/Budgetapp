// Påminnelser via web push. Telefonen prenumererar, servern (Supabase-funktionen "reminders",
// se supabase/functions/reminders) skickar vid rätt tid. Bara när du är inloggad.

import { getSyncState, supabase } from '../sync'

const FUNCTION_URL = 'https://gnmbtioxwgzdooswpwxy.supabase.co/functions/v1/reminders'

export type PushSupport = 'ok' | 'unsupported' | 'ios-home'

/** Kan den här telefonen/webbläsaren få notiser? På iPhone krävs att appen ligger på hemskärmen. */
export function pushSupport(): PushSupport {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
  if (ios && !standalone) return 'ios-home'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return 'ok'
}

export class PushError extends Error {
  constructor(readonly reason: 'denied' | 'login' | 'failed') {
    super(reason)
  }
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array) {
  if (!a) return false
  const x = new Uint8Array(a)
  return x.length === b.length && x.every((v, i) => v === b[i])
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return existing
  // Utvecklingsläget registrerar ingen service worker – vänta inte för evigt.
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))])
}

/** Prenumerationen på den här telefonen, om notiser är på. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return null
  const reg = await registration()
  return reg ? reg.pushManager.getSubscription() : null
}

/** Kvällspåminnelsens tid för den här telefonen (null = av). */
export async function loadEvening(sub: PushSubscription): Promise<string | null> {
  const { data } = await supabase.from('push_subscriptions').select('evening').eq('endpoint', sub.endpoint).maybeSingle()
  return (data?.evening as string | null) ?? null
}

/**
 * Slå på notiser. Måste anropas direkt från ett tryck (iPhone kräver det för frågan om tillstånd).
 * Sparar prenumerationen på kontot, så att servern kan skicka.
 */
export async function enablePush(evening: string | null): Promise<PushSubscription> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new PushError('denied')
  if (getSyncState().status === 'utloggad') throw new PushError('login')
  try {
    const reg = await registration()
    if (!reg) throw new Error('Ingen service worker')
    const { publicKey } = (await (await fetch(`${FUNCTION_URL}?action=key`)).json()) as { publicKey: string }
    const key = keyBytes(publicKey)
    let sub = await reg.pushManager.getSubscription()
    if (sub && !sameKey(sub.options.applicationServerKey, key)) {
      await sub.unsubscribe()
      sub = null
    }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    const json = sub.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Stockholm',
      evening,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    return sub
  } catch (e) {
    console.error('Påminnelser: kunde inte slå på', e)
    throw new PushError('failed')
  }
}

/** Stäng av notiser på den här telefonen. */
export async function disablePush(sub: PushSubscription): Promise<void> {
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function saveEvening(sub: PushSubscription, evening: string | null): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .update({ evening, updated_at: new Date().toISOString() })
    .eq('endpoint', sub.endpoint)
  if (error) throw error
}

/** Skicka en testnotis till den här telefonen. */
export async function sendTest(sub: PushSubscription): Promise<boolean> {
  try {
    const response = await fetch(`${FUNCTION_URL}?action=test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    })
    return ((await response.json()) as { ok: boolean }).ok
  } catch {
    return false
  }
}
