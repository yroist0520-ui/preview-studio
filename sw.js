// Preview Studio · Service Worker v2
// 修复：HTML 走网络优先（发版频繁变化），其余静态资源走缓存优先
const CACHE="ps-v2";
// 只预缓存永远不会变的静态资源（字体 CSS、图标）
const PRECACHE=[
  "./fonts.css",
  "./icons/apple-touch-icon.png",
  "./icons/apple-touch-icon-1024.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];
// HTML 文件：每次发版都变，不走预缓存，运行时也用 network-first
const HTML_FILES=["./","./index.html","./preview-studio.html","./collage-studio.html","./dual-studio.html","./qr-studio.html","./unlock-generator.html","./manifest.webmanifest"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET")return;
  const u=new URL(req.url);

  // 跨域（字体 CDN / sortablejs 等）：网络优先，失败静默（SW 无法缓存 opaque 响应）
  if(u.origin!==location.origin){
    e.respondWith(fetch(req).catch(()=>new Response("",{status:408})));
    return;
  }

  // HTML / manifest：网络优先 —— 每次发版都在变，必须拿到最新
  const path=u.pathname;
  const isHtml=HTML_FILES.some(h=>path.endsWith(h.replace(/^\.\//,""))) || path.endsWith(".html") || path.endsWith(".webmanifest") || path.endsWith("/");
  if(isHtml){
    e.respondWith(
      fetch(req).then(res=>{
        if(res&&res.status===200){
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(req,copy));
        }
        return res;
      }).catch(()=>caches.match(req).then(c=>c||new Response("离线 · 请检查网络",{status:503})))
    );
    return;
  }

  // 其余同源静态资源（字体 woff2、已缓存的图标）：缓存优先 + 后台更新（stale-while-revalidate）
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
