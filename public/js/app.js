/**
 * public/js/app.js  —  Sanskrit Visual Builder v3.1 FINAL
 * 7 features: magnetic wires, working examples, full output console,
 * recommendations, compile+run, 15 canvas examples, .sans export/import
 */

import { Palette }    from './palette.js';
import { Canvas }     from './canvas.js';
import { Properties } from './properties.js';

// ── Globals ───────────────────────────────────────────────────────────────────
let isRunning = false;
let codeView  = false;
let ws        = null;
let wsAlive   = false;

// ── DOM helper ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Subsystems ────────────────────────────────────────────────────────────────
const palette    = new Palette($('palette-list'), $('palette-search'), $('palette-clear-search'));
const canvasEl   = $('canvas');
const canvas     = new Canvas(canvasEl);
window._canvas   = canvas;   // expose for mini-toolbar buttons

const properties = new Properties($('properties-form'), $('properties-empty'), $('properties-title'));

// Wire canvas → properties
canvas.onBlockSelect = block => {
  if (block) properties.show(block, (key, val) => { canvas.updateBlockParam(block.id, key, val); updateRecs(); });
  else       properties.deselect();
  updateRecs();
};

// ── WebSocket ─────────────────────────────────────────────────────────────────
function connectWS() {
  try {
    ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onopen    = ()  => { wsAlive=true;  setStatus('ready'); wsStatusEl('⚡ WS live','#10B981'); };
    ws.onclose   = ()  => { wsAlive=false; setStatus('error'); wsStatusEl('⚡ WS offline','#4a7a8a'); setTimeout(connectWS,3000); };
    ws.onerror   = ()  => {};
    ws.onmessage = ev  => { try { handleWS(JSON.parse(ev.data)); } catch{} };
  } catch(e) {}
}
function sendWS(type,data){ if(ws?.readyState===1){ws.send(JSON.stringify({type,data}));return true;} return false; }
function wsStatusEl(t,c){ const el=$('ws-status');if(el){el.textContent=t;el.style.color=c;} }

function handleWS(msg) {
  const d = msg.data || {};
  switch(msg.type) {
    case 'output':        addLog('print',   d.text||''); break;
    case 'log':           addLog(d.lv||'info', d.m||''); break;
    case 'gate':          addLog('gate',    d.m||`⟨gate⟩ ${d.gate||''}`); break;
    case 'done':          setRunning(false); addLog('timing',`⏱ Done in ${d.elapsed_ms}ms`); break;
    case 'error':         setRunning(false); addLog('error', `✗ ${d.message||d.m||''}`); break;
    case 'status':        if(d.running===false) setRunning(false); break;
    case 'metrics':       updateMetrics(d); break;
    case 'compile_result':showCompileResult(d); break;
    case 'welcome':       addLog('info',`⟨ψ⟩ Connected — ${d.blocks||528} blocks · Engine: ${(d.engine||'js').toUpperCase()}`); break;
  }
}

// ── Toolbar bindings ──────────────────────────────────────────────────────────
$('btn-run')?.$('btn-run').addEventListener('click', runProgram);
// Fix: direct binding
document.addEventListener('DOMContentLoaded', () => {
  const run = $('btn-run');   if(run)    run.addEventListener('click', runProgram);
  const comp= $('btn-compile');if(comp) comp.addEventListener('click', compileCode);
  const stop= $('btn-stop');  if(stop)   stop.addEventListener('click', stopRun);
  const clear=$('btn-clear'); if(clear)  clear.addEventListener('click', clearCanvas);
  const code= $('btn-code');  if(code)   code.addEventListener('click', toggleCode);
  const open= $('btn-open');  if(open)   open.addEventListener('click', ()=>$('file-open-input')?.click());
  const save= $('btn-save');  if(save)   save.addEventListener('click', saveCode);
  const expSans=$('btn-export-sans');  if(expSans) expSans.addEventListener('click', exportSans);
  const impSans=$('btn-import-sans');  if(impSans) impSans.addEventListener('click', ()=>$('sans-import-input')?.click());
  const expCircuit=$('btn-export');   if(expCircuit) expCircuit.addEventListener('click', ()=>{ $('export-modal')?.classList.remove('hidden'); });
  const examplesBtn=$('btn-canvas-examples'); if(examplesBtn) examplesBtn.addEventListener('click', ()=>$('canvas-examples-modal')?.classList.remove('hidden'));
  const codeRun=$('btn-code-run'); if(codeRun) codeRun.addEventListener('click', runProgram);
  const outClear=$('btn-output-clear'); if(outClear) outClear.addEventListener('click', clearOutput);
  const outToggle=$('btn-output-toggle'); if(outToggle) outToggle.addEventListener('click', toggleOutput);
  const propClose=$('properties-close'); if(propClose) propClose.addEventListener('click', ()=>properties.deselect());
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();runProgram();}
  if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key==='B'){e.preventDefault();compileCode();}
});

