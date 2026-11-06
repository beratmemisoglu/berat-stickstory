// Toon Studio Style Kit: the STATIC checks of a style package (docs/STYLE_KIT_PLAN.md section 3, "Static").
// The single source for the kit (`cz check`, `cz package`) and the app's import (src/main/styleImport.ts bundles this
// file through a relative import), so the two can never disagree. Rules for this file:
//   - only node: imports, no top-level side effects, no process.exit, never runs a package's code (text only)
//   - every finding is { id, sev, where: { file?, line? }, finding, meaning, fix }, in plain words
//   - what differs between kit and app is injected through `opts` (validators, the base's folders and version)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

/** The engine contract (section 2): every package engine exports `required`; each `optional` name it must keep exporting
 *  when its base engine exports it (host.js uses them when present). */
export const HOST_CONTRACT = Object.freeze({
  required: Object.freeze(['SHOTS', 'compose', 'outCanvas', 'loadTimeline', 'loadImages', 'finalizeShots', 'renderer', 'W', 'H', 'THREE', 'cue',
    'activeIndex', 'exportVideo', 'collectEvents', 'ENGINE_KIND', 'ENGINE_VERSION']),
  optional: Object.freeze(['FONT_FILES', 'SUITE', 'setKeep', 'PREVIEW_SCALE', 'SS', 'getGraphics', 'applyGraphics', 'prewarm', 'PICKABLE', 'pickTarget',
    'layoutIssues', 'checkTimes', 'SETTINGS', 'AW', 'AH', 'FW', 'FH', 'C']),
});
/** The built-in bases a package can be built on, and the ENGINE_KIND each base engine declares. */
export const BASES = Object.freeze(['pixel-art', 'collage', 'flat', 'stickman', 'recon', 'lowpoly', 'starter']);
/** Calls that make a video differ between renders (or run code from outside the style). Plus: fetch/import of absolute
 *  URLs, DOM writes, the manifest's own `banned` list. */
export const ALWAYS_BANNED = Object.freeze(['eval(', 'new Function(', 'Math.random(', 'Date.now(', 'performance.now(', 'setTimeout(', 'setInterval(',
  'requestAnimationFrame(', 'localStorage', 'sessionStorage', 'indexedDB']);
/** The only file types a package may hold. */
export const ALLOWED_EXT = Object.freeze(['js', 'mjs', 'json', 'md', 'txt', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'glb', 'gltf', 'bin', 'ktx2', 'hdr', 'exr',
  'ttf', 'otf', 'woff', 'woff2', 'wav', 'mp3', 'ogg', 'm4a', 'mp4', 'webm', 'csv']);
/** Licence files without an extension (fonts and libraries ship them so): plain text a package may hold too. */
export const LICENCE_NAME = /^(licen[cs]e|copying|ofl|notice)$/i;
/** May a package hold this file (by its name)? An allowed extension, or an extensionless licence file. */
export const isAllowedFile = rel => ALLOWED_EXT.includes(extOf(rel)) || LICENCE_NAME.test(String(rel).split('/').pop() ?? '');
/** Size limits, checked before anything else is read (a zip: before it is unpacked). */
export const LIMITS = Object.freeze({ totalBytes: 200 * 1024 * 1024, fileBytes: 50 * 1024 * 1024, files: 4000 });
/** Faults of a base engine itself (its own untouched sample fails the check): a style built on that base engine, at or
 *  below `upTo`, is not blocked by them; the finding stays, as medium, saying so. When the base is fixed its ENGINE_VERSION
 *  rises past `upTo` and the check blocks again for styles built on the fixed engine. Remove an entry once no supported
 *  engine has the fault. Read by the kit's checks and the app's import alike. */
export const BASE_DEBT = Object.freeze({
  lowpoly: Object.freeze({ repeat: Object.freeze({ upTo: 9, why: 'the Low poly engine (v9 and older) carries an animal\'s pose and the camera framing from the frame drawn before, so a jump in the preview can show a slightly different pose' }) }),
});
/** The base debt entry for a finding id on a style built on `base` engine `engineVersion`, else null. */
export function baseDebt(base, id, engineVersion) {
  const e = BASE_DEBT[base]?.[id]; return e && Number.isFinite(+engineVersion) && +engineVersion <= e.upTo ? e : null;
}
/** sha256 of the Mixamo Y Bot the app's 3D reconstruction engine uses (never ships in a package: Mixamo licence). */
export const MIXAMO_HASHES = Object.freeze(['5033fe1c29ff5ff17c1959f203d77fec80590bd12a3c27ae6bacd4e0b3c30f47']);
const ALLOWED_LICENCE = /^\s*(cc0|cc-?0|pd|public\s*domain|cc[\s-]*by\b.*|ofl\b.*|sil\s*ofl.*|sil\s*open\s*font.*|mit\b.*|apache[\s-]*2(\.0)?\b.*|odbl\b.*|own\b.*)\s*$/i;
/** Words that belong to one base's look: a style on another base whose prompts use them was probably copied from it. */
const VOCAB = Object.freeze({ collage: ['front page', 'newspaper collage', 'cut-out collage'], stickman: ['ms paint', 'stick figure'],
  'pixel-art': ['16-colour palette', 'pixel-art explainer'], recon: ['matte clay', '3d reconstruction'], lowpoly: ['game-capture', 'ps1 style'], flat: ['flat-vector'] });

/** What each check id means for the member (finding -> meaning -> fix: the meaning half). Same words in the kit, the
 *  app's import page and the fixer's prompt. */
export const MEANING = Object.freeze({
  manifest: 'the app cannot read the style: it will not import',
  files: 'the package cannot be imported safely (or carries files that must never leave your computer)',
  contract: 'the app\'s preview, render workers and every project made in this style call this export: without it they break',
  banned: 'the video would not be the same on every render (preview, stills, export), or the style would reach outside its own files',
  text: 'the file is read wrongly on one of the two systems, or an earlier edit glued code into a comment so it never runs',
  sample: 'the app cannot re-check the style without its sample views (the import refuses an unchecked style)',
  looks: 'a look the style ships would be refused when a member picks it',
  prompts: 'Claude builds videos in this style from these prompts: empty or wrong ones give videos that do not look like the style',
  credits: 'an asset without a known free licence cannot be shared with other members',
  fonts: 'a font without its licence cannot be shared, and letters it lacks fall back to a system font',
  version: 'nothing is broken: your style keeps its engine until you update it',
});

/** The meaning half of each RENDER finding (the kit's checks.mjs and the app's import both read it from here). */
export const RENDER_MEANING = Object.freeze({
  boot: 'that view does not load cleanly: in the app the preview, the exports and every project in the style would show the same error',
  layout: 'a frame breaks the style\'s layout rules: elements cut by the edge, colliding, under the captions, floating or passing through each other',
  frames: 'the frame shows nothing, is too dark to read, or nothing moves: viewers see a broken video',
  mustfail: 'the check no longer catches the fault it exists for, so a clean result means nothing',
  export: 'the style cannot be exported to a video file',
  repeat: 'the same moment looks different depending on what was drawn before: previews, stills and exports will not match',
  controls: 'a setting the style offers does nothing, so the Look panel shows a control that changes nothing',
});
/** Severity of each engine layout issue type (the app's Studio checks.ts SEVERITY); a style's skill/QUALITY.md lines
 *  "- severity <TYPE>: high|medium|low" may RAISE it, never lower it (layoutSeverity). Unknown types are medium. */
export const LAYOUT_SEVERITY = Object.freeze({ cut: 'high', caption: 'high', band: 'high', dark: 'high', crushed: 'high', frame: 'high', floating: 'high', through: 'high', contact: 'high',
  collide: 'high', coplanar: 'high', flicker: 'high', nocollide: 'high', support: 'high', sunk: 'high', blank: 'high', offframe: 'high', covered: 'high',
  overlap: 'medium', small: 'medium', contrast: 'medium', kit: 'medium', frozen: 'medium', same: 'medium', cue: 'medium', empty: 'low', abrupt: 'low' });
const SEV_RANK = Object.freeze({ info: -1, low: 0, medium: 1, high: 2 });
/** The severity a layout / frame finding type gets: the built-in one (LAYOUT_SEVERITY; unknown types medium), or the
 *  style's own (`declared`: QUALITY.md "- severity <TYPE>: ..." as { type: sev }) when that is HIGHER. A package may make a
 *  check stricter for its look (EMPTY: high for a full-frame style), never let a fault through by lowering it. */
