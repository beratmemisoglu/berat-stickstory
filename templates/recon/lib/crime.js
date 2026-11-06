// Investigation kit, 3D (engine v7+): the true-crime documentary's sets and devices, as reusable builders for scenes.
//   crimeBoard(S, o)     a cork/dark board with photos, cards and notes pinned >= 1 cm proud, red string that draws on,
//                        a lamp pool, camera travel along a string, push-focus on an item
//   networkGrid(S, o)    the red-grid network diagram: icon/photo nodes with scrambling labels, links that draw on (line,
//                        arc, dashed), packets, states (infected skull, padlock, money, target), a node-to-node camera
//   sideView(S, o)       a locked side cutaway of a building (floors, rooms, stairs, doors, gallery walls), labels, a path
//   evidence(S, doc, o)  a document / headline / tweet / card on a desk, filmed close with tilt-shift focus: word-timed
//                        highlighter, hand-drawn ellipse, redaction, camera moves onto a phrase; evidence.fromCanvas(draw)
//   darkSpace(S, o)      black space with blue bokeh: .photo(key) stands a borderless portrait in it, the camera slides
//   setBedroom / setOffice / setLobby / setStreet / setVoid (S, o)   minimal furnished sets with practical lights,
//                        returning { group, solids, spots, lights, lightsOut(t0) }
// Everything is closed meshes standing on what holds it (check_layout: no coplanar, no floating, no flicker) and a pure
// function of the time. Imports only the engine's public exports (projects get this file on "Update engine").
import { THREE, C, THEME, IMG, E, ease, seg, clamp, lerp, FW, FH, selectable, sfx, custom } from '../engine.js';
import { RoundedBoxGeometry } from '../vendor/jsm/geometries/RoundedBoxGeometry.js';
import { CF, hh, decodeText, glowText, redDots, redStreaks, makeDoc } from './crimeover.js';

import * as ENG from '../engine.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// STRINGEND (check_layout, engine v9+ LAYOUT_CHECKS): every drawn string's two ends lie within 3 mm of a pin head
ENG.LAYOUT_CHECKS?.push((S, t) => { const out = [];
  for (const B of S._boards || []) { const heads = B.heads().map(h => B.group.worldToLocal(h.getWorldPosition(V())));
    for (const st of B.strings) { if (t < st.t0 + st.dur || !st.mesh.visible) continue; const P = st.points();
      for (const [end, q] of [['start', P[0]], ['end', P[P.length - 1]]]) { const d = Math.min(...heads.map(h => h.distanceTo(q)), Infinity);
        if (d > .003) out.push({ type: 'STRINGEND', detail: `a red string's ${end} is ${(d * 1000).toFixed(1)} mm from the nearest pin head (limit 3 mm): strings run pin head to pin head (B.string(item, item) / a point end gets B.pinAt).` }); } } }
  return out; });
const INV = THEME.grade != null;                                    // the dark Investigation theme is active
export const rbox = (w, h, d, r = .01, s = 2) => new RoundedBoxGeometry(w, h, d, s, Math.max(1e-4, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
export function part(geo, mat, p = [0, 0, 0], r = null, parent = null, name = '') {
  const m = new THREE.Mesh(geo, mat); m.position.set(...p); if (r) m.rotation.set(...r); m.castShadow = m.receiveShadow = true; if (name) m.name = name; parent?.add(m); return m;
}
export const std = (color, rough = .8, x = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...x });
const basic = (color, x = {}) => new THREE.MeshBasicMaterial({ color, ...x });
// a canvas texture (sRGB, drawn once): draw(ctx, w, h)
export function ctex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...o.repeat); }
  t.userData.canvas = c; t.userData.ctx = x; return t;
}
// a photo (IMG key) drawn to cover a rect, cropped around focus [fx, fy]
export function drawCover(x, key, X, Y, w, h, o = {}) {
  const im = typeof key === 'string' ? IMG[key] : key; if (!im || !im.width) { x.fillStyle = '#555'; x.fillRect(X, Y, w, h); return false; }
  const [fx, fy] = o.focus ?? [.5, .4], s = Math.max(w / im.width, h / im.height) * (o.zoom ?? 1), sw = w / s, sh = h / s;
  x.save(); if (o.filter) x.filter = o.filter; x.drawImage(im, clamp(fx * im.width - sw / 2, 0, im.width - sw), clamp(fy * im.height - sh / 2, 0, im.height - sh), sw, sh, X, Y, w, h); x.restore(); return true;
}
// a tube along points that can be rewritten every frame (strings, links): geometry with n segments, `radial` sides
function tubeGeo(n, radial = 6) {
  const g = new THREE.BufferGeometry(), N = (n + 1) * (radial + 1), idx = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }   // outward-facing
  g.setIndex(idx); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.userData = { n, radial }; return g;
}
function tubeSet(g, pts, r) {
  const { n, radial } = g.userData, P = g.attributes.position.array, Nn = g.attributes.normal.array;
  let prevN = null;
  for (let i = 0; i <= n; i++) {
    const p = pts[i], tng = (pts[Math.min(n, i + 1)].clone().sub(pts[Math.max(0, i - 1)])).normalize();
    let nrm = prevN ? prevN.clone().sub(tng.clone().multiplyScalar(prevN.dot(tng))).normalize() : (Math.abs(tng.y) < .9 ? V(0, 1, 0) : V(1, 0, 0)).cross(tng).normalize();
    if (!isFinite(nrm.x)) nrm = V(0, 0, 1); prevN = nrm; const bin = tng.clone().cross(nrm);
    for (let j = 0; j <= radial; j++) { const a = j / radial * Math.PI * 2, d = nrm.clone().multiplyScalar(Math.cos(a)).add(bin.clone().multiplyScalar(Math.sin(a))), k = (i * (radial + 1) + j) * 3;
      Nn[k] = d.x; Nn[k + 1] = d.y; Nn[k + 2] = d.z; P[k] = p.x + d.x * r; P[k + 1] = p.y + d.y * r; P[k + 2] = p.z + d.z * r; }
  }
  g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = true; g.computeBoundingBox(); g.computeBoundingSphere();
}
const drawOn = (g, k) => { const { n, radial } = g.userData; g.setDrawRange(0, Math.round(clamp(k) * n) * radial * 6); };
// dashes: one short closed-ish tube per [a, b] piece in one geometry (drawOn draws them on piece by piece)
function dashGeo(pieces, r, radial = 5) {
  const g = new THREE.BufferGeometry(), P = [], Nn = [], idx = [];
  pieces.forEach(([a, b], k) => { const tng = b.clone().sub(a).normalize(), nrm = (Math.abs(tng.y) < .9 ? V(0, 1, 0) : V(1, 0, 0)).cross(tng).normalize(), bin = tng.clone().cross(nrm), base = k * (radial + 1) * 2;
    for (const e of [a, b]) for (let j = 0; j <= radial; j++) { const an = j / radial * Math.PI * 2, d = nrm.clone().multiplyScalar(Math.cos(an)).add(bin.clone().multiplyScalar(Math.sin(an))); P.push(e.x + d.x * r, e.y + d.y * r, e.z + d.z * r); Nn.push(d.x, d.y, d.z); }
    for (let j = 0; j < radial; j++) { const a2 = base + j, b2 = a2 + radial + 1; idx.push(a2, a2 + 1, b2, b2, a2 + 1, b2 + 1); } });
  g.setIndex(idx); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  g.userData = { n: pieces.length, radial }; return g;
}
const softDisc = (() => { let t = null; return () => t ??= ctex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }); })();
const lampColor = () => THEME.lamp ?? 0xfff2dd;

