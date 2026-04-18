/**
 * public/js/palette.js  —  Sanskrit Visual Builder v3.1
 * ─────────────────────────────────────────────────────────────────────────────
 * FIXES:
 *   1. Registry blocks use {cat:'quantum_reg'} not {category:'Quantum/Registers'}
 *      → organise() now reads block.cat and maps via CATEGORIES lookup
 *   2. Drag payload includes block.label so canvas fallback label works
 *   3. Search checks both label and info (block.info not block.description)
 */

// ── CATEGORIES map (mirrors server registry.js CATEGORIES) ────────────────────
const CAT_MAP = {
  quantum_reg:  { label:'Quantum Registers',    color:'#0D9488', icon:'📦' },
  quantum_gate: { label:'Quantum Gates',        color:'#6C3FC5', icon:'⚛'  },
  quantum_meas: { label:'Measurement',          color:'#4338CA', icon:'📏' },
  quantum_algo: { label:'Algorithms',           color:'#2563EB', icon:'🔬' },
  error_mit:    { label:'Error Mitigation',     color:'#0891B2', icon:'🛡'  },
  noise:        { label:'Noise Models',         color:'#EA580C', icon:'〰' },
  pulse:        { label:'Pulse Level',          color:'#E11D48', icon:'〜' },
  benchmark:    { label:'Benchmarking',         color:'#06B6D4', icon:'📊' },
  sharding:     { label:'Sharding Engine',      color:'#65A30D', icon:'⊕'  },
  classical:    { label:'Classical Control',    color:'#CE4A2E', icon:'⌨'  },
  fn_block:     { label:'Functions',            color:'#D97706', icon:'λ'  },
  variable:     { label:'Variables',            color:'#0D9488', icon:'$'  },
  string_re:    { label:'String & Regex',       color:'#DB2777', icon:'📝' },
  math:         { label:'Math & Numerics',      color:'#6366F1', icon:'∑'  },
  chemistry:    { label:'Chemistry',            color:'#059669', icon:'⬡'  },
  drug:         { label:'Drug Discovery',       color:'#7C3AED', icon:'💊' },
  vaccine:      { label:'Vaccine & Immunology', color:'#DB2777', icon:'💉' },
  biology:      { label:'Biology & Genomics',   color:'#16A34A', icon:'🧬' },
  medical:      { label:'Medical Imaging',      color:'#0891B2', icon:'🏥' },
  physics:      { label:'Physics',              color:'#4338CA', icon:'⚡' },
  materials:    { label:'Materials Science',    color:'#78716C', icon:'🔬' },
  astro:        { label:'Astrophysics',         color:'#475569', icon:'🌌' },
  ml:           { label:'Machine Learning',     color:'#65A30D', icon:'🤖' },
  genai:        { label:'GenAI & LLMs',         color:'#9333EA', icon:'✨' },
  file_src:     { label:'File Sources',         color:'#0EA5E9', icon:'📁' },
  database:     { label:'Databases',            color:'#1D4ED8', icon:'🗄'  },
  cloud:        { label:'Cloud Storage',        color:'#0369A1', icon:'☁'  },
  api:          { label:'API Connectors',       color:'#0284C7', icon:'🔌' },
  transform:    { label:'Data Transform',       color:'#D97706', icon:'⇄'  },
  output:       { label:'Output & Display',     color:'#F59E0B', icon:'📤' },
  exec_ctrl:    { label:'Execution Control',    color:'#6B7280', icon:'⚙'  },
  logging:      { label:'Logging & Debug',      color:'#EAB308', icon:'📋' },
  security:     { label:'Security & Auth',      color:'#DC2626', icon:'🔒' },
  hardware:     { label:'Hardware Export',      color:'#7C3AED', icon:'🖥'  },
  utility:      { label:'Utilities',            color:'#94A3B8', icon:'🔧' },
  // Fallback for simple-format blocks that use 'category' string
  'Quantum / Registers':    { label:'Quantum Registers',  color:'#0D9488', icon:'📦' },
  'Quantum / Gates':        { label:'Quantum Gates',      color:'#6C3FC5', icon:'⚛'  },
  'Quantum / Algorithms':   { label:'Algorithms',         color:'#2563EB', icon:'🔬' },
  'Quantum / Measurement':  { label:'Measurement',        color:'#4338CA', icon:'📏' },
  'Quantum':                { label:'Quantum',            color:'#1D4ED8', icon:'⚛'  },
  'Chemistry':              { label:'Chemistry',          color:'#059669', icon:'⬡'  },
  'Biology':                { label:'Biology',            color:'#16A34A', icon:'🧬' },
  'Physics':                { label:'Physics',            color:'#4338CA', icon:'⚡' },
  'ML':                     { label:'Machine Learning',   color:'#65A30D', icon:'🤖' },
  'Data':                   { label:'Data',               color:'#0EA5E9', icon:'📁' },
  'Data / Sources':         { label:'Data Sources',       color:'#0EA5E9', icon:'📁' },
  'Output':                 { label:'Output',             color:'#F59E0B', icon:'📤' },
  'Math / Statistics':      { label:'Statistics',         color:'#6366F1', icon:'∑'  },
  'Utility':                { label:'Utilities',          color:'#94A3B8', icon:'🔧' },
};

