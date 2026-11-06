// PROOF module.recon.rig-pose: (default) one Walk_Loop stance with nothing / lean .5 / hinge .8 + lean .3 / tilt .45 +
// hinge .22, then footTo targets with their miss distance printed once. With ?probe=clipA,clipB it is the POSE PROBE: each
// clip in a row at 6 times (?pstep=.25 s apart), seen from ?pry= (radians), so the nearest clip can be picked in one render
// (clip names don't predict silhouettes). Install as scenes/<name>.js next to library/module.recon.rig-pose/.
import { shot, THREE } from '../engine.js';
import { figure } from '../lib/figures.js';
import { lean, hinge, tilt, footTo, bodyOf } from '../library/module.recon.rig-pose/index.js';

const Q = new URLSearchParams(location.search), PROBE = Q.get('probe');
shot({ trans: 'cut', t0: 0, build(S) {
  S.studio({ near: .05, far: 60, keyI: 1, area: 8 }); S.recon = false;
  const fig = (name, o) => figure({ role: 'extra', body: 'm', outfit: 'none', name }, { parent: S.scene, ...o });
  if (PROBE) {
    const clips = PROBE.split(','), fs = [], step = +(Q.get('pstep') ?? .25), ry = +(Q.get('pry') ?? 0);
    clips.forEach((c, r) => { for (let i = 0; i < 6; i++) fs.push([fig(c + ' ' + i, { x: i * 1.6, y: (clips.length - 1 - r) * 2.2, z: 0, ry }), c, i]); });
    S.tick(() => { for (const [f, c, i] of fs) f.play(c, i * step).apply(); });
    const n = clips.length, K = { p: [4, (n - 1) * 1.1 + 1.2, 4 + n * 3.2], l: [4, (n - 1) * 1.1 + .9, 0], fov: 40 }; S.camera([{ t: 0, ...K }, { t: 5, ...K }]);
    S.visibility = false; S.post.dof = null; return;
  }
  const side = Math.PI / 2, A = fig('clip only', { x: -3, ry: side }), B = fig('lean .5', { x: -1.5, ry: side }), C = fig('hinge .8 + lean .3', { x: 0, ry: side }), D = fig('tilt .45', { x: 1.5, ry: side }), E = fig('footTo', { x: 3, ry: side });
  tilt(D, .45);
  let logged = false;
  S.tick(() => { for (const f of [A, B, C, D]) f.act('Walk_Loop', { t: 0 }); E.act('stand', { t: 0 });
    lean(B, .5); hinge(C, .8); lean(C, .3); hinge(D, .22); lean(D, .12);
    const m1 = footTo(E, 'L', new THREE.Vector3(3.35, .45, .1), new THREE.Vector3(3.8, 1, .1)), m2 = footTo(E, 'R', new THREE.Vector3(3, .09, -.1), new THREE.Vector3(3.4, .6, -.1));
    if (!logged && Q.get('bones')) { logged = true; console.log(`footTo miss L ${m1.toFixed(3)} R ${m2.toFixed(3)}`); } });
  S.collide = { bodies: () => [A, B, C, D, E].map(f => bodyOf(f)), solids: [] };
  S.post.dof = null; S.visibility = false;
  const K = { p: [0, 1.2, 7.5], l: [0, .9, 0], fov: 45 }; S.camera([{ t: 0, ...K }, { t: 5, ...K }]);
} });
