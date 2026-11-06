// Starter kit gallery: every element shown ALONE before it goes into a scene (the Kit stage of the Style Studio).
//   kitShot({ t0, name, bg: 'light' | 'dark', build: S => element })   one element, centred and framed, on a plain ground
//   kitGallery([{ name, build }], { t0, each })                          each element on light, then on dark
// The element is st.el: check_layout's 'kit' check says when it is not whole and comfortably in frame, and every other
// check (cut, small text, contrast, floating, through ...) runs on it as in a scene.
import { THREE, shot, THEMES, DIM, W, H, clamp } from '../engine.js';

export function kitShot({ t0, name, bg = 'light', build }) {
  if (typeof build !== 'function') throw new Error('kitShot(): needs build: S => element');
  return shot({ t0, name: name ? `${name} (${bg})` : undefined, trans: 'cut', captions: false, build(S) {
    const th = bg === 'dark' ? THEMES.dark : THEMES.base;
    S.bg(th.bg, th.bg2); S.noCamera = true; S.kit = true;
    const el = build(S);
    if (!el?.isObject3D) throw new Error(`kitShot ${name || ''}: build must return the element`);
    el.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(el), c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
    if (DIM === '3d' && !isHud(el, S)) {
      S.ground(th.ground);                                    // a solid stands on a ground; a HUD element shows on the plain background
      // frame the solid: its bounding sphere fits the narrower field of view, seen from the front-right, a little above
      const r = Math.max(.25, size.length() / 2), v = S.cam.fov * Math.PI / 180, h = 2 * Math.atan(Math.tan(v / 2) * W / H), d = r / Math.sin(Math.min(v, h) / 2) * 1.15;
      const dir = new THREE.Vector3(.55, .4, 1).normalize();
      S.view(c.clone().addScaledVector(dir, d).toArray(), c.toArray());
    } else {
      // 2D: centred, and resized when it is far too big or too small to judge
      const k = Math.max(size.x / W, size.y / H);
      if (k > .7 || k < .25) el.scale.multiplyScalar(clamp(.45 / Math.max(k, 1e-3), .2, 5));
      el.updateWorldMatrix(true, true); const c2 = new THREE.Box3().setFromObject(el).getCenter(new THREE.Vector3());
      el.position.x -= c2.x; el.position.y -= c2.y;
    }
    return { el };
  } });
}
const isHud = (o, S) => { while (o) { if (o === S.hud) return true; o = o.parent; } return false; };

/** Every element on light and on dark, `each` seconds apart. Returns the time after the last one (project.json "end"). */
export function kitGallery(items, { t0 = 0, each = 2 } = {}) {
  let t = t0;
  for (const it of items) for (const bg of ['light', 'dark']) { kitShot({ t0: t, name: it.name, bg, build: it.build }); t += each; }
  return t;
}
