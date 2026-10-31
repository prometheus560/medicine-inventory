const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const app = express();
const db = new DatabaseSync(path.join(__dirname, 'medicines.db'));

db.exec(`CREATE TABLE IF NOT EXISTS medicines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  batch_no TEXT DEFAULT '',
  expiry_date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);
// Upgrade older databases without losing data
const cols = db.prepare('PRAGMA table_info(medicines)').all().map(c => c.name);
if (!cols.includes('reorder_level')) db.exec('ALTER TABLE medicines ADD COLUMN reorder_level INTEGER NOT NULL DEFAULT 10');
if (!cols.includes('supplier')) db.exec("ALTER TABLE medicines ADD COLUMN supplier TEXT DEFAULT ''");
if (!cols.includes('remarks')) db.exec("ALTER TABLE medicines ADD COLUMN remarks TEXT DEFAULT ''");
db.exec(`CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER,
  medicine_name TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const get = id => db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);
const log = (m, type, qty, note) => db.prepare(
  'INSERT INTO transactions (medicine_id, medicine_name, type, quantity, note) VALUES (?,?,?,?,?)'
).run(m.id, m.name, type, qty, note);

function validate(b) {
  const name = String(b.name || '').trim(), category = String(b.category || '').trim(), unit = String(b.unit || '').trim();
  const batch_no = String(b.batch_no || '').trim(), expiry_date = String(b.expiry_date || '').trim();
  const supplier = String(b.supplier || '').trim(), remarks = String(b.remarks || '').trim();
  const quantity = Number(b.quantity);
  const reorder_level = b.reorder_level === '' || b.reorder_level == null ? 10 : Number(b.reorder_level);
  if (!name || !category || !unit) return { error: 'Name, category and unit are required.' };
  if (!Number.isInteger(quantity) || quantity < 0) return { error: 'Quantity must be a whole number ≥ 0.' };
  if (!Number.isInteger(reorder_level) || reorder_level < 0) return { error: 'Reorder level must be a whole number ≥ 0.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry_date)) return { error: 'Expiry date is required.' };
  return { value: { name, category, unit, quantity, reorder_level, batch_no, expiry_date, supplier, remarks } };
}

app.get('/api/medicines', (req, res) => {
  res.json(db.prepare('SELECT * FROM medicines ORDER BY expiry_date ASC').all());
});

app.get('/api/stats', (req, res) => {
  const t = db.prepare(`SELECT COUNT(*) AS medicines,
    COALESCE(SUM(quantity),0) AS units,
    COALESCE(SUM(quantity<=reorder_level),0) AS lowStock,
    COALESCE(SUM(expiry_date < date('now')),0) AS expired,
    COALESCE(SUM(expiry_date >= date('now') AND expiry_date <= date('now','+30 days')),0) AS expiringSoon
    FROM medicines`).get();
  const byCategory = db.prepare('SELECT category, COUNT(*) AS count FROM medicines GROUP BY category ORDER BY count DESC').all();
  res.json({ ...t, byCategory });
});

app.post('/api/medicines', (req, res) => {
  const { error, value } = validate(req.body);
  if (error) return res.status(400).json({ error });
  const r = db.prepare(`INSERT INTO medicines (name, category, unit, quantity, reorder_level, batch_no, expiry_date, supplier, remarks)
    VALUES (@name,@category,@unit,@quantity,@reorder_level,@batch_no,@expiry_date,@supplier,@remarks)`).run(value);
  const m = get(r.lastInsertRowid);
  if (m.quantity > 0) log(m, 'IN', m.quantity, 'Initial stock');
  res.status(201).json(m);
});

app.put('/api/medicines/:id', (req, res) => {
  const id = Number(req.params.id), old = get(id);
  if (!old) return res.status(404).json({ error: 'Medicine not found.' });
  const { error, value } = validate(req.body);
  if (error) return res.status(400).json({ error });
  db.prepare(`UPDATE medicines SET name=@name, category=@category, unit=@unit, quantity=@quantity, reorder_level=@reorder_level,
    batch_no=@batch_no, expiry_date=@expiry_date, supplier=@supplier, remarks=@remarks WHERE id=@id`).run({ ...value, id });
  const diff = value.quantity - old.quantity;
  if (diff !== 0) log({ id, name: value.name }, diff > 0 ? 'IN' : 'OUT', Math.abs(diff), 'Manual edit');
  res.json(get(id));
});

// Stock in / out (dispense) with history
app.post('/api/medicines/:id/stock', (req, res) => {
  const id = Number(req.params.id), m = get(id);
  if (!m) return res.status(404).json({ error: 'Medicine not found.' });
  const type = req.body.type === 'IN' ? 'IN' : req.body.type === 'OUT' ? 'OUT' : null;
  const qty = Number(req.body.quantity), note = String(req.body.note || '').trim();
  if (!type) return res.status(400).json({ error: 'Choose stock in or stock out.' });
  if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: 'Quantity must be a whole number ≥ 1.' });
  if (type === 'OUT' && qty > m.quantity) return res.status(400).json({ error: `Only ${m.quantity} ${m.unit} in stock.` });
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE medicines SET quantity = ? WHERE id = ?').run(type === 'IN' ? m.quantity + qty : m.quantity - qty, id);
    log(m, type, qty, note);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); return res.status(500).json({ error: 'Could not update stock.' }); }
  res.json(get(id));
});

app.get('/api/transactions', (req, res) => {
  res.json(db.prepare('SELECT * FROM transactions ORDER BY id DESC LIMIT 100').all());
});

app.get('/api/export.csv', (req, res) => {
  const rows = db.prepare('SELECT * FROM medicines ORDER BY name').all();
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Name', 'Category', 'Quantity', 'Unit', 'Reorder level', 'Batch no', 'Expiry date', 'Supplier', 'Remarks'];
  const csv = [head.map(q).join(','), ...rows.map(r =>
    [r.name, r.category, r.quantity, r.unit, r.reorder_level, r.batch_no, r.expiry_date, r.supplier, r.remarks].map(q).join(','))].join('\r\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="medicine-inventory.csv"' }).send('\ufeff' + csv);
});

app.delete('/api/medicines/:id', (req, res) => {
  const r = db.prepare('DELETE FROM medicines WHERE id = ?').run(Number(req.params.id));
  if (!r.changes) return res.status(404).json({ error: 'Medicine not found.' });
  res.status(204).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Medicine inventory running at http://localhost:${PORT}`));