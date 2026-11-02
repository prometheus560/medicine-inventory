import { useState } from 'react';
import { card, input, Pill } from './ui.jsx';
import { when } from './lib.js';

export default function History({ hist }) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const rows = hist.filter(t => (!type || t.type === type)
    && `${t.medicine_name} ${t.note} ${t.performed_by}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center gap-3 p-5">
        <h3 className="mr-auto font-bold">Stock movements <span className="text-xs font-normal text-slate-400">latest 100</span></h3>
        <input className={`${input} !w-60`} placeholder="Search medicine, note, user..." value={q} onChange={e => setQ(e.target.value)} />
        <select className={`${input} !w-auto`} value={type} onChange={e => setType(e.target.value)}>
          <option value="">All movements</option><option value="IN">Stock in</option><option value="OUT">Stock out</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{['Date', 'Medicine', 'Type', 'Qty', 'Note', 'By'].map(h => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{when(t.created_at)}</td>
                <td className="px-4 py-3">{t.medicine_name}</td>
                <td className="px-4 py-3"><Pill k={t.type === 'IN' ? 'ok' : 'exp'}>{t.type === 'IN' ? 'Stock in' : 'Stock out'}</Pill></td>
                <td className="px-4 py-3 font-bold">{t.type === 'IN' ? '+' : '−'}{t.quantity}</td>
                <td className="px-4 py-3 text-slate-500">{t.note || '—'}</td>
                <td className="px-4 py-3 text-slate-500">{t.performed_by || '—'}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="6" className="p-8 text-center text-slate-500">No stock movements found.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