// Tab in editor
$('code-editor')?.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  e.preventDefault();
  const el=e.target, s=el.selectionStart;
  el.value=el.value.slice(0,s)+'    '+el.value.slice(el.selectionEnd);
  el.selectionStart=el.selectionEnd=s+4;
});

// File open
$('file-open-input')?.addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{ const ed=$('code-editor'); if(ed)ed.value=ev.target.result; if(!codeView)toggleCode(); addLog('info',`📂 Opened: ${f.name}`); };
  r.readAsText(f); e.target.value='';
});

// .sans import
$('sans-import-input')?.addEventListener('change',async e=>{
  const f=e.target.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=async ev=>{ try{ const d=JSON.parse(ev.target.result); await canvas.importSans(d); addLog('info',`📐 Imported: ${f.name} (${d.blocks?.length||0} blocks)`); updateRecs(); }catch(ex){addLog('error',`Import failed: ${ex.message}`);} };
  r.readAsText(f); e.target.value='';
});

// Export circuit modal
$('btn-export-generate')?.addEventListener('click',async()=>{
  const code=codeView?$('code-editor')?.value:canvas.toCode();
  const fmt=$('export-format')?.value||'qasm2';
  try{const r=await fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,format:fmt})});const d=await r.json();const o=$('export-output');if(o)o.value=d.output||d.error||'';}catch(ex){const o=$('export-output');if(o)o.value=`-- Error: ${ex.message}`;}
});
$('btn-export-copy')?.addEventListener('click',()=>{const o=$('export-output');if(o?.value)navigator.clipboard.writeText(o.value).then(()=>{const b=$('btn-export-copy');if(b){const t=b.textContent;b.textContent='Copied!';setTimeout(()=>b.textContent=t,1500);}});});

// Modal closes
document.querySelectorAll('[data-modal],.modal-close').forEach(el=>el.addEventListener('click',()=>{const mid=el.dataset.modal||el.closest('.modal')?.id;if(mid)document.getElementById(mid)?.classList.add('hidden');}));
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.add('hidden');}));

// Example selector (code)
$('example-selector')?.addEventListener('change',e=>{
  const key=e.target.value; if(!key)return;
  const code=CODE_EXAMPLES[key]; if(!code)return;
  const ed=$('code-editor'); if(ed)ed.value=code;
  if(!codeView)toggleCode();
  addLog('info',`📖 Example loaded: ${key} — Click ▶ RUN`);
  e.target.value='';
});

