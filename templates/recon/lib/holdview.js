// Hold viewer (3D reconstruction, engine v17+): ONE hold combo - a person (body, finish), a prop (any prop function, kit or
// the project's own), a grip, a hand - played through clips and rendered CLOSE UP from several angles into one sheet, with
// the HOLD check's numbers (lib/hands.js holdIssues: the real meshes). The SOP step before a new prop / grip / clip is used
// in a scene (docs/CHARACTER_SOP.md, the skill's references/hands.md). Served from a project folder:
//   <project>/lib/holdview.html?body=male|female|custom:<id>&finish=matte|glossy|glow&color=%23rrggbb
//     &mod=<path from the project root, default lib/props.js>&fn=<export, default 'prop'>&args=<json array, e.g. ["mug"]>
//     &grip=<grip name, default the prop's first>&side=R|L&use=<USES name>&clip=<clip,clip,...>&times=<s,s,...>
//     &views=<face,out,pov,below,front,side,top,back,in>&t0=&t1=&table=<m: pick-up from a table this high>&theme=studio|investigation
// window.viewHold(o?) -> Promise<{ png: dataURL, report: { kind, grip, side, body, finish, use, verified (VERIFIED table),
//   clean (no HOLD issue in any cell), rows: [{ clip, t, issues: [text], handIn_mm, bodyIn_mm, palmGap_mm, gaps_mm: {finger: mm},
//   second_mm, scene, handScene, ear_cm }], solve: { shift_mm, fingers_mm, second_mm }, grips: [names], warnings: [] } }>
//   o: the URL's keys as an object ({ body, finish, color, mod, fn, args, grip, side, use, clips: [], times: [], views: [],
//   t0, t1, table }) - one page can check many combos. window.ready = true | 'error: ...'.
const Q = new URLSearchParams(location.search);
const THEME = Q.get('theme') === 'investigation' ? 'investigation' : 'studio';
globalThis.__CZ_SETTINGS = { theme: THEME, quality: { ss: 1 }, post: { grain: 0, vignette: 0, ao: true } };
const sheet = document.getElementById('sheet'), sx = sheet.getContext('2d');
const parse = s => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const list = s => s == null || s === '' ? null : String(s).split(',').map(x => x.trim()).filter(Boolean);
const safeMod = m => { if (typeof m !== 'string' || !/^[\w./-]+\.js$/.test(m) || m.split('/').includes('..') || m.startsWith('/')) throw new Error(`mod "${m}" must be a .js path inside the project, like lib/props.js`); return new URL('../' + m, location.href).href; };
try {
  const E = await import('../engine.js'), { THREE } = E, FIG = await import('./figures.js'), PR = await import('./props.js'), HA = await import('./hands.js');
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), INV = THEME === 'investigation';
  const SEATED = /sit|typing(?!_?stand)|driv/i, DEFAULT_CLIPS = ['Idle_Loop', 'Walk_Loop', 'Idle_Talking_Loop', 'Sitting_Idle_Loop', 'KK_Sit_Chair_Idle_Loop'];
  const KIND_OPTS = { laptop: { open: 0 } }, KIND_JOB = { 'steering wheel': { chestAt: [-.04, .4], clips: ['Driving_Loop'] } };
  // views around a target: [azimuth from the person's forward toward the holding side (deg), elevation (deg)]
  const VIEWS = { front: [35, 12], side: [100, 4], top: [40, 62], under: [20, -38], back: [210, 10], face: [0, 8], out: [80, 30], below: [0, -42], high: [0, 55], in: [-30, 15] };
  const viewOf = (name, target, dist, side, fwd) => { const [az, el] = VIEWS[name] ?? VIEWS.front, a = az * Math.PI / 180 * (side === 'l' ? 1 : -1), e = el * Math.PI / 180;
    const f0 = fwd.clone().setY(0).normalize(), r0 = V3().crossVectors(V3(0, 1, 0), f0).normalize(), d = f0.clone().multiplyScalar(Math.cos(a)).addScaledVector(r0, Math.sin(a)).multiplyScalar(Math.cos(e)).add(V3(0, Math.sin(e), 0));
    return { p: target.clone().addScaledVector(d, dist), l: target.clone(), fov: 30 }; };
  let VIEW = null, FRAME = null, ST = null, KEY = null, cur = null;
  function setShot(look) {   // one shot: the studio, a stool for seated clips, the person (rebuilt when the look changes)
    const k = JSON.stringify(look); if (KEY === k && ST) return ST; KEY = k; E.SHOTS.splice(0); ST = {};
    E.shot({ t0: 0, trans: 'cut', name: 'hold', build(S) {
      S.recon = false; if (S.post) S.post.dof = null; S.visibility = false;
      S.studio({ floor: true, near: .01, far: 60, fog: [40, 90], key: [2.5, 5, 4], target: [0, 1, 0], area: 5, keyI: INV ? 2.6 : 1.5, hemi: INV ? 2.2 : 1.3, rim: [-3, 3, -4] });
      ST.S = S; ST.f = FIG.figure('extra', { parent: S.scene, x: 0, z: 0, ry: 0, act: 'stand', name: 'holder', ...look });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(.44, FIG.SEAT_H ?? .45, .42), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: .7 })); seat.name = 'stool'; seat.castShadow = seat.receiveShadow = true; seat.visible = false; S.scene.add(seat); ST.seat = seat;
      return {};
    }, update(s, t, S) { FRAME?.(t); const v = VIEW; if (v) { S.cam.position.copy(v.p); S.cam.up.set(0, 1, 0); S.cam.lookAt(v.l); S.look?.copy(v.l); if (S.cam.fov !== v.fov) { S.cam.fov = v.fov; S.cam.updateProjectionMatrix(); } } } });
    E.finalizeShots(1e6); E.compose(0); return ST;
  }
  function cell(g, x, y, size, label, bad) {
    const W = E.outCanvas.width, H = E.outCanvas.height, c = Math.min(W, H);
    g.drawImage(E.outCanvas, (W - c) / 2, (H - c) / 2, c, c, x, y, size, size);
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, y, size, 22); g.fillStyle = bad ? '#ff6060' : '#9fe29f'; g.font = '13px monospace'; g.fillText(label, x + 5, y + 15);
  }
  async function viewHold(o = {}) {
    const g = k => o[k] ?? Q.get(k);
    const body = g('body') || 'male', finish = g('finish') || 'matte', color = g('color') || '#b9b2a6', warnings = [];
    if (/^custom:/.test(body)) await FIG.loadFigures([body]);
    const st = setShot({ body, finish, color }), S = st.S, f = st.f;
    if (cur) { cur.h?.release(); cur.prop?.removeFromParent(); for (const x of cur.extra || []) x.removeFromParent(); cur = null; }
    S._placed = (S._placed || []).filter(r => r.item.parent);
    const mod = g('mod') || 'lib/props.js', fn = g('fn') || 'prop', args = o.args ?? parse(Q.get('args')) ?? ['mug'];
    const M = await import(safeMod(mod)); if (typeof M[fn] !== 'function') throw new Error(`${mod} has no export "${fn}"`);
    const kind0 = String(args[0] ?? ''), a2 = [...args]; if (fn === 'prop' && a2.length < 2 && KIND_OPTS[kind0]) a2[1] = KIND_OPTS[kind0];
    let prop = await M[fn](...a2); prop = prop?.isObject3D ? prop : prop?.group ?? null; if (!prop) throw new Error(`${fn}(...) did not return an object`);
    const kind = prop.userData?.prop?.kind ?? prop.name ?? kind0, grips = Object.keys(HA.gripsOf(prop)); if (!grips.length) throw new Error(`"${kind}" has no grips: add grips (props.js grip(), references/hands.md) before it can be held`);
    // grip: a name of the prop's grips, or a grip object / JSON (a NEW grip, tried before it is written into the prop:
    // { pos, fingers, palm, pose, use, hand, mirror, second, contact } in the prop's own coordinates)
    const g0 = g('grip'), go = typeof g0 === 'object' && g0 ? g0 : typeof g0 === 'string' && g0.trim().startsWith('{') ? parse(g0) : null;
    const grip = go ? 'new grip' : g0 || grips[0], gd = go ?? HA.gripsOf(prop)[grip]; if (!gd) throw new Error(`"${kind}" has no grip "${grip}" (its grips: ${grips.join(', ')})`);
    const side = String(g('side') || (gd.hand === 'L' ? 'L' : 'R')).toUpperCase().startsWith('L') ? 'l' : 'r', job = KIND_JOB[kind] || {};
    const clips = o.clips ?? list(Q.get('clip')) ?? job.clips ?? [...new Set([...(gd.clips || []), ...DEFAULT_CLIPS])];
    const times = (o.times ?? list(Q.get('times'))?.map(Number) ?? [.3, 1.1]).filter(x => isFinite(x)), views = o.views ?? list(Q.get('views')) ?? ['face', 'out', 'pov', 'below'];
    const t0 = g('t0') != null && g('t0') !== '' ? +g('t0') : undefined, t1 = g('t1') != null && g('t1') !== '' ? +g('t1') : undefined, table = g('table') != null && g('table') !== '' ? +g('table') : null, use = g('use') || undefined;
    S.scene.add(prop); const extra = [];
    if (table != null) { const tb = PR.place(S, PR.prop('table', { w: 1.0, d: .6, h: table }), { at: [0, .62], face: 0 }); extra.push(tb); PR.place(S, prop, { on: tb, local: [side === 'r' ? -.17 : .17, -.22], face: 0 }); }
    if (job.chestAt) { FRAME = tt => { f.act(clips[0], { t: tt }); }; st.seat.visible = SEATED.test(clips[0]); E.compose(.3);
      const c = f.bone('spine_03').getWorldPosition(V3()), fw = f.fwd(), p = c.clone().addScaledVector(fw, job.chestAt[1]); prop.position.set(p.x, p.y + job.chestAt[0] - .72, p.z); prop.rotation.y = Math.atan2(fw.x, fw.z) + Math.PI; prop.updateMatrixWorld(true); FRAME = null; }
    let h = null, err = null; try { h = HA.hold(f, prop, go ?? grip, { side: side.toUpperCase(), t0, t1, use }); } catch (e) { err = e.message; }
    cur = { h, prop, extra }; if (err) throw new Error(err);
    const size = Math.max(160, Math.min(480, +(g('size') || 300))), rows = [];
    const cv = document.createElement('canvas'); cv.width = size * views.length; cv.height = size * clips.length * times.length + 40; const gx = cv.getContext('2d');
    gx.fillStyle = INV ? '#0c0d0f' : '#202124'; gx.fillRect(0, 0, cv.width, cv.height);
    let r = 0, clean = true;
    for (const clip of clips) { const seated = SEATED.test(clip); st.seat.visible = seated; st.seatPlaced = null;
      for (const t of times) { FRAME = tt => { f.act(clip, { t: tt }); }; VIEW = null; E.compose(t);
        if (seated && st.seatPlaced !== clip) { const pv = f.bone('pelvis').getWorldPosition(V3()); st.seat.position.set(pv.x, (FIG.SEAT_H ?? .45) / 2, pv.z - .04); st.seatPlaced = clip; E.compose(t); }
        let issues = []; try { issues = HA.holdIssues(f).map(q => q.detail); } catch (e) { issues = ['check failed: ' + e.message]; }
        const rep = h.report, real = issues.filter(i => !/VERIFIED/.test(i)); if (real.length) clean = false;
        prop.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(prop), tgt = box.getCenter(V3()), dim = Math.max(...box.getSize(V3()).toArray()), big = dim > .5, dist = big ? .55 : Math.min(2.4, Math.max(.36, dim * 2.4));
        const hands = [f.bone('hand_' + side).getWorldPosition(V3())]; if (h.second) hands.push(f.bone('hand_' + h.second.side).getWorldPosition(V3()));
        views.forEach((vn, k) => { if (vn === 'pov') { const hd = f.bone('Head').getWorldPosition(V3()).add(V3(0, .07, 0)).addScaledVector(f.fwd(), .09); VIEW = { p: hd, l: tgt, fov: 34 }; }
          else VIEW = viewOf(vn, big ? hands[k % hands.length] : tgt, dist, side, f.fwd()); E.compose(t);
          cell(gx, k * size, 40 + r * size, size, `${clip.replace(/_Loop$/, '')} t${t} ${vn}${k === 0 ? ` ${real.length ? '!' + real.length : 'ok'}` : ''}`, real.length && k === 0); });
        rows.push({ clip, t, issues, handIn_mm: rep ? +(rep.handIn * 1000).toFixed(1) : null, bodyIn_mm: rep ? +(rep.bodyIn * 1000).toFixed(1) : null, palmGap_mm: rep ? +(rep.palmGap * 1000).toFixed(1) : null,
          gaps_mm: rep ? Object.fromEntries(Object.entries(rep.gaps).map(([k2, v]) => [k2, +(v * 1000).toFixed(1)])) : {}, second_mm: rep?.second == null ? null : +(rep.second * 1000).toFixed(1), scene: rep?.scene ?? null, handScene: rep?.handScene ?? null, ear_cm: rep?.ear == null ? null : +(rep.ear * 100).toFixed(1), wrap: rep?.wrap ?? null });
        r++; } }
    st.seat.visible = false; FRAME = null; VIEW = null;
    const verified = clips.every(c => HA.isVerified(h, c));
    gx.fillStyle = clean ? '#9fe29f' : '#ff6060'; gx.font = '600 18px monospace';
    gx.fillText(`${kind} : ${grip} : ${side.toUpperCase()}  ${body} ${finish}  ${clean ? 'CLEAN' : 'HOLD ISSUES'}  ${verified ? 'in VERIFIED' : 'not in VERIFIED'}`, 10, 26);
    if (!verified) warnings.push('not in the VERIFIED table for every clip asked: look at every cell; if it is clean and LOOKS right, add the row to VERIFIED (hands.js + the experiments mirror)');
    sheet.width = cv.width; sheet.height = cv.height; sx.drawImage(cv, 0, 0);
    const solve = { shift_mm: +(h.sol.shift * 1000).toFixed(1), fingers_mm: Object.fromEntries(Object.entries(h.sol.report).map(([k2, v]) => [k2, +(v.gap * 1000).toFixed(1)])), second_mm: h.second ? Object.fromEntries(Object.entries(h.second.sol.report).map(([k2, v]) => [k2, +(v.gap * 1000).toFixed(1)])) : null };
    return { png: cv.toDataURL('image/png'), report: { kind, grip, side: side.toUpperCase(), body, finish, use: h.use, verified, clean, rows, solve, grips, warnings } };
  }
  // one combo at a time: calls queue (the app may ask while the URL's own combo is still being drawn)
  let chain = Promise.resolve();
  const one = async o => { try { return await viewHold(o); } catch (e) { console.error(e); return { png: null, report: { error: String(e?.message ?? e), warnings: ['error: ' + (e?.message ?? e)] } }; } };
  window.viewHold = (o = {}) => { const r = chain.then(() => one(o)); chain = r.catch(() => {}); return r; };
  if (Q.get('args') || Q.get('mod') || Q.get('grip')) await window.viewHold();
  window.ready = true;
} catch (e) {
  sx.fillStyle = '#07080a'; sx.fillRect(0, 0, sheet.width, sheet.height); sx.fillStyle = '#e1e7e7'; sx.font = '28px sans-serif'; sx.fillText('The hold viewer could not start: ' + String(e.message).slice(0, 90), 40, 80);
  console.error(e); window.ready = 'error: ' + e.message;
}
