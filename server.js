'use strict';

const express      = require('express');
const multer       = require('multer');
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const path         = require('path');
const fs           = require('fs');
const { Readable } = require('stream');
const { createClient } = require('@supabase/supabase-js');
const WebSocket    = require('ws');
const nodemailer   = require('nodemailer');
const { gatePage, page404, pageInactive } = require('./gate-template');

const app  = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'egate-dev-secret-change-in-production';
const DIR  = __dirname;

// ── Supabase ──────────────────────────────────────────────
function normaliseSupabaseUrl(v) {
  let u = String(v || '').trim().replace(/\/+$/, '')
    .replace(/\/(rest|storage|auth|realtime|functions)\/v1.*$/i, '').replace(/\/+$/, '');
  return u;
}
const SUPABASE_URL              = normaliseSupabaseUrl(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_BUCKET           = String(process.env.SUPABASE_BUCKET || 'egate').trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n[E-gate] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY\n'); process.exit(1);
}
try { const p = new URL(SUPABASE_URL); if (!p.hostname) throw 0; } catch {
  console.error('\n[E-gate] Invalid SUPABASE_URL\n'); process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket }
});

// ── Admin ─────────────────────────────────────────────────
const ADMIN_EMAIL    = (process.env.ADMIN_EMAIL    || 'admin@e-gate.local').toLowerCase();
const ADMIN_PASSWORD =  process.env.ADMIN_PASSWORD || 'changeme';
const ADMIN_NAME     =  process.env.ADMIN_NAME     || 'Low E';
const ADMIN_SLUG     = (process.env.ARTIST_SLUG    || ADMIN_NAME).toLowerCase()
                         .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const ADMIN_ID       = 'admin';

// ── Email ─────────────────────────────────────────────────
let mailer = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  try {
    mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    console.log('[E-gate] Email via', process.env.SMTP_HOST);
  } catch(e) { console.warn('[E-gate] Email setup failed:', e.message); }
}

async function sendMail(to, subject, text) {
  if (!mailer) return;
  const from = process.env.SMTP_FROM || `E-gate <${process.env.SMTP_USER}>`;
  try { await mailer.sendMail({ from, to, subject, text }); }
  catch(e) { console.warn('[E-gate] Mail failed:', e.message); }
}

// ── Rate limiter ──────────────────────────────────────────
const rateLimits = new Map();
function checkRateLimit(ip) {
  const now = Date.now(), entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) { rateLimits.set(ip, { count: 1, resetAt: now + 600000 }); return true; }
  if (entry.count >= 5) return false;
  entry.count++; return true;
}
setInterval(() => { const n = Date.now(); for (const [k,v] of rateLimits) if (n > v.resetAt) rateLimits.delete(k); }, 900000);

// ── Multer ────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 350 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'track_file' && !/\.(wav|mp3|flac|aif{1,2})$/i.test(file.originalname))
      return cb(new Error('Alleen WAV, MP3, FLAC of AIFF'));
    if (file.fieldname === 'cover_art' && !/\.(jpe?g|png|webp)$/i.test(file.originalname))
      return cb(new Error('Alleen JPG, PNG of WEBP'));
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
  return res.status(500).send(`Missing ${filename}`);
}

const PAGES = ['index','login','dashboard','builder','stats','register','spotify-callback'];
PAGES.forEach(p => {
  app.get('/' + (p === 'index' ? '' : p + '.html'), (req, res) => sendPage(res, p + '.html'));
  if (p !== 'index') app.get('/' + p + '.html', (req, res) => sendPage(res, p + '.html'));
});
app.get('/index.html', (req, res) => sendPage(res, 'index.html'));
app.get('/style.css',  (req, res) => sendPage(res, 'style.css'));
app.get('/chrome-bg.js', (req, res) => sendPage(res, 'chrome-bg.js'));
app.get('/artist.html',  (req, res) => sendPage(res, 'artist.html'));

// ── Auth ──────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7) : req.query?.token;
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error: 'Session expired' }); }
}
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ── Helpers ───────────────────────────────────────────────
const uid = () => crypto.randomUUID();

