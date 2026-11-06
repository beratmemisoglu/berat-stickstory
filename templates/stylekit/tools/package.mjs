// Toon Studio Style Kit: a style folder (styles/<name>/, laid out like a project) -> a package (dist/<id>/ + dist/<id>.zip)
// exactly per docs/STYLE_KIT_PLAN.md section 1, and back (import-package: a package -> a style folder, for the round trip).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { KIT, DIST, STYLES, ENGINE_PARTS, BASE_KIND, BASE_NAME, readJson, writeJson, exists, copyTree, listFiles, readStyle, kitJson, baseDir, baseLook,
  controlsFor, validateByControls, deepMerge, formatOfAspect, settingsFor, NAME_RX, VIEW_RX, toLF, seedStickmanSprites, exportedObject, leafPaths, settingAt } from './kitlib.mjs';
import { staticCheck, MEANING, ALLOWED_EXT, packageRoot, skippedReason, engineVersionOf, exportNames, BASES } from './static.mjs';
const extOf = f => (/\.([^./]+)$/.exec(f)?.[1] ?? '').toLowerCase();
import { validateManifest, validateLookSchema } from './jsonschema.mjs';
import { readZip, writeZip } from './zip.mjs';

/** The static check's options in the kit (the app passes its zod validators and its own templates instead). */
export function kitStaticOpts(base) {
  const kj = kitJson();
  return {
    validateManifest,
    validateLook: (raw, manifest) => {
      const v = validateLookSchema(raw); if (!v.ok) return v;
      if (!manifest || !BASES.includes(manifest.base)) return { ok: true };
      const L = baseLook(manifest.base), aspects = Array.isArray(manifest.aspects) && manifest.aspects.length ? manifest.aspects : ['16:9'];
      const controls = controlsFor(L.controls, manifest.controls, aspects), def = deepMerge(lookOfDim(L, manifest.dim), manifest.defaults || {});
      // (a look that names its own format keeps it, so a format the style doesn't declare is reported, not papered over)
      const own = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
      const e = validateByControls({ ...def, ...own, format: own.format ?? formatOfAspect(aspects[0]) }, controls, aspects);
      return e ? { ok: false, why: e } : { ok: true };
    },
    baseEngineDir: base ? path.join(baseDir(base), 'engine') : undefined,
    baseSkillDir: base ? path.join(baseDir(base), 'skill') : undefined,
    baseSampleDir: base ? path.join(baseDir(base), 'samples') : undefined,
    baseEngineVersion: base ? kj.engines?.[base] : undefined,
    baseKind: base ? BASE_KIND[base] : undefined,
    baseName: base ? BASE_NAME[base] : undefined,
  };
}

/** The base look a style's settings start from: the base's default look, or for a starter style the look of its dim. */
const lookOfDim = (L, dim) => (dim ? Object.values(L.looks ?? {}).find(s => s && s.dim === dim) : null) ?? L.settings;

/** The engine DEFAULTS a style changed on keys the base look also sets: the look's value wins in every project, so the
 *  change never shows (the settings a project renders with are base look < style.json defaults < its look; the engine
 *  reads DEFAULTS only for keys none of them set). Medium "looks" findings, kit only. */
