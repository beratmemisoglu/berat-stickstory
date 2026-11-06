// Toon Studio preview/render host. Served at /p/<projectId>/__suite/host.html by the app's local server;
// loads the project's own engine.js, scenes and assets (all relative to ../), then talks to the app:
//   preview mode (iframe in the editor): postMessage API  - seek, pick, frame, info
//   render mode  (hidden worker window): window.suite API - stills, exportVideo, events
const qs = new URLSearchParams(location.search);
const MODE = qs.get('mode') || 'preview';
// Preview quality (Settings / the editor's transport bar, for slow computers): ?pq=.5 or .25 asks the engine to draw the
// live preview smaller. Contract: the host sets globalThis.__CZ_PREVIEW_SCALE before importing the engine; an engine that
// honours it draws at about that scale (its outCanvas is then smaller, FW/FH/W/H stay the same, so scenes and picking are
// unchanged) and exports PREVIEW_SCALE = the scale it really used. 3D reconstruction takes it as its supersampling factor.
// Engines that ignore it draw at full size. Render mode (exports, stills, Claude's frames) never gets it.
const PQ = MODE === 'preview' ? Math.min(1, Math.max(.25, +qs.get('pq') || 1)) : 1;
if (PQ < 1) globalThis.__CZ_PREVIEW_SCALE = PQ;
// ?swenc=1 (render mode): the app's retry after the graphics card's H.264 encoder stopped answering mid-export (some
// drivers accept the config, then never return frames). Every engine picks the first of prefer-hardware / no-preference /
// prefer-software that isConfigSupported accepts, so refusing the first two makes all of them, old ones too, encode in software.
if (MODE === 'render' && qs.get('swenc') === '1' && globalThis.VideoEncoder?.isConfigSupported) {
  const orig = VideoEncoder.isConfigSupported.bind(VideoEncoder);
  VideoEncoder.isConfigSupported = async c => c?.hardwareAcceleration && c.hardwareAcceleration !== 'prefer-software' ? { supported: false, config: c } : orig(c);
}
// ?lowgl=1 (render mode, a Mac's last try after the graphics context was lost at the same moment twice): WebGL without
// powerPreference 'high-performance', so a Mac with two graphics chips doesn't switch chips for this hidden page (a switch
// loses the context; a hidden page's high-performance context can also be taken away to let the Mac go back to the other)
if (MODE === 'render' && qs.get('lowgl') === '1') {
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) { return get.call(this, type, /webgl/.test(type) && attrs?.powerPreference === 'high-performance' ? { ...attrs, powerPreference: 'default' } : attrs); };
}
// ?testhang=1 (only the app's test exportstall): a hardware encoder that never hands frames back (its queue never drains)
if (MODE === 'render' && qs.get('testhang') === '1' && globalThis.VideoEncoder) Object.defineProperty(VideoEncoder.prototype, 'encodeQueueSize', { get: () => 99 });
// Render mode: every key frame the export's encoder hands back is reported to the app ("CZKEY <frame> <byte offset>"). When
// the page dies mid-export (a graphics card reset, a hung driver, a crashed renderer), the app keeps the file up to the last
// good key frame and renders only the rest in a fresh page, instead of failing a long export (or keeping black frames).
let keyFps = 30;
if (MODE === 'render' && globalThis.VideoEncoder) {
  const Base = globalThis.VideoEncoder;
  globalThis.VideoEncoder = class extends Base {
    constructor(init) {
      let off = 0;
      super({ ...init, output: (c, meta) => { if (c.type === 'key') console.log(`CZKEY ${Math.round(c.timestamp * keyFps / 1e6)} ${off}`); off += c.byteLength; return init.output(c, meta); } });
    }
  };
}
// the WebGL context is gone: every frame drawn from now on is black (a graphics card reset, a driver update, sleep).
// Chromium gives it back (webglcontextrestored, three.js rebuilds) unless the graphics card keeps failing: a context that
// was lost and restored before an export is fine (it was taken as lost for good: every export on Roman's Mac failed at
// 0:00), one lost while frames are drawn is counted (glLosses), since frames between the loss and the restore are black
let glLosses = 0;
const glLost = () => { if (window.contextLost) return true; try { return !!E?.renderer?.getContext?.()?.isContextLost?.(); } catch { return false; } };
const GPU_LOST = 'The graphics card reset while the video was exporting (its frames turned black).';
// ?testlose=<seconds> (only the app's test exportblack): the graphics card resets once the export passes that time
const testLose = MODE === 'render' ? +qs.get('testlose') || 0 : 0;
// ?testleakcap=<n> (only the app's test exportleak): the context is lost once the page holds more than n textures (a small
// stand-in for a graphics card whose memory a leaking scene fills)
const testLeakCap = MODE === 'render' ? +qs.get('testleakcap') || 0 : 0;
// ?testlosestart=1 (only the app's test exportgpustart): the context is lost before the first frame, as the test scene asks
// (globalThis.CZ_LOSE_START): 'restored' = lost and given back, 'hard' = lost for good unless the software encoder is used
const testLoseStart = MODE === 'render' && qs.get('testlosestart') === '1', swencOn = qs.get('swenc') === '1';
// what the export's page holds at each progress report (render mode): "m:<textures>,<geometries>,<canvases>,<heap MB>". A
// scene that makes new textures / geometries / canvases every frame without letting go fills the graphics memory until the
// context is lost at the same moment on every try (any graphics card, software too): the app names that scene from these
let canvases = 0;
if (MODE === 'render') { const ce = Document.prototype.createElement; Document.prototype.createElement = function (tag, o) { if (String(tag).toLowerCase() === 'canvas') canvases++; return ce.call(this, tag, o); }; }
const memNow = () => { try { const m = E?.renderer?.info?.memory || {}; return `m:${m.textures | 0},${m.geometries | 0},${canvases},${Math.round((performance.memory?.usedJSHeapSize || 0) / 1048576)}`; } catch { return 'm:0,0,0,0'; } };
const parentPost = msg => { try { window.parent !== window && window.parent.postMessage({ source: 'cz-host', ...msg }, '*'); } catch {} };
const errors = [];
// A broken shot throws on every frame it is drawn, and a scene can warn on every frame: the preview used to send each one
// to the editor (its time made every line new, ~30 a second, each re-rendering the editor). Now (preview only) the same
// message (numbers ignored) is sent at most once per 10 s, with how often it repeated meanwhile, and at most 4 lines a
// second reach the editor; the rest is counted and reported in one line. Render workers log everything (the app reads it).
const LOG_EVERY = 10000, LOG_PER_S = 4, logSeen = new Map();
let logWin = 0, logN = 0, logHidden = 0, logHiddenTimer = 0;
const logKey = (level, text) => level + '|' + String(text).replace(/\d+(\.\d+)?/g, '#').slice(0, 300);
const logError = (level, text) => {
  const now = Date.now();
  if (MODE === 'preview') {
    const k = logKey(level, text), s = logSeen.get(k);
    if (s && now - s.t < LOG_EVERY) { s.n++; return false; }
    const rep = s?.n ? ` (repeated ${s.n} more time${s.n > 1 ? 's' : ''})` : '';
    logSeen.set(k, { t: now, n: 0 }); if (logSeen.size > 500) logSeen.delete(logSeen.keys().next().value);
    if (now - logWin > 1000) { logWin = now; logN = 0; }
    if (++logN > LOG_PER_S) {
      logHidden++;
      logHiddenTimer ||= setTimeout(() => { logHiddenTimer = 0; const n = logHidden; logHidden = 0; if (n) parentPost({ type: 'log', level: 'warn', text: `${n} more preview message${n > 1 ? 's' : ''} hidden (too many at once)` }); }, 2000);
      errors.push({ level, text, t: now }); if (errors.length > 200) errors.shift();
      return true;
    }
    text += rep;
  } else {
    const last = errors[errors.length - 1];
    if (last && last.text === text && now - last.t < 5000) return false;    // a broken shot throws on every frame: report it once
  }
  errors.push({ level, text, t: now }); if (errors.length > 200) errors.shift(); parentPost({ type: 'log', level, text });
  return true;
};
for (const level of ['warn', 'error']) {
  const orig = console[level].bind(console);
  console[level] = (...a) => {
    const text = a.map(x => x instanceof Error ? x.message : typeof x === 'string' ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })()).join(' ');
    if (logError(level, text) || MODE !== 'preview') orig(...a);              // (a repeat within 10 s is not printed again either)
  };
}
window.addEventListener('error', e => logError('error', `${e.message} (${(e.filename || '').split('/').slice(-2).join('/')}:${e.lineno})`));
window.addEventListener('unhandledrejection', e => logError('error', String(e.reason?.message || e.reason)));
// host.html's security policy blocked a request (a style reaching outside the project's files): an error the editor's log,
// the render checks and a style import name, never a silent stand-in
document.addEventListener('securitypolicyviolation', e => logError('error', `Blocked by the app's security policy: ${e.effectiveDirective || e.violatedDirective} ${String(e.blockedURI || 'inline').slice(0, 160)} (a style may only load files of its own project)`));