// ======================================================================================================================
// CRIME BOARD
// ======================================================================================================================
// crimeBoard(S, { w = 2.4, h = 1.4, pos = [0, 1.55, 0], rot = [0, 0, 0] (rot[1] = yaw), style: 'cork' | 'dark', frame = true,
//   wall = true (a wall behind it, from the floor up: the board hangs on it), lamp = true (one warm spot pool from above),
//   name = 'crime board' }) -> board
// Board coordinates: x, y in metres from the board's centre (x right, y up), on its face.
//   board.pin(photoKey | text, { x, y, rot (deg), size (width m), kind: 'polaroid' | 'print' | 'note' | 'card' | 'clip',
//     label, pin: 'red' | 'white' | 'black' | false, t0 (pops in, with a pin sound), focus: [fx, fy], lines (card text) }) -> item
//     Items stand >= 1 cm proud of the board, overlapping ones stack another 6 mm; a pin goes through each into the cork.
//   board.string(a, b, { color = C.dot, sag, t0, dur = .8, slack: { t0, dur, sag } }) -> string: a red string from pin to
//     pin (b may be [x, y] on the board: a string that stops short), a hanging curve that draws on from a to b.
//   board.camTo(item, { t0, dur = 1.6, dist = .55, fov, side = 0, from }) chains camera moves: from the previous item (or
//     `from`) to this one, following the string between them when there is one; eased; the look point is the item, so the
//     default depth of field focuses on it. board.view(item, o) -> a camera key { p, l, fov } for S.camera.
//   board.highlight(item, t, { dur = .5 }): push-focus: the item lifts a little toward the camera, the others dim.
export function crimeBoard(S, o = {}) {
  const w = o.w ?? 2.4, h = o.h ?? 1.4, style = o.style ?? 'cork', G = new THREE.Group();
  G.position.set(...(o.pos ?? [0, 1.55, 0])); G.rotation.set(...(o.rot ?? [0, 0, 0])); (o.parent ?? S.scene).add(G); selectable(G, o.name ?? 'crime board', 'board'); G.updateMatrixWorld(true);
  const corkTex = ctex(2048, Math.round(2048 * h / w), (x, W, H) => {
    if (style === 'dark') { x.fillStyle = '#1d1e21'; x.fillRect(0, 0, W, H); for (let i = 0; i < W * H / 14; i++) { const v = 20 + hh(i, 1) * 26; x.fillStyle = `rgba(${v},${v},${v + 3},.5)`; x.fillRect(hh(i, 2) * W, hh(i, 3) * H, 2, 2); } }
    else { x.fillStyle = '#7e5d3c'; x.fillRect(0, 0, W, H);
      // cork granules: soft round flecks of three tones, small ones many, a few bigger dark pits
      for (let i = 0; i < W * H / 7; i++) { const r = hh(i, 1), c = r < .42 ? `rgba(66,42,22,${.18 + hh(i, 4) * .3})` : r < .84 ? `rgba(168,128,86,${.16 + hh(i, 5) * .28})` : `rgba(44,27,13,${.4})`;
        x.fillStyle = c; const s = .7 + hh(i, 6) ** 2 * 2.6; x.beginPath(); x.ellipse(hh(i, 2) * W, hh(i, 3) * H, s, s * (.6 + hh(i, 7) * .5), hh(i, 8) * 3, 0, 7); x.fill(); }
      for (let i = 0; i < 60; i++) { x.strokeStyle = 'rgba(40,24,10,.35)'; x.lineWidth = 1; x.beginPath(); const X = hh(i, 8) * W, Y = hh(i, 9) * H; x.arc(X, Y, 1 + hh(i, 10) * 2, 0, 7); x.stroke(); } }   // old pin holes
  });
  const board = part(new THREE.BoxGeometry(w, h, .03), [std(0x2a2522, .9), std(0x2a2522, .9), std(0x2a2522, .9), std(0x2a2522, .9), std(0xffffff, .95, { map: corkTex }), std(0x2a2522, .9)], [0, 0, -.015], null, G, 'board face');
  if (o.frame !== false) { const fm = std(style === 'dark' ? 0x111214 : 0x3b2a1d, .55), fw = .045;
    for (const [px, py, fw2, fh2] of [[0, h / 2 + fw / 2, w + fw * 2, fw], [0, -h / 2 - fw / 2, w + fw * 2, fw], [-w / 2 - fw / 2, 0, fw, h], [w / 2 + fw / 2, 0, fw, h]])
      part(rbox(fw2, fh2, .05, .008), fm, [px, py, -.005], null, G, 'board frame'); }
  const solids = [board];
  if (o.wall !== false) {   // the wall it hangs on: from the floor (world y 0) to above the board
    const y0 = G.position.y, wh = y0 + h / 2 + (o.wallAbove ?? 1.6), ww = w + (o.wallW ?? 8);
    const wall = part(new THREE.BoxGeometry(ww, wh, .2), std(style === 'dark' ? 0x1a1b1e : 0x2c2d31, .95), [0, wh / 2 - y0, -.03 - .1], null, G, 'board wall'); wall.userData.noPick = true; solids.push(wall);
  }
  let lamp = null;
  if (o.lamp !== false) {
    lamp = new THREE.SpotLight(lampColor(), o.lampI ?? (INV ? 14 : 7), 0, o.lampAngle ?? .62, .75, 1.6);
    lamp.position.copy(G.localToWorld(V(...(o.lampAt ?? [w * .12, h / 2 + 1.1, 1.7])))); G.updateMatrixWorld(true);
    lamp.target.position.copy(G.localToWorld(V(0, -h * .08, 0))); lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.bias = -.0004; lamp.shadow.radius = 5; lamp.shadow.blurSamples = 12;
    lamp.shadow.camera.near = .3; lamp.shadow.camera.far = 6; S.scene.add(lamp, lamp.target);
  }
  G.updateMatrixWorld(true);
  const N = V(0, 0, 1).applyQuaternion(G.getWorldQuaternion(new THREE.Quaternion())), UPv = V(0, 1, 0).applyQuaternion(G.getWorldQuaternion(new THREE.Quaternion())), RIGHT = UPv.clone().cross(N).negate();
  const items = [], strings = [], moves = [], toWorld = (x, y, z) => G.localToWorld(V(x, y, z));
  const PIN = { red: 0xc00014, white: 0xe9e9e6, black: 0x141416 };
  const api = { group: G, solids, items, strings, lamp, w, h, normal: N, toWorld };
  (S._boards ??= []).push(api);   // STRINGEND (check_layout) measures every board of the shot

  api.pin = (content, p = {}) => {
    const isImg = typeof content === 'string' && IMG[content] !== undefined, kind = p.kind ?? (isImg ? 'polaroid' : 'note');
    const im = isImg ? IMG[content] : null, sz = p.size ?? { polaroid: .15, print: .2, note: .085, card: .15, clip: .2 }[kind];
    let iw = sz, ih;
    if (kind === 'polaroid') ih = sz * 107 / 88; else if (kind === 'note') ih = sz; else if (kind === 'card') ih = sz * 76 / 127;
    else if (kind === 'print') ih = im ? sz * im.height / im.width : sz * 1.3; else ih = p.h ?? (im ? sz * im.height / im.width : sz * 1.1);
    const res = 640, TW = res, TH = Math.round(res * ih / iw), label = p.label;
    const tex = ctex(TW, TH, (x, W, H) => {
      const ink = '#1c1c28';
      if (kind === 'polaroid') { x.fillStyle = '#ecebe6'; x.fillRect(0, 0, W, H); const m = W * .06; drawCover(x, content, m, m, W - m * 2, W - m * 2, { focus: p.focus, filter: p.filter });
        x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(m, m, W - 2 * m, 3);
        if (label) { x.save(); x.translate(W / 2, W - m + (H - W + m) * .55); x.rotate(-.025); x.font = CF.i(Math.round(W * .075), 600); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = ink; x.fillText(label, 0, 0); x.restore(); } }
      else if (kind === 'print') { x.fillStyle = '#e8e7e2'; x.fillRect(0, 0, W, H); const m = W * .025; drawCover(x, content, m, m, W - m * 2, H - m * 2, { focus: p.focus, filter: p.filter ?? 'grayscale(.3)' }); }
      else if (kind === 'note') { x.fillStyle = p.color ?? '#d9c74a'; x.fillRect(0, 0, W, H); const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(0,0,0,.12)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.save(); x.translate(W / 2, H / 2); x.rotate(-.04); x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle'; const lines = String(content).split('\n'), fs = Math.round(W * (lines.length > 2 ? .13 : .16));
        x.font = CF.i(fs, 800); lines.forEach((l, i) => x.fillText(l, 0, (i - (lines.length - 1) / 2) * fs * 1.15)); x.restore(); }
      else if (kind === 'card') { x.fillStyle = '#eceae3'; x.fillRect(0, 0, W, H); x.fillStyle = 'rgba(184,50,58,.8)'; x.fillRect(0, H * .2, W, 3); x.fillStyle = 'rgba(58,110,168,.32)'; for (let y = H * .32; y < H; y += H * .12) x.fillRect(0, y, W, 2);
        x.fillStyle = ink; x.font = CF.m(Math.round(W * .065), 700); x.fillText(String(isImg ? (label ?? '') : content).toUpperCase(), W * .06, H * .16);
        x.font = CF.m(Math.round(W * .05)); (p.lines || []).forEach((l, i) => x.fillText(l, W * .06, H * .3 + i * H * .12)); }
      else { x.fillStyle = '#d8d3c6'; x.fillRect(0, 0, W, H); if (isImg) drawCover(x, content, W * .04, W * .04, W * .92, H - W * .08, { filter: 'grayscale(1) contrast(1.1)' });
        else { x.fillStyle = '#1a1a1a'; x.font = CF.serif(Math.round(W * .085), 700); let y = W * .14; for (const l of String(content).split('\n')) { x.fillText(l, W * .05, y); y += W * .1; }
          x.fillStyle = 'rgba(30,30,30,.3)'; for (let c = 0; c < 2; c++) for (let r = 0; y + r * W * .045 < H - W * .05; r++) x.fillRect(W * .05 + c * W * .46, y + r * W * .045, W * .42 * (r % 7 === 6 ? .5 : 1), W * .018); } }
      // paper tooth + a soft fold shade
      x.globalAlpha = .06; for (let i = 0; i < 1400; i++) { x.fillStyle = hh(i, 3) < .5 ? '#000' : '#fff'; x.fillRect(hh(i, 1) * W, hh(i, 2) * H, 2, 2); } x.globalAlpha = 1;
    });
    const edge = std(kind === 'note' ? (p.color ? new THREE.Color(p.color).getHex() : 0xd9c74a) : 0xe4e2dc, .9), front = std(0xffffff, kind === 'print' ? .55 : .85, { map: tex });
    const th = .0016, g = new THREE.Group(); g.name = label ? `${kind}: ${label}` : `${kind}`;
    const sheet = part(new THREE.BoxGeometry(iw, ih, th), [edge, edge, edge, edge, front, edge], [0, 0, 0], null, g); sheet.name = g.name;
    // stacking: >= 1 cm off the cork, +6 mm for every earlier item it overlaps
    const x0 = p.x ?? 0, y0 = p.y ?? 0, rot = (p.rot ?? 0) * Math.PI / 180;
    const rad = Math.hypot(iw, ih) / 2, under = items.filter(it => Math.hypot(it.x - x0, it.y - y0) < (rad + it.rad) * .92);
    const z = .011 + th / 2 + (under.length ? Math.max(...under.map(it => it.layer + 1)) : 0) * .006, layer = under.length ? Math.max(...under.map(it => it.layer + 1)) : 0;
    g.position.set(x0, y0, z); g.rotation.z = rot; G.add(g);
    // the pin: through the item into the cork (a needle) with a round head
    let head = null;
    const pinCol = p.pin === false ? null : PIN[p.pin ?? (kind === 'note' ? 'black' : 'red')] ?? PIN.red;
    const pinAt = V(0, ih / 2 - Math.min(.022, ih * .14), 0);
    if (pinCol != null) { const pm = new THREE.MeshPhysicalMaterial({ color: pinCol, roughness: .25, clearcoat: 1, clearcoatRoughness: .1 });
      const needleL = z + .012; part(new THREE.CylinderGeometry(.0009, .0009, needleL, 8), std(0x9a9ea3, .3, { metalness: .8 }), [pinAt.x, pinAt.y, th / 2 + .004 - needleL / 2], [Math.PI / 2, 0, 0], g, 'pin needle');
      part(new THREE.CylinderGeometry(.0042, .0055, .006, 18), pm, [pinAt.x, pinAt.y, th / 2 + .007], [Math.PI / 2, 0, 0], g, 'pin');
      head = part(new THREE.SphereGeometry(.0068, 20, 14), pm, [pinAt.x, pinAt.y, th / 2 + .0135], null, g, 'pin head'); }
    const it = { g, sheet, front, kind, label, x: x0, y: y0, z, rot, w: iw, h: ih, rad, layer, t0: p.t0 ?? null, i: items.length, head,
      // v2.3 where the string ties on: the CENTRE OF THE PIN HEAD, from the head's actual transform (the item lifts / scales
      // per frame), in board coordinates. An item pinned without a pin gets one the moment a string needs it.
      tie: () => { if (!it.head) addPin(it); G.updateMatrixWorld(true); return G.worldToLocal(it.head.getWorldPosition(V(0, 0, 0))); },
      center: () => toWorld(x0, y0, z), world: () => toWorld(x0, y0, z) };
    it._pinAt = pinAt; it._th = th; it._pinCol = PIN[kind === 'note' ? 'black' : 'red'];
    if (it.t0 != null && p.sound !== false) sfx('pin', it.t0 + .12, { gain: -8 });
    items.push(it); return it;
  };

  // a pin for an item that was pinned with pin: false (a string needs a head to tie to)
  function addPin(it) { const pm = new THREE.MeshPhysicalMaterial({ color: it._pinCol ?? PIN.red, roughness: .25, clearcoat: 1, clearcoatRoughness: .1 }), pa = it._pinAt, th = it._th;
    part(new THREE.CylinderGeometry(.0042, .0055, .006, 18), pm, [pa.x, pa.y, th / 2 + .007], [Math.PI / 2, 0, 0], it.g, 'pin');
    it.head = part(new THREE.SphereGeometry(.0068, 20, 14), pm, [pa.x, pa.y, th / 2 + .0135], null, it.g, 'pin head'); }
  // a bare pin in the cork (a string ending on empty cork ends on a visible pin, never in mid-air)
  const pins = [];
  api.pinAt = (x, y, p = {}) => { const g = new THREE.Group(); g.position.set(x, y, 0); G.add(g); g.name = 'cork pin';
    const pm = new THREE.MeshPhysicalMaterial({ color: PIN[p.pin ?? 'red'] ?? PIN.red, roughness: .25, clearcoat: 1, clearcoatRoughness: .1 });
    part(new THREE.CylinderGeometry(.0009, .0009, .02, 8), std(0x9a9ea3, .3, { metalness: .8 }), [0, 0, .002], [Math.PI / 2, 0, 0], g, 'pin needle');
    part(new THREE.CylinderGeometry(.0042, .0055, .006, 18), pm, [0, 0, .014], [Math.PI / 2, 0, 0], g, 'pin');
    const head = part(new THREE.SphereGeometry(.0068, 20, 14), pm, [0, 0, .0205], null, g, 'pin head');
    const pin = { g, head, x, y, bare: true, tie: () => { G.updateMatrixWorld(true); return G.worldToLocal(head.getWorldPosition(V(0, 0, 0))); }, center: () => toWorld(x, y, .02) };
    pins.push(pin); return pin; };
  // an end given as a point [x, y]: snapped to the pin of an item under / within 8 cm of it, else a new bare pin there
  const endOf = (e, which) => { if (e && e.tie) return e; const [x, y] = e;
    const near = items.map(it => ({ it, d: Math.hypot(it.x - x, it.y - y) - it.rad })).sort((u, v) => u.d - v.d)[0];
    if (near && near.d < .08) { console.warn(`crimeBoard.string: the ${which} end [${x}, ${y}] snapped to the pin of ${near.it.g.name} (strings always end on a pin head)`); return near.it; }
    return api.pinAt(x, y); };
  api.pins = pins;
  api.heads = () => [...items.filter(it => it.head).map(it => it.head), ...pins.map(q => q.head)];

  // red string: a hanging curve from pin head to pin head that rides over any item between them. BOTH ends are pin heads,
  // taken from the pins' actual world positions every frame (items lift / move). There is no 'stops short' mode: a point end
  // gets a pin (endOf), and p.slack (v2.2's slack end) is ignored with a warning.
  api.string = (a0, b0, p = {}) => {
    const n = 120, geo = tubeGeo(n, 6), col = p.color ?? C.dot, mat = std(new THREE.Color(col).getHex(), .55);
    const m = part(geo, mat, [0, 0, 0], null, G, 'red string'); m.castShadow = true; m.receiveShadow = false;
    const a = endOf(a0, 'start'), b = endOf(b0, 'end');
    if (p.slack) console.warn('crimeBoard.string: slack ends are not allowed (a string always connects pin to pin): p.slack ignored');
    const A = () => a.tie(), B = () => b.tie();
    const sag0 = p.sag ?? null, pts = () => { const pa = A(), pb = B(), L = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      const sag = sag0 ?? (.012 + .045 * L);
      const out = [];
      for (let i = 0; i <= n; i++) { const s = i / n, q = pa.clone().lerp(pb, s); q.y -= sag * 4 * s * (1 - s);
        // ride over items under the string (their front + 3 mm)
        let zz = lerp(pa.z, pb.z, s); for (const it of items) { if (it === a || it === b) continue; const dx = q.x - it.x, dy = q.y - it.y, c = Math.cos(-it.rot), sn = Math.sin(-it.rot), lx = dx * c - dy * sn, ly = dx * sn + dy * c;
          if (Math.abs(lx) < it.w / 2 + .004 && Math.abs(ly) < it.h / 2 + .004) zz = Math.max(zz, it.z + .0008 + .003); }
        q.z = zz; out.push(q); }
      for (let pass = 0; pass < 3; pass++) for (let i = 1; i < n; i++) out[i].z = Math.max(out[i].z, (out[i - 1].z + out[i + 1].z) / 2 - .0005);
      return out; };
    let curT = 0;
    const st = { mesh: m, a, b, t0: p.t0 ?? 0, dur: p.dur ?? .8, points: pts, at: s => { const P = pts(); const f = clamp(s) * n, i = Math.min(n - 1, Math.floor(f)); return P[i].clone().lerp(P[i + 1], f - i); } };
    const upd = t => { curT = t; tubeSet(geo, pts(), p.radius ?? .0011); drawOn(geo, ease(t, st.t0, st.t0 + st.dur, E.inOutSine)); };
    upd(st.t0 + st.dur + 99); S.tick(upd);
    if (p.sound !== false) sfx('string', st.t0, { gain: -10, dur: st.dur });
    strings.push(st); return st;
  };

  api.view = (item, p = {}) => { const d = p.dist ?? .55, c = item.center ? item.center() : toWorld(item[0], item[1], .02);
    const pos = c.clone().add(N.clone().multiplyScalar(d)).add(UPv.clone().multiplyScalar(d * (p.up ?? .06))).add(RIGHT.clone().multiplyScalar(d * (p.side ?? 0)));
    return { p: pos.toArray(), l: c.toArray(), fov: p.fov ?? THEME.fov ?? 30 }; };
  api.wide = (p = {}) => { const d = p.dist ?? (h / 2 + .2) / Math.tan((p.fov ?? THEME.fov ?? 30) * Math.PI / 360);
    const c = toWorld(p.at?.[0] ?? 0, p.at?.[1] ?? 0, 0); return { p: c.clone().add(N.clone().multiplyScalar(d)).add(RIGHT.clone().multiplyScalar(d * (p.side ?? 0))).toArray(), l: c.toArray(), fov: p.fov ?? THEME.fov ?? 30 }; };
  api.camTo = (item, p = {}) => { const prev = moves[moves.length - 1]; moves.push({ to: item, from: p.from ?? prev?.to ?? item, t0: p.t0 ?? 0, dur: p.dur ?? 1.6, dist: p.dist ?? prev?.dist ?? .55, d0: prev?.dist ?? p.dist ?? .55, side: p.side ?? 0, side0: prev?.side ?? p.side ?? 0, fov: p.fov });
    if (moves.length === 1) S.tick(t => camTick(t)); return api; };
  const camTick = t => {
    let mv = moves[0]; for (const m2 of moves) if (t >= m2.t0) mv = m2;
    const k = E.inOutCubic(seg(t, mv.t0, mv.t0 + mv.dur));
    const st = strings.find(s2 => (s2.a === mv.from && s2.b === mv.to) || (s2.b === mv.from && s2.a === mv.to));
    const ca = mv.from.center ? mv.from.center() : toWorld(mv.from[0], mv.from[1], .02), cb = mv.to.center ? mv.to.center() : toWorld(mv.to[0], mv.to[1], .02);
    let look;
    if (st && mv.from !== mv.to) { const s = st.a === mv.from ? k : 1 - k, q = G.localToWorld(st.at(s)); look = q.lerp(ca.clone().lerp(cb, k), Math.sin(Math.PI * k) < .5 ? 1 - Math.sin(Math.PI * k) * 2 : 0); }
    else look = ca.clone().lerp(cb, k);
    const d = lerp(mv.d0, mv.dist, k) * (1 + .18 * Math.sin(Math.PI * k)), side = lerp(mv.side0, mv.side, k);
    S.look.copy(look); S.cam.position.copy(look).add(N.clone().multiplyScalar(d)).add(UPv.clone().multiplyScalar(d * .06)).add(RIGHT.clone().multiplyScalar(d * side)); S.cam.lookAt(S.look);
    if (mv.fov && S.cam.fov !== mv.fov) { S.cam.fov = mv.fov; S.cam.updateProjectionMatrix(); }
  };
  const hls = [];
  api.highlight = (item, t, p = {}) => { hls.push({ item, t, dur: p.dur ?? .5 }); return api; };
  // per frame: pop-ins, push-focus
  S.tick(t => { let dim = 0; const lift = new Map();
    for (const hl of hls) { const k = E.inOutCubic(seg(t, hl.t, hl.t + hl.dur)); dim = Math.max(dim, k); lift.set(hl.item, Math.max(lift.get(hl.item) ?? 0, k)); }
    for (const it of items) { const pk = it.t0 == null ? 1 : seg(t, it.t0, it.t0 + .2), lk = lift.get(it) ?? 0;
      it.g.visible = it.t0 == null || t >= it.t0;
      it.g.position.z = it.z + (1 - E.outCubic(pk)) * .05 + lk * .018; it.g.scale.setScalar(1 + (1 - E.outCubic(pk)) * .06 + lk * .04);
      it.front.color.setScalar(1 - (lift.has(it) ? 0 : dim * .45)); } });
  return api;
}