export function hiddenDefaults(dir, sj) {
  const base = sj.base, read = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
  const mine = exportedObject(read(path.join(dir, 'engine.js')), 'DEFAULTS');
  const theirs = exportedObject(read(path.join(dir, '.cz', 'base-engine', 'engine.js')) ?? read(path.join(baseDir(base), 'engine', 'engine.js')), 'DEFAULTS');
  if (!mine || !theirs) return [];
  const look = lookOfDim(baseLook(base), sj.dim), defaults = sj.defaults && typeof sj.defaults === 'object' ? sj.defaults : {}, out = [];
  const a = leafPaths(mine), b = leafPaths(theirs), same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  for (const [p, v] of Object.entries(a)) {
    if (!(p in b) || same(v, b[p])) continue;                     // new keys (a new switch) are read from DEFAULTS: fine
    const L = settingAt(look, p); if (!L.set || settingAt(defaults, p).set) continue;
    const want = p.split('.').reduceRight((acc, k) => ({ [k]: acc }), v);
    out.push({ id: 'looks', sev: 'medium', where: { file: 'engine.js' }, finding: `engine.js DEFAULTS.${p} is ${JSON.stringify(v)} (the base's: ${JSON.stringify(b[p])}), but the base's default look sets ${L.at} (${JSON.stringify(L.value)}), and a look beats DEFAULTS: this change is hidden by the look, no project ever shows it.`,
      meaning: 'The style looks different in its engine than in every video made with it.', fix: `Set it in style.json "defaults" instead (${JSON.stringify(want)}): those beat the base look. Keep engine DEFAULTS for keys no look sets (docs/METHOD.md stage 2).` });
  }
  return out;
}

// What the package copies: everything of the style's own folders except secrets / other tools' folders (left out, with a
// low finding). Files of a wrong type or Mixamo files ARE copied, so the static check refuses them by name: the member
// learns about them here, not at the import.
let leftOut = [];
const allowed = rel => { const why = skippedReason(rel); if (why) { leftOut.push(`${rel} (${why})`); return false; } return true; };
/** The base's own folders never carry a Mixamo file into a package (the kit has none; an app template might). */
const notMixamo = rel => !/mixamo|y[\s_-]?bot/i.test(rel);
/** A hash of the engine files of a style (ENGINE_PARTS, LF-normalised text). */
export function engineHash(dir) {
  const h = crypto.createHash('sha256');
  for (const part of ENGINE_PARTS) {
    const p = path.join(dir, part); if (!exists(p)) continue;
    const files = fs.statSync(p).isDirectory() ? listFiles(p).map(f => `${part}/${f}`) : [part];
    for (const f of files) { h.update(f + '\0'); const b = fs.readFileSync(path.join(dir, f)); h.update(/\.(m?js|json)$/.test(f) ? toLF(b.toString('utf8')) : b); }
  }
  return h.digest('hex');
}
/** A project.json "images" value -> its path under assets/ ('assets/a.png', 'a.png', './assets/x/b.jpg'), or null when it
 *  is not a plain relative path inside assets/. */
