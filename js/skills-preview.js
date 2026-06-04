// ─────────────────────────────────────────────────────
// Floating canvas preview cards for the skills list.
// ─────────────────────────────────────────────────────

const PW = 300, PH = 200;
const BG     = '#06050A';
const ACCENT = '#1E9FE2';
const BRIGHT = '#5FC7EF';
const TEXT   = '#EAEAEA';

function rr(ctx, x, y, w, h, r = 4) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

// ─── Image slots (drop real images here) ──────────────
const IMG = {};
function loadImg(key, url) {
  const i = new Image(); i.crossOrigin = 'anonymous'; i.src = url;
  IMG[key] = i;
}
// Real images from Unsplash
loadImg('landing', 'https://images.unsplash.com/photo-1633793566023-a74b74104acb?w=600&h=400&fit=crop&auto=format');
loadImg('website', 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=600&h=400&fit=crop&auto=format');
loadImg('ai',      './assets/ai-preview.jpg');

// ─── 1. Landing page — hero layout ───────────────────
function drawLanding(ctx, t) {
  ctx.clearRect(0, 0, PW, PH);

  // ── Background ──
  const bg = ctx.createLinearGradient(0, 0, PW, PH);
  bg.addColorStop(0, '#07060f'); bg.addColorStop(1, '#030208');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, PW, PH);

  // Subtle radial glow top-right
  const gl = ctx.createRadialGradient(PW*0.78, PH*0.22, 0, PW*0.78, PH*0.22, 110);
  gl.addColorStop(0, 'rgba(30,159,226,0.09)'); gl.addColorStop(1, 'rgba(30,159,226,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, PW, PH);

  // ── Nav bar ──
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, 0, PW, 22);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(0,22); ctx.lineTo(PW,22); ctx.stroke();
  // Logo
  ctx.fillStyle = 'rgba(234,234,234,0.9)'; ctx.font = 'bold 8px "Space Mono",monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('BRAND', 12, 11);
  // Nav links
  ctx.fillStyle = 'rgba(234,234,234,0.3)'; ctx.font = '6px "Space Mono",monospace';
  ['About','Work','Pricing'].forEach((l,i) => ctx.fillText(l, 100+i*46, 11));
  // CTA nav button
  const nb = 0.6 + 0.4*Math.sin(t*1.2);
  ctx.fillStyle = `rgba(30,159,226,${nb})`; rr(ctx, PW-52, 5, 40, 13, 3); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 6px "Space Mono",monospace'; ctx.textAlign='center';
  ctx.fillText('Get started', PW-32, 11.5);

  // ── Hero left: text ──
  const heroY = 38;
  // Tag line
  ctx.fillStyle = 'rgba(30,159,226,0.9)'; ctx.font = '6px "Space Mono",monospace';
  ctx.textAlign = 'left';
  ctx.fillText('✦  NEW  ·  Version 2.0', 14, heroY);
  ctx.strokeStyle = 'rgba(30,159,226,0.25)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(14,heroY+6); ctx.lineTo(PW*0.52,heroY+6); ctx.stroke();

  // Headline — big
  ctx.fillStyle = 'rgba(234,234,234,0.95)'; ctx.font = 'bold 17px Arial,sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Build faster.', 14, heroY+24);
  // Second line with accent
  ctx.fillStyle = 'rgba(234,234,234,0.95)'; ctx.fillText('Ship ', 14, heroY+44);
  ctx.fillStyle = ACCENT; ctx.fillText('smarter.', 14+33, heroY+44);

  // Sub text
  ctx.fillStyle = 'rgba(234,234,234,0.38)'; ctx.font = '6.5px Arial,sans-serif';
  ctx.fillText('Automate workflows. Save hours.', 14, heroY+60);
  ctx.fillText('Focus on what matters.', 14, heroY+72);

  // CTA button — pulses
  const p = 0.5+0.5*Math.sin(t*1.8);
  ctx.fillStyle = `rgba(30,159,226,${0.8+0.2*p})`;
  rr(ctx, 14, heroY+82, 82, 20, 4); ctx.fill();
  // Button glow
  const bg2 = ctx.createRadialGradient(55, heroY+92, 0, 55, heroY+92, 40);
  bg2.addColorStop(0,`rgba(30,159,226,${0.2*p})`); bg2.addColorStop(1,'rgba(30,159,226,0)');
  ctx.fillStyle=bg2; ctx.fillRect(0,heroY+72,120,40);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 7px "Space Mono",monospace'; ctx.textAlign='center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Get started →', 55, heroY+92);

  // Social proof
  ctx.fillStyle = 'rgba(234,234,234,0.22)'; ctx.font = '5.5px Arial,sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('★★★★★  10,000+ users', 14, heroY+115);

  // ── Hero right: product card / mockup ──
  const rx = PW*0.56, ry = 28, rw = PW*0.41, rh = PH-38;

  // Card bg
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  rr(ctx, rx, ry, rw, rh, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.7; ctx.stroke();

  // Screen/dashboard inside card
  ctx.fillStyle = '#0c0a18'; rr(ctx, rx+6, ry+8, rw-12, rh-16, 4); ctx.fill();

  // Mini chart bars
  const bars = [0.4,0.65,0.5,0.8,0.6,0.9,0.75,1.0,0.85];
  bars.forEach((h,i)=>{
    const bh=(rh-40)*h*0.55, bx=rx+10+i*(((rw-20))/bars.length);
    const pulse2=0.7+0.3*Math.sin(t*1.5+i*0.4);
    ctx.fillStyle=`rgba(30,159,226,${0.4*pulse2})`;
    ctx.fillRect(bx, ry+rh-24-bh, ((rw-20)/bars.length)-2, bh);
    // Top highlight
    ctx.fillStyle=`rgba(95,199,239,${0.6*pulse2})`;
    ctx.fillRect(bx, ry+rh-24-bh, ((rw-20)/bars.length)-2, 1.5);
  });

  // Stat numbers
  ctx.fillStyle='rgba(234,234,234,0.7)'; ctx.font='bold 9px Arial,sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText('+24%', rx+8, ry+18);
  ctx.fillStyle='rgba(34,197,94,0.9)'; ctx.font='6px Arial,sans-serif';
  ctx.fillText('↑ growth', rx+8, ry+28);

  // Floating metric badge
  const bpulse = 0.5+0.5*Math.sin(t*2.2);
  ctx.fillStyle='rgba(6,5,10,0.85)'; rr(ctx,rx+rw-50,ry-6,46,20,4); ctx.fill();
  ctx.strokeStyle=`rgba(34,197,94,${0.5+0.3*bpulse})`; ctx.lineWidth=0.8; ctx.stroke();
  ctx.fillStyle='rgba(34,197,94,0.9)'; ctx.font='bold 8px Arial,sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('↑ 98%', rx+rw-27, ry+4);
}

