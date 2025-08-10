const CACHE='patent-ox-final-v1';
const ABS=(p)=>new URL(p,self.location).toString();
const ASSETS=['index.html','manifest.webmanifest','sw.js','data/statutes.json','data/enforcement.json','data/cases.json'].map(ABS);
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{const cp=n.clone(); caches.open(CACHE).then(c=>c.put(e.request,cp)); return n;}).catch(()=>caches.match(ABS('index.html')))));
});