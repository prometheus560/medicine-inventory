export const card = 'rounded-2xl border border-slate-200/80 bg-white shadow-sm';
export const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100';
const btn = 'rounded-lg px-4 py-2 font-semibold transition disabled:opacity-40';
export const primary = `${btn} bg-cyan-700 text-white hover:bg-cyan-800`;
export const ghost = `${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
export const danger = `${btn} bg-rose-600 text-white hover:bg-rose-700`;
export const small = 'rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50';

const PILL = {
  ok: 'bg-emerald-100 text-emerald-700', low: 'bg-amber-100 text-amber-700', soon: 'bg-orange-100 text-orange-700',
  exp: 'bg-rose-100 text-rose-700', info: 'bg-sky-100 text-sky-700', off: 'bg-slate-100 text-slate-500'
};
export const Pill = ({ k, children }) => (
  <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[k]}`}>{children}</span>
);
export const Field = ({ label, children }) => (
  <label className="mt-3 block text-sm font-semibold text-slate-500">
    {label}
    <div className="mt-1 font-normal text-slate-900">{children}</div>
  </label>
);
export const Err = ({ children }) => <p className="mt-3 min-h-5 text-sm text-rose-600">{children}</p>;
export const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm print:hidden"
       onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <h3 className="text-lg font-bold">{title}</h3>
      {children}
    </div>
  </div>
);
export const Actions = ({ onClose, onSave, label, tone = primary }) => (
  <div className="mt-3 flex justify-end gap-2">
    <button className={ghost} onClick={onClose}>Cancel</button>
    <button className={tone} onClick={onSave}>{label}</button>
  </div>
);
