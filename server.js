'use strict';

const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const { gatePage, page404 } = require('./gate-template');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'egate-dev-secret-change-in-production';
const DIR = __dirname;

// ── Supabase storage/database ─────────────────────────────
// Required on Render:
// SUPABASE_URL=https://xxxxx.supabase.co
// SUPABASE_SERVICE_ROLE_KEY=your service_role key (server-side only)
// SUPABASE_BUCKET=egate (optional, defaults to egate)

function normaliseSupabaseUrl(value) {
  let url = String(value || '').trim();
  // Render/Supabase dashboards sometimes make people copy a REST/Storage URL.
  // The JS client needs only the project base URL: https://PROJECT.supabase.co
  url = url
    .replace(/\/+$/g, '')
    .replace(/\/(rest|storage|auth|realtime|functions)\/v1.*$/i, '')
    .replace(/\/+$/g, '');
  return url;
}

const SUPABASE_URL_RAW = process.env.SUPABASE_URL;
const SUPABASE_URL = normaliseSupabaseUrl(SUPABASE_URL_RAW);
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_BUCKET = String(process.env.SUPABASE_BUCKET || 'egate').trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n[E-gate setup error] Missing Supabase environment variables.');
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Render → Environment.');
  console.error('Then run SUPABASE_SETUP.sql in Supabase SQL Editor and redeploy.\n');
  process.exit(1);
}

try {
  const parsed = new URL(SUPABASE_URL);
  if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname) throw new Error('bad url');
  if (parsed.pathname && parsed.pathname !== '/') {
    throw new Error('SUPABASE_URL should not contain a path');
  }
} catch {
  console.error('\n[E-gate setup error] SUPABASE_URL is invalid.');
  console.error('Use only your Supabase project base URL, for example: https://your-project-ref.supabase.co');
  console.error('Do not use /rest/v1, /storage/v1, anon/public URL, or a dashboard URL.\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket }
});

// ── Single admin account (set via Render environment variables) ──
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@e-gate.local').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Low E';
const ADMIN_ID = 'admin';

// ── Multer: keep upload only in memory, then immediately push to Supabase ──
// No Render Persistent Disk is needed. Do keep files reasonably sized on free hosting.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 350 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'track_file') {
      if (!/\.(wav|mp3|flac|aif{1,2})$/i.test(file.originalname)) {
        return cb(new Error('Only WAV, MP3, FLAC or AIFF files are allowed'));
      }
    } else if (file.fieldname === 'cover_art') {
      if (!/\.(jpe?g|png|webp)$/i.test(file.originalname)) {
        return cb(new Error('Only JPG, PNG or WEBP cover images are allowed'));
      }
    }
    cb(null, true);
  }
});

// ── Middleware ─────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));

const PUBLIC_DIR = path.join(DIR, 'public');

// Serve the dashboard files from /public when that folder exists.
// Also support the GitHub-browser upload case where public files are placed directly in the repo root.
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
}

function sendPage(res, filename) {
  const locations = [path.join(PUBLIC_DIR, filename), path.join(DIR, filename)];
  for (const filePath of locations) {
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
  }
  return res.status(500).send(`Missing ${filename}. Upload the complete E-gate project files to GitHub.`);
}

app.get('/', (req, res) => sendPage(res, 'index.html'));
app.get('/index.html', (req, res) => sendPage(res, 'index.html'));
app.get('/login.html', (req, res) => sendPage(res, 'login.html'));
app.get('/dashboard.html', (req, res) => sendPage(res, 'dashboard.html'));
app.get('/builder.html', (req, res) => sendPage(res, 'builder.html'));
app.get('/stats.html', (req, res) => sendPage(res, 'stats.html'));
app.get('/register.html', (req, res) => sendPage(res, 'register.html'));
app.get('/spotify-callback.html', (req, res) => sendPage(res, 'spotify-callback.html'));
app.get('/style.css', (req, res) => sendPage(res, 'style.css'));
app.get('/chrome-bg.js', (req, res) => sendPage(res, 'chrome-bg.js'));

// ── Auth middleware ────────────────────────────────────────
function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7) : (req.query && req.query.token);
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
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
    view_count: Number(row.view_count || 0),
    complete_count: Number(row.complete_count || 0),
    created_at: toEpoch(row.created_at)
  };
}

function normaliseSubmission(row) {
  if (!row) return row;
  return {
    ...row,
    spotify_verified: !!row.spotify_verified,
    created_at: toEpoch(row.created_at)
  };
}

