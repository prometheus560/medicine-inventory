export const DEMO = import.meta.env.VITE_DEMO === 'true';

const real = async (url, opts) => {
  const r = await fetch(url, opts && { ...opts, headers: { 'Content-Type': 'application/json' } });
  if (r.status === 401 && !url.endsWith('/login')) window.dispatchEvent(new Event('signed-out'));
  if (!r.ok) throw new Error((await r.json()).error || 'Request failed');
  return r.status === 204 ? null : r.json();
};

/* Demo mode (GitHub Pages): same API, data kept in the browser */
const KEY = 'medstock-react-demo';
const iso = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const write = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ } };

function read() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) return d; } catch { /* ignore */ }
  const m = (id, name, category, unit, quantity, batch_no, days, reorder_level, supplier) =>
    ({ id, name, category, unit, quantity, batch_no, expiry_date: iso(days), reorder_level, supplier, remarks: '' });
  const meds = [
    m(1, 'Paracetamol 500mg', 'Analgesic', 'tablet', 200, 'PCM-101', 400, 20, 'MediSupply'),
    m(2, 'Amoxicillin 500mg', 'Antibiotic', 'capsule', 6, 'AMX-220', 200, 10, 'PharmaCare'),
    m(3, 'Cetirizine 10mg', 'Antihistamine', 'tablet', 80, 'CTZ-045', 15, 10, 'MediSupply'),
    m(4, 'Ibuprofen 200mg', 'Analgesic', 'tablet', 60, 'IBU-377', -10, 10, 'PharmaCare'),
    m(5, 'Povidone-iodine', 'First aid', 'bottle', 25, 'PVI-009', 300, 5, 'MediSupply')
  ];
  const d = { meds, txs: meds.map(x => ({ id: x.id, medicine_id: x.id, medicine_name: x.name, type: 'IN', quantity: x.quantity, note: 'Initial stock', created_at: now() })).reverse() };
  write(d);
  return d;
}

function validate(b) {
  const s = k => String(b[k] ?? '').trim();
  const quantity = Number(b.quantity);
  const reorder_level = b.reorder_level === '' || b.reorder_level == null ? 10 : Number(b.reorder_level);
  if (!s('name') || !s('category') || !s('unit')) throw new Error('Name, category and unit are required.');
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Quantity must be a whole number ≥ 0.');
  if (!Number.isInteger(reorder_level) || reorder_level < 0) throw new Error('Reorder level must be a whole number ≥ 0.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s('expiry_date'))) throw new Error('Expiry date is required.');
  return { name: s('name'), category: s('category'), unit: s('unit'), quantity, reorder_level, batch_no: s('batch_no'), expiry_date: s('expiry_date'), supplier: s('supplier'), remarks: s('remarks') };
}

const demo = async (url, opts = {}) => {
  const method = opts.method || 'GET', d = read(), body = opts.body ? JSON.parse(opts.body) : {};
  const [, , res, id, sub] = url.split('/');
  const log = (m, type, quantity, note) => d.txs.unshift({ id: Math.max(0, ...d.txs.map(t => t.id)) + 1, medicine_id: m.id, medicine_name: m.name, type, quantity, note, created_at: now() });

  if (res === 'me' || res === 'login') return { user: 'Demo' };
  if (res === 'logout') return null;

  if (res === 'stats') {
    const t = iso(0), s = iso(30), by = {};
    d.meds.forEach(x => { by[x.category] = (by[x.category] || 0) + 1; });
    return {
      medicines: d.meds.length,
      units: d.meds.reduce((a, x) => a + x.quantity, 0),
      lowStock: d.meds.filter(x => x.quantity <= x.reorder_level).length,
      expired: d.meds.filter(x => x.expiry_date < t).length,
      expiringSoon: d.meds.filter(x => x.expiry_date >= t && x.expiry_date <= s).length,
      byCategory: Object.entries(by).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count)
    };
  }
  if (res === 'transactions') return d.txs.slice(0, 100);

  const m = d.meds.find(x => x.id === Number(id));
  if (sub === 'stock') {
    if (!m) throw new Error('Medicine not found.');
    const qty = Number(body.quantity);
    if (!['IN', 'OUT'].includes(body.type)) throw new Error('Choose stock in or stock out.');
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Quantity must be a whole number ≥ 1.');
    if (body.type === 'OUT' && qty > m.quantity) throw new Error(`Only ${m.quantity} ${m.unit} in stock.`);
    m.quantity += body.type === 'IN' ? qty : -qty;
    log(m, body.type, qty, String(body.note || '').trim());
    write(d);
    return m;
  }
  if (method === 'GET') return d.meds.slice().sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  if (method === 'POST') {
    const n = { id: Math.max(0, ...d.meds.map(x => x.id)) + 1, ...validate(body) };
    d.meds.push(n);
    if (n.quantity > 0) log(n, 'IN', n.quantity, 'Initial stock');
    write(d);
    return n;
  }
  if (!m) throw new Error('Medicine not found.');
  if (method === 'PUT') {
    const v = validate(body), diff = v.quantity - m.quantity;
    Object.assign(m, v);
    if (diff) log(m, diff > 0 ? 'IN' : 'OUT', Math.abs(diff), 'Manual edit');
    write(d);
    return m;
  }
  d.meds = d.meds.filter(x => x.id !== m.id);
  write(d);
  return null;
};

export const api = DEMO ? demo : real;

export function exportCsv() {
  if (!DEMO) { window.location.href = '/api/export.csv'; return; }
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Name', 'Category', 'Quantity', 'Unit', 'Reorder level', 'Batch no', 'Expiry date', 'Supplier', 'Remarks'];
  const rows = read().meds.map(r => [r.name, r.category, r.quantity, r.unit, r.reorder_level, r.batch_no, r.expiry_date, r.supplier, r.remarks].map(q).join(','));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + [head.map(q).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = 'medicine-inventory.csv';
  a.click();
}