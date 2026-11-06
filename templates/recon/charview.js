// Characters preview (3D reconstruction, lib/figures.js): served by the app at /fv/charview.html from templates/recon (the
// engine, rig and wardrobe that projects get) in an iframe of the Look panel and New project. Same local server and
// Host checks as every other page; nothing here reads project files.
//   ?theme=investigation|studio  &fig=<json { role, body, finish, color }>  &act=stand|sit|walk|typing|phone|handsOnHead|cuffed|think|talk
//   &spin=1|0  &mode=tool (no animation loop: the app's tests and portraits drive it)
//   postMessage({ type: 'cz-fig', fig, act, spin }) from the app swaps the figure without a reload
//   postMessage({ type: 'cz-portrait', id, fig }) -> parent gets { type: 'cz-portrait', id, url } (a small still of that figure)
//   window.portrait(fig, { act, ry, w, h }) -> PNG data URL     window.rosters() -> listFigures()
//   window.checkFig(fig, acts?) -> { act: clipReport } (how much body shows through the clothes in each standard pose)
const Q = new URLSearchParams(location.search);
const THEME = Q.get('theme') === 'studio' ? 'studio' : 'investigation', TOOL = Q.get('mode') === 'tool';
globalThis.__CZ_SETTINGS = { theme: THEME, quality: { ss: 1 }, post: { grain: .006, vignette: THEME === 'studio' ? .05 : .2, ao: true } };
// a model from the user's library (rig 'model') is previewed straight from the library, before any project has it
globalThis.__CZ_FIG_URL = k => k.startsWith('model:') ? new URL('libmodel/' + encodeURIComponent(k.slice(6).split('/').pop()), location.href).href : null;
const view = document.getElementById('view'), vx = view.getContext('2d');
const parse = s => { try { const o = JSON.parse(s); return o && typeof o === 'object' ? o : null; } catch { return null; } };
try {
  const E = await import('./engine.js'), M = await import('./models.js'), F = await import('./lib/figures.js'), { THREE, MAT } = E;
  const cur = { fig: parse(Q.get('fig')) || { role: 'main' }, act: Q.get('act') || 'stand', spin: Q.get('spin') !== '0', ry: -.45 };
  const furniture = (g, act, hum) => {
    if (act !== 'sit' && act !== 'typing') return; const u = hum ? .08 : 0, z = hum ? -.17 : 0;   // the clips sit on a 0.45 m seat, the pelvis 0.34 m behind the root
    M.mesh(M.box(.46, .05 + u, .44, .01), MAT.clay2, [0, .345 + u / 2, -.04 + z], [0, 0, 0], g);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.mesh(M.box(.035, .32 + u, .035, .006), MAT.clay3, [a * .2, .16 + u / 2, -.04 + z + b * .19], [0, 0, 0], g);
    M.mesh(M.box(.46, .42, .04, .01), MAT.clay2, [0, .59 + u, -.27 + z - .06], [-.08, 0, 0], g);
    if (act === 'typing') { M.mesh(M.box(.9, .035, .5, .006), MAT.clay2, [0, .7225, .5], [0, 0, 0], g); M.mesh(M.box(.42, .015, .14, .004), MAT.dark, [0, .748, .44], [0, 0, 0], g);
      for (const a of [-1, 1]) M.mesh(M.box(.03, .705, .44, .006), MAT.clay3, [a * .42, .3525, .5], [0, 0, 0], g); }
  };
  const framing = act => act === 'sit' || act === 'typing' ? { p: [0, 1.0, 3.1], l: [0, .72, .12], fov: 32 } : act === 'handsOnHead' || act === 'phone' ? { p: [0, 1.06, 3.55], l: [0, 1.0, 0], fov: 33 } : { p: [0, 1.0, 3.4], l: [0, .93, 0], fov: 33 };
  // v16: every character is one of the two mannequin bodies (old rig values map onto them); 'custom:<id>' = the user's own (/fv/__chars3d/)
  const needs = fig => ['mq', ...(typeof fig?.body === 'string' && fig.body.startsWith('custom:') ? [fig.body] : [])];
  function setShot(fig, act, o = {}) {
    for (const s of E.SHOTS) s._S?.scene.traverse(x => { if (x.isMesh && !x.userData.shared) x.geometry?.dispose?.(); });
    E.SHOTS.splice(0);
    E.shot({ t0: 0, trans: 'cut', name: 'character', build(S) {
      S.recon = false;
      S.studio({ fog: [30, 90], area: 3, key: [2.2, 4.6, 3.6], keyI: THEME === 'studio' ? 1.6 : 3.1, hemi: THEME === 'studio' ? 1.1 : 2.4, target: [0, .9, 0], rim: [-2.5, 3.2, -3.5], rimI: 1.6 });
      if (THEME !== 'studio') S.sky('#232a33', '#11151a', '#0c0e11');   // a soft graded backdrop: dark outfits keep their silhouette
      const tt = new THREE.Group(); S.scene.add(tt); furniture(tt, act, F.figureSpec(fig).rig === 'mq');
      const f = F.figure({ ...fig, parent: tt, act, t: o.actT ?? 0 });
      S.camera([{ t: 0, ...(o.cam ?? framing(act)) }]);
      return { f, tt };
    }, update(st, t) {
      st.tt.rotation.y = o.ry ?? (cur.spin && !TOOL ? cur.ry + t * .42 : cur.ry);
      if (o.seq) st.f.sequence(o.seq, t); else if (act === 'walk') st.f.act('walk', { phase: t * .85 }); else st.f.act(act, { t: o.actT ?? t });   // (every action plays: the live preview shows the motion)
    } });
    E.finalizeShots(1e6);
  }
  const crop = (w = view.width, h = view.height, c = view) => { const x = c.getContext('2d'), src = E.outCanvas, sh = src.height, sw = Math.min(src.width, sh * w / h);
    x.clearRect(0, 0, w, h); x.drawImage(src, (src.width - sw) / 2, 0, sw, sh, 0, 0, w, h); };
  let t0 = performance.now(), busy = false, gen = 0;
  async function show(fig, act) {
    const my = ++gen; busy = true;
    try { await F.loadFigures(needs(fig)); } catch (e) { console.warn('figure model: ' + e.message); }
    if (my !== gen) return; cur.fig = fig; cur.act = act; setShot(fig, act); t0 = performance.now(); busy = false;
    if (TOOL) { E.compose(.4); crop(); }
  }
  let queue = Promise.resolve();
  addEventListener('message', e => { const d = e.data; if (e.source !== parent || !d || d.type !== 'cz-portrait' || typeof d.id !== 'string') return;
    queue = queue.then(async () => { try { const url = await window.portrait(d.fig && typeof d.fig === 'object' ? d.fig : {}, { act: 'stand', ry: -.35, w: 120, h: 160, cam: { p: [0, 1.05, 3.3], l: [0, .9, 0], fov: 33 } });
      parent.postMessage({ type: 'cz-portrait', id: d.id, url }, '*'); } catch (err) { console.warn('portrait: ' + err.message); } setShot(cur.fig, cur.act); t0 = performance.now(); if (TOOL) { E.compose(.4); crop(); } }); });
  addEventListener('message', e => { const d = e.data; if (e.source !== parent || !d || d.type !== 'cz-fig') return;
    if (typeof d.spin === 'boolean') cur.spin = d.spin; show(d.fig && typeof d.fig === 'object' ? d.fig : cur.fig, typeof d.act === 'string' ? d.act : cur.act); });
  await show(cur.fig, cur.act);
  if (!TOOL) {
    let last = 0;
    const frame = now => { requestAnimationFrame(frame); if (busy || document.hidden || now - last < 33) return; last = now; try { E.compose((now - t0) / 1000); crop(); } catch (e) { console.warn(e.message); } };
    requestAnimationFrame(frame);
  }
  window.rosters = () => F.listFigures();
  window.current = () => { const f = E.SHOTS[0]?._st?.f; return { fig: cur.fig, act: cur.act, spin: cur.spin, rig: f?.rig ?? null, body: f?.figure?.body ?? null, finish: f?.figure?.finish ?? null, color: f?.figure?.color ?? null }; };
  window.portrait = async (fig, o = {}) => {
    await F.loadFigures(needs(fig)); setShot(fig, o.act ?? 'stand', { ry: o.ry ?? -.45, cam: o.cam, actT: o.actT }); E.compose(o.t ?? .4);
    const c = document.createElement('canvas'); c.width = o.w ?? 240; c.height = o.h ?? 320; crop(c.width, c.height, c); return c.toDataURL('image/png');
  };
  window.checkFig = async (fig, acts = ['stand', 'sit', 'walk', 'typing', 'phone', 'handsOnHead']) => {
    await F.loadFigures(needs(fig)); const out = {};
    for (const act of acts) { setShot(fig, act, { ry: 0 }); E.compose(.25); const st = E.SHOTS[0]._st; out[act] = st.f.clipReport(); }
    return out;
  };
  // window.smoothness(fig, seq, { from, to, instant }) -> per-frame (30 fps) max joint rotation change (deg) and pelvis velocity
  // jump (m/s) over [from, to] of a human figure's sequence(seq), plus the same for each step's clip alone (natural motion)
  // and whether a frame rendered alone equals the frame played through (stateless)
  window.smoothness = async (fig, seq, o = {}) => {
    await F.loadFigures(needs(fig)); setShot(fig, 'stand', { ry: 0 }); E.compose(0); const f = E.SHOTS[0]._st.f; if (f.rig !== 'human') return { error: 'rig ' + f.rig };
    const bones = []; f.group.traverse(b => { if (b.isBone && !/index|middle|ring|pinky|thumb/.test(b.name)) bones.push(b); });
    const pel = bones.find(b => /pelvis/i.test(b.name)) ?? bones[0], snap = () => ({ q: bones.map(b => b.quaternion.clone()), p: pel.getWorldPosition(new THREE.Vector3()) });
    const sweep = s => { const out = []; for (let k = 0; (o.from ?? .5) + k / 30 <= (o.to ?? 2.2) + 1e-6; k++) { f.sequence(s, (o.from ?? .5) + k / 30); out.push(snap()); } return out; };
    const measure = fr => { let rot = 0, jump = 0, v0 = null; for (let k = 1; k < fr.length; k++) { for (let i = 0; i < bones.length; i++) rot = Math.max(rot, 2 * Math.acos(Math.min(1, Math.abs(fr[k].q[i].dot(fr[k - 1].q[i])))));
      const v = fr[k].p.clone().sub(fr[k - 1].p).multiplyScalar(30); if (v0) jump = Math.max(jump, v.distanceTo(v0)); v0 = v; } return { rot: +(rot * 180 / Math.PI).toFixed(2), jump: +jump.toFixed(3) }; };
    const fr = sweep(seq), res = { smooth: measure(fr), instant: measure(sweep(seq.map((s, i) => i ? { ...s, blend: 1e-4 } : s))) };
    const nat = seq.map(s => measure(sweep([{ ...s, t0: 0 }]))); res.natural = { rot: Math.max(...nat.map(n => n.rot)), jump: Math.max(...nat.map(n => n.jump)) };
    const k = Math.round((((o.from ?? .5) + (o.to ?? 2.2)) / 2 - (o.from ?? .5)) * 30), tk = (o.from ?? .5) + k / 30; f.sequence(seq, 9); f.sequence(seq, tk);
    const alone = snap(); let da = 0, wb = ''; alone.q.forEach((q, i) => { const a = 2 * Math.acos(Math.min(1, Math.abs(q.dot(fr[k].q[i])))) * 180 / Math.PI; if (a > da) { da = a; wb = bones[i].name; } });
    res.aloneDiff = { deg: +da.toFixed(4), bone: wb, mm: +(alone.p.distanceTo(fr[k].p) * 1000).toFixed(3) }; res.stateless = da < .05 && res.aloneDiff.mm < .5;   // float noise only
    return res;
  };
  // window.burst(fig, seq, times, { act (furniture), ry, w, h }) -> one PNG data URL: the frames at `times` side by side
  window.burst = async (fig, seq, times, o = {}) => {
    await F.loadFigures(needs(fig)); setShot(fig, o.act ?? 'stand', { ry: o.ry ?? -.6, seq }); const w = o.w ?? 200, h = o.h ?? 270;
    const c = document.createElement('canvas'); c.width = w * times.length; c.height = h; const cx = c.getContext('2d'), one = document.createElement('canvas'); one.width = w; one.height = h;
    times.forEach((t, i) => { E.compose(t); crop(w, h, one); cx.drawImage(one, i * w, 0); }); return c.toDataURL('image/png');
  };
  // window.repeatPixels(fig, seq, t) -> pixels that differ (> 8 levels) between the frame at t rendered first, again straight
  // away, and again after a seek to t + 1.3 (determinism: preview == export, any frame alone == the frame played through)
  window.repeatPixels = async (fig, seq, t, o = {}) => {
    await F.loadFigures(needs(fig)); setShot(fig, o.act ?? 'stand', { ry: o.ry ?? -.6, seq }); const w = 240, h = 320, one = document.createElement('canvas'); one.width = w; one.height = h;
    const grab = tt => { E.compose(tt); crop(w, h, one); return one.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data; };
    const a = grab(t), b = grab(t); grab(t + 1.3); const c = grab(t); let n = 0;
    for (let i = 0; i < a.length; i += 4) if (Math.max(...[0, 1, 2].map(k => Math.max(Math.abs(a[i + k] - b[i + k]), Math.abs(a[i + k] - c[i + k])))) > 8) n++;
    return n;
  };
  window.ready = true;
  if (parent !== window) parent.postMessage({ type: 'cz-ready' }, '*');   // (the picker asks for its row portraits now)
} catch (e) {
  vx.fillStyle = '#07080a'; vx.fillRect(0, 0, view.width, view.height); vx.fillStyle = '#a7aeb1'; vx.font = '22px sans-serif'; vx.fillText('The preview could not start:', 30, 60); vx.fillText(String(e.message).slice(0, 60), 30, 96);
  console.error(e); window.ready = 'error: ' + e.message;
}
