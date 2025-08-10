const CACHE = 'patent-ox-pro-v3';
const ASSETS = [
  '/', '/index.html', '/manifest.webmanifest', '/sw.js',
  '/icon-192.png', '/icon-512.png',
  '/data/questions.json', '/data/cases.json'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate', e=>{
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', e=>{
  e.respondWith(
    caches.match(e.request).then(res=>{
      return res || fetch(e.request).then(net=>{
        const copy = net.clone();
        caches.open(CACHE).then(c=>c.put(e.request, copy));
        return net;
      }).catch(()=>caches.match('/index.html'));
    })
  );
});