// ======================================================================================================================
// ICONS (flat white glyphs for the network diagram, drawn on canvas; no external assets)
// ======================================================================================================================
const ICON = {
  pc(x) { x.beginPath(); x.roundRect(36, 50, 184, 120, 10); x.fill(); cut(x, () => { x.beginPath(); x.roundRect(52, 66, 152, 88, 4); x.fill(); }); x.fillRect(116, 170, 24, 24); x.beginPath(); x.roundRect(80, 192, 96, 14, 7); x.fill(); },
  hacker(x) { x.beginPath(); x.moveTo(128, 30); x.bezierCurveTo(66, 32, 58, 112, 70, 158); x.lineTo(186, 158); x.bezierCurveTo(198, 112, 190, 32, 128, 30); x.fill();
    cut(x, () => { x.beginPath(); x.ellipse(128, 112, 32, 42, 0, 0, 7); x.fill(); });
    x.beginPath(); x.moveTo(30, 232); x.quadraticCurveTo(40, 160, 92, 150); x.lineTo(164, 150); x.quadraticCurveTo(216, 160, 226, 232); x.closePath(); x.fill(); },
  house(x) { x.beginPath(); x.moveTo(128, 34); x.lineTo(228, 124); x.lineTo(28, 124); x.closePath(); x.fill(); x.fillRect(60, 118, 136, 96); cut(x, () => { x.fillRect(110, 150, 36, 64); x.fillRect(158, 140, 26, 24); }); },
  wifi(x) { x.lineCap = 'round'; x.lineWidth = 22; for (const r of [44, 92, 140]) { x.beginPath(); x.arc(128, 206, r, -Math.PI * .75, -Math.PI * .25); x.stroke(); } x.beginPath(); x.arc(128, 206, 15, 0, 7); x.fill(); },
  dish(x) { x.save(); x.translate(112, 112); x.rotate(-.65); x.beginPath(); x.ellipse(0, 0, 80, 34, 0, 0, Math.PI); x.closePath(); x.fill(); x.restore();
    x.lineWidth = 9; x.beginPath(); x.moveTo(112, 112); x.lineTo(172, 54); x.stroke(); x.beginPath(); x.arc(176, 50, 12, 0, 7); x.fill(); x.lineWidth = 16; x.beginPath(); x.moveTo(118, 130); x.lineTo(134, 200); x.stroke(); x.beginPath(); x.roundRect(86, 196, 92, 16, 6); x.fill(); },
  bitcoin(x) { x.lineWidth = 16; x.beginPath(); x.arc(128, 128, 94, 0, 7); x.stroke(); x.font = CF.h(150); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('B', 132, 136); x.fillRect(108, 46, 12, 30); x.fillRect(132, 46, 12, 30); x.fillRect(108, 186, 12, 30); x.fillRect(132, 186, 12, 30); },
  phone(x) { x.beginPath(); x.roundRect(82, 26, 92, 204, 18); x.fill(); cut(x, () => { x.beginPath(); x.roundRect(93, 52, 70, 150, 4); x.fill(); x.fillRect(114, 38, 28, 5); }); x.beginPath(); x.arc(128, 216, 7, 0, 7); x.fill(); },
  server(x) { for (let i = 0; i < 3; i++) { x.beginPath(); x.roundRect(46, 40 + i * 62, 164, 50, 8); x.fill(); cut(x, () => { x.beginPath(); x.arc(186, 65 + i * 62, 7, 0, 7); x.fill(); x.fillRect(64, 61 + i * 62, 76, 8); }); } },
  document(x) { x.beginPath(); x.moveTo(62, 26); x.lineTo(162, 26); x.lineTo(200, 64); x.lineTo(200, 230); x.lineTo(62, 230); x.closePath(); x.fill();
    cut(x, () => { x.beginPath(); x.moveTo(160, 26); x.lineTo(160, 66); x.lineTo(200, 66); x.closePath(); x.fill(); for (let i = 0; i < 5; i++) x.fillRect(84, 98 + i * 24, i === 4 ? 56 : 94, 9); }); x.beginPath(); x.moveTo(166, 34); x.lineTo(166, 60); x.lineTo(192, 60); x.closePath(); x.fill(); },
  money(x) { x.beginPath(); x.roundRect(24, 66, 208, 124, 12); x.fill(); cut(x, () => { x.lineWidth = 6; x.beginPath(); x.roundRect(38, 80, 180, 96, 6); x.stroke(); x.beginPath(); x.arc(128, 128, 38, 0, 7); x.fill(); });
    x.font = CF.h(64); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', 128, 132); },
  person(x) { x.beginPath(); x.arc(128, 84, 44, 0, 7); x.fill(); x.beginPath(); x.moveTo(36, 232); x.quadraticCurveTo(40, 140, 128, 140); x.quadraticCurveTo(216, 140, 220, 232); x.closePath(); x.fill(); },
  building(x) { x.fillRect(66, 24, 124, 210); cut(x, () => { for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) x.fillRect(80 + c * 36, 40 + r * 28, 24, 16); x.fillRect(112, 204, 32, 30); }); },
  skull(x) { x.beginPath(); x.arc(128, 104, 76, 0, 7); x.fill(); x.beginPath(); x.roundRect(82, 140, 92, 68, 14); x.fill();
    cut(x, () => { x.beginPath(); x.ellipse(98, 112, 21, 25, -.15, 0, 7); x.fill(); x.beginPath(); x.ellipse(158, 112, 21, 25, .15, 0, 7); x.fill(); x.beginPath(); x.moveTo(128, 140); x.lineTo(116, 166); x.lineTo(140, 166); x.closePath(); x.fill(); for (const tx of [104, 122, 140]) x.fillRect(tx, 180, 6, 30); }); },
  padlock(x) { x.lineWidth = 22; x.beginPath(); x.moveTo(82, 118); x.lineTo(82, 96); x.arc(128, 96, 46, Math.PI, 0); x.lineTo(174, 118); x.stroke(); x.beginPath(); x.roundRect(58, 112, 140, 112, 14); x.fill();
    cut(x, () => { x.beginPath(); x.arc(128, 156, 15, 0, 7); x.fill(); x.fillRect(121, 160, 14, 36); }); },
  envelope(x) { x.beginPath(); x.roundRect(30, 62, 196, 132, 10); x.fill(); cut(x, () => { x.lineWidth = 9; x.beginPath(); x.moveTo(36, 72); x.lineTo(128, 140); x.lineTo(220, 72); x.stroke(); }); },
  globe(x) { x.lineWidth = 12; x.beginPath(); x.arc(128, 128, 90, 0, 7); x.stroke(); x.beginPath(); x.ellipse(128, 128, 40, 90, 0, 0, 7); x.stroke(); x.beginPath(); x.moveTo(38, 128); x.lineTo(218, 128); x.stroke();
    x.beginPath(); x.moveTo(52, 82); x.quadraticCurveTo(128, 100, 204, 82); x.stroke(); x.beginPath(); x.moveTo(52, 174); x.quadraticCurveTo(128, 156, 204, 174); x.stroke(); },
  target(x) { x.lineWidth = 12; for (const r of [96, 56]) { x.beginPath(); x.arc(128, 128, r, 0, 7); x.stroke(); } x.beginPath(); x.arc(128, 128, 16, 0, 7); x.fill(); for (const [a, b, c, d] of [[128, 8, 128, 52], [128, 204, 128, 248], [8, 128, 52, 128], [204, 128, 248, 128]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); } },
  cash(x) { x.font = CF.h(118); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$$$', 128, 134); },
};
function cut(x, f) { x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; x.strokeStyle = '#000'; f(); x.restore(); }
export const ICON_NAMES = Object.keys(ICON);
const ICONS = new Map();
// iconTexture(name | photoKey, { color, glow }) -> a 256 px glyph with a soft glow (photo keys: a square photo, white rim)
export function iconTexture(name, o = {}) {
  const color = o.color ?? '#ffffff', key = `${name}|${color}|${o.glow ?? ''}`; if (ICONS.has(key)) return ICONS.get(key);
  const [g] = [document.createElement('canvas')]; g.width = g.height = 256; const gx = g.getContext('2d'); gx.fillStyle = color; gx.strokeStyle = color;
  if (ICON[name]) { gx.save(); gx.translate(128, 128); gx.scale(.82, .82); gx.translate(-128, -128); ICON[name](gx); gx.restore(); }
  else { gx.fillStyle = '#f2f2f2'; gx.fillRect(28, 28, 200, 200); drawCover(gx, name, 36, 36, 184, 184, { focus: [.5, .35] }); }
  const t = ctex(256, 256, (x) => { x.shadowColor = o.glow ?? color; x.shadowBlur = 22; x.drawImage(g, 0, 0); x.shadowBlur = 8; x.drawImage(g, 0, 0); x.shadowBlur = 0; x.drawImage(g, 0, 0); });
  ICONS.set(key, t); return t;
}

// ======================================================================================================================
// NETWORK GRID
// ======================================================================================================================
// networkGrid(S, { size: [w, d] = [24, 16], cell = .5, glow: [x, z] = [5, 1], fog = [7, 20], bloom = .55, near, far })
//   -> net. Call it INSTEAD of S.studio() (it sets the black room, fog, depth range; S.recon = false). Units: metres on the
//   grid floor, x right, z toward the camera's start; nodes at [x, z].
//   net.node(id, { icon: 'pc' | 'hacker' | 'house' | 'wifi' | 'dish' | 'bitcoin' | 'phone' | 'server' | 'document' | 'money' |
//     'person' | 'building' | 'envelope' | 'globe' | photoKey, label, at: [x, z], t0, size = .8 })   pops in (~.3 s) on t0,
//     its label (heavy white caps) scrambles in under it
//   net.link(a, b, { t0, dur = .7, kind: 'line' | 'arc' | 'dashed', color, height }) -> link: draws on from a to b
//   net.packets(a, b, { t0, t1, every = .45, speed = 2.2, color }): glowing packets travelling the link a -> b
//   net.state(id, 'infected' | 'locked' | 'money' | 'target', t): red skull (icon swaps), red padlock badge, green $$$, red
//     target ring
//   net.label(id, text, t): the label scrambles to a new text at t (a counter: '~40,000,000 $')
//   net.camTo(id | [x, z], { t0, dur = 2, dist = 5, tilt (deg above the floor; first 70, then 38), yaw (deg), fov })
//     chains one continuous eased camera move node to node; net.view(...) the same as a static S.camera key
export function networkGrid(S, o = {}) {
  const [GW, GD] = o.size ?? [24, 16], cell = o.cell ?? .5, scene = S.scene;
  scene.background = new THREE.Color(0x000000); scene.fog = new THREE.Fog(0x000000, o.fog?.[0] ?? 7, o.fog?.[1] ?? 20);
  S.cam.near = o.near ?? .05; S.cam.far = o.far ?? 80; S.cam.updateProjectionMatrix(); S.recon = false;
  S.post.ao = 0; S.post.bloom = o.bloom ?? .3; if (S.post.dof) S.post.dof = { focus: 'look', aperture: o.aperture ?? .0011, maxblur: .007 };
  const per = 4, tex = ctex(512, 512, (x, W) => { x.fillStyle = '#060203'; x.fillRect(0, 0, W, W); x.strokeStyle = 'rgba(128,20,30,.62)'; x.lineWidth = 2.5;
    for (let i = 0; i <= per; i++) { const p = i * W / per; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, W); x.stroke(); x.beginPath(); x.moveTo(0, p); x.lineTo(W, p); x.stroke(); } }, { repeat: [GW / (cell * per), GD / (cell * per)] });
  const floor = part(new THREE.PlaneGeometry(GW, GD), basic(0xffffff, { map: tex }), [0, 0, 0], [-Math.PI / 2, 0, 0], scene, 'grid floor'); floor.userData.ground = true; floor.castShadow = false;
  const [gx, gz] = o.glow ?? [5, 1], glowTex = ctex(256, 256, (x) => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(120,0,14,1)'); g.addColorStop(.4, 'rgba(70,0,10,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); });
  const glow = part(new THREE.PlaneGeometry(16, 12), basic(0xffffff, { map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), [gx, .012, gz], [-Math.PI / 2, 0, 0], scene, 'grid glow'); glow.userData.noPick = true; glow.castShadow = false;
  const nodes = new Map(), links = [], cams = [], labels = [];
  const net = { nodes, links, floor };
  const sprite = (tex2, size, c = .86) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex2, color: new THREE.Color(c, c, c), transparent: true, depthWrite: false, toneMapped: false })); sp.scale.set(size, size, 1); return sp; };
  net.node = (id, p = {}) => {
    const [x, z] = p.at ?? [0, 0], size = p.size ?? .8, g = new THREE.Group(); g.position.set(x, 0, z); g.name = p.label ?? id; scene.add(g); selectable(g, p.label ?? id, 'node');
    const sp = sprite(iconTexture(p.icon ?? 'pc'), size); sp.position.y = size * .62; g.add(sp);
    const ringTex = ctex(128, 128, (c) => { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 4; c.beginPath(); c.arc(64, 64, 52, 0, 7); c.stroke(); const r = c.createRadialGradient(64, 64, 0, 64, 64, 60); r.addColorStop(0, 'rgba(255,255,255,.25)'); r.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = r; c.fillRect(0, 0, 128, 128); });
    const ring = part(new THREE.PlaneGeometry(size * .9, size * .9), basic(0xffffff, { map: ringTex, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }), [0, .02, 0], [-Math.PI / 2, 0, 0], g); ring.castShadow = false;
    const n = { id, g, sp, ring, size, x, z, t0: p.t0 ?? null, label: p.label ?? '', labels: [{ t: p.t0 ?? -1e9, text: p.label ?? '' }], states: [], icon: p.icon ?? 'pc' };
    nodes.set(id, n); if (n.t0 != null && p.sound !== false) sfx('blip', n.t0, { gain: -12 }); return n;
  };
  const N = id => typeof id === 'string' ? nodes.get(id) : id;
  const pathOf = (a, b, kind, hgt) => { const A = V(a.x, .035, a.z), B = V(b.x, .035, b.z), L = A.distanceTo(B), out = [];
    // links end at the node rings, not at their centres
    const ra = a.size * .42, rb = b.size * .42, d = B.clone().sub(A).normalize(), A2 = A.clone().add(d.clone().multiplyScalar(ra)), B2 = B.clone().sub(d.clone().multiplyScalar(rb));
    for (let i = 0; i <= 80; i++) { const s = i / 80, q = A2.clone().lerp(B2, s); if (kind === 'arc') q.y += (hgt ?? .28 * L) * 4 * s * (1 - s); out.push(q); } return out; };
  net.link = (a, b, p = {}) => { const A = N(a), B = N(b), kind = p.kind ?? 'line', pts = pathOf(A, B, kind, p.height), col = new THREE.Color(p.color ?? (kind === 'arc' ? C.crimson : '#ffffff'));
    const t0 = p.t0 ?? 0, dur = p.dur ?? .7, grp = new THREE.Group(); grp.name = `link ${A.label || A.id} - ${B.label || B.id}`; scene.add(grp);
    const lk0 = { at: s => { const f = clamp(s) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)); return pts[i].clone().lerp(pts[i + 1], f - i); } };
    const mk = (r, op) => { let geo;
      if (kind === 'dashed') { const L = pts[0].distanceTo(pts[pts.length - 1]), pieces = []; for (let s = 0; s < L; s += .24) pieces.push([s / L, Math.min(L, s + .14) / L]); geo = dashGeo(pieces.map(([u, v]) => [lk0.at(u), lk0.at(v)]), r); }
      else { geo = tubeGeo(80, 6); tubeSet(geo, pts, r); }
      const m = part(geo, basic(col.getHex(), { transparent: op < 1, opacity: op, blending: op < 1 ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: op >= 1, toneMapped: false }), [0, 0, 0], null, grp); m.castShadow = false; m.receiveShadow = false; return m; };
    const core = mk(kind === 'arc' ? .012 : .0085, 1), halo = mk(kind === 'arc' ? .036 : .026, .16);
    const headSp = sprite(softDisc(), .32); headSp.material.color = col; headSp.material.blending = THREE.AdditiveBlending; grp.add(headSp);
    const lk = { a: A, b: B, kind, pts, t0, dur, grp, at: lk0.at };
    S.tick(t => { const k = ease(t, t0, t0 + dur, E.inOutSine); for (const m of [core, halo]) drawOn(m.geometry, k);
      headSp.visible = k > 0 && k < 1; if (headSp.visible) headSp.position.copy(lk.at(k)); });
    if (p.sound !== false) sfx(kind === 'arc' ? 'whoosh' : 'blip', t0, { gain: kind === 'arc' ? -14 : -16 });
    links.push(lk); return lk; };
  net.packets = (a, b, p = {}) => { const A = N(a), B = N(b), lk = links.find(l => l.a === A && l.b === B) ?? { at: s => V(A.x, .05, A.z).lerp(V(B.x, .05, B.z), s), pts: [V(A.x, 0, A.z), V(B.x, 0, B.z)] };
    const t0 = p.t0 ?? 0, t1 = p.t1 ?? t0 + 3, every = p.every ?? .45, L = lk.pts[0].distanceTo(lk.pts[lk.pts.length - 1]), life = L / (p.speed ?? 2.2), n = Math.ceil((t1 - t0) / every) + 1, col = new THREE.Color(p.color ?? C.crimson);
    const sps = []; for (let i = 0; i < n; i++) { const sp = sprite(softDisc(), .16); sp.material.color = col; sp.material.blending = THREE.AdditiveBlending; scene.add(sp); sps.push(sp); }
    S.tick(t => sps.forEach((sp, i) => { const born = t0 + i * every, s = (t - born) / life; sp.visible = born <= t1 && s >= 0 && s <= 1; if (sp.visible) { sp.position.copy(lk.at(s)); sp.position.y += .03; } }));
    return net; };
  net.state = (id, kind, t, p = {}) => { const n = N(id); const st = { kind, t };
    if (kind === 'infected') { st.sp = sprite(iconTexture('skull', { color: C.crimson }), n.size); st.sp.position.y = n.size * .62; n.g.add(st.sp); }
    else if (kind === 'locked') { st.sp = sprite(iconTexture('padlock', { color: C.crimson }), n.size * .5); st.sp.position.set(n.size * .45, n.size * 1.05, 0); n.g.add(st.sp); }
    else if (kind === 'money') { st.sp = sprite(iconTexture('cash', { color: '#33d17a', glow: '#16a34a' }), n.size * .75); st.sp.position.set(0, n.size * 1.35, 0); n.g.add(st.sp); }
    else if (kind === 'target') { const tt = ctex(256, 256, (x) => { x.strokeStyle = C.crimson; x.lineWidth = 7; x.setLineDash([22, 14]); x.beginPath(); x.arc(128, 128, 112, 0, 7); x.stroke(); x.setLineDash([]); x.lineWidth = 4; x.beginPath(); x.arc(128, 128, 92, 0, 7); x.stroke(); });
      st.sp = part(new THREE.PlaneGeometry(n.size * 1.6, n.size * 1.6), basic(0xffffff, { map: tt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [0, .028, 0], [-Math.PI / 2, 0, 0], n.g); st.sp.castShadow = false; }
    n.states.push(st); if (p.sound !== false) sfx(kind === 'infected' ? 'glitch' : kind === 'money' ? 'cash' : 'beep', t, { gain: -10 }); return net; };
  net.label = (id, text, t) => { const n = N(id); n.labels.push({ t, text }); n.labels.sort((a, b) => a.t - b.t); return net; };
  // per frame: pop-ins, states
  S.tick(t => { for (const n of nodes.values()) {
    const k = n.t0 == null ? 1 : E.outBack(seg(t, n.t0, n.t0 + .3), 1.8); n.g.visible = n.t0 == null || t >= n.t0; n.g.scale.setScalar(Math.max(.001, k));
    let skull = 0; for (const st of n.states) { const a = seg(t, st.t, st.t + .2);
      if (st.kind === 'infected') { skull = Math.max(skull, a); st.sp.material.opacity = a; st.sp.visible = a > 0; }
      else if (st.kind === 'target') { st.sp.visible = t >= st.t; st.sp.rotation.z = t * .6; st.sp.material.opacity = a * (.75 + .25 * Math.sin(t * 6)); }
      else { st.sp.visible = t >= st.t; const s = E.outBack(a, 2); st.sp.scale.setScalar(Math.max(.001, s) * (st.kind === 'money' ? n.size * .75 : n.size * .5)); if (st.kind === 'money') st.sp.position.y = n.size * 1.35 + .05 * Math.sin(t * 2.4); } }
    n.sp.material.opacity = 1 - skull; n.ring.material.color.set(skull > 0 || n.states.some(s => s.kind === 'target' && t >= s.t) ? C.crimson : '#ffffff'); } });
  // labels (2D: sharp, scrambling) + the red dots and streaks of the grid frame
  S.over(custom((x, t, a, S2) => {
    redStreaks(x, .9); redDots(x);
    for (const n of nodes.values()) { if (n.t0 != null && t < n.t0 + .05) continue; let L = n.labels[0]; for (const l of n.labels) if (t >= l.t) L = l; if (!L.text) continue;
      const [X, Y, ok] = S2.proj(V(n.x, 0, n.z)); if (!ok) continue;
      const k = seg(t, Math.max(L.t, n.t0 ?? -1e9) + .05, Math.max(L.t, n.t0 ?? -1e9) + .6), s = decodeText(String(L.text).toUpperCase(), k, { t, seed: n.id.length * 31 + L.t * 7 });
      glowText(x, s, X, Y + 34, { font: CF.h(24), align: 'center', ls: '1px', glow: 'rgba(0,0,0,.9)', blur: 12 }); }
  }, { t0: S.t0 ?? 0, what: 'network labels', text: null }));
  // camera: one continuous eased move node to node, tilting down toward the floor
  const poseAt = (c, tilt, yaw, dist) => { const look = V(c[0], .3, c[1]), tr = tilt * Math.PI / 180, yr = yaw * Math.PI / 180;
    return { look, pos: look.clone().add(V(Math.sin(yr) * Math.cos(tr) * dist, Math.sin(tr) * dist, Math.cos(yr) * Math.cos(tr) * dist)) }; };
  const where = id => { const n = N(id); return n ? [n.x, n.z] : id; };
  net.view = (id, p = {}) => { const q = poseAt(where(id), p.tilt ?? 55, p.yaw ?? 0, p.dist ?? 6); return { p: q.pos.toArray(), l: q.look.toArray(), fov: p.fov ?? 34 }; };
  net.camTo = (id, p = {}) => { const prev = cams[cams.length - 1]; const c = { at: where(id), t0: p.t0 ?? 0, dur: p.dur ?? 2, dist: p.dist ?? prev?.dist ?? 5, tilt: p.tilt ?? (prev ? 38 : 70), yaw: p.yaw ?? prev?.yaw ?? 0, fov: p.fov ?? prev?.fov ?? 34, push: p.push ?? .05 };
    c.from = prev ?? c; cams.push(c);
    if (cams.length === 1) S.tick(t => { let c2 = cams[0]; for (const q of cams) if (t >= q.t0) c2 = q; const f = c2.from, k = E.inOutCubic(seg(t, c2.t0, c2.t0 + c2.dur));
      const nxt = cams[cams.indexOf(c2) + 1], hold = seg(t, c2.t0 + c2.dur, nxt ? nxt.t0 : c2.t0 + c2.dur + 6), d = lerp(f.dist, c2.dist, k) * (1 - c2.push * hold);
      const at = [lerp(f.at[0], c2.at[0], k), lerp(f.at[1], c2.at[1], k)], q = poseAt(at, lerp(f.tilt, c2.tilt, k), lerp(f.yaw, c2.yaw, k), d);
      S.look.copy(q.look); S.cam.position.copy(q.pos); S.cam.lookAt(S.look); const fv = lerp(f.fov, c2.fov, k); if (S.cam.fov !== fv) { S.cam.fov = fv; S.cam.updateProjectionMatrix(); } });
    return net; };
  return net;
}

// ======================================================================================================================
// SIDE VIEW (cutaway)
// ======================================================================================================================
// sideView(S, { floors: [{ name, h = 3, rooms: [{ name, w, kind: 'room' | 'stairs' | 'gallery' | 'hall', door: 'left' | 'right',
//   lamp = true, frames: n, empty: true (a gallery wall with one bare spot and four pegs) }] }] (bottom floor first), depth = 3,
//   slab = .25, wall = .16, fov = 11, labels = true, studio = true }) -> sv
//   A locked, nearly orthographic side camera on a building cut open lengthwise: floors and walls are closed slabs (their cut
//   faces toward the camera), rooms labelled in mono caps. People: the scene makes them (cast) and stands them with
//   sv.place(person, room, fx, ry) or sv.spot(room, fx) -> Vector3 on that room's floor (room = its name or [floor, index]).
//   sv.path([[room, fx, fy], ...], { t0, dur, color, dashed = true, dot = true }) -> { at(t) -> Vector3 }: a crimson route
//     drawing on room to room (fy: height in the room, 0-1, for stairs) with a glowing dot at its head.
//   sv.camera(t, { zoom = 1, at: [x, y] }) -> a camera key for S.camera; sv.solids: every slab, wall and step (S.collide).
export function sideView(S, o = {}) {
  const D = o.depth ?? 3, TS = o.slab ?? .25, TW = o.wall ?? .16, floors = o.floors ?? [{ name: 'GROUND FLOOR', rooms: [{ name: 'ROOM', w: 6 }] }];
  if (o.studio !== false) S.studio({ floor: false, interior: true, near: .5, far: 400, fog: [120, 300], key: [-8, 14, 30], keyI: INV ? 1.6 : 1, area: 22, soft: 4, rim: false });
  S.post.dof = null; S.post.bloom = 0;                                // a diagram: everything sharp
  const G = new THREE.Group(); G.name = o.name ?? 'side view'; S.scene.add(G); selectable(G, G.name, 'cutaway');
  const cutM = std(INV ? 0xa4a8ad : 0xe8e7e3, .85), backM = std(INV ? 0x4a4e54 : 0xcfcdc7, .95), floorM = std(INV ? 0x6a6e74 : 0xd9d7d1, .9), stepM = std(INV ? 0x8a8e94 : 0xdedcd6, .85), earthM = std(INV ? 0x15161a : 0xbebcb5, 1);
  const solids = [], rooms = [], add = (geo, m, p, name) => { const me = part(geo, m, p, null, G, name); solids.push(me); return me; };
  const Wtot = Math.max(...floors.map(f => f.rooms.reduce((s, r) => s + r.w, 0))) + TW;
  add(new THREE.BoxGeometry(Wtot + 6, 2, D + 1), earthM, [Wtot / 2, -1 - TS, 0], 'ground');
  let y = 0;
  floors.forEach((f, fi) => {
    const h = f.h ?? 3, below = floors[fi - 1]; let x = 0;
    // the slab under this floor, with holes over the stairs of the floor below
    // (the slab's ends stop 12 mm off the wall faces beside the hole: never in one plane with them)
    const holes = []; if (below) { let bx = 0; for (const r of below.rooms) { if (r.kind === 'stairs') holes.push([bx + TW + .012, bx + r.w - .012]); bx += r.w; } }
    let sx = 0; const fw = f.rooms.reduce((s, r) => s + r.w, 0) + TW;
    for (const [h0, h1] of [...holes, [fw, fw]]) { if (h0 - sx > .05) add(new THREE.BoxGeometry(h0 - sx, TS, D), floorM, [(sx + h0) / 2, y - TS / 2, 0], `${f.name ?? 'floor'} slab`); sx = h1; }
    add(new THREE.BoxGeometry(fw, h, .12), backM, [fw / 2, y + h / 2, -D / 2 + .06], `${f.name ?? 'floor'} back wall`);
    f.rooms.forEach((r, ri) => {
      const x0 = x + TW, x1 = x + r.w, room = { ...r, fi, ri, x0, x1, y, h, floor: f };
      rooms.push(room);
      // the wall on its left (the first room's is the outer wall); a door leaves a 2.1 m opening
      // walls run down through the slab under them (they carry it: nothing hangs in the air) to the floor below's top
      //   (their cut face sits 12 mm behind the slab's, so the two never share a plane)
      const WD = D - .152, WZ = .07 - .006;
      const wallAt = (wx, door) => { if (door) { const top = h - 2.15; if (top > .05) add(new THREE.BoxGeometry(TW, top, WD), cutM, [wx, y + h - top / 2, WZ], 'lintel'); if (fi > 0) add(new THREE.BoxGeometry(TW, TS, WD), cutM, [wx, y - TS / 2, WZ], 'wall foot'); }
        else add(new THREE.BoxGeometry(TW, h + TS, WD), cutM, [wx, y + (h - TS) / 2, WZ], 'wall'); };
      wallAt(x + TW / 2, r.door === 'left' || f.rooms[ri - 1]?.door === 'right');
      if (ri === f.rooms.length - 1) wallAt(x1 + TW / 2, r.door === 'right');
      if (r.kind === 'stairs') { const rise = h + TS, n = Math.max(6, Math.round(rise / .19)), run = (x1 - .012 - x0) / n;   // up to the next floor's top, meeting its slab edge
        for (let i = 0; i < n; i++) { const sh = (i + 1) * rise / n; add(new THREE.BoxGeometry(run, sh, D * .55), stepM, [x0 + run * (i + .5), y + sh / 2, -D / 2 + .12 + D * .275], 'step'); } }
      if (r.kind === 'gallery') { const nF = r.frames ?? Math.max(1, Math.floor((x1 - x0) / 1.6)), fm = std(INV ? 0x5a4a32 : 0xb9a27a, .5), pm = std(INV ? 0x3a3c40 : 0x9a9893, .8);
        for (let i = 0; i < nF; i++) { const cx = x0 + (x1 - x0) * (i + .5) / nF, fwid = Math.min(1.1, (x1 - x0) / nF * .7);
          if (r.empty && i === Math.floor(nF / 2)) { for (const [dx, dy] of [[-.18, .3], [.18, .3], [-.18, -.25], [.18, -.25]]) part(new THREE.CylinderGeometry(.015, .015, .06, 10), std(0x55585c, .4, { metalness: .6 }), [cx + dx, y + 1.75 + dy, -D / 2 + .12 + .03], [Math.PI / 2, 0, 0], G, 'peg'); continue; }
          part(rbox(fwid, fwid * .75, .05, .01), fm, [cx, y + 1.75, -D / 2 + .12 + .025], null, G, 'frame'); part(new THREE.BoxGeometry(fwid * .8, fwid * .55, .01), pm, [cx, y + 1.75, -D / 2 + .12 + .055], null, G, 'canvas'); } }
      x += r.w;
    });
    y += h + TS;
  });
  const Htot = y - TS;
  add(new THREE.BoxGeometry(Wtot, TS, D), floorM, [Wtot / 2, Htot + TS / 2, 0], 'roof');
  // lamps: one warm point light near each room's ceiling (at most 8)
  rooms.filter(r => r.lamp !== false && r.kind !== 'well').slice(0, o.maxLamps ?? 8).forEach(r => { const pl = new THREE.PointLight(lampColor(), INV ? 9 : 4, Math.max(6, r.w * 1.8), 1.1); pl.position.set((r.x0 + r.x1) / 2, r.y + r.h - .4, .4); S.scene.add(pl); });
  const roomOf = q => typeof q === 'string' ? rooms.find(r => r.name === q) : Array.isArray(q) ? rooms.find(r => r.fi === q[0] && r.ri === q[1]) : q;
  const sv = { group: G, solids, rooms, width: Wtot, height: Htot, depth: D };
  sv.spot = (room, fx = .5, fy = 0) => { const r = roomOf(room); const x = lerp(r.x0 + .3, r.x1 - .3, fx);
    let yy = r.y + fy * r.h; if (r.kind === 'stairs' && fy === 0) { const n = Math.max(6, Math.round((r.h + TS) / .19)); yy = r.y + Math.min(n, Math.floor(clamp((x - r.x0) / (r.x1 - r.x0)) * n) + 1) * (r.h + TS) / n; }   // on the stairs: the tread under x
    return V(x, yy, r.kind === 'stairs' ? -D / 2 + .12 + D * .275 : .25); };
  sv.place = (p, room, fx = .5, ry = Math.PI / 2) => { const q = sv.spot(room, fx); p.place(q.x, q.y, q.z, ry); return q; };
  sv.camera = (t = 0, p = {}) => { const fov = p.fov ?? o.fov ?? 11, z = p.zoom ?? 1, cx = p.at?.[0] ?? Wtot / 2, cy = p.at?.[1] ?? Htot / 2;
    const half = Math.max((Htot / 2 + 1.1) / z, (Wtot / 2 + 1.4) / z / (FW / FH)), dist = half / Math.tan(fov * Math.PI / 360);
    return { t, p: [cx, cy + dist * .02, dist + D / 2], l: [cx, cy, 0], fov }; };
  sv.path = (wps, p = {}) => { const pts = wps.map(w => Array.isArray(w) ? sv.spot(w[0], w[1] ?? .5, w[2] ?? 0).add(V(0, .9, D / 2 - .25)) : V(...w)), t0 = p.t0 ?? 0, dur = p.dur ?? 3;
    const Ls = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const d = pts[i].distanceTo(pts[i - 1]); Ls.push(d); tot += d; }
    const at = t => { let rem = tot * E.inOutSine(seg(t, t0, t0 + dur)); for (let i = 1; i < pts.length; i++) { if (rem <= Ls[i - 1]) return pts[i - 1].clone().lerp(pts[i], Ls[i - 1] ? rem / Ls[i - 1] : 0); rem -= Ls[i - 1]; } return pts[pts.length - 1].clone(); };
    S.over(custom((x, t, a, S2) => { const k = E.inOutSine(seg(t, t0, t0 + dur)); if (k <= 0) return; const P = pts.map(q => S2.proj(q));
      x.save(); x.strokeStyle = p.color ?? C.crimson; x.lineWidth = 4; x.lineCap = 'round'; x.lineJoin = 'round'; if (p.dashed !== false) x.setLineDash([14, 10]); x.shadowColor = p.color ?? C.crimson; x.shadowBlur = 10;
      let rem = tot * k; x.beginPath(); x.moveTo(P[0][0], P[0][1]); let e = P[0];
      for (let i = 1; i < pts.length && rem > 0; i++) { const f = Math.min(1, rem / Ls[i - 1]); e = [lerp(P[i - 1][0], P[i][0], f), lerp(P[i - 1][1], P[i][1], f)]; x.lineTo(e[0], e[1]); rem -= Ls[i - 1]; }
      x.stroke(); x.setLineDash([]);
      if (p.dot !== false) { const [hx, hy] = S2.proj(at(t)); x.fillStyle = '#fff'; x.shadowBlur = 22; x.beginPath(); x.arc(hx, hy, 9, 0, 7); x.fill(); x.fillStyle = p.color ?? C.crimson; x.beginPath(); x.arc(hx, hy, 5, 0, 7); x.fill(); }
      x.restore(); }, { t0, t1: p.t1, what: 'route', text: p.label ?? null }));
    if (p.sound !== false) sfx('whoosh', t0, { gain: -16 });
    return { at, points: pts }; };
  if (o.labels !== false) S.over(custom((x, t, a, S2) => {
    for (const r of rooms) { if (!r.name) continue; const [X, Y, ok] = S2.proj(V(r.x0 + .12, r.y + r.h - .14, D / 2)); if (!ok) continue;
      x.save(); x.font = CF.m(17, 700); x.letterSpacing = '2px'; const s = String(r.name).toUpperCase(), w = x.measureText(s).width;
      x.fillStyle = 'rgba(8,9,11,.72)'; x.fillRect(X + 6, Y + 6, w + 20, 30); x.fillStyle = C.dot; x.fillRect(X + 6, Y + 6, 3, 30); x.fillStyle = 'rgba(232,236,236,.95)'; x.fillText(s, X + 16, Y + 27); x.restore(); }
    for (const f of floors) { const r = rooms.find(q => q.floor === f); if (!f.name || !r) continue; const [X, Y, ok] = S2.proj(V(-.25, r.y + .5, D / 2)); if (!ok) continue;
      x.save(); x.font = CF.m(15); x.letterSpacing = '3px'; x.textAlign = 'right'; x.fillStyle = 'rgba(200,205,207,.75)'; x.fillText(String(f.name).toUpperCase(), X - 10, Y); x.restore(); }
  }, { t0: S.t0 ?? 0, what: 'cutaway labels' }));
  return sv;
}

