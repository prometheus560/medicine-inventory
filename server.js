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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function validate(b) {
  const name = String(b.name || '').trim();
  const category = String(b.category || '').trim();
  const unit = String(b.unit || '').trim();
  const batch_no = String(b.batch_no || '').trim();
  const expiry_date = String(b.expiry_date || '').trim();
  const quantity = Number(b.quantity);
  if (!name || !category || !unit) return { error: 'Name, category and unit are required.' };
  if (!Number.isInteger(quantity) || quantity < 0) return { error: 'Quantity must be a whole number ≥ 0.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry_date)) return { error: 'Expiry date is required.' };
  return { value: { name, category, unit, quantity, batch_no, expiry_date } };
}

// READ all
app.get('/api/medicines', (req, res) => {
  res.json(db.prepare('SELECT * FROM medicines ORDER BY expiry_date ASC').all());
});

// Dashboard stats
app.get('/api/stats', (req, res) => {
  const t = db.prepare(`SELECT COUNT(*) AS medicines,
    COALESCE(SUM(quantity),0) AS units,
    COALESCE(SUM(quantity<=10),0) AS lowStock,
    COALESCE(SUM(expiry_date < date('now')),0) AS expired,
    COALESCE(SUM(expiry_date >= date('now') AND expiry_date <= date('now','+30 days')),0) AS expiringSoon
    FROM medicines`).get();
  const byCategory = db.prepare(
    'SELECT category, COUNT(*) AS count FROM medicines GROUP BY category ORDER BY count DESC').all();
  res.json({ ...t, byCategory });
});

// CREATE
app.post('/api/medicines', (req, res) => {
  const { error, value } = validate(req.body);
  if (error) return res.status(400).json({ error });
  const r = db.prepare(`INSERT INTO medicines (name, category, unit, quantity, batch_no, expiry_date)
    VALUES (@name,@category,@unit,@quantity,@batch_no,@expiry_date)`).run(value);
  res.status(201).json(db.prepare('SELECT * FROM medicines WHERE id = ?').get(r.lastInsertRowid));
});

// UPDATE
app.put('/api/medicines/:id', (req, res) => {
  const { error, value } = validate(req.body);
  if (error) return res.status(400).json({ error });
  const r = db.prepare(`UPDATE medicines SET name=@name, category=@category, unit=@unit,
    quantity=@quantity, batch_no=@batch_no, expiry_date=@expiry_date WHERE id=@id`)
    .run({ ...value, id: Number(req.params.id) });
  if (!r.changes) return res.status(404).json({ error: 'Medicine not found.' });
  res.json(db.prepare('SELECT * FROM medicines WHERE id = ?').get(Number(req.params.id)));
});

// DELETE
app.delete('/api/medicines/:id', (req, res) => {
  const r = db.prepare('DELETE FROM medicines WHERE id = ?').run(Number(req.params.id));
  if (!r.changes) return res.status(404).json({ error: 'Medicine not found.' });
  res.status(204).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Medicine inventory running at http://localhost:${PORT}`));