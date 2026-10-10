'use strict';
/* ===================================================================
   Dual Studio —— 壁纸 + 方图双画布模板编辑器
   数据模型：
   state = {
     mode: 'sync'|'indep',
     wp: { w,h, view, bg:{color,imgId,opacity,scale,x,y}, els:[...] },
     sq: { w,h, view, bg:{...}, els:[...], content:{scale,x,y}, infobar:{...} },
     images: { imgId: dataURL }
   }
   共享机制：sync 模式下方图直接渲染壁纸内容（缩放/裁剪由 sq.content 控制），
   独立元素存于 sq.els；indep 模式将壁纸内容拷贝为 sq.els 快照，两画布互不影响。
   =================================================================== */
(function(){
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const deep=o=>JSON.parse(JSON.stringify(o));
let UID=Date.now()%100000;
const uid=p=>p+(UID++).toString(36);

/* ---------- 图片仓库 ---------- */
const imgCache={};
function putImage(id,src){
  state.images[id]=src;
  const im=new Image();
  im.onload=()=>{drawAll();};
  im.onerror=()=>toast('图片加载失败','err');
  im.src=src; imgCache[id]=im;
}
/* 仅返回已成功解码的图片，避免未加载/损坏图片导致 drawImage 抛错中断整幅渲染 */
const getImg=id=>{
  const im=id&&imgCache[id];
  return (im&&im.complete&&im.naturalWidth>0)?im:null;
};

/* ---------- 默认状态 ---------- */
function mkText(o){return Object.assign({id:uid('t'),type:'text',x:0,y:0,w:400,h:120,rot:0,opacity:1,locked:false,hidden:false,
  text:'双击编辑',font:"-apple-system,'PingFang SC',sans-serif",size:60,color:'#2b2b2b',weight:'400',spacing:0,lh:1.3,align:'center',
  shadow:0,shadowColor:'#000000',shadowX:0,shadowY:0},o);}
function mkImg(o){return Object.assign({id:uid('i'),type:'image',x:0,y:0,w:400,h:400,rot:0,opacity:1,locked:false,hidden:false,imgId:null},o);}
function mkAvatar(o){return Object.assign({id:uid('a'),type:'avatar',x:0,y:0,w:220,h:220,rot:0,opacity:1,locked:false,hidden:false,imgId:null,
  shape:'rounded',radius:44,borderW:6,borderC:'#ffffff'},o);}
function mkShape(o){return Object.assign({id:uid('s'),type:'shape',x:0,y:0,w:400,h:120,rot:0,opacity:1,locked:false,hidden:false,
  shape:'rect',fill:'#ffffff',radius:24,iconText:'',iconColor:'#2b2b2b',iconSize:.5},o);}

/* 背景：type solid/gradient/dark · color/color2 渐变主副色 · dir 方向 · blur 高斯模糊 */
function mkBg(b){
  return Object.assign({type:'solid',color:'#eceef0',color2:'#ffffff',dir:'v',blur:0,
    imgId:null,opacity:1,scale:1,x:0,y:0},b||{});
}
/* 全屏水印配置：壁纸 / 方图各自独立一份 */
function mkWm(o){
  return Object.assign({enabled:false,imgId:null,blend:'overlay',scale:0.4,opacity:0.35,
    x:0.5,y:0.5,rot:0,gap:0.6,tile:true},o||{});
}

function hardcodedState(){
  /* 壁纸（锁屏排版）：状态栏 + 大时间 + 日期星期 + 底部按钮/横线 */
  const elStatusL = mkText({text:'5:20  ⚡★ 萌名愿!',x:70,y:56,w:560,h:60,size:44,weight:'600',color:'#2b2b2b',align:'left',opacity:.92});
  const elStatusR = mkText({text:'◍ 4G  ▮53',x:540,y:56,w:470,h:60,size:44,weight:'600',color:'#2b2b2b',align:'right',opacity:.92});
  const elTime    = mkText({text:'5:20',x:190,y:430,w:700,h:300,size:300,color:'#2b2b2b',weight:'700',spacing:6,shadow:16,shadowY:8});
  const elDate    = mkText({text:'5月21日    星期二',x:190,y:800,w:700,h:90,size:66,weight:'600',color:'#2f2f2f',shadow:10,shadowY:6});
  const btnL      = mkShape({shape:'circle',x:150,y:1960,w:130,h:130,fill:'#ffffff',shadow:26,group:'wpBtns'});
  const btnR      = mkShape({shape:'circle',x:800,y:1960,w:130,h:130,fill:'#ffffff',shadow:26,group:'wpBtns'});
  const elBar     = mkShape({shape:'rect',x:360,y:2240,w:360,h:12,radius:6,fill:'#2b2b2b',opacity:.75});
  const wpEls=[elStatusL,elStatusR,elTime,elDate,btnL,btnR,elBar];

  /* 方图（仿朋友圈个人主页）：封面背景图 + 右下角头像 + 昵称 + 个性签名 */
  const sqStatusL = mkText({text:'5:20  ⚡★ 萌名愿!',x:70,y:56,w:560,h:60,size:44,weight:'600',color:'#2b2b2b',align:'left',opacity:.92});
  const sqStatusR = mkText({text:'◍ 4G  ▮53',x:540,y:56,w:470,h:60,size:44,weight:'600',color:'#2b2b2b',align:'right',opacity:.92});
  /* 头像：右下角，轻微圆角，参考朋友圈头像位置 */
  const sqAvatar  = mkAvatar({x:780,y:780,w:220,h:220,radius:20,borderW:0});
  /* 昵称：头像左侧，与头像底部对齐 */
  const sqNick    = mkText({id:uid('t'),text:'点击编辑昵称',x:80,y:830,w:660,h:90,size:56,weight:'700',color:'#1a1a1a',align:'left'});
  /* 个性签名：昵称下方，可换行 */
  const sqSig     = mkText({id:uid('t'),text:'这里是个性签名\n可以换行写多句话',x:80,y:950,w:920,h:100,size:38,weight:'400',color:'#888888',align:'left'});
  const sqEls=[sqStatusL,sqStatusR,sqNick,sqSig,sqAvatar];

  return {
    mode:'sync',
    images:{},
    wp:{w:1080,h:2340,view:.30,bg:mkBg(),wm:mkWm(),els:wpEls},
    sq:{w:1080,h:1080,view:.40,bg:mkBg(),wm:mkWm(),
        els:sqEls,
        content:{scale:1,x:0,y:0},
        indep:null,
        infobar:{visible:false,x:0,y:900,w:1080,h:180,bg:'#ffffff',pad:46,gap:14,
          lines:[
            {text:'素材来源：某某某',size:36,color:'#8a8f96',weight:'400',align:'left',spacing:1,font:"-apple-system,'PingFang SC',sans-serif",visible:true},
            {text:'价格：某某某',size:46,color:'#2b2b2b',weight:'600',align:'left',spacing:1,font:"-apple-system,'PingFang SC',sans-serif",visible:true}
          ]}},
    ov:{
      w:2048,h:2048,view:.28,
      bg:mkBg({color:'#f1f2f4'}),
      wpSlot:{x:120,y:90,w:820,h:1840,pad:16,radius:44,shadow:40,bg:'#ffffff',visible:true,
        frame:'round',border:false,borderColor:'#e6e8ea',title:'',titleSize:30,titleColor:'#8a8f96'},
      sqSlot:{x:1040,y:594,w:900,h:860,pad:14,radius:40,shadow:40,bg:'#ffffff',visible:true,
        frame:'round',border:false,borderColor:'#e6e8ea',title:'',titleSize:30,titleColor:'#8a8f96'},
      signature:[
        {type:'line1',text:'署名：在此输入你的署名',font:"-apple-system,'PingFang SC',sans-serif",size:62,color:'#2b2b2b',weight:'700',align:'left',x:1040,y:1500,visible:true},
        {type:'line2',text:'价格：在此输入价格',font:"-apple-system,'PingFang SC',sans-serif",size:54,color:'#2b2b2b',weight:'600',align:'left',x:1040,y:1600,visible:true},
        {type:'line3',text:'番号：在此输入番号',font:"-apple-system,'PingFang SC',sans-serif",size:54,color:'#2b2b2b',weight:'600',align:'left',x:1040,y:1690,visible:true}
      ]
    }
  };
}

/* 运行时的默认模板：优先使用生成文件里的预设（window.DS_DEFAULT_STATE），否则回退到内置排版 */
let _dsDefaultTpl=null;
function defaultTemplate(){
  if(!_dsDefaultTpl){
    const base=(typeof window!=='undefined'&&window.DS_DEFAULT_STATE)?window.DS_DEFAULT_STATE:null;
    _dsDefaultTpl=base?deep(base):hardcodedState();
  }
  return _dsDefaultTpl;
}
/* 把默认状态里的图片载入图片仓库（已加载的跳过，避免重复解码） */
function loadStateImages(s){
  s.images=s.images||{};
  Object.entries(s.images).forEach(([id,src])=>{
    if(imgCache[id])return;
    const im=new Image();im.onload=()=>drawAll();im.src=src;imgCache[id]=im;
  });
}
/* 默认预设里的图片不写入本地缓存（体积大且可随时从默认文件还原） */
function mergeDefaultImages(s){
  const def=(typeof window!=='undefined'&&window.DS_DEFAULT_STATE&&window.DS_DEFAULT_STATE.images)||null;
  if(!def)return;
  s.images=s.images||{};
  Object.entries(def).forEach(([id,src])=>{if(!s.images[id])s.images[id]=src;});
}
/* 默认初始状态：以预设文件为模板，返回独立副本并预载图片 */
function defaultState(){
  const s=deep(defaultTemplate());
  loadStateImages(s);
  return s;
}

let state=null;
let active='ov';            // 当前编辑画布（总览舞台编辑的是方图内容）
let selIds=[];              // 选中元素 id（含 '__infobar'）
let wpSelId=null;           // 壁纸锁屏元素面板当前选中的元素 id
let copyBuf=[];             // 复制缓冲
let history={stack:[],idx:-1};
const AS_KEY='dual-studio-autosave-v5';

/* ---------- 历史 ---------- */
function snapshot(){
  history.stack=history.stack.slice(0,history.idx+1);
  history.stack.push(JSON.stringify(state));
  if(history.stack.length>60)history.stack.shift();
  history.idx=history.stack.length-1;
}
function restore(json){state=JSON.parse(json);selIds=[];fitViews();syncAllPanels();drawAll();saveAutosave();}
function undo(){if(history.idx>0){history.idx--;restore(history.stack[history.idx]);toast('已撤销');}else toast('没有可撤销的操作');}
function redo(){if(history.idx<history.stack.length-1){history.idx++;restore(history.stack[history.idx]);toast('已重做');}else toast('没有可重做的操作');}

/* ---------- 画布引用（现在只保留「总览」一张画布） ---------- */
const _cv={ov:'ovCanvas'};
const _ov={ov:'ovOvl'};
const _in={ov:'ovInner'};
const _ed={ov:'ovInline'};
const _st={};
function cv(n){return _cv[n]?$('#'+_cv[n]):null;}
function ovl(n){return _ov[n]?$('#'+_ov[n]):null;}
function inner(n){return _in[n]?$('#'+_in[n]):null;}
function ed(n){return _ed[n]?$('#'+_ed[n]):null;}
function C(n){return n==='wp'?state.wp:n==='sq'?state.sq:state.ov;}
/* 总览画布上可交互编辑的是「方图」内容：交互载体画布 */
function ec(n){return n==='ov'?state.sq:C(n);}
/* 交互舞台名 → 元素画布名（总览舞台编辑的是方图） */
function stageActive(n){return n==='ov'?'sq':n;}
const INFoid='__infobar';
/* 叠加层画布在当前屏幕上的显示比例（用于命中判定/手柄大小） */
function scaleOf(name){
  const o=ovl(name);if(!o)return 1;
  const c=ec(name);
  return (o.getBoundingClientRect().width/c.w)||1;
}

/* ---------- 视图缩放 ---------- */
function fitViews(){
  const wrap=$('#stageWrap');
  const mobile=window.innerWidth<=1080;
  const c=C('ov');
  let availW,availH;
  if(mobile){
    availW=window.innerWidth*0.86;
    availH=window.innerHeight*0.58;
  }else{
    availW=wrap.clientWidth-100;
    availH=wrap.clientHeight-90;
  }
  const s=Math.min(Math.max(availW,100)/c.w,Math.max(availH,120)/c.h);
  c.view=clamp(s,.04,3);
  applyStageSize('ov');
}
/* 方图在总览画布中的内容矩形（与 drawPreviewSlot 的变换保持一致） */
function ovSqRect(){
  const slot=state.ov.sqSlot,sq=state.sq;
  const p=slot.pad||0;
  const availW=slot.w-2*p,availH=slot.h-2*p;
  const ratio=Math.min(availW/sq.w,availH/sq.h);
  const dw=sq.w*ratio,dh=sq.h*ratio;
  const ox=slot.x+p+(availW-dw)/2,oy=slot.y+p+(availH-dh)/2;
  return {ox,oy,dw,dh,ratio};
}
function applyStageSize(name){
  const c=C(name),v=c.view;
  const el=inner(name);if(!el)return;
  el.style.width=(c.w*v)+'px';el.style.height=(c.h*v)+'px';
  const base=cv(name);
  if(base){
    base.width=c.w;base.height=c.h;
    base.style.width=(c.w*v)+'px';base.style.height=(c.h*v)+'px';
  }
  /* 叠加层：内部尺寸 = 方图原始尺寸，位置/显示尺寸 = 方图框内容区 */
  const o=ovl(name);
  if(o){
    const sq=state.sq,r=ovSqRect();
    o.width=sq.w;o.height=sq.h;
    o.style.left=(r.ox*v)+'px';o.style.top=(r.oy*v)+'px';
    o.style.width=(r.dw*v)+'px';o.style.height=(r.dh*v)+'px';
  }
  const zl=$('#'+name+'Zoomv');
  if(zl)zl.textContent=Math.round(v*100)+'%';
}
function setZoom(name,delta){
  const c=C(name);
  c.view=clamp((c.view+delta),.04,3);
  applyStageSize(name);drawAll();
}

/* ============================================================
   渲染
   ============================================================ */
function drawAll(){requestDraw('ov');}
let raf={ov:false};
function requestDraw(name){
  name='ov'; /* 现在只有总览一张画布 */
  if(raf[name])return;
  raf[name]=true;
  requestAnimationFrame(()=>{
    raf[name]=false;
    renderCanvas('ov');
  });
}

/* 背景底色：纯色 / 渐变 / 深色（与普通模板一致） */
function bgFill(ctx,c){
  const b=c.bg||{},type=b.type||'solid';
  if(type==='gradient'){
    let g;
    if(b.dir==='h')g=ctx.createLinearGradient(0,0,c.w,0);
    else if(b.dir==='d')g=ctx.createLinearGradient(0,0,c.w,c.h);
    else if(b.dir==='r')g=ctx.createRadialGradient(c.w/2,c.h/2,Math.min(c.w,c.h)*0.1,c.w/2,c.h/2,Math.max(c.w,c.h)*0.7);
    else g=ctx.createLinearGradient(0,0,0,c.h);
    g.addColorStop(0,b.color||'#eceef0');
    g.addColorStop(1,b.color2||'#ffffff');
    ctx.fillStyle=g;
  }else if(type==='dark'){
    const g=ctx.createLinearGradient(0,0,0,c.h);
    g.addColorStop(0,'#1a1a1a');g.addColorStop(1,'#000000');
    ctx.fillStyle=g;
  }else{
    ctx.fillStyle=b.color||'#eceef0';
  }
  ctx.fillRect(0,0,c.w,c.h);
}
/* 检测当前浏览器 canvas 是否真正支持 ctx.filter 模糊（部分 Safari 只接受赋值但不渲染，
   因此必须实测像素：模糊后边缘应出现介于黑白之间的中间灰度） */
const CANVAS_FILTER_OK=(()=>{
  try{
    const c=document.createElement('canvas');c.width=16;c.height=16;
    const x=c.getContext('2d');
    if(!x||typeof x.filter!=='string')return false;
    x.fillStyle='#ffffff';x.fillRect(0,0,16,16);
    x.filter='blur(3px)';
    x.fillStyle='#000000';x.fillRect(6,6,4,4);
    x.filter='none';
    const d=x.getImageData(0,0,16,16).data;
    for(let i=0;i<d.length;i+=4){
      const r=d[i],g=d[i+1],b=d[i+2];
      if(r>12&&r<243&&g>12&&g<243&&b>12&&b<243)return true;
    }
    return false;
  }catch(e){return false;}
})();
const blurCache={};
/* 不依赖 ctx.filter 的高质量模糊（全平台可用，尤其用于不支持 canvas filter 的 Safari）：
   单次大幅缩放会严重采样不足，产生锯齿、摩尔纹、块状（很丑），因此改为
   「逐级减半」构建降采样金字塔，再「逐级翻倍」平滑放大还原，得到接近真实高斯模糊的效果。 */
function blurredImage(im,id,blurPx){
  const q=Math.max(1,Math.round(blurPx));
  const key=id+'@'+q;
  if(blurCache[key])return blurCache[key];
  const w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;
  if(!w||!h)return null;
  const f=Math.max(1,q/3);                          // 目标降采样倍率
  const steps=Math.max(1,Math.min(7,Math.round(Math.log2(f))||1));
  const mk=function(cw,ch){
    const c=document.createElement('canvas');c.width=cw;c.height=ch;
    const x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';
    return x;
  };
  /* 1) 逐级减半降采样（每级仅缩小 2 倍，避免一次性大幅缩放的采样锯齿） */
  const levels=[im];
  let cur=im,cw=w,ch=h;
  for(let i=0;i<steps;i++){
    const nw=Math.max(1,Math.round(cw/2)),nh=Math.max(1,Math.round(ch/2));
    if(nw<1||nh<1)break;
    const x=mk(nw,nh);x.drawImage(cur,0,0,nw,nh);
    levels.push(x.canvas);cur=x.canvas;cw=nw;ch=nh;
    if(Math.min(cw,ch)<=1)break;
  }
  /* 2) 逐级翻倍放大回原始分辨率（双线性平滑，无块状） */
  let up=levels[levels.length-1];
  for(let i=levels.length-2;i>=0;i--){
    const L=levels[i];
    const x=mk(L.width,L.height);x.drawImage(up,0,0,L.width,L.height);
    up=x.canvas;
  }
  blurCache[key]=up;
  return up;
}
function drawBg(ctx,c){
  bgFill(ctx,c);
  const im=getImg(c.bg.imgId);
  if(im){
    const blur=Math.max(0,parseFloat(c.bg.blur)||0);
    ctx.save();
    ctx.globalAlpha=c.bg.opacity;
    const s=c.bg.scale;
    const iw=im.width*s,ih=im.height*s;
    const dx=(c.w-iw)/2+c.bg.x,dy=(c.h-ih)/2+c.bg.y;
    if(blur>0&&CANVAS_FILTER_OK){
      ctx.filter=`blur(${blur}px)`;
      const pad=blur; // 模糊时向外扩张，避免边缘露出底色
      safeDrawImg(ctx,im,dx-pad,dy-pad,iw+pad*2,ih+pad*2);
    }else if(blur>0){
      const bil=blurredImage(im,c.bg.imgId,blur);
      safeDrawImg(ctx,bil||im,dx,dy,iw,ih);
    }else{
      safeDrawImg(ctx,im,dx,dy,iw,ih);
    }
    ctx.restore();
  }
}
function drawTextBlock(ctx,el,boxW){
  ctx.font=`${el.weight} ${el.size}px ${el.font}`;
  if('letterSpacing' in ctx)ctx.letterSpacing=el.spacing+'px';
  ctx.textBaseline='top';
  const lines=String(el.text).split('\n');
  const lh=el.size*el.lh;
  lines.forEach((ln,i)=>{
    const w=ctx.measureText(ln).width;
    let x=0;
    if(el.align==='center')x=(boxW-w)/2;
    else if(el.align==='right')x=boxW-w;
    ctx.fillText(ln,x,i*lh);
  });
  if('letterSpacing' in ctx)ctx.letterSpacing='0px';
}
function roundRectPath(ctx,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
/* 原创装饰框型：round 圆角 / arch 拱顶 / corner 角标 */
function framePath(ctx,x,y,w,h,frame,r){
  if(frame==='arch'){
    const ar=Math.min(w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x,y+h);
    ctx.lineTo(x,y+ar);
    ctx.arc(x+w/2,y+ar,ar,Math.PI,0,false);
    ctx.lineTo(x+w,y+h);
    ctx.closePath();
  }else{
    roundRectPath(ctx,x,y,w,h,r);
  }
}
function drawCornerBrackets(ctx,slot){
  ctx.save();
  ctx.strokeStyle=slot.borderColor||'#c9a37c';
  ctx.lineWidth=Math.max(3,slot.w*0.008);
  ctx.lineCap='round';
  const L=Math.max(26,slot.w*0.12),m=-L*0.22;
  [[slot.x,slot.y,1,1],[slot.x+slot.w,slot.y,-1,1],
   [slot.x,slot.y+slot.h,1,-1],[slot.x+slot.w,slot.y+slot.h,-1,-1]].forEach(([cx,cy,sx,sy])=>{
    ctx.beginPath();
    ctx.moveTo(cx+sx*m,cy+sy*L);
    ctx.lineTo(cx+sx*m,cy+sy*m);
    ctx.lineTo(cx+sx*L,cy+sy*m);
    ctx.stroke();
  });
  ctx.restore();
}
/* 把任意 emoji / 颜文字 / 符号绘制成「单色扁平矢量」图标：
   先按字形绘制到离屏画布，再用 source-in 保留字形轮廓并整体填充为指定颜色 */
const _iconCache=new Map();
function vectorIconCanvas(t,color,boxPx){
  const box=Math.max(4,Math.round(boxPx));
  const key=t+'\u0001'+color+'\u0001'+box;
  const hit=_iconCache.get(key);if(hit)return hit;
  const DPR=2;
  const cv=document.createElement('canvas');
  cv.width=box*DPR;cv.height=box*DPR;
  const c=cv.getContext('2d');
  const fam="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','PingFang SC','Microsoft YaHei',sans-serif";
  let fs=box*DPR*0.8;
  c.font=fs+'px '+fam;
  const m=c.measureText(t);
  const tw=m.width||fs;
  const asc=(typeof m.actualBoundingBoxAscent==='number')?m.actualBoundingBoxAscent:fs*0.72;
  const dsc=(typeof m.actualBoundingBoxDescent==='number')?m.actualBoundingBoxDescent:fs*0.18;
  const th=(asc+dsc)||fs;
  const target=box*DPR*0.86;
  const k=Math.min(target/(tw||1),target/(th||1));
  if(k>0&&k<1)fs=fs*k;
  c.font=fs+'px '+fam;
  c.textAlign='center';c.textBaseline='middle';
  c.fillStyle='#000';
  c.fillText(t,cv.width/2,cv.height/2);
  c.globalCompositeOperation='source-in';
  c.fillStyle=color||'#2b2b2b';
  c.fillRect(0,0,cv.width,cv.height);
  if(_iconCache.size>240)_iconCache.clear();
  _iconCache.set(key,cv);
  return cv;
}
function drawEl(ctx,el){
  if(el.hidden)return;
  ctx.save();
  ctx.globalAlpha=el.opacity;
  ctx.translate(el.x+el.w/2,el.y+el.h/2);
  ctx.rotate(el.rot*Math.PI/180);
  ctx.translate(-el.w/2,-el.h/2);
  if(el.type==='text'){
    if(el.shadow){
      ctx.shadowColor=withAlpha(el.shadowColor||'#000000',.45);
      ctx.shadowBlur=el.shadow;
      ctx.shadowOffsetX=el.shadowX||0;
      ctx.shadowOffsetY=(el.shadowY==null?Math.round(el.shadow*0.4):el.shadowY);
    }
    ctx.fillStyle=el.color;drawTextBlock(ctx,el,el.w);
  }
  else if(el.type==='image'){
    const im=getImg(el.imgId);
    if(im){
      const s=Math.max(el.w/im.width,el.h/im.height);
      const iw=im.width*s,ih=im.height*s;
      safeDrawImg(ctx,im,(el.w-iw)/2,(el.h-ih)/2,iw,ih);
    }else{placeholder(ctx,el,'图片');}
  }
  else if(el.type==='avatar'){
    const im=getImg(el.imgId);
    ctx.save();
    if(el.shape==='circle'){ctx.beginPath();ctx.arc(el.w/2,el.h/2,Math.min(el.w,el.h)/2,0,7);ctx.clip();}
    else if(el.shape==='rounded'){roundRectPath(ctx,0,0,el.w,el.h,el.radius);ctx.clip();}
    else{ctx.beginPath();ctx.rect(0,0,el.w,el.h);ctx.clip();}
    if(im){
      const s=Math.max(el.w/im.width,el.h/im.height);
      const iw=im.width*s,ih=im.height*s;
      safeDrawImg(ctx,im,(el.w-iw)/2,(el.h-ih)/2,iw,ih);
    }else{
      ctx.fillStyle='#e3e6ea';ctx.fillRect(0,0,el.w,el.h);
      ctx.fillStyle='#9aa1a9';ctx.font=`600 ${Math.min(el.w,el.h)*.22}px sans-serif`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('LOGO',el.w/2,el.h/2);ctx.textAlign='left';
    }
    ctx.restore();
    if(el.borderW>0){
      ctx.strokeStyle=el.borderC;ctx.lineWidth=el.borderW;
      if(el.shape==='circle'){ctx.beginPath();ctx.arc(el.w/2,el.h/2,Math.min(el.w,el.h)/2-el.borderW/2,0,7);ctx.stroke();}
      else if(el.shape==='rounded'){roundRectPath(ctx,el.borderW/2,el.borderW/2,el.w-el.borderW,el.h-el.borderW,el.radius);ctx.stroke();}
      else ctx.strokeRect(el.borderW/2,el.borderW/2,el.w-el.borderW,el.h-el.borderW);
    }
  }
  else if(el.type==='shape'){
    if(el.shadow){ctx.shadowColor='rgba(0,0,0,.16)';ctx.shadowBlur=el.shadow;ctx.shadowOffsetY=el.shadow*0.4;}
    ctx.fillStyle=el.fill||'#ffffff';
    if(el.shape==='circle'){
      ctx.beginPath();ctx.arc(el.w/2,el.h/2,Math.min(el.w,el.h)/2,0,Math.PI*2);ctx.fill();
    }else{
      roundRectPath(ctx,0,0,el.w,el.h,el.radius||0);ctx.fill();
    }
    if(el.iconText){
      ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
      const box=Math.max(4,Math.min(el.w,el.h)*(el.iconSize==null?.5:el.iconSize));
      const ic=vectorIconCanvas(el.iconText,el.iconColor||'#2b2b2b',box);
      ctx.drawImage(ic,el.w/2-box/2,el.h/2-box/2,box,box);
    }
  }
  ctx.restore();
}
function placeholder(ctx,el,txt){
  ctx.fillStyle='#e3e6ea';ctx.fillRect(0,0,el.w,el.h);
  ctx.fillStyle='#9aa1a9';ctx.font=`600 ${Math.min(el.w,el.h)*.2}px sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(txt,el.w/2,el.h/2);ctx.textAlign='left';ctx.textBaseline='top';
}
function drawInfobar(ctx,sq,ib){
  if(!ib.visible)return;
  ctx.save();
  ctx.fillStyle=ib.bg;
  roundRectPath(ctx,ib.x,ib.y,ib.w,ib.h,0);
  ctx.fill();
  let y=ib.y+ib.pad;
  const innerW=ib.w-ib.pad*2;
  ib.lines.forEach(ln=>{
    if(!ln.visible)return;
    ctx.fillStyle=ln.color;
    ctx.font=`${ln.weight} ${ln.size}px ${ln.font||"-apple-system,'PingFang SC',sans-serif"}`;
    if('letterSpacing' in ctx)ctx.letterSpacing=ln.spacing+'px';
    ctx.textBaseline='top';
    const w=ctx.measureText(ln.text).width;
    let x=ib.x+ib.pad;
    if(ln.align==='center')x=ib.x+ib.pad+(innerW-w)/2;
    else if(ln.align==='right')x=ib.x+ib.pad+innerW-w;
    ctx.fillText(ln.text,x,y);
    if('letterSpacing' in ctx)ctx.letterSpacing='0px';
    y+=ln.size*1.5+ib.gap;
  });
  ctx.restore();
}

/* 把「壁纸 / 方图」的内容画进给定 ctx（供总览预览框与取色复用） */
function drawContent(ctx,kind){
  const cc=kind==='wp'?state.wp:state.sq;
  drawBg(ctx,cc);
  /* 先画白色信息栏，再画其他元素，最后补画头像，确保头像永远在最上层、不被信息栏遮挡 */
  if(kind==='sq')drawInfobar(ctx,cc,cc.infobar);
  cc.els.filter(el=>el.type!=='avatar').forEach(el=>drawEl(ctx,el));
  cc.els.filter(el=>el.type==='avatar').forEach(el=>drawEl(ctx,el));
  /* 全屏水印：覆盖在图层内容最上层，壁纸 / 方图各自独立配置 */
  drawWatermark(ctx,cc);
}
/* 全屏水印：以「画布长边」为基准等比计算尺寸，保证预览与导出比例一致 */
function drawWatermark(ctx,c){
  const wm=c&&c.wm;
  if(!wm||!wm.enabled)return;
  const im=getImg(wm.imgId);if(!im)return;
  const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;
  if(!iw||!ih)return;
  const canvasLong=Math.max(c.w,c.h);
  const k=(canvasLong*(wm.scale||0.4)*0.5)/Math.max(iw,ih);
  const w=iw*k,h=ih*k;
  const rot=(wm.rot||0)*Math.PI/180;
  ctx.save();
  ctx.globalAlpha=wm.opacity==null?1:wm.opacity;
  ctx.globalCompositeOperation=(wm.blend&&wm.blend!=='normal')?wm.blend:'source-over';
  if(wm.tile){
    const gap=wm.gap||0;
    const stepX=w*(1+gap),stepY=h*(1+gap);
    const ext=Math.hypot(c.w,c.h);
    ctx.translate(c.w/2,c.h/2);
    ctx.rotate(rot);
    ctx.translate(-c.w/2,-c.h/2);
    for(let y=-h-ext;y<c.h+h+ext;y+=stepY){
      for(let x=-w-ext;x<c.w+w+ext;x+=stepX){
        safeDrawImg(ctx,im,x,y,w,h);
      }
    }
  }else{
    ctx.translate(c.w*(wm.x==null?0.5:wm.x),c.h*(wm.y==null?0.5:wm.y));
    ctx.rotate(rot);
    safeDrawImg(ctx,im,-w/2,-h/2,w,h);
  }
  ctx.restore();
}
/* 信息栏可见时把旧存档头像限制在其上方；信息栏隐藏时不动（朋友圈布局头像在右下角） */
function clampAvatarAboveInfobar(cc){
  if(!cc||!Array.isArray(cc.els))return;
  const ib=cc.infobar||{};
  if(ib.visible===false)return;
  const ibTop=(typeof ib.y==='number')?ib.y:900;
  cc.els.forEach(el=>{
    if(el.type!=='avatar')return;
    const h=el.h||180;
    if((el.y||0)+h>ibTop-16)el.y=Math.max(24,ibTop-h-40);
  });
}
/* 旧默认署名文字 → 新默认文字（兼容用户本地旧存档，避免刷新后仍是旧文案） */
const OLD_SIG_MAP={
  '⚡★ 署名の美化小铺贩卖ing':'署名：在此输入你的署名',
  '販売価格：某某某':'价格：在此输入价格',
  '販壳価格：某某某':'价格：在此输入价格',
  '番号付け：某某某':'番号：在此输入番号'
};
function migrateSignatureText(s){
  if(!s||!s.ov||!Array.isArray(s.ov.signature))return;
  s.ov.signature.forEach(line=>{
    if(line&&Object.prototype.hasOwnProperty.call(OLD_SIG_MAP,line.text))line.text=OLD_SIG_MAP[line.text];
  });
  /* 移除历史默认的「下单发全署名」说明行（用户要求不再需要） */
  s.ov.signature=s.ov.signature.filter(line=>!(line&&line.type==='line4'&&/下单发全署名/.test(line.text||'')));
}
function renderCanvas(name){
  const canvas=cv('ov'),ctx=canvas.getContext('2d');
  const c=state.ov;
  ctx.clearRect(0,0,c.w,c.h);
  drawBg(ctx,c);
  if(c.wpSlot.visible)drawPreviewSlot(ctx,c.wpSlot,'wp');
  if(c.sqSlot.visible)drawPreviewSlot(ctx,c.sqSlot,'sq');
  drawOverviewSignature(ctx,c.signature);
  renderOvl('ov');
}
/* 合成画布：原创装饰预览框 + 阴影 + 内部缩放绘制子画布内容 */
function drawPreviewSlot(ctx,slot,kind){
  const frame=slot.frame||'round',rad=slot.radius||24;
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,.25)';
  ctx.shadowBlur=slot.shadow||0;
  ctx.shadowOffsetY=(slot.shadow||0)*0.35;
  framePath(ctx,slot.x,slot.y,slot.w,slot.h,frame,rad);
  ctx.fillStyle=slot.bg||'#ffffff';
  ctx.fill();
  ctx.restore();
  // 内部裁剪 + 缩放绘制
  ctx.save();
  const p=slot.pad||12;
  framePath(ctx,slot.x+p,slot.y+p,slot.w-2*p,slot.h-2*p,frame,rad-p*0.4);
  ctx.clip();
  const cc=kind==='wp'?state.wp:state.sq;
  const availW=slot.w-2*p,availH=slot.h-2*p;
  const ratio=Math.min(availW/cc.w,availH/cc.h);
  const dw=cc.w*ratio,dh=cc.h*ratio;
  const ox=slot.x+p+(availW-dw)/2,oy=slot.y+p+(availH-dh)/2;
  ctx.translate(ox,oy);ctx.scale(ratio,ratio);
  drawContent(ctx,kind);
  ctx.restore();
  // 双线描边
  if(slot.border){
    ctx.save();
    ctx.strokeStyle=slot.borderColor||'#c9a37c';
    ctx.lineWidth=Math.max(2,slot.w*0.006);
    framePath(ctx,slot.x,slot.y,slot.w,slot.h,frame,rad);
    ctx.stroke();
    const g=Math.max(7,slot.w*0.02);
    ctx.lineWidth=Math.max(1,slot.w*0.0022);
    framePath(ctx,slot.x+g,slot.y+g,slot.w-2*g,slot.h-2*g,frame,Math.max(2,rad-g*0.5));
    ctx.stroke();
    ctx.restore();
  }
  // 角标装饰
  if(frame==='corner')drawCornerBrackets(ctx,slot);
  // 底部标题
  if(slot.title){
    ctx.save();
    const ts=slot.titleSize||30;
    ctx.font=`600 ${ts}px -apple-system,'PingFang SC',sans-serif`;
    ctx.fillStyle=slot.titleColor||'#8a8f96';
    ctx.textAlign='center';ctx.textBaseline='top';
    if('letterSpacing' in ctx)ctx.letterSpacing='2px';
    ctx.fillText(slot.title,slot.x+slot.w/2,slot.y+slot.h+Math.max(10,ts*0.55));
    if('letterSpacing' in ctx)ctx.letterSpacing='0px';
    ctx.restore();
  }
}
function drawOverviewSignature(ctx,sigs){
  ctx.save();
  ctx.textBaseline='top';
  sigs.forEach(line=>{
    if(!line||!line.visible||!line.text)return;
    ctx.font=`${line.weight||'600'} ${line.size}px ${line.font||"-apple-system,'PingFang SC',sans-serif"}`;
    ctx.fillStyle=line.color||'#2b2b2b';
    if('letterSpacing' in ctx)ctx.letterSpacing='0px';
    const lines=String(line.text).split('\n');
    lines.forEach((ln,i)=>{
      let x=line.x;
      if(line.align==='right'){const w=ctx.measureText(ln).width;x=line.x-w;}
      else if(line.align==='center'){const w=ctx.measureText(ln).width;x=line.x-w/2;}
      ctx.fillText(ln,x,line.y+i*line.size*1.35);
    });
  });
  ctx.restore();
}
function renderOvl(name){
  const o=ovl(name);if(!o)return;
  const ctx=o.getContext('2d');
  const c=ec(name);
  ctx.clearRect(0,0,c.w,c.h);
  if(name!==active)return;
  const g=selGroupIds(name);
  if(g){
    const b=unionBBox(name,g);
    if(b)drawSelBox(ctx,b,true);
    return;
  }
  selIds.forEach(id=>{
    const b=getBBox(name,id);if(!b)return;
    drawSelBox(ctx,b,id!==INFoid&&selIds.length===1);
  });
}
function drawSelBox(ctx,b,withHandles){
  const sc=scaleOf(active)||1;
  ctx.save();
  ctx.translate(b.cx,b.cy);ctx.rotate(b.rot*Math.PI/180);
  ctx.strokeStyle='#4f7cff';ctx.lineWidth=Math.max(1,2/sc);
  const hs=Math.max(6,8/sc);
  ctx.strokeRect(-b.w/2,-b.h/2,b.w,b.h);
  if(withHandles){
    ctx.fillStyle='#fff';
    handlePts(b).forEach(h=>{
      ctx.beginPath();ctx.rect(h.x-hs/2,h.y-hs/2,hs,hs);
      ctx.fill();ctx.stroke();
    });
    const r=rotPt(b);
    ctx.beginPath();ctx.moveTo(0,-b.h/2);ctx.lineTo(r.x,r.y);ctx.stroke();
    ctx.beginPath();ctx.arc(r.x,r.y,hs*.8,0,7);ctx.fill();ctx.stroke();
  }
  ctx.restore();
}
function handlePts(b){
  const w=b.w/2,h=b.h/2;
  return [{x:-w,y:-h,k:'nw'},{x:0,y:-h,k:'n'},{x:w,y:-h,k:'ne'},{x:w,y:0,k:'e'},
          {x:w,y:h,k:'se'},{x:0,y:h,k:'s'},{x:-w,y:h,k:'sw'},{x:-w,y:0,k:'w'}];
}
function rotPt(b){return {x:0,y:-b.h/2-30/(scaleOf(active)||1)};}

/* ---------- bbox / 坐标换算 ---------- */
function getBBox(name,id){
  const c=ec(name);
  if(id===INFoid){
    const ib=c.infobar;if(!ib||!ib.visible)return null;
    return {cx:ib.x+ib.w/2,cy:ib.y+ib.h/2,w:ib.w,h:ib.h,rot:0};
  }
  const el=c.els.find(e=>e.id===id);
  if(!el||el.hidden)return null;
  return {cx:el.x+el.w/2,cy:el.y+el.h/2,w:el.w,h:el.h,rot:el.rot||0};
}
function findEl(name,id){
  if(id===INFoid)return null;
  return ec(name).els.find(x=>x.id===id)||null;
}
/* 联动分组：返回与 id 同属一个 group 的所有元素 id（无分组则只有自身） */
function groupIdsOf(name,id){
  const el=findEl(name,id);
  if(!el||!el.group)return [id];
  return ec(name).els.filter(e=>e.group===el.group).map(e=>e.id);
}
/* 当前多选若同属一个分组，返回该组 id 列表（否则 null） */
function selGroupIds(name){
  if(selIds.length<=1)return null;
  const ids=selIds.filter(id=>id!==INFoid);
  if(!ids.length||ids.length!==selIds.length)return null;
  const els=ids.map(id=>findEl(name,id));
  if(els.some(e=>!e)||!els[0].group)return null;
  const g=els[0].group;
  return els.every(e=>e.group===g)?ids:null;
}
/* 多个元素的并集包围盒（用于整组选中框 / 缩放 / 旋转） */
function unionBBox(name,ids){
  let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
  ids.forEach(id=>{const b=getBBox(name,id);if(!b)return;
    x1=Math.min(x1,b.cx-b.w/2);y1=Math.min(y1,b.cy-b.h/2);
    x2=Math.max(x2,b.cx+b.w/2);y2=Math.max(y2,b.cy+b.h/2);});
  if(x1===Infinity)return null;
  return {cx:(x1+x2)/2,cy:(y1+y2)/2,w:x2-x1,h:y2-y1,rot:0};
}
/* 当前选中的整体包围盒：整组用并集，单选用自身 */
function selBBox(name){
  const g=selGroupIds(name);
  if(g)return unionBBox(name,g);
  return selIds.length===1?getBBox(name,selIds[0]):null;
}
/* 整组对齐修复（一次性）：同组元素 → 统一尺寸、统一水平中线、整体相对画布水平居中 */
function normalizeGroups(name){
  const c=ec(name);if(!c||!c.els)return;
  const groups={};
  c.els.forEach(el=>{if(el.group&&!el.hidden){(groups[el.group]=groups[el.group]||[]).push(el);}});
  Object.keys(groups).forEach(gk=>{
    const arr=groups[gk];
    if(arr.length<2)return;
    const w=Math.max.apply(null,arr.map(e=>e.w));
    const h=Math.max.apply(null,arr.map(e=>e.h));
    const cy=arr.reduce((s,e)=>s+(e.y+e.h/2),0)/arr.length;
    arr.forEach(e=>{e.w=w;e.h=h;});
    const cxAvg=arr.reduce((s,e)=>s+(e.x+e.w/2),0)/arr.length;
    const shift=c.w/2-cxAvg;
    arr.forEach(e=>{
      e.x=Math.round(e.x+shift);
      e.y=Math.round(cy-h/2);
    });
  });
}
function toCanvasPt(name,e){
  const r=ovl(name).getBoundingClientRect();
  const c=ec(name);
  const sx=(r.width/c.w)||1,sy=(r.height/c.h)||1;
  return {x:(e.clientX-r.left)/sx,y:(e.clientY-r.top)/sy};
}
function toLocal(b,px,py){
  const a=-b.rot*Math.PI/180,dx=px-b.cx,dy=py-b.cy;
  return {x:dx*Math.cos(a)-dy*Math.sin(a),y:dx*Math.sin(a)+dy*Math.cos(a)};
}
function hitTest(name,px,py){
  const c=ec(name);
  const lists=[c.els.map(e=>e.id)];
  if(c.infobar&&c.infobar.visible)lists.push([INFoid]);
  for(const l of lists){
    for(let i=l.length-1;i>=0;i--){
      const id=l[i];
      const el=id===INFoid?null:findEl(name,id);
      if(el&&el.hidden)continue;
      const b=getBBox(name,id);if(!b)continue;
      const p=toLocal(b,px,py);
      if(Math.abs(p.x)<=b.w/2&&Math.abs(p.y)<=b.h/2)return id;
    }
  }
  return null;
}
function hitHandle(name,px,py){
  if(!selGroupIds(name)&&selIds.length!==1)return null;
  const b=selBBox(name);if(!b)return null;
  const tol=12/(scaleOf(name)||1);
  const lp=toLocal(b,px,py);
  for(const h of handlePts(b)){
    if(Math.abs(lp.x-h.x)<=tol&&Math.abs(lp.y-h.y)<=tol)return h.k;
  }
  const r=rotPt(b);
  if(Math.hypot(lp.x-r.x,lp.y-r.y)<=tol*1.2)return 'rot';
  return null;
}

/* ============================================================
   交互（指针：鼠标+触摸统一 pointer events）
   ============================================================ */
const drag={mode:null,name:null,start:null,items:[],handle:null,rot0:0,b0:null,groupIds:null,rotStart:0};
function bindStage(name){
  const o=ovl(name);
  o.addEventListener('pointerdown',e=>{
    if(name!==active)setActive(name);
    e.preventDefault();
    o.setPointerCapture(e.pointerId);
    const pt=toCanvasPt(name,e);
    const c=ec(name);
    const hk=hitHandle(name,pt.x,pt.y);
    if(hk){
      const g=selGroupIds(name);
      const single=g?null:(findEl(name,selIds[0])||(selIds[0]===INFoid?c.infobar:null));
      if(single&&(single.locked)){toast('元素已锁定，请先解锁','err');return;}
      snapshot();
      drag.mode=hk==='rot'?'rotate':'resize';drag.handle=hk;drag.name=name;drag.start=pt;
      const b=selBBox(name);
      drag.b0=b;
      drag.rot0=Math.atan2(pt.y-b.cy,pt.x-b.cx);
      drag.groupIds=g?g.slice():null;
      drag.items=[];
      if(g){
        drag.items=g.map(id=>{const el=findEl(name,id);
          return {el,x0:el.x,y0:el.y,w0:el.w,h0:el.h,rot0:el.rot||0,size0:el.size||0};});
      }else if(single){
        drag.rotStart=single.rot||0;
      }
      return;
    }
    const hit=hitTest(name,pt.x,pt.y);
    if(hit){
      const el=hit===INFoid?null:findEl(name,hit);
      if(el&&el.locked){selectOnly(hit);return;}
      if(e.shiftKey){
        if(selIds.includes(hit))selIds=selIds.filter(i=>i!==hit);
        else selIds=selIds.concat(groupIdsOf(name,hit).filter(i=>!selIds.includes(i)));
      }else if(!selIds.includes(hit))selIds=groupIdsOf(name,hit);
      snapshot();
      drag.mode='move';drag.name=name;drag.start=pt;drag.groupIds=null;
      drag.items=selIds.map(id=>{
        const el=id===INFoid?ec(name).infobar:findEl(name,id);
        return {el,sx:el.x,sy:el.y};
      });
      buildProps();buildLayerList();
    }else{
      if(!e.shiftKey)selectOnly(null);
    }
    drawAll();
  });
  o.addEventListener('pointermove',e=>{
    if(drag.mode&&drag.name===name){
      e.preventDefault();
      const pt=toCanvasPt(name,e);
      onDrag(pt);
    }else{
      const pt=toCanvasPt(name,e);
      const hk=hitHandle(name,pt.x,pt.y);
      const hit=hk?null:hitTest(name,pt.x,pt.y);
      o.style.cursor=hk?(hk==='rot'?'grab':cursorFor(hk)):(hit?'move':'default');
    }
  });
  const finish=e=>{if(drag.mode&&drag.name===name){drag.mode=null;saveAutosave();}};
  o.addEventListener('pointerup',finish);
  o.addEventListener('pointercancel',finish);
  o.addEventListener('dblclick',e=>{
    const pt=toCanvasPt(name,e);
    const hit=hitTest(name,pt.x,pt.y);
    const el=hit?findEl(name,hit):null;
    if(el&&el.type==='text'&&!el.locked)openTextEditor(name,el);
  });
}
function bBoxCy(){const b=selBBox(drag.name);return b?b.cy:0;}
function bBoxCx(){const b=selBBox(drag.name);return b?b.cx:0;}
function cursorFor(k){return {nw:'nwse-resize',se:'nwse-resize',ne:'nesw-resize',sw:'nesw-resize',n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize'}[k]||'default';}

function onDrag(pt){
  const name=drag.name;
  const dx=pt.x-drag.start.x,dy=pt.y-drag.start.y;
  if(drag.mode==='move'){
    drag.items.forEach(it=>{it.el.x=Math.round(it.sx+dx);it.el.y=Math.round(it.sy+dy);});
    buildProps();requestDraw(name);
    return;
  }
  if(drag.mode==='rotate'){
    const b=drag.b0||selBBox(name);
    if(!b)return;
    const a=Math.atan2(pt.y-b.cy,pt.x-b.cx);
    let dDeg=(a-drag.rot0)*180/Math.PI;
    if(drag.groupIds){
      if(eShift())dDeg=Math.round(dDeg/15)*15;
      const rad=dDeg*Math.PI/180;
      drag.items.forEach(it=>{
        const el=it.el;
        const cx0=it.x0+it.w0/2,cy0=it.y0+it.h0/2;
        const dx=cx0-b.cx,dy=cy0-b.cy;
        const ncx=b.cx+dx*Math.cos(rad)-dy*Math.sin(rad);
        const ncy=b.cy+dx*Math.sin(rad)+dy*Math.cos(rad);
        el.x=Math.round(ncx-el.w/2);el.y=Math.round(ncy-el.h/2);
        el.rot=Math.round((it.rot0||0)+dDeg);
      });
    }else{
      const el=findEl(name,selIds[0])||(selIds[0]===INFoid?ec(name).infobar:null);
      if(!el)return;
      let deg=(drag.rotStart||0)+dDeg;
      if(eShift())deg=Math.round(deg/15)*15;
      el.rot=Math.round(deg);
    }
    buildProps();requestDraw(name);
    return;
  }
  if(drag.mode==='resize'){
    const b=drag.b0||selBBox(name);
    if(!b)return;
    const lp=toLocal(b,pt.x,pt.y);
    const k=drag.handle;
    const hw=b.w/2,hh=b.h/2;
    let lx1,lx2,ly1,ly2;
    if(k.includes('w')){lx1=lp.x;lx2=hw;}
    else if(k.includes('e')){lx1=-hw;lx2=lp.x;}
    else{lx1=-hw;lx2=hw;}
    if(k==='n'){ly1=lp.y;ly2=hh;}
    else if(k==='s'){ly1=-hh;ly2=lp.y;}
    else if(k.includes('n')){ly1=lp.y;ly2=hh;}
    else if(k.includes('s')){ly1=-hh;ly2=lp.y;}
    else{ly1=-hh;ly2=hh;}
    let newW=Math.max(8,Math.abs(lx2-lx1));
    let newH=Math.max(8,Math.abs(ly2-ly1));
    if(drag.groupIds){
      const corner=(k==='nw'||k==='ne'||k==='sw'||k==='se');
      let s;
      if(corner)s=Math.max(newW/b.w,newH/b.h);
      else if(k==='e'||k==='w')s=newW/b.w;
      else s=newH/b.h;
      s=Math.max(0.05,Math.min(20,s));
      drag.items.forEach(it=>{
        const el=it.el;
        const nw=Math.max(2,Math.round(it.w0*s)),nh=Math.max(2,Math.round(it.h0*s));
        const cx0=it.x0+it.w0/2,cy0=it.y0+it.h0/2;
        const ncx=b.cx+(cx0-b.cx)*s,ncy=b.cy+(cy0-b.cy)*s;
        el.w=nw;el.h=nh;
        el.x=Math.round(ncx-nw/2);el.y=Math.round(ncy-nh/2);
        if(el.type==='text'&&it.size0)el.size=Math.max(2,Math.round(it.size0*s));
      });
      buildProps();requestDraw(name);
      return;
    }
    const el=findEl(name,selIds[0])||(selIds[0]===INFoid?ec(name).infobar:null);
    if(!el)return;
    const corner=(k==='nw'||k==='ne'||k==='sw'||k==='se');
    if(el.type==='text'&&corner&&b.h>0){
      const f=newH/b.h;
      el.size=Math.max(2,Math.round(el.size*f));
      newW=Math.max(newW,b.w*f);
    }
    const ncLocal={x:(lx1+lx2)/2,y:(ly1+ly2)/2};
    const rad=(el.rot||0)*Math.PI/180;
    const wc={x:ncLocal.x*Math.cos(rad)-ncLocal.y*Math.sin(rad),y:ncLocal.x*Math.sin(rad)+ncLocal.y*Math.cos(rad)};
    el.w=Math.round(newW);el.h=Math.round(newH);
    el.x=Math.round(b.cx+wc.x-newW/2);
    el.y=Math.round(b.cy+wc.y-newH/2);
    if(el.type==='text')el.h=Math.max(el.h,el.size*el.lh);
    buildProps();requestDraw(name);
  }
}
function eShift(){return window.event&&window.event.shiftKey;}

function selectOnly(id){selIds=id?[id]:[];buildProps();buildLayerList();drawAll();}

/* ---------- 双击行内编辑文字 ---------- */
function openTextEditor(name,el){
  const e=ed(name);if(!e)return;
  const c=ec(name);
  const sc=scaleOf(name)||1;
  const o=ovl(name);
  const ox=o?o.offsetLeft:0,oy=o?o.offsetTop:0;
  e.style.display='block';
  e.value=el.text;
  e.style.font=`${el.weight} ${el.size*sc}px ${el.font}`;
  e.style.color=el.color;
  e.style.letterSpacing=(el.spacing*sc)+'px';
  e.style.lineHeight=el.lh;
  e.style.textAlign=el.align;
  e.style.left=(ox+el.x*sc)+'px';
  e.style.top=(oy+el.y*sc)+'px';
  e.style.width=Math.max(el.w*sc,60)+'px';
  e.style.height=Math.max(el.h*sc,el.size*el.lh*sc)+'px';
  e.style.transform=el.rot?`rotate(${el.rot}deg)`:'none';
  e.focus();e.select();
  e.oninput=()=>{
    el.text=e.value;
    e.style.height='auto';
    e.style.height=Math.max(e.scrollHeight,el.size*el.lh*sc)+'px';
    requestDraw(name);
  };
  e.onblur=()=>{e.style.display='none';snapshot();saveAutosave();buildLayerList();};
  e.onkeydown=ev=>{
    if(ev.key==='Escape'){e.onblur();e.blur();}
    ev.stopPropagation();
  };
}

/* ============================================================
   元素操作 API
   ============================================================ */
function addText(name){
  snapshot();
  const c=ec(name);
  const el=mkText({x:c.w/2-200,y:c.h/2-40,w:400,h:100,text:'新文字',size:60});
  c.els.push(el);
  setActive(name);selectOnly(el.id);saveAutosave();
}
function addImageTo(name,dataURL){
  snapshot();
  const im=new Image();
  im.onload=()=>{
    const c=ec(name);
    const s=Math.min((c.w*.8)/im.width,(c.h*.8)/im.height);
    const el=mkImg({imgId:currentUploadImgId,w:Math.round(im.width*s),h:Math.round(im.height*s),
      x:Math.round((c.w-im.width*s)/2),y:Math.round((c.h-im.height*s)/2)});
    c.els.push(el);
    setActive(name);selectOnly(el.id);saveAutosave();toast(name==='ov'?'已添加到方图画布':'已添加到画布');
  };
  im.onerror=()=>toast('图片解析失败','err');
  const id=uid('img');
  currentUploadImgId=id;
  putImage(id,dataURL);
  im.src=dataURL;
}
let currentUploadImgId=null;
function addAvatarTo(dataURL){
  const im=new Image();
  im.onload=()=>{
    snapshot();
    const sq=state.sq;
    const el=mkAvatar({imgId:currentUploadImgId,w:230,h:230,x:sq.w-300,y:sq.infobar.y-300});
    sq.els.push(el);
    setActive('sq');selectOnly(el.id);saveAutosave();toast('头像已添加（可拖动/缩放）');
  };
  im.onerror=()=>toast('头像解析失败','err');
  const id=uid('img');
  currentUploadImgId=id;
  putImage(id,dataURL);
  im.src=dataURL;
}
/* 上传头像：替换方图里的头像占位图（默认在信息栏上方，不会被信息栏遮挡） */
/* 安全绘制图片到 canvas（大图/异常图片不应导致整体崩溃） */
function safeDrawImg(ctx,img,x,y,w,h){
  try{ctx.drawImage(img,x,y,w||img.width,h||img.height);return true;}
  catch(e){console.error('drawImage fail',e);return false;}
}
function uploadAvatar(dataURL){
  const im=new Image();
  im.onload=()=>{
    snapshot();
    const el=avatarEl();
    if(!el)return toast('未找到头像占位','err');
    const id=uid('img');
    putImage(id,dataURL);
    el.imgId=id;
    drawAll();syncBgSection();saveAutosave();
    toast('头像已更新');
  };
  im.onerror=()=>toast('头像解析失败，请换 JPG/PNG','err');
  im.src=dataURL;
}
function setBgImage(name,dataURL){
  const im=new Image();
  im.onload=()=>{
    snapshot();
    const c=C(name);
    const id=uid('bg');
    putImage(id,dataURL);
    const s=Math.max(c.w/im.width,c.h/im.height);
    c.bg.imgId=id;c.bg.scale=s;c.bg.x=0;c.bg.y=0;c.bg.opacity=1;
    drawAll();syncBgSection();saveAutosave();
  };
  im.onerror=()=>toast('背景图片解析失败，请换 JPG/PNG','err');
  im.src=dataURL;
}
/* 从壁纸/方图/总览背景图片提取主色调，填入总览底图的渐变背景 */
function pickBgColors(from){
  const isOv=from==='ov';
  const cc=isOv?state.ov:(from==='wp'?state.wp:state.sq);
  const name=isOv?'背景图':(from==='wp'?'壁纸':'方图');
  if(isOv&&!(cc.bg&&cc.bg.imgId))return toast('请先在「总览背景」上传背景图片','err');
  /* 图片可能尚未解码完成，先等解码再取色，避免取到空白底色 */
  const pending=Object.keys(state.images||{}).filter(id=>!getImg(id));
  if(pending.length){
    toast('图片解码中，稍候自动取色…');
    Promise.all(pending.map(id=>new Promise(res=>{
      const im=new Image();
      im.onload=()=>res();im.onerror=()=>res();
      im.src=state.images[id];imgCache[id]=im;
    }))).then(()=>{drawAll();setTimeout(()=>pickBgColors(from),80);});
    return;
  }
  const off=document.createElement('canvas');off.width=cc.w;off.height=cc.h;
  const o=off.getContext('2d');
  /* 优先只采样背景图片本身，避免白色信息栏/文字干扰取色；无图片时才取整幅内容 */
  if(isOv)drawBg(o,state.ov);
  else if(cc.bg&&cc.bg.imgId&&getImg(cc.bg.imgId))drawBg(o,cc);
  else drawContent(o,from);
  const sw=96,sh=96;
  const small=document.createElement('canvas');small.width=sw;small.height=sh;
  const so=small.getContext('2d');
  try{so.drawImage(off,0,0,sw,sh);}catch(e){return toast('取色失败','err');}
  let data;
  try{data=so.getImageData(0,0,sw,sh).data;}catch(e){return toast('取色失败：画布受限','err');}
  const buckets={};
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]<128)continue;
    const r=Math.floor(data[i]/16)*16,g=Math.floor(data[i+1]/16)*16,b=Math.floor(data[i+2]/16)*16;
    const key=r+'_'+g+'_'+b;
    if(!buckets[key])buckets[key]={count:0,r,g,b};
    buckets[key].count++;
  }
  const sorted=Object.values(buckets).sort((a,b)=>b.count-a.count);
  if(!sorted.length)return toast('未能提取到颜色','err');
  const dist=(a,b)=>Math.abs(a.r-b.r)+Math.abs(a.g-b.g)+Math.abs(a.b-b.b);
  const isVivid=c=>{const mx=Math.max(c.r,c.g,c.b),mn=Math.min(c.r,c.g,c.b);return (mx-mn)>24&&mx<250&&mn>10;};
  const vivid=sorted.filter(isVivid);
  const main=vivid[0]||sorted[0];
  /* 副色：从高频色里挑与主色差异最大的一个，保证渐变肉眼可见 */
  let sub=null,best=-1;
  sorted.slice(0,10).forEach(c=>{const d=dist(c,main);if(d>best){best=d;sub=c;}});
  if(best<40)sub=null;
  const shift=(c,d)=>({r:Math.min(255,Math.max(0,c.r+d)),g:Math.min(255,Math.max(0,c.g+d)),b:Math.min(255,Math.max(0,c.b+d))});
  const hx=v=>'#'+[v.r,v.g,v.b].map(x=>('0'+Math.round(x).toString(16)).slice(-2)).join('');
  const c1=sub||shift(main,54);
  const c2=shift(main,-54);
  snapshot();
  const ob=state.ov.bg;
  ob.type='gradient';
  ob.color=hx(c1);
  ob.color2=hx(c2);
  if(!ob.dir)ob.dir='v';
  drawAll();syncBgSection();saveAutosave();
  toast(`已从${name}取色：${hx(c1)} → ${hx(c2)}`);
}
function removeEl(){
  if(!selIds.length)return toast('请先选择元素');
  snapshot();
  const c=ec(active);
  selIds.forEach(id=>{
    if(id===INFoid)return;
    const i=c.els.findIndex(e=>e.id===id);
    if(i>=0)c.els.splice(i,1);
  });
  selectOnly(null);saveAutosave();
}
function copySel(){
  if(!selIds.length)return toast('请先选择元素');
  const c=ec(active);
  copyBuf=selIds.filter(i=>i!==INFoid).map(id=>deep(findEl(active,id))).filter(Boolean);
  toast(copyBuf.length?`已复制 ${copyBuf.length} 个元素`:'信息栏不可复制');
}
function pasteSel(){
  if(!copyBuf.length)return toast('剪贴板为空，请先复制元素');
  snapshot();
  const c=ec(active);
  const newIds=[];
  copyBuf.forEach(t=>{
    const el=deep(t);el.id=uid(t.type==='text'?'t':t.type==='avatar'?'a':t.type==='shape'?'s':'i');
    el.x+=30;el.y+=30;
    c.els.push(el);newIds.push(el.id);
  });
  setActive(active);selIds=newIds;buildProps();buildLayerList();drawAll();saveAutosave();
}
function duplicateSel(){copySel();pasteSel();}
function toggleLockSel(){
  if(!selIds.length)return toast('请先选择元素');
  snapshot();
  selIds.forEach(id=>{
    const el=id===INFoid?ec(active).infobar:findEl(active,id);
    if(el)el.locked=!el.locked;
  });
  buildLayerList();buildProps();saveAutosave();
}
function toggleHideSel(){
  if(!selIds.length)return toast('请先选择元素');
  snapshot();
  selIds.forEach(id=>{
    if(id===INFoid){const ib=ec(active).infobar;ib.visible=!ib.visible;return;}
    const el=findEl(active,id);
    if(el)el.hidden=!el.hidden;
  });
  buildLayerList();buildProps();drawAll();saveAutosave();
}
function layerOp(op){
  if(!selIds.length)return toast('请先选择元素');
  snapshot();
  const c=ec(active);
  selIds.forEach(id=>{
    if(id===INFoid)return;
    let list=c.els;
    let i=list.findIndex(e=>e.id===id);
    if(i<0)return;
    const [el]=list.splice(i,1);
    if(op==='top')list.push(el);
    else if(op==='bottom')list.unshift(el);
    else if(op==='up')list.splice(Math.min(i+1,list.length),0,el);
    else if(op==='down')list.splice(Math.max(0,i-1),0,el);
  });
  buildLayerList();drawAll();saveAutosave();
}
function nudge(dx,dy){
  if(!selIds.length)return;
  selIds.forEach(id=>{
    const el=id===INFoid?ec(active).infobar:findEl(active,id);
    if(el&&!el.locked){el.x+=dx;el.y+=dy;}
  });
  buildProps();drawAll();saveAutosave();
}

/* ---------- 模式切换 ---------- */
function setMode(m){
  if(m===state.mode)return;
  if(m==='sync'&&state.sq.indep){
    if(!confirm('切回同步模式后，方图背景将重新跟随壁纸（当前的独立背景设置会被放弃），是否继续？'))return;
  }
  snapshot();
  if(m==='indep'){
    /* 独立模式：把壁纸背景复制一份给方图，之后两者背景互不影响（元素本来就各自独立） */
    state.sq.bg=deep(state.wp.bg);
    state.sq.indep={bg:deep(state.wp.bg)};
  }else{
    /* 同步模式：方图背景重新跟随壁纸 */
    state.sq.indep=null;
  }
  state.mode=m;
  $('#modeSync').classList.toggle('on',m==='sync');
  $('#modeIndep').classList.toggle('on',m==='indep');
  buildLayerList();buildProps();drawAll();saveAutosave();
  toast(m==='sync'?'同步模式：方图背景跟随壁纸':'独立模式：方图背景与壁纸各自独立');
}
function copyWpToSq(){
  snapshot();
  const sq=state.sq;
  state.wp.els.forEach(el=>{
    const cp=deep(el);cp.id=uid('c');
    sq.els.push(cp);
  });
  setActive('sq');buildLayerList();drawAll();saveAutosave();
  toast('已把壁纸全部元素复制到方图（独立副本）');
}

/* ============================================================
   面板：图层 / 属性
   ============================================================ */
function elName(el){
  if(el.type==='text')return (el.text||'').split('\n')[0].slice(0,10)||'文字';
  if(el.type==='avatar')return el.imgId?'头像/Logo':'头像占位';
  if(el.type==='shape')return el.shape==='circle'?'圆形装饰':(el.h<=20?'线条':'白色方块');
  return el.imgId?'图片':'空图片';
}
function buildLayerList(){
  const box=$('#layerList');if(!box)return;
  box.innerHTML='';
  const c=ec(active);
  const items=[];
  if(c.infobar&&c.infobar.visible)items.push({id:INFoid,name:'白色信息栏',ic:'▬',el:c.infobar});
  c.els.forEach(el=>items.push({id:el.id,name:elName(el),ic:el.type==='text'?'T':el.type==='avatar'?'☺':el.type==='shape'?'▢':'🖼',el}));
  items.slice().reverse().forEach(it=>{
    const d=document.createElement('div');
    d.className='layerItem'+(selIds.includes(it.id)?' sel':'');
    d.innerHTML=`<span class="ic">${it.el.hidden?'🚫':it.ic}</span><span class="nm">${escapeHtml(it.name)}</span>`;
    const lk=document.createElement('button');lk.className='mini';lk.textContent=it.el.locked?'🔒':'🔓';lk.title='锁定/解锁';
    lk.onclick=ev=>{ev.stopPropagation();selIds=[it.id];toggleLockSel();};
    const hd=document.createElement('button');hd.className='mini';hd.textContent=it.el.hidden?'👁':'🙈';hd.title='显示/隐藏';
    hd.onclick=ev=>{ev.stopPropagation();selIds=[it.id];toggleHideSel();};
    d.append(hd,lk);
    d.onclick=()=>{
      if(window.event&&window.event.shiftKey){if(!selIds.includes(it.id))selIds.push(it.id);}
      else selIds=[it.id];
      buildLayerList();buildProps();drawAll();
    };
    box.appendChild(d);
  });
}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

const FONTS=[
  ["默认黑体","-apple-system,'PingFang SC','Microsoft YaHei',sans-serif"],
  ["Inter","'Inter',sans-serif"],
  ["思源宋体","'Noto Serif SC',serif"],
  ["马善政毛笔","'Ma Shan Zheng',cursive"],
  ["龙藏体","'Long Cang',cursive"],
  ["站酷小薇","'ZCOOL XiaoWei',serif"],
  ["站酷庆科黄油体","'ZCOOL QingKe HuangYou',sans-serif"],
  ["Liu手写","'Liu Jian Mao Cao',cursive"],
  ["Caveat","'Caveat',cursive"],
  ["Dancing Script","'Dancing Script',cursive"],
  ["Playfair","'Playfair Display',serif"]
];
function fopts(sel){
  return FONTS.map(([n,v])=>`<option value="${escapeHtml(v)}" ${v===sel?'selected':''}>${n}</option>`).join('');
}
function buildProps(){
  const box=$('#propBody'),empty=$('#emptyProp');
  if(!box||!empty)return;
  if(!selIds.length){box.style.display='none';empty.style.display='block';return;}
  if(selIds.length>1){
    box.style.display='block';empty.style.display='none';
    box.innerHTML=`<p class="hint">已选中 ${selIds.length} 个元素（组合）。拖动可整体移动；缩放/旋转请只选中一个。</p>`;
    return;
  }
  const id=selIds[0];
  const el=id===INFoid?ec(active).infobar:findEl(active,id);
  if(!el){box.style.display='none';empty.style.display='block';return;}
  box.style.display='block';empty.style.display='none';
  const isIb=id===INFoid;
  const {w:cw, h:ch} = ec(active);
  const op=el.opacity==null?1:el.opacity;
  const rng=(k,label,val,min,max,step,fmt,disp)=>{
    const f=fmt?` data-fmt="${fmt}"`:'';
    return `<div class="f"><label>${label}<b class="pv">${disp!==undefined?disp:val}</b></label><input type="range" data-pk="${k}"${f} min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
  };
  let html=`<div class="grid2">
    ${rng('x','X 位置',Math.round(el.x),0,cw,1)}
    ${rng('y','Y 位置',Math.round(el.y),0,ch,1)}
    ${rng('w','宽度',Math.round(el.w),0,cw,1)}
    ${rng('h','高度',Math.round(el.h),0,ch,1)}
  </div>
  <div class="grid2">
    ${rng('rot','旋转',el.rot||0,-180,180,1,'deg',(el.rot||0)+'°')}
    ${rng('opacity','透明度',op,0,1,0.01,'pct',Math.round(op*100)+'%')}
  </div>`;
  if(isIb){
    html+=`<div class="f"><label>信息栏底色</label><input type="color" data-pk="bg" value="${el.bg}"></div>
    <div class="grid2">${rng('pad','内边距',el.pad,0,200,1)}${rng('gap','行间距',el.gap,0,120,1)}</div>
    <p class="hint">提示：信息栏始终位于最上层保护显示，画布中可直接拖动/拉伸手柄调整位置与大小。</p>`;
  }else if(el.type==='text'){
    html+=`<div><label>文字内容（支持换行）</label><textarea data-pk="text" rows="2">${escapeHtml(el.text)}</textarea></div>
    <div class="f"><label>字体</label><select data-pk="font">${fopts(el.font)}</select></div>
    ${rng('size','字号',el.size,4,600,1)}
    <div class="f"><label>颜色</label><input type="color" data-pk="color" value="${toHex(el.color)}"></div>
    <div class="f"><label>字重</label><select data-pk="weight">${['300','400','500','600','700','800'].map(w=>`<option ${w===el.weight?'selected':''}>${w}</option>`).join('')}</select></div>
    <div class="grid2">${rng('spacing','字间距',el.spacing,-20,60,0.5)}${rng('lh','行高倍数',el.lh,0.8,3,0.05)}</div>
    <div class="f"><label>对齐</label><select data-pk="align">${['left','center','right'].map(a=>`<option ${a===el.align?'selected':''}>${a==='left'?'左':a==='center'?'中':'右'}</option>`).join('')}</select></div>
    <div class="grid2">${rng('shadow','阴影模糊',el.shadow||0,0,80,1)}${rng('shadowY','阴影偏移',el.shadowY||0,-60,60,1)}</div>
    <div class="f"><label>阴影颜色</label><input type="color" data-pk="shadowColor" value="${toHex(el.shadowColor||'#000000')}"></div>`;
  }else if(el.type==='avatar'){
    html+=`<div class="f"><label>形状</label><select data-pk="shape">
      <option value="circle" ${el.shape==='circle'?'selected':''}>圆形</option>
      <option value="rounded" ${el.shape==='rounded'?'selected':''}>圆角方形</option>
      <option value="square" ${el.shape==='square'?'selected':''}>正方形</option></select></div>
    <div class="grid2">${rng('radius','圆角',el.radius,0,400,1)}${rng('borderW','边框宽',el.borderW,0,60,1)}</div>
    <div class="f"><label>边框色</label><input type="color" data-pk="borderC" value="${toHex(el.borderC)}"></div>
    <div class="row"><button class="primary" id="pbReplace">替换头像图片</button><button class="danger" id="pbDelEl">删除头像</button></div>`;
  }else if(el.type==='image'){
    html+=`<div class="row"><button class="primary" id="pbReplace">替换图片</button><button class="danger" id="pbDelEl">删除图片</button></div>
    <p class="hint">图片以「封面裁剪」方式填充选框：拖动角点控制点即可同时完成缩放与裁剪。</p>`;
  }else if(el.type==='shape'){
    html+=`<div class="f"><label>形状</label><select data-pk="shape">
      <option value="rect" ${el.shape==='rect'?'selected':''}>矩形 / 线条</option>
      <option value="circle" ${el.shape==='circle'?'selected':''}>圆形</option></select></div>
    <div class="f"><label>填充色</label><input type="color" data-pk="fill" value="${toHex(el.fill||'#ffffff')}"></div>
    ${rng('radius','圆角',el.radius||0,0,400,1)}
    <div class="row"><button class="danger" id="pbDelEl">删除</button></div>
    <p class="hint">用于白色方块 / 装饰线条 / 圆形按钮：拖动可移动，拉角点可缩放，高度调小即为一条横线。</p>`;
  }
  html+=`<div class="grid2"><button id="pbDup">复制元素</button><button id="pbLock">${el.locked?'解锁':'锁定'}</button></div>`;
  box.innerHTML=html;
  box.querySelectorAll('[data-pk]').forEach(inp=>{
    inp.addEventListener('input',()=>{
      const k=inp.dataset.pk;
      const t=inp.type;
      let v=t==='number'||t==='range'?parseFloat(inp.value):inp.value;
      if(k==='opacity')el.opacity=v;else if(['text','font','weight','align','shape','color','fill'].indexOf(k)<0&&isNaN(v))return;
      if(k==='text')el.text=inp.value;
      else if(k==='font')el.font=inp.value;
      else if(k==='weight')el.weight=inp.value;
      else if(k==='align')el.align=inp.value;
      else if(k==='shape')el.shape=inp.value;
      else el[k]=v;
      if(el.type==='text'&&(k==='size'||k==='lh'))el.h=Math.max(el.h,el.size*el.lh);
      requestDraw(active);saveAutosaveDebounced();
    });
    inp.addEventListener('change',()=>snapshot());
  });
  const rep=$('#pbReplace');
  if(rep)rep.onclick=()=>replaceTarget(el);
  const del=$('#pbDelEl');
  if(del)del.onclick=removeEl;
  $('#pbDup').onclick=duplicateSel;
  $('#pbLock').onclick=toggleLockSel;
}
function toHex(c){
  if(/^#/.test(c))return c.length===4?'#'+[...c.slice(1)].map(x=>x+x).join(''):c;
  return '#000000';
}
/* 把十六进制颜色转成带透明度的 rgba（用于文字阴影） */
function withAlpha(c,a){
  const h=toHex(c).slice(1);
  const n=parseInt(h,16);
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';
}
let replaceEl=null;
function replaceTarget(el){replaceEl=el;$('#fileReplace').click();}
function bindReplaceInput(){
  const inp=$('#fileReplace');
  inp.onchange=()=>{
    const f=inp.files[0];inp.value='';
    if(!f||!replaceEl)return;
    readAsDataURL(f).then(url=>{
      snapshot();
      const id=uid('img');
      putImage(id,url);
      replaceEl.imgId=id;
      drawAll();saveAutosave();toast('已替换图片');
    });
  };
}

/* ============================================================
   文件读取
   ============================================================ */
function readAsDataURL(f){
  return new Promise((res,rej)=>{
    if(!/^image\/(png|jpe?g|webp)$/i.test(f.type))return rej(new Error('仅支持 PNG / JPG / JPEG / WebP 格式'));
    const r=new FileReader();
    r.onload=()=>res(r.result);r.onerror=rej;
    r.readAsDataURL(f);
  });
}
/* 解码图片文件：优先 createImageBitmap（可在解码时缩放，大图更稳），失败回退 objectURL + Image */
const MAX_IMG_DIM=1600;
function loadImageFile(file){
  return new Promise((resolve,reject)=>{
    const fail=()=>reject(new Error('图片解码失败，请换成 JPG / PNG 格式再试（HEIC 请先转成 JPG）'));
    const useImg=()=>{
      const url=URL.createObjectURL(file);
      const im=new Image();
      im.onload=()=>{URL.revokeObjectURL(url);resolve(im);};
      im.onerror=()=>{URL.revokeObjectURL(url);fail();};
      im.src=url;
    };
    if(window.createImageBitmap){
      createImageBitmap(file).then(resolve).catch(useImg);
    }else useImg();
  });
}
/* 等比缩放到上限尺寸后重新编码为 dataURL，避免超大图解码失败 / 超出存储上限 */
function toScaledDataURL(file,maxDim){
  maxDim=maxDim||MAX_IMG_DIM;
  return loadImageFile(file).then(src=>{
    const sw=src.width||src.naturalWidth,sh=src.height||src.naturalHeight;
    if(!sw||!sh)throw new Error('图片尺寸异常，无法读取');
    const r=Math.min(1,maxDim/Math.max(sw,sh));
    const dw=Math.max(1,Math.round(sw*r)),dh=Math.max(1,Math.round(sh*r));
    const cv=document.createElement('canvas');cv.width=dw;cv.height=dh;
    cv.getContext('2d').drawImage(src,0,0,dw,dh);
    if(src.close)try{src.close();}catch(e){}
    const png=/png/i.test(file.type||'');
    return cv.toDataURL(png?'image/png':'image/jpeg',png?undefined:0.88);
  });
}
function bindUpload(inputId,fn){
  const inp=$(inputId);
  if(!inp)return; // 对应上传入口已移除时跳过
  inp.onchange=async()=>{
    const f=inp.files[0];inp.value='';
    if(!f)return;
    if(f.type&&!/^image\//i.test(f.type))return toast('请选择图片文件','err');
    try{
      const url=await toScaledDataURL(f);
      fn(url,f);
    }catch(err){toast(err.message||'读取失败','err');}
  };
}

/* ============================================================
   导出
   ============================================================ */
async function renderExport(name){
  const c=state.ov;
  const off=document.createElement('canvas');
  off.width=c.w;off.height=c.h;
  const ctx=off.getContext('2d');
  try{await document.fonts.ready;}catch(e){}
  drawBg(ctx,c);
  if(c.wpSlot.visible)drawPreviewSlot(ctx,c.wpSlot,'wp');
  if(c.sqSlot.visible)drawPreviewSlot(ctx,c.sqSlot,'sq');
  drawOverviewSignature(ctx,c.signature);
  return off;
}
function download(canvas,filename){
  try{
    const a=document.createElement('a');
    a.download=filename;
    a.href=canvas.toDataURL('image/png');
    document.body.appendChild(a);a.click();a.remove();
  }catch(e){toast('导出失败：'+e.message,'err');}
}
async function exportOne(name){
  toast('正在导出…');
  try{
    const off=await renderExport('ov');
    download(off,`总览合成_${state.ov.w}x${state.ov.h}.png`);
    toast('总览合成已导出');
  }catch(e){toast('导出失败：'+(e.message||e),'err');}
}
async function exportBoth(){await exportOne('ov');}
async function exportOverview(){await exportOne('ov');}

/* ============================================================
   保存 / 恢复 / JSON
   ============================================================ */
let asTimer=null;
let asCompressing=false;
function saveAutosaveDebounced(){clearTimeout(asTimer);asTimer=setTimeout(saveAutosave,600);}
/* 存储用副本：默认预设里的图片不写入本地缓存（体积大且可随时从默认文件还原），其余原样保留 */
function stateForStore(){
  const copy=Object.assign({},state);
  const imgs=Object.assign({},state.images||{});
  const def=(typeof window!=='undefined'&&window.DS_DEFAULT_STATE&&window.DS_DEFAULT_STATE.images)||null;
  if(def)Object.keys(imgs).forEach(id=>{if(def[id]&&imgs[id]===def[id])delete imgs[id];});
  copy.images=imgs;
  return copy;
}
function saveAutosave(){
  if(tryStore(AS_KEY,stateForStore()))return true;
  if(asCompressing)return false;
  asCompressing=true;
  saveAutosaveCompress().finally(()=>{asCompressing=false;});
  return false;
}
function tryStore(key,obj){
  try{localStorage.setItem(key,JSON.stringify(obj));return true;}catch(e){return false;}
}
function loadDataUrlImg(src){
  return new Promise((res,rej)=>{
    const im=new Image();
    im.onload=()=>res(im);im.onerror=()=>rej(new Error('decode failed'));
    im.src=src;
  });
}
/* 单张图片重压缩：等比缩小到 max 边长后重新编码，PNG 保留透明通道 */
function recompressDataUrl(src,max,quality){
  return loadDataUrlImg(src).then(im=>{
    const sw=im.naturalWidth||im.width,sh=im.naturalHeight||im.height;
    if(!sw||!sh)throw new Error('bad image');
    const r=Math.min(1,max/Math.max(sw,sh));
    if(r>=1&&/^data:image\/jpeg/i.test(src))return src;
    const dw=Math.max(1,Math.round(sw*r)),dh=Math.max(1,Math.round(sh*r));
    const cv=document.createElement('canvas');cv.width=dw;cv.height=dh;
    cv.getContext('2d').drawImage(im,0,0,dw,dh);
    const keepAlpha=/^data:image\/png/i.test(src);
    return cv.toDataURL(keepAlpha?'image/png':'image/jpeg',keepAlpha?undefined:quality);
  });
}
/* 本地缓存超限时的兜底：先逐张重压缩（缩尺寸+降质量）尽量保住图片，实在放不下才仅存排版 */
async function saveAutosaveCompress(){
  const light=deep(stateForStore());
  const ids=Object.keys(light.images||{});
  for(const id of ids){
    try{
      light.images[id]=await recompressDataUrl(light.images[id],1400,0.85);
      if(tryStore(AS_KEY,light))return;
      light.images[id]=await recompressDataUrl(light.images[id],1000,0.78);
      if(tryStore(AS_KEY,light))return;
    }catch(e){}
  }
  if(ids.length){
    ids.forEach(id=>delete light.images[id]);
    ['wp','sq','ov'].forEach(n=>{if(light[n]&&light[n].bg&&ids.indexOf(light[n].bg.imgId)>=0)light[n].bg.imgId=null;});
    [light.wp.els,light.sq.els].forEach(arr=>(arr||[]).forEach(el=>{if(ids.indexOf(el.imgId)>=0)el.imgId=null;}));
    if(tryStore(AS_KEY,light)){
      toast('本地缓存空间不足，已仅保存排版配置（图片请重新上传）','err');
      return;
    }
  }
  console.warn('autosave failed: quota exceeded');
}
function restoreAutosave(){
  try{
    const raw=localStorage.getItem(AS_KEY);
    if(!raw)return false;
    const s=JSON.parse(raw);
    if(!s||!s.wp||!s.sq)return false;
    // 兼容旧版本缺失的顶层字段，防止 upgrade 后脏数据继续炸
    s.images=s.images||{};
    s.mode=s.mode||'sync';
    s.wp.bg=mkBg(s.wp.bg);
    s.sq.bg=mkBg(s.sq.bg);
    s.sq.content=s.sq.content||{scale:1,x:0,y:0};
    if(!s.ov){
      s.ov=deep(defaultTemplate().ov);
    }else{
      s.ov.bg=mkBg(s.ov.bg);
      const dOv=deep(defaultTemplate().ov);
      s.ov.wpSlot=Object.assign({},dOv.wpSlot,s.ov.wpSlot||{});
      s.ov.sqSlot=Object.assign({},dOv.sqSlot,s.ov.sqSlot||{});
      s.ov.signature=s.ov.signature||[];
      migrateSignatureText(s);
    }
    state=s;
    mergeDefaultImages(state);
    clampAvatarAboveInfobar(state.sq);
    loadStateImages(state);
    return true;
  }catch(e){console.warn('restoreAutosave failed, falling back to defaults',e);return false;}
}
function exportJSON(){
  const blob=new Blob([JSON.stringify(state,null,1)],{type:'application/json'});
  const a=document.createElement('a');
  a.download='dual-studio-template.json';
  a.href=URL.createObjectURL(blob);
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  toast('JSON 已导出');
}
/* 把一份 state 对象规范化后应用（供「导入模板 / 载入预设 / 导入预设文件」复用） */
function applyStateObject(s,msg){
  if(!s||!s.wp||!s.sq)throw new Error('文件格式不正确');
  snapshot();
  state=s;
  state.images=state.images||{};state.mode=state.mode||'sync';
  state.wp.bg=mkBg(state.wp.bg);state.wp.wm=mkWm(state.wp.wm);
  state.sq.bg=mkBg(state.sq.bg);state.sq.wm=mkWm(state.sq.wm);
  state.sq.content=state.sq.content||{scale:1,x:0,y:0};
  const dOv=deep(defaultTemplate().ov);
  state.ov=state.ov||dOv;
  state.ov.bg=mkBg(state.ov.bg);
  state.ov.wpSlot=Object.assign({},dOv.wpSlot,state.ov.wpSlot||{});
  state.ov.sqSlot=Object.assign({},dOv.sqSlot,state.ov.sqSlot||{});
  state.ov.signature=state.ov.signature||[];
  migrateSignatureText(state);
  clampAvatarAboveInfobar(state.sq);
  Object.entries(state.images).forEach(([id,src])=>{
    const im=new Image();im.onload=()=>drawAll();im.src=src;imgCache[id]=im;
  });
  selIds=[];fitViews();buildLayerList();syncAllPanels();drawAll();saveAutosave();
  const ms=$('#modeSync'),mi=$('#modeIndep');
  if(ms)ms.classList.toggle('on',state.mode==='sync');
  if(mi)mi.classList.toggle('on',state.mode==='indep');
  if(msg)toast(msg);
  return true;
}
function importJSONFile(file){
  const r=new FileReader();
  r.onload=()=>{
    try{applyStateObject(JSON.parse(r.result),'模板已导入');}
    catch(e){toast('导入失败：'+e.message,'err');}
  };
  r.readAsText(file);
}

/* ============================================================
   预设存档槽 + 导入 / 导出预设文件
   ============================================================ */
const PRESET_KEY='dual-studio-presets-v1';
const PRESET_SLOTS=5;
function readPresets(){
  try{return JSON.parse(localStorage.getItem(PRESET_KEY)||'{}')||{};}catch(e){return {};}
}
function buildPresetGrid(){
  const grid=$('#presetGrid');if(!grid)return;
  let html='';
  for(let i=1;i<=PRESET_SLOTS;i++){
    html+='<div class="presetRow">'
      +'<button data-slot="'+i+'" data-act="save">存到 '+i+'</button>'
      +'<button data-slot="'+i+'" data-act="load" class="empty">载入 '+i+'</button>'
      +'</div>';
  }
  grid.innerHTML=html;
  grid.querySelectorAll('button[data-act]').forEach(btn=>{
    btn.onclick=()=>{btn.dataset.act==='save'?savePreset(+btn.dataset.slot):loadPreset(+btn.dataset.slot);};
  });
  refreshPresetUI();
}
function refreshPresetUI(){
  const presets=readPresets();
  document.querySelectorAll('#presetGrid button[data-act="load"]').forEach(btn=>{
    btn.classList.toggle('empty',!presets[btn.dataset.slot]);
  });
}
function savePreset(n){
  const presets=readPresets();
  presets[n]={t:Date.now(),data:deep(state)};
  try{
    localStorage.setItem(PRESET_KEY,JSON.stringify(presets));
    refreshPresetUI();toast('已保存到预设槽 '+n);
  }catch(e){
    const light=deep(state);light.images={};
    ['wp','sq','ov'].forEach(k=>{if(light[k]&&light[k].bg)light[k].bg.imgId=null;});
    [light.wp.els,light.sq.els].forEach(arr=>(arr||[]).forEach(el=>{if(el.imgId)el.imgId=null;}));
    ['wp','sq'].forEach(k=>{if(light[k]&&light[k].wm)light[k].wm.imgId=null;});
    presets[n]={t:Date.now(),data:light,noImages:true};
    try{
      localStorage.setItem(PRESET_KEY,JSON.stringify(presets));
      refreshPresetUI();toast('存储空间不足，已仅保存排版（图片需重新上传）','err');
    }catch(e2){toast('预设保存失败：本地存储空间不足','err');}
  }
}
function loadPreset(n){
  const presets=readPresets();
  const rec=presets[n];
  if(!rec||!rec.data)return toast('预设槽 '+n+' 为空，请先存档','err');
  if(!confirm('载入预设槽 '+n+' 将覆盖当前编辑内容，确定继续？'))return;
  try{applyStateObject(rec.data,'已载入预设槽 '+n+(rec.noImages?'（图片需重新上传）':''));}
  catch(e){toast('载入失败：'+e.message,'err');}
}
/* ---------- LZString 压缩（内联，用于生成短分享链接） ---------- */
const LZString=(function(){
  const f=String.fromCharCode;
  const keyStrUriSafe="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  const baseReverseDic={};
  function getBaseValue(alphabet,character){
    if(!baseReverseDic[alphabet]){
      baseReverseDic[alphabet]={};
      for(let i=0;i<alphabet.length;i++)baseReverseDic[alphabet][alphabet.charAt(i)]=i;
    }
    return baseReverseDic[alphabet][character];
  }
  function _compress(uncompressed,bitsPerChar,getCharFromInt){
    if(uncompressed==null)return"";
    let i,value,context_dictionary={},context_dictionaryToCreate={},context_c="",context_wc="",context_w="",context_enlargeIn=2,context_dictSize=3,context_numBits=2,context_data=[],context_data_val=0,context_data_position=0,ii;
    for(ii=0;ii<uncompressed.length;ii++){
      context_c=uncompressed.charAt(ii);
      if(!Object.prototype.hasOwnProperty.call(context_dictionary,context_c)){
        context_dictionary[context_c]=context_dictSize++;
        context_dictionaryToCreate[context_c]=true;
      }
      context_wc=context_w+context_c;
      if(Object.prototype.hasOwnProperty.call(context_dictionary,context_wc)){
        context_w=context_wc;
      }else{
        if(Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)){
          if(context_w.charCodeAt(0)<256){
            for(i=0;i<context_numBits;i++){
              context_data_val=(context_data_val<<1);
              if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}
            }
            value=context_w.charCodeAt(0);
            for(i=0;i<8;i++){
              context_data_val=(context_data_val<<1)|(value&1);
              if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}
              value=value>>1;
            }
          }else{
            value=1;
            for(i=0;i<context_numBits;i++){
              context_data_val=(context_data_val<<1)|value;
              if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}
              value=0;
            }
            value=context_w.charCodeAt(0);
            for(i=0;i<16;i++){
              context_data_val=(context_data_val<<1)|(value&1);
              if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}
              value=value>>1;
            }
          }
          context_enlargeIn--;
          if(context_enlargeIn==0){context_enlargeIn=Math.pow(2,context_numBits);context_numBits++;}
          delete context_dictionaryToCreate[context_w];
        }else{
          value=context_dictionary[context_w];
          for(i=0;i<context_numBits;i++){
            context_data_val=(context_data_val<<1)|(value&1);
            if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}
            value=value>>1;
          }
        }
        context_enlargeIn--;
        if(context_enlargeIn==0){context_enlargeIn=Math.pow(2,context_numBits);context_numBits++;}
        context_dictionary[context_wc]=context_dictSize++;
        context_w=String(context_c);
      }
    }
    if(context_w!==""){
      if(Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)){
        if(context_w.charCodeAt(0)<256){
          for(i=0;i<context_numBits;i++){
            context_data_val=(context_data_val<<1);
            if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}
          }
          value=context_w.charCodeAt(0);
          for(i=0;i<8;i++){
            context_data_val=(context_data_val<<1)|(value&1);
            if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}
            value=value>>1;
          }
        }else{
          value=1;
          for(i=0;i<context_numBits;i++){
            context_data_val=(context_data_val<<1)|value;
            if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}
            value=0;
          }
          value=context_w.charCodeAt(0);
          for(i=0;i<16;i++){
            context_data_val=(context_data_val<<1)|(value&1);
            if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}
            value=value>>1;
          }
        }
        context_enlargeIn--;
        if(context_enlargeIn==0){context_enlargeIn=Math.pow(2,context_numBits);context_numBits++;}
        delete context_dictionaryToCreate[context_w];
      }else{
        value=context_dictionary[context_w];
        for(i=0;i<context_numBits;i++){
          context_data_val=(context_data_val<<1)|(value&1);
          if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}
          value=value>>1;
        }
      }
      context_enlargeIn--;
      if(context_enlargeIn==0){context_enlargeIn=Math.pow(2,context_numBits);context_numBits++;}
    }
    value=2;
    for(i=0;i<context_numBits;i++){
      context_data_val=(context_data_val<<1)|(value&1);
      if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}
      value=value>>1;
    }
    while(true){
      context_data_val=(context_data_val<<1);
      if(context_data_position==bitsPerChar-1){context_data.push(getCharFromInt(context_data_val));break;}else context_data_position++;
    }
    return context_data.join("");
  }
  function _decompress(length,resetValue,getNextValue){
    let dictionary=[],enlargeIn=4,dictSize=4,numBits=3,entry="",result=[],i,w,bits,resb,maxpower,power,c,data={val:getNextValue(0),position:resetValue,index:1};
    for(i=0;i<3;i++)dictionary[i]=i;
    bits=0;maxpower=Math.pow(2,2);power=1;
    while(power!=maxpower){
      resb=data.val&data.position;
      data.position>>=1;
      if(data.position==0){data.position=resetValue;data.val=getNextValue(data.index++);}
      bits|=(resb>0?1:0)*power;
      power<<=1;
    }
    switch(bits){
      case 0:bits=0;maxpower=Math.pow(2,8);power=1;while(power!=maxpower){resb=data.val&data.position;data.position>>=1;if(data.position==0){data.position=resetValue;data.val=getNextValue(data.index++);}bits|=(resb>0?1:0)*power;power<<=1;}c=f(bits);break;
      case 1:bits=0;maxpower=Math.pow(2,16);power=1;while(power!=maxpower){resb=data.val&data.position;data.position>>=1;if(data.position==0){data.position=resetValue;data.val=getNextValue(data.index++);}bits|=(resb>0?1:0)*power;power<<=1;}c=f(bits);break;
      case 2:return"";
    }
    dictionary[3]=c;w=c;result.push(c);
    while(true){
      if(data.index>length)return"";
      bits=0;maxpower=Math.pow(2,numBits);power=1;
      while(power!=maxpower){
        resb=data.val&data.position;
        data.position>>=1;
        if(data.position==0){data.position=resetValue;data.val=getNextValue(data.index++);}
        bits|=(resb>0?1:0)*power;
        power<<=1;
      }
      switch(c=bits){
        case 0:bits=0;maxpower=Math.pow(2,8);power=1;while(power!=maxpower){resb=data.val&data.position;data.position>>=1;if(data.position==0){data.position=resetValue;data.val=getNextValue(data.index++);}bits|=(resb>0?1:0)*power;power<<=1;}dictionary[dictSize++]=f(bits);c=dictSize-1;enlargeIn--;break;
        case 1:bits=0;maxpower=Math.pow(2,16);power=1;while(power!=maxpower){resb=data.val&data.position;data.position>>=1;if(data.position==0){data.position=resetValue;data.val=getNextValue(data.index++);}bits|=(resb>0?1:0)*power;power<<=1;}dictionary[dictSize++]=f(bits);c=dictSize-1;enlargeIn--;break;
        case 2:return result.join("");
      }
      if(enlargeIn==0){enlargeIn=Math.pow(2,numBits);numBits++;}
      if(dictionary[c]){entry=dictionary[c];}else{if(c===dictSize){entry=w+w.charAt(0);}else{return null;}}
      result.push(entry);
      dictionary[dictSize++]=w+entry.charAt(0);
      enlargeIn--;
      w=entry;
      if(enlargeIn==0){enlargeIn=Math.pow(2,numBits);numBits++;}
    }
  }
  return {
    compressToEncodedURIComponent:function(input){if(input==null)return"";return _compress(input,6,function(a){return keyStrUriSafe.charAt(a);});},
    decompressFromEncodedURIComponent:function(input){if(input==null)return"";if(input=="")return null;input=input.replace(/ /g,"+");return _decompress(input.length,32,function(index){return getBaseValue(keyStrUriSafe,input.charAt(index));});}
  };
})();