// ======================================================================================================================
// EVIDENCE ON A DESK
// ======================================================================================================================
// evidence(S, doc, { width = .42 (m), yaw = -8 (deg), desk = true, studio = true, aperture, curl = true }) -> ev
//   doc: a spec for makeDoc ({ kind: 'headline' | 'document' | 'tweet' | 'card' | 'letter', ... }), a doc, or
//   evidence.fromCanvas(draw, { w, h }). The page lies on a grey desk, filmed close with a strong tilt-shift focus band.
//   ev.highlight(phrase | [x, y, w, h] (page px), { t0, dur = .7, color = C.hl }): highlighter wiping L->R on the spoken word
//   ev.ellipse(phrase | rect, t0, { dur }): a hand-drawn crimson ellipse;  ev.redact(phrase | rect, t0)
//   ev.key(t, at = phrase | rect | null (page centre), { dist = .32, tilt = 48 (deg above the desk), turn = 0 (deg around the
//     look point), dx = 0 (m along the line), fov }) -> a camera key { t, p, l, fov } for S.camera([...])
//   ev.zoomTo(at, { t0, dur = .5, from, dist = .14 }) -> two keys: a push onto the phrase; ev.drift(t0, t1, at, o): a slow
//     sideways drift across a line (5-10 % of the frame per second)
export function evidence(S, docIn, o = {}) {
  const doc = docIn?.paint ? docIn : makeDoc(docIn ?? { kind: 'document' }), PW = o.width ?? .42, PH = PW * doc.h / doc.w;
  if (o.studio !== false) S.studio({ floor: false, interior: false, near: .01, far: 30, fog: [6, 14], key: [-.9, 2.6, 1.4], keyI: INV ? 1.45 : 1.1, area: .9, soft: 5, target: [0, 0, 0], rim: false });
  if (S.post.dof !== undefined) S.post.dof = { focus: 'look', aperture: o.aperture ?? .32, maxblur: o.maxblur ?? .045 };   // tilt-shift: one or two lines sharp
  S.post.ao = 0;
  if (o.desk !== false) { const dt = ctex(512, 512, (x, W) => { x.fillStyle = '#6a6c6e'; x.fillRect(0, 0, W, W); for (let i = 0; i < 9000; i++) { const v = 80 + hh(i, 1) * 50; x.fillStyle = `rgba(${v},${v},${v + 2},.35)`; x.fillRect(hh(i, 2) * W, hh(i, 3) * W, 2, 2); } }, { repeat: [4, 3] });
    const desk = part(new THREE.BoxGeometry(5, .1, 4), std(INV ? 0x8a8c8f : 0xb6b7b8, .92, { map: dt }), [0, -.05, 0], null, S.scene, 'desk'); desk.userData.ground = true; }
  const Cv = document.createElement('canvas'); Cv.width = doc.w; Cv.height = doc.h; const ctx = Cv.getContext('2d');
  const tex = new THREE.CanvasTexture(Cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
  // the sheet: a subdivided plane, flat at 11 mm above the desk, its last few cm curling down to 3 mm (paper never lies flat)
  const geo = new THREE.PlaneGeometry(PW, PH, 40, 40); geo.rotateX(-Math.PI / 2); const pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) { const u = Math.abs(pa.getX(i)) / (PW / 2), v = Math.abs(pa.getZ(i)) / (PH / 2), e = Math.min(1 - u, 1 - v) * Math.min(PW, PH) / 2; pa.setY(i, o.curl === false ? .011 : .003 + .008 * E.inOutSine(clamp(e / .025))); }
  geo.computeVertexNormals();
  const sheet = part(geo, std(0xffffff, .82, { map: tex }), [0, 0, 0], [0, (o.yaw ?? -8) * Math.PI / 180, 0], S.scene, o.name ?? 'evidence'); sheet.castShadow = false; selectable(sheet, o.name ?? 'evidence', 'document');
  let lastKey = null; const paint = t => { const k = doc.key(t); if (k === lastKey) return; lastKey = k; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, doc.w, doc.h); doc.paint(ctx, t); tex.needsUpdate = true; };
  paint(-1e9); S.tick(paint);
  sheet.updateMatrixWorld(true);
  const toWorld = (px, py) => sheet.localToWorld(V((px / doc.w - .5) * PW, .011, (py / doc.h - .5) * PH));
  const centreOf = at => { if (at == null) return [doc.w / 2, doc.h / 2]; const R = Array.isArray(at) && typeof at[0] === 'number' ? [{ x: at[0], y: at[1], w: at[2], h: at[3] }] : doc.find(at);
    if (!R.length) return [doc.w / 2, doc.h / 2]; const x0 = Math.min(...R.map(r => r.x)), x1 = Math.max(...R.map(r => r.x + r.w)), y0 = Math.min(...R.map(r => r.y)), y1 = Math.max(...R.map(r => r.y + r.h)); return [(x0 + x1) / 2, (y0 + y1) / 2]; };
  const yaw = (o.yaw ?? -8) * Math.PI / 180, fwd = V(Math.sin(yaw), 0, Math.cos(yaw)), side = V(Math.cos(yaw), 0, -Math.sin(yaw));
  const ev = { doc, sheet, width: PW, height: PH, toWorld };
  ev.highlight = (at, p = {}) => { doc.highlight(at, { ...p, color: p.color ?? C.hl }); if (p.sound !== false) sfx('marker', p.t0 ?? 0, { gain: -14, dur: p.dur ?? .7 }); return ev; };
  ev.ellipse = (at, t0, p = {}) => { doc.ellipse(at, { ...p, t0 }); if (p.sound !== false) sfx('marker', t0, { gain: -12, dur: p.dur ?? .45 }); return ev; };
  ev.redact = (at, t0, p = {}) => { doc.redact(at, { ...p, t0 }); return ev; };
  ev.key = (t, at = null, p = {}) => { const [px, py] = centreOf(at), L = toWorld(px, py).add(side.clone().multiplyScalar(p.dx ?? 0)), d = p.dist ?? .32, tl = (p.tilt ?? 48) * Math.PI / 180, tn = (p.turn ?? 0) * Math.PI / 180;
    const dir = fwd.clone().applyAxisAngle(V(0, 1, 0), tn).multiplyScalar(Math.cos(tl)).add(V(0, Math.sin(tl), 0));
    return { t, p: L.clone().add(dir.multiplyScalar(d)).toArray(), l: L.toArray(), fov: p.fov ?? 30 }; };
  ev.zoomTo = (at, p = {}) => { const t0 = p.t0 ?? 0; return [ev.key(t0, p.from ?? at, { dist: p.fromDist ?? .3, tilt: p.tilt, turn: p.turn }), { ...ev.key(t0 + (p.dur ?? .5), at, { dist: p.dist ?? .14, tilt: p.tilt, turn: p.turn }), ease: E.outCubic }]; };
  ev.drift = (t0, t1, at = null, p = {}) => [ev.key(t0, at, { ...p, dx: -(p.amount ?? .02) }), { ...ev.key(t1, at, { ...p, dx: p.amount ?? .02 }), ease: E.lin }];
  return ev;
}
// evidence.fromCanvas(draw(ctx, L), { w, h, paper }) -> a doc drawn by the scene: L.text(str, x, y, { font, color, maxW, lh, align })
//   draws text and records its words (so ev.highlight('the phrase') finds them); L.w, L.h the page size.
evidence.fromCanvas = (draw, o = {}) => makeDoc({ kind: 'canvas', draw, w: o.w ?? 1600, h: o.h ?? 1000, paper: o.paper });

