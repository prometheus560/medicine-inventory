const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');

const app = express();
const db = new DatabaseSync(path.join(__dirname, 'medicines.db'));

function ensureSchema(d) {
  const cols = t => d.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
  const add = (t, c, def) => { if (!cols(t).includes(c)) d.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };
  d.exec(`CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL, unit TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0, batch_no TEXT DEFAULT '', expiry_date TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  add('medicines', 'reorder_level', 'INTEGER NOT NULL DEFAULT 10');
  add('medicines', 'supplier', "TEXT DEFAULT ''");
  add('medicines', 'remarks', "TEXT DEFAULT ''");
  d.exec(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, medicine_id INTEGER, medicine_name TEXT NOT NULL, type TEXT NOT NULL,
    quantity INTEGER NOT NULL, note TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  add('transactions', 'performed_by', "TEXT DEFAULT ''");
  add('transactions', 'patient', "TEXT DEFAULT ''");
  add('transactions', 'patient_id', "TEXT DEFAULT ''");
  add('transactions', 'purpose', "TEXT DEFAULT ''");
  d.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE, full_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'staff', password TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  d.exec(`CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, action TEXT NOT NULL, target TEXT DEFAULT '',
    detail TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
}
ensureSchema(db);
function audit(by, action, target = '', detail = '') {
  db.prepare('INSERT INTO audit (username, action, target, detail) VALUES (?,?,?,?)').run(by || 'system', action, String(target), String(detail));
}

/* ---------- passwords & sessions ---------- */
const hashPw = p => { const s = crypto.randomBytes(16).toString('hex'); return s + ':' + crypto.scryptSync(p, s, 32).toString('hex'); };
const checkPw = (p, stored) => {
  const [s, h] = stored.split(':'), a = crypto.scryptSync(p, s, 32), b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
if (!db.prepare('SELECT COUNT(*) AS n FROM users').get().n) {
  db.prepare('INSERT INTO users (username, full_name, role, password) VALUES (?,?,?,?)')
    .run(process.env.ADMIN_USER || 'admin', 'Administrator', 'admin', hashPw(process.env.ADMIN_PASSWORD || 'admin123'));
}
const sessions = new Map();
const getSid = req => (/(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '') || [])[1];
const me = u => ({ user: u.username, name: u.full_name || u.username, role: u.role });
const getUser = id => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const dropSessions = id => { for (const [k, v] of sessions) if (v.id === id) sessions.delete(k); };
const bad = (res, msg) => res.status(400).json({ error: msg });

app.use(express.json());

app.post('/api/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
  if (!u || !u.active || !checkPw(String(password), u.password)) return res.status(401).json({ error: 'Wrong username or password.' });
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, { id: u.id, exp: Date.now() + 8 * 3600e3 });
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
  audit(u.username, 'login');
  res.json(me(u));
});
app.post('/api/logout', (req, res) => {
  sessions.delete(getSid(req));
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.status(204).end();
});
app.use('/api', (req, res, next) => {
  const sid = getSid(req), s = sessions.get(sid);
  const u = s && s.exp > Date.now() ? getUser(s.id) : null;
  if (!u || !u.active) { sessions.delete(sid); return res.status(401).json({ error: 'Please sign in.' }); }
  req.u = u; req.user = u.username;
  next();
});
const admin = (req, res, next) => (req.u.role === 'admin' ? next() : res.status(403).json({ error: 'Only an administrator can do this.' }));

app.get('/api/me', (req, res) => res.json(me(req.u)));
app.post('/api/me/password', (req, res) => {
  const { current = '', next = '' } = req.body || {};
  if (!checkPw(String(current), req.u.password)) return bad(res, 'Current password is wrong.');
  if (String(next).length < 6) return bad(res, 'New password must be at least 6 characters.');
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPw(String(next)), req.u.id);
  audit(req.user, 'change password', req.user);
  res.status(204).end();
});