function dbError(error, ctx) {
  if (!error) return;
  const e = new Error((ctx ? ctx + ': ' : '') + error.message);
  e.details = error.details; e.code = error.code; throw e;
}

function toEpoch(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  const ms = Date.parse(v); return Number.isFinite(ms) ? Math.floor(ms/1000) : 0;
}

function normGate(r) {
  if (!r) return r;
  return { ...r, view_count: Number(r.view_count||0), complete_count: Number(r.complete_count||0),
           is_active: r.is_active !== false, created_at: toEpoch(r.created_at) };
}
function normSub(r) {
  if (!r) return r;
  return { ...r, spotify_verified: !!r.spotify_verified, created_at: toEpoch(r.created_at) };
}
function parseCfg(c) {
  if (!c) return {};
  if (typeof c === 'object') return c;
  try { return JSON.parse(c); } catch { return {}; }
}

async function makeSlug() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  for (let t = 0; t < 40; t++) {
    const b = crypto.randomBytes(8); let s = '';
    for (let i = 0; i < 8; i++) s += chars[b[i] % chars.length];
    const { data } = await supabase.from('gates').select('id').eq('slug', s).limit(1);
    if (!data?.length) return s;
  }
  throw new Error('Cannot generate unique slug');
}

function cleanName(n, fb) {
  return String(n || fb || 'download').trim().replace(/[\\/\0\r\n\t]/g,' ').replace(/\s+/g,' ').trim() || fb || 'download';
}

