// Toon Studio Style Kit: the RENDER checks (docs/STYLE_KIT_PLAN.md section 3, "Render"), run on a style folder through
// tools/serve.mjs in headless Chrome / Edge, the way the app runs them in its hidden render workers:
//   boot      every view loads in every declared aspect: no page error, no 404, no "not loaded" / fallback warning
//   layout    the engine's own layoutIssues (+ the 3D reconstruction collide probe) on every normal view
//   frames    BLANK / DARK / FROZEN / SAME on downscaled frames (thresholds of src/main/studio/checks.ts frameStat)
//   mustfail  every must-fail view fires the check it declares (`expect`)
//   export    5 s of the sample through the engine's exportVideo -> append sink -> ffmpeg -c:v copy -> ffprobe
//   repeat    a frame drawn after seeking elsewhere is the same frame drawn fresh (determinism)
//   controls  (optional) every control the style adds changes pixels between its two ends
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readJson, readStyle, settingsFor as baseSettingsFor, isMustFail, aspectTag, exists } from './kitlib.mjs';
import { baseDebt, RENDER_MEANING, layoutSeverity, declaredSeverities, structureOf, BLANK_LIMIT, REPEAT_MAX, REPEAT_HUGE_PX, repeatMoments, repeatSeverity } from './static.mjs';
// (the measures and rules the app's import uses too live in static.mjs: one copy, so the kit and the app always agree)
export { structureOf, BLANK_LIMIT, REPEAT_MAX, REPEAT_HUGE_PX };

/** The meaning half of each render finding: static.mjs holds it (the app's import page reads the same words). */
export { RENDER_MEANING };
const F = (id, sev, where, finding, fix) => ({ id, sev, where, finding: String(finding).slice(0, 400), meaning: RENDER_MEANING[id] ?? '', fix });

