#!/usr/bin/env node
// Toon Studio Style Kit command line (run through the cz / cz.cmd wrappers). `cz help` lists the commands.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { KIT, STYLES, DIST, ENGINE_PARTS, BASE_ENGINE_PARTS, BASE_ENGINE_DIR, BASE_NAME, BASE_KIND, DIM_OF_BASE, NAME_RX, VIEW_RX, readJson, writeJson, exists, copyTree, listFiles,
  readStyle, kitJson, appTemplates, baseDir, baseLook, settingsFor, isMustFail, aspectTag, sha1, toLF, seedStickmanSprites, readLook, useLook } from './kitlib.mjs';
import { BASES, engineVersionOf, engineKindOf, exportNames, formatFindings, HOST_CONTRACT } from './static.mjs';
import { findBrowser, launch } from './cdp.mjs';
import { startServer } from './serve.mjs';
import { renderChecks, exportClip, openView, tool, probeVideo, KIT_EXPORT_MAX } from './checks.mjs';
import { assemble, importPackage } from './package.mjs';

const HELP = `Toon Studio Style Kit

  cz doctor                                   check the runtime, browser (H.264 + WebGL), ffmpeg and the app this kit came from
  cz new <name> --base <base> [--aspects 16:9,9:16] [--dim 2d|3d]
                                              start a style on a base (${BASES.join(', ')})
  cz list                                     your styles
  cz preview <style> [view] [--look <id>]     open the player (the app's real preview page) in your browser
  cz stills <style> <view> --times 1,3.5 [--aspect 9:16] [--scale .5] [--look <id>]
                                              PNG frames into styles/<style>/.cz/stills/
  cz check <style> [--views a,b] [--aspects 9:16] [--controls] [--no-export] [--look <id>] [--json]
                                              every check the app's import runs (exit code 1 on a high finding)
  cz export <style> [view] [--aspect 9:16] [--from 0] [--to 5] [--look <id>]
                                              an mp4 through the app's encoder path (styles/<style>/out/)
                                              --look <id>: render with looks/<id>.json over the style's settings
  cz package <style> [--no-preview]           dist/<id>/ + dist/<id>.zip, checked
  cz rebase <style> [--done]                  bring this kit's base engine next to yours to merge (then --done)
  cz import-package <zip|folder> [--replace] [--as <name>]
                                              a package (e.g. exported by the app after its fixes) back into styles/
`;

// ---------- args ----------
const argv = process.argv.slice(2), cmd = argv[0] || 'help', pos = [], flags = {};
const VALUED = new Set(['base', 'aspects', 'aspect', 'dim', 'times', 'scale', 'views', 'from', 'to', 'as', 'port', 'name', 'look']);
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); if (v !== undefined) flags[k] = v; else if (VALUED.has(k)) flags[k] = argv[++i]; else flags[k] = true; }
  else pos.push(a);
}
const say = (...a) => console.log(...a);
const fail = msg => { console.error(`cz ${cmd}: ${msg}`); process.exitCode = 1; };
const list = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const titleOf = n => n.split('-').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

/** A headless browser + the kit server for one command; always closed. */
async function withRender(f) {
  const server = await startServer();
  let browser = null;
  try { browser = await launch(); return await f({ browser, server }); }
  finally { if (browser) await browser.close().catch(() => {}); await server.close().catch(() => {}); }
}
/** --look <id>: the style's looks/<id>.json (its settings go over the style's for every render of this command). */
const lookOf = st => { if (flags.look == null) return null; if (flags.look === true || !String(flags.look).trim()) throw new Error('give the look: --look <id> (a file in looks/)'); return readLook(st.dir, String(flags.look)); };
/** The aspect a command renders: --aspect, else the look's own format when the style has it, else the style's first. */
const aspectOf = (st, lk) => flags.aspect ?? (lk?.aspect && st.aspects.includes(lk.aspect) ? lk.aspect : st.aspects[0]);
const baseAspects = base => {
  const fmt = baseLook(base).controls.find(c => c.path === 'format');
  if (fmt?.options?.length) return fmt.options.map(o => o.value === 'vertical' ? '9:16' : o.value === 'landscape' ? '16:9' : null).filter(Boolean);
  return base === 'pixel-art' || base === 'stickman' ? ['16:9'] : ['16:9', '9:16'];
};

