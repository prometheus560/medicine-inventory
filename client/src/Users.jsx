import { useEffect, useState } from 'react';
import { api } from './api.js';
import { card, input, primary, small, Pill, Field, Err, Modal, Actions } from './ui.jsx';
import { Confirm } from './Forms.jsx';
import { when } from './lib.js';

const send = (method, body) => ({ method, body: JSON.stringify(body) });

function UserForm({ u, onClose, onSaved }) {
  const [f, setF] = useState(u ? { full_name: u.full_name, role: u.role, active: u.active, password: '' } : { username: '', full_name: '', role: 'staff', active: true, password: '' });
  const [err, setErr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    try { await api(u ? `/api/users/${u.id}` : '/api/users', send(u ? 'PUT' : 'POST', f)); onSaved(u ? 'User updated' : 'User added'); }
    catch (e) { setErr(e.message); }
  };
  return (
    <Modal title={u ? `Edit ${u.username}` : 'Add user'} onClose={onClose}>
      {!u && <Field label="Username"><input className={input} value={f.username} onChange={set('username')} autoFocus /></Field>}
      <Field label="Full name"><input className={input} value={f.full_name} onChange={set('full_name')} /></Field>
      <Field label="Role">
        <select className={input} value={f.role} onChange={set('role')}>
          <option value="staff">Staff - can dispense and edit, cannot delete</option>
          <option value="admin">Administrator - full access</option>
        </select>
      </Field>
      {u && (
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-500">
          <input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} /> Account is active
        </label>
      )}
      <Field label={u ? 'New password (leave blank to keep)' : 'Password (min. 6 characters)'}>
        <input className={input} type="password" value={f.password} onChange={set('password')} />
      </Field>
      <Err>{err}</Err>
      <Actions onClose={onClose} onSave={save} label="Save user" />
    </Modal>
  );
}

export default function Users({ me, notify }) {
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api('/api/users').then(setUsers).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const done = msg => { setModal(null); notify(msg); load(); };

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <h3 className="font-bold">Staff accounts</h3>
        <button className={primary} onClick={() => setModal({ type: 'form' })}>+ Add user</button>
      </div>
      {err && <p className="px-5 pb-3 text-rose-600">{err}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{['Name', 'Username', 'Role', 'Status', 'Created', ''].map(h => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold">{u.full_name || '—'}{u.username === me.user && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}</td>
                <td className="px-4 py-3">{u.username}</td>
                <td className="px-4 py-3"><Pill k={u.role === 'admin' ? 'info' : 'off'}>{u.role === 'admin' ? 'Administrator' : 'Staff'}</Pill></td>
                <td className="px-4 py-3"><Pill k={u.active ? 'ok' : 'off'}>{u.active ? 'Active' : 'Disabled'}</Pill></td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{when(u.created_at)}</td>
                <td className="space-x-1 whitespace-nowrap px-4 py-3">
                  <button className={small} onClick={() => setModal({ type: 'form', u })}>Edit</button>
                  {u.username !== me.user && <button className={`${small} !border-transparent text-rose-600 hover:!bg-rose-50`} onClick={() => setModal({ type: 'del', u })}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal?.type === 'form' && <UserForm u={modal.u} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.type === 'del' && (
        <Confirm title="Delete user?" text={`${modal.u.username} will no longer be able to sign in. Their past stock records are kept.`} label="Delete user"
          onClose={() => setModal(null)} onConfirm={async () => { await api(`/api/users/${modal.u.id}`, { method: 'DELETE' }); done('User deleted'); }} />
      )}
    </section>
  );
}
