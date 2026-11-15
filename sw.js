/* Kampfzone als installierte App: Helfer im Hintergrund (Service Worker).
   Die Seite kommt immer frisch aus dem Netz (Updates sind sofort da). Ohne Internet erscheint ein Hinweis statt einer Fehlerseite. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;   // Bilder, Skripte, Mehrspieler: ganz normal über das Netz
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kampfzone</title>' +
    '<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;background:#0d120f;color:#ffcc33;font:20px Segoe UI,Arial,sans-serif">' +
    '<div>Kampfzone braucht eine Internetverbindung.<br><br><button onclick="location.reload()" style="font:inherit;padding:10px 18px;border:0;border-radius:8px;background:#ffcc33;color:#111">Nochmal versuchen</button></div></body>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