function catMeta(catKey) {
  return CAT_MAP[catKey] || { label: catKey || 'Other', color: '#94A3B8', icon: '◆' };
}

// Get the category key from a block — handles both formats
function blockCat(block) {
  // Registry format: block.cat = 'quantum_reg'
  if (block.cat) return block.cat;
  // Simple format: block.category = 'Quantum / Registers'
  if (block.category) return block.category;
  return 'utility';
}

export class Palette {
  constructor(listEl, searchEl, clearEl) {
    this.listEl    = listEl;
    this.searchEl  = searchEl;
    this.clearEl   = clearEl;
    this.allBlocks = [];       // flat array of all blocks
    this.grouped   = {};       // catKey → [blocks]
    this.collapsed = new Set();
  }

  // ── Load blocks from server ────────────────────────────────────────────────
  async load() {
    let serverBlocks = null;
    try {
      const res = await fetch('/api/blocks');
      if (res.ok) {
        const data = await res.json();
        serverBlocks = data.blocks || (Array.isArray(data) ? data : null);
      }
    } catch(e) {}

    this.allBlocks = serverBlocks || BUILTIN_BLOCKS;
    this._group();
    this._render(this.grouped);
    this._bindSearch();

    console.log(`[palette] Loaded ${this.allBlocks.length} blocks across ${Object.keys(this.grouped).length} categories`);
  }

  // ── Group blocks by category key ───────────────────────────────────────────
  _group() {
    this.grouped = {};
    for (const block of this.allBlocks) {
      const key = blockCat(block);
      if (!this.grouped[key]) this.grouped[key] = [];
      this.grouped[key].push(block);
    }
    // Sort categories: quantum first, then alphabetical
    const priority = ['quantum_reg','quantum_gate','quantum_meas','quantum_algo','chemistry','biology','physics','ml'];
    const keys = Object.keys(this.grouped);
    keys.sort((a, b) => {
      const pa = priority.indexOf(a), pb = priority.indexOf(b);
      if (pa !== -1 && pb !== -1) return pa - pb;
      if (pa !== -1) return -1;
      if (pb !== -1) return 1;
      return a.localeCompare(b);
    });
    const sorted = {};
    keys.forEach(k => { sorted[k] = this.grouped[k]; });
    this.grouped = sorted;
  }

  // ── Render palette ────────────────────────────────────────────────────────
  _render(grouped) {
    this.listEl.innerHTML = '';

    for (const [catKey, blocks] of Object.entries(grouped)) {
      if (!blocks.length) continue;
      const meta = catMeta(catKey);

      const wrap = document.createElement('div');
      wrap.className   = 'palette-category';

      // Header
      const hdr = document.createElement('div');
      hdr.className = 'palette-cat-header';
      hdr.style.borderLeft = `3px solid ${meta.color}`;
      if (this.collapsed.has(catKey)) hdr.classList.add('collapsed');

      hdr.innerHTML = `
        <span style="display:flex;align-items:center;gap:7px">
          <span style="font-size:14px">${meta.icon}</span>
          <span>${meta.label}</span>
          <span style="font-size:10px;opacity:0.5;margin-left:auto">${blocks.length}</span>
        </span>
        <span class="palette-cat-arrow" style="transition:transform 0.2s">▾</span>`;

      // Items container
      const items = document.createElement('div');
      items.className = 'palette-items';
      if (this.collapsed.has(catKey)) items.style.display = 'none';

      hdr.addEventListener('click', () => {
        const isNowCollapsed = hdr.classList.toggle('collapsed');
        items.style.display = isNowCollapsed ? 'none' : '';
        hdr.querySelector('.palette-cat-arrow').style.transform = isNowCollapsed ? 'rotate(-90deg)' : '';
        if (isNowCollapsed) this.collapsed.add(catKey);
        else this.collapsed.delete(catKey);
      });

      // Build block items
      blocks.forEach(block => items.appendChild(this._item(block, meta)));

      wrap.appendChild(hdr);
      wrap.appendChild(items);
      this.listEl.appendChild(wrap);
    }
  }