function imageRel(f) {
  if (typeof f !== 'string') return null;
  const r = f.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^assets\//, '');
  return r && !r.startsWith('/') && !/^[a-z]:/i.test(r) && !/[\0-\x1f]/.test(r) && !r.split('/').some(p => p === '' || p === '.' || p === '..') ? r : null;
}
const isFile = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const titleOf = n => String(n).split('-').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
/** QUALITY.md "## The bar" without the template's fill marks (publish.ts sectionText). */
function sectionText(md, head) {
  const out = []; let on = false;
  for (const l of md.replace(/\r/g, '').split('\n')) { const h = /^##\s+(.*)$/.exec(l); if (h) { on = head.test(h[1]); continue; } if (on) out.push(l); }
  return out.join('\n').replace(/_\(to fill\)_/g, '').trim();
}

/** The exports of the base engine a style was built on (its .cz/base-engine snapshot, else the kit's base): the app's
 *  contract check keeps these, not the exports a newer base engine added since. */
function builtOnExports(dir, base) {
  for (const f of [path.join(dir, '.cz', 'base-engine', 'engine.js'), path.join(baseDir(base), 'engine', 'engine.js')]) {
    try { return [...exportNames(fs.readFileSync(f, 'utf8'))].sort(); } catch { /* next */ }
  }
  return undefined;
}

/**
 * Assemble the package of styles/<name> into `outDir`/<id>/ (+ <id>.zip). `bump`: raise ENGINE_VERSION when the engine
 * changed since the last package (cz package). `preview`: make preview.mp4 + poster.jpg (needs browser + server).
 * Returns { id, dir, zip, findings, notes, engineVersion }.
 */
export async function assemble(name, { outDir = DIST, zip = true, bump = true, preview = true, browser = null, server = null, exportClip = null, log = () => {} } = {}) {
  const st = readStyle(name), notes = []; leftOut = [];
  const { dir, sj, pj, base } = st;
  if (!BASES.includes(base)) throw new Error(`styles/${name}/style.json "base" is "${base}": it must be one of ${BASES.join(', ')}.`);
  const id = String(sj.id || ''), pkgDir = path.join(outDir, /^custom-[a-z0-9-]{1,40}$/.test(id) ? id : `custom-${name}`);
  // ENGINE_VERSION: the app installs a re-import as a new version only when the engine's version rose with its content
  const lastF = path.join(dir, '.cz', 'last-package.json'), last = readJson(lastF, null), hash = engineHash(dir);
  const engF = path.join(dir, 'engine.js'); let engSrc = fs.readFileSync(engF, 'utf8'), ver = engineVersionOf(engSrc);
  if (bump && last && last.engineHash !== hash && ver != null && ver <= last.engineVersion) {
    const next = last.engineVersion + 1;
    engSrc = engSrc.replace(/^export const ENGINE_VERSION = \d+/m, `export const ENGINE_VERSION = ${next}`); fs.writeFileSync(engF, engSrc);
    notes.push(`The engine changed since the last package and ENGINE_VERSION was still ${ver}: raised it to ${next} in styles/${name}/engine.js (projects of this style are offered the update).`);
    ver = next;
  }
  fs.rmSync(pkgDir, { recursive: true, force: true }); fs.mkdirSync(pkgDir, { recursive: true });
  // style.json: the style's manifest + the kit block + from
  const kj = kitJson(), now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const prompts = { brief: '', build: '', context: '', qualityBar: '', reframe: '', imageStyle: '', ignoreBaseRefs: [], ...(sj.prompts && typeof sj.prompts === 'object' ? sj.prompts : {}) };
  if (!String(prompts.qualityBar || '').trim()) { try { prompts.qualityBar = sectionText(fs.readFileSync(path.join(dir, 'skill', 'QUALITY.md'), 'utf8'), /the bar/i).slice(0, 4000); } catch { /* none */ } }
  const from = sj.from && Number.isInteger(sj.from.engineVersion) ? { style: base, engineVersion: sj.from.engineVersion } : { style: base, engineVersion: kj.engines?.[base] ?? 0 };
  // `created` is the style's identity across versions (the app tells two members' styles with the same id apart by it):
  // set once when the style was made, never changed by a package (styles made before it existed: their cz new date)
  if (typeof sj.created !== 'string' || !sj.created) {
    sj.created = String(readJson(path.join(dir, '.cz', 'created.json'), null)?.at ?? now).replace(/\.\d+Z$/, 'Z');
    try { const own = readJson(path.join(dir, 'style.json'), null); if (own && !own.created) writeJson(path.join(dir, 'style.json'), { ...own, created: sj.created }); } catch { /* style.json unreadable: the static check says so */ }
  }
  const manifest = { ...sj, schema: 2, kind: 'style', base, from, version: Number.isInteger(sj.version) && sj.version > 0 ? sj.version : 1, prompts,
    kit: { kit: 1, app: String(kj.app ?? 'unknown'), host: String(kj.host ?? ''), base, baseEngine: from.engineVersion, built: now, baseExports: builtOnExports(dir, base) } };
  writeJson(path.join(pkgDir, 'style.json'), manifest);
  // engine/: the style's engine parts (else the base's), never a Mixamo file. A base file of a type packages may not hold
  // (3D reconstruction's lib/holdview.html, lib/propview.html: the app's own QA pages) stays out while the member left it
  // as it came: equal to the style's own base snapshot (.cz/base-engine, the engine it was built on) or to this kit's
  // base (a newer kit may have changed the app's copy since: that is not the member's change). Changed or new ones are
  // packaged, so the check names them.
  const ownBase = path.join(dir, '.cz', 'base-engine'), kitBase = path.join(baseDir(base), 'engine');
  const baseEngine = exists(path.join(ownBase, 'engine.js')) ? ownBase : kitBase;
  const sameText = (a, b) => { try { return toLF(fs.readFileSync(a, 'utf8')) === toLF(fs.readFileSync(b, 'utf8')); } catch { return false; } };
  const baseCopy = (part, r) => [ownBase, kitBase].some(B => sameText(path.join(B, part, r), path.join(dir, part, r)));
  for (const part of ENGINE_PARTS) {
    const src = exists(path.join(dir, part)) ? path.join(dir, part) : exists(path.join(baseEngine, part)) ? path.join(baseEngine, part) : null;
    if (src) { if (fs.statSync(src).isDirectory()) copyTree(src, path.join(pkgDir, 'engine', part), { filter: (r, d) => d || (src.startsWith(dir) ? allowed(r) && (ALLOWED_EXT.includes(extOf(r)) || !baseCopy(part, r)) : notMixamo(r) && ALLOWED_EXT.includes(extOf(r))) }); else { fs.mkdirSync(path.join(pkgDir, 'engine'), { recursive: true }); fs.copyFileSync(src, path.join(pkgDir, 'engine', part)); } }
  }
  // skill/ (the style's own docs) + skill/base/ (the base skill it was built on: .cz/base-skill, else the kit's base)
  if (exists(path.join(dir, 'skill'))) copyTree(path.join(dir, 'skill'), path.join(pkgDir, 'skill'), { filter: (r, d) => r !== 'base' && (d || allowed(r)) });
  const bskill = exists(path.join(dir, '.cz', 'base-skill')) ? path.join(dir, '.cz', 'base-skill') : path.join(baseDir(base), 'skill');
  if (exists(bskill)) copyTree(bskill, path.join(pkgDir, 'skill', 'base'), { filter: (r, d) => !/^evals(\/|$)/.test(r) && (d || /\.(md|json|txt)$/i.test(r)) });
  // looks/
  if (exists(path.join(dir, 'looks'))) copyTree(path.join(dir, 'looks'), path.join(pkgDir, 'looks'), { filter: (r, d) => d || /\.json$/i.test(r) });
  // sample/: the views, their scenes, the narration timing + script, the pictures they use
  const views = {}; for (const [n, v] of Object.entries(st.views)) if (VIEW_RX.test(n) && v && Array.isArray(v.scenes)) views[n] = { scenes: [...v.scenes], end: +v.end, ...(v.expect ? { expect: String(v.expect) } : {}) };
  // every scenes/*.js, not only the views' own: scenes import shared helper modules (recon's flight1549.js) that no view names
  if (exists(path.join(dir, 'scenes'))) copyTree(path.join(dir, 'scenes'), path.join(pkgDir, 'sample', 'scenes'), { filter: (r, d) => d || (/\.m?js$/i.test(r) && allowed(r)) });
  const tl = path.join(dir, pj.timeline || 'audio/timeline.json'); if (exists(tl)) fs.copyFileSync(tl, path.join(pkgDir, 'sample', 'timeline.json'));
  if (exists(path.join(dir, 'script.txt'))) fs.copyFileSync(path.join(dir, 'script.txt'), path.join(pkgDir, 'sample', 'script.txt'));
  if (exists(path.join(dir, 'assets'))) copyTree(path.join(dir, 'assets'), path.join(pkgDir, 'sample', 'assets'), { filter: (r, d) => r !== 'figures' && !r.startsWith('figures/') && (d || allowed(r)) });
  // project.json "images" (key -> picture; the host page loads only these, image() / IMG[] read them): the entries whose
  // picture is in the package, as "assets/<file>" (relative to sample/, the same form project.json uses)
  const images = {}, lost = [];
  for (const [k, f] of Object.entries(pj.images && typeof pj.images === 'object' && !Array.isArray(pj.images) ? pj.images : {})) {
    const rel = imageRel(f);
    if (typeof k === 'string' && k.length && k.length <= 80 && !/[\0-\x1f]/.test(k) && rel && isFile(path.join(pkgDir, 'sample', 'assets', rel))) images[k] = `assets/${rel}`;
    else lost.push(`${k} -> ${String(f).slice(0, 80)}`);
  }
  writeJson(path.join(pkgDir, 'sample', 'views.json'), { narration: { timeline: 'timeline.json', script: 'script.txt' }, views, images });
  // reference/ANALYSIS.md (never the member's reference files), CREDITS.json, FIXES.md
  if (exists(path.join(dir, 'reference', 'ANALYSIS.md'))) { fs.mkdirSync(path.join(pkgDir, 'reference'), { recursive: true }); fs.copyFileSync(path.join(dir, 'reference', 'ANALYSIS.md'), path.join(pkgDir, 'reference', 'ANALYSIS.md')); }
  const credits = readJson(path.join(dir, 'CREDITS.json'), []); writeJson(path.join(pkgDir, 'CREDITS.json'), Array.isArray(credits) ? credits : []);
  if (exists(path.join(dir, 'FIXES.md'))) fs.copyFileSync(path.join(dir, 'FIXES.md'), path.join(pkgDir, 'FIXES.md'));
  // preview.mp4 + poster.jpg from a short export of the sample (the wide frame when the style has one)
  if (preview && browser && server && exportClip) {
    const a = st.aspects.includes('16:9') ? '16:9' : st.aspects[0], tall = a === '9:16';
    try {
      const clip = await exportClip(name, { browser, server, view: views.sample ? 'sample' : Object.keys(views)[0], aspect: a, to: Math.min(8, +(views.sample?.end ?? 8)), out: path.join(dir, '.cz', 'preview_src.mp4'), log });
      const ff = args => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { windowsHide: true, encoding: 'utf8' }); if (r.status !== 0) throw new Error((r.stderr || '').trim().slice(-200)); };
      ff(['-i', clip.file, '-vf', tall ? 'scale=360:-2' : 'scale=640:-2', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(pkgDir, 'preview.mp4')]);
      ff(['-ss', '2.5', '-i', clip.file, '-frames:v', '1', '-vf', tall ? 'scale=360:-2' : 'scale=640:-2', '-q:v', '3', path.join(pkgDir, 'poster.jpg')]);
      fs.rmSync(clip.file, { force: true });
    } catch (e) { notes.push(`No preview video: ${e.message}`); }
  }
  // the zip (the package folder at its root)
  let zipFile = null;
  if (zip) {
    zipFile = path.join(outDir, `${path.basename(pkgDir)}.zip`);
    const entries = listFiles(pkgDir).map(r => ({ name: `${path.basename(pkgDir)}/${r}`, data: fs.readFileSync(path.join(pkgDir, r)) }));
    fs.writeFileSync(zipFile, writeZip(entries));
  }
  const findings = await staticCheck(pkgDir, kitStaticOpts(base));
  if (lost.length) findings.push({ id: 'sample', sev: 'medium', where: { file: 'project.json' }, finding: `${lost.length} project.json "images" entr${lost.length > 1 ? 'ies point' : 'y points'} at no picture under assets/ and ${lost.length > 1 ? 'were' : 'was'} left out of the package: ${lost.slice(0, 6).join('; ')}${lost.length > 6 ? ' ...' : ''}.`,
    meaning: 'A scene that shows that key draws a stand-in in the app (and the boot check fails there).', fix: 'Put the picture into the style\'s assets/ (with its CREDITS.json entry) and write its path as "assets/<file>", or remove the entry.' });
  findings.push(...hiddenDefaults(dir, sj));
  if (leftOut.length) findings.push({ id: 'files', sev: 'low', where: {}, finding: `${leftOut.length} file${leftOut.length > 1 ? 's were' : ' was'} left out of the package: ${leftOut.slice(0, 6).join('; ')}${leftOut.length > 6 ? ' ...' : ''}.`, meaning: MEANING.files, fix: 'Nothing to do if that is what you want; rename a file the style really needs (no key / secret / token in its name).' });
  if (bump) writeJson(lastF, { engineHash: engineHash(dir), engineVersion: ver, id: path.basename(pkgDir), at: now, zip: zipFile ? path.relative(KIT, zipFile) : null });   // (after a raise: the engine as packaged)
  return { id: path.basename(pkgDir), dir: pkgDir, zip: zipFile, findings, notes, engineVersion: ver };
}

