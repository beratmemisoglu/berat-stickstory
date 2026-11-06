// Toon Studio Style Kit: shared helpers (kit paths, JSON, copying, settings per aspect, controls validation).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STYLES = path.join(KIT, 'styles');
export const DIST = path.join(KIT, 'dist');
export const BASES_DIR = path.join(KIT, 'bases');
/** The parts of an engine folder a package's engine/ carries (src/main/studio/publish.ts ENGINE_PARTS). */
export const ENGINE_PARTS = ['engine.js', 'models.js', 'lib', 'fonts', 'vendor', 'sprites', 'assets/figures'];
/** What the kit copies from an app engine folder into bases/<base>/engine (ENGINE_PARTS + what the base's models
 *  import: flat's default character.js, recon's animation catalog). */
export const BASE_ENGINE_PARTS = [...ENGINE_PARTS, 'character.js', 'assets/anims/builtin.json', 'assets/anims/quality.json'];
/** The built-in bases and the templates/<folder> each one's engine lives in (src/main/styles.ts). */
export const BASE_ENGINE_DIR = { 'pixel-art': 'engine', collage: 'collage', flat: 'flat', stickman: 'stickman', recon: 'recon', lowpoly: 'lowpoly', starter: 'starter' };
export const BASE_SKILL = { 'pixel-art': 'pixel-explainer-video', collage: 'vox-collage-video', flat: 'flat-explainer-video', stickman: 'stickman-explainer', recon: 'recon-reconstruction', lowpoly: 'lowpoly-shorts', starter: 'studio-starter' };
export const BASE_NAME = { 'pixel-art': 'Pixel art', collage: 'Vox', flat: 'Flat explainer', stickman: 'Stick figure', recon: '3D reconstruction', lowpoly: 'Low poly shorts', starter: 'Starter' };
/** The ENGINE_KIND each base declares (pixel-art's engine has none: the host treats a missing one as 'pixel'). */
export const BASE_KIND = { 'pixel-art': 'pixel', collage: 'collage', flat: 'flat', stickman: 'stickman', recon: 'recon', lowpoly: 'lowpoly', starter: 'starter' };
export const DIM_OF_BASE = { flat: '2d', collage: '2d', stickman: '2d', recon: '3d', lowpoly: '3d', 'pixel-art': '3d' };
export const NAME_RX = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const VIEW_RX = /^[A-Za-z][\w-]{0,40}$/;

export const readJson = (f, fb = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return fb; } };
export const writeJson = (f, v, indent = 2) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, indent) + '\n'); };
export const exists = f => { try { fs.statSync(f); return true; } catch { return false; } };
export const sha1 = buf => crypto.createHash('sha1').update(buf).digest('hex');
export const isText = f => /\.(m?js|json|md|txt|csv|svg|html)$/i.test(f);
/** LF line endings for the kit's own text files (the app's templates may have CRLF ones). */
export const toLF = s => s.replace(/\r\n?/g, '\n');

export function kitJson() { return readJson(path.join(KIT, 'kit.json'), {}) || {}; }
/** The installed app's templates folder when it is still there (read-only: host, low-poly library, script fonts, anims). */
export function appTemplates() {
  const t = kitJson().appTemplates;
  return t && exists(path.join(t, 'host', 'host.js')) ? t : null;
}
export const hostDir = () => { const a = appTemplates(); return a ? path.join(a, 'host') : path.join(KIT, 'host'); };
export const styleDir = name => path.join(STYLES, name);
export const baseDir = base => path.join(BASES_DIR, base);

/** Copy a tree (files only, never links; skips __pycache__ and .DS_Store). `filter(rel)` false = skip. `lf`: text files
 *  get LF line endings. Returns the number of files copied. */