function parseConfig(config) {
  if (!config) return {};
  if (typeof config === 'object') return config;
  try { return JSON.parse(config); } catch { return {}; }
}

async function makeSlug() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let tries = 0; tries < 40; tries++) {
    const b = crypto.randomBytes(8);
    s = '';
    for (let i = 0; i < 8; i++) s += chars[b[i] % chars.length];
    const { data, error } = await supabase.from('gates').select('id').eq('slug', s).limit(1);
    dbError(error, 'slug check failed');
    if (!data || data.length === 0) return s;
  }
  throw new Error('Could not create a unique gate slug');
}

function cleanDownloadFilename(name, fallback) {
  const raw = String(name || fallback || 'download').trim();
  const cleaned = raw
    .replace(/[\\/\0\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback || 'download';
}

function fallbackTrackFilename(gate) {
  const ext = path.extname(gate.track_file || '').toLowerCase();
  const base = cleanDownloadFilename(gate.track_name || 'download', 'download')
    .replace(/[<>:"|?*]/g, '')
    .trim() || 'download';
  return base + ext;
}

function mimeFromExt(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.flac') return 'audio/flac';
  if (ext === '.aif' || ext === '.aiff') return 'audio/aiff';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function assertSafeStoredFilename(filename) {
  if (!/^[a-f0-9]{36}\.[a-z0-9]+$/i.test(filename || '')) {
    const err = new Error('Invalid file name');
    err.status = 400;
    throw err;
  }
}

async function uploadToSupabase(folder, file) {
  if (!file) return null;
  const ext = path.extname(file.originalname || '').toLowerCase();
  const filename = crypto.randomBytes(18).toString('hex') + ext;
  const objectPath = `${folder}/${filename}`;
  const contentType = file.mimetype || mimeFromExt(file.originalname);

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(objectPath, file.buffer, {
      contentType,
      cacheControl: folder === 'covers' ? '31536000' : '3600',
      upsert: false
    });
  dbError(error, `upload ${objectPath} failed`);

  return {
    filename,
    originalName: cleanDownloadFilename(file.originalname, filename)
  };
}

async function removeStoredFile(folder, filename) {
  if (!filename) return;
  try {
    await supabase.storage.from(SUPABASE_BUCKET).remove([`${folder}/${filename}`]);
  } catch (e) {
    console.warn('[E-gate warning] Could not remove stored file:', folder, filename, e.message);
  }
}

async function downloadStoredFile(folder, filename) {
  assertSafeStoredFilename(filename);
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(`${folder}/${filename}`);
  if (error) {
    const e = new Error(error.message || 'File not found');
    e.status = 404;
    throw e;
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  return { buffer, contentType: data.type || mimeFromExt(filename) };
}

function contentDispositionAttachment(filename) {
  const safe = cleanDownloadFilename(filename, 'download')
    .replace(/["\\]/g, '')
    .replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return '"' + s.replace(/"/g, '""') + '"';
}

function sendCsv(res, filename, rows) {
  const header = ['naam','email','track','gate','soundcloud','comment','instagram','spotify_verified','datum'];
  const lines = [header.map(csvCell).join(',')];
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

async function getGateByIdForUser(id, artistId) {
  const { data, error } = await supabase
    .from('gates')
    .select('*')
    .eq('id', id)
    .eq('artist_id', artistId)
    .maybeSingle();
  dbError(error, 'get gate failed');
  return data;
}

async function getGateBySlug(slug) {
  const { data, error } = await supabase
    .from('gates')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  dbError(error, 'get public gate failed');
  return data;
}

// ── Auth routes: single admin only ────────────────────────
app.post('/api/auth/register', (req, res) => {
  res.status(403).json({ error: 'Registration is disabled. This is a private platform.' });
});

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const emailOk = email.toLowerCase() === ADMIN_EMAIL;
  const passOk = password === ADMIN_PASSWORD;
  if (!emailOk || !passOk) return res.status(401).json({ error: 'Wrong email or password' });

  const token = jwt.sign({ id: ADMIN_ID, name: ADMIN_NAME }, SECRET, { expiresIn: '30d' });
  res.json({ token, name: ADMIN_NAME });
}));

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ id: ADMIN_ID, name: ADMIN_NAME, email: ADMIN_EMAIL });
});

// ── Gate routes ───────────────────────────────────────────
app.get('/api/gates', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('gates')
    .select('id,slug,track_name,artist_name,cover_art,view_count,complete_count,created_at')
    .eq('artist_id', req.user.id)
    .order('created_at', { ascending: false });
  dbError(error, 'list gates failed');
  res.json((data || []).map(normaliseGate));
}));

app.post('/api/gates', requireAuth,
  upload.fields([{ name: 'track_file', maxCount: 1 }, { name: 'cover_art', maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    const { track_name, artist_name, config } = req.body || {};
    if (!track_name?.trim()) return res.status(400).json({ error: 'Track name is required' });

    let cfg;
    try { cfg = JSON.parse(config || '{}'); }
    catch { return res.status(400).json({ error: 'Invalid configuration' }); }

    const tf = req.files?.track_file?.[0];
    if (!tf) return res.status(400).json({ error: 'Track file is required' });
    const ca = req.files?.cover_art?.[0];

    const trackUpload = await uploadToSupabase('tracks', tf);
    const coverUpload = ca ? await uploadToSupabase('covers', ca) : null;

    const id = uid();
    const slug = await makeSlug();
    const row = {
      id,
      artist_id: req.user.id,
      slug,
      track_name: track_name.trim(),
      artist_name: artist_name?.trim() || req.user.name || ADMIN_NAME,
      track_file: trackUpload.filename,
      track_original_name: trackUpload.originalName,
      cover_art: coverUpload ? coverUpload.filename : null,
      config: cfg,
      view_count: 0,
      complete_count: 0
    };

    const { error } = await supabase.from('gates').insert(row);
    if (error) {
      await removeStoredFile('tracks', trackUpload.filename);
      if (coverUpload) await removeStoredFile('covers', coverUpload.filename);
    }
    dbError(error, 'create gate failed');
    res.json({ id, slug });
  })
);

app.get('/api/gates/:id', requireAuth, asyncHandler(async (req, res) => {
  const gate = await getGateByIdForUser(req.params.id, req.user.id);
  if (!gate) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: gate.id,
    slug: gate.slug,
    track_name: gate.track_name,
    artist_name: gate.artist_name,
    has_track: !!gate.track_file,
    track_original_name: gate.track_original_name || null,
    cover_art: gate.cover_art,
    config: parseConfig(gate.config),
    view_count: Number(gate.view_count || 0),
    complete_count: Number(gate.complete_count || 0)
  });
}));

