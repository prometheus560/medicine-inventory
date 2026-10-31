const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database(path.join(__dirname, 'inventory.db'));
db.exec(`CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function validate(b) {
  const name = String(b.name || '').trim();
  const category = String(b.category || '').trim();
  const quantity = Number(b.quantity);
  const price = Number(b.price);
  if (!name || !category) return { error: 'Name and category are required.' };
  if (!Number.isInteger(quantity) || quantity < 0) return { error: 'Quantity must be a whole number ≥ 0.' };
  if (!Number.isFinite(price) || price < 0) return { error: 'Price must be a number ≥ 0.' };
  return { value: { name, category, quantity, price } };
}

// READ all
app.get('/api/items', (req, res) => {
  res.json(db.prepare('SELECT * FROM items ORDER BY id DESC').all());
});

// Dashboard stats
app.get('/api/stats', (req, res) => {
  const totals = db.prepare(
    `SELECT COUNT(*) AS items, COALESCE(SUM(quantity*price),0) AS value,
     COALESCE(SUM(quantity<=5),0) AS lowStock FROM items`).get();
  const byCategory = db.prepare(
    'SELECT category, COUNT(*) AS count FROM items GROUP BY category ORDER BY count DESC').all();
  res.json({ ...totals, byCategory });
});

// CREATE
app.post('/api/items', (req, res) => {
  const { error, value } = validate(req.body);
  if (error) return res.status(400).json({ error });
  const r = db.prepare('INSERT INTO items (name, category, quantity, price) VALUES (@name,@category,@quantity,@price)').run(value);
  res.status(201).json(db.prepare('SELECT * FROM items WHERE id = ?').get(r.lastInsertRowid));
});

// UPDATE
app.put('/api/items/:id', (req, res) => {
  const { error, value } = validate(req.body);
  if (error) return res.status(400).json({ error });
  const r = db.prepare('UPDATE items SET name=@name, category=@category, quantity=@quantity, price=@price WHERE id=@id')
    .run({ ...value, id: req.params.id });
  if (!r.changes) return res.status(404).json({ error: 'Item not found.' });
  res.json(db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id));
});

// DELETE
app.delete('/api/items/:id', (req, res) => {
  const r = db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Item not found.' });
  res.status(204).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Dashboard running at http://localhost:${PORT}`));
