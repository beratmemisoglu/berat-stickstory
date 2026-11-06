#!/usr/bin/env node
// Toon Studio Style Kit generator: writes a kit folder from an app's templates, so the kit always matches the installed
// app's engines. The app runs it from Styles > Get the Style Kit; it also runs standalone:
//   node make-kit.mjs --templates <app templates dir> --out <folder> [--bases-info <json file>] [--app-version x.y.z] [--runtime <app exe>]
// Re-running on an existing kit refreshes tools/, host/, bases/, LICENSES/, docs and kit.json; styles/, dist/ and refs/
// are never touched.
// Never copied: the Mixamo Y Bot (recon assets/figures/mixamo_mannequin.glb), the low-poly library and the host's script
// fonts (both served read-only from the app), __pycache__.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');     // templates/stylekit
const BASES = { 'pixel-art': ['engine', 'pixel-explainer-video'], collage: ['collage', 'vox-collage-video'], flat: ['flat', 'flat-explainer-video'],
  stickman: ['stickman', 'stickman-explainer'], recon: ['recon', 'recon-reconstruction'], lowpoly: ['lowpoly', 'lowpoly-shorts'], starter: ['starter', 'studio-starter'] };
const ENGINE_PARTS = ['engine.js', 'models.js', 'lib', 'fonts', 'vendor', 'sprites', 'assets/figures', 'character.js', 'assets/anims/builtin.json', 'assets/anims/quality.json'];
const NEVER = /(^|\/)(__pycache__|\.DS_Store|Thumbs\.db)$|mixamo_mannequin\.glb$/i;
const TEXT = /\.(m?js|json|md|txt|csv|svg|html|py|sh)$/i;

/** `overrides`: { <base>: <another templates folder> } takes that base's engine, skill and samples from there (the
 *  compatibility gate: an older engine version from git history next to this app's host); `only`: the bases to write. */