export function copyTree(src, dst, { filter = null, lf = false } = {}) {
  let n = 0;
  const go = (s, d, rel) => {
    let st; try { st = fs.lstatSync(s); } catch { return; }
    if (st.isSymbolicLink()) return;
    const base = path.basename(s);
    if (base === '__pycache__' || base === '.DS_Store' || base === 'Thumbs.db') return;
    if (filter && rel && !filter(rel, st.isDirectory())) return;
    if (st.isDirectory()) { fs.mkdirSync(d, { recursive: true }); for (const e of fs.readdirSync(s)) go(path.join(s, e), path.join(d, e), rel ? `${rel}/${e}` : e); return; }
    if (!st.isFile()) return;
    fs.mkdirSync(path.dirname(d), { recursive: true });
    if (lf && isText(s)) fs.writeFileSync(d, toLF(fs.readFileSync(s, 'utf8'))); else fs.copyFileSync(s, d);
    n++;
  };
  go(src, dst, ''); return n;
}
/** Every file under a folder: relative paths with '/'. */
export function listFiles(dir, { skip = null } = {}) {
  const out = [];
  const walk = rel => { let es = []; try { es = fs.readdirSync(path.join(dir, rel), { withFileTypes: true }); } catch { return; }
    for (const e of es) { const r = rel ? `${rel}/${e.name}` : e.name; if (skip && skip(r, e.isDirectory())) continue; if (e.isDirectory()) walk(r); else if (e.isFile()) out.push(r); } };
  walk(''); return out.sort();
}

// ---------- settings ----------
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
/** checks.ts mergeSettings: one level deep. */
export const mergeSettings = (a, b) => { const o = { ...(a ?? {}) }; for (const [k, v] of Object.entries(b ?? {})) o[k] = isObj(v) && isObj(o[k]) ? { ...o[k], ...v } : v; return o; };
export const deepMerge = (a, b) => { const o = { ...(a ?? {}) }; for (const k in b || {}) o[k] = isObj(b[k]) && isObj(a?.[k]) ? deepMerge(a[k], b[k]) : b[k]; return o; };
export const formatOfAspect = a => a === '9:16' ? 'vertical' : 'landscape';
/** The base's default look and controls (bases/<base>/look.json, written by make-kit from the app). */
export function baseLook(base) { const j = readJson(path.join(baseDir(base), 'look.json'), {}) || {}; return { settings: j.settings ?? {}, controls: Array.isArray(j.controls) ? j.controls : [], id: j.id ?? null, looks: j.looks ?? {} }; }
/** The engine settings a style renders one aspect with (the app's styleImport.ts settingsOf): the base's default look
 *  (for a starter style the look of its `dim`), the style's defaults (style.json) over it, then `look` (a looks/*.json
 *  "settings", for `--look`) over that, then that frame's format. The engine merges these over its own DEFAULTS, so a key
 *  the base look sets is never read from DEFAULTS: a style changes such a key in style.json "defaults". */
const SESSION_LOOK = new Map();
/** `cz preview --look`: every settingsFor of that style in this process (the preview server's too) uses the look. */
export function useLook(dir, settings) { SESSION_LOOK.set(path.resolve(dir), isObj(settings) ? settings : null); }
export function settingsFor(dir, aspect, look = null) {
  look = look ?? SESSION_LOOK.get(path.resolve(dir)) ?? null;
  const sj = readJson(path.join(dir, 'style.json'), {}) || {}, base = sj.base;
  const L = baseLook(base), dimLook = sj.dim ? Object.values(L.looks).find(s => s && s.dim === sj.dim) : null;
  let s = deepMerge(dimLook ?? L.settings, isObj(sj.defaults) ? sj.defaults : {});
  if (isObj(look)) s = deepMerge(s, look);
  // the frame is always the aspect asked for: an engine whose default is vertical (flat, low poly) must not render a
  // 16:9 view tall when the base look carries no format (engines without a format setting ignore it)
  return { ...s, format: formatOfAspect(aspect) };
}
/** A style's look (looks/<id>.json, found by file name or "id"): { id, file, settings, format } or an Error message. */
export function readLook(dir, id) {
  const ld = path.join(dir, 'looks'), files = exists(ld) ? fs.readdirSync(ld).filter(f => /\.json$/i.test(f)) : [];
  for (const f of files) {
    const j = readJson(path.join(ld, f), null);
    if (f.replace(/\.json$/i, '') !== id && j?.id !== id) continue;
    if (!j || !isObj(j.settings)) throw new Error(`looks/${f} has no "settings" object.`);
    const fmt = j.settings.format;
    return { id: j.id ?? f.replace(/\.json$/i, ''), file: `looks/${f}`, settings: j.settings, aspect: fmt === 'vertical' ? '9:16' : fmt === 'landscape' ? '16:9' : null };
  }
  throw new Error(`there is no look "${id}" in looks/ (${files.length ? `looks: ${files.map(f => f.replace(/\.json$/i, '')).join(', ')}` : 'none yet'}).`);
}

