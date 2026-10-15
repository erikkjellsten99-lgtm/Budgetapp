// Service worker som gör att appen går att öppna utan internet.
// Online hämtas allt från nätet, så att du alltid får senaste versionen, och en kopia sparas.
// Offline används den sparade kopian.

const CACHE = 'budget-v1';

self.addEventListener('install', (event) => {
  // Spara startsidan och filerna den länkar till (JS, CSS, ikoner) direkt,
  // så att appen fungerar offline redan efter första besöket.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const response = await fetch('./');
      const html = await response.clone().text();
      await cache.put('./', response);
      await cache.addAll([...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]));
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Ta bort gamla cachar (om CACHE har fått ett nytt namn) och ta över öppna flikar direkt.
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) event.waitUntil(cache.put(request, response.clone()));
        return response;
      } catch {
        // Offline. Saknas just den adressen i cachen visas startsidan.
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') return (await cache.match('./')) ?? Response.error();
        return Response.error();
      }
    })(),
  );
});
