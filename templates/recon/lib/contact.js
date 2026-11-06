// Spatial consistency check (sign-off, HARD RULE: everything touches what holds it): props rest on something, parts that
// belong together meet, and solid things don't pass through each other. Cheap and approximate on purpose, and judged on
// screen: only props the camera sees (8 px or bigger) are checked, and only gaps that show (2 px or more) count.
// - environment = anything that spans most of the frame or is huge (terrain, decks, cables, the bridge as one mesh): it
//   holds others up and is never itself "floating"; things with nothing under them within reach are held by design (a deck
//   hanging from cables) and hold others up too.
// - floating: grounded is a chain (environment -> a ray down lands on it, or touching -> a wheel -> the body -> the roof);
//   whatever is left floats, reported once per model (nearest named group) or per InstancedMesh. A model the frame edge
//   cuts is judged whole: its parts out of view (or too small to check) still join it up and stand it on what is under it;
//   only its pieces with a part in view are reported.
// - through: a prop's surface points inside another solid, box-like prop of another model (never terrain or planes).
// Opt out per object (or a whole group): userData.airborne = true (flying, falling, thrown) / userData.noContact = true.
// contacts(scene, { camera, height }) -> [{ type: 'floating' | 'through', name, at: [x, y, z], detail }]
import * as THREE from '../vendor/three.module.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DOWN = V(0, -1, 0);
const rc = new THREE.Raycaster(), rcIn = new THREE.Raycaster(), INDIR = V(.5774, .5771, .5776).normalize();
const MAX_PROP = 14;               // metres: bigger is environment wherever it is on screen
const INST = 4000;                 // instances per InstancedMesh (boxes are cheap: every post of a railing counts)
const MAX_PROPS = 600;             // the biggest props on screen (small loose things too: stones among hundreds of kerb slabs)
const BUDGET_MS = 3500;            // per call: what is left unchecked is said

const optedOut = o => { for (let p = o; p; p = p.parent) if (p.userData?.airborne || p.userData?.noContact) return true; return false; };
const shown = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };
const solidMat = m => [].concat(m.material).every(mt => mt && !(mt.transparent && (mt.opacity ?? 1) < .6) && mt.visible !== false && !mt.wireframe);
/** The model a mesh belongs to: its nearest group that is prop-sized (a car, a fence, a crate - not the whole bridge or the
 *  world), else the mesh itself. (cache: a group's size per check) */
let SIZED = new Map();
const propSized = g => { if (!SIZED.has(g)) { const b = new THREE.Box3().setFromObject(g); SIZED.set(g, !b.isEmpty() && maxDim(b) <= MAX_PROP); } return SIZED.get(g); };
const modelOf = o => { for (let p = o.parent; p && !p.isScene; p = p.parent) if (p.isGroup || p.type === 'Object3D') { if (propSized(p)) { let top = p; for (let q = p.parent; q && !q.isScene && propSized(q); q = q.parent) top = q; return top; } break; } return o; };
const label = (o, k) => {
  let n = ''; for (let p = o; p && !n; p = p.parent) n = p.name || p.userData?.kind || '';
  return `${n || o.geometry?.type?.replace('Geometry', '').toLowerCase() || 'mesh'}${k != null ? ` #${k}` : ''}`;
};
const fmt = v => v.toArray().map(x => x.toFixed(2)).join(', ');
const size = b => b.getSize(V());
const vol = b => { const s = size(b); return Math.max(1e-9, s.x * s.y * s.z); };
const maxDim = b => { const s = size(b); return Math.max(s.x, s.y, s.z); };

/** A body part of code-built people (models.js cast(): one InstancedMesh per part kind in one group): bodies are checked by
 *  collide.js (S.collide), not here. */
const castPart = o => o.isInstancedMesh && (o.parent?.children.filter(c => c.isInstancedMesh && c.count === o.count).length ?? 0) >= 10;
/** Every solid mesh (and a sample of each InstancedMesh's instances) with its world box. */
function items(scene) {
  const out = [], m4 = new THREE.Matrix4();
  scene.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || o.isSprite || !o.geometry || !shown(o) || !solidMat(o)) return;   // people: collide.js
    if ([].concat(o.material).every(mt => mt?.isMeshBasicMaterial)) return;                          // effects: streaks, glows, sky shapes
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const gb = o.geometry.boundingBox; if (!gb || gb.isEmpty()) return;
    const skip = optedOut(o) || castPart(o), model = modelOf(o);
    if (o.isInstancedMesh) {
      const n = o.count, step = Math.max(1, Math.ceil(n / INST));
      for (let k = 0; k < n; k += step) { o.getMatrixAt(k, m4); out.push({ obj: o, inst: k, box: gb.clone().applyMatrix4(m4.premultiply(o.matrixWorld)), model: o, skip, name: label(o, k) }); }
    } else out.push({ obj: o, inst: null, box: gb.clone().applyMatrix4(o.matrixWorld), model, skip, name: label(o) });
  });
  return out;
}
// inside a closed mesh: odd number of surface crossings along a ray (both faces counted)
function inside(pt, solid) {
  rcIn.set(pt, INDIR); rcIn.far = 1e4; const hits = rcIn.intersectObject(solid, false); let n = 0, last = -1;
  for (const h of hits) { if (h.distance - last > 1e-5) n++; last = h.distance; } return n % 2 === 1;
}

