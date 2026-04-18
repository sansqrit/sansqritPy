/**
 * public/js/properties.js  —  Sanskrit Visual Builder v3.1
 * ─────────────────────────────────────────────────────────────────────────────
 * FIXES:
 *  1. Reads p.key (not p.name) — matches registry format
 *  2. Reads p.label for display (not p.name)
 *  3. Shows correct current value: params[p.key]
 *  4. All input types work: number, string, bool, select, angle
 *  5. onUpdate called with correct key
 */

const DOCS = {
  n_qubits:   'Number of qubits. Each extra qubit doubles the state space.',
  n_ancilla:  'Number of ancilla scratch qubits.',
  name:       'Variable name in generated code. Use letters and numbers only.',
  qubit:      'Qubit index (starts at 0).',
  target:     'Target qubit index.',
  control:    'Control qubit — gate fires only when this qubit is |1⟩.',
  ctrl1:      'First control qubit (Toffoli).',
  ctrl2:      'Second control qubit (Toffoli).',
  qubit_a:    'First qubit for two-qubit gate.',
  qubit_b:    'Second qubit for two-qubit gate.',
  theta:      'Rotation angle in radians. Common values: π/2 ≈ 1.5708 · π ≈ 3.1416',
  angle:      'Rotation angle in radians.',
  phi:        'Azimuthal angle φ (radians).',
  shots:      'Measurement repetitions. More = better statistics but slower.',
  ansatz:     'Variational circuit template. UCCSD is standard for chemistry.',
  inverse:    'If true, applies the inverse (adjoint) QFT.',
  basis_set:  'Quantum chemistry basis. STO-3G is fast; cc-pVDZ is accurate.',
  bond_length:'Distance between atoms in Ångströms.',
  p_layers:   'QAOA optimisation layers p. More = better solution, slower.',
};

const PORT_COL = {
  register:'#7C3AED', qubit:'#6D28D9', classical:'#1D4ED8',
  number:'#1D4ED8',   list:'#0F766E',  dict:'#B45309',
  string:'#374151',   bool:'#059669',  any:'#064E3B',
};

// Fields to skip (internal/advanced)
const SKIP = new Set(['bypass','code_override','override_code','log_result','noise_model','error_rate']);

export class Properties {
  constructor(formEl, emptyEl, titleEl) {
    this.form  = formEl;
    this.empty = emptyEl;
    this.title = titleEl;
    this._cb   = null;
  }

