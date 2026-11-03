import { useState } from 'react';
import { api } from './api.js';
import { Modal, Field, Err, Actions, input, danger } from './ui.jsx';

const send = (method, body) => ({ method, body: JSON.stringify(body) });
const DEF = {
  category: ['Analgesic', 'Antibiotic', 'Antihistamine', 'Antacid', 'Vitamins', 'Dental', 'First aid'],
  unit: ['tablet', 'capsule', 'bottle', 'box', 'sachet', 'tube'],
  supplier: []
};
const uniq = (meds, k) => [...new Set([...DEF[k], ...meds.map(m => m[k]).filter(Boolean)])];

export function MedForm({ med, meds, onClose, onSaved }) {
  const [f, setF] = useState(med || { name: '', category: '', quantity: '', unit: '', batch_no: '', expiry_date: '', reorder_level: 10, supplier: '', remarks: '' });
  const [err, setErr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    try {
      await api(med ? `/api/medicines/${med.id}` : '/api/medicines', send(med ? 'PUT' : 'POST', f));
      onSaved(med ? 'Medicine updated' : 'Medicine added');
    } catch (e) { setErr(e.message); }
  };
  const list = (id, k) => <datalist id={id}>{uniq(meds, k).map(c => <option key={c} value={c} />)}</datalist>;
  return (
    <Modal title={med ? 'Edit medicine' : 'Add medicine'} onClose={onClose}>
      {list('dl-cat', 'category')}{list('dl-unit', 'unit')}{list('dl-sup', 'supplier')}
      <Field label="Medicine name"><input className={input} value={f.name} onChange={set('name')} placeholder="e.g. Paracetamol 500mg" /></Field>
      <Field label="Category"><input className={input} list="dl-cat" value={f.category} onChange={set('category')} placeholder="e.g. Analgesic" /></Field>
      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Quantity"><input className={input} type="number" min="0" value={f.quantity} onChange={set('quantity')} /></Field>
        <Field label="Unit"><input className={input} list="dl-unit" value={f.unit} onChange={set('unit')} placeholder="tablet" /></Field>
        <Field label="Batch no."><input className={input} value={f.batch_no ?? ''} onChange={set('batch_no')} /></Field>
        <Field label="Expiry date"><input className={input} type="date" value={f.expiry_date} onChange={set('expiry_date')} /></Field>
        <Field label="Reorder level"><input className={input} type="number" min="0" value={f.reorder_level} onChange={set('reorder_level')} /></Field>
        <Field label="Supplier"><input className={input} list="dl-sup" value={f.supplier ?? ''} onChange={set('supplier')} /></Field>
      </div>
      <Field label="Remarks (optional)"><input className={input} value={f.remarks ?? ''} onChange={set('remarks')} /></Field>
      <Err>{err}</Err>
      <Actions onClose={onClose} onSave={save} label="Save medicine" />
    </Modal>
  );
}

export function StockForm({ med, onClose, onSaved }) {
  const [type, setType] = useState('OUT');
  const [f, setF] = useState({ quantity: '', note: '', patient: '', patient_id: '', purpose: '' });
  const [err, setErr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    try { await api(`/api/medicines/${med.id}/stock`, send('POST', { type, ...f })); onSaved('Stock updated'); }
    catch (e) { setErr(e.message); }
  };
  return (
    <Modal title={`Update stock - ${med.name}`} onClose={onClose}>
      <p className="mt-1 text-slate-500">Currently {med.quantity} {med.unit}</p>
      <Field label="Action">
        <select className={input} value={type} onChange={e => setType(e.target.value)}>
          <option value="OUT">Dispense / use (stock out)</option>
          <option value="IN">Receive (stock in)</option>
        </select>
      </Field>
      <Field label="Quantity"><input className={input} type="number" min="1" value={f.quantity} onChange={set('quantity')} /></Field>
      {type === 'OUT' && (
        <>
          <Field label="Patient name (for the dispensing record)"><input className={input} value={f.patient} onChange={set('patient')} /></Field>
          <div className="grid grid-cols-2 gap-x-3">
            <Field label="Patient ID / reference"><input className={input} value={f.patient_id} onChange={set('patient_id')} /></Field>
            <Field label="Purpose / diagnosis"><input className={input} value={f.purpose} onChange={set('purpose')} /></Field>
          </div>
        </>
      )}
      <Field label="Note (optional)"><input className={input} value={f.note} onChange={set('note')} /></Field>
      <Err>{err}</Err>
      <Actions onClose={onClose} onSave={save} label="Save" />
    </Modal>
  );
}

export function Confirm({ title, text, label, onClose, onConfirm }) {
  const [err, setErr] = useState('');
  const go = async () => { try { await onConfirm(); } catch (e) { setErr(e.message); } };
  return (
    <Modal title={title} onClose={onClose}>
      <p className="mt-2 text-slate-600">{text}</p>
      <Err>{err}</Err>
      <Actions onClose={onClose} onSave={go} label={label} tone={danger} />
    </Modal>
  );
}

export function PasswordForm({ onClose, onSaved }) {
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [err, setErr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    if (f.next !== f.again) return setErr('The new passwords do not match.');
    try { await api('/api/me/password', send('POST', { current: f.current, next: f.next })); onSaved('Password changed'); }
    catch (e) { setErr(e.message); }
  };
  return (
    <Modal title="Change my password" onClose={onClose}>
      <Field label="Current password"><input className={input} type="password" value={f.current} onChange={set('current')} /></Field>
      <Field label="New password (min. 6 characters)"><input className={input} type="password" value={f.next} onChange={set('next')} /></Field>
      <Field label="Repeat new password"><input className={input} type="password" value={f.again} onChange={set('again')} /></Field>
      <Err>{err}</Err>
      <Actions onClose={onClose} onSave={save} label="Change password" />
    </Modal>
  );
}