/* ---------- users (admin only) ---------- */
const userOut = u => ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role, active: !!u.active, created_at: u.created_at });
app.get('/api/users', admin, (req, res) => res.json(db.prepare('SELECT * FROM users ORDER BY id').all().map(userOut)));
app.post('/api/users', admin, (req, res) => {
  const b = req.body || {}, username = String(b.username || '').trim(), pw = String(b.password || '');
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) return bad(res, 'Username must be 3-30 letters, numbers, dot, dash or underscore.');
  if (pw.length < 6) return bad(res, 'Password must be at least 6 characters.');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return bad(res, 'That username is already taken.');
  const r = db.prepare('INSERT INTO users (username, full_name, role, password) VALUES (?,?,?,?)')
    .run(username, String(b.full_name || '').trim(), b.role === 'admin' ? 'admin' : 'staff', hashPw(pw));
  audit(req.user, 'add user', username, b.role === 'admin' ? 'Administrator' : 'Staff');
  res.status(201).json(userOut(getUser(r.lastInsertRowid)));
});
app.put('/api/users/:id', admin, (req, res) => {
  const id = Number(req.params.id), u = getUser(id);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  const b = req.body || {}, role = b.role === 'admin' ? 'admin' : 'staff', active = b.active === false || b.active === 0 ? 0 : 1;
  if (id === req.u.id && (role !== 'admin' || !active)) return bad(res, 'You cannot remove your own admin access.');
  if (b.password && String(b.password).length < 6) return bad(res, 'Password must be at least 6 characters.');
  db.prepare('UPDATE users SET full_name = ?, role = ?, active = ? WHERE id = ?').run(String(b.full_name || '').trim(), role, active, id);
  if (b.password) db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPw(String(b.password)), id);
  if (!active || b.password) dropSessions(id);
  audit(req.user, 'edit user', u.username, `${role}${active ? '' : ', disabled'}${b.password ? ', password reset' : ''}`);
  res.json(userOut(getUser(id)));
});
app.delete('/api/users/:id', admin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.u.id) return bad(res, 'You cannot delete your own account.');
  const gone = getUser(id);
  if (!db.prepare('DELETE FROM users WHERE id = ?').run(id).changes) return res.status(404).json({ error: 'User not found.' });
  audit(req.user, 'delete user', gone.username);
  dropSessions(id);
  res.status(204).end();
});

/* ---------- medicines ---------- */
const dist = path.join(__dirname, 'client', 'dist');
app.use(express.static(fs.existsSync(dist) ? dist : path.join(__dirname, 'public')));

const get = id => db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);
const clip = v => String(v || '').trim().slice(0, 120);
const log = (m, type, qty, note, by = '', x = {}) => db.prepare(
  'INSERT INTO transactions (medicine_id, medicine_name, type, quantity, note, performed_by, patient, patient_id, purpose) VALUES (?,?,?,?,?,?,?,?,?)'
).run(m.id, m.name, type, qty, note, by, x.patient || '', x.patient_id || '', x.purpose || '');
const dup = (name, batch, exceptId = 0) => db.prepare(
  'SELECT 1 FROM medicines WHERE lower(name) = lower(?) AND lower(batch_no) = lower(?) AND id != ?').get(name, batch, exceptId);
const DUP = 'This medicine with the same batch number already exists. Edit it, or use a different batch no.';

