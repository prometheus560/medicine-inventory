const crypto = require('crypto');

module.exports = function setupAuth(app) {
  const USER = process.env.ADMIN_USER || 'admin';
  const PASS = process.env.ADMIN_PASSWORD || 'admin123';
  const salt = crypto.randomBytes(16);
  const passHash = crypto.scryptSync(PASS, salt, 32);
  const sessions = new Map();
  const getSid = req => (/(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '') || [])[1];

  app.post('/api/login', (req, res) => {
    const { username = '', password = '' } = req.body || {};
    const ok = username === USER && crypto.timingSafeEqual(crypto.scryptSync(String(password), salt, 32), passHash);
    if (!ok) return res.status(401).json({ error: 'Wrong username or password.' });
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, { user: USER, exp: Date.now() + 8 * 3600e3 });
    res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
    res.json({ user: USER });
  });

  app.post('/api/logout', (req, res) => {
    sessions.delete(getSid(req));
    res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.status(204).end();
  });

  app.use('/api', (req, res, next) => {
    const s = sessions.get(getSid(req));
    if (!s || s.exp < Date.now()) { sessions.delete(getSid(req)); return res.status(401).json({ error: 'Please sign in.' }); }
    req.user = s.user;
    next();
  });

  app.get('/api/me', (req, res) => res.json({ user: req.user }));
};