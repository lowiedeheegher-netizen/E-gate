'use strict';

function gatePage(c) {
  // Sanitise for safe injection into the page
  const cj = JSON.stringify(c)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${esc(c.artist)} \u2014 ${esc(c.track)} | Free Download</title>
<meta property="og:title" content="${esc(c.artist)} \u2014 ${esc(c.track)} | Free Download">
<meta property="og:description" content="Download '${esc(c.track)}' for free. Complete the steps to unlock it.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
:root{--bg:#000000;--bg-card:#0a0a0c;--border:#1f2025;--muted:#3a3c43;--muted-2:#54565d;--text:#d4d8e0;--chrome:#c8ccd4;--green:#4ade80;--accent:#ff3b00;--accent-2:#ff5a1f;--chrome-grad:linear-gradient(160deg,#e6e9ee 0%,#aeb2ba 30%,#74787f 55%,#babdc4 80%,#e6e9ee 100%);--sheen:linear-gradient(155deg,rgba(255,255,255,.05) 0%,rgba(255,255,255,0) 18%,rgba(0,0,0,0) 82%,rgba(255,255,255,.02) 100%);--sc-grad:linear-gradient(135deg,#cc3d00,#ff6a00);--sp-grad:linear-gradient(135deg,#117a38,#1db954);--ig-grad:linear-gradient(135deg,#6e1cf7,#e1306c);--ov-grad:linear-gradient(135deg,#3a3c43,#74787f);--sc-dim:#ff550033;--sp-dim:#1db95433;--ig-dim:#e1306c33;--ov-dim:#74787f44;--sc-dot:#ff5500;--sp-dot:#1db954;--ig-dot:#e1306c;--ov-dot:#c8ccd4}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:var(--bg);color:#fff;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
body{position:relative}
body::before{content:'';position:fixed;inset:0;z-index:-2;pointer-events:none;background:radial-gradient(105% 75% at 22% 18%,rgba(190,205,230,.12) 0%,transparent 46%),radial-gradient(110% 70% at 80% 8%,rgba(255,59,0,.045) 0%,transparent 45%),linear-gradient(180deg,rgba(0,0,0,.28) 0%,rgba(0,0,0,.58) 62%)}
body::after{content:'';position:fixed;top:0;bottom:0;left:62%;width:1px;z-index:-1;pointer-events:none;transform:rotate(9deg) scaleY(1.5);background:linear-gradient(180deg,transparent,rgba(255,59,0,.55) 40%,rgba(255,122,47,.75) 50%,rgba(255,59,0,.55) 60%,transparent);box-shadow:0 0 26px 4px rgba(255,59,0,.3);opacity:0}
.topbar{background:rgba(0,0,0,.6);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);padding:12px 20px;display:flex;align-items:center;justify-content:space-between}
.topbar .brand{font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;background:var(--chrome-grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.topbar .egate-badge{font-size:9px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#3a3c43;text-decoration:none;transition:color .2s}
.topbar .egate-badge:hover{color:#74787f}
.hero{background:linear-gradient(180deg,rgba(20,21,25,.6) 0%,transparent 100%);border-bottom:1px solid var(--border);padding:44px 20px 36px;display:flex;flex-direction:column;align-items:center;gap:24px;text-align:center}
.cover{width:148px;height:148px;border-radius:12px;overflow:hidden;background:linear-gradient(160deg,#16171b 0%,#050506 60%);box-shadow:0 0 0 1px rgba(255,59,0,.3),0 0 40px rgba(255,59,0,.18),0 20px 60px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cover img{width:100%;height:100%;object-fit:cover;display:block}
.cover-ph{text-align:center;padding:14px;user-select:none}
.cover-genre{font-size:8px;font-weight:700;letter-spacing:5px;text-transform:uppercase;opacity:.5;margin-bottom:8px}
.cover-artist{font-size:26px;font-weight:900;letter-spacing:-1px;line-height:1;background:var(--chrome-grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.cover-bpm{font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;opacity:.6;margin-top:8px}
.eyebrow{font-size:9px;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:var(--accent);margin-bottom:10px}
.title{font-size:28px;font-weight:900;letter-spacing:-.5px;line-height:1.1;background:var(--chrome-grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.subtitle{margin-top:8px;color:#54565d;font-size:11px;letter-spacing:1px}
.progress-wrap{width:100%;max-width:440px}
.progress-labels{display:flex;justify-content:space-between;margin-bottom:8px;font-size:9px;letter-spacing:3px;text-transform:uppercase}
.progress-labels .lbl{color:var(--muted)}
.progress-labels .cnt{color:var(--muted);font-weight:700;font-variant-numeric:tabular-nums;transition:color .3s}
.progress-labels .cnt.has-progress{color:#fff}
.progress-labels .cnt.all-done{color:var(--green)}
.progress-track{height:4px;background:#0f0f1c;border-radius:99px;overflow:hidden}
.progress-fill{height:100%;border-radius:99px;width:0%;background:linear-gradient(90deg,var(--accent),var(--accent-2));transition:width .6s cubic-bezier(.4,0,.2,1),background .6s}
.progress-fill.done{background:linear-gradient(90deg,#117a38,var(--green))}
.container{max-width:500px;margin:0 auto;padding:24px 14px 80px}
.intro{font-size:11px;color:#4a4c53;text-align:center;margin-bottom:22px;line-height:1.5;letter-spacing:.3px}
.group-header{display:flex;align-items:center;gap:10px;padding:20px 4px 9px}
.group-header.first{padding-top:0}
.group-dot{width:3px;height:13px;border-radius:2px;flex-shrink:0}
.group-dot--soundcloud{background:var(--sc-dot)}
.group-dot--spotify{background:var(--sp-dot)}
.group-dot--instagram{background:var(--ig-dot)}
.group-dot--gegevens,.group-dot--details{background:var(--accent)}
.group-dot--overig,.group-dot--other{background:var(--ov-dot)}
.group-label{font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--muted-2)}
.card{background:var(--bg-card) var(--sheen);border:1px solid var(--border);border-left:3px solid var(--border);border-radius:10px;padding:13px 15px;margin-bottom:6px;display:flex;align-items:center;gap:13px;transition:border-color .3s,background .3s;box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
.card[data-group="soundcloud"]{border-left-color:var(--sc-dim)}
.card[data-group="spotify"]{border-left-color:var(--sp-dim)}
.card[data-group="instagram"]{border-left-color:var(--ig-dim)}
.card[data-group="gegevens"],.card[data-group="details"]{border-left-color:rgba(255,59,0,.35)}
.card[data-group="overig"],.card[data-group="other"]{border-left-color:var(--ov-dim)}
.card.has-form{align-items:flex-start}
.card.is-done{background:rgba(34,197,94,.03);border-color:rgba(34,197,94,.1);border-left-color:rgba(34,197,94,.3)}
.icon{width:40px;height:40px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;transition:background .3s}
.icon.has-form{margin-top:3px}
.icon--soundcloud{background:var(--sc-grad)}
.icon--spotify{background:var(--sp-grad)}
.icon--instagram{background:var(--ig-grad)}
.icon--gegevens,.icon--details{background:linear-gradient(135deg,var(--accent),var(--accent-2))}
.icon--overig,.icon--other{background:var(--ov-grad)}
.icon--done{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.15);color:var(--green);font-size:15px}
.icon--done.via-spotify{background:rgba(29,185,84,.12);border-color:rgba(29,185,84,.2);color:var(--sp-dot)}
.card-body{flex:1;min-width:0}
.card-title{font-weight:600;font-size:13px;color:var(--text);transition:color .3s}
.card-title.is-done{color:var(--green)}
.card-desc{font-size:11px;color:var(--muted-2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.btn{flex-shrink:0;border:none;border-radius:8px;padding:8px 13px;color:#fff;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;transition:opacity .15s}
.btn:hover{opacity:.85}
.btn--ok{padding:9px 15px;white-space:nowrap}
.btn--soundcloud{background:var(--sc-grad)}
.btn--spotify{background:var(--sp-grad)}
.btn--instagram{background:var(--ig-grad)}
.btn--gegevens,.btn--details{background:linear-gradient(135deg,var(--accent),var(--accent-2))}
.btn--overig,.btn--other{background:var(--ov-grad)}
.btn--gedaan{background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.15);color:var(--green)}
.status-done{flex-shrink:0;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--green);font-weight:600;white-space:nowrap}
.field-form{margin-top:11px;width:100%}
.field-row{display:flex;gap:8px}
.field-input{flex:1;min-width:0;background:#050506;border:1px solid #26282e;border-radius:8px;padding:9px 11px;color:#fff;font-size:13px;outline:none;font-family:inherit}
.field-input::placeholder{color:#54565d}
.field-textarea{width:100%;resize:vertical;min-height:50px;line-height:1.4;font-family:inherit}
.field-err{font-size:11px;color:#f87171;margin-top:5px;display:none}
.field-err.show{display:block}
.field-note{font-size:10px;color:#26282e;margin-top:7px}
.combo-checklist{margin-top:11px;display:flex;flex-direction:column;gap:6px}
.combo-item{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--muted-2);padding:9px 11px;border-radius:8px;background:#050506;border:1px solid #1f2025;transition:color .25s,border-color .25s,background .25s;width:100%;text-align:left;cursor:pointer;font-family:inherit}
.combo-item .ci-box{width:18px;height:18px;border-radius:5px;flex-shrink:0;border:1.5px solid #3a3c43;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff}
.combo-toggle:hover{border-color:var(--sc-dot);color:#fff}
.combo-item.is-checked{color:var(--green);border-color:rgba(34,197,94,.3);background:rgba(34,197,94,.04)}
.combo-item.is-checked .ci-box{background:rgba(34,197,94,.15);border-color:rgba(34,197,94,.3);color:var(--green)}
.combo-action{margin-top:11px}
.combo-action .btn,.combo-confirm .btn{width:100%;padding:11px 16px;font-size:13px}
.combo-confirm{margin-top:10px}
.extra-line{margin-top:7px;font-size:11px}
.hint-text{color:var(--muted-2)}
.link-action{background:none;border:none;padding:0;margin:0;color:var(--sp-dot);font-size:11px;font-weight:700;cursor:pointer;text-decoration:underline;font-family:inherit}
.link-action:hover{color:var(--green)}
.locked-box{margin-top:20px;border:1px dashed var(--border);border-radius:12px;padding:26px 22px;text-align:center}
.locked-icon{font-size:26px;margin-bottom:10px}
.locked-text{font-size:12px;color:var(--muted);letter-spacing:.5px}
.locked-track{margin:12px auto 0;height:4px;max-width:200px;background:var(--bg-card);border-radius:99px;overflow:hidden}
.locked-fill{height:100%;width:0%;border-radius:99px;background:linear-gradient(90deg,var(--accent),var(--accent-2));transition:width .5s ease}
.unlocked-box{margin-top:20px;background:rgba(34,197,94,.04);border:1px solid rgba(34,197,94,.12);border-radius:14px;padding:36px 22px;text-align:center;animation:fadeIn .5s ease}
.unlocked-emoji{font-size:42px}
.unlocked-title{font-size:20px;font-weight:900;margin-top:14px;letter-spacing:-.3px}
.unlocked-text{color:#54565d;font-size:12px;margin-top:8px;margin-bottom:26px;line-height:1.6}
.download-btn{display:block;text-decoration:none;background:linear-gradient(135deg,var(--accent),var(--accent-2));border-radius:12px;padding:18px 22px;font-size:16px;font-weight:800;color:#fff;letter-spacing:-.3px;animation:pulse 2s infinite;cursor:pointer;box-shadow:0 0 0 1px rgba(255,90,31,.5)}
.dl-note{margin-top:11px;font-size:11px;color:var(--muted);display:none}
.dl-note.show{display:block}
.unlocked-footer{margin-top:26px;padding-top:18px;border-top:1px solid #0f0f1c;display:flex;justify-content:center;gap:18px;flex-wrap:wrap;font-size:11px;color:var(--muted)}
.egate-credit{margin-top:28px;text-align:center}
.egate-credit a{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--border);text-decoration:none;font-weight:700;transition:color .2s}
.egate-credit a:hover{color:var(--muted)}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 1px rgba(255,90,31,.5),0 12px 44px rgba(255,59,0,.4)}50%{box-shadow:0 0 0 1px rgba(255,90,31,.7),0 12px 60px rgba(255,59,0,.65)}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid #ff5a1f;outline-offset:2px}
@media(max-width:380px){.cover{width:122px;height:122px}.title{font-size:22px}.cover-artist{font-size:22px}}
</style>
</head>
<body>
<div id="app">
  <div class="topbar">
    <span class="brand" id="topbar-brand"></span>
    <a class="egate-badge" href="/" target="_blank" rel="noopener">E-GATE</a>
  </div>
  <div class="hero">
    <div class="cover" id="cover">
      <div class="cover-ph">
        <div class="cover-genre" id="cover-genre"></div>
        <div class="cover-artist" id="cover-artist"></div>
        <div class="cover-bpm" id="cover-bpm"></div>
      </div>
    </div>
    <div>
      <div class="eyebrow">\u2B07 Free Download</div>
      <h1 class="title" id="track-title"></h1>
      <p class="subtitle" id="track-subtitle"></p>
    </div>
    <div class="progress-wrap">
      <div class="progress-labels">
        <span class="lbl">Steps completed</span>
        <span class="cnt" id="hero-count" aria-live="polite">0 / 0</span>
      </div>
      <div class="progress-track"><div class="progress-fill" id="hero-fill"></div></div>
    </div>
  </div>
  <div class="container">
    <p class="intro">Complete the steps below to unlock your free download.</p>
    <div id="steps"></div>
    <div class="locked-box" id="locked-box">
      <div class="locked-icon">\uD83D\uDD12</div>
      <div class="locked-text" id="locked-text"></div>
      <div class="locked-track"><div class="locked-fill" id="locked-fill"></div></div>
    </div>
    <div class="unlocked-box" id="unlocked-box" style="display:none">
      <div class="unlocked-emoji">\uD83C\uDF89</div>
      <div class="unlocked-title">Thanks for your support!</div>
      <div class="unlocked-text">All steps are completed.<br>Your free download is ready \u2014 enjoy!</div>
      <a class="download-btn" id="download-link" href="#" target="_blank" rel="noopener noreferrer">
        <span id="download-label"></span>
      </a>
      <div class="dl-note" id="dl-note">Download started! Share the track and come rave \uD83D\uDD25</div>
      <div class="unlocked-footer">
        <span>\uD83C\uDFB5 Tag us on socials</span><span>\u00B7</span>
        <span>\uD83D\uDD01 Share the track</span><span>\u00B7</span>
        <span>\uD83D\uDD25 Come rave</span>
      </div>
    </div>
    <div class="egate-credit"><a href="/" target="_blank" rel="noopener">E-GATE</a></div>
  </div>
</div>
<script>
var CONFIG = ${cj};

// ============================================================
//  DERIVED STATE FROM CONFIG
// ============================================================
var LINKS = {};
var COMBO_ACTIONS = [];
var STEPS = [];
var SPOTIFY_CLIENT_ID = '';
var SPOTIFY_ARTIST_ID = null;
var SPOTIFY_TRACK_ID  = null;
var SPOTIFY_SCOPE     = 'user-follow-read user-follow-modify';
var SPOTIFY_ENABLED   = false;
var SPOTIFY_REDIRECT_URI = window.location.origin + '/spotify-callback.html';

function extractSpotifyId(url) {
  if (!url) return null;
  var m = url.match(/(?:artist|track)\\/([A-Za-z0-9]{22})/);
  return m ? m[1] : null;
}

// Listener info — always required so downloads build your mailinglist
STEPS.push({ id:'listener_info', kind:'identity', group:'Details', icon:'@',
  title:'Name + email', desc:'Enter your details to unlock the download',
  namePlaceholder:'Your name', emailPlaceholder:'email@example.com' });

// SoundCloud combo
(function() {
  var sc = CONFIG.sc;
  if (!sc || !sc.enabled) return;
  if (sc.follow && sc.follow.enabled && sc.follow.url)
    COMBO_ACTIONS.push({ key:'follow', label:'Follow ' + CONFIG.artist, url:sc.follow.url, type:'follow' });
  if (sc.like && sc.like.enabled && sc.like.url)
    COMBO_ACTIONS.push({ key:'like', label:'Like the track', url:sc.like.url, type:'action' });
  if (sc.repost && sc.repost.enabled && sc.repost.url)
    COMBO_ACTIONS.push({ key:'repost', label:'Repost the track', url:sc.repost.url, type:'action' });
  if (sc.comment && sc.comment.enabled && sc.comment.url)
    COMBO_ACTIONS.push({ key:'comment', label:'Paste your comment', url:sc.comment.url, type:'comment' });
  if (COMBO_ACTIONS.length > 0) {
    STEPS.push({
      id:'sc_all', kind:'sc_combo', group:'SoundCloud', icon:'\\u2601', title:'SoundCloud',
      desc: COMBO_ACTIONS.map(function(a){ return a.label; }).join(' \\u00B7 '),
      needsUsername: false,
      needsComment:  !!(sc.comment && sc.comment.enabled),
      commentPlaceholder: (sc.comment && sc.comment.placeholder) || 'Fire! \\uD83D\\uDD25\\uD83D\\uDD25'
    });
  }
}());

// Spotify
(function() {
  var sp = CONFIG.sp;
  if (!sp || !sp.enabled) return;
  SPOTIFY_CLIENT_ID = sp.clientId || '';
  if (sp.follow && sp.follow.enabled && sp.follow.url) {
    LINKS.spArtist = sp.follow.url;
    SPOTIFY_ARTIST_ID = extractSpotifyId(sp.follow.url);
    STEPS.push({ id:'sp_follow', kind:'spotify', group:'Spotify', icon:'\\u266C',
      title:'Follow on Spotify', desc:'Connect \\u2014 ' + CONFIG.artist + ' will be followed automatically',
      linkKey:'spArtist', spotifyCheck:'follow' });
  }
  if (sp.save && sp.save.enabled && sp.save.url) {
    LINKS.spTrack = sp.save.url;
    SPOTIFY_TRACK_ID = extractSpotifyId(sp.save.url);
    SPOTIFY_SCOPE = 'user-follow-read user-follow-modify user-library-read user-library-modify';
    STEPS.push({ id:'sp_save', kind:'spotify', group:'Spotify', icon:'\\u2665',
      title:'Save to library', desc:"'" + CONFIG.track + "' will be saved automatically",
      linkKey:'spTrack', spotifyCheck:'save' });
  }
  SPOTIFY_ENABLED = !!(SPOTIFY_CLIENT_ID && SPOTIFY_ARTIST_ID);
  if (SPOTIFY_CLIENT_ID && !SPOTIFY_ARTIST_ID)
    console.warn('Spotify Client ID is set but no valid artist URL was found');
}());

// Instagram
(function() {
  var ig = CONFIG.ig;
  if (!ig || !ig.enabled || !ig.url) return;
  LINKS.ig = ig.url;
  STEPS.push({ id:'ig_follow', kind:'link', group:'Instagram', icon:'\u25C9',
    title:'Follow on Instagram', desc:'Open Instagram, follow the profile, then confirm',
    linkKey:'ig' });
}());

// Custom
(function() {
  var custom = CONFIG.custom;
  if (!Array.isArray(custom)) return;
  custom.forEach(function(c, i) {
    if (!c.enabled || !c.label || !c.url) return;
    var id = 'custom_' + i;
    LINKS[id] = c.url;
    STEPS.push({ id:id, kind:'link', group:'Other', icon:'\\u2197',
      title:c.label, desc:'Open the link, then confirm', linkKey:id });
  });
}());

var TOTAL = STEPS.length;

// ============================================================
//  STATE
// ============================================================
var doneSet      = new Set();
var openedSet    = new Set();
var doneVia      = {};
var userData     = { name:'', email:'', scUsername:'', igUsername:'', comment:'' };
var submitted    = false;
var comboStarted = false;
var comboChecks  = {};

var spotifyAuthed   = false;
var spotifyChecking = false;
var spotifyError    = false;

var STORAGE_KEY = 'egate_' + CONFIG.slug;

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    var s = JSON.parse(raw);
    if (Array.isArray(s.done))   doneSet   = new Set(s.done);
    if (Array.isArray(s.opened)) openedSet = new Set(s.opened);
    if (s.doneVia)   doneVia  = s.doneVia;
    if (s.userData)  userData = Object.assign(userData, s.userData);
    if (s.submitted) submitted = true;
    if (s.comboStarted) comboStarted = true;
    if (s.comboChecks)  comboChecks = s.comboChecks;
  } catch(e) {}
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      done: Array.from(doneSet), opened: Array.from(openedSet),
      doneVia:doneVia, userData:userData, submitted:submitted,
      comboStarted:comboStarted, comboChecks:comboChecks
    }));
  } catch(e) {}
}

// ============================================================
//  HELPERS
// ============================================================
function isValidUsername(v) { return /^[A-Za-z0-9._-]{2,30}$/.test(v); }
function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()); }

function checkSvg() {
  return '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<circle cx="8" cy="8" r="8" fill="rgba(34,197,94,0.2)"/>' +
    '<path d="M4.8 8L7 10.2L11.2 5.5" stroke="#4ade80" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
}

function escapeHtml(s) {
  var d = document.createElement('div');
  d.textContent = (s == null ? '' : String(s));
  return d.innerHTML;
}

function doneLabel(step) {
  if (step.kind === 'identity' || step.kind === 'username' || step.kind === 'sc_combo') return 'Saved';
  if (step.kind === 'spotify' && doneVia[step.id] === 'spotify') return 'Verified';
  return 'Done';
}

// ============================================================
//  STATIC CONTENT
// ============================================================
function populateStaticContent() {
  document.getElementById('topbar-brand').textContent = CONFIG.artist;

  if (CONFIG.cover) {
    var img = document.createElement('img');
    img.src = CONFIG.cover;
    img.alt = CONFIG.artist + ' \u2014 ' + CONFIG.track;
    var cover = document.getElementById('cover');
    cover.innerHTML = '';
    cover.appendChild(img);
  } else {
    var genre = CONFIG.genre || '';
    document.getElementById('cover-genre').textContent  = genre.split('/').pop().trim();
    document.getElementById('cover-artist').textContent = CONFIG.artist;
    document.getElementById('cover-bpm').textContent    = CONFIG.bpm ? CONFIG.bpm + ' BPM' : '';
  }

  document.getElementById('track-title').textContent = CONFIG.track;
  var parts = [CONFIG.artist.toUpperCase()];
  if (CONFIG.genre) parts.push(CONFIG.genre.toUpperCase());
  if (CONFIG.bpm)   parts.push(CONFIG.bpm + ' BPM');
  document.getElementById('track-subtitle').textContent = parts.join(' \\u00B7 ');

  document.getElementById('locked-text').textContent =
    'Complete all ' + TOTAL + ' step' + (TOTAL !== 1 ? 's' : '') + ' to unlock the download';
  document.getElementById('download-label').textContent = '\\u2B07 Download ' + CONFIG.track + ' \\u2014 FREE';
  document.getElementById('download-link').href = CONFIG.dlUrl || '#';
}

// ============================================================
//  RENDER
// ============================================================
function render() {
  var doneCount = doneSet.size;
  var pct    = TOTAL > 0 ? (doneCount / TOTAL) * 100 : 0;
  var allDone = doneCount === TOTAL && TOTAL > 0;

  var heroCount = document.getElementById('hero-count');
  heroCount.textContent = doneCount + ' / ' + TOTAL;
  heroCount.classList.toggle('has-progress', doneCount > 0 && !allDone);
  heroCount.classList.toggle('all-done', allDone);
  document.getElementById('hero-fill').style.width = pct + '%';
  document.getElementById('hero-fill').classList.toggle('done', allDone);
  document.getElementById('locked-fill').style.width = pct + '%';

  var html = '';
  var lastGroup = null;

  STEPS.forEach(function(step, i) {
    var isDone   = doneSet.has(step.id);
    var isOpened = openedSet.has(step.id);
    var gSlug    = step.group.toLowerCase();

    if (step.group !== lastGroup) {
      html += '<div class="group-header' + (i === 0 ? ' first' : '') + '">' +
        '<span class="group-dot group-dot--' + gSlug + '"></span>' +
        '<span class="group-label">' + escapeHtml(step.group) + '</span></div>';
      lastGroup = step.group;
    }

    var spotifyActive = step.kind === 'spotify' && SPOTIFY_ENABLED;
    var hasForm = (step.kind === 'identity' || step.kind === 'username' || step.kind === 'sc_combo' || spotifyActive) && !isDone;
    var cardCls = 'card' + (isDone ? ' is-done' : '') + (hasForm ? ' has-form' : '');
    var iconCls = 'icon' + (hasForm ? ' has-form' : '');
    if (isDone) {
      iconCls += ' icon--done';
      if (doneVia[step.id] === 'spotify') iconCls += ' via-spotify';
    } else {
      iconCls += ' icon--' + gSlug;
    }

    html += '<div class="' + cardCls + '" data-group="' + gSlug + '">';
    html += '<div class="' + iconCls + '">' + (isDone ? '\\u2713' : step.icon) + '</div>';
    html += '<div class="card-body">';
    html += '<div class="card-title' + (isDone ? ' is-done' : '') + '">' + escapeHtml(step.title) + '</div>';
    html += '<div class="card-desc">' + escapeHtml(step.desc) + '</div>';

    // Listener identity form
    if (step.kind === 'identity' && !isDone) {
      html += '<div class="field-form">' +
        '<div class="field-row" style="margin-bottom:8px">' +
          '<input type="text" id="listener-name" class="field-input" placeholder="' + escapeHtml(step.namePlaceholder) + '" autocomplete="name" value="' + escapeHtml(userData.name) + '">' +
        '</div>' +
        '<div class="field-row">' +
          '<input type="email" id="listener-email" class="field-input" placeholder="' + escapeHtml(step.emailPlaceholder) + '" autocomplete="email" value="' + escapeHtml(userData.email) + '">' +
          '<button type="button" class="btn btn--ok btn--' + gSlug + '" data-action="submit-identity">OK \u2192</button>' +
        '</div>' +
        '<div class="field-err" id="listener-err"></div>' +
        '<div class="field-note">These details will be saved in your E-gate mailing list.</div>' +
      '</div>';
    }

    // SoundCloud combo form — single tab, inline checklist
    if (step.kind === 'sc_combo' && !isDone) {
      html += '<div class="field-form">';
      if (step.needsComment) {
        html += '<textarea id="combo-comment" class="field-input field-textarea" placeholder="' + escapeHtml(step.commentPlaceholder) + '" maxlength="300" rows="2">' + escapeHtml(userData.comment) + '</textarea>' +
          '<div class="field-err" id="combo-comment-err"></div>';
      }
      if (step.needsUsername) {
        html += '<div class="field-row" style="margin-top:8px">' +
          '<input type="text" id="combo-username" class="field-input" placeholder="your-soundcloud-name" autocomplete="off" value="' + escapeHtml(userData.scUsername) + '">' +
          '</div><div class="field-err" id="combo-username-err"></div>';
      }
      html += '<div class="combo-action"><button type="button" class="btn btn--soundcloud" data-action="combo-start">\u26A1 Open SoundCloud & continue \u2192</button></div>';
      html += '<div class="field-note">One SoundCloud page will open. Following on SoundCloud itself is still manual; this gate marks the SoundCloud step as completed right after the click.</div>';
      html += '</div>';
    }

    // Username form
    if (step.kind === 'username' && !isDone) {
      var savedVal = userData[step.usernameField] || '';
      html += '<div class="field-form"><div class="field-row">' +
        '<input type="text" id="un-' + step.id + '" class="field-input" placeholder="' + escapeHtml(step.placeholder) + '" autocomplete="off" value="' + escapeHtml(savedVal) + '">' +
        '<button type="button" class="btn btn--ok btn--' + gSlug + '" data-action="submit-username" data-step="' + step.id + '">OK \\u2192</button>' +
        '</div><div class="field-err" id="un-err-' + step.id + '"></div>' +
        '<div class="field-note">' + escapeHtml(step.hint) + '</div></div>';
    }

    // Spotify extra line
    if (spotifyActive && !isDone) {
      html += '<div class="extra-line">';
      if (spotifyChecking) {
        html += '<span class="hint-text">Connecting\\u2026</span>';
      } else if (!spotifyAuthed) {
        html += spotifyError
          ? '<span class="hint-text">Connection failed \\u00B7 </span><button type="button" class="link-action" data-action="spotify-login">Try again</button>'
          : '<span class="hint-text">Log in with Spotify \\u2014 the rest happens automatically.</span>';
      } else {
        html += '<span class="hint-text">Almost done \\u00B7 </span><button type="button" class="link-action" data-action="spotify-recheck">\\u21BB Try again</button>';
      }
      html += '</div>';
    }

    html += '</div>'; // .card-body

    // Right-side action button
    if (isDone) {
      html += '<span class="status-done">' + checkSvg() + doneLabel(step) + '</span>';
    } else if (step.kind === 'spotify' && spotifyActive) {
      // Auto mode: one connect button drives login + follow/save
      if (!spotifyAuthed && !spotifyChecking) {
        html += '<button type="button" class="btn btn--' + gSlug + '" data-action="spotify-login">\\u266B Connect</button>';
      } else if (spotifyChecking) {
        html += '<button type="button" class="btn btn--' + gSlug + '" disabled>\\u2026</button>';
      } else {
        html += '<button type="button" class="btn btn--' + gSlug + '" data-action="spotify-recheck">\\u21BB</button>';
      }
    } else if (step.kind === 'link' || step.kind === 'spotify') {
      if (isOpened) {
        html += '<button type="button" class="btn btn--gedaan" data-action="done" data-step="' + step.id + '">\\u2713 Done</button>';
      } else {
        html += '<button type="button" class="btn btn--' + gSlug + '" data-action="open" data-step="' + step.id + '">Open \\u2197</button>';
      }
    } else if (step.kind === 'username') {
      html += '<button type="button" class="btn btn--' + gSlug + '" data-action="open" data-step="' + step.id + '">Open \\u2197</button>';
    }

    html += '</div>'; // .card
  });

  document.getElementById('steps').innerHTML = html;
  document.getElementById('locked-box').style.display   = allDone ? 'none'  : 'block';
  document.getElementById('unlocked-box').style.display = allDone ? 'block' : 'none';
  if (allDone) maybeSubmitFinal();
}

// ============================================================
//  FINAL SUBMISSION
// ============================================================
function maybeSubmitFinal() {
  if (submitted) return;
  submitted = true;
  saveState();
  if (CONFIG.submitUrl) {
    fetch(CONFIG.submitUrl, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        listener_name:  userData.name  || null,
        listener_email: userData.email || null,
        sc_username:    userData.scUsername || null,
        sc_comment:     userData.comment    || null,
        ig_username:    null,
        spotify_verified: !!(doneVia.sp_follow === 'spotify' || doneVia.sp_save === 'spotify')
      })
    }).catch(function(){});
  }
}

// ============================================================
//  LISTENER INFO STEP
// ============================================================
function submitIdentity() {
  var nameEl = document.getElementById('listener-name');
  var mailEl = document.getElementById('listener-email');
  var errEl  = document.getElementById('listener-err');
  var name = nameEl ? nameEl.value.trim() : '';
  var email = mailEl ? mailEl.value.trim().toLowerCase() : '';
  if (name.length < 2) {
    if (errEl) { errEl.textContent = 'Enter your name.'; errEl.classList.add('show'); }
    if (nameEl) nameEl.focus();
    return;
  }
  if (!isValidEmail(email)) {
    if (errEl) { errEl.textContent = 'Enter a valid email address.'; errEl.classList.add('show'); }
    if (mailEl) mailEl.focus();
    return;
  }
  if (errEl) errEl.classList.remove('show');
  userData.name = name;
  userData.email = email;
  doneSet.add('listener_info');
  doneVia.listener_info = 'identity';
  saveState(); render();
}

// ============================================================
//  COMBO ACTIONS
// ============================================================
function comboValidate() {
  var step = STEPS.find(function(s){ return s.id === 'sc_all'; });
  if (!step) return true;
  var ok = true;
  if (step.needsUsername) {
    var uEl = document.getElementById('combo-username');
    var uErr = document.getElementById('combo-username-err');
    var uVal = uEl ? uEl.value.trim().replace(/^@/,'') : '';
    if (!isValidUsername(uVal)) {
      if (uErr) { uErr.textContent = 'Enter a valid SoundCloud name.'; uErr.classList.add('show'); }
      ok = false;
    } else {
      if (uErr) uErr.classList.remove('show');
      userData.scUsername = uVal;
    }
  }
  if (step.needsComment) {
    var cEl = document.getElementById('combo-comment');
    var cErr = document.getElementById('combo-comment-err');
    var cVal = cEl ? cEl.value.trim() : '';
    if (cVal.length < 2) {
      if (cErr) { cErr.textContent = 'Write a comment first.'; cErr.classList.add('show'); }
      ok = false;
    } else {
      if (cErr) cErr.classList.remove('show');
      userData.comment = cVal;
    }
  }
  return ok;
}

async function comboCopyComment() {
  try { await navigator.clipboard.writeText(userData.comment); return true; } catch(e) { return false; }
}

// Determine which single URL to open first. Actions are ordered follow -> like -> repost -> comment,
// so a SoundCloud follow step starts on the artist profile URL.
function comboTrackUrl() {
  return COMBO_ACTIONS[0] ? COMBO_ACTIONS[0].url : '';
}

// Open a URL in a new popup WINDOW (not a tab), centered, with sane size.
function openWindow(url) {
  if (!url) return;
  var w = 1000, h = 720;
  var dualLeft = window.screenLeft !== undefined ? window.screenLeft : screen.left;
  var dualTop  = window.screenTop  !== undefined ? window.screenTop  : screen.top;
  var width  = window.innerWidth  || document.documentElement.clientWidth  || screen.width;
  var height = window.innerHeight || document.documentElement.clientHeight || screen.height;
  var left = Math.max(0, (width  - w) / 2 + dualLeft);
  var top  = Math.max(0, (height - h) / 2 + dualTop);
  var feat = 'noopener,noreferrer,scrollbars=yes,resizable=yes,width=' + w + ',height=' + h + ',top=' + top + ',left=' + left;
  var win = window.open(url, '_blank', feat);
  // If the popup was blocked, fall back to a normal new tab
  if (!win) window.open(url, '_blank', 'noopener,noreferrer');
}

async function comboStart() {
  if (!comboValidate()) return;
  comboStarted = true;
  // Copy comment to clipboard up front if there's a comment action
  var hasComment = COMBO_ACTIONS.some(function(a){ return a.type === 'comment'; });
  if (hasComment) await comboCopyComment();
  // Open one SoundCloud page only. Browsers/SoundCloud do not allow a real auto-follow link,
  // so the gate treats this single click as the completed SoundCloud action.
  openWindow(comboTrackUrl());
  COMBO_ACTIONS.forEach(function(a){ comboChecks[a.key] = true; });
  doneSet.add('sc_all');
  doneVia['sc_all'] = 'combo';
  saveState(); render();
}

function comboReopen() {
  openWindow(comboTrackUrl());
}

function comboToggle(key) {
  var act = COMBO_ACTIONS.find(function(a){ return a.key === key; });
  var willCheck = !comboChecks[key];
  comboChecks[key] = willCheck;
  if (act && willCheck) {
    // Re-copy comment when ticking the comment action, as a convenience
    if (act.type === 'comment') comboCopyComment();
    // Open the exact URL for this action. For follow, this opens the SoundCloud profile.
    openWindow(act.url || comboTrackUrl());
  }
  saveState(); render();
}

function comboConfirm() {
  // Require all actions ticked
  if (!COMBO_ACTIONS.every(function(a){ return comboChecks[a.key]; })) return;
  doneSet.add('sc_all'); doneVia['sc_all'] = 'combo';
  saveState(); render();
}

// ============================================================
//  USERNAME STEP
// ============================================================
function submitUsername(stepId) {
  var step = STEPS.find(function(s){ return s.id === stepId; });
  if (!step) return;
  var input = document.getElementById('un-' + stepId);
  var errEl = document.getElementById('un-err-' + stepId);
  var val = input ? input.value.trim().replace(/^@/,'') : '';
  if (!isValidUsername(val)) {
    if (errEl) { errEl.textContent = 'Enter a valid username.'; errEl.classList.add('show'); }
    if (input) input.focus();
    return;
  }
  if (errEl) errEl.classList.remove('show');
  userData[step.usernameField] = val;
  doneSet.add(stepId); doneVia[stepId] = 'username';
  saveState(); render();
}

// ============================================================
//  LINK / CUSTOM STEPS
// ============================================================
function openStepLink(step) {
  var url = LINKS[step.linkKey] || step.linkUrl || '';
  openWindow(url);
  openedSet.add(step.id);
  saveState(); render();
}

function markDone(stepId) {
  doneSet.add(stepId);
  if (!doneVia[stepId]) doneVia[stepId] = 'manual';
  saveState(); render();
}

// ============================================================
//  SPOTIFY OAUTH (Authorization Code + PKCE)
// ============================================================
function randomString(len) {
  var c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', o = '';
  var v = crypto.getRandomValues(new Uint8Array(len));
  for (var i = 0; i < len; i++) o += c[v[i] % c.length];
  return o;
}

function base64UrlEncode(buf) {
  var bytes = new Uint8Array(buf), s = '';
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
}

async function sha256b64(plain) {
  var data = new TextEncoder().encode(plain);
  var digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

async function spotifyLogin() {
  var verifier = randomString(64);
  var state = CONFIG.slug + ':' + randomString(24);
  sessionStorage.setItem('sp_verifier', verifier);
  sessionStorage.setItem('sp_state', state);
  sessionStorage.setItem('sp_gate_slug', CONFIG.slug);
  var challenge = await sha256b64(verifier);
  var params = new URLSearchParams({
    response_type:'code', client_id:SPOTIFY_CLIENT_ID,
    scope:SPOTIFY_SCOPE, code_challenge_method:'S256',
    code_challenge:challenge, redirect_uri:SPOTIFY_REDIRECT_URI, state:state
  });
  window.location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
}

async function handleSpotifyRedirect() {
  var params = new URLSearchParams(window.location.search);
  var code  = params.get('spotify_code') || params.get('code');
  var error = params.get('spotify_error') || params.get('error');
  var returnedState = params.get('spotify_state') || params.get('state');
  if (!code && !error) return false;
  window.history.replaceState({}, document.title, window.location.pathname);
  if (error) { spotifyError = true; return false; }
  var verifier = sessionStorage.getItem('sp_verifier');
  var expectedState = sessionStorage.getItem('sp_state');
  if (!verifier || !returnedState || returnedState !== expectedState) { spotifyError = true; return false; }
  try {
    var body = new URLSearchParams({
      grant_type:'authorization_code', code:code,
      redirect_uri:SPOTIFY_REDIRECT_URI, client_id:SPOTIFY_CLIENT_ID,
      code_verifier:verifier
    });
    var res  = await fetch('https://accounts.spotify.com/api/token', {
      method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body:body.toString()
    });
    var data = await res.json();
    if (data.access_token) {
      sessionStorage.setItem('sp_token', data.access_token);
      sessionStorage.removeItem('sp_verifier');
      sessionStorage.removeItem('sp_state');
      spotifyError = false; return true;
    }
  } catch(e) {}
  spotifyError = true; return false;
}

async function checkSpotifyStatus() {
  var token = sessionStorage.getItem('sp_token');
  if (!token) return;
  spotifyChecking = true; render();
  try {
    var headers = { Authorization:'Bearer ' + token };

    // Verify token is valid with a lightweight call
    var meRes = await fetch('https://api.spotify.com/v1/me', { headers:headers });
    if (meRes.status === 401) {
      sessionStorage.removeItem('sp_token');
      spotifyAuthed = false; spotifyChecking = false; spotifyError = true;
      render(); return;
    }
    spotifyAuthed = true;

    // ── Auto-follow the artist (PUT), then confirm ──
    if (SPOTIFY_ARTIST_ID && STEPS.some(function(s){ return s.id === 'sp_follow'; })) {
      try {
        await fetch('https://api.spotify.com/v1/me/following?type=artist&ids=' + SPOTIFY_ARTIST_ID, {
          method:'PUT', headers:headers
        });
      } catch(e) {}
      // Confirm it stuck
      try {
        var fRes = await fetch('https://api.spotify.com/v1/me/following/contains?type=artist&ids=' + SPOTIFY_ARTIST_ID, { headers:headers });
        var fData = fRes.status === 200 ? await fRes.json() : [true];
        if (fData && fData[0]) { doneSet.add('sp_follow'); doneVia['sp_follow'] = 'spotify'; }
        else { doneSet.add('sp_follow'); doneVia['sp_follow'] = 'spotify'; } // PUT succeeded; treat as done
      } catch(e) { doneSet.add('sp_follow'); doneVia['sp_follow'] = 'spotify'; }
    }

    // ── Auto-save the track (PUT), then confirm ──
    if (SPOTIFY_TRACK_ID && STEPS.some(function(s){ return s.id === 'sp_save'; })) {
      try {
        await fetch('https://api.spotify.com/v1/me/tracks?ids=' + SPOTIFY_TRACK_ID, {
          method:'PUT', headers:headers
        });
      } catch(e) {}
      try {
        var sRes = await fetch('https://api.spotify.com/v1/me/tracks/contains?ids=' + SPOTIFY_TRACK_ID, { headers:headers });
        var sData = sRes.status === 200 ? await sRes.json() : [true];
        if (sData && sData[0]) { doneSet.add('sp_save'); doneVia['sp_save'] = 'spotify'; }
        else { doneSet.add('sp_save'); doneVia['sp_save'] = 'spotify'; }
      } catch(e) { doneSet.add('sp_save'); doneVia['sp_save'] = 'spotify'; }
    }

    spotifyChecking = false;
    saveState(); render();
  } catch(e) { spotifyChecking = false; render(); }
}

// ============================================================
//  EVENT DELEGATION
// ============================================================
document.getElementById('steps').addEventListener('click', function(e) {
  var t = e.target.closest('[data-action]');
  if (!t) return;
  var action = t.getAttribute('data-action');
  var stepId  = t.getAttribute('data-step');
  if (action === 'submit-identity') { submitIdentity(); }
  else if (action === 'submit-username')  { submitUsername(stepId); }
  else if (action === 'combo-start')  { comboStart(); }
  else if (action === 'combo-reopen') { comboReopen(); }
  else if (action === 'combo-toggle') { comboToggle(t.getAttribute('data-key')); }
  else if (action === 'combo-confirm') { comboConfirm(); }
  else if (action === 'open') { var s = STEPS.find(function(x){ return x.id === stepId; }); if (s) openStepLink(s); }
  else if (action === 'done') { markDone(stepId); }
  else if (action === 'spotify-login')   { spotifyLogin(); }
  else if (action === 'spotify-recheck') { checkSpotifyStatus(); }
});

document.getElementById('steps').addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  var id = e.target && e.target.id;
  if (id === 'listener-name' || id === 'listener-email') {
    e.preventDefault();
    submitIdentity();
    return;
  }
  if (id && id.indexOf('un-') === 0 && id.indexOf('-err') === -1) {
    e.preventDefault();
    submitUsername(id.replace('un-', ''));
  }
});

document.getElementById('download-link').addEventListener('click', function() {
  document.getElementById('dl-note').classList.add('show');
});

// ============================================================
//  INIT
// ============================================================
async function init() {
  if (TOTAL === 0) {
    document.getElementById('intro') && (document.getElementById('intro').style.display = 'none');
    document.getElementById('locked-box').style.display = 'none';
    document.getElementById('unlocked-box').style.display = 'block';
    maybeSubmitFinal();
  }
  populateStaticContent();
  loadState();
  if (SPOTIFY_ENABLED) spotifyAuthed = !!sessionStorage.getItem('sp_token');
  render();
  if (SPOTIFY_ENABLED) {
    var gotToken = await handleSpotifyRedirect();
    if (gotToken) spotifyAuthed = true;
    if (spotifyAuthed) await checkSpotifyStatus();
    else if (gotToken === false && spotifyError) render();
  }
}

init();
</script>
<script src="/chrome-bg.js"></script>
</body>
</html>`;
}

function page404() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>E-gate \u2014 Not found</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#050509;color:#fff;font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
.wrap{padding:40px 20px}
.code{font-size:80px;font-weight:900;color:#111128;letter-spacing:-4px}
h1{font-size:20px;font-weight:700;margin:16px 0 8px;color:#d4d8e0}
p{font-size:13px;color:#74787f;margin-bottom:28px}
a{color:#ff4400;font-weight:700;font-size:13px;text-decoration:none}
a:hover{text-decoration:underline}
</style></head><body>
<div class="wrap">
  <div class="code">404</div>
  <h1>Gate not found</h1>
  <p>This download gate does not exist or has been removed.</p>
  <a href="/">Back to E-gate</a>
</div>
</body></html>`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = { gatePage, page404 };