// ---------- controls (port of src/shared/stylePackage.ts controlsFor / validateByControls) ----------
const FORMAT_LABEL = { vertical: 'Vertical 9:16', landscape: 'Wide 16:9' };
export function controlsFor(base, spec, aspects) {
  const keep = spec?.keep?.length ? new Set([...spec.keep, 'format', 'brand.color']) : null, remove = new Set(spec?.remove ?? []);
  const added = spec?.add ?? [], addedPaths = new Set(added.map(c => c.path));
  let out = base.filter(c => (!keep || keep.has(c.path)) && !remove.has(c.path) && !addedPaths.has(c.path)).map(c => ({ ...c }));
  const bi = out.findIndex(c => c.path === 'brand.color');
  out = bi < 0 ? [...out, ...added.map(c => ({ ...c }))] : [...out.slice(0, bi), ...added.map(c => ({ ...c })), ...out.slice(bi)];
  if (aspects?.length) {
    const formats = aspects.map(formatOfAspect), opts = formats.map(v => ({ value: v, label: FORMAT_LABEL[v] }));
    const f = out.find(c => c.path === 'format');
    if (f) f.options = opts.map(o => ({ ...(f.options?.find(x => x.value === o.value) ?? {}), ...o }));
    else if (formats.length > 1) out.unshift({ path: 'format', label: 'Format', help: 'Set when the project is created.', type: 'select', readOnly: true, options: opts });
  }
  return out;
}
const getPath = (o, p) => p.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);
const num = v => typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? +v : NaN;
export function validateByControls(s, controls, aspects) {
  if (s == null || typeof s !== 'object' || Array.isArray(s)) return 'Settings must be an object.';
  if (aspects?.length && s.format != null) { const ok = aspects.map(formatOfAspect); if (!ok.includes(s.format)) return ok.length > 1 ? 'Format must be vertical or landscape.' : `This style is ${aspects[0]} only.`; }
  for (const c of controls) {
    if (c.path === 'format') continue;
    const v = getPath(s, c.path), name = c.label || c.path;
    if (v == null || (v === '' && c.type === 'color')) continue;
    if (c.type === 'range') { const n = num(v); if (!isFinite(n)) return `${name} must be a number.`; if ((c.min != null && n < c.min) || (c.max != null && n > c.max)) return `${name} must be ${c.min ?? '...'}-${c.max ?? '...'}.`; }
    else if (c.type === 'toggle') { if (typeof v !== 'boolean') return `${name} must be on or off.`; }
    else if (c.type === 'select') { const val = c.size && v && typeof v === 'object' ? `${v.width}x${v.height}` : v; if (c.options?.length && !c.options.some(o => String(o.value) === String(val))) return `${name}: unknown choice.`; }
    else if (c.type === 'color') { if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) return `${name} must be a colour like #e6007e.`; }
  }
  return null;
}

