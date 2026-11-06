// Character viewer (Toon Studio, flat style): served at /c/<id>/charview.html next to that character's character.js
// (models.js imports it), with the engine and models of the app's flat template. Used by the app for:
//   live preview (default)      the character idling through poses and expressions (the Characters tab, New project)
//   window.still(look?, o)      a thumbnail (PNG data URL)
//   window.gen(seed)            randomLook(seed) from the rig's trait catalog
//   window.check(look?)         the element gate on the whole character: every pose and expression built alone and
//                               measured with the engine's layout check (shading/detail outside the form, cut-offs)
//   window.sheet(looks, o)      many characters in one frame (visual QA of the trait catalog)
// look = null/undefined means this folder's character.js (with its parts); an object means that look.
globalThis.__CZ_SETTINGS = { format: 'vertical', captions: { on: false, size: 56 }, post: { grain: 0, vignette: 0 }, camera: { push: 0, punch: 0 }, transitions: { duration: .3 } };
try {
  const E = await import('./engine.js');
  const M = await import('./models.js');
  const Q = new URLSearchParams(location.search);
  const view = document.getElementById('view'), vx = view.getContext('2d');
  const BG = Q.get('bg') || 'night';
  const mk = (look, o = {}) => (look ? { look, ...o } : { ...o });

  // replace every shot (the old ones' GPU memory is freed)
  function setShots(defs, end) {
    for (const s of E.SHOTS) s._S?.scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.map?.dispose?.(); x.dispose(); }); });
    E.SHOTS.splice(0); defs.forEach(d => E.shot(d)); E.finalizeShots(end);
  }
  const crop = (h = 1440, y0 = (1920 - h) / 2) => { vx.clearRect(0, 0, view.width, view.height); vx.drawImage(E.outCanvas, 0, y0, 1080, h, 0, 0, view.width, view.height); };

  // ---- idle cycle: a pose and an expression every 1.6 s, eased, with follow-through; loops seamlessly every 9.6 s
  const T = 9.6, KEYS = [[0, 'rest'], [1.6, 'wave'], [3.2, 'think'], [4.8, 'cheer'], [6.4, 'shrug'], [8, 'hipsOut'], [9.0, 'rest']];
  const FACES = [[0, 'open', 'smile', 0], [1.6, 'happy', 'grin', .2], [3.2, 'open', 'flat', .5], [4.8, 'happy', 'grin', .1], [6.4, 'open', 'o', -.7], [8, 'open', 'smile', .3], [9.0, 'open', 'smile', 0]];
  const poseAt = t => {
    const u = ((t % T) + T) % T; let i = 0; KEYS.forEach((k, j) => { if (u >= k[0]) i = j; });
    const a = M.POSES[KEYS[Math.max(0, i - 1)][1]], b = M.POSES[KEYS[i][1]], k = E.E.inOutCubic(E.seg(u, KEYS[i][0], KEYS[i][0] + .45));
    const p = M.mixPose(i ? a : b, b, i ? k : 1);
    if (KEYS[i][1] === 'wave') p.armR = [p.armR[0], p.armR[1] + Math.sin(u * 9) * .35 * k];
    p.look = [Math.sin(u * .7) * 6, Math.sin(u * .9) * 3]; p.head = (p.head || 0) + Math.sin(u * 1.3) * .02;
    return p;
  };
  function liveShot(look, scale = 1.55) {
    return { t0: 0, trans: 'cut', build(S) { S.bg(BG); const st = {};
      st.shadow = S.shadow(250 * scale, 0, -560); st.hero = M.character(S.root, mk(look, { scale })); M.placeOnGround(st.hero, 0, scale, -560); return st; },
      update(st, t) { M.drive(st.hero, poseAt, t); M.expr(st.hero, ((t % T) + T) % T, FACES, .7); } };
  }

  // ---- the gate: every pose x expression alone, plus flipped, walking and a close-up of the head
  const SET = [['rest', 'open', 'smile'], ['wave', 'happy', 'grin'], ['think', 'half', 'flat'], ['cheer', 'shut', 'o'], ['shrug', 'open', 'frown'], ['walk', 'open', 'smile', { flip: true }], ['hipsOut', 'happy', 'grin', { close: true }]];
  function checkShots(look) {
    return SET.map(([pose, eyes, mouth, o = {}], i) => ({ t0: i, trans: 'cut', name: `${pose} ${eyes} ${mouth}${o.flip ? ' flipped' : ''}${o.close ? ' close-up' : ''}`,
      build(S) { S.bg(BG); const st = {}, sc = o.close ? 2.3 : 1;
        st.hero = M.character(S.root, mk(look, { scale: sc, flip: !!o.flip })); M.placeOnGround(st.hero, 0, sc, o.close ? -1050 : -420);
        M.pose(st.hero, pose === 'walk' ? M.walkPose(.3) : M.POSES[pose]); M.setFace(st.hero, eyes, mouth, .4); return st; },
      update(st) { M.pose(st.hero, pose === 'walk' ? M.walkPose(.3) : M.POSES[pose]); M.setFace(st.hero, eyes, mouth, .4); } }));
  }
  window.check = (look = null) => {
    setShots(checkShots(look), SET.length);
    const issues = [];
    SET.forEach((_, i) => { for (const x of E.layoutIssues(i + .5)) if (x.type === 'shading' || (x.type === 'cut' && i < SET.length - 1)) issues.push({ shot: E.SHOTS[i].name, type: x.type, detail: x.detail }); });
    // size sanity: a character is about 640 px tall at scale 1; parts must not blow it up or leave it tiny
    setShots([liveShot(look, 1)], 1); E.compose(.5);
    const b = new (E.THREE.Box3)().setFromObject(E.SHOTS[0]._st.hero), w = b.max.x - b.min.x, h = b.max.y - b.min.y;
    if (h < 420 || h > 1000 || w > 700) issues.push({ shot: 'size', type: 'size', detail: `${Math.round(w)} x ${Math.round(h)} px at scale 1 (expected about 300-500 x 640)` });
    return { ok: !issues.length, issues, size: [Math.round(w), Math.round(h)] };
  };
  window.gen = seed => M.randomLook(seed);
  window.still = (look = null, { t = .4, size = 480, scale = 1.25 } = {}) => {
    setShots([{ ...liveShot(look, scale), update(st, tt) { M.pose(st.hero, M.POSES.rest); M.setFace(st.hero, 'open', 'smile', .2); } }], 2);
    E.compose(t);
    const c = document.createElement('canvas'); c.width = c.height = size;
    // the frame's centre square, moved down so the character sits in it (hips at y -304 with scale 1.25)
    c.getContext('2d').drawImage(E.outCanvas, 0, 1920 / 2 - 540 + 120, 1080, 1080, 0, 0, size, size);
    return c.toDataURL('image/png');
  };
  window.sheet = (looks, { cols = 3, scale = .62, pose = 'rest', eyes = 'open', mouth = 'smile' } = {}) => {
    const cw = 1080 / cols, rh = 760 * scale;                              // a character is ~720 px tall at scale 1
    setShots([{ t0: 0, trans: 'cut', build(S) { S.bg(BG); const st = {};
      looks.forEach((l, i) => { const ch = M.character(S.root, mk(l, { scale })), cx = -540 + cw * (i % cols + .5), gy = 900 - rh * (Math.floor(i / cols) + 1) + 40 * scale;
        M.placeOnGround(ch, cx, scale, gy); M.pose(ch, pose === 'walk' ? M.walkPose(.3) : M.POSES[pose]); M.setFace(ch, eyes, mouth, .3); st['c' + i] = ch; });
      return st; } }], 1);
    E.compose(.5); return E.outCanvas.toDataURL('image/png');
  };
  window.info = () => ({ name: M.MAIN_NAME ?? null });

  if ((Q.get('mode') || 'live') === 'live') {
    setShots([liveShot(null)], 1e6);
    const t0 = performance.now();
    const loop = () => { E.compose((performance.now() - t0) / 1000); crop(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  window.ready = true;
} catch (e) { window.bootError = String(e?.stack || e); console.error(e); }
