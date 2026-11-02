export const iso = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
export const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
export const when = s => new Date(s.replace(' ', 'T') + 'Z').toLocaleString();
export const status = m => {
  if (m.expiry_date < iso(0)) return ['exp', 'Expired'];
  if (m.expiry_date <= iso(30)) return ['soon', 'Expiring soon'];
  if (m.quantity <= m.reorder_level) return ['low', 'Low stock'];
  return ['ok', 'In stock'];
};
