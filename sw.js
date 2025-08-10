// ===== Patent OX PRO — patched sw.js =====
const CACHE='patent-ox-ui-final-v3'; // bump version to bust old caches
const ABS=(p)=>new URL(p,self.location).toString();
const ASSETS=['index.html','style.css','main.js','manifest.webmanifest','sw.js','packs.json','icon-192.png','icon-512.png'].map(ABS);

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',e=>{
  e.respondWith((async()=>{
    // Try network first to prefer fresh data, fallback to cache
    try{
      const r = await fetch(e.request, {cache:'no-store'});
      const cp = r.clone();
      const c = await caches.open(CACHE);
      c.put(e.request, cp);
      return r;
    }catch(_){
      const cached = await caches.match(e.request);
      if(cached) return cached;
      return caches.match(ABS('index.html'));
    }
  })());
});