let E = null, P = null, END = 0, t = 0, FW = 1920, FH = 1080;
const view = document.getElementById('view'), vctx = view.getContext('2d');
const shotMeta = [];                                            // per shot: { name } parsed from scene source comments
let CUES = [];                                                  // every cue('word', near) call in the scene code, resolved to a time

// Letters of their own (Japanese, Korean, Chinese, Thai, Hindi): no style's font has them. The pieces of the bundled Noto
// Sans fonts (fonts/script, made by scripts/script-fonts.py) that this video's words need are added under every family
// the engine loaded, with the same weight and style, and under "CZ Script" (engines name it after their own fonts), so a
// title in any style draws them in one font on Windows and Mac, old projects too. Only those scripts' code points: Latin
// letters keep the style's own font. Chinese characters take the shapes of the video's language (Japanese, Korean or
// Chinese); kana always come from the Japanese font, Hangul from the Korean one.
const kindOf = c => c >= 0x900 && c <= 0x97f || c >= 0xa8e0 && c <= 0xa8ff || c >= 0x1cd0 && c <= 0x1cff ? 'deva' : c >= 0xe00 && c <= 0xe7f ? 'thai'
  : c >= 0x1100 && c <= 0x11ff || c >= 0x3130 && c <= 0x318f || c >= 0xa960 && c <= 0xa97f || c >= 0xac00 && c <= 0xd7ff ? 'hangul'
  : c >= 0x3040 && c <= 0x30ff || c >= 0x31f0 && c <= 0x31ff ? 'kana' : c >= 0x2e80 ? 'han' : null;
const SCRIPT_FONTS = globalThis.__CZ_SCRIPT_FONTS = { faces: 0, pieces: 0, fonts: [] };   // what was loaded (tests read it)
async function scriptFonts(text, loaded) {
  const cps = new Set(); for (const ch of text) { const c = ch.codePointAt(0); if (c >= 0x900 && kindOf(c)) cps.add(c); }
  if (!cps.size) return;
  let man; try { man = await (await fetch('fonts/script/scripts.json')).json(); } catch { return; }   // (an older app)
  const lang = globalThis.__CZ_LANG, has = k => [...cps].some(c => kindOf(c) === k);
  const hanBy = lang === 'ja' ? 'jp' : lang === 'ko' ? 'kr' : lang === 'zh' ? 'sc' : has('kana') ? 'jp' : has('hangul') && !has('han') ? 'kr' : 'sc';
  const by = { deva: 'deva', thai: 'thai', hangul: 'kr', kana: 'jp', han: hanBy }, want = new Map();
  for (const c of cps) { const id = by[kindOf(c)]; if (!want.has(id)) want.set(id, []); want.get(id).push(c); }
  const fams = [...loaded].map(k => k.split('|')).concat([['CZ Script', '100 900', 'normal'], ['CZ Script', '100 900', 'italic']]);
  const faces = [];
  // the font of the video's Chinese characters goes last: where pieces overlap (the kana pieces hold kanji too), the face
  // added last draws the letter
  for (const id of [...want.keys()].sort((a, b) => (a === hanBy) - (b === hanBy))) {
    const font = man.fonts.find(f => f.id === id); if (!font) continue;
    const spans = font.slices.flatMap((s, i) => s.cps.map(([a, b]) => [a, b, i])).sort((x, y) => x[0] - y[0]), need = new Set();
    for (const c of want.get(id)) {                               // the piece holding each letter (binary search)
      let lo = 0, hi = spans.length - 1;
      while (lo <= hi) { const m = (lo + hi) >> 1; if (spans[m][1] < c) lo = m + 1; else if (spans[m][0] > c) hi = m - 1; else { need.add(spans[m][2]); break; } }
    }
    for (const i of [...need].sort((a, b) => a - b)) {
      const s = font.slices[i], range = s.cps.map(([a, b]) => a === b ? `U+${a.toString(16)}` : `U+${a.toString(16)}-${b.toString(16)}`).join(',');
      for (const [fam, weight, style] of fams) faces.push(new FontFace(fam, `url(fonts/${s.file})`, { weight, style, unicodeRange: range }));
      SCRIPT_FONTS.pieces++;
    }
    SCRIPT_FONTS.fonts.push(font.family);
  }
  for (const f of faces) document.fonts.add(f);                 // (in this order: loads finish in any order)
  await Promise.all(faces.map(f => f.load().catch(() => { document.fonts.delete(f); logError('warn', `font failed ${f.family}`); })));
  SCRIPT_FONTS.faces = faces.length;
}

