import { useEffect, useState } from 'react';
import { api } from './api.js';
import { status, fmt } from './lib.js';
import { Pill, ghost } from './ui.jsx';
import { MedForm, StockForm, PasswordForm, Confirm } from './Forms.jsx';
import Dashboard from './Dashboard.jsx';
import Inventory from './Inventory.jsx';
import History from './History.jsx';
import Users from './Users.jsx';
import Login from './Login.jsx';

const PAGES = {
  dashboard: ['Dashboard', 'Monitor stock levels and medicine expiry at a glance.'],
  inventory: ['Inventory', 'Add, edit and track every medicine.'],
  history: ['Stock history', 'Every stock in and stock out, with who recorded it.'],
  users: ['Users', 'Manage staff accounts and permissions.']
};

const useRoute = () => {
  const get = () => window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard';
  const [r, setR] = useState(get);
  useEffect(() => {
    const f = () => setR(get());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
};

export default function App() {
  const [me, setMe] = useState(null);
  const [meds, setMeds] = useState([]);
  const [hist, setHist] = useState([]);
  const [stats, setStats] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const route = useRoute();

  const load = async () => {
    const [m, h, s] = await Promise.all([api('/api/medicines'), api('/api/transactions'), api('/api/stats')]);
    setMeds(m); setHist(h); setStats(s);
  };
  useEffect(() => {
    const out = () => setMe(false);
    window.addEventListener('signed-out', out);
    return () => window.removeEventListener('signed-out', out);
  }, []);
  useEffect(() => { api('/api/me').then(setMe).catch(() => setMe(false)); }, []);
  useEffect(() => { if (me) load(); }, [me]);

  const notify = msg => { setToast(msg); setTimeout(() => setToast(''), 2200); };
  const done = msg => { setModal(null); notify(msg); load(); };
  const signOut = async () => { try { await api('/api/logout', { method: 'POST' }); } finally { setMe(false); } };
  const exportXlsx = async () => { const { exportExcel } = await import('./exportExcel.js'); await exportExcel(meds, hist, status); };

  if (me === null) return <div className="grid min-h-screen place-items-center text-slate-500">Loading...</div>;
  if (me === false) return <Login onDone={setMe} />;

  const isAdmin = me.role === 'admin';
  const canDelete = me.role !== 'staff';
  const page = route === 'users' && !isAdmin ? 'dashboard' : PAGES[route] ? route : 'dashboard';
  const links = [['dashboard', 'Dashboard'], ['inventory', 'Inventory'], ['history', 'Stock history'], ...(isAdmin ? [['users', 'Users']] : [])];

  return (
    <div className="flex min-h-screen bg-[#f3f7fa] text-sm text-slate-900">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 bg-gradient-to-b from-[#062c43] to-[#0b4f6c] p-5 text-cyan-100/80 lg:flex print:hidden">
        <div className="flex items-center gap-3 text-white">
          <img src={import.meta.env.BASE_URL + 'mertlogo.jpg'} alt="CPSU SCC-MERT" className="h-12 w-12 rounded-full bg-white object-cover ring-2 ring-white/30" />
          <div><b className="block text-base tracking-wide">MedStock</b><small className="text-cyan-200/70">Clinic Medicine Inventory</small></div>
        </div>
        <nav className="space-y-1">
          {links.map(([id, label]) => (
            <a key={id} href={`#/${id}`} className={'block rounded-xl px-3 py-2.5 ' + (page === id ? 'bg-white/15 text-white' : 'hover:bg-white/10')}>{label}</a>
          ))}
        </nav>
        <div className="mt-auto rounded-xl bg-white/10 p-3 text-xs leading-relaxed">
          <b className="block text-sm text-white">{me.name || me.user}</b>
          <span className="text-cyan-200/70">{me.role === 'admin' ? 'Administrator' : me.role === 'staff' ? 'Staff' : 'Demo'} · Medical-Dental Health Unit</span>
          <div className="mt-2 flex gap-3">
            {me.role && <button className="underline-offset-2 hover:underline" onClick={() => setModal({ type: 'pw' })}>Change password</button>}
            <button className="underline-offset-2 hover:underline" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <nav className="flex items-center gap-2 overflow-x-auto px-4 pt-4 lg:hidden print:hidden">
          {links.map(([id, label]) => (
            <a key={id} href={`#/${id}`} className={'whitespace-nowrap rounded-full px-3 py-1.5 ' + (page === id ? 'bg-cyan-700 text-white' : 'bg-white text-slate-600')}>{label}</a>
          ))}
          <button className={`${ghost} !px-3 !py-1.5`} onClick={signOut}>Sign out</button>
        </nav>
        <header className="px-6 pb-2 pt-6 lg:px-8 print:hidden">
          <h1 className="text-2xl font-bold">{PAGES[page][0]}</h1>
          <p className="text-slate-500">{PAGES[page][1]}</p>
        </header>
        <main className="space-y-4 px-6 pb-10 pt-3 lg:px-8 print:p-0">
          {page === 'dashboard' && (
            <Dashboard meds={meds} hist={hist} stats={stats} status={status} fmt={fmt}
              onAdd={() => setModal({ type: 'med' })} onStock={m => setModal({ type: 'stock', med: m })} />
          )}
          {page === 'inventory' && <Inventory meds={meds} admin={canDelete} setModal={setModal} onExport={exportXlsx} />}
          {page === 'history' && <History hist={hist} />}
          {page === 'users' && <Users me={me} notify={notify} />}
        </main>
      </div>

      {modal?.type === 'med' && <MedForm med={modal.med} meds={meds} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.type === 'stock' && <StockForm med={modal.med} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.type === 'pw' && <PasswordForm onClose={() => setModal(null)} onSaved={done} />}
      {modal?.type === 'del' && (
        <Confirm title="Delete medicine?" label="Delete"
          text={`${modal.med.name} will be removed from the inventory. Its stock history is kept.`}
          onClose={() => setModal(null)}
          onConfirm={async () => { await api(`/api/medicines/${modal.med.id}`, { method: 'DELETE' }); done('Medicine deleted'); }} />
      )}
      {toast && <div className="fixed bottom-6 right-6 rounded-xl bg-[#0b4f6c] px-4 py-3 text-white shadow-xl print:hidden">{toast}</div>}
    </div>
  );
}