export function contacts(scene, o = {}) {
  const T0 = performance.now(), late = () => performance.now() - T0 > BUDGET_MS;
  SIZED = new Map();
  scene.updateMatrixWorld(true);
  const cam = o.camera, H = o.height ?? 1080, W = o.width ?? H * 16 / 9, fr = new THREE.Frustum();
  if (cam) { cam.updateMatrixWorld(true); fr.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); }
  const camPos = cam ? cam.getWorldPosition(V()) : V();
  const pxPerM = b => { if (!cam) return 1e6; const d = Math.max(.01, b.getCenter(V()).distanceTo(camPos)); return (H / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov ?? 40) / 2) / d; };
  const onScreen = b => !cam || fr.intersectsBox(b);
  const P = globalThis.__CONTACT_PROF ? (globalThis.__CONTACT_TIMES = {}) : null, mark = k => { if (P) P[k] = +(performance.now() - T0).toFixed(1); };
  const all = items(scene), out = []; mark('items');
  const X = all.map(it => ({ it, b: it.box, big: maxDim(it.box), px: maxDim(it.box) * pxPerM(it.box) }));
  // environment: huge, or a FLAT thing filling the frame (terrain, a deck, the road). A car filling a close-up is still a car
  const flat = b => { const s = size(b); return s.y < .25 * Math.max(s.x, s.z); };
  const isEnv = x => x.big > MAX_PROP || (x.px > W * .6 && flat(x.b));
  const byKey = new Map(X.map(x => [`${x.it.obj.id}:${x.it.inst ?? ''}`, x]));                                  // a ray's hit -> its item
  const slab = x => { const d = size(x.b).toArray().sort((a, b) => a - b); return d[0] < 1 || d[0] < .1 * d[2]; };  // walls, decks, floors, cables
  const env = X.filter(isEnv), envObjs = [...new Set(env.map(x => x.it.obj))];
  const visible = X.filter(x => !isEnv(x) && x.big > 1e-4 && onScreen(x.b));
  const props = visible.filter(x => !x.it.skip && x.px >= 8).sort((a, b) => b.px - a.px).slice(0, MAX_PROPS);
  const checked = new Set(props), others = visible.filter(x => !checked.has(x));   // not checked themselves, but they hold others
  mark('select'); if (P) P.counts = { all: all.length, visible: visible.length, props: props.length, env: env.length };
  const sides = new Map(); for (const m of new Set(all.map(i => i.obj))) for (const mt of [].concat(m.material)) if (mt && !sides.has(mt)) { sides.set(mt, mt.side); mt.side = THREE.DoubleSide; }
  let partial = false;
  try {
    // ---- floating: per model (a whole car, a stone, one copy of a crate). Its real lowest points (the wheel bottoms, not its
    // box) are measured straight down: within a few cm (or under 2 px on screen) it rests; nothing below within reach, it hangs
    // by design (a deck on cables); else it must be fixed at its side to something that stands beside it (a rail into its post,
    // a rod into a wall - not something lying under it). Otherwise it floats, with the measured gap. ----
    const tolOf = x => Math.max(Math.min(.08, .06 * x.big), 2 / pxPerM(x.b), x.big * .01);
    const reach = x => Math.max(.4 * x.big, Math.min(2.5 * x.big, 6));
    const flatThin = x => { const s = size(x.b); return s.y < .1 && s.y <= .25 * Math.min(s.x, s.z); };   // a plate lying down (a lane line, a decal)
    // models: a group model's parts together, a single mesh or one instance on its own
    const models = new Map(), perInst = new Map();
    // copies of one thing are placed by the same code: the 12 most visible stand for the rest (a lifted set still shows up)
    for (const x of props) { if (x.it.inst != null) { const n = perInst.get(x.it.obj) ?? 0; if (n >= 12) continue; perInst.set(x.it.obj, n + 1); }
      const k = x.it.inst != null ? x : x.it.model; const m = models.get(k) ?? { parts: [], box: new THREE.Box3(), key: k }; m.parts.push(x); m.box.union(x.b); models.set(k, m); }
    // a group model is judged by ALL its parts, in view or not (and those too small to check): a chair cut by the frame edge
    // is still one chair standing on its castors, not a seat floating apart from its base
    const whole = new Map();
    for (const x of X) if (x.it.inst == null && x.it.model !== x.it.obj && models.has(x.it.model) && !x.it.skip && !isEnv(x) && x.big > 1e-4) (whole.get(x.it.model) ?? whole.set(x.it.model, []).get(x.it.model)).push(x);
    // a model in pieces that don't touch (a rail short of its posts): each loose piece is checked on its own, if it is in view
    const units = [];
    for (const m of models.values()) {
      const all = whole.get(m.key) ?? m.parts;
      if (all.length < 2) { units.push(m); continue; }
      // parts touch when their boxes come within the larger one's tolerance (swept along x: imported models have thousands)
      const tl = all.map(tolOf), T = tl.reduce((a, b) => Math.max(a, b), 0), par = all.map((_, i) => i), f = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
      const ord = all.map((_, i) => i).sort((a, b) => all[a].b.min.x - all[b].b.min.x);
      for (let a = 0; a < ord.length; a++) { const i = ord[a], A = all[i].b;
        for (let c = a + 1; c < ord.length; c++) { const j = ord[c], B = all[j].b, t = Math.max(tl[i], tl[j]); if (B.min.x > A.max.x + T) break;
          if (B.min.x <= A.max.x + t && B.min.y <= A.max.y + t && B.max.y >= A.min.y - t && B.min.z <= A.max.z + t && B.max.z >= A.min.z - t) par[f(i)] = f(j); } }
      const inView = new Set(m.parts), comp = new Map();
      all.forEach((x, i) => { const r = f(i); const c = comp.get(r) ?? { parts: [], shown: [], box: new THREE.Box3(), key: m.key, of: m }; c.parts.push(x); if (inView.has(x)) c.shown.push(x); c.box.union(x.b); comp.set(r, c); });
      for (const c of comp.values()) { if (comp.size < 2) delete c.of; if (c.shown.length) units.push(c); }  // one piece: just the model; a piece out of view: not judged
    }
    // the lowest points of a unit: real surface points (vertices, sampled), not box corners (the corners of a curved car
    // body's box hang in the air below its bumper). Its feet are the ones within ~3% of its height of the very bottom
    // (the tyre bottoms), spread out
    const m4 = new THREE.Matrix4(), vv = V();
    const lowest = (u, n = 6) => {
      const pts = [], band = Math.max(.02, .2 * size(u.box).y); let low = Infinity;
      // parts from the bottom up, until the next one starts above the band (the rest of a big model never gets that low)
      for (const x of [...u.parts].sort((a, b) => a.b.min.y - b.b.min.y)) { if (x.b.min.y > low + band) break;
        const pos = x.it.obj.geometry.attributes.position; if (!pos) continue;
        if (x.it.inst != null) { x.it.obj.getMatrixAt(x.it.inst, m4); m4.premultiply(x.it.obj.matrixWorld); } else m4.copy(x.it.obj.matrixWorld);
        const step = Math.max(1, Math.floor(pos.count / 400));
        for (let k = 0; k < pos.count; k += step) { const p = vv.fromBufferAttribute(pos, k).applyMatrix4(m4).clone(); pts.push(p); if (p.y < low) low = p.y; } }
      pts.sort((a, b) => a.y - b.y); const out = [], minY = pts[0]?.y ?? 0, sz = maxDim(u.box);
      for (const p of pts) { if (p.y > minY + band) break; if (out.every(q => Math.hypot(q.x - p.x, q.z - p.z) > .2 * sz)) out.push(p); if (out.length >= n) break; }
      return out;
    };
    const inUnit = (u, obj, inst) => u.parts.some(x => x.it.obj === obj && (x.it.inst == null || x.it.inst === inst));
    // the gap under a unit's feet (every bottom point within ~6% of its height of the very bottom: the wheel bottoms of a car;
    // points higher up, a chassis above the road, may have a gap). Infinity: nothing below within reach
    const measure = (u, tol, far) => {
      const low = lowest(u), cc = u.box.getCenter(V()), gaps = [];
      // inset a little toward the unit's centre: a corner exactly on an edge can miss what it stands on
      const qs = low.map(p => V(p.x + (cc.x - p.x) * .08, p.y + .01, p.z + (cc.z - p.z) * .08));
      // things entirely out of reach below (the terrain under a bridge) are skipped: their triangles are the cost
      const cast = (q, env) => { rc.set(q, DOWN); rc.far = far + .02; let g = Infinity;
        const tg = [...new Set(X.filter(j => isEnv(j) === env && j.b.min.y < q.y && j.b.max.y >= q.y - far - .05 && q.x >= j.b.min.x - .01 && q.x <= j.b.max.x + .01 && q.z >= j.b.min.z - .01 && q.z <= j.b.max.z + .01).map(j => j.it.obj))];
        for (const h of rc.intersectObjects(tg, false)) { if (inUnit(u, h.object, h.instanceId)) continue; g = h.distance - .01; break; } return g; };
      for (const q of qs) { let g = cast(q, false); if (g > tol) g = Math.min(g, cast(q, true)); gaps.push(g); }   // small things first
      const minY = Math.min(...qs.map(q => q.y)), footBand = Math.max(.02, .03 * size(u.box).y);
      const feet = gaps.filter((g, i) => qs[i].y <= minY + footBand), bad = feet.filter(g => g > tol && isFinite(g));
      let best = !bad.length && feet.some(g => g <= tol) ? 0 : bad.length ? Math.max(...bad) : Math.min(...gaps);
      if (gaps.every(g => !isFinite(g) || g > far)) best = Infinity;
      return { best, gaps, low };
    };
    // every box again from the objects' matrices now (the scene was stepped)
    const m6 = new THREE.Matrix4();
    const reBox = () => { for (const x of X) { const gb = x.it.obj.geometry.boundingBox;
      if (x.it.inst != null) { x.it.obj.getMatrixAt(x.it.inst, m6); x.it.box = x.b = gb.clone().applyMatrix4(m6.premultiply(x.it.obj.matrixWorld)); } else x.it.box = x.b = gb.clone().applyMatrix4(x.it.obj.matrixWorld); }
      for (const u of units) { u.box = new THREE.Box3(); for (const x of u.parts) u.box.union(x.b); } };
    for (const u of units) {
      if (late()) { partial = true; break; }
      const lead = (u.shown ?? u.parts).reduce((a, b) => b.px > a.px ? b : a), ux = { big: maxDim(u.box), b: u.box };   // named by what is in view
      if (u.parts.every(flatThin) || maxDim(u.box) * pxPerM(u.box) < 16) continue;                          // decals / too small to show a gap
      const tol = tolOf(ux), far = reach(ux), { best: b0, gaps, low } = measure(u, tol, far); let best = b0;
      if (globalThis.__CONTACT_DEBUG) (globalThis.__CONTACT_UNITS ??= []).push({ name: lead.it.name, parts: u.parts.length, gaps: gaps.map(g => isFinite(g) ? +g.toFixed(3) : null), best: +best.toFixed(3), tol: +tol.toFixed(3), far: +far.toFixed(2), size: size(u.box).toArray().map(v => +v.toFixed(2)), low: low.map(p => +p.y.toFixed(3)) });
      if (best <= tol || best > far) continue;                                // rests / hangs by design
      // fixed at its side: touching something not flat, not itself, beside it (its height covers this one's middle)
      const near = u.box.clone().expandByScalar(tol), midY = (u.box.min.y + u.box.max.y) / 2;
      // (only slender things hang at their side - rails, rods, poles, signs - never a car or a stone; and never on a copy of itself)
      const d = size(u.box).toArray().sort((a, b) => a - b), slender = d[2] >= 3 * d[0];
      const self = j => j.it.model === u.key || u.parts.includes(j) || u.parts.some(x => x.it.obj === j.it.obj && x.it.inst != null);
      if (slender && X.some(j => !self(j) && !flatThin(j) && j.b.min.y <= midY && j.b.max.y >= midY && j.b.intersectsBox(near))) continue;
      const c = u.box.getCenter(V()), sz = size(u.box), nm = lead.it.name.replace(/ #\d+$/, ''), whole = u.of ? (u.of.key?.name || u.of.key?.userData?.kind || 'its model') : null;
      out.push({ type: 'floating', name: lead.it.name, at: c.toArray(), model: u.key.it?.obj ?? u.key, gap: best, unit: u,
        detail: `"${nm}"${u.parts.length > 1 ? ` (${u.parts.length} parts)` : ''}${u.of ? ` - a loose piece of ${whole === 'its model' ? whole : `"${whole}"`}, not touching the rest -` : ''} around ${fmt(c)}, ${sz.x.toFixed(2)} × ${sz.y.toFixed(2)} × ${sz.z.toFixed(2)}: its lowest point is ${(best * 100).toFixed(0)} cm above what is under it, and it is not fixed to anything beside it` });
    }
    mark('rays');
    // in motion: falling, thrown or flying = the thing itself moves up or down faster than 1 m/s (0.1 m in the next 0.1 s).
    // A car standing still above a deck that twists under it is not in motion: it floats
    if (o.later && out.some(f => f.unit)) {
      const y0 = out.map(f => f.unit ? f.unit.box.getCenter(V()).y : 0);
      o.later(); scene.updateMatrixWorld(true); reBox();
      const changed = out.map((f, i) => f.unit ? Math.abs(f.unit.box.getCenter(V()).y - y0[i]) > .1 : false);
      o.back?.(); scene.updateMatrixWorld(true); reBox();
      for (let i = out.length - 1; i >= 0; i--) if (changed[i]) out.splice(i, 1);
    }
    for (const f of out) delete f.unit;
    // copies of one thing (instances) floating together: one line
    { const byObj = new Map(), rest = [];
      for (const f of out.splice(0)) { const k = f.model?.isInstancedMesh ? f.model : null; if (!k) { rest.push(f); continue; } (byObj.get(k) ?? byObj.set(k, []).get(k)).push(f); }
      for (const [k, fs] of byObj) { if (fs.length === 1) { rest.push(fs[0]); continue; } const gs = fs.map(f => f.gap), nm = fs[0].name.replace(/ #\d+$/, '');
        rest.push({ type: 'floating', name: nm, at: fs[0].at, detail: `"${nm}" (${fs.length} copies, e.g. around ${fs[0].at.map(v => v.toFixed(2)).join(', ')}): ${(Math.min(...gs) * 100).toFixed(0)}-${(Math.max(...gs) * 100).toFixed(0)} cm above what is under them, not fixed to anything beside them` }); }
      for (const f of rest) { delete f.model; delete f.gap; out.push(f); } }
    // ---- through: into another solid, box-like prop of another model ----
    const solidish = x => { const s = size(x.b).toArray().sort((a, b) => a - b); return s[0] >= .1 * s[2] && x.it.inst == null; };
    const seen = new Set();
    for (let a = 0; a < props.length && !late(); a++) for (let k = 0; k < props.length; k++) {
      const A = props[a], B = props[k]; if (a === k || A.it.model === B.it.model || !A.b.intersectsBox(B.b)) continue;
      const sm = vol(A.b) <= vol(B.b) ? A : B, lg = sm === A ? B : A; if (sm !== A || !solidish(lg)) continue;
      const key = `${sm.it.model.uuid}|${lg.it.model.uuid}`; if (seen.has(key)) continue;
      const ov = A.b.clone().intersect(B.b); if (vol(ov) < vol(sm.b) * .15) continue;
      const pos = sm.it.obj.geometry.attributes.position, m4 = new THREE.Matrix4(); if (!pos) continue;
      if (sm.it.inst != null) { sm.it.obj.getMatrixAt(sm.it.inst, m4); m4.premultiply(sm.it.obj.matrixWorld); } else m4.copy(sm.it.obj.matrixWorld);
      const stepN = Math.max(1, Math.floor(pos.count / 24)), total = Math.ceil(pos.count / stepN); let inn = 0, n = 0;
      for (let v = 0; v < pos.count; v += stepN) { const p = V().fromBufferAttribute(pos, v).applyMatrix4(m4); if (!ov.containsPoint(p)) continue; n++; if (inside(p, lg.it.obj)) inn++; }
      if (n >= 4 && inn / total > .3) { seen.add(key);
        out.push({ type: 'through', name: `${sm.it.name} / ${lg.it.name}`, at: ov.getCenter(V()).toArray(),
          detail: `"${sm.it.name.replace(/ #\d+$/, '')}" passes through "${lg.it.name.replace(/ #\d+$/, '')}" (${Math.round(inn / total * 100)}% of its surface inside it, around ${fmt(ov.getCenter(V()))})` }); }
    }
    mark('through');
  } finally { for (const [mt, side] of sides) mt.side = side; }
  if (partial || late()) out.push({ type: 'floating', name: '(time)', at: [0, 0, 0], detail: `(checked within ${BUDGET_MS} ms: the smaller props on screen were not all checked)` });
  return out;
}
