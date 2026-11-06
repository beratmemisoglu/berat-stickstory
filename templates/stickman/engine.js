// Toon Studio - Stickman (MS Paint) engine. Scenes are written in the shot language (lib/scene.js):
//   import { script } from '../engine.js';
//   script(`
//   cast ali desc="an archaeologist: tan skin, yellow hard hat, round glasses"
//   title THE CITY FROM THE STORY
//   > Three thousand years ago, a poet named Homer told a story
//   set field
//   ali C pose=talk e=talk
//   `);
// Every `>` line is one shot: it starts when its first words are spoken (matched against audio/timeline.json, so no
// times are written by hand) and ends when the next shot starts. Frames are drawn at 960x540 in a flat Paint look and
// doubled with nearest-neighbour to 1920x1080. People and animals come from assets/sprites (make_sprites); anything
// without a sprite is drawn by the procedural stick-figure rig.
import * as THREE from './vendor/three.module.js';
import { P, reset } from './lib/paint.js';
import { parseScript, newContext, drawShot, setPhotos, setDetail } from './lib/scene.js';
import { loadSprites } from './lib/sprites.js';
export { THREE };

export const ENGINE_KIND = 'stickman';
export const ENGINE_VERSION = 5;               // bump when the Suite ships engine changes (projects get an Update button)
export const DEFAULTS = { detail: false, web: { on: false, perMin: 2 } };
const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b || {})) o[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? merge(a[k], v) : v; return o; };
export const SETTINGS = merge(DEFAULTS, globalThis.__CZ_SETTINGS || {});
export const AW = 960, AH = 540, FW = 1920, FH = 1080, W = FW, H = FH;
export const C = P;
// brand colour (v5): settings.brand.color ('#rrggbb', the Suite's "Brand colour" look setting) becomes the colour named
// `accent` (labels, date and number cards, text without c=: Paint red when unset) and `brand`; text in it gets the
// black Paint outline, so any colour reads on the drawn backdrops. BRAND.ink: text on a BRAND.color fill.
const _brand = typeof SETTINGS.brand?.color === 'string' && /^#[0-9a-f]{6}$/i.test(SETTINGS.brand.color) ? SETTINGS.brand.color.toLowerCase() : null;
if (_brand) { P.accent = _brand; P.brand = _brand; }
const _lum = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
export const BRAND = { on: !!_brand, color: P.accent, ink: (1.05 / (_lum(P.accent) + .05)) >= ((_lum(P.accent) + .05) / .05) ? '#ffffff' : '#000000' };
export const FONT_FILES = [];
export const SUITE = { module: null, pick: null, base: '' };
setDetail(SETTINGS.detail);

// ---------- scenes ----------
export const SHOTS = [];
const CTX = newContext();
function caller() {
  for (const l of (new Error().stack || '').split('\n')) {
    if (l.includes('/engine.js') || l.includes('/lib/')) continue;
    const m = l.match(/((?:scenes\/)?[\w.-]+\.js):(\d+):\d+/); if (m && !m[1].startsWith('host')) return { file: m[1], line: +m[2] };
  }
  return null;
}
/** A scene file's shots, in the shot language. Line numbers point into the scene file (the editor jumps to them). */
export function script(src) {
  const c = caller(), file = SUITE.module || c?.file || null, base = c?.line ?? 1;
  const sc = parseScript(String(src), CTX);
  for (const s of sc.shots) {
    for (const e of s.errors) console.warn(`${file}:${base + (+e.match(/line (\d+)/)?.[1] || s.line) - 1}: ${e.replace(/^line \d+: /, '')}`);
    for (const it of s.items) it.line = base + it.line - 1;
    SHOTS.push({ ...s, _file: file, _line: base + s.line - 1, name: s.say.length > 48 ? s.say.slice(0, 46) + '…' : s.say, cut: true, trans: 'cut', _sc: { cast: CTX.cast } });
  }
}