export function layoutSeverity(type, declared = {}) {
  const t = String(type ?? '').toLowerCase(), built = LAYOUT_SEVERITY[t] ?? 'medium', d = declared?.[t];
  return d in SEV_RANK && SEV_RANK[d] > SEV_RANK[built] ? d : built;
}
/**
 * BLANK's measure (the single source for the kit's checks.mjs and the app's import): how much a frame shows beyond its
 * background, on the 64-px-wide luma of the frame (the kit: FRAMES_JS `small`; the app: studio/checks.ts frameStat).
 * Everything that varies along one axis only is removed first (flat fills, gradients, horizons and floor lines, vignettes:
 * R = L - rowMean - colMean + mean), then the edge energy is summed: per cell d = the larger of |R(x+1,y) - R(x,y)| and
 * |R(x,y+1) - R(x,y)| (0 past the region's edge), energy = 1000 x mean(max(0, d - floor)). `full` is the whole frame,
 * `centre` the frame without the outer `margin` on each side (a corner badge, the caption band). BLANK when
 * full < BLANK_LIMIT.full AND centre < BLANK_LIMIT.centre. Calibrated 2026-10-16 on every base's untouched sample, hero and
 * kit (both aspects; 280 shot middles, lowest full .63 / centre 1.09) plus synthetic sparse frames (one 44-56 px word, a
 * 60 px dot, a 4 px line: lowest .41 / .58) against shots of only the base's default grounds (highest .25 / .13).
 */
export const BLANK_LIMIT = Object.freeze({ full: .5, centre: .3, floor: .02, margin: .1 });
export function structureOf(L, w = 64) {
  const h = Math.floor((L?.length ?? 0) / w);
  const edge = (x0, x1, y0, y1) => {
    const W = x1 - x0, H = y1 - y0; if (W < 2 || H < 2) return 0;
    const rm = new Float64Array(H), cm = new Float64Array(W); let m = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = L[(y0 + y) * w + x0 + x]; rm[y] += v / W; cm[x] += v / H; m += v / (W * H); }
    const R = (x, y) => L[(y0 + y) * w + x0 + x] - rm[y] - cm[x] + m;
    let s = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const r = R(x, y), d = Math.max(x + 1 < W ? Math.abs(R(x + 1, y) - r) : 0, y + 1 < H ? Math.abs(R(x, y + 1) - r) : 0);
      if (d > BLANK_LIMIT.floor) s += d - BLANK_LIMIT.floor;
    }
    return 1000 * s / (W * H);
  };
  if (h < 2) return { full: 0, centre: 0, blank: true };
  const mx = Math.round(w * BLANK_LIMIT.margin), my = Math.round(h * BLANK_LIMIT.margin), full = edge(0, w, 0, h), centre = edge(mx, w - mx, my, h - my);
  return { full: +full.toFixed(3), centre: +centre.toFixed(3), blank: full < BLANK_LIMIT.full && centre < BLANK_LIMIT.centre };
}
/** The repeat check draws one moment per sample shot (its middle), at most this many, spread over the video. */
export const REPEAT_MAX = 12;
/** Repeat: more pixels than this changed by > 48 levels = a thing drawn somewhere else (high); fewer = rounding (low). */
export const REPEAT_HUGE_PX = 64;
/** Repeat: more than this share of the pixels changed by > 16 levels = a visible change (high). */
export const REPEAT_BIG_FRAC = .001;
/** The moments the repeat check draws twice: one per shot of the sample (its middle, clamped to end - .02, deduped), at most
 *  REPEAT_MAX picked evenly over the video; a view without shot info: 37 % and 71 % of it. */
export function repeatMoments(shots, end) {
  const clamp = t => +Math.max(0, Math.min(end - .02, t)).toFixed(2);
  let m = [...new Set((Array.isArray(shots) ? shots : []).filter(s => s && Number.isFinite(+s.t0) && +s.t0 < end).map(s => clamp(+s.t0 + ((s.t1 ?? end) - s.t0) * .5)))];
  if (!m.length) m = [+(end * .37).toFixed(2), +(end * .71).toFixed(2)];
  if (m.length > REPEAT_MAX) m = Array.from({ length: REPEAT_MAX }, (_, i) => m[Math.round(i * (m.length - 1) / (REPEAT_MAX - 1))]);
  return m;
}
/** A frame drawn again that differs from the first drawing: 'high' when visibly (more than REPEAT_BIG_FRAC of the pixels by
 *  more than 16 levels - `big`, a share - or more than REPEAT_HUGE_PX pixels by more than 48 - `huge`, a count: a small thing
 *  in another place), else 'low' (GPU rounding: pixel art's dither flips 9-18 px by up to 84 levels; that stays low). */
