const card = 'rounded-2xl border border-slate-200/80 bg-white shadow-sm';
const COLORS = { ok: '#10b981', low: '#f59e0b', soon: '#f97316', exp: '#ef4444' };
const ICONS = {
  pill: 'M10.5 20.5l-7-7a4.9 4.9 0 017-7l7 7a4.9 4.9 0 01-7 7zM8.5 8.5l7 7',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  warn: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  x: 'M15 9l-6 6M9 9l6 6M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7'
};

const Icon = ({ d, cls = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const Kpi = ({ icon, label, value, sub, tone }) => (
  <div className={`${card} flex items-center gap-4 p-4`}>
    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tone}`}><Icon d={ICONS[icon]} /></div>
    <div className="min-w-0">
      <p className="text-slate-500">{label}</p>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      <p className="truncate text-xs text-slate-400">{sub}</p>
    </div>
  </div>
);

const Panel = ({ title, hint, className = '', children }) => (
  <div className={`${card} p-5 ${className}`}>
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h3 className="font-bold">{title}</h3>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </div>
    {children}
  </div>
);

function Donut({ parts }) {
  const sum = parts.reduce((a, p) => a + p.n, 0);
  let off = 25;
  return (
    <svg viewBox="0 0 36 36" className="h-36 w-36 shrink-0">
      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" strokeWidth="4" />
      {parts.filter(p => p.n).map(p => {
        const len = (p.n / sum) * 100;
        const el = <circle key={p.label} cx="18" cy="18" r="15.9155" fill="none" stroke={p.color} strokeWidth="4" strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={off} />;
        off -= len;
        return el;
      })}
      <text x="18" y="18" textAnchor="middle" className="fill-slate-900 text-[7px] font-bold">{sum}</text>
      <text x="18" y="23" textAnchor="middle" className="fill-slate-400 text-[2.6px]">medicines</text>
    </svg>
  );
}

const ago = s => {
  const m = Math.round((Date.now() - new Date(s.replace(' ', 'T') + 'Z')) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};

export default function Dashboard({ meds, hist, stats, status, fmt, onAdd, onStock }) {
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date(now.toDateString());
  const days = m => Math.round((new Date(m.expiry_date + 'T00:00:00') - today) / 864e5);

  const counts = { ok: 0, low: 0, soon: 0, exp: 0 };
  meds.forEach(m => { counts[status(m)[0]]++; });
  const parts = [
    { label: 'In stock', n: counts.ok, color: COLORS.ok },
    { label: 'Low stock', n: counts.low, color: COLORS.low },
    { label: 'Expiring soon', n: counts.soon, color: COLORS.soon },
    { label: 'Expired', n: counts.exp, color: COLORS.exp }
  ];
  const buckets = [
    ['Expired', m => days(m) < 0, '#ef4444'],
    ['Within 30 days', m => days(m) >= 0 && days(m) <= 30, '#f97316'],
    ['31 – 90 days', m => days(m) > 30 && days(m) <= 90, '#f59e0b'],
    ['91 – 180 days', m => days(m) > 90 && days(m) <= 180, '#06b6d4'],
    ['Over 180 days', m => days(m) > 180, '#10b981']
  ].map(([label, test, color]) => ({ label, color, n: meds.filter(test).length }));
  const maxB = Math.max(1, ...buckets.map(b => b.n));
  const cats = stats?.byCategory || [];
  const maxC = Math.max(1, ...cats.map(c => c.count));
  const rank = { exp: 0, soon: 1, low: 2 };
  const attention = meds.filter(m => status(m)[0] !== 'ok').sort((a, b) => rank[status(a)[0]] - rank[status(b)[0]]);
  const PILL = { low: 'bg-amber-100 text-amber-700', soon: 'bg-orange-100 text-orange-700', exp: 'bg-rose-100 text-rose-700' };

  return (
    <div className="space-y-4 print:hidden">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0b4f6c] via-[#0e7490] to-[#14b8a6] p-6 text-white shadow-lg">
        <svg className="pointer-events-none absolute -right-6 -top-6 h-56 w-56 text-white/10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" /></svg>
        <p className="text-cyan-100">{now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <h2 className="mt-1 text-2xl font-bold">{greet}, Health Unit Team</h2>
        <p className="mt-1 max-w-xl text-cyan-50/90">
          {attention.length
            ? `${attention.length} medicine${attention.length > 1 ? 's need' : ' needs'} attention today. Review the expired, expiring and low-stock items below.`
            : 'All medicines are in good standing. Nothing needs attention today.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={onAdd} className="rounded-lg bg-white px-4 py-2 font-semibold text-cyan-800 shadow hover:bg-cyan-50">+ Add medicine</button>
          <a href="#inventory" className="rounded-lg border border-white/40 px-4 py-2 font-semibold hover:bg-white/10">View inventory</a>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi icon="pill" label="Medicines" value={stats?.medicines ?? 0} sub="Registered items" tone="bg-sky-50 text-sky-600" />
        <Kpi icon="box" label="Units in stock" value={stats?.units ?? 0} sub="All medicines combined" tone="bg-emerald-50 text-emerald-600" />
        <Kpi icon="warn" label="Low stock" value={stats?.lowStock ?? 0} sub="At or below reorder level" tone="bg-amber-50 text-amber-600" />
        <Kpi icon="clock" label="Expiring soon" value={stats?.expiringSoon ?? 0} sub="Within 30 days" tone="bg-orange-50 text-orange-600" />
        <Kpi icon="x" label="Expired" value={stats?.expired ?? 0} sub="Remove from use" tone="bg-rose-50 text-rose-600" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Stock health" hint="By status">
          <div className="flex items-center gap-5">
            <Donut parts={parts} />
            <ul className="space-y-2">
              {parts.map(p => (
                <li key={p.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  <span className="text-slate-600">{p.label}</span>
                  <b className="ml-auto pl-3">{p.n}</b>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel title="Expiry outlook" hint="Medicines by time left">
          {buckets.map(b => (
            <div key={b.label} className="mt-2.5 grid grid-cols-[108px_1fr_22px] items-center gap-3">
              <span className="text-slate-600">{b.label}</span>
              <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${(b.n / maxB) * 100}%`, background: b.color }} /></div>
              <b>{b.n}</b>
            </div>
          ))}
        </Panel>
        <Panel title="Stock by category" hint="Number of medicines">
          {cats.map(c => (
            <div key={c.category} className="mt-2.5 grid grid-cols-[108px_1fr_22px] items-center gap-3">
              <span className="truncate text-slate-600">{c.category}</span>
              <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-gradient-to-r from-cyan-600 to-teal-400" style={{ width: `${(c.count / maxC) * 100}%` }} /></div>
              <b>{c.count}</b>
            </div>
          ))}
          {!cats.length && <p className="text-slate-500">No medicines yet.</p>}
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Panel title="Needs attention" hint={`${attention.length} item${attention.length === 1 ? '' : 's'}`} className="lg:col-span-3">
          {attention.slice(0, 5).map(m => { const [k, l] = status(m); return (
            <div key={m.id} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.name}</p>
                <p className="text-xs text-slate-500">{m.quantity} {m.unit} · expires {fmt(m.expiry_date)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[k]}`}>{l}</span>
              <button onClick={() => onStock(m)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50">Update stock</button>
            </div>
          ); })}
          {!attention.length && <p className="py-4 text-slate-500">All clear. Nothing needs attention.</p>}
        </Panel>
        <Panel title="Recent activity" hint="Latest stock movements" className="lg:col-span-2">
          {hist.slice(0, 6).map(t => (
            <div key={t.id} className="flex items-start gap-3 border-b border-slate-100 py-2.5 last:border-0">
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${t.type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <Icon d={t.type === 'IN' ? ICONS.down : ICONS.up} cls="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{t.medicine_name}</p>
                <p className="truncate text-xs text-slate-500">{t.type === 'IN' ? 'Received' : 'Dispensed'} {t.quantity}{t.note ? ` · ${t.note}` : ''}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">{ago(t.created_at)}</span>
            </div>
          ))}
          {!hist.length && <p className="py-4 text-slate-500">No stock movements yet.</p>}
        </Panel>
      </section>
    </div>
  );
}