// ─── 2. Full Website ──────────────────────────────────
function drawWebsite(ctx, t) {
  ctx.clearRect(0, 0, PW, PH);

  if (IMG.website?.complete && IMG.website.naturalWidth > 0) {
    ctx.drawImage(IMG.website, 0, 0, PW, PH);
    ctx.fillStyle = 'rgba(6,5,10,0.4)'; ctx.fillRect(0, 0, PW, PH);
  } else {
    ctx.fillStyle = '#090712'; ctx.fillRect(0, 0, PW, PH);

    // Browser chrome
    ctx.fillStyle = '#111020'; ctx.fillRect(0, 0, PW, 22);
    ['#ff5f57','#febc2e','#28c840'].forEach((c,i)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(10+i*14,11,3.5,0,Math.PI*2);ctx.fill();});
    ctx.fillStyle='rgba(255,255,255,0.06)'; rr(ctx,48,5,168,12,6); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(56,10,80,2);

    // Left sidebar
    ctx.fillStyle='#0e0c1a'; ctx.fillRect(0,22,52,PH-22);
    ctx.fillStyle='rgba(30,159,226,0.8)'; ctx.fillRect(10,30,24,3);
    ctx.fillStyle='rgba(234,234,234,0.15)';
    [40,52,64,76,88,100,112].forEach(y=>ctx.fillRect(8,y,28,2.5));
    // Active nav item
    ctx.fillStyle='rgba(30,159,226,0.15)'; ctx.fillRect(0,50,52,14);
    ctx.fillStyle='rgba(30,159,226,0.7)'; ctx.fillRect(8,54,28,2.5);

    // Main content area
    // Hero section
    ctx.fillStyle='rgba(30,159,226,0.06)'; ctx.fillRect(52,22,PW-52,44);
    ctx.fillStyle='rgba(234,234,234,0.85)'; ctx.fillRect(62,32,110,11);
    ctx.fillStyle='rgba(234,234,234,0.22)'; ctx.fillRect(62,47,70,5);
    // CTA
    const p=0.5+0.5*Math.sin(t*1.8);
    ctx.fillStyle=`rgba(30,159,226,${p})`; rr(ctx,62,56,52,14,2); ctx.fill();

    // Cards grid (3 columns, 2 rows)
    const scroll = Math.sin(t*0.3)*6;
    [[56,70+scroll,70,50],[132,70+scroll,70,50],[208,70+scroll,70,50],
     [56,126+scroll,70,50],[132,126+scroll,70,50],[208,126+scroll,70,50]].forEach(([x,y,w,h])=>{
      if(y > 22 && y < PH+10){
        ctx.save(); ctx.beginPath(); ctx.rect(52,22,PW-52,PH-22); ctx.clip();
        ctx.fillStyle='#13101e'; rr(ctx,x,y,w,h,3); ctx.fill();
        ctx.strokeStyle='rgba(30,159,226,0.15)'; ctx.lineWidth=0.8; ctx.stroke();
        ctx.fillStyle='rgba(30,159,226,0.25)'; ctx.fillRect(x+5,y+5,w-10,18);
        ctx.fillStyle='rgba(234,234,234,0.3)'; ctx.fillRect(x+5,y+28,w-10,4); ctx.fillRect(x+5,y+36,(w-10)*0.6,4);
        ctx.restore();
      }
    });
  }
}

