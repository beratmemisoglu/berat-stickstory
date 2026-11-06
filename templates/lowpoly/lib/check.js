// The layout / clipping check behind the Suite's check_layout tool for low-poly shorts: visual consistency, no clipping,
// everything in the right place. At a steady frame of a shot it measures (measured against a planted-fault set:
// scripts/lowpoly-qa/faults.js, docs/ps1-style/CLIPPING.md has each detector's blind spots):
//   through   - a body part (bone capsules sampled on their surface, hands to the fingertips, the head) inside a solid,
//               a flying prop through a person, a held prop through its holder's own body
//   bodies    - two people passing through each other
//   feet      - feet floating / sunk relative to the person's own root (the clip), feet sliding on a walk
//   support   - feet floating above / sunk into the real surface under them, or standing on top of furniture
//   hand      - a held prop not touching the palm
//   floating  - a prop resting on nothing;  sunk - a prop sunk into the ground
//   seat      - a seated person hovering above or sunk into the seat
//   self      - a hand / forearm inside the own torso or head
//   scale     - a library prop scaled far from its real size (a giant cup)
//   camera    - the camera inside or grazing geometry, inside a person, or a surface filling the frame from very close
//   ceiling   - a body above the room's ceiling or behind its back / side walls
//   subject   - the subject off frame, too small, or its head cut by the frame edge
//   covered   - text on text, on the caption (or in the caption band), over a face
//   offframe  - a callout / panel cut by the frame edge;  small - text too small to read on a phone
//   coplanar  - two flat surfaces in one plane (horizontal or vertical) that will flicker
//   thin      - geometry thinner than a render pixel but long on screen (shimmers / flickers)
//   look      - a head turn further than a neck turns (the body should face it)
//   edge      - the end of the world (nothing under the horizon) in view
// Each issue: { t, type, what, detail, rect? } (rect: the element's normalised screen rect, for review frames).
import { THREE, FW, FH, RW, RH, SETTINGS } from './core.js';
import { captionBox } from './ui.js';
import { entry as libEntry } from './assets.js';

