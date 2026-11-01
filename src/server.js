import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { seed } from './seed.js';
import { property, calendar, quote } from './availability.js';
import { financeReport } from './finance.js';
import { runSync, getSyncStatus, startPolling } from './sync/index.js';
import * as V from './views.js';

seed();
const app = express();
const here = path.dirname(fileURLToPath(import.meta.url));
const OWNER_KEY = process.env.OWNER_KEY || 'owner-demo-key';
const sessions = new Set();
app.use(express.json()); app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(here, '..', 'public')));
const cookie = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')));
const today = () => new Date().toISOString().slice(0, 10);
const validInvite = t => db.prepare("SELECT * FROM invite_tokens WHERE token=? AND active=1 AND (expires_at IS NULL OR expires_at > datetime('now'))").get(t);

// Public
app.get('/', (req, res) => res.send(V.publicPage(property(), getSyncStatus())));
app.get('/api/sync-status', (req, res) => res.json(getSyncStatus()));
app.get('/api/availability', (req, res) => {
  const from = req.query.from || today(), to = req.query.to || new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  const days = calendar(from, to);
  // Trusted view gets availability only (no prices)
  res.json({ sync: getSyncStatus(), days: req.query.invite && validInvite(req.query.invite) ? days.map(({ date, available }) => ({ date, available })) : days });
});
app.get('/api/quote', (req, res) => res.json(quote(req.query.checkIn, req.query.checkOut, Number(req.query.guests))));
app.post('/api/bookings', (req, res) => {
  const { checkIn, checkOut, guests, name, email, phone, purpose, message, type } = req.body;
  if (!name || !email) return res.status(400).json({ ok: false, errors: ['Name and email are required.'] });
  const q = quote(checkIn, checkOut, Number(guests));
  if (!q.ok) return res.status(400).json(q);
  const status = type === 'request' ? 'request' : 'inquiry';
  const r = db.prepare('INSERT INTO bookings (property_id,source,status,check_in,check_out,guests,guest_name,guest_email,guest_phone,trip_purpose,message,quoted_total_cents) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(property().id, 'direct', status, checkIn, checkOut, Number(guests), name, email, phone || null, purpose || null, message || null, q.totalCents);
  res.json({ ok: true, id: r.lastInsertRowid, status, quote: q });
});

// Trusted-guest (tokenized, no open booking)
app.get('/trusted/:token', (req, res) => {
  if (!validInvite(req.params.token)) return res.status(404).send(V.layout('Not found', '<main class="wrap"><h1>Link not found or expired</h1></main>', { robots: true }));
  res.send(V.trustedPage(property(), getSyncStatus(), req.params.token));
});
app.post('/api/trusted/:token/inquiry', (req, res) => {
  if (!validInvite(req.params.token)) return res.status(404).json({ ok: false, errors: ['Invalid link'] });
  const { name, email, dates, guests, message } = req.body; const g = Math.min(8, Math.max(1, Number(guests) || 1));
  if (!name || !email) return res.status(400).json({ ok: false, errors: ['Name and email are required.'] });
  db.prepare("INSERT INTO bookings (property_id,source,status,check_in,check_out,guests,guest_name,guest_email,message) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(property().id, 'trusted', 'inquiry', 'TBD', 'TBD', g, name, email, `[dates: ${dates || 'n/a'}] ${message || ''}`);
  res.json({ ok: true });
});

// Owner (private)
const owner = (req, res, next) => sessions.has(cookie(req).owner_session) ? next() : res.status(401).send(V.ownerLogin(false));
const login = (res) => { const s = crypto.randomBytes(24).toString('hex'); sessions.add(s); res.setHeader('Set-Cookie', `owner_session=${s}; HttpOnly; SameSite=Strict; Path=/owner; Max-Age=43200`); };
const keyOk = k => k && k.length === OWNER_KEY.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(OWNER_KEY));
app.get('/owner/login', (req, res) => res.send(V.ownerLogin(false)));
app.post('/owner/login', (req, res) => keyOk(req.body.key) ? (login(res), res.redirect('/owner')) : res.status(401).send(V.ownerLogin(true)));
app.get('/owner/k/:key', (req, res) => keyOk(req.params.key) ? (login(res), res.redirect('/owner')) : res.status(404).send('Not found'));
app.post('/owner/logout', (req, res) => { sessions.delete(cookie(req).owner_session); res.setHeader('Set-Cookie', 'owner_session=; Path=/owner; Max-Age=0'); res.redirect('/owner/login'); });
app.get('/owner', owner, (req, res) => {
  const p = property();
  res.send(V.ownerPage(p, getSyncStatus(), financeReport(p.id),
    db.prepare("SELECT * FROM bookings WHERE source IN ('direct','trusted') AND status IN ('inquiry','request') ORDER BY id DESC LIMIT 50").all(),
    db.prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT 10').all()));
});
app.post('/owner/sync', owner, async (req, res) => { await runSync(); res.redirect('/owner'); });
app.get('/owner/api/finance', owner, (req, res) => res.json(financeReport(property().id)));

const port = Number(process.env.PORT) || 3000;
startPolling();
app.listen(port, () => console.log(`Beach Place running at http://localhost:${port}\nTrusted demo link: /trusted/demo-trusted-7f3k9q\nOwner: /owner/login (key from OWNER_KEY, default "owner-demo-key")`));
