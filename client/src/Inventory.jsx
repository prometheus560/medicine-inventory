import { useMemo, useState } from 'react';
import { card, input, ghost, primary, small, Pill } from './ui.jsx';
import { status, fmt } from './lib.js';

const PER = 10;

export default function Inventory({ meds, admin, setModal, onExport }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState({ k: 'expiry_date', dir: 1 });
  const [page, setPage] = useState(1);
  const [all, setAll] = useState(false);

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
  const rows = all ? list : list.slice((cur - 1) * PER, cur * PER);
  const print = () => { setAll(true); setTimeout(() => { window.print(); setAll(false); }, 80); };

  const th = (k, label) => (
    <th key={label} className={`whitespace-nowrap px-4 py-3 ${k ? 'cursor-pointer select-none hover:text-slate-900' : ''}`}
        onClick={k ? () => { setSort({ k, dir: sort.k === k ? -sort.dir : 1 }); setPage(1); } : undefined}>
      {label}{sort.k === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <>
      <div className="hidden print:block">
        <h2 className="text-xl font-bold">Medical-Dental Health Unit - San Carlos Campus</h2>
        <p className="text-slate-600">Medicine Inventory Report · {new Date().toLocaleDateString()}</p>
      </div>
      <section className={card}>
        <div className="flex flex-wrap items-center gap-3 p-5 print:hidden">
          <h3 className="mr-auto font-bold">All medicines</h3>
          <input className={`${input} !w-60`} placeholder="Search name, category, batch..." value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
          <select className={`${input} !w-auto`} value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}>
            <option value="">All status</option><option value="ok">In stock</option><option value="low">Low stock</option>
            <option value="soon">Expiring soon</option><option value="exp">Expired</option>
          </select>
          <button className={ghost} onClick={print}>Print report</button>
          <button className={ghost} onClick={onExport}>Export Excel</button>
          <button className={primary} onClick={() => setModal({ type: 'med' })}>+ Add medicine</button>
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
                  <td className="whitespace-nowrap px-4 py-3">{m.category}</td>
                  <td className="whitespace-nowrap px-4 py-3"><b>{m.quantity}</b> <span className="text-xs text-slate-500">{m.unit} · reorder ≤{m.reorder_level}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{m.batch_no || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">{fmt(m.expiry_date)}</td>
                  <td className="px-4 py-3"><Pill k={k}>{l}</Pill></td>
                  <td className="space-x-1 whitespace-nowrap px-4 py-3 print:hidden">
                    <button className={small} onClick={() => setModal({ type: 'stock', med: m })}>Stock</button>
                    <button className={small} onClick={() => setModal({ type: 'med', med: m })}>Edit</button>
                    {admin && <button className={`${small} !border-transparent text-rose-600 hover:!bg-rose-50`} onClick={() => setModal({ type: 'del', med: m })}>Delete</button>}
                  </td>
                </tr>
              ); })}
              {!rows.length && <tr><td colSpan="7" className="p-8 text-center text-slate-500">No medicines found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-slate-500">
          <span>Showing {rows.length} of {list.length} medicines</span>
          <div className="flex items-center gap-2 print:hidden">
            <button className={`${ghost} !px-3 !py-1`} disabled={cur <= 1} onClick={() => setPage(cur - 1)}>Prev</button>
            <span>{cur} / {pages}</span>
            <button className={`${ghost} !px-3 !py-1`} disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Next</button>
          </div>
        </div>
      </section>
    </>
  );
}