// ─── 3. AI Product — 3-ring hologram ─────────────────
function drawAI(ctx, t) {
  ctx.clearRect(0, 0, PW, PH);

  if (IMG.ai?.complete && IMG.ai.naturalWidth > 0) {
    // Draw image with contain fit — full 3×2 grid visible
    ctx.fillStyle = '#04030a'; ctx.fillRect(0,0,PW,PH);
    const iw = IMG.ai.naturalWidth, ih = IMG.ai.naturalHeight;
    const scale = Math.min(PW/iw, PH/ih);
    const dw = iw*scale, dh = ih*scale;
    ctx.drawImage(IMG.ai, (PW-dw)/2, (PH-dh)/2, dw, dh);

    // Dark tinted overlay
    ctx.fillStyle = 'rgba(4,3,10,0.52)'; ctx.fillRect(0,0,PW,PH);
    ctx.fillStyle = 'rgba(30,159,226,0.06)'; ctx.fillRect(0,0,PW,PH);

    // Scan-grid lines
    ctx.strokeStyle = 'rgba(30,159,226,0.07)'; ctx.lineWidth = 0.5;
    for(let x=0;x<PW;x+=20){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,PH);ctx.stroke();}
    for(let y=0;y<PH;y+=20){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(PW,y);ctx.stroke();}

    // Horizontal scan line sweeping
    const scanY = ((t*0.4)%1)*PH;
    const sg = ctx.createLinearGradient(0,scanY-12,0,scanY+12);
    sg.addColorStop(0,'rgba(30,159,226,0)');
    sg.addColorStop(0.5,`rgba(30,159,226,${0.18+0.1*Math.sin(t*3)})`);
    sg.addColorStop(1,'rgba(30,159,226,0)');
    ctx.fillStyle=sg; ctx.fillRect(0,scanY-12,PW,24);

    // AI detect dots on outfit positions (3 top, 3 bottom in 3-col grid)
    const dots = [
      {x:46,y:60},{x:150,y:60},{x:254,y:60},
      {x:46,y:148},{x:150,y:148},{x:254,y:148},
    ];
    dots.forEach(({x,y},i)=>{
      const pulse=0.5+0.5*Math.sin(t*2.2+i*1.05);
      // outer ring
      ctx.strokeStyle=`rgba(30,159,226,${0.35*pulse})`;
      ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.arc(x,y,10+pulse*4,0,Math.PI*2); ctx.stroke();
      // inner dot
      ctx.fillStyle=`rgba(95,199,239,${0.7+0.3*pulse})`;
      ctx.beginPath(); ctx.arc(x,y,2,0,Math.PI*2); ctx.fill();
      // label line
      ctx.strokeStyle=`rgba(30,159,226,${0.3+0.2*pulse})`;
      ctx.lineWidth=0.6;
      ctx.beginPath(); ctx.moveTo(x+4,y-4); ctx.lineTo(x+14,y-10); ctx.stroke();
    });

    // Top-left label
    ctx.fillStyle='rgba(6,5,10,0.65)'; rr(ctx,6,6,80,16,3); ctx.fill();
    ctx.strokeStyle='rgba(30,159,226,0.4)'; ctx.lineWidth=0.7; ctx.stroke();
    ctx.fillStyle=ACCENT; ctx.font='bold 7px "Space Mono",monospace';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText('AI STYLIST', 12, 14);

    // Bottom-right: confidence
    const conf = 94 + Math.floor(Math.sin(t*0.7)*3);
    ctx.fillStyle='rgba(6,5,10,0.65)'; rr(ctx,PW-68,PH-22,62,16,3); ctx.fill();
    ctx.strokeStyle='rgba(34,197,94,0.4)'; ctx.lineWidth=0.7; ctx.stroke();
    ctx.fillStyle='rgba(34,197,94,0.9)'; ctx.font='7px "Space Mono",monospace';
    ctx.textAlign='right'; ctx.textBaseline='middle';
    ctx.fillText(`MATCH ${conf}%`, PW-10, PH-14);

  } else {
    const bg = ctx.createRadialGradient(PW/2,PH/2,0,PW/2,PH/2,PH*0.7);
    bg.addColorStop(0,'#06081a'); bg.addColorStop(1,'#020308');
    ctx.fillStyle=bg; ctx.fillRect(0,0,PW,PH);

    const CX=PW/2, CY=PH/2, R=60, FOV=380, N=64;
    const rotY=t*0.45, rotX=Math.sin(t*0.18)*0.28;

    function rot(x,y,z){
      const x1=x*Math.cos(rotY)+z*Math.sin(rotY), z1=-x*Math.sin(rotY)+z*Math.cos(rotY);
      const y2=y*Math.cos(rotX)-z1*Math.sin(rotX), z2=y*Math.sin(rotX)+z1*Math.cos(rotX);
      return [x1,y2,z2];
    }
    function proj([x,y,z]){const s=FOV/(FOV+z*0.6);return[x*s+CX,y*s+CY,(z+R)/(2*R)];}

    function drawRing(fn,r,g,b,phase){
      const pts=Array.from({length:N+1},(_,i)=>proj(rot(...fn(i/N*Math.PI*2))));
      for(let i=0;i<N;i++){
        const[ax,ay,ad]=pts[i],[bx,by]=pts[i+1];
        ctx.strokeStyle=`rgba(${r},${g},${b},${0.1+ad*0.45})`; ctx.lineWidth=0.7+ad*0.5;
        ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      }
      const pa=(t*1.1+phase)%(Math.PI*2);
      for(let i=6;i>=0;i--){
        const a=pa-i*0.1, [sx,sy,sd]=proj(rot(...fn(a)));
        ctx.fillStyle=`rgba(${r},${g},${b},${(1-i/7)*(0.4+sd*0.6)})`;
        ctx.beginPath(); ctx.arc(sx,sy,(1-i/8)*(2.8+sd),0,Math.PI*2); ctx.fill();
      }
    }

    drawRing(a=>[R*Math.cos(a),0,R*Math.sin(a)],30,159,226,0);
    drawRing(a=>[R*Math.cos(a),R*Math.sin(a),0],95,199,239,2.1);
    drawRing(a=>[0,R*Math.cos(a),R*Math.sin(a)],160,100,255,4.2);

    const pulse=0.65+0.35*Math.sin(t*2.8);
    const orb=ctx.createRadialGradient(CX,CY,0,CX,CY,18);
    orb.addColorStop(0,`rgba(95,199,239,${pulse})`); orb.addColorStop(0.5,'rgba(30,159,226,0.55)'); orb.addColorStop(1,'rgba(30,159,226,0)');
    ctx.fillStyle=orb; ctx.beginPath(); ctx.arc(CX,CY,18,0,Math.PI*2); ctx.fill();

    const glow=ctx.createRadialGradient(CX,CY,0,CX,CY,78);
    glow.addColorStop(0,'rgba(30,159,226,0.06)'); glow.addColorStop(1,'rgba(30,159,226,0)');
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(CX,CY,78,0,Math.PI*2); ctx.fill();
  }
}

