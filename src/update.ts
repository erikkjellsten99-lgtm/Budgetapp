// Uppdaterar appen automatiskt. När appen öppnas igen (eller var femte minut medan den är öppen)
// kollar den om en ny version har publicerats, och laddar i så fall om sig själv.
// Datan ligger kvar på telefonen, och ändringar som inte skickats än skickas efter omladdningen.

declare const __BUILD_ID__: string;

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
let updateReady = false;

async function isNewVersionOut(): Promise<boolean> {
  try {
    const response = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return false;
    const { build } = (await response.json()) as { build: string };
    return build !== __BUILD_ID__;
  } catch {
    return false; // Offline: försök igen nästa gång.
  }
}

/** Ladda inte om mitt i att någon skriver. Då väntar vi tills appen öppnas nästa gång. */
function userIsTyping(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
}

async function check() {
  if (!updateReady) updateReady = await isNewVersionOut();
  if (updateReady && !userIsTyping()) location.reload();
}

export function startAutoUpdate() {
  if (!import.meta.env.PROD) return;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('focus', () => check());
  window.setInterval(() => {
    if (document.visibilityState === 'visible') check();
  }, CHECK_INTERVAL_MS);
}
