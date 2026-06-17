'use strict';

const express    = require('express');
const multer     = require('multer');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const path       = require('path');
const fs         = require('fs');
const { Readable } = require('stream');
const { createClient } = require('@supabase/supabase-js');
const WebSocket  = require('ws');
const nodemailer = require('nodemailer');
const { gatePage, page404, pageInactive } = require('./gate-template');

const app  = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'egate-dev-secret-change-in-production';
const DIR  = __dirname;

// ── Supabase ──────────────────────────────────────────────
function normaliseSupabaseUrl(value) {
  let url = String(value || '').trim();
  url = url
    .replace(/\/+$/g, '')
    .replace(/\/(rest|storage|auth|realtime|functions)\/v1.*$/i, '')
    .replace(/\/+$/g, '');
  return url;
}

const SUPABASE_URL_RAW         = process.env.SUPABASE_URL;
const SUPABASE_URL             = normaliseSupabaseUrl(SUPABASE_URL_RAW);
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_BUCKET          = String(process.env.SUPABASE_BUCKET || 'egate').trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n[E-gate] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n');
  process.exit(1);
}
try {
  const p = new URL(SUPABASE_URL);
  if (!/^https?:$/.test(p.protocol) || !p.hostname) throw new Error();
  if (p.pathname && p.pathname !== '/') throw new Error('No path in SUPABASE_URL');
} catch {
  console.error('\n[E-gate] SUPABASE_URL is invalid. Use: https://your-ref.supabase.co\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket }
});

// ── Single admin account ──────────────────────────────────
const ADMIN_EMAIL    = (process.env.ADMIN_EMAIL    || 'admin@e-gate.local').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD  || 'changeme';
const ADMIN_NAME     = process.env.ADMIN_NAME      || 'Low E';
const ADMIN_ID       = 'admin';

// ── Optional email notifications ──────────────────────────
// Set SMTP_HOST + SMTP_USER + SMTP_PASS in Render to receive download alerts.
let mailer = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  try {
    mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    console.log('[E-gate] Email notifications enabled via', process.env.SMTP_HOST);
  } catch (e) {
    console.warn('[E-gate] Email setup failed:', e.message);
  }
}

async function sendDownloadNotification(gate, sub) {
  if (!mailer) return;
  const to   = process.env.NOTIFY_EMAIL || ADMIN_EMAIL;
  const from = process.env.SMTP_FROM    || `E-gate <${process.env.SMTP_USER}>`;
  try {
    await mailer.sendMail({
      from, to,
      subject: `🎵 Nieuwe download: ${gate.track_name}`,
      text: [
        `${sub.listener_name} (${sub.listener_email}) heeft "${gate.track_name}" gedownload.`,
        '',
        `SoundCloud : ${sub.sc_username  || '—'}`,
        `Instagram  : ${sub.ig_username  || '—'}`,
        `Spotify    : ${sub.spotify_verified ? 'geverifieerd' : 'nee'}`,
        `Comment    : ${sub.sc_comment   || '—'}`,
        '',
        `Gate: ${process.env.APP_URL || ''}  /gate/${gate.slug}`
      ].join('\n')
    });
  } catch (e) {
    console.warn('[E-gate] Notification email failed:', e.message);
  }
}

// ── Rate limiter (in-memory, no Redis needed) ─────────────
// Max 5 submit attempts per IP per 10 minutes.
const rateLimits = new Map();
const RATE_MAX    = 5;
const RATE_WINDOW = 10 * 60 * 1000; // 10 min

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count++;
  return true;
}

// Cleanup stale rate limit entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimits) {
    if (now > entry.resetAt) rateLimits.delete(ip);
  }
}, 15 * 60 * 1000);