  show(block, onChange) {
    this._cb = onChange;
    const def = block.def;

    this.empty.classList.add('hidden');
    this.form.classList.remove('hidden');
    this.title.textContent = def.label || def.id || 'Block';
    this.form.innerHTML = '';

    // ── Description ──────────────────────────────────────────────────────────
    if (def.info) {
      const d = el('div', `font-size:12px;color:var(--text2,#94A3B8);line-height:1.5;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border,#2D3748)`);
      d.textContent = def.info.slice(0, 200);
      this.form.appendChild(d);
    }

    // ── Parameters ───────────────────────────────────────────────────────────
    const params = (def.params || []).filter(p => !SKIP.has(p.key));
    if (params.length) {
      this.form.appendChild(secTitle('Parameters'));
      params.forEach(p => this.form.appendChild(this._field(p, block.params)));
    }

    // ── Ports summary ─────────────────────────────────────────────────────────
    const ins  = def.ins  || [];
    const outs = def.outs || [];
    if (ins.length || outs.length) {
      this.form.appendChild(secTitle('Connections'));
      if (ins.length) {
        const row = el('div', 'margin-bottom:8px');
        row.innerHTML = '<div style="font-size:10px;color:var(--text2,#94A3B8);margin-bottom:4px;letter-spacing:1px">INPUTS</div>' +
          ins.map(p => badge(p, '→')).join('');
        this.form.appendChild(row);
      }
      if (outs.length) {
        const row = el('div', '');
        row.innerHTML = '<div style="font-size:10px;color:var(--text2,#94A3B8);margin-bottom:4px;letter-spacing:1px">OUTPUTS</div>' +
          outs.map(p => badge(p, '←')).join('');
        this.form.appendChild(row);
      }
    }

    // ── Block info ────────────────────────────────────────────────────────────
    this.form.appendChild(secTitle('Info'));
    const info = el('div', 'font-size:11px;color:var(--text2,#94A3B8)');
    info.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span>ID</span>
        <code style="background:#1E2538;padding:1px 6px;font-size:10px;font-family:monospace">${def.id}</code>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span>Category</span><span>${def.cat||''}</span>
      </div>`;
    this.form.appendChild(info);
  }

  deselect() {
    this._cb = null;
    this.form.classList.add('hidden');
    this.empty.classList.remove('hidden');
    this.title.textContent = 'Properties';
  }

  // ── Build one field ───────────────────────────────────────────────────────────
  _field(p, params) {
    const key   = p.key   || p.name || '';
    const label = p.label || key    || 'Value';
    const type  = p.type  || 'string';

    // Current value: params[key] → p.default → ''
    const cur = params !== undefined && params[key] !== undefined && params[key] !== null
      ? params[key]
      : (p.default !== undefined ? p.default : '');

    const doc = p.description || p.desc || DOCS[key] || '';

    const wrap = el('div', 'margin-bottom:14px');

    // Label
    const lbl = document.createElement('label');
    lbl.style.cssText = 'display:block;font-size:11px;font-weight:600;color:var(--text2,#94A3B8);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.5px';
    lbl.textContent = fmt(label);
    wrap.appendChild(lbl);

    let input;

    if (type === 'bool') {
      const row = el('div', 'display:flex;align-items:center;gap:8px;margin:4px 0');
      input = document.createElement('input');
      input.type    = 'checkbox';
      input.checked = Boolean(cur);
      input.style.cssText = 'width:16px;height:16px;cursor:pointer;accent-color:#0F4C5C';
      const txt = el('span', 'font-size:12px;color:var(--text2,#94A3B8)');
      txt.textContent = input.checked ? 'Yes' : 'No';
      input.addEventListener('change', () => {
        txt.textContent = input.checked ? 'Yes' : 'No';
        if (this._cb) this._cb(key, input.checked);
      });
      row.appendChild(input); row.appendChild(txt);
      wrap.appendChild(row);

    } else if ((type === 'select') && p.options?.length) {
      input = document.createElement('select');
      input.className = 'prop-select';
      input.style.cssText = inputStyle();
      p.options.forEach(opt => {
        const o = document.createElement('option');
        const v = typeof opt==='object' ? opt.value : opt;
        const t = typeof opt==='object' ? (opt.label||opt.value) : opt;
        o.value = v; o.textContent = t;
        if (String(v) === String(cur)) o.selected = true;
        input.appendChild(o);
      });
      input.addEventListener('change', () => { if (this._cb) this._cb(key, input.value); });
      wrap.appendChild(input);

    } else if (type === 'number' || type === 'angle' || type === 'qubit') {
      input = document.createElement('input');
      input.type  = 'number';
      input.style.cssText = inputStyle();
      input.value = (cur !== '' && cur !== undefined) ? cur : (p.default ?? 0);
      input.step  = p.step ?? (type==='angle' ? '0.01' : '1');
      if (p.min !== undefined && p.min !== null) input.min = p.min;
      if (p.max !== undefined && p.max !== null) input.max = p.max;
      const upd = () => {
        const v = input.value==='' ? 0 : Number(input.value);
        if (this._cb) this._cb(key, v);
      };
      input.addEventListener('change', upd);
      input.addEventListener('input',  upd);
      wrap.appendChild(input);

    } else {
      // string, code, json, etc.
      input = document.createElement('input');
      input.type        = 'text';
      input.style.cssText = inputStyle();
      input.value       = cur !== undefined && cur !== null ? String(cur) : '';
      input.placeholder = p.placeholder || label;
      const upd = () => { if (this._cb) this._cb(key, input.value); };
      input.addEventListener('change', upd);
      input.addEventListener('input',  upd);
      wrap.appendChild(input);
    }

    if (doc) {
      const d = el('div', 'font-size:10px;color:var(--text2,#94A3B8);margin-top:4px;line-height:1.4');
      d.textContent = doc;
      wrap.appendChild(d);
    }

    return wrap;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function el(tag, style) {
  const e = document.createElement(tag);
  if (style) e.style.cssText = style;
  return e;
}
function secTitle(text) {
  const d = el('div', 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text2,#94A3B8);padding:10px 0 5px;border-top:1px solid var(--border,#2D3748);margin-top:10px');
  d.textContent = text;
  return d;
}
function fmt(s) {
  return String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) || 'Value';
}
function inputStyle() {
  return 'width:100%;background:#1E2538;border:1px solid #2D3748;border-radius:5px;padding:7px 10px;color:#E2E8F0;font-size:12px;font-family:Segoe UI,sans-serif;box-sizing:border-box;outline:none';
}
function badge(port, arrow) {
  const c = PORT_COL[port.type||port.dt] || PORT_COL.any;
  const n = port.name || port.id || 'port';
  const t = port.type || port.dt || 'any';
  return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 8px;border-radius:10px;background:${c}22;border:1px solid ${c}55;color:${c};margin:2px 3px 2px 0;font-family:Segoe UI,sans-serif"><span style="font-size:8px">${arrow}</span>${n}<span style="opacity:0.6;font-size:9px">${t}</span></span>`;
}
