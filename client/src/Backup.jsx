import { useEffect, useState } from 'react';
import { api } from './api.js';
import { card, primary, ghost } from './ui.jsx';

export default function Backup({ notify }) {
  const [files, setFiles] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/api/backups').then(setFiles).catch(() => {}); }, []);

  const restore = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm(`Restore from "${file.name}"?\n\nCurrent medicines and stock history will be replaced. A safety copy is saved first, and staff accounts are kept.`)) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/restore', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: await file.arrayBuffer() });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Restore failed');
      notify('Backup restored');
      setTimeout(() => window.location.reload(), 900);
    } catch (x) { setMsg(x.message); }
    setBusy(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={`${card} p-6`}>
        <h3 className="font-bold">Download a backup</h3>
        <p className="mt-2 text-slate-600">Saves all medicines and stock history to one file. Keep a copy on a USB drive or cloud storage.</p>
        <a href="/api/backup" className={`${primary} mt-4 inline-block`}>Download backup file</a>
      </section>
      <section className={`${card} p-6`}>
        <h3 className="font-bold">Restore from a backup</h3>
        <p className="mt-2 text-slate-600">Replaces the current medicines and history with a backup file. Staff accounts are not changed.</p>
        <label className={`${ghost} mt-4 inline-block cursor-pointer`}>
          {busy ? 'Restoring...' : 'Choose backup file...'}
          <input type="file" accept=".db" className="hidden" disabled={busy} onChange={restore} />
        </label>
        <p className="mt-3 min-h-5 text-rose-600">{msg}</p>
      </section>
      <section className={`${card} p-6 lg:col-span-2`}>
        <h3 className="font-bold">Automatic backups on this computer</h3>
        <p className="mt-1 text-slate-500">Saved daily in the project's <code>backups</code> folder. The last 7 days are kept.</p>
        <ul className="mt-3 divide-y divide-slate-100">
          {files.map(f => <li key={f.name} className="flex justify-between py-2"><span>{f.name}</span><span className="text-slate-400">{(f.size / 1024).toFixed(0)} KB</span></li>)}
          {!files.length && <li className="py-2 text-slate-500">No backups yet.</li>}
        </ul>
      </section>
    </div>
  );
}
