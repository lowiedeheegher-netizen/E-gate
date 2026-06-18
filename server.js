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
const Stripe       = require('stripe');
const { gatePage, page404, pageInactive } = require('./gate-template');

const app  = express();
const PORT = process.env.PORT || 3000;
const SECRET       = process.env.JWT_SECRET || 'egate-dev-secret';
const DIR          = __dirname;
const APP_URL      = (process.env.APP_URL || '').replace(/\/+$/, '');
const TRIAL_DAYS   = 14;

// ── Stripe ────────────────────────────────────────────────
const stripe = process.env.STRIPE_SECRET_KEY
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const STRIPE_PRICE_ID      = process.env.STRIPE_PRICE_ID      || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
if (!stripe) console.warn('[E-gate] Stripe not configured (set STRIPE_SECRET_KEY)');

// ── Supabase ──────────────────────────────────────────────
function normaliseUrl(v) {
  return String(v||'').trim().replace(/\/+$/,'')
    .replace(/\/(rest|storage|auth|realtime|functions)\/v1.*$/i,'').replace(/\/+$/,'');
}
const SUPABASE_URL              = normaliseUrl(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
const SUPABASE_BUCKET           = String(process.env.SUPABASE_BUCKET||'egate').trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[E-gate] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'); process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession:false, autoRefreshToken:false },
  realtime: { transport: WebSocket }
});

// ── Admin (Low E — env-var auth, no Stripe needed) ────────
const ADMIN_EMAIL    = (process.env.ADMIN_EMAIL    || 'admin@e-gate.local').toLowerCase();
const ADMIN_PASSWORD =  process.env.ADMIN_PASSWORD || 'changeme';
const ADMIN_NAME     =  process.env.ADMIN_NAME     || 'Low E';
const ADMIN_SLUG     = (process.env.ARTIST_SLUG    || ADMIN_NAME).toLowerCase()
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

// ── Email ─────────────────────────────────────────────────
let mailer = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  try {
    mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT||'587',10),
      secure: process.env.SMTP_SECURE==='true',
      auth: { user:process.env.SMTP_USER, pass:process.env.SMTP_PASS }
    });
  } catch(e) { console.warn('[E-gate] Email setup failed:', e.message); }
}
async function sendMail(to, subject, text) {
  if (!mailer) return;
  try { await mailer.sendMail({ from:process.env.SMTP_FROM||`E-gate <${process.env.SMTP_USER}>`, to, subject, text }); }
  catch(e) { console.warn('[E-gate] Mail failed:', e.message); }
}

// ── Rate limiter ──────────────────────────────────────────
const rateLimits = new Map();
function checkRateLimit(ip, max=5, windowMs=600000) {
  const now=Date.now(), e=rateLimits.get(ip);
  if (!e||now>e.r) { rateLimits.set(ip,{c:1,r:now+windowMs}); return true; }
  if (e.c>=max) return false;
  e.c++; return true;
}
setInterval(()=>{ const n=Date.now(); for(const[k,v] of rateLimits) if(n>v.r) rateLimits.delete(k); },900000);

// ── Multer ────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(), limits:{fileSize:350*1024*1024},
  fileFilter:(req,file,cb)=>{
    if(file.fieldname==='track_file'&&!/\.(wav|mp3|flac|aif{1,2})$/i.test(file.originalname)) return cb(new Error('Alleen WAV, MP3, FLAC of AIFF'));
    if(file.fieldname==='cover_art'&&!/\.(jpe?g|png|webp)$/i.test(file.originalname)) return cb(new Error('Alleen JPG, PNG of WEBP'));
    cb(null,true);
  }
});

// ── Stripe webhook needs raw body — must come BEFORE express.json ──
app.post('/api/webhooks/stripe', express.raw({type:'application/json'}), async (req,res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.json({ok:true});
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET); }
  catch(e) { return res.status(400).send(`Webhook error: ${e.message}`); }

  try {
    switch(event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId  = session.metadata?.user_id;
        if (userId && session.subscription) {
          await supabase.from('users').update({
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            subscription_status: 'active'
          }).eq('id', userId);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const { data: u } = await supabase.from('users').select('id').eq('stripe_subscription_id', sub.id).maybeSingle();
        if (u) {
          const status = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'canceled';
          await supabase.from('users').update({ subscription_status: status }).eq('id', u.id);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const { data: u } = await supabase.from('users').select('id').eq('stripe_subscription_id', sub.id).maybeSingle();
        if (u) await supabase.from('users').update({ subscription_status:'canceled' }).eq('id', u.id);
        break;
      }
      case 'invoice.paid': {
        const inv = event.data.object;
        const { data: u } = await supabase.from('users').select('id').eq('stripe_customer_id', inv.customer).maybeSingle();
        await supabase.from('payments').insert({
          id: uid(), user_id: u?.id||null,
          stripe_invoice_id: inv.id,
          amount_cents: inv.amount_paid,
          currency: inv.currency,
          status: 'paid',
          period_start: inv.lines?.data?.[0]?.period?.start ? new Date(inv.lines.data[0].period.start*1000).toISOString() : null,
          period_end:   inv.lines?.data?.[0]?.period?.end   ? new Date(inv.lines.data[0].period.end*1000).toISOString()   : null
        });
        // Notify admin
        if (mailer) sendMail(process.env.NOTIFY_EMAIL||ADMIN_EMAIL,
          `💰 E-gate betaling: €${(inv.amount_paid/100).toFixed(2)}`,
          `Nieuwe betaling ontvangen.\nArtiest: ${inv.customer_email||'onbekend'}\nBedrag: €${(inv.amount_paid/100).toFixed(2)}\n`
        ).catch(()=>{});
        break;
      }
    }
  } catch(e) { console.error('[E-gate] Webhook handler error:', e.message); }

  res.json({received:true});
});

// ── Middleware ────────────────────────────────────────────
app.use(express.json({limit:'2mb'}));
const PUBLIC_DIR = path.join(DIR, 'public');
if (fs.existsSync(PUBLIC_DIR)) app.use(express.static(PUBLIC_DIR));

function sendPage(res,filename) {
  for(const base of [PUBLIC_DIR,DIR]) { const p=path.join(base,filename); if(fs.existsSync(p)) return res.sendFile(p); }
  return res.status(500).send(`Missing ${filename}`);
}
const PAGES = ['index','login','dashboard','builder','stats','register','spotify-callback','charts','admin','billing'];
PAGES.forEach(p => {
  const route = p==='index' ? '/' : '/'+p+'.html';
  app.get(route, (req,res)=>sendPage(res,p+'.html'));
  if (p!=='index') app.get('/'+p+'.html',(req,res)=>sendPage(res,p+'.html'));
});
app.get('/index.html',(req,res)=>sendPage(res,'index.html'));
app.get('/style.css',(req,res)=>sendPage(res,'style.css'));
app.get('/chrome-bg.js',(req,res)=>sendPage(res,'chrome-bg.js'));
app.get('/artist.html',(req,res)=>sendPage(res,'artist.html'));

