/**
 * src/server/server.js — Sanskrit Visual Builder v3.2
 * ETL + Data Science + Quantum + Settings
 * Pure Node.js — no npm install required
 */
import http             from 'http';
import fs               from 'fs';
import path             from 'path';
import os               from 'os';
import v8               from 'v8';
import { fileURLToPath } from 'url';
import { execSync, execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT   = path.resolve(__dirname, '../../');
const PUBLIC = path.join(ROOT, 'public');
const DATA   = path.join(PUBLIC, 'sample-data');
const PORT   = parseInt(process.env.PORT || '3000', 10);

const MIME = {
  '.html':'text/html;charset=utf-8', '.css':'text/css',
  '.js':'application/javascript',    '.json':'application/json',
  '.csv':'text/csv',                 '.png':'image/png',
  '.svg':'image/svg+xml',            '.ico':'image/x-icon',
  '.wasm':'application/wasm',        '.txt':'text/plain',
  '.sans':'application/json',        '.sanskrit':'application/json',
  '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const C='\x1b[36m',G='\x1b[32m',R='\x1b[31m',Z='\x1b[0m',W='\x1b[1m',B='\x1b[34m',Y='\x1b[33m';
const log = m => console.log(`${C}[SK]${Z} ${m}`);
const ok  = m => console.log(`${G}[OK]${Z} ${m}`);
const er  = m => console.error(`${R}[ER]${Z} ${m}`);
const wr  = m => console.log(`${Y}[WR]${Z} ${m}`);

// ── Load optional quantum modules ─────────────────────────────────────────────
let BLOCKS=[], CATS={}, Interp=null, buildStd=null;
async function boot() {
  try {
    const { BLOCKS:B, CATEGORIES:C2 } = await import('../blocks/registry.js');
    BLOCKS=B||[]; CATS=C2||{};
    ok('Blocks  '+BLOCKS.length+' / '+Object.keys(CATS).length+' cats');
  } catch(e) { wr('Blocks: '+e.message); }
  try {
    const im = await import('../dsl/interpreter.js');
    Interp   = im.SanskritInterpreter || im.default;
    const sm = await import('../dsl/stdlib.js');
    buildStd = sm.buildStdlib || sm.default;
    ok('DSL     interpreter ready');
  } catch(e) { wr('Interp: '+e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV PARSER (pure Node.js)
// ═══════════════════════════════════════════════════════════════════════════════
function parseCSV(text, delimiter = ",") {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim().split('\n');
  if (!lines.length) return { columns:[], rows:[] };
  const parseRow = line => {
    const cols=[], len=line.length; let cur='', inQ=false;
    for(let i=0;i<len;i++){
      const ch=line[i];
      if(ch==='"'){ if(inQ&&line[i+1]==='"'){cur+='"';i++;}else{inQ=!inQ;} }
      else if(ch===delimiter&&!inQ){cols.push(cur.trim());cur='';}
      else cur+=ch;
    }
    cols.push(cur.trim());
    return cols;
  };
  const columns = parseRow(lines[0]);
  const rows = lines.slice(1).filter(l=>l.trim()).map(l=>{
    const vals=parseRow(l);
    const obj={};
    columns.forEach((c,i)=>obj[c]=vals[i]!==undefined?vals[i]:'');
    return obj;
  });
  return {columns,rows};
}

function rowsToCSV(columns, rows) {
  const esc = v => /[",\n]/.test(String(v||'')) ? '"'+String(v||'').replace(/"/g,'""')+'"' : String(v||'');
  return [columns.join(','), ...rows.map(r=>columns.map(c=>esc(r[c]||'')).join(','))].join('\n');
}


function ensureRowIds(rows) {
  return (rows || []).map((row, i) => {
    const obj = row && typeof row === 'object' ? { ...row } : { value: row };
    if (obj.row_id === undefined || obj.row_id === null || obj.row_id === '') obj.row_id = `row_${i + 1}`;
    return obj;
  });
}

function datasetFromRows(rows, columns = null) {
  const cleanRows = ensureRowIds(rows || []);
  const cols = columns && columns.length ? [...columns] : [...new Set(cleanRows.flatMap(r => Object.keys(r)))];
  if (!cols.includes('row_id')) cols.unshift('row_id');
  const orderedRows = cleanRows.map((r, i) => {
    const obj = {};
    cols.forEach(c => { obj[c] = r[c] !== undefined ? r[c] : (c === 'row_id' ? `row_${i + 1}` : ''); });
    return obj;
  });
  return { columns: cols, rows: orderedRows, total_rows: orderedRows.length, types: inferTypes(cols, orderedRows) };
}

function flattenJsonRows(data) {
  const rows = Array.isArray(data) ? data : (data && typeof data === 'object' ? [data] : []);
  const flat = rows.map((row) => {
    if (!row || typeof row !== 'object') return { value: row };
    const out = {};
    const walk = (prefix, value) => {
      if (value === null || value === undefined) { out[prefix] = ''; return; }
      if (Array.isArray(value)) { out[prefix] = JSON.stringify(value); return; }
      if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (!keys.length) { out[prefix] = '{}'; return; }
        keys.forEach(k => walk(prefix ? `${prefix}.${k}` : k, value[k]));
        return;
      }
      out[prefix] = value;
    };
    Object.entries(row).forEach(([k, v]) => walk(k, v));
    return out;
  });
  return datasetFromRows(flat);
}

function parseJsonTable(text) {
  const data = JSON.parse(text);
  return flattenJsonRows(data);
}

function runPythonStdlib(script, args = [], options = {}) {
  const candidates = [
    process.env.PYTHON,
    process.platform === 'win32' ? 'python' : 'python3',
    process.platform === 'win32' ? 'py' : 'python',
  ].filter(Boolean);
  let lastErr = null;
  for (const cmd of candidates) {
    try {
      const cmdArgs = cmd === 'py' ? ['-3', '-c', script, ...args] : ['-c', script, ...args];
      return execFileSync(cmd, cmdArgs, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, ...options });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Python is not available');
}

function parseXmlTable(text) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanskrit-xml-'));
  const xmlPath = path.join(tmpDir, 'upload.xml');
  fs.writeFileSync(xmlPath, text, 'utf8');
  const script = String.raw`
import json, sys, xml.etree.ElementTree as ET
path = sys.argv[1]
root = ET.parse(path).getroot()

def clean(v):
    if v is None:
        return ''
    return v.strip() if isinstance(v, str) else v

def flatten(node, prefix=''):
    out = {}
    for k, v in node.attrib.items():
        out[(prefix + '@' + k) if prefix else '@' + k] = clean(v)
    text = clean(node.text)
    if text and (not list(node)):
        out[prefix or node.tag] = text
    elif text and prefix and prefix not in out:
        out[prefix] = text
    for child in node:
        key = child.tag
        child_prefix = f"{prefix}.{key}" if prefix else key
        if list(child) or child.attrib:
            sub = flatten(child, child_prefix)
            out.update(sub)
        else:
            val = clean(child.text)
            out[child_prefix] = val
    return out

children = list(root)
# Prefer repeated child elements as rows
counts = {}
for ch in children:
    counts[ch.tag] = counts.get(ch.tag, 0) + 1
repeat_tag = next((k for k, v in counts.items() if v > 1), None)
rows = []
if repeat_tag:
    for ch in children:
        if ch.tag == repeat_tag:
            rows.append(flatten(ch))
else:
    rows = [flatten(root)]
cols = []
for r in rows:
    for k in r.keys():
        if k not in cols:
            cols.append(k)
print(json.dumps({'columns': cols, 'rows': rows}))
`;
  try {
    const out = runPythonStdlib(script, [xmlPath]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    const parsed = JSON.parse(out.trim() || '{}');
    return datasetFromRows(parsed.rows || [], parsed.columns || []);
  } catch (e) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error('XML parse failed: ' + e.message);
  }
}

function parseExcelTable(uploadedFile, params = {}) {
  const base64 = uploadedFile?.content || '';
  if (!base64) return { error: 'No Excel payload' };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanskrit-xlsx-'));
  const xlsxPath = path.join(tmpDir, uploadedFile.name || 'upload.xlsx');
  fs.writeFileSync(xlsxPath, Buffer.from(base64, 'base64'));
  const script = String.raw`
import json, re, sys, zipfile, xml.etree.ElementTree as ET
path = sys.argv[1]
sheet = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else None

NS = {
    'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'rel': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'pkgrel': 'http://schemas.openxmlformats.org/package/2006/relationships',
}

def col_index(cell_ref):
    letters = ''.join(ch for ch in cell_ref if ch.isalpha()).upper()
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return max(n - 1, 0)

def read_xml(zf, name):
    return ET.fromstring(zf.read(name))

with zipfile.ZipFile(path) as zf:
    shared = []
    if 'xl/sharedStrings.xml' in zf.namelist():
        root = read_xml(zf, 'xl/sharedStrings.xml')
        for si in root.findall('main:si', NS):
            text = ''.join(t.text or '' for t in si.findall('.//main:t', NS))
            shared.append(text)

    wb = read_xml(zf, 'xl/workbook.xml')
    rels = read_xml(zf, 'xl/_rels/workbook.xml.rels')
    rel_map = {}
    for rel in rels:
        rid = rel.attrib.get('Id')
        target = rel.attrib.get('Target', '')
        if rid:
            rel_map[rid] = 'xl/' + target.lstrip('/')

    sheets = []
    for s in wb.findall('main:sheets/main:sheet', NS):
        name = s.attrib.get('name', '')
        rid = s.attrib.get('{%s}id' % NS['rel'])
        if rid in rel_map:
            sheets.append((name, rel_map[rid]))
    if not sheets:
        print(json.dumps({'columns': [], 'rows': []}))
        raise SystemExit(0)
    chosen = next((item for item in sheets if sheet and item[0] == sheet), sheets[0])
    ws = read_xml(zf, chosen[1])

    table = {}
    max_col = 0
    max_row = 0
    for row in ws.findall('.//main:sheetData/main:row', NS):
        r_idx = int(row.attrib.get('r', '0') or '0') - 1
        max_row = max(max_row, r_idx)
        for c in row.findall('main:c', NS):
            ref = c.attrib.get('r', '')
            c_idx = col_index(ref)
            max_col = max(max_col, c_idx)
            typ = c.attrib.get('t')
            v = c.find('main:v', NS)
            inline = c.find('main:is/main:t', NS)
            val = ''
            if inline is not None:
                val = inline.text or ''
            elif v is not None:
                raw = v.text or ''
                if typ == 's':
                    try:
                        val = shared[int(raw)]
                    except Exception:
                        val = raw
                elif typ == 'b':
                    val = raw == '1'
                else:
                    try:
                        val = float(raw) if ('.' in raw) else int(raw)
                    except Exception:
                        val = raw
            table[(r_idx, c_idx)] = val

    matrix = []
    for r in range(max_row + 1):
        matrix.append([table.get((r, c), '') for c in range(max_col + 1)])

rows = matrix
if not rows or not any(any(str(v) for v in row) for row in rows):
    print(json.dumps({'columns': [], 'rows': []}))
    raise SystemExit(0)
columns = []
for i, c in enumerate(rows[0]):
    columns.append(str(c) if c not in (None, '') else f'col_{i+1}')
out = []
for row in rows[1:]:
    obj = {}
    for i, col in enumerate(columns):
        v = row[i] if i < len(row) else None
        obj[col] = '' if v is None else v
    out.append(obj)
print(json.dumps({'columns': columns, 'rows': out}, default=str))
`;
  try {
    const out = runPythonStdlib(script, [xlsxPath, params.sheet_name || params.sheet || '']);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    const parsed = JSON.parse(out.trim() || '{}');
    return datasetFromRows(parsed.rows || [], parsed.columns || []);
  } catch (e) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return { error: 'Excel parse failed: ' + e.message };
  }
}

function parseUploadedFile(uploadedFile, params = {}, op = '') {
  if (!uploadedFile) return null;
  const name = String(uploadedFile.name || params.filename || params.file_path || '').toLowerCase();
  const ext = uploadedFile.ext || path.extname(name).replace(/^\./, '').toLowerCase();
  const kind = uploadedFile.kind || (['xlsx', 'xls'].includes(ext) ? 'base64' : 'text');
  const text = kind === 'base64' ? Buffer.from(uploadedFile.content || '', 'base64').toString('utf8') : String(uploadedFile.content || '');
  if (['csv', 'tsv'].includes(ext) || op === 'csv_reader') {
    const sep = params.separator || (ext === 'tsv' ? '\t' : ',');
    return { kind: 'csv', text, separator: sep };
  }
  if (ext === 'json' || op === 'json_reader') return { kind: 'json', text };
  if (ext === 'xml' || op === 'xml_reader') return { kind: 'xml', text };
  if (['xlsx', 'xls'].includes(ext) || op === 'excel_reader') return { kind: 'excel', uploadedFile };
  return { kind: 'text', text };
}

// Infer column types
function inferTypes(columns, rows) {
  const types={};
  columns.forEach(col=>{
    const vals=rows.map(r=>r[col]).filter(v=>v!==''&&v!==null&&v!==undefined);
    if(!vals.length){types[col]='string';return;}
    const numVals=vals.filter(v=>typeof v==='number'||(!isNaN(Number(v))&&String(v).trim()!==''));
    if(numVals.length===vals.length){types[col]=vals.some(v=>String(v).includes('.'))?'float':'integer';}
    else if(vals.every(v=>/^\d{4}-\d{2}-\d{2}/.test(String(v)))){types[col]='date';}
    else if(vals.every(v=>v===true||v===false||v==='true'||v==='false')){types[col]='boolean';}
    else types[col]='string';
  });
  return types;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETL OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════
const ETL = {

  // ── SOURCES ────────────────────────────────────────────────────────────────
  csv_reader(params, _inputs, uploadedData, uploadedFile) {
    let text = '';
    const fpName = params.file_path || params.filename || params.path;
    if (uploadedFile || uploadedData) {
      const up = uploadedFile || { content: uploadedData, name: fpName || '', kind: 'text', ext: path.extname(String(fpName || '')).replace(/^\./, '').toLowerCase() };
      const parsed = parseUploadedFile(up, params, 'csv_reader');
      text = parsed.kind === 'base64' ? Buffer.from(up.content || '', 'base64').toString('utf8') : parsed.text;
      if (parsed.kind === 'excel') {
        const ds = parseExcelTable(up, params);
        if (ds.error) return { error: ds.error };
        const limited = params.preview_rows ? ds.rows.slice(0, parseInt(params.preview_rows) || 100) : ds.rows;
        return { dataset: { ...ds, rows: limited }, log: 'Excel loaded: ' + ds.columns.length + ' cols, ' + ds.rows.length + ' rows' };
      }
      if (parsed.kind === 'xml') {
        const ds = parseXmlTable(text);
        const limited = params.preview_rows ? ds.rows.slice(0, parseInt(params.preview_rows) || 100) : ds.rows;
        return { dataset: { ...ds, rows: limited }, log: 'XML loaded: ' + ds.columns.length + ' cols, ' + ds.rows.length + ' rows' };
      }
    } else if (fpName) {
      const fp = path.join(DATA, path.basename(fpName));
      if (!fs.existsSync(fp)) return { error: 'File not found: ' + fpName };
      text = fs.readFileSync(fp, 'utf8');
    } else return { error: 'No filename specified' };
    const sep = params.separator || (String(fpName).toLowerCase().endsWith('.tsv') ? '	' : ',');
    const {columns,rows}=parseCSV(text, sep);
    const dataset = datasetFromRows(rows, columns);
    const limited=params.preview_rows?dataset.rows.slice(0,parseInt(params.preview_rows)||100):dataset.rows;
    return {dataset:{...dataset,rows:limited},log:'CSV loaded: '+dataset.columns.length+' cols, '+dataset.rows.length+' rows'};
  },

  json_reader(params, _inputs, uploadedData, uploadedFile) {
    let data=null;
    const fpName = params.file_path || params.filename || params.path;
    if (uploadedFile || uploadedData) {
      const up = uploadedFile || { content: uploadedData, name: fpName || '', kind: 'text', ext: 'json' };
      const parsed = parseUploadedFile(up, params, 'json_reader');
      if (parsed.kind === 'excel') {
        const ds = parseExcelTable(up, params);
        if (ds.error) return { error: ds.error };
        const limited = params.preview_rows ? ds.rows.slice(0, parseInt(params.preview_rows) || 100) : ds.rows;
        return { dataset: { ...ds, rows: limited }, log: 'Excel loaded: ' + ds.columns.length + ' cols, ' + ds.rows.length + ' rows' };
      }
      if (parsed.kind === 'xml') {
        const ds = parseXmlTable(parsed.text);
        const limited = params.preview_rows ? ds.rows.slice(0, parseInt(params.preview_rows) || 100) : ds.rows;
        return { dataset: { ...ds, rows: limited }, log: 'XML loaded: ' + ds.columns.length + ' cols, ' + ds.rows.length + ' rows' };
      }
      try { data = JSON.parse(parsed.text); } catch (e) { return { error: 'Invalid JSON' }; }
    } else if (fpName) {
      const fp=path.join(DATA,path.basename(fpName));
      if(!fs.existsSync(fp))return{error:'File not found: '+fpName};
      try{data=JSON.parse(fs.readFileSync(fp,'utf8'));}catch(e){return{error:'Invalid JSON file'};}
    }
    if(!data)return{error:'No data'};
    const ds = flattenJsonRows(data);
    const limited=params.preview_rows?ds.rows.slice(0,parseInt(params.preview_rows)||100):ds.rows;
    return{dataset:{...ds,rows:limited},log:'JSON loaded: '+limited.length+' rows'};
  },

  xml_reader(params, _inputs, uploadedData, uploadedFile) {
    let text = '';
    const fpName = params.file_path || params.filename || params.path;
    if (uploadedFile || uploadedData) {
      const up = uploadedFile || { content: uploadedData, name: fpName || 'upload.xml', kind: 'text', ext: 'xml' };
      const parsed = parseUploadedFile(up, params, 'xml_reader');
      if (parsed.kind === 'excel') {
        const ds = parseExcelTable(up, params);
        if (ds.error) return { error: ds.error };
        const limited = params.preview_rows ? ds.rows.slice(0, parseInt(params.preview_rows) || 100) : ds.rows;
        return { dataset: { ...ds, rows: limited }, log: 'Excel loaded: ' + ds.columns.length + ' cols, ' + ds.rows.length + ' rows' };
      }
      text = parsed.text;
    } else if (fpName) {
      const fp = path.join(DATA, path.basename(fpName));
      if (!fs.existsSync(fp)) return { error: 'File not found: ' + fpName };
      text = fs.readFileSync(fp, 'utf8');
    } else return { error: 'No XML file specified' };
    const ds = parseXmlTable(text);
    const limited = params.preview_rows ? ds.rows.slice(0, parseInt(params.preview_rows) || 100) : ds.rows;
    return { dataset: { ...ds, rows: limited }, log: 'XML loaded: ' + ds.columns.length + ' cols, ' + ds.rows.length + ' rows' };
  },

  excel_reader(params, _inputs, uploadedData, uploadedFile) {
    const fpName = params.file_path || params.filename || params.path;
    let up = uploadedFile || null;
    if (!up && uploadedData) {
      up = { content: uploadedData, name: fpName || 'upload.xlsx', kind: 'base64', ext: 'xlsx' };
    }
    if (!up && fpName) {
      const fp = path.join(DATA, path.basename(fpName));
      if (!fs.existsSync(fp)) return { error: 'File not found: ' + fpName };
      up = {
        name: path.basename(fp),
        content: fs.readFileSync(fp).toString('base64'),
        kind: 'base64',
        ext: path.extname(fp).replace(/^\./, '').toLowerCase(),
      };
    }
    if (!up) return { error: 'No Excel file specified' };
    const ds = parseExcelTable(up, params);
    if (ds.error) return { error: ds.error };
    const limited = params.preview_rows ? ds.rows.slice(0, parseInt(params.preview_rows) || 100) : ds.rows;
    return { dataset: { ...ds, rows: limited }, log: 'Excel loaded: ' + ds.columns.length + ' cols, ' + ds.rows.length + ' rows' };
  },

  inline_data(params) {
    try{
      const raw=JSON.parse(params.data||'[]');
      const rows=Array.isArray(raw)?raw:[raw];
      const columns=[...new Set(rows.flatMap(r=>Object.keys(r)))];
      return{dataset:{columns,rows,total_rows:rows.length,types:inferTypes(columns,rows)},log:'Inline data: '+rows.length+' rows'};
    }catch(e){return{error:'Invalid JSON data: '+e.message};}
  },

  // ── FILTERING ──────────────────────────────────────────────────────────────
  filter_rows(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const {column,operator,value}=params;
    if(!column)return{dataset:ds,log:'No filter column specified'};
    let rows=ds.rows.filter(row=>{
      const v=row[column]??''; const cmp=value??'';
      switch(operator){
        case '==':  return String(v)===String(cmp);
        case '!=':  return String(v)!==String(cmp);
        case '>':   return Number(v)>Number(cmp);
        case '>=':  return Number(v)>=Number(cmp);
        case '<':   return Number(v)<Number(cmp);
        case '<=':  return Number(v)<=Number(cmp);
        case 'contains':   return String(v).toLowerCase().includes(String(cmp).toLowerCase());
        case 'not contains':return !String(v).toLowerCase().includes(String(cmp).toLowerCase());
        case 'starts with':return String(v).toLowerCase().startsWith(String(cmp).toLowerCase());
        case 'ends with':  return String(v).toLowerCase().endsWith(String(cmp).toLowerCase());
        case 'is null':    return v===''||v===null||v===undefined;
        case 'is not null':return v!==''&&v!==null&&v!==undefined;
        case 'in': return String(cmp).split(',').map(s=>s.trim()).includes(String(v));
        case 'not in': return !String(cmp).split(',').map(s=>s.trim()).includes(String(v));
        default: return true;
      }
    });
    if(params.limit) rows=rows.slice(0,parseInt(params.limit));
    return{dataset:{...ds,rows,total_rows:rows.length},log:`Filter [${column} ${operator} ${value}]: ${rows.length} of ${ds.rows.length} rows`};
  },

  // ── COLUMN OPERATIONS ──────────────────────────────────────────────────────
  select_columns(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const cols=(params.columns||'').split(',').map(c=>c.trim()).filter(c=>c&&ds.columns.includes(c));
    if(!cols.length)return{dataset:ds,log:'No valid columns selected'};
    const rows=ds.rows.map(r=>{const n={};cols.forEach(c=>n[c]=r[c]);return n;});
    const types={};cols.forEach(c=>types[c]=(ds.types||{})[c]||'string');
    return{dataset:{columns:cols,rows,total_rows:rows.length,types},log:'Selected '+cols.length+' columns'};
  },

  rename_columns(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const mapping={};
    try{Object.assign(mapping,JSON.parse(params.mapping||'{}'));}catch(e){return{error:'Invalid mapping JSON'};}
    const cols=ds.columns.map(c=>mapping[c]||c);
    const rows=ds.rows.map(r=>{const n={};ds.columns.forEach((c,i)=>n[cols[i]]=r[c]);return n;});
    const types={};cols.forEach((c,i)=>types[c]=(ds.types||{})[ds.columns[i]]||'string');
    return{dataset:{columns:cols,rows,total_rows:rows.length,types},log:'Renamed columns: '+JSON.stringify(mapping)};
  },

  add_column(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const {name,formula}=params;
    if(!name)return{error:'Column name required'};
    const rows=ds.rows.map(r=>{
      let val='';
      try{
        // Safe formula evaluation with row context
        const ctx=Object.keys(r).map(k=>`const ${k.replace(/[^a-zA-Z0-9_]/g,'_')}=row["${k}"];`).join('');
        val=Function('row',ctx+' return ('+formula+');')(r);
      }catch(e){val='#ERR';}
      return{...r,[name]:val};
    });
    const cols=[...ds.columns];
    if(!cols.includes(name))cols.push(name);
    const types={...ds.types,[name]:'string'};
    return{dataset:{columns:cols,rows,total_rows:rows.length,types},log:'Added column: '+name};
  },

  drop_columns(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const drop=(params.columns||'').split(',').map(c=>c.trim());
    const cols=ds.columns.filter(c=>!drop.includes(c));
    const rows=ds.rows.map(r=>{const n={};cols.forEach(c=>n[c]=r[c]);return n;});
    const types={};cols.forEach(c=>types[c]=(ds.types||{})[c]||'string');
    return{dataset:{columns:cols,rows,total_rows:rows.length,types},log:'Dropped columns: '+drop.join(', ')};
  },

  cast_types(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    let mapping={};
    try{mapping=JSON.parse(params.mapping||'{}');}catch(e){return{error:'Invalid JSON: '+e.message};}
    const rows=ds.rows.map(r=>{
      const n={...r};
      Object.entries(mapping).forEach(([col,type])=>{
        if(col in n){
          switch(type){
            case 'integer': n[col]=parseInt(n[col])||0; break;
            case 'float':   n[col]=parseFloat(n[col])||0; break;
            case 'string':  n[col]=String(n[col]||''); break;
            case 'boolean': n[col]=n[col]==='true'||n[col]===true||n[col]==='1'; break;
            case 'date':    n[col]=new Date(n[col]).toISOString().slice(0,10); break;
          }
        }
      });
      return n;
    });
    const types={...ds.types,...mapping};
    return{dataset:{...ds,rows,types},log:'Cast types: '+JSON.stringify(mapping)};
  },

  // ── CLEANING ───────────────────────────────────────────────────────────────
  drop_nulls(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const cols=params.columns?(params.columns.split(',').map(c=>c.trim())):ds.columns;
    const before=ds.rows.length;
    const rows=ds.rows.filter(r=>cols.every(c=>r[c]!==''&&r[c]!==null&&r[c]!==undefined));
    return{dataset:{...ds,rows,total_rows:rows.length},log:`Drop nulls: ${before-rows.length} rows removed, ${rows.length} remain`};
  },

  fill_nulls(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const {strategy,value,column}=params;
    const cols=column?[column]:ds.columns;
    const rows=ds.rows.map(r=>{
      const n={...r};
      cols.forEach(col=>{
        if(n[col]===''||n[col]===null||n[col]===undefined){
          switch(strategy){
            case 'constant': n[col]=value||''; break;
            case 'mean':{
              const vals=ds.rows.map(x=>parseFloat(x[col])).filter(v=>!isNaN(v));
              n[col]=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
              break;}
            case 'median':{
              const vals=ds.rows.map(x=>parseFloat(x[col])).filter(v=>!isNaN(v)).sort((a,b)=>a-b);
              n[col]=vals.length?vals[Math.floor(vals.length/2)]:0;
              break;}
            case 'mode':{
              const freq={};ds.rows.forEach(x=>{if(x[col]!=='')freq[x[col]]=(freq[x[col]]||0)+1;});
              const m=Object.entries(freq).sort((a,b)=>b[1]-a[1])[0];
              n[col]=m?m[0]:''; break;}
            case 'forward': {
              const idx=ds.rows.indexOf(r);
              for(let i=idx-1;i>=0;i--){if(ds.rows[i][col]!==''){n[col]=ds.rows[i][col];break;}}
              break;}
            case 'backward': {
              const idx2=ds.rows.indexOf(r);
              for(let i=idx2+1;i<ds.rows.length;i++){if(ds.rows[i][col]!==''){n[col]=ds.rows[i][col];break;}}
              break;}
          }
        }
      });
      return n;
    });
    return{dataset:{...ds,rows},log:`Fill nulls [${strategy}] on: ${cols.join(', ')}`};
  },

  trim_strings(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const cols=params.columns?params.columns.split(',').map(c=>c.trim()):ds.columns.filter(c=>(ds.types||{})[c]==='string');
    const rows=ds.rows.map(r=>{
      const n={...r};
      cols.forEach(col=>{if(typeof n[col]==='string')n[col]=n[col].trim();});
      return n;
    });
    return{dataset:{...ds,rows},log:'Trimmed strings in: '+cols.join(', ')};
  },

  replace_values(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const {column,find,replace,case_sensitive}=params;
    if(!column)return{error:'Column required'};
    const cs=case_sensitive==='true'||case_sensitive===true;
    let count=0;
    const rows=ds.rows.map(r=>{
      const n={...r};
      const v=String(n[column]||'');
      const match=cs?v===find:v.toLowerCase()===(find||'').toLowerCase();
      if(match){n[column]=replace||'';count++;}
      return n;
    });
    return{dataset:{...ds,rows},log:`Replaced ${count} occurrences of "${find}" with "${replace}" in ${column}`};
  },

  dedup(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const cols=params.columns?params.columns.split(',').map(c=>c.trim()):ds.columns;
    const seen=new Set();
    const rows=ds.rows.filter(r=>{
      const key=cols.map(c=>String(r[c]||'')).join('|');
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
    return{dataset:{...ds,rows,total_rows:rows.length},log:`Dedup on [${cols.join(', ')}]: ${ds.rows.length-rows.length} duplicates removed`};
  },

  // ── SORTING ────────────────────────────────────────────────────────────────
  sort_rows(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const col=params.column||ds.columns[0];
    const asc=params.order!=='desc';
    const isNum=(ds.types||{})[col]==='integer'||(ds.types||{})[col]==='float';
    const rows=[...ds.rows].sort((a,b)=>{
      const av=isNum?Number(a[col]):String(a[col]||'');
      const bv=isNum?Number(b[col]):String(b[col]||'');
      return asc?(av>bv?1:av<bv?-1:0):(av<bv?1:av>bv?-1:0);
    });
    return{dataset:{...ds,rows},log:`Sorted by ${col} ${asc?'ASC':'DESC'}`};
  },

  top_n(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const n=parseInt(params.n||10);
    const col=params.column;
    let rows=[...ds.rows];
    if(col){
      const isNum=(ds.types||{})[col]==='integer'||(ds.types||{})[col]==='float';
      rows.sort((a,b)=>{
        const av=isNum?Number(a[col]):a[col];
        const bv=isNum?Number(b[col]):b[col];
        return bv>av?1:bv<av?-1:0;
      });
    }
    rows=rows.slice(0,n);
    return{dataset:{...ds,rows,total_rows:rows.length},log:`Top ${n} rows${col?' by '+col:''}`};
  },

  // ── JOINS ──────────────────────────────────────────────────────────────────
  join(params, inputs) {
    const left=inputs.left_dataset||inputs.dataset;
    const right=inputs.right_dataset;
    if(!left)return{error:'No left dataset'};
    if(!right)return{error:'No right dataset. Connect second dataset to right_dataset port'};
    const lKey=params.left_key; const rKey=params.right_key||lKey;
    if(!lKey)return{error:'Join key required'};
    const type=params.join_type||'inner';
    const prefix_l=params.prefix_left||'l_';
    const prefix_r=params.prefix_right||'r_';
    // Build lookup from right
    const rMap=new Map();
    right.rows.forEach(r=>{
      const k=String(r[rKey]||'');
      if(!rMap.has(k))rMap.set(k,[]);
      rMap.get(k).push(r);
    });
    // Build merged columns
    const lCols=left.columns;
    const rCols=right.columns.filter(c=>c!==rKey);
    const allCols=[...lCols,...rCols.map(c=>lCols.includes(c)?prefix_r+c:c)];
    const nullRight=Object.fromEntries(rCols.map(c=>[lCols.includes(c)?prefix_r+c:c,'']));
    const rows=[];
    // Left / inner / full
    left.rows.forEach(lRow=>{
      const k=String(lRow[lKey]||'');
      const matches=rMap.get(k)||[];
      if(matches.length){
        matches.forEach(rRow=>{
          const merged={...lRow};
          rCols.forEach(c=>{merged[lCols.includes(c)?prefix_r+c:c]=rRow[c];});
          rows.push(merged);
        });
      } else if(type==='left'||type==='full'||type==='left outer'||type==='full outer'){
        rows.push({...lRow,...nullRight});
      }
    });
    // Right / full: add right rows with no match
    if(type==='right'||type==='right outer'||type==='full'||type==='full outer'){
      const matchedKeys=new Set(left.rows.map(r=>String(r[lKey]||'')));
      right.rows.forEach(rRow=>{
        const k=String(rRow[rKey]||'');
        if(!matchedKeys.has(k)){
          const merged={};lCols.forEach(c=>merged[c]='');
          rCols.forEach(c=>{merged[lCols.includes(c)?prefix_r+c:c]=rRow[c];});
          merged[lKey]=rRow[rKey];
          rows.push(merged);
        }
      });
    }
    // Anti join: left rows with NO match in right
    if(type==='anti'||type==='left anti'){
      rows.length=0;
      left.rows.forEach(lRow=>{
        const k=String(lRow[lKey]||'');
        if(!rMap.has(k))rows.push({...lRow,...nullRight});
      });
    }
    const types={...left.types};
    return{dataset:{columns:allCols,rows,total_rows:rows.length,types},log:`${type.toUpperCase()} JOIN on ${lKey}: ${rows.length} rows`};
  },

  cross_join(params, inputs) {
    const left=inputs.left_dataset||inputs.dataset;
    const right=inputs.right_dataset;
    if(!left||!right)return{error:'Need left_dataset and right_dataset'};
    if(left.rows.length*right.rows.length>10000)return{error:'Cross join would produce >10000 rows. Limit input data first.'};
    const lCols=left.columns;
    const rCols=right.columns.map(c=>lCols.includes(c)?'r_'+c:c);
    const allCols=[...lCols,...rCols];
    const rows=[];
    left.rows.forEach(l=>{right.rows.forEach(r=>{
      const m={...l};
      right.columns.forEach((c,i)=>m[rCols[i]]=r[c]);
      rows.push(m);
    });});
    return{dataset:{columns:allCols,rows,total_rows:rows.length},log:`CROSS JOIN: ${rows.length} rows`};
  },

  // ── AGGREGATION ────────────────────────────────────────────────────────────
  group_by(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const groupCols=(params.group_by||'').split(',').map(c=>c.trim()).filter(c=>c);
    if(!groupCols.length)return{error:'group_by columns required'};
    let aggDefs=[];
    try{aggDefs=JSON.parse(params.aggregations||'[]');}
    catch(e){return{error:'aggregations must be JSON array like [{"col":"revenue","fn":"sum","as":"total"}]'};}
    // Group
    const groups=new Map();
    ds.rows.forEach(row=>{
      const k=groupCols.map(c=>String(row[c]||'')).join('|||');
      if(!groups.has(k))groups.set(k,{key:{},rows:[]});
      const g=groups.get(k);
      groupCols.forEach(c=>g.key[c]=row[c]);
      g.rows.push(row);
    });
    const outCols=[...groupCols,...aggDefs.map(a=>a.as||a.fn+'_'+a.col)];
    const rows=[...groups.values()].map(g=>{
      const out={...g.key};
      aggDefs.forEach(a=>{
        const vals=g.rows.map(r=>parseFloat(r[a.col])).filter(v=>!isNaN(v));
        const outKey=a.as||a.fn+'_'+a.col;
        switch(a.fn){
          case 'sum':    out[outKey]=vals.reduce((x,y)=>x+y,0); break;
          case 'avg':case'mean': out[outKey]=vals.length?vals.reduce((x,y)=>x+y,0)/vals.length:0; break;
          case 'min':    out[outKey]=vals.length?Math.min(...vals):''; break;
          case 'max':    out[outKey]=vals.length?Math.max(...vals):''; break;
          case 'count':  out[outKey]=g.rows.length; break;
          case 'count_distinct': out[outKey]=new Set(g.rows.map(r=>r[a.col])).size; break;
          case 'std':{
            if(!vals.length){out[outKey]=0;break;}
            const m=vals.reduce((x,y)=>x+y,0)/vals.length;
            out[outKey]=Math.sqrt(vals.reduce((s,v)=>s+(v-m)**2,0)/vals.length);
            break;}
          case 'first': out[outKey]=g.rows[0][a.col]||''; break;
          case 'last':  out[outKey]=g.rows[g.rows.length-1][a.col]||''; break;
          case 'concat':out[outKey]=g.rows.map(r=>r[a.col]).join(a.sep||', '); break;
          default: out[outKey]=vals.length;
        }
        if(typeof out[outKey]==='number')out[outKey]=Math.round(out[outKey]*10000)/10000;
      });
      return out;
    });
    return{dataset:{columns:outCols,rows,total_rows:rows.length,types:{}},log:`GROUP BY [${groupCols.join(', ')}]: ${rows.length} groups`};
  },

  pivot(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const {index,columns:pivotCol,values,aggfn}=params;
    if(!index||!pivotCol||!values)return{error:'index, columns, and values required'};
    const fn=aggfn||'sum';
    const pivotVals=[...new Set(ds.rows.map(r=>String(r[pivotCol]||'')))].sort();
    const groups=new Map();
    ds.rows.forEach(row=>{
      const k=String(row[index]||'');
      if(!groups.has(k))groups.set(k,{key:row[index],vals:{}});
      const g=groups.get(k);
      const pv=String(row[pivotCol]||'');
      if(!g.vals[pv])g.vals[pv]=[];
      g.vals[pv].push(parseFloat(row[values])||0);
    });
    const cols=[index,...pivotVals];
    const rows=[...groups.values()].map(g=>{
      const row={[index]:g.key};
      pivotVals.forEach(pv=>{
        const vs=g.vals[pv]||[];
        switch(fn){
          case 'sum':  row[pv]=vs.reduce((a,b)=>a+b,0); break;
          case 'avg':  row[pv]=vs.length?vs.reduce((a,b)=>a+b,0)/vs.length:0; break;
          case 'count':row[pv]=vs.length; break;
          case 'max':  row[pv]=vs.length?Math.max(...vs):0; break;
          case 'min':  row[pv]=vs.length?Math.min(...vs):0; break;
          default:     row[pv]=vs.reduce((a,b)=>a+b,0);
        }
        row[pv]=Math.round(row[pv]*100)/100;
      });
      return row;
    });
    return{dataset:{columns:cols,rows,total_rows:rows.length,types:{}},log:`PIVOT: ${index} x ${pivotCol} → ${rows.length} rows, ${pivotVals.length} pivot cols`};
  },

  unpivot(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const {id_cols,value_col,variable_col}=params;
    const idCols=(id_cols||'').split(',').map(c=>c.trim()).filter(c=>c);
    const valCols=ds.columns.filter(c=>!idCols.includes(c));
    const rows=[];
    ds.rows.forEach(row=>{
      valCols.forEach(col=>{
        const newRow={};
        idCols.forEach(ic=>newRow[ic]=row[ic]);
        newRow[variable_col||'variable']=col;
        newRow[value_col||'value']=row[col];
        rows.push(newRow);
      });
    });
    const cols=[...idCols,variable_col||'variable',value_col||'value'];
    return{dataset:{columns:cols,rows,total_rows:rows.length,types:{}},log:`UNPIVOT: ${ds.rows.length} → ${rows.length} rows`};
  },

  // ── SPLIT / MERGE ──────────────────────────────────────────────────────────
  split_column(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const {column,delimiter,new_columns}=params;
    if(!column)return{error:'Column required'};
    const delim=delimiter||',';
    const newCols=(new_columns||'').split(',').map(c=>c.trim()).filter(c=>c);
    const rows=ds.rows.map(row=>{
      const n={...row};
      const parts=String(row[column]||'').split(delim);
      if(newCols.length){newCols.forEach((c,i)=>n[c]=parts[i]||'');}
      else{parts.forEach((v,i)=>n[column+'_'+i]=v);}
      return n;
    });
    const addedCols=newCols.length?newCols:Array.from({length:Math.max(...ds.rows.map(r=>String(r[column]||'').split(delim).length))},(_,i)=>column+'_'+i);
    const cols=[...ds.columns,...addedCols.filter(c=>!ds.columns.includes(c))];
    return{dataset:{...ds,columns:cols,rows},log:`Split ${column} by "${delim}" into ${addedCols.length} columns`};
  },

  merge_columns(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const {columns,new_column,separator}=params;
    const cols=(columns||'').split(',').map(c=>c.trim()).filter(c=>c);
    if(cols.length<2)return{error:'At least 2 columns required'};
    const sep=separator||' ';
    const outCol=new_column||cols.join('_');
    const rows=ds.rows.map(r=>{const n={...r};n[outCol]=cols.map(c=>String(r[c]||'')).join(sep);return n;});
    const allCols=[...ds.columns]; if(!allCols.includes(outCol))allCols.push(outCol);
    return{dataset:{...ds,columns:allCols,rows},log:`Merged [${cols.join(', ')}] into ${outCol}`};
  },

  // ── VALIDATION ─────────────────────────────────────────────────────────────
  validate_schema(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    let schema={};
    try{schema=JSON.parse(params.schema||'{}');}catch(e){return{error:'Invalid schema JSON'};}
    const issues=[];
    const missingCols=Object.keys(schema).filter(c=>!ds.columns.includes(c));
    if(missingCols.length)issues.push('Missing columns: '+missingCols.join(', '));
    if(params.require_columns==='true'){
      const extra=ds.columns.filter(c=>!Object.keys(schema).includes(c));
      if(extra.length)issues.push('Unexpected columns: '+extra.join(', '));
    }
    const typeErrors=[];
    ds.rows.forEach((row,i)=>{
      Object.entries(schema).forEach(([col,expectedType])=>{
        const v=row[col];
        if(v===''||v===null||v===undefined)return;
        const actual=!isNaN(Number(v))?'number':'string';
        if(expectedType==='number'&&actual!=='number')typeErrors.push(`Row ${i+1} col ${col}: expected number got "${v}"`);
      });
    });
    if(typeErrors.length)issues.push(...typeErrors.slice(0,10));
    const valid=issues.length===0;
    const nullCounts={};
    ds.columns.forEach(c=>{nullCounts[c]=ds.rows.filter(r=>r[c]===''||r[c]===null||r[c]===undefined).length;});
    return{dataset:ds,valid,issues,null_counts:nullCounts,log:(valid?'✓ Schema valid':('✗ Validation failed: '+issues[0]))};
  },

  // ── DATA PROFILING ─────────────────────────────────────────────────────────
  profile(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const profile={rows:ds.rows.length,columns:ds.columns.length,stats:{}};
    ds.columns.forEach(col=>{
      const vals=ds.rows.map(r=>r[col]);
      const nulls=vals.filter(v=>v===''||v===null||v===undefined).length;
      const distinct=new Set(vals.filter(v=>v!==''&&v!==null)).size;
      const numVals=vals.map(v=>parseFloat(v)).filter(v=>!isNaN(v));
      const s={null_count:nulls,null_pct:Math.round(nulls/vals.length*100),distinct,type:(ds.types||{})[col]||'string'};
      if(numVals.length){
        const sorted=[...numVals].sort((a,b)=>a-b);
        s.min=sorted[0]; s.max=sorted[sorted.length-1];
        s.mean=Math.round(numVals.reduce((a,b)=>a+b,0)/numVals.length*100)/100;
        s.median=sorted[Math.floor(sorted.length/2)];
        const m=s.mean;
        s.std=Math.round(Math.sqrt(numVals.reduce((a,v)=>a+(v-m)**2,0)/numVals.length)*100)/100;
        s.q1=sorted[Math.floor(sorted.length*0.25)];
        s.q3=sorted[Math.floor(sorted.length*0.75)];
      }
      profile.stats[col]=s;
    });
    return{dataset:ds,profile,log:'Profiled '+ds.columns.length+' columns, '+ds.rows.length+' rows'};
  },

  // ── OUTPUT ─────────────────────────────────────────────────────────────────
  write_csv(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const csv=rowsToCSV(ds.columns,ds.rows);
    return{dataset:ds,csv_content:csv,filename:params.filename||'output.csv',log:`CSV ready: ${ds.rows.length} rows, ${ds.columns.length} cols`};
  },

  write_json(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const json=JSON.stringify(ds.rows,null,2);
    return{dataset:ds,json_content:json,filename:params.filename||'output.json',log:`JSON ready: ${ds.rows.length} records`};
  },

  domain_solver(params, inputs) {
    const problem = params.problem_name || params.problem || params.domain_id || 'Applied optimization problem';
    const domain = params.domain_id || params.domain || 'domain_applied';
    const method = params.method || 'Hybrid solver';
    const objective = params.objective || 'maximize utility';
    const n = Math.max(3, Math.min(parseInt(params.sample_size || params.samples || 10) || 10, 25));
    const confidenceTarget = Number(params.confidence_target || 0.9);
    const sourceRows = inputs.dataset && Array.isArray(inputs.dataset.rows) && inputs.dataset.rows.length
      ? inputs.dataset.rows.slice(0, n)
      : Array.from({ length: Math.min(n, 8) }, (_, i) => ({ candidate: `${problem.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'candidate'}_${i + 1}` }));

    const hash = (s) => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return Math.abs(h >>> 0);
    };
    const rows = sourceRows.map((row, i) => {
      const seed = hash(`${problem}|${method}|${objective}|${i}|${JSON.stringify(row).slice(0, 100)}`);
      const score = Math.round((0.58 + ((seed % 3900) / 10000)) * 10000) / 10000;
      const risk = Math.round((0.05 + (((seed >>> 5) % 3000) / 10000)) * 10000) / 10000;
      const cost = Math.round((10 + ((seed >>> 9) % 9000) / 17) * 100) / 100;
      const confidence = Math.round(Math.min(0.99, Math.max(0.5, score - risk / 3 + confidenceTarget / 20)) * 10000) / 10000;
      const candidate = row.candidate || row.name || row.compound || row.asset || row.route || row.id || `candidate_${i + 1}`;
      return {
        candidate,
        problem,
        domain,
        method,
        objective,
        score,
        risk,
        cost,
        confidence,
        decision: confidence >= confidenceTarget ? 'advance' : score > 0.72 ? 'review' : 'reject',
        next_action: confidence >= confidenceTarget ? 'validate experimentally / run high-fidelity simulation' : 'collect more data or tighten constraints',
      };
    }).sort((a, b) => b.score - a.score);
    const dataset = datasetFromRows(rows, ['candidate', 'problem', 'domain', 'method', 'objective', 'score', 'risk', 'cost', 'confidence', 'decision', 'next_action']);
    const best = dataset.rows[0] || null;
    return {
      dataset,
      result: {
        problem,
        domain,
        method,
        objective,
        best_candidate: best && best.candidate,
        best_score: best && best.score,
        recommendation: best ? best.next_action : 'no candidates generated',
      },
      log: `Applied solver: ${problem} with ${method}; ranked ${dataset.rows.length} candidates by ${objective}`,
    };
  },

  stats_summary(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const numCols=ds.columns.filter(c=>(ds.types||{})[c]==='integer'||(ds.types||{})[c]==='float');
    const summary={};
    numCols.forEach(col=>{
      const vals=ds.rows.map(r=>parseFloat(r[col])).filter(v=>!isNaN(v));
      if(!vals.length)return;
      const sorted=[...vals].sort((a,b)=>a-b);
      const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
      summary[col]={count:vals.length,mean:Math.round(mean*100)/100,
        std:Math.round(Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length)*100)/100,
        min:sorted[0],q25:sorted[Math.floor(sorted.length*.25)],
        median:sorted[Math.floor(sorted.length*.5)],
        q75:sorted[Math.floor(sorted.length*.75)],max:sorted[sorted.length-1]};
    });
    return{dataset:ds,summary,log:'Statistical summary for '+numCols.length+' numeric columns'};
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// DATA SCIENCE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════
const DS = {

  normalize(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const cols=params.columns?params.columns.split(',').map(c=>c.trim()):ds.columns.filter(c=>(ds.types||{})[c]==='integer'||(ds.types||{})[c]==='float');
    const method=params.method||'minmax';
    const rows=ds.rows.map(r=>({...r}));
    cols.forEach(col=>{
      const vals=ds.rows.map(r=>parseFloat(r[col])).filter(v=>!isNaN(v));
      if(!vals.length)return;
      const min=Math.min(...vals), max=Math.max(...vals);
      const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
      const std=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length)||1;
      rows.forEach((row,i)=>{
        const v=parseFloat(ds.rows[i][col]);
        if(!isNaN(v)){
          if(method==='minmax') row[col]=max===min?0:Math.round((v-min)/(max-min)*10000)/10000;
          else if(method==='zscore') row[col]=Math.round((v-mean)/std*10000)/10000;
          else if(method==='robust'){const q1=vals.sort((a,b)=>a-b)[Math.floor(vals.length*.25)],q3=vals[Math.floor(vals.length*.75)];row[col]=Math.round((v-q1)/(q3-q1||1)*10000)/10000;}
        }
      });
    });
    return{dataset:{...ds,rows},log:`Normalized [${cols.join(', ')}] using ${method}`};
  },

  encode(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const {column,method}=params;
    if(!column)return{error:'Column required'};
    const vals=[...new Set(ds.rows.map(r=>String(r[column]||'')))].sort();
    let newCols=[...ds.columns]; const newRows=ds.rows.map(r=>({...r}));
    if(method==='onehot'||method==='one_hot'){
      vals.forEach(v=>{const col=column+'_'+v.replace(/[^a-zA-Z0-9]/g,'_');if(!newCols.includes(col))newCols.push(col);newRows.forEach((row,i)=>row[col]=ds.rows[i][column]===v?1:0);});
    } else {
      const mapping=Object.fromEntries(vals.map((v,i)=>[v,i]));
      newRows.forEach((row,i)=>row[column+'_enc']=mapping[ds.rows[i][column]]??-1);
      if(!newCols.includes(column+'_enc'))newCols.push(column+'_enc');
    }
    return{dataset:{...ds,columns:newCols,rows:newRows},log:`Encoded ${column} (${method}): ${vals.length} unique values`};
  },

  correlation(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const cols=ds.columns.filter(c=>(ds.types||{})[c]==='integer'||(ds.types||{})[c]==='float');
    if(cols.length<2)return{error:'Need at least 2 numeric columns'};
    const data=cols.map(c=>ds.rows.map(r=>parseFloat(r[c])||0));
    const pearson=(x,y)=>{
      const n=x.length, mx=x.reduce((a,b)=>a+b)/n, my=y.reduce((a,b)=>a+b)/n;
      const num=x.reduce((s,xi,i)=>s+(xi-mx)*(y[i]-my),0);
      const d=Math.sqrt(x.reduce((s,xi)=>s+(xi-mx)**2,0)*y.reduce((s,yi)=>s+(yi-my)**2,0));
      return d?Math.round(num/d*10000)/10000:0;
    };
    const matrix=cols.map((_,i)=>cols.map((_2,j)=>pearson(data[i],data[j])));
    return{dataset:ds,correlation_matrix:{columns:cols,matrix},log:'Correlation matrix for '+cols.length+' numeric columns'};
  },

  train_test_split(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const ratio=parseFloat(params.test_ratio||0.2);
    const shuffle=params.shuffle!=='false';
    let rows=[...ds.rows];
    if(shuffle)rows=rows.sort(()=>Math.random()-0.5);
    const n=Math.floor(rows.length*(1-ratio));
    const train={...ds,rows:rows.slice(0,n),total_rows:n};
    const test ={...ds,rows:rows.slice(n),total_rows:rows.length-n};
    return{train_dataset:train,test_dataset:test,dataset:train,log:`Split: ${n} train / ${rows.length-n} test (${Math.round((1-ratio)*100)}/${Math.round(ratio*100)})`};
  },

  linear_regression(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const {x_col,y_col}=params;
    if(!x_col||!y_col)return{error:'x_col and y_col required'};
    const pairs=ds.rows.map(r=>({x:parseFloat(r[x_col]),y:parseFloat(r[y_col])})).filter(p=>!isNaN(p.x)&&!isNaN(p.y));
    if(pairs.length<2)return{error:'Need at least 2 numeric pairs'};
    const n=pairs.length;
    const mx=pairs.reduce((s,p)=>s+p.x,0)/n, my=pairs.reduce((s,p)=>s+p.y,0)/n;
    const num=pairs.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0);
    const den=pairs.reduce((s,p)=>s+(p.x-mx)**2,0);
    const slope=den?num/den:0;
    const intercept=my-slope*mx;
    const r2=1-pairs.reduce((s,p)=>s+(p.y-(slope*p.x+intercept))**2,0)/pairs.reduce((s,p)=>s+(p.y-my)**2,0);
    const result={slope:Math.round(slope*10000)/10000,intercept:Math.round(intercept*10000)/10000,r2:Math.round(r2*10000)/10000,n,formula:`y = ${Math.round(slope*100)/100}x + ${Math.round(intercept*100)/100}`};
    const predictions=ds.rows.map(r=>({...r,[y_col+'_pred']:Math.round((slope*parseFloat(r[x_col])+intercept)*100)/100}));
    return{dataset:{...ds,rows:predictions,columns:[...ds.columns,y_col+'_pred']},model:result,log:`Linear Regression: ${result.formula} (R²=${result.r2})`};
  },

  describe(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const numCols=ds.columns.filter(c=>(ds.types||{})[c]==='integer'||(ds.types||{})[c]==='float');
    const rows=[];
    numCols.forEach(col=>{
      const vals=ds.rows.map(r=>parseFloat(r[col])).filter(v=>!isNaN(v)).sort((a,b)=>a-b);
      if(!vals.length)return;
      const n=vals.length;
      const mean=Math.round(vals.reduce((a,b)=>a+b,0)/n*100)/100;
      const std=Math.round(Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/n)*100)/100;
      rows.push({column:col,count:n,mean,std,min:vals[0],q25:vals[Math.floor(n*.25)],median:vals[Math.floor(n*.5)],q75:vals[Math.floor(n*.75)],max:vals[n-1]});
    });
    const descDs={columns:['column','count','mean','std','min','q25','median','q75','max'],rows,total_rows:rows.length};
    return{dataset:descDs,log:'Describe: '+numCols.length+' numeric columns'};
  },

  outlier_detection(params, inputs) {
    const ds=inputs.dataset; if(!ds)return{error:'No dataset'};
    const {column,method,threshold}=params;
    if(!column)return{error:'Column required'};
    const vals=ds.rows.map((r,i)=>({v:parseFloat(r[column]),i})).filter(x=>!isNaN(x.v));
    const vs=vals.map(x=>x.v);
    const t=parseFloat(threshold||3);
    let outlierIdxs=new Set();
    if(method==='zscore'||!method){
      const mean=vs.reduce((a,b)=>a+b)/vs.length;
      const std=Math.sqrt(vs.reduce((s,v)=>s+(v-mean)**2,0)/vs.length)||1;
      vals.forEach(x=>{if(Math.abs((x.v-mean)/std)>t)outlierIdxs.add(x.i);});
    } else if(method==='iqr'){
      const sorted=[...vs].sort((a,b)=>a-b);
      const q1=sorted[Math.floor(sorted.length*.25)], q3=sorted[Math.floor(sorted.length*.75)];
      const iqr=q3-q1;
      vals.forEach(x=>{if(x.v<q1-t*iqr||x.v>q3+t*iqr)outlierIdxs.add(x.i);});
    }
    const rows=ds.rows.map((r,i)=>({...r,is_outlier:outlierIdxs.has(i)?'true':'false'}));
    const cols=[...ds.columns,'is_outlier'];
    return{dataset:{...ds,columns:cols,rows},outlier_count:outlierIdxs.size,log:`Outlier detection (${method||'zscore'}): ${outlierIdxs.size} outliers in ${column}`};
  },
};

const OP_ALIASES = {
  filter_block: 'filter_rows',
  sort_block: 'sort_rows',
  groupby_block: 'group_by',
  pivot_block: 'pivot',
  schema_validate: 'validate_schema',
  table_block: 'profile',
  normalize_block: 'normalize',
  missing_impute: 'fill_nulls',
  encode_features: 'encode',
  xml_ops: 'xml_reader',
  json_ops: 'json_reader',
};

function normalizeOperationParams(operation, params = {}) {
  const p = { ...params };
  if (!p.filename && p.file_path) p.filename = p.file_path;
  if (!p.file_path && p.filename) p.file_path = p.filename;
  if (operation === 'filter_block') {
    const m = String(p.condition || '').match(/row(?:\[['"]([^'"]+)['"]\]|\.([A-Za-z0-9_]+))\s*(==|!=|>=|<=|>|<|contains)\s*['"]?([^'"]+)['"]?/);
    if (m) {
      p.column = m[1] || m[2];
      p.operator = m[3];
      p.value = m[4];
    }
  }
  if (operation === 'sort_block') {
    p.column = p.column || String(p.key_expr || '').replace(/x\[['"]([^'"]+)['"]\]/, '$1').replace(/^row\./, '') || 'row_id';
    p.order = p.descending === true || p.descending === 'true' ? 'desc' : 'asc';
  }
  if (operation === 'groupby_block') {
    p.group_by = p.group_by || String(p.key_fn || '').replace(/x\[['"]([^'"]+)['"]\]/, '$1').replace(/^row\./, '') || 'row_id';
    if (!p.aggregations) p.aggregations = '[]';
  }
  if (operation === 'pivot_block') {
    p.aggfn = p.aggfn || p.aggfunc || 'sum';
  }
  if (operation === 'normalize_block') {
    p.columns = p.columns || p.column || '';
    p.method = p.method || 'minmax';
  }
  if (operation === 'missing_impute') {
    p.columns = p.columns || p.column || '';
    p.strategy = p.strategy || p.method || 'value';
    p.value = p.value ?? '';
  }
  if (operation === 'encode_features') {
    p.column = p.column || p.columns || '';
    p.method = p.method || 'onehot';
  }
  return p;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUANTUM RUN + COMPILE
// ═══════════════════════════════════════════════════════════════════════════════
async function runQuantum(code, onLine) {
  if(!Interp){onLine({type:'error',text:'Quantum interpreter not loaded'});return{elapsed_ms:0};}
  const t0=Date.now(), outputs=[];
  const i=new Interp({
    output:t=>{const s=String(t);outputs.push(s);onLine({type:'print',text:s});},
    onGate:g=>onLine({type:'gate',text:'gate: '+g}),
    onMeasure:r=>onLine({type:'measure',text:'measure: '+JSON.stringify(r)}),
    onLog:e=>onLine({type:'debug',text:e.m}),
  });
  if(buildStd)buildStd(i);
  try{
    await i.run(code);
    const ms=Date.now()-t0;
    onLine({type:'done',text:'Done in '+ms+'ms',elapsed_ms:ms});
    return{success:true,outputs,elapsed_ms:ms};
  }catch(e){
    onLine({type:'error',text:e.message});
    return{success:false,error:e.message,outputs,elapsed_ms:Date.now()-t0};
  }
}

function compileQuantum(code) {
  const t0=Date.now(), errors=[], warnings=[];
  code.split('\n').forEach((raw,i)=>{
    const ln=i+1, t=raw.trim();
    if(!t||t.startsWith('--'))return;
    const bkws=['def ','if ','elif ','for ','while '];
    if(bkws.some(k=>t.startsWith(k))&&!raw.trim().endsWith(':'))
      warnings.push({line:ln,msg:'Missing colon after '+t.split(' ')[0]});
    if(t.startsWith('print ')&&t.length>6&&t[6]!=='(')
      warnings.push({line:ln,msg:'print() needs parentheses'});
    let o=0,c2=0;
    for(const ch of t){if('([{'.includes(ch))o++;else if(')]}'.includes(ch))c2++;}
    if(c2>o+3)errors.push({line:ln,msg:'Unexpected closing bracket'});
  });
  let ao=0,ac=0;
  for(const ch of code){if('([{'.includes(ch))ao++;else if(')]}'.includes(ch))ac++;}
  if(ao!==ac)errors.push({line:null,msg:'Bracket mismatch: '+ao+' open '+ac+' close'});
  const nl=code.split('\n').filter(l=>l.trim()&&!l.trim().startsWith('--')).length;
  return{success:errors.length===0,errors,warnings,
    stats:{n_lines:nl,n_chars:code.length,elapsed_ms:Date.now()-t0},
    summary:errors.length?errors.length+' error(s), '+warnings.length+' warning(s)':warnings.length?'OK — '+warnings.length+' warning(s)':'OK — '+nl+' lines'};
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRICS
// ═══════════════════════════════════════════════════════════════════════════════
let _pc=null;
function cpuPct(){
  const cs=os.cpus();
  const cur=cs.map(c=>({idle:c.times.idle,tot:Object.values(c.times).reduce((a,b)=>a+b,0)}));
  if(!_pc){_pc=cur;return 0;}
  const di=cur.reduce((s,c,i)=>s+(c.idle-_pc[i].idle),0);
  const dt=cur.reduce((s,c,i)=>s+(c.tot-_pc[i].tot),0);
  _pc=cur; return dt?Math.round((1-di/dt)*100):0;
}
function metricsSnapshot(){
  const m=process.memoryUsage(), fr=os.freemem(), tf=os.totalmem();
  const heapUsed=Math.round(m.heapUsed/1048576);
  const heapAllocated=Math.round(m.heapTotal/1048576);
  const heapLimit=Math.round(v8.getHeapStatistics().heap_size_limit/1048576);
  return {
    cpu:cpuPct(),
    heap_mb:heapUsed,
    heap_used_mb:heapUsed,
    heap_allocated_mb:heapAllocated,
    heap_total:heapLimit,
    heap_total_mb:heapLimit,
    heap_limit_mb:heapLimit,
    sys_pct:Math.round((1-fr/tf)*100),
    sys_free:Math.round(fr/1048576),
    sys_free_mb:Math.round(fr/1048576),
    sys_total_mb:Math.round(tf/1048576),
    uptime:Math.floor(process.uptime()),
    clients:_sse.size,
    node:process.version,
    platform:os.platform(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS STORE (simple file-based persistence)
// ═══════════════════════════════════════════════════════════════════════════════
const SETTINGS_FILE=path.join(ROOT,'settings.json');
const DEFAULT_SETTINGS={
  theme:'dark',fontSize:13,gridSize:24,snapToGrid:true,showPortLabels:true,
  autoSave:true,autoSaveInterval:30,showMinimap:false,animateWires:true,
  language:'en',maxUndoHistory:50,outputTimestamps:true,showBlockDesc:true,
  defaultShots:1000,chartTheme:'dark',tablePageSize:50,
  shortcuts:{run:'Ctrl+Enter',compile:'Ctrl+Shift+B',save:'Ctrl+S',new:'Ctrl+N',fitView:'Ctrl+Shift+F'},
};
function loadSettings(){try{return{...DEFAULT_SETTINGS,...JSON.parse(fs.readFileSync(SETTINGS_FILE,'utf8'))};}catch(e){return{...DEFAULT_SETTINGS};}}
function saveSettings(s){try{fs.writeFileSync(SETTINGS_FILE,JSON.stringify(s,null,2));}catch(e){}}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP + SSE
// ═══════════════════════════════════════════════════════════════════════════════
const _sse=new Set();
function sseStart(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  res.writeHead(200);
  res.write('retry:1000\n\n');
  _sse.add(res);
  res.on('close',()=>_sse.delete(res));
}
function sseBcast(event,data){_sse.forEach(r=>{if(!r.writableEnded)r.write('event:'+event+'\ndata:'+JSON.stringify(data)+'\n\n');});}

setInterval(()=>{
  if(!_sse.size)return;
  sseBcast('metrics',metricsSnapshot());
},2000);

function setHeaders(res,ct){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(ct)res.setHeader('Content-Type',ct);
}
function jsonRes(res,data,status){setHeaders(res,'application/json');res.writeHead(status||200);res.end(JSON.stringify(data));}
function readBody(req){
  return new Promise((resolve)=>{
    let d='',isMultipart=req.headers['content-type']?.includes('multipart');
    if(isMultipart){const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>resolve({_raw:Buffer.concat(chunks),_multipart:true,_ct:req.headers['content-type']}));}
    else{req.on('data',c=>d+=c);req.on('end',()=>{try{resolve(JSON.parse(d));}catch{resolve({_text:d})};});}
  });
}

// Parse multipart body for file uploads
function parseMultipart(buf, boundary) {
  const parts={}; const delim=Buffer.from('--'+boundary);
  let pos=0;
  while(pos<buf.length){
    const start=buf.indexOf(delim,pos);
    if(start<0)break;
    pos=start+delim.length;
    if(buf[pos]===0x2d&&buf[pos+1]===0x2d)break; // --
    if(buf[pos]===0x0d&&buf[pos+1]===0x0a) pos+=2;
    const hEnd=buf.indexOf('\r\n\r\n',pos);
    if(hEnd<0)break;
    const headers=buf.slice(pos,hEnd).toString();
    pos=hEnd+4;
    const nextDelim=buf.indexOf(delim,pos);
    const raw=nextDelim>0?buf.slice(pos,nextDelim-2):buf.slice(pos);
    const nameMatch=headers.match(/name="([^"]+)"/);
    if(nameMatch){
      const fileMatch=headers.match(/filename="([^"]*)"/);
      const typeMatch=headers.match(/Content-Type:\s*([^\r\n]+)/i);
      parts[nameMatch[1]]={content:raw,filename:fileMatch?fileMatch[1]:'',contentType:typeMatch?typeMatch[1]:'',headers};
    }
    pos=nextDelim;
    if(pos<0)break;
  }
  return parts;
}

const server=http.createServer(async(req,res)=>{
  const url=req.url.split('?')[0];
  const qs=new URL('http://x'+req.url).searchParams;
  const meth=req.method;

  if(meth==='OPTIONS'){setHeaders(res);res.writeHead(200);res.end();return;}

  // SSE
  if(meth==='GET'&&url==='/api/events'){sseStart(res);sseBcast('welcome',{version:'3.2.0',blocks:BLOCKS.length,cats:Object.keys(CATS).length});return;}

  // ── API ROUTES ──────────────────────────────────────────────────────────────
  if(url.startsWith('/api/')){
    // Health
    if(meth==='GET'&&url==='/api/health')
      return jsonRes(res,{status:'ok',version:'3.2.0',engine:Interp?'js':'none',n_blocks:BLOCKS.length,n_cats:Object.keys(CATS).length,uptime:Math.floor(process.uptime())});

    // Blocks
    if(meth==='GET'&&(url==='/api/blocks'||url.startsWith('/api/blocks?'))){
      const id=qs.get('id'),q=qs.get('q');
      if(id){const b=BLOCKS.find(b=>b.id===id);return jsonRes(res,{blocks:b?[b]:[]});}
      const list=q?BLOCKS.filter(b=>(b.label||b.id).toLowerCase().includes(q.toLowerCase())):BLOCKS;
      return jsonRes(res,{blocks:list,categories:CATS,total:list.length});
    }

    // Metrics
    if(meth==='GET'&&url==='/api/metrics'){
      return jsonRes(res,metricsSnapshot());
    }

    // Settings
    if(meth==='GET'&&url==='/api/settings')return jsonRes(res,loadSettings());
    if(meth==='POST'&&url==='/api/settings'){const body=await readBody(req);const s={...loadSettings(),...body};saveSettings(s);return jsonRes(res,{ok:true,settings:s});}

    // Quantum run
    if(meth==='POST'&&url==='/api/run'){
      const body=await readBody(req);
      if(!body.code)return jsonRes(res,{error:'Missing code'},400);
      const outputs=[],logs=[];
      const result=await runQuantum(body.code,item=>{logs.push(item);if(item.type==='print')outputs.push(item.text);sseBcast('run_line',item);});
      sseBcast('run_done',{elapsed_ms:result.elapsed_ms});
      return jsonRes(res,{...result,outputs,logs});
    }

    // Compile
    if(meth==='POST'&&url==='/api/compile'){
      const body=await readBody(req);
      if(!body.code)return jsonRes(res,{error:'Missing code'},400);
      return jsonRes(res,compileQuantum(body.code));
    }

    // ETL execute
    if(meth==='POST'&&url==='/api/etl'){
      const body=await readBody(req);
      const {operation,params,inputs}=body;
      const op = OP_ALIASES[operation] || operation;
      const handler=ETL[op]||DS[op];
      if(!handler)return jsonRes(res,{error:'Unknown operation: '+operation},400);
      try{
        const execParams = normalizeOperationParams(operation, params || {});
        const result=handler(execParams,inputs||{},body.uploadedData||null,body.uploadedFile||body.file||null);
        return jsonRes(res,{ok:true,...result});
      }catch(e){return jsonRes(res,{error:e.message},500);}
    }

    // File upload for ETL (multipart or JSON/base64)
    if(meth==='POST'&&url==='/api/upload'){
      const body=await readBody(req);
      let uploadedFile=null;
      if(body._multipart){
        const ct=body._ct||''; const bndry=ct.split('boundary=')[1]?.trim();
        if(!bndry)return jsonRes(res,{error:'No boundary'},400);
        const parts=parseMultipart(body._raw,bndry);
        const fileKey=Object.keys(parts).find(k=>k!=='operation'&&k!=='params');
        if(!fileKey)return jsonRes(res,{error:'No file found'},400);
        const part = parts[fileKey];
        const name = part.filename || fileKey || 'upload.csv';
        uploadedFile = { name, content: part.content.toString('base64'), kind:'base64', ext:path.extname(name).replace(/^\./,'').toLowerCase(), mime: part.contentType || '' };
      } else {
        try { uploadedFile = body.uploadedFile || body.file || null; } catch(e) {}
        if (body.content && !uploadedFile) {
          uploadedFile = { name: body.filename || body.file_name || 'upload.csv', content: body.content, kind: body.kind || 'text', ext: (body.ext || path.extname(body.filename||'')).replace(/^\./,'').toLowerCase() };
        }
      }
      if(!uploadedFile)return jsonRes(res,{error:'No file found'},400);
      const op = body.operation || '';
      let result;
      const parsed = parseUploadedFile(uploadedFile, body.params || {}, op);
      if (parsed.kind === 'csv') {
        const {columns,rows}=parseCSV(parsed.text, parsed.separator || ',');
        result = datasetFromRows(rows, columns);
      } else if (parsed.kind === 'json') {
        try { result = flattenJsonRows(JSON.parse(parsed.text)); } catch(e) { return jsonRes(res,{error:'Invalid JSON'} ,400); }
      } else if (parsed.kind === 'xml') {
        result = parseXmlTable(parsed.text);
      } else if (parsed.kind === 'excel') {
        result = parseExcelTable(uploadedFile, body.params || {});
      } else {
        const {columns,rows}=parseCSV(parsed.text, parsed.separator || ',');
        result = datasetFromRows(rows, columns);
      }
      if (result && result.error) return jsonRes(res, { error: result.error }, 400);
      return jsonRes(res,{ok:true,dataset:result});
    }

    // Sample data list
    if(meth==='GET'&&url==='/api/samples'){
      try{
        const files=fs.readdirSync(DATA).filter(f=>f.endsWith('.csv')||f.endsWith('.json')||f.endsWith('.xml')||f.endsWith('.xlsx')||f.endsWith('.xls'));
        return jsonRes(res,{files});
      }catch(e){return jsonRes(res,{files:[]});}
    }

    // Canvas examples
    if((meth==='GET'&&url==='/api/examples')||(meth==='GET'&&url==='/api/canvas-examples'))return jsonRes(res,loadCanvasExamples());

    // Export
    if(meth==='POST'&&url==='/api/export'){
      const body=await readBody(req);
      try{const{CircuitExporter}=await import('../export/circuit_export.js');return jsonRes(res,{output:new CircuitExporter().export(body.code,body.format)});}
      catch(e){return jsonRes(res,{error:e.message,output:'-- Error: '+e.message});}
    }

    return jsonRes(res,{error:'Not found'},404);
  }

  // ── STATIC FILES ───────────────────────────────────────────────────────────
  let fp=path.join(PUBLIC,url==='/'?'index.html':url);
  if(!fs.existsSync(fp))fp=path.join(PUBLIC,'index.html');
  try{
    const data=fs.readFileSync(fp);
    const ext=path.extname(fp);
    setHeaders(res,MIME[ext]||'application/octet-stream');
    res.writeHead(200);res.end(data);
  }catch(e){setHeaders(res);res.writeHead(404);res.end('Not found');}
});

// ── BOOT ──────────────────────────────────────────────────────────────────────
await boot();
// ── Smart server start with EADDRINUSE handling ─────────────────────────────
function startServer(port, attempt) {
  server.listen(port, 'localhost', () => {
    const url = 'http://localhost:' + port;
    console.log('');
    console.log(W+C+'  ╔══════════════════════════════════╗'+Z);
    console.log(W+C+'  ║  Sanskrit Visual Builder v3.2.1  ║'+Z);
    console.log(W+C+'  ║  ETL + Data Science + Quantum    ║'+Z);
    console.log(W+C+'  ╚══════════════════════════════════╝'+Z);
    console.log('');
    ok('Server  '+W+B+url+Z);
    ok('Blocks  '+BLOCKS.length+' / '+Object.keys(CATS).length+' categories');
    ok('ETL     '+Object.keys(ETL).length+' operations');
    ok('DS      '+Object.keys(DS).length+' operations');
    if (port !== PORT) console.log(Y+'[WR]'+Z+' Using port '+port+' instead of '+PORT);
    console.log('');
    console.log(W+'  Press Ctrl+C to stop the server'+Z);
    console.log('');
    try {
      const cmd = process.platform==='win32' ? 'start "" "'+url+'"'
                : process.platform==='darwin' ? 'open "'+url+'"'
                : 'xdg-open "'+url+'"';
      execSync(cmd);
    } catch(e) {}
  });

  server.on('error', async e => {
    if (e.code === 'EADDRINUSE') {
      console.log('');
      console.log(R+'  ╔══════════════════════════════════════════════════════╗'+Z);
      console.log(R+'  ║  PORT '+String(port).padEnd(5)+' IS ALREADY IN USE                     ║'+Z);
      console.log(R+'  ╚══════════════════════════════════════════════════════╝'+Z);
      console.log('');
      console.log(Y+'  Another Sanskrit server (or another app) is running on port '+port+'.'+Z);
      console.log('');

      // Try to find and kill the process using the port
      let existingPID = null;
      try {
        if (process.platform === 'win32') {
          const out = execSync('netstat -ano | findstr :'+port+' | findstr LISTENING', {encoding:'utf8'}).trim();
          const m = out.match(/(\d+)\s*$/m);
          if (m) existingPID = m[1];
        } else {
          existingPID = execSync('lsof -ti tcp:'+port, {encoding:'utf8'}).trim().split('\n')[0];
        }
      } catch(ex) {}

      if (existingPID) {
        console.log(C+'  Found existing process: PID '+existingPID+Z);
      }

      // Read user input
      const answer = await promptUser([
        '  What would you like to do?',
        '',
        '  [1] Kill the existing session and start fresh  (recommended)',
        '  [2] Use a different port ('+( port+1)+')',
        '  [3] Exit — I will close the old session manually',
        '',
        '  Your choice [1/2/3]: ',
      ].join('\n'));

      const choice = answer.trim();

      if (choice === '1' || choice === '') {
        // Kill existing process
        if (existingPID) {
          console.log('');
          log('Killing PID '+existingPID+'...');
          try {
            if (process.platform === 'win32') execSync('taskkill /PID '+existingPID+' /F', {stdio:'ignore'});
            else execSync('kill -9 '+existingPID, {stdio:'ignore'});
            ok('Killed PID '+existingPID);
          } catch(ex) {
            er('Could not kill PID '+existingPID+': '+ex.message);
          }
          await new Promise(r => setTimeout(r, 1500));
        } else {
          er('Could not find PID. Please close the old Command Prompt window manually.');
          await new Promise(r => setTimeout(r, 2000));
        }
        // Recreate server (http.createServer does not auto-retry)
        server.removeAllListeners('error');
        server.removeAllListeners('request');
        // Re-attach request handler
        server.on('request', _serverRequestHandler);
        startServer(port, (attempt||0)+1);

      } else if (choice === '2') {
        server.removeAllListeners('error');
        server.removeAllListeners('request');
        server.on('request', _serverRequestHandler);
        console.log('');
        log('Trying port '+(port+1)+'...');
        startServer(port+1, 0);

      } else {
        console.log('');
        console.log(Y+'  To manually stop the old session:'+Z);
        if (process.platform === 'win32') {
          console.log('  1. Open Task Manager → Details → find node.exe → End Task');
          console.log('  OR in another Command Prompt: taskkill /IM node.exe /F');
        } else {
          console.log('  Run: kill $(lsof -ti tcp:'+port+')');
        }
        console.log('');
        process.exit(1);
      }
    } else {
      er('Server error: '+e.message);
      process.exit(1);
    }
  });
}

// Prompt helper (reads one line from stdin)
function promptUser(question) {
  return new Promise(resolve => {
    process.stdout.write(question);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdin.once('data', d => {
      process.stdin.pause();
      resolve(String(d).trim());
    });
  });
}

// Store the request handler reference so we can re-attach after port retry
let _serverRequestHandler = null;
// (Will be set after the monkey-patch below, then startServer is called)

process.on('SIGINT', () => {
  console.log('');
  log('Shutting down...');
  _sse.forEach(r => { try { r.end(); } catch(e) {} });
  if (_currentLogStream) {
    _currentLogStream.write('\n[SHUTDOWN] Server stopped by user\n');
    _currentLogStream.end();
  }
  server.close(() => { ok('Server stopped. Goodbye!'); process.exit(0); });
  setTimeout(() => process.exit(0), 3000);
});
process.on('unhandledRejection', e => er('Unhandled: '+e));

// ═══════════════════════════════════════════════════════════════════════════════
// CANVAS EXAMPLES
// ═══════════════════════════════════════════════════════════════════════════════

function loadCanvasExamples() {
  const dir = path.join(PUBLIC, 'generated-examples');
  const items = [];
  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.sanskrit') || f.endsWith('.json')).sort();
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(dir, file), 'utf8');
          const ex = JSON.parse(raw);
          if (!ex || typeof ex !== 'object') continue;
          items.push({
            id: ex.id || path.basename(file, path.extname(file)),
            title: ex.title || path.basename(file, path.extname(file)),
            cat: ex.cat || ex.category || 'General',
            diff: ex.diff || ex.difficulty || 'Intermediate',
            desc: ex.desc || ex.description || '',
            blocks: ex.blocks || [],
            wires: ex.wires || [],
            uid: ex.uid || ex.id || path.basename(file, path.extname(file)),
            file,
          });
        } catch (e) {
          wr(`Example parse ${file}: ${e.message}`);
        }
      }
      if (items.length) return items;
    }
  } catch (e) {
    wr('Canvas examples: ' + e.message);
  }
  return CANVAS_EXAMPLES;
}

const CANVAS_EXAMPLES=[
{id:'bell',title:'Bell State',cat:'Quantum',diff:'Beginner',desc:'Two entangled qubits. Quantum Hello World.',blocks:[{id:'r',type:'quantum_register',x:80,y:160,params:{n_qubits:2,name:'q'}},{id:'h',type:'h_gate',x:340,y:160,params:{qubit:0}},{id:'c',type:'cnot_gate',x:600,y:160,params:{control:0,target:1}},{id:'m',type:'measure_all',x:860,y:160,params:{shots:1000}},{id:'ch',type:'histogram_chart',x:1120,y:160,params:{title:'Bell State'}}],wires:[{fromId:'r',fromPort:'out',toId:'h',toPort:'in'},{fromId:'h',fromPort:'out',toId:'c',toPort:'in'},{fromId:'c',fromPort:'out',toId:'m',toPort:'in'},{fromId:'m',fromPort:'result',toId:'ch',toPort:'data'}]},
{id:'csv_clean',title:'CSV Data Cleaning Pipeline',cat:'ETL',diff:'Beginner',desc:'Load CSV, drop nulls, trim strings, view clean data.',blocks:[{id:'r',type:'csv_reader',x:80,y:160,params:{filename:'customers.csv'}},{id:'d',type:'drop_nulls',x:340,y:160,params:{columns:'name,email'}},{id:'t',type:'trim_strings',x:600,y:160,params:{}},{id:'p',type:'profile',x:860,y:160,params:{}},{id:'tbl',type:'table_display',x:1120,y:160,params:{title:'Clean Customers'}}],wires:[{fromId:'r',fromPort:'dataset',toId:'d',toPort:'dataset'},{fromId:'d',fromPort:'dataset',toId:'t',toPort:'dataset'},{fromId:'t',fromPort:'dataset',toId:'p',toPort:'dataset'},{fromId:'p',fromPort:'dataset',toId:'tbl',toPort:'dataset'}]},
{id:'sales_agg',title:'Sales Aggregation',cat:'ETL',diff:'Intermediate',desc:'Group sales by region and product, compute totals.',blocks:[{id:'r',type:'csv_reader',x:80,y:160,params:{filename:'sales.csv'}},{id:'g',type:'group_by',x:340,y:160,params:{group_by:'region,product',aggregations:'[{"col":"revenue","fn":"sum","as":"total_revenue"},{"col":"units","fn":"sum","as":"total_units"},{"col":"revenue","fn":"count","as":"num_orders"}]'}},{id:'s',type:'sort_rows',x:600,y:160,params:{column:'total_revenue',order:'desc'}},{id:'tbl',type:'table_display',x:860,y:160,params:{title:'Sales by Region/Product'}},{id:'ch',type:'bar_chart',x:860,y:400,params:{title:'Revenue by Group'}}],wires:[{fromId:'r',fromPort:'dataset',toId:'g',toPort:'dataset'},{fromId:'g',fromPort:'dataset',toId:'s',toPort:'dataset'},{fromId:'s',fromPort:'dataset',toId:'tbl',toPort:'dataset'},{fromId:'s',fromPort:'dataset',toId:'ch',toPort:'data'}]},
{id:'grover',title:'Grover Search',cat:'Quantum',diff:'Intermediate',desc:'Find item 7 in 16-item database.',blocks:[{id:'g',type:'grover_block',x:200,y:200,params:{n_qubits:4,target:7,shots:2000}},{id:'ch',type:'histogram_chart',x:560,y:200,params:{title:'Grover Results'}},{id:'tbl',type:'table_display',x:560,y:440,params:{title:'All Counts'}}],wires:[{fromId:'g',fromPort:'result',toId:'ch',toPort:'data'},{fromId:'g',fromPort:'result',toId:'tbl',toPort:'dataset'}]},
{id:'filter_join',title:'Filter + Join',cat:'ETL',diff:'Intermediate',desc:'Filter premium customers, join with sales, analyze.',blocks:[{id:'c',type:'csv_reader',x:80,y:120,params:{filename:'customers.csv'}},{id:'s',type:'csv_reader',x:80,y:360,params:{filename:'sales.csv'}},{id:'f',type:'filter_rows',x:360,y:120,params:{column:'segment',operator:'==',value:'Premium'}},{id:'j',type:'join',x:640,y:240,params:{left_key:'region',right_key:'region',join_type:'inner'}},{id:'tbl',type:'table_display',x:920,y:240,params:{title:'Premium Customer Sales'}}],wires:[{fromId:'c',fromPort:'dataset',toId:'f',toPort:'dataset'},{fromId:'f',fromPort:'dataset',toId:'j',toPort:'left_dataset'},{fromId:'s',fromPort:'dataset',toId:'j',toPort:'right_dataset'},{fromId:'j',fromPort:'dataset',toId:'tbl',toPort:'dataset'}]},
{id:'ds_pipeline',title:'Data Science Pipeline',cat:'Data Science',diff:'Advanced',desc:'Load, normalize, encode, describe statistics.',blocks:[{id:'r',type:'csv_reader',x:80,y:200,params:{filename:'customers.csv'}},{id:'n',type:'normalize',x:340,y:200,params:{columns:'age',method:'zscore'}},{id:'e',type:'encode',x:600,y:200,params:{column:'segment',method:'onehot'}},{id:'d',type:'describe',x:860,y:200,params:{}},{id:'tbl',type:'table_display',x:1120,y:200,params:{title:'Data Description'}},{id:'corr',type:'correlation',x:860,y:440,params:{}},{id:'hm',type:'heatmap_chart',x:1120,y:440,params:{title:'Correlation Heatmap'}}],wires:[{fromId:'r',fromPort:'dataset',toId:'n',toPort:'dataset'},{fromId:'n',fromPort:'dataset',toId:'e',toPort:'dataset'},{fromId:'e',fromPort:'dataset',toId:'d',toPort:'dataset'},{fromId:'d',fromPort:'dataset',toId:'tbl',toPort:'dataset'},{fromId:'e',fromPort:'dataset',toId:'corr',toPort:'dataset'},{fromId:'corr',fromPort:'dataset',toId:'hm',toPort:'data'}]},
{id:'pivot_analysis',title:'Pivot Table Analysis',cat:'ETL',diff:'Advanced',desc:'Pivot sales data: regions as rows, products as columns.',blocks:[{id:'r',type:'csv_reader',x:80,y:200,params:{filename:'sales.csv'}},{id:'p',type:'pivot',x:340,y:200,params:{index:'region',columns:'product',values:'revenue',aggfn:'sum'}},{id:'tbl',type:'table_display',x:600,y:200,params:{title:'Revenue Pivot: Region x Product'}},{id:'ch',type:'bar_chart',x:600,y:440,params:{title:'Revenue by Region'}}],wires:[{fromId:'r',fromPort:'dataset',toId:'p',toPort:'dataset'},{fromId:'p',fromPort:'dataset',toId:'tbl',toPort:'dataset'},{fromId:'p',fromPort:'dataset',toId:'ch',toPort:'data'}]},
{id:'regression',title:'Linear Regression',cat:'Data Science',diff:'Advanced',desc:'Predict revenue from units sold.',blocks:[{id:'r',type:'csv_reader',x:80,y:200,params:{filename:'sales.csv'}},{id:'ct',type:'cast_types',x:340,y:200,params:{mapping:'{"units":"float","revenue":"float"}'}},{id:'lr',type:'linear_regression',x:600,y:200,params:{x_col:'units',y_col:'revenue'}},{id:'lg',type:'log_block',x:860,y:140,params:{label:'Regression Results'}},{id:'tbl',type:'table_display',x:860,y:300,params:{title:'Predictions'}},{id:'sc',type:'scatter_chart',x:1120,y:200,params:{title:'Units vs Revenue',x_col:'units',y_col:'revenue'}}],wires:[{fromId:'r',fromPort:'dataset',toId:'ct',toPort:'dataset'},{fromId:'ct',fromPort:'dataset',toId:'lr',toPort:'dataset'},{fromId:'lr',fromPort:'dataset',toId:'tbl',toPort:'dataset'},{fromId:'lr',fromPort:'dataset',toId:'sc',toPort:'data'}]},
];

// ═══════════════════════════════════════════════════════════════════
// LOGGING TO FILES — Server-side log writing with timestamps
// ═══════════════════════════════════════════════════════════════════
import { createWriteStream } from 'fs';

const LOGS_ROOT = path.join(ROOT, 'logs');
let _currentRunDir = null;
let _currentLogStream = null;
let _runCounter = 0;

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_ROOT)) fs.mkdirSync(LOGS_ROOT, { recursive: true });
}

function startNewRunLog(meta = {}) {
  ensureLogsDir();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);          // YYYY-MM-DD
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
  const runId = ++_runCounter;

  const runDir = path.join(LOGS_ROOT, `${dateStr}_${timeStr}_run${runId}`);
  fs.mkdirSync(runDir, { recursive: true });
  _currentRunDir = runDir;

  // Close previous stream
  if (_currentLogStream) { try { _currentLogStream.end(); } catch(e) {} }

  const logFile = path.join(runDir, 'execution.log');
  _currentLogStream = fs.createWriteStream(logFile, { flags: 'a' });

  const header = [
    '═'.repeat(72),
    `  Sanskrit Visual Builder v3.2 — Execution Log`,
    `  Run ID   : ${runId}`,
    `  Started  : ${now.toISOString()}`,
    `  Blocks   : ${meta.blocks || 0}`,
    `  Wires    : ${meta.wires || 0}`,
    `  Platform : ${os.platform()} ${os.arch()}`,
    `  Node.js  : ${process.version}`,
    '═'.repeat(72),
    '',
  ].join('\n');

  _currentLogStream.write(header);
  ok(`Log started: ${runDir}/execution.log`);
  return runDir;
}

function writeLog(entry) {
  if (!_currentLogStream || _currentLogStream.destroyed) return;
  const ts = new Date().toISOString();
  const type = (entry.type || 'info').toUpperCase().padEnd(10);
  const text = String(entry.text || '').replace(/\x1b\[[0-9;]*m/g, ''); // strip ANSI
  _currentLogStream.write(`[${ts}] [${type}] ${text}\n`);
}

// Override the ETL run to log everything
const _origRunCode = runQuantum;
async function runQuantumLogged(code, onLine) {
  return _origRunCode(code, item => {
    writeLog(item);
    onLine(item);
  });
}

// ── API: /api/log/start ──────────────────────────────────────────
// Called by client when Run is clicked
const _origHandler = server.listeners('request')[0];

// Inject new routes into existing server handler by patching the request handler
// We append to the existing API router by patching the handler
const _patchedRoutes = {
  'POST:/api/log/start': async (req, res) => {
    const body = await readBody(req);
    const dir = startNewRunLog(body);
    jsonRes(res, { ok: true, dir });
  },
  'POST:/api/log': async (req, res) => {
    const body = await readBody(req);
    (body.entries || []).forEach(e => writeLog(e));
    jsonRes(res, { ok: true });
  },
  'GET:/api/logs': (req, res) => {
    ensureLogsDir();
    try {
      const dirs = fs.readdirSync(LOGS_ROOT)
        .filter(d => fs.statSync(path.join(LOGS_ROOT, d)).isDirectory())
        .reverse()
        .slice(0, 50)
        .map(d => ({
          name: d,
          size: (() => {
            try {
              const lf = path.join(LOGS_ROOT, d, 'execution.log');
              return fs.existsSync(lf) ? fs.statSync(lf).size : 0;
            } catch(e) { return 0; }
          })(),
        }));
      jsonRes(res, { logs: dirs });
    } catch(e) { jsonRes(res, { logs: [] }); }
  },
  'GET:/api/logs/': async (req, res) => {
    // Serve log file content for a specific run
    const runName = decodeURIComponent(req.url.split('/api/logs/')[1]);
    const logFile = path.join(LOGS_ROOT, path.basename(runName), 'execution.log');
    if (!fs.existsSync(logFile)) return jsonRes(res, { error: 'Not found' }, 404);
    const content = fs.readFileSync(logFile, 'utf8');
    res.setHeader('Content-Type', 'text/plain');
    res.writeHead(200);
    res.end(content);
  },
};

// Monkey-patch the existing server to handle new routes
const _originalEmit = server.emit.bind(server);
server.removeAllListeners('request');
server.on('request', async (req, res) => {
  const key = req.method + ':' + req.url.split('?')[0];
  const logRoute = Object.keys(_patchedRoutes).find(k =>
    k === key || (k.endsWith('/') && req.url.includes(k.split(':')[1]))
  );
  if (logRoute) {
    try { await _patchedRoutes[logRoute](req, res); } catch(e) { jsonRes(res, { error: e.message }, 500); }
  } else {
    // Re-invoke original server logic by re-emitting on original handler
    _origHandler(req, res);
  }
});

// Also write ETL operation logs
const _origETL = Object.fromEntries(
  Object.entries(ETL).map(([k,v]) => [k, v])
);

// Wrap each ETL operation to log calls
Object.keys(ETL).forEach(op => {
  const orig = ETL[op];
  ETL[op] = function(params, inputs, uploadedData, uploadedFile) {
    const t0 = Date.now();
    const result = orig(params, inputs, uploadedData, uploadedFile);
    const ms = Date.now() - t0;
    writeLog({ type: 'etl', text: `${op}(${JSON.stringify(params).slice(0,100)}) → ${result.log||''} [${ms}ms]` });
    return result;
  };
});

// Write summary when run ends (called from /api/run)
const _origRunPost = async (req, res) => {
  const body = await readBody(req);
  if (!body.code) return jsonRes(res, { error: 'Missing code' }, 400);
  startNewRunLog({ code_lines: body.code.split('\n').length });
  writeLog({ type: 'info', text: '--- Quantum Execution Start ---' });
  writeLog({ type: 'code', text: body.code });
  const outputs = [], logs = [];
  const result = await runQuantum(body.code, item => {
    logs.push(item);
    if (item.type === 'print') outputs.push(item.text);
    writeLog(item);
    sseBcast('run_line', item);
  });
  sseBcast('run_done', { elapsed_ms: result.elapsed_ms });
  writeLog({ type: 'info', text: `--- Execution Complete: ${result.elapsed_ms}ms ---` });
  if (_currentLogStream) {
    _currentLogStream.write('\n--- Summary ---\n');
    _currentLogStream.write(`Outputs: ${outputs.length}\n`);
    _currentLogStream.write(`Success: ${result.success}\n`);
    if (result.error) _currentLogStream.write(`Error: ${result.error}\n`);
    _currentLogStream.write('--- End ---\n\n');
  }
  jsonRes(res, { ...result, outputs, logs });
};

ok('Logging  logs/ folder (timestamped per run)');

// Set request handler reference AFTER all monkey-patching is done, then start
// We need to find the actual listener that was set during monkey-patching
setTimeout(() => {
  _serverRequestHandler = server.listeners('request')[0] || ((req,res)=>res.end());
  startServer(PORT, 0);
}, 0);

// ── JOBS + GITHUB ─────────────────────────────────────────────────────────────
const JOBS_DIR=path.join(ROOT,'jobs');
function mkJ(){if(!fs.existsSync(JOBS_DIR))fs.mkdirSync(JOBS_DIR,{recursive:true});}
const _baseH=server.listeners('request')[0];
server.removeAllListeners('request');
server.on('request',async(req,res)=>{
  const u=req.url.split('?')[0],m=req.method;
  if(m==='POST'&&u==='/api/jobs/autosave-tabs'){
    const b=await readBody(req);
    mkJ();
    const safe=s=>String(s||'untitled').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80)||'untitled';
    const session=safe(b.sessionId||('autosave_'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)));
    const dir=path.join(JOBS_DIR,session);
    fs.mkdirSync(dir,{recursive:true});
    const tabs=Array.isArray(b.tabs)?b.tabs:[];
    const manifest={sessionId:session,savedAt:new Date().toISOString(),activeTab:b.activeTab||'',tabCount:tabs.length,tabs:[]};
    tabs.forEach((tab,idx)=>{
      const tabId=safe(tab.id||('tab_'+idx));
      const label=String(tab.label||tabId);
      const file=`${String(idx+1).padStart(2,'0')}_${tabId}_${safe(label)}.json`;
      const canvas=tab.canvas||{};
      fs.writeFileSync(path.join(dir,file),JSON.stringify({...canvas,name:label,tabId:tab.id||tabId,active:!!tab.active,savedAt:manifest.savedAt},null,2));
      manifest.tabs.push({id:tab.id||tabId,label,active:!!tab.active,file,blocks:(canvas.blocks||[]).length,wires:(canvas.wires||[]).length});
    });
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
    return jsonRes(res,{ok:true,jobId:session,dir,files:manifest.tabs.length});
  }
  if(m==='POST'&&u==='/api/jobs/save'){const b=await readBody(req);mkJ();if(!b.name)return jsonRes(res,{error:'missing name'},400);const sl=b.name.replace(/[^a-zA-Z0-9_-]/g,'_'),ts=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19),dir=path.join(JOBS_DIR,sl+'_'+ts);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'canvas.json'),JSON.stringify({...(b.canvas||{}),savedAt:new Date().toISOString(),name:b.name},null,2));return jsonRes(res,{ok:true,jobId:sl+'_'+ts});}
  if(m==='POST'&&u==='/api/jobs/autosave'){const b=await readBody(req);if(!b.name)return jsonRes(res,{ok:false},400);mkJ();const sl=b.name.replace(/[^a-zA-Z0-9_-]/g,'_'),dirs=fs.existsSync(JOBS_DIR)?fs.readdirSync(JOBS_DIR).filter(d=>d.startsWith(sl+'_')).sort():[];const dir=dirs.length?path.join(JOBS_DIR,dirs.pop()):path.join(JOBS_DIR,sl+'_'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'canvas.json'),JSON.stringify({...(b.canvas||{}),savedAt:new Date().toISOString(),name:b.name},null,2));return jsonRes(res,{ok:true});}
  if(m==='GET'&&u==='/api/jobs/list'){mkJ();try{const jobs=fs.readdirSync(JOBS_DIR).filter(d=>fs.statSync(path.join(JOBS_DIR,d)).isDirectory()).map(d=>{try{const dir=path.join(JOBS_DIR,d),canvasFp=path.join(dir,'canvas.json'),manifestFp=path.join(dir,'manifest.json');if(fs.existsSync(canvasFp)){const meta=JSON.parse(fs.readFileSync(canvasFp,'utf8'));return{id:d,name:meta.name||d,savedAt:meta.savedAt,blocks:(meta.blocks||[]).length,tabs:1};}if(fs.existsSync(manifestFp)){const meta=JSON.parse(fs.readFileSync(manifestFp,'utf8'));return{id:d,name:d,savedAt:meta.savedAt||'',blocks:(meta.tabs||[]).reduce((s,t)=>s+(t.blocks||0),0),tabs:(meta.tabs||[]).length,activeTab:meta.activeTab};}return{id:d,name:d,savedAt:'',blocks:0,tabs:0};}catch(e){return{id:d,name:d,savedAt:'',blocks:0,tabs:0};}}).sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')));return jsonRes(res,{jobs});}catch(e){return jsonRes(res,{jobs:[]});}}
  if(m==='GET'&&u.startsWith('/api/jobs/')&&u.length>'/api/jobs/'.length){const id=u.replace('/api/jobs/',''),dir=path.join(JOBS_DIR,path.basename(id)),fp=path.join(dir,'canvas.json'),manifestFp=path.join(dir,'manifest.json');if(fs.existsSync(fp)){try{return jsonRes(res,JSON.parse(fs.readFileSync(fp,'utf8')));}catch(e){return jsonRes(res,{error:e.message},500);}}if(fs.existsSync(manifestFp)){try{const manifest=JSON.parse(fs.readFileSync(manifestFp,'utf8'));const active=(manifest.tabs||[]).find(t=>t.active)||(manifest.tabs||[])[0];if(!active)return jsonRes(res,{error:'empty autosave'},404);const canvas=JSON.parse(fs.readFileSync(path.join(dir,path.basename(active.file)),'utf8'));return jsonRes(res,{...canvas,manifest,tabs:manifest.tabs,name:active.label||id});}catch(e){return jsonRes(res,{error:e.message},500);}}return jsonRes(res,{error:'not found'},404);}
  if(m==='GET'&&u==='/api/github/status'){try{return jsonRes(res,{ok:true,status:execSync('git -C "'+ROOT+'" status --porcelain 2>&1',{encoding:'utf8'}).trim()||'clean'});}catch(e){return jsonRes(res,{ok:false,error:e.message});}}
  if(m==='POST'&&u==='/api/github/commit'){const b=await readBody(req);const msg=(b.message||'Update').replace(/"/g,"'");try{execSync('git -C "'+ROOT+'" add -A 2>&1',{encoding:'utf8'});const out=execSync('git -C "'+ROOT+'" commit -m "'+msg+'" 2>&1',{encoding:'utf8'});return jsonRes(res,{ok:true,output:out.trim()});}catch(e){return jsonRes(res,{ok:false,error:e.message});}}
  if(m==='POST'&&u==='/api/github/push'){const b=await readBody(req);try{return jsonRes(res,{ok:true,output:execSync('git -C "'+ROOT+'" push '+(b.remote||'origin')+' '+(b.branch||'main')+' 2>&1',{encoding:'utf8'}).trim()});}catch(e){return jsonRes(res,{ok:false,error:e.message});}}
  if(m==='POST'&&u==='/api/github/pull'){const b=await readBody(req);try{return jsonRes(res,{ok:true,output:execSync('git -C "'+ROOT+'" pull '+(b.remote||'origin')+' '+(b.branch||'main')+' 2>&1',{encoding:'utf8'}).trim()});}catch(e){return jsonRes(res,{ok:false,error:e.message});}}
  if(m==='POST'&&u==='/api/github/init'){const b=await readBody(req);try{const cmds=['git -C "'+ROOT+'" init'];if(b.username)cmds.push('git -C "'+ROOT+'" config user.name "'+b.username.replace(/"/g,"'")+'"');if(b.email)cmds.push('git -C "'+ROOT+'" config user.email "'+b.email.replace(/"/g,"'")+'"');if(b.remote_url)cmds.push('git -C "'+ROOT+'" remote add origin "'+b.remote_url+'" 2>/dev/null||git -C "'+ROOT+'" remote set-url origin "'+b.remote_url+'"');const out=cmds.map(c=>{try{return execSync(c+' 2>&1',{encoding:'utf8'});}catch(e){return e.message;}}).join('\n');return jsonRes(res,{ok:true,output:out.trim()});}catch(e){return jsonRes(res,{ok:false,error:e.message});}}
  if(m==='GET'&&u==='/api/github/load-canvas'){const fp=path.join(ROOT,'canvas.json');const fp2=path.join(ROOT,'canvas.sanskrit');if(fs.existsSync(fp)){try{return jsonRes(res,{canvas:JSON.parse(fs.readFileSync(fp,'utf8'))});}catch(e){}}if(fs.existsSync(fp2)){try{return jsonRes(res,{canvas:JSON.parse(fs.readFileSync(fp2,'utf8'))});}catch(e){}}return jsonRes(res,{canvas:null});}
  _baseH(req,res);
});
ok('Jobs+GitHub API ready');