async function boot() {
  P = await (await fetch('../project.json', { cache: 'no-store' })).json();
  // a Style Studio check pass (render workers only): one view of the workspace (its scenes and length), project.json untouched
  if (MODE === 'render' && qs.get('scenes')) {
    const sc = qs.get('scenes').split(',').filter(s => /^[A-Za-z0-9][\w-]{0,60}$/.test(s)), e = +qs.get('end');
    if (sc.length) { P.scenes = sc; if (e > 0) P.end = e; }
  }
  let override = null; try { override = qs.get('settings') ? JSON.parse(qs.get('settings')) : null; } catch { logError('warn', 'bad settings override'); }
  globalThis.__CZ_SETTINGS = override || P.settings || {};             // override: 'preview this look' renders without touching project.json
  // the live preview draws at 1x: a supersampling engine's Final quality (3D reconstruction, 2x) is 4x the pixels on every
  // frame you play or scrub. Exports, stills and Claude's frame checks (render mode) keep the project's quality.
  if (MODE === 'preview' && !qs.get('ss')) globalThis.__CZ_SETTINGS = { ...globalThis.__CZ_SETTINGS, quality: { ...(globalThis.__CZ_SETTINGS.quality || {}), ss: PQ } };
  if (MODE === 'preview') { const v = +(globalThis.__CZ_SETTINGS.graphics?.maxFps) || 0; maxFps = [10, 15, 24].includes(v) ? v : 0; }   // Graphics > Frame rate cap
  globalThis.__CZ_LANG = P.language || 'en';                         // the narration's language: newer engines write numbers its way (fmt)
  document.documentElement.lang = globalThis.__CZ_LANG;                // (a letter no font here has: the system's font for that language)
  // fonts before the first frame: the engine lists its own (FONT_FILES); older engines use the pixel pair
  const loaded = new Set();                                            // family|weight|style of every face loaded
  const loadFont = async ([fam, url, weight, style = 'normal', range]) => { try { const f = new FontFace(fam, `url(${url})`, { weight, style, ...(range ? { unicodeRange: range } : {}) }); await f.load(); document.fonts.add(f); if (!range) loaded.add(`${fam}|${weight}|${style}`); } catch (e) { logError('warn', 'font failed ' + url); } };
  await Promise.all([['Orbitron', '../fonts/orbitron.woff2', '500 900'], ['Share Tech Mono', '../fonts/share-tech-mono.woff2', '400']].map(f => fetch(f[1], { method: 'HEAD' }).then(r => r.ok && loadFont(f)).catch(() => {})));
  globalThis.__CZ_MODE = MODE;                                         // (engines with Graphics: preview-only switches)
  E = await import('../engine.js');
  if (E.FONT_FILES) await Promise.all(E.FONT_FILES.map(([fam, file, weight, style]) => loadFont([fam, '../' + file, weight, style])));
  // the accented letters those fonts lack (Playfair and Garamond shipped with ASCII only, the rest without œ, ł or ő): small
  // files beside this page (scripts/ext-fonts.py), added after the engine's with a unicode-range, so plain text keeps the
  // shipped glyphs and a Spanish or French title no longer falls back to a system font. Old projects get them too.
  // (the flat engine's Inter has them all, but Vietnamese and Russian: the pieces marked "set": "viet" or "cyrl" are for
  // every engine; a family with no Cyrillic of its own gets a look-alike's, under its own name, for those letters only)
  try { const ext = await (await fetch('fonts/fonts.json')).json(); await Promise.all(ext.filter(x => (E.ENGINE_KIND !== 'flat' || x.set === 'viet' || x.set === 'cyrl') && loaded.has(`${x.family}|${x.weight}|${x.style}`)).map(x => loadFont([x.family, 'fonts/' + x.file, x.weight, x.style, x.range]))); }
  catch { /* an older app without them */ }
  FW = E.FW || 1920; FH = E.FH || 1080;
  // the page shows the engine's frame at the size it was drawn (smaller at a lower preview quality) and CSS scales it up
  view.width = E.outCanvas?.width || FW; view.height = E.outCanvas?.height || FH; crisp();
  if (E.SUITE) E.SUITE.base = location.pathname.replace(/\/host\.html$/, '');
  const tlUrl = '../' + (P.timeline || 'audio/timeline.json');
  let tlText = '';
  if ((await fetch(tlUrl, { method: 'HEAD', cache: 'no-store' })).ok) {
    await E.loadTimeline(tlUrl).catch(e => logError('error', 'timeline: ' + e.message));
    try { tlText = await (await fetch(tlUrl, { cache: 'no-store' })).text(); } catch { /* gone meanwhile */ }
  } else logError('info', 'No timeline yet (audio/timeline.json) - cues fall back to their approximate times.');
  await E.loadImages(Object.fromEntries(Object.entries(P.images || {}).map(([k, f]) => [k, '../' + (f.startsWith('assets/') ? f : 'assets/' + f)])));
  const sceneErrors = [], sources = {};
  // the scenes' source first (shot names, and the letters the video writes: its script fonts load before any scene draws)
  await Promise.all((P.scenes || []).map(async m => { try { sources[`scenes/${m}.js`] = (await (await fetch(`../scenes/${m}.js`, { cache: 'no-store' })).text()).split('\n'); } catch {} }));
  await scriptFonts([JSON.stringify(P), tlText, ...Object.values(sources).map(l => l.join('\n'))].join('\n'), loaded);
  for (const m of P.scenes || []) {
    if (E.SUITE) E.SUITE.module = `scenes/${m}.js`;
    try { await import(`../scenes/${m}.js`); } catch (e) { sceneErrors.push(`${m}.js: ${e.message}`); logError('error', `scene ${m}.js failed to load: ${e.message}`); }
  }
  if (E.SUITE) E.SUITE.module = null;
  END = P.end || 0;
  if (E.SHOTS.length) E.finalizeShots(END);
  // pixel engines read chapter as ['01', 'TITLE  ·  SUB']: a chapter start without one (or a plain string) threw
  // "undefined is not iterable" on every frame of its slam, which also stopped sound design and export
  if ((E.ENGINE_KIND || 'pixel') === 'pixel') for (const s of E.SHOTS) {
    if (s.chapter != null && !Array.isArray(s.chapter)) s.chapter = ['', String(s.chapter)];
    else if (Array.isArray(s.chapter)) s.chapter = [String(s.chapter[0] ?? ''), String(s.chapter[1] ?? '')];
    if (s.chapterFirst && !s.chapter) s.chapter = ['', s.name || ''];
  }
  E.SHOTS.forEach((s, i) => {                                     // shot title = nearest "// ---- title ----" comment above the shot
    let name = s.name || '';
    const lines = sources[s._file];
    if (!name && lines && s._line) for (let k = s._line - 2; k >= Math.max(0, s._line - 80); k--) {   // walk up to the previous shot
      const l = lines[k] || '';
      const m = l.match(/^\s*\/\/\s*-{2,}\s*(.+?)\s*-*\s*$/); if (m) { name = m[1]; break; }
      if (/^\s*shot\(/.test(l)) break;
    }
    shotMeta[i] = { name: name || `Shot ${i + 1}` };
  });
  CUES = parseCues(sources);
  window.E = E;
  if (MODE === 'preview' && E.setKeep) E.setKeep(14);   // scrubbing back and forth reuses built shots (an export keeps its neighbours only)
  // a GPU reset (driver update, sleep, another app) kills the WebGL context: the editor loads a fresh preview,
  // the render worker reloads before its next job
  E.renderer.domElement.addEventListener('webglcontextlost', ev => { ev.preventDefault(); window.contextLost = true; glLosses++; parentPost({ type: 'context-lost' }); });
  E.renderer.domElement.addEventListener('webglcontextrestored', () => { window.contextLost = false; });
  texJanitor(E.renderer);
  return { sceneErrors };
}

// Graphics memory (every engine, old projects too): a texture no frame has drawn for a while is given back to the graphics
// card; three.js uploads it again from its picture the next time something draws it. Flat explainer makes two word textures
// for every word of the narration (captions) and kept every one it ever drew: playing a long video through in the editor
// filled the graphics memory, and the export's page then lost its context at the same moment on every try (Roman's Mac, a
// 15-minute video: "the graphics card reset at about 0:02.0", also in software; reproduced on an M4 with the editor open).
// Only textures drawn from a canvas or an image (never render targets, videos or data) are let go.
function texJanitor(R) {
  if (!R || typeof R.render !== 'function' || R._czJanitor) return; R._czJanitor = true;
  const used = new Map(); let n = 0, swept = performance.now();
  const note = v => { if (v && v.isTexture) used.set(v, n); };
  const mark = m => { for (const k in m) note(m[k]); const u = m.uniforms; if (u) for (const k in u) note(u[k]?.value); };
  const render = R.render;
  R.render = function (scene, cam) {
    n++;
    try { scene?.traverseVisible?.(o => { const m = o.material; if (m) Array.isArray(m) ? m.forEach(mark) : mark(m); }); note(scene?.background); note(scene?.environment); } catch { /* never stops a frame */ }
    const r = render.apply(this, arguments);
    if (n % 60 === 0 && performance.now() - swept > 1500) {         // let go of what 600 draws (5-10 s of video) did not use
      swept = performance.now();
      for (const [tex, at] of used) if (n - at > 600) {
        used.delete(tex); const im = tex.image;
        if (!tex.isRenderTargetTexture && !tex.isVideoTexture && !tex.isDataTexture && (im instanceof HTMLCanvasElement || im instanceof HTMLImageElement)) try { tex.dispose(); } catch {}
      }
    }
    return r;
  };
}

// Static scan of cue('words', near[, 's'|'e']) calls. Resolved with the engine's own cue(); misses are flagged, not re-logged.
function parseCues(sources) {
  const out = [], re = /(?:(st\.\w+)\s*=\s*)?cue\(\s*(['"`])((?:(?!\2).)+)\2\s*,\s*(-?[\d.]+)(?:\s*,\s*(['"])([se])\5)?\s*\)(\s*[+-]\s*\d*\.?\d+(?![\w(]))?/g;
  const shotLines = E.SHOTS.map((s, i) => ({ i, file: s._file, line: s._line || 0 }));
  const warn = console.warn; let missed = false;
  console.warn = (...a) => { if (String(a[0]).startsWith('cue miss')) missed = true; else warn(...a); };
  try {
    for (const [file, lines] of Object.entries(sources)) lines.forEach((l, k) => {
      if (/^\s*\/\//.test(l)) return;
      for (const m of l.matchAll(re)) {
        missed = false;
        const near = +m[4], which = m[6] || 's', offset = m[7] ? +m[7].replace(/\s+/g, '') : 0, t = E.cue(m[3], near, which) + offset;
        const owner = shotLines.filter(s => s.file === file && s.line <= k + 1).pop();
        out.push({ word: m[3], near, which, offset, t, miss: missed, key: m[1] || null, file, line: k + 1, shot: owner ? owner.i : null });
      }
    });
  } finally { console.warn = warn; }
  return out.sort((a, b) => a.t - b.t);
}
function info() {
  return {
    end: END, title: P.title, settings: E.SETTINGS, art: [E.AW, E.AH], size: [FW, FH], kind: E.ENGINE_KIND || 'pixel', errors: errors.slice(-50), cues: CUES,
    preview: { asked: PQ, scale: previewScale(), scalable: scalable(), drawn: [view.width, view.height] }, graphics: graphicsInfo(), gpu: gpuName(),
    shots: E.SHOTS.map((s, i) => ({ index: i, t0: s.t0, t1: s.t1, file: s._file, line: s._line, name: shotMeta[i]?.name, chapter: s.chapter || null, chapterFirst: !!s.chapterFirst, cut: !!s.cut, trans: s.trans ?? null })),
  };
}
// the scale the engine really draws the preview at: its own word, 3D reconstruction's supersampling, else full size
function previewScale() {
  if (typeof E?.PREVIEW_SCALE === 'number') return E.PREVIEW_SCALE;
  if (E?.ENGINE_KIND === 'recon' && typeof E.SS === 'number') return Math.min(1, E.SS);
  return 1;
}
const scalable = () => typeof E?.PREVIEW_SCALE === 'number' || (E?.ENGINE_KIND === 'recon' && typeof E.SS === 'number');
// pixel art drawn smaller is shown with nearest-neighbour pixels when the page enlarges it (never blurred); zoomed in, always
let zoomCrisp = false;
function crisp() {
  const up = view.getBoundingClientRect().width * (window.devicePixelRatio || 1) > view.width * 1.02;
  view.style.imageRendering = zoomCrisp || ((E?.ENGINE_KIND || 'pixel') === 'pixel' && previewScale() < 1 && up) ? 'pixelated' : '';
}
window.addEventListener('resize', () => { if (E) crisp(); });
function placeholder(msg) {                                       // empty project: a calm frame instead of a crash
  const w = view.width, h = view.height, k = w / FW;
  vctx.fillStyle = '#141414'; vctx.fillRect(0, 0, w, h);
  vctx.fillStyle = '#6f7d75'; vctx.font = `500 ${Math.round(34 * k)}px Inter, Arial, sans-serif`; vctx.textAlign = 'center'; vctx.fillText(msg, w / 2, h / 2, w * .9);
}
// the preview shows exactly the frames an export renders: time snaps to the 30 fps grid and a frame already on
// screen is not composed again (a 60 Hz display would otherwise compose every frame twice)
const FPS = 30; let shown = -1;
const frameOf = time => Math.round(Math.max(0, Math.min(END || 0, time)) * FPS);
// Graphics > Frame rate cap (preview only, every style): frames asked for sooner than 1/cap after the last one wait; the
// newest one is drawn when its turn comes (a pause or a scrub always ends on the right frame)
let maxFps = 0, lastShow = 0, capTimer = 0, capT = 0;
function show(time) {
  const f = frameOf(time); if (f === shown) return;
  if (maxFps > 0) { const wait = 1000 / maxFps - (performance.now() - lastShow); capT = time;
    if (wait > 1) { if (!capTimer) capTimer = setTimeout(() => { capTimer = 0; show(capT); }, wait); return; } }
  lastShow = performance.now(); draw(f / FPS); shown = f;
}
function draw(time) {
  t = Math.max(0, Math.min(END || 0, time)); shown = -1; window.__draws = (window.__draws || 0) + 1;
  if (!E.SHOTS.length) return placeholder(P.scenes?.length ? 'Scenes failed to load - see the warnings' : 'No scenes yet - build the video with Claude');
  const t0 = performance.now();
  // 3D reconstruction draws one scene per frame through several passes (the image, ambient occlusion's normals, depth of
  // field's depth), and three.js re-renders every shadow map on each of them: render them once per frame, the first time
  // (the same maps: nothing moves between the passes of one frame)
  const sm = MODE === 'preview' && E.ENGINE_KIND === 'recon' && E.renderer?.shadowMap, auto = sm && sm.autoUpdate;
  if (auto) { sm.autoUpdate = false; sm.needsUpdate = true; }
  try { E.compose(t); } finally { if (auto) sm.autoUpdate = true; }
  vctx.drawImage(E.outCanvas, 0, 0, view.width, view.height);
  const ms = performance.now() - t0;
  perf(ms); window.__czRec?.push([t0, ms, t]);                     // (tests: drive.mjs previewfps records every frame)
  warm();
}
// how long frames take (preview only): every second the median of the frames drawn in it, for the editor's Auto quality
const took = [], gaps = []; let perfAt = 0, lastDraw = 0;
function perf(ms) {
  if (MODE !== 'preview') return;
  const now = performance.now();
  // a pause or a single scrub step starts a new window (while playing, a slow computer's long gaps are the measurement)
  if (now - lastDraw > 500 && !ad.playing) { took.length = 0; gaps.length = 0; perfAt = now; }
  else if (took.length) gaps.push(now - lastDraw);
  lastDraw = now; took.push(ms);
  if (now - perfAt < 1000) return;
  const span = now - perfAt, s = took.splice(0).sort((a, b) => a - b), g = gaps.splice(0).sort((a, b) => a - b); perfAt = now;
  const fps = s.length * 1000 / Math.max(1, span), median = s[s.length >> 1];
  adapt(g.length ? g[g.length >> 1] : span, median);
  parentPost({ type: 'perf', median: +median.toFixed(1), frames: s.length, fps: +fps.toFixed(1), scale: previewScale(), scalable: scalable(),
    drawn: E?.getGraphics ? E.getGraphics().drawn : null, adaptive: ad.level });
}
// ---------- adaptive quality while playing (preview only, engines with live Graphics: 3D reconstruction v9+) ----------
// Frames that come too slowly while the video plays (the typical time between two frames over 42 ms, i.e. under ~24 a
// second, or a typical frame taking over 30 ms to draw; one long stall, a shot being built, does not count) step
// the picture down one level for the rest of the play: a smaller 3D image, then no ambient occlusion / depth of field,
// then no bloom or anti-aliasing. Each level only ever lowers what the user's Graphics settings ask for. Paused, the
// frame on screen is drawn again at the user's settings; exports, stills and Claude's frames (render mode) never see this.
// The next play starts one level below the last one, so it climbs back once the computer has room again.
const AD_LEVELS = [null, { scale: .75 }, { scale: .5, ao: false, dof: 'off' }, { scale: .35, ao: false, dof: 'off', bloom: 'off', aa: 'off' }];
const ad = { on: MODE === 'preview' && qs.get('adapt') !== '0', playing: false, level: 0, last: 0, base: null, slow: 0, since: 0 };
function adaptiveOk() { return ad.on && !!E?.applyGraphics && !!E?.getGraphics && (E.getGraphics().supported || []).includes('scale'); }
function adLevel(n) {
  if (!adaptiveOk() || n === ad.level) return;
  if (!ad.base) ad.base = { ...(E.getGraphics().values || {}) };   // the user's own Graphics, given back on pause
  const b = ad.base, L = AD_LEVELS[n], v = { ...b };
  if (L) { v.scale = Math.min(b.scale ?? 1, L.scale);
    if (L.ao === false) v.ao = false; if (L.dof === 'off') v.dof = 'off'; if (L.bloom === 'off') v.bloom = 'off'; if (L.aa === 'off') v.aa = 'off'; }
  ad.level = n; E.applyGraphics(v, true); crisp();
  if (!n) ad.base = null;
}
function adapt(gap, median) {
  if (!ad.playing || !adaptiveOk()) return;
  if (performance.now() - ad.since < 1000) return;               // the first second of a play (and of a new level) settles
  const crawl = gap > 120 || median > 90;                         // under ~8 frames a second: no time to wait, two levels at once
  ad.slow = crawl ? 2 : gap > 42 || median > 30 ? ad.slow + 1 : 0;
  if (ad.slow >= 2 && ad.level < AD_LEVELS.length - 1) { ad.slow = 0; ad.since = performance.now(); adLevel(Math.min(AD_LEVELS.length - 1, ad.level + (crawl ? 2 : 1))); ad.last = ad.level; }
}
function setPlaying(on) {
  if (on === ad.playing) return; ad.playing = on; ad.slow = 0; ad.since = performance.now();
  took.length = 0; gaps.length = 0; perfAt = lastDraw = performance.now();   // a fresh measuring window
  if (on) { if (ad.last > 1) adLevel(ad.last - 1); return; }
  ad.last = ad.level;
  if (ad.level) { adLevel(0); if (E?.SHOTS?.length) { draw(t); shown = frameOf(t); } }
}
// ---------- Graphics (the editor's Graphics panel): live engine switches, no reload ----------
const HOST_GFX = ['maxFps'];                                      // handled here for every style
function graphicsInfo() {
  const g = E?.getGraphics ? E.getGraphics() : null;
  return { engine: !!g, supported: [...(g?.supported || []), ...HOST_GFX], values: { ...(ad.base || g?.values || {}), ...(maxFps ? { maxFps } : {}) }, look: g?.look || {}, drawn: g?.drawn || null,
    kind: E?.ENGINE_KIND || 'pixel', version: E?.ENGINE_VERSION ?? null };
}
function gpuName() {
  try { const gl = E?.renderer?.getContext?.(); if (!gl) return null; const x = gl.getExtension('WEBGL_debug_renderer_info');
    return String(x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).replace(/^ANGLE \((.*)\)$/, '$1').slice(0, 120); } catch { return null; }
}
function applyGfx(values, replace) {
  if (ad.level) { adLevel(0); ad.last = 0; }                      // the user's change applies to their own settings, not to a lowered level
  if ('maxFps' in values || replace) { const v = +values.maxFps || 0; maxFps = [10, 15, 24].includes(v) ? v : 0; }
  const { maxFps: _m, ...rest } = values;
  if (E.applyGraphics) E.applyGraphics(rest, !!replace);
  const g = graphicsInfo(); if (g.drawn) crisp();
  return g;
}
// the frame on screen drawn n times: the median time of one frame at the current settings (the panel's Measure button)
function bench(n = 8) {
  // (a one-pixel read waits for the GPU: without it only the time to queue the work would be measured)
  const gl = E?.renderer?.getContext?.(), px = new Uint8Array(4), sync = () => { try { gl?.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } catch { /* no GL */ } };
  const ms = []; draw(t); sync(); for (let k = 0; k < n; k++) { const t0 = performance.now(); draw(t); sync(); ms.push(performance.now() - t0); }
  shown = frameOf(t); ms.sort((a, b) => a - b); return { median: +ms[ms.length >> 1].toFixed(2), min: +ms[0].toFixed(2), n };
}
function luma() {                                                 // mean brightness of the frame on screen (tests)
  const c = document.createElement('canvas'); c.width = 96; c.height = 54; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(view, 0, 0, 96, 54);
  const d = x.getImageData(0, 0, 96, 54).data; let s = 0, h = 0; for (let i = 0; i < d.length; i += 4) { const l = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114; s += l; h = (h * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0; }
  return { luma: +(s / (d.length / 4)).toFixed(2), hash: h.toString(16) };
}
window.czGfx = { luma, bench: n => bench(n), info: () => graphicsInfo(), maxFps: () => maxFps };   // (tests: drive.mjs graphicspanel)
// preview only, engines that offer it (3D reconstruction v2+): the next shots are built while the preview is idle, so
// playing into a shot or stepping to it doesn't stall on building its scene
// A built shot still froze the preview for 0.1-2 s on its first frame: its geometry, textures, shadow maps and the shader
// variants only the real render makes (shadow depth, the passes' override materials) were all set up then, in one go.
// While the preview is paused, each built shot ahead is now also drawn once off screen (a tiny image, everything in it,
// whatever the camera sees later), so playing into it later costs what any frame costs. Not while playing: the work
// cannot be split finely enough (one new shader blocks for 100+ ms), so there it stays where it was, on the shot's first frame.
let warming = false, warmRT = null;
function warm() {
  if (warming || MODE !== 'preview' || !E?.prewarm) return; warming = true;
  const idle = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 1000 }) : f => setTimeout(f, 60);
  const go = () => idle(() => {
    let more = false;
    try { more = (!ad.playing && warmShot()) || E.prewarm(t, ad.playing ? 3 : 5); } catch { /* shown when reached */ }
    if (more) setTimeout(go, 120); else warming = false;
  });
  setTimeout(go, 150);
}
const RENDERABLE = o => o.isMesh || o.isPoints || o.isLine || o.isSprite;
function warmShot() {
  if (E.ENGINE_KIND !== 'recon' || !E.THREE || !E.renderer) return false;
  const i = E.activeIndex(t), S = E.SHOTS.slice(i + 1, i + 6).map(s => s._S).find(S => S && S.scene && S.cam && !S._czWarm);
  if (!S) return false;
  S._czWarm = true;
  const T = E.THREE, R = E.renderer, saved = [];
  warmRT ||= new T.WebGLRenderTarget(64, 64, { type: T.HalfFloatType });
  S.scene.traverse(o => { if (RENDERABLE(o) && o.frustumCulled) { saved.push(o); o.frustumCulled = false; } });
  const prev = R.getRenderTarget(), sm = R.shadowMap, au = sm.autoUpdate;
  try {
    sm.needsUpdate = true; R.setRenderTarget(warmRT); R.render(S.scene, S.cam);
    // the shader variants of ambient occlusion's normals and depth of field's depth
    sm.autoUpdate = false; const sc = S.scene, bg = sc.background, om = sc.overrideMaterial; sc.background = null;
    warmRT.mats ||= [new T.MeshNormalMaterial({ blending: T.NoBlending }), new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, blending: T.NoBlending })];
    try { for (const m of warmRT.mats) { sc.overrideMaterial = m; R.render(sc, S.cam); } } finally { sc.overrideMaterial = om; sc.background = bg; }
  }
  finally { R.setRenderTarget(prev); sm.autoUpdate = au; for (const o of saved) o.frustumCulled = true; }
  return true;
}

// ---------- picking ----------
function tagState(def) {                                        // label every Object3D reachable from the shot's `st` with its key
  const st = def._st; if (!st || def._tagged === st) return; def._tagged = st;
  const T = E.THREE, depth = o => { let d = 0; while (o.parent) { d++; o = o.parent; } return d; };
  const mark = (obj, key) => { if (!(obj instanceof T.Object3D)) return false; const d0 = depth(obj);
    obj.traverse(o => { if (o.userData._stDepth == null || d0 >= o.userData._stDepth) { o.userData._st = key; o.userData._stDepth = d0; } }); return true; };
  for (const [k, v] of Object.entries(st)) {
    if (mark(v, `st.${k}`)) continue;
    if (Array.isArray(v)) v.forEach((x, i) => { if (!mark(x, `st.${k}[${i}]`) && x && typeof x === 'object') for (const [k2, v2] of Object.entries(x)) mark(v2, `st.${k}[${i}].${k2}`); });
    else if (v && typeof v === 'object') for (const [k2, v2] of Object.entries(v)) mark(v2, `st.${k}.${k2}`);
  }
}
function shotAt(time) { const i = E.activeIndex(time); return { i, def: E.SHOTS[i] }; }
// where an error happened, in the words of the shot list: "shot 5 (scenes/s2_day1.js:24) at 18.34s: "
function whereAt(time) { try { const { i, def } = shotAt(time); return `shot ${i + 1} (${def._file}:${def._line}) at ${(+time).toFixed(2)}s: `; } catch { return ''; } }
function screenRect(obj, cam) {                                  // obj: an Object3D or a world Box3
  const T = E.THREE, box = obj.isBox3 ? obj : new T.Box3().setFromObject(obj); if (box.isEmpty()) return null;
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0; const v = new T.Vector3();
  for (let k = 0; k < 8; k++) { v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(cam);
    if (v.z > 1) continue; const sx = (v.x + 1) / 2, sy = (1 - v.y) / 2; x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy); }
  if (x1 <= x0) return null;
  return { x: Math.max(0, x0), y: Math.max(0, y0), w: Math.min(1, x1) - Math.max(0, x0), h: Math.min(1, y1) - Math.max(0, y0) };
}
function describeObject(hitObj, layers = []) {
  // layers: groups whose children are the separate things of a shot (flat: S.root, S.back), so a click on something the
  // scene didn't name selects that thing, not every element of the shot
  let o = hitObj, kind = null, named = null;
  while (o) { if (!kind && (o.kind || o.userData.kind)) kind = o.kind || o.userData.kind; if (!named && o.name) named = o.name; if (!o.parent || o.parent.type === 'Scene' || layers.includes(o.parent)) break; o = o.parent; }
  // the selection root: the outermost object that shares the hit's st key (e.g. the whole character, not one box)
  const key = hitObj.userData._st || null; let root = hitObj;
  if (key) { while (root.parent && root.parent.userData._st === key && root.parent.type !== 'Scene') root = root.parent; }
  else { root = o; }
  return { key, kind, name: named, root };
}
function pick(nx, ny, time) {
  if (!E.SHOTS.length) return null;
  if (time !== undefined && frameOf(time) !== frameOf(t)) show(time);   // hover probes on the frame on screen skip a re-render
  const { i, def } = shotAt(t), S = def._S, shot = { index: i, t0: def.t0, t1: def.t1, file: def._file, line: def._line, name: shotMeta[i]?.name };
  // HUD first: it sits on top of the 3D image
  if (E.SUITE) {
    const hx = nx * E.W, hy = ny * E.H;
    // at: the cursor in frame pixels, for engines that test what is really drawn there (3D reconstruction v4+)
    let list; E.SUITE.pick = []; E.SUITE.at = [hx, hy]; try { E.compose(t); list = E.SUITE.pick; } finally { E.SUITE.pick = null; E.SUITE.at = null; }
    const hits = list.filter(b => b.alpha > .2 && hx >= b.x - 1 && hx <= b.x + b.w + 1 && hy >= b.y - 1 && hy <= b.y + b.h + 1);
    const best = hits.reverse().sort((a, b) => (a.kind === 'box') - (b.kind === 'box'))[0];
    if (best) return { kind: 'hud', time: t, shot, element: { type: best.kind, text: best.text || null, key: best.key || null, color: best.col || null, size: best.size || null, source: best.src },
      rect: { x: best.x / E.W, y: best.y / E.H, w: best.w / E.W, h: best.h / E.H } };
  }
  if (!S) return { kind: 'shot', time: t, shot };
  tagState(def);
  const T = E.THREE, rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(nx * 2 - 1, -(ny * 2 - 1)), S.cam);
  const visible = o => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
  const pickable = E.PICKABLE || (o => o.isMesh && o.material?.userData?.facet);
  const shown = h => { const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;   // faded out or a stencil mask: not seen
    return !m || (m.colorWrite !== false && !(m.transparent && m.opacity < .05)); };
  const hits = rc.intersectObjects(S.scene.children, true).filter(h => pickable(h.object) && visible(h.object) && shown(h));
  // what is on top where the click is. Flat draws every layer at the same depth without a depth test, in its draw order
  // (opaque before transparent, then renderOrder): the ray reaches them all at the same distance, so the nearest-first
  // order said nothing and the full-frame background, added first, won every click. Flat: the latest-drawn wins and the
  // background layer (S.back) only when nothing else is there. Other engines: nearest first, draw order breaks a tie
  // (Vox cut-outs lie on one page at the same depth).
  const flat = E.ENGINE_KIND === 'flat', back = flat && S.back ? S.back : null;
  const under = (o, g) => { while (o) { if (o === g) return true; o = o.parent; } return false; };
  const drawn = o => { const m = Array.isArray(o.material) ? o.material[0] : o.material; return [m?.transparent ? 1 : 0, o.renderOrder || 0, o.id]; };
  const later = (a, b) => { const x = drawn(a.object), y = drawn(b.object); for (let k = 0; k < 3; k++) if (x[k] !== y[k]) return y[k] - x[k]; return 0; };
  hits.sort((a, b) => {
    if (back) { const ba = under(a.object, back), bb = under(b.object, back); if (ba !== bb) return ba - bb; return later(a, b); }
    const dd = a.distance - b.distance; return Math.abs(dd) > 2e-5 * Math.max(1, a.distance) ? dd : later(a, b);
  });
  const hit = hits[0];
  if (!hit) return { kind: 'shot', time: t, shot };
  // engines that know their own objects say what a click selects (3D reconstruction v4+: one person of a crowd, a whole model)
  const tg = E.pickTarget ? E.pickTarget(hit, S, def._st) : null;
  const inBack = !!back && under(hit.object, back);              // flat background: the whole background layer is one thing
  const d = tg ? { key: tg.key ?? null, kind: tg.kind ?? null, name: tg.name ?? null, root: tg.box ?? tg.object } : describeObject(hit.object, flat ? [S.root, inBack ? null : S.back].filter(Boolean) : []);
  if (inBack && !d.key) { d.root = back; d.kind = d.kind || 'background'; }
  const box = d.root.isBox3 ? d.root : new T.Box3().setFromObject(d.root);
  const size = box.getSize(new T.Vector3()).toArray().map(v => +v.toFixed(2));
  const mat = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
  const u = mat.uniforms, hex = c => '#' + c.value.getHexString();
  const colors = tg?.colors ?? (u?.c0 ? [hex(u.c0), hex(u.c1), hex(u.c2)] : mat.color && !mat.map ? ['#' + mat.color.getHexString()] : null);
  const pal = Object.entries(E.C); const named = colors?.map(c => pal.find(([, v]) => typeof v === 'string' && v.toLowerCase() === c)?.[0] ?? c);
  return { kind: 'object', time: t, shot, element: { key: d.key, kind: d.kind, name: d.name, point: hit.point.toArray().map(v => +v.toFixed(2)), size, ramp: named },
    rect: screenRect(box, S.cam) };
}

