/**
 * public/js/canvas.js  — Sanskrit Visual Builder v3.1 FINAL
 *
 * Features:
 *  ✓ Magnetic wire snapping — glow ring appears when within SNAP_R of a port
 *  ✓ Delete key removes selected block or selected wire
 *  ✓ Click wire to select/highlight, press DEL to remove
 *  ✓ exportSans() / importSans() for .sans file format
 *  ✓ addBlockById() for recommendations panel
 *  ✓ Correct param key reading (key || name)
 *  ✓ Correct port reading  (id||name, dt||type)
 */

const GRID     = 20;
const BLK_W    = 200;
const HDR_H    = 32;
const PARAM_H  = 19;
const PORT_R   = 8;
const MIN_H    = 76;
const SNAP_R   = 52;   // magnetic snap radius in canvas px

// ── Category → header colour ──────────────────────────────────────────────────
const CAT_COL = {
  quantum_reg:'#0D9488', quantum_gate:'#6C3FC5', quantum_meas:'#4338CA',
  quantum_algo:'#2563EB', error_mit:'#0891B2',  noise:'#EA580C',
  chemistry:'#059669',   drug:'#7C3AED',         biology:'#16A34A',
  physics:'#4338CA',     ml:'#65A30D',           genai:'#9333EA',
  math:'#6366F1',        output:'#F59E0B',        utility:'#374151',
  classical:'#CE4A2E',   fn_block:'#D97706',      medical:'#0891B2',
  materials:'#78716C',   astro:'#475569',         finance:'#065F46',
  Quantum:'#1D4ED8',     Chemistry:'#059669',     Biology:'#16A34A',
  Physics:'#4338CA',     ML:'#65A30D',            Data:'#EA580C',
  Output:'#F59E0B',      Utility:'#374151',       Math:'#6366F1',
};
function hdrCol(block) {
  return block.raw?.color || block.color
    || CAT_COL[block.def?.cat] || CAT_COL[(block.def?.category||'').split('/')[0]?.trim()] || '#374151';
}

// ── Port colours ──────────────────────────────────────────────────────────────
const PFILL  = { register:'#7C3AED',qubit:'#6D28D9',classical:'#1D4ED8',number:'#1D4ED8',list:'#0F766E',dict:'#B45309',string:'#374151',bool:'#059669',any:'#064E3B' };
const PSTK   = { register:'#A78BFA',qubit:'#C4B5FD',classical:'#60A5FA',number:'#60A5FA',list:'#2DD4BF',dict:'#FCD34D',string:'#9CA3AF',bool:'#34D399',any:'#34D399' };
const WCOL   = { register:'#7C3AED',qubit:'#6D28D9',number:'#1D4ED8',list:'#0F766E',dict:'#B45309',any:'#0F4C5C' };

// ── Normalise param: read key || name ─────────────────────────────────────────
function nP(p) {
  if (!p || typeof p!=='object') return {key:'val',label:'Value',type:'string',def:''};
  return {
    key:   p.key   || p.name  || p.id    || 'val',
    label: p.label || p.name  || p.key   || 'Value',
    type:  p.type  || 'string',
    def:   p.value !== undefined ? p.value : p.default !== undefined ? p.default : '',
    options: p.options||null, min:p.min, max:p.max, step:p.step,
  };
}
// ── Normalise port: read id||name, dt||type ───────────────────────────────────
function nPort(p,defaultDir) {
  if (!p||typeof p!=='object') return {name:'port',type:'any',dir:defaultDir};
  const dir = p.dir || defaultDir;
  return { name: p.id||p.name||'port', type: p.dt||p.type||'any', dir, label: p.label||p.id||p.name||'' };
}

// ── Normalise block definition ────────────────────────────────────────────────
function normDef(raw) {
  if (!raw) return {id:'?',label:'Block',cat:'',params:[],ins:[],outs:[],toSq:null};
  const allParams = (raw.params||[]).filter(p=>!['bypass','code_override','override_code'].includes(p.key||p.name||''));
  return {
    id:    raw.id   || '?',
    label: raw.label|| raw.name || raw.id || 'Block',
    cat:   raw.cat  || raw.category || 'Utility',
    color: raw.color|| null,
    info:  typeof raw.info==='string' ? raw.info : (raw.description||''),
    params: allParams.map(nP),
    ins:  (raw.inputs ||[]).filter(p=>(p.dir||'in')==='in').map(p=>nPort(p,'in')),
    outs: (raw.outputs||[]).map(p=>nPort(p,'out')),
    toSq: raw.toSq||null,
  };
}