// ── Multer ────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 350 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'track_file') {
      if (!/\.(wav|mp3|flac|aif{1,2})$/i.test(file.originalname))
        return cb(new Error('Alleen WAV, MP3, FLAC of AIFF bestanden zijn toegestaan'));
    } else if (file.fieldname === 'cover_art') {
      if (!/\.(jpe?g|png|webp)$/i.test(file.originalname))
        return cb(new Error('Alleen JPG, PNG of WEBP covers zijn toegestaan'));
    }
    cb(null, true);
  }
});

// ── Middleware ────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));

const PUBLIC_DIR = path.join(DIR, 'public');
if (fs.existsSync(PUBLIC_DIR)) app.use(express.static(PUBLIC_DIR));

function sendPage(res, filename) {
  for (const base of [PUBLIC_DIR, DIR]) {
    const p = path.join(base, filename);
    if (fs.existsSync(p)) return res.sendFile(p);
  }
  return res.status(500).send(`Missing ${filename}.`);
}

app.get('/',                   (req, res) => sendPage(res, 'index.html'));
app.get('/index.html',         (req, res) => sendPage(res, 'index.html'));
app.get('/login.html',         (req, res) => sendPage(res, 'login.html'));
app.get('/dashboard.html',     (req, res) => sendPage(res, 'dashboard.html'));
app.get('/builder.html',       (req, res) => sendPage(res, 'builder.html'));
app.get('/stats.html',         (req, res) => sendPage(res, 'stats.html'));
app.get('/register.html',      (req, res) => sendPage(res, 'register.html'));
app.get('/spotify-callback.html', (req, res) => sendPage(res, 'spotify-callback.html'));
app.get('/style.css',          (req, res) => sendPage(res, 'style.css'));
app.get('/chrome-bg.js',       (req, res) => sendPage(res, 'chrome-bg.js'));

// ── Auth middleware ───────────────────────────────────────
function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7) : req.query?.token;
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error: 'Session expired, please log in again' }); }
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ── Utils ─────────────────────────────────────────────────
function uid() { return crypto.randomUUID(); }

function dbError(error, context) {
  if (!error) return;
  const e = new Error((context ? context + ': ' : '') + error.message);
  e.details = error.details;
  e.code = error.code;
  throw e;
}

function toEpoch(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function normaliseGate(row) {
  if (!row) return row;
  return {
    ...row,
    view_count:     Number(row.view_count     || 0),
    complete_count: Number(row.complete_count || 0),
    is_active:      row.is_active !== false,   // default true
    created_at:     toEpoch(row.created_at)
  };
}

function normaliseSubmission(row) {
  if (!row) return row;
  return { ...row, spotify_verified: !!row.spotify_verified, created_at: toEpoch(row.created_at) };
}

function parseConfig(config) {
  if (!config) return {};
  if (typeof config === 'object') return config;
  try { return JSON.parse(config); } catch { return {}; }
}

async function makeSlug() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  for (let tries = 0; tries < 40; tries++) {
    const b = crypto.randomBytes(8);
    let s = '';
    for (let i = 0; i < 8; i++) s += chars[b[i] % chars.length];
    const { data, error } = await supabase.from('gates').select('id').eq('slug', s).limit(1);
    dbError(error, 'slug check');
    if (!data || data.length === 0) return s;
  }
  throw new Error('Could not create a unique slug');
}