// ---------- timeline: shot starts from the narration's own words ----------
let WORDS = [];
const norm = s => String(s).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}']/gu, '');
export async function loadTimeline(url) {
  const ph = await (await fetch(url, { cache: 'no-store' })).json();
  WORDS = ph.flatMap(p => p.words.map(w => ({ ...w, n: norm(w.w) })));
}
export function cue(word, near, which = 's') {
  const parts = String(word).split(' ').map(norm).filter(Boolean); if (!parts.length) return near;
  let best = null, bd = 1e9;
  for (let i = 0; i < WORDS.length; i++) {
    if (!parts.every((p, k) => WORDS[i + k] && WORDS[i + k].n.startsWith(p))) continue;
    const d = Math.abs(WORDS[i].s - near); if (d < bd) { bd = d; best = which === 's' ? WORDS[i].s : WORDS[i + parts.length - 1].e; }
  }
  // a cue in a language written without spaces (Japanese, Chinese, Thai) may span several timed words ("東京タワー" is timed
  // as "東京" + "タワー"): the words' letters are joined until they hold it (v4)
  if (best === null && parts.length === 1) for (let i = 0; i < WORDS.length; i++) {
    let s = '', k = i; while (k < WORDS.length && s.length < parts[0].length) s += WORDS[k++].n;
    if (!s.startsWith(parts[0])) continue;
    const d = Math.abs(WORDS[i].s - near); if (d < bd) { bd = d; best = which === 's' ? WORDS[i].s : WORDS[k - 1].e; }
  }
  if (best === null || bd > 12) { console.warn('cue miss', word, near); return near; }
  return best;
}
export const IMG = {};
export async function loadImages(map) {
  await Promise.all(Object.entries(map).map(([k, src]) => new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => res(); im.src = src; })));
  setPhotos(IMG);
  // every sprite the project has (make_sprites keeps assets/sprites in step with the scenes)
  await loadSprites(null).catch(e => console.warn('sprites: ' + e.message));
}

const LEAD = .06, WPS = 2.7;                     // a shot appears just before its first word; no timeline: ~2.7 words a second
let END = 0;
export function finalizeShots(end) {
  END = end || 0;
  const toks = s => s.split(/[\s\-–—/]+/).map(norm).filter(Boolean);
  // walk the narration in order: each shot's words are looked for a little ahead of where the last shot ended
  let k = 0, t = 0;
  for (const s of SHOTS) {
    const ws = toks(s.say); s._words = ws.length;
    let at = -1;
    for (let tries = 0; tries < Math.min(3, ws.length) && at < 0; tries++)
      for (let j = k; j < Math.min(WORDS.length, k + 40); j++) if (WORDS[j].n === ws[tries] || (ws[tries].length > 3 && WORDS[j].n.startsWith(ws[tries]))) { at = j - (tries ? 0 : 0); s._k = j; s._skip = tries; break; }
    if (at >= 0) { s.t0 = Math.max(0, WORDS[at].s - LEAD); k = at + Math.max(1, ws.length - 1); }
    else { s.t0 = null; k += ws.length; }
  }
  // shots the narration didn't match sit between their neighbours (or at reading speed without a timeline)
  for (let i = 0; i < SHOTS.length; i++) if (SHOTS[i].t0 == null) {
    const prev = SHOTS[i - 1], next = SHOTS.slice(i + 1).find(s => s.t0 != null);
    SHOTS[i].t0 = prev ? (next ? (prev.t0 + next.t0) / 2 : prev.t0 + Math.max(1.2, prev._words / WPS)) : 0;
  }
  SHOTS[0] && (SHOTS[0].t0 = 0);
  for (let i = 1; i < SHOTS.length; i++) if (SHOTS[i].t0 <= SHOTS[i - 1].t0 + .3) SHOTS[i].t0 = SHOTS[i - 1].t0 + .3;
  if (!END) END = SHOTS.length ? SHOTS[SHOTS.length - 1].t0 + Math.max(2, SHOTS[SHOTS.length - 1]._words / WPS) : 0;
  SHOTS.forEach((s, i) => { s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : END; });
  // beats: the shot's own words, in order
  for (const s of SHOTS) s._beatT = s.beats.map(b => {
    const w = norm(b.word);
    for (let j = s._k ?? 0; j < WORDS.length && WORDS[j].s < s.t1 + .01; j++) if (WORDS[j].s >= s.t0 && WORDS[j].n.startsWith(w)) return Math.max(s.t0, WORDS[j].s - LEAD);
    return s.t0 + (s.t1 - s.t0) / 2;
  });
}
export function activeIndex(t) { let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].t0) i++; return i; }