/** The style's own severities: skill/QUALITY.md lines "- severity EMPTY: high" (they may only raise a check: layoutSeverity). */
function qualityOf(dir) {
  let t = ''; try { t = fs.readFileSync(path.join(dir, 'skill', 'QUALITY.md'), 'utf8'); } catch { /* none */ }
  return declaredSeverities(t);
}
// checks.ts RECON_COLLIDE_PROBE (shots with figures must declare S.collide; declared bodies must stand on something)
const RECON_COLLIDE_PROBE = `(async () => {
  const E = window.E; if (!E || !Array.isArray(E.SHOTS) || typeof E.compose !== 'function') return null;
  const info = window.suite && window.suite.info ? window.suite.info() : null, end = info && info.end ? +info.end : 0, out = [];
  for (let i = 0; i < E.SHOTS.length; i++) {
    const d = E.SHOTS[i], nx = E.SHOTS[i + 1], t1 = d.t1 != null ? d.t1 : nx ? nx.t0 : (end || d.t0 + 4), mid = +(d.t0 + (t1 - d.t0) * .5).toFixed(2);
    try { E.compose(mid); } catch (e) { continue; }
    const S = d._S; if (!S || !S.scene) continue;
    let people = 0, rigged = 0; const casts = new Set();
    S.scene.traverse(o => { const u = o.userData || {};
      if (u.kind === 'person') people++;
      else if (u.castOf && Array.isArray(u.castOf.drawn) && u.castOf.drawn.length && !casts.has(u.castOf)) { casts.add(u.castOf); people += u.castOf.drawn.length; }
      else if (o.isSkinnedMesh) { let p = o.parent, inside = false; while (p) { if (p.userData && p.userData.kind === 'person') { inside = true; break; } p = p.parent; } if (!inside) rigged++; } });
    const support = [], THREE = E.THREE;
    if (S.collide && typeof S.collide.bodies === 'function' && THREE) {
      let bodies = []; try { bodies = S.collide.bodies() || []; } catch (e) { bodies = []; }
      const skip = new Set(), surfaces = [], vis = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };
      S.scene.traverse(o => { const u = o.userData || {}; if (u.kind === 'person') o.traverse(c => skip.add(c)); else if (u.castOf || o.isSkinnedMesh) skip.add(o); });
      S.scene.traverse(o => { if (o.isMesh && !skip.has(o) && !(o.userData && o.userData.airborne) && vis(o)) surfaces.push(o); });
      const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), UP = .25;
      for (const b of bodies.slice(0, 40)) {
        if (!b || b.airborne || !Array.isArray(b.caps)) continue;
        let low = null; for (const c of b.caps) for (const p of [c && c.a, c && c.b]) if (p && (low == null || p.y - (c.r || 0) < low.y)) low = { x: p.x, y: p.y - (c.r || 0), z: p.z };
        if (!low) continue;
        rc.set(new THREE.Vector3(low.x, low.y + UP, low.z), down); rc.far = 60;
        const hit = rc.intersectObjects(surfaces, false)[0]; if (!hit) continue;
        const gap = hit.distance - UP;
        if (gap > .15 || gap < -.08) support.push({ name: String(b.name || 'a body').slice(0, 60), gap: +gap.toFixed(3) });
      }
    }
    out.push({ i, name: String(d.name || ''), file: String(d._file || ''), line: +d._line || 0, t: mid, figures: people + (rigged ? 1 : 0), collide: !!S.collide, support });
    await new Promise(r => setTimeout(r, 0));
  }
  return out;
})()`;
/** In-page frame statistics on a 64-px-wide copy of the engine's frame (checks.ts frameStat: luma .2/.6/.2). */
const FRAMES_JS = times => `(async () => {
  const E = window.E, out = [], c = document.createElement('canvas');
  for (const t of ${JSON.stringify(times)}) {
    try { E.compose(t); } catch (e) { let d = null; try { d = E.SHOTS[E.activeIndex(t)]; } catch (e2) {} out.push({ t, error: String(e && e.message || e), file: d && d._file || null, line: d && d._line || null }); continue; }
    // (an exact area average of the half-size frame, like the app's stills at .5 resized to 64 px: no browser resampling
    // filter decides a borderline BLANK / DARK)
    const src = E.outCanvas, W2 = Math.round(src.width / 2), H2 = Math.round(src.height / 2), w = 64, h = Math.max(1, Math.round(64 * src.height / src.width));
    c.width = W2; c.height = H2; const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'medium';
    x.clearRect(0, 0, W2, H2); x.drawImage(src, 0, 0, W2, H2);
    const full = x.getImageData(0, 0, W2, H2).data, d = new Float32Array(w * h * 4), cnt = new Float32Array(w * h);
    for (let yy = 0; yy < H2; yy++) { const by = Math.min(h - 1, Math.floor(yy * h / H2)); for (let xx = 0; xx < W2; xx++) { const bx = Math.min(w - 1, Math.floor(xx * w / W2)), o = (yy * W2 + xx) * 4, b = by * w + bx; d[b * 4] += full[o]; d[b * 4 + 1] += full[o + 1]; d[b * 4 + 2] += full[o + 2]; cnt[b]++; } }
    for (let b = 0; b < w * h; b++) { const k = cnt[b] || 1; d[b * 4] /= k; d[b * 4 + 1] /= k; d[b * 4 + 2] /= k; }
    const n = w * h, L = new Array(n), hist = new Array(256).fill(0); let sum = 0, dark = 0;
    for (let i = 0; i < n; i++) { const v = (d[i * 4] * .2 + d[i * 4 + 1] * .6 + d[i * 4 + 2] * .2) / 255; L[i] = Math.round(v * 10000) / 10000; sum += v; hist[Math.min(255, Math.round(v * 255))]++; if (v < .06) dark++; }
    const q = p => { let k = 0, cnt = 0; const want = p * n; for (; k < 256; k++) { cnt += hist[k]; if (cnt >= want) return k / 255; } return 1; };
    out.push({ t, mean: sum / n, lo: q(.02), hi: q(.98), darkFrac: dark / n, small: L, w });
    await new Promise(r => setTimeout(r, 0));
  }
  return out; })()`;
/** In-page: the full-resolution frame at t as a hash (+ kept for a diff), after drawing `before` times first. */
const HASH_JS = (t, before, key) => `(async () => {
  const E = window.E;
  for (const b of ${JSON.stringify(before)}) { try { E.compose(b); } catch (e) {} await new Promise(r => setTimeout(r, 0)); }
  E.compose(${t});
  const src = E.outCanvas, c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data; let h = 2166136261 >>> 0;
  for (let i = 0; i < d.length; i += 1) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; }
  const keep = (window.__czRepeat ||= {}), prev = keep[${JSON.stringify(key)}]; let diff = null;
  if (prev && prev.length === d.length) { let n = 0, big = 0, huge = 0, max = 0; for (let i = 0; i < d.length; i += 4) { const m = Math.max(Math.abs(d[i] - prev[i]), Math.abs(d[i + 1] - prev[i + 1]), Math.abs(d[i + 2] - prev[i + 2])); if (m) n++; if (m > 16) big++; if (m > 48) huge++; if (m > max) max = m; } diff = { changed: n / (d.length / 4), big: big / (d.length / 4), huge, max }; }
  else keep[${JSON.stringify(key)}] = new Uint8ClampedArray(d);
  return { hash: h.toString(16), w: c.width, h: c.height, diff };
})()`;

// BLANK's measure (structureOf, BLANK_LIMIT) and the repeat rules (REPEAT_MAX, REPEAT_HUGE_PX, repeatMoments,
// repeatSeverity) are static.mjs's: their calibration notes live there.
const isDark = m => m.mean < .10 && m.hi < .35;