function cleanFilename(name, fallback) {
  return String(name || fallback || 'download').trim()
    .replace(/[\\/\0\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim() || fallback || 'download';
}

function fallbackTrackFilename(gate) {
  const ext  = path.extname(gate.track_file || '').toLowerCase();
  const base = cleanFilename(gate.track_name, 'download').replace(/[<>:"|?*]/g, '').trim() || 'download';
  return base + ext;
}

function mimeFromExt(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  if (ext === '.mp3')                    return 'audio/mpeg';
  if (ext === '.wav')                    return 'audio/wav';
  if (ext === '.flac')                   return 'audio/flac';
  if (ext === '.aif' || ext === '.aiff') return 'audio/aiff';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png')                    return 'image/png';
  if (ext === '.webp')                   return 'image/webp';
  return 'application/octet-stream';
}

function assertSafeStoredFilename(filename) {
  if (!/^[a-f0-9]{36,}\.[a-z0-9]+$/i.test(filename || '')) {
    const e = new Error('Invalid file name'); e.status = 400; throw e;
  }
}

function contentDispositionAttachment(filename) {
  const safe    = cleanFilename(filename, 'download').replace(/["\\]/g, '').replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

// ── Supabase Storage helpers ──────────────────────────────
async function uploadToSupabase(folder, file) {
  if (!file) return null;
  const ext      = path.extname(file.originalname || '').toLowerCase();
  const filename = crypto.randomBytes(18).toString('hex') + ext;
  const objPath  = `${folder}/${filename}`;
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(objPath, file.buffer, {
    contentType:  file.mimetype || mimeFromExt(file.originalname),
    cacheControl: folder === 'covers' ? '31536000' : '3600',
    upsert: false
  });
  dbError(error, `upload ${objPath}`);
  return { filename, originalName: cleanFilename(file.originalname, filename) };
}

async function removeStoredFile(folder, filename) {
  if (!filename) return;
  try { await supabase.storage.from(SUPABASE_BUCKET).remove([`${folder}/${filename}`]); }
  catch (e) { console.warn('[E-gate] Could not remove', folder, filename, e.message); }
}

// Stream a private file directly to the response via a short-lived signed URL.
// No full-file buffering needed — handles large WAV files gracefully.
async function streamStoredFile(res, folder, filename, downloadName) {
  assertSafeStoredFilename(filename);
  const objPath = `${folder}/${filename}`;

  // Create signed URL valid for 60 s (only the server uses it immediately)
  const { data: signed, error: signErr } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .createSignedUrl(objPath, 60);
  if (signErr) {
    const e = new Error(signErr.message || 'File not found'); e.status = 404; throw e;
  }

  const upstream = await fetch(signed.signedUrl);
  if (!upstream.ok) {
    const e = new Error('Could not retrieve file from storage'); e.status = 502; throw e;
  }

  const contentType = upstream.headers.get('content-type') || mimeFromExt(filename);
  const contentLen  = upstream.headers.get('content-length');

  res.setHeader('Content-Type', contentType);
  if (contentLen) res.setHeader('Content-Length', contentLen);
  if (downloadName) res.setHeader('Content-Disposition', contentDispositionAttachment(downloadName));

  // Convert Web ReadableStream → Node Readable and pipe
  Readable.fromWeb(upstream.body).pipe(res);
}

// ── DB helpers ────────────────────────────────────────────
async function getGateByIdForUser(id, artistId) {
  const { data, error } = await supabase.from('gates').select('*')
    .eq('id', id).eq('artist_id', artistId).maybeSingle();
  dbError(error, 'get gate');
  return data;
}

async function getGateBySlug(slug) {
  const { data, error } = await supabase.from('gates').select('*')
    .eq('slug', slug).maybeSingle();
  dbError(error, 'get public gate');
  return data;
}

// CSV helper
function csvCell(v) { const s = v == null ? '' : String(v); return '"' + s.replace(/"/g, '""') + '"'; }
function sendCsv(res, filename, rows) {
  const header = ['naam','email','track','gate','soundcloud','comment','instagram','spotify_verified','datum'];
  const lines  = [header.map(csvCell).join(',')];
  rows.forEach(r => lines.push([
    r.listener_name, r.listener_email, r.track_name, r.slug,
    r.sc_username, r.sc_comment, r.ig_username,
    r.spotify_verified ? 'yes' : 'no',
    new Date((r.created_at || 0) * 1000).toISOString()
  ].map(csvCell).join(',')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', contentDispositionAttachment(filename));
  res.send(lines.join('\n'));
}

// ── Auth routes ───────────────────────────────────────────
app.post('/api/auth/register', (req, res) =>
  res.status(403).json({ error: 'Registration is disabled.' })
);

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  if (email.toLowerCase() !== ADMIN_EMAIL || password !== ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Wrong email or password' });
  const token = jwt.sign({ id: ADMIN_ID, name: ADMIN_NAME }, SECRET, { expiresIn: '30d' });
  res.json({ token, name: ADMIN_NAME });
}));

app.get('/api/me', requireAuth, (req, res) =>
  res.json({ id: ADMIN_ID, name: ADMIN_NAME, email: ADMIN_EMAIL })
);

// ── Gate CRUD ─────────────────────────────────────────────
app.get('/api/gates', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('gates')
    .select('id,slug,track_name,artist_name,cover_art,view_count,complete_count,is_active,created_at')
    .eq('artist_id', req.user.id)
    .order('created_at', { ascending: false });
  dbError(error, 'list gates');
  res.json((data || []).map(normaliseGate));
}));

app.post('/api/gates', requireAuth,
  upload.fields([{ name: 'track_file', maxCount: 1 }, { name: 'cover_art', maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    const { track_name, artist_name, config } = req.body || {};
    if (!track_name?.trim()) return res.status(400).json({ error: 'Track name is required' });
    let cfg; try { cfg = JSON.parse(config || '{}'); }
    catch { return res.status(400).json({ error: 'Invalid configuration' }); }
    const tf = req.files?.track_file?.[0];
    if (!tf) return res.status(400).json({ error: 'Track file is required' });
    const ca = req.files?.cover_art?.[0];

    const trackUpload = await uploadToSupabase('tracks', tf);
    const coverUpload = ca ? await uploadToSupabase('covers', ca) : null;

    const id   = uid();
    const slug = await makeSlug();
    const row  = {
      id, artist_id: req.user.id, slug,
      track_name: track_name.trim(),
      artist_name: artist_name?.trim() || ADMIN_NAME,
      track_file: trackUpload.filename,
      track_original_name: trackUpload.originalName,
      cover_art: coverUpload?.filename || null,
      config: cfg,
      view_count: 0, complete_count: 0, is_active: true
    };
    const { error } = await supabase.from('gates').insert(row);
    if (error) {
      await removeStoredFile('tracks', trackUpload.filename);
      if (coverUpload) await removeStoredFile('covers', coverUpload.filename);
    }
    dbError(error, 'create gate');
    res.json({ id, slug });
  })
);

app.get('/api/gates/:id', requireAuth, asyncHandler(async (req, res) => {
  const gate = await getGateByIdForUser(req.params.id, req.user.id);
  if (!gate) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: gate.id, slug: gate.slug, track_name: gate.track_name, artist_name: gate.artist_name,
    has_track: !!gate.track_file, track_original_name: gate.track_original_name || null,
    cover_art: gate.cover_art, config: parseConfig(gate.config),
    view_count: Number(gate.view_count || 0), complete_count: Number(gate.complete_count || 0),
    is_active: gate.is_active !== false
  });
}));

app.put('/api/gates/:id', requireAuth,
  upload.fields([{ name: 'track_file', maxCount: 1 }, { name: 'cover_art', maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    const gate = await getGateByIdForUser(req.params.id, req.user.id);
    if (!gate) return res.status(404).json({ error: 'Not found' });
    const { track_name, artist_name, config } = req.body || {};
    if (!track_name?.trim()) return res.status(400).json({ error: 'Track name is required' });
    let cfg; try { cfg = JSON.parse(config || '{}'); }
    catch { return res.status(400).json({ error: 'Invalid configuration' }); }

    const tf = req.files?.track_file?.[0];
    const ca = req.files?.cover_art?.[0];
    let trackFile = gate.track_file, trackOriginalName = gate.track_original_name, coverArt = gate.cover_art;
    let newTrackUpload = null, newCoverUpload = null;

    if (tf) { newTrackUpload = await uploadToSupabase('tracks', tf); trackFile = newTrackUpload.filename; trackOriginalName = newTrackUpload.originalName; }
    if (ca) { newCoverUpload = await uploadToSupabase('covers', ca); coverArt = newCoverUpload.filename; }

    const { error } = await supabase.from('gates').update({
      track_name: track_name.trim(), artist_name: artist_name?.trim() || ADMIN_NAME,
      track_file: trackFile, track_original_name: trackOriginalName,
      cover_art: coverArt, config: cfg
    }).eq('id', gate.id).eq('artist_id', req.user.id);

    if (error) {
      if (newTrackUpload) await removeStoredFile('tracks', newTrackUpload.filename);
      if (newCoverUpload) await removeStoredFile('covers', newCoverUpload.filename);
    }
    dbError(error, 'update gate');
    if (newTrackUpload && gate.track_file) await removeStoredFile('tracks', gate.track_file);
    if (newCoverUpload && gate.cover_art)  await removeStoredFile('covers', gate.cover_art);
    res.json({ id: gate.id, slug: gate.slug });
  })
);

// ── Toggle gate active/inactive ───────────────────────────
app.patch('/api/gates/:id/toggle', requireAuth, asyncHandler(async (req, res) => {
  const gate = await getGateByIdForUser(req.params.id, req.user.id);
  if (!gate) return res.status(404).json({ error: 'Not found' });
  const newState = !(gate.is_active !== false);
  const { error } = await supabase.from('gates').update({ is_active: newState })
    .eq('id', gate.id).eq('artist_id', req.user.id);
  dbError(error, 'toggle gate');
  res.json({ id: gate.id, is_active: newState });
}));

app.get('/api/gates/:id/submissions', requireAuth, asyncHandler(async (req, res) => {
  const gate = await getGateByIdForUser(req.params.id, req.user.id);
  if (!gate) return res.status(404).json({ error: 'Not found' });
  const { data, error } = await supabase.from('submissions')
    .select('id,listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at')
    .eq('gate_id', gate.id).order('created_at', { ascending: false }).limit(200);
  dbError(error, 'list submissions');
  res.json((data || []).map(normaliseSubmission));
}));

// ── Stats (with 30-day timeline) ──────────────────────────
app.get('/api/stats', requireAuth, asyncHandler(async (req, res) => {
  const { data: gatesRaw, error: gatesError } = await supabase.from('gates')
    .select('id,slug,track_name,artist_name,cover_art,view_count,complete_count,is_active,created_at')
    .eq('artist_id', req.user.id);
  dbError(gatesError, 'stats gates');

  const gates    = (gatesRaw || []).map(normaliseGate);
  const gateIds  = gates.map(g => g.id);
  const gateById = new Map(gates.map(g => [g.id, g]));

  let submissions = [], timelineDays = [];

  if (gateIds.length) {
    const { data: subsRaw, error: subsError } = await supabase.from('submissions')
      .select('listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at,gate_id')
      .in('gate_id', gateIds).order('created_at', { ascending: false }).limit(100);
    dbError(subsError, 'stats submissions');

    submissions = (subsRaw || []).map(normaliseSubmission).map(s => ({
      ...s,
      track_name: gateById.get(s.gate_id)?.track_name || '',
      slug:       gateById.get(s.gate_id)?.slug       || ''
    }));

    // 30-day timeline: group submissions by UTC date
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: tlRaw } = await supabase.from('submissions')
      .select('created_at').in('gate_id', gateIds)
      .gte('created_at', thirtyDaysAgo).order('created_at', { ascending: true });

    const buckets = {};
    (tlRaw || []).forEach(s => {
      const day = new Date(s.created_at).toISOString().slice(0, 10);
      buckets[day] = (buckets[day] || 0) + 1;
    });
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      timelineDays.push({ date: d, count: buckets[d] || 0 });
    }
  } else {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      timelineDays.push({ date: d, count: 0 });
    }
  }

  const totals = gates.reduce((acc, g) => {
    acc.views += Number(g.view_count || 0);
    acc.downloads += Number(g.complete_count || 0);
    return acc;
  }, { gates: gates.length, views: 0, downloads: 0 });
  const conversion = totals.views > 0 ? Math.round((totals.downloads / totals.views) * 100) : 0;
  const perGate    = gates.slice().sort((a, b) =>
    (b.complete_count - a.complete_count) || (b.view_count - a.view_count)
  );

  res.json({ totals: { ...totals, conversion }, perGate, recent: submissions, timeline: timelineDays });
}));

// ── CSV export ────────────────────────────────────────────
app.get('/api/mailinglist.csv', requireAuth, asyncHandler(async (req, res) => {
  const { data: gatesRaw } = await supabase.from('gates').select('id,slug,track_name').eq('artist_id', req.user.id);
  const gates    = gatesRaw || [];
  const gateIds  = gates.map(g => g.id);
  const gateById = new Map(gates.map(g => [g.id, g]));
  let rows = [];
  if (gateIds.length) {
    const { data } = await supabase.from('submissions')
      .select('listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at,gate_id')
      .in('gate_id', gateIds).order('created_at', { ascending: false });
    rows = (data || []).map(normaliseSubmission).map(r => ({
      ...r, track_name: gateById.get(r.gate_id)?.track_name || '', slug: gateById.get(r.gate_id)?.slug || ''
    }));
  }
  sendCsv(res, 'egate-mailinglist.csv', rows);
}));

app.get('/api/gates/:id/mailinglist.csv', requireAuth, asyncHandler(async (req, res) => {
  const gate = await getGateByIdForUser(req.params.id, req.user.id);
  if (!gate) return res.status(404).json({ error: 'Not found' });
  const { data } = await supabase.from('submissions')
    .select('listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at')
    .eq('gate_id', gate.id).order('created_at', { ascending: false });
  const rows = (data || []).map(normaliseSubmission).map(r => ({ ...r, track_name: gate.track_name, slug: gate.slug }));
  sendCsv(res, `egate-${gate.id}-mailinglist.csv`, rows);
}));

app.delete('/api/gates/:id', requireAuth, asyncHandler(async (req, res) => {
  const gate = await getGateByIdForUser(req.params.id, req.user.id);
  if (!gate) return res.status(404).json({ error: 'Not found' });
  await removeStoredFile('tracks', gate.track_file);
  await removeStoredFile('covers', gate.cover_art);
  const { error: se } = await supabase.from('submissions').delete().eq('gate_id', gate.id);
  dbError(se, 'delete submissions');
  const { error: ge } = await supabase.from('gates').delete().eq('id', gate.id).eq('artist_id', req.user.id);
  dbError(ge, 'delete gate');
  res.json({ ok: true });
}));

// ── Listener submission ───────────────────────────────────
app.post('/api/submit/:slug', asyncHandler(async (req, res) => {
  // Rate limit by IP
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Te veel pogingen. Probeer het over 10 minuten opnieuw.' });
  }

  const gate = await getGateBySlug(req.params.slug);
  if (!gate) return res.status(404).json({ error: 'Gate not found' });
  if (gate.is_active === false) return res.status(403).json({ error: 'Gate is gesloten' });

  const { listener_name, listener_email, sc_username, sc_comment, ig_username, spotify_verified } = req.body || {};
  const name  = String(listener_name  || '').trim();
  const email = String(listener_email || '').trim().toLowerCase();
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Name and a valid email address are required' });

  // Duplicate check: same email + same gate → still return a fresh token (re-download ok)
  const { data: existing } = await supabase.from('submissions')
    .select('id').eq('gate_id', gate.id).eq('listener_email', email).maybeSingle();

  if (!existing) {
    // New submission
    const subData = {
      id: uid(), gate_id: gate.id,
      listener_name: name, listener_email: email,
      sc_username: sc_username || null, sc_comment: sc_comment || null,
      ig_username: ig_username || null, spotify_verified: !!spotify_verified
    };
    const { error: insertError } = await supabase.from('submissions').insert(subData);
    dbError(insertError, 'insert submission');

    // Atomic increment (no race condition)
    await supabase.rpc('increment_complete', { gate_id_arg: gate.id });

    // Email notification (fire-and-forget)
    sendDownloadNotification(gate, subData).catch(() => {});
  }

  // Issue a short-lived download token (1 hour)
  const downloadToken = jwt.sign(
    { gate: gate.slug, purpose: 'dl', v: 1 },
    SECRET,
    { expiresIn: '1h' }
  );

  res.json({ ok: true, download_token: downloadToken });
}));

// ── Cover image proxy ─────────────────────────────────────
app.get('/uploads/covers/:filename', asyncHandler(async (req, res) => {
  assertSafeStoredFilename(req.params.filename);
  const { data: signed, error } = await supabase.storage
    .from(SUPABASE_BUCKET).createSignedUrl(`covers/${req.params.filename}`, 3600);
  if (error) return res.status(404).send('Not found');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.redirect(302, signed.signedUrl);
}));

// ── Secure track download ─────────────────────────────────
app.get('/download/:slug', asyncHandler(async (req, res) => {
  // Validate download token
  const token = req.query.token;
  if (!token) return res.status(403).send('Download link ontbreekt. Vul de gate in om je download te ontvangen.');
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(403).send('Download link verlopen of ongeldig. Vul de gate opnieuw in.');
  }
  if (payload.purpose !== 'dl' || payload.gate !== req.params.slug) {
    return res.status(403).send('Ongeldige download link.');
  }

  const gate = await getGateBySlug(req.params.slug);
  if (!gate || !gate.track_file) return res.status(404).send('Download niet gevonden');

  const downloadName = cleanFilename(gate.track_original_name, fallbackTrackFilename(gate));
  await streamStoredFile(res, 'tracks', gate.track_file, downloadName);
}));

// ── Public gate page ──────────────────────────────────────
app.get('/gate/:slug', asyncHandler(async (req, res) => {
  const gate = await getGateBySlug(req.params.slug);
  if (!gate) return res.status(404).send(page404());

  // Show inactive page without incrementing views
  if (gate.is_active === false) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(pageInactive(gate.artist_name, gate.track_name));
  }

  // Atomic view increment
  await supabase.rpc('increment_view', { gate_id_arg: gate.id });

  const cfg    = parseConfig(gate.config);
  cfg.artist   = gate.artist_name;
  cfg.track    = gate.track_name;
  cfg.slug     = gate.slug;
  cfg.dlUrl    = gate.track_file ? '/download/' + encodeURIComponent(gate.slug) : '';
  cfg.cover    = gate.cover_art  ? '/uploads/covers/' + gate.cover_art : '';
  cfg.submitUrl = '/api/submit/' + gate.slug;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(gatePage(cfg));
}));

// ── Health check ──────────────────────────────────────────
app.get('/api/health', asyncHandler(async (req, res) => {
  const db      = await supabase.from('gates').select('id', { count: 'exact', head: true }).limit(1);
  const storage = await supabase.storage.from(SUPABASE_BUCKET).list('', { limit: 1 });
  res.json({
    ok: !db.error && !storage.error,
    version: '1.1.0',
    storage: 'supabase',
    bucket: SUPABASE_BUCKET,
    supabaseHost: new URL(SUPABASE_URL).host,
    emailNotifications: !!mailer,
    database: db.error ? { ok: false, error: db.error.message } : { ok: true },
    bucketCheck: storage.error ? { ok: false, error: storage.error.message } : { ok: true }
  });
}));

// ── Fallbacks ─────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use((err, req, res, next) => {
  console.error('[E-gate error]', err.message, err.details || '');
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Bestand te groot (max 350 MB)' });
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n  E-GATE v1.1.0 running at http://localhost:' + PORT);
  console.log('  Supabase: ' + new URL(SUPABASE_URL).host);
  console.log('  Bucket:   ' + SUPABASE_BUCKET);
  console.log('  Email:    ' + (mailer ? 'enabled' : 'disabled (set SMTP_HOST to enable)') + '\n');
});