function validate(b) {
  const s = k => String(b[k] ?? '').trim();
  const quantity = Number(b.quantity);
  const reorder_level = b.reorder_level === '' || b.reorder_level == null ? 10 : Number(b.reorder_level);
  if (!s('name') || !s('category') || !s('unit')) return { error: 'Name, category and unit are required.' };
  if (!Number.isInteger(quantity) || quantity < 0) return { error: 'Quantity must be a whole number ≥ 0.' };
  if (!Number.isInteger(reorder_level) || reorder_level < 0) return { error: 'Reorder level must be a whole number ≥ 0.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s('expiry_date'))) return { error: 'Expiry date is required.' };
  return { value: { name: s('name'), category: s('category'), unit: s('unit'), quantity, reorder_level, batch_no: s('batch_no'), expiry_date: s('expiry_date'), supplier: s('supplier'), remarks: s('remarks') } };
}

app.get('/api/medicines', (req, res) => res.json(db.prepare('SELECT * FROM medicines ORDER BY expiry_date ASC').all()));

app.get('/api/stats', (req, res) => {
  const t = db.prepare(`SELECT COUNT(*) AS medicines, COALESCE(SUM(quantity),0) AS units,
    COALESCE(SUM(quantity<=reorder_level),0) AS lowStock, COALESCE(SUM(expiry_date < date('now')),0) AS expired,
    COALESCE(SUM(expiry_date >= date('now') AND expiry_date <= date('now','+30 days')),0) AS expiringSoon FROM medicines`).get();
  res.json({ ...t, byCategory: db.prepare('SELECT category, COUNT(*) AS count FROM medicines GROUP BY category ORDER BY count DESC').all() });
});

app.post('/api/medicines', (req, res) => {
  const { error, value } = validate(req.body);
  if (error) return bad(res, error);
  if (dup(value.name, value.batch_no)) return bad(res, DUP);
  const r = db.prepare(`INSERT INTO medicines (name, category, unit, quantity, reorder_level, batch_no, expiry_date, supplier, remarks)
    VALUES (@name,@category,@unit,@quantity,@reorder_level,@batch_no,@expiry_date,@supplier,@remarks)`).run(value);
  const m = get(r.lastInsertRowid);
  audit(req.user, 'add medicine', m.name, `${m.quantity} ${m.unit}` + (m.batch_no ? `, batch ${m.batch_no}` : ''));
  if (m.quantity > 0) log(m, 'IN', m.quantity, 'Initial stock', req.user);
  res.status(201).json(m);
});

app.put('/api/medicines/:id', (req, res) => {
  const id = Number(req.params.id), old = get(id);
  if (!old) return res.status(404).json({ error: 'Medicine not found.' });
  const { error, value } = validate(req.body);
  if (error) return bad(res, error);
  if (dup(value.name, value.batch_no, id)) return bad(res, DUP);
  db.prepare(`UPDATE medicines SET name=@name, category=@category, unit=@unit, quantity=@quantity, reorder_level=@reorder_level,
    batch_no=@batch_no, expiry_date=@expiry_date, supplier=@supplier, remarks=@remarks WHERE id=@id`).run({ ...value, id });
  const diff = value.quantity - old.quantity;
  if (diff !== 0) log({ id, name: value.name }, diff > 0 ? 'IN' : 'OUT', Math.abs(diff), 'Manual edit', req.user);
  const ch = ['name', 'category', 'unit', 'quantity', 'reorder_level', 'batch_no', 'expiry_date', 'supplier', 'remarks']
    .filter(k => String(old[k] ?? '') !== String(value[k] ?? '')).map(k => `${k.replace('_', ' ')}: ${old[k] || '-'} -> ${value[k] || '-'}`).join('; ');
  audit(req.user, 'edit medicine', value.name, ch || 'no changes');
  res.json(get(id));
});

app.post('/api/medicines/:id/stock', (req, res) => {
  const id = Number(req.params.id), m = get(id);
  if (!m) return res.status(404).json({ error: 'Medicine not found.' });
  const type = req.body.type === 'IN' ? 'IN' : req.body.type === 'OUT' ? 'OUT' : null;
  const qty = Number(req.body.quantity), note = String(req.body.note || '').trim();
  if (!type) return bad(res, 'Choose stock in or stock out.');
  if (!Number.isInteger(qty) || qty < 1) return bad(res, 'Quantity must be a whole number ≥ 1.');
  if (type === 'OUT' && qty > m.quantity) return bad(res, `Only ${m.quantity} ${m.unit} in stock.`);
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE medicines SET quantity = ? WHERE id = ?').run(type === 'IN' ? m.quantity + qty : m.quantity - qty, id);
    log(m, type, qty, note, req.user, type === 'OUT' ? { patient: clip(req.body.patient), patient_id: clip(req.body.patient_id), purpose: clip(req.body.purpose) } : {});
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); return res.status(500).json({ error: 'Could not update stock.' }); }
  res.json(get(id));
});

app.get('/api/transactions', (req, res) => res.json(db.prepare('SELECT * FROM transactions ORDER BY id DESC LIMIT 100').all()));