// ── Auth helpers ──────────────────────────────────────────
function requireAuth(req,res,next) {
  const h=req.headers.authorization;
  const token=h?.startsWith('Bearer ')?h.slice(7):req.query?.token;
  if(!token) return res.status(401).json({error:'Not logged in'});
  try { req.user=jwt.verify(token,SECRET); next(); }
  catch { res.status(401).json({error:'Session expired'}); }
}
function requireAdmin(req,res,next) {
  if(req.user?.role!=='admin') return res.status(403).json({error:'Admin only'});
  next();
}
function asyncHandler(fn) { return (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next); }

// Subscription check: trial or active required to create/edit gates
async function requireSubscription(req,res,next) {
  if(req.user.role==='admin') return next();
  const { data:u } = await supabase.from('users').select('subscription_status,trial_ends_at').eq('id',req.user.id).maybeSingle();
  if (!u) return res.status(401).json({error:'Account niet gevonden'});
  const isPro = u.subscription_status==='active' || (u.subscription_status==='trial' && new Date(u.trial_ends_at)>new Date());
  if (isPro) return next();
  // Free plan: allow 1 gate
  const { count } = await supabase.from('gates').select('*',{count:'exact',head:true}).eq('artist_id',req.user.id);
  if ((count||0) < 1) return next(); // First gate always free
  return res.status(402).json({error:'Free plan limiet bereikt (1 gate). Upgrade naar Pro voor onbeperkte gates.',code:'UPGRADE_REQUIRED'});
}

