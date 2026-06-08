// ─────────────────────────────────────────────────────
// NYM / SWEEP — Full-screen minesweeper, hacker style  v3
// • Entrance scan-wave animation
// • Hover ripple: cells scale up with distance falloff
// • Electricity crawlers along cell borders
// ─────────────────────────────────────────────────────

import { pauseLenis, resumeLenis } from './smooth-scroll.js?v=29';
import { registerExitHandler }    from './overlays.js?v=28';

// ── Config ─────────────────────────────────────────
const CELL    = 30;
const MINE_R  = 0.155;
const NUM_COL = ['','#00d4ff','#00ff88','#ff4466','#bb88ff','#ff8822','#00ffdd','#ffffff','#888899'];

// Scale ripple
const S0 = 1.18, S1 = 1.09, S2 = 1.03; // dist 0,1,2

// Electricity crawlers
const CRAWLER_N    = 14;   // simultaneous arcs
const CRAWLER_LIFE = 120;  // frames per arc

// ── State ──────────────────────────────────────────
let canvas, ctx;
let cols, rows, total, mineCount;
let cells = [];
let state = 'idle';
let firstClick = true, revealed = 0, flagged = 0;

let hoverIdx  = -1;
let cellScale = [];   // per-cell current scale
let cellScaleT= [];   // per-cell target scale
let particles = [];
let flashCells= [];
let crawlers  = [];   // electric arcs

// Entrance animation
let introT    = 0;    // 0→1 over ~80 frames
let introDone = false;

let rafId = null, active = false;

// ── Cell helpers ────────────────────────────────────
const idx = (c,r) => r*cols+c;
const col = i => i%cols;
const row = i => Math.floor(i/cols);
const cx  = i => col(i)*CELL + CELL/2;
const cy  = i => row(i)*CELL + CELL/2;

function neighbours(i) {
  const c=col(i),r=row(i),nb=[];
  for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
    if(!dr&&!dc) continue;
    const nc=c+dc,nr=r+dr;
    if(nc>=0&&nc<cols&&nr>=0&&nr<rows) nb.push(idx(nc,nr));
  }
  return nb;
}

// ── Init ────────────────────────────────────────────
function newGame() {
  cols  = Math.max(10, Math.floor(canvas.width  / CELL));
  rows  = Math.max(8,  Math.floor(canvas.height / CELL));
  total = cols*rows;
  mineCount = Math.round(total*MINE_R);
  cells = Array.from({length:total}, ()=>({mine:false,revealed:false,flagged:false,number:0}));
  cellScale  = new Float32Array(total).fill(1);
  cellScaleT = new Float32Array(total).fill(1);
  state = 'playing'; firstClick=true; revealed=0; flagged=0;
  particles=[]; flashCells=[]; crawlers=[];
  // Start entrance
  introT=0; introDone=false;
  // Seed initial crawlers
  for(let k=0;k<CRAWLER_N;k++) spawnCrawler(Math.random()*CRAWLER_LIFE|0);
}

function placeMines(safe) {
  const safeSet = new Set([safe,...neighbours(safe)]);
  let p=0;
  while(p<mineCount){
    const i=Math.floor(Math.random()*total);
    if(!safeSet.has(i)&&!cells[i].mine){cells[i].mine=true;p++;}
  }
  for(let i=0;i<total;i++){
    if(cells[i].mine) continue;
    cells[i].number = neighbours(i).filter(n=>cells[n].mine).length;
  }
}

// ── Reveal + flood ──────────────────────────────────
function reveal(i) {
  if(i<0||i>=total) return;
  const c=cells[i];
  if(c.revealed||c.flagged) return;
  c.revealed=true; revealed++;
  flashCells.push({idx:i,t:1.0});
  if(!c.mine&&c.number===0){
    const q=[i];
    while(q.length){
      const cur=q.shift();
      for(const nb of neighbours(cur)){
        if(!cells[nb].revealed&&!cells[nb].flagged&&!cells[nb].mine){
          cells[nb].revealed=true; revealed++;
          flashCells.push({idx:nb,t:1.0});
          if(cells[nb].number===0) q.push(nb);
        }
      }
    }
  }
}

function checkWin(){
  if(revealed+mineCount===total){ state='won'; spawnWinParticles(); }
}