// ── RUN ───────────────────────────────────────────────────────────────────────
async function runProgram() {
  if(isRunning)return;
  const ed=$('code-editor');
  const code=(codeView?ed?.value:canvas.toCode())?.trim();
  if(!code){addLog('error','Nothing to run — add blocks or write code.');return;}

  clearOutput();
  setRunning(true);
  addLog('info',`⟨ψ⟩ Running ${code.split('\n').filter(l=>l.trim()&&!l.trim().startsWith('--')).length} lines…`);

  // Try WebSocket (real-time streaming)
  if(sendWS('run',{code})) return;

  // Fallback: REST
  try {
    const res=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
    if(!res.ok){addLog('error',`HTTP ${res.status} — is npm start running?`);setRunning(false);return;}
    const d=await res.json();
    (d.outputs||[]).forEach(t=>addLog('print',String(t)));
    (d.logs||[]).forEach(l=>addLog(l.lv||'debug', l.m||''));
    if(d.error) addLog('error',`✗ ${d.error}`);
    if(d.elapsed_ms!=null) addLog('timing',`⏱ Done in ${d.elapsed_ms}ms`);
  } catch(ex){ addLog('error',`✗ Cannot reach server.\n  Make sure npm start is running in Command Prompt.`); }
  setRunning(false);
}