// ---------- a pure reader for an engine's `export const DEFAULTS = { ... }` (port of src/main/literal.ts) ----------
// Never runs anything: numbers, strings, booleans, null, arrays and nested objects (comments, trailing commas, unquoted
// keys); any other value (a call, a variable, arithmetic, a spread) is unknown and that key is skipped.
const UNKNOWN = Symbol('unknown'), ID_START = /[A-Za-z_$]/, ID_PART = /[\w$]/;
class LiteralReader {
  constructor(s, at) { this.s = s; this.i = at; this.depth = 0; }
  fail() { throw new Error('not a literal'); }
  ws() { const s = this.s; for (;;) { while (this.i < s.length && /\s/.test(s[this.i])) this.i++;
    if (s.startsWith('//', this.i)) { const e = s.indexOf('\n', this.i); this.i = e < 0 ? s.length : e + 1; continue; }
    if (s.startsWith('/*', this.i)) { const e = s.indexOf('*/', this.i + 2); if (e < 0) this.fail(); this.i = e + 2; continue; }
    return; } }
  value() {
    this.ws(); const s = this.s, c = s[this.i];
    if (c === undefined) this.fail();
    if (c === '{') return this.object();
    if (c === '[') return this.array();
    if (c === '"' || c === "'") return this.string(c);
    if (c === '`') { const t = this.template(); return t === null ? UNKNOWN : t; }
    if (/[-+.\d]/.test(c)) { const n = this.number(); if (n !== null) return n; }
    if (ID_START.test(c)) {
      const w = this.word(), k = this.i; this.ws(); const after = s[this.i]; this.i = k;
      if (after === undefined || after === ',' || after === '}' || after === ']') { if (w === 'true') return true; if (w === 'false') return false; if (w === 'null') return null; if (w === 'undefined') return undefined; }
    }
    return UNKNOWN;
  }
  skip() { const s = this.s; let d = 0;
    while (this.i < s.length) { this.ws(); const c = s[this.i]; if (c === undefined) break;
      if (c === '"' || c === "'") { this.string(c); continue; } if (c === '`') { this.rawTemplate(); continue; }
      if (c === '(' || c === '[' || c === '{') { d++; this.i++; continue; }
      if (c === ')' || c === ']' || c === '}') { if (d === 0) return; d--; this.i++; continue; }
      if (c === ',' && d === 0) return; this.i++; }
    this.fail(); }
  object() { if (++this.depth > 64) this.fail(); const o = {}; this.i++;
    for (;;) { this.ws(); const s = this.s, c = s[this.i];
      if (c === '}') { this.i++; this.depth--; return o; } if (c === undefined) this.fail();
      let key = null;
      if (c === '"' || c === "'") key = this.string(c); else if (ID_START.test(c)) key = this.word(); else if (/\d/.test(c)) { const n = this.number(); key = n === null ? null : String(n); }
      this.ws();
      if (key === null || s[this.i] !== ':') this.skip();
      else { this.i++; const start = this.i, v = this.value();
        if (v === UNKNOWN) { this.i = start; this.skip(); }
        else { this.ws(); const nx = s[this.i]; if (nx !== ',' && nx !== '}') { this.i = start; this.skip(); } else if (v !== undefined && key !== '__proto__' && key !== 'constructor' && key !== 'prototype') o[key] = v; } }
      this.ws(); if (s[this.i] === ',') { this.i++; continue; } if (s[this.i] === '}') continue; this.fail(); } }
  array() { if (++this.depth > 64) this.fail(); const a = []; this.i++;
    for (;;) { this.ws(); const s = this.s; if (s[this.i] === ']') { this.i++; this.depth--; return a; } if (s[this.i] === undefined) this.fail();
      const start = this.i, v = this.value();
      if (v === UNKNOWN) { this.i = start; this.skip(); } else { this.ws(); const nx = s[this.i]; if (nx !== ',' && nx !== ']') { this.i = start; this.skip(); } else a.push(v); }
      this.ws(); if (s[this.i] === ',') { this.i++; continue; } if (s[this.i] === ']') continue; this.fail(); } }
  word() { const s = this.s, b = this.i; this.i++; while (this.i < s.length && ID_PART.test(s[this.i])) this.i++; return s.slice(b, this.i); }
  number() {
    const m = /^[-+]?(0[xX][0-9a-fA-F_]+|(\d[\d_]*\.?[\d_]*|\.\d[\d_]*)([eE][-+]?\d+)?)/.exec(this.s.slice(this.i, this.i + 64)); if (!m) return null;
    const t = m[0].replace(/_/g, ''), neg = t.startsWith('-'), body = t.replace(/^[-+]/, ''), n = /^0[xX]/.test(body) ? parseInt(body.slice(2), 16) : Number(body);
    if (Number.isNaN(n)) return null; this.i += m[0].length; return neg ? -n : n; }
  string(q) { const s = this.s; let out = ''; this.i++;
    while (this.i < s.length) { const c = s[this.i++]; if (c === q) return out; if (c === '\n') this.fail(); if (c !== '\\') { out += c; continue; }
      const e = s[this.i++]; out += e === 'n' ? '\n' : e === 't' ? '\t' : e; }
    this.fail(); }
  template() { const s = this.s, b = this.i; let out = ''; this.i++;
    while (this.i < s.length) { const c = s[this.i++]; if (c === '`') return out; if (c === '$' && s[this.i] === '{') { this.i = b; return null; } if (c === '\\') { const e = s[this.i++]; out += e === 'n' ? '\n' : e; continue; } out += c; }
    this.fail(); }
  rawTemplate() { const s = this.s; this.i++; let d = 0;
    while (this.i < s.length) { const c = s[this.i++]; if (c === '\\') { this.i++; continue; } if (d === 0 && c === '`') return; if (c === '$' && s[this.i] === '{') { d++; this.i++; continue; } if (d > 0 && c === '}') d--; }
    this.fail(); }
}
/** The object literal of `export const <name> = { ... }` in an engine's text (undefined when absent or unreadable). */
export function exportedObject(src, name) {
  const m = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\{`).exec(src || ''); if (!m) return undefined;
  try { const r = new LiteralReader(src, m.index + m[0].length - 1), v = r.value(); return isObj(v) ? v : undefined; } catch { return undefined; }
}
/** Every leaf path of a plain object ('post.vignette' -> .16); arrays and null are leaves. */
export function leafPaths(o, pre = '', out = {}) { for (const [k, v] of Object.entries(o ?? {})) { const p = pre ? `${pre}.${k}` : k; if (isObj(v) && Object.keys(v).length) leafPaths(v, p, out); else out[p] = v; } return out; }
/** The value at a dotted path, and whether some prefix of it is set to a non-object (which hides everything below). */
export function settingAt(o, p) { let v = o; const ks = p.split('.'); for (let i = 0; i < ks.length; i++) { if (!isObj(v)) return { set: false }; if (!(ks[i] in v)) return { set: false }; v = v[ks[i]]; if (i < ks.length - 1 && !isObj(v)) return { set: true, value: v, at: ks.slice(0, i + 1).join('.') }; } return { set: true, value: v, at: p }; }

/** Stick figure base: a project starts with the built-in characters (the narrator) in assets/sprites/ + its index.json,
 *  like the app's stickman.ts seedSprites, so the first scenes draw before anything is made. */
export function seedStickmanSprites(dir) {
  const from = path.join(baseDir('stickman'), 'engine', 'sprites'), to = path.join(dir, 'assets', 'sprites');
  const idx = readJson(path.join(from, 'index.json'), {}) || {}, out = {};
  for (const [id, c] of Object.entries(idx)) {
    out[id] = { ...c, lib: id, sprites: {} };
    for (const [k, e] of Object.entries(c.sprites || {})) {
      const s = path.join(from, id, e.file), d = path.join(to, id, e.file);
      if (!exists(s)) continue; fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); out[id].sprites[k] = e;
    }
  }
  writeJson(path.join(to, 'index.json'), out, 1);
}

/** A style's project.json, style.json and views. */
export function readStyle(name) {
  const dir = styleDir(name);
  if (!NAME_RX.test(name) || !exists(path.join(dir, 'project.json'))) throw new Error(`There is no style "${name}" in styles/ (cz list shows them; cz new <name> --base <base> makes one).`);
  const pj = readJson(path.join(dir, 'project.json'), null); if (!pj) throw new Error(`styles/${name}/project.json is not valid JSON.`);
  const sj = readJson(path.join(dir, 'style.json'), null); if (!sj) throw new Error(`styles/${name}/style.json is missing or not valid JSON.`);
  const views = pj.views && typeof pj.views === 'object' ? pj.views : {};
  return { dir, pj, sj, views, base: sj.base, aspects: Array.isArray(sj.aspects) && sj.aspects.length ? sj.aspects : ['16:9'] };
}
export const isMustFail = (n, v) => !!v?.expect || /^mustfail/i.test(n);
export const aspectTag = a => a.replace(':', 'x');
/** Frame size in pixels for an aspect (the engines' FW x FH). */
export const sizeOf = a => a === '9:16' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