// ── Utility ───────────────────────────────────────────────
const uid=()=>crypto.randomUUID();
function dbError(e,ctx){ if(!e)return; const err=new Error((ctx?ctx+': ':'')+e.message); err.details=e.details; err.code=e.code; throw err; }
function toEpoch(v){if(!v)return 0;if(typeof v==='number')return v;const ms=Date.parse(v);return Number.isFinite(ms)?Math.floor(ms/1000):0;}
function normGate(r){if(!r)return r;return{...r,view_count:Number(r.view_count||0),complete_count:Number(r.complete_count||0),is_active:r.is_active!==false,created_at:toEpoch(r.created_at)};}
function normSub(r){if(!r)return r;return{...r,spotify_verified:!!r.spotify_verified,created_at:toEpoch(r.created_at)};}
function parseCfg(c){if(!c)return{};if(typeof c==='object')return c;try{return JSON.parse(c);}catch{return{};}}
function cleanName(n,fb){return String(n||fb||'download').trim().replace(/[\\/\0\r\n\t]/g,' ').replace(/\s+/g,' ').trim()||fb||'download';}
function mimeExt(f){const e=path.extname(f||'').toLowerCase();return({'.mp3':'audio/mpeg','.wav':'audio/wav','.flac':'audio/flac','.aif':'audio/aiff','.aiff':'audio/aiff','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'})[e]||'application/octet-stream';}
function safeFilename(f){if(!/^[a-f0-9]{36,}\.[a-z0-9]+$/i.test(f||'')){const e=new Error('Invalid filename');e.status=400;throw e;}}
function cdAttachment(n){const safe=cleanName(n,'download').replace(/["\\]/g,'').replace(/[^\x20-\x7E]/g,'_');const enc=encodeURIComponent(n).replace(/['()]/g,escape).replace(/\*/g,'%2A');return `attachment; filename="${safe}"; filename*=UTF-8''${enc}`;}

// Password hashing with built-in crypto (no bcrypt needed)
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key  = await new Promise((res,rej)=>crypto.scrypt(password,salt,64,(e,k)=>e?rej(e):res(k)));
  return `${salt}:${key.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [salt,hash]=stored.split(':');
  if(!salt||!hash) return false;
  const key = await new Promise((res,rej)=>crypto.scrypt(password,salt,64,(e,k)=>e?rej(e):res(k)));
  try { return crypto.timingSafeEqual(Buffer.from(hash,'hex'),key); } catch { return false; }
}

// Artist slug generation
function slugify(s) {
  return String(s||'').toLowerCase()
    .replace(/[àáâãäå]/g,'a').replace(/[èéêë]/g,'e').replace(/[ìíîï]/g,'i').replace(/[òóôõö]/g,'o').replace(/[ùúûü]/g,'u')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'artist';
}
async function makeArtistSlug(name) {
  const base=slugify(name);
  for(let i=0;i<50;i++){
    const slug=i===0?base:`${base}-${i+1}`;
    // Check admin slug too
    if(slug===ADMIN_SLUG){continue;}
    const{data}=await supabase.from('users').select('id').eq('artist_slug',slug).maybeSingle();
    if(!data) return slug;
  }
  return base+'-'+Date.now().toString(36);
}

async function makeGateSlug() {
  const chars='abcdefghjkmnpqrstuvwxyz23456789';
  for(let t=0;t<40;t++){
    const b=crypto.randomBytes(8);let s='';
    for(let i=0;i<8;i++) s+=chars[b[i]%chars.length];
    const{data}=await supabase.from('gates').select('id').eq('slug',s).limit(1);
    if(!data?.length) return s;
  }
  throw new Error('Cannot generate unique slug');
}

// ── Storage ───────────────────────────────────────────────
async function uploadFile(folder,file){
  if(!file) return null;
  const ext=path.extname(file.originalname||'').toLowerCase();
  const name=crypto.randomBytes(18).toString('hex')+ext;
  const{error}=await supabase.storage.from(SUPABASE_BUCKET).upload(`${folder}/${name}`,file.buffer,{contentType:file.mimetype||mimeExt(file.originalname),cacheControl:folder==='covers'?'31536000':'3600',upsert:false});
  dbError(error,`upload ${folder}`);
  return{filename:name,originalName:cleanName(file.originalname,name)};
}
async function removeFile(folder,name){if(!name)return;try{await supabase.storage.from(SUPABASE_BUCKET).remove([`${folder}/${name}`]);}catch(e){console.warn('[E-gate] rm',folder,name,e.message);}}
async function streamFile(res,folder,name,dlName){
  safeFilename(name);
  const{data:s,error}=await supabase.storage.from(SUPABASE_BUCKET).createSignedUrl(`${folder}/${name}`,60);
  if(error){const e=new Error('File not found');e.status=404;throw e;}
  const up=await fetch(s.signedUrl);
  if(!up.ok){const e=new Error('Storage error');e.status=502;throw e;}
  res.setHeader('Content-Type',up.headers.get('content-type')||mimeExt(name));
  const cl=up.headers.get('content-length');if(cl)res.setHeader('Content-Length',cl);
  if(dlName)res.setHeader('Content-Disposition',cdAttachment(dlName));
  Readable.fromWeb(up.body).pipe(res);
}

// ── DB helpers ────────────────────────────────────────────
async function getGate(id,artistId){
  const{data,error}=await supabase.from('gates').select('*').eq('id',id).eq('artist_id',artistId).maybeSingle();
  dbError(error); return data;
}
async function getGateBySlug(slug){
  const{data,error}=await supabase.from('gates').select('*').eq('slug',slug).maybeSingle();
  dbError(error); return data;
}
async function getUser(id){
  const{data}=await supabase.from('users').select('*').eq('id',id).maybeSingle();
  return data;
}
async function getSimilarGates(gateId, genre) {
  const{data}=await supabase.rpc('similar_gates',{current_id:gateId,genre_arg:genre||null,lim:3});
  return data||[];
}

function csvRow(vals){return vals.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',');}
function sendCsv(res,name,rows){
  const hdr=['naam','email','track','gate','soundcloud','comment','instagram','spotify','datum'];
  const lines=[csvRow(hdr),...rows.map(r=>csvRow([r.listener_name,r.listener_email,r.track_name,r.slug,r.sc_username,r.sc_comment,r.ig_username,r.spotify_verified?'yes':'no',new Date((r.created_at||0)*1000).toISOString()]))];
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition',cdAttachment(name));
  res.send(lines.join('\n'));
}

// ── Registration ──────────────────────────────────────────
app.post('/api/auth/register', asyncHandler(async(req,res)=>{
  const ip=req.headers['x-forwarded-for']?.split(',')[0]?.trim()||req.socket.remoteAddress||'x';
  if(!checkRateLimit(ip+':reg',3,3600000)) return res.status(429).json({error:'Te veel pogingen. Probeer over een uur opnieuw.'});
  const{email,password,name,artist_name}=req.body||{};
  if(!email||!password||!name||!artist_name) return res.status(400).json({error:'Alle velden zijn verplicht'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:'Ongeldig e-mailadres'});
  if(password.length<8) return res.status(400).json({error:'Wachtwoord moet minstens 8 tekens zijn'});
  if(email.toLowerCase()===ADMIN_EMAIL) return res.status(409).json({error:'E-mailadres al in gebruik'});
  const{data:existing}=await supabase.from('users').select('id').eq('email',email.toLowerCase()).maybeSingle();
  if(existing) return res.status(409).json({error:'E-mailadres al in gebruik'});
  const passwordHash=await hashPassword(password);
  const artistSlug=await makeArtistSlug(artist_name);
  const id=uid();
  const{error}=await supabase.from('users').insert({
    id, email:email.toLowerCase(), password_hash:passwordHash,
    name:name.trim(), artist_name:artist_name.trim(), artist_slug:artistSlug,
    subscription_status:'trial', trial_ends_at:new Date(Date.now()+TRIAL_DAYS*86400000).toISOString()
  });
  dbError(error,'register');
  const token=jwt.sign({id,name:name.trim(),role:'artist'},SECRET,{expiresIn:'30d'});
  // Notify admin
  sendMail(process.env.NOTIFY_EMAIL||ADMIN_EMAIL,`🎤 Nieuwe artiest: ${artist_name}`,`${name} (${email}) heeft zich geregistreerd.\nArtiest: ${artist_name}\nSlug: ${artistSlug}\n`).catch(()=>{});
  res.json({token,name:name.trim(),artist_name:artist_name.trim(),artist_slug:artistSlug,subscription_status:'trial',trial_days_left:TRIAL_DAYS});
}));

// ── Login ─────────────────────────────────────────────────
app.post('/api/auth/login', asyncHandler(async(req,res)=>{
  const{email,password}=req.body||{};
  if(!email||!password) return res.status(400).json({error:'Email en wachtwoord zijn verplicht'});
  // Admin check
  if(email.toLowerCase()===ADMIN_EMAIL && password===ADMIN_PASSWORD) {
    const token=jwt.sign({id:'admin',name:ADMIN_NAME,role:'admin'},SECRET,{expiresIn:'30d'});
    return res.json({token,name:ADMIN_NAME,role:'admin',subscription_status:'active'});
  }
  // Artist check
  const{data:u}=await supabase.from('users').select('*').eq('email',email.toLowerCase()).maybeSingle();
  if(!u) return res.status(401).json({error:'Onbekend e-mailadres of fout wachtwoord'});
  const valid=await verifyPassword(password,u.password_hash);
  if(!valid) return res.status(401).json({error:'Onbekend e-mailadres of fout wachtwoord'});
  const token=jwt.sign({id:u.id,name:u.name,role:'artist'},SECRET,{expiresIn:'30d'});
  const trialLeft=u.subscription_status==='trial'?Math.max(0,Math.ceil((new Date(u.trial_ends_at)-Date.now())/86400000)):null;
  res.json({token,name:u.name,artist_name:u.artist_name,artist_slug:u.artist_slug,role:'artist',subscription_status:u.subscription_status,trial_days_left:trialLeft});
}));

app.get('/api/me', requireAuth, asyncHandler(async(req,res)=>{
  if(req.user.role==='admin') return res.json({id:'admin',name:ADMIN_NAME,email:ADMIN_EMAIL,role:'admin',subscription_status:'active'});
  const u=await getUser(req.user.id);
  if(!u) return res.status(404).json({error:'Not found'});
  const trialLeft=u.subscription_status==='trial'?Math.max(0,Math.ceil((new Date(u.trial_ends_at)-Date.now())/86400000)):null;
  res.json({id:u.id,name:u.name,email:u.email,artist_name:u.artist_name,artist_slug:u.artist_slug,role:'artist',subscription_status:u.subscription_status,trial_days_left:trialLeft});
}));

// ── Gates CRUD ────────────────────────────────────────────
app.get('/api/gates', requireAuth, asyncHandler(async(req,res)=>{
  const artistId=req.user.role==='admin'?'admin':req.user.id;
  const{data,error}=await supabase.from('gates')
    .select('id,slug,track_name,artist_name,cover_art,view_count,complete_count,is_active,genre,created_at')
    .eq('artist_id',artistId).order('created_at',{ascending:false});
  dbError(error); res.json((data||[]).map(normGate));
}));

app.post('/api/gates', requireAuth, requireSubscription,
  upload.fields([{name:'track_file',maxCount:1},{name:'cover_art',maxCount:1}]),
  asyncHandler(async(req,res)=>{
    const{track_name,artist_name,config}=req.body||{};
    if(!track_name?.trim()) return res.status(400).json({error:'Track naam verplicht'});
    let cfg; try{cfg=JSON.parse(config||'{}')}catch{return res.status(400).json({error:'Ongeldige config'});}
    const tf=req.files?.track_file?.[0]; if(!tf) return res.status(400).json({error:'Track bestand verplicht'});
    const ca=req.files?.cover_art?.[0];
    const tu=await uploadFile('tracks',tf), cu=ca?await uploadFile('covers',ca):null;
    const id=uid(), slug=await makeGateSlug();
    const artistId=req.user.role==='admin'?'admin':req.user.id;
    const artistDisplayName=artist_name?.trim()||(req.user.role==='admin'?ADMIN_NAME:req.user.name);
    const row={id,artist_id:artistId,slug,track_name:track_name.trim(),artist_name:artistDisplayName,
      track_file:tu.filename,track_original_name:tu.originalName,cover_art:cu?.filename||null,
      config:cfg,view_count:0,complete_count:0,is_active:true,
      genre:cfg.genre||null, sc_preview_url:cfg.sc_preview_url||null};
    const{error}=await supabase.from('gates').insert(row);
    if(error){await removeFile('tracks',tu.filename);if(cu)await removeFile('covers',cu.filename);}
    dbError(error,'create gate'); res.json({id,slug});
  })
);

app.get('/api/gates/:id', requireAuth, asyncHandler(async(req,res)=>{
  const artistId=req.user.role==='admin'?'admin':req.user.id;
  const g=await getGate(req.params.id,artistId);
  if(!g) return res.status(404).json({error:'Not found'});
  res.json({id:g.id,slug:g.slug,track_name:g.track_name,artist_name:g.artist_name,has_track:!!g.track_file,track_original_name:g.track_original_name||null,cover_art:g.cover_art,config:parseCfg(g.config),view_count:Number(g.view_count||0),complete_count:Number(g.complete_count||0),is_active:g.is_active!==false,genre:g.genre||null});
}));

app.put('/api/gates/:id', requireAuth, requireSubscription,
  upload.fields([{name:'track_file',maxCount:1},{name:'cover_art',maxCount:1}]),
  asyncHandler(async(req,res)=>{
    const artistId=req.user.role==='admin'?'admin':req.user.id;
    const g=await getGate(req.params.id,artistId);
    if(!g) return res.status(404).json({error:'Not found'});
    const{track_name,artist_name,config}=req.body||{};
    if(!track_name?.trim()) return res.status(400).json({error:'Track naam verplicht'});
    let cfg; try{cfg=JSON.parse(config||'{}')}catch{return res.status(400).json({error:'Ongeldige config'});}
    const tf=req.files?.track_file?.[0], ca=req.files?.cover_art?.[0];
    let trackFile=g.track_file,trackOrig=g.track_original_name,coverArt=g.cover_art;
    let ntu=null,ncu=null;
    if(tf){ntu=await uploadFile('tracks',tf);trackFile=ntu.filename;trackOrig=ntu.originalName;}
    if(ca){ncu=await uploadFile('covers',ca);coverArt=ncu.filename;}
    const displayName=artist_name?.trim()||(req.user.role==='admin'?ADMIN_NAME:req.user.name);
    const{error}=await supabase.from('gates').update({track_name:track_name.trim(),artist_name:displayName,track_file:trackFile,track_original_name:trackOrig,cover_art:coverArt,config:cfg,genre:cfg.genre||null,sc_preview_url:cfg.sc_preview_url||null}).eq('id',g.id).eq('artist_id',artistId);
    if(error){if(ntu)await removeFile('tracks',ntu.filename);if(ncu)await removeFile('covers',ncu.filename);}
    dbError(error,'update');
    if(ntu&&g.track_file) await removeFile('tracks',g.track_file);
    if(ncu&&g.cover_art)  await removeFile('covers',g.cover_art);
    res.json({id:g.id,slug:g.slug});
  })
);

app.patch('/api/gates/:id/toggle', requireAuth, asyncHandler(async(req,res)=>{
  const artistId=req.user.role==='admin'?'admin':req.user.id;
  const g=await getGate(req.params.id,artistId);
  if(!g) return res.status(404).json({error:'Not found'});
  const newState=!(g.is_active!==false);
  await supabase.from('gates').update({is_active:newState}).eq('id',g.id).eq('artist_id',artistId);
  res.json({id:g.id,is_active:newState});
}));

app.delete('/api/gates/:id', requireAuth, asyncHandler(async(req,res)=>{
  const artistId=req.user.role==='admin'?'admin':req.user.id;
  const g=await getGate(req.params.id,artistId);
  if(!g) return res.status(404).json({error:'Not found'});
  await removeFile('tracks',g.track_file); await removeFile('covers',g.cover_art);
  await supabase.from('submissions').delete().eq('gate_id',g.id);
  await supabase.from('step_events').delete().eq('gate_id',g.id);
  await supabase.from('referrals').delete().eq('gate_id',g.id);
  const{error}=await supabase.from('gates').delete().eq('id',g.id).eq('artist_id',artistId);
  dbError(error,'delete'); res.json({ok:true});
}));

// ── Submissions & CSV ─────────────────────────────────────
app.get('/api/gates/:id/submissions', requireAuth, asyncHandler(async(req,res)=>{
  const artistId=req.user.role==='admin'?'admin':req.user.id;
  const g=await getGate(req.params.id,artistId); if(!g) return res.status(404).json({error:'Not found'});
  const{data,error}=await supabase.from('submissions').select('id,listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at').eq('gate_id',g.id).order('created_at',{ascending:false}).limit(200);
  dbError(error); res.json((data||[]).map(normSub));
}));

app.get('/api/mailinglist.csv', requireAuth, asyncHandler(async(req,res)=>{
  const artistId=req.user.role==='admin'?'admin':req.user.id;
  const{data:gs}=await supabase.from('gates').select('id,slug,track_name').eq('artist_id',artistId);
  const gates=gs||[],ids=gates.map(g=>g.id),byId=new Map(gates.map(g=>[g.id,g]));
  let rows=[];
  if(ids.length){const{data}=await supabase.from('submissions').select('listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at,gate_id').in('gate_id',ids).order('created_at',{ascending:false});rows=(data||[]).map(normSub).map(r=>({...r,track_name:byId.get(r.gate_id)?.track_name||'',slug:byId.get(r.gate_id)?.slug||''}));}
  sendCsv(res,'egate-mailinglist.csv',rows);
}));

app.get('/api/gates/:id/mailinglist.csv', requireAuth, asyncHandler(async(req,res)=>{
  const artistId=req.user.role==='admin'?'admin':req.user.id;
  const g=await getGate(req.params.id,artistId); if(!g) return res.status(404).json({error:'Not found'});
  const{data}=await supabase.from('submissions').select('listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at').eq('gate_id',g.id).order('created_at',{ascending:false});
  sendCsv(res,`egate-${g.slug}.csv`,(data||[]).map(normSub).map(r=>({...r,track_name:g.track_name,slug:g.slug})));
}));

// ── Step events & stats ───────────────────────────────────
app.post('/api/step-event/:slug', asyncHandler(async(req,res)=>{
  const{step_id}=req.body||{};if(!step_id)return res.status(400).json({error:'step_id required'});
  const g=await getGateBySlug(req.params.slug);if(!g||g.is_active===false)return res.json({ok:true});
  await supabase.from('step_events').insert({id:uid(),gate_id:g.id,step_id});res.json({ok:true});
}));

app.get('/api/stats', requireAuth, asyncHandler(async(req,res)=>{
  const artistId=req.user.role==='admin'?'admin':req.user.id;
  const{data:gRaw,error:gErr}=await supabase.from('gates').select('id,slug,track_name,artist_name,cover_art,view_count,complete_count,is_active,genre,created_at').eq('artist_id',artistId);
  dbError(gErr);
  const gates=(gRaw||[]).map(normGate),ids=gates.map(g=>g.id),byId=new Map(gates.map(g=>[g.id,g]));
  let subs=[],timeline=[],funnelTotals={};
  if(ids.length){
    const{data:sRaw}=await supabase.from('submissions').select('listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,created_at,gate_id').in('gate_id',ids).order('created_at',{ascending:false}).limit(100);
    subs=(sRaw||[]).map(normSub).map(s=>({...s,track_name:byId.get(s.gate_id)?.track_name||'',slug:byId.get(s.gate_id)?.slug||''}));
    const ago30=new Date(Date.now()-30*86400000).toISOString();
    const{data:tlRaw}=await supabase.from('submissions').select('created_at').in('gate_id',ids).gte('created_at',ago30);
    const buckets={};(tlRaw||[]).forEach(s=>{const d=new Date(s.created_at).toISOString().slice(0,10);buckets[d]=(buckets[d]||0)+1;});
    for(let i=29;i>=0;i--){const d=new Date(Date.now()-i*86400000).toISOString().slice(0,10);timeline.push({date:d,count:buckets[d]||0});}
    const{data:evRaw}=await supabase.from('step_events').select('step_id').in('gate_id',ids);
    (evRaw||[]).forEach(e=>{funnelTotals[e.step_id]=(funnelTotals[e.step_id]||0)+1;});
  } else {for(let i=29;i>=0;i--)timeline.push({date:new Date(Date.now()-i*86400000).toISOString().slice(0,10),count:0});}
  const totals=gates.reduce((a,g)=>({...a,views:a.views+g.view_count,downloads:a.downloads+g.complete_count}),{gates:gates.length,views:0,downloads:0});
  totals.conversion=totals.views>0?Math.round((totals.downloads/totals.views)*100):0;
  res.json({totals,perGate:gates.slice().sort((a,b)=>(b.complete_count-a.complete_count)||(b.view_count-a.view_count)),recent:subs,timeline,funnelTotals});
}));

// ── Public APIs ───────────────────────────────────────────

// Top 100 chart
app.get('/api/charts', asyncHandler(async(req,res)=>{
  const limit=Math.min(100,parseInt(req.query.limit||'100')||100);
  const genre=req.query.genre||null;
  let query=supabase.rpc('top_gates_30d',{limit_arg:limit});
  const{data,error}=await query;
  dbError(error,'charts');
  let results=data||[];
  if(genre) results=results.filter(r=>r.genre===genre);
  res.json({updated:new Date().toISOString(),results});
}));

// Fan wall
app.get('/api/fan-wall/:slug', asyncHandler(async(req,res)=>{
  const g=await getGateBySlug(req.params.slug);if(!g||g.is_active===false)return res.json({names:[],total:0});
  const{data,count}=await supabase.from('submissions').select('listener_name',{count:'exact'}).eq('gate_id',g.id).not('listener_name','is',null).order('created_at',{ascending:false}).limit(20);
  res.json({names:(data||[]).map(r=>r.listener_name.split(' ')[0]).filter(Boolean),total:count||0});
}));

// Public artist page data
app.get('/api/artist/:slug', asyncHandler(async(req,res)=>{
  const slug=req.params.slug;
  // Check admin
  if(slug===ADMIN_SLUG){
    const{data}=await supabase.from('gates').select('slug,track_name,artist_name,cover_art,complete_count,genre').eq('artist_id','admin').eq('is_active',true).order('created_at',{ascending:false});
    return res.json({name:ADMIN_NAME,slug:ADMIN_SLUG,gates:data||[]});
  }
  const{data:u}=await supabase.from('users').select('id,name,artist_name,artist_slug').eq('artist_slug',slug).maybeSingle();
  if(!u) return res.status(404).json({error:'Artiest niet gevonden'});
  const{data}=await supabase.from('gates').select('slug,track_name,artist_name,cover_art,complete_count,genre').eq('artist_id',u.id).eq('is_active',true).order('created_at',{ascending:false});
  res.json({name:u.name,artist_name:u.artist_name,slug:u.artist_slug,gates:data||[]});
}));

// Backward compat
app.get('/artist', asyncHandler(async(req,res)=>{
  const{data}=await supabase.from('gates').select('slug,track_name,artist_name,cover_art,complete_count').eq('artist_id','admin').eq('is_active',true).order('created_at',{ascending:false});
  res.json({name:ADMIN_NAME,slug:ADMIN_SLUG,gates:data||[]});
}));

// ── Billing (Stripe) ──────────────────────────────────────
app.get('/api/billing/status', requireAuth, asyncHandler(async(req,res)=>{
  if(req.user.role==='admin') return res.json({status:'active',plan:'admin'});
  const u=await getUser(req.user.id);
  if(!u) return res.status(404).json({error:'Not found'});
  const trialLeft=u.subscription_status==='trial'?Math.max(0,Math.ceil((new Date(u.trial_ends_at)-Date.now())/86400000)):null;
  res.json({status:u.subscription_status,trial_days_left:trialLeft,has_stripe:!!u.stripe_subscription_id});
}));

app.post('/api/billing/checkout', requireAuth, asyncHandler(async(req,res)=>{
  if(!stripe) return res.status(503).json({error:'Betalingen zijn nog niet geconfigureerd.'});
  if(!STRIPE_PRICE_ID) return res.status(503).json({error:'Stripe price ID ontbreekt.'});
  if(req.user.role==='admin') return res.status(400).json({error:'Admin heeft geen abonnement nodig.'});
  const u=await getUser(req.user.id);if(!u) return res.status(404).json({error:'Not found'});
  if(u.subscription_status==='active') return res.status(400).json({error:'Je hebt al een actief abonnement.'});
  const session=await stripe.checkout.sessions.create({
    mode:'subscription',
    payment_method_types:['card'],
    customer_email:u.email,
    line_items:[{price:STRIPE_PRICE_ID,quantity:1}],
    metadata:{user_id:u.id},
    success_url:`${APP_URL||req.headers.origin||''}/billing.html?success=true`,
    cancel_url:`${APP_URL||req.headers.origin||''}/billing.html?canceled=true`,
    locale:'nl',
    subscription_data:{metadata:{user_id:u.id}}
  });
  res.json({url:session.url});
}));

app.post('/api/billing/portal', requireAuth, asyncHandler(async(req,res)=>{
  if(!stripe) return res.status(503).json({error:'Stripe niet geconfigureerd.'});
  const u=await getUser(req.user.id);if(!u||!u.stripe_customer_id) return res.status(400).json({error:'Geen actief abonnement gevonden.'});
  const portal=await stripe.billingPortal.sessions.create({
    customer:u.stripe_customer_id,
    return_url:`${APP_URL||req.headers.origin||''}/billing.html`
  });
  res.json({url:portal.url});
}));

// ── Admin routes ──────────────────────────────────────────
app.get('/api/admin/users', requireAuth, requireAdmin, asyncHandler(async(req,res)=>{
  const{data,error}=await supabase.from('users').select('id,email,name,artist_name,artist_slug,subscription_status,trial_ends_at,created_at').order('created_at',{ascending:false});
  dbError(error); res.json(data||[]);
}));

app.get('/api/admin/revenue', requireAuth, requireAdmin, asyncHandler(async(req,res)=>{
  const{data:payments}=await supabase.from('payments').select('*').order('created_at',{ascending:false});
  const{data:users}=await supabase.from('users').select('subscription_status');
  const paidPayments=payments||[];
  const totalRevenue=paidPayments.filter(p=>p.status==='paid').reduce((s,p)=>s+p.amount_cents,0);
  const thisMonth=new Date();thisMonth.setDate(1);thisMonth.setHours(0,0,0,0);
  const monthRevenue=paidPayments.filter(p=>p.status==='paid'&&new Date(p.created_at)>=thisMonth).reduce((s,p)=>s+p.amount_cents,0);
  const stats=(users||[]).reduce((a,u)=>({...a,[u.subscription_status]:(a[u.subscription_status]||0)+1}),{});
  res.json({total_revenue_cents:totalRevenue,month_revenue_cents:monthRevenue,total_revenue_eur:(totalRevenue/100).toFixed(2),month_revenue_eur:(monthRevenue/100).toFixed(2),user_stats:stats,recent_payments:paidPayments.slice(0,20)});
}));

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, asyncHandler(async(req,res)=>{
  const{data:u}=await supabase.from('users').select('id,stripe_customer_id').eq('id',req.params.id).maybeSingle();
  if(!u) return res.status(404).json({error:'Not found'});
  if(stripe&&u.stripe_customer_id){
    try{await stripe.customers.del(u.stripe_customer_id);}catch(e){console.warn('Stripe delete failed:',e.message);}
  }
  await supabase.from('gates').delete().eq('artist_id',u.id);
  await supabase.from('users').delete().eq('id',u.id);
  res.json({ok:true});
}));

app.patch('/api/admin/users/:id/subscription', requireAuth, requireAdmin, asyncHandler(async(req,res)=>{
  const{status}=req.body||{};
  if(!['trial','active','canceled'].includes(status)) return res.status(400).json({error:'Invalid status'});
  await supabase.from('users').update({subscription_status:status}).eq('id',req.params.id);
  res.json({ok:true});
}));

// ── Cover proxy ───────────────────────────────────────────
app.get('/uploads/covers/:filename', asyncHandler(async(req,res)=>{
  safeFilename(req.params.filename);
  const{data:s,error}=await supabase.storage.from(SUPABASE_BUCKET).createSignedUrl(`covers/${req.params.filename}`,3600);
  if(error) return res.status(404).send('Not found');
  res.setHeader('Cache-Control','public, max-age=3600');res.redirect(302,s.signedUrl);
}));

// ── Secure download ───────────────────────────────────────
app.get('/download/:slug', asyncHandler(async(req,res)=>{
  const token=req.query.token;
  if(!token) return res.status(403).send('Download link ontbreekt. Vul de gate in.');
  let payload;
  try{payload=jwt.verify(token,SECRET);}catch{return res.status(403).send('Download link verlopen. Vul de gate opnieuw in.');}
  if(payload.purpose!=='dl'||payload.gate!==req.params.slug) return res.status(403).send('Ongeldige link.');
  const g=await getGateBySlug(req.params.slug);if(!g||!g.track_file) return res.status(404).send('Niet gevonden');
  const dlName=cleanName(g.track_original_name,'download'+path.extname(g.track_file));
  await streamFile(res,'tracks',g.track_file,dlName);
}));

// ── Submit (with recommendations) ────────────────────────
app.post('/api/submit/:slug', asyncHandler(async(req,res)=>{
  const ip=req.headers['x-forwarded-for']?.split(',')[0]?.trim()||req.socket.remoteAddress||'x';
  if(!checkRateLimit(ip)) return res.status(429).json({error:'Te veel pogingen. Wacht 10 minuten.'});
  const g=await getGateBySlug(req.params.slug);
  if(!g) return res.status(404).json({error:'Gate not found'});
  if(g.is_active===false) return res.status(403).json({error:'Gate is gesloten'});
  const cfg=parseCfg(g.config);
  if(cfg.secret_code){const s=String(req.body?.secret_code||'').trim();if(s.toLowerCase()!==cfg.secret_code.toLowerCase())return res.status(403).json({error:'Verkeerde code.'});}
  if(cfg.max_downloads&&Number(cfg.max_downloads)>0&&g.complete_count>=Number(cfg.max_downloads))return res.status(410).json({error:`Gate is vol (max ${cfg.max_downloads}).`});
  const{listener_name,listener_email,sc_username,sc_comment,ig_username,spotify_verified,ref_code}=req.body||{};
  const name=String(listener_name||'').trim(),email=String(listener_email||'').trim().toLowerCase();
  if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Naam en geldig e-mailadres zijn verplicht'});
  const{data:existing}=await supabase.from('submissions').select('id').eq('gate_id',g.id).eq('listener_email',email).maybeSingle();
  let subId=existing?.id;
  if(!existing){
    subId=uid();
    const{error:ie}=await supabase.from('submissions').insert({id:subId,gate_id:g.id,listener_name:name,listener_email:email,sc_username:sc_username||null,sc_comment:sc_comment||null,ig_username:ig_username||null,spotify_verified:!!spotify_verified,ref_code:ref_code||null,referrer:String(req.body?.referrer||'').slice(0,200)||null});
    dbError(ie,'insert sub');
    await supabase.rpc('increment_complete',{gate_id_arg:g.id});
    if(ref_code){
      const{data:ref}=await supabase.from('referrals').select('*').eq('referral_code',ref_code).maybeSingle();
      if(ref&&ref.gate_id===g.id){
        await supabase.rpc('increment_referral_used',{code_arg:ref_code});
        if(cfg.referral_reward_gate_slug){
          const rewardToken=jwt.sign({gate:cfg.referral_reward_gate_slug,purpose:'dl',v:1},SECRET,{expiresIn:'7d'});
          await supabase.from('referrals').update({reward_token:rewardToken}).eq('referral_code',ref_code);
          if(mailer){
            const{data:rs}=await supabase.from('submissions').select('listener_email,listener_name').eq('id',ref.referrer_submission_id).maybeSingle();
            if(rs)sendMail(rs.listener_email,'🎁 Jouw exclusieve track is beschikbaar!',`Hey ${rs.listener_name},\n\nIemand heeft jouw link gebruikt!\nJouw beloning: ${APP_URL}/download/${cfg.referral_reward_gate_slug}?token=${encodeURIComponent(rewardToken)}\n`).catch(()=>{});
          }
        }
      }
    }
    if(mailer)sendMail(process.env.NOTIFY_EMAIL||ADMIN_EMAIL,`🎵 Nieuwe download: ${g.track_name}`,`${name} (${email})\nSoundCloud: ${sc_username||'—'}`).catch(()=>{});
  }
  let referralCode=null;
  if(cfg.referral_enabled){
    const{data:er}=await supabase.from('referrals').select('referral_code').eq('gate_id',g.id).eq('referrer_submission_id',subId).maybeSingle();
    if(er){referralCode=er.referral_code;}else{referralCode=crypto.randomBytes(6).toString('hex');await supabase.from('referrals').insert({id:uid(),gate_id:g.id,referral_code:referralCode,referrer_submission_id:subId});}
  }
  // Recommendations (same genre, most popular)
  const similar=await getSimilarGates(g.id,g.genre||cfg.genre||null);
  const downloadToken=jwt.sign({gate:g.slug,purpose:'dl',v:1},SECRET,{expiresIn:'1h'});
  res.json({ok:true,download_token:downloadToken,referral_code:referralCode,similar_gates:similar});
}));

app.get('/api/referral/reward/:code', asyncHandler(async(req,res)=>{
  const{data:ref}=await supabase.from('referrals').select('reward_token,used_count').eq('referral_code',req.params.code).maybeSingle();
  if(!ref) return res.status(404).json({error:'Referral niet gevonden'});
  if(!ref.reward_token) return res.status(404).json({error:'Nog geen beloning beschikbaar.'});
  res.json({ok:true,reward_token:ref.reward_token});
}));

// ── Gate page ─────────────────────────────────────────────
app.get('/gate/:slug', asyncHandler(async(req,res)=>{
  const g=await getGateBySlug(req.params.slug);
  if(!g) return res.status(404).send(page404());
  if(g.is_active===false){res.setHeader('Content-Type','text/html; charset=utf-8');return res.send(pageInactive(g.artist_name,g.track_name));}
  await supabase.rpc('increment_view',{gate_id_arg:g.id});
  const cfg=parseCfg(g.config);
  cfg.artist=g.artist_name;cfg.track=g.track_name;cfg.slug=g.slug;
  cfg.dlUrl=g.track_file?'/download/'+encodeURIComponent(g.slug):'';
  cfg.cover=g.cover_art?'/uploads/covers/'+g.cover_art:'';
  cfg.submitUrl='/api/submit/'+g.slug;
  cfg.fan_wall_url='/api/fan-wall/'+g.slug;
  cfg.downloads_left=(cfg.max_downloads&&cfg.max_downloads>0)?Math.max(0,Number(cfg.max_downloads)-Number(g.complete_count||0)):null;
  cfg.has_secret_code=!!cfg.secret_code;delete cfg.secret_code;
  cfg.referral_has_reward=!!cfg.referral_reward_gate_slug;delete cfg.referral_reward_gate_slug;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(gatePage(cfg));
}));

// ── Artist page route ─────────────────────────────────────
app.get('/~:slug', (req,res)=>sendPage(res,'artist.html'));
app.get('/'+ADMIN_SLUG, (req,res)=>sendPage(res,'artist.html'));

// ── Health ────────────────────────────────────────────────
app.get('/api/health', asyncHandler(async(req,res)=>{
  const db=await supabase.from('gates').select('id',{count:'exact',head:true}).limit(1);
  const st=await supabase.storage.from(SUPABASE_BUCKET).list('',{limit:1});
  res.json({ok:!db.error&&!st.error,version:'3.0.0',storage:'supabase',bucket:SUPABASE_BUCKET,supabaseHost:new URL(SUPABASE_URL).host,stripe:!!stripe,email:!!mailer,database:db.error?{ok:false,error:db.error.message}:{ok:true},bucketCheck:st.error?{ok:false,error:st.error.message}:{ok:true}});
}));

// ── Fallbacks ─────────────────────────────────────────────
app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint not found'}));
app.use((err,req,res,next)=>{
  console.error('[E-gate]',err.message,err.details||'');
  if(err.code==='LIMIT_FILE_SIZE') return res.status(413).json({error:'Bestand te groot (max 350 MB)'});
  if(res.headersSent) return next(err);
  res.status(err.status||500).json({error:err.message||'Server error'});
});

app.listen(PORT,()=>{
  console.log('\n  E-GATE v3.0.0  →  http://localhost:'+PORT);
  console.log('  Supabase: '+new URL(SUPABASE_URL).host);
  console.log('  Stripe: '+(stripe?'enabled':'disabled'));
  console.log('  Artist page: /'+ADMIN_SLUG+'\n');
});

// ═══════════════════════════════════════════════════════════
//  V4.0 ADDITIONS
// ═══════════════════════════════════════════════════════════

// ── Geo lookup (fire-and-forget) ──────────────────────────
async function getCountryCode(ip) {
  if (!ip||ip==='unknown'||ip.startsWith('127.')||ip==='::1') return null;
  try {
    const r = await fetch(`https://ipapi.co/${ip}/country_code/`,
      { signal:AbortSignal.timeout(2000), headers:{'User-Agent':'E-gate/4.0'} });
    if (!r.ok) return null;
    const code = (await r.text()).trim();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch { return null; }
}

// ── Password reset ────────────────────────────────────────
app.post('/api/auth/forgot-password', asyncHandler(async(req,res)=>{
  const { email } = req.body||{};
  // Always return 200 to avoid email enumeration
  res.json({ ok:true, message:'Als dit e-mailadres bekend is, ontvang je een resetlink.' });
  if (!email||!mailer) return;
  const { data:u } = await supabase.from('users').select('id,name').eq('email',email.toLowerCase()).maybeSingle();
  if (!u) return;
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  await supabase.from('password_reset_tokens').insert({ id:uid(), user_id:u.id, token_hash:hash, expires_at:new Date(Date.now()+3600000).toISOString() });
  sendMail(email,'Wachtwoord resetten — E-gate',
    `Hey ${u.name},\n\nKlik om je wachtwoord te resetten:\n${APP_URL}/reset-password.html?token=${raw}\n\nDeze link is 1 uur geldig.\nAls je dit niet aangevraagd hebt, negeer dan deze mail.`
  ).catch(()=>{});
}));

app.post('/api/auth/reset-password', asyncHandler(async(req,res)=>{
  const { token, password } = req.body||{};
  if (!token||!password) return res.status(400).json({error:'Token en wachtwoord zijn verplicht'});
  if (password.length<8) return res.status(400).json({error:'Wachtwoord moet minstens 8 tekens zijn'});
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const { data:rt } = await supabase.from('password_reset_tokens').select('*').eq('token_hash',hash).is('used_at',null).maybeSingle();
  if (!rt) return res.status(400).json({error:'Ongeldige of al gebruikte link.'});
  if (new Date(rt.expires_at)<new Date()) return res.status(400).json({error:'Link verlopen. Vraag een nieuwe aan.'});
  const newHash = await hashPassword(password);
  await supabase.from('users').update({password_hash:newHash}).eq('id',rt.user_id);
  await supabase.from('password_reset_tokens').update({used_at:new Date().toISOString()}).eq('id',rt.id);
  res.json({ok:true});
}));

// ── Email verification ────────────────────────────────────
app.post('/api/auth/send-verification', requireAuth, asyncHandler(async(req,res)=>{
  if (req.user.role==='admin') return res.json({ok:true});
  if (!mailer) return res.status(503).json({error:'E-mail niet geconfigureerd.'});
  const u = await getUser(req.user.id);
  if (!u||u.email_verified) return res.json({ok:true});
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  await supabase.from('email_verification_tokens').upsert({ id:uid(), user_id:u.id, token_hash:hash, expires_at:new Date(Date.now()+7*86400000).toISOString() }, { onConflict:'user_id' });
  await sendMail(u.email,'Bevestig je e-mailadres — E-gate',`Hey ${u.name},\n\nKlik hier om je e-mailadres te bevestigen:\n${APP_URL}/verify-email.html?token=${raw}\n\nDeze link is 7 dagen geldig.`);
  res.json({ok:true});
}));

app.get('/api/auth/verify-email', asyncHandler(async(req,res)=>{
  const { token } = req.query;
  if (!token) return res.status(400).json({error:'Token ontbreekt'});
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const { data:vt } = await supabase.from('email_verification_tokens').select('*').eq('token_hash',hash).maybeSingle();
  if (!vt||new Date(vt.expires_at)<new Date()) return res.status(400).json({error:'Ongeldige of verlopen link'});
  await supabase.from('users').update({email_verified:true,plan:'free'}).eq('id',vt.user_id);
  await supabase.from('email_verification_tokens').delete().eq('id',vt.id);
  res.json({ok:true});
}));

// ── Platform stats (landing page) ─────────────────────────
app.get('/api/platform-stats', asyncHandler(async(req,res)=>{
  const { data } = await supabase.rpc('platform_stats');
  const s = data?.[0]||{total_gates:0,total_downloads:0,total_artists:0};
  res.json(s);
}));

// ── Geo & referrer stats ──────────────────────────────────
app.get('/api/stats/geo', requireAuth, asyncHandler(async(req,res)=>{
  const artistId = req.user.role==='admin'?'admin':req.user.id;
  const { data } = await supabase.rpc('geo_breakdown',{artist_id_arg:artistId});
  res.json(data||[]);
}));

app.get('/api/stats/referrers', requireAuth, asyncHandler(async(req,res)=>{
  const artistId = req.user.role==='admin'?'admin':req.user.id;
  const { data } = await supabase.rpc('referrer_breakdown',{artist_id_arg:artistId});
  res.json(data||[]);
}));

// ── Embed gate page ───────────────────────────────────────
app.get('/embed/:slug', asyncHandler(async(req,res)=>{
  const g = await getGateBySlug(req.params.slug);
  if (!g||g.is_active===false) return res.status(404).send('<p style="font-family:sans-serif;color:#666;padding:20px">Gate not found</p>');
  const cfg = parseCfg(g.config);
  cfg.artist=g.artist_name; cfg.track=g.track_name; cfg.slug=g.slug;
  cfg.dlUrl=g.track_file?'/download/'+encodeURIComponent(g.slug):'';
  cfg.cover=g.cover_art?'/uploads/covers/'+g.cover_art:'';
  cfg.submitUrl='/api/submit/'+g.slug;
  cfg.fan_wall_url='/api/fan-wall/'+g.slug;
  cfg.downloads_left=(cfg.max_downloads&&cfg.max_downloads>0)?Math.max(0,Number(cfg.max_downloads)-Number(g.complete_count||0)):null;
  cfg.has_secret_code=!!cfg.secret_code; delete cfg.secret_code;
  cfg.referral_has_reward=!!cfg.referral_reward_gate_slug; delete cfg.referral_reward_gate_slug;
  cfg.embed=true;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('X-Frame-Options','ALLOWALL');
  res.setHeader('Content-Security-Policy',"frame-ancestors *");
  res.send(gatePage(cfg));
}));

// ── Updated cover proxy with OG support ───────────────────
// (Override the existing /uploads/covers/:filename route by adding this after)
// Note: the first matching route wins in Express, so this won't work as an override.
// The OG support is handled in gate-template.js by using a longer cache.

// ── Static pages v4 ───────────────────────────────────────
['forgot-password','reset-password','verify-email'].forEach(p=>{
  app.get('/'+p+'.html',(req,res)=>sendPage(res,p+'.html'));
});