/** A package (zip or folder) -> styles/<name>/ (the round trip: the app's fixes come back into the kit). The existing
 *  folder of that style moves to styles/.replaced/ first (only with `replace`). Returns { name, dir, findings, notes }. */
export async function importPackage(src, { replace = false, as = null } = {}) {
  const notes = []; let root = null, tmp = null;
  if (!exists(src)) throw new Error(`${src} does not exist.`);
  if (fs.statSync(src).isDirectory()) root = packageRoot(src);
  else {
    const files = readZip(fs.readFileSync(src));                       // refuses zip-slip, links, zip64, over-limit archives
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cz-import-'));
    for (const f of files) { const out = path.resolve(tmp, f.name); if (!out.startsWith(path.resolve(tmp) + path.sep)) throw new Error(`Refused ${f.name}: outside the package.`); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, f.data); }
    root = packageRoot(tmp);
  }
  try {
    const m = readJson(path.join(root, 'style.json'), null);
    if (!m) throw new Error('The package has no valid style.json.');
    if (!BASES.includes(m.base)) throw new Error(`The package's base "${m.base}" is not a built-in base.`);
    const findings = await staticCheck(root, kitStaticOpts(m.base));
    const name = as ?? String(m.id || '').replace(/^custom-/, '');
    if (!NAME_RX.test(name)) throw new Error(`"${name}" is not a usable style name (lowercase letters, digits, -): pass --as <name>.`);
    const dir = path.join(STYLES, name);
    if (exists(dir)) {
      if (!replace) throw new Error(`styles/${name} exists already. Run again with --replace (the current folder moves to styles/.replaced/) or --as <other-name>.`);
      const keep = path.join(STYLES, '.replaced', `${name}-${Date.now().toString(36)}`); fs.mkdirSync(path.dirname(keep), { recursive: true }); fs.renameSync(dir, keep);
      notes.push(`The previous styles/${name} moved to ${path.relative(KIT, keep)}.`);
    }
    fs.mkdirSync(dir, { recursive: true });
    const has = r => exists(path.join(root, r));
    if (has('engine')) copyTree(path.join(root, 'engine'), dir);
    if (has('skill')) copyTree(path.join(root, 'skill'), path.join(dir, 'skill'), { filter: r => r !== 'base' && !r.startsWith('base/') });
    if (has('skill/base')) copyTree(path.join(root, 'skill', 'base'), path.join(dir, '.cz', 'base-skill'));
    for (const d of ['looks', 'reference']) if (has(d)) copyTree(path.join(root, d), path.join(dir, d));
    if (has('sample/scenes')) copyTree(path.join(root, 'sample', 'scenes'), path.join(dir, 'scenes'));
    if (has('sample/assets')) copyTree(path.join(root, 'sample', 'assets'), path.join(dir, 'assets'));
    fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
    if (has('sample/timeline.json')) fs.copyFileSync(path.join(root, 'sample', 'timeline.json'), path.join(dir, 'audio', 'timeline.json'));
    if (has('sample/script.txt')) fs.copyFileSync(path.join(root, 'sample', 'script.txt'), path.join(dir, 'script.txt'));
    for (const f of ['CREDITS.json', 'FIXES.md']) if (has(f)) fs.copyFileSync(path.join(root, f), path.join(dir, f));
    // flat: the engine's models import the project's main character (never part of a package)
    if (m.base === 'flat' && !exists(path.join(dir, 'character.js')) && exists(path.join(baseDir('flat'), 'engine', 'character.js'))) fs.copyFileSync(path.join(baseDir('flat'), 'engine', 'character.js'), path.join(dir, 'character.js'));
    if (m.base === 'stickman' && !exists(path.join(dir, 'assets', 'sprites', 'index.json'))) seedStickmanSprites(dir);
    const { kit, ...sj } = m, now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    // --as: a copy is a different style (its own id, made now, version 1, none of the original's aliases); its looks
    // belong to the new id. Without --as the package keeps its identity (the round trip of the same style).
    const pkgId = String(m.id || ''), renamed = !!as && `custom-${name}` !== pkgId;
    if (renamed) {
      sj.id = `custom-${name}`.slice(0, 47); sj.created = now; delete sj.updated; sj.version = 1; delete sj.aliases; delete sj.official;
      if (!sj.name || sj.name === titleOf(pkgId.replace(/^custom-/, ''))) sj.name = titleOf(name);
      for (const f of exists(path.join(dir, 'looks')) ? fs.readdirSync(path.join(dir, 'looks')).filter(x => /\.json$/i.test(x)) : []) {
        const lf = path.join(dir, 'looks', f), lj = readJson(lf, null); if (lj && typeof lj === 'object') { lj.style = sj.id; writeJson(lf, lj); }
      }
      notes.push(`Imported as a new style: id ${sj.id} (the package was ${pkgId}), version 1, made ${now}; its looks now belong to ${sj.id}.`);
    }
    writeJson(path.join(dir, 'style.json'), sj);
    const vj = readJson(path.join(root, 'sample', 'views.json'), {}) ?? {}, views = vj.views ?? {};
    const first = views.sample ? 'sample' : Object.keys(views)[0];
    // the pictures the scenes use (sample/views.json "images", relative to sample/): only those that came with the package
    const images = {};
    for (const [k, f] of Object.entries(vj.images && typeof vj.images === 'object' && !Array.isArray(vj.images) ? vj.images : {})) { const rel = imageRel(f); if (rel && isFile(path.join(dir, 'assets', rel))) images[k] = `assets/${rel}`; else notes.push(`The picture "${k}" (${String(f).slice(0, 80)}) is not in the package: left out of project.json "images".`); }
    writeJson(path.join(dir, 'project.json'), { title: sj.name || name, style: sj.id, language: 'en', end: +(views[first]?.end ?? 0), timeline: 'audio/timeline.json', scenes: [...(views[first]?.scenes ?? [])], images,
      previewAudio: 'audio/clean.wav', settings: {}, views, view: first }, 1);
    const pjf = path.join(dir, 'project.json'), pj = readJson(pjf); pj.settings = settingsFor(dir, (sj.aspects ?? ['16:9'])[0]); writeJson(pjf, pj, 1);
    // the base engine snapshot cz rebase compares against: only when this kit's base engine is the one it was built on
    const kj = kitJson();
    if (kj.engines?.[m.base] === m.from?.engineVersion) copyTree(path.join(baseDir(m.base), 'engine'), path.join(dir, '.cz', 'base-engine'));
    else notes.push(`This kit's ${BASE_NAME[m.base] ?? m.base} engine is v${kj.engines?.[m.base]}, the package was built on v${m.from?.engineVersion}, and the kit has no copy of v${m.from?.engineVersion}: cz rebase will compare your engine with this kit's v${kj.engines?.[m.base]} directly (every difference listed; telling your changes from the base's is then up to you). If you have the style's old folder (styles/.replaced/), copy its .cz/base-engine/ back first: then cz rebase compares properly.`);
    writeJson(path.join(dir, '.cz', 'created.json'), { base: m.base, engineVersion: m.from?.engineVersion ?? null, importedFrom: path.basename(src), ...(renamed ? { copyOf: pkgId } : {}), at: new Date().toISOString() });
    writeJson(path.join(dir, '.cz', 'last-package.json'), { engineHash: engineHash(dir), engineVersion: engineVersionOf(exists(path.join(dir, 'engine.js')) ? fs.readFileSync(path.join(dir, 'engine.js'), 'utf8') : '') ?? 0, id: sj.id, at: new Date().toISOString(), imported: true });
    return { name, dir, findings, notes };
  } finally { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); }
}
