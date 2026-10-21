// Animated graphics background: gradient orbs + particle field + city skyline + floating data nodes
export function initBackground() {
  let canvas = document.getElementById("bgCanvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "bgCanvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
  }
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, dpr = 1, t = 0, running = true;
  const orbs = [], particles = [], stars = [], skyline = [], nodes = [], arcs = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.floor(w*dpr); canvas.height = Math.floor(h*dpr);
    canvas.style.width = w+"px"; canvas.style.height = h+"px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
    seed();
  }
  function seed() {
    orbs.length=0; particles.length=0; stars.length=0; skyline.length=0; nodes.length=0; arcs.length=0;
    orbs.push({x:w*.2,y:h*.25,r:Math.max(w,h)*.3,c:"0,229,255",vx:.00005,vy:.00004,ph:0});
    orbs.push({x:w*.8,y:h*.55,r:Math.max(w,h)*.32,c:"0,255,198",vx:-.00004,vy:.00005,ph:1});
    orbs.push({x:w*.5,y:h*.85,r:Math.max(w,h)*.25,c:"122,92,255",vx:.00003,vy:-.00004,ph:2});
    for(let i=0;i<90;i++) stars.push({x:Math.random()*w,y:Math.random()*h*.6,r:Math.random()*1.2+.4,ph:Math.random()*6.28,s:Math.random()*.0012});
    const cnt=Math.floor((w*h)/9000); for(let i=0;i<Math.min(cnt,160);i++) particles.push({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.3,r:Math.random()*1.6+.4,a:Math.random()*.6+.25});
    let x=-40; while(x<w+80){ const bw=Math.random()*56+28,bh=Math.random()*(h*.24)+h*.08; const b={x,w:bw,h:bh,far:Math.random()>.5,win:[]}; if(!b.far){ for(let wx=b.x+6;wx<b.x+b.w-6;wx+=12){ for(let wy=h-bh+10;wy<h-8;wy+=14){ if(Math.random()>.5) b.win.push({x:wx,y:wy,ph:Math.random()*6.28}); }}} skyline.push(b); x+=bw+Math.random()*12; }
    for(let i=0;i<16;i++) nodes.push({x:Math.random()*w,y:Math.random()*h*.5+40,r:Math.random()*2.2+.8,ph:Math.random()*6.28,vx:Math.random()*.08-.04,vy:Math.random()*.05-.025});
    for(let i=0;i<24;i++){ const a=nodes[(i*7)%nodes.length],b=nodes[(i*11)%nodes.length]; arcs.push({a,b}); }
  }
  function draw(){
    t+=16;
    const bg=ctx.createLinearGradient(0,0,0,h); bg.addColorStop(0,"#050b14"); bg.addColorStop(1,"#02060c"); ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
    orbs.forEach(o=>{ const ox=o.x+Math.sin(t*o.vx+o.ph)*60, oy=o.y+Math.cos(t*o.vy+o.ph)*40, g=ctx.createRadialGradient(ox,oy,0,ox,oy,o.r); g.addColorStop(0,`rgba(${o.c},.16)`); g.addColorStop(.6,`rgba(${o.c},.06)`); g.addColorStop(1,`rgba(${o.c},0)`); ctx.fillStyle=g; ctx.fillRect(0,0,w,h); });
    stars.forEach(s=>{ const a=.25+Math.abs(Math.sin(t*s.s+s.ph))*.7; ctx.fillStyle=`rgba(230,245,255,${a})`; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.28); ctx.fill(); });
    skyline.forEach(b=>{ const top=h-b.h; ctx.fillStyle=b.far?"rgba(9,18,26,.9)":"rgba(6,13,19,.95)"; ctx.fillRect(b.x,top,b.w,b.h); ctx.strokeStyle=b.far?"rgba(0,229,255,.04)":"rgba(0,229,255,.08)"; ctx.strokeRect(b.x+.5,top+.5,b.w,b.h); b.win.forEach(wi=>{ const lit=.22+Math.abs(Math.sin(t*.0009+wi.ph))*.6; ctx.fillStyle=`rgba(0,229,255,${lit})`; ctx.fillRect(wi.x,wi.y,4,5); }); });
    nodes.forEach(n=>{ n.x+=n.vx; n.y+=n.vy; if(n.x<0)n.x=w; if(n.x>w)n.x=0; if(n.y<0)n.y=h*.5+40; if(n.y>h*.6+80)n.y=h*.5+20; const g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,14); g.addColorStop(0,"rgba(0,229,255,.9)"); g.addColorStop(1,"rgba(0,229,255,0)"); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,6.28); ctx.fill(); });
    arcs.forEach(e=>{ ctx.strokeStyle="rgba(0,229,255,.18)"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(e.a.x,e.a.y); ctx.lineTo(e.b.x,e.b.y); ctx.stroke(); });
    particles.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; if(p.x<0)p.x=w; if(p.x>w)p.x=0; if(p.y<0)p.y=h; if(p.y>h)p.y=0; ctx.fillStyle=`rgba(0,255,198,${p.a})`; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.28); ctx.fill(); });
    const v=ctx.createRadialGradient(w/2,h/2,h*.2,w/2,h/2,h*.9); v.addColorStop(0,"rgba(0,0,0,0)"); v.addColorStop(1,"rgba(0,0,0,.4)"); ctx.fillStyle=v; ctx.fillRect(0,0,w,h);
    if(running&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches) requestAnimationFrame(draw);
  }
  window.addEventListener("resize", resize); resize();
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) draw();
  else requestAnimationFrame(draw);
  return {destroy(){running=false; window.removeEventListener("resize",resize);}};
}