// ─── 4. Business Automation — complex n8n + users ─────
function bz(p0,p1,p2,p3,t){const m=1-t;return{x:m**3*p0.x+3*m**2*t*p1.x+3*m*t**2*p2.x+t**3*p3.x,y:m**3*p0.y+3*m**2*t*p1.y+3*m*t**2*p2.y+t**3*p3.y};}

function drawN8n(ctx, t) {
  ctx.clearRect(0, 0, PW, PH);
  ctx.fillStyle = '#030610'; ctx.fillRect(0, 0, PW, PH);

  // 8 nodes in a wider pipeline
  const nodes = [
    {x:18,  y:100, c:'#f87315', label:'▶'},   // 0 trigger
    {x:70,  y:58,  c:ACCENT,    label:'⇄'},   // 1 filter A
    {x:70,  y:142, c:'#a855f7', label:'✉'},   // 2 filter B
    {x:130, y:40,  c:'#06b6d4', label:'🌐'},  // 3 HTTP
    {x:130, y:100, c:'#22c55e', label:'⚡'},  // 4 process
    {x:130, y:160, c:'#f59e0b', label:'🗄'},  // 5 DB
    {x:200, y:70,  c:'#ec4899', label:'📊'},  // 6 analytics
    {x:200, y:130, c:'#84cc16', label:'📨'},  // 7 notify
    {x:268, y:100, c:'#eaeaea', label:'✔'},   // 8 done
  ];
  const paths = [[0,1],[0,2],[1,3],[1,4],[2,4],[2,5],[3,6],[4,6],[4,7],[5,7],[6,8],[7,8]];

  paths.forEach(([a,b],i) => {
    const na=nodes[a], nb=nodes[b];
    const p0={x:na.x+15,y:na.y}, p3={x:nb.x-15,y:nb.y};
    const cp1={x:p0.x+(p3.x-p0.x)*0.5,y:p0.y}, cp2={x:p0.x+(p3.x-p0.x)*0.5,y:p3.y};
    ctx.strokeStyle='rgba(70,70,100,0.4)'; ctx.lineWidth=1.2; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(p0.x,p0.y); ctx.bezierCurveTo(cp1.x,cp1.y,cp2.x,cp2.y,p3.x,p3.y); ctx.stroke();
    const ph=((t*0.5+i*0.18)%1);
    const pt=bz(p0,cp1,cp2,p3,ph);
    ctx.fillStyle=na.c; ctx.beginPath(); ctx.arc(pt.x,pt.y,2.5,0,Math.PI*2); ctx.fill();
  });

  nodes.forEach(n => {
    ctx.fillStyle='#0a0f1e'; rr(ctx,n.x-14,n.y-12,28,24,4); ctx.fill();
    ctx.strokeStyle=n.c; ctx.lineWidth=1.2; ctx.stroke();
    ctx.fillStyle=n.c; ctx.font='11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(n.label,n.x,n.y);
  });

  // User counter — grows with time
  const users = Math.floor(8200 + (t % 60) * 180);
  const formatted = users.toLocaleString();
  ctx.textAlign='right'; ctx.textBaseline='top';
  ctx.fillStyle='rgba(30,159,226,0.35)'; ctx.font='7px "Space Mono",monospace';
  ctx.fillText('USERS', PW-8, 6);
  ctx.fillStyle=`rgba(34,197,94,${0.7+0.3*Math.sin(t*2)})`; ctx.font='bold 11px "Space Mono",monospace';
  ctx.fillText('↑ '+formatted, PW-8, 16);

  ctx.setLineDash([]);
}

