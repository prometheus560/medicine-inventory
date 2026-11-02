import { useState } from 'react';
import { api } from './api.js';

const input = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100';

export default function Login({ onDone }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      onDone(r.user);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-[#062c43] via-[#0b4f6c] to-[#14b8a6] p-4 text-sm">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <img src={import.meta.env.BASE_URL + 'mertlogo.jpg'} alt="CPSU SCC-MERT" className="h-14 w-14 rounded-full object-cover ring-2 ring-slate-100" />
          <div>
            <h1 className="text-xl font-bold">MedStock</h1>
            <p className="text-slate-500">Medical-Dental Health Unit</p>
          </div>
        </div>
        <label className="block font-semibold text-slate-500">Username
          <input className={input} value={username} onChange={e => setUsername(e.target.value)} autoFocus />
        </label>
        <label className="mt-3 block font-semibold text-slate-500">Password
          <input className={input} type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <p className="mt-3 min-h-5 text-rose-600">{err}</p>
        <button disabled={busy} className="mt-2 w-full rounded-lg bg-cyan-700 py-2.5 font-semibold text-white hover:bg-cyan-800 disabled:opacity-50">
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}