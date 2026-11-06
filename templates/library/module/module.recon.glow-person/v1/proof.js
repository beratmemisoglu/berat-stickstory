// PROOF module.recon.glow-person: the three looks on the kit's bare human (cafe, night, sunlit with halo shells), one
// wearing the glow cap, each with its glow light, on a mid-grey floor under a dim key. Set settings.post.cap >= .95.
// Install as scenes/<name>.js next to library/module.recon.glow-person/ (+ module.recon.rig-pose).
import { shot, THREE } from '../engine.js';
import { glowPerson, glowCap, glowLight } from '../library/module.recon.glow-person/index.js';
import { bodyOf } from '../library/module.recon.rig-pose/index.js';

shot({ trans: 'cut', t0: 0, build(S) {
  S.studio({ near: .05, far: 40, keyI: .5, area: 4 }); S.recon = false;
  const a = glowPerson('cafe look', { parent: S.scene, x: -1.2, z: 0, ry: .3 }, 'cafe');
  const b = glowPerson('night look', { parent: S.scene, x: 0, z: 0, ry: 0 }, 'night');
  const c = glowPerson('sunlit look', { parent: S.scene, x: 1.2, z: 0, ry: -.3 }, 'sunlit');
  S.tick(() => { a.act('stand', { t: .5 }); b.act('talk', { t: .8 }); c.act('stand', { t: 1.1 }); });
  glowCap(S, a, 'cafe');
  for (const f of [a, b, c]) glowLight(S, f, { i: 1.2, d: 2 });
  S.collide = { bodies: () => [a, b, c].map(f => bodyOf(f)), solids: [] };
  S.post.dof = null; S.post.bloom = .4; S.visibility = false;
  const K = { p: [0, 1.3, 5.2], l: [0, 1, 0], fov: 40 }; S.camera([{ t: 0, ...K }, { t: 5, ...K }]);
} });