// ─── 5. Pong ──────────────────────────────────────────
function drawGame(ctx, t) {
  ctx.clearRect(0, 0, PW, PH);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, PW, PH);

  const bx = PW/2 + Math.sin(t*1.1)*(PW/2-22);
  const by = PH/2 + Math.sin(t*1.7)*(PH/2-14);
  const pad=32, pw=6, mg=9;
  const p1y=Math.max(mg,Math.min(PH-pad-mg,by-pad/2));
  const p2y=Math.max(mg,Math.min(PH-pad-mg,by-pad/2));

  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=2; ctx.setLineDash([6,6]);
  ctx.beginPath(); ctx.moveTo(PW/2,0); ctx.lineTo(PW/2,PH); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle=TEXT; ctx.fillRect(mg,p1y,pw,pad); ctx.fillRect(PW-mg-pw,p2y,pw,pad);

  const grd=ctx.createRadialGradient(bx,by,0,bx,by,16);
  grd.addColorStop(0,'rgba(30,159,226,0.55)'); grd.addColorStop(1,'rgba(30,159,226,0)');
  ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(bx,by,16,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=ACCENT; ctx.beginPath(); ctx.arc(bx,by,5.5,0,Math.PI*2); ctx.fill();

  ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.font='bold 20px "Space Mono",monospace'; ctx.textAlign='center';
  ctx.fillText(Math.floor(t/3.8)%10, PW/2-20, 22);
  ctx.fillText(Math.floor(t/4.5)%10, PW/2+20, 22);
}

