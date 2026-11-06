// berat studio's command line over berat studio's own code (appcore/load.cjs): every command calls the app's function
// for it, so a project is set up, voiced, timed, built by Claude, mixed and exported exactly as the app does it.
//   node cli.cjs styles | looks <style>
//   node cli.cjs new <name> --style <id> [--length 60] [--format vertical|landscape] [--lang en] [--look <preset>] [--topic "..."] [--brief "..."]
//   node cli.cjs import <folder>                     register an existing project folder
//   node cli.cjs run <project> <script|build|edit|ask|ultra> [--level standard|props|polish|scenes|ultra|ultraplus] [--notes "..."] [--model id] [--effort e]
//   node cli.cjs voice <project> [--provider elevenlabs|file] [--file a.wav]   (then the app cleans and times it)
//   node cli.cjs step <project> clean|timeline|sound
//   node cli.cjs export <project> [--name n] [--stems] [--silent] [--from s --to s]
//   node cli.cjs stills <project> <t> [t ...] [--scale 0.5]
//   node cli.cjs info <project> | levels <project> | prompt <project> <kind> [--level ...] [--notes ...]
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { load, ROOT } = require('./load.cjs');
const { fixEncoder } = require('./fixes.cjs');

const argv = process.argv.slice(2), flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--stems', '--json'].includes(argv[i - 1])));
const A = load(['STYLES', 'getStyle', 'baseOf', 'listPresets', 'createProject', 'importProject', 'register', 'q', 'getProject', 'startServer', 'runTask',
  'qualityLevels', 'levelExtras', 'extrasFor', 'startVoiceover', 'jobOf', 'runStep', 'markDirty', 'writeContext', 'stepSucceeded', 'exportVideo',
  'checkedStills', 'hostState', 'getConfig', 'buildPrompt', 'withExtras', 'getShots', 'stopTask', 'running$1', 'ws', 'openFlow',
  'loadPackages', 'loadCustomStyles', 'loadStudioLooks', 'makeKit', 'startImport', 'getRun$1', 'installImport', 'formatFindings',
  'PACKAGES', 'CUSTOM']);
// the app loads the installed and custom styles (Styles > Custom) when it starts
try { A.loadPackages(); A.loadCustomStyles(); A.loadStudioLooks(); } catch (e) { console.error('custom styles:', e.message); }
const say = (...a) => console.log(...a);
const done = (code = 0) => setTimeout(() => process.exit(code), 400);

function projectOf(ref) {
  if (!ref) throw new Error('Name a project (its folder name under projects/, its title or its id).');
  const dir = path.isAbsolute(ref) ? ref : path.join(A.ws.projects(), ref);
  const p = A.q.get('SELECT * FROM projects WHERE id=? OR slug=? OR name=? OR path=?', ref, ref, ref, path.resolve(dir));
  if (p) return p;
  if (fs.existsSync(path.join(dir, 'project.json'))) return importFolder(dir);
  throw new Error(`No project "${ref}".`);
}
function importFolder(dir) {
  dir = path.resolve(dir);
  const pj = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8').replace(/^﻿/, ''));
  // the look whose settings match the project's own (look / theme / renderEngine), else the style's default look
  const style = pj.style || 'pixel-art', mine = A.listPresets().filter((x) => (x.style_id || 'pixel-art') === style), s = pj.settings || {};
  const same = (x) => { const o = typeof x.settings === 'string' ? JSON.parse(x.settings) : x.settings || {}; return ['look', 'theme', 'palette'].every((k) => o[k] === undefined || o[k] === s[k]); };
  const look = (mine.find(same) ?? mine.find((x) => x.id === A.getStyle(style).defaultLook) ?? mine[0])?.id ?? null;
  const existing = A.q.get('SELECT * FROM projects WHERE path=?', dir);
  if (existing) { A.q.run('UPDATE projects SET preset_id=? WHERE id=?', look, existing.id); try { A.writeContext(existing.id); } catch {} return A.getProject(existing.id); }
  const p = A.register(dir, pj.title || path.basename(dir), look, style);
  try { A.writeContext(p.id); } catch {}
  return A.getProject(p.id);
}
// the stream of a Claude run, the way the app's side panel shows it: text, the tools it calls, notes, the end
function printer(onDone) {
  let line = '';
  const out = (t) => { process.stdout.write(t); line = t.endsWith('\n') ? '' : 'x'; };
  return (ev) => {
    if (ev.type === 'delta') { if (ev.text) out(ev.text); }
    else if (ev.type === 'text') { if (ev.text && !ev.streamed) out(ev.text + '\n'); }
    else if (ev.type === 'tool') { if (line) out('\n'); say(`  [${ev.name}] ${String(ev.summary || '').slice(0, 160)}`); }
    else if (ev.type === 'note') { if (line) out('\n'); say(`(${ev.text})`); }
    else if (ev.type === 'permission') { if (line) out('\n'); say(`(Claude asked to use ${ev.tool}: Settings > Permissions is "${A.getConfig().claude.permissions}")`); }
    else if (ev.type === 'done') {
      if (line) out('\n');
      say(`--- ${ev.status}${ev.error ? `: ${ev.error}` : ''} | ${Math.round(ev.ms / 1000)} s, ${ev.tokens?.turns ?? '?'} turns, ${ev.files?.length ?? 0} files changed ---`);
      onDone?.(ev);
    }
  };
}