// ---------- its own clock while the video plays (preview) ----------
// The editor used to hand the preview every frame (one 'seek' per editor frame): anything that held up the editor's page
// (re-rendering a long Claude chat, the timeline, a click) held up the video too, and a slow editor meant a slow video
// however fast the 3D was. Now each 'seek' while playing only says where the video was and when (at: the epoch clock both
// pages share, so the time the message spent in transit counts) and how fast it plays; the preview draws on its own
// animation frames from the newest of them. A jump (a click on the timeline, a loop) moves it at once; pausing stops it.
const run = { on: false, t: 0, at: 0, rate: 1, raf: 0 };
const epochNow = () => performance.timeOrigin + performance.now();
function follow(m) {
  run.t = m.t; run.at = m.at; run.rate = +m.rate > 0 ? +m.rate : 1;
  if (!run.on) { run.on = true; show(m.t); run.raf = requestAnimationFrame(runFrame); }
}
function runFrame() {
  run.raf = 0; if (!run.on || !E) return;
  // a frame that throws (a shot whose scene breaks at one moment) must not stop the clock: it did, and the preview stayed
  // frozen on that shot for good, every later play too, until the app was restarted
  try { show(Math.min(END || 0, run.t + Math.max(0, epochNow() - run.at) / 1000 * run.rate)); }
  catch (err) { logError('error', whereAt(t) + err.message); }
  finally { if (run.on && !run.raf) run.raf = requestAnimationFrame(runFrame); }
}
function stopRun() { run.on = false; if (run.raf) cancelAnimationFrame(run.raf); run.raf = 0; }
// A paused seek (scrubbing, the arrow keys, ] through the shots) draws only the newest time, once per screen frame. Each
// queued seek used to be drawn in turn, building every shot passed on the way: 44 quick jumps on a slow computer kept the
// preview busy for over 30 s after the last one. `t` moves at once, so anything asked next (a pick, a frame) uses it.
let seekPend = null, seekRaf = 0, seekTimer = 0;
function flushSeek() { if (seekRaf) cancelAnimationFrame(seekRaf); if (seekTimer) clearTimeout(seekTimer); seekRaf = seekTimer = 0; const v = seekPend; seekPend = null; if (v != null && E) show(v); }
function seekTo(time) {
  seekPend = time; t = Math.max(0, Math.min(END || 0, time));
  if (seekRaf || seekTimer) return;
  seekRaf = requestAnimationFrame(flushSeek); seekTimer = setTimeout(flushSeek, 120);   // (the timer: a hidden window gets no animation frames)
}
window.czRun = () => ({ ...run });   // (tests)

