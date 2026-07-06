const CACHE='irka-v4';
const CORE=['./','index.html','styles.css','course-data.js','gemini-client.js','app.js','assets/misa-lecturer.png','assets/misa-thinking.png','assets/misa-success.png','assets/scenes/water-systems.png','assets/scenes/heat-systems.png','assets/scenes/air-systems.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))).then(()=>self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))).then(()=>self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method==='GET'&&!e.request.url.includes('/api/'))e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))) });