  // ── Single block item ─────────────────────────────────────────────────────
  _item(block, meta) {
    const div = document.createElement('div');
    div.className  = 'palette-item';
    div.draggable  = true;
    div.title      = this._desc(block);

    // Icon: use block's own icon if available
    const icon = block.icon || meta.icon;
    div.innerHTML = `
      <span class="palette-item-icon" style="color:${block.color||meta.color}">${icon}</span>
      <span class="palette-item-label">${block.label || block.id}</span>
    `;

    // Drag: pass id AND label so canvas fallback works without server
    div.addEventListener('dragstart', e => {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type:    'block',
        blockId: block.id,
        label:   block.label || block.id,
        cat:     blockCat(block),
      }));
    });

    return div;
  }

  _desc(block) {
    // Registry uses 'info', simple format uses 'description'
    const d = block.info || block.description || '';
    return typeof d === 'string' ? d.slice(0, 120) : block.label || block.id;
  }

  // ── Search ────────────────────────────────────────────────────────────────
  _bindSearch() {
    const doSearch = () => {
      const q = (this.searchEl?.value || '').toLowerCase().trim();
      if (!q) { this._render(this.grouped); return; }

      const filtered = {};
      for (const [cat, blocks] of Object.entries(this.grouped)) {
        const match = blocks.filter(b =>
          (b.label || b.id).toLowerCase().includes(q) ||
          (b.id).toLowerCase().includes(q) ||
          this._desc(b).toLowerCase().includes(q)
        );
        if (match.length) filtered[cat] = match;
      }
      this._render(filtered);
      // Expand all in search results
      this.listEl.querySelectorAll('.palette-cat-header').forEach(h => {
        h.classList.remove('collapsed');
        const arrow = h.querySelector('.palette-cat-arrow');
        if (arrow) arrow.style.transform = '';
        const sib = h.nextElementSibling;
        if (sib) sib.style.display = '';
      });
    };

    this.searchEl?.addEventListener('input', doSearch);
    this.clearEl?.addEventListener('click', () => {
      if (this.searchEl) this.searchEl.value = '';
      doSearch();
    });
  }
}