(async () => {
  const cmd = pos[0];
  if (cmd === 'styles') {
    for (const s of A.STYLES) if (!s.hidden || s.id === 'blender') say(`${s.id.padEnd(11)} ${s.name}${s.legacy ? ' (legacy)' : ''} - ${s.tagline || ''}`);
    for (const s of [...(A.PACKAGES ?? []), ...(A.CUSTOM ?? [])]) say(`${s.id} ${s.name} (custom) - ${s.tagline || ''}`);
    return done();
  }
  if (cmd === 'looks') { for (const p of A.listPresets().filter((x) => (x.style_id || 'pixel-art') === pos[1])) say(`${p.id.padEnd(24)} ${p.name} - ${String(p.description || '').slice(0, 110)}`); return done(); }
  if (cmd === 'new') {
    const style = flag('style') || 'blender';
    if (![...A.STYLES, ...(A.PACKAGES ?? []), ...(A.CUSTOM ?? [])].some((s) => s.id === style)) throw new Error(`No style "${style}": node cli.cjs styles`);
    const p = await A.createProject({ name: pos[1] || 'Untitled video', styleId: style, presetId: flag('look') ?? null, length: +flag('length', 0) || undefined,
      format: flag('format'), language: flag('lang'), topic: flag('topic'), brief: flag('brief'), script: flag('script-file') ? fs.readFileSync(flag('script-file'), 'utf8') : undefined });
    if (fixEncoder(p.path)) say('engine.js: video encoder fallback added (appcore/fixes.cjs)');
    say(`created ${p.slug} (${p.style_id}, look ${p.preset_id}) at ${p.path}`); return done();
  }
  if (cmd === 'import') { const p = importFolder(pos[1]); say(`registered ${p.slug} (${p.style_id}) ${p.path}`); return done(); }
  if (cmd === 'kit') {                                  // the app's "Get the Style Kit" (Styles > Custom)
    const r = await A.makeKit(pos[1] || path.dirname(A.ws.projects()));
    say(`Style Kit: ${r.folder}${r.guide ? `\nguide: ${r.guide}` : ''}`); return done();
  }
  if (cmd === 'import-style') {                         // the app's Styles > Custom > Import style: checks, then adds it
    await A.startServer();
    let run = A.startImport(pos[1]), shown = '';
    while (run.status === 'running') {
      await new Promise((r) => setTimeout(r, 1500)); run = A.getRun$1(run.id);
      const s = `${run.status} ${run.phase || run.step || ''}`.trim(); if (s !== shown) { shown = s; say(s); }
    }
    const notes = run.findings?.filter((f) => f.sev !== 'info') ?? [];
    if (notes.length) say(A.formatFindings(notes));
    if (run.status !== 'ready') { say(`NOT ADDED (${run.status}${run.error ? `: ${run.error}` : ''})`); return done(1); }
    run = await A.installImport(run.id);
    say(`ADDED ${run.result.id} v${run.result.version}: python studio.py new <name> --style ${run.result.id}`); return done();
  }
  if (cmd === 'flow-open') { const s = await A.openFlow(); say(`Flow is open in its Chrome window (${JSON.stringify(s)}): sign in to Google there or finish the check it shows, then go on.`); return done(); }
  if (cmd === 'list') { for (const x of A.q.all('SELECT slug, style_id, preset_id, duration, path FROM projects ORDER BY updated_at DESC')) say(`${x.slug.padEnd(28)} ${x.style_id.padEnd(11)} ${String(x.preset_id).padEnd(22)} ${x.path}`); return done(); }
  if (cmd === 'use') { const p = projectOf(pos[1]); fs.writeFileSync(path.join(ROOT, '.active-project'), p.path); say(`open project: ${p.slug} (${p.style_id}). Reconnect the suite MCP server (/mcp) so its tools follow it.`); return done(); }
  const p = projectOf(pos[1]);
  if (fixEncoder(p.path)) say('engine.js: video encoder fallback added (appcore/fixes.cjs)');
  if (cmd === 'info') { say(JSON.stringify(p, null, 1)); return done(); }
  if (cmd === 'levels') { for (const l of A.qualityLevels(A.baseOf(p.style_id))) say(`${l.key.padEnd(10)} ${l.name}: ${l.adds}`); return done(); }
  await A.startServer();
  if (cmd === 'run') {
    const kind = pos[2] || 'build', level = flag('level', kind === 'build' ? 'scenes' : undefined);
    const extras = kind === 'build' && level ? A.levelExtras(level, A.baseOf(p.style_id)) : undefined;
    say(`Claude: ${kind}${extras?.length ? ` (${extras.join(', ')})` : ''} on ${p.slug}. This runs Claude Code exactly as the app does; Ctrl+C stops it.\n`);
    process.on('SIGINT', () => { for (const id of A.running$1.keys()) A.stopTask(id); setTimeout(() => process.exit(130), 1500); });
    let finish; const ended = new Promise((r) => { finish = r; });
    await A.runTask({ projectId: p.id, kind, instruction: flag('notes', ''), extras, model: flag('model') || null, effort: flag('effort') || null }, printer(finish));
    const ev = await ended;
    return done(ev.status === 'error' || ev.status === 'failed' ? 1 : 0);
  }
  if (cmd === 'voice') {
    const prov = flag('provider', A.getConfig().voice?.provider === 'auto' ? 'elevenlabs' : A.getConfig().voice?.provider);
    const v = A.getConfig().voice || {};
    const req = prov === 'file' ? { provider: 'file', files: argv.filter((a, i) => argv[i - 1] === '--file').map((f) => path.resolve(f)), autoTime: true }
      : { provider: prov, eleven: v.elevenlabs, fish: v.fish, kokoro: v.kokoro, autoTime: v.autoTime !== false, gap: v.gap };
    let last = '';
    const job = await A.startVoiceover(p.id, p.path, req, (j) => { const s = `${j.status} ${j.phase || ''} ${j.part ? `${j.part.done}/${j.part.total}` : ''} ${j.error || ''}`.trim(); if (s !== last) { last = s; say(s); } }, () => A.markDirty(p.id));
    for (;;) { const j = A.jobOf(p.id); if (!j || ['done', 'failed', 'cancelled', 'error'].includes(j.status)) { say(JSON.stringify(j ?? job).slice(0, 600)); break; } await new Promise((r) => setTimeout(r, 1000)); }
    return done();
  }
  if (cmd === 'step') {
    const step = pos[2];
    const r = await A.runStep(step, p.path, { projectId: p.id, tightenPauses: false }, (l) => say('  ' + l));
    A.markDirty(p.id); A.writeContext(p.id); say(JSON.stringify(r ?? true).slice(0, 400)); return done();
  }
  if (cmd === 'export') {
    let last = '';
    // --silent: a video with no sound track at all. The app refuses to save a video whose soundtrack is silent, and it
    // adds no sound track when the project has none: the soundtrack files step aside for the export and come back.
    const aside = has('silent') ? ['clean.wav', 'final_mix.wav'].map((f) => path.join(p.path, 'audio', f)).filter((f) => fs.existsSync(f)) : [];
    for (const f of aside) fs.renameSync(f, f + '.silent-export');
    try {
      const r = await A.exportVideo(p.id, { name: flag('name', p.slug), stems: has('stems'), ...(flag('from') ? { from: +flag('from'), to: +flag('to') } : {}) },
        (o) => { const s = `${o.phase || 'Rendering'} ${Math.floor(o.frame / Math.max(1, o.frames) * 100)}%`; if (s !== last) { last = s; say(s); } });
      say(`DONE ${r.path} (${r.seconds}s, ${r.realtime}x real time)`); return done();
    } finally {
      for (const f of aside) { const t = fs.statSync(f + '.silent-export').mtime; fs.renameSync(f + '.silent-export', f); fs.utimesSync(f, t, t); }
    }
  }
  if (cmd === 'stills') {
    const times = pos.slice(2).map(Number), r = await A.checkedStills(p.id, times, +flag('scale', 0.5), 'cli');
    for (const s of r.shots) say(`${s.time}s ${s.file || '(error)'}`); if (r.bootError) say('BOOT ERROR ' + r.bootError); return done();
  }
  throw new Error(`Unknown command "${cmd}".`);
})().catch((e) => { console.error('ERROR:', e?.message || e); done(1); });
