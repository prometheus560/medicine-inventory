import { useEffect, useMemo, useState } from 'react';

const api = async (url, opts) => {
  const r = await fetch(url, opts && { ...opts, headers: { 'Content-Type': 'application/json' } });
  if (!r.ok) throw new Error((await r.json()).error || 'Request failed');
  return r.status === 204 ? null : r.json();
};
const send = (method, body) => ({ method, body: JSON.stringify(body) });
const iso = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const status = m => {
  if (m.expiry_date < iso(0)) return ['exp', 'Expired'];
  if (m.expiry_date <= iso(30)) return ['soon', 'Expiring soon'];
  if (m.quantity <= m.reorder_level) return ['low', 'Low stock'];
  return ['ok', 'In stock'];
};

const PILL = { ok: 'bg-emerald-100 text-emerald-700', low: 'bg-amber-100 text-amber-700', soon: 'bg-amber-100 text-amber-700', exp: 'bg-rose-100 text-rose-700' };
const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const input = 'w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const btn = 'rounded-lg px-4 py-2 font-semibold transition disabled:opacity-40';
const primary = `${btn} bg-blue-600 text-white hover:bg-blue-700`;
const ghost = `${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const small = 'rounded-md px-2.5 py-1 text-xs font-medium';

const Pill = ({ k, children }) => (
  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[k]}`}>{children}</span>
);
const Stat = ({ label, value, tone }) => (
  <div className={`${card} p-4`}>
    <p className="text-slate-500">{label}</p>
    <p className={`mt-1 text-3xl font-bold ${tone}`}>{value}</p>
  </div>
);
const Field = ({ label, children }) => (
  <label className="mt-3 block text-sm font-semibold text-slate-500">
    {label}
    <div className="mt-1 font-normal text-slate-900">{children}</div>
  </label>
);
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm print:hidden"
       onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <h3 className="text-lg font-bold">{title}</h3>
      {children}
    </div>
  </div>
);
const Actions = ({ onClose, onSave, label }) => (
  <div className="mt-3 flex justify-end gap-2">
    <button className={ghost} onClick={onClose}>Cancel</button>
    <button className={primary} onClick={onSave}>{label}</button>
  </div>
);

function MedForm({ med, onClose, onSaved }) {
  const [f, setF] = useState(med || { name: '', category: '', quantity: '', unit: '', batch_no: '', expiry_date: '', reorder_level: 10, supplier: '', remarks: '' });
  const [err, setErr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    try {
      await api(med ? `/api/medicines/${med.id}` : '/api/medicines', send(med ? 'PUT' : 'POST', f));
      onSaved(med ? 'Medicine updated' : 'Medicine added');
    } catch (e) { setErr(e.message); }
  };
  return (
    <Modal title={med ? 'Edit medicine' : 'Add medicine'} onClose={onClose}>
      <Field label="Medicine name"><input className={input} value={f.name} onChange={set('name')} placeholder="e.g. Paracetamol 500mg" /></Field>
      <Field label="Category"><input className={input} list="cats" value={f.category} onChange={set('category')} placeholder="e.g. Analgesic" /></Field>
      <datalist id="cats">{['Analgesic', 'Antibiotic', 'Antihistamine', 'Antacid', 'Vitamins', 'Dental', 'First aid'].map(c => <option key={c}>{c}</option>)}</datalist>
      <datalist id="units">{['tablet', 'capsule', 'bottle', 'box', 'sachet', 'tube'].map(c => <option key={c}>{c}</option>)}</datalist>
      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Quantity"><input className={input} type="number" min="0" value={f.quantity} onChange={set('quantity')} /></Field>
        <Field label="Unit"><input className={input} list="units" value={f.unit} onChange={set('unit')} placeholder="tablet" /></Field>
        <Field label="Batch no."><input className={input} value={f.batch_no ?? ''} onChange={set('batch_no')} /></Field>
        <Field label="Expiry date"><input className={input} type="date" value={f.expiry_date} onChange={set('expiry_date')} /></Field>
        <Field label="Reorder level"><input className={input} type="number" min="0" value={f.reorder_level} onChange={set('reorder_level')} /></Field>
        <Field label="Supplier"><input className={input} value={f.supplier ?? ''} onChange={set('supplier')} /></Field>
      </div>
      <Field label="Remarks (optional)"><input className={input} value={f.remarks ?? ''} onChange={set('remarks')} /></Field>
      <p className="mt-3 min-h-5 text-sm text-rose-600">{err}</p>
      <Actions onClose={onClose} onSave={save} label="Save medicine" />
    </Modal>
  );
}