app.put('/api/gates/:id', requireAuth,
  upload.fields([{ name: 'track_file', maxCount: 1 }, { name: 'cover_art', maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    const gate = await getGateByIdForUser(req.params.id, req.user.id);
    if (!gate) return res.status(404).json({ error: 'Not found' });

    const { track_name, artist_name, config } = req.body || {};
    if (!track_name?.trim()) return res.status(400).json({ error: 'Track name is required' });

    let cfg;
    try { cfg = JSON.parse(config || '{}'); }
    catch { return res.status(400).json({ error: 'Invalid configuration' }); }

    const tf = req.files?.track_file?.[0];
    const ca = req.files?.cover_art?.[0];

    let trackFile = gate.track_file;
    let trackOriginalName = gate.track_original_name;
    let coverArt = gate.cover_art;
    let newTrackUpload = null;
    let newCoverUpload = null;

    if (tf) {
      newTrackUpload = await uploadToSupabase('tracks', tf);
      trackFile = newTrackUpload.filename;
      trackOriginalName = newTrackUpload.originalName;
    }
    if (ca) {
      newCoverUpload = await uploadToSupabase('covers', ca);
      coverArt = newCoverUpload.filename;
    }

    const { error } = await supabase
      .from('gates')
      .update({
        track_name: track_name.trim(),
        artist_name: artist_name?.trim() || req.user.name || ADMIN_NAME,
        track_file: trackFile,
        track_original_name: trackOriginalName,
        cover_art: coverArt,
        config: cfg
      })
      .eq('id', gate.id)
      .eq('artist_id', req.user.id);

    if (error) {
      if (newTrackUpload) await removeStoredFile('tracks', newTrackUpload.filename);
      if (newCoverUpload) await removeStoredFile('covers', newCoverUpload.filename);
    }
    dbError(error, 'update gate failed');

    if (newTrackUpload && gate.track_file) await removeStoredFile('tracks', gate.track_file);
    if (newCoverUpload && gate.cover_art) await removeStoredFile('covers', gate.cover_art);

    res.json({ id: gate.id, slug: gate.slug });
  })
);

app.get('/api/gates/:id/submissions', requireAuth, asyncHandler(async (req, res) => {
  const gate = await getGateByIdForUser(req.params.id, req.user.id);
  if (!gate) return res.status(404).json({ error: 'Not found' });
  const { data, error } = await supabase
    .from('submissions')
    .select('id,listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at')
    .eq('gate_id', gate.id)
    .order('created_at', { ascending: false })
    .limit(200);
  dbError(error, 'list submissions failed');
  res.json((data || []).map(normaliseSubmission));
}));

app.get('/api/stats', requireAuth, asyncHandler(async (req, res) => {
  const { data: gatesRaw, error: gatesError } = await supabase
    .from('gates')
    .select('id, slug, track_name, artist_name, cover_art, view_count, complete_count, created_at')
    .eq('artist_id', req.user.id);
  dbError(gatesError, 'stats gates failed');

  const gates = (gatesRaw || []).map(normaliseGate);
  const gateIds = gates.map(g => g.id);
  const gateById = new Map(gates.map(g => [g.id, g]));

  let submissions = [];
  if (gateIds.length) {
    const { data: subsRaw, error: subsError } = await supabase
      .from('submissions')
      .select('listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at,gate_id')
      .in('gate_id', gateIds)
      .order('created_at', { ascending: false })
      .limit(100);
    dbError(subsError, 'stats submissions failed');
    submissions = (subsRaw || []).map(normaliseSubmission).map(s => ({
      ...s,
      track_name: gateById.get(s.gate_id)?.track_name || '',
      slug: gateById.get(s.gate_id)?.slug || ''
    }));
  }

  const totals = gates.reduce((acc, g) => {
    acc.views += Number(g.view_count || 0);
    acc.downloads += Number(g.complete_count || 0);
    return acc;
  }, { gates: gates.length, views: 0, downloads: 0 });
  const conversion = totals.views > 0 ? Math.round((totals.downloads / totals.views) * 100) : 0;
  const perGate = gates
    .slice()
    .sort((a, b) => (b.complete_count - a.complete_count) || (b.view_count - a.view_count));

  res.json({
    totals: { gates: totals.gates, views: totals.views, downloads: totals.downloads, conversion },
    perGate,
    recent: submissions
  });
}));

app.get('/api/mailinglist.csv', requireAuth, asyncHandler(async (req, res) => {
  const { data: gatesRaw, error: gatesError } = await supabase
    .from('gates')
    .select('id, slug, track_name')
    .eq('artist_id', req.user.id);
  dbError(gatesError, 'mailinglist gates failed');

  const gates = gatesRaw || [];
  const gateIds = gates.map(g => g.id);
  const gateById = new Map(gates.map(g => [g.id, g]));
  let rows = [];

  if (gateIds.length) {
    const { data, error } = await supabase
      .from('submissions')
      .select('listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at,gate_id')
      .in('gate_id', gateIds)
      .order('created_at', { ascending: false });
    dbError(error, 'mailinglist submissions failed');
    rows = (data || []).map(normaliseSubmission).map(r => ({
      ...r,
      track_name: gateById.get(r.gate_id)?.track_name || '',
      slug: gateById.get(r.gate_id)?.slug || ''
    }));
  }

  sendCsv(res, 'egate-mailinglist.csv', rows);
}));

app.get('/api/gates/:id/mailinglist.csv', requireAuth, asyncHandler(async (req, res) => {
  const gate = await getGateByIdForUser(req.params.id, req.user.id);
  if (!gate) return res.status(404).json({ error: 'Not found' });

  const { data, error } = await supabase
    .from('submissions')
    .select('listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at')
    .eq('gate_id', gate.id)
    .order('created_at', { ascending: false });
  dbError(error, 'gate mailinglist submissions failed');

  const rows = (data || []).map(normaliseSubmission).map(r => ({
    ...r,
    track_name: gate.track_name,
    slug: gate.slug
  }));
  sendCsv(res, `egate-${gate.id}-mailinglist.csv`, rows);
}));

app.delete('/api/gates/:id', requireAuth, asyncHandler(async (req, res) => {
  const gate = await getGateByIdForUser(req.params.id, req.user.id);
  if (!gate) return res.status(404).json({ error: 'Not found' });

  await removeStoredFile('tracks', gate.track_file);
  await removeStoredFile('covers', gate.cover_art);

  const { error: subError } = await supabase.from('submissions').delete().eq('gate_id', gate.id);
  dbError(subError, 'delete submissions failed');
  const { error: gateError } = await supabase.from('gates').delete().eq('id', gate.id).eq('artist_id', req.user.id);
  dbError(gateError, 'delete gate failed');
  res.json({ ok: true });
}));

// ── Submission from listener gate page ────────────────────
app.post('/api/submit/:slug', asyncHandler(async (req, res) => {
  const gate = await getGateBySlug(req.params.slug);
  if (!gate) return res.status(404).json({ error: 'Gate not found' });

  const { listener_name, listener_email, sc_username, sc_comment, ig_username, spotify_verified } = req.body || {};
  const name = String(listener_name || '').trim();
  const email = String(listener_email || '').trim().toLowerCase();
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Name and a valid email address are required' });
  }

  const { error: insertError } = await supabase.from('submissions').insert({
    id: uid(),
    gate_id: gate.id,
    listener_name: name,
    listener_email: email,
    sc_username: sc_username || null,
    sc_comment: sc_comment || null,
    ig_username: ig_username || null,
    spotify_verified: !!spotify_verified
  });
  dbError(insertError, 'submit listener failed');

  const { error: updateError } = await supabase
    .from('gates')
    .update({ complete_count: Number(gate.complete_count || 0) + 1 })
    .eq('id', gate.id);
  dbError(updateError, 'increment complete count failed');

  res.json({ ok: true });
}));