export async function makeKit({ templates, out, basesInfo = null, appVersion = null, runtime = null, force = false, overrides = {}, only = null, log = console.log }) {
  const T = path.resolve(templates), OUT = path.resolve(out);
  if (!fs.existsSync(path.join(T, 'host', 'host.js'))) throw new Error(`${T} is not the app's templates folder (no host/host.js).`);
  if (fs.existsSync(OUT) && fs.readdirSync(OUT).length && !fs.existsSync(path.join(OUT, 'kit.json')) && !force) throw new Error(`${OUT} is not empty and is not a Style Kit: pick an empty folder.`);
  fs.mkdirSync(OUT, { recursive: true });
  let files = 0;
  const copy = (src, dst, { lf = true, skip = null } = {}) => {
    const st = fs.lstatSync(src);
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) { for (const e of fs.readdirSync(src)) { const s = path.join(src, e), rel = s.slice(T.length + 1).replace(/\\/g, '/'); if (NEVER.test(rel) || NEVER.test(e) || skip?.(s)) continue; copy(s, path.join(dst, e), { lf, skip }); } return; }
    if (!st.isFile() || NEVER.test(src.replace(/\\/g, '/'))) return;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (lf && TEXT.test(src)) fs.writeFileSync(dst, fs.readFileSync(src, 'utf8').replace(/\r\n?/g, '\n')); else fs.copyFileSync(src, dst);
    files++;
  };
  const fresh = d => { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); };

  // tools + schema (+ the docs, CLAUDE.md and README when this app has them)
  fresh(path.join(OUT, 'tools'));
  copy(path.join(SRC, 'tools'), path.join(OUT, 'tools'));
  for (const f of ['style.schema.json', 'CLAUDE.md', 'README.md', 'TERMS.md', 'Toon Studio Style Kit Guide.pdf']) if (fs.existsSync(path.join(SRC, f))) copy(path.join(SRC, f), path.join(OUT, f));
  // docs/ (read only for the member: refreshed whole), without docs/shots (the guide PDF's pictures, already in the PDF)
  if (fs.existsSync(path.join(SRC, 'docs'))) { fresh(path.join(OUT, 'docs')); copy(path.join(SRC, 'docs'), path.join(OUT, 'docs'), { skip: s => /[\\/]docs[\\/]shots$/.test(s) }); }
  // the Studio's output templates and each base's extension points, unless the kit docs bring their own
  if (!fs.existsSync(path.join(OUT, 'docs', 'templates')) && fs.existsSync(path.join(T, 'studio', 'templates'))) copy(path.join(T, 'studio', 'templates'), path.join(OUT, 'docs', 'templates'));
  for (const b of Object.keys(BASES)) { const s = path.join(T, 'studio', 'bases', b); if (fs.existsSync(s) && !fs.existsSync(path.join(OUT, 'docs', 'bases', b))) copy(s, path.join(OUT, 'docs', 'bases', b)); }

  // host page (without the 14 MB of script fonts: served from the app)
  fresh(path.join(OUT, 'host'));
  copy(path.join(T, 'host'), path.join(OUT, 'host'), { lf: false, skip: s => /[\\/]fonts[\\/]script$/.test(s) });

  // bases: engine, skill, samples (copy-map files resolved), look.json
  const info = basesInfo ? JSON.parse(fs.readFileSync(basesInfo, 'utf8')) : {};
  const engines = {};
  fresh(path.join(OUT, 'bases'));
  for (const [b, [eng, skill]] of Object.entries(BASES)) {
    if (only && !only.includes(b)) continue;
    const TB = overrides?.[b] ? path.resolve(overrides[b]) : T;   // where this base's engine, skill and samples come from
    const bd = path.join(OUT, 'bases', b), ed = path.join(TB, eng);
    if (!fs.existsSync(path.join(ed, 'engine.js'))) { log(`  (skipped ${b}: no templates/${eng}/engine.js)`); continue; }
    for (const part of ENGINE_PARTS) if (fs.existsSync(path.join(ed, part))) copy(path.join(ed, part), path.join(bd, 'engine', part));
    const v = /^export const ENGINE_VERSION = (\d+)/m.exec(fs.readFileSync(path.join(ed, 'engine.js'), 'utf8'));
    engines[b] = v ? +v[1] : 0;
    // the base skill's docs only (engine API, pitfalls, quality): never its pipeline scripts (audio prep, transcription,
    // alignment, sound design, mixing, renderers) - those are the app's, a style does not need them
    if (fs.existsSync(path.join(TB, 'skill', skill))) copy(path.join(TB, 'skill', skill), path.join(bd, 'skill'), { skip: s => /[\\/](evals|scripts|assets|__pycache__)$/.test(s) || (/\.(py|sh|ps1|cmd|bat|mjs|cjs|js|exe)$/i.test(s) && fs.statSync(s).isFile()) });
    const sd = path.join(TB, 'studio', 'samples', b);
    if (fs.existsSync(sd)) {
      copy(sd, path.join(bd, 'samples'));
      for (const vf of [path.join(bd, 'samples', 'views.json'), path.join(bd, 'samples', '2d', 'views.json'), path.join(bd, 'samples', '3d', 'views.json')]) {
        if (!fs.existsSync(vf)) continue;
        const vj = JSON.parse(fs.readFileSync(vf, 'utf8')), sub = path.dirname(vf);
        for (const [to, from] of Object.entries(vj.copy ?? {})) {
          const own = path.resolve(TB, String(from)), s = fs.existsSync(own) ? own : path.resolve(T, String(from)), d = path.resolve(sub, String(to));
          if (!(s.startsWith(TB + path.sep) || s.startsWith(T + path.sep)) || !d.startsWith(path.join(sub, 'assets') + path.sep) || !fs.existsSync(s)) { log(`  (sample copy skipped: ${to})`); continue; }
          copy(s, d);
        }
        delete vj.copy; fs.writeFileSync(vf, JSON.stringify(vj, null, 1) + '\n');
      }
    }
    const bi = info[b] ?? {};
    fs.writeFileSync(path.join(bd, 'look.json'), JSON.stringify({ id: bi.id ?? bi.defaultLook ?? null, name: bi.name ?? null, settings: bi.settings ?? {}, controls: bi.controls ?? [], looks: bi.looks ?? {} }, null, 1) + '\n');
  }

  // licences
  const L = path.join(OUT, 'LICENSES'); fresh(L);
  fs.writeFileSync(path.join(L, 'three.js-MIT.txt'), 'The MIT License\n\nCopyright © 2010-2024 three.js authors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in\nall copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\nTHE SOFTWARE.\n\n(three.js: vendor/three.module.js and vendor/jsm in every base engine.)\n');
  const ofl = ['jp', 'kr', 'sc', 'thai', 'deva'].map(d => path.join(T, 'host', 'fonts', 'script', d, 'OFL.txt')).find(f => fs.existsSync(f));
  if (ofl) { const t = fs.readFileSync(ofl, 'utf8').replace(/\r\n?/g, '\n'), at = t.indexOf('This Font Software is licensed'); fs.writeFileSync(path.join(L, 'OFL-1.1.txt'), 'SIL OPEN FONT LICENSE Version 1.1 - the licence of the fonts in host/fonts and the bases\' fonts/ folders (Inter, JetBrains Mono, Orbitron, Share Tech Mono, Playfair Display, EB Garamond, ...).\n\n' + (at >= 0 ? t.slice(at) : t)); }
  fs.writeFileSync(path.join(L, 'Apache-2.0-SpecialElite.txt'), 'Special Elite (host/fonts/special-elite-*.woff2) by Astigmatic is licensed under the Apache License, Version 2.0.\nYou may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0\n');
  for (const f of ['host/fonts/FONTS-LICENSE.txt', 'collage/fonts/FONTS-LICENSE.txt', 'studio/fonts/LICENSES.md', 'recon/assets/figures/CREDITS.json']) if (fs.existsSync(path.join(T, f))) copy(path.join(T, f), path.join(L, f.replace(/\//g, '__')));
  fs.writeFileSync(path.join(L, 'README.txt'), 'Licences of what the kit ships: three.js (MIT), the fonts (SIL OFL 1.1; Special Elite: Apache-2.0) and the base assets (the CREDITS.json files).\nNot shipped: the Mixamo Y Bot of 3D reconstruction (Mixamo\'s licence forbids redistributing it; the kit uses the installed app\'s copy and a package never carries it), the low-poly library and the script fonts (both read from the installed app).\n');

  // the Library's built-in entries (served at __library/ when the app is gone)
  if (fs.existsSync(path.join(T, 'library'))) { fresh(path.join(OUT, 'shared', 'library')); copy(path.join(T, 'library'), path.join(OUT, 'shared', 'library'), { lf: false }); }

  // kit.json + wrappers
  const hostSha = crypto.createHash('sha1').update(fs.readFileSync(path.join(T, 'host', 'host.js'))).digest('hex');
  const kitJson = { kit: 1, app: appVersion ?? 'dev', host: hostSha, engines, appTemplates: T, runtime: runtime ? path.resolve(runtime) : null, generated: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT, 'kit.json'), JSON.stringify(kitJson, null, 1) + '\n');
  const rt = kitJson.runtime ?? '';
  fs.writeFileSync(path.join(OUT, 'cz.cmd'), ['@echo off', 'rem Toon Studio Style Kit: runs tools\\cz.mjs with Node 22+ when it is installed, else with the Toon Studio app as Node.',
    'setlocal', 'set "KIT=%~dp0"',
    'where node >nul 2>nul || goto runtime',
    'node -e "process.exit(+process.versions.node.split(\'.\')[0]>=22?0:1)" >nul 2>nul || goto runtime',
    'node "%KIT%tools\\cz.mjs" %*', 'exit /b %ERRORLEVEL%',
    ':runtime', `set "RT=${rt.replace(/%/g, '%%')}"`, 'if "%RT%"=="" goto none', 'if not exist "%RT%" goto none',
    'set "ELECTRON_RUN_AS_NODE=1"', '"%RT%" "%KIT%tools\\cz.mjs" %*', 'exit /b %ERRORLEVEL%',
    ':none', 'echo cz needs Node.js 22 or newer, or the Toon Studio app. Install Node from nodejs.org, or get the kit again from Toon Studio (Styles ^> Get the Style Kit). 1>&2',
    'exit /b 1', ''].join('\r\n'));
  const q = s => `'${String(s).replace(/'/g, `'\\''`)}'`;
  fs.writeFileSync(path.join(OUT, 'cz'), ['#!/bin/sh', '# Toon Studio Style Kit: runs tools/cz.mjs with Node 22+ when it is installed, else with the Toon Studio app as Node.',
    'KIT="$(cd "$(dirname "$0")" && pwd)"',
    'if command -v node >/dev/null 2>&1 && node -e "process.exit(+process.versions.node.split(\'.\')[0]>=22?0:1)" >/dev/null 2>&1; then',
    '  exec node "$KIT/tools/cz.mjs" "$@"', 'fi',
    `RT=${q(rt)}`,
    '# (Git Bash on Windows: the app path is a Windows path; cygpath makes it one the shell can test and run)',
    'if [ -n "$RT" ] && command -v cygpath >/dev/null 2>&1; then RT="$(cygpath -u "$RT")"; fi',
    'if [ -n "$RT" ] && [ -f "$RT" ]; then', '  ELECTRON_RUN_AS_NODE=1 exec "$RT" "$KIT/tools/cz.mjs" "$@"', 'fi',
    'echo "cz needs Node.js 22 or newer, or the Toon Studio app. Install Node from nodejs.org, or get the kit again from Toon Studio (Styles > Get the Style Kit)." >&2',
    'exit 1', ''].join('\n'));
  try { fs.chmodSync(path.join(OUT, 'cz'), 0o755); } catch { /* Windows */ }
  for (const d of ['styles', 'dist', 'refs']) fs.mkdirSync(path.join(OUT, d), { recursive: true });   // refs/: the member's reference videos and pictures (never packaged)
  log(`Style Kit written to ${OUT}: ${files} files, bases ${Object.entries(engines).map(([b, v]) => `${b} v${v}`).join(', ')}`);
  return { out: OUT, kit: kitJson, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  // --override <base>=<templates folder> (repeatable), --only <base,base>
  const overrides = {}; a.forEach((x, i) => { if (x === '--override' && a[i + 1]?.includes('=')) { const [b, ...d] = a[i + 1].split('='); overrides[b] = d.join('='); } });
  if (!opt('--templates') || !opt('--out')) { console.error('usage: node make-kit.mjs --templates <app templates dir> --out <folder> [--bases-info <json>] [--app-version x] [--runtime <exe>] [--force] [--only <base,...>] [--override <base>=<templates dir>]'); process.exitCode = 2; }
  else makeKit({ templates: opt('--templates'), out: opt('--out'), basesInfo: opt('--bases-info'), appVersion: opt('--app-version'), runtime: opt('--runtime'), force: a.includes('--force'), overrides, only: opt('--only') ? opt('--only').split(',') : null })
    .catch(e => { console.error(`make-kit: ${e.message}`); process.exitCode = 1; });
}