// ─── Main ─────────────────────────────────────────────
const DRAWS = [drawLanding, drawWebsite, drawAI, drawN8n, drawGame];

export function initSkillsPreview() {
  const items = [...document.querySelectorAll('.skills li')];
  if (!items.length) return;

  const wrap = document.createElement('div');
  wrap.className = 'skills-preview';
  const canvas = document.createElement('canvas');
  canvas.width = PW; canvas.height = PH;
  wrap.appendChild(canvas);
  document.body.appendChild(wrap);

  const ctx = canvas.getContext('2d');
  let activeIdx = -1, startTime = null, rafId = null;
  let tx = 0, ty = 0, cx = 0, cy = 0, visible = false;

  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    if (!visible || activeIdx < 0) return;
    if (startTime === null) { startTime = ts; cx = tx; cy = ty; }
    cx += (tx-cx)*0.1; cy += (ty-cy)*0.1;
    wrap.style.left = cx+'px'; wrap.style.top = cy+'px';
    DRAWS[activeIdx](ctx, (ts-startTime)/1000);
  }
  rafId = requestAnimationFrame(loop);

  items.forEach((li,i) => {
    li.addEventListener('mouseenter', () => {
      if (document.body.dataset.page !== 'about') return;
      activeIdx=i; startTime=null; visible=true;
      wrap.classList.add('is-visible');
    });
    li.addEventListener('mouseleave', () => {
      visible=false; activeIdx=-1;
      wrap.classList.remove('is-visible');
    });
  });

  document.addEventListener('mousemove', e => {
    tx = Math.min(e.clientX+24, window.innerWidth-PW-8);
    ty = Math.max(8, Math.min(e.clientY-PH/2, window.innerHeight-PH-8));
  });
}