// ---------- drawing: one static picture per shot and beat, cached ----------
THREE.ColorManagement.enabled = true;
const glCanvas = document.createElement('canvas');
export const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(AW, AH, false);
const cam = new THREE.OrthographicCamera(0, AW, AH, 0, -10, 10);
export const outCanvas = document.createElement('canvas'); outCanvas.width = FW; outCanvas.height = FH;
const octx = outCanvas.getContext('2d'); octx.imageSmoothingEnabled = false;
const cache = new Map();                          // key -> { canvas, boxes }; a few pictures (a shot rarely has more than 3 beats)
function picture(i, b) {
  const key = i * 100 + b; let hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const s = SHOTS[i], scene = new THREE.Scene(); scene.background = new THREE.Color('#ffffff');
  reset(scene, 1000 + i * 17);
  const drawn = drawShot(s._sc, s, b, scene);
  scene.updateMatrixWorld(true); renderer.render(scene, cam);
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH; cv.getContext('2d').drawImage(glCanvas, 0, 0);
  const boxes = [];
  for (const { item, g } of drawn) {
    const bx = new THREE.Box3().setFromObject(g); if (bx.isEmpty()) continue;
    const x0 = Math.max(0, bx.min.x), x1 = Math.min(AW, bx.max.x), y0 = Math.max(0, bx.min.y), y1 = Math.min(AH, bx.max.y); if (x1 <= x0 || y1 <= y0) continue;
    const what = item.kind === 'man' ? item.cast : item.kind === 'prop' ? item.name : item.kind;
    boxes.push({ x: x0 * 2, y: (AH - y1) * 2, w: (x1 - x0) * 2, h: (y1 - y0) * 2, alpha: 1, kind: item.kind === 'text' ? 'text' : 'element', text: item.str || what, key: what, src: { file: s._file, line: item.line } });
  }
  scene.traverse(o => { o.geometry?.dispose(); });
  hit = { canvas: cv, boxes }; cache.set(key, hit);
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  return hit;
}
const beatAt = (s, t) => (s._beatT || []).filter(bt => t >= bt).length;
export function compose(t) {
  if (!SHOTS.length) return;
  const i = activeIndex(t), s = SHOTS[i], pic = picture(i, beatAt(s, t));
  octx.drawImage(pic.canvas, 0, 0, FW, FH);
  if (SUITE.pick) SUITE.pick.push(...pic.boxes);
}

// ---------- export (WebCodecs H.264, streamed to the app) ----------
export async function exportVideo({ name = 'video', fps = 30, from = 0, to, bitrate = 12e6, onProgress } = {}) {
  to ??= END;
  const chunks = []; let bytes = 0, first = true, err = null;
  const enc = new VideoEncoder({ output: c => { const b = new Uint8Array(c.byteLength); c.copyTo(b); chunks.push(b); bytes += b.length; }, error: e => err = e });
  let cfg = { codec: 'avc1.640032', width: FW, height: FH, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'annexb' } };
  for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) { const c = { ...cfg, hardwareAcceleration: hw }; if ((await VideoEncoder.isConfigSupported(c)).supported) { cfg = c; break; } }
  enc.configure(cfg);
  const flush = async force => { if (!chunks.length || (!force && bytes < 8e6)) return; const blob = new Blob(chunks); chunks.length = 0; bytes = 0;
    await fetch(`${SUITE.base}/append/${name}${first ? '?reset=1' : ''}`, { method: 'POST', body: blob }); first = false; };
  const n = Math.round((to - from) * fps), t0 = performance.now();
  for (let f = 0; f < n; f++) {
    if (err) throw err;
    compose(from + f / fps);
    const vf = new VideoFrame(outCanvas, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: f % (fps * 2) === 0 }); vf.close();
    while (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 1));
    if (f % 30 === 0) { await flush(false); onProgress?.(f, n, (performance.now() - t0) / 1000); }
  }
  await enc.flush(); await flush(true); enc.close();
  const secs = (performance.now() - t0) / 1000;
  return { frames: n, seconds: +secs.toFixed(1), fps: +(n / secs).toFixed(1), realtime: +((to - from) / secs).toFixed(2) };
}

// ---------- sound events: hard cuts and the voice alone (no whooshes, no pops, no music: the style runs on the narration) ----------
export async function collectEvents(end) {
  const shots = SHOTS.map(s => ({ t0: +s.t0.toFixed(3), trans: 'cut', cut: true, chapter: false, name: s.name || '' }));
  return { shots, hits: [], cards: [], sfx: [], style: 'stickman' };
}

// ---------- checks (check_preview reports these) ----------
export function shotProblems() {
  const out = [];
  SHOTS.forEach((s, i) => {
    const d = s.t1 - s.t0;
    if (d > 6) out.push(`shot ${i + 1} (${s._file}:${s._line}) stays ${d.toFixed(1)} s: split it (one image every 2-3 s)`);
    if (!s.items.length && s.set === 'white') out.push(`shot ${i + 1} (${s._file}:${s._line}) is an empty white frame`);
  });
  return out;
}