// ======================================================================================================================
// DARK SPACE: a photo standing in black space with blue bokeh
// ======================================================================================================================
// darkSpace(S, { bokeh = 26, color = '#4f82e8', seed = 3 }) -> ds; ds.photo(key, { w = 1.1, at = [0, 1.5, 0], t0, t1,
//   slide = .04 (fraction of the frame width the camera slides), dist = 2.4, fov, camera = true }) -> the card mesh.
//   Also darkSpace.photo(S, key, o) for a shot that is only that.
export function darkSpace(S, o = {}) {
  S.studio({ floor: false, near: .05, far: 60, fog: [30, 60], key: [-2.2, 3.2, 3.6], keyI: INV ? 1.2 : 1, area: 3, rim: [2, 2.5, -2] });
  S.scene.background = new THREE.Color(0x020306); if (S.scene.fog) S.scene.fog.color.set(0x020306); S.post.ao = 0; S.post.bloom = Math.max(S.post.bloom ?? 0, .25);
  if (S.post.dof !== undefined) S.post.dof = { focus: 'look', aperture: o.aperture ?? .006, maxblur: .02 };
  const col = new THREE.Color(o.color ?? '#4f82e8'), seed = o.seed ?? 3;
  for (let i = 0; i < (o.bokeh ?? 26); i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color: col.clone().offsetHSL((hh(seed, i) - .5) * .06, 0, (hh(seed + 1, i) - .5) * .2), transparent: true, opacity: .35 + hh(seed + 2, i) * .5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    const z = -4 - hh(seed + 3, i) * 9, s = .25 + hh(seed + 4, i) * .7; sp.position.set((hh(seed + 5, i) - .5) * 14, .2 + hh(seed + 6, i) * 3.6, z); sp.scale.set(s, s, 1); S.scene.add(sp); }
  const ds = {};
  ds.photo = (key, p = {}) => { const im = IMG[key], w = p.w ?? 1.1, h = im ? w * im.height / im.width : w * 1.3, at = p.at ?? [0, 1.5, 0];
    const tex = ctex(1024, Math.round(1024 * h / w), (x, W, H) => drawCover(x, key, 0, 0, W, H, { focus: p.focus, filter: p.filter }));
    const fm = std(0xffffff, .55, { map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: p.glow ?? (INV ? .5 : .25) }), dm = std(0x0c0d10, .6);
    const card = part(new THREE.BoxGeometry(w, h, .012), [dm, dm, dm, dm, fm, dm], at, [0, (p.yaw ?? 0) * Math.PI / 180, 0], S.scene, p.name ?? `photo ${key}`); selectable(card, p.name ?? `photo ${key}`, 'photo');
    if (p.camera !== false) { const t0 = p.t0 ?? S.t0 ?? 0, t1 = p.t1 ?? (S.t1 ?? t0 + 3), fov = p.fov ?? 30, d = p.dist ?? Math.max(h * 1.3, w * 1.9 * FH / FW) / (2 * Math.tan(fov * Math.PI / 360)), fw = 2 * d * Math.tan(fov * Math.PI / 360) * FW / FH, dx = fw * (p.slide ?? .04) / 2;
      S.camera([{ t: t0, p: [at[0] - dx, at[1] + .02, at[2] + d], l: [at[0] - dx * .6, at[1], at[2]], fov }, { t: t1, p: [at[0] + dx, at[1] + .02, at[2] + d * .97], l: [at[0] + dx * .6, at[1], at[2]], fov, ease: E.lin }]); }
    return card; };
  return ds;
}
darkSpace.photo = (S, key, o = {}) => darkSpace(S, o).photo(key, o);

