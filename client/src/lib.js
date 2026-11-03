export const iso = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
export const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
export const when = s => new Date(s.replace(' ', 'T') + 'Z').toLocaleString();
export const status = m => {
  if (m.expiry_date < iso(0)) return ['exp', 'Expired'];
  if (m.expiry_date <= iso(30)) return ['soon', 'Expiring soon'];
  if (m.quantity <= m.reorder_level) return ['low', 'Low stock'];
  return ['ok', 'In stock'];
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function printSlip(t) {
  const w = window.open('', '_blank', 'width=720,height=800');
  if (!w) return alert('Please allow pop-ups to print the slip.');
  const row = (a, b) => `<tr><td>${a}</td><td>${esc(b || '-')}</td></tr>`;
  w.document.write(`<!doctype html><html><head><title>Dispensing slip</title><style>
body{font-family:'Segoe UI',Arial,sans-serif;margin:40px;color:#111}h1{font-size:20px;margin:0}h2{font-size:15px;margin:4px 0 24px;color:#555;font-weight:normal}
table{border-collapse:collapse;width:100%}td{padding:9px 6px;border-bottom:1px solid #ddd}td:first-child{width:36%;color:#555}
.sig{margin-top:70px;display:flex;justify-content:space-between}.sig div{width:44%;border-top:1px solid #111;padding-top:6px;text-align:center;font-size:13px}
</style></head><body><h1>Medical-Dental Health Unit - San Carlos Campus</h1><h2>Medicine Dispensing Slip</h2><table>
${row('Date and time', when(t.created_at))}${row('Patient', t.patient)}${row('Patient ID / reference', t.patient_id)}${row('Medicine', t.medicine_name)}
${row('Quantity dispensed', t.quantity)}${row('Purpose / diagnosis', t.purpose)}${row('Notes', t.note)}${row('Dispensed by', t.performed_by)}
</table><div class="sig"><div>Patient signature</div><div>Dispensing staff</div></div>
<script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}
