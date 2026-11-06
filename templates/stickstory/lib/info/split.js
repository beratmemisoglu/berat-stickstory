// SPLIT SCREEN (iq500's good side / bad side): two panels side by side, a torn-paper black divider at ~0.46 of the width
// (slightly slanted, jagged), each panel its own little scene with its own camera; in and out by a hard cut, or the
// divider slides out of frame in 8 frames and the right (or left) panel becomes the shot.
//
//   S.split((S) => { S.place('kitchen'); const a = S.char('main', { at: [0, 0] }); S.camera('static', { on: a, frame: 'ms' }); },
//           (S) => { ...; S.camera(...) }, { at: .46, slide: { word: 'catch', keep: 'right', frames: 8 } })
//
// How: whatever each panel function adds to the scene is moved to its own render layer (1 = left, 2 = right) and drawn
// by its own camera (the camera the function set up) into a render target; two flat panels show them, seen by the shot's
// camera, which looks at them far away from the sets. Each panel camera frames its subject in the middle of its panel
// (view offset), so a slide-out glides the kept subject to the middle of the frame. Corner HUD icons for each side:
// S.plusminus('+') / S.plusminus('-') as usual.
// Known limits: no depth of field inside the panels; S.screen() overlays pinned to things inside a panel do not follow.
import { THREE, RW, RH, FPS, clamp, lerp, E, rnd } from '../core.js';
import * as P from './paint.js';

const F = 1 / FPS, U = .005, FAR = [2000, 0, 0];
const KEEP_KEYS = ['spots', 'placeName', 'placeInfo', 'bounds', 'rim', 'rimDir', 'subject'];
function tornEdge(x0, x1, seed, side) {   // points down the divider from top (y 0) to bottom (y 1080), jagged
  const R = rnd(seed), pts = []; for (let y = -20; y <= 1100; y += 11) { const k = (y + 20) / 1120, x = lerp(x0, x1, k) + (R() - .5) * 9 + side * (3 + R() * 3); pts.push([x, y]); } return pts;
}
export function split(S, o = {}) {
  const panels = [];
  const saved = Object.fromEntries(KEEP_KEYS.map(k => [k, S[k]])), mainCam = S._cam;
  ['left', 'right'].forEach((side, i) => {
    const fn = o[side]; if (typeof fn !== 'function') return;
    for (const k of KEEP_KEYS) S[k] = saved[k];
    const before = new Set(S.scene.children), actors0 = S.actors.length; S._cam = null;
    const ret = fn(S, { side, layer: i + 1 });
    if (!S._cam) S.camera(ret && typeof ret === 'object' && ret.kind ? ret.kind : 'static', { on: S.actors[actors0] ?? S.props[S.props.length - 1] ?? [0, 1.2, 0], frame: 'ms', ...(ret && typeof ret === 'object' ? ret : {}) });
    const rig = S._cam, roots = S.scene.children.filter(c => !before.has(c));
    panels.push({ side, layer: i + 1, rig, roots, cam: new THREE.PerspectiveCamera(S.cam.fov, S.cam.aspect, S.cam.near, S.cam.far) });
  });
  S._cam = mainCam; for (const k of KEEP_KEYS) S[k] = saved[k];
  // the shot's own camera looks at the two panels, far from the sets
  const g = new THREE.Group(); g.position.set(...FAR); g.userData.kind = 'split'; g.userData.pickRoot = true;
  if (!S._cam) S.camera('static', { on: FAR, frame: { h: 960 * U } });
  const xd0 = (o.at ?? .46) * 1920, slant = o.slant ?? 22, tSlide = o.slide ? P.landed(S, P.startOf(S, o.slide, 0)) : null, keep = o.slide?.keep ?? 'right', nSlide = o.slide?.frames ?? 8;
  const divAt = t => { if (tSlide == null || t < tSlide) return xd0; const k = E.inOutQuad(clamp((t - tSlide) * FPS / nSlide)); return lerp(xd0, keep === 'right' ? -60 : 1980, k); };
  const mkPanel = (p) => {
    const rt = new THREE.WebGLRenderTarget(RW, RH, { samples: 4, type: THREE.HalfFloatType, depthBuffer: true });
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace; const td = rt.texture.dispose.bind(rt.texture); rt.texture.dispose = () => { rt.dispose(); td(); };
    const geo = new THREE.BufferGeometry(); const m = new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false, side: THREE.DoubleSide }); m.userData.own = true;
    const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.userData.noPick = true; p.mesh = mesh; p.rt = rt; g.add(mesh);
    let lastXd = null;
    p.shape = xd => { if (xd === lastXd) return; lastXd = xd;   // the panel polygon (board px) with a torn edge; uv = its own place in the frame
      const left = p.side === 'left', edge = tornEdge(xd + slant / 2, xd - slant / 2, left ? 3 : 7, left ? -1 : 1);
      const poly = left ? [[-40, -20], ...edge, [-40, 1100]] : [[1960, -20], [1960, 1100], ...edge.slice().reverse()];
      const pos = [], uv = [], idx = []; const xs = poly.map(q => q[0]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = 540;
      pos.push((cx - 960) * U, (540 - cy) * U, 0); uv.push(cx / 1920, 1 - cy / 1080);
      for (const [x, y] of poly) { pos.push((x - 960) * U, (540 - y) * U, 0); uv.push(x / 1920, 1 - y / 1080); }
      for (let k = 1; k <= poly.length; k++) idx.push(0, k, k % poly.length + 1);
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeBoundingSphere(); };
    mesh.onBeforeRender = (renderer, scene) => {
      const t = S.lt ?? S.t0, xd = divAt(t); p.shape(xd);
      // the panel camera: the function's rig, then a view offset that puts its frame centre in the middle of the panel
      const keepF = { _focus: S._focus, _apAuto: S._apAuto, _subj: S._subj };
      p.cam.aspect = S.cam.aspect; p.rig(p.cam, t); Object.assign(S, keepF);
      const pc = p.side === 'left' ? Math.max(0, xd) / 2 : (Math.min(1920, xd) + 1920) / 2;
      p.cam.setViewOffset(1920, 1080, -(pc - 960), 0, 1920, 1080); p.cam.updateMatrixWorld(); p.cam.layers.set(p.layer);
      for (const r of p.roots) r.traverse(c => c.layers.set(p.layer));
      const prev = renderer.getRenderTarget(), cc = new THREE.Color(); renderer.getClearColor(cc); const ca = renderer.getClearAlpha();
      renderer.setRenderTarget(rt); renderer.setClearColor(0, 1); renderer.clear(); renderer.render(scene, p.cam);
      renderer.setRenderTarget(prev); renderer.setClearColor(cc, ca);
    };
    p.shape(xd0);
  };
  panels.forEach(mkPanel);
  // black behind the torn gap
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1920 * U * 1.2, 1080 * U * 1.2), new THREE.MeshBasicMaterial({ color: '#050506', toneMapped: false })); back.material.userData.own = true; back.position.z = -.01; g.add(back);
  S.splitPanels = panels; g.userData.panels = panels;
  return g;
}