// ── Public cover image proxy from Supabase Storage ────────
// Kept compatible with the existing frontend path: /uploads/covers/:filename
app.get('/uploads/covers/:filename', asyncHandler(async (req, res) => {
  const { buffer, contentType } = await downloadStoredFile('covers', req.params.filename);
  res.setHeader('Content-Type', contentType || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(buffer);
}));

// ── Public track download ─────────────────────────────────
app.get('/download/:slug', asyncHandler(async (req, res) => {
  const gate = await getGateBySlug(req.params.slug);
  if (!gate || !gate.track_file) return res.status(404).send('Download not found');

  const downloadName = cleanDownloadFilename(gate.track_original_name, fallbackTrackFilename(gate));
  const { buffer, contentType } = await downloadStoredFile('tracks', gate.track_file);

  res.setHeader('Content-Type', contentType || mimeFromExt(downloadName));
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Content-Disposition', contentDispositionAttachment(downloadName));
  res.send(buffer);
}));

// ── Public gate page ──────────────────────────────────────
app.get('/gate/:slug', asyncHandler(async (req, res) => {
  const gate = await getGateBySlug(req.params.slug);
  if (!gate) return res.status(404).send(page404());

  await supabase
    .from('gates')
    .update({ view_count: Number(gate.view_count || 0) + 1 })
    .eq('id', gate.id);

  const cfg = parseConfig(gate.config);
  cfg.artist = gate.artist_name;
  cfg.track = gate.track_name;
  cfg.slug = gate.slug;
  cfg.dlUrl = gate.track_file ? '/download/' + encodeURIComponent(gate.slug) : '';
  cfg.cover = gate.cover_art ? '/uploads/covers/' + gate.cover_art : '';
  cfg.submitUrl = '/api/submit/' + gate.slug;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(gatePage(cfg));
}));

// ── Health check ──────────────────────────────────────────
app.get('/api/health', asyncHandler(async (req, res) => {
  const db = await supabase.from('gates').select('id', { count: 'exact', head: true }).limit(1);
  const storage = await supabase.storage.from(SUPABASE_BUCKET).list('', { limit: 1 });
  res.json({
    ok: !db.error && !storage.error,
    version: '1.0.1-supabase-url-fix',
    storage: 'supabase',
    bucket: SUPABASE_BUCKET,
    supabaseHost: new URL(SUPABASE_URL).host,
    database: db.error ? { ok: false, error: db.error.message } : { ok: true },
    bucketCheck: storage.error ? { ok: false, error: storage.error.message } : { ok: true }
  });
}));

// ── Fallbacks ─────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use((err, req, res, next) => {
  console.error('[E-gate error]', err.message, err.details || '');
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 350 MB)' });
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n  E-GATE running at http://localhost:' + PORT);
  console.log('  Database/storage: Supabase bucket "' + SUPABASE_BUCKET + '"');
  console.log('  Supabase host: ' + new URL(SUPABASE_URL).host + '\n');
});
