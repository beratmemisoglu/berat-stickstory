// berat studio's preview / render host for the BLENDER engine (3D cartoon shorts, docs/BLENDER_ENGINE_PLAN.md). Served at
// /p/<projectId>/__suite/blender.html. It speaks the same messages as host.js, so the editor (Preview.tsx: seek,
// playing, pick, frame, info, ping, graphics) and the render workers (window.suite: info, stills, events, layout,
// sweep, errors) work unchanged; the frames come from the app's hidden Blender through the local server:
//   blender/shots                         -> the shot list ({fps, end, shots: [{name, file, f0, f1, t0, t1}]})
//   blender/frame?f=&mode=solid|look&w=   -> a JPEG (Solid = Workbench, light; Look = EEVEE as the film renders it)
//   blender/pick?f=&x=&y=                 -> what is under the click (a ray through that pixel, through glass)
// Frames are global, 30 fps, frame 1 = time 0. Scrubbing asks Solid frames and drops stale ones; when the playhead rests
// in Look mode a Look frame replaces the Solid one. Playing streams Solid frames as fast as the server returns them.
const qs = new URLSearchParams(location.search);
const MODE = qs.get('mode') || 'preview';
// the film's frame: 1080x1920, or 1920x1080 for a 16:9 project (settings.format landscape, read in boot)
const FPS = 30;
let FW = 1080, FH = 1920;
const API = 'blender/';
const view = document.getElementById('view'), note = document.getElementById('note'), badge = document.getElementById('badge');
const parentPost = msg => { try { window.parent !== window && window.parent.postMessage({ source: 'cz-host', ...msg }, '*'); } catch {} };
const errors = [];
const logError = (level, text) => { errors.push({ level, text: String(text), at: Date.now() }); if (errors.length > 200) errors.shift(); if (MODE === 'preview') parentPost({ type: 'log', level, text: String(text) }); else console.log(`[${level}] ${text}`); };
let P = null, SHOTS = [], END = 0, t = 0, ready = false;
// Solid (light on the computer) or Look (EEVEE); the editor's switch sends it as a graphics value, kept per computer
let bmode = (() => { try { return localStorage.getItem('cz-bmode') || 'solid'; } catch { return 'solid'; } })();
// preview frame widths: 540 / 360 px across a vertical frame, the same short side (960 / 640 across) for a wide one
let W_SCRUB = 540, W_PLAY = 360;
const LOOK_SAMPLES = 4, REST_MS = 220;

const frameOf = time => Math.max(1, Math.round(Math.max(0, Math.min(END, time)) * FPS) + 1);
const shotAt = f => { let own = null; for (const s of SHOTS) if (s.f0 <= f && f <= s.f1) own = s; return own; };
const fmtT = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
function say(msg, small) { note.innerHTML = ''; if (!msg) return; note.textContent = msg; if (small) { const e = document.createElement('small'); e.textContent = small; note.appendChild(e); } }