function StockForm({ med, onClose, onSaved }) {
  const [type, setType] = useState('OUT');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const save = async () => {
    try { await api(`/api/medicines/${med.id}/stock`, send('POST', { type, quantity, note })); onSaved('Stock updated'); }
    catch (e) { setErr(e.message); }
  };
  return (
    <Modal title={`Update stock – ${med.name}`} onClose={onClose}>
      <p className="mt-1 text-slate-500">Currently {med.quantity} {med.unit}</p>
      <Field label="Action">
        <select className={input} value={type} onChange={e => setType(e.target.value)}>
          <option value="OUT">Dispense / use (stock out)</option>
          <option value="IN">Receive (stock in)</option>
        </select>
      </Field>
      <Field label="Quantity"><input className={input} type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} /></Field>
      <Field label="Note (patient, purpose, supplier…)"><input className={input} value={note} onChange={e => setNote(e.target.value)} /></Field>
      <p className="mt-3 min-h-5 text-sm text-rose-600">{err}</p>
      <Actions onClose={onClose} onSave={save} label="Save" />
    </Modal>
  );
}

const PER = 10;

export default function App() {
  const [meds, setMeds] = useState([]);
  const [hist, setHist] = useState([]);
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState({ k: 'expiry_date', dir: 1 });
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [printAll, setPrintAll] = useState(false);

  const load = async () => {
    const [m, h, s] = await Promise.all([api('/api/medicines'), api('/api/transactions'), api('/api/stats')]);
    setMeds(m); setHist(h); setStats(s);
  };
  useEffect(() => { load(); }, []);

  const done = msg => { setModal(null); setToast(msg); setTimeout(() => setToast(''), 2200); load(); };
  const remove = async m => {
    if (!confirm(`Delete ${m.name}?`)) return;
    await api(`/api/medicines/${m.id}`, { method: 'DELETE' });
    done('Medicine deleted');
  };
  const print = () => { setPrintAll(true); setTimeout(() => { window.print(); setPrintAll(false); }, 80); };

  const list = useMemo(() => {
    const val = m => (sort.k === 'status' ? status(m)[1] : m[sort.k]);
    return meds
      .filter(m => `${m.name} ${m.category} ${m.batch_no} ${m.supplier}`.toLowerCase().includes(q.toLowerCase())
        && (!filter || (filter === 'low' ? m.quantity <= m.reorder_level : status(m)[0] === filter)))
      .sort((a, b) => {
        const x = val(a), y = val(b);
        return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
      });
  }, [meds, q, filter, sort]);

  const pages = Math.max(1, Math.ceil(list.length / PER));
  const cur = Math.min(page, pages);
  const rows = printAll ? list : list.slice((cur - 1) * PER, cur * PER);

  const rank = { exp: 0, soon: 1, low: 2 };
  const alerts = meds.filter(m => status(m)[0] !== 'ok').sort((a, b) => rank[status(a)[0]] - rank[status(b)[0]]).slice(0, 5);
  const cats = stats?.byCategory || [];
  const max = Math.max(1, ...cats.map(c => c.count));

  const th = (k, label) => (
    <th key={label} className={`px-4 py-3 ${k ? 'cursor-pointer select-none hover:text-slate-900' : ''}`}
        onClick={k ? () => { setSort({ k, dir: sort.k === k ? -sort.dir : 1 }); setPage(1); } : undefined}>
      {label}{sort.k === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <div className="flex min-h-screen bg-slate-100 text-sm text-slate-900">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 bg-[#0b1f3a] p-5 text-slate-300 lg:flex print:hidden">
        <div className="flex items-center gap-3 text-white">
          <img src="/mertlogo.jpg" alt="CPSU SCC-MERT" className="h-11 w-11 rounded-full bg-white object-cover" />
          <div><b className="block text-base">MedStock</b><small className="text-slate-400">Medicine Inventory</small></div>
        </div>
        <nav className="space-y-1">
          <a href="#top" className="block rounded-lg bg-white/10 px-3 py-2.5 text-white">Dashboard</a>
          <a href="#inventory" className="block rounded-lg px-3 py-2.5 hover:bg-white/5">Inventory</a>
          <a href="#history" className="block rounded-lg px-3 py-2.5 hover:bg-white/5">History</a>
        </nav>
        <div className="mt-auto rounded-lg bg-white/5 p-3 text-xs leading-relaxed">
          <b className="text-white">Medical-Dental Health Unit</b><br />San Carlos Campus
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header id="top" className="flex flex-wrap items-center justify-between gap-3 px-6 pb-2 pt-6 lg:px-8 print:hidden">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-slate-500">Monitor stock levels and medicine expiry at a glance.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={ghost} onClick={print}>Print report</button>
            <a className={ghost} href="/api/export.csv">Export CSV</a>
            <button className={primary} onClick={() => setModal({ type: 'med' })}>+ Add medicine</button>
          </div>
        </header>

        <main className="space-y-4 px-6 pb-10 pt-3 lg:px-8 print:p-0">
          <div className="hidden print:block">
            <h2 className="text-xl font-bold">Medical-Dental Health Unit – San Carlos Campus</h2>
            <p className="text-slate-600">Medicine Inventory Report · {new Date().toLocaleDateString()}</p>
          </div>

          <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5 print:hidden">
            <Stat label="Medicines" value={stats?.medicines ?? 0} tone="text-blue-600" />
            <Stat label="Units in stock" value={stats?.units ?? 0} tone="text-emerald-600" />
            <Stat label="Low stock" value={stats?.lowStock ?? 0} tone="text-amber-600" />
            <Stat label="Expiring in 30 days" value={stats?.expiringSoon ?? 0} tone="text-amber-600" />
            <Stat label="Expired" value={stats?.expired ?? 0} tone="text-rose-600" />
          </section>

          <section className="grid gap-4 lg:grid-cols-2 print:hidden">
            <div className={`${card} p-5`}>
              <h3 className="font-bold">Stock by category</h3>
              {cats.map(c => (
                <div key={c.category} className="mt-3 grid grid-cols-[110px_1fr_24px] items-center gap-3">
                  <span>{c.category}</span>
                  <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${(c.count / max) * 100}%` }} /></div>
                  <b>{c.count}</b>
                </div>
              ))}
              {!cats.length && <p className="mt-3 text-slate-500">No medicines yet.</p>}
            </div>
            <div className={`${card} p-5`}>
              <h3 className="font-bold">Needs attention</h3>
              {alerts.map(m => { const [k, l] = status(m); return (
                <div key={m.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
                  <div><b>{m.name}</b><div className="text-xs text-slate-500">{m.quantity} {m.unit} · exp {fmt(m.expiry_date)}</div></div>
                  <Pill k={k}>{l}</Pill>
                </div>
              ); })}
              {!alerts.length && <p className="mt-3 text-slate-500">All clear — nothing needs attention.</p>}
            </div>
          </section>

          <section id="inventory" className={card}>
            <div className="flex flex-wrap items-center gap-3 p-5 print:hidden">
              <h3 className="mr-auto font-bold">Medicine inventory</h3>
              <input className={`${input} !w-64`} placeholder="Search name, category, batch…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
              <select className={`${input} !w-auto`} value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}>
                <option value="">All status</option><option value="ok">In stock</option><option value="low">Low stock</option>
                <option value="soon">Expiring soon</option><option value="exp">Expired</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>{th('name', 'Medicine')}{th('category', 'Category')}{th('quantity', 'Quantity')}{th(null, 'Batch')}{th('expiry_date', 'Expiry')}{th('status', 'Status')}<th className="print:hidden" /></tr>
                </thead>
                <tbody>
                  {rows.map(m => { const [k, l] = status(m); return (
                    <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3" title={m.remarks}><div className="font-semibold">{m.name}</div>{m.supplier && <div className="text-xs text-slate-500">{m.supplier}</div>}</td>
                      <td className="px-4 py-3">{m.category}</td>
                      <td className="px-4 py-3"><b>{m.quantity}</b> <span className="text-xs text-slate-500">{m.unit} · reorder ≤{m.reorder_level}</span></td>
                      <td className="px-4 py-3 text-slate-500">{m.batch_no || '—'}</td>
                      <td className="px-4 py-3">{fmt(m.expiry_date)}</td>
                      <td className="px-4 py-3"><Pill k={k}>{l}</Pill></td>
                      <td className="space-x-1 whitespace-nowrap px-4 py-3 print:hidden">
                        <button className={`${small} border border-slate-200 hover:bg-slate-50`} onClick={() => setModal({ type: 'stock', med: m })}>Stock</button>
                        <button className={`${small} border border-slate-200 hover:bg-slate-50`} onClick={() => setModal({ type: 'med', med: m })}>Edit</button>
                        <button className={`${small} text-rose-600 hover:bg-rose-50`} onClick={() => remove(m)}>Delete</button>
                      </td>
                    </tr>
                  ); })}
                  {!rows.length && <tr><td colSpan="7" className="p-8 text-center text-slate-500">No medicines found.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-slate-500">
              <span>Showing {rows.length} of {list.length} medicines</span>
              <div className="flex items-center gap-2 print:hidden">
                <button className={`${ghost} !px-3 !py-1`} disabled={cur <= 1} onClick={() => setPage(cur - 1)}>Prev</button>
                <span>{cur} / {pages}</span>
                <button className={`${ghost} !px-3 !py-1`} disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Next</button>
              </div>
            </div>
          </section>

          <section id="history" className={`${card} print:hidden`}>
            <div className="flex items-center justify-between p-5"><h3 className="font-bold">Stock history</h3><span className="text-slate-500">Latest 100 movements</span></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Medicine</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Note</th></tr>
                </thead>
                <tbody>
                  {hist.map(t => (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-500">{new Date(t.created_at.replace(' ', 'T') + 'Z').toLocaleString()}</td>
                      <td className="px-4 py-3">{t.medicine_name}</td>
                      <td className="px-4 py-3"><Pill k={t.type === 'IN' ? 'ok' : 'exp'}>{t.type === 'IN' ? 'Stock in' : 'Stock out'}</Pill></td>
                      <td className="px-4 py-3 font-bold">{t.type === 'IN' ? '+' : '−'}{t.quantity}</td>
                      <td className="px-4 py-3 text-slate-500">{t.note || '—'}</td>
                    </tr>
                  ))}
                  {!hist.length && <tr><td colSpan="5" className="p-8 text-center text-slate-500">No stock movements yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {modal?.type === 'med' && <MedForm med={modal.med} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.type === 'stock' && <StockForm med={modal.med} onClose={() => setModal(null)} onSaved={done} />}
      {toast && <div className="fixed bottom-6 right-6 rounded-xl bg-[#0b1f3a] px-4 py-3 text-white shadow-xl print:hidden">{toast}</div>}
    </div>
  );
}