const NOGROUND = /Jump|Fall|Death|Lie|Lay|Crawl|Swim|Climb|Roll|Sit|Knockback|Slide|PushUps|SitUps|Ninja|Driving|Hit_|Spell|Dodge/i;
const v = new THREE.Vector3(), ray = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0);
const tag = (o, k) => { for (let x = o; x; x = x.parent) if (x.userData?.[k]) return true; return false; };
const heldName = o => o.name || (o.userData?.libId ? (libEntry(o.userData.libId)?.name || o.userData.libId) : 'held prop');
const nameOf = o => { for (let x = o; x; x = x.parent) { if (x.userData?.actor) return x.userData.actor.name || x.name || 'a person'; if (x.userData?.pickRoot && x.name) return x.name; } return o.name || o.geometry?.type || 'an object'; };
const rootOf = o => { let r = o; for (let x = o; x && !x.isScene; x = x.parent) if (x.userData?.pickRoot) r = x; return r; };
const isIn = (m, p) => { for (let x = m; x; x = x.parent) if (x === p) return true; return false; };
const visible = o => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
const matOf = m => Array.isArray(m.material) ? m.material[0] : m.material;
/** solid meshes of a scene (not ground, not the actors, not worn / held / overlay / see-through things) */
function solids(S, withAirborne) {
  const out = [];
  S.scene.traverse(m => {
    if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || !visible(m)) return;
    if (tag(m, 'ground') || tag(m, 'noCheck') || tag(m, 'actor') || tag(m, 'worn') || tag(m, 'heldBy') || tag(m, 'overlay')) return;
    const air = tag(m, 'airborne'); if (air && !withAirborne) return;
    const mt = matOf(m); if (mt?.transparent && mt.opacity < .6) return;
    m.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m); if (b.isEmpty()) return;
    const s = b.getSize(new THREE.Vector3()); if (Math.max(s.x, s.y, s.z) < .04) return;
    out.push({ m, b, air });
  });
  return out;
}
// is point p inside closed mesh m? (ray parity along two skewed directions, both must agree)
function inside(m, p) {
  let n = 0;
  for (const d of [new THREE.Vector3(1, .013, .007), new THREE.Vector3(-.009, .011, 1)]) {
    ray.set(p, d.normalize()); ray.far = 50; const mt = Array.isArray(m.material) ? m.material : [m.material], sides = mt.map(x => x.side); mt.forEach(x => x.side = THREE.DoubleSide);
    const hits = ray.intersectObject(m, false); mt.forEach((x, i) => x.side = sides[i]);
    if (hits.length % 2 === 1) n++;
  }
  return n === 2;
}
const segDist = (p1, q1, p2, q2) => {   // closest distance between two segments
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2), a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t; if (a <= 1e-9 && e <= 1e-9) return p1.distanceTo(p2);
  if (a <= 1e-9) { s = 0; t = Math.min(1, Math.max(0, f / e)); } else { const c = d1.dot(r); if (e <= 1e-9) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else { const b = d1.dot(d2), den = a * e - b * b; s = den !== 0 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0; t = (b * s + f) / e; if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); } } }
  return p1.clone().add(d1.multiplyScalar(s)).distanceTo(p2.clone().add(d2.multiplyScalar(t)));
};
function clipAt(a, t) { let cur = a.plan[0]; for (const s of a.plan) if (t >= s.at) cur = s; return cur?.name || ''; }
const restY = new WeakMap();
function soleOffsets(a) {   // height of each foot bone above the sole at the bind pose (read once)
  if (restY.has(a)) return restY.get(a);
  const o = {}; for (const n of ['foot_l', 'foot_r', 'ball_l', 'ball_r']) { const b = a.bones[n]; if (!b) continue; o[n] = (a._rest?.[n] ?? .08) * a.scale; }
  restY.set(a, o); return o;
}
/** lowest foot point above the actor's ground (m): negative = below the ground */
export function footClearance(a) {
  const off = soleOffsets(a), g = a.root.position.y; let low = 1e9, which = null, pos = null;
  for (const n of ['foot_l', 'foot_r', 'ball_l', 'ball_r']) { const b = a.bones[n]; if (!b) continue; const p = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld); const y = p.y - (off[n] ?? 0) - g; if (y < low) { low = y; which = n; pos = p; } }
  return { low, which, pos };
}
/** sample points of a capsule: the axis ends and middle, plus four points on its surface (70% of the radius) around the middle */
function capPoints(A, B, r) {
  const pts = [A, A.clone().lerp(B, .5), B], d = B.clone().sub(A); if (d.lengthSq() < 1e-8) return pts;
  d.normalize(); const u = Math.abs(d.y) < .9 ? new THREE.Vector3(0, 1, 0).cross(d).normalize() : new THREE.Vector3(1, 0, 0).cross(d).normalize(), w = d.clone().cross(u), m = pts[1];
  for (const q of [u, u.clone().negate(), w, w.clone().negate()]) pts.push(m.clone().addScaledVector(q, r * .7));
  return pts;
}
/** the person's capsules for the clipping tests: the actor's bone capsules + each hand to its fingertips + the head ball */
function bodyCaps(a) {
  const C = a.capsules().slice();
  if (!a.animal) for (const s of ['l', 'r']) { const h = a.boneAt('hand_' + s), tip = a.boneAt('middle_03_' + s) || a.boneAt('middle_02_' + s), k = a.boneAt('middle_01_' + s);
    if (h && (tip || k)) { const end = tip ? tip.clone().add(tip.clone().sub(k || h).multiplyScalar(.6)) : k.clone().add(k.clone().sub(h)); C.push([h, end, .03 * a.scale, 'fingers_' + s]); } }
  if (!a.animal && a.bones.Head) { const c = a.head().sub(new THREE.Vector3(0, .09 * a.scale, 0)); C.push([c, c.clone().add(new THREE.Vector3(0, .07 * a.scale, 0)), .085 * a.scale, 'head']); }
  return C;
}
const rectOf = (b, cam) => { const r = screenRect(b, cam); return r ? { x: +r.x.toFixed(4), y: +r.y.toFixed(4), w: +r.w.toFixed(4), h: +r.h.toFixed(4) } : null; };
const ovRect = b => ({ x: +(b.x / FW).toFixed(4), y: +(b.y / FH).toFixed(4), w: +(b.w / FW).toFixed(4), h: +(b.h / FH).toFixed(4) });
/** meshes rays may land on (support surfaces, the camera's view): everything visible but the people, worn / held / overlay / flying things */
function rayMeshes(S, o = {}) {
  const out = []; S.scene.traverse(m => { if (!m.isMesh || !visible(m) || m.isSkinnedMesh) return; if (tag(m, 'actor') || tag(m, 'worn') || tag(m, 'heldBy') || tag(m, 'overlay') || tag(m, 'airborne')) return;
    if (o.noBackdrop && (m.geometry?.type === 'SphereGeometry' && m.geometry.parameters?.radius > 30)) return;
    const mt = matOf(m); if (mt?.transparent && mt.opacity < .3 && !tag(m, 'ground')) return; if (o.solidOnly && mt?.isShadowMaterial) return; out.push(m); });
  return out;
}