// ---------- frames ----------
let shown = { f: -1, mode: null, w: 0 };       // what is on screen
let want = null;                                // the frame asked for last ({f, mode, w})
let inflight = 0, restTimer = 0, playing = false, firstFrame = true;
async function fetchFrame(f, mode, w, samples = LOOK_SAMPLES) {
  const r = await fetch(`${API}frame?f=${f}&mode=${mode}&w=${w}&samples=${samples}`, { cache: 'no-store' });
  if (r.status === 204) return null;                                   // a newer request replaced it
  if (!r.ok) { let m = `frame ${f}: HTTP ${r.status}`; try { m = (await r.json()).error || m; } catch {} throw new Error(m); }
  return { blob: await r.blob(), ms: +(r.headers.get('X-Cz-Ms') || 0), shot: r.headers.get('X-Cz-Shot') };
}
function put(res, f, mode, w) {
  const url = URL.createObjectURL(res.blob), old = view.src;
  view.onload = () => { if (old.startsWith('blob:')) URL.revokeObjectURL(old); };
  view.src = url; shown = { f, mode, w }; firstFrame = false; say('');
  badge.style.display = 'block'; badge.textContent = `${mode === 'look' ? 'Look' : 'Solid'} · ${res.shot || ''} · f${f}`;
}
async function request(f, mode, w) {
  want = { f, mode, w }; inflight++;
  if (firstFrame) say('Starting Blender…', `building the shot at ${fmtT((f - 1) / FPS)} (the first frame of each shot takes a few seconds)`);
  try {
    const res = await fetchFrame(f, mode, w);
    if (res && want && want.f === f && (want.mode === mode || mode === 'solid')) put(res, f, mode, w);
    else if (res && playing) put(res, f, mode, w);                     // while playing every returned frame moves the picture on
  } catch (e) { logError('error', e.message); if (firstFrame) say('The Blender preview could not draw this shot', e.message.slice(0, 300)); }
  finally { inflight--; }
}
function show(time) {
  t = Math.max(0, Math.min(END, time)); const f = frameOf(t);
  if (!SHOTS.length) { say('No shots yet', 'Build the video with Claude: each shot is a Blender scene file in the project.'); return; }
  if (!shotAt(f) && f > 1) { say('No shot at this moment', fmtT(t)); }
  if (playing) return;                                                   // the play loop asks for its own frames
  if ((shown.f !== f || shown.mode === null) && cachedAt(f)) putCached(f);   // a scrub shows the cached frame at once, the sharper live one follows
  if (shown.f !== f || shown.mode === null || shown.mode === 'cache') request(f, 'solid', W_SCRUB);
  clearTimeout(restTimer);
  if (bmode === 'look') restTimer = setTimeout(() => { if (frameOf(t) === f && !playing) request(f, 'look', W_SCRUB); }, REST_MS);
}
// ---------- the playback cache (blender/cache.ts: every shot's Solid frames at 360 px, filled in the background) ----------
let cmap = { key: '', shots: [] };
async function refreshCache() { try { cmap = await (await fetch(API + 'cachemap', { cache: 'no-store' })).json(); } catch { /* not yet */ } }
const cachedAt = f => { let s = null; for (const x of cmap.shots || []) if (x.f0 <= f && f <= x.f1) s = x; return !!s && f - s.f0 < s.have; };
const cacheUrl = f => `${API}cache?f=${f}&k=${cmap.key}`;
const preload = new Map();                                             // frame -> Image (decoded ahead of the playhead)
function warm(f) {
  for (let k = 0; k < 14; k++) { const g = f + k; if (g > frameOf(END) || preload.has(g) || !cachedAt(g)) continue; const im = new Image(); im.src = cacheUrl(g); preload.set(g, im); }
  for (const g of [...preload.keys()]) if (g < f - 2 || g > f + 30) preload.delete(g);
}
function putCached(f) {
  const im = preload.get(f); view.src = im?.src || cacheUrl(f); shown = { f, mode: 'cache', w: W_PLAY }; firstFrame = false; say('');
  badge.style.display = 'block'; badge.textContent = `Playing · cached · f${f}`;
}
// playing: the newest time of the editor's clock; cached frames when the shot's cache has them (full speed), else a live
// Solid frame at a time, as fast as Blender returns them
const run = { t: 0, at: 0, rate: 1 };
const epochNow = () => performance.timeOrigin + performance.now();
async function playLoop() {
  while (playing) {
    const now = Math.min(END, run.t + Math.max(0, epochNow() - run.at) / 1000 * run.rate); t = now;
    const f = frameOf(now);
    if (f !== shown.f) {
      if (cachedAt(f)) { warm(f); putCached(f); await new Promise(r => setTimeout(r, 8)); }
      else await request(f, 'solid', W_PLAY);
    } else await new Promise(r => setTimeout(r, 8));
  }
}
function setPlaying(on, m) {
  if (m) { run.t = m.t; run.at = m.at; run.rate = +m.rate > 0 ? +m.rate : 1; }
  if (on && !playing) { playing = true; playLoop(); }
  if (!on && playing) { playing = false; show(t); }
}

// ---------- picking ----------
async function pick(nx, ny, time) {
  if (!SHOTS.length) return null;
  if (time !== undefined) t = Math.max(0, Math.min(END, time));
  const f = frameOf(t), s = shotAt(f);
  const shot = s ? { index: s.index, t0: s.t0, t1: s.t1, file: s.file, line: 1, name: s.name } : null;
  const r = await (await fetch(`${API}pick?f=${f}&x=${nx}&y=${ny}`, { cache: 'no-store' })).json();
  if (r?.error) throw new Error(r.error);
  if (!r || !r.object) return { kind: 'shot', time: t, shot };
  return { kind: 'object', time: t, shot, element: { key: r.owner, kind: r.char ? 'character' : 'object', name: r.char || r.owner, point: r.point, size: null, ramp: null,
    blender: { object: r.object, owner: r.owner, character: r.char, seenThrough: r.through || [] } }, rect: null };
}

function info() {
  return { end: END, title: P?.title, settings: P?.settings || {}, art: [FW, FH], size: [FW, FH], kind: 'blender', errors: errors.slice(-50), cues: [],
    preview: { asked: 1, scale: 1, scalable: false, drawn: [view.naturalWidth || 0, view.naturalHeight || 0] }, graphics: { bmode }, gpu: null,
    shots: SHOTS.map(s => ({ index: s.index, t0: s.t0, t1: s.t1, file: s.file, line: 1, name: s.name, chapter: null, chapterFirst: false, cut: true, trans: null })) };
}