// ── COMPILE ───────────────────────────────────────────────────────────────────
async function compileCode() {
  const ed=$('code-editor');
  const code=(codeView?ed?.value:canvas.toCode())?.trim();
  if(!code){addLog('error','Nothing to compile.');return;}
  addLog('info','🔨 Compiling…');
  if(sendWS('compile',{code}))return;
  try{const r=await fetch('/api/compile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});showCompileResult(await r.json());}
  catch(ex){addLog('error',`Compile error: ${ex.message}`);}
}

function showCompileResult(d){
  if(!d)return;
  const badge=$('compile-badge');
  if(d.success){
    addLog('success',`✓ ${d.summary||'Compiled OK'}`);
    if(badge){badge.textContent='OK';badge.className='ok';}
  } else {
    addLog('error',`✗ ${d.summary||'Errors found'}`);
    if(badge){badge.textContent='ERROR';badge.className='fail';}
  }
  (d.errors||[]).forEach(e=>addLog('error',`  Line ${e.line||'?'}: ${e.msg||e.message||e}`));
  (d.warnings||[]).forEach(w=>addLog('warn', `  ⚠ Line ${w.line||'?'}: ${w.msg||w.message||w}`));
  if(d.stats) addLog('info',`  Stats: ${d.stats.n_lines} lines · ${d.stats.n_chars} chars · ${d.stats.elapsed_ms}ms`);
  setTimeout(()=>{if(badge)badge.className='';},4000);
}

function stopRun(){ sendWS('stop'); setRunning(false); addLog('warn','■ Stopped'); }

// ── METRICS ───────────────────────────────────────────────────────────────────
function updateMetrics(m){
  const set=(id,val)=>{const el=$(id);if(el)el.textContent=val;};
  const bar=(id,pct)=>{const el=$(id);if(el)el.style.width=`${Math.min(100,Math.max(0,pct))}%`;};
  const cpu=m.cpu_pct||0, heap=m.heap_used_mb||0, tot=m.heap_total_mb||1;
  const sysPct=m.sys_used_pct||0, sysF=m.sys_free_mb||0;
  bar('cpu-bar', cpu);  set('cpu-label', `CPU ${cpu}%`);
  bar('mem-bar', Math.round(heap/tot*100)); set('mem-label',`HEAP ${heap}/${tot}MB`);
  set('sys-label', `SYS ${sysPct}% (${sysF}MB free)`);
  const u=m.uptime_s||0; set('uptime-label',`UP ${Math.floor(u/3600)}h${Math.floor(u%3600/60)}m${u%60}s`);
  set('ws-clients',`${m.active_ws||0} client${m.active_ws!==1?'s':''}`);
  if($('cpu-bar')){const b=$('cpu-bar');b.style.background=cpu>80?'#EF4444':cpu>50?'#F59E0B':'linear-gradient(90deg,#1D4ED8,#00e5ff)';}
}

// Poll metrics via REST when WS not connected
setInterval(async()=>{
  if(wsAlive)return;
  try{const r=await fetch('/api/metrics');if(r.ok)updateMetrics(await r.json());}catch{}
},3000);

// ── RECOMMENDATIONS ───────────────────────────────────────────────────────────
const REC_MAP={
  q_register:    [{id:'h_gate',lbl:'H Gate'},{id:'x_gate',lbl:'X Gate'},{id:'cnot_gate',lbl:'CNOT'}],
  h_gate:        [{id:'cnot_gate',lbl:'CNOT'},{id:'measure_all',lbl:'Measure All'},{id:'cz_gate',lbl:'CZ Gate'}],
  x_gate:        [{id:'cnot_gate',lbl:'CNOT'},{id:'toffoli_gate',lbl:'Toffoli'},{id:'measure_all',lbl:'Measure All'}],
  y_gate:        [{id:'measure_all',lbl:'Measure All'},{id:'statevector_block',lbl:'Statevector'}],
  z_gate:        [{id:'measure_all',lbl:'Measure All'},{id:'statevector_block',lbl:'Statevector'}],
  s_gate:        [{id:'h_gate',lbl:'H Gate'},{id:'measure_all',lbl:'Measure All'}],
  t_gate:        [{id:'h_gate',lbl:'H Gate'},{id:'measure_all',lbl:'Measure All'}],
  rx_gate:       [{id:'measure_all',lbl:'Measure All'},{id:'cnot_gate',lbl:'CNOT'}],
  ry_gate:       [{id:'measure_all',lbl:'Measure All'},{id:'cnot_gate',lbl:'CNOT'}],
  rz_gate:       [{id:'measure_all',lbl:'Measure All'},{id:'cnot_gate',lbl:'CNOT'}],
  cnot_gate:     [{id:'measure_all',lbl:'Measure All'},{id:'toffoli_gate',lbl:'Toffoli'},{id:'statevector_block',lbl:'Statevector'}],
  cz_gate:       [{id:'h_gate',lbl:'H Gate'},{id:'measure_all',lbl:'Measure All'}],
  swap_gate:     [{id:'measure_all',lbl:'Measure All'}],
  toffoli_gate:  [{id:'measure_all',lbl:'Measure All'}],
  qft_block:     [{id:'measure_all',lbl:'Measure All'}],
  grover_algo:   [],
  vqe_solver:    [],
};

function updateRecs(){
  const panel=$('recommendations-panel'); if(!panel)return;
  const ids=[...canvas.blocks.values()].map(b=>b.def?.id||b.def?.cat||'');
  if(!ids.length){panel.innerHTML='<span style="color:#2D5060;font-size:11px">Add a Quantum Register block to start</span>';return;}
  const last=ids[ids.length-1];
  const sugg=(REC_MAP[last]||[]).filter(r=>!ids.includes(r.id));
  if(!sugg.length){panel.innerHTML='<span style="color:#10B981;font-size:11px">✓ Circuit looks complete</span>';return;}
  panel.innerHTML=sugg.slice(0,4).map(r=>`
    <span onclick="window._addSug('${r.id}')" title="Add ${r.lbl}"
      style="display:inline-block;cursor:pointer;background:#1E2538;border:1px solid #2D3748;font-size:10px;padding:3px 9px;margin:2px;border-radius:3px;color:#94A3B8;transition:all 0.15s;font-family:Segoe UI,sans-serif"
      onmouseenter="this.style.borderColor='#00e5ff';this.style.color='#00e5ff'"
      onmouseleave="this.style.borderColor='#2D3748';this.style.color='#94A3B8'">+ ${r.lbl}</span>`).join('');
}
window._addSug=async(id)=>{await canvas.addBlockById(id);updateRecs();};

// ── Canvas examples ───────────────────────────────────────────────────────────
async function loadCanvasExamples(){
  try{
    const r=await fetch('/api/canvas-examples');
    const examples=await r.json();
    const grid=$('canvas-examples-grid');if(!grid)return;
    const cats={};
    examples.forEach(ex=>{const c=ex.cat||'General';if(!cats[c])cats[c]=[];cats[c].push(ex);});
    grid.innerHTML='';
    for(const [cat,exs] of Object.entries(cats)){
      const sec=document.createElement('div');sec.style.marginBottom='20px';
      sec.innerHTML=`<div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#0F4C5C;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #1E2840;font-family:monospace">${cat}</div>`;
      exs.forEach(ex=>{
        const card=document.createElement('div');
        card.style.cssText='background:#1E2538;border:1px solid #2D3748;padding:12px 14px;margin-bottom:6px;cursor:pointer;border-radius:4px;transition:border-color 0.15s';
        card.innerHTML=`<div style="font-size:13px;font-weight:600;color:#E2E8F0;margin-bottom:3px">${ex.title}</div><div style="font-size:11px;color:#64748B;line-height:1.4">${ex.desc||''}</div><div style="margin-top:6px;font-size:10px;color:#0F4C5C;font-family:monospace">${ex.blocks?.length||0} blocks — click to load</div>`;
        card.onmouseenter=()=>card.style.borderColor='#00e5ff';
        card.onmouseleave=()=>card.style.borderColor='#2D3748';
        card.onclick=async()=>{ await canvas.importSans(ex); $('canvas-examples-modal')?.classList.add('hidden'); addLog('info',`📐 Loaded: ${ex.title}`); updateRecs(); };
        sec.appendChild(card);
      });
      grid.appendChild(sec);
    }
  }catch(e){console.warn('canvas examples',e);}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toggleCode(){
  codeView=!codeView;
  $('btn-code')?.classList.toggle('active',codeView);
  $('canvas-wrap')?.classList.toggle('hidden',codeView);
  $('code-wrap')?.classList.toggle('hidden',!codeView);
  if(codeView){const ed=$('code-editor');if(ed&&!ed.value.trim()){const g=canvas.toCode();if(g.trim())ed.value=g;}}
}

function clearCanvas(){
  if(codeView){const ed=$('code-editor');if(ed)ed.value='';return;}
  if(confirm('Clear canvas? Cannot be undone.')){canvas.clear();updateRecs();}
}

function saveCode(){
  const code=codeView?$('code-editor')?.value:canvas.toCode();
  if(!code?.trim()){addLog('error','Nothing to save');return;}
  dlFile(code,'program.sq','text/plain');
  addLog('info','💾 Saved program.sq');
}

function exportSans(){
  const d=canvas.exportSans();
  if(!d){addLog('error','Canvas is empty');return;}
  dlFile(JSON.stringify(d,null,2),'diagram.sans','application/json');
  addLog('info',`📐 Exported diagram.sans (${d.blocks.length} blocks)`);
}

function clearOutput(){const el=$('output-lines');if(el)el.innerHTML='';}
function toggleOutput(){const p=$('output-panel');if(p){const c=p.classList.toggle('collapsed');const b=$('btn-output-toggle');if(b)b.textContent=c?'▲':'▼';}}

function addLog(type,text){
  const lines=$('output-lines');if(!lines||!text&&text!==0)return;
  const COL={info:'#64748B',print:'#E2E8F0',error:'#EF4444',warn:'#F59E0B',success:'#10B981',gate:'#60A5FA',meas:'#34D399',measure:'#34D399',timing:'#F59E0B',debug:'#374151'};
  const div=document.createElement('div');
  div.style.cssText=`font-family:'Fira Code','Cascadia Code','Consolas',monospace;font-size:11.5px;line-height:1.65;white-space:pre-wrap;word-break:break-all;color:${COL[type]||COL.info}`;
  const ts=new Date().toTimeString().slice(0,8);
  div.innerHTML=`<span style="color:#1E2840;font-size:10px;user-select:none;margin-right:8px">${ts}</span>${escHtml(String(text))}`;
  lines.appendChild(div);lines.scrollTop=lines.scrollHeight;
  const panel=$('output-panel');
  if(panel?.classList.contains('collapsed')&&type!=='debug'){panel.classList.remove('collapsed');const b=$('btn-output-toggle');if(b)b.textContent='▼';}
}

function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function setRunning(v){
  isRunning=v;
  const rb=$('btn-run');if(rb){rb.disabled=v;rb.textContent=v?'⟨ψ⟩ Running…':'▶ RUN';}
  const sb=$('btn-stop');if(sb)sb.disabled=!v;
  const st=$('status-indicator');if(st){st.textContent=v?'● Running':'● Ready';st.className=v?'status-running':'status-ready';}
}
function setStatus(s){const el=$('status-indicator');if(el){el.textContent=s==='ready'?'● Ready':'● Disconnected';el.className=s==='ready'?'status-ready':'status-error';}}
function dlFile(c,n,m){const b=new Blob([c],{type:m}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click();URL.revokeObjectURL(a.href);}

// ═══════════════════════════════════════════════════════════════════════════════
// CODE EXAMPLES
// ═══════════════════════════════════════════════════════════════════════════════
const CODE_EXAMPLES={
bell:
`-- Bell State: quantum entanglement — Hello World of quantum
let q = qubits(2)
H(q[0])
CNOT(q[0], q[1])
let r = measure_all(q, shots=1000)
print("Bell State Histogram:")
print(r.histogram)
print(f"P(00) = {dict_get(r.histogram,'00',0)/1000.0:.3f}")
print(f"P(11) = {dict_get(r.histogram,'11',0)/1000.0:.3f}")`,

grover:
`-- Grover Search: find item 7 in a 16-item database
-- Quantum: ~3 queries. Classical: up to 16 queries.
let n_qubits = 4
let target = 7
print(f"Searching for {target} in {2**n_qubits} items...")
let result = grover(n_qubits, [target], 2000)
let found = dict_get(result.histogram, "0111", 0)
print(f"Target found: {found}/2000 times ({round_to(found/20.0,1)}%)")
print("Full histogram (top results):")
let s = sort_by(items(result.histogram), fn(kv): return -kv[1])
for kv in s[:5]:
    print(f"  |{kv[0]}> = {kv[1]}")`,

vqe:
`-- VQE: Hydrogen molecule ground state energy
-- Exact FCI: -1.137270 Hartree. Chemical acc: <1 mHa error.
molecule H2 {
    atoms: [H, H],
    bond_length: 0.74,
    basis_set: "STO-3G",
    charge: 0,
    multiplicity: 1
}
print("Running VQE for H2 molecule...")
let result = vqe(H2, ansatz="UCCSD", shots=2000)
let exact  = -1.137270
let error  = abs(result.energy - exact) * 1000
print(f"VQE energy:    {result.energy:.6f} Ha")
print(f"Exact FCI:     {exact:.6f} Ha")
print(f"Error:         {error:.3f} mHartree")
print(f"Chemical acc:  {error < 1.0}")`,

teleport:
`-- Quantum Teleportation Protocol
-- Transfers qubit state from Alice to Bob using Bell pair + 2 classical bits
def teleport(angle):
    let q = qubits(3)
    Ry(q[0], angle)            -- Alice's secret qubit
    H(q[1]); CNOT(q[1], q[2]) -- Create Bell pair
    CNOT(q[0], q[1]); H(q[0]) -- Alice's Bell measurement
    let m0 = measure(q[0])
    let m1 = measure(q[1])
    if m1 == 1: X(q[2])        -- Bob corrects
    if m0 == 1: Z(q[2])
    let expected = round_to(cos(angle/2)**2, 4)
    print(f"  angle={round_to(angle,4)}: expected P(|0>)={expected}")

print("=== Quantum Teleportation ===")
for a in [0.0, PI/6, PI/4, PI/3, PI/2, PI]:
    teleport(a)`,

qrng:
`-- Quantum Random Number Generator
-- Uses quantum measurement — truly random, not pseudo-random
def qrand(lo, hi):
    let range_sz = hi - lo + 1
    let n = n_qubits_for(range_sz)
    let q = qubits(n)
    H_all(q)
    let bits = [measure(q[i]) for i in range(n)]
    let v = bits_to_int(join([str(b) for b in bits], ""))
    if v >= range_sz: return qrand(lo, hi)  -- rejection sampling
    return lo + v

print("10 quantum random integers (1-100):")
print([qrand(1, 100) for _ in range(10)])
print("")
print("1000 coin flips (expect ~500 heads):")
let flips = [qrand(0,1) for _ in range(1000)]
let heads  = len(filter(fn(x): return x==0, flips))
print(f"Heads: {heads}  Tails: {1000-heads}")`,

stats:
`-- Statistical Analysis using Sanskrit stdlib
let data = [2.3, 4.1, 3.8, 5.2, 4.7, 3.9, 6.1, 4.5, 5.0, 4.3,
            3.7, 4.9, 5.5, 3.2, 4.8, 5.1, 4.0, 3.6, 4.4, 5.3]
print("=== Descriptive Statistics ===")
print(f"N:        {len(data)}")
print(f"Mean:     {mean(data):.4f}")
print(f"Median:   {median(data):.4f}")
print(f"Std Dev:  {stdev(data):.4f}")
print(f"Std Err:  {stderr(data):.4f}")
print(f"Min/Max:  {min(data):.2f} / {max(data):.2f}")
print(f"IQR:      {iqr(data):.4f}")
print(f"95th pct: {percentile(data,95):.4f}")
let t = t_test_one_sample(data, 4.0)
print(f"T-test (mu=4): t={t.t_stat:.4f}")`,

shor:
`-- Shor's Algorithm: quantum integer factoring
-- Uses quantum period finding to factor integers
for N in [15, 21, 33, 35]:
    let r = shor_factor(N=N, a=2, n_count_qubits=8, shots=2000)
    print(f"{N} = {r.factors[0]} x {r.factors[1]}")
-- Expected: 15=3x5, 21=3x7, 33=3x11, 35=5x7`,

qaoa:
`-- QAOA: Quantum Approximate Optimisation Algorithm
-- Portfolio selection: pick best 2 assets from 4
let assets  = ["RELIANCE", "TCS", "HDFC", "INFOSYS"]
let returns = [0.24, 0.31, 0.19, 0.28]
let vols    = [0.22, 0.25, 0.18, 0.26]

print("Assets and Sharpe ratios:")
for i in range(4):
    let sharpe = returns[i] / vols[i]
    print(f"  {assets[i]}: return={returns[i]*100:.0f}% vol={vols[i]*100:.0f}% Sharpe={sharpe:.3f}")

print("")
let edges = [[0,1],[1,2],[2,3],[3,0],[0,2],[1,3]]
print("Running QAOA (p=3 layers)...")
let r = qaoa(n_nodes=4, edges=edges, p_layers=3, shots=2000)
let sorted = sort_by(items(r.histogram), fn(kv): return -kv[1])
print("Top portfolios:")
for kv in sorted[:4]:
    let sel = [assets[i] for i in range(4) if kv[0][i]=="1"]
    print(f"  {kv[0]}: {sel} -> {kv[1]} times")`,
};

// ── Init ──────────────────────────────────────────────────────────────────────
async function init(){
  await palette.load();
  canvas.init();
  connectWS();
  loadCanvasExamples();
  updateRecs();

  try{
    const r=await fetch('/api/health');
    const d=await r.json();
    if(!wsAlive){
      addLog('info',`⟨ψ⟩ Sanskrit Visual Builder v3.1`);
      addLog('info',`📦 ${d.n_blocks||528} blocks · ${d.n_categories||42} categories · Engine: ${(d.engine||'js').toUpperCase()}`);
      addLog('info',`✓ Server ready · Drag blocks or click CODE · EXAMPLES for pre-built programs`);
      addLog('info',`💡 Tip: Connect blocks by dragging from the right ● to the left ● of the next block`);
      addLog('info',`💡 Tip: Select a wire and press DELETE to remove it`);
    }
  }catch(e){
    addLog('error','⚠ Cannot reach server. Run: npm start in Command Prompt');
  }
}

init().catch(console.error);