export function issues(S, def, t, where, restep) {
  const out = [], add = (type, what, detail, rect) => out.push(rect ? { t, type, what: `${what} ${where}`, detail, rect } : { t, type, what: `${what} ${where}`, detail });
  const dbg = globalThis.__CZ_QA_DEBUG ? (what, detail) => out.push({ t, type: 'debug', what, detail }) : () => {};   // (scripts/lowpoly-qa: the measured numbers)
  const actors = (S.actors || []).filter(a => a.root.visible && visible(a.root)), sol = solids(S, true), cam = S.cam;
  S.scene.updateMatrixWorld(true);
  const caps = new Map(actors.map(a => [a, bodyCaps(a)]));
  const aRect = a => rectOf(a.box(), cam);
  // people / animals vs solids (and flying props)
  for (const a of actors) {
    if (a.root.userData.noCheck || a.root.userData.airborne) continue;
    const clip = clipAt(a, t), lying = NOGROUND.test(clip);
    let found = false;
    for (const [A, B, r, bone] of caps.get(a)) {
      const capBox = new THREE.Box3().setFromPoints([A, B]).expandByScalar(r), pts = /^foot_/.test(bone) ? [A, A.clone().lerp(B, .5), B] : capPoints(A, B, r);   // (soles stand ON things: no points under the foot)
      for (const s of sol) {
        // the seat it sits on: only the hips, back and thighs may touch it (feet through a boat's hull, arms through the chair back still count)
        const seatPart = /^(pelvis|spine|thigh)/.test(bone);
        if (seatPart && (s.m.userData.seatOf === a || a.seat && rootOf(s.m) === a.seat)) continue;
        const onSeat = a.seated && a.seatPos && (a.seat && rootOf(s.m) === a.seat || new THREE.Box3().setFromObject(rootOf(s.m)).expandByScalar(.08).containsPoint(a.seatPos));
        if (seatPart && onSeat) continue;
        if (s.air && isIn(s.m, a.root)) continue;
        if (!capBox.intersectsBox(s.b)) continue;
        // against its own seat: the knee rests on the front edge and forearms on the armrests, so only the lower calf / the
        // arm's axis count there (a shin inside a crate or through a chair back still does)
        const use = !onSeat ? pts : /^calf/.test(bone) ? [A.clone().lerp(B, .6), B] : [A, A.clone().lerp(B, .5), B];
        let hit = 0; for (const p of use) if (s.b.containsPoint(p) && inside(s.m, p)) { hit++; break; }
        if (hit) { add('through', a.name || 'a person', s.air ? `${nameOf(s.m)} (flying) passes through the ${bone.replace(/_/g, ' ')}: move its path around the body, or let it hit and react.` : `${bone.replace(/_/g, ' ')} passes through ${nameOf(s.m)}${lying ? ' (while ' + clip + ')' : ''}: move the person or the object, change the clip, or use a seat / spot of the set (set.spots) so the body clears it.`, aRect(a)); found = true; break; }
      }
      if (found) break;
    }
  }
  // held props through the holder's own body (not the holding arm)
  for (const a of actors) for (const h of a.holds) { if (t < h.at || t >= h.until || !visible(h.item)) continue;
    const ms = []; h.item.traverse(m => { if (m.isMesh && visible(m)) { m.updateMatrixWorld(true); ms.push({ m, b: new THREE.Box3().setFromObject(m) }); } });
    let hitBone = null;
    for (const [A, B, r, bone] of caps.get(a)) { if (new RegExp(`(lowerarm|hand|fingers)_${h.hand}$`).test(bone)) continue;
      const pts = capPoints(A, B, r); for (const s of ms) { if (pts.some(p => s.b.containsPoint(p) && inside(s.m, p))) { hitBone = bone; break; } } if (hitBone) break; }
    if (hitBone) add('through', a.name || 'a person', `the ${heldName(h.item)} in the ${h.hand === 'l' ? 'left' : 'right'} hand passes through the ${hitBone.replace(/_/g, ' ')}: hold it further out (offset), a smaller prop, or another grip / clip.`, aRect(a)); }
  // hair / hats / glasses cutting into the face (measured once against the skull when they are put on)
  if (!def._wornSeen) { def._wornSeen = true; for (const a of actors) for (const w of a.wornIssues || []) add('worn', a.name || 'a person', `${w}: a smaller hat / other hair style, or move it up.`, aRect(a)); }
  // people vs people
  for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) {
    const A = actors[i], B = actors[j]; if (A.root.position.distanceTo(B.root.position) > 2.5 || A.root.userData.touch || B.root.userData.touch) continue;
    let worst = 0, part = '';
    for (const [a1, a2, r1, n1] of A.capsules()) for (const [b1, b2, r2, n2] of B.capsules()) { const d = segDist(a1, a2, b1, b2), pen = r1 + r2 - d; if (pen > worst) { worst = pen; part = `${n1} / ${n2}`; } }
    if (worst > .05) add('bodies', `${A.name || 'a person'} + ${B.name || 'a person'}`, `the two bodies overlap by ${Math.round(worst * 100)} cm (${part.replace(/_/g, ' ')}): space them at least 0.6 m apart, or mark a hug / handshake with root.userData.touch = true.`, rectOf(A.box().union(B.box()), cam));
  }
  // own hands / forearms inside the own torso or head (a clip's arms crossing through the chest, a facepalm through the skull)
  for (const a of actors) { if (a.animal || a.root.userData.noCheck) continue;
    const p0 = a.boneAt('pelvis'), p1 = a.boneAt('spine_03'), hc = a.bones.Head ? a.head().sub(new THREE.Vector3(0, .09 * a.scale, 0)) : null; if (!p0 || !p1) continue;
    for (const s of ['l', 'r']) { const la = a.boneAt('lowerarm_' + s), hd = a.boneAt('hand_' + s); if (!la || !hd) continue;
      const fa = la.clone().lerp(hd, .5), torsoR = .14 * a.scale;
      const dT = Math.min(segDist(hd, hd, p0, p1), segDist(fa, fa, p0, p1)), dH = hc ? hd.distanceTo(hc) : 1e9; dbg(a.name || 'self', `${s} torso ${dT.toFixed(3)} head ${dH.toFixed(3)}`);
      if (dT < torsoR * .55) { add('self', a.name || 'a person', `the ${s === 'l' ? 'left' : 'right'} ${segDist(hd, hd, p0, p1) < segDist(fa, fa, p0, p1) ? 'hand' : 'forearm'} is ${Math.round((torsoR - dT) * 100)} cm inside the torso (${clipAt(a, t)}): another clip, or a pose that keeps the arm in front of the body.`, aRect(a)); break; }
      if (dH < .075 * a.scale) { add('self', a.name || 'a person', `the ${s === 'l' ? 'left' : 'right'} hand is inside the head (${clipAt(a, t)}): another clip, or turn the head away.`, aRect(a)); break; } } }
  // feet on the ground (the clip: relative to the person's own root)
  for (const a of actors) {
    if (a.animal || a.seated || a.root.userData.airborne || a.root.userData.noCheck) continue;
    const clip = clipAt(a, t); if (NOGROUND.test(clip)) continue;
    const { low } = footClearance(a);
    if (low > (/Run|Sprint|Jog/i.test(clip) ? .2 : .05)) add('feet', a.name || 'a person', `feet float ${Math.round(low * 100)} cm above the ground during ${clip}: put the person on the floor (y = the surface under them) or use a clip that leaves the ground.`, aRect(a));
    if (low < -.045) add('feet', a.name || 'a person', `feet sink ${Math.round(-low * 100)} cm into the ground during ${clip}: raise the person to the surface they stand on.`, aRect(a));
  }
  // feet on what is really under them (the placement: a person at y 0.1 over a floor at 0 floats, at y 0.75 stands on the table)
  const RM = rayMeshes(S);
  for (const a of actors) {
    if (a.animal || a.seated || a.root.userData.airborne || a.root.userData.noCheck) continue;
    const clip = clipAt(a, t); if (NOGROUND.test(clip)) continue;
    const off = soleOffsets(a), cs = []; let low = 1e9, on = null;
    for (const n of ['foot_l', 'foot_r', 'ball_l', 'ball_r']) { const b = a.bones[n]; if (!b) continue; const p = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld), sole = p.y - (off[n] ?? 0);
      // from just above the sole (a table top or shelf the foot is tucked under is not the floor), upward-facing surfaces only
      ray.set(new THREE.Vector3(p.x, sole + .25, p.z), DOWN); ray.far = 4; const hit = ray.intersectObjects(RM, false).find(h => !h.face || h.face.normal.clone().transformDirection(h.object.matrixWorld).y > .5); if (!hit) continue;
      const c = sole - hit.point.y; cs.push({ c, o: hit.object }); if (c < low) { low = c; on = hit.object; } }
    if (!cs.length) continue;
    const sk = cs.filter(x => x.c < -.05).sort((x, y) => x.c - y.c), sunk = sk.length >= 2 ? sk[1].c : 0, run = /Run|Sprint|Jog/i.test(clip);   // (two foot points down: one toe dipping is the clip)
    dbg(a.name || 'support', `support low ${low.toFixed(3)} sunk ${sunk.toFixed(3)} on ${nameOf(on)}`);
    if (low > (run ? .2 : .05)) add('support', a.name || 'a person', `feet float ${Math.round(low * 100)} cm above ${nameOf(on)} under them: set the person's y to that surface (a.at(x, surfaceY, z)).`, aRect(a));
    else if (sunk < -.05) add('support', a.name || 'a person', `a foot sinks ${Math.round(-sunk * 100)} cm into ${nameOf(sk[1].o)}: set the person's y to the top of the surface they stand on.`, aRect(a));
    const r = on && rootOf(on); if (r && (r.userData.libId || r.userData.pickRoot) && !tag(on, 'ground') && !r.userData.floor && !r.userData.standOn && /^(prop|vehicle)/.test(r.userData.kind || r.userData.libId || 'prop') && on.matrixWorld && low < .1) {
      const top = new THREE.Box3().setFromObject(r).max.y; if (top > .2) add('support', a.name || 'a person', `stands on top of ${nameOf(on)} (${Math.round(top * 100)} cm up): put the person on the floor beside it (or mark the object userData.standOn = true when standing on it is the picture).`, aRect(a)); }
  }
  // seated people sit ON the seat: rays down from 12 cm above the pelvis and the middle of both thighs find the top of what
  // is under them (from above: a pelvis sunk into a cushion still finds the cushion's top); it must sit right under the
  // bones (Sitting_Idle_Loop on a chair: 8-10 cm under the pelvis bone, 7-8 cm under the thigh)
  for (const a of actors) { if (a.animal || !a.seated || a.root.userData.noCheck) continue; const pv = a.boneAt('pelvis'); if (!pv) continue;
    let best = null;
    for (const p of [pv, ...['l', 'r'].map(s => { const th = a.boneAt('thigh_' + s), ca = a.boneAt('calf_' + s); return th && ca ? th.clone().lerp(ca, .45) : null; })]) { if (!p) continue;
      ray.set(p.clone().add(new THREE.Vector3(0, .12, 0)), DOWN); ray.far = 2; const hit = ray.intersectObjects(RM, false).find(h => !h.face || h.face.normal.clone().transformDirection(h.object.matrixWorld).y > .3); if (!hit) continue;
      const gap = p.y - hit.point.y - (p === pv ? .09 : .075) * a.scale; if (!best || Math.abs(gap) < Math.abs(best.gap)) best = { gap, on: hit.object }; }
    if (best) { dbg(a.name || 'seat', `seat gap ${best.gap.toFixed(3)} on ${nameOf(best.on)}`);
      if (best.gap > .07) add('seat', a.name || 'a person', `sits ${Math.round(best.gap * 100)} cm above ${nameOf(best.on)}: sit() on the seat object itself (it finds the seat height), or lower pos y.`, aRect(a));
      else if (best.gap < -.07) add('seat', a.name || 'a person', `sits ${Math.round(-best.gap * 100)} cm into ${nameOf(best.on)}: raise pos y to the seat top.`, aRect(a)); } }
  // feet sliding on walks: every heel / ball on its own; while one is on the floor (within 1.5 cm in both frames) it must
  // not move. (The old test followed the lowest of the four bones: a crouch walk's swing foot passing low counted as a
  // "slide" of 9-13 cm while the real planted-foot drift was 5-8 cm. Validated against frame-by-frame bone positions.)
  const walkers = actors.filter(a => !a.animal && (a.moves.some(m => t >= m.at && t < m.at + m.dur) || /Walk|Run|Jog/i.test(clipAt(a, t))));
  if (walkers.length && restep) {
    const BN = ['foot_l', 'ball_l', 'foot_r', 'ball_r'], track = walkers.map(() => []);
    const NF = Math.max(2, Math.min(24, Math.floor(((def.t1 ?? t + 1) - t) * 30))); for (let f = 0; f <= NF; f++) { restep(t + f / 30); walkers.forEach((a, i) => { const off = soleOffsets(a), g = a.root.position.y;
      track[i].push(BN.map(n => { const b = a.bones[n]; if (!b) return null; const p = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld); return { h: p.y - (off[n] ?? 0) - g, x: p.x, z: p.z }; })); }); }
    restep(t);
    // per contact: the travel of the bone while it is down, without the heel-strike step and the last three steps (the
    // mocap's own toe-off: Walk_Loop's toe tip scuffs 4-5 cm forward in its last 2-3 frames down, on every clean walk)
    walkers.forEach((a, i) => { let slide = 0, bone = ''; const tr = track[i];
      BN.forEach((n, j) => { let seg = [], first = 0;
        for (let f = 0; f <= tr.length; f++) { const c = tr[f]?.[j];
          if (c && c.h < .015) { if (!seg.length) first = f; seg.push(c); continue; }
          if (seg.length > 1) { const st = seg.slice(1).map((q, k) => Math.hypot(q.x - seg[k].x, q.z - seg[k].z)); const a0 = first > 0 ? 1 : 0, b0 = 3;
            const d = st.slice(a0, Math.max(a0, st.length - b0)).reduce((x, y) => x + y, 0); if (d > slide) { slide = d; bone = n; } }
          seg = []; } });
      if (slide > .035) add('feet', a.name || 'a person', `the planted foot (${bone.replace('_', ' ')}) slides ${Math.round(slide * 100)} cm on the walk: keep walk()'s own speed (no extra moves on root.position), or use pace to change the step rate instead of the distance.`, aRect(a)); });
  }
  // held props touch the palm (measured from the palm point hold() made, else the hand bone)
  for (const a of actors) for (const h of a.holds) { if (t < h.at || t >= h.until) continue;
    const hb = a.bones['hand_' + h.hand]; if (!hb) continue; const hp = h.sock ? new THREE.Vector3().setFromMatrixPosition(h.sock.matrixWorld) : new THREE.Vector3().setFromMatrixPosition(hb.matrixWorld), b = new THREE.Box3().setFromObject(h.item);
    const lim = h.sock ? .035 : .07; dbg(a.name || 'hand', `palm ${b.distanceToPoint(hp).toFixed(3)}`);
    if (!b.isEmpty() && b.distanceToPoint(hp) > lim) add('hand', a.name || 'a person', `${heldName(h.item)} is ${Math.round(b.distanceToPoint(hp) * 100)} cm from the ${h.sock ? 'palm' : 'hand'} that holds it: hold() with a grip that fits and no offset away from the palm.`, rectOf(b.clone().expandByPoint(hp), cam)); }
  // props resting on nothing (every checked frame: a prop that moves can end up in the air); props sunk into the ground and
  // props far from their real size (once per shot)
  { const voidSet = /^(void|space)/.test(S.setName || ''), once = !def._floatSeen, grounds = RM.filter(m => tag(m, 'ground')); def._floatSeen = true; let all = null;
    for (const p of S.props || []) { if (!visible(p) || p.userData.airborne || p.userData.noCheck || p.userData.heldBy || p.userData.wall || p.userData.hang) continue;
      const b = new THREE.Box3().setFromObject(p); if (b.isEmpty()) continue; const c = b.getCenter(new THREE.Vector3());
      if (!voidSet && b.min.y >= .02) { ray.set(new THREE.Vector3(c.x, b.min.y + .004, c.z), DOWN); ray.far = 3;
        all ??= (() => { const l = []; S.scene.traverse(m => { if (m.isMesh && visible(m) && !tag(m, 'actor')) l.push(m); }); return l; })();
        const hit = ray.intersectObjects(all.filter(m => !isIn(m, p)), false)[0];
        if (!hit || hit.distance > .04) add('floating', nameOf(p), `hangs ${hit ? Math.round(hit.distance * 100) + ' cm' : ''} above what is under it: rest it on the surface (y = its top) or mark it userData.airborne = true if it really flies.`, rectOf(b, cam)); }
      if (!once) continue;
      if (grounds.length && !p.userData.sunkOk && !/^(set|building)/.test(p.userData.kind || '')) { ray.set(new THREE.Vector3(c.x, b.max.y + 2, c.z), DOWN); ray.far = 50; const g = ray.intersectObjects(grounds, false)[0];
        if (g && b.min.y < g.point.y - .03) add('sunk', nameOf(p), `is sunk ${Math.round((g.point.y - b.min.y) * 100)} cm into the ground: raise it to y = ${g.point.y.toFixed(2)} (mark userData.sunkOk = true if it is meant to be buried).`, rectOf(b, cam)); }
      const e = p.userData.libId && libEntry(p.userData.libId), sz = e?.size_m; if (sz && !p.userData.scaleOk && /^(prop|vehicle|animal)/.test(e.kind || '')) {
        const s = b.getSize(new THREE.Vector3()), ref = sz[1] > .05 ? s.y / sz[1] : Math.max(s.x, s.y, s.z) / Math.max(...sz);
        if (ref > 2.2 || ref < .45) add('scale', nameOf(p), `is ${ref > 1 ? ref.toFixed(1) + 'x its real size' : Math.round(ref * 100) + '% of its real size'} (${Math.round(s.y * 100)} cm tall, the library model is ${Math.round(sz[1] * 100)} cm): use its own size next to people (no height / size option), or mark userData.scaleOk = true when the odd size IS the joke.`, rectOf(b, cam)); } } }
  // the camera: inside / grazing a solid, inside a person, a surface filling the frame from very close
  const cp = cam.position;
  for (const s of sol) { if (s.air) continue; if (s.m.userData.shell && !s.b.containsPoint(cp)) continue; const d = s.b.distanceToPoint(cp);
    if (s.b.containsPoint(cp) ? inside(s.m, cp) || s.m.userData.shell : d < cam.near * 1.5) { add('camera', 'camera', `the camera is ${s.b.containsPoint(cp) ? 'inside' : 'touching'} ${nameOf(s.m)}: move it out or frame from another side.`); break; } }
  for (const a of actors) { if (a === S.pov) continue;            // the body's capsules (its box: a face close-up next to raised arms was "inside")
    const hit = a.capsules().find(([A, B, r]) => segDist(A, B, cp, cp) < r + .06);
    if (hit) add('camera', 'camera', `the camera is inside ${a.name || 'a person'} (${hit[3].replace(/_/g, ' ')}): frame from further away (or use cam 'pov' with from: that person).`); }
  { const subj = S.subject, mine = o => subj && (subj.root ? isIn(o, subj.root) : subj.isObject3D ? isIn(o, subj) : false);
    let near = 0, tot = 0, nearest = 1e9, what = null; const ndc = new THREE.Vector2(), VM = RM.filter(m => !tag(m, 'ground') || true);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { ndc.set(-.8 + i * .4, -.8 + j * .4); ray.setFromCamera(ndc, cam); ray.near = 0; ray.far = .3; tot++;
      const hit = ray.intersectObjects(VM, false).find(h => !mine(h.object)); if (hit) { near++; if (hit.distance < nearest) { nearest = hit.distance; what = hit.object; } } }
    ray.near = 0; if (near / tot >= .4 && S.def.macro !== true) add('camera', 'camera', `${nameOf(what)} fills ${Math.round(near / tot * 100)}% of the frame from ${Math.round(nearest * 100)} cm: move the camera back or around it (the near clip cuts it open).`); }
  // bodies above the room's ceiling or behind its back / side walls
  if (S.bounds) { const B = S.bounds;
    for (const a of actors) { if (a.root.userData.noCheck || a.root.userData.airborne) continue; let msg = null;
      for (const [A, Bp, r, bone] of caps.get(a)) for (const p of [A, Bp]) { if (B.h && p.y + (bone === 'head' ? r : 0) > B.h + .01) msg ??= `the ${bone.replace(/_/g, ' ')} is above the ceiling (${B.h} m): a taller room (room h) or a shorter / seated person.`;
        else if (p.x < B.x0 - .02 || p.x > B.x1 + .02 || p.z < B.z0 - .02) msg ??= `the ${bone.replace(/_/g, ' ')} is behind the room's wall: move the person into the room.`; }
      if (msg) add('ceiling', a.name || 'a person', msg, aRect(a)); } }
  // the subject in frame
  const subj = S.subject; if (subj && (subj.box || subj.isObject3D)) {
    const b = subj.box ? subj.box() : new THREE.Box3().setFromObject(subj), r = screenRect(b, cam), nm = subj.name || subj.root?.name || 'the subject';
    if (!r) add('subject', nm, 'is not in the frame at all: aim the camera at it (cam: { on: ... }).');
    else { if (r.h < .1 && !S.wide) add('subject', nm, `is only ${Math.round(r.h * 100)}% of the frame height: frame closer (or set S.wide = true when a wide shot is the point).`, rectOf(b, cam));
      if (subj.head) { const hb = new THREE.Box3().setFromCenterAndSize(subj.head().sub(new THREE.Vector3(0, .06 * (subj.scale || 1), 0)), new THREE.Vector3(.22, .26, .22).multiplyScalar(subj.scale || 1)), hr = screenRect(hb, cam, true);
        if (hr && hr.out > .45) add('subject', nm, `the head is ${Math.round(hr.out * 100)}% outside the frame: tilt / move the camera so the face is in.`, rectOf(hb, cam)); } } }
  // head turns further than a neck goes (the clamp leaves the face looking past the target)
  for (const a of actors) { if (a.animal) continue; const lk = [...(a.looks || [])].reverse().find(l => t >= l.at + .35 && t < l.until); if (!lk) continue;
    const tg = lk.target?.isVector3 ? lk.target : Array.isArray(lk.target) ? new THREE.Vector3(...lk.target) : lk.target?.head ? lk.target.head() : lk.target?.isObject3D ? new THREE.Box3().setFromObject(lk.target).getCenter(new THREE.Vector3()) : null; if (!tg) continue;
    const ry = a.root.rotation.y, f = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), d = tg.clone().sub(a.root.position); d.y = 0; if (d.lengthSq() < .01) continue;
    const ang = f.angleTo(d.normalize()); if (ang > 1.45) add('look', a.name || 'a person', `looks at something ${Math.round(ang * 180 / Math.PI)} degrees to the side / behind: the head turns ~70 degrees, so the face points past it. Turn the body to it (a.face(target)) or put the target in front.`, aRect(a)); }
  // text over text / the caption / faces; text cut by the frame edge; text too small to read
  const boxes = (S._ovBoxes || []).filter(x => x.box && x.box.w > 4);
  const capOn = S._capBox, capsShown = SETTINGS.captions?.on !== false && S.def.captions !== false, cb = captionBox(''), band = { x: FW * .08, y: cb.y - cb.sz * 1.3, w: FW * .84, h: cb.sz * 2.9 };
  for (let i = 0; i < boxes.length; i++) {
    const A = boxes[i].box, steady = !(boxes[i].age < .3);
    if (capOn && overlap(A, capOn) > .15) add('covered', boxes[i].what, 'sits on the caption: move it up or down (captions are at ' + Math.round(captionBox('').y / FH * 100) + '% of the height).', ovRect(A));
    else if (capsShown && steady && overlap(A, band) > .25 && A.y + A.h > band.y + band.h * .25) add('covered', boxes[i].what, `sits in the caption band (${Math.round(band.y / FH * 100)}-${Math.round((band.y + band.h) / FH * 100)}% of the height): the next caption lands on it. Move it up.`, ovRect(A));
    for (let j = i + 1; j < boxes.length; j++) if (overlap(A, boxes[j].box) > .15) add('covered', boxes[i].what, `overlaps ${boxes[j].what}: one thing at a time, or move them apart.`, ovRect(A));
    if (steady) { const cut = Math.max(0, -A.x) + Math.max(0, A.x + A.w - FW), cutY = Math.max(0, -A.y) + Math.max(0, A.y + A.h - FH);
      if (cut > A.w * .02 + 2 || cutY > A.h * .05 + 2) add('offframe', boxes[i].what, `is cut by the frame edge (${Math.round(cut / A.w * 100 || cutY / A.h * 100)}% outside): shorter text, a smaller size, or move it in.`, ovRect(A));
      if (boxes[i].text !== false && A.h < 26 * Math.min(FW, FH) / 1080) add('small', boxes[i].what, `is ${Math.round(A.h)} px tall: too small to read on a phone (26 px at least on a 1080 frame; captions are ~46).`, ovRect(A)); }
    // (pane A of a split screen shows the middle half of its picture: 'h' on the top half, 'v' on the left half)
    const sp = def.split && !S.pane ? def.split : null, toFrame = r => sp === 'h' ? { ...r, y: r.y - .25 } : sp === 'v' ? { ...r, x: r.x - .25 } : r;
    for (const a of actors) { if (!a.faceMask) continue; const hb = new THREE.Box3().setFromCenterAndSize(a.head().sub(new THREE.Vector3(0, .07, 0)), new THREE.Vector3(.18, .2, .18)); let hr = screenRect(hb, cam); if (hr) hr = toFrame(hr);
      if (!hr || hr.w <= .04) continue; const F = { x: hr.x * FW, y: hr.y * FH, w: hr.w * FW, h: hr.h * FH }, ix = Math.min(A.x + A.w, F.x + F.w) - Math.max(A.x, F.x), iy = Math.min(A.y + A.h, F.y + F.h) - Math.max(A.y, F.y);
      if (ix > 0 && iy > 0 && ix * iy / (F.w * F.h) > .2) add('covered', boxes[i].what, `covers ${Math.round(ix * iy / (F.w * F.h) * 100)}% of the face of ${a.name || 'a person'}: place it beside or above the head.`, ovRect(A)); }
  }
  // flat surfaces in one plane (z-fight: horizontal tops, a poster on a wall), once per shot
  if (!def._flatSeen) { def._flatSeen = true; const flats = [], boxy = [];
    S.scene.traverse(m => { if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || !visible(m) || matOf(m)?.transparent || tag(m, 'actor') || tag(m, 'noCheck')) return; const b = new THREE.Box3().setFromObject(m); if (b.isEmpty()) return;
      const s = b.getSize(new THREE.Vector3()), dims = [s.x, s.y, s.z];
      for (let ax = 0; ax < 3; ax++) { const o2 = dims.filter((_, k) => k !== ax); if (dims[ax] <= .02 * Math.max(...o2) && Math.min(...o2) >= .12 && Math.max(...o2) >= .3) { flats.push({ m, b, ax }); break; } }
      if (/^(Box|Plane)Geometry$/.test(m.geometry?.type) && Math.abs(m.rotation.x % (Math.PI / 2)) < 1e-3 && Math.abs(m.rotation.y % (Math.PI / 2)) < 1e-3) boxy.push({ m, b }); });
    const K = ['x', 'y', 'z'], same = (A, B) => rootOf(A.m) === rootOf(B.m) && rootOf(A.m) !== A.m;   // (one model's own layers are made that way)
    const olap = (A, B, ax) => K.every((k, i) => i === ax || (A.b.max[k] > B.b.min[k] + .005 && B.b.max[k] > A.b.min[k] + .005));
    // facing: a box's face at its max is +, at its min -; a plane faces its normal; a thin box both ways. Faces that touch
    // back to back (a box standing on the floor, a table top under a box) never fight; faces pointing the same way do.
    const sgn = (F, plane, k) => { if (F.m.geometry?.type === 'PlaneGeometry') { const n = new THREE.Vector3(0, 0, 1).transformDirection(F.m.matrixWorld); return Math.sign(n[k]) || 0; } return Math.abs(F.b.max[k] - plane) < .004 ? 1 : Math.abs(F.b.min[k] - plane) < .004 ? -1 : 0; };
    let hitPair = null;
    for (let i = 0; i < flats.length && !hitPair; i++) { const A = flats[i], k = K[A.ax], pa = (A.b.min[k] + A.b.max[k]) / 2;
      for (let j = i + 1; j < flats.length && !hitPair; j++) { const B = flats[j]; if (B.ax !== A.ax || same(A, B) || Math.abs((B.b.min[k] + B.b.max[k]) / 2 - pa) >= .004 && Math.abs(A.b.max[k] - B.b.max[k]) >= .004) continue; if (olap(A, B, A.ax)) hitPair = [A, B]; }
      for (const B of boxy) { if (hitPair || B.m === A.m || same(A, B) || flats.some(F => F.m === B.m)) continue; const face = Math.abs(B.b.min[k] - pa) < Math.abs(B.b.max[k] - pa) ? B.b.min[k] : B.b.max[k]; if (Math.abs(face - pa) >= .004 || !olap(A, B, A.ax)) continue;
        const sb = face === B.b.max[k] ? 1 : -1, sa = A.m.geometry?.type === 'PlaneGeometry' ? sgn(A, face, k) : (Math.abs(A.b.max[k] - face) <= Math.abs(A.b.min[k] - face) ? 1 : -1); if (sa === sb) hitPair = [A, B]; } }
    if (hitPair) add('coplanar', `${nameOf(hitPair[0].m)} / ${nameOf(hitPair[1].m)}`, `two surfaces in the same ${hitPair[0].ax === 1 ? 'horizontal' : 'vertical'} plane will flicker: lift / move the top one 1 cm off the other.`, rectOf(hitPair[0].b, cam)); }
  // geometry thinner than a render pixel but long on screen: it shimmers in and out (wires, thin poles far away), once per shot
  if (!def._thinSeen) { def._thinSeen = true; const tanH = Math.tan(cam.fov * Math.PI / 360), sc = new THREE.Vector3(); let worst = null;
    S.scene.traverse(m => { if (!m.isMesh || m.isSkinnedMesh || !visible(m) || tag(m, 'actor') || tag(m, 'noCheck') || tag(m, 'worn') || matOf(m)?.transparent || !m.geometry) return;
      m.geometry.boundingBox || m.geometry.computeBoundingBox(); const gb = m.geometry.boundingBox; if (!gb) return; m.getWorldScale(sc);
      const d3 = [(gb.max.x - gb.min.x) * Math.abs(sc.x), (gb.max.y - gb.min.y) * Math.abs(sc.y), (gb.max.z - gb.min.z) * Math.abs(sc.z)].sort((a, b) => a - b); if (d3[1] > .03 || d3[2] < .3) return;
      const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()), cc = c.clone().applyMatrix4(cam.matrixWorldInverse); if (cc.z > -cam.near) return;
      const pxPerM = RH / (2 * -cc.z * tanH), thick = d3[1] * pxPerM, long = d3[2] * pxPerM, q = c.clone().project(cam); if (Math.abs(q.x) > 1.05 || Math.abs(q.y) > 1.05) return;
      if (thick < .6 && long > 20 && (!worst || thick < worst.thick)) worst = { m, thick, long }; });
    if (worst) add('thin', nameOf(worst.m), `is ${worst.thick.toFixed(2)} render pixels thick and ${Math.round(worst.long)} long at ${RW}x${RH}: it will shimmer / break up. Make it thicker (>= 1 px), closer, or remove it.`, rectOf(new THREE.Box3().setFromObject(worst.m), cam)); }
  // the end of the world in view: rays below the horizon that hit nothing (a floor that ends, the sky under the ground)
  if (!/^(void|space|studio)/.test(S.setName || '') && !S.scene.fog && S.def.edgeOk !== true) { let miss = 0; const ndc = new THREE.Vector2(), RB = rayMeshes(S, { noBackdrop: true, solidOnly: true });
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { ndc.set(-.9 + i * .3, -.9 + j * .3); ray.setFromCamera(ndc, cam); if (ray.ray.direction.y > -.04) continue; ray.far = 600; if (!ray.intersectObjects(RB, false).length) miss++; }
    ray.near = 0; if (miss >= 2) add('edge', 'the set', `the world ends in view (${miss} of 49 sample rays below the horizon hit nothing): a bigger ground / set piece there, fog, or another camera angle.`); }
  return out;
}
function overlap(a, b) { const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); if (ix <= 0 || iy <= 0) return 0; return ix * iy / Math.min(a.w * a.h, b.w * b.h); }
/** normalised screen rect of a world box (0..1), with `out` = the share of it outside the frame */
export function screenRect(box, cam, withOut) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, front = 0;
  for (let k = 0; k < 8; k++) { v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z); const c = v.clone().applyMatrix4(cam.matrixWorldInverse); if (c.z > -cam.near) continue; front++; v.project(cam);
    const sx = (v.x + 1) / 2, sy = (1 - v.y) / 2; x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy); }
  if (!front || x1 < 0 || y1 < 0 || x0 > 1 || y0 > 1) return null;
  const area = (x1 - x0) * (y1 - y0), inA = Math.max(0, Math.min(1, x1) - Math.max(0, x0)) * Math.max(0, Math.min(1, y1) - Math.max(0, y0));
  return { x: Math.max(0, x0), y: Math.max(0, y0), w: Math.min(1, x1) - Math.max(0, x0), h: Math.min(1, y1) - Math.max(0, y0), out: area > 0 ? 1 - inA / area : 0 };
}
