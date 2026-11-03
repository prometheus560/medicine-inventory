import { useEffect, useState } from 'react';
import { api } from './api.js';
import { card, input, Pill } from './ui.jsx';
import { when } from './lib.js';

const tone = a => (/delete/.test(a) ? 'exp' : /add/.test(a) ? 'ok' : /edit|password|restore/.test(a) ? 'low' : 'info');

export default function Audit() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { api('/api/audit').then(setRows).catch(e => setErr(e.message)); }, []);
  const list = rows.filter(r => `${r.username} ${r.action} ${r.target} ${r.detail}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center gap-3 p-5">
        <h3 className="mr-auto font-bold">Activity log <span className="text-xs font-normal text-slate-400">latest 200</span></h3>
        <input className={`${input} !w-64`} placeholder="Search user, action, medicine..." value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {err && <p className="px-5 pb-3 text-rose-600">{err}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{['When', 'User', 'Action', 'Item', 'Details'].map(h => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {list.map(r => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{when(r.created_at)}</td>
                <td className="px-4 py-3 font-semibold">{r.username}</td>
                <td className="px-4 py-3"><Pill k={tone(r.action)}>{r.action}</Pill></td>
                <td className="px-4 py-3">{r.target || '—'}</td>
                <td className="px-4 py-3 text-slate-500">{r.detail || '—'}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan="5" className="p-8 text-center text-slate-500">No activity recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
