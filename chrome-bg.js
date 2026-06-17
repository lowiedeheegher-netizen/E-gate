<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>E-gate — Nieuwe gate maken</title>
<link rel="stylesheet" href="/style.css">
<style>
.page-title { font-family:var(--font-h); font-size:24px; font-weight:700; letter-spacing:-.5px; margin-bottom:4px; }
.page-sub { font-size:13px; color:var(--text-dim); margin-bottom:32px; }

.step-tag { font-size:9px; font-weight:700; letter-spacing:3px; text-transform:uppercase;
  color:var(--text-muted); background:var(--border); border-radius:4px; padding:2px 7px; }

/* Section head overrides for builder */
.builder-section .section-head { padding:18px 20px; }
.builder-section .section-head .toggle { margin-left:auto; }
.builder-section.is-disabled .section-body { opacity:.45; pointer-events:none; }

/* Spotify Client ID info box */
.info-box { background:rgba(255,59,0,.06); border:1px solid rgba(255,59,0,.18);
  border-radius:8px; padding:10px 14px; font-size:12px; color:var(--text-dim); line-height:1.6; margin-top:8px; }
.info-box code { color:var(--chrome); background:#050506; border:1px solid var(--border); border-radius:5px; padding:2px 5px; }

/* Custom step add button */
.add-custom-btn { display:inline-flex; align-items:center; gap:8px; background:transparent;
  border:1px dashed var(--border-2); border-radius:var(--radius-sm); padding:8px 16px;
  font-size:13px; color:var(--text-dim); cursor:pointer; font-family:var(--font-b);
  transition:border-color .2s, color .2s; margin-top:8px; }
.add-custom-btn:hover { border-color:var(--text-dim); color:var(--text); }

/* Track section layout */
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.cover-and-track { display:grid; grid-template-columns:160px 1fr; gap:16px; align-items:start; }

/* Preview panel steps */
.preview-step-icon.sc  { background:linear-gradient(135deg,#cc3d00,#ff6a00); }
.preview-step-icon.sp  { background:linear-gradient(135deg,#117a38,#1db954); }
.preview-step-icon.ig  { background:linear-gradient(135deg,#6e1cf7,#e1306c); }
.preview-step-icon.ov  { background:linear-gradient(135deg,#1e3a5f,#2563eb); }

/* Publish button */
.publish-wrap { position:sticky; bottom:0; padding:14px 0 0; margin-top:6px; }
.publish-btn-inner { background:var(--surface); border:1px solid var(--border);
  border-radius:var(--radius); padding:16px 20px;
  box-shadow:0 -8px 24px rgba(5,5,9,.8); }

@media(max-width:640px) {
  .cover-and-track { grid-template-columns:1fr; }
  .two-col { grid-template-columns:1fr; }
}
</style>
</head>
<body>

<nav class="nav">
  <a class="nav-brand" href="/">E<span style="color:var(--text-muted)">-</span>GATE</a>
  <div class="nav-spacer"></div>
  <div class="nav-links">
    <a class="nav-link" href="/dashboard.html">← Dashboard</a>
    <a class="nav-link" href="/stats.html">Statistieken</a>
    <button class="nav-link" id="logout-btn" type="button">Uitloggen</button>
  </div>
</nav>

<div class="page-wrap page-wrap--wide" style="padding-top:36px;padding-bottom:80px">
  <h1 class="page-title">Nieuwe E-gate</h1>
  <p class="page-sub">Upload je track en stel in welke stappen fans moeten doen om te downloaden.</p>

  <div class="builder-layout">

    <!-- LEFT: form sections -->
    <div class="builder-sections" id="builder-form">

      <!-- ── SECTION 1: Track ────────────────────── -->
      <div class="builder-section">
        <div class="section-head">
          <span class="section-head-icon">🎵</span>
          <span class="section-head-label">Track & coverart</span>
          <span class="step-tag">Verplicht</span>
        </div>
        <div class="section-body" id="track-section">
          <div style="margin-top:16px">
            <div class="cover-and-track">

              <!-- Cover art drop zone -->
              <div>
                <div class="field-label">Coverart</div>
                <div class="drop-zone cover-drop" id="cover-drop">
                  <input type="file" id="cover-file" accept="image/jpeg,image/png,image/webp" tabindex="-1">
                  <div class="drop-content" id="cover-drop-content">
                    <div class="drop-icon">🖼</div>
                    <div class="drop-label" style="font-size:11px">JPG · PNG · WEBP</div>
                    <div class="drop-sub">Klik of sleep</div>
                  </div>
                </div>
                <div class="field-hint">Optioneel. 1:1 aanbevolen.</div>
              </div>

              <!-- Track info fields -->
              <div>
                <div class="field">
                  <label class="field-label" for="track-name">Tracknaam <span style="color:var(--accent)">*</span></label>
                  <input class="field-input" id="track-name" type="text" placeholder="Ready Or Not" required>
                </div>
                <div class="field">
                  <label class="field-label" for="artist-name">Artiestennaam</label>
                  <input class="field-input" id="artist-name" type="text" placeholder="Low E">
                  <div class="field-hint">Vult automatisch jouw accountnaam in.</div>
                </div>
                <div class="two-col">
                  <div class="field">
                    <label class="field-label" for="genre">Genre</label>
                    <input class="field-input" id="genre" type="text" placeholder="Gabber / Hard Techno">
                  </div>
                  <div class="field">
                    <label class="field-label" for="bpm">BPM</label>
                    <input class="field-input" id="bpm" type="number" placeholder="160" min="60" max="300">
                  </div>
                </div>
              </div>
            </div>

            <!-- Track file drop zone -->
            <div class="field" style="margin-top:8px">
              <label class="field-label">Track bestand <span style="color:var(--accent)">*</span></label>
              <div class="drop-zone" id="track-drop" style="padding:22px 20px">
                <input type="file" id="track-file" accept=".wav,.mp3,.flac,.aif,.aiff" tabindex="-1">
                <div id="track-drop-content">
                  <div class="drop-icon">🎧</div>
                  <div class="drop-label">Drag & drop WAV, MP3, FLAC of AIFF</div>
                  <div class="drop-sub">Max 350 MB</div>
                </div>
              </div>
              <div class="field-error" id="track-file-error"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── SECTION 2: SoundCloud ───────────────── -->
      <div class="builder-section" id="sc-section-wrap">
        <div class="section-head" id="sc-head">
          <span class="section-head-icon">☁</span>
          <span class="section-head-label">SoundCloud</span>
          <label class="toggle" title="SoundCloud inschakelen" onclick="event.stopPropagation()">
            <input type="checkbox" id="sc-enabled" checked>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="section-body" id="sc-section">
          <div style="margin-top:16px">
            <div class="field">
              <label class="field-label" for="sc-profile-url">Profiel URL (voor volgen)</label>
              <input class="field-input" id="sc-profile-url" type="url" placeholder="https://soundcloud.com/lowetechno" value="https://soundcloud.com/lowetechno">
            </div>
            <div class="field">
              <label class="field-label" for="sc-track-url">Track URL (voor like / repost / comment)</label>
              <input class="field-input" id="sc-track-url" type="url" placeholder="https://soundcloud.com/lowetechno/ready-or-not">
              <div class="field-hint">Eén URL voor like, repost en comment — alles op dezelfde track.</div>
            </div>

            <div class="field-label" style="margin-bottom:10px">Welke stappen moeten fans doen?</div>
            <div class="sub-checks">
              <label class="sub-check"><input type="checkbox" id="sc-follow" checked><span>☁ Volg profiel</span></label>
              <label class="sub-check"><input type="checkbox" id="sc-like" checked><span>♡ Like track</span></label>
              <label class="sub-check"><input type="checkbox" id="sc-repost" checked><span>⟳ Repost track</span></label>
              <label class="sub-check"><input type="checkbox" id="sc-comment" checked><span>💬 Laat comment</span></label>
            </div>

            <div id="sc-comment-placeholder-wrap" class="field">
              <label class="field-label" for="sc-comment-placeholder">Comment-tekst (fans kopiëren en plakken)</label>
              <input class="field-input" id="sc-comment-placeholder" type="text" placeholder="Sick edit! 🔥🔥" maxlength="200">
              <div class="field-hint">Geef fans een kant-en-klare comment. Ze kunnen hem ook zelf schrijven.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── SECTION 3: Spotify ─────────────────── -->
      <div class="builder-section" id="sp-section-wrap">
        <div class="section-head" id="sp-head">
          <span class="section-head-icon">♬</span>
          <span class="section-head-label">Spotify</span>
          <label class="toggle" title="Spotify inschakelen" onclick="event.stopPropagation()">
            <input type="checkbox" id="sp-enabled">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="section-body hidden" id="sp-section">
          <div style="margin-top:16px">
            <div class="field">
              <label class="field-label" for="sp-artist-url">Artiest URL</label>
              <input class="field-input" id="sp-artist-url" type="url" placeholder="https://open.spotify.com/artist/..." value="https://open.spotify.com/artist/2Xz23vUQqZwpOaUac3A8kf">
            </div>
            <div class="sub-checks" style="margin-bottom:14px">
              <label class="sub-check"><input type="checkbox" id="sp-follow" checked><span>♬ Volg profiel</span></label>
              <label class="sub-check"><input type="checkbox" id="sp-save"><span>♥ Opslaan in bibliotheek</span></label>
            </div>
            <div id="sp-track-wrap" class="field" style="display:none">
              <label class="field-label" for="sp-track-url">Track URL (voor opslaan)</label>
              <input class="field-input" id="sp-track-url" type="url" placeholder="https://open.spotify.com/track/...">
            </div>
            <div class="field">
              <label class="field-label" for="sp-client-id">Spotify Client ID <span style="color:var(--text-muted)">(optioneel)</span></label>
              <input class="field-input" id="sp-client-id" type="text" placeholder="32-karakter code van Spotify Developer Dashboard" maxlength="64" value="e9ad64e7253942e89629b30aa4de758f">
              <div class="info-box">
                <strong>Laat leeg</strong> voor handmatige verificatie (fans klikken "Gedaan" zelf).<br>
                Vul in voor <strong>automatische verificatie</strong> — fans loggen in via Spotify en E-gate volgt/slaat automatisch op.<br>
                Zet in je Spotify Developer App exact deze Redirect URI: <code id="spotify-callback-uri"></code>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── SECTION 4: Instagram ───────────────── -->
      <div class="builder-section" id="ig-section-wrap">
        <div class="section-head" id="ig-head">
          <span class="section-head-icon">◉</span>
          <span class="section-head-label">Instagram</span>
          <label class="toggle" title="Instagram inschakelen" onclick="event.stopPropagation()">
            <input type="checkbox" id="ig-enabled">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="section-body hidden" id="ig-section">
          <div style="margin-top:16px">
            <div class="field">
              <label class="field-label" for="ig-url">Profiel URL</label>
              <input class="field-input" id="ig-url" type="url" placeholder="https://www.instagram.com/low.e___/" value="https://www.instagram.com/low.e___">
              <div class="field-hint">Fans openen je profiel, volgen je en klikken daarna op "Gedaan". Ze hoeven geen gebruikersnaam meer in te vullen.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── SECTION 5: Custom steps ────────────── -->
      <div class="builder-section" id="custom-section-wrap">
        <div class="section-head">
          <span class="section-head-icon">↗</span>
          <span class="section-head-label">Eigen stappen</span>
          <span class="step-tag">Max 3 · Optioneel</span>
        </div>
        <div class="section-body" id="custom-section">
          <div style="margin-top:16px">
            <div class="field-hint" style="margin-bottom:14px">
              Voeg extra links toe: YouTube, nieuwsbrief, Discord, Bandcamp — alles kan.
              Fans klikken de link open en bevestigen zelf.
            </div>
            <div id="custom-steps-container"></div>
            <button type="button" class="add-custom-btn" id="add-custom-btn">
              + Voeg eigen stap toe
            </button>
            <div class="field-hint" id="custom-max-note" style="display:none;margin-top:8px">Maximum van 3 stappen bereikt.</div>
          </div>
        </div>
      </div>

      <!-- ── PUBLISH ────────────────────────────── -->
      <div class="publish-wrap">
        <div class="publish-btn-inner">
          <div id="publish-error" style="display:none;font-size:12px;color:#f87171;margin-bottom:12px;padding:8px 12px;background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.18);border-radius:7px"></div>
          <button class="btn btn--primary btn--full btn--lg" id="publish-btn" type="button">
            Publiceer E-gate →
          </button>
          <div style="font-size:11px;color:var(--text-muted);margin-top:8px;text-align:center">
            Je krijgt direct een unieke link die je kunt delen.
          </div>
        </div>
      </div>

    </div><!-- /builder-sections -->

    <!-- RIGHT: preview panel -->
    <aside>
      <div class="preview-panel" id="preview-panel">
        <div class="preview-title">Voorbeeld stappen</div>
        <div id="preview-steps">
          <div class="preview-empty">Schakel stappen in om een voorbeeld te zien.</div>
        </div>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;letter-spacing:.3px">
            Na voltooiing van alle stappen:
          </div>
          <div style="background:linear-gradient(135deg,var(--accent),#ff6600);border-radius:8px;padding:12px;text-align:center;font-size:13px;font-weight:700;color:#fff">
            ↓ Download GRATIS
          </div>
        </div>
      </div>
    </aside>

  </div><!-- /builder-layout -->
</div><!-- /page-wrap -->

<!-- Success overlay -->
<div class="overlay" id="success-overlay" style="display:none">
  <div class="overlay-box">
    <div class="overlay-emoji">🎉</div>
    <h2 class="overlay-title">Jouw E-gate is live!</h2>
    <p class="overlay-sub">Deel deze link met je fans. Ze voltooien de stappen en downloaden de track direct.</p>
    <div class="gate-url-big" id="success-url"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn--primary" id="copy-success-url" type="button" style="flex:1">📋 Kopieer link</button>
      <a class="btn btn--ghost" id="preview-gate-link" href="#" target="_blank" rel="noopener" style="flex:1">↗ Bekijk gate</a>
    </div>
    <a class="btn btn--ghost btn--full" href="/dashboard.html" style="margin-top:10px">Naar dashboard</a>
  </div>
</div>

<!-- Toast -->
<div class="toast" id="toast"></div>

<script>
(function() {
  // ── Auth guard ─────────────────────────────────────────
  var token = localStorage.getItem('egate_token');
  if (!token) { window.location.href = '/login.html'; return; }
  var storedName = localStorage.getItem('egate_name') || '';
  if (storedName) document.getElementById('artist-name').value = storedName;

  // ── Edit mode? ─────────────────────────────────────────
  var editId = new URLSearchParams(window.location.search).get('edit');
  var isEdit = !!editId;
  var existingTrack = false; // does the gate already have a track file?

  document.getElementById('logout-btn').addEventListener('click', function() {
    localStorage.removeItem('egate_token');
    localStorage.removeItem('egate_name');
    window.location.href = '/';
  });

  // ── Toast ──────────────────────────────────────────────
  var toastEl = document.getElementById('toast');
  var toastTimer;
  function showToast(msg, type) {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.className = 'toast show ' + (type || '');
    toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 2800);
  }

  // ── Section toggles ────────────────────────────────────
  function setupToggle(checkId, sectionId, wrapId) {
    var check   = document.getElementById(checkId);
    var section = document.getElementById(sectionId);
    var wrap    = document.getElementById(wrapId);
    if (!check || !section) return;
    function update() {
      if (check.checked) {
        section.classList.remove('hidden');
        if (wrap) wrap.classList.remove('is-disabled');
      } else {
        section.classList.add('hidden');
        if (wrap) wrap.classList.add('is-disabled');
      }
      updatePreview();
    }
    check.addEventListener('change', update);
    update();
  }

  setupToggle('sc-enabled', 'sc-section', 'sc-section-wrap');
  setupToggle('sp-enabled', 'sp-section', 'sp-section-wrap');
  setupToggle('ig-enabled', 'ig-section', 'ig-section-wrap');

  var cbUriEl = document.getElementById('spotify-callback-uri');
  if (cbUriEl) cbUriEl.textContent = window.location.origin + '/spotify-callback.html';

  // SC comment checkbox — show/hide placeholder
  document.getElementById('sc-comment').addEventListener('change', function() {
    document.getElementById('sc-comment-placeholder-wrap').style.display = this.checked ? 'block' : 'none';
    updatePreview();
  });

  // Spotify save checkbox — show/hide track URL
  document.getElementById('sp-save').addEventListener('change', function() {
    document.getElementById('sp-track-wrap').style.display = this.checked ? 'block' : 'none';
    updatePreview();
  });

  // All checkboxes → update preview
  document.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
    cb.addEventListener('change', updatePreview);
  });

  // ── File drop zones ────────────────────────────────────
  function setupDropZone(dropId, inputId, onFile) {
    var drop  = document.getElementById(dropId);
    var input = document.getElementById(inputId);
    if (!drop || !input) return;

    drop.addEventListener('click', function(e) {
      if (e.target !== input) input.click();
    });
    input.addEventListener('change', function() {
      if (input.files[0]) onFile(input.files[0]);
    });
    drop.addEventListener('dragover', function(e) { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', function()  { drop.classList.remove('drag-over'); });
    drop.addEventListener('drop', function(e) {
      e.preventDefault(); drop.classList.remove('drag-over');
      var file = e.dataTransfer.files[0];
      if (file) {
        // Set the file to the input
        var dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        onFile(file);
      }
    });
  }

  // Cover art drop zone
  setupDropZone('cover-drop', 'cover-file', function(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var drop = document.getElementById('cover-drop');
      drop.classList.add('has-file');
      drop.querySelector('input').style.zIndex = '2';
      document.getElementById('cover-drop-content').innerHTML =
        '<img class="drop-preview" src="' + e.target.result + '" alt="Cover">';
    };
    reader.readAsDataURL(file);
  });

  // Track file drop zone
  setupDropZone('track-drop', 'track-file', function(file) {
    var drop = document.getElementById('track-drop');
    drop.classList.add('has-file');
    var mb = (file.size / 1024 / 1024).toFixed(1);
    document.getElementById('track-drop-content').innerHTML =
      '<div class="drop-icon">\u2713</div>' +
      '<div class="drop-label">' + escHtml(file.name) + '</div>' +
      '<div class="drop-sub">' + mb + ' MB</div>';
    document.getElementById('track-file-error').classList.remove('show');
  });

  // ── Custom steps ───────────────────────────────────────
  var customCount = 0;

  function addCustomStep() {
    if (customCount >= 3) return;
    customCount++;
    var idx = customCount;
    var container = document.getElementById('custom-steps-container');
    var row = document.createElement('div');
    row.className = 'custom-step-row';
    row.dataset.idx = idx;
    row.innerHTML =
      '<input class="field-input field-input--sm" type="text" placeholder="Label (bv. Subscribe)" data-custom="label-' + idx + '" maxlength="60">' +
      '<input class="field-input field-input--sm" type="url" placeholder="https://..." data-custom="url-' + idx + '">' +
      '<button type="button" class="btn btn--danger btn--sm remove-custom" data-idx="' + idx + '" title="Verwijder">✕</button>';
    container.appendChild(row);
    if (customCount >= 3) {
      document.getElementById('add-custom-btn').style.display = 'none';
      document.getElementById('custom-max-note').style.display = 'block';
    }
    row.querySelector('input').focus();
    row.querySelectorAll('input').forEach(function(i) { i.addEventListener('input', updatePreview); });
    updatePreview();
  }

  document.getElementById('add-custom-btn').addEventListener('click', addCustomStep);

  document.getElementById('custom-steps-container').addEventListener('click', function(e) {
    var btn = e.target.closest('.remove-custom');
    if (!btn) return;
    var row = btn.closest('.custom-step-row');
    if (row) { row.remove(); customCount--; }
    document.getElementById('add-custom-btn').style.display = customCount < 3 ? 'inline-flex' : 'none';
    document.getElementById('custom-max-note').style.display = customCount >= 3 ? 'block' : 'none';
    updatePreview();
  });

  // ── Live preview panel ─────────────────────────────────
  function updatePreview() {
    var steps = [];

    // SoundCloud
    if (document.getElementById('sc-enabled').checked) {
      var scSubs = [];
      if (document.getElementById('sc-follow').checked)  scSubs.push('Volg');
      if (document.getElementById('sc-like').checked)    scSubs.push('Like');
      if (document.getElementById('sc-repost').checked)  scSubs.push('Repost');
      if (document.getElementById('sc-comment').checked) scSubs.push('Comment');
      if (scSubs.length) steps.push({ icon:'☁', cls:'sc', name:'SoundCloud', desc:scSubs.join(' · ') });
    }

    // Spotify
    if (document.getElementById('sp-enabled').checked) {
      if (document.getElementById('sp-follow').checked) steps.push({ icon:'♬', cls:'sp', name:'Volg op Spotify', desc:'Artiest volgen' });
      if (document.getElementById('sp-save').checked)   steps.push({ icon:'♥', cls:'sp', name:'Opslaan', desc:'Opslaan in bibliotheek' });
    }

    // Instagram
    if (document.getElementById('ig-enabled').checked) {
      steps.push({ icon:'◉', cls:'ig', name:'Instagram volgen', desc:'Profiel volgen' });
    }

    // Custom
    document.querySelectorAll('.custom-step-row').forEach(function(row) {
      var lEl = row.querySelector('[data-custom^="label"]');
      var uEl = row.querySelector('[data-custom^="url"]');
      var label = lEl ? lEl.value.trim() : '';
      var url   = uEl ? uEl.value.trim() : '';
      if (label || url) steps.push({ icon:'↗', cls:'ov', name: label || 'Eigen stap', desc: url || 'Link' });
    });

    var container = document.getElementById('preview-steps');
    if (!steps.length) {
      container.innerHTML = '<div class="preview-empty">Schakel stappen in om een voorbeeld te zien.</div>';
      return;
    }
    var html = '';
    steps.forEach(function(s) {
      html += '<div class="preview-step">' +
        '<div class="preview-step-icon ' + s.cls + '">' + s.icon + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="preview-step-name">' + escHtml(s.name) + '</div>' +
          '<div class="card-meta" style="font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(s.desc) + '</div>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  updatePreview();

  // ── Build config JSON ──────────────────────────────────
  function buildConfig() {
    var custom = [];
    document.querySelectorAll('.custom-step-row').forEach(function(row) {
      var lEl = row.querySelector('[data-custom^="label"]');
      var uEl = row.querySelector('[data-custom^="url"]');
      var label = lEl ? lEl.value.trim() : '';
      var url   = uEl ? uEl.value.trim() : '';
      if (label && url) custom.push({ enabled: true, label: label, url: url });
    });

    var scTrackUrl = document.getElementById('sc-track-url').value.trim();
    return {
      genre: document.getElementById('genre').value.trim(),
      bpm:   document.getElementById('bpm').value.trim(),
      sc: {
        enabled: document.getElementById('sc-enabled').checked,
        follow:  { enabled: document.getElementById('sc-follow').checked,  url: document.getElementById('sc-profile-url').value.trim() },
        like:    { enabled: document.getElementById('sc-like').checked,    url: scTrackUrl },
        repost:  { enabled: document.getElementById('sc-repost').checked,  url: scTrackUrl },
        comment: { enabled: document.getElementById('sc-comment').checked, url: scTrackUrl, placeholder: document.getElementById('sc-comment-placeholder').value.trim() }
      },
      sp: {
        enabled:  document.getElementById('sp-enabled').checked,
        clientId: document.getElementById('sp-client-id').value.trim(),
        follow:   { enabled: document.getElementById('sp-follow').checked, url: document.getElementById('sp-artist-url').value.trim() },
        save:     { enabled: document.getElementById('sp-save').checked,   url: document.getElementById('sp-track-url').value.trim() }
      },
      ig: {
        enabled: document.getElementById('ig-enabled').checked,
        url:     document.getElementById('ig-url').value.trim()
      },
      custom: custom
    };
  }

  // ── Validate ───────────────────────────────────────────
  function validate() {
    var track = document.getElementById('track-name').value.trim();
    if (!track) return 'Tracknaam is verplicht.';
    var tf = document.getElementById('track-file').files[0];
    if (!tf && !(isEdit && existingTrack)) return 'Upload een track bestand (WAV/MP3/FLAC/AIFF).';
    // Check at least one step is enabled
    var cfg = buildConfig();
    var hasStep = (cfg.sc.enabled && (cfg.sc.follow.enabled || cfg.sc.like.enabled || cfg.sc.repost.enabled || cfg.sc.comment.enabled))
      || (cfg.sp.enabled && (cfg.sp.follow.enabled || cfg.sp.save.enabled))
      || cfg.ig.enabled
      || cfg.custom.some(function(c){ return c.enabled; });
    if (!hasStep) return 'Schakel minstens één stap in voor je luisteraars.';
    return null;
  }

  // ── Publish ────────────────────────────────────────────
  var publishBtn = document.getElementById('publish-btn');
  var publishErr = document.getElementById('publish-error');

  publishBtn.addEventListener('click', async function() {
    publishErr.style.display = 'none';
    var err = validate();
    if (err) {
      publishErr.textContent = err;
      publishErr.style.display = 'block';
      publishErr.scrollIntoView({ behavior:'smooth', block:'nearest' });
      return;
    }

    publishBtn.disabled = true;
    publishBtn.textContent = isEdit ? 'Opslaan\u2026' : 'Even geduld\u2026';

    var formData = new FormData();
    formData.append('track_name',  document.getElementById('track-name').value.trim());
    formData.append('artist_name', document.getElementById('artist-name').value.trim() || storedName);
    formData.append('config',      JSON.stringify(buildConfig()));
    var newTrack = document.getElementById('track-file').files[0];
    if (newTrack) formData.append('track_file', newTrack);
    var cover = document.getElementById('cover-file').files[0];
    if (cover) formData.append('cover_art', cover);

    try {
      var res  = await fetch(isEdit ? ('/api/gates/' + editId) : '/api/gates', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body:   formData
      });
      var data = await res.json();
      if (!res.ok) {
        publishErr.textContent = data.error || (isEdit ? 'Opslaan mislukt.' : 'Aanmaken mislukt.');
        publishErr.style.display = 'block';
        publishBtn.disabled = false;
        publishBtn.textContent = isEdit ? 'Wijzigingen opslaan' : 'Publiceer E-gate \u2192';
        return;
      }
      // Success!
      showSuccess(data.slug);
    } catch(e) {
      publishErr.textContent = 'Verbindingsfout. Probeer opnieuw.';
      publishErr.style.display = 'block';
      publishBtn.disabled = false;
      publishBtn.textContent = isEdit ? 'Wijzigingen opslaan' : 'Publiceer E-gate \u2192';
    }
  });

  function showSuccess(slug) {
    var url = window.location.origin + '/gate/' + slug;
    if (isEdit) {
      document.querySelector('.overlay-title').textContent = 'Wijzigingen opgeslagen!';
      document.querySelector('.overlay-sub').textContent = 'Je gate is bijgewerkt. Dezelfde link blijft werken.';
    }
    document.getElementById('success-url').textContent = url;
    document.getElementById('preview-gate-link').href = url;
    document.getElementById('success-overlay').style.display = 'flex';

    document.getElementById('copy-success-url').addEventListener('click', function() {
      navigator.clipboard.writeText(url).then(function() {
        showToast('\u2713 Link gekopieerd!', 'success');
      });
    });
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Load existing gate for editing ─────────────────────
  function setCheck(id, val) { var el = document.getElementById(id); if (el) { el.checked = !!val; } }
  function setVal(id, val)   { var el = document.getElementById(id); if (el && val != null) el.value = val; }

  async function loadForEdit() {
    // Switch UI into edit mode
    document.querySelector('.page-title').textContent = 'E-gate bewerken';
    document.querySelector('.page-sub').textContent = 'Pas je gate aan en sla de wijzigingen op.';
    publishBtn.textContent = 'Wijzigingen opslaan';

    try {
      var res = await fetch('/api/gates/' + editId, { headers: { Authorization: 'Bearer ' + token } });
      if (res.status === 401) { localStorage.removeItem('egate_token'); window.location.href = '/login.html'; return; }
      if (!res.ok) { publishErr.textContent = 'Kon gate niet laden.'; publishErr.style.display = 'block'; return; }
      var g = await res.json();
      var c = g.config || {};

      setVal('track-name', g.track_name);
      setVal('artist-name', g.artist_name);
      setVal('genre', c.genre);
      setVal('bpm', c.bpm);

      existingTrack = g.has_track;
      if (existingTrack) {
        var dz = document.getElementById('track-drop');
        dz.classList.add('has-file');
        document.getElementById('track-drop-content').innerHTML =
          '<div class="drop-icon">\u2713</div><div class="drop-label">' + escHtml(g.track_original_name || 'Huidige track blijft behouden') + '</div>' +
          '<div class="drop-sub">Sleep een nieuw bestand om te vervangen</div>';
      }
      if (g.cover_art) {
        var cd = document.getElementById('cover-drop');
        cd.classList.add('has-file');
        document.getElementById('cover-drop-content').innerHTML =
          '<img class="drop-preview" src="/uploads/covers/' + g.cover_art + '" alt="Cover">';
      }

      // SoundCloud
      if (c.sc) {
        setCheck('sc-enabled', c.sc.enabled);
        setVal('sc-profile-url', c.sc.follow && c.sc.follow.url);
        setVal('sc-track-url', (c.sc.like && c.sc.like.url) || (c.sc.comment && c.sc.comment.url));
        setCheck('sc-follow', c.sc.follow && c.sc.follow.enabled);
        setCheck('sc-like', c.sc.like && c.sc.like.enabled);
        setCheck('sc-repost', c.sc.repost && c.sc.repost.enabled);
        setCheck('sc-comment', c.sc.comment && c.sc.comment.enabled);
        setVal('sc-comment-placeholder', c.sc.comment && c.sc.comment.placeholder);
        document.getElementById('sc-comment-placeholder-wrap').style.display =
          (c.sc.comment && c.sc.comment.enabled) ? 'block' : 'none';
      }
      // Spotify
      if (c.sp) {
        setCheck('sp-enabled', c.sp.enabled);
        setVal('sp-artist-url', c.sp.follow && c.sp.follow.url);
        setVal('sp-client-id', c.sp.clientId);
        setCheck('sp-follow', c.sp.follow && c.sp.follow.enabled);
        setCheck('sp-save', c.sp.save && c.sp.save.enabled);
        setVal('sp-track-url', c.sp.save && c.sp.save.url);
        document.getElementById('sp-track-wrap').style.display =
          (c.sp.save && c.sp.save.enabled) ? 'block' : 'none';
      }
      // Instagram
      if (c.ig) {
        setCheck('ig-enabled', c.ig.enabled);
        setVal('ig-url', c.ig.url);
      }
      // Custom steps
      if (Array.isArray(c.custom)) {
        c.custom.forEach(function(cs) {
          if (!cs.label && !cs.url) return;
          addCustomStep();
          var rows = document.querySelectorAll('.custom-step-row');
          var row = rows[rows.length - 1];
          if (row) {
            row.querySelector('[data-custom^="label"]').value = cs.label || '';
            row.querySelector('[data-custom^="url"]').value = cs.url || '';
          }
        });
      }

      // Re-run all toggle visibility + preview
      ['sc-enabled','sp-enabled','ig-enabled'].forEach(function(id){
        var el = document.getElementById(id);
        if (el) el.dispatchEvent(new Event('change'));
      });
      updatePreview();
    } catch(e) {
      publishErr.textContent = 'Verbindingsfout bij laden.'; publishErr.style.display = 'block';
    }
  }

  if (isEdit) loadForEdit();

}());
</script>
<script src="/chrome-bg.js"></script>
</body>
</html>