// ======================================================================================================================
// SETS: minimal furnished rooms with practical lights. Each returns { group, solids (closed meshes, for S.collide), spots
// (named [x, y, z] marks: where a person sits or stands), lights, screens, lightsOut(t0, { dur = .35, red = true }) }.
// They call S.studio() themselves (o.studio: false to skip, then the scene sets its own room). Units: metres, y up, the
// open side of the room toward +z.
// lightsOut(t0): at t0 the room's lights die to ~12 % over dur and a deep red light comes up (the "power" moment).
// ======================================================================================================================
function screenTex(kind, o = {}) {
  return ctex(768, 432, (x, W, H) => {
    if (kind === 'code') { x.fillStyle = '#0b0f14'; x.fillRect(0, 0, W, H); x.font = CF.m(15); const cols = ['#7ee787', '#79c0ff', '#d2a8ff', '#c9d1d9', '#ffa657'];
      for (let i = 0; i < 24; i++) { x.fillStyle = cols[Math.floor(hh(i, 1) * cols.length)]; const ind = Math.floor(hh(i, 2) * 4) * 18; let s = ''; for (let k = 0; k < 8 + hh(i, 3) * 30; k++) s += 'abcdefghijklmnopqrstuvwxyz_(){}=;.'[Math.floor(hh(i * 7 + k, 4) * 35)]; x.fillText(s, 16 + ind, 26 + i * 17); } }
    else if (kind === 'game') { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5d6f7d'); g.addColorStop(.55, '#a59a85'); g.addColorStop(.56, '#4b4a3e'); g.addColorStop(1, '#262620'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = '#2d2c27'; for (let i = 0; i < 7; i++) x.fillRect(hh(i, 1) * W, H * .25 + hh(i, 2) * H * .2, 40 + hh(i, 3) * 120, H * .4); x.fillStyle = '#1a1a18'; x.beginPath(); x.moveTo(W * .62, H); x.lineTo(W * .7, H * .62); x.lineTo(W * .86, H * .66); x.lineTo(W, H); x.fill();
      x.strokeStyle = '#d8ffd0'; x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2 - 10, H / 2); x.lineTo(W / 2 + 10, H / 2); x.moveTo(W / 2, H / 2 - 10); x.lineTo(W / 2, H / 2 + 10); x.stroke(); x.fillStyle = '#fff'; x.font = CF.h(18); x.fillText('100', 20, H - 18); }
    else if (kind === 'browser') { x.fillStyle = '#f2f3f5'; x.fillRect(0, 0, W, H); x.fillStyle = '#dfe1e5'; x.fillRect(0, 0, W, 44); x.fillStyle = '#fff'; x.beginPath(); x.roundRect(90, 9, W - 180, 26, 13); x.fill(); x.fillStyle = '#555'; x.font = CF.h(14, 600); x.fillText(o.url ?? 'https://', 104, 27);
      x.fillStyle = '#222'; x.font = CF.h(30); x.fillText(o.title ?? 'Account login', 60, 110); x.fillStyle = '#bbb'; for (const yy of [150, 210]) { x.strokeStyle = '#bbb'; x.strokeRect(60, yy, 320, 40); } x.fillStyle = '#2f6fd6'; x.fillRect(60, 270, 140, 40); x.fillStyle = '#fff'; x.font = CF.h(16); x.fillText('Sign in', 98, 296); }
    else if (kind === 'red') { x.fillStyle = '#1a0003'; x.fillRect(0, 0, W, H); x.fillStyle = '#ff2030'; x.font = CF.m(26, 700); x.textAlign = 'center'; x.fillText(o.text ?? 'ACCESS GRANTED', W / 2, H / 2); }
    else if (typeof kind === 'function') kind(x, W, H);
    else { x.fillStyle = '#0d1520'; x.fillRect(0, 0, W, H); }
    x.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < H; y += 3) x.fillRect(0, y, W, 1);    // scan lines: reads as a screen
  });
}
function monitor(parent, at, ry, kind, o = {}) {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = ry; parent.add(g); g.name = o.name ?? 'monitor';
  const blk = std(0x101113, .45), w = o.w ?? .62, h = o.h ?? .36;
  part(rbox(.24, .014, .17, .005), blk, [0, .007, 0], null, g, 'monitor base'); part(rbox(.045, .2, .03, .008), blk, [0, .014 + .1, -.03], null, g, 'monitor neck');
  part(rbox(w, h, .028, .008), blk, [0, .2 + h / 2, -.01], null, g, 'monitor');
  const tex = screenTex(kind, o), sm = basic(0xffffff, { map: tex }); const scr = part(new THREE.PlaneGeometry(w - .03, h - .03), sm, [0, .2 + h / 2, .0045], null, g, 'screen'); scr.castShadow = false;
  return { g, scr, mat: sm };
}
function chair(parent, at, ry, o = {}) {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = ry; parent.add(g); g.name = o.name ?? 'chair'; const m = std(o.color ?? 0x17181b, .6), mt = std(0x2b2d31, .35, { metalness: .5 }), seatY = o.seat ?? .44, solids = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; part(rbox(.3, .035, .045, .01), mt, [Math.sin(a) * .15, .07, Math.cos(a) * .15], [0, a + Math.PI / 2, 0], g, 'chair leg'); part(new THREE.SphereGeometry(.03, 12, 8), m, [Math.sin(a) * .28, .03, Math.cos(a) * .28], null, g, 'castor'); }
  part(new THREE.CylinderGeometry(.03, .03, seatY - .14, 12), mt, [0, .07 + (seatY - .14) / 2 + .02, 0], null, g, 'gas lift');
  solids.push(part(rbox(.52, .09, .5, .03), m, [0, seatY - .045, 0], null, g, 'seat'));
  solids.push(part(rbox(.5, o.back ?? .75, .09, .03), m, [0, seatY + .03 + (o.back ?? .75) / 2, -.25], [-.08, 0, 0], g, 'chair back'));
  return { g, solids, seatY };
}
// v8: the set's professional light rig (S.lighting) when the engine has one: o.light: preset | false, o.subject, o.lightOpts
function rig(S, o, preset, d) { if (o.light === false || typeof S.lighting !== 'function') return null; return S.lighting(o.light ?? preset, { ...d, subject: o.subject, ...(o.lightOpts || {}) }); }
function captureLights(S) { const L = []; S.scene.traverse(o => { if (o.isLight && !o.isAmbientLight) L.push({ l: o, i: o.intensity }); }); return L; }
function lightsOutApi(S, api, o = {}) {
  api.lightsOut = (t0, p = {}) => { const base = captureLights(S), dur = p.dur ?? .35;
    const red = new THREE.PointLight(0xff1424, 0, 14, 1.2); red.position.set(...(p.at ?? o.redAt ?? [0, 2.4, 1])); S.scene.add(red);
    const red2 = new THREE.DirectionalLight(0xff0a18, 0); red2.position.set(-3, 4, 4); S.scene.add(red2);
    const scr = (api.screens || []).map(s => ({ m: s.mat, c: s.mat.color.clone() }));
    S.tick(t => { const k = E.inOutCubic(seg(t, t0, t0 + dur)); for (const b of base) b.l.intensity = b.i * (1 - .88 * k);
      if (p.red !== false) { red.intensity = 3.2 * k * (INV ? 1 : .6); red2.intensity = .9 * k; }
      for (const s of scr) s.m.color.copy(s.c).lerp(new THREE.Color(0xff2a2a), k * .7); });
    if (p.sound !== false) sfx('powerdown', t0, { gain: -6 });
    return api; };
  return api;
}
// setBedroom(S, { screens: [kind, kind] ('code' | 'game' | 'browser' | 'red' | fn(ctx, w, h)), rgb = '#d02bd8', bed = true,
//   poster = true, clock = '11:36' }): a teen's room at night: desk with two monitors and an RGB tower, gaming chair, bed,
//   poster, LED clock; lit by the screens and the RGB strip. spots: chair (sit here: POSE.sit, facing -z), stand (in
//   front of the desk), bed.
export function setBedroom(S, o = {}) {
  if (o.studio !== false) S.studio({ interior: true, near: .03, far: 40, fog: [10, 26], key: [2.2, 3.4, 3.2], keyI: INV ? .55 : .8, area: 3.4, soft: 6, target: [0, .8, -1.5], rim: [-2.5, 2.6, -1] });
  const G = new THREE.Group(); G.name = 'bedroom'; S.scene.add(G); const solids = [], rgb = new THREE.Color(o.rgb ?? '#d02bd8');
  const wallM = std(INV ? 0x2e2d2f : 0xd6d3cc, .95), floorT = ctex(512, 512, (x, W) => { x.fillStyle = '#4a3a2e'; x.fillRect(0, 0, W, W); for (let i = 0; i < 8; i++) { x.fillStyle = `rgba(${30 + hh(i, 1) * 30},${20 + hh(i, 2) * 20},12,.35)`; x.fillRect(0, i * 64, W, 62); x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, i * 64 + 62, W, 2); } }, { repeat: [3, 3] });
  solids.push(part(new THREE.BoxGeometry(6, .1, 5), std(0xffffff, .7, { map: floorT }), [0, -.05, -.5], null, G, 'floor')); G.children[0].userData.ground = true;
  solids.push(part(new THREE.BoxGeometry(6, 3, .12), wallM, [0, 1.5, -3.06], null, G, 'back wall'), part(new THREE.BoxGeometry(.12, 3, 5), wallM, [-3.06, 1.5, -.5], null, G, 'side wall'));
  const deskTop = .76, dz = -2.62, deskM = std(0x1c1d20, .5);
  solids.push(part(rbox(1.6, .04, .7, .008), deskM, [0, deskTop - .02, dz], null, G, 'desk'));
  for (const sx of [-.77, .77]) solids.push(part(new THREE.BoxGeometry(.04, deskTop - .04, .66), deskM, [sx, (deskTop - .04) / 2, dz], null, G, 'desk side'));
  const pad = ctex(512, 256, (x, W, H) => { x.fillStyle = '#0c0c0e'; x.fillRect(0, 0, W, H); x.strokeStyle = '#' + rgb.getHexString(); x.lineWidth = 10; x.shadowColor = x.strokeStyle; x.shadowBlur = 20; x.strokeRect(6, 6, W - 12, H - 12); });
  part(new THREE.BoxGeometry(.9, .012, .36), std(0x0c0c0e, .9, { emissive: 0xffffff, emissiveMap: pad, emissiveIntensity: 1.2 }), [0, deskTop + .006, dz + .17], null, G, 'mouse pad');
  part(rbox(.44, .022, .14, .006), std(0x121316, .5), [-.06, deskTop + .012 + .011, dz + .24], null, G, 'keyboard');
  part(rbox(.06, .035, .1, .02), std(0x121316, .4), [.3, deskTop + .012 + .0175, dz + .24], null, G, 'mouse');
  const kinds = o.screens ?? ['code', 'game'], screens = [monitor(G, [-.36, deskTop, dz - .1], .22, kinds[0], { name: 'left monitor' }), monitor(G, [.36, deskTop, dz - .1], -.22, kinds[1] ?? 'code', { name: 'right monitor' })];
  // the RGB tower beside the desk, fans glowing through the glass side
  const tw = new THREE.Group(); tw.position.set(1.08, 0, dz + .05); G.add(tw); tw.name = 'PC tower';
  solids.push(part(rbox(.22, .48, .46, .01), std(0x0e0f11, .45), [0, .24, 0], null, tw, 'PC tower'));
  const fanT = ctex(128, 128, (x) => { x.strokeStyle = '#' + rgb.getHexString(); x.lineWidth = 9; x.shadowColor = x.strokeStyle; x.shadowBlur = 14; x.beginPath(); x.arc(64, 64, 48, 0, 7); x.stroke(); });
  for (let i = 0; i < 3; i++) { const f = part(new THREE.PlaneGeometry(.13, .13), basic(0xffffff, { map: fanT, transparent: true, toneMapped: false }), [0, .1 + i * .14, .232], null, tw, 'fan'); f.castShadow = false; }
  const side = part(new THREE.PlaneGeometry(.4, .4), basic(rgb.clone().multiplyScalar(.35).getHex(), { toneMapped: false }), [-.113, .26, 0], [0, -Math.PI / 2, 0], tw, 'glass side'); side.castShadow = false;
  const ch = chair(G, [0, 0, -1.9], Math.PI, { name: 'gaming chair', seat: .42 }); solids.push(...ch.solids);
  if (o.bed !== false) { const bed = new THREE.Group(); bed.position.set(-2.1, 0, -1.6); G.add(bed); bed.name = 'bed';
    solids.push(part(rbox(1.5, .3, 2.1, .02), std(0x2b2724, .8), [0, .15, 0], null, bed, 'bed frame'), part(rbox(1.42, .2, 2.02, .05), std(0xcfd2d6, .95), [0, .4, 0], null, bed, 'mattress'));
    part(rbox(1.46, .09, 1.35, .04), std(0x3d4a5c, .95), [0, .545, .3], null, bed, 'duvet'); part(rbox(.62, .12, .34, .05), std(0xe2e4e6, .95), [0, .56, -.78], null, bed, 'pillow'); }
  if (o.poster !== false) { const pt = ctex(512, 720, (x, W, H) => { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a2430'); g.addColorStop(1, '#6b3a22'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = '#0b0d10'; x.beginPath(); x.moveTo(W * .32, H * .9); x.lineTo(W * .38, H * .42); x.lineTo(W * .5, H * .32); x.lineTo(W * .62, H * .42); x.lineTo(W * .7, H * .9); x.fill(); x.beginPath(); x.arc(W * .5, H * .27, W * .07, 0, 7); x.fill();
      x.fillStyle = '#f2e9d8'; x.font = CF.h(70); x.textAlign = 'center'; x.fillText(o.posterTitle ?? 'NIGHTFALL', W / 2, H * .13); x.font = CF.h(26, 600); x.fillText(o.posterSub ?? 'OPERATION', W / 2, H * .19); });
    part(new THREE.BoxGeometry(.6, .84, .012), [std(0xdddddd), std(0xdddddd), std(0xdddddd), std(0xdddddd), std(0xffffff, .6, { map: pt }), std(0xdddddd)], [-1.2, 1.75, -3 + .006], null, G, 'poster'); }
  if (o.clock !== false) { const shelf = part(rbox(.6, .03, .22, .005), std(0x5c4632, .7), [1.45, 1.25, -3 + .11], null, G, 'shelf'); void shelf;
    const ct = ctex(256, 96, (x, W, H) => { x.fillStyle = '#080808'; x.fillRect(0, 0, W, H); x.fillStyle = '#ff2a20'; x.shadowColor = '#ff2a20'; x.shadowBlur = 12; x.font = CF.m(64, 700); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(o.clock ?? '11:36', W / 2, H / 2 + 4); });
    part(new THREE.BoxGeometry(.2, .075, .07), [std(0x0b0b0b), std(0x0b0b0b), std(0x0b0b0b), std(0x0b0b0b), basic(0xffffff, { map: ct }), std(0x0b0b0b)], [1.45, 1.25 + .015 + .0375, -3 + .11], null, G, 'LED clock'); }
  // practical lights: the screens' cool glow, the RGB strip under the desk, a dim window
  const lights = [];
  const scrL = new THREE.PointLight(0x9db4ff, INV ? 2.4 : 1.6, 3.5, 1.4); scrL.position.set(0, deskTop + .5, dz + .45); S.scene.add(scrL); lights.push(scrL);
  const rgbL = new THREE.PointLight(rgb.getHex(), INV ? 1.8 : 1.2, 3, 1.4); rgbL.position.set(.9, .35, dz + .3); S.scene.add(rgbL); lights.push(rgbL);
  const winM = basic(0x3a5070, { toneMapped: true }); const win = part(new THREE.PlaneGeometry(1.2, 1.1), winM, [-3 + .001, 1.7, -.4], [0, Math.PI / 2, 0], G, 'window'); win.position.x = -3 + .01; win.castShadow = false;
  const api = { group: G, solids, screens, lights, spots: { chair: [0, .03, -1.9], stand: [0, 0, -1.6], bed: [-2.1, .52, -1.6], deskTop }, chair: ch };
  api.rig = rig(S, o, 'practical', { fallback: [0, 1.05, -1.9], wall: [-.6, 1.5, -3], amb: 3.6, wash: 3.2, key: 1.6, practicals: [{ at: [1.45, 1.78, -2.9], color: 0xffc88a, i: .35 }] });
  return lightsOutApi(S, api, { redAt: [0, 2.4, -1] });
}
// setOffice(S, { screen: kind, window = true, pendants = 2 }): a cool blue office: desk with an all-in-one screen, office
//   chair, filing cabinet, pendant lamps, a window with blinds. spots: chair, stand, door.
export function setOffice(S, o = {}) {
  if (o.studio !== false) S.studio({ interior: true, near: .03, far: 40, fog: [10, 26], key: [-2.4, 3.5, 3], keyI: INV ? .6 : .9, area: 3.6, soft: 6, target: [0, .8, -1.5], rim: [2.5, 2.6, -1] });
  const G = new THREE.Group(); G.name = 'office'; S.scene.add(G); const solids = [], wallM = std(INV ? 0x2c3238 : 0xdfe1e3, .95);
  const fl = part(new THREE.BoxGeometry(7, .1, 5.5), std(INV ? 0x2a2e33 : 0x9aa0a6, .8), [0, -.05, -.6], null, G, 'floor'); fl.userData.ground = true; solids.push(fl);
  solids.push(part(new THREE.BoxGeometry(7, 3, .12), wallM, [0, 1.5, -3.36], null, G, 'back wall'));
  if (o.window !== false) { const wm = basic(INV ? 0x5d7fa8 : 0xdde9f5); const w = part(new THREE.PlaneGeometry(2.2, 1.4), wm, [1.6, 1.75, -3.3 + .002], null, G, 'window light'); w.castShadow = false;
    for (let i = 0; i < 14; i++) part(new THREE.BoxGeometry(2.24, .03, .05), std(0x9ba3ab, .6), [1.6, 1.08 + i * .1, -3.3 + .03], [.35, 0, 0], G, 'blind'); }
  const deskTop = .75, dz = -2.5, dm = std(INV ? 0x3a3f45 : 0xc9c5bd, .55);
  solids.push(part(rbox(1.8, .04, .8, .008), dm, [-.4, deskTop - .02, dz], null, G, 'desk'));
  for (const sx of [-1.26, .46]) solids.push(part(new THREE.BoxGeometry(.04, deskTop - .04, .76), dm, [sx, (deskTop - .04) / 2, dz], null, G, 'desk side'));
  const screens = [monitor(G, [-.4, deskTop, dz - .12], 0, o.screen ?? 'browser', { name: 'screen', w: .66, h: .4, url: o.url, title: o.title })];
  part(rbox(.42, .015, .13, .005), std(0xd8d9db, .4), [-.4, deskTop + .0075, dz + .2], null, G, 'keyboard');
  const ch = chair(G, [-.4, 0, -1.75], Math.PI, { name: 'office chair', color: 0x26292e, seat: .42 }); solids.push(...ch.solids);
  const cab = part(rbox(.5, 1.3, .6, .01), std(INV ? 0x4b5157 : 0xa9adb1, .5), [-2.6, .65, -3.0], null, G, 'filing cabinet'); solids.push(cab);
  for (let i = 0; i < 4; i++) part(rbox(.16, .03, .03, .01), std(0x8a8f95, .3, { metalness: .6 }), [-2.6, .25 + i * .3, -2.7 + .015], null, G, 'handle');
  const lights = [];
  // the ceiling the pendants hang from (no shadow: the key light comes from above it)
  const ceil = part(new THREE.BoxGeometry(7, .12, 5.5), std(INV ? 0x24282d : 0xe8e8e6, .95), [0, 3.06, -.6], null, G, 'ceiling'); ceil.castShadow = false; solids.push(ceil);
  for (let i = 0; i < (o.pendants ?? 2); i++) { const px = -1.5 + i * 2.2, pg = new THREE.Group(); pg.name = 'pendant lamp'; G.add(pg);
    pg.userData.noContact = true;   // hangs from the ceiling on its cord: the contact check only knows support from below or beside
    part(new THREE.CylinderGeometry(.006, .006, .9, 6), std(0x111111), [px, 2.55, -1.8], null, pg, 'cord');
    part(new THREE.CylinderGeometry(.12, .26, .22, 24, 1, true), std(0x15171a, .5, { side: THREE.DoubleSide }), [px, 2.0, -1.8], null, pg, 'pendant shade');
    const bulb = part(new THREE.SphereGeometry(.06, 16, 10), basic(0xfff1d6, { toneMapped: false }), [px, 1.96, -1.8], null, pg, 'bulb'); bulb.castShadow = false;
    const pl = new THREE.PointLight(lampColor(), INV ? 3.2 : 2, 5, 1.3); pl.position.set(px, 1.8, -1.8); S.scene.add(pl); lights.push(pl); }
  const blue = new THREE.PointLight(0x6f97d6, INV ? 1.6 : 1, 6, 1.2); blue.position.set(1.6, 1.8, -2.6); S.scene.add(blue); lights.push(blue);
  const api = { group: G, solids, screens, lights, spots: { chair: [-.4, 0, -1.75], stand: [.6, 0, -1.4], door: [-3, 0, -.5], deskTop }, chair: ch };
  api.rig = rig(S, o, 'window', { fallback: [-.4, 1.05, -1.75], wall: [-1.2, 1.5, -3.3], amb: 1.5, wash: 1.5 });
  return lightsOutApi(S, api, { redAt: [0, 2.4, -1] });
}
// setLobby(S, { seal = 'DEPARTMENT OF INVESTIGATION', glass = true, columns = 4 }): a big stone lobby with an agency seal
//   inlaid in the floor (in the floor's own texture: no decal, no coplanar), glass walls and columns, a reception desk.
//   spots: seal (the centre), desk, door.
export function setLobby(S, o = {}) {
  if (o.studio !== false) S.studio({ interior: true, near: .1, far: 120, fog: [26, 60], key: [-6, 12, 9], keyI: INV ? .85 : 1.1, area: 12, soft: 8, rim: [6, 8, -8] });
  const G = new THREE.Group(); G.name = 'lobby'; S.scene.add(G); const solids = [];
  const sealTxt = String(o.seal ?? 'DEPARTMENT OF INVESTIGATION').toUpperCase();
  const ft = ctex(2048, 2048, (x, W) => { x.fillStyle = INV ? '#8e8f8c' : '#d9d7d1'; x.fillRect(0, 0, W, W);
    for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(60,60,58,${.08 + hh(i, 1) * .12})`; x.lineWidth = 1 + hh(i, 2) * 3; x.beginPath(); let px = hh(i, 3) * W, py = hh(i, 4) * W; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (hh(i * 9 + k, 5) - .3) * 300; py += (hh(i * 9 + k, 6) - .5) * 200; x.lineTo(px, py); } x.stroke(); }
    x.strokeStyle = 'rgba(40,40,40,.35)'; x.lineWidth = 3; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * W / 8, 0); x.lineTo(i * W / 8, W); x.stroke(); x.beginPath(); x.moveTo(0, i * W / 8); x.lineTo(W, i * W / 8); x.stroke(); }
    // the seal (generic, not any real agency's): rings, lettering round the rim, a shield with a star and a compass rose
    const cx = W / 2, cy = W / 2, R = W * .2; x.fillStyle = INV ? '#2f3236' : '#3c4048'; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill(); x.strokeStyle = '#c9b47a'; x.lineWidth = 10; x.beginPath(); x.arc(cx, cy, R - 6, 0, 7); x.stroke(); x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, R * .72, 0, 7); x.stroke();
    x.fillStyle = '#d9c68e'; x.font = CF.h(44); x.textAlign = 'center'; x.textBaseline = 'middle'; const chars = [...sealTxt + ' • '], step = Math.PI * 2 / Math.max(chars.length, 28);
    for (let i = 0; i < chars.length; i++) { const a = -Math.PI / 2 + (i - (chars.length - 1) / 2) * step; x.save(); x.translate(cx + Math.cos(a) * R * .86, cy + Math.sin(a) * R * .86); x.rotate(a + Math.PI / 2); x.fillText(chars[i], 0, 0); x.restore(); }
    x.fillStyle = '#c9b47a'; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r1 = R * (i % 2 ? .38 : .62); x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a - .09) * r1 * .25, cy + Math.sin(a - .09) * r1 * .25); x.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); x.lineTo(cx + Math.cos(a + .09) * r1 * .25, cy + Math.sin(a + .09) * r1 * .25); x.fill(); }
    x.fillStyle = INV ? '#2f3236' : '#3c4048'; x.beginPath(); x.arc(cx, cy, R * .2, 0, 7); x.fill(); x.fillStyle = '#d9c68e'; x.font = CF.h(80); x.fillText('★', cx, cy + 4); });
  const fl = part(new THREE.BoxGeometry(24, .2, 24), std(0xffffff, INV ? .28 : .4, { map: ft }), [0, -.1, 0], null, G, 'lobby floor'); fl.userData.ground = true; solids.push(fl);
  for (let i = 0; i < (o.columns ?? 4); i++) solids.push(part(new THREE.CylinderGeometry(.45, .45, 8, 32), std(INV ? 0x6b6d70 : 0xe4e2dc, .6), [-7 + i * 14 / Math.max(1, (o.columns ?? 4) - 1), 4, -7], null, G, 'column'));
  solids.push(part(new THREE.BoxGeometry(24, 8, .3), std(INV ? 0x3a3c40 : 0xcfcdc7, .9), [0, 4, -9.5], null, G, 'back wall'));
  if (o.glass !== false) for (const gx of [-8.5, 8.5]) { const gm = new THREE.MeshPhysicalMaterial({ color: 0x9fb4c8, roughness: .05, metalness: 0, transparent: true, opacity: .18 }); part(new THREE.BoxGeometry(.06, 6, 14), gm, [gx, 3, -2], null, G, 'glass wall').castShadow = false;
    for (let i = 0; i < 5; i++) solids.push(part(new THREE.BoxGeometry(.12, 6, .12), std(0x1b1d20, .4), [gx, 3, -9 + i * 3.5], null, G, 'mullion')); }
  const desk = part(rbox(3.2, 1.1, .8, .04), std(INV ? 0x26282b : 0xbdb9b0, .5), [0, .55, -6], null, G, 'reception desk'); solids.push(desk);
  const lights = []; for (const lx of [-4, 4]) { const pl = new THREE.PointLight(lampColor(), INV ? 6 : 3, 14, 1.2); pl.position.set(lx, 6, -3); S.scene.add(pl); lights.push(pl); }
  const api = { group: G, solids, screens: [], lights, spots: { seal: [0, 0, 0], desk: [0, 0, -5.2], door: [0, 0, 6] } };
  api.rig = rig(S, o, 'threePoint', { fallback: [0, 1, 0], wall: [0, 2.6, -9.35], dist: 5 });
  return lightsOutApi(S, api, { redAt: [0, 5, 0] });
}
// setStreet(S, { houses = 6, night = true, police = false, wet = true }): a brick terrace street at night with street lamps,
//   lit and dark windows, wet asphalt; police: red/blue lights flashing from a patrol car. spots: door (the second house's),
//   kerb, road.
export function setStreet(S, o = {}) {
  if (o.studio !== false) S.studio({ interior: true, near: .1, far: 160, fog: [24, 70], key: [8, 14, 10], keyI: INV ? .35 : .9, area: 16, soft: 7, rim: [-6, 6, -8] });
  if (o.night !== false) { S.scene.background = new THREE.Color(INV ? 0x05070b : 0x1a2230); if (S.scene.fog) S.scene.fog.color.copy(S.scene.background); }
  const G = new THREE.Group(); G.name = 'street'; S.scene.add(G); const solids = [];
  const asp = ctex(1024, 1024, (x, W) => { x.fillStyle = '#26282b'; x.fillRect(0, 0, W, W); for (let i = 0; i < 40000; i++) { const v = 25 + hh(i, 1) * 40; x.fillStyle = `rgb(${v},${v},${v + 2})`; x.fillRect(hh(i, 2) * W, hh(i, 3) * W, 2, 2); } x.fillStyle = '#b9b7ad'; for (let i = 0; i < 4; i++) x.fillRect(i * W / 4 + 40, W / 2 - 6, W / 8, 12); }, { repeat: [3, 1] });
  const road = part(new THREE.BoxGeometry(40, .1, 8), std(0xffffff, o.wet === false ? .85 : .28, { map: asp, metalness: o.wet === false ? 0 : .15 }), [0, -.05, 0], null, G, 'road'); road.userData.ground = true; solids.push(road);
  for (const sz of [-5.25, 5.25]) solids.push(part(new THREE.BoxGeometry(40, .15, 2.5), std(INV ? 0x55575a : 0xb0aea8, .8), [0, .075, sz], null, G, 'pavement'));
  const brick = ctex(512, 512, (x, W) => { x.fillStyle = '#3c2a24'; x.fillRect(0, 0, W, W); for (let r = 0; r < 32; r++) for (let c = 0; c < 9; c++) { const v = hh(r * 9 + c, 1); x.fillStyle = `rgb(${110 + v * 40},${55 + v * 20},${42 + v * 14})`; x.fillRect(c * 60 + (r % 2) * 30 - 30, r * 16 + 2, 56, 13); } }, { repeat: [2, 3] });
  const bm = std(0xffffff, .9, { map: brick }), winOff = std(0x0b0d10, .2), doorM = std(0x1d2a22, .5), lights = [];
  // a lit window: warm light falling off toward the edges behind half-drawn curtains (never a flat white card)
  const winOn = basic(0xffffff, { map: ctex(128, 160, (x, W, H) => { const g = x.createRadialGradient(W / 2, H * .45, 4, W / 2, H * .5, W * .8); g.addColorStop(0, '#c99a5a'); g.addColorStop(1, '#4a3420'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(40,22,14,.85)'; x.fillRect(0, 0, W * .2, H); x.fillRect(W * .8, 0, W * .2, H); x.fillStyle = '#16100b'; x.fillRect(W / 2 - 2, 0, 4, H); x.fillRect(0, H / 2 - 2, W, 4); }) });
  const n = o.houses ?? 6;
  for (let i = 0; i < n; i++) { const hx = (i - (n - 1) / 2) * 5.2, hz = -6.5 - 3;
    solids.push(part(new THREE.BoxGeometry(5.1, 7, 6), bm, [hx, 3.5, hz], null, G, 'terrace house'));
    for (let fl = 0; fl < 2; fl++) for (const wx of fl ? [-1.3, 1.3] : [1.3]) { const lit = hh(i * 7 + fl * 3 + (wx > 0 ? 1 : 0), 4) < .4; part(new THREE.BoxGeometry(1.1, 1.4, .06), lit ? winOn : winOff, [hx + wx, 1.6 + fl * 3, hz + 3 + .03], null, G, lit ? 'lit window' : 'window').castShadow = false; }
    part(new THREE.BoxGeometry(1, 2.1, .06), doorM, [hx - 1.3, 1.05 + .15, hz + 3 + .03], null, G, 'front door');
    if (i % 2 === 0) { const lx = hx + 2.6; part(new THREE.CylinderGeometry(.06, .08, 4.6, 10), std(0x15171a, .5), [lx, .15 + 2.3, -4.4], null, G, 'lamp post'); part(rbox(.5, .12, .22, .03), std(0x15171a, .5), [lx, .15 + 4.6, -4.25], null, G, 'lamp head');
      const bulb = part(new THREE.BoxGeometry(.36, .02, .14), basic(0xffdca8, { toneMapped: false }), [lx, .15 + 4.53, -4.25], null, G, 'lamp glow'); bulb.castShadow = false;
      const pl = new THREE.PointLight(0xffc98a, INV ? 9 : 5, 12, 1.3); pl.position.set(lx, 4.4, -4); S.scene.add(pl); lights.push(pl); } }
  if (o.police) { const car = new THREE.Group(); car.position.set(o.police.x ?? 2, 0, 1.4); G.add(car); car.name = 'patrol car';
    solids.push(part(rbox(4.3, .75, 1.8, .15), std(0x1a1c20, .35), [0, .2 + .375 + .15, 0], null, car, 'car body'), part(rbox(2.3, .6, 1.6, .2), std(0x14161a, .25), [-.2, 1.1 + .3, 0], null, car, 'car cabin'));
    for (const [wx, wz] of [[-1.4, -.82], [1.4, -.82], [-1.4, .82], [1.4, .82]]) part(new THREE.CylinderGeometry(.35, .35, .24, 20), std(0x0b0b0b, .8), [wx, .35, wz], [Math.PI / 2, 0, 0], car, 'wheel');
    const red = part(rbox(.4, .1, .3, .02), basic(0xff1020, { toneMapped: false }), [-.4, 1.75, 0], null, car, 'light bar red'), blue = part(rbox(.4, .1, .3, .02), basic(0x2050ff, { toneMapped: false }), [.05, 1.75, 0], null, car, 'light bar blue');
    const rl = new THREE.PointLight(0xff1020, 0, 14, 1.2), bl = new THREE.PointLight(0x2a5cff, 0, 14, 1.2); rl.position.set((o.police.x ?? 2) - .4, 2.2, 1.4); bl.position.set((o.police.x ?? 2) + .1, 2.2, 1.4); S.scene.add(rl, bl);
    S.tick(t => { const ph = Math.floor(t * 6) % 2; rl.intensity = ph ? 8 : .3; bl.intensity = ph ? .3 : 8; red.material.color.setHex(ph ? 0xff1020 : 0x4a0508); blue.material.color.setHex(ph ? 0x0a1440 : 0x2050ff); }); }
  const api = { group: G, solids, screens: [], lights, spots: { door: [(1 - (n - 1) / 2) * 5.2 - 1.3, .15, -6], kerb: [0, .15, -4.2], road: [0, 0, 0] } };
  // (the wash on the facade carries the frame: at 1.8 the Investigation grade of engine v11 left the street at mean .098,
  // just under the visibility gate's .10; 2.4 keeps the night and the lamp pools and reads)
  api.rig = rig(S, o, 'lowKey', { fallback: [0, 1.1, -4.2], wall: [0, 2.2, -6.5], dist: 4, amb: 2.1, wash: 2.4 });
  return lightsOutApi(S, api, { redAt: [0, 4, 0] });
}
// setVoid(S, { desk = false, chair = false, pool = 2.2 }): black void, one soft spotlight pool on a glossy black floor (the
//   reference's stage for generic people and hypotheticals). spots: centre.
export function setVoid(S, o = {}) {
  if (o.studio !== false) S.studio({ floor: false, near: .05, far: 60, fog: [18, 40], key: [0, 8, .5], keyI: .05, area: 4, rim: [-1.5, 3, -3] });
  S.scene.background = new THREE.Color(0x000000); if (S.scene.fog) S.scene.fog.color.set(0x000000);
  const G = new THREE.Group(); G.name = 'void'; S.scene.add(G); const solids = [];
  const fl = part(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: .3, metalness: .1 }), [0, 0, 0], [-Math.PI / 2, 0, 0], G, 'void floor'); fl.userData.ground = true; fl.castShadow = false;
  const sp = new THREE.SpotLight(0xf2f4f8, INV ? 70 : 40, 0, Math.atan((o.pool ?? 2.2) / 5.5), .5, 1); sp.position.set(0, 5.5, .2); sp.target.position.set(0, 0, 0); sp.castShadow = true; sp.shadow.mapSize.set(2048, 2048); sp.shadow.radius = 6; sp.shadow.bias = -.0004; S.scene.add(sp, sp.target);
  if (o.desk) { const dm = std(0x0c0d0f, .35); solids.push(part(rbox(1.3, .04, .65, .006), dm, [0, .74, -.45], null, G, 'black desk')); for (const sx of [-.62, .62]) solids.push(part(new THREE.BoxGeometry(.04, .72, .6), dm, [sx, .36, -.45], null, G, 'desk side')); }
  let ch = null; if (o.chair) { ch = chair(G, [0, 0, .25], Math.PI, { name: 'chair' }); solids.push(...ch.solids); }
  const api = { group: G, solids, screens: [], lights: [sp], spots: { centre: [0, 0, 0], chair: [0, 0, .25], deskTop: .76 }, chair: ch };
  api.rig = rig(S, o, 'void', { fallback: [0, .95, 0], key: .5 });
  S.visibility ??= { dark: .05, darkFrac: .95, crushFrac: .9 };   // the black void is the look: only the pool and the subject must read
  return lightsOutApi(S, api, { redAt: [0, 3, 1] });
}
// setGallery(S, { frames: [{ x, y, w, h, img }] , wall = '#2b3038' }): a museum gallery wall (paintings in gilt frames, a
//   picture light over each one: visible practicals), a parquet floor, a low-key rig with a wash on the wall (v8). The wall
//   face is z = 0 (paintings 1 cm+ proud of it). spots: centre (1.4 m in front of the wall), each frame's centre.
export function setGallery(S, o = {}) {
  if (o.studio !== false) S.studio({ floor: false, near: .03, far: 60, fog: [9, 26], key: [-1.5, 6, 3], keyI: 1, area: 6, rim: [3, 3, -1] });
  const G = new THREE.Group(); G.name = 'gallery'; S.scene.add(G); const solids = [];
  const parq = ctex(512, 512, (x, W) => { for (let i = 0; i < 16; i++) for (let k = 0; k < 4; k++) { const v = hh(i * 4 + k, 7); x.fillStyle = `rgb(${70 + v * 22},${50 + v * 16},${36 + v * 10})`; x.fillRect(k * 128 + (i % 2) * 64 - 64, i * 32, 126, 30); } }, { repeat: [6, 6] });
  const fl = part(new THREE.BoxGeometry(14, .1, 10), std(0xffffff, .55, { map: parq }), [0, -.05, 3], null, G, 'parquet floor'); fl.userData.ground = true; solids.push(fl);
  solids.push(part(new THREE.BoxGeometry(14, 4.6, .3), std(new THREE.Color(o.wall ?? '#2b3038').getHex(), .92), [0, 2.3, -.15], null, G, 'gallery wall'));
  part(new THREE.BoxGeometry(14, .3, .06), std(0x1d2127, .8), [0, .15, .03], null, G, 'skirting');
  const gilt = std(0x8a7442, .38, { metalness: .55 }), frames = [], practicals = [];
  for (const [i, f] of (o.frames ?? [{ x: -2.6, y: 1.75, w: 1.3, h: 1 }, { x: 0, y: 1.66, w: .53, h: .77 }, { x: 2.7, y: 1.8, w: 1.5, h: 1.15 }]).entries()) {
    const g = new THREE.Group(); g.position.set(f.x, f.y, 0); g.name = f.name ?? `painting ${i + 1}`; G.add(g); const b = .07;
    for (const [px, py, ww, hh2] of [[0, f.h / 2 + b / 2, f.w + 2 * b, b], [0, -f.h / 2 - b / 2, f.w + 2 * b, b], [-f.w / 2 - b / 2, 0, b, f.h], [f.w / 2 + b / 2, 0, b, f.h]]) part(rbox(ww, hh2, .08, .012), gilt, [px, py, .035], null, g, 'gilt frame');
    const canvas = f.img && IMG[f.img] ? (() => { const t = new THREE.Texture(IMG[f.img]); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return std(0xffffff, .62, { map: t }); })() : std(0x2a2620, .7);
    part(new THREE.BoxGeometry(f.w - .004, f.h - .004, .03), [std(0x222222), std(0x222222), std(0x222222), std(0x222222), canvas, std(0x222222)], [0, 0, .025], null, g, 'canvas');
    frames.push(g); practicals.push({ at: [f.x, f.y + f.h / 2 + .32, .3], i: .5, r: .025 });
  }
  const api = { group: G, solids, screens: [], lights: [], frames, spots: { centre: [0, 0, 1.4], ...Object.fromEntries(frames.map((g, i) => [`frame${i + 1}`, [g.position.x, g.position.y, .05]])) } };
  api.rig = rig(S, o, 'lowKey', { fallback: [0, 1.6, .4], wall: [0, 1.8, 0], wash: 2, amb: 1.6, practicals });
  return lightsOutApi(S, api, { redAt: [0, 2.6, 2] });
}