async function boot() {
  P = await (await fetch('../project.json', { cache: 'no-store' })).json();
  if (P?.settings?.format === 'landscape') { FW = 1920; FH = 1080; W_SCRUB = 960; W_PLAY = 640; }
  const sh = await (await fetch(API + 'shots', { cache: 'no-store' })).json();
  SHOTS = (sh.shots || []).map((s, index) => ({ ...s, index }));
  END = Math.max(+P.end || 0, (sh.end || 0) / FPS);
}

// ---------- message API (preview mode) ----------
window.addEventListener('message', async e => {
  const m = e.data; if (!m || m.target !== 'cz-host') return;
  if (!ready) { if (m.id) parentPost({ type: 'reply-error', id: m.id, message: 'The preview is not loaded.' }); return; }
  try {
    if (m.type === 'seek') { if (m.playing && typeof m.at === 'number') setPlaying(true, m); else { setPlaying(false); show(m.t); } }
    else if (m.type === 'playing') { setPlaying(!!m.on); }
    else if (m.type === 'crisp') { /* (the frame is a picture: nothing to sharpen) */ }
    else if (m.type === 'pick') parentPost({ type: 'picked', id: m.id, result: await pick(m.x, m.y, m.t) });
    else if (m.type === 'frame') {
      const c = document.createElement('canvas'); c.width = FW * (m.scale || .25); c.height = FH * (m.scale || .25);
      if (view.complete && view.naturalWidth) c.getContext('2d').drawImage(view, 0, 0, c.width, c.height);
      parentPost({ type: 'frame', id: m.id, dataUrl: c.toDataURL('image/jpeg', .85) });
    }
    else if (m.type === 'info') parentPost({ type: 'info', id: m.id, info: info() });
    else if (m.type === 'ping') parentPost({ type: 'pong', id: m.id, result: { t, lost: false } });
    else if (m.type === 'graphics') {
      const v = m.values || {};
      if (v.bmode === 'solid' || v.bmode === 'look') { bmode = v.bmode; try { localStorage.setItem('cz-bmode', bmode); } catch {} shown.mode = null; if (m.redraw !== false) show(t); }
      if (m.id) parentPost({ type: 'graphics', id: m.id, result: { bmode, t } });
    }
    else if (m.type === 'bench') parentPost({ type: 'bench', id: m.id, result: { fps: 0, t } });
  } catch (err) { logError('error', err.message); parentPost({ type: 'reply-error', id: m.id, message: err.message }); }
});

// ---------- render worker API (render mode) ----------
window.suite = {
  info,
  // Claude's render_frames and the thumbnails: Look frames at the asked size (16 samples: what the export shows)
  async stills(times, scale = .5) {
    const out = [], w = Math.round(FW * scale);
    for (const tt of times) {
      try {
        const res = await fetchFrame(frameOf(tt), 'look', w, 16);
        if (!res) { out.push(null); continue; }
        const bmp = await createImageBitmap(res.blob), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        c.getContext('2d').drawImage(bmp, 0, 0); out.push(c.toDataURL('image/png'));
      } catch (err) { logError('error', `${fmtT(tt)}: ${err.message}`); out.push(null); }
    }
    return out;
  },
  async sweep() { return { frames: 0, errors: [] }; },
  async exportVideo() { throw new Error('Blender videos export through the Blender render (the app does it), not this page.'); },
  // sound design: the shot starts (each shot is a cut); actions come from the scene files' events later
  async events() { return { shots: SHOTS.map(s => ({ t0: +s.t0.toFixed(3), chapter: false, cut: true, mode: 0, name: s.name })), hits: [], cards: [] }; },
  // check_layout: each shot built by the app's Blender once, its automatic contact report (limbs through solids, nobody
  // on their seat, faces not drawn, scene errors) as issues; a range checks only the shots in it (a crew agent's part)
  async layout(times, range) {
    const q = range && (range.from != null || range.to != null) ? `?${range.from != null ? `from=${range.from}` : ''}${range.from != null && range.to != null ? '&' : ''}${range.to != null ? `to=${range.to}` : ''}` : '';
    const r = await (await fetch(API + 'check' + q, { cache: 'no-store' })).json();
    if (r?.error) throw new Error(r.error);
    return { times: r.times || [], issues: r.issues || [] };
  },
  errors: () => errors.slice(),
};

boot().then(async () => {
  if (MODE === 'preview') { await refreshCache(); setInterval(refreshCache, 3000); }
  ready = true; window.ready = true;
  if (MODE === 'preview') show(+(qs.get('t') || 0));
  parentPost({ type: 'ready', info: info(), sceneErrors: [] });
}).catch(err => { logError('error', 'boot failed: ' + err.message); window.bootError = err.message; window.ready = true; parentPost({ type: 'boot-error', message: err.message }); });