function mimeExt(f) {
  const e = path.extname(f||'').toLowerCase();
  const m = {'.mp3':'audio/mpeg','.wav':'audio/wav','.flac':'audio/flac','.aif':'audio/aiff','.aiff':'audio/aiff',
             '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
  return m[e] || 'application/octet-stream';
}

function safeFilename(f) {
  if (!/^[a-f0-9]{36,}\.[a-z0-9]+$/i.test(f||'')) { const e=new Error('Invalid filename'); e.status=400; throw e; }
}

function cdAttachment(name) {
  const safe = cleanName(name,'download').replace(/["\\]/g,'').replace(/[^\x20-\x7E]/g,'_');
  const enc  = encodeURIComponent(name).replace(/['()]/g,escape).replace(/\*/g,'%2A');
  return `attachment; filename="${safe}"; filename*=UTF-8''${enc}`;
}

// ── Storage ───────────────────────────────────────────────
async function uploadFile(folder, file) {
  if (!file) return null;
  const ext  = path.extname(file.originalname||'').toLowerCase();
  const name = crypto.randomBytes(18).toString('hex') + ext;
  const { error } = await supabase.storage.from(SUPABASE_BUCKET)
    .upload(`${folder}/${name}`, file.buffer, {
      contentType: file.mimetype || mimeExt(file.originalname),
      cacheControl: folder==='covers' ? '31536000' : '3600', upsert: false
    });
  dbError(error, `upload ${folder}`);
  return { filename: name, originalName: cleanName(file.originalname, name) };
}

async function removeFile(folder, name) {
  if (!name) return;
  try { await supabase.storage.from(SUPABASE_BUCKET).remove([`${folder}/${name}`]); }
  catch(e) { console.warn('[E-gate] rm failed', folder, name, e.message); }
}

async function streamFile(res, folder, name, dlName) {
  safeFilename(name);
  const { data: s, error } = await supabase.storage.from(SUPABASE_BUCKET)
    .createSignedUrl(`${folder}/${name}`, 60);
  if (error) { const e=new Error('File not found'); e.status=404; throw e; }
  const up = await fetch(s.signedUrl);
  if (!up.ok) { const e=new Error('Storage error'); e.status=502; throw e; }
  res.setHeader('Content-Type', up.headers.get('content-type') || mimeExt(name));
  const cl = up.headers.get('content-length');
  if (cl) res.setHeader('Content-Length', cl);
  if (dlName) res.setHeader('Content-Disposition', cdAttachment(dlName));
  Readable.fromWeb(up.body).pipe(res);
}

// ── DB helpers ────────────────────────────────────────────
async function getGate(id, artistId) {
  const { data, error } = await supabase.from('gates').select('*')
    .eq('id', id).eq('artist_id', artistId).maybeSingle();
  dbError(error); return data;
}
async function getGateBySlug(slug) {
  const { data, error } = await supabase.from('gates').select('*').eq('slug', slug).maybeSingle();
  dbError(error); return data;
}

// CSV
function csvRow(vals) { return vals.map(v => '"' + String(v??'').replace(/"/g,'""') + '"').join(','); }
function sendCsv(res, name, rows) {
  const hdr = ['naam','email','track','gate','soundcloud','comment','instagram','spotify','datum'];
  const lines = [csvRow(hdr), ...rows.map(r => csvRow([
    r.listener_name, r.listener_email, r.track_name, r.slug,
    r.sc_username, r.sc_comment, r.ig_username,
    r.spotify_verified?'yes':'no', new Date((r.created_at||0)*1000).toISOString()
  ]))];
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', cdAttachment(name));
  res.send(lines.join('\n'));
}

// ── Auth routes ───────────────────────────────────────────
app.post('/api/auth/register', (req,res) => res.status(403).json({error:'Registration disabled'}));
app.post('/api/auth/login', asyncHandler(async (req,res) => {
  const { email, password } = req.body || {};
  if (!email||!password) return res.status(400).json({error:'Email and password required'});
  if (email.toLowerCase()!==ADMIN_EMAIL || password!==ADMIN_PASSWORD)
    return res.status(401).json({error:'Wrong email or password'});
  const token = jwt.sign({id:ADMIN_ID,name:ADMIN_NAME}, SECRET, {expiresIn:'30d'});
  res.json({token, name:ADMIN_NAME});
}));
app.get('/api/me', requireAuth, (req,res) => res.json({id:ADMIN_ID,name:ADMIN_NAME,email:ADMIN_EMAIL}));

// ── Gates CRUD ────────────────────────────────────────────
app.get('/api/gates', requireAuth, asyncHandler(async (req,res) => {
  const { data, error } = await supabase.from('gates')
    .select('id,slug,track_name,artist_name,cover_art,view_count,complete_count,is_active,created_at')
    .eq('artist_id', req.user.id).order('created_at',{ascending:false});
  dbError(error); res.json((data||[]).map(normGate));
}));

app.post('/api/gates', requireAuth,
  upload.fields([{name:'track_file',maxCount:1},{name:'cover_art',maxCount:1}]),
  asyncHandler(async (req,res) => {
    const { track_name, artist_name, config } = req.body||{};
    if (!track_name?.trim()) return res.status(400).json({error:'Track name required'});
    let cfg; try { cfg=JSON.parse(config||'{}'); } catch { return res.status(400).json({error:'Invalid config'}); }
    const tf = req.files?.track_file?.[0];
    if (!tf) return res.status(400).json({error:'Track file required'});
    const ca = req.files?.cover_art?.[0];
    const tu = await uploadFile('tracks', tf);
    const cu = ca ? await uploadFile('covers', ca) : null;
    const id = uid(), slug = await makeSlug();
    const row = { id, artist_id:req.user.id, slug,
      track_name:track_name.trim(), artist_name:artist_name?.trim()||ADMIN_NAME,
      track_file:tu.filename, track_original_name:tu.originalName,
      cover_art:cu?.filename||null, config:cfg, view_count:0, complete_count:0, is_active:true };
    const { error } = await supabase.from('gates').insert(row);
    if (error) { await removeFile('tracks',tu.filename); if(cu) await removeFile('covers',cu.filename); }
    dbError(error,'create gate'); res.json({id,slug});
  })
);

app.get('/api/gates/:id', requireAuth, asyncHandler(async (req,res) => {
  const g = await getGate(req.params.id, req.user.id);
  if (!g) return res.status(404).json({error:'Not found'});
  res.json({ id:g.id, slug:g.slug, track_name:g.track_name, artist_name:g.artist_name,
    has_track:!!g.track_file, track_original_name:g.track_original_name||null,
    cover_art:g.cover_art, config:parseCfg(g.config),
    view_count:Number(g.view_count||0), complete_count:Number(g.complete_count||0), is_active:g.is_active!==false });
}));

app.put('/api/gates/:id', requireAuth,
  upload.fields([{name:'track_file',maxCount:1},{name:'cover_art',maxCount:1}]),
  asyncHandler(async (req,res) => {
    const g = await getGate(req.params.id, req.user.id);
    if (!g) return res.status(404).json({error:'Not found'});
    const { track_name, artist_name, config } = req.body||{};
    if (!track_name?.trim()) return res.status(400).json({error:'Track name required'});
    let cfg; try { cfg=JSON.parse(config||'{}'); } catch { return res.status(400).json({error:'Invalid config'}); }
    const tf=req.files?.track_file?.[0], ca=req.files?.cover_art?.[0];
    let trackFile=g.track_file, trackOrig=g.track_original_name, coverArt=g.cover_art;
    let ntu=null, ncu=null;
    if (tf) { ntu=await uploadFile('tracks',tf); trackFile=ntu.filename; trackOrig=ntu.originalName; }
    if (ca) { ncu=await uploadFile('covers',ca); coverArt=ncu.filename; }
    const { error } = await supabase.from('gates').update({
      track_name:track_name.trim(), artist_name:artist_name?.trim()||ADMIN_NAME,
      track_file:trackFile, track_original_name:trackOrig, cover_art:coverArt, config:cfg
    }).eq('id',g.id).eq('artist_id',req.user.id);
    if (error) { if(ntu) await removeFile('tracks',ntu.filename); if(ncu) await removeFile('covers',ncu.filename); }
    dbError(error,'update gate');
    if (ntu&&g.track_file) await removeFile('tracks',g.track_file);
    if (ncu&&g.cover_art)  await removeFile('covers',g.cover_art);
    res.json({id:g.id,slug:g.slug});
  })
);

app.patch('/api/gates/:id/toggle', requireAuth, asyncHandler(async (req,res) => {
  const g = await getGate(req.params.id, req.user.id);
  if (!g) return res.status(404).json({error:'Not found'});
  const newState = !(g.is_active !== false);
  const { error } = await supabase.from('gates').update({is_active:newState}).eq('id',g.id).eq('artist_id',req.user.id);
  dbError(error,'toggle'); res.json({id:g.id, is_active:newState});
}));

app.delete('/api/gates/:id', requireAuth, asyncHandler(async (req,res) => {
  const g = await getGate(req.params.id, req.user.id);
  if (!g) return res.status(404).json({error:'Not found'});
  await removeFile('tracks',g.track_file); await removeFile('covers',g.cover_art);
  await supabase.from('submissions').delete().eq('gate_id',g.id);
  await supabase.from('step_events').delete().eq('gate_id',g.id);
  await supabase.from('referrals').delete().eq('gate_id',g.id);
  const { error } = await supabase.from('gates').delete().eq('id',g.id).eq('artist_id',req.user.id);
  dbError(error,'delete'); res.json({ok:true});
}));

// ── Submissions & CSV ─────────────────────────────────────
app.get('/api/gates/:id/submissions', requireAuth, asyncHandler(async (req,res) => {
  const g = await getGate(req.params.id, req.user.id);
  if (!g) return res.status(404).json({error:'Not found'});
  const { data, error } = await supabase.from('submissions')
    .select('id,listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at')
    .eq('gate_id',g.id).order('created_at',{ascending:false}).limit(200);
  dbError(error); res.json((data||[]).map(normSub));
}));

app.get('/api/mailinglist.csv', requireAuth, asyncHandler(async (req,res) => {
  const { data: gs } = await supabase.from('gates').select('id,slug,track_name').eq('artist_id',req.user.id);
  const gates = gs||[], ids=gates.map(g=>g.id), byId=new Map(gates.map(g=>[g.id,g]));
  let rows=[];
  if (ids.length) {
    const { data } = await supabase.from('submissions')
      .select('listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at,gate_id')
      .in('gate_id',ids).order('created_at',{ascending:false});
    rows=(data||[]).map(normSub).map(r=>({...r,track_name:byId.get(r.gate_id)?.track_name||'',slug:byId.get(r.gate_id)?.slug||''}));
  }
  sendCsv(res,'egate-mailinglist.csv',rows);
}));

app.get('/api/gates/:id/mailinglist.csv', requireAuth, asyncHandler(async (req,res) => {
  const g = await getGate(req.params.id, req.user.id);
  if (!g) return res.status(404).json({error:'Not found'});
  const { data } = await supabase.from('submissions')
    .select('listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at')
    .eq('gate_id',g.id).order('created_at',{ascending:false});
  const rows=(data||[]).map(normSub).map(r=>({...r,track_name:g.track_name,slug:g.slug}));
  sendCsv(res,`egate-${g.slug}-mailinglist.csv`,rows);
}));

// ── Funnel step tracking ──────────────────────────────────
app.post('/api/step-event/:slug', asyncHandler(async (req,res) => {
  const { step_id } = req.body||{};
  if (!step_id) return res.status(400).json({error:'step_id required'});
  const g = await getGateBySlug(req.params.slug);
  if (!g || g.is_active===false) return res.json({ok:true}); // silent
  await supabase.from('step_events').insert({id:uid(), gate_id:g.id, step_id});
  res.json({ok:true});
}));

// Funnel data per gate
app.get('/api/gates/:id/funnel', requireAuth, asyncHandler(async (req,res) => {
  const g = await getGate(req.params.id, req.user.id);
  if (!g) return res.status(404).json({error:'Not found'});
  const { data } = await supabase.from('step_events').select('step_id')
    .eq('gate_id',g.id);
  const counts = {};
  (data||[]).forEach(e => { counts[e.step_id]=(counts[e.step_id]||0)+1; });
  res.json({ gate_id:g.id, view_count:g.view_count, counts });
}));

// ── Stats with timeline + funnel ──────────────────────────
app.get('/api/stats', requireAuth, asyncHandler(async (req,res) => {
  const { data: gRaw, error: gErr } = await supabase.from('gates')
    .select('id,slug,track_name,artist_name,cover_art,view_count,complete_count,is_active,created_at')
    .eq('artist_id',req.user.id);
  dbError(gErr,'stats');
  const gates=gRaw.map(normGate), ids=gates.map(g=>g.id), byId=new Map(gates.map(g=>[g.id,g]));
  let subs=[], timeline=[], funnelTotals={};

  if (ids.length) {
    const { data: sRaw } = await supabase.from('submissions')
      .select('listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at,gate_id')
      .in('gate_id',ids).order('created_at',{ascending:false}).limit(100);
    subs=(sRaw||[]).map(normSub).map(s=>({...s,track_name:byId.get(s.gate_id)?.track_name||'',slug:byId.get(s.gate_id)?.slug||''}));

    // 30-day timeline
    const ago30 = new Date(Date.now()-30*86400000).toISOString();
    const { data: tlRaw } = await supabase.from('submissions').select('created_at').in('gate_id',ids).gte('created_at',ago30);
    const buckets={};
    (tlRaw||[]).forEach(s=>{ const d=new Date(s.created_at).toISOString().slice(0,10); buckets[d]=(buckets[d]||0)+1; });
    for (let i=29;i>=0;i--) {
      const d=new Date(Date.now()-i*86400000).toISOString().slice(0,10);
      timeline.push({date:d, count:buckets[d]||0});
    }

    // Funnel step totals
    const { data: evRaw } = await supabase.from('step_events').select('step_id').in('gate_id',ids);
    (evRaw||[]).forEach(e=>{ funnelTotals[e.step_id]=(funnelTotals[e.step_id]||0)+1; });

    // Referral counts
    const { data: refRaw } = await supabase.from('referrals').select('gate_id,used_count').in('gate_id',ids);
    const refByGate={};
    (refRaw||[]).forEach(r=>{ refByGate[r.gate_id]=(refByGate[r.gate_id]||0)+r.used_count; });
    gates.forEach(g=>{ g.referral_count=refByGate[g.id]||0; });
  } else {
    for (let i=29;i>=0;i--) timeline.push({date:new Date(Date.now()-i*86400000).toISOString().slice(0,10),count:0});
  }

  const totals=gates.reduce((a,g)=>({...a,views:a.views+g.view_count,downloads:a.downloads+g.complete_count}),{gates:gates.length,views:0,downloads:0});
  totals.conversion=totals.views>0?Math.round((totals.downloads/totals.views)*100):0;
  const perGate=gates.slice().sort((a,b)=>(b.complete_count-a.complete_count)||(b.view_count-a.view_count));

  res.json({totals, perGate, recent:subs, timeline, funnelTotals});
}));

// ── Fan wall ──────────────────────────────────────────────
app.get('/api/fan-wall/:slug', asyncHandler(async (req,res) => {
  const g = await getGateBySlug(req.params.slug);
  if (!g || g.is_active===false) return res.json({names:[],total:0});
  const { data, count } = await supabase.from('submissions')
    .select('listener_name', {count:'exact'})
    .eq('gate_id',g.id).not('listener_name','is',null).order('created_at',{ascending:false}).limit(20);
  const names=(data||[]).map(r=>r.listener_name.split(' ')[0]).filter(Boolean);
  res.json({names, total:count||0});
}));

// ── Listener submit ───────────────────────────────────────
app.post('/api/submit/:slug', asyncHandler(async (req,res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'x';
  if (!checkRateLimit(ip)) return res.status(429).json({error:'Te veel pogingen. Wacht 10 minuten.'});

  const g = await getGateBySlug(req.params.slug);
  if (!g) return res.status(404).json({error:'Gate not found'});
  if (g.is_active===false) return res.status(403).json({error:'Gate is gesloten'});

  const cfg = parseCfg(g.config);

  // Secret code check
  if (cfg.secret_code) {
    const submitted = String(req.body?.secret_code||'').trim();
    if (submitted.toLowerCase() !== cfg.secret_code.toLowerCase())
      return res.status(403).json({error:'Verkeerde code. Probeer opnieuw.'});
  }

  // Download limit check
  if (cfg.max_downloads && Number(cfg.max_downloads) > 0 && g.complete_count >= Number(cfg.max_downloads))
    return res.status(410).json({error:`Deze gate is vol. Maximaal ${cfg.max_downloads} downloads bereikt.`});

  const { listener_name, listener_email, sc_username, sc_comment, ig_username, spotify_verified, ref_code } = req.body||{};
  const name  = String(listener_name  || '').trim();
  const email = String(listener_email || '').trim().toLowerCase();
  if (name.length<2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({error:'Name and valid email required'});

  // Duplicate check
  const { data: existing } = await supabase.from('submissions')
    .select('id').eq('gate_id',g.id).eq('listener_email',email).maybeSingle();

  let subId = existing?.id;

  if (!existing) {
    subId = uid();
    const subData = { id:subId, gate_id:g.id, listener_name:name, listener_email:email,
      sc_username:sc_username||null, sc_comment:sc_comment||null, ig_username:ig_username||null,
      spotify_verified:!!spotify_verified, ref_code:ref_code||null };
    const { error: ie } = await supabase.from('submissions').insert(subData);
    dbError(ie,'insert sub');
    await supabase.rpc('increment_complete',{gate_id_arg:g.id});

    // Handle incoming referral: reward the referrer
    if (ref_code) {
      const { data: ref } = await supabase.from('referrals').select('*').eq('referral_code',ref_code).maybeSingle();
      if (ref && ref.gate_id === g.id) {
        await supabase.rpc('increment_referral_used',{code_arg:ref_code});
        // Issue reward token if reward gate is set
        if (cfg.referral_reward_gate_slug) {
          const rewardToken = jwt.sign({gate:cfg.referral_reward_gate_slug,purpose:'dl',v:1},SECRET,{expiresIn:'7d'});
          await supabase.from('referrals').update({reward_token:rewardToken}).eq('referral_code',ref_code);
          // Email referrer if we can find their email
          if (mailer) {
            const { data: refSub } = await supabase.from('submissions').select('listener_email,listener_name').eq('id',ref.referrer_submission_id).maybeSingle();
            if (refSub) {
              const rewardUrl = `${process.env.APP_URL||''}/download/${cfg.referral_reward_gate_slug}?token=${encodeURIComponent(rewardToken)}`;
              await sendMail(refSub.listener_email, '🎁 Jouw exclusieve track is beschikbaar!',
                `Hey ${refSub.listener_name},\n\nIemand heeft jouw link gebruikt om "${g.track_name}" te downloaden!\nAls bedankje krijg je gratis toegang tot de exclusieve track:\n\n${rewardUrl}\n\nLink is 7 dagen geldig.\n\n— E-gate`);
            }
          }
        }
      }
    }

    // Email notification to artist
    if (mailer) {
      sendMail(process.env.NOTIFY_EMAIL||ADMIN_EMAIL,
        `🎵 Nieuwe download: ${g.track_name}`,
        `${name} (${email}) heeft "${g.track_name}" gedownload.\n\nSoundCloud: ${sc_username||'—'}\nSpotify: ${spotify_verified?'ja':'nee'}`
      ).catch(()=>{});
    }
  }

  // Create referral code for this downloader
  let referralCode = null;
  if (cfg.referral_enabled) {
    // Check if they already have one
    const { data: existRef } = await supabase.from('referrals')
      .select('referral_code').eq('gate_id',g.id).eq('referrer_submission_id',subId).maybeSingle();
    if (existRef) {
      referralCode = existRef.referral_code;
    } else {
      referralCode = crypto.randomBytes(6).toString('hex');
      await supabase.from('referrals').insert({id:uid(), gate_id:g.id, referral_code:referralCode, referrer_submission_id:subId});
    }
  }

  const downloadToken = jwt.sign({gate:g.slug,purpose:'dl',v:1}, SECRET, {expiresIn:'1h'});
  res.json({ok:true, download_token:downloadToken, referral_code:referralCode});
}));

// Claim referral reward
app.get('/api/referral/reward/:code', asyncHandler(async (req,res) => {
  const { data: ref } = await supabase.from('referrals')
    .select('reward_token,used_count,gate_id').eq('referral_code',req.params.code).maybeSingle();
  if (!ref) return res.status(404).json({error:'Referral niet gevonden'});
  if (!ref.reward_token) return res.status(404).json({error:'Nog geen beloning beschikbaar. Deel je link eerst!'});
  if (ref.used_count < 1) return res.status(403).json({error:'Nog niemand heeft via jouw link gedownload.'});
  res.json({ok:true, reward_token:ref.reward_token});
}));

// ── Cover proxy ───────────────────────────────────────────
app.get('/uploads/covers/:filename', asyncHandler(async (req,res) => {
  safeFilename(req.params.filename);
  const { data: s, error } = await supabase.storage.from(SUPABASE_BUCKET).createSignedUrl(`covers/${req.params.filename}`,3600);
  if (error) return res.status(404).send('Not found');
  res.setHeader('Cache-Control','public, max-age=3600'); res.redirect(302, s.signedUrl);
}));

// ── Secure download ───────────────────────────────────────
app.get('/download/:slug', asyncHandler(async (req,res) => {
  const token = req.query.token;
  if (!token) return res.status(403).send('Download link ontbreekt. Vul de gate in.');
  let payload;
  try { payload = jwt.verify(token, SECRET); }
  catch { return res.status(403).send('Download link verlopen. Vul de gate opnieuw in.'); }
  if (payload.purpose !== 'dl' || payload.gate !== req.params.slug)
    return res.status(403).send('Ongeldige download link.');

  const g = await getGateBySlug(req.params.slug);
  if (!g || !g.track_file) return res.status(404).send('Niet gevonden');

  const dlName = cleanName(g.track_original_name, (path.basename(g.track_file,'').slice(0,8)) + path.extname(g.track_file));
  await streamFile(res,'tracks',g.track_file,dlName);
}));

// ── Gate page ─────────────────────────────────────────────
app.get('/gate/:slug', asyncHandler(async (req,res) => {
  const g = await getGateBySlug(req.params.slug);
  if (!g) return res.status(404).send(page404());
  if (g.is_active===false) { res.setHeader('Content-Type','text/html; charset=utf-8'); return res.send(pageInactive(g.artist_name,g.track_name)); }

  await supabase.rpc('increment_view',{gate_id_arg:g.id});

  const cfg = parseCfg(g.config);
  // Inject server-side fields
  cfg.artist   = g.artist_name;
  cfg.track    = g.track_name;
  cfg.slug     = g.slug;
  cfg.dlUrl    = g.track_file ? '/download/' + encodeURIComponent(g.slug) : '';
  cfg.cover    = g.cover_art  ? '/uploads/covers/' + g.cover_art : '';
  cfg.submitUrl = '/api/submit/' + g.slug;
  cfg.fan_wall_url = '/api/fan-wall/' + g.slug;
  cfg.downloads_left = (cfg.max_downloads && cfg.max_downloads > 0)
    ? Math.max(0, Number(cfg.max_downloads) - Number(g.complete_count||0)) : null;
  // Security: never send raw secret code to browser
  cfg.has_secret_code = !!cfg.secret_code;
  delete cfg.secret_code;
  // Referral: don't expose reward gate slug
  cfg.referral_has_reward = !!cfg.referral_reward_gate_slug;
  delete cfg.referral_reward_gate_slug;

  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(gatePage(cfg));
}));

// ── Public artist page ────────────────────────────────────
app.get('/artist', asyncHandler(async (req,res) => {
  const { data } = await supabase.from('gates')
    .select('slug,track_name,artist_name,cover_art,complete_count')
    .eq('artist_id',ADMIN_ID).eq('is_active',true).order('created_at',{ascending:false});
  res.json({ name:ADMIN_NAME, slug:ADMIN_SLUG, gates:(data||[]) });
}));
app.get('/' + ADMIN_SLUG, (req,res) => sendPage(res,'artist.html'));

// ── Health ────────────────────────────────────────────────
app.get('/api/health', asyncHandler(async (req,res) => {
  const db = await supabase.from('gates').select('id',{count:'exact',head:true}).limit(1);
  const st = await supabase.storage.from(SUPABASE_BUCKET).list('',{limit:1});
  res.json({ ok:!db.error&&!st.error, version:'2.0.0', storage:'supabase', bucket:SUPABASE_BUCKET,
    supabaseHost:new URL(SUPABASE_URL).host, email:!!mailer,
    database:db.error?{ok:false,error:db.error.message}:{ok:true},
    bucketCheck:st.error?{ok:false,error:st.error.message}:{ok:true} });
}));

// ── Fallbacks ─────────────────────────────────────────────
app.use('/api',(req,res) => res.status(404).json({error:'Endpoint not found'}));
app.use((err,req,res,next) => {
  console.error('[E-gate]',err.message,err.details||'');
  if (err.code==='LIMIT_FILE_SIZE') return res.status(413).json({error:'Bestand te groot (max 350 MB)'});
  if (res.headersSent) return next(err);
  res.status(err.status||500).json({error:err.message||'Server error'});
});

app.listen(PORT,() => {
  console.log('\n  E-GATE v2.0.0  →  http://localhost:'+PORT);
  console.log('  Supabase: '+new URL(SUPABASE_URL).host);
  console.log('  Artist page: /'+ADMIN_SLUG);
  console.log('  Email: '+(mailer?'enabled':'disabled')+'\n');
});