/* ---------- 预设分享链接（不含图片，接收方图片需重新上传） ---------- */
function stripImages(src){
  const light=deep(src);light.images={};
  ['wp','sq','ov'].forEach(k=>{if(light[k]&&light[k].bg)light[k].bg.imgId=null;});
  [light.wp.els,light.sq.els].forEach(arr=>(arr||[]).forEach(el=>{if(el.imgId)el.imgId=null;}));
  ['wp','sq'].forEach(k=>{if(light[k]&&light[k].wm)light[k].wm.imgId=null;});
  return light;
}
function fallbackCopyText(t){
  const ta=document.createElement('textarea');
  ta.value=t;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');}catch(e){}
  document.body.removeChild(ta);
}
function copyText(t){
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).catch(()=>fallbackCopyText(t));
  }else fallbackCopyText(t);
}
function makePresetLink(){
  const payload={type:'dual-studio-preset',v:1,s:stripImages(state)};
  const code=LZString.compressToEncodedURIComponent(JSON.stringify(payload));
  const url=location.origin+location.pathname+'?p='+code;
  const inp=$('#presetLink');if(inp)inp.value=url;
  copyText(url);
  toast('已生成分享链接并复制，可直接发给别人');
}
function copyPresetLink(){
  const inp=$('#presetLink');
  const v=inp&&inp.value.trim();
  if(!v)return toast('请先点「生成分享链接」','err');
  copyText(v);toast('链接已复制');
}
function parsePresetLink(input){
  let s=String(input||'').trim();
  if(!s)throw new Error('请输入链接或短码');
  const m=s.match(/[?&#]p=([^&#\s]+)/);
  if(m)s=m[1];
  const json=LZString.decompressFromEncodedURIComponent(s);
  if(!json)throw new Error('无法解析链接');
  const obj=JSON.parse(json);
  return obj&&obj.s?obj.s:obj;
}
function importPresetLink(){
  const inp=$('#presetLink');
  try{
    const s=parsePresetLink(inp&&inp.value);
    if(!confirm('导入分享链接将覆盖当前编辑内容，确定继续？'))return;
    applyStateObject(s,'已导入分享预设（图片需重新上传）');
  }catch(e){toast('导入失败：'+e.message,'err');}
}
function importPresetFromClipboard(){
  if(navigator.clipboard&&navigator.clipboard.readText){
    navigator.clipboard.readText().then(txt=>{
      const inp=$('#presetLink');if(inp)inp.value=txt||'';
      importPresetLink();
    }).catch(()=>toast('无法读取剪贴板，请手动粘贴','err'));
  }else toast('当前浏览器不支持读取剪贴板，请手动粘贴','err');
}
function bindPresetPanel(){
  buildPresetGrid();
  const mk=$('#btnMakeLink');if(mk)mk.onclick=makePresetLink;
  const cp=$('#btnCopyLink');if(cp)cp.onclick=copyPresetLink;
  const im=$('#btnImportLink');if(im)im.onclick=importPresetLink;
  const ps=$('#btnPasteImport');if(ps)ps.onclick=importPresetFromClipboard;
}

/* ============================================================
   风格预设
   ============================================================ */
const PRESETS={
  gray:{name:'浅灰简约',bg:'#eceef0',ink:'#2b2b2b',sub:'#8a8f96',wm:'#8a8f96',wmOp:.34},
  white:{name:'纯白极简',bg:'#ffffff',ink:'#1c1c1c',sub:'#9aa1a9',wm:'#c8cdd6',wmOp:.4},
  pink:{name:'浅粉甜系',bg:'#f9ebef',ink:'#7a4b57',sub:'#c58fa0',wm:'#e5b7c5',wmOp:.45},
  dark:{name:'深色高对比',bg:'#141414',ink:'#f5f5f5',sub:'#9aa1a9',wm:'#f5f5f5',wmOp:.14},
};
function applyPreset(key){
  const p=PRESETS[key];if(!p)return;
  snapshot();
  const paint=list=>list.forEach(el=>{
    if(el.type!=='text')return;
    if(el.size>=150)el.color=p.ink;
    else if(el.opacity<.6){el.color=p.wm;el.opacity=p.wmOp;}
    else if(el.weight==='600'||el.weight==='700')el.color=p.ink;
    else el.color=p.sub;
  });
  paint(state.wp.els);
  paint(state.sq.els);
  state.wp.bg.type='solid';state.wp.bg.color=p.bg;
  state.sq.bg.type='solid';state.sq.bg.color=p.bg;
  const ib=state.sq.infobar;
  if(p===PRESETS.dark){ib.bg='#1f1f1f';ib.lines.forEach((l,i)=>l.color=i===0?'#9aa1a9':'#f5f5f5');}
  else{ib.bg='#ffffff';ib.lines.forEach((l,i)=>l.color=i===0?p.sub:p.ink);}
  state.ov.bg.type='solid';state.ov.bg.color=p.bg;
  drawAll();syncBgSection();buildIbPanel();syncIbPanel();saveAutosave();
  toast(`已应用「${p.name}」预设`);
}

/* ============================================================
   信息栏面板
   ============================================================ */
function buildIbPanel(){
  const ib=state.sq.infobar;
  const box=$('#ibLines');
  if(!box)return; // 信息栏面板已移除时跳过
  box.innerHTML='';
  ib.lines.forEach((ln,i)=>{
    const d=document.createElement('div');
    d.className='ibLine';
    d.innerHTML=`
      <div class="row">
        <input class="f" data-k="text" value="${escapeHtml(ln.text)}" placeholder="这一行文字">
        <label class="chk" style="margin:0"><input type="checkbox" data-k="visible" ${ln.visible?'checked':''}>显示</label>
        <button class="del danger" data-op="del">删</button>
      </div>
      <div class="grid4">
        <div><label>字号<b class="pv">${ln.size}</b></label><input type="range" data-k="size" min="4" max="240" step="1" value="${ln.size}"></div>
        <div><label>颜色</label><input type="color" data-k="color" value="${toHex(ln.color)}"></div>
        <div><label>字重</label><select data-k="weight">${['300','400','500','600','700','800'].map(w=>`<option ${w===ln.weight?'selected':''}>${w}</option>`).join('')}</select></div>
        <div><label>对齐</label><select data-k="align">${['left','center','right'].map(a=>`<option value="${a}" ${a===ln.align?'selected':''}>${a==='left'?'左':a==='center'?'中':'右'}</option>`).join('')}</select></div>
      </div>
      <div class="f"><label>字体</label><select data-k="font">${fopts(ln.font)}</select></div>
      <div><label>字间距<b class="pv">${ln.spacing}</b></label><input type="range" data-k="spacing" min="0" max="20" step="0.5" value="${ln.spacing}"></div>`;
    d.querySelectorAll('[data-k]').forEach(inp=>{
      inp.addEventListener('input',()=>{
        const k=inp.dataset.k;
        if(k==='visible')ln.visible=inp.checked;
        else if(k==='text')ln.text=inp.value;
        else if(k==='weight')ln.weight=inp.value;
        else if(k==='align')ln.align=inp.value;
        else if(k==='font')ln.font=inp.value;
        else if(k==='color')ln.color=inp.value;
        else if(k==='size')ln.size=parseFloat(inp.value);
        else ln.spacing=parseFloat(inp.value);
        drawAll();saveAutosaveDebounced();
      });
      inp.addEventListener('change',()=>snapshot());
    });
    d.querySelector('[data-op=del]').onclick=()=>{
      snapshot();
      ib.lines.splice(i,1);
      buildIbPanel();drawAll();saveAutosave();
    };
    box.appendChild(d);
  });
}
function bindIbPanel(){
  if(!$('#ibVis'))return; // 信息栏面板已移除时跳过绑定
  const ib=()=>state.sq.infobar;
  [['#ibVis','visible','checked'],['#ibH','h','num'],['#ibW','w','num'],['#ibX','x','num'],['#ibBg','bg','val'],['#ibPad','pad','num']].forEach(([sel,k,kind])=>{
    const inp=$(sel);
    if(!inp)return;
    inp.addEventListener('input',()=>{
      const v=kind==='checked'?inp.checked:kind==='num'?parseFloat(inp.value):inp.value;
      ib()[k]=v;
      drawAll();saveAutosaveDebounced();
    });
    inp.addEventListener('change',()=>snapshot());
  });
  const add=$('#ibAddLine');
  if(add)add.onclick=()=>{
    snapshot();
    ib().lines.push({text:'新字段: xxx',size:40,color:'#2b2b2b',weight:'500',align:'left',spacing:1,visible:true});
    buildIbPanel();drawAll();saveAutosave();
  };
}
function syncIbPanel(){
  const ib=state.sq.infobar;
  const put=(sel,v,checked)=>{const el=$(sel);if(!el)return;if(checked)el.checked=!!v;else el.value=v;};
  put('#ibVis',ib.visible,true);put('#ibH',ib.h);put('#ibW',ib.w);put('#ibX',ib.x);put('#ibBg',toHex(ib.bg));put('#ibPad',ib.pad);
  refreshSliderLabels();
}
/* 头像占位：位于方图顶部、信息栏之上 */
function avatarEl(){return state.sq.els.find(el=>el.type==='avatar');}
function bindAvatarPanel(){
  const map=[['#avX','x'],['#avY','y'],['#avW','w'],['#avR','radius']];
  map.forEach(([sel,k])=>{
    const inp=$(sel);if(!inp)return;
    inp.addEventListener('input',()=>{
      const el=avatarEl();if(!el)return;
      const v=parseFloat(inp.value)||0;
      el[k]=v;
      if(k==='w')el.h=v;
      drawAll();saveAutosaveDebounced();
    });
    inp.addEventListener('change',()=>snapshot());
  });
}
function syncAvatarPanel(){
  const el=avatarEl();if(!el)return;
  const put=(sel,v)=>{const i=$(sel);if(i)i.value=v;};
  put('#avX',el.x);put('#avY',el.y);put('#avW',el.w);put('#avR',el.radius||0);
  refreshSliderLabels();
}

/* ============================================================
   画布尺寸 / 背景面板
   ============================================================ */
/* 背景面板：只作用于「总览」底图（渐变 / 取色 / 高斯模糊） */
function syncBgSection(){
  const setV=(sel,v)=>{const el=$(sel);if(el)el.value=v;};
  const ob=state.ov.bg;
  setV('#ovBgType',ob.type||'solid');
  setV('#ovBgColor',toHex(ob.color||'#eceef0'));
  setV('#ovBgColor2',toHex(ob.color2||'#ffffff'));
  setV('#ovBgDir',ob.dir||'v');
  setV('#ovBgBlur',ob.blur||0);
  setV('#ovBgOp',ob.opacity);
  setV('#ovBgScale',ob.scale);
  setV('#ovBgX',ob.x);
  setV('#ovBgY',ob.y);
  setV('#ovW',state.ov.w);setV('#ovH',state.ov.h);
  /* 壁纸 / 方图 背景图调节 */
  const wpbg=state.wp.bg||{};
  setV('#wpBgBlur',wpbg.blur||0);setV('#wpBgOp',wpbg.opacity==null?1:wpbg.opacity);
  setV('#wpBgScale',wpbg.scale==null?1:wpbg.scale);setV('#wpBgX',wpbg.x||0);setV('#wpBgY',wpbg.y||0);
  const sbg=state.sq.bg||{};
  setV('#sqBgBlur',sbg.blur||0);setV('#sqBgOp',sbg.opacity==null?1:sbg.opacity);
  setV('#sqBgScale',sbg.scale==null?1:sbg.scale);setV('#sqBgX',sbg.x||0);setV('#sqBgY',sbg.y||0);
  const obb=$('#upOvBgBox');if(obb)obb.classList.toggle('has',!!ob.imgId);
  const wb=$('#upWpBox');if(wb)wb.classList.toggle('has',!!state.wp.bg.imgId);
  const sb=$('#upSqBox');if(sb)sb.classList.toggle('has',!!state.sq.bg.imgId);
  const ab=$('#upAvBox');if(ab){const el=avatarEl();ab.classList.toggle('has',!!(el&&el.imgId));}
  refreshSliderLabels();
}
/* 总览底图 / 尺寸 / 取色 */
function bindOverviewBg(){
  const ob=()=>state.ov.bg;
  const dirty=()=>{drawAll();saveAutosaveDebounced();};
  const on=(sel,ev,fn)=>{const el=$(sel);if(el)el.addEventListener(ev,fn);};
  on('#ovW','input',()=>{state.ov.w=clamp(parseInt($('#ovW').value)||2048,120,6000);applyStageSize('ov');drawAll();});
  on('#ovW','change',()=>snapshot());
  on('#ovH','input',()=>{state.ov.h=clamp(parseInt($('#ovH').value)||2048,120,6000);applyStageSize('ov');drawAll();});
  on('#ovH','change',()=>snapshot());
  on('#ovBgType','change',()=>{snapshot();ob().type=$('#ovBgType').value;dirty();});
  on('#ovBgColor','input',()=>{ob().color=$('#ovBgColor').value;dirty();});
  on('#ovBgColor','change',()=>snapshot());
  on('#ovBgColor2','input',()=>{ob().color2=$('#ovBgColor2').value;dirty();});
  on('#ovBgColor2','change',()=>snapshot());
  on('#ovBgDir','change',()=>{ob().dir=$('#ovBgDir').value;dirty();});
  on('#ovBgBlur','input',()=>{ob().blur=parseFloat($('#ovBgBlur').value);dirty();});
  on('#ovBgBlur','change',()=>snapshot());
  on('#ovBgOp','input',()=>{ob().opacity=parseFloat($('#ovBgOp').value);dirty();});
  on('#ovBgScale','input',()=>{ob().scale=parseFloat($('#ovBgScale').value);dirty();});
  on('#ovBgX','input',()=>{ob().x=parseFloat($('#ovBgX').value);dirty();});
  on('#ovBgY','input',()=>{ob().y=parseFloat($('#ovBgY').value);dirty();});
  on('#ovBgClear','click',()=>{snapshot();ob().imgId=null;drawAll();syncBgSection();saveAutosave();toast('总览底图已移除');});
  on('#bgPickWp','click',()=>pickBgColors('wp'));
  on('#bgPickSq','click',()=>pickBgColors('sq'));
  on('#bgPickOv','click',()=>pickBgColors('ov'));
}
/* 壁纸 / 方图 背景图调节：高斯模糊 / 透明度 / 缩放 / 位置 / 移除 */
function bindBgAdjust(){
  const bind=(prefix,getBg,label)=>{
    const on=(sel,ev,fn)=>{const el=$(sel);if(el)el.addEventListener(ev,fn);};
    const read=sel=>{const el=$(sel);return el?parseFloat(el.value):0;};
    on('#'+prefix+'BgBlur','input',()=>{getBg().blur=Math.max(0,read('#'+prefix+'BgBlur')||0);drawAll();saveAutosaveDebounced();});
    on('#'+prefix+'BgBlur','change',()=>snapshot());
    on('#'+prefix+'BgOp','input',()=>{getBg().opacity=clamp(read('#'+prefix+'BgOp'),0,1);drawAll();saveAutosaveDebounced();});
    on('#'+prefix+'BgOp','change',()=>snapshot());
    on('#'+prefix+'BgScale','input',()=>{getBg().scale=Math.max(0.05,read('#'+prefix+'BgScale')||1);drawAll();saveAutosaveDebounced();});
    on('#'+prefix+'BgScale','change',()=>snapshot());
    on('#'+prefix+'BgX','input',()=>{getBg().x=read('#'+prefix+'BgX')||0;drawAll();saveAutosaveDebounced();});
    on('#'+prefix+'BgX','change',()=>snapshot());
    on('#'+prefix+'BgY','input',()=>{getBg().y=read('#'+prefix+'BgY')||0;drawAll();saveAutosaveDebounced();});
    on('#'+prefix+'BgY','change',()=>snapshot());
    on('#'+prefix+'BgClear','click',()=>{snapshot();getBg().imgId=null;drawAll();syncBgSection();saveAutosave();toast(label+'背景图已移除');});
  };
  bind('wp',()=>state.wp.bg,'壁纸');
  bind('sq',()=>state.sq.bg,'方图');
}
/* 全屏水印面板：壁纸 / 方图各自独立配置，通过「作用图层」切换编辑对象 */
let wmTargetName='wp';
function activeWm(){const c=wmTargetName==='sq'?state.sq:state.wp;return c.wm;}
function bindWatermark(){
  const on=(sel,ev,fn)=>{const el=$(sel);if(el)el.addEventListener(ev,fn);};
  const tgt=$('#wmTarget');
  if(tgt)tgt.addEventListener('change',()=>{wmTargetName=tgt.value;syncWatermark();});
  on('#wmEnable','change',()=>{const w=activeWm();if(!w)return;snapshot();w.enabled=$('#wmEnable').checked;drawAll();saveAutosave();});
  on('#wmBlend','change',()=>{const w=activeWm();if(!w)return;w.blend=$('#wmBlend').value;drawAll();saveAutosaveDebounced();});
  on('#wmScale','input',()=>{const w=activeWm();if(!w)return;w.scale=parseFloat($('#wmScale').value);drawAll();saveAutosaveDebounced();});
  on('#wmScale','change',()=>snapshot());
  on('#wmOpacity','input',()=>{const w=activeWm();if(!w)return;w.opacity=parseFloat($('#wmOpacity').value);drawAll();saveAutosaveDebounced();});
  on('#wmOpacity','change',()=>snapshot());
  on('#wmX','input',()=>{const w=activeWm();if(!w)return;w.x=parseFloat($('#wmX').value);drawAll();saveAutosaveDebounced();});
  on('#wmX','change',()=>snapshot());
  on('#wmY','input',()=>{const w=activeWm();if(!w)return;w.y=parseFloat($('#wmY').value);drawAll();saveAutosaveDebounced();});
  on('#wmY','change',()=>snapshot());
  on('#wmRot','input',()=>{const w=activeWm();if(!w)return;w.rot=parseFloat($('#wmRot').value);drawAll();saveAutosaveDebounced();});
  on('#wmRot','change',()=>snapshot());
  on('#wmGap','input',()=>{const w=activeWm();if(!w)return;w.gap=parseFloat($('#wmGap').value);drawAll();saveAutosaveDebounced();});
  on('#wmGap','change',()=>snapshot());
  on('#wmTile','change',()=>{const w=activeWm();if(!w)return;w.tile=$('#wmTile').checked;drawAll();saveAutosave();});
  bindUpload('#upWm',url=>{
    const w=activeWm();if(!w)return;
    snapshot();
    const id=uid('wm');
    putImage(id,url);
    w.imgId=id;w.enabled=true;
    drawAll();syncWatermark();saveAutosave();
    toast((wmTargetName==='sq'?'方图':'壁纸')+'水印已上传并启用');
  });
}
function syncWatermark(){
  const w=activeWm()||{};
  const setV=(sel,v)=>{const el=$(sel);if(el)el.value=v;};
  const setC=(sel,v)=>{const el=$(sel);if(el)el.checked=!!v;};
  const tgt=$('#wmTarget');if(tgt)tgt.value=wmTargetName;
  setC('#wmEnable',w.enabled);
  setV('#wmBlend',w.blend||'overlay');
  setV('#wmScale',w.scale==null?0.4:w.scale);
  setV('#wmOpacity',w.opacity==null?0.35:w.opacity);
  setV('#wmX',w.x==null?0.5:w.x);
  setV('#wmY',w.y==null?0.5:w.y);
  setV('#wmRot',w.rot||0);
  setV('#wmGap',w.gap==null?0.6:w.gap);
  setC('#wmTile',w.tile!==false);
  const box=$('#upWmBox');if(box)box.classList.toggle('has',!!w.imgId);
  refreshSliderLabels();
}
function bindContentPanel(){
  if(!$('#sqCs'))return; // 方图裁剪面板已移除时跳过绑定
  const ct=()=>state.sq.content;
  const dirty=()=>{requestDraw('sq');saveAutosaveDebounced();};
  $('#sqCs').addEventListener('input',()=>{ct().scale=parseFloat($('#sqCs').value);dirty();});
  $('#sqCx').addEventListener('input',()=>{ct().x=parseFloat($('#sqCx').value);dirty();});
  $('#sqCy').addEventListener('input',()=>{ct().y=parseFloat($('#sqCy').value);dirty();});
}
/* ---------- 总览合成画布面板 ---------- */
function buildOverviewSig(){
  const body=$('#ovSigBody');body.innerHTML='';
  state.ov.signature.forEach((ln,i)=>{
    const d=document.createElement('div');
    d.className='ibLine';
    d.innerHTML=`
      <div class="row">
        <input class="f" data-k="text" data-i="${i}" value="${escapeHtml(ln.text)}" placeholder="署名内容（支持换行）">
        <label class="chk" style="margin:0"><input type="checkbox" data-k="visible" data-i="${i}" ${ln.visible?'checked':''}>显示</label>
      </div>
      <div class="grid2">
        <div class="f"><label>字号<b class="pv">${ln.size}</b></label><input type="range" data-k="size" data-i="${i}" min="4" max="240" step="1" value="${ln.size}"></div>
        <div class="f"><label>颜色</label><input type="color" data-k="color" data-i="${i}" value="${toHex(ln.color)}"></div>
      </div>
      <div class="grid2">
        <div class="f"><label>字重</label><select data-k="weight" data-i="${i}">${['300','400','500','600','700','800'].map(w=>`<option ${w===ln.weight?'selected':''}>${w}</option>`).join('')}</select></div>
        <div class="f"><label>对齐</label><select data-k="align" data-i="${i}">${['left','center','right'].map(a=>`<option value="${a}" ${a===ln.align?'selected':''}>${a==='left'?'左':a==='center'?'中':'右'}</option>`).join('')}</select></div>
      </div>
      <div class="grid2">
        <div class="f"><label>X 位置<b class="pv">${ln.x}</b></label><input type="range" data-k="x" data-i="${i}" min="0" max="${state.ov.w}" step="1" value="${ln.x}"></div>
        <div class="f"><label>Y 位置<b class="pv">${ln.y}</b></label><input type="range" data-k="y" data-i="${i}" min="0" max="${state.ov.h}" step="1" value="${ln.y}"></div>
      </div>
      <div class="f"><label>字体</label><select data-k="font" data-i="${i}">${fopts(ln.font)}</select></div>`;
    d.querySelectorAll('[data-k]').forEach(inp=>{
      inp.addEventListener('input',()=>{
        const k=inp.dataset.k,i=parseInt(inp.dataset.i);
        const sig=state.ov.signature[i];
        if(k==='visible')sig.visible=inp.checked;
        else if(k==='text')sig.text=inp.value;
        else if(k==='weight'||k==='align'||k==='font')sig[k]=inp.value;
        else if(k==='color')sig[k]=inp.value;
        else sig[k]=parseFloat(inp.value);
        requestDraw('ov');saveAutosaveDebounced();
      });
      inp.addEventListener('change',()=>snapshot());
    });
    body.appendChild(d);
  });
}
/* ---------- 方图文字（朋友圈昵称 / 签名 / 装饰文案）面板 ---------- */
function sqTextEls(){return state.sq.els.filter(el=>el.type==='text');}
function buildSqTextPanel(){
  const body=$('#sqTextList');if(!body)return;
  body.innerHTML='';
  const list=sqTextEls();
  if(!list.length){
    body.innerHTML='<p class="hint">暂无文字。点击「＋ 添加文字」即可在方图封面里叠加新的昵称 / 签名 / 装饰文案。</p>';
    return;
  }
  list.forEach(el=>{
    const d=document.createElement('div');
    d.className='ibLine'+(selIds.includes(el.id)?' sel':'');
    d.innerHTML=`
      <div class="row">
        <input class="f" data-k="text" data-id="${el.id}" value="${escapeHtml(el.text)}" placeholder="文字内容（支持换行）">
        <label class="chk" style="margin:0"><input type="checkbox" data-k="visible" data-id="${el.id}" ${el.hidden?'':'checked'}>显示</label>
      </div>
      <div class="grid2">
        <div class="f"><label>字号<b class="pv">${el.size}</b></label><input type="range" data-k="size" data-id="${el.id}" min="4" max="400" step="1" value="${el.size}"></div>
        <div class="f"><label>颜色</label><input type="color" data-k="color" data-id="${el.id}" value="${toHex(el.color)}"></div>
      </div>
      <div class="grid2">
        <div class="f"><label>字体</label><select data-k="font" data-id="${el.id}">${fopts(el.font)}</select></div>
        <div class="f"><label>字重</label><select data-k="weight" data-id="${el.id}">${['300','400','500','600','700','800'].map(w=>`<option ${w===el.weight?'selected':''}>${w}</option>`).join('')}</select></div>
      </div>
      <div class="grid2">
        <div class="f"><label>对齐</label><select data-k="align" data-id="${el.id}">${['left','center','right'].map(a=>`<option value="${a}" ${a===el.align?'selected':''}>${a==='left'?'左':a==='center'?'中':'右'}</option>`).join('')}</select></div>
        <div class="f"><label>旋转<b class="pv">${el.rot||0}°</b></label><input type="range" data-k="rot" data-id="${el.id}" data-fmt="deg" min="-180" max="180" step="1" value="${el.rot||0}"></div>
      </div>
      <div class="grid2">
        <div class="f"><label>X 位置<b class="pv">${Math.round(el.x)}</b></label><input type="range" data-k="x" data-id="${el.id}" min="-200" max="${state.sq.w}" step="1" value="${Math.round(el.x)}"></div>
        <div class="f"><label>Y 位置<b class="pv">${Math.round(el.y)}</b></label><input type="range" data-k="y" data-id="${el.id}" min="-200" max="${state.sq.h}" step="1" value="${Math.round(el.y)}"></div>
      </div>
      <div class="f"><label>透明度<b class="pv">${Math.round((el.opacity==null?1:el.opacity)*100)}%</b></label><input type="range" data-k="opacity" data-id="${el.id}" data-fmt="pct" min="0" max="1" step="0.01" value="${el.opacity==null?1:el.opacity}"></div>`;
    d.addEventListener('pointerdown',e=>{
      if(e.target.closest('input,select,button,label'))return;
      selectOnly(el.id);
    });
    d.querySelectorAll('[data-k]').forEach(inp=>{
      inp.addEventListener('input',()=>{
        const k=inp.dataset.k,id=inp.dataset.id;
        const t=state.sq.els.find(x=>x.id===id);if(!t)return;
        if(k==='visible')t.hidden=!inp.checked;
        else if(k==='text')t.text=inp.value;
        else if(k==='font'||k==='weight'||k==='align')t[k]=inp.value;
        else if(k==='color')t.color=inp.value;
        else t[k]=parseFloat(inp.value);
        if(t.type==='text'&&(k==='size'))t.h=Math.max(t.h,t.size*t.lh);
        requestDraw('ov');saveAutosaveDebounced();
      });
      inp.addEventListener('change',()=>{snapshot();buildSqTextPanel();});
    });
    body.appendChild(d);
  });
}
function bindSqTextPanel(){
  const add=$('#sqTextAdd'),del=$('#sqTextDel');
  if(add)add.onclick=()=>{
    snapshot();
    const el=mkText({x:120,y:120,w:760,h:120,text:'点击编辑文字',size:64,weight:'600',color:'#1a1a1a',align:'left'});
    state.sq.els.push(el);
    setActive('ov');selectOnly(el.id);saveAutosave();
    buildSqTextPanel();syncSqTextPanel();
    toast('已添加文字，可在预览里拖动/缩放');
  };
  if(del)del.onclick=()=>{
    const texts=sqTextEls().filter(el=>selIds.includes(el.id));
    if(!texts.length)return toast('请先选中要删除的文字','err');
    snapshot();
    const ids=texts.map(t=>t.id);
    state.sq.els=state.sq.els.filter(el=>!ids.includes(el.id));
    selIds=[];drawAll();buildLayerList();buildProps();saveAutosave();
    buildSqTextPanel();syncSqTextPanel();
    toast(`已删除 ${ids.length} 组文字`);
  };
}
function syncSqTextPanel(){buildSqTextPanel();}
/* ---------- 壁纸锁屏元素（大时间 / 日期 / 状态栏 / 图案）面板 ---------- */
function wpElLabel(el){
  if(el.type==='text')return '文字：'+((el.text||'').split('\n')[0].slice(0,12)||'文字');
  if(el.type==='shape')return (el.group?'图案组：':'图案：')+(el.shape==='circle'?'圆形':'方块/线条');
  if(el.type==='avatar')return '图案：头像';
  return '图案：图片';
}
/* 形状元素里的图标/文字输入区（emoji / 颜文字 → 单色扁平矢量） */
const WP_QUICK_ICONS=['🔋','📷','🔦','🔕','✈️','⏰','♡','⚙','☰','☾','☀','⚡','🎵','💬'];
function wpIconHtml(el){
  const size=el.iconSize==null?.5:el.iconSize;
  return `<div class="f" style="margin-top:6px"><label>图标 / 文字（自动转单色矢量）</label>
    <input class="f" data-k="iconText" data-id="${el.id}" value="${escapeHtml(el.iconText||'')}" placeholder="输入 emoji / 颜文字 / 符号，如 🔋 📷 ♪ (｡･ω･｡)"></div>
    <div class="iconPick">${WP_QUICK_ICONS.map(s=>`<button type="button" data-icon-for="${el.id}" data-icon-val="${escapeHtml(s)}">${s}</button>`).join('')}</div>
    <div class="grid2">
      <div class="f"><label>图标颜色</label><input type="color" data-k="iconColor" data-id="${el.id}" value="${toHex(el.iconColor||'#2b2b2b')}"></div>
      <div class="f"><label>图标大小<b class="pv">${Math.round(size*100)}%</b></label><input type="range" data-k="iconSize" data-id="${el.id}" data-fmt="pct" min="0.1" max="1.2" step="0.02" value="${size}"></div>
    </div>`;
}
/* 单个元素的属性块 */
function buildWpElBlock(el){
  const d=document.createElement('div');
  d.className='ibLine'+(wpSelId===el.id?' sel':'');
  let html=`<p class="hint" style="margin:0 0 4px;font-weight:600;color:var(--text)">${escapeHtml(wpElLabel(el))}</p>`;
  if(el.type==='text'){
    html+=`<div class="row"><input class="f" data-k="text" data-id="${el.id}" value="${escapeHtml(el.text)}" placeholder="文字内容（支持换行）"></div>
    <div class="grid2">
      <div class="f"><label>字体</label><select data-k="font" data-id="${el.id}">${fopts(el.font)}</select></div>
      <div class="f"><label>字重</label><select data-k="weight" data-id="${el.id}">${['300','400','500','600','700','800'].map(w=>`<option ${w===el.weight?'selected':''}>${w}</option>`).join('')}</select></div>
    </div>
    <div class="grid2">
      <div class="f"><label>字号<b class="pv">${el.size}</b></label><input type="range" data-k="size" data-id="${el.id}" min="4" max="600" step="1" value="${el.size}"></div>
      <div class="f"><label>颜色</label><input type="color" data-k="color" data-id="${el.id}" value="${toHex(el.color)}"></div>
    </div>
    <div class="grid2">
      <div class="f"><label>阴影模糊<b class="pv">${el.shadow||0}</b></label><input type="range" data-k="shadow" data-id="${el.id}" min="0" max="80" step="1" value="${el.shadow||0}"></div>
      <div class="f"><label>阴影偏移<b class="pv">${el.shadowY||0}</b></label><input type="range" data-k="shadowY" data-id="${el.id}" min="-60" max="60" step="1" value="${el.shadowY||0}"></div>
    </div>
    <div class="f"><label>阴影颜色</label><input type="color" data-k="shadowColor" data-id="${el.id}" value="${toHex(el.shadowColor||'#000000')}"></div>`;
  }else{
    html+=`<div class="grid2">
      <div class="f"><label>颜色</label><input type="color" data-k="fill" data-id="${el.id}" value="${toHex(el.fill||'#ffffff')}"></div>
      <div class="f"><label>圆角<b class="pv">${el.radius||0}</b></label><input type="range" data-k="radius" data-id="${el.id}" min="0" max="400" step="1" value="${el.radius||0}"></div>
    </div>`;
    if(el.type==='shape')html+=wpIconHtml(el);
  }
  html+=`<div class="grid2">
    <div class="f"><label>X 位置<b class="pv">${Math.round(el.x)}</b></label><input type="range" data-k="x" data-id="${el.id}" min="-400" max="${state.wp.w}" step="1" value="${Math.round(el.x)}"></div>
    <div class="f"><label>Y 位置<b class="pv">${Math.round(el.y)}</b></label><input type="range" data-k="y" data-id="${el.id}" min="-400" max="${state.wp.h}" step="1" value="${Math.round(el.y)}"></div>
  </div>
  <div class="grid2">
    <div class="f"><label>宽度<b class="pv">${Math.round(el.w)}</b></label><input type="range" data-k="w" data-id="${el.id}" min="4" max="${state.wp.w}" step="1" value="${Math.round(el.w)}"></div>
    <div class="f"><label>高度<b class="pv">${Math.round(el.h)}</b></label><input type="range" data-k="h" data-id="${el.id}" min="4" max="${state.wp.h}" step="1" value="${Math.round(el.h)}"></div>
  </div>
  <div class="grid2">
    <div class="f"><label>旋转<b class="pv">${el.rot||0}°</b></label><input type="range" data-k="rot" data-id="${el.id}" data-fmt="deg" min="-180" max="180" step="1" value="${el.rot||0}"></div>
    <div class="f"><label>透明度<b class="pv">${Math.round((el.opacity==null?1:el.opacity)*100)}%</b></label><input type="range" data-k="opacity" data-id="${el.id}" data-fmt="pct" min="0" max="1" step="0.01" value="${el.opacity==null?1:el.opacity}"></div>
  </div>`;
  d.innerHTML=html;
  d.addEventListener('pointerdown',e=>{
    if(e.target.closest('input,select,button,label'))return;
    wpSelId=el.id;buildWpElPanel();
  });
  bindWpInputs(d,buildWpElPanel);
  bindIconPick(d,buildWpElPanel);
  return d;
}
/* 联动图案组：把整组当成一个整体，用一套控件统一设置颜色/大小/圆角等；每个图案仍可单独设置图标 */
function buildWpGroupBlock(gid){
  const mem=state.wp.els.filter(o=>o.group===gid);
  if(!mem.length)return document.createElement('div');
  const first=mem[0];
  const d=document.createElement('div');
  d.className='ibLine'+(mem.some(m=>m.id===wpSelId)?' sel':'');
  const shapeName=first.shape==='circle'?'圆形':(first.shape==='rect'?'方块/线条':'图案');
  let html=`<p class="hint" style="margin:0 0 4px;font-weight:600;color:var(--text)">图案组：${shapeName}（${mem.length} 个）— 以下设置同时作用于整组</p>
  <div class="grid2">
    <div class="f"><label>颜色</label><input type="color" data-gk="fill" data-gid="${gid}" value="${toHex(first.fill||'#ffffff')}"></div>
    <div class="f"><label>大小<b class="pv">${Math.round(first.w)}</b></label><input type="range" data-gk="size" data-gid="${gid}" min="20" max="800" step="1" value="${Math.round(first.w)}"></div>
  </div>
  <div class="grid2">
    <div class="f"><label>圆角<b class="pv">${first.radius||0}</b></label><input type="range" data-gk="radius" data-gid="${gid}" min="0" max="400" step="1" value="${first.radius||0}"></div>
    <div class="f"><label>旋转<b class="pv">${first.rot||0}°</b></label><input type="range" data-gk="rot" data-gid="${gid}" data-fmt="deg" min="-180" max="180" step="1" value="${first.rot||0}"></div>
  </div>
  <div class="grid2">
    <div class="f"><label>X 位置<b class="pv">${Math.round(first.x)}</b></label><input type="range" data-gk="x" data-gid="${gid}" min="-400" max="${state.wp.w}" step="1" value="${Math.round(first.x)}"></div>
    <div class="f"><label>Y 位置<b class="pv">${Math.round(first.y)}</b></label><input type="range" data-gk="y" data-gid="${gid}" min="-400" max="${state.wp.h}" step="1" value="${Math.round(first.y)}"></div>
  </div>
  <div class="grid2">
    <div class="f"><label>透明度<b class="pv">${Math.round((first.opacity==null?1:first.opacity)*100)}%</b></label><input type="range" data-gk="opacity" data-gid="${gid}" data-fmt="pct" min="0" max="1" step="0.01" value="${first.opacity==null?1:first.opacity}"></div>
  </div>
  <p class="hint" style="margin:8px 0 2px">圆圈图标（每个图案单独输入 emoji / 颜文字，自动转成单色矢量）：</p>`;
  mem.forEach((m,i)=>{
    html+=`<div class="subLine"><p class="hint" style="margin:0 0 2px;font-weight:600">图案 ${i+1}</p>${wpIconHtml(m)}</div>`;
  });
  d.innerHTML=html;
  d.addEventListener('pointerdown',e=>{
    if(e.target.closest('input,select,button,label'))return;
    wpSelId=first.id;buildWpElPanel();
  });
  bindWpGroupInputs(d,buildWpElPanel);
  bindWpInputs(d,buildWpElPanel);
  bindIconPick(d,buildWpElPanel);
  return d;
}
/* 元素属性输入绑定（data-k） */
function bindWpInputs(scope,rerender){
  scope.querySelectorAll('[data-k]').forEach(inp=>{
    inp.addEventListener('input',()=>{
      const k=inp.dataset.k,id=inp.dataset.id;
      const t=state.wp.els.find(x=>x.id===id);if(!t)return;
      if(k==='text')t.text=inp.value;
      else if(k==='iconText')t.iconText=inp.value;
      else if(k==='font'||k==='weight')t[k]=inp.value;
      else if(k==='color'||k==='fill'||k==='iconColor')t[k]=inp.value;
      else if(k==='shadowColor')t.shadowColor=inp.value;
      else if((k==='x'||k==='y')&&t.group){
        const d=parseFloat(inp.value)-t[k];
        state.wp.els.forEach(o=>{if(o.group===t.group)o[k]=Math.round(o[k]+d);});
      }
      else t[k]=parseFloat(inp.value);
      if(t.type==='text'&&(k==='size'||k==='h'))t.h=Math.max(t.h,t.size*t.lh);
      drawAll();saveAutosaveDebounced();
    });
    inp.addEventListener('change',()=>{snapshot();rerender();});
  });
}
/* 图案组统一控件绑定（data-gk）：一次改动同时作用到整组 */
function bindWpGroupInputs(scope,rerender){
  scope.querySelectorAll('[data-gk]').forEach(inp=>{
    inp.addEventListener('input',()=>{
      const gk=inp.dataset.gk,gid=inp.dataset.gid;
      const mem=state.wp.els.filter(o=>o.group===gid);if(!mem.length)return;
      if(gk==='fill')mem.forEach(o=>o.fill=inp.value);
      else if(gk==='radius')mem.forEach(o=>o.radius=parseFloat(inp.value));
      else if(gk==='rot')mem.forEach(o=>o.rot=parseFloat(inp.value));
      else if(gk==='opacity')mem.forEach(o=>o.opacity=parseFloat(inp.value));
      else if(gk==='size'){
        const v=Math.max(4,parseFloat(inp.value));
        mem.forEach(o=>{
          /* 以各自中心为基准缩放，避免改高度时圆心的纵向位置被带偏、导致整组错位 */
          const cx=o.x+o.w/2,cy=o.y+o.h/2;
          if(o.shape==='circle'){o.w=v;o.h=v;}
          else{const r=(o.h/o.w)||1;o.w=v;o.h=Math.round(v*r);}
          o.x=Math.round(cx-o.w/2);o.y=Math.round(cy-o.h/2);
        });
      }
      else if(gk==='x'||gk==='y'){
        const base=mem[0];const d=parseFloat(inp.value)-base[gk];
        mem.forEach(o=>o[gk]=Math.round(o[gk]+d));
      }
      drawAll();saveAutosaveDebounced();
    });
    inp.addEventListener('change',()=>{snapshot();rerender();});
  });
}
/* 快捷图标按钮 */
function bindIconPick(scope,rerender){
  scope.querySelectorAll('[data-icon-for]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const t=state.wp.els.find(x=>x.id===btn.dataset.iconFor);if(!t)return;
      t.iconText=btn.dataset.iconVal||'';
      snapshot();drawAll();saveAutosaveDebounced();rerender();
    });
  });
}
function buildWpElPanel(){
  const body=$('#wpElList');if(!body)return;
  body.innerHTML='';
  const list=state.wp.els||[];
  if(!list.length){
    body.innerHTML='<p class="hint">暂无锁屏元素。点击「＋ 添加文字」即可在壁纸锁屏里叠加文字。</p>';
    return;
  }
  const doneGroups={};
  list.forEach(el=>{
    if(el.group){
      if(doneGroups[el.group])return;
      doneGroups[el.group]=true;
      body.appendChild(buildWpGroupBlock(el.group));
      return;
    }
    body.appendChild(buildWpElBlock(el));
  });
}
function bindWpElPanel(){
  const add=$('#wpElAdd'),del=$('#wpElDel');
  if(add)add.onclick=()=>{
    snapshot();
    const el=mkText({x:120,y:120,w:760,h:120,text:'锁屏文字',size:64,weight:'600',color:'#1a1a1a',align:'left'});
    state.wp.els.push(el);
    wpSelId=el.id;drawAll();saveAutosave();
    buildWpElPanel();
    toast('已添加锁屏文字');
  };
  if(del)del.onclick=()=>{
    if(!wpSelId)return toast('请先在下方点选要删除的锁屏元素','err');
    snapshot();
    const sel=state.wp.els.find(el=>el.id===wpSelId);
    const ids=(sel&&sel.group)?state.wp.els.filter(el=>el.group===sel.group).map(el=>el.id):[wpSelId];
    state.wp.els=state.wp.els.filter(el=>!ids.includes(el.id));
    wpSelId=null;drawAll();saveAutosave();
    buildWpElPanel();
    toast(ids.length>1?`已删除整组（${ids.length} 个）`:'已删除锁屏元素');
  };
}
function syncWpElPanel(){buildWpElPanel();}
function bindOverviewPanel(){
  const ov=()=>state.ov;
  const dirty=()=>{requestDraw('ov');saveAutosaveDebounced();};
  const readVal=(inp,kind)=>kind==='checked'?inp.checked:kind==='num'?parseFloat(inp.value):inp.value;
  const wpSlotFields=[['Vis','visible','checked'],['X','x','num'],['Y','y','num'],['W','w','num'],
    ['R','radius','num'],['Sd','shadow','num'],['Pad','pad','num'],['Frame','frame','text'],
    ['BC','borderColor','text'],['Border','border','checked'],['Title','title','text'],
    ['TS','titleSize','num'],['TC','titleColor','text']];
  wpSlotFields.forEach(([k,p,kind])=>{
    const inp=$('#ovWpSlot'+k);if(!inp)return;
    inp.addEventListener('input',()=>{ov().wpSlot[p]=readVal(inp,kind);dirty();});
    inp.addEventListener('change',()=>snapshot());
  });
  const sqSlotFields=[['Vis','visible','checked'],['X','x','num'],['Y','y','num'],['W','w','num'],
    ['R','radius','num'],['Sd','shadow','num'],['Pad','pad','num'],['Frame','frame','text'],
    ['BC','borderColor','text'],['Border','border','checked'],['Title','title','text'],
    ['TS','titleSize','num'],['TC','titleColor','text']];
  sqSlotFields.forEach(([k,p,kind])=>{
    const inp=$('#ovSqSlot'+k);if(!inp)return;
    inp.addEventListener('input',()=>{ov().sqSlot[p]=readVal(inp,kind);dirty();});
    inp.addEventListener('change',()=>snapshot());
  });
}
function syncOverviewPanel(){
  const put=(sel,v,kind)=>{const el=$(sel);if(!el)return;
    if(kind==='checked')el.checked=!!v;
    else el.value=(v===undefined||v===null)?'':v;};
  const wp=state.ov.wpSlot,sq=state.ov.sqSlot;
  put('#ovWpSlotVis',wp.visible,'checked');put('#ovWpSlotX',wp.x);put('#ovWpSlotY',wp.y);
  put('#ovWpSlotW',wp.w);put('#ovWpSlotR',wp.radius);put('#ovWpSlotSd',wp.shadow);
  put('#ovWpSlotPad',wp.pad);put('#ovWpSlotFrame',wp.frame||'round');
  put('#ovWpSlotBC',toHex(wp.borderColor||'#c9a37c'));put('#ovWpSlotBorder',wp.border,'checked');
  put('#ovWpSlotTitle',wp.title||'');put('#ovWpSlotTS',wp.titleSize);put('#ovWpSlotTC',toHex(wp.titleColor||'#8a8f96'));
  put('#ovSqSlotVis',sq.visible,'checked');put('#ovSqSlotX',sq.x);put('#ovSqSlotY',sq.y);
  put('#ovSqSlotW',sq.w);put('#ovSqSlotR',sq.radius);put('#ovSqSlotSd',sq.shadow);
  put('#ovSqSlotPad',sq.pad);put('#ovSqSlotFrame',sq.frame||'round');
  put('#ovSqSlotBC',toHex(sq.borderColor||'#c9a37c'));put('#ovSqSlotBorder',sq.border,'checked');
  put('#ovSqSlotTitle',sq.title||'');put('#ovSqSlotTS',sq.titleSize);put('#ovSqSlotTC',toHex(sq.titleColor||'#8a8f96'));
}

