const CACHE='patent-ox-ui-final-v1';
const ABS=(p)=>new URL(p,self.location).toString();
const ASSETS=['index.html','style.css','main.js','manifest.webmanifest','sw.js','packs.json','icon-192.png','icon-512.png'].map(ABS);
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{const cp=n.clone(); caches.open(CACHE).then(c=>c.put(e.request,cp)); return n;}).catch(()=>caches.match(ABS('index.html')))));
});