app.get('/api/export.csv', (req, res) => {
  const rows = db.prepare('SELECT * FROM medicines ORDER BY name').all();
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Name', 'Category', 'Quantity', 'Unit', 'Reorder level', 'Batch no', 'Expiry date', 'Supplier', 'Remarks'];
  const csv = [head.map(q).join(','), ...rows.map(r => [r.name, r.category, r.quantity, r.unit, r.reorder_level, r.batch_no, r.expiry_date, r.supplier, r.remarks].map(q).join(','))].join('\r\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="medicine-inventory.csv"' }).send('\ufeff' + csv);
});

app.delete('/api/medicines/:id', admin, (req, res) => {
  const m = get(Number(req.params.id));
  if (!m || !db.prepare('DELETE FROM medicines WHERE id = ?').run(m.id).changes) return res.status(404).json({ error: 'Medicine not found.' });
  audit(req.user, 'delete medicine', m.name, `${m.quantity} ${m.unit} removed`);
  res.status(204).end();
});

/* ---------- activity log and backups ---------- */
app.get('/api/audit', admin, (req, res) => res.json(db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 200').all()));

const BK = path.join(__dirname, 'backups');
fs.mkdirSync(BK, { recursive: true });
const snapshot = file => db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
function autoBackup() {
  try {
    const f = path.join(BK, `auto-${new Date().toISOString().slice(0, 10)}.db`);
    if (!fs.existsSync(f)) snapshot(f);
    fs.readdirSync(BK).filter(n => n.startsWith('auto-')).sort().slice(0, -7).forEach(n => fs.unlinkSync(path.join(BK, n)));
  } catch (e) { console.error('Automatic backup failed:', e.message); }
}
autoBackup();
setInterval(autoBackup, 6 * 3600e3).unref();

app.get('/api/backups', admin, (req, res) => res.json(
  fs.readdirSync(BK).filter(n => n.endsWith('.db')).sort().reverse().map(n => ({ name: n, size: fs.statSync(path.join(BK, n)).size }))));

app.get('/api/backup', admin, (req, res) => {
  const tmp = path.join(os.tmpdir(), `mi-backup-${Date.now()}.db`);
  snapshot(tmp);
  audit(req.user, 'download backup');
  res.download(tmp, `medicine-inventory-backup-${new Date().toISOString().slice(0, 10)}.db`, () => fs.unlink(tmp, () => {}));
});

app.post('/api/restore', admin, express.raw({ type: () => true, limit: '100mb' }), (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length < 100 || buf.subarray(0, 15).toString() !== 'SQLite format 3') return bad(res, 'That file is not a valid backup.');
  const tmp = path.join(os.tmpdir(), `mi-restore-${Date.now()}.db`);
  fs.writeFileSync(tmp, buf);
  try {
    const chk = new DatabaseSync(tmp);
    const has = chk.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'medicines'").get();
    if (has) ensureSchema(chk);
    chk.close();
    if (!has) throw new Error('no medicine data found in this file');
    snapshot(path.join(BK, `before-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.db`));
    db.exec(`ATTACH DATABASE '${tmp.replace(/'/g, "''")}' AS bk`);
    try {
      db.exec('BEGIN');
      db.exec('DELETE FROM transactions; DELETE FROM medicines;');
      db.exec(`INSERT INTO medicines (id, name, category, unit, quantity, batch_no, expiry_date, created_at, reorder_level, supplier, remarks)
        SELECT id, name, category, unit, quantity, batch_no, expiry_date, created_at, reorder_level, supplier, remarks FROM bk.medicines`);
      db.exec(`INSERT INTO transactions (id, medicine_id, medicine_name, type, quantity, note, created_at, performed_by, patient, patient_id, purpose)
        SELECT id, medicine_id, medicine_name, type, quantity, note, created_at, performed_by, patient, patient_id, purpose FROM bk.transactions`);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; } finally { db.exec('DETACH DATABASE bk'); }
    audit(req.user, 'restore backup', '', `${buf.length} bytes`);
    res.json({ ok: true });
  } catch (e) { bad(res, 'Could not restore this file: ' + e.message); }
  finally { fs.unlink(tmp, () => {}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Medicine inventory running at http://localhost:${PORT}`));
