// Low-poly asset library: index, search, add, verify, credits.
// Node >= 18, no dependencies.  Used by the build tools and by future Claude runs to save new finds.
//
//   import * as lib from './tools/lib.mjs'
//   const idx = lib.loadIndex()                      // { dir, entries, credits }
//   lib.search({ query: 'dog walk', kind: 'animal' })  // ranked entries
//   lib.add({ id, kind, name, tags, licence, author, source_url, ... }, 'path/to/file.glb')
//   lib.verify()                                     // [] when everything is fine
//   lib.creditsFor(['char.mannequin_m', 'prop.kenney.desk'])  // text for a video description
//
// CLI:  node tools/lib.mjs search <words...> [--kind=prop] [--tag=casino]
//       node tools/lib.mjs verify
//       node tools/lib.mjs credits <id...>
//       node tools/lib.mjs add <entry.json> <file>      (entry.json = one index entry without hash/file)
//       node tools/lib.mjs stats
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const LIB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KINDS = ['character', 'animation', 'animal', 'prop', 'set', 'texture', 'vehicle'];
// Licences we accept. CC-BY needs credit_text. Anything else (NC, ND, SA, "free for personal use", Mixamo, unknown) is rejected.
export const LICENCES = { 'CC0-1.0': { credit: false }, 'PD': { credit: false }, 'CC-BY-3.0': { credit: true }, 'CC-BY-4.0': { credit: true }, 'OWN-CC0': { credit: false } };

const idxPath = dir => path.join(dir, 'index.json');
const credPath = dir => path.join(dir, 'CREDITS.json');
export function sha256File(f) { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }

export function loadIndex(dir = LIB_DIR) {
  const entries = fs.existsSync(idxPath(dir)) ? JSON.parse(fs.readFileSync(idxPath(dir), 'utf8')).entries : [];
  const credits = fs.existsSync(credPath(dir)) ? JSON.parse(fs.readFileSync(credPath(dir), 'utf8')).credits : [];
  return { dir, entries, credits };
}

function save(idx) {
  idx.entries.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  fs.writeFileSync(idxPath(idx.dir), JSON.stringify({ version: 1, about: 'Toon Studio low-poly asset library. See README.txt. Edit only through tools/lib.mjs.', count: idx.entries.length, entries: idx.entries }, null, 1));
  // credits are always rebuilt from the entries (one line per author + source + licence)
  const map = new Map();
  for (const e of idx.entries) {
    const key = `${e.author}|${e.licence}|${e.source_url}`;
    if (!map.has(key)) map.set(key, { author: e.author, licence: e.licence, source_url: e.source_url, credit_text: e.credit_text, required: !!LICENCES[e.licence]?.credit, ids: [] });
    map.get(key).ids.push(e.id);
  }
  idx.credits = [...map.values()].sort((a, b) => (b.required - a.required) || a.author.localeCompare(b.author));
  fs.writeFileSync(credPath(idx.dir), JSON.stringify({ about: 'Credits for every library asset. required=true (CC-BY): the credit_text MUST appear in the description of any video that uses the asset. CC0: credit is optional but kind.', credits: idx.credits }, null, 1));
}

const norm = s => String(s || '').toLowerCase();
/** search({query, tags, kind, limit}) -> entries ranked by match */
export function search({ query = '', tags = [], kind, limit = 50 } = {}, idx = loadIndex()) {
  const words = norm(query).split(/[\s,]+/).filter(Boolean);
  const out = [];
  for (const e of idx.entries) {
    if (kind && e.kind !== kind) continue;
    if (tags.length && !tags.every(t => e.tags.map(norm).includes(norm(t)))) continue;
    const hay = [e.id, e.name, ...(e.tags || []), ...(e.animations || []).map(a => a.name || a)].map(norm).join(' ');
    let score = 0;
    for (const w of words) { if (e.tags?.map(norm).includes(w)) score += 3; else if (norm(e.name).includes(w)) score += 2; else if (hay.includes(w)) score += 1; else { score = -1; break; } }
    if (score >= 0) out.push({ score, e });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.e);
}
export const get = (id, idx = loadIndex()) => idx.entries.find(e => e.id === id);

function check(e) {
  const errs = [];
  for (const k of ['id', 'kind', 'name', 'tags', 'licence', 'author', 'source_url']) if (e[k] == null || e[k] === '') errs.push(`missing ${k}`);
  if (e.kind && !KINDS.includes(e.kind)) errs.push(`bad kind ${e.kind}`);
  if (e.licence && !LICENCES[e.licence]) errs.push(`licence not allowed: ${e.licence}`);
  if (LICENCES[e.licence]?.credit && !e.credit_text) errs.push('CC-BY needs credit_text');
  if (e.id && !/^[a-z0-9_.-]+$/.test(e.id)) errs.push('id must be [a-z0-9_.-]');
  return errs;
}

/**
 * add(entry, srcFile, {dir, overwrite, relPath}) -> stored entry.
 * Copies srcFile into the library (default <kind>s/<id>.<ext>), hashes it, appends to index.json, rebuilds CREDITS.json.
 * If an entry with the same hash already exists, nothing is copied and the existing entry is returned (no re-downloads).
 */
