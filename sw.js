// Preview Studio · Service Worker v5
// v5 修复：图标重新生成后，旧 SW 缓存仍按 ps-v4 命中旧图标（iPad 主屏显示黑块）。
// 缓存名必须随图标更新一起提升，才能让已有客户端重新预缓存。
const CACHE="ps-v5";
// 只预缓存永远不变的静态资源（字体 CSS、图标）
const PRECACHE=[
  "./fonts.css",
  "./favicon.svg",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/apple-touch-icon-1024.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

// 页面可以通过 postMessage 主动要求清空全部缓存（用于发版后排障）
self.addEventListener("message",e=>{
  if(e.data==="clear-all"){
    e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))));
  }
});

function isHtmlPath(path){
  return path.endsWith(".html") || path.endsWith(".webmanifest") || path.endsWith("/");
}

self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET")return;
  const u=new URL(req.url);

  // 跨域（字体 CDN / sortablejs）：网络优先，失败直接放行空响应
  if(u.origin!==location.origin){
    e.respondWith(fetch(req).catch(()=>new Response("",{status:408})));
    return;
  }

  // HTML / manifest：强制网络优先，且 cache:"reload" 绕开 HTTP 缓存
  if(isHtmlPath(u.pathname)){
    e.respondWith(
      fetch(new Request(req.url,{cache:"reload",credentials:"same-origin"}))
        .then(res=>{
          if(res&&res.status===200){
            const copy=res.clone();
            caches.open(CACHE).then(c=>c.put(u.pathname,copy));
          }
          return res;
        })
        .catch(()=>caches.match(u.pathname,{ignoreSearch:true}).then(c=>c||new Response("离线 · 请检查网络",{status:503})))
    );
    return;
  }

  // 其余同源静态资源：缓存优先（忽略 query 差异，避免 ?v= 造成重复条目）+ 后台更新
  e.respondWith(
    caches.match(req,{ignoreSearch:true}).then(cached=>{
      const net=fetch(req).then(res=>{
        if(res&&res.status===200&&res.type==="basic"){
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(u.pathname,copy));
        }
        return res;
      }).catch(()=>cached);
      return cached||net;
    })
  );
});