// ── Built-in blocks (used when server is offline) ─────────────────────────────
// Uses {name, type, default} format — matches simple normDef path in canvas.js
const BUILTIN_BLOCKS = [
  { id:'q_register',    label:'Quantum Register', cat:'quantum_reg',  color:'#0D9488', icon:'📦',
    info:'Create N qubits all starting as |0⟩.',
    params:[{key:'n_qubits',label:'Qubits',type:'number',value:2,default:2,min:1,max:50},{key:'name',label:'Name',type:'string',value:'q',default:'q'}],
    inputs:[], outputs:[{id:'ro',dir:'out',dt:'register',label:'Register out'}],
    toSq: p=>`let ${p.name||'q'} = qubits(${p.n_qubits||2})` },

  { id:'h_gate',    label:'H Gate (Hadamard)', cat:'quantum_gate', color:'#6C3FC5', icon:'H',
    info:'Creates superposition: |0⟩ → (|0⟩+|1⟩)/√2',
    params:[{key:'qubit',label:'Qubit',type:'number',value:0,default:0,min:0}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'ro',dir:'out',dt:'register',label:'Register'}],
    toSq: p=>`H(q[${p.qubit||0}])` },

  { id:'x_gate',    label:'X Gate (NOT)',      cat:'quantum_gate', color:'#6C3FC5', icon:'X',
    info:'Bit flip: |0⟩↔|1⟩',
    params:[{key:'qubit',label:'Qubit',type:'number',value:0,default:0,min:0}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'ro',dir:'out',dt:'register',label:'Register'}],
    toSq: p=>`X(q[${p.qubit||0}])` },

  { id:'y_gate',    label:'Y Gate',            cat:'quantum_gate', color:'#6C3FC5', icon:'Y',
    info:'Pauli-Y gate.',
    params:[{key:'qubit',label:'Qubit',type:'number',value:0,default:0,min:0}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'ro',dir:'out',dt:'register',label:'Register'}],
    toSq: p=>`Y(q[${p.qubit||0}])` },

  { id:'z_gate',    label:'Z Gate',            cat:'quantum_gate', color:'#6C3FC5', icon:'Z',
    info:'Phase flip: |1⟩→-|1⟩',
    params:[{key:'qubit',label:'Qubit',type:'number',value:0,default:0,min:0}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'ro',dir:'out',dt:'register',label:'Register'}],
    toSq: p=>`Z(q[${p.qubit||0}])` },

  { id:'s_gate',    label:'S Gate',            cat:'quantum_gate', color:'#6C3FC5', icon:'S',
    info:'Phase gate: |1⟩→i|1⟩',
    params:[{key:'qubit',label:'Qubit',type:'number',value:0,default:0,min:0}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'ro',dir:'out',dt:'register',label:'Register'}],
    toSq: p=>`S(q[${p.qubit||0}])` },

  { id:'t_gate',    label:'T Gate',            cat:'quantum_gate', color:'#6C3FC5', icon:'T',
    info:'π/8 gate: |1⟩→e^(iπ/4)|1⟩',
    params:[{key:'qubit',label:'Qubit',type:'number',value:0,default:0,min:0}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'ro',dir:'out',dt:'register',label:'Register'}],
    toSq: p=>`T(q[${p.qubit||0}])` },

  { id:'rx_gate',   label:'Rx Rotation',       cat:'quantum_gate', color:'#6C3FC5', icon:'Rx',
    info:'Rotation around X-axis by θ radians.',
    params:[{key:'qubit',label:'Qubit',type:'number',value:0,default:0,min:0},{key:'theta',label:'Theta (rad)',type:'number',value:1.5708,default:1.5708,step:0.01}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'ro',dir:'out',dt:'register',label:'Register'}],
    toSq: p=>`Rx(q[${p.qubit||0}], ${p.theta||1.5708})` },

  { id:'ry_gate',   label:'Ry Rotation',       cat:'quantum_gate', color:'#6C3FC5', icon:'Ry',
    info:'Rotation around Y-axis by θ radians.',
    params:[{key:'qubit',label:'Qubit',type:'number',value:0,default:0,min:0},{key:'theta',label:'Theta (rad)',type:'number',value:1.5708,default:1.5708,step:0.01}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'ro',dir:'out',dt:'register',label:'Register'}],
    toSq: p=>`Ry(q[${p.qubit||0}], ${p.theta||1.5708})` },

  { id:'rz_gate',   label:'Rz Rotation',       cat:'quantum_gate', color:'#6C3FC5', icon:'Rz',
    info:'Rotation around Z-axis by θ radians.',
    params:[{key:'qubit',label:'Qubit',type:'number',value:0,default:0,min:0},{key:'theta',label:'Theta (rad)',type:'number',value:1.5708,default:1.5708,step:0.01}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'ro',dir:'out',dt:'register',label:'Register'}],
    toSq: p=>`Rz(q[${p.qubit||0}], ${p.theta||1.5708})` },

  { id:'cnot_gate', label:'CNOT Gate',          cat:'quantum_gate', color:'#6C3FC5', icon:'⊕',
    info:'Controlled-NOT: flip target if control=|1⟩. Creates entanglement.',
    params:[{key:'control',label:'Control',type:'number',value:0,default:0,min:0},{key:'target',label:'Target',type:'number',value:1,default:1,min:0}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'ro',dir:'out',dt:'register',label:'Register'}],
    toSq: p=>`CNOT(q[${p.control||0}], q[${p.target||1}])` },

  { id:'cz_gate',   label:'CZ Gate',            cat:'quantum_gate', color:'#6C3FC5', icon:'CZ',
    info:'Controlled-Z: phase flip on |11⟩.',
    params:[{key:'qubit_a',label:'Qubit A',type:'number',value:0,default:0,min:0},{key:'qubit_b',label:'Qubit B',type:'number',value:1,default:1,min:0}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'ro',dir:'out',dt:'register',label:'Register'}],
    toSq: p=>`CZ(q[${p.qubit_a||0}], q[${p.qubit_b||1}])` },

  { id:'swap_gate', label:'SWAP Gate',           cat:'quantum_gate', color:'#6C3FC5', icon:'⇄',
    info:'Exchange quantum states of two qubits.',
    params:[{key:'qubit_a',label:'Qubit A',type:'number',value:0,default:0,min:0},{key:'qubit_b',label:'Qubit B',type:'number',value:1,default:1,min:0}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'ro',dir:'out',dt:'register',label:'Register'}],
    toSq: p=>`SWAP(q[${p.qubit_a||0}], q[${p.qubit_b||1}])` },

  { id:'toffoli_gate', label:'Toffoli (CCX)',   cat:'quantum_gate', color:'#6C3FC5', icon:'CCX',
    info:'Doubly-controlled X: flip target if ctrl1=|1⟩ AND ctrl2=|1⟩.',
    params:[{key:'ctrl1',label:'Control 1',type:'number',value:0,default:0,min:0},{key:'ctrl2',label:'Control 2',type:'number',value:1,default:1,min:0},{key:'target',label:'Target',type:'number',value:2,default:2,min:0}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'ro',dir:'out',dt:'register',label:'Register'}],
    toSq: p=>`Toffoli(q[${p.ctrl1||0}], q[${p.ctrl2||1}], q[${p.target||2}])` },

  { id:'measure_all', label:'Measure All',      cat:'quantum_meas', color:'#4338CA', icon:'📏',
    info:'Measure all qubits N shots. Returns {histogram:{...}}.',
    params:[{key:'shots',label:'Shots',type:'number',value:1000,default:1000,min:1,max:100000}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'hist',dir:'out',dt:'dict',label:'Histogram'}],
    toSq: p=>`let result = measure_all(q, shots=${p.shots||1000})\nprint(result.histogram)` },

  { id:'measure_qubit', label:'Measure Qubit',  cat:'quantum_meas', color:'#4338CA', icon:'M',
    info:'Measure a single qubit. Returns 0 or 1.',
    params:[{key:'qubit',label:'Qubit',type:'number',value:0,default:0,min:0}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'bit',dir:'out',dt:'number',label:'Bit (0 or 1)'}],
    toSq: p=>`let bit = measure(q[${p.qubit||0}])` },

  { id:'statevector_block', label:'Statevector', cat:'quantum_meas', color:'#4338CA', icon:'ψ',
    info:'Get the full complex amplitude vector of the quantum state.',
    params:[],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'sv',dir:'out',dt:'list',label:'Statevector'}],
    toSq: _=>`let sv = statevector(q)\nprint(sv)` },

  { id:'grover_algo', label:'Grover Search',    cat:'quantum_algo', color:'#2563EB', icon:'🔍',
    info:'O(√N) quantum search algorithm. Finds target in unsorted database.',
    params:[{key:'n_qubits',label:'Qubits (log₂ N)',type:'number',value:4,default:4,min:1,max:20},{key:'target',label:'Target item',type:'number',value:7,default:7,min:0},{key:'shots',label:'Shots',type:'number',value:1000,default:1000,min:1}],
    inputs:[], outputs:[{id:'hist',dir:'out',dt:'dict',label:'Histogram'}],
    toSq: p=>`let result = grover(${p.n_qubits||4}, [${p.target||7}], ${p.shots||1000})\nprint(result.histogram)` },

  { id:'vqe_solver', label:'VQE',               cat:'quantum_algo', color:'#2563EB', icon:'⚗',
    info:'Variational Quantum Eigensolver. Finds ground state energy of a molecule.',
    params:[{key:'ansatz',label:'Ansatz',type:'select',options:['UCCSD','HEA','RY'],value:'UCCSD',default:'UCCSD'},{key:'shots',label:'Shots',type:'number',value:2000,default:2000,min:100}],
    inputs:[{id:'mol',dir:'in',dt:'any',label:'Molecule'}],
    outputs:[{id:'result',dir:'out',dt:'dict',label:'Result'}],
    toSq: p=>`let result = vqe(molecule, ansatz="${p.ansatz||'UCCSD'}", shots=${p.shots||2000})\nprint(result.energy)` },

  { id:'qft_block', label:'QFT',                cat:'quantum_algo', color:'#2563EB', icon:'QFT',
    info:'Quantum Fourier Transform. forward or inverse.',
    params:[{key:'inverse',label:'Inverse',type:'bool',value:false,default:false}],
    inputs:[{id:'ri',dir:'in',dt:'register',label:'Register'}],
    outputs:[{id:'ro',dir:'out',dt:'register',label:'Register'}],
    toSq: p=>`q.qft(q.n_qubits, ${p.inverse||false})` },

  { id:'print_block', label:'Print',            cat:'output', color:'#F59E0B', icon:'📤',
    info:'Display a value in the output panel.',
    params:[{key:'label',label:'Label',type:'string',value:'',default:''}],
    inputs:[{id:'val',dir:'in',dt:'any',label:'Value'}],
    outputs:[],
    toSq: _=>`print(result)` },
];