/* ============================================================
   初始化绑定
   ============================================================ */
function setActive(name){
  active=name;
  selIds=[];
  drawAll();syncBgSection();
}
function syncAllPanels(){
  syncBgSection();syncIbPanel();buildIbPanel();syncAvatarPanel();buildOverviewSig();syncOverviewPanel();
  buildSqTextPanel();syncWpElPanel();syncWatermark();
  refreshSliderLabels();
}
function toast(msg,kind){
  const t=$('#toast');
  t.textContent=msg;
  t.className='show'+(kind==='err'?' err':'');
  clearTimeout(t._h);
  t._h=setTimeout(()=>t.className='',2400);
}

function refreshSliderLabels(){
  document.querySelectorAll('input[type=range]').forEach(inp=>{
    const pv=inp.parentElement&&inp.parentElement.querySelector('.pv');
    if(!pv)return;
    const fmt=inp.dataset.fmt,v=inp.value;
    pv.textContent=fmt==='pct'?Math.round(parseFloat(v)*100)+'%':fmt==='deg'?v+'°':v;
  });
}
/* 移动端：实时测量顶栏高度，用于 sticky 预览画布的 top 偏移 */
function updateHeaderH(){
  const h=document.querySelector('header');
  if(h)document.documentElement.style.setProperty('--header-h',h.offsetHeight+'px');
}
function init(){
  if(!restoreAutosave())state=defaultState();
  if(!state._alignV){normalizeGroups('wp');normalizeGroups('sq');state._alignV=1;}
  updateHeaderH();
  bindStage('ov');
  bindOverviewBg();bindOverviewPanel();bindIbPanel();bindAvatarPanel();bindSqTextPanel();
  bindBgAdjust();bindWpElPanel();bindWatermark();bindPresetPanel();

  bindUpload('#upOvBg',url=>setBgImage('ov',url));
  bindUpload('#upWpImg',url=>setBgImage('wp',url));
  bindUpload('#upSqImg',url=>setBgImage('sq',url));
  bindUpload('#upAvatar',url=>uploadAvatar(url));

  $('#btnExportOverview').onclick=exportOverview;
  $('#btnReset').onclick=()=>{
    if(!confirm('确定恢复默认模板？当前内容将被清空（可用撤销找回）。'))return;
    snapshot();state=defaultState();selIds=[];
    fitViews();syncAllPanels();drawAll();saveAutosave();
  };

  document.querySelectorAll('.pbtn[data-p]').forEach(b=>b.onclick=()=>applyPreset(b.dataset.p));
  document.addEventListener('input',e=>{if(e.target&&e.target.type==='range')refreshSliderLabels();});

  $('#ovZin').onclick=()=>setZoom('ov',.05);
  $('#ovZout').onclick=()=>setZoom('ov',-.05);
  $('#ovFit').onclick=()=>{fitViews();drawAll();};

  document.addEventListener('keydown',e=>{
    const tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea'||tag==='select')return;
    if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){undo();e.preventDefault();}
    else if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){redo();e.preventDefault();}
  });

  window.addEventListener('resize',()=>{fitViews();drawAll();updateHeaderH();});

  requestAnimationFrame(()=>{
    fitViews();drawAll();
    syncAllPanels();
    snapshot();
    const _p=new URLSearchParams(location.search).get('p');
    if(_p){
      try{applyStateObject(parsePresetLink(_p),'已应用分享链接中的预设');}
      catch(e){toast('链接预设解析失败','err');}
    }
  });
  setInterval(saveAutosave,15000);
}
document.addEventListener('DOMContentLoaded',init);
window.DS={get state(){return state;},drawAll,exportOne,exportBoth,normalizeGroups};
})();
