// Prop viewer (3D reconstruction): ONE prop alone on a neutral floor with a 10 cm grid, as a 2x2 sheet at 1920 x 1080
// (front, side from +X, 3/4 from front-above, top-down; each panel framed on the prop's box), labelled with the kind and
// W x H x D in cm, a blue (Investigation: red) arrow on the floor pointing +Z = the front, plus a self-check report.
// Served from a project folder (templates/recon/lib/* is copied into every project's lib/):
//   <project>/lib/propview.html?mod=<path from the project root: lib/props.js | lib/props/fax.js>&fn=<export, default
//   'prop'>&args=<json array, e.g. ["monitor",{"screen":"code"}]>&theme=studio|investigation&expect=<json [w,h,d] metres>
// window.viewProp(o?) -> Promise<{ png: dataURL (1920 x 1080), report: { kind, size: [w,h,d], minY, parts, verts, loose,
//   floating, through, frontHint, tops, warnings: [] } }>   o: { mod, fn, args, expect } override the URL (one page can
//   check many props; the theme needs a reload). window.ready = true | 'error: ...'. window.kinds() -> the kit's kinds.
// Nothing here needs a timeline, shot list or camera move: the scene is built directly as one engine shot.
const Q = new URLSearchParams(location.search);
const THEME = Q.get('theme') === 'investigation' ? 'investigation' : 'studio';
globalThis.__CZ_SETTINGS = { theme: THEME, quality: { ss: 1 }, post: { grain: 0, vignette: 0, ao: true } };
const sheet = document.getElementById('sheet'), sx = sheet.getContext('2d');
const parse = s => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const safeMod = m => { if (typeof m !== 'string' || !/^[\w./-]+\.js$/.test(m) || m.split('/').includes('..') || m.startsWith('/')) throw new Error(`mod "${m}" must be a .js path inside the project, like lib/props.js`); return new URL('../' + m, location.href).href; };
try {
  const E = await import('../engine.js'), { THREE } = E, { contacts } = await import('./contact.js');
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), INV = THEME === 'investigation';
  const objOf = x => x == null ? null : x.isObject3D ? x : (x.group ?? x.g ?? x.root ?? x.mesh ?? null);
  // the 10 cm grid (1 m tile, thicker metre lines)
  const gridTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    x.fillStyle = INV ? '#2a2d31' : '#d9d9d5'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i <= 10; i++) { const p = Math.round(i * 51.2); x.fillStyle = i % 10 === 0 ? (INV ? 'rgba(255,255,255,.17)' : 'rgba(0,0,0,.2)') : i === 5 ? (INV ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.12)') : (INV ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.075)');
      const w = i % 10 === 0 ? 3 : 1.5; x.fillRect(p - w / 2, 0, w, 512); x.fillRect(0, p - w / 2, 512, w); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30); t.anisotropy = 8; return t; })();
  function arrow(len, color) {
    const s = new THREE.Shape(), w = len * .14, hw = len * .32, hl = len * .4;   // drawn pointing -Y: lies on the floor pointing +Z
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, -(len - hl)); s.lineTo(hw, -(len - hl)); s.lineTo(0, -len); s.lineTo(-hw, -(len - hl)); s.lineTo(-w / 2, -(len - hl)); s.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.rotation.x = -Math.PI / 2; m.name = 'front arrow'; m.userData.noPick = true; m.userData.noContact = true; return m;
  }
  // a view: the camera along `dir` from the box centre, far enough that every corner fits with a margin
  function fit(box, dir, fov, up = [0, 1, 0], margin = 1.22) {
    const c = box.getCenter(V()), d = dir.clone().normalize(), cam = new THREE.PerspectiveCamera(fov, 16 / 9, .01, 1000); cam.up.set(...up);
    cam.position.copy(c).addScaledVector(d, 10); cam.lookAt(c); cam.updateMatrixWorld(true);
    const R = V().setFromMatrixColumn(cam.matrixWorld, 0), U = V().setFromMatrixColumn(cam.matrixWorld, 1), th = Math.tan(fov * Math.PI / 360), tw = th * 16 / 9;
    let dist = .05; for (let i = 0; i < 8; i++) { const p = V(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(c);
      dist = Math.max(dist, p.dot(d) + Math.abs(p.dot(R)) * margin / tw, p.dot(d) + Math.abs(p.dot(U)) * margin / th); }
    return { p: c.clone().addScaledVector(d, dist), l: c, fov, up };
  }
  let VIEW = null;
  function setShot(item, box) {
    for (const s of E.SHOTS) s._S?.scene.traverse(x => { if (x.isMesh && !x.userData.shared && x.name !== 'grid floor') x.geometry?.dispose?.(); });
    E.SHOTS.splice(0);
    const sz = box.getSize(V()), R = Math.max(sz.x, sz.y, sz.z, .05), cy = sz.y / 2;
    E.shot({ t0: 0, trans: 'cut', name: 'prop', build(S) {
      S.recon = false; S.post.dof = null; S.visibility = false;
      S.studio({ floor: false, near: Math.max(.003, R * .01), far: Math.max(60, R * 40), fog: [150, 300], area: Math.max(1.2, R * 1.4), shadowFar: Math.max(30, R * 20),
        key: [R * 1.6 + 1, R * 2.6 + 1.6, R * 2 + 1.4], target: [0, cy, 0], keyI: INV ? 3 : 1.5, hemi: INV ? 2.6 : 1.15, rim: [-R * 2 - 1, R * 2 + 1.5, -R * 2 - 1.5], rimI: 1.4, soft: 4 });
      if (INV) S.sky('#2a3038', '#1a1e23', '#14171a');
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: gridTex, roughness: INV ? .6 : 1 }));
      fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; fl.name = 'grid floor'; fl.userData.ground = true; S.scene.add(fl); S.floor = fl;
      S.scene.add(item);
      const L = Math.min(.5, Math.max(.05, R * .22)), ar = arrow(L, INV ? 0xd30007 : 0x2f6fd6); ar.position.set(0, .001, box.max.z + Math.max(.015, R * .05)); S.scene.add(ar);
      return { item };
    }, update(st, t, S) { const v = VIEW; if (!v) return; S.cam.up.set(...v.up); S.cam.position.copy(v.p); S.cam.lookAt(v.l); S.look.copy(v.l); if (S.cam.fov !== v.fov) { S.cam.fov = v.fov; S.cam.updateProjectionMatrix(); } } });
    E.finalizeShots(1e6);
  }
  const FRONTISH = /screen|display|lens|drawer|keys|keypad|door|face|gauge|pocket|led/i;
  const FURNITURE = /^(?!.*(lamp|phone|chair|clock)).*(desk|table|shelf|cabinet|counter|console|nightstand|bench|dresser|sideboard)/i;
  async function viewProp(o = {}) {
    const mod = o.mod ?? Q.get('mod') ?? 'lib/props.js', fn = o.fn ?? Q.get('fn') ?? 'prop', args = o.args ?? parse(Q.get('args')) ?? ['desk'], expect = o.expect ?? parse(Q.get('expect'));
    const M = await import(safeMod(mod)); if (typeof M[fn] !== 'function') throw new Error(`${mod} has no export "${fn}"`);
    const item = objOf(await M[fn](...args)); if (!item) throw new Error(`${fn}(...) did not return a THREE.Group`);
    item.position.set(0, 0, 0); item.rotation.set(0, 0, 0); item.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(item, true), size = box.getSize(V()), P = item.userData.prop, warnings = [];
    const kind = P?.kind ?? item.name ?? String(args[0] ?? fn);
    setShot(item, box);
    const views = [['FRONT', fit(box, V(0, .14, 1), 22)], ['SIDE (from +X)', fit(box, V(1, .14, 0), 22)], ['3/4 FRONT-ABOVE', fit(box, V(.75, .62, 1), 26)], ['TOP (front down)', fit(box, V(0, 1, 0), 22, [0, 0, -1])]];
    sx.fillStyle = INV ? '#0c0d0f' : '#bdbdb8'; sx.fillRect(0, 0, 1920, 1080);
    views.forEach(([name, v], i) => { VIEW = v; E.compose(0); const px = (i % 2) * 960, py = (i >> 1) * 540; sx.drawImage(E.outCanvas, 0, 0, E.outCanvas.width, E.outCanvas.height, px, py, 960, 540);
      sx.font = '600 22px Inter, Segoe UI, sans-serif'; const t1 = `${kind}  ·  ${(size.x * 100).toFixed(1)} × ${(size.y * 100).toFixed(1)} × ${(size.z * 100).toFixed(1)} cm`, t2 = `${name}  ·  arrow = front (+Z)  ·  grid 10 cm`;
      sx.fillStyle = INV ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.72)'; sx.fillRect(px + 14, py + 12, Math.max(sx.measureText(t1).width, sx.measureText(t2).width * .82) + 24, 66);
      sx.fillStyle = INV ? '#e1e7e7' : '#16181b'; sx.fillText(t1, px + 26, py + 40); sx.font = '500 18px Inter, Segoe UI, sans-serif'; sx.fillStyle = INV ? '#a7aeb1' : '#4f5459'; sx.fillText(t2, px + 26, py + 66); });
    sx.fillStyle = INV ? '#2a2d31' : '#8f8f8a'; sx.fillRect(958, 0, 4, 1080); sx.fillRect(0, 538, 1920, 4);
    // ---- self-check ----
    const meshes = []; item.traverse(m => { if (m.isMesh) meshes.push(m); }); let verts = 0; for (const m of meshes) verts += m.geometry?.attributes?.position?.count ?? 0;
    // loose parts: meshes whose (2 mm grown) boxes don't connect to the biggest group
    const bx = meshes.map(m => new THREE.Box3().setFromObject(m, true).expandByScalar(.002)), par = meshes.map((_, i) => i), f = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
    for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) if (bx[i].intersectsBox(bx[j])) par[f(i)] = f(j);
    const comp = new Map(); meshes.forEach((m, i) => { const r = f(i); comp.set(r, [...(comp.get(r) ?? []), m]); });
    const big = [...comp.values()].sort((a, b) => b.length - a.length)[0] ?? [], loose = meshes.filter(m => !big.includes(m)).map(m => m.name || m.geometry.type);
    const S = E.SHOTS[0]._S, cam = new THREE.PerspectiveCamera(views[2][1].fov, 16 / 9, .01, 1000); cam.position.copy(views[2][1].p); cam.lookAt(views[2][1].l); cam.updateMatrixWorld(true);
    let cs = []; try { cs = contacts(S.scene, { camera: cam, height: 1080, width: 1920 }); } catch (e) { warnings.push('contact check failed: ' + e.message); }
    const floating = cs.filter(c => c.type === 'floating' && c.name !== '(time)').map(c => c.detail), through = cs.filter(c => c.type === 'through').map(c => c.detail);
    if (Math.abs(box.min.y) > .001) warnings.push(`lowest point is at y = ${(box.min.y * 1000).toFixed(1)} mm: it must be exactly 0 (origin at floor level)`);
    if (Math.hypot((box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2) > .005 && P?.mount !== 'wall') warnings.push(`the origin is ${(Math.hypot((box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2) * 100).toFixed(1)} cm off the centre of the footprint`);
    if (!P) warnings.push('no userData.prop (the contract): build it with propGroup(kind, o, g => meta) from lib/props.js');
    else { if (!P.kind) warnings.push('userData.prop.kind missing'); if (!Array.isArray(P.size)) warnings.push('userData.prop.size missing');
      if (FURNITURE.test(kind) && !(P.tops?.length)) warnings.push('furniture without tops: nothing can be placed on it (add tops: [{ name, y, x0, x1, z0, z1 }])');
      for (const t of P.tops || []) if (t.y > box.max.y + .002 || t.y < -.001 || t.x0 < box.min.x - .01 || t.x1 > box.max.x + .01 || t.z0 < box.min.z - .01 || t.z1 > box.max.z + .01) warnings.push(`top "${t.name}" lies outside the prop's box`); }
    if (Array.isArray(expect) && expect.length === 3) ['width', 'height', 'depth'].forEach((k, i) => { const r = [size.x, size.y, size.z][i] / expect[i]; if (r < .7 || r > 1.4) warnings.push(`${k} ${([size.x, size.y, size.z][i] * 100).toFixed(1)} cm vs the expected ${(expect[i] * 100).toFixed(1)} cm (real-world proportions?)`); });
    if (verts > 30000) warnings.push(`${verts} vertices: heavy for a prop used many times (share geometries, fewer segments)`);
    if (meshes.some(m => [].concat(m.material).some(mt => mt?.transparent && (mt.opacity ?? 1) < .6))) warnings.push('see-through parts: the contact check skips them');
    if (!meshes.every(m => m.name)) warnings.push(`${meshes.filter(m => !m.name).length} unnamed parts (name every mesh: 'monitor screen')`);
    try { for (const c of S.audit?.() ?? []) if (!/grid floor|front arrow/.test(c)) warnings.push('coplanar (will flicker): ' + c); } catch { /* old engine */ }
    // front: a flat named screen/face must look +Z (its normal), other front parts must sit on the +Z half
    const fr = meshes.filter(m => FRONTISH.test((m.name || '').replace(kind, ''))), cz = (box.min.z + box.max.z) / 2, bad = [];
    for (const m of fr) { if (m.geometry?.type === 'PlaneGeometry') { const n = V(0, 0, 1).transformDirection(m.matrixWorld); if (n.z < -.2) bad.push(m.name); }
      else if (new THREE.Box3().setFromObject(m).getCenter(V()).z < cz - .01 * size.z - .002) bad.push(m.name); }
    let frontHint = fr.length ? 'ok: named front parts (' + [...new Set(fr.map(m => m.name))].slice(0, 3).join(', ') + ') face / sit toward +Z' : 'no named front parts (screen / drawer / lens / door ...) to judge by: check the FRONT panel';
    if (bad.length) { frontHint = `parts that face the viewer (${[...new Set(bad)].slice(0, 4).join(', ')}) look or sit toward -Z: the front must be +Z`; warnings.push(frontHint); }
    if (loose.length) warnings.push(`loose parts not touching the rest: ${[...new Set(loose)].join(', ')}`);
    const report = { kind, size: [size.x, size.y, size.z].map(v => +v.toFixed(4)), minY: +box.min.y.toFixed(5), parts: meshes.length, verts, loose: [...new Set(loose)], floating, through, frontHint, mount: P?.mount ?? null, tops: P?.tops ?? [], seat: P?.seat ?? null, warnings };
    return { png: sheet.toDataURL('image/png'), report };
  }
  window.viewProp = async (o = {}) => { try { return await viewProp(o); } catch (e) { console.error(e); return { png: null, report: { error: String(e?.message ?? e), warnings: ['error: ' + (e?.message ?? e)] } }; } };
  window.kinds = async () => Object.keys((await import(safeMod('lib/props.js'))).PROP_KINDS);
  if (Q.get('args') || Q.get('mod')) await window.viewProp();
  window.ready = true;
} catch (e) {
  sx.fillStyle = '#07080a'; sx.fillRect(0, 0, 1920, 1080); sx.fillStyle = '#e1e7e7'; sx.font = '28px sans-serif'; sx.fillText('The prop viewer could not start: ' + String(e.message).slice(0, 90), 40, 80);
  console.error(e); window.ready = 'error: ' + e.message;
}