export const repeatSeverity = ({ big, huge }) => (big > REPEAT_BIG_FRAC || huge > REPEAT_HUGE_PX ? 'high' : 'low');
/** QUALITY.md text -> the severities it declares ({ type: 'high' | 'medium' | 'low' }); layoutSeverity applies them. */
export function declaredSeverities(text) {
  const sev = {}; for (const m of String(text ?? '').matchAll(/^\s*[-*]?\s*`?severity\s+([A-Za-z][\w-]*)\s*:\s*(high|medium|low)\b/gim)) sev[m[1].toLowerCase()] = m[2].toLowerCase();
  return sev;
}

// ---------- small helpers ----------
const readText = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
const eol = s => s.replace(/\r\n?/g, '\n');
const lineAt = (s, i) => { let n = 1; for (let k = 0; k < i && k < s.length; k++) if (s.charCodeAt(k) === 10) n++; return n; };
const extOf = f => (/\.([^./\\]+)$/.exec(f)?.[1] ?? '').toLowerCase();
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const F = (id, sev, where, finding, fix, meaning) => ({ id, sev, where: where || {}, finding, meaning: meaning ?? MEANING[id] ?? '', fix });

/** The code of a JS file with comments blanked (and string / template / regex contents too unless keepStrings), same
 *  length and line breaks, so matches keep their line numbers. A heuristic tokenizer, good enough for "is this real code".
 *  (Port of src/main/studio/checks.ts stripJs.) */
export function stripJs(src, keepStrings = false) {
  const out = src.split(''), n = src.length;
  const blank = (a, b) => { for (let k = a; k < Math.min(b, n); k++) if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' '; };
  const stack = []; let depth = 0, prev = '', i = 0;
  const template = from => {
    let j = from;
    while (j < n && src[j] !== '`' && !(src[j] === '$' && src[j + 1] === '{')) { if (src[j] === '\\') j++; j++; }
    if (!keepStrings) blank(from, j);
    if (src[j] === '$') { stack.push(depth); depth++; prev = '{'; return j + 2; }
    prev = '`'; return j + 1;
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); const end = e < 0 ? n : e; blank(i, end); i = end; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2; blank(i, end); i = end; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') j++; j++; } if (!keepStrings) blank(i + 1, j); i = j + 1; prev = c; continue; }
    if (c === '`') { i = template(i + 1); continue; }
    if (c === '/' && (!prev || '(,=:[!&|?{};+-*%<>~^'.includes(prev))) {
      let j = i + 1, cls = false;
      while (j < n && src[j] !== '\n' && (cls || src[j] !== '/')) { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; j++; }
      blank(i + 1, j); i = j + 1; while (i < n && /[a-z]/i.test(src[i])) i++; prev = '/'; continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (stack.length && stack[stack.length - 1] === depth) { stack.pop(); i = template(i + 1); continue; } }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out.join('');
}

/** The names an engine exports, read from its text (never run): `export function|const|let|class X`, `export { a, b as c }`.
 *  (Port of src/main/studio/workspace.ts exportNames.) */
export function exportNames(src) {
  const out = new Set();
  for (const m of src.matchAll(/^[ \t]*export[ \t]+(?:async[ \t]+)?(?:function[ \t]*\*?|class)[ \t]+([A-Za-z_$][\w$]*)/gm)) out.add(m[1]);
  for (const m of src.matchAll(/^[ \t]*export[ \t]+(?:const|let|var)[ \t]+([^\n]*)/gm)) {
    const line = m[1]; let depth = 0, start = 0, quote = '';
    const parts = [];
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) depth--;
      else if (c === ',' && depth === 0) { parts.push(line.slice(start, i)); start = i + 1; }
      else if (c === ';' && depth === 0) break;
    }
    parts.push(line.slice(start));
    parts.forEach((p, k) => { const n = /^\s*([A-Za-z_$][\w$]*)\s*=(?!=)/.exec(p)?.[1]; if (n && (k === 0 || !/[:]/.test(p.split('=')[0]))) out.add(n); });
  }
  for (const m of src.matchAll(/^[ \t]*export[ \t]*\{([^}]*)\}/gm)) for (const part of m[1].split(',')) { const n = part.trim().split(/\s+as\s+/).pop()?.trim(); if (n && /^[A-Za-z_$][\w$]*$/.test(n)) out.add(n); }
  return [...out].sort();
}
/** `export const ENGINE_VERSION = N` (the exact format the app parses), else null. */
export function engineVersionOf(src) { const m = /^export const ENGINE_VERSION = (\d+)/m.exec(src || ''); return m ? +m[1] : null; }
/** The ENGINE_KIND an engine declares (a string literal), else null. */
export function engineKindOf(src) { const m = /^\s*export\s+const\s+ENGINE_KIND\s*=\s*['"]([\w-]+)['"]/m.exec(src || ''); return m ? m[1] : null; }

// ---------- banned calls ----------
const tokenRx = tok => {
  const esc = tok.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\($/, '\\s*\\(').replace(/\s+/g, '\\s+');
  return new RegExp(`(?<![\\w$.])${esc}`, 'g');
};
const DOM_WRITE = /\b(?:document|window)\s*\.\s*(?:write|writeln|body|head|documentElement|cookie|title|location|open|opener|parent|top|history)\b|\bwindow\s*\.\s*[A-Za-z_$][\w$]*\s*=(?!=)/g;
/** Ways code reaches outside its own files or page: a style never does (host.html's security policy blocks the requests and
 *  the app blocks navigation at run time too; this names them before anything runs). [label, pattern on comment-free code] */
export const NETWORK_BANNED = Object.freeze([
  ['navigator.sendBeacon', /\bsendBeacon\s*\(/g],
  ['new WebSocket', /\bnew\s+(?:(?:window|self|globalThis)\s*\.\s*)?WebSocket\b/g],
  ['new EventSource', /\bnew\s+(?:(?:window|self|globalThis)\s*\.\s*)?EventSource\b/g],
  ['new XMLHttpRequest', /\bXMLHttpRequest\b/g],
  ['RTCPeerConnection', /\b(?:webkit)?RTCPeerConnection\b/g],
  ['window.open', /\b(?:window|self|globalThis|top|parent)\s*\.\s*open\s*\(/g],
  ['a page navigation (location)', /(?<![\w$.])location\s*\.\s*(?:assign|replace)\s*\(|(?<![\w$.])location\s*\.\s*href\s*=(?!=)|\b(?:window|document|self|globalThis|top|parent)\s*\.\s*location\s*(?:=(?!=)|\.\s*(?:href\s*=(?!=)|assign\s*\(|replace\s*\())/g],
].map(([label, rx]) => Object.freeze([label, rx])));
// an absolute address (scheme:// or //host) loaded: fetch / import / from / import '...', a .src / .href = '...', a
// setAttribute('src', '...'), a CSS url(...), new Audio / Image / Worker('...'), a loader's .load('...')
const ABS = String.raw`(?:[a-z][\w+.-]*:)?\/\/`;
const ABS_URL = new RegExp([String.raw`\b(?:fetch|import)\s*\(\s*(['"\x60])\s*${ABS}`, String.raw`\bfrom\s*(['"\x60])\s*${ABS}`, String.raw`^\s*import\s*(['"\x60])\s*${ABS}`,
  String.raw`\.\s*(?:src|href|srcset|poster|data|action|formAction|background)\s*=\s*(['"\x60])\s*${ABS}`,
  String.raw`\bsetAttribute(?:NS)?\s*\(\s*(?:[^,()]*,\s*)?(['"])(?:src|href|srcset|poster|data|action|xlink:href)\5\s*,\s*(['"\x60])\s*${ABS}`,
  String.raw`\burl\(\s*['"]?\s*${ABS}`, String.raw`\bnew\s+(?:Audio|Image|Worker|SharedWorker|WebSocket|EventSource)\s*\(\s*(['"\x60])\s*${ABS}`,
  String.raw`\.\s*load(?:Async)?\s*\(\s*(['"\x60])\s*${ABS}`].join('|'), 'gim');
/** fetch( / import( (also window.fetch) whose address is not a quoted relative path: computed at run time (a variable, an
 *  expression, new URL(...), a template starting with ${...}) or starting at the server root ('/...') or with a scheme
 *  (data:, blob:). A quoted relative path ('assets/x.json', `scenes/${name}.js`) is fine. */
const LOADER_CALL = /(?<![\w$.])(?:fetch|import)\s*\(|\b(?:window|self|globalThis)\s*\.\s*fetch\s*\(/g;
const ROOT_IMPORT = /\bfrom\s*(['"])\s*(?:\/(?!\/)|[a-z][\w+.-]*:(?!\/\/))|^\s*import\s*(['"])\s*(?:\/(?!\/)|[a-z][\w+.-]*:(?!\/\/))/gim;
function loaderAddress(withStrings, at) {
  let p = at; while (p < withStrings.length && /\s/.test(withStrings[p])) p++;
  const q = withStrings[p];
  if (q === ')' || q == null) return null;                                     // fetch() / import(): nothing loaded
  let head;
  if (q === '"' || q === "'") { const e = withStrings.indexOf(q, p + 1); head = withStrings.slice(p + 1, e < 0 ? p + 200 : e); }
  else if (q === '`') { let e = p + 1; while (e < withStrings.length && withStrings[e] !== '`' && !(withStrings[e] === '$' && withStrings[e + 1] === '{')) e++; head = withStrings.slice(p + 1, e); if (!head.trim()) return 'computed'; }
  else return 'computed';
  if (/^\s*\/\//.test(head) || /^\s*[a-z][\w+.-]*:\/\//i.test(head)) return null;  // scheme:// and //host: the absolute URL rule names it
  if (/^\s*\//.test(head)) return 'root';
  if (/^\s*[a-z][\w+.-]*:/i.test(head)) return 'scheme';
  return null;
}
const BANNED_FIX = [
  [/sendBeacon|WebSocket|EventSource|XMLHttpRequest|RTCPeerConnection|window\.open|location/, 'remove it: a style never sends anything anywhere or leaves its page (the app blocks it at run time anyway, so it only fails); what the style needs goes into the style (lib/) and is loaded by a relative path'],
  [/computed address|server root/, 'load the style\'s own files by a quoted relative path (\'assets/map.json\', `scenes/${name}.js`) or through the engine\'s loaders: an address built at run time (or starting with / or a scheme) can point outside the style'],
  [/random/i, 'use fixed values or the engine\'s seeded random (the same numbers on every render)'],
  [/now\(|Date/i, 'use the frame time the engine passes (t, or the shot\'s own time), never the clock'],
  [/setTimeout|setInterval|requestAnimationFrame/, 'draw everything from the frame time t inside compose: the engine decides when a frame is drawn, never a timer'],
  [/eval|Function/, 'write the code out as plain code'],
  [/Storage|indexedDB/, 'keep state in the scene (from t), never in the browser: a render worker starts empty every time'],
  [/DOM/, 'draw into the engine\'s canvas only: the host page owns the document'],
  [/absolute URL/, 'put the file into the style and load it by a relative path (the engine\'s own textures, models and data in lib/; the pictures a video shows come from the project, as the sample\'s do from sample/assets): a style never reaches the internet'],
];
const fixOf = tok => BANNED_FIX.find(([r]) => r.test(tok))?.[1] ?? 'remove it (the style\'s manifest bans it)';
/** Every banned call in one JS source: [{ token, line, text }]. Comments never count; strings only for the URL rule. */
export function bannedInSource(src, tokens = ALWAYS_BANNED) {
  const out = [], code = stripJs(src, false), withStrings = stripJs(src, true), lines = src.split('\n');
  const push = (token, idx, s) => { const line = lineAt(s, idx); out.push({ token, line, text: (lines[line - 1] ?? '').trim() }); };
  for (const tok of [...new Set([...ALWAYS_BANNED, ...tokens])]) { const rx = tokenRx(tok); for (const m of code.matchAll(rx)) push(tok, m.index, code); }
  // reaching outside the style: one finding per line (the most specific: network, absolute URL, computed address, DOM)
  const reached = new Set(), reach = (token, idx, s) => { const line = lineAt(s, idx); if (reached.has(line)) return; reached.add(line); push(token, idx, s); };
  for (const [label, rx] of NETWORK_BANNED) for (const m of code.matchAll(rx)) reach(label, m.index, code);
  for (const m of withStrings.matchAll(ABS_URL)) reach('absolute URL', m.index, withStrings);
  for (const m of withStrings.matchAll(ROOT_IMPORT)) reach('fetch/import from the server root or a scheme', m.index, withStrings);
  for (const m of code.matchAll(LOADER_CALL)) { const k = loaderAddress(withStrings, m.index + m[0].length); if (k) reach(k === 'computed' ? 'fetch/import of a computed address' : 'fetch/import from the server root or a scheme', m.index, code); }
  for (const m of code.matchAll(DOM_WRITE)) reach('DOM write', m.index, code);
  return out;
}
/** A `//` comment that has code glued after it by an earlier edit: `// note;  foo(1);` (the call never runs). */
export function gluedComments(src) {
  const out = [], code = stripJs(src, true), lines = src.split('\n'), clines = code.split('\n');
  lines.forEach((l, k) => {
    const c = clines[k] ?? ''; const at = l.indexOf('//'); if (at < 0) return;
    // a real comment: the stripped text is blank from there on
    let j = -1; for (let p = 0; p < l.length - 1; p++) if (l[p] === '/' && l[p + 1] === '/' && !c.slice(p).trim()) { j = p; break; }
    if (j < 0) return;
    // glued: prose, a `;`, then a whole statement that ends with `;` (doc comments listing an API don't end in `;`)
    const text = l.slice(j + 2).replace(/\r$/, ''), semi = text.search(/;\s/);
    if (semi < 0) return;
    const tail = text.slice(semi + 1);
    if (/^\s*(?:(?:const|let|var)\s+[\w$]+\s*=|(?:await\s+)?[A-Za-z_$][\w$.]*\()/.test(tail) && /;\s*$/.test(tail) && !/^\s*(e\.g\.|eg|i\.e\.|example|usage)\b/i.test(text))
      out.push({ line: k + 1, text: l.trim().slice(0, 140) });
  });
  return out;
}

// ---------- fonts: which code points a font has (TTF / OTF / WOFF / WOFF2, cmap only) ----------
function readBase128(b, o) { let v = 0; for (let k = 0; k < 5; k++) { const x = b[o.p++]; v = v * 128 + (x & 127); if (!(x & 128)) return v; } throw new Error('bad UIntBase128'); }
/** The cmap table of a font file as a function cp => boolean, or null when it can't be read. */
export function fontCoverage(buf) {
  try {
    const u32 = (b, o) => b.readUInt32BE(o), u16 = (b, o) => b.readUInt16BE(o);
    const sig = buf.toString('latin1', 0, 4); let cmap = null;
    if (sig === 'wOFF') {
      const n = u16(buf, 12);
      for (let i = 0; i < n; i++) { const o = 44 + i * 20; if (buf.toString('latin1', o, o + 4) !== 'cmap') continue;
        const off = u32(buf, o + 4), comp = u32(buf, o + 8), orig = u32(buf, o + 12), raw = buf.subarray(off, off + comp);
        cmap = comp < orig ? zlib.inflateSync(raw) : raw; }
    } else if (sig === 'wOF2') {
      const n = u16(buf, 12), compLen = u32(buf, 20), o = { p: 48 }, tables = [];
      for (let i = 0; i < n; i++) {
        const flags = buf[o.p++], idx = flags & 63, tv = flags >> 6; let tag = idx; if (idx === 63) { tag = buf.toString('latin1', o.p, o.p + 4); o.p += 4; }
        const orig = readBase128(buf, o), transformed = (idx === 10 || idx === 11) ? tv === 0 : tv !== 0;
        const len = transformed ? readBase128(buf, o) : orig; tables.push({ idx: tag, len });
      }
      const data = zlib.brotliDecompressSync(buf.subarray(o.p, o.p + compLen)); let at = 0;
      for (const t of tables) { if (t.idx === 0) { cmap = data.subarray(at, at + t.len); break; } at += t.len; }
    } else {
      const n = u16(buf, 4);
      for (let i = 0; i < n; i++) { const o = 12 + i * 16; if (buf.toString('latin1', o, o + 4) === 'cmap') { const off = u32(buf, o + 8), len = u32(buf, o + 12); cmap = buf.subarray(off, off + len); } }
    }
    if (!cmap) return null;
    const recs = []; for (let i = 0, n = u16(cmap, 2); i < n; i++) recs.push({ pid: u16(cmap, 4 + i * 8), eid: u16(cmap, 6 + i * 8), off: u32(cmap, 8 + i * 8) });
    const fmt = r => u16(cmap, r.off);
    const pick = recs.find(r => fmt(r) === 12) ?? recs.find(r => fmt(r) === 4 && (r.pid === 3 || r.pid === 0)) ?? recs.find(r => fmt(r) === 4);
    if (!pick) return null;
    const ranges = [];
    if (fmt(pick) === 12) { const o = pick.off, n = u32(cmap, o + 12); for (let i = 0; i < n; i++) ranges.push([u32(cmap, o + 16 + i * 12), u32(cmap, o + 20 + i * 12)]); }
    else { const o = pick.off, seg = u16(cmap, o + 6) / 2; for (let i = 0; i < seg; i++) { const end = u16(cmap, o + 14 + i * 2), start = u16(cmap, o + 16 + seg * 2 + i * 2); if (start !== 0xffff) ranges.push([start, end]); } }
    return cp => ranges.some(([a, b]) => cp >= a && cp <= b);
  } catch { return null; }
}
/** The letters a declared charset needs (a font "covers" it when it has every one). */
export const CHARSETS = Object.freeze({
  latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?\'"()-&%',
  'latin-ext': 'ÀÁÂÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÖØÙÚÛÜÝßàáâäåæçèéêëìíîïñòóôöøùúûüýÿĄąĆćĘęŁłŃńŚśŹźŻżŐőŰűŒœŠšŽž',
  cyrillic: 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюяЁё',
  greek: 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω',
  vietnamese: 'ĂăÂâĐđÊêÔôƠơƯưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ',
});

// ---------- the package's files ----------
function listFiles(root) {
  const out = [];
  const walk = rel => {
    let es = []; try { es = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const r = rel ? `${rel}/${e.name}` : e.name, abs = path.join(root, r);
      let st; try { st = fs.lstatSync(abs); } catch { continue; }
      if (st.isSymbolicLink()) { out.push({ rel: r, abs, size: 0, link: true }); continue; }
      if (st.isDirectory()) { walk(r); continue; }
      if (st.isFile()) out.push({ rel: r, abs, size: st.size, link: false });
      if (out.length > LIMITS.files + 50) return;
    }
  };
  walk(''); return out;
}
/** Files that are never copied into a style (secrets, other tools' folders): [reason] or null. */
export function skippedReason(rel) {
  const parts = rel.split('/'), base = parts[parts.length - 1], stem = base.replace(/\.[^.]*$/, '');
  if (parts.some(p => p === '.git' || p === 'node_modules')) return 'a folder of another tool (.git / node_modules)';
  if (parts[0] === 'out') return 'render output (out/)';
  if (/^\.env/i.test(base)) return 'an environment file (.env: may hold keys)';
  if (/(^|[^a-z])(keys?|secrets?|tokens?|credentials?|password)([^a-z]|$)/i.test(stem)) return 'its name says it holds a key, secret or token';
  return null;
}
/** A name that must never be extracted or copied (zip-slip): the reason, or null. */
export function unsafeName(name) {
  if (!name || name.length > 400) return 'empty or too long';
  if (/\0/.test(name)) return 'it contains a NUL character';
  if (name.includes('\\')) return 'it contains a backslash';
  if (/^\//.test(name) || /^[A-Za-z]:/.test(name)) return 'it is an absolute path';
  if (name.split('/').some(p => p === '..')) return 'it climbs out of the folder (..)';
  if (/[\u0000-\u001f<>:"|?*]/.test(name.replace(/\/$/, ''))) return 'it contains a character Windows or macOS cannot store';
  return null;
}
/** One sample/views.json "images" entry (project.json's form, relative to sample/): what is wrong with it, or null. The key:
 *  1-80 characters, no control characters; the value: "assets/<path>", no leading /, no drive letter, no backslash, no
 *  empty / . / .. part. The app writes the good ones into the check copy's project.json. */
export function imageEntryProblem(key, value) {
  if (typeof key !== 'string' || !key.length || key.length > 80 || /[\u0000-\u001f\u007f]/.test(key)) return 'the key must be 1-80 characters without control characters';
  if (typeof value !== 'string' || !value.length || value.length > 300) return 'the file must be a path like "assets/press.png"';
  if (/^[\\/]/.test(value) || /^[A-Za-z]:/.test(value) || value.includes('\\') || /[\u0000-\u001f]/.test(value)) return `"${value.slice(0, 80)}" is not a plain relative path`;
  if (value.split('/').some(s => s === '' || s === '.' || s === '..')) return `"${value.slice(0, 80)}" has an empty, . or .. part`;
  if (!value.startsWith('assets/')) return `"${value.slice(0, 80)}" is not under assets/`;
  return null;
}
/** The folder that holds style.json: the given one, or its only subfolder that has one. */
export function packageRoot(dir) {
  if (fs.existsSync(path.join(dir, 'style.json'))) return dir;
  let subs = []; try { subs = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('__MACOSX')); } catch { return dir; }
  const hits = subs.filter(e => fs.existsSync(path.join(dir, e.name, 'style.json')));
  return hits.length === 1 ? path.join(dir, hits[0].name) : dir;
}

// ---------- base comparison (cached per base folder) ----------
const baseCache = new Map();
function baseIndex(dirs) {
  const key = dirs.filter(Boolean).join('|'); if (baseCache.has(key)) return baseCache.get(key);
  const idx = { byRel: new Map(), hashes: new Set(), lines: new Set() };
  for (const [k, d] of dirs.entries()) {
    if (!d || !fs.existsSync(d)) continue;
    for (const f of listFiles(d)) {
      if (f.link || f.size > LIMITS.fileBytes) continue;
      let buf; try { buf = fs.readFileSync(f.abs); } catch { continue; }
      const text = /^(js|mjs|json|md|txt|svg|csv)$/.test(extOf(f.rel)) ? eol(buf.toString('utf8')) : null;
      if (k === 0) idx.byRel.set(f.rel, { text, hash: sha256(text != null ? Buffer.from(text) : buf) });
      idx.hashes.add(sha256(text != null ? Buffer.from(text) : buf));
      if (text != null && /^(js|mjs)$/.test(extOf(f.rel))) for (const l of text.split('\n')) { const t = l.trim(); if (t.length > 3) idx.lines.add(t); }
    }
  }
  baseCache.set(key, idx); return idx;
}
/** Package path -> the path the file has in a project (engine/lib/x.js -> lib/x.js, sample/scenes/a.js -> scenes/a.js). */
function projectPathOf(rel) {
  if (rel.startsWith('engine/')) return rel.slice(7);
  if (rel.startsWith('sample/scenes/')) return 'scenes/' + rel.slice(14);
  if (rel.startsWith('sample/assets/')) return 'assets/' + rel.slice(14);
  return null;
}
/** A project path -> where a package carries it (null: a project file no package part holds). */
const ENGINE_ROOTS = ['engine.js', 'models.js', 'lib/', 'fonts/', 'vendor/', 'sprites/', 'assets/figures/'];
function packagePathOf(proj) {
  if (proj.startsWith('scenes/')) return 'sample/' + proj;
  if (ENGINE_ROOTS.some(r => r.endsWith('/') ? proj.startsWith(r) : proj === r)) return 'engine/' + proj;
  if (proj.startsWith('assets/')) return 'sample/' + proj;
  return null;
}
/** Paths the app serves itself to every project (never in a package). */
const APP_PROVIDED = [/^__(lib|anims|chars3d|library|suite)\//];
/** The module specifiers of a (comment-stripped) source: static imports / re-exports and import('literal'). */
function importSpecs(src) {
  const out = [], rx = /\b(?:import|export)\s*(?:[\w*{}\s,$]+?\s*from\s*)?(['"])([^'"\n]+)\1|\bimport\s*\(\s*(['"])([^'"\n]+)\3\s*\)/g;
  let m; while ((m = rx.exec(src))) out.push({ spec: m[2] ?? m[4], line: lineAt(src, m.index) });
  return out;
}
const hashOfFile = (abs, rel) => { const buf = fs.readFileSync(abs); return sha256(/^(js|mjs|json|md|txt|svg|csv)$/.test(extOf(rel)) ? Buffer.from(eol(buf.toString('utf8'))) : buf); };

/**
 * Every static check on a package folder (a dist/<id>/ folder, or an unpacked zip).
 * @param {string} pkgDir
 * @param {{ validateManifest?: (raw:any)=>{ok:boolean, why?:string}, validateLook?: (raw:any, manifest:any)=>{ok:boolean, why?:string},
 *           baseEngineDir?: string, baseSkillDir?: string, baseSampleDir?: string, baseEngineVersion?: number, baseKind?: string,
 *           baseName?: string }} opts
 * @returns {Promise<Finding[]>}
 */
export async function staticCheck(pkgDir, opts = {}) {
  const out = [], root = packageRoot(pkgDir), add = (...a) => out.push(F(...a));
  // ---- files (limits, names, types, links, secrets, Mixamo)
  const all = listFiles(root);
  if (all.length > LIMITS.files) { add('files', 'high', {}, `The package holds more than ${LIMITS.files} files.`, `Remove what the style does not use (render output, unused assets): at most ${LIMITS.files} files.`); return out; }
  const total = all.reduce((s, f) => s + f.size, 0);
  if (total > LIMITS.totalBytes) { add('files', 'high', {}, `The package is ${Math.round(total / 1048576)} MB unpacked (the limit is ${LIMITS.totalBytes / 1048576} MB).`, 'Remove unused assets or make big ones smaller (compress textures, shorter clips).'); return out; }
  const files = [], skipped = [];
  for (const f of all) {
    const bad = unsafeName(f.rel);
    if (bad) { add('files', 'high', { file: f.rel }, `The file name "${f.rel.slice(0, 120)}" is not allowed: ${bad}.`, 'Rename the file to plain letters, digits, - and _ inside the package folder.'); continue; }
    if (f.link) { add('files', 'high', { file: f.rel }, `${f.rel} is a link (symlink / shortcut), not a file.`, 'Replace the link with the real file (or remove it).'); continue; }
    const why = skippedReason(f.rel); if (why) { skipped.push(`${f.rel} (${why})`); continue; }
    if (f.size > LIMITS.fileBytes) { add('files', 'high', { file: f.rel }, `${f.rel} is ${Math.round(f.size / 1048576)} MB (one file may be at most ${LIMITS.fileBytes / 1048576} MB).`, 'Make it smaller (compress it, lower its resolution) or leave it out.'); continue; }
    if (!isAllowedFile(f.rel)) { add('files', 'high', { file: f.rel }, `${f.rel} is a .${extOf(f.rel) || '(no extension)'} file, which a package may not hold.`, `Remove it, or convert it to an allowed type (${ALLOWED_EXT.join(' ')}; a licence may also be a plain LICENSE / COPYING / OFL / NOTICE file).`); continue; }
    if (/mixamo|y[\s_-]?bot/i.test(f.rel)) { add('files', 'high', { file: f.rel }, `${f.rel} looks like a Mixamo file.`, 'Remove it: Mixamo characters and animations may never be shared in a style (the kit\'s guide says how members add their own on their own computer).'); continue; }
    if (/\.(glb|gltf|bin|fbx)$/i.test(f.rel) && f.size > 100000) { try { if (MIXAMO_HASHES.includes(sha256(fs.readFileSync(f.abs)))) { add('files', 'high', { file: f.rel }, `${f.rel} is the Mixamo Y Bot.`, 'Remove it: the app gives every 3D reconstruction project its own copy; a package may never carry it.'); continue; } } catch { /* unreadable: below */ } }
    files.push(f);
  }
  if (skipped.length) add('files', 'low', {}, `${skipped.length} file${skipped.length > 1 ? 's are' : ' is'} left out of the style: ${skipped.slice(0, 6).join('; ')}${skipped.length > 6 ? ' ...' : ''}.`, 'Nothing to do if that is what you want; move a file the style really needs to a name without key/secret/token.');
  const has = rel => files.some(f => f.rel === rel), byRel = new Map(files.map(f => [f.rel, f]));
  const txt = rel => { const f = byRel.get(rel); return f ? readText(f.abs) : null; };

  // ---- manifest
  let manifest = null;
  const rawManifest = txt('style.json');
  if (rawManifest == null) add('manifest', 'high', { file: 'style.json' }, 'The package has no style.json.', 'Run `cz package <style>`: it writes style.json from styles/<name>/style.json.');
  else {
    try { manifest = JSON.parse(rawManifest.replace(/^﻿/, '')); } catch (e) { add('manifest', 'high', { file: 'style.json' }, `style.json is not valid JSON (${String(e.message).slice(0, 120)}).`, 'Fix the JSON syntax (a missing comma or quote), then package again.'); }
    if (manifest && (typeof manifest !== 'object' || Array.isArray(manifest))) { add('manifest', 'high', { file: 'style.json' }, 'style.json is not a JSON object.', 'Write style.json as one { ... } object (see style.schema.json).'); manifest = null; }
    if (manifest) {
      const v = opts.validateManifest ? opts.validateManifest(manifest) : { ok: true };
      if (!v.ok) add('manifest', 'high', { file: 'style.json' }, `style.json does not match the manifest schema: ${v.why}.`, 'Fix the field it names (style.schema.json lists every field and its limits).');
      if (typeof manifest.id !== 'string' || !/^custom-[a-z0-9-]{1,40}$/.test(manifest.id)) add('manifest', 'high', { file: 'style.json' }, `The style id "${String(manifest.id ?? '').slice(0, 60)}" is not custom-<name> (lowercase letters, digits and -, at most 40).`, 'Set "id" to custom-<name>, e.g. custom-neon-noir (cz new does this for you).');
      if (!BASES.includes(manifest.base)) add('manifest', 'high', { file: 'style.json' }, `"base" is "${String(manifest.base ?? '').slice(0, 60)}", which is not a built-in base.`, `Set "base" to the base the style was made on: one of ${BASES.join(', ')}.`);
      const k = manifest.kit;
      if (!k || typeof k !== 'object') add('manifest', 'high', { file: 'style.json' }, 'style.json has no "kit" block (it says which kit and base engine made the package).', 'Package the style with `cz package <style>`: it writes the kit block.');
      else {
        if (k.kit !== 1) add('manifest', 'high', { file: 'style.json' }, `The kit block says kit ${JSON.stringify(k.kit)}; this app reads kit 1.`, 'Package the style with the kit this app generated (Styles > Get the Style Kit).');
        if (k.base !== manifest.base) add('manifest', 'high', { file: 'style.json' }, `The kit block says base "${k.base}" but "base" is "${manifest.base}".`, 'Package again with `cz package` (it writes both from the style).');
        if (!Number.isInteger(k.baseEngine)) add('manifest', 'high', { file: 'style.json' }, 'The kit block has no base engine version.', 'Package again with `cz package`.');
      }
      if (!manifest.from || typeof manifest.from !== 'object' || !Number.isInteger(manifest.from.engineVersion)) add('manifest', 'high', { file: 'style.json' }, 'style.json has no "from" (the base engine version it was built on).', 'Package again with `cz package` (it writes "from": { "style": <base>, "engineVersion": N }).');
    }
  }
  const base = BASES.includes(manifest?.base) ? manifest.base : null, baseName = opts.baseName || base || 'the base';

  // ---- contract (section 2)
  const engSrc = txt('engine/engine.js');
  let baseSrc = opts.baseEngineDir ? readText(path.join(opts.baseEngineDir, 'engine.js')) : null;
  if (engSrc == null) add('contract', 'high', { file: 'engine/engine.js' }, 'The package has no engine/engine.js.', 'Package the style again: engine/ is copied from the style folder\'s engine files.');
  else {
    // the optional exports to keep are the ones of the base engine THIS style was built on: the kit block lists them
    // (kit.baseExports); without it, this app's base engine only when it is that version (a newer base engine may have
    // added exports a style built on an older one never had: that is not a removal)
    const builtOn = manifest?.from?.engineVersion, kitBase = Array.isArray(manifest?.kit?.baseExports) ? manifest.kit.baseExports.filter(x => typeof x === 'string') : null;
    const have = new Set(exportNames(engSrc)), baseHas = new Set(kitBase ?? (baseSrc && (builtOn == null || builtOn === engineVersionOf(baseSrc)) ? exportNames(baseSrc) : []));
    const missing = HOST_CONTRACT.required.filter(n => !have.has(n));
    for (const n of missing) add('contract', 'high', { file: 'engine/engine.js', line: null }, `engine.js does not export ${n}.`, `Export ${n} again (exports may be added, never removed or renamed: keep the old name exported, as an alias if you renamed it).`);
    for (const n of HOST_CONTRACT.optional) if (baseHas.has(n) && !have.has(n)) add('contract', 'high', { file: 'engine/engine.js' }, `engine.js no longer exports ${n} (the ${baseName} engine does, and the host page uses it).`, `Export ${n} again (as an alias if you renamed it).`);
    if (have.has('ENGINE_VERSION') && engineVersionOf(engSrc) == null) add('contract', 'high', { file: 'engine/engine.js' }, 'ENGINE_VERSION is not written as `export const ENGINE_VERSION = <number>` on its own line.', 'Write it exactly like that (the app reads it with a pattern, it never runs the engine).');
    const kind = engineKindOf(engSrc), want = opts.baseKind ?? engineKindOf(baseSrc);
    if (have.has('ENGINE_KIND') && want && kind !== want) add('contract', 'high', { file: 'engine/engine.js' }, `ENGINE_KIND is ${kind ? `'${kind}'` : 'not a plain string'}; the ${baseName} engine is '${want}'.`, `Set export const ENGINE_KIND = '${want}' (the host page and the app branch on it).`);
  }

  // ---- banned calls + text
  const baseIdx = baseIndex([opts.baseEngineDir, opts.baseSampleDir]);
  let manifestBanned = Array.isArray(manifest?.banned) ? manifest.banned.filter(x => typeof x === 'string').map(s => s.trim()).filter(s => s.length >= 3 && s.length <= 80) : [];
  const tokens = [...new Set([...ALWAYS_BANNED, ...manifestBanned])], debt = new Map();
  // every engine file and every sample scene file (helpers in subfolders and .mjs too), except the scenes the must-fail
  // views name (they break rules on purpose)
  const mustScenes = new Set(); { let vj = null; try { vj = JSON.parse((txt('sample/views.json') ?? '').replace(/^﻿/, '')); } catch { /* the sample check names it */ }
    for (const [n, v] of Object.entries(vj?.views && typeof vj.views === 'object' ? vj.views : {})) if (v && (v.expect || /^mustfail/i.test(n)) && Array.isArray(v.scenes)) for (const s of v.scenes) if (typeof s === 'string') mustScenes.add(`sample/scenes/${s}.js`); }
  const scanJs = files.filter(f => /\.(m?js)$/i.test(f.rel) && (f.rel.startsWith('engine/') || (/^sample\/scenes\/.+\.m?js$/i.test(f.rel) && !mustScenes.has(f.rel))));
  for (const f of scanJs) {
    const src = readText(f.abs); if (src == null) continue;
    const norm = eol(src.replace(/^﻿/, ''));
    const baseRel = f.rel.startsWith('engine/') ? f.rel.slice(7) : null, b = baseRel ? baseIdx.byRel.get(baseRel) : null;
    const identical = !!b && b.text === norm;
    const hits = bannedInSource(norm, tokens);
    for (const h of hits) {
      if (identical || baseIdx.lines.has(h.text)) { debt.set(f.rel, (debt.get(f.rel) ?? 0) + 1); continue; }
      const label = h.token === 'DOM write' ? 'a DOM write (document / window)' : h.token === 'absolute URL' ? 'code or data loaded from an absolute URL' : h.token;
      // a computed fetch / import address is named, not blocking: the base engines build their own files' addresses that
      // way, and the page's security policy refuses any address outside the project when it runs
      add('banned', h.token === 'fetch/import of a computed address' ? 'medium' : 'high', { file: f.rel, line: h.line }, `${label} in ${f.rel}:${h.line}: ${h.text.slice(0, 120)}`, fixOf(h.token === 'DOM write' ? 'DOM' : h.token));
    }
    if (!identical) for (const g of gluedComments(norm)) { if (baseIdx.lines.has(g.text)) continue; add('text', 'high', { file: f.rel, line: g.line }, `Code after a // comment in ${f.rel}:${g.line}: ${g.text}`, 'Put the code on its own line (an edit glued it into the comment, so it never runs).'); }
  }
  if (debt.size) { const list = [...debt].map(([f, n]) => `${f} (${n})`); add('banned', 'low', {}, `Banned calls kept from the ${baseName} engine itself (base debt, not yours): ${list.slice(0, 6).join(', ')}${list.length > 6 ? ` and ${list.length - 6} more` : ''}.`, 'Nothing to fix in your style; do not copy these patterns into your own code.', 'they are the base engine\'s own (timers in its exporter, three.js internals): every style on this base has them'); }
  for (const f of files) {
    const e = extOf(f.rel); if (!/^(js|mjs|json|md|txt|csv|svg)$/.test(e) && !(e === '' && LICENCE_NAME.test(f.rel.split('/').pop()))) continue;
    let buf; try { buf = fs.readFileSync(f.abs); } catch { continue; }
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) add('text', 'high', { file: f.rel, line: 1 }, `${f.rel} starts with a byte-order mark (BOM).`, 'Save it as UTF-8 without BOM (let Claude rewrite it with its Write tool; on Windows, PowerShell\'s Set-Content and Out-File add one).');
    try { new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { add('text', 'high', { file: f.rel }, `${f.rel} is not valid UTF-8 text.`, 'Save it as UTF-8 (without BOM).'); continue; }
    if (/^(js|mjs|json)$/.test(e) && buf.includes(13)) { const s = buf.toString('utf8'); add('text', 'high', { file: f.rel, line: lineAt(s, s.indexOf('\r')) }, `${f.rel} has Windows line endings (CRLF).`, 'Convert it to LF line endings (the kit\'s files are LF; an editor or shell edit added CR).'); }
  }

  // ---- sample (views, scenes, timeline)
  let views = null;
  const vtxt = txt('sample/views.json');
  if (vtxt == null) add('sample', 'high', { file: 'sample/views.json' }, 'The package has no sample/views.json.', 'Package the style with `cz package`: it writes sample/ from the style\'s views.');
  else {
    let vj = null; try { vj = JSON.parse(vtxt.replace(/^﻿/, '')); } catch (e) { add('sample', 'high', { file: 'sample/views.json' }, `sample/views.json is not valid JSON (${String(e.message).slice(0, 100)}).`, 'Fix the JSON, or package again.'); }
    views = vj && typeof vj.views === 'object' && vj.views ? vj.views : null;
    if (vj && !views) add('sample', 'high', { file: 'sample/views.json' }, 'sample/views.json has no "views".', 'Package again with `cz package`.');
    if (views) {
      for (const need of ['sample', 'hero', 'kit']) if (!views[need]) add('sample', 'high', { file: 'sample/views.json' }, `There is no "${need}" view.`, `Add the ${need} view to project.json "views" in your style (scenes + end), then package again.`);
      const must = Object.entries(views).filter(([n, v]) => v && (v.expect || /^mustfail/i.test(n)));
      if (!must.length) add('sample', 'high', { file: 'sample/views.json' }, 'There is no must-fail view (a scene that a check must catch).', 'Keep at least one mustfail_* view from the base sample (each with "expect": the check it must fire): a check never seen to fail is not trusted.');
      for (const [n, v] of must) if (!v.expect) add('sample', 'high', { file: 'sample/views.json' }, `The must-fail view ${n} does not say which check it must fire.`, `Add "expect": "<check>" to ${n} (e.g. "overlap", "cut", "BLANK").`);
      for (const [n, v] of Object.entries(views)) {
        if (!/^[A-Za-z][\w-]{0,40}$/.test(n)) { add('sample', 'high', { file: 'sample/views.json' }, `The view name "${n.slice(0, 40)}" is not allowed.`, 'Use letters, digits, _ and - only.'); continue; }
        if (!v || !Array.isArray(v.scenes) || !v.scenes.length || !(+v.end > 0)) { add('sample', 'high', { file: 'sample/views.json' }, `The view ${n} needs "scenes" (a list) and "end" (seconds > 0).`, `Write ${n} as { "scenes": ["${n}"], "end": 6 }.`); continue; }
        for (const s of v.scenes) {
          if (typeof s !== 'string' || !/^[A-Za-z0-9][\w-]{0,60}$/.test(s)) add('sample', 'high', { file: 'sample/views.json' }, `View ${n}: the scene name "${String(s).slice(0, 40)}" is not allowed.`, 'Scene names are file names without .js: letters, digits, _ and -.');
          else if (!has(`sample/scenes/${s}.js`)) add('sample', 'high', { file: `sample/scenes/${s}.js` }, `View ${n} uses sample/scenes/${s}.js, which is missing.`, `Put scenes/${s}.js in the style (or remove it from the view), then package again.`);
        }
      }
    }
    // the pictures the sample's scenes load (views.json "images", project.json's form: key -> "assets/<file>", relative to
    // sample/): the app writes them into the check copy's project.json, so each must be a plain path to a packaged file
    const imgs = vj?.images;
    if (imgs != null && (typeof imgs !== 'object' || Array.isArray(imgs))) add('sample', 'high', { file: 'sample/views.json' }, 'sample/views.json "images" is not an object (picture key -> "assets/<file>").', 'Package again with `cz package` (it writes the pictures of project.json "images").');
    else for (const [k, p] of Object.entries(imgs ?? {})) {
      const why = imageEntryProblem(k, p);
      if (why) add('sample', 'high', { file: 'sample/views.json' }, `sample/views.json "images" entry "${String(k).slice(0, 60)}": ${why}.`, 'Write it as "<key>": "assets/<file>" (the picture in the style\'s assets/ folder, packaged as sample/assets/), then package again.');
      else if (!has(`sample/${p}`)) add('sample', 'high', { file: `sample/${p}` }, `sample/views.json "images" names ${p} for "${k}", which is not in the package (no sample/${p}).`, `Put the picture into the style's assets/ (it is packaged as sample/assets/) or remove "${k}" from project.json "images", then package again.`);
    }
    const tl = txt('sample/timeline.json');
    if (tl == null) add('sample', 'high', { file: 'sample/timeline.json' }, 'The package has no sample/timeline.json (the sample narration timing).', 'Keep audio/timeline.json in the style (cz new copies the base\'s), then package again.');
    else { let t = null; try { t = JSON.parse(tl.replace(/^﻿/, '')); } catch { /* below */ }
      const segs = Array.isArray(t) ? t : Array.isArray(t?.segments) ? t.segments : null;
      if (!segs || segs.some(x => !x || typeof x.s !== 'number' || typeof x.e !== 'number')) add('sample', 'high', { file: 'sample/timeline.json' }, 'sample/timeline.json is not a narration timing ([{ s, e, text, words: [{ w, s, e }] }]).', 'Restore audio/timeline.json from the base sample (or a real transcription in that shape).'); }
  }

  // ---- imports: every relative import of the engine and the sample scenes resolves to a file in the package (a scene
  // helper module or a root-level engine file left out of the package boots in the kit's folder but 404s in the app)
  for (const f of files) {
    if (!/\.m?js$/i.test(f.rel) || !(f.rel.startsWith('engine/') || f.rel.startsWith('sample/scenes/'))) continue;
    const src = readText(f.abs); if (src == null) continue;
    const proj = projectPathOf(f.rel); if (!proj) continue;
    for (const { spec, line } of importSpecs(stripJs(eol(src), true))) {
      if (!/^\.{1,2}\//.test(spec)) continue;                                 // bare ('three': the import map) or absolute (banned above)
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(proj), spec.split(/[?#]/)[0]));
      if (target.startsWith('../') || target === '..') { add(f.rel.startsWith('engine/') ? 'contract' : 'sample', 'high', { file: f.rel, line }, `${f.rel}:${line} imports "${spec}", which is outside the project folder.`, 'Import only files inside the style (engine files at its root, scenes/, assets/).'); continue; }
      if (APP_PROVIDED.some(rx => rx.test(target)) || (base === 'flat' && target === 'character.js')) continue;
      const inPkg = packagePathOf(target);
      if (!inPkg || !has(inPkg)) add(f.rel.startsWith('engine/') ? 'contract' : 'sample', 'high', { file: f.rel, line }, `${f.rel}:${line} imports "${spec}" (${target} in a project), which is not in the package${inPkg ? ` (no ${inPkg})` : ''}.`,
        inPkg ? `Package again with \`cz package\` (it carries every scenes/*.js and the engine parts); if the file lives elsewhere in the style, move it into ${target.startsWith('scenes/') ? 'scenes/' : 'lib/'}.` : `Move ${target} into lib/ (engine code) or scenes/ (scene code) and import it from there: a project only gets engine.js, models.js, lib/, fonts/, vendor/, scenes/ and assets/.`);
    }
  }

  // ---- looks
  const lookFiles = files.filter(f => /^looks\/[^/]+\.json$/.test(f.rel));
  if (!lookFiles.length) add('looks', 'high', { file: 'looks/' }, 'The package has no look (looks/<look-id>.json).', 'Keep at least one look in looks/ (cz new writes looks/look-default.json).');
  for (const f of lookFiles) {
    let raw = null; try { raw = JSON.parse((readText(f.abs) ?? '').replace(/^﻿/, '')); } catch (e) { add('looks', 'high', { file: f.rel }, `${f.rel} is not valid JSON.`, 'Fix the JSON syntax.'); continue; }
    // a look's format must be one the style is made for (the app could not offer it: New project and the Look panel skip it)
    const fmt = raw?.settings?.format, aspects = Array.isArray(manifest?.aspects) ? manifest.aspects : [];
    const formats = aspects.map(a => a === '9:16' ? 'vertical' : 'landscape');
    if (fmt != null && aspects.length && !formats.includes(fmt)) { add('looks', 'high', { file: f.rel }, `${f.rel} sets "format": ${JSON.stringify(fmt)}, but the style is made for ${aspects.join(' and ')} (${formats.map(x => `"${x}"`).join(' / ')}).`, `Remove "format" from the look (the app sets it from the project's format), or use ${formats.map(x => `"${x}"`).join(' or ')}; to offer another format, add its aspect to style.json "aspects" and check every view in it.`); continue; }
    const v = opts.validateLook ? opts.validateLook(raw, manifest) : { ok: true };
    if (!v.ok) add('looks', 'high', { file: f.rel }, `${f.rel}: ${v.why}`, 'Fix the setting it names: a look may only use values the style\'s controls allow (min / max / options).');
  }

  // ---- prompts
  if (manifest) {
    const p = manifest.prompts && typeof manifest.prompts === 'object' ? manifest.prompts : {};
    for (const k of ['build', 'context', 'qualityBar']) if (!String(p[k] ?? '').trim()) add('prompts', 'medium', { file: 'style.json' }, `prompts.${k} is empty.`, k === 'qualityBar' ? 'Write the quality bar (what a finished frame must be), e.g. from skill/QUALITY.md "The bar".' : `Write prompts.${k}: what Claude must know to ${k === 'build' ? 'build a video' : 'work on a project'} in this style (point it at skill/STYLE_GUIDE.md).`);
    const texts = [['style.json', Object.values(p).filter(x => typeof x === 'string').join('\n')], ...files.filter(f => /^skill\/[^/]+\.md$/.test(f.rel)).map(f => [f.rel, readText(f.abs) ?? ''])];
    const exists = ref => { const r = ref.replace(/^\.\//, ''); if (['', 'engine/', 'skill/', 'skill/base/', 'skill/base/references/', 'sample/'].some(pre => has(pre + r))) return true; const b = r.split('/').pop(); return files.some(f => f.rel.split('/').pop() === b); };
    const missing = new Set();
    for (const [file, t] of texts) for (const m of t.matchAll(/`((?:skill|references|lib|docs|reference|engine|looks|sample)\/[\w./-]+\.(?:md|js|json)|[\w-]+\.md)`/g)) if (!exists(m[1]) && !missing.has(m[1])) { missing.add(m[1]); add('prompts', 'medium', { file }, `${file} names ${m[1]}, which is not in the package.`, `Add ${m[1]} to the style, or remove the reference.`); }
    if (base) { const all = texts.map(x => x[1]).join('\n').toLowerCase(); for (const [b, words] of Object.entries(VOCAB)) if (b !== base) for (const w of words) if (all.includes(w)) add('prompts', 'medium', { file: 'style.json' }, `The prompts or skill say "${w}", which is the ${b} style's vocabulary (this style is built on ${base}).`, 'Describe this style in its own words: the base style\'s words make Claude build the base style.'); }
  }

  // ---- credits (assets that are not the base's)
  let credits = []; const ctxt = txt('CREDITS.json');
  if (ctxt != null) { try { const c = JSON.parse(ctxt.replace(/^﻿/, '')); credits = Array.isArray(c) ? c : []; if (!Array.isArray(c)) add('credits', 'medium', { file: 'CREDITS.json' }, 'CREDITS.json is not a list.', 'Write CREDITS.json as [{ "file", "source", "licence", "author" }].'); } catch { add('credits', 'medium', { file: 'CREDITS.json' }, 'CREDITS.json is not valid JSON.', 'Fix the JSON syntax.'); } }
  const creditFor = rel => credits.find(c => c && typeof c.file === 'string' && (c.file === rel || c.file.replace(/^\.\//, '') === rel || rel.endsWith('/' + c.file)));
  const assetFiles = files.filter(f => (f.rel.startsWith('engine/') || f.rel.startsWith('sample/assets/')) && !/\.(m?js|json|md|txt)$/i.test(f.rel));
  for (const f of assetFiles) {
    let h; try { h = hashOfFile(f.abs, f.rel); } catch { continue; }
    if (baseIdx.hashes.has(h)) continue;
    const c = creditFor(f.rel);
    if (!c) add('credits', 'medium', { file: f.rel }, `${f.rel} has no entry in CREDITS.json.`, `Add { "file": "${f.rel}", "source": "<where it is from>", "licence": "CC0 / CC-BY 4.0 / OFL / MIT / own", "author": "<who made it>" } to CREDITS.json.`);
    else if (!ALLOWED_LICENCE.test(String(c.licence ?? c.license ?? ''))) add('credits', 'medium', { file: f.rel }, `${f.rel} has the licence "${String(c.licence ?? c.license ?? '').slice(0, 60)}", which members may not share.`, 'Use an asset under CC0, public domain, CC-BY, OFL, MIT, Apache-2.0, ODbL (map data, with attribution), or your own work (licence "own").');
  }

  // ---- fonts
  const fontFiles = files.filter(f => /\.(ttf|otf|woff2?)$/i.test(f.rel));
  for (const f of fontFiles) {
    const dir = f.rel.includes('/') ? f.rel.slice(0, f.rel.lastIndexOf('/') + 1) : '';
    let h = null; try { h = hashOfFile(f.abs, f.rel); } catch { /* unreadable */ }
    if (h && baseIdx.hashes.has(h)) continue;                     // the base's own font (its licence ships with the app)
    // a licence next to it: not the base's own licence file (that one covers the base's fonts, not a new one)
    const near = files.filter(x => x.rel.startsWith(dir) && !x.rel.slice(dir.length).includes('/') && /(licen[cs]e|ofl|copying|notice)/i.test(x.rel.slice(dir.length)));
    const own = near.filter(x => { try { return !baseIdx.hashes.has(hashOfFile(x.abs, x.rel)); } catch { return true; } });
    if (!own.length) add('fonts', 'medium', { file: f.rel }, near.length ? `${f.rel} has no licence of its own next to it (${near.map(x => x.rel.slice(dir.length)).join(', ')} is the base's, for the base's fonts).` : `${f.rel} has no licence file next to it.`,
      `Put the font's own licence (e.g. OFL.txt or a LICENSE file for an SIL Open Font License font, with its copyright line) in ${dir || 'the same folder'}.`);
  }
  const charsets = Array.isArray(manifest?.fonts?.charsets) ? manifest.fonts.charsets.filter(c => typeof c === 'string') : [];
  if (charsets.length) for (const f of fontFiles) {
    let cov = null; try { cov = fontCoverage(fs.readFileSync(f.abs)); } catch { /* below */ }
    if (!cov) { add('fonts', 'low', { file: f.rel }, `The letters of ${f.rel} could not be read.`, 'Use a standard TTF / OTF / WOFF / WOFF2 font.'); continue; }
    for (const cs of charsets) { const need = CHARSETS[cs.toLowerCase()]; if (!need) { add('fonts', 'medium', { file: 'style.json' }, `fonts.charsets names "${cs}", which the checks do not know.`, `Use ${Object.keys(CHARSETS).join(', ')}.`); continue; }
      const lack = [...need].filter(ch => !cov(ch.codePointAt(0)));
      if (lack.length) add('fonts', 'medium', { file: f.rel }, `${f.rel} lacks ${lack.length} ${cs} letter${lack.length > 1 ? 's' : ''} (${lack.slice(0, 12).join('')}${lack.length > 12 ? '...' : ''}).`, `Use a font with full ${cs} support, or remove "${cs}" from fonts.charsets.`); }
  }

  // ---- version (info)
  const fromV = manifest?.from?.engineVersion;
  if (Number.isInteger(fromV) && Number.isInteger(opts.baseEngineVersion) && opts.baseEngineVersion > fromV) {
    const nm = opts.baseName || (base ? base.replace(/(^|-)(\w)/g, (_, d, c) => (d ? ' ' : '') + c.toUpperCase()) : 'The base');
    add('version', 'info', {}, `${nm} engine v${opts.baseEngineVersion} is available (yours: v${fromV}).`, 'Optional: `cz rebase <style>` brings the new base engine next to yours to merge (guide: "Update your style to a newer engine").');
  }
  return out;
}

/** Findings as text, grouped by severity (finding -> meaning -> fix). */
export function formatFindings(findings) {
  const order = ['high', 'medium', 'low', 'info'], lines = [];
  for (const sev of order) {
    const list = findings.filter(f => f.sev === sev); if (!list.length) continue;
    lines.push(`${sev.toUpperCase()} (${list.length})`);
    for (const f of list) {
      const w = f.where?.file ? ` [${f.where.file}${f.where.line ? ':' + f.where.line : ''}${f.where.view ? ` view ${f.where.view}` : ''}${f.where.aspect ? ` ${f.where.aspect}` : ''}]` : f.where?.view ? ` [view ${f.where.view}${f.where.aspect ? ' ' + f.where.aspect : ''}]` : '';
      lines.push(`  ${f.id}${w}: ${f.finding}`, `    -> ${f.meaning}`, `    -> fix: ${f.fix}`);
    }
  }
  return lines.join('\n');
}