function bH(def) {
  const vis = def.params.filter(p=>!['bypass','log_result','noise_model','error_rate'].includes(p.key));
  return Math.max(MIN_H, HDR_H + Math.min(vis.length,5)*PARAM_H + Math.max(def.ins.length,def.outs.length)*24 + 14);
}

function portXY(def,portName,dir,bx,by,bh) {
  const list = dir==='out' ? def.outs : def.ins;
  const idx  = list.findIndex(p=>p.name===portName);
  if (idx<0) return null;
  return { x: dir==='out'?bx+BLK_W:bx, y: by+HDR_H+(idx+1)*(bh-HDR_H)/(list.length+1), type:list[idx].type };
}

let _nid = 1;

// ── BLOCK DEFS CACHE ──────────────────────────────────────────────────────────
const _defCache = new Map();
async function fetchDef(blockId) {
  if (_defCache.has(blockId)) return _defCache.get(blockId);
  try {
    const r = await fetch(`/api/blocks?id=${encodeURIComponent(blockId)}`);
    if (r.ok) {
      const d = await r.json();
      const arr = d.blocks||(Array.isArray(d)?d:[d]);
      const found = arr.find(b=>b.id===blockId)||arr[0];
      if (found) { _defCache.set(blockId,found); return found; }
    }
  } catch(e) {}
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
export class Canvas {
// ═══════════════════════════════════════════════════════════════════════════════
  constructor(svgEl) {
    this.svg   = svgEl;
    this.bG    = svgEl.querySelector('#canvas-blocks');
    this.wG    = svgEl.querySelector('#canvas-wires');
    this.draft = svgEl.querySelector('#wire-draft');
    this.gridG = svgEl.querySelector('#canvas-grid');
    this.snapEl= svgEl.querySelector('#snap-indicator');
    this.hint  = document.getElementById('canvas-empty-hint');

    this.blocks = new Map();   // id → block
    this.wires  = new Map();   // id → wire
    this.selBlock= null;       // selected block id
    this.selWire = null;       // selected wire id
    this.dw      = null;       // drawing wire state
    this.drag    = null;       // dragging block
    this.pan     = null;       // panning

    this.vx=0; this.vy=0; this.vs=1;
    this.onBlockSelect = null;
  }

  init() { this._grid(); this._events(); this._drop(); }

  // ── Grid ──────────────────────────────────────────────────────────────────
  _grid() {
    let s='';
    for(let x=0;x<=6000;x+=GRID) s+=`<line x1="${x}" y1="0" x2="${x}" y2="4000" stroke="${x%(GRID*5)?'#1A2030':'#1E2840'}" stroke-width="1"/>`;
    for(let y=0;y<=4000;y+=GRID) s+=`<line x1="0" y1="${y}" x2="6000" y2="${y}" stroke="${y%(GRID*5)?'#1A2030':'#1E2840'}" stroke-width="1"/>`;
    this.gridG.innerHTML=s;
  }

  _vp() {
    const t=`translate(${this.vx},${this.vy}) scale(${this.vs})`;
    [this.gridG,this.bG,this.wG].forEach(g=>g?.setAttribute('transform',t));
  }

  _toC(ex,ey) {
    const r=this.svg.getBoundingClientRect();
    return {x:(ex-r.left-this.vx)/this.vs, y:(ey-r.top-this.vy)/this.vs};
  }

  // ── Drop from palette ──────────────────────────────────────────────────────
  _drop() {
    const w=this.svg.parentElement;
    w.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
    w.addEventListener('drop',async e=>{
      e.preventDefault();
      try {
        const d=JSON.parse(e.dataTransfer.getData('text/plain'));
        if(d.type!=='block') return;
        const pt=this._toC(e.clientX,e.clientY);
        const raw=await fetchDef(d.blockId);
        this.addBlock(raw||{id:d.blockId,label:d.label||d.blockId,cat:'Utility'}, Math.round(pt.x/GRID)*GRID, Math.round(pt.y/GRID)*GRID);
      } catch(e2){console.warn('drop',e2);}
    });
  }

  // ── Add block ──────────────────────────────────────────────────────────────
  addBlock(raw,x,y) {
    const def=normDef(raw);
    const id=`b${_nid++}`;
    const h=bH(def);
    const params={};
    def.params.forEach(p=>{params[p.key]=p.def;});
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.dataset.bid=id;
    this._paint(g,def,id,x,y,h,params,raw);
    this.bG.appendChild(g);
    const block={def,id,x,y,h,params,el:g,raw};
    this.blocks.set(id,block);
    this._hint();
    if(this.onBlockSelect) this.onBlockSelect(block);
    return block;
  }

  // ── addBlockById — for recommendations ────────────────────────────────────
  async addBlockById(blockId) {
    const raw = await fetchDef(blockId);
    const x   = 100 + (this.blocks.size % 5)*240;
    const y   = 100 + Math.floor(this.blocks.size/5)*180;
    return this.addBlock(raw||{id:blockId,label:blockId,cat:'Utility'},x,y);
  }

  // ── Paint ─────────────────────────────────────────────────────────────────
  _paint(g,def,id,x,y,h,params,raw) {
    const col=hdrCol({def,raw,color:def.color});
    const catL=(def.cat||'').split(/[/_]/).pop()?.trim()||'';
    const BW=BLK_W;

    // Visible params (skip internal ones)
    const visPar=def.params.filter(p=>!['bypass','log_result','noise_model','error_rate','code_override','override_code'].includes(p.key));

    let pSVG=''; let py=y+HDR_H+13;
    visPar.slice(0,5).forEach(p=>{
      const cur=params[p.key]!==undefined&&params[p.key]!==null?params[p.key]:p.def;
      const v=String(cur??''); const disp=v.length>15?v.slice(0,15)+'…':v;
      pSVG+=`<text x="${x+10}" y="${py}" font-size="10" fill="#64748B" font-family="Segoe UI,sans-serif">${p.label}:</text><text x="${x+BW-10}" y="${py}" text-anchor="end" font-size="10" fill="#CBD5E1" font-family="Segoe UI,sans-serif">${disp}</text>`;
      py+=PARAM_H;
    });

    let portSVG='';
    def.ins.forEach((p,i)=>{
      const pp=y+HDR_H+(i+1)*(h-HDR_H)/(def.ins.length+1);
      const f=PFILL[p.type]||PFILL.any, s=PSTK[p.type]||PSTK.any;
      portSVG+=`<circle cx="${x}" cy="${pp}" r="${PORT_R}" fill="${f}" stroke="${s}" stroke-width="1.5" data-bid="${id}" data-port="${p.name}" data-dir="in" style="cursor:crosshair"/><text x="${x+PORT_R+5}" y="${pp+4}" font-size="9" fill="#475569" font-family="Segoe UI,sans-serif">${p.label||p.name}</text>`;
    });
    def.outs.forEach((p,i)=>{
      const pp=y+HDR_H+(i+1)*(h-HDR_H)/(def.outs.length+1);
      const f=PFILL[p.type]||PFILL.any, s=PSTK[p.type]||PSTK.any;
      portSVG+=`<circle cx="${x+BW}" cy="${pp}" r="${PORT_R}" fill="${f}" stroke="${s}" stroke-width="1.5" data-bid="${id}" data-port="${p.name}" data-dir="out" style="cursor:crosshair"/><text x="${x+BW-PORT_R-5}" y="${pp+4}" text-anchor="end" font-size="9" fill="#475569" font-family="Segoe UI,sans-serif">${p.label||p.name}</text>`;
    });

    // Icon if available
    const icon=raw?.icon?`<text x="${x+BW-14}" y="${y+19}" font-size="13" text-anchor="end" font-family="Segoe UI,sans-serif" opacity="0.6">${raw.icon}</text>`:'';

    g.innerHTML=`
      <rect x="${x+3}" y="${y+4}" width="${BW}" height="${h}" rx="8" fill="rgba(0,0,0,0.3)"/>
      <rect x="${x}" y="${y}" width="${BW}" height="${h}" rx="8" fill="#1E2538" stroke="#2D3748" stroke-width="1"/>
      <rect x="${x}" y="${y}" width="${BW}" height="${HDR_H}" rx="8" fill="${col}"/>
      <rect x="${x}" y="${y+HDR_H-6}" width="${BW}" height="6" fill="${col}"/>
      ${icon}
      <text x="${x+10}" y="${y+21}" font-size="13" font-weight="600" fill="white" font-family="Segoe UI,sans-serif">${def.label}</text>
      <text x="${x+10}" y="${y+30}" font-size="9" fill="rgba(255,255,255,0.55)" font-family="Segoe UI,sans-serif">${catL}</text>
      ${pSVG}${portSVG}
      <rect class="sel-ol" x="${x}" y="${y}" width="${BW}" height="${h}" rx="8" fill="none" stroke="#00e5ff" stroke-width="2" opacity="0" filter="url(#glow)"/>
    `;
  }

  _repaint(block) {
    this._paint(block.el,block.def,block.id,block.x,block.y,block.h,block.params,block.raw);
    this.wires.forEach(w=>{if(w.fb===block.id||w.tb===block.id)this._drawWire(w);});
    if(this.selBlock===block.id) block.el.querySelector('.sel-ol')?.setAttribute('opacity','1');
  }

  // ── Wire ─────────────────────────────────────────────────────────────────
  _curve(x1,y1,x2,y2){const cx=(x1+x2)/2;return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;}

  _drawWire(w){
    const fb=this.blocks.get(w.fb),tb=this.blocks.get(w.tb);
    if(!fb||!tb)return;
    const fp=portXY(fb.def,w.fp,'out',fb.x,fb.y,fb.h);
    const tp=portXY(tb.def,w.tp,'in', tb.x,tb.y,tb.h);
    if(!fp||!tp)return;
    w.el.setAttribute('d',this._curve(fp.x,fp.y,tp.x,tp.y));
    w.el.setAttribute('stroke',WCOL[fp.type]||WCOL.any);
  }

  _addWire(fb,fp,tb,tp){
    if(fb===tb)return;
    for(const w of this.wires.values()) if(w.fb===fb&&w.fp===fp&&w.tb===tb&&w.tp===tp)return;
    const wid=`w${_nid++}`;
    const el=document.createElementNS('http://www.w3.org/2000/svg','path');
    el.setAttribute('fill','none'); el.setAttribute('stroke-width','2.5');
    el.setAttribute('stroke-linecap','round'); el.setAttribute('marker-end','url(#arrowhead)');
    el.style.cursor='pointer'; el.dataset.wid=wid;
    this.wG.appendChild(el);
    const wire={fb,fp,tb,tp,el};
    this.wires.set(wid,wire);
    this._drawWire(wire);
  }

  _delWire(wid){const w=this.wires.get(wid);if(w){w.el.remove();this.wires.delete(wid);}}

  _cancelWire(){this.dw=null;if(this.draft){this.draft.setAttribute('d','');this.draft.style.display='none';}if(this.snapEl)this.snapEl.setAttribute('opacity','0');}

  // ── Find nearest input port within SNAP_R ────────────────────────────────
  _findSnap(cx,cy,excludeBlockId) {
    let best=null, bestD=SNAP_R;
    for(const block of this.blocks.values()){
      if(block.id===excludeBlockId) continue;
      block.def.ins.forEach(p=>{
        const pos=portXY(block.def,p.name,'in',block.x,block.y,block.h);
        if(!pos)return;
        const d=Math.hypot(cx-pos.x,cy-pos.y);
        if(d<bestD){bestD=d;best={block,portName:p.name,x:pos.x,y:pos.y};}
      });
    }
    return best;
  }

  // ── Events — SVG delegation ───────────────────────────────────────────────
  _events() {
    const svg=this.svg;

    svg.addEventListener('mousedown',e=>{
      // Port → start wire
      const portEl=e.target.closest('[data-dir]');
      if(portEl){
        e.stopPropagation();e.preventDefault();
        if(portEl.dataset.dir==='out'){
          const bid=portEl.dataset.bid, pn=portEl.dataset.port;
          const block=this.blocks.get(bid);if(!block)return;
          const pos=portXY(block.def,pn,'out',block.x,block.y,block.h);
          if(pos)this.dw={bid,port:pn,sx:pos.x,sy:pos.y};
        }
        return;
      }
      // Wire click → select wire
      const wireEl=e.target.closest('[data-wid]');
      if(wireEl){
        e.stopPropagation();
        this._selectWire(wireEl.dataset.wid);
        return;
      }
      // Block drag
      const bg=e.target.closest('[data-bid]');
      if(bg){
        e.preventDefault();
        const bid=bg.dataset.bid, block=this.blocks.get(bid);if(!block)return;
        this._selectBlock(bid);
        const pt=this._toC(e.clientX,e.clientY);
        this.drag={bid,ox:pt.x-block.x,oy:pt.y-block.y};
        return;
      }
      // Deselect + pan
      this._deselect();
      this.pan={mx:e.clientX,my:e.clientY,vx:this.vx,vy:this.vy};
    });

    svg.addEventListener('mousemove',e=>{
      if(this.dw){
        const pt=this._toC(e.clientX,e.clientY);
        // Magnetic snap
        const snap=this._findSnap(pt.x,pt.y,this.dw.bid);
        if(snap&&this.snapEl){
          // Convert snap coords to screen
          const sx=snap.x*this.vs+this.vx, sy=snap.y*this.vs+this.vy;
          this.snapEl.setAttribute('cx',sx);this.snapEl.setAttribute('cy',sy);
          this.snapEl.setAttribute('r',Math.round(14*this.vs));
          this.snapEl.setAttribute('opacity','0.9');
        } else if(this.snapEl){
          this.snapEl.setAttribute('opacity','0');
        }
        // Draw draft wire
        const x2=snap?snap.x:pt.x, y2=snap?snap.y:pt.y;
        const x1=this.dw.sx,y1=this.dw.sy;
        const cx=(x1+x2)/2;
        const sx1=x1*this.vs+this.vx,sy1=y1*this.vs+this.vy;
        const sx2=x2*this.vs+this.vx,sy2=y2*this.vs+this.vy;
        const scx=(sx1+sx2)/2;
        if(this.draft){this.draft.setAttribute('d',`M ${sx1} ${sy1} C ${scx} ${sy1}, ${scx} ${sy2}, ${sx2} ${sy2}`);this.draft.style.display='block';}
        return;
      }
      if(this.drag){
        const pt=this._toC(e.clientX,e.clientY);
        const block=this.blocks.get(this.drag.bid);if(!block)return;
        block.x=Math.round((pt.x-this.drag.ox)/GRID)*GRID;
        block.y=Math.round((pt.y-this.drag.oy)/GRID)*GRID;
        this._repaint(block);return;
      }
      if(this.pan){this.vx=this.pan.vx+(e.clientX-this.pan.mx);this.vy=this.pan.vy+(e.clientY-this.pan.my);this._vp();}
    });

    svg.addEventListener('mouseup',e=>{
      if(this.dw){
        const pt=this._toC(e.clientX,e.clientY);
        // Check for snap first
        const snap=this._findSnap(pt.x,pt.y,this.dw.bid);
        if(snap){
          this._addWire(this.dw.bid,this.dw.port,snap.block.id,snap.portName);
          this._cancelWire();return;
        }
        // Check port under mouse
        const portEl=e.target.closest('[data-dir]');
        if(portEl&&portEl.dataset.dir==='in'&&portEl.dataset.bid!==this.dw.bid){
          this._addWire(this.dw.bid,this.dw.port,portEl.dataset.bid,portEl.dataset.port);
        }
        this._cancelWire();return;
      }
      this.drag=null;this.pan=null;
    });

    svg.addEventListener('mouseleave',()=>{if(this.dw)this._cancelWire();this.drag=null;this.pan=null;});

    svg.addEventListener('wheel',e=>{
      e.preventDefault();
      const r=svg.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
      const f=e.deltaY>0?0.9:1.1;
      const ns=Math.min(2.5,Math.max(0.25,this.vs*f));
      this.vx=mx-(mx-this.vx)*(ns/this.vs);this.vy=my-(my-this.vy)*(ns/this.vs);this.vs=ns;this._vp();
    },{passive:false});

    svg.addEventListener('dblclick',e=>{if(!e.target.closest('[data-bid]')){this.vs=1;this.vx=60;this.vy=60;this._vp();}});

    // Wire click delegate on wires group
    this.wG.addEventListener('click',e=>{
      const el=e.target.closest('[data-wid]');
      if(el){e.stopPropagation();this._selectWire(el.dataset.wid);}
    });

    document.addEventListener('keydown',e=>{
      if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
      if(e.key==='Delete'||e.key==='Backspace'){
        // Delete selected wire first
        if(this.selWire){this._delWire(this.selWire);this.selWire=null;return;}
        // Delete selected block
        if(this.selBlock){
          const block=this.blocks.get(this.selBlock);
          if(block){block.el.remove();this.blocks.delete(this.selBlock);}
          // Remove connected wires
          [...this.wires.entries()].forEach(([wid,w])=>{if(w.fb===this.selBlock||w.tb===this.selBlock){w.el.remove();this.wires.delete(wid);}});
          this.selBlock=null;this._hint();
          if(this.onBlockSelect)this.onBlockSelect(null);
        }
      }
      if(e.key==='Escape'){this._cancelWire();this._deselect();}
    });
  }

  _selectBlock(bid){
    if(this.selWire){const w=this.wires.get(this.selWire);if(w)w.el.setAttribute('stroke-width','2.5');this.selWire=null;}
    if(this.selBlock&&this.selBlock!==bid)this.blocks.get(this.selBlock)?.el.querySelector('.sel-ol')?.setAttribute('opacity','0');
    this.selBlock=bid;
    this.blocks.get(bid)?.el.querySelector('.sel-ol')?.setAttribute('opacity','1');
    if(this.onBlockSelect)this.onBlockSelect(this.blocks.get(bid));
  }

  _selectWire(wid){
    if(this.selBlock){this.blocks.get(this.selBlock)?.el.querySelector('.sel-ol')?.setAttribute('opacity','0');this.selBlock=null;if(this.onBlockSelect)this.onBlockSelect(null);}
    if(this.selWire&&this.selWire!==wid){const pw=this.wires.get(this.selWire);if(pw)pw.el.setAttribute('stroke-width','2.5');}
    this.selWire=wid;
    const w=this.wires.get(wid);if(w){w.el.setAttribute('stroke-width','4');w.el.setAttribute('filter','url(#glow)');}
  }

  _deselect(){
    if(this.selBlock){this.blocks.get(this.selBlock)?.el.querySelector('.sel-ol')?.setAttribute('opacity','0');this.selBlock=null;if(this.onBlockSelect)this.onBlockSelect(null);}
    if(this.selWire){const w=this.wires.get(this.selWire);if(w){w.el.setAttribute('stroke-width','2.5');w.el.removeAttribute('filter');}this.selWire=null;}
  }

  // ── Update param from properties panel ───────────────────────────────────
  updateBlockParam(blockId,key,value){
    const block=this.blocks.get(blockId);if(!block)return;
    block.params[key]=value;this._repaint(block);
  }

  // ── Code generation ────────────────────────────────────────────────────────
  toCode(){
    if(!this.blocks.size)return'';
    const lines=['-- Generated by Sanskrit Visual Builder v3.1',''];
    this._topo().forEach(id=>{
      const b=this.blocks.get(id);if(!b)return;
      if(b.raw?.toSq){try{lines.push(b.raw.toSq(b.params));return;}catch(e){}}
      const c=this._bCode(b);if(c)lines.push(c);
    });
    return lines.join('\n');
  }

  _topo(){
    const deg=new Map();this.blocks.forEach((_,id)=>deg.set(id,0));
    this.wires.forEach(w=>deg.set(w.tb,(deg.get(w.tb)||0)+1));
    const q=[...deg.entries()].filter(([,v])=>v===0).map(([k])=>k);
    const r=[];
    while(q.length){const c=q.shift();r.push(c);this.wires.forEach(w=>{if(w.fb===c){const n=(deg.get(w.tb)||1)-1;deg.set(w.tb,n);if(!n)q.push(w.tb);}});}
    this.blocks.forEach((_,id)=>{if(!r.includes(id))r.push(id);});
    return r;
  }

  _upReg(bid){const w=[...this.wires.values()].find(w=>w.tb===bid);if(!w)return null;const fb=this.blocks.get(w.fb);return fb?.params?.name||fb?.params?.register||null;}

  _bCode(b){
    const {def,params:p,id}=b; const n=id;
    const reg=this._upReg(id)||p.name||p.register||'q';
    switch(def.id){
      case 'q_register':    return `let ${p.name||'q'} = qubits(${p.n_qubits||2})`;
      case 'h_gate':        return `H(${reg}[${p.qubit??0}])`;
      case 'x_gate':        return `X(${reg}[${p.qubit??0}])`;
      case 'y_gate':        return `Y(${reg}[${p.qubit??0}])`;
      case 'z_gate':        return `Z(${reg}[${p.qubit??0}])`;
      case 's_gate':        return `S(${reg}[${p.qubit??0}])`;
      case 't_gate':        return `T(${reg}[${p.qubit??0}])`;
      case 'sdg_gate':      return `Sdg(${reg}[${p.qubit??0}])`;
      case 'tdg_gate':      return `Tdg(${reg}[${p.qubit??0}])`;
      case 'sx_gate':       return `SX(${reg}[${p.qubit??0}])`;
      case 'rx_gate':       return `Rx(${reg}[${p.qubit??0}], ${p.theta??1.5708})`;
      case 'ry_gate':       return `Ry(${reg}[${p.qubit??0}], ${p.theta??1.5708})`;
      case 'rz_gate':       return `Rz(${reg}[${p.qubit??0}], ${p.theta??1.5708})`;
      case 'cnot_gate':     return `CNOT(${reg}[${p.control??0}], ${reg}[${p.target??1}])`;
      case 'cz_gate':       return `CZ(${reg}[${p.qubit_a??0}], ${reg}[${p.qubit_b??1}])`;
      case 'swap_gate':     return `SWAP(${reg}[${p.qubit_a??0}], ${reg}[${p.qubit_b??1}])`;
      case 'toffoli_gate':  return `Toffoli(${reg}[${p.ctrl1??0}], ${reg}[${p.ctrl2??1}], ${reg}[${p.target??2}])`;
      case 'measure_all':   return `let result_${n}=measure_all(${reg},shots=${p.shots??1000})\nprint(result_${n}.histogram)`;
      case 'measure_qubit': return `let bit_${n}=measure(${reg}[${p.qubit??0}])\nprint(bit_${n})`;
      case 'statevector_block':return`let sv_${n}=statevector(${reg})\nprint(sv_${n})`;
      case 'grover_algo':   return `let gr_${n}=grover(${p.n_qubits??4},[${p.target??7}],${p.shots??1000})\nprint(gr_${n}.histogram)`;
      case 'vqe_solver':    return `let vqe_${n}=vqe(molecule,ansatz="${p.ansatz||'UCCSD'}",shots=${p.shots??2000})\nprint(vqe_${n}.energy)`;
      case 'qft_block':     return `${reg}.qft(${reg}.n_qubits,${p.inverse||false})`;
      case 'print_block':   return `print(${reg})`;
      default: return `-- ${def.label}`;
    }
  }

  // ── .sans export / import ─────────────────────────────────────────────────
  exportSans(){
    if(!this.blocks.size) return null;
    return {
      version: '3.1',
      title:   'Sanskrit Canvas Diagram',
      created: new Date().toISOString(),
      blocks: [...this.blocks.values()].map(b=>({
        id:    b.id,
        defId: b.def.id,
        x:     b.x, y: b.y,
        params:{ ...b.params },
        label: b.def.label,
        cat:   b.def.cat,
      })),
      wires: [...this.wires.values()].map(w=>({
        from:{ blockId:w.fb, port:w.fp },
        to:  { blockId:w.tb, port:w.tp },
      })),
    };
  }

  async importSans(data){
    this.clear();
    if(!data) return;
    // Support both .sans files and canvas-example objects from server
    const blocks = data.blocks||[];
    const wires  = data.wires||[];
    const idMap  = {};   // old id → new block

    for(const bd of blocks){
      const defId = bd.defId||bd.id;
      const raw   = await fetchDef(defId) || {id:defId, label:bd.label||defId, cat:bd.cat||'Utility'};
      const block = this.addBlock(raw, bd.x||100, bd.y||100);
      idMap[bd.id] = block;
      // Restore params
      if(bd.params) Object.entries(bd.params).forEach(([k,v])=>{ block.params[k]=v; });
      this._repaint(block);
    }

    // Restore wires
    wires.forEach(w=>{
      const fb=idMap[w.from?.blockId||w.from], tb=idMap[w.to?.blockId||w.to];
      if(fb&&tb) this._addWire(fb.id, w.from?.port||'ro', tb.id, w.to?.port||'ri');
    });

    this._hint();
  }

  // ── Utility ────────────────────────────────────────────────────────────────
  clear(){
    this.blocks.forEach(b=>b.el.remove());this.blocks.clear();
    this.wires.forEach(w=>w.el.remove()); this.wires.clear();
    this.selBlock=null;this.selWire=null;this._cancelWire();this._hint();
    if(this.onBlockSelect)this.onBlockSelect(null);
  }

  _hint(){this.hint?.classList.toggle('hidden',this.blocks.size>0);}
}