const diffOf = (a, b) => { if (!a || !b || a.small.length !== b.small.length) return 1; let s = 0; for (let i = 0; i < a.small.length; i++) s += Math.abs(a.small[i] - b.small[i]); return s / a.small.length; };
/** "st.box (scenes/x.js:12)" -> element, file, line. */
function parseWhat(what) {
  const m = /^(.*?)\s*\(([^():]+):(\d+)\)\s*$/.exec(String(what).trim());
  return m ? { element: m[1].trim() || null, file: m[2], line: +m[3] } : { element: String(what).trim() || null, file: null, line: null };
}
/** A page-logged error -> { file, line, t, msg } (host.js whereAt: "shot 5 (scenes/x.js:24) at 18.34s: msg"). */
function parseErr(text) {
  const m = /^shot (\d+) \(([^():]+):(\d+)\) at ([\d.]+)s: (.*)$/s.exec(text), ld = /^scene ([\w-]+\.js) failed to load: (.*)$/s.exec(text);
  return { file: m ? m[2] : ld ? `scenes/${ld[1]}` : null, line: m ? +m[3] : null, t: m ? +m[4] : null, msg: (m ? m[5] : ld ? ld[2] : text).trim() };
}
const HOST_URL = (server, style, view, settings, extra = '') => server.styleUrl(style, `__suite/host.html?mode=render&scenes=${encodeURIComponent(view.scenes.join(','))}&end=${+view.end || 0}&settings=${encodeURIComponent(JSON.stringify(settings))}${extra}`);

/** Open one view of a style in a render page and wait for it (window.ready). Returns { page, bootError, info }. */
export async function openView(browser, server, style, view, settings, { extra = '', onConsole = null } = {}) {
  const page = await browser.newPage(HOST_URL(server, style, view, settings, extra), { width: 1280, height: 720, onConsole });
  await page.waitFor('window.ready === true', 180000);
  const bootError = await page.evaluate('window.bootError || null', { timeout: 10000 });
  const info = bootError ? null : await page.evaluate('window.suite ? window.suite.info() : null', { timeout: 30000 });
  return { page, bootError, info };
}

/** Which console warnings are failures: anything that says a part did not load or fell back to a stand-in. */
const BAD_WARN = /not loaded|fallback|fall back|falls back|failed|missing|stand-in|instead|could not|cannot|unknown/i;
const IGNORE = /^\[\.WebGL-[^\]]*\]\s*GL_INVALID|GPU stall due to ReadPixels|Automatic fallback to software WebGL has been deprecated/i;

async function pool(items, n, f) { const out = new Array(items.length); let next = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { for (;;) { const k = next++; if (k >= items.length) return; out[k] = await f(items[k], k); } })); return out; }

/**
 * Every render check on styles/<name>. `browser` (cdp.mjs launch) and `server` (serve.mjs startServer) are the caller's.
 * @returns {Promise<{ findings: object[], pairs: object[], exports: Record<string, string> }>}
 */
