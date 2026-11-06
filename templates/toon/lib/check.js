// check_layout for the toon look: what a person checking every frame would flag. Each issue: { t, type, what, other?, detail }.
//  offscreen  a character the shot is about is out of frame (or its head is cut by the frame edge in a close shot)
//  caption    a face sits behind the caption band (captions centred at 70.5 % of the height)
//  through    two characters, or a character and a prop, interpenetrate (bounding spheres of torso/head)
//  floating   a character's feet are well above the ground with nothing under them (not hopping / falling / seated)
//  backface   the camera sees the back of the head of the character the shot is about in a close framing
//  dark       the frame is too dark to read (mean luminance under the gate)
//  empty      most of the frame is one flat colour (an undressed set), or a flat void band at the top / bottom
//             (the room ends and the frame shows the background past it: 9:16 wide shots of a room)
//  held       a prop held by a character is not at its hand
import { THREE, FW, FH } from './core.js';

const _v = new THREE.Vector3();
function onScreen(S, p) { const q = p.clone().project(S.cam); return { x: (q.x + 1) / 2, y: (1 - q.y) / 2, front: q.z < 1 && p.clone().applyMatrix4(S.cam.matrixWorldInverse).z < 0 }; }
const _ray = new THREE.Raycaster();
// a ray hit that really hides a face: a visible, opaque mesh that is not the character itself, an outline hull, a decal or a glow
function solidHit(o, actor) {
  if (!o.isMesh || !o.visible || o.userData.isOutline || o.userData.noPick) return false;
  for (let x = o; x; x = x.parent) { if (x === actor.root) return false; if (x.visible === false) return false; }
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!m || m.transparent && (m.opacity ?? 1) < .6 || m.blending === THREE.AdditiveBlending || m.side === THREE.BackSide) return false;
  return true;
}
function nameOf(o) { for (let x = o; x; x = x.parent) if (x.userData?.kind || x.userData?.pickRoot) return x.userData.kind || x.name || 'a prop'; return o.name || 'an object'; }
export function issues(S, def, t, where, ctx = {}) {
  const out = [];
  const push = (type, what, detail, other) => out.push({ t, type, what, other, detail: `${detail} ${where}` });
  const subject = S.subject?.toon ? S.subject : null;
  const capY0 = ctx.captionBox ? ctx.captionBox.y / FH : .655, capY1 = ctx.captionBox ? (ctx.captionBox.y + ctx.captionBox.h) / FH : .755;
  const capX0 = ctx.captionBox ? ctx.captionBox.x / FW : .2, capX1 = ctx.captionBox ? (ctx.captionBox.x + ctx.captionBox.w) / FW : .8;
  // a camera on a THING (a counter, the tower: S.camera(kind, { on: prop })) is about the thing: a lone character walking
  // out of that frame is not "offscreen" (short 10: 6 false flags on counter and tower shots)
  const camOnThing = !!S.subject && !S.subject.toon && !!(S.subject.isObject3D || S.subject.isBox3);
  for (const a of S.actors) {
    const head = a.head(), R = a.toon.B.head, s = onScreen(S, head);
    const main = a === subject || (S.actors.length === 1 && !camOnThing);
    if (main && (!s.front || s.x < -.05 || s.x > 1.05 || s.y < -.05 || s.y > 1.05)) push('offscreen', a.name, `the head of ${a.name} is out of frame`);
    // caption band: the face (eyes to mouth, about +-0.45 R around the head centre) overlapping the caption box
    if (s.front && ctx.captionBox !== null && ctx.captionBox !== undefined) {
      const top = onScreen(S, head.clone().add(new THREE.Vector3(0, R * .45, 0))), bot = onScreen(S, head.clone().add(new THREE.Vector3(0, -R * .45, 0)));
      const fy0 = Math.min(top.y, bot.y), fy1 = Math.max(top.y, bot.y), rx = Math.abs(fy1 - fy0) * FH / FW * .6;
      if (fy1 > capY0 && fy0 < capY1 && s.x + rx > capX0 && s.x - rx < capX1) push('caption', a.name, `${a.name}'s face is behind the caption at ${(s.y * 100).toFixed(0)} % height: frame it higher (place: [0, .15]) or lower`);
    }
    // back of the head in a close shot
    if (main) { const toCam = S.cam.position.clone().sub(head).normalize(), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(a.toon.head.getWorldQuaternion(new THREE.Quaternion()));
      const dist = S.cam.position.distanceTo(head); if (dist < R * 12 && fwd.dot(toCam) < -.2) push('backface', a.name, `the camera sees the back of ${a.name}'s head in a close shot (the face is the point of the shot)`); }
    // cropped: a close-up may cut the top of the skull, never the brows or eyes (the expression is the point of the shot)
    // (a push past the face onto the body - the eyes AND the mouth above the frame, a sliver of chin left - is a framing
    // on something else, not a cropped face: short 03's x-ray push into the belly)
    if (main && s.front && !a.root?.userData.xray) { const brow = onScreen(S, head.clone().add(new THREE.Vector3(0, R * .5, 0))), chin = onScreen(S, head.clone().add(new THREE.Vector3(0, -R * .55, 0)));
      const mouth = onScreen(S, head.clone().add(new THREE.Vector3(0, -R * .3, 0)));
      if (brow.y < .015 && chin.y > 0 && (s.y > 0 || mouth.y > .05)) push('cropped', a.name, `the frame cuts ${a.name}'s brows / eyes at the top (brow line at ${(brow.y * 100).toFixed(0)} % height): frame a little wider or lower the head (place: [0, -.1])`);
      if (s.x > 0 && s.x < 1 && (brow.x < -.02 || brow.x > 1.02)) push('cropped', a.name, `the frame cuts ${a.name}'s face at the side`); }
    // hidden: the face of the shot's subject behind something solid (rays from the lens to the face centre and its sides)
    if (main && s.front && s.x > 0 && s.x < 1 && s.y > 0 && s.y < 1) {
      const side = new THREE.Vector3().subVectors(head, S.cam.position).cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(R * .5);
      let blocked = 0, by = null;
      for (const p of [head, head.clone().add(side), head.clone().sub(side)]) {
        const d = p.clone().sub(S.cam.position), len = d.length(); _ray.set(S.cam.position, d.normalize()); _ray.far = len - R * .9; _ray.near = S.cam.near;
        const hit = _ray.intersectObjects(S.scene.children, true).find(h => solidHit(h.object, a));
        if (hit) { blocked++; by ??= nameOf(hit.object); }
      }
      if (blocked >= 2) push('hidden', a.name, `${a.name}'s face is hidden behind ${by || 'something'} from this camera: move the camera, the character or the object`, by);
    }
    // floating (hops, falls, seats, moves and raised floors excused)
    const fy = Math.min(a.toon.feet.L.getWorldPosition(_v).y, a.toon.feet.R.getWorldPosition(new THREE.Vector3()).y);
    const busy = a.hops.some(h => t > h.t - .2 && t < h.t + h.dur + .3) || a.acts.some(x => (x.kind === 'jolt' || x.kind === 'fall') && t >= x.t0 && t <= x.t1 + .3) || a.seats.length;
    if (fy > .12 + a.home.y && !busy && !a.moves.length) push('floating', a.name, `${a.name}'s feet are ${fy.toFixed(2)} m above the floor`);
    // held props stay in the hand
    for (const h of a.holds) { if (t < h.t0 || t >= h.t1 || h.side === 'both') continue; const hp = a.toon.handPos(h.side), b = new THREE.Box3().setFromObject(h.obj); if (b.isEmpty()) continue; if (b.distanceToPoint(hp) > .08) push('held', a.name, `${h.obj.name || 'a prop'} held by ${a.name} is ${b.distanceToPoint(hp).toFixed(2)} m from the hand`, h.obj.name || 'prop'); }
  }
  // PROP CHARACTERS (a modem, a pin, a machine with a face: short 02): scenes mark them with userData.face = [x, y, z]
  // (the face's centre in the object's own space); their faces must stay out of the caption band like the cast's
  if (ctx.captionBox) S.scene.traverse(o => {
    const f = o.userData?.face; if (!Array.isArray(f) || o.visible === false) return;
    const p = onScreen(S, new THREE.Vector3(f[0], f[1], f[2]).applyMatrix4(o.matrixWorld));
    if (p.front && p.y > capY0 - .02 && p.y < capY1 + .02 && p.x > capX0 - .05 && p.x < capX1 + .05)
      push('caption', o.name || o.userData.kind || 'a prop character', `the face of ${o.name || o.userData.kind || 'a prop character'} sits behind the caption at ${(p.y * 100).toFixed(0)} % height: frame it higher or lower`);
  });
  // characters through each other
  for (let i = 0; i < S.actors.length; i++) for (let j = i + 1; j < S.actors.length; j++) {
    const A = S.actors[i], B = S.actors[j], ha = A.head(), hb = B.head(), d = ha.distanceTo(hb), r = A.toon.B.head + B.toon.B.head;
    if (d < r * .92) push('through', A.name, `${A.name} and ${B.name} overlap (heads ${d.toFixed(2)} m apart)`, B.name);
    const pa = A.root.position, pb = B.root.position, dd = Math.hypot(pa.x - pb.x, pa.z - pb.z), rr = (A.toon.B.hip + B.toon.B.hip) * .95;
    if (dd < rr && Math.abs(pa.y - pb.y) < .5) push('through', A.name, `${A.name} and ${B.name} stand inside each other (${dd.toFixed(2)} m apart)`, B.name);
  }
  // prop collisions with characters: the hip point inside a solid prop. Props with userData.footprint ({ r } circle or
  // { w, d } box in the prop's local x/z, optional h) are tested against it (standing under a tree or an umbrella is fine);
  // others against their bounding box. solid: false never counts.
  for (const p of S.props) { if (p.userData.solid === false || !p.userData.solid) continue; p.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(p).expandByScalar(-.02), fp = p.userData.footprint, inv = fp ? p.matrixWorld.clone().invert() : null;
    for (const a of S.actors) { if (p.userData.heldBy === a || (p.userData.seat != null && a._seatAt?.(t))) continue; const c = a.root.position.clone(); c.y += a.toon.B.leg + a.toon.B.torso * .4;
      let inside;
      if (fp) { const l = c.clone().applyMatrix4(inv), inY = fp.h != null ? l.y >= 0 && l.y <= fp.h : c.y >= b.min.y && c.y <= b.max.y;
        inside = inY && (fp.r != null ? Math.hypot(l.x, l.z) < fp.r : Math.abs(l.x) < (fp.w ?? 0) / 2 && Math.abs(l.z) < (fp.d ?? 0) / 2); }
      else inside = b.containsPoint(c);
      if (inside) push('through', a.name, `${a.name}'s body is inside ${p.name || 'a prop'}`, p.name || 'prop'); } }
  // frame brightness / emptiness (reads the drawn frame)
  if (ctx.renderer) {
    const w = 48, h = 85;
    try {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(ctx.renderer.domElement, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data;
      const lum = k => (.2126 * d[k] + .7152 * d[k + 1] + .0722 * d[k + 2]) / 255, key = k => (d[k] >> 4) + ',' + (d[k + 1] >> 4) + ',' + (d[k + 2] >> 4);
      let sum = 0; const hist = new Map(); for (let k = 0; k < d.length; k += 4) { sum += lum(k); const q = key(k); hist.set(q, (hist.get(q) || 0) + 1); }
      const mean = sum / (w * h); if (mean < .07) push('dark', 'frame', `the frame is too dark (mean ${mean.toFixed(3)}): add a key light or a practical`);
      // dim: the frame as a whole passes but where the subject sits (the centre, above the captions) is murky - short 02's
      // "internet" shot (a dog asleep in a dark hallway) read as nothing at phone size
      else { const cl = []; for (let yy = Math.round(h * .15); yy < Math.round(h * .65); yy++) for (let xx = Math.round(w * .2); xx < Math.round(w * .8); xx++) cl.push(lum((yy * w + xx) * 4));
        // murky = a dark middle AND nothing lit in it (the brightest tenth stays dim). Measured (mean, 90th percentile):
        // murky - short 02's dog .193/.249 and pipe room .198/.282, short 03's creek .188/.265, a night room .149/.239;
        // readable - short 01's dark machine with bright pins and springs .152-.206 / .310-.447 (a dark set is fine when
        // the subject is lit)
        cl.sort((p, q) => p - q); const cm = cl.reduce((p, q) => p + q, 0) / Math.max(1, cl.length), c90 = cl[Math.floor(cl.length * .9)] ?? 0;
        if (cm < .21 && c90 < .3) push('dim', 'frame', `the middle of the frame, where the subject is, is murky (mean ${cm.toFixed(3)}, brightest tenth ${c90.toFixed(3)}): light the subject (a key on it, a practical beside it) or frame it against something brighter`); }
      const top = Math.max(...hist.values()) / (w * h); if (top > .62) push('empty', 'frame', `${Math.round(top * 100)} % of the frame is one flat colour: dress the set (props, texture, depth)`);
    } catch { /* no read-back in this context */ }
  }
  // void: rays through the frame that hit nothing show the empty background past the set (a 9:16 wide shot of a room
  // shows its missing ceiling / floor edge as a flat band). Checked geometrically: a flat painted wall is not a void.
  const rc = new THREE.Raycaster(), meshes = [];
  S.scene.traverse(o => { if (o.isMesh && o.visible && !o.userData.isOutline) meshes.push(o); });
  const voidShare = (y0, y1, rows = 4) => { let miss = 0, n = 0;
    for (let i = 0; i < 12; i++) for (let j = 0; j < rows; j++) { rc.setFromCamera(new THREE.Vector2((i + .5) / 12 * 2 - 1, 1 - 2 * (y0 + (j + .5) / rows * (y1 - y0))), S.cam); if (!rc.intersectObjects(meshes, false).length) miss++; n++; }
    return miss / n; };
  if (meshes.length) {
    const vt = voidShare(0, .2), vb = voidShare(.8, 1), all = voidShare(0, 1, 10);
    for (const [v, label] of [[vt, 'top'], [vb, 'bottom']]) if (v > .5) push('empty', 'frame', `the ${label} 20 % of the frame is ${Math.round(v * 100)} % empty background (the set ends in shot): frame tighter, add a ceiling / sky / foreground, or move the camera`);
    if (all > .35 && vt <= .5 && vb <= .5) push('empty', 'frame', `${Math.round(all * 100)} % of the frame shows empty background past the set: add walls / a sky dome or frame tighter`);
  }
  return out;
}