// ── Particles ───────────────────────────────────────
function spawnExplosion(i){
  for(let k=0;k<32;k++){
    const a=Math.random()*Math.PI*2, s=1.5+Math.random()*4.5;
    particles.push({x:cx(i),y:cy(i),vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      life:1,decay:0.016+Math.random()*0.020,size:2+Math.random()*3,
      col:Math.random()>.5?'#ff2244':'#ff8800'});
  }
}
function spawnWinParticles(){
  for(let k=0;k<100;k++){
    particles.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,
      vx:(Math.random()-.5)*3,vy:-2-Math.random()*4,
      life:1,decay:0.006+Math.random()*0.010,size:3+Math.random()*4,
      col:Math.random()>.5?'#1E9FE2':'#00ffdd'});
  }
}

// ── Electricity crawlers ────────────────────────────
// Each crawler travels along the border of a random cell, then jumps to neighbour
function spawnCrawler(age=0){
  const i  = Math.floor(Math.random()*total);
  const nb = neighbours(i);
  crawlers.push({
    from: i,
    to:   nb[Math.floor(Math.random()*nb.length)] ?? i,
    t:    age / CRAWLER_LIFE,
    life: CRAWLER_LIFE - age,
    opacity: 0.6+Math.random()*0.4,
  });
}

function updateCrawlers(){
  crawlers = crawlers.filter(c=>{
    c.t    += 0.022;
    c.life -= 1;
    return c.life > 0 && c.t <= 1;
  });
  while(crawlers.length < CRAWLER_N) spawnCrawler();
}

function drawCrawlers(){
  crawlers.forEach(c=>{
    const ax=cx(c.from), ay=cy(c.from);
    const bx=cx(c.to),   by=cy(c.to);
    const px=ax+(bx-ax)*c.t, py=ay+(by-ay)*c.t;
    const fade = Math.sin(c.t*Math.PI);  // fade in/out
    ctx.save();
    ctx.beginPath();
    ctx.arc(px,py, 2.5,0,Math.PI*2);
    ctx.fillStyle=`rgba(30,159,226,${c.opacity*fade})`;
    ctx.shadowColor='#1E9FE2';
    ctx.shadowBlur=10;
    ctx.fill();
    // trailing glow line
    ctx.beginPath();
    const tx=ax+(bx-ax)*Math.max(0,c.t-0.15), ty=ay+(by-ay)*Math.max(0,c.t-0.15);
    ctx.moveTo(tx,ty); ctx.lineTo(px,py);
    ctx.strokeStyle=`rgba(30,159,226,${c.opacity*fade*0.4})`;
    ctx.lineWidth=1.5;
    ctx.stroke();
    ctx.restore();
  });
}

// ── Scale ripple ─────────────────────────────────────
function updateScales(){
  // Reset targets
  cellScaleT.fill(1);

  if(hoverIdx>=0 && hoverIdx<total && state==='playing'){
    const hc=col(hoverIdx), hr=row(hoverIdx);
    // Apply ripple within radius 3
    for(let dr=-3;dr<=3;dr++) for(let dc=-3;dc<=3;dc++){
      const nc=hc+dc, nr=hr+dr;
      if(nc<0||nc>=cols||nr<0||nr>=rows) continue;
      const dist=Math.abs(dc)+Math.abs(dr);
      const s = dist===0?S0 : dist===1?S1 : dist===2?S2 : 1+0.008;
      const ni=idx(nc,nr);
      if(s>cellScaleT[ni]) cellScaleT[ni]=s;
    }
  }

  // Lerp toward target
  for(let i=0;i<total;i++){
    const spd = cellScaleT[i]>cellScale[i] ? 0.18 : 0.10;
    cellScale[i] += (cellScaleT[i]-cellScale[i])*spd;
  }
}

