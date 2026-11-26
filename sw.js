// Preview Studio · 极简 Service Worker
// 仅负责缓存本地静态资源，让 PWA 安装后在弱网/离线也能打开
const CACHE="ps-v1";
const PRECACHE=[
  "./",
  "./index.html",
  "./preview-studio.html",
  "./collage-studio.html",
  "./dual-studio.html",
  "./qr-studio.html",
  "./unlock-generator.html",
  "./manifest.webmanifest",
  "./fonts.css",
  "./icons/apple-touch-icon.png",
  "./icons/apple-touch-icon-1024.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET")return;
  const u=new URL(req.url);
  // 跨域（字体 CDN / sortablejs 等）：网络优先，失败回缓存（SW 能拦截但无法主动缓存 opaque 响应）
  if(u.origin!==location.origin){
    e.respondWith(fetch(req).catch(()=>caches.match(req)));
    return;
  }
  // 同源：缓存优先 + 后台更新（stale-while-revalidate）
  e.respondWith(
    caches.match(req).then(cached=>{
      const net=fetch(req).then(res=>{
        if(res&&res.status===200&&res.type==="basic"){
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(req,copy));
        }
        return res;
      }).catch(()=>cached);
      return cached||net;
    })
  );
});