export function add(entry, srcFile, { dir = LIB_DIR, overwrite = false, relPath } = {}) {
  const idx = loadIndex(dir);
  const e = { added: new Date().toISOString().slice(0, 10), ...entry };
  const errs = check(e); if (errs.length) throw new Error(`add ${e.id}: ${errs.join('; ')}`);
  if (srcFile) {
    const hash = sha256File(srcFile);
    const dupe = idx.entries.find(x => x.hash === 'sha256:' + hash && x.id !== e.id);
    if (dupe) return dupe;
    const rel = (relPath || e.file || `${e.kind}s/${e.id}${path.extname(srcFile)}`).replace(/\\/g, '/');
    const dst = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (path.resolve(srcFile) !== path.resolve(dst)) fs.copyFileSync(srcFile, dst);
    e.file = rel; e.hash = 'sha256:' + hash; e.bytes = fs.statSync(dst).size;
  } else if (!e.remote) throw new Error(`add ${e.id}: no file and no remote`);
  const i = idx.entries.findIndex(x => x.id === e.id);
  if (i >= 0 && !overwrite) throw new Error(`add ${e.id}: id exists (pass overwrite)`);
  if (i >= 0) idx.entries[i] = e; else idx.entries.push(e);
  save(idx);
  return e;
}

export function remove(id, { dir = LIB_DIR, deleteFile = true } = {}) {
  const idx = loadIndex(dir);
  const e = idx.entries.find(x => x.id === id); if (!e) return false;
  idx.entries = idx.entries.filter(x => x.id !== id);
  if (deleteFile && e.file && !idx.entries.some(x => x.file === e.file)) fs.rmSync(path.join(dir, e.file), { force: true });
  save(idx); return true;
}

/** verify() -> list of problems ([] = ok): files exist, hashes match, licences allowed, credits present, no orphan files. */
export function verify(dir = LIB_DIR) {
  const idx = loadIndex(dir); const probs = [];
  const ids = new Set();
  for (const e of idx.entries) {
    if (ids.has(e.id)) probs.push(`${e.id}: duplicate id`); ids.add(e.id);
    for (const m of check(e)) probs.push(`${e.id}: ${m}`);
    if (e.file) {
      const f = path.join(dir, e.file);
      if (!fs.existsSync(f)) probs.push(`${e.id}: file missing ${e.file}`);
      else if (e.hash && 'sha256:' + sha256File(f) !== e.hash) probs.push(`${e.id}: hash mismatch ${e.file}`);
    } else if (!e.remote?.url) probs.push(`${e.id}: no file and no remote url`);
    if (e.kind === 'animation' && e.skeleton && !idx.entries.some(c => c.kind === 'character' && c.skeleton === e.skeleton)) probs.push(`${e.id}: no character with skeleton ${e.skeleton}`);
  }
  const known = new Set(idx.entries.map(e => e.file).filter(Boolean));
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(x => x.isDirectory() ? walk(path.join(d, x.name)) : [path.join(d, x.name)]);
  for (const sub of ['characters', 'animations', 'animals', 'props', 'sets', 'textures', 'vehicles']) {
    const d = path.join(dir, sub); if (!fs.existsSync(d)) continue;
    for (const f of walk(d)) { const rel = path.relative(dir, f).replace(/\\/g, '/'); if (!known.has(rel)) probs.push(`orphan file not in index: ${rel}`); }
  }
  return probs;
}

/** Text block for a video description: required (CC-BY) credits first, then CC0 thanks. */
export function creditsFor(ids, idx = loadIndex()) {
  const use = idx.entries.filter(e => ids.includes(e.id));
  const req = new Map(), thanks = new Set();
  for (const e of use) { if (LICENCES[e.licence]?.credit) req.set(e.credit_text, true); else if (e.licence !== 'OWN-CC0') thanks.add(e.author); }
  const lines = [...req.keys()];
  if (thanks.size) lines.push(`Free CC0 3D assets by ${[...thanks].join(', ')}.`);
  return lines.join('\n');
}

export function stats(idx = loadIndex()) {
  const by = {}; let bytes = 0;
  for (const e of idx.entries) { by[e.kind] = (by[e.kind] || 0) + 1; bytes += e.bytes || 0; }
  return { count: idx.entries.length, by, mb: +(bytes / 1048576).toFixed(1) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = Object.fromEntries(rest.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
  const args = rest.filter(a => !a.startsWith('--'));
  if (cmd === 'search') for (const e of search({ query: args.join(' '), kind: flags.kind, tags: flags.tag ? flags.tag.split(',') : [] })) console.log(`${e.id.padEnd(40)} ${e.kind.padEnd(10)} ${e.file || '(remote)'}  [${e.tags.join(', ')}]`);
  else if (cmd === 'verify') { const p = verify(); console.log(p.length ? p.join('\n') : 'OK ' + JSON.stringify(stats())); process.exitCode = p.length ? 1 : 0; }
  else if (cmd === 'credits') console.log(creditsFor(args));
  else if (cmd === 'add') console.log(add(JSON.parse(fs.readFileSync(args[0], 'utf8')), args[1]));
  else if (cmd === 'stats') console.log(stats());
  // the recorded sound effects (library/sfx/index.json, CC0 / public domain): search by words over category + tags
  else if (cmd === 'sfx') {
    const sx = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sfx', 'index.json'), 'utf8')).entries;
    const w = args.map(a => a.toLowerCase());
    for (const e of sx.filter(e => w.every(x => [e.category, ...e.tags].some(t => t.includes(x))))) console.log(`${e.id.padEnd(22)} ${String(e.duration).padStart(6)}s  ${e.licence.padEnd(13)} [${e.tags.join(', ')}]`);
  }
  else console.log('usage: node tools/lib.mjs search|verify|credits|add|stats|sfx ...');
}