// ── Draw ─────────────────────────────────────────────
function draw(){
  const W=canvas.width, H=canvas.height;
  ctx.fillStyle='#010205';
  ctx.fillRect(0,0,W,H);

  // Update state
  if(!introDone){ introT=Math.min(1,introT+0.013); if(introT>=1) introDone=true; }
  flashCells = flashCells.filter(f=>{f.t-=0.055;return f.t>0;});
  particles  = particles.filter(p=>{
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.11; p.life-=p.decay; return p.life>0;
  });
  updateCrawlers();
  updateScales();

  // Wave front for entrance (top→bottom, introT=0 start, 1 done)
  const waveY = introDone ? H*2 : introT * (H + CELL*2) - CELL;

  for(let i=0;i<total;i++){
    const c  = cells[i];
    const bx = col(i)*CELL, by = row(i)*CELL;
    const cy_ = by + CELL/2;

    // Entrance: hide cells above the wave front
    if(!introDone && cy_>waveY) continue;

    const sc    = cellScale[i];
    const cl    = CELL-1;
    const flash = flashCells.find(f=>f.idx===i);
    const hover = i===hoverIdx;

    // Apply scale transform around cell centre
    ctx.save();
    if(sc!==1){
      ctx.translate(bx+CELL/2, by+CELL/2);
      ctx.scale(sc,sc);
      ctx.translate(-(bx+CELL/2),-(by+CELL/2));
    }

    if(c.revealed){
      if(c.mine&&state==='dead'){
        ctx.fillStyle='rgba(255,20,40,0.20)';
        ctx.fillRect(bx,by,cl,cl);
        ctx.strokeStyle='#ff3355'; ctx.lineWidth=2;
        ctx.shadowColor='#ff3355'; ctx.shadowBlur=8;
        ctx.beginPath();
        ctx.moveTo(bx+7,by+7);ctx.lineTo(bx+cl-7,by+cl-7);
        ctx.moveTo(bx+cl-7,by+7);ctx.lineTo(bx+7,by+cl-7);
        ctx.stroke(); ctx.shadowBlur=0;
      } else {
        if(flash){
          ctx.fillStyle=`rgba(30,159,226,${flash.t*0.22})`;
          ctx.fillRect(bx,by,cl,cl);
        }
        if(c.number>0){
          ctx.shadowColor=NUM_COL[c.number]; ctx.shadowBlur=6;
          ctx.fillStyle=NUM_COL[c.number];
          ctx.font=`bold ${Math.round(CELL*0.52)}px monospace`;
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(c.number, bx+CELL/2, by+CELL/2);
          ctx.shadowBlur=0;
        }
      }
    } else {
      // Closed cell
      const alpha = hover?0.95:0.65;
      ctx.fillStyle=hover?'rgba(20,25,46,0.96)':'rgba(10,10,20,0.92)';
      ctx.fillRect(bx,by,cl,cl);

      // Border — brighter when scaled
      const bAlpha = Math.min(1, alpha + (sc-1)*2);
      ctx.strokeStyle=`rgba(30,159,226,${bAlpha})`;
      ctx.lineWidth=hover?1.3:0.75;
      if(hover){ctx.shadowColor='#1E9FE2';ctx.shadowBlur=10;}
      ctx.strokeRect(bx+0.5,by+0.5,cl-1,cl-1);
      ctx.shadowBlur=0;

      // Corner tech marks
      const m=4,l=5;
      ctx.strokeStyle=`rgba(30,159,226,${bAlpha*0.4})`;
      ctx.lineWidth=0.6;
      ctx.beginPath();
      ctx.moveTo(bx+m,by+m+l);ctx.lineTo(bx+m,by+m);ctx.lineTo(bx+m+l,by+m);
      ctx.moveTo(bx+cl-m,by+cl-m-l);ctx.lineTo(bx+cl-m,by+cl-m);ctx.lineTo(bx+cl-m-l,by+cl-m);
      ctx.stroke();

      // Intro scan-line glow on the wave front
      if(!introDone){
        const dist=Math.abs(cy_-waveY);
        if(dist<CELL*3){
          const g=1-dist/(CELL*3);
          ctx.fillStyle=`rgba(30,159,226,${g*0.35})`;
          ctx.fillRect(bx,by,cl,cl);
        }
      }

      if(flash){
        ctx.fillStyle=`rgba(30,159,226,${flash.t*0.5})`;
        ctx.fillRect(bx,by,cl,cl);
      }
      if(c.flagged){
        ctx.fillStyle='#ff4466'; ctx.shadowColor='#ff4466'; ctx.shadowBlur=10;
        ctx.font=`${Math.round(CELL*0.55)}px sans-serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('⚑',bx+CELL/2,by+CELL/2);
        ctx.shadowBlur=0;
      }
    }

    // Show mines on death
    if(state==='dead'&&c.mine&&!c.flagged&&!c.revealed){
      ctx.fillStyle='rgba(255,50,50,0.12)';
      ctx.fillRect(bx,by,cl,cl);
      ctx.fillStyle='#ff3355';
      ctx.font=`${Math.round(CELL*0.48)}px monospace`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('◉',bx+CELL/2,by+CELL/2);
    }

    ctx.restore();
  }

  // Electricity crawlers (drawn on top, no clip)
  drawCrawlers();

  // Particles
  particles.forEach(p=>{
    ctx.globalAlpha=p.life;
    ctx.fillStyle=p.col; ctx.shadowColor=p.col; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha=1; ctx.shadowBlur=0;

  // HUD
  const remaining = mineCount-flagged;
  ctx.fillStyle='rgba(30,159,226,0.65)';
  ctx.font='11px monospace'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(`◉ ${remaining}  ⚑ ${flagged}`,10,8);

  // Win/dead overlay
  if(state==='won'||state==='dead'){
    ctx.fillStyle='rgba(1,2,5,0.75)';
    ctx.fillRect(0,0,W,H);
    const msg=state==='won'?'ACCESS GRANTED':'SYSTEM FAILURE';
    const sub='Click to restart';
    const colour=state==='won'?'#00ffdd':'#ff2244';
    ctx.shadowColor=colour; ctx.shadowBlur=28;
    ctx.fillStyle=colour;
    ctx.font='bold 42px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(msg,W/2,H/2-24);
    ctx.shadowBlur=0; ctx.fillStyle='rgba(234,234,234,0.5)';
    ctx.font='14px monospace';
    ctx.fillText(sub,W/2,H/2+20);
  }
}

// ── Game loop ────────────────────────────────────────
function loop(){ rafId=requestAnimationFrame(loop); if(active) draw(); }

// ── Input ────────────────────────────────────────────
function cellAt(x,y){
  const c=Math.floor(x/CELL),r=Math.floor(y/CELL);
  if(c<0||c>=cols||r<0||r>=rows) return -1;
  return idx(c,r);
}
function onClick(e){
  if(!active) return;
  e.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const i=cellAt(e.clientX-rect.left,e.clientY-rect.top);
  if(state==='won'||state==='dead'){newGame();return;}
  if(i<0) return;
  const c=cells[i];
  if(c.flagged) return;
  if(firstClick){firstClick=false;placeMines(i);}
  if(!c.revealed){
    reveal(i);
    if(c.mine){state='dead';spawnExplosion(i);}
    else checkWin();
  }
}
function onRightClick(e){
  if(!active) return;
  e.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const i=cellAt(e.clientX-rect.left,e.clientY-rect.top);
  if(i<0||state!=='playing') return;
  const c=cells[i];
  if(c.revealed) return;
  c.flagged=!c.flagged; flagged+=c.flagged?1:-1;
}
function onMouseMove(e){
  if(!active) return;
  const rect=canvas.getBoundingClientRect();
  hoverIdx=cellAt(e.clientX-rect.left,e.clientY-rect.top);
}
function onMouseLeave(){ hoverIdx=-1; }
function onResize(){
  if(!canvas) return;
  canvas.width=window.innerWidth; canvas.height=window.innerHeight;
  newGame();
}

// ── Public API ───────────────────────────────────────
export function initSweep(){
  registerExitHandler(hideSweep);
}

export function showSweep(){
  const pg=document.getElementById('page-sweep');
  if(!pg) return;
  pg.style.display='block';
  requestAnimationFrame(()=>pg.classList.add('is-visible'));

  canvas=document.getElementById('sweep-canvas');
  if(!canvas) return;
  ctx=canvas.getContext('2d');
  canvas.width=window.innerWidth; canvas.height=window.innerHeight;

  newGame();
  active=true;

  canvas.addEventListener('click',       onClick);
  canvas.addEventListener('contextmenu', onRightClick);
  canvas.addEventListener('mousemove',   onMouseMove);
  canvas.addEventListener('mouseleave',  onMouseLeave);
  window.addEventListener('resize',      onResize);

  if(!rafId) rafId=requestAnimationFrame(loop);
  pauseLenis();
  document.body.dataset.page='sweep';
}

export function hideSweep(){
  const pg=document.getElementById('page-sweep');
  if(!pg) return;
  pg.classList.remove('is-visible');
  setTimeout(()=>{pg.style.display='none';},500);
  active=false;
  if(rafId){cancelAnimationFrame(rafId);rafId=null;}
  canvas?.removeEventListener('click',       onClick);
  canvas?.removeEventListener('contextmenu', onRightClick);
  canvas?.removeEventListener('mousemove',   onMouseMove);
  canvas?.removeEventListener('mouseleave',  onMouseLeave);
  window.removeEventListener('resize',       onResize);
  if(document.body.dataset.page==='sweep') delete document.body.dataset.page;
  resumeLenis();
}