// ---------- message API (preview mode) ----------
window.addEventListener('message', async e => {
  const m = e.data; if (!m || m.target !== 'cz-host') return;
  if (!E) { if (m.id) parentPost({ type: 'reply-error', id: m.id, message: window.bootError || 'The preview is not loaded.' }); return; }
  try {
    if (m.type !== 'seek' && m.type !== 'playing' && m.type !== 'ping') flushSeek();      // (whatever is asked next sees the frame of the newest seek)
    if (m.type === 'seek') { if (m.playing && typeof m.at === 'number') { flushSeek(); follow(m); } else { stopRun(); seekTo(m.t); } }
    else if (m.type === 'playing') { setPlaying(!!m.on); if (!m.on) stopRun(); }                // (adaptive quality while playing)
    else if (m.type === 'crisp') { zoomCrisp = !!m.on; crisp(); }     // editor zoomed in: show real pixels
    else if (m.type === 'pick') parentPost({ type: 'picked', id: m.id, result: pick(m.x, m.y, m.t) });
    else if (m.type === 'frame') { draw(m.t); const c = document.createElement('canvas'); c.width = FW * (m.scale || .25); c.height = FH * (m.scale || .25);
      c.getContext('2d').drawImage(E.outCanvas, 0, 0, c.width, c.height); parentPost({ type: 'frame', id: m.id, dataUrl: c.toDataURL('image/jpeg', .85) }); draw(t); shown = frameOf(t); }
    else if (m.type === 'info') parentPost({ type: 'info', id: m.id, info: info() });
    else if (m.type === 'ping') parentPost({ type: 'pong', id: m.id, result: { t, lost: glLost() } });   // the editor's "still alive?" check
    // Graphics: apply a partial (null removes a key; replace: the whole set) and redraw the frame on screen, playhead kept
    else if (m.type === 'graphics') { const g = applyGfx(m.values || {}, m.replace); if (m.redraw !== false) { draw(t); shown = frameOf(t); }
      if (m.id) parentPost({ type: 'graphics', id: m.id, result: { ...g, t, frame: luma() } }); }
    else if (m.type === 'bench') parentPost({ type: 'bench', id: m.id, result: { ...bench(m.n || 8), frame: luma(), drawn: graphicsInfo().drawn, t } });
  } catch (err) { logError('error', whereAt(m.t ?? t) + err.message); parentPost({ type: 'reply-error', id: m.id, message: err.message }); }
});