export async function renderChecks(name, { browser, server, views: onlyViews = null, aspects: onlyAspects = null, controls = false, exportCheck = true, repeat = true, look = null, log = () => {} } = {}) {
  const st = readStyle(name), sev = qualityOf(st.dir), sevOf = type => layoutSeverity(type, sev);
  // the settings every render uses: the style's (base look < style.json defaults), and with --look that look's over them
  const settingsFor = (dir, a) => baseSettingsFor(dir, a, look?.settings ?? null);
  const aspects = st.aspects.filter(a => !onlyAspects?.length || onlyAspects.includes(a));
  const all = Object.entries(st.views).filter(([n, v]) => (!onlyViews?.length || onlyViews.includes(n)) && Array.isArray(v?.scenes) && v.scenes.length && +v.end > 0);
  const jobs = []; for (const [n, v] of all) { const must = isMustFail(n, v); for (const a of must ? aspects.slice(0, 1) : aspects) jobs.push({ n, v, a, must }); }
  const findings = [], pairs = [], seen = new Set();
  // (one finding per thing: the same message at another moment - numbers aside - is the same finding)
  const add = f => { const k = `${f.id}|${f.where.view}|${f.where.aspect}|${f.where.file ?? ''}:${f.where.line ?? ''}|${f.finding.replace(/\d+(\.\d+)?/g, '#')}`; if (seen.has(k)) return; seen.add(k); findings.push(f); };
  const probe = st.base === 'recon' ? RECON_COLLIDE_PROBE : null;
  const results = await pool(jobs, 3, async j => {
    const t0 = Date.now(), where = { view: j.n, aspect: j.a }, scene0 = `scenes/${j.v.scenes[0]}.js`;
    let page = null; const r = { j, ok: false, layout: null, stats: [], ms: 0 };
    try {
      const o = await openView(browser, server, name, j.v, settingsFor(st.dir, j.a));
      page = o.page; r.info = o.info;
      if (o.bootError) { add(F('boot', 'high', { ...where, file: scene0 }, `The ${j.n} view does not load (${j.a}): ${o.bootError}`, 'Fix the error it names (cz preview shows it with its line).')); return r; }
      r.ok = true;
      const shots = o.info?.shots ?? [], end = +j.v.end, clampT = t => +Math.max(0, Math.min(end - .02, t)).toFixed(2);
      // layout (the engine's own check) + the base's probe
      r.layout = await page.evaluate('window.suite.layout(null)', { timeout: 180000 });
      if (probe && !j.must && j.a === aspects[0]) r.probe = await page.evaluate(probe, { timeout: 120000 }).catch(() => null);
      // frames: the shots' middles (must-fail: only those), plus starts / ends on a sample view (FROZEN needs them)
      const mids = shots.map(s => clampT(s.t0 + ((s.t1 ?? end) - s.t0) * .5));
      let times = mids;
      if (!j.must) { const ends = shots.map(s => clampT(s.t0 + ((s.t1 ?? end) - s.t0) * .88)), starts = shots.map(s => clampT(s.t0 + ((s.t1 ?? end) - s.t0) * .12)); times = [...new Set([...mids, ...ends, ...starts])].slice(0, 30); }
      r.stats = times.length ? await page.evaluate(FRAMES_JS(times), { timeout: 30000 + times.length * 4000 }) : [];
      // the runtime sweep on the sample (every frame an export draws, for scenes that throw)
      if (!j.must && /^sample/i.test(j.n) && j.a === aspects[0]) r.sweep = await page.evaluate('window.suite.sweep ? window.suite.sweep(4) : null', { timeout: 300000 }).catch(e => ({ frames: 0, errors: [{ t: 0, where: '', message: e.message }] }));
      r.shots = shots;
      return r;
    } catch (e) { add(F('boot', 'high', { ...where, file: scene0 }, `The ${j.n} view does not load (${j.a}): ${e.message}`, 'Fix the error it names (cz preview shows it with its line).')); return r; }
    finally {
      if (page) {
        // everything the page said while it booted and drew: errors, 404s, fallback warnings
        for (const e of page.errors) { const p = parseErr(e); add(F('boot', 'high', { ...where, file: p.file ?? scene0, line: p.line }, `Page error in ${j.n} (${j.a}): ${p.msg}`, 'Fix the scene / engine code at that line.')); }
        for (const c of page.console) {
          if (IGNORE.test(c.text) || /^PROGRESS/.test(c.text)) continue;
          const p = parseErr(c.text), cue = /cue miss/i.test(c.text);
          if (c.level === 'error') add(F('boot', 'high', { ...where, file: p.file ?? scene0, line: p.line, t: p.t }, `${j.n} (${j.a}) logged an error: ${p.msg}`, 'Fix the error it names (the line is in the message).'));
          else if (cue) add(F('layout', 'medium', { ...where, file: p.file, line: p.line }, `CUE: ${c.text}`, 'Cue a word that is in the narration (audio/timeline.json).'));
          else add(F('boot', BAD_WARN.test(c.text) ? 'high' : 'low', { ...where, file: p.file, line: p.line }, `${j.n} (${j.a}) warned: ${c.text}`, BAD_WARN.test(c.text) ? 'Make the part it names load (a missing file, a wrong path, an asset the style must carry): a stand-in is never shipped.' : 'Look at the warning; fix it if it is the style\'s.'));
        }
        for (const f of page.failed) add(F('boot', 'high', { ...where, file: f.url ? decodeURIComponent(String(f.url).replace(/^https?:\/\/[^/]+\/p\/[^/]+\//, '')).split('?')[0] : null }, `${j.n} (${j.a}) requested a file that is not there: ${f.status ? `HTTP ${f.status}` : f.error} ${String(f.url).replace(/^https?:\/\/[^/]+/, '')}`, 'Put the file into the style (or fix the path that asks for it): the app serves exactly the same files.'));
        r.ms = Date.now() - t0; await page.close().catch(() => {});
      }
    }
  });
  for (const r of results) {
    const { j } = r, where = { view: j.n, aspect: j.a };
    pairs.push({ view: j.n, aspect: j.a, boot: r.ok, layout: !!r.layout, ms: r.ms });
    if (!r.ok) continue;
    const shots = r.shots ?? [], end = +j.v.end, stats = new Map();
    for (const s of r.stats) { if (s.error) add(F('boot', 'high', { ...where, t: s.t, file: s.file, line: s.line }, `${j.n} (${j.a}) throws at ${s.t}s${s.file ? ` (the shot of ${s.file}:${s.line})` : ''}: ${s.error}`, 'Fix the scene code that throws at that moment (cz stills renders it).')); else stats.set(s.t, s); }
    for (const e of r.sweep?.errors ?? []) { const p = parseErr(`${e.where}: ${e.message}`); add(F('boot', 'high', { ...where, file: p.file, line: p.line, t: e.t }, `A frame of ${j.n} throws at ${e.t}s${e.where ? ` (${e.where})` : ''}: ${e.message}`, 'Fix the scene code at that line: an export draws that frame too.')); }
    if (j.must) {
      const types = [...new Set((r.layout?.issues ?? []).map(i => String(i.type)))], want = String(j.v.expect ?? '');
      // (a frame can be both: a near-black shot shows next to nothing, so it measures BLANK and DARK)
      if (!r.layout) for (const m of stats.values()) for (const ft of [structureOf(m.small, m.w).blank ? 'BLANK' : null, isDark(m) ? 'DARK' : null]) if (ft && !types.includes(ft)) types.push(ft);
      if (!want || !types.some(t => t.toLowerCase() === want.toLowerCase())) add(F('mustfail', 'high', { ...where, file: `scenes/${j.v.scenes[0]}.js` }, `${j.n} no longer reports ${want || '(no expected check)'} (it reports ${types.join(', ') || 'nothing'}).`, `Restore the ${want} check in the engine (engine.js layoutIssues / lib) so ${j.n} fails again; never edit a must-fail scene.`));
      continue;
    }
    for (const i of r.layout?.issues ?? []) {
      const type = String(i.type ?? 'layout'), p = parseWhat(i.what ?? ''), o = i.other ? parseWhat(i.other) : null;
      const element = o?.element ? [p.element, o.element].filter(Boolean).sort().join(' + ') : p.element;
      const det = String(i.detail ?? ''), cut = det.indexOf(': ');
      add(F('layout', sevOf(type), { ...where, t: +i.t, file: p.file ?? o?.file ?? null, line: p.line ?? o?.line ?? null }, `${type.toUpperCase()}: ${element ?? ''} ${cut > 0 ? det.slice(0, cut) : det} (at ${(+i.t).toFixed(2)}s)`.replace(/\s+/g, ' ').trim(), cut > 0 ? det.slice(cut + 2) : 'Fix the element it names at that moment.'));
    }
    for (const p of Array.isArray(r.probe) ? r.probe : []) {
      const n = (+p.i || 0) + 1, file = /^[\w./-]+\.js$/.test(String(p.file)) ? String(p.file) : null;
      if (+p?.figures > 0 && !p.collide) add(F('layout', 'high', { ...where, t: p.t, file, line: +p.line || null }, `COLLISION NOT DECLARED: shot ${n}${p.name ? ` (${String(p.name).slice(0, 60)})` : ''} shows ${p.figures} figure${p.figures === 1 ? '' : 's'} but declares no S.collide = { bodies, solids }`,
        'In the shot\'s build: S.collide = { bodies: () => [{ name, caps: personCaps(p) }], solids: [the closed meshes they stand at or sit in] } (lib/collide.js; engine_api.md "S.collide").'));
      for (const b of Array.isArray(p?.support) ? p.support : []) { const cm = Math.round(Math.abs(+b.gap) * 100), up = +b.gap > 0;
        add(F('layout', 'high', { ...where, t: p.t, file, line: +p.line || null }, `${up ? 'SUPPORT' : 'SUNK'}: ${String(b.name).slice(0, 60)} in shot ${n} ${up ? `hangs ${cm} cm above what is under it` : `is ${cm} cm into the surface under it`}`,
          up ? 'Rest the body on the surface (within 3 cm), or mark a body that really flies, falls or swims { airborne: true } in S.collide.bodies.' : 'Lift the body (or its feet) onto the surface: nothing of it may go into the floor or the seat.')); }
    }
    // frames (every normal view: BLANK, DARK without a layout check, SAME; FROZEN on sample views, except on the stick
    // figure base, whose shots are stills by design)
    const motion = /^sample/i.test(j.n) && st.base !== 'stickman';
    shots.forEach((s, k) => {
      const t1 = s.t1 ?? end, mid = +Math.max(0, Math.min(end - .02, s.t0 + (t1 - s.t0) * .5)).toFixed(2), m = stats.get(mid);
      const w = { ...where, t: mid, file: s.file ?? null, line: s.line ?? null };
      if (!m) return;
      const S = structureOf(m.small, m.w);
      if (S.blank) add(F('frames', 'high', w, `BLANK: shot ${k + 1} of ${j.n} shows nothing but its background at ${mid}s (structure ${S.full.toFixed(2)}, centre ${S.centre.toFixed(2)}: a frame that shows something measures ${BLANK_LIMIT.full}+ overall or ${BLANK_LIMIT.centre}+ in its centre).`, 'Make the shot draw its elements (check they are inside the frame and visible).'));
      else if (!r.layout && isDark(m)) add(F('frames', 'high', w, `DARK: shot ${k + 1} of ${j.n} is too dark to read at ${mid}s (mean ${m.mean.toFixed(3)}, brightest 2 % ${m.hi.toFixed(2)}).`, 'Light the subject or lighten the background (never by turning text up).'));
      if (motion && t1 - s.t0 >= 2.5) {
        const a = stats.get(+Math.max(0, s.t0 + (t1 - s.t0) * .12).toFixed(2)), b = stats.get(+Math.min(end - .02, s.t0 + (t1 - s.t0) * .88).toFixed(2));
        if (a && b && diffOf(a, m) < .002 && diffOf(m, b) < .002) add(F('frames', sevOf('frozen'), w, `FROZEN: nothing moves in shot ${k + 1} of ${j.n} (${(t1 - s.t0).toFixed(1)} s).`, 'Bring elements in on their spoken words, or move the camera / an element over the shot.'));
      }
      const pv = k > 0 ? shots[k - 1] : null;
      if (pv) { const pm = stats.get(+Math.max(0, Math.min(end - .02, pv.t0 + ((pv.t1 ?? end) - pv.t0) * .5)).toFixed(2)); if (pm && diffOf(pm, m) < .0015) add(F('frames', sevOf('same'), w, `SAME: shots ${k} and ${k + 1} of ${j.n} look the same.`, 'Change what the second shot shows (a new subject, framing or layout), or merge the two shots.')); }
    });
  }
  const sample = Object.entries(st.views).find(([n, v]) => n === 'sample' && v?.scenes?.length) ?? Object.entries(st.views).find(([n, v]) => !isMustFail(n, v) && v?.scenes?.length);
  // repeat: the same moment, fresh vs after drawing other moments (first aspect)
  if (repeat && sample && (!onlyViews?.length || onlyViews.includes(sample[0]))) {
    const [vn, v] = sample, a = aspects[0], end = +v.end, where = { view: vn, aspect: a };
    let page = null;
    try {
      const o = await openView(browser, server, name, v, settingsFor(st.dir, a)); page = o.page;
      // one moment per shot of the sample (its middle), at most REPEAT_MAX spread over the video (time: each moment is
      // ~18 frames drawn); a view without shot info falls back to two moments
      const moments = repeatMoments(o.info?.shots ?? [], end);
      if (!o.bootError) for (const t of moments) {
        const key = `t${t}`;
        // fresh: the first frame drawn there. Then the same moment after jumping around (a scrubbed preview, a still) and
        // after playing the second before it (an export, a playing preview): state carried between frames shows up in one
        const far = [+(end * .95).toFixed(2), +(end * .1).toFixed(2), +(t + 1.3).toFixed(2), 0, +(end * .55).toFixed(2)];
        const lead = Array.from({ length: 10 }, (_, k) => +Math.max(0, t - 1 + k * .1).toFixed(3));
        const fresh = await page.evaluate(HASH_JS(t, [], key), { timeout: 60000 });
        for (const [how, before] of [['after jumping to other moments (a scrubbed preview, a still)', far], ['after playing the second before it (an export, a playing preview)', [...far.slice(0, 2), ...lead]]]) {
          const again = await page.evaluate(HASH_JS(t, before, key), { timeout: 120000 });
          if (fresh.hash === again.hash) continue;
          const d = again.diff, big = d ? d.big : 1;
          // high: a visible change (> 0.1 % of the pixels by more than 16 levels, or more than REPEAT_HUGE_PX pixels by more
          // than 48: a small thing in another place). A few pixels flipping a palette step (pixel art's dither and outline
          // thresholds turn GPU rounding into 1-2 art pixels, 9-18 screen pixels) is rounding, not state: low.
          if (!d || repeatSeverity({ big, huge: d.huge ?? 0 }) === 'high') add(F('repeat', 'high', { ...where, t }, `The frame at ${t}s of ${vn} is not the frame drawn there first when it is drawn ${how}: ${d ? `${(d.changed * 100).toFixed(2)} % of pixels differ, by up to ${d.max} levels` : 'a different size'}.`, 'Draw everything from the frame time t alone: no state carried between frames (counters, accumulated positions, particles, an animation mixer advanced by the time since the last frame instead of set to t, a wipe drawn before the camera moved).'));
          else add(F('repeat', 'low', { ...where, t }, `The frame at ${t}s of ${vn} differs very slightly when it is drawn ${how} (${(d.changed * 100).toFixed(2)} % of pixels, ${d.huge ?? 0} of them by more than 48 levels, at most ${d.max}).`, 'Probably GPU rounding; if it is visible, look for state carried between frames.'));
        }
      }
    } catch (e) { add(F('repeat', 'high', where, `The repeat check could not run on ${vn}: ${e.message}`, 'Fix the error it names, then check again.')); }
    finally { if (page) await page.close().catch(() => {}); }
  }
  // export: 5 s of the sample in each aspect -> mp4 (the app's encoder path)
  const exports = {};
  if (exportCheck && sample && (!onlyViews?.length || onlyViews.includes(sample[0]))) for (const a of aspects) {
    const where = { view: sample[0], aspect: a };
    try { exports[a] = await exportClip(name, { browser, server, view: sample[0], aspect: a, look, to: Math.min(5, +sample[1].end), out: path.join(st.dir, '.cz', 'check', `export_${aspectTag(a)}.mp4`), log }); }
    catch (e) { add(F('export', 'high', where, `A 5 s export of ${sample[0]} in ${a} failed: ${e.message}`, 'Fix what it names (a scene that throws while exporting names its line), then check again.')); }
  }
  // controls: each added control's two ends must look different
  if (controls && sample) {
    const added = Array.isArray(st.sj.controls?.add) ? st.sj.controls.add : [];
    for (const c of added) {
      const ends = c.type === 'range' ? [c.min, c.max] : c.type === 'toggle' ? [false, true] : c.type === 'select' && c.options?.length > 1 ? [c.options[0].value, c.options[c.options.length - 1].value] : null;
      if (!ends || ends.some(x => x == null)) continue;
      const a = aspects[0], t = +(+sample[1].end * .5).toFixed(2), shots = [];
      for (const val of ends) {
        const s = settingsFor(st.dir, a), keys = c.path.split('.'); let o = s; for (const k of keys.slice(0, -1)) { o[k] = { ...(o[k] && typeof o[k] === 'object' ? o[k] : {}) }; o = o[k]; } o[keys[keys.length - 1]] = val;
        let page = null; try { const r = await openView(browser, server, name, sample[1], s); page = r.page; shots.push((await page.evaluate(FRAMES_JS([t]), { timeout: 60000 }))[0]); } catch { shots.push(null); } finally { if (page) await page.close().catch(() => {}); }
      }
      if (shots[0] && shots[1] && !shots[0].error && !shots[1].error && diffOf(shots[0], shots[1]) < .002) add(F('controls', 'medium', { view: sample[0], aspect: a, t, file: 'style.json' }, `The control "${c.label || c.path}" (${c.path}) looks the same at ${JSON.stringify(ends[0])} and ${JSON.stringify(ends[1])}.`, `Make the engine read settings.${c.path} (or remove the control).`));
    }
  }
  // faults of the base engine itself (static.mjs BASE_DEBT): medium, said so, not blocking a style built on that engine
  for (const f of findings) {
    const debt = f.sev === 'high' ? baseDebt(st.base, f.id, st.sj?.from?.engineVersion) : null;
    if (debt) { f.sev = 'medium'; f.finding += ` This is a known fault of the base engine itself (${debt.why}), not of your style: it does not block the import, and it goes away when you rebase onto the fixed engine.`; }
  }
  return { findings, pairs, exports };
}

/** ffmpeg / ffprobe from PATH. */
export function tool(name) { const r = spawnSync(name, ['-version'], { windowsHide: true, encoding: 'utf8' }); return r.status === 0 ? (r.stdout.split('\n')[0] || name) : null; }
/** Probe a video: { codec, width, height, duration, frames }. */
export function probeVideo(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=codec_name,width,height,nb_read_packets:format=duration', '-of', 'json', file], { windowsHide: true, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffprobe could not read ${path.basename(file)}: ${(r.stderr || '').trim().slice(0, 200)}`);
  const j = JSON.parse(r.stdout), s = j.streams?.[0] ?? {};
  return { codec: s.codec_name, width: +s.width, height: +s.height, frames: +s.nb_read_packets, duration: +(+j.format?.duration).toFixed(3) };
}
/** Export [from, to] of a view through the engine's own encoder (append sink) and mux it with ffmpeg -c:v copy (+ the
 *  narration audio when the style has one and the clip starts at 0). Returns the mp4 path after ffprobe checked it. */
/** `cz export` makes development previews, not videos: at most this many seconds, with the kit's mark in the corner
 *  (finished videos come out of Toon Studio). The checks' and the package preview's own short exports carry no mark. */
export const KIT_EXPORT_MAX = 30;
const MARK_JS = (w, h) => `(() => { const s = ${Math.min(w, h)} / 1080, c = document.createElement('canvas'), x = c.getContext('2d');
  const text = 'Toon Studio Style Kit \\u00b7 preview', fs = Math.round(26 * s), pad = Math.round(14 * s);
  x.font = '600 ' + fs + 'px Inter, "Segoe UI", Helvetica, Arial, sans-serif'; const tw = Math.ceil(x.measureText(text).width);
  c.width = tw + pad * 2; c.height = fs + pad * 2; x.font = '600 ' + fs + 'px Inter, "Segoe UI", Helvetica, Arial, sans-serif';
  x.fillStyle = 'rgba(0,0,0,.55)'; const r = c.height / 2; x.beginPath(); x.roundRect(0, 0, c.width, c.height, r); x.fill();
  x.fillStyle = 'rgba(255,255,255,.92)'; x.textBaseline = 'middle'; x.fillText(text, pad, c.height / 2 + 1); return c.toDataURL('image/png'); })()`;

export async function exportClip(name, { browser, server, view = 'sample', aspect = null, from = 0, to = null, out = null, audio = false, look = null, mark = false, log = () => {} }) {
  const settingsFor = (dir, a) => baseSettingsFor(dir, a, look?.settings ?? null);
  const st = readStyle(name), v = st.views[view]; if (!v) throw new Error(`The style has no view "${view}" (project.json "views").`);
  const a = aspect ?? st.aspects[0]; if (!st.aspects.includes(a)) throw new Error(`The style renders ${st.aspects.join(' and ')}, not ${a}.`);
  if (!tool('ffmpeg')) throw new Error('ffmpeg is not on PATH (the Toon Studio installer installs it; cz doctor checks it).');
  const end = +v.end, t1 = Math.min(end, to ?? end, mark ? from + KIT_EXPORT_MAX : Infinity), fps = 30, nameOut = `cz_${view}_${aspectTag(a)}`.replace(/[^\w-]/g, '');
  let markPng = null;
  const h264 = path.join(st.dir, 'out', `${nameOut}.h264`); fs.rmSync(h264, { force: true });
  const { page, bootError } = await openView(browser, server, name, v, settingsFor(st.dir, a), { onConsole: (type, text) => { if (/^PROGRESS/.test(text)) log(text); } });
  let res;
  try {
    if (bootError) throw new Error(`the view does not load: ${bootError}`);
    res = await page.evaluate(`window.suite.exportVideo(${JSON.stringify({ name: nameOut, fps, from, to: t1, bitrate: 16e6 })})`, { timeout: Math.max(300000, (t1 - from) * 60000) });
    const errs = page.errors.concat(page.console.filter(c => c.level === 'error').map(c => c.text));
    if (errs.length) throw new Error(`the page reported: ${errs[0]}`);
    if (mark) {
      const [w0, h0] = a === '9:16' ? [1080, 1920] : [1920, 1080], url = await page.evaluate(MARK_JS(w0, h0), { timeout: 20000 });
      markPng = path.join(st.dir, 'out', '.kit-mark.png'); fs.writeFileSync(markPng, Buffer.from(String(url).split(',')[1], 'base64'));
    }
  } finally { await page.close().catch(() => {}); }
  if (!exists(h264) || fs.statSync(h264).size < 1000) throw new Error('the engine wrote no video (out/*.h264 is missing or empty)');
  const mp4 = out ?? path.join(st.dir, 'out', `${view}_${aspectTag(a)}.mp4`); fs.mkdirSync(path.dirname(mp4), { recursive: true });
  const mix = audio && from === 0 ? ['audio/final_mix.wav', 'audio/clean.wav', 'audio/narration.wav', 'audio/narration.mp3'].map(f => path.join(st.dir, f)).find(exists) : null;
  // with the mark: re-encoded with the kit's mark in the bottom-right corner; without: the engine's own stream, copied
  const ffArgs = markPng
    ? ['-y', '-loglevel', 'error', '-r', String(fps), '-i', h264, '-i', markPng, ...(mix ? ['-i', mix] : []),
      '-filter_complex', '[0:v][1:v]overlay=W-w-32:H-h-32[v]', '-map', '[v]', ...(mix ? ['-map', '2:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]
    : ['-y', '-loglevel', 'error', '-r', String(fps), '-i', h264, ...(mix ? ['-i', mix, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []), '-c:v', 'copy', '-movflags', '+faststart', mp4];
  const r = spawnSync('ffmpeg', ffArgs, { windowsHide: true, encoding: 'utf8' });
  if (markPng) fs.rmSync(markPng, { force: true });
  if (r.status !== 0) throw new Error(`ffmpeg could not mux the video: ${(r.stderr || '').trim().slice(-300)}`);
  fs.rmSync(h264, { force: true });
  const p = probeVideo(mp4), want = a === '9:16' ? [1080, 1920] : [1920, 1080], frames = Math.round((t1 - from) * fps);
  if (p.codec !== 'h264') throw new Error(`the video is ${p.codec}, not H.264`);
  if (p.width !== want[0] || p.height !== want[1]) throw new Error(`the video is ${p.width}x${p.height}, not ${want[0]}x${want[1]} (${a})`);
  if (Math.abs(p.frames - frames) > 2) throw new Error(`the video has ${p.frames} frames, not ${frames}`);
  return { file: mp4, ...p, render: res };
}
