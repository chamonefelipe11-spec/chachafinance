// Service worker do chachafinance: só cuida de notificações.
// Não guarda páginas em cache, para cada deploy da Vercel aparecer na hora.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let dados = {};
  try {
    dados = e.data ? e.data.json() : {};
  } catch {
    dados = { corpo: e.data ? e.data.text() : '' };
  }
  const titulo = dados.titulo || 'chachafinance';
  e.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.corpo || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: dados.tag || undefined,
      data: { url: dados.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ('focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