// ---------- commands ----------
const commands = {
  help() { say(HELP); },

  async doctor() {
    let bad = 0; const ok = (good, text, fix) => { say(`${good ? 'ok  ' : 'FAIL'} ${text}`); if (!good) { bad++; if (fix) say(`     -> ${fix}`); } };
    const kj = kitJson();
    ok(+process.versions.node.split('.')[0] >= 22, `runtime: ${process.versions.electron ? `Toon Studio app (Electron ${process.versions.electron}, Node ${process.versions.node})` : `Node ${process.versions.node}`}`, 'Install Node.js 22 or newer (nodejs.org), or run cz from the kit the app made (it uses the app as Node).');
    ok(!!kj.kit, `kit: made by Toon Studio ${kj.app ?? '?'} on ${String(kj.generated ?? '?').slice(0, 10)}`, 'kit.json is missing: get the kit again from the app (Styles > Get the Style Kit).');
    const app = appTemplates();
    if (kj.appTemplates && !app) say(`warn the Toon Studio app's files are not at ${kj.appTemplates} any more (moved or updated). The kit uses its own copies; the low-poly library, the 3D reconstruction male body and the script fonts need the app: get the kit again from the app (Styles > Get the Style Kit).`);
    else if (app) {
      say(`ok   app files: ${app}`);
      const appSha = sha1(fs.readFileSync(path.join(app, 'host', 'host.js')));
      if (appSha !== kj.host) say('warn the app was updated after this kit was made (its host page changed): get the kit again from the app so previews and checks match it exactly.');
      for (const b of BASES) { const f = path.join(app, BASE_ENGINE_DIR[b], 'engine.js'); if (!exists(f)) continue; const v = engineVersionOf(fs.readFileSync(f, 'utf8'));
        if (v != null && kj.engines?.[b] != null && v !== kj.engines[b]) say(`warn the app's ${BASE_NAME[b]} engine is v${v}, this kit's is v${kj.engines[b]}: get the kit again for the newer base (your styles keep their engine).`); }
    }
    const hostOk = exists(path.join(KIT, 'host', 'host.js')) && sha1(fs.readFileSync(path.join(KIT, 'host', 'host.js'))) === kj.host;
    ok(hostOk, 'host page: the kit\'s copy matches kit.json', 'The kit\'s host/ was changed: get the kit again from the app.');
    for (const b of BASES) { const f = path.join(baseDir(b), 'engine', 'engine.js'); ok(exists(f), `base ${b}: engine v${exists(f) ? engineVersionOf(fs.readFileSync(f, 'utf8')) : '-'}`, 'The base is missing from bases/: get the kit again.'); }
    const ff = tool('ffmpeg'), fp = tool('ffprobe');
    ok(!!ff, `ffmpeg: ${ff ?? 'not found on PATH'}`, process.platform === 'darwin' ? 'Install ffmpeg (brew install ffmpeg), or run the Toon Studio installer again.' : process.platform === 'win32' ? 'Install ffmpeg (winget install Gyan.FFmpeg), or run the Toon Studio installer again.' : 'Install ffmpeg.');
    ok(!!fp, `ffprobe: ${fp ?? 'not found on PATH'}`, 'ffprobe comes with ffmpeg: install ffmpeg.');
    const b = findBrowser();
    ok(!!b, `browser: ${b ? `${b.name} (${b.path})` : 'none found'}`, process.platform === 'darwin' ? 'Install Google Chrome, or set CZ_BROWSER to a Chromium browser.' : 'Install Google Chrome or Microsoft Edge, or set CZ_BROWSER.');
    if (b) {
      try {
        await withRender(async ({ browser, server }) => {
          const p = await browser.probe(`${server.url}/__kit/blank.html`);
          ok(true, `headless: ${browser.version}`);
          ok(p.h264, `H.264 encoder (WebCodecs): ${p.h264 ? (p.h264hw ? 'yes, hardware' : 'yes, software') : 'no'}`, 'Update the browser (Chrome / Edge 94+); on Linux use Google Chrome, not Chromium (no H.264).');
          ok(!!p.gl, `WebGL: ${p.gl ?? 'none'}`, 'Update the graphics driver; the styles need WebGL 2.');
          if (p.software) say('warn WebGL runs in software (SwiftShader / llvmpipe): checks and exports will be slow. Update the graphics driver or use the computer\'s main browser.');
        });
      } catch (e) { ok(false, `headless browser: ${e.message}`, 'Close other copies of the browser that use a lot of memory and try again; or set CZ_BROWSER to another Chromium browser.'); }
    }
    const styles = exists(STYLES) ? fs.readdirSync(STYLES).filter(n => exists(path.join(STYLES, n, 'project.json'))) : [];
    say(`ok   styles: ${styles.length ? styles.join(', ') : 'none yet (cz new <name> --base <base>)'}`);
    say(bad ? `\n${bad} problem${bad > 1 ? 's' : ''} to fix (see above).` : '\nEverything is ready.');
    if (bad) process.exitCode = 1;
  },

  async new() {
    const name = pos[0], base = flags.base;
    if (!name || !NAME_RX.test(name)) return fail('give the style a name: lowercase letters, digits and -, e.g. cz new neon-noir --base flat');
    if (!BASES.includes(base)) return fail(`--base must be one of ${BASES.join(', ')}`);
    const dir = path.join(STYLES, name); if (exists(dir)) return fail(`styles/${name} exists already (pick another name, or delete that folder)`);
    const can = baseAspects(base), aspects = flags.aspects ? [...new Set(list(flags.aspects))] : [can[0]];
    for (const a of aspects) if (!can.includes(a)) return fail(`${BASE_NAME[base]} renders ${can.join(' and ')}, not ${a}`);
    const dim = base === 'starter' ? (flags.dim === '3d' ? '3d' : '2d') : DIM_OF_BASE[base] ?? null;
    if (flags.dim && base !== 'starter' && flags.dim !== dim) return fail(`--dim is for the starter base only (${BASE_NAME[base]} is ${dim})`);
    const bd = baseDir(base), eng = path.join(bd, 'engine');
    if (!exists(path.join(eng, 'engine.js'))) return fail(`bases/${base} is missing from the kit (get the kit again from the app)`);
    const kj = kitJson();
    fs.mkdirSync(dir, { recursive: true });
    try {
      for (const d of ['scenes', 'audio', 'assets', 'skill', 'looks', 'reference', 'out', '.cz']) fs.mkdirSync(path.join(dir, d), { recursive: true });
      // the engine at the root (like a project), LF line endings; a snapshot of the base engine + skill for cz rebase
      for (const part of [...ENGINE_PARTS, 'character.js']) if (exists(path.join(eng, part))) { if (fs.statSync(path.join(eng, part)).isDirectory()) copyTree(path.join(eng, part), path.join(dir, part), { lf: true }); else fs.writeFileSync(path.join(dir, part), /\.(m?js|json)$/.test(part) ? toLF(fs.readFileSync(path.join(eng, part), 'utf8')) : fs.readFileSync(path.join(eng, part))); }
      let es = fs.readFileSync(path.join(dir, 'engine.js'), 'utf8');
      if (!engineKindOf(es)) { es = es.replace(/\s*$/, '') + `\nexport const ENGINE_KIND = '${BASE_KIND[base]}';   // (Style Kit: the engine contract names the kind; the host page reads a missing one as 'pixel')\n`; fs.writeFileSync(path.join(dir, 'engine.js'), es); }
      copyTree(eng, path.join(dir, '.cz', 'base-engine'), { lf: true });
      if (exists(path.join(bd, 'skill'))) copyTree(path.join(bd, 'skill'), path.join(dir, '.cz', 'base-skill'));
      // the base's sample: scenes, views (+ their expect), assets, the sample narration
      const sroot = path.join(bd, 'samples'), sub = dim && exists(path.join(sroot, dim, 'views.json')) ? path.join(sroot, dim) : sroot;
      const vj = readJson(path.join(sub, 'views.json'), null); if (!vj?.views) throw new Error(`bases/${base} has no sample views`);
      for (const f of fs.readdirSync(sub)) if (f.endsWith('.js')) fs.writeFileSync(path.join(dir, 'scenes', f), toLF(fs.readFileSync(path.join(sub, f), 'utf8')));
      if (exists(path.join(sub, 'assets'))) copyTree(path.join(sub, 'assets'), path.join(dir, 'assets'));
      if (base === 'stickman') seedStickmanSprites(dir);
      const views = {}; for (const [k, v] of Object.entries(vj.views)) if (VIEW_RX.test(k) && Array.isArray(v?.scenes)) views[k] = v;
      const tl = [path.join(sroot, 'timeline.json'), path.join(baseDir('starter'), 'samples', 'timeline.json')].find(exists);
      if (tl) { fs.copyFileSync(tl, path.join(dir, 'audio', 'timeline.json')); const sc = path.join(path.dirname(tl), 'script.txt'); if (exists(sc)) fs.copyFileSync(sc, path.join(dir, 'script.txt')); }
      // the docs Claude fills (fixed headings)
      const tdir = path.join(KIT, 'docs', 'templates');
      const tpl = (f, fallback) => { const p = path.join(tdir, f); const t = exists(p) ? fs.readFileSync(p, 'utf8') : fallback; return toLF(t).replace(/\{\{NAME\}\}/g, titleOf(name)).replace(/\{\{TARGET\}\}/g, BASE_NAME[base]).replace(/\{\{BASE\}\}/g, base); };
      for (const f of ['STYLE_GUIDE.md', 'QUALITY.md', 'PITFALLS.md']) fs.writeFileSync(path.join(dir, 'skill', f), tpl(f, `# {{NAME}} - ${f.replace('.md', '').replace('_', ' ').toLowerCase()}\n\n_(to fill)_\n`));
      fs.writeFileSync(path.join(dir, 'reference', 'ANALYSIS.md'), tpl('STUDY.md', '# {{NAME}} - what the style was measured from\n\n_(to fill)_\n'));
      // style.json (the manifest draft), a default look, project.json (views + the sample view loaded)
      const id = `custom-${name}`.slice(0, 47);
      writeJson(path.join(dir, 'style.json'), { schema: 2, kind: 'style', id, name: titleOf(name), tagline: '', description: '', base, from: { style: base, engineVersion: kj.engines?.[base] ?? engineVersionOf(es) ?? 0 },
        version: 1, created: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), ...(dim ? { dim } : {}), aspects, controls: { keep: [], add: [], remove: [] }, defaults: base === 'starter' ? { dim } : {},
        capabilities: { needsImageKey: base === 'collage' }, banned: ['Math.random(', 'Date.now(', 'performance.now('],
        prompts: { brief: '', build: '', context: '', qualityBar: '', reframe: '', imageStyle: '', ignoreBaseRefs: [] } });
      writeJson(path.join(dir, 'looks', 'look-default.json'), { schema: 2, kind: 'look', id: 'look-default', style: id, name: 'Default', description: 'The style as it ships.', settings: {}, pitfalls: [] });
      writeJson(path.join(dir, 'CREDITS.json'), []);
      const first = views.sample ? 'sample' : Object.keys(views)[0];
      writeJson(path.join(dir, 'project.json'), { title: titleOf(name), style: id, language: 'en', end: +views[first].end, timeline: 'audio/timeline.json', scenes: [...views[first].scenes], images: {},
        previewAudio: 'audio/clean.wav', settings: settingsFor(dir, aspects[0]), views, view: first }, 1);
      writeJson(path.join(dir, '.cz', 'created.json'), { base, engineVersion: kj.engines?.[base] ?? null, dim, aspects, kitApp: kj.app ?? null, at: new Date().toISOString() });
    } catch (e) { fs.rmSync(dir, { recursive: true, force: true }); throw e; }
    say(`styles/${name}: a ${BASE_NAME[base]} style (${aspects.join(' + ')}${dim ? `, ${dim}` : ''}), id custom-${name}`);
    say(`  views: ${Object.keys(readJson(path.join(dir, 'project.json')).views).join(', ')}`);
    say(`  next: cz preview ${name}   |   cz check ${name}`);
  },

  list() {
    const names = exists(STYLES) ? fs.readdirSync(STYLES).filter(n => exists(path.join(STYLES, n, 'project.json'))) : [];
    if (!names.length) return say('No styles yet: cz new <name> --base <base>');
    for (const n of names) {
      try { const st = readStyle(n), lp = readJson(path.join(st.dir, '.cz', 'last-package.json'), null), lc = readJson(path.join(st.dir, '.cz', 'last-check.json'), null);
        say(`${n.padEnd(24)} ${String(st.sj.id).padEnd(30)} ${BASE_NAME[st.base] ?? st.base} engine v${engineVersionOf(fs.readFileSync(path.join(st.dir, 'engine.js'), 'utf8')) ?? '?'}, ${st.aspects.join(' + ')}, ${Object.keys(st.views).length} views`
          + `${lc ? `, last check ${lc.at?.slice(0, 16)} ${lc.high ? `${lc.high} high` : 'clean'}` : ''}${lp ? `, packaged ${lp.at?.slice(0, 16)}` : ''}`); }
      catch (e) { say(`${n.padEnd(24)} (broken: ${e.message})`); }
    }
  },

  async preview() {
    const name = pos[0]; const st = readStyle(name), view = pos[1] ?? st.pj.view ?? 'sample';
    if (!st.views[view]) return fail(`no view "${view}" (views: ${Object.keys(st.views).join(', ')})`);
    const lk = lookOf(st); if (lk) useLook(st.dir, lk.settings);     // (the player asks this process's server for the settings)
    const pj = st.pj; pj.scenes = [...st.views[view].scenes]; pj.end = +st.views[view].end; pj.view = view; writeJson(path.join(st.dir, 'project.json'), pj, 1);
    const server = await startServer({ port: +flags.port || 0 });
    const url = `${server.url}/__kit/player.html?style=${encodeURIComponent(name)}`;
    say(`Preview of ${name} (${view}${lk ? `, look ${lk.id}` : ''}): ${url}\nPress Ctrl+C to stop.`);
    if (!flags['no-open']) {
      const o = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
      try { spawn(o[0], o[1], { windowsHide: true, detached: true, stdio: 'ignore' }).unref(); } catch { say('Open that address in your browser.'); }
    }
    await new Promise(() => {});
  },

  async stills() {
    const [name, view] = pos; const st = readStyle(name), v = st.views[view];
    if (!v) return fail(`no view "${view}" (views: ${Object.keys(st.views).join(', ')})`);
    const lk = lookOf(st), a = aspectOf(st, lk); if (!st.aspects.includes(a)) return fail(`the style renders ${st.aspects.join(' and ')}`);
    if (lk) say(`with look ${lk.id} (${lk.file}) over the style's settings, ${a}`);
    const times = list(flags.times).map(Number).filter(t => isFinite(t) && t >= 0); if (!times.length) return fail('give --times, e.g. --times 1,3.5');
    if (times.length > 24) return fail('at most 24 frames per call (stills are for looking at moments; videos are made in Toon Studio)');
    const scale = Math.min(1, Math.max(.1, +(flags.scale ?? .5)));
    const out = path.join(st.dir, '.cz', 'stills'); fs.mkdirSync(out, { recursive: true });
    await withRender(async ({ browser, server }) => {
      const { page, bootError } = await openView(browser, server, name, v, settingsFor(st.dir, a, lk?.settings ?? null));
      try {
        if (bootError) return fail(`the ${view} view does not load: ${bootError}`);
        // the page renders with the host's own stills() and posts each PNG to the server's frame sink (.suite/frames/)
        const batch = `czstills${Date.now().toString(36)}`, sink = path.join(st.dir, '.suite', 'frames', batch);
        const ok = await page.evaluate(`(async () => { const urls = await window.suite.stills(${JSON.stringify(times)}, ${scale}), base = location.pathname.replace(/\\/host\\.html$/, ''), out = [];
          for (let i = 0; i < urls.length; i++) { if (!urls[i]) { out.push(false); continue; }
            const bin = atob(urls[i].slice(urls[i].indexOf(',') + 1)), b = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) b[k] = bin.charCodeAt(k);   // (no fetch of the data URL: its 5 MB address would ride on a DevTools event)
            out.push((await fetch(base + '/frame/${batch}/' + i, { method: 'POST', body: new Blob([b], { type: 'image/png' }) })).ok); }
          return out; })()`, { timeout: 60000 + times.length * 10000 });
        ok.forEach((good, i) => {
          const src = path.join(sink, String(i).padStart(6, '0') + '.png');
          if (!good || !exists(src)) return say(`  ${times[i]}s: the frame threw (see the errors below)`);
          const f = path.join(out, `${view}_${aspectTag(a)}${lk ? `_${String(lk.id).replace(/[^\w-]/g, '')}` : ''}_t${times[i].toFixed(2).replace('.', '_')}.png`); fs.rmSync(f, { force: true }); fs.renameSync(src, f); say(f);
        });
        fs.rmSync(sink, { recursive: true, force: true });
        const errs = [...page.errors, ...page.console.map(c => `${c.level}: ${c.text}`), ...page.failed.map(f => `missing: ${f.url}`)];
        if (errs.length) { say(`\n${errs.length} message${errs.length > 1 ? 's' : ''} from the page:`); for (const e of errs.slice(0, 20)) say(`  ${e}`); }
      } finally { await page.close(); }
    });
  },

  async check() {
    const name = pos[0]; const st = readStyle(name), t0 = Date.now(), lk = lookOf(st);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cz-check-'));
    let findings = [], pairs = [], exports = {};
    try {
      say(`Checking ${name} (${BASE_NAME[st.base]}, ${st.aspects.join(' + ')}${lk ? `, with look ${lk.id}` : ''}): static checks on the package, then every view in every aspect ...`);
      const pkg = await assemble(name, { outDir: tmp, zip: false, bump: false, preview: false });
      findings.push(...pkg.findings);
      const r = await withRender(({ browser, server }) => renderChecks(name, { browser, server, look: lk, views: flags.views ? list(flags.views) : null, aspects: flags.aspects ? list(flags.aspects) : null, controls: !!flags.controls, exportCheck: !flags['no-export'] }));
      findings.push(...r.findings); pairs = r.pairs; exports = r.exports;
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    const n = s => findings.filter(f => f.sev === s).length, high = n('high');
    writeJson(path.join(st.dir, '.cz', lk ? `last-check-${String(lk.id).replace(/[^\w-]/g, '')}.json` : 'last-check.json'), { at: new Date().toISOString(), ms: Date.now() - t0, ...(lk ? { look: lk.id } : {}), high, medium: n('medium'), low: n('low'), info: n('info'), pairs, findings });
    if (flags.json) { say(JSON.stringify({ high, findings, pairs }, null, 1)); }
    else {
      say(`\n${pairs.length} view x aspect render${pairs.length === 1 ? '' : 's'}: ${pairs.map(p => `${p.view} ${p.aspect}${p.boot ? '' : ' (did not load)'}`).join(', ')}`);
      for (const [a, e] of Object.entries(exports)) say(`export ${a}: ${e.width}x${e.height} ${e.codec}, ${e.frames} frames, ${e.duration} s`);
      say(findings.length ? `\n${formatFindings(findings)}` : '\nNo findings.');
      say(`\n${high ? `NOT READY: ${high} high finding${high > 1 ? 's' : ''}` : 'READY: no high finding'} (${n('medium')} medium, ${n('low')} low) in ${Math.round((Date.now() - t0) / 1000)} s`);
    }
    if (high) process.exitCode = 1;
  },

  async export() {
    const name = pos[0]; const st = readStyle(name), view = pos[1] ?? 'sample', lk = lookOf(st), a = aspectOf(st, lk);
    if (lk) say(`with look ${lk.id} (${lk.file}) over the style's settings, ${a}`);
    const out = lk ? path.join(st.dir, 'out', `${view}_${aspectTag(a)}_${String(lk.id).replace(/[^\w-]/g, '')}.mp4`) : null;
    await withRender(async ({ browser, server }) => {
      const vEnd = +(st.views[view]?.end ?? 0), from0 = +(flags.from ?? 0), want = (flags.to != null ? +flags.to : vEnd) - from0;
      if (want > KIT_EXPORT_MAX) say(`note: kit exports are previews of at most ${KIT_EXPORT_MAX} s with the Style Kit mark (videos are made in Toon Studio): exporting ${from0}-${from0 + KIT_EXPORT_MAX} s.`);
      const r = await exportClip(name, { browser, server, view, aspect: a, look: lk, out, mark: true, from: from0, to: flags.to != null ? +flags.to : null, audio: true, log: s => process.stdout.write(`\r${s}   `) });
      say(`\n${r.file}\n  ${r.width}x${r.height} ${r.codec}, ${r.frames} frames, ${r.duration} s (rendered at ${r.render?.fps ?? '?'} fps)`);
    });
  },

  async package() {
    const name = pos[0]; readStyle(name);
    const run = async (o = {}) => assemble(name, { ...o, preview: !flags['no-preview'], exportClip, log: () => {} });
    const r = flags['no-preview'] ? await run() : await withRender(({ browser, server }) => run({ browser, server }));
    for (const n of r.notes) say(`note: ${n}`);
    say(`${path.relative(KIT, r.dir)}${path.sep}  +  ${r.zip ? path.relative(KIT, r.zip) : '(no zip)'}   (engine v${r.engineVersion})`);
    say(r.findings.length ? `\n${formatFindings(r.findings)}` : '\nStatic checks: no findings.');
    const high = r.findings.filter(f => f.sev === 'high').length;
    say(high ? `\n${high} high finding${high > 1 ? 's' : ''}: the app will refuse this package until they are fixed (cz check ${name} runs the render checks too).` : `\nStatic checks pass. Run cz check ${name} for the render checks, then import ${r.zip ? path.basename(r.zip) : 'the package'} in Toon Studio (Styles > Custom > Import style).`);
    if (high) process.exitCode = 1;
  },

  rebase() {
    const name = pos[0]; const st = readStyle(name), snap = path.join(st.dir, '.cz', 'base-engine'), next = path.join(st.dir, '.rebase'), kj = kitJson();
    const kitEng = path.join(baseDir(st.base), 'engine');
    if (flags.done) {
      if (!exists(next)) return fail('there is no .rebase/ to finish (run cz rebase <style> first)');
      const nv = engineVersionOf(readText(path.join(next, 'engine.js'))) ?? kj.engines?.[st.base] ?? st.sj.from?.engineVersion;
      fs.rmSync(snap, { recursive: true, force: true }); fs.renameSync(next, snap);
      const sj = st.sj; sj.from = { style: st.base, engineVersion: nv }; writeJson(path.join(st.dir, 'style.json'), sj);
      const mine = engineVersionOf(readText(path.join(st.dir, 'engine.js')));
      if (mine != null && nv != null && mine <= nv) say(`note: your engine.js says ENGINE_VERSION = ${mine}; raise it above ${nv} (the base's) so projects of this style get the update.`);
      fs.rmSync(path.join(st.dir, '.cz', 'base-skill'), { recursive: true, force: true }); copyTree(path.join(baseDir(st.base), 'skill'), path.join(st.dir, '.cz', 'base-skill'));
      return say(`Rebased: styles/${name} is now built on ${BASE_NAME[st.base]} engine v${sj.from.engineVersion}. Next: cz check ${name}, then cz package ${name}.`);
    }
    fs.rmSync(next, { recursive: true, force: true }); copyTree(kitEng, next, { lf: true });
    const vNew = engineVersionOf(readText(path.join(next, 'engine.js')));
    const same = (x, y) => { try { const A = fs.readFileSync(x), B = fs.readFileSync(y); return /\.(m?js|json|md|txt|html|css|svg)$/i.test(x) ? toLF(A.toString('utf8')) === toLF(B.toString('utf8')) : Buffer.compare(A, B) === 0; } catch { return false; } };
    if (!exists(snap)) {
      // no snapshot of the engine the style was built on (an imported package built on another engine version): compare
      // the style with this kit's base directly. Each difference is the style's change OR the base's: say so plainly.
      const was = st.sj.from?.engineVersion;
      say(`WARNING: styles/${name} has no snapshot of the engine it was built on (${BASE_NAME[st.base]} v${was ?? '?'}; .cz/base-engine/ is missing, e.g. after cz import-package of a package built on another engine version).\nComparing your engine with this kit's v${vNew} directly (now in styles/${name}/.rebase/): every difference below is EITHER your change OR the base's, and you must tell which by reading it.\nIf you still have the style's old folder (styles/.replaced/...), copy its .cz/base-engine/ into styles/${name}/.cz/ and run cz rebase ${name} again instead: then the merge is a real 3-way merge.\n`);
      const ours = new Set(listFiles(st.dir, { skip: r => !BASE_ENGINE_PARTS.some(p => r === p || r.startsWith(p + '/') || p.startsWith(r + '/')) })), theirs = new Set(listFiles(next));
      let n = 0;
      for (const f of [...new Set([...ours, ...theirs])].sort()) {
        const inMine = ours.has(f), inKit = theirs.has(f);
        if (inMine && inKit && same(path.join(st.dir, f), path.join(next, f))) continue;
        n++;
        if (!inMine) say(`  only in the kit's base  ${f}  (new in the base, or a file you removed: copy it from .rebase/ unless you removed it on purpose)`);
        else if (!inKit) say(`  only in your style      ${f}  (yours, or removed from the base)`);
        else { const lo = readText(path.join(next, f)), ln = readText(path.join(st.dir, f)); say(`  differs                 ${f}${lo != null && ln != null ? ` ${lineDiff(lo, ln)}` : ''}  (git diff --no-index .rebase/${f} ${f})`); }
      }
      return say(n ? `\n${n} file${n > 1 ? 's' : ''} differ. Merge by hand, file by file: keep the style's look (palette, fonts, DEFAULTS values, its own elements and checks), take the base's behaviour (fixes, new exports, new options).\nKeep every export, set ENGINE_VERSION above ${vNew}. Then: cz rebase ${name} --done (records v${vNew} as the engine the style is built on, with a snapshot), cz check ${name}, cz package ${name}.`
        : `\nYour engine files equal this kit's v${vNew}: nothing to merge (cz rebase ${name} --done records v${vNew} with a snapshot).`);
    }
    const vOld = engineVersionOf(readText(path.join(snap, 'engine.js')));
    const a = new Set(listFiles(snap)), b = new Set(listFiles(next)), files = [...new Set([...a, ...b])].sort();
    say(`${BASE_NAME[st.base]} engine v${vOld} (what styles/${name} was built on, .cz/base-engine/) -> v${vNew} (this kit, now in styles/${name}/.rebase/)\n`);
    let changed = 0;
    for (const f of files) {
      const inOld = a.has(f), inNew = b.has(f), yours = path.join(st.dir, f), mine = exists(yours) ? (inOld ? (same(yours, path.join(snap, f)) ? 'untouched by you' : 'CHANGED BY YOU: merge by hand') : 'yours') : inOld ? 'you removed it' : 'not in your style';
      if (inOld && inNew && same(path.join(snap, f), path.join(next, f))) continue;
      changed++;
      if (!inOld) say(`  added    ${f}  (${mine === 'not in your style' ? 'copy it from .rebase/' : mine})`);
      else if (!inNew) say(`  removed  ${f}  (${mine})`);
      else { const lo = readText(path.join(snap, f)), ln = readText(path.join(next, f)), d = lo != null && ln != null ? ` ${lineDiff(lo, ln)}` : ''; say(`  changed  ${f}${d}  (${mine === 'untouched by you' ? 'untouched by you: take .rebase/ as is' : mine})`); }
    }
    say(changed ? `\n${changed} file${changed > 1 ? 's' : ''} differ. Merge: for each file, base old = .cz/base-engine/<f>, base new = .rebase/<f>, yours = <f>. Keep your changes, take the base's.\nKeep every export (the contract), keep ENGINE_VERSION above the base's. Then: cz rebase ${name} --done, cz check ${name}, cz package ${name}.`
      : '\nThe base engine did not change: nothing to merge (cz rebase ' + name + ' --done records the new version).');
  },

  async 'import-package'() {
    const src = pos[0]; if (!src) return fail('give a package: cz import-package dist/custom-x.zip (or a folder)');
    const r = await importPackage(path.resolve(src), { replace: !!flags.replace, as: flags.as ?? null });
    for (const n of r.notes) say(`note: ${n}`);
    say(`Imported into styles/${r.name}. Views: ${Object.keys(readJson(path.join(r.dir, 'project.json')).views).join(', ')}`);
    if (r.findings.length) say(`\n${formatFindings(r.findings)}`);
    say(`\nNext: cz check ${r.name}`);
  },
};
function readText(f) { try { return fs.readFileSync(f, 'utf8').replace(/\r\n?/g, '\n'); } catch { return null; } }
function lineDiff(a, b) { const A = new Set(a.split('\n')), B = new Set(b.split('\n')); let add = 0, del = 0; for (const l of B) if (!A.has(l)) add++; for (const l of A) if (!B.has(l)) del++; return `(+${add} -${del} lines)`; }

const f = commands[cmd];
if (!f) { console.error(`cz: unknown command "${cmd}"\n`); say(HELP); process.exitCode = 2; }
else Promise.resolve().then(() => f()).catch(e => { console.error(`cz ${cmd}: ${e.message}`); if (process.env.CZ_DEBUG) console.error(e.stack); process.exitCode = 1; });