// ---------- render worker API (render mode, driven by the main process) ----------
// A part of the video (a trailer) starts and ends on whole shots: transitions are centred on a shot's start, so its first
// frames were half the shot before it and its last ones half the shot after it. The transition into its first shot and the
// one into the shot after it become cuts (every engine: flat/vox read trans, pixel cut, collage dur). Only ever in a worker
// that is thrown away after: the export's own, or one made for these stills.
function cleanEdges(c) {
  if (!c || !E.SHOTS?.length) return;
  const cut = s => { if (!s) return; s.trans = 'cut'; s.cut = true; s.transDur = 0; if (E.ENGINE_KIND === 'collage') s.dur = 0; };
  if (typeof c.from === 'number') cut([...E.SHOTS].reverse().find(s => s.t0 <= c.from + .01));
  if (typeof c.to === 'number') cut(E.SHOTS.find(s => s.t0 > c.to - .01));
}
window.suite = {
  info,
  async stills(times, scale = .5, opts = {}) {
    cleanEdges(opts.clean);
    const c = document.createElement('canvas'); c.width = Math.round(FW * scale); c.height = Math.round(FH * scale); const x = c.getContext('2d');
    const out = [];
    for (const tt of times) {                                    // a shot that throws gives a null frame, not a failed batch
      try { E.compose(tt); x.drawImage(E.outCanvas, 0, 0, c.width, c.height); out.push(c.toDataURL('image/png')); }
      catch (err) { logError('error', whereAt(tt) + err.message); out.push(null); }
      await new Promise(r => setTimeout(r, 0));
    }
    return out;
  },
  // every frame the export would draw, checked for scenes that throw (Routines' Quality check): `fps` frames a second over
  // the whole video, and every 30 fps frame within 0.7 s of each shot's start (transitions call both shots, the moment
  // a scene bug hides in). Returns the frames that threw, one entry per shot and message (first time it happens).
  async sweep(fps = 10) {
    const ts = new Set(), out = new Map();
    for (let f = 0; f <= END * fps; f++) ts.add(+(f / fps).toFixed(3));
    for (const s of E.SHOTS || []) for (let f = -21; f <= 21; f++) { const tt = +(s.t0 + f / 30).toFixed(3); if (tt >= 0 && tt <= END) ts.add(tt); }
    let n = 0;
    for (const tt of [...ts].sort((a, b) => a - b)) {
      try { E.compose(tt); }
      catch (err) { const w = whereAt(tt), k = w.split(' at ')[0] + '|' + err.message; if (!out.has(k)) out.set(k, { t: tt, where: w.replace(/: $/, ''), message: err.message }); }
      if (++n % 40 === 0) await new Promise(r => setTimeout(r, 0));
    }
    return { frames: n, errors: [...out.values()] };
  },
  async exportVideo(opts) {
    window.exporting = true;
    cleanEdges(opts.clean);
    const from = +opts.from || 0, fps = +opts.fps || 30, to = opts.to ?? END;
    let ok = from;                                                 // the last frame the engine reported drawn
    keyFps = fps;
    if (testLoseStart && globalThis.CZ_LOSE_START && !(globalThis.CZ_LOSE_START === 'hard' && swencOn)) {   // (test exportgpustart)
      const ext = E.renderer?.getContext?.()?.getExtension?.('WEBGL_lose_context');
      ext?.loseContext();
      if (ext && globalThis.CZ_LOSE_START === 'restored') { await new Promise(r => setTimeout(r, 300)); ext.restoreContext(); }
    }
    // lost before the first frame: wait a moment for Chromium to give it back (the whole video would be black without it)
    for (let i = 0; i < 80 && glLost(); i++) await new Promise(r => setTimeout(r, 100));
    if (glLost()) throw new Error(GPU_LOST);
    if (glLosses) await new Promise(r => setTimeout(r, 100));       // (a context just given back: three.js rebuilds on its event)
    const losses = glLosses;
    // a lost graphics context draws black frames without an error: stop at the next progress report (the frames reported
    // before it are good) and let the app render the rest in a fresh page
    const lose = testLose > 0 || testLeakCap > 0 ? E.renderer?.getContext?.()?.getExtension?.('WEBGL_lose_context') : null;
    try { return await E.exportVideo({ ...opts, onProgress: (f, n, s) => {
      if (lose && ((testLose > 0 && from + f / fps >= testLose) || (testLeakCap > 0 && (E.renderer.info?.memory?.textures | 0) > testLeakCap))) lose.loseContext();
      if (glLost() || glLosses !== losses) throw new Error(GPU_LOST);
      ok = from + f / fps; console.log(`PROGRESS ${f} ${n} ${(f / Math.max(s, .001)).toFixed(1)} ${memNow()} |${whereAt(ok).replace(/ at [\d.]+s: $/, '')}`); } }); }
    catch (err) {
      if (glLost() || glLosses !== losses || err?.message === GPU_LOST) throw new Error(GPU_LOST);
      // a scene that throws at a frame the preview never drew (often inside a transition) stopped the export with only the
      // script's message ("Cannot read properties of undefined (reading 'join')"): find that frame (the engines report
      // progress every 30 frames) and say where it is and what fixes it
      if (!E.SHOTS?.length) throw err;
      for (let k = 0; k <= 2 * fps; k++) {
        const tt = +(ok + k / fps).toFixed(4); if (tt > to) break;
        try { E.compose(tt); } catch (e2) {
          const m = Math.floor(tt / 60), at = `${m}:${(tt - m * 60).toFixed(1).padStart(4, '0')}`, w = whereAt(tt).replace(/ at [\d.]+s: $/, '');
          logError('error', whereAt(tt) + (e2?.message || e2));
          throw new Error(`A scene throws an error at ${at}${w ? ` in ${w}` : ''}, so the video cannot be exported: ${e2?.message || e2}. Ask Claude to fix the error at ${at}, then export again.`);
        }
      }
      throw err;
    }
  },
  async events() {
    // a beat while the pass runs (it yields every few hundred frames): the app's only sign that a long video is still
    // working and not stuck in a loop (no fixed deadline, a 20-minute video takes as long as it takes)
    const beat = setInterval(() => console.log('PROGRESS events'), 2000);
    try { return await this.eventPass(); } finally { clearInterval(beat); }
  },
  async eventPass() {
    try { return await E.collectEvents(END); }
    catch (err) {
      // one scene that throws must not stop sound design (the preview skips such a frame too). Pixel engines step every
      // frame: do that pass here, skipping the frames that throw, and say which shots did (any pixel engine version)
      logError('error', 'sound events: ' + err.message);
      if ((E.ENGINE_KIND || 'pixel') !== 'pixel' || !E.drawFrame || !E.EVENTS) throw new Error(`A scene threw while collecting sound events: ${err.message}`);
      const FPSE = 30, skipped = new Map();
      for (let f = 0; f < END * FPSE; f++) {
        const tt = f / FPSE;
        try { E.drawFrame(tt); } catch (e) { const w = whereAt(tt); const k = w.split(' at ')[0]; if (!skipped.has(k)) { skipped.set(k, w + e.message); logError('error', w + e.message); } }
        if (f % 300 === 0) await new Promise(r => setTimeout(r, 0));
      }
      const S = E.SHOTS, EV = E.EVENTS;
      const shots = S.map((s, i) => ({ t0: +s.t0.toFixed(3), chapter: !!s.chapterFirst, cut: !!s.cut, mode: s.trans ?? (s.chapterFirst ? 3 : [0, 1, 2, 4, 1, 0][i % 6]), name: s.name || '' }));
      const hits = [...new Set(EV.filter(e => e[0] === 'hits').flatMap(e => e[2] || []))].sort((a, b) => a - b);
      const cards = [...new Map(EV.filter(e => e[0] === 'card').map(e => [e[1] + e[2], { t: e[1], key: e[2] }])).values()].sort((a, b) => a.t - b.t);
      return { shots, hits, cards, skipped: [...skipped.values()] };
    }
  },
  // engines with a layout check (collage): issues at steady frames; null = this engine has none
  // range { from, to }: only the moments in that span (a crew build's agent checks its own chapter)
  async layout(times, range) {
    if (!E.layoutIssues) return null;
    let ts = times && times.length ? times : E.checkTimes(); const issues = [];
    if (range && (range.from != null || range.to != null)) ts = ts.filter(t => t >= (range.from ?? 0) - 1e-6 && t <= (range.to ?? Infinity) + 1e-6);
    for (const tt of ts) { try { issues.push(...E.layoutIssues(tt)); } catch (err) { logError('error', whereAt(tt) + err.message); } await new Promise(r => setTimeout(r, 0)); }
    return { times: ts, issues };
  },
  errors: () => errors.slice(),
};

boot().then(({ sceneErrors }) => {
  const start = +(qs.get('t') || 0);
  try { draw(start); } catch (err) { logError('error', whereAt(start) + err.message); }   // the rest of the video still works
  window.ready = true;
  parentPost({ type: 'ready', info: info(), sceneErrors });
}).catch(err => { logError('error', 'boot failed: ' + err.message); window.bootError = err.message; window.ready = true; parentPost({ type: 'boot-error', message: err.message }); });
