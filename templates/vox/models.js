// Toon Studio - Vox style model library: tactile collage props and procedural illustrations.
// Everything returns a THREE.Object3D; place it, then S.add(obj, { at, in }). Units: the frame is 9 x 16 (vertical).
// "Upright" 3D props (typewriter, keycaps, coins standing) are built Y-up and wrapped so their top faces the camera
// (the board is the XY plane, the camera looks down -Z). Name props on `st` so the editor's clicks resolve.
import { THREE, C, FONTS, mkCanvas, canvasTex, card, cutout, words, paperMat, solidMat, paperCanvas, rrect, rng, clamp, easeOut, easeInOut, lerp } from './engine.js';

const kind = (o, k) => { o.userData.kind = k; return o; };
const shadowed = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
export function upright(obj, tilt = 0) { const g = new THREE.Group(); obj.rotation.x = Math.PI / 2 - tilt; g.add(obj); g.userData.kind = obj.userData.kind; return g; }

// ---------- collage hardware ----------
export function pushpin(color = C.accent2, s = 1) {
  const g = new THREE.Group(), m = solidMat(color, { rough: .35 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(.16 * s, 24, 16), m); head.scale.set(1, 1, .75); head.position.z = .34 * s;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.1 * s, .13 * s, .16 * s, 20), m); collar.rotation.x = Math.PI / 2; collar.position.z = .2 * s;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(.19 * s, .19 * s, .04 * s, 24), m); disc.rotation.x = Math.PI / 2; disc.position.z = .12 * s;
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(.012 * s, .012 * s, .2 * s, 8), solidMat('#c9c9c9', { rough: .25, metal: .9 })); needle.rotation.x = Math.PI / 2; needle.position.z = .02 * s;
  g.add(head, collar, disc, needle); return kind(shadowed(g), 'pin');
}
export function tape(w = 1.2, h = .38, color = '#e6dcb2', seed = 3) {
  const m = card({ w, h, color, torn: 1.2, edges: 'lr', seed, rough: .6, grain: .6 });
  m.material.transparent = true; m.material.opacity = .88; m.castShadow = true;
  return kind(m, 'tape');
}
export function paperclip(color = '#bfc3c7', s = 1) {
  const pts = [[0, -.5], [0, .35], [.09, .45], [.18, .35], [.18, -.38], [.28, -.48], [.38, -.38], [.38, .45], [.27, .56], [.16, .45]].map(([x, y]) => new THREE.Vector3(x * s, y * s, 0));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .2);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, .018 * s, 8), solidMat(color, { rough: .25, metal: 1 }));
  return kind(shadowed(m), 'clip');
}
// red string between two points (on pins): sags a little
export function string(a, b, color = '#b3261e', sag = .15) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), mid = A.clone().lerp(B, .5); mid.y -= sag * A.distanceTo(B) * .3; mid.z += .05;
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(A, mid, B), 40, .018, 6), solidMat(color, { rough: .8 }));
  m.castShadow = true; return kind(m, 'string');
}
export function pencil(len = 3, color = '#f2b705') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, len, 6), solidMat(color, { rough: .5 })); g.add(body);
  const wood = new THREE.Mesh(new THREE.ConeGeometry(.09, .32, 6), solidMat('#e7c08a', { rough: .8 })); wood.position.y = len / 2 + .16; g.add(wood);
  const lead = new THREE.Mesh(new THREE.ConeGeometry(.03, .1, 8), solidMat('#2a2a2a', { rough: .4 })); lead.position.y = len / 2 + .29; g.add(lead);
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(.095, .095, .22, 16), solidMat('#b8b8b0', { rough: .3, metal: .9 })); ferrule.position.y = -len / 2 - .11; g.add(ferrule);
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .2, 16), solidMat('#e98a8a', { rough: .9 })); eraser.position.y = -len / 2 - .31; g.add(eraser);
  g.rotation.z = -Math.PI / 2; const w = new THREE.Group(); w.add(g); w.position.z = .1; return kind(shadowed(w), 'pencil');
}
// picture frame: returns a group; put content at frame.userData.inner (z just in front of the back)
export function frame(w = 3, h = 4, o = {}) {
  const { color = '#b8873a', depth = .22, bar = .32, style = 'gilt' } = o, g = new THREE.Group();
  const mat = style === 'gilt' ? solidMat(color, { rough: .35, metal: .75 }) : solidMat(color, { rough: .7 });
  const inner = solidMat(style === 'gilt' ? '#7a5a26' : '#2b2118', { rough: .6, metal: style === 'gilt' ? .5 : 0 });
  const mk = (bw, bh, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, depth), mat); m.position.set(x, y, depth / 2); g.add(m);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(bw * (bw > bh ? 1 : .35), bh * (bh > bw ? 1 : .35), depth * .5), inner); lip.position.set(x + (bw > bh ? 0 : Math.sign(-x) * bw * .3), y + (bh > bw ? 0 : Math.sign(-y) * bh * .3), depth * 1.02); g.add(lip); };
  mk(w + bar * 2, bar, 0, h / 2 + bar / 2); mk(w + bar * 2, bar, 0, -h / 2 - bar / 2); mk(bar, h, -w / 2 - bar / 2, 0); mk(bar, h, w / 2 + bar / 2, 0);
  g.userData.inner = new THREE.Vector3(0, 0, .03); g.userData.size = [w + bar * 2, h + bar * 2];
  return kind(shadowed(g), 'frame');
}

// ---------- money ----------
function coinFace(label = '1', col = '#caa24a') {
  const S = 512, c = mkCanvas(S, S), x = c.getContext('2d');
  const g = x.createRadialGradient(S * .4, S * .35, 20, S / 2, S / 2, S / 2); g.addColorStop(0, '#fff3c4'); g.addColorStop(.55, col); g.addColorStop(1, '#8a6a22');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(80,55,10,.55)'; x.lineWidth = 10; x.beginPath(); x.arc(S / 2, S / 2, S * .44, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 3; for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2; x.beginPath(); x.moveTo(S / 2 + Math.cos(a) * S * .455, S / 2 + Math.sin(a) * S * .455); x.lineTo(S / 2 + Math.cos(a) * S * .49, S / 2 + Math.sin(a) * S * .49); x.stroke(); }
  x.fillStyle = 'rgba(70,45,5,.7)'; x.font = `900 ${S * .42}px ${FONTS.serif}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, S / 2, S / 2 + 8);
  x.fillStyle = 'rgba(255,245,200,.45)'; x.fillText(label, S / 2 - 5, S / 2 + 3);
  return canvasTex(c);
}
export function coin(o = {}) {
  const { r = .55, t = .09, label = '1', color = '#c9a24a' } = o;
  const face = coinFace(label, color), edge = solidMat('#9c7a2c', { rough: .35, metal: .85 });
  const top = new THREE.MeshStandardMaterial({ map: face, roughness: .32, metalness: .8 }); top.userData.vox = true;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, 48), [edge, top, top]); m.rotation.x = Math.PI / 2; m.position.z = t / 2;
  const g = new THREE.Group(); g.add(m); return kind(shadowed(g), 'coin');
}
export function coinStack(n = 5, o = {}) {
  const g = new THREE.Group(), r = rng(o.seed ?? 3);
  for (let i = 0; i < n; i++) { const c = coin(o); c.position.set((r() - .5) * .06, (r() - .5) * .06, i * (o.t ?? .09) * 1.02); c.rotation.z = r() * 6.3; g.add(c); }
  g.userData.height = n * (o.t ?? .09); return kind(g, 'coins');
}
// a generic stylised banknote (clearly an illustration, not a replica of any currency)
export function billCanvas(value = 100, o = {}) {
  const { ink = '#2f4a3a', paper = '#dfe6d2' } = o, w = 1024, h = 440, c = mkCanvas(w, h), x = c.getContext('2d');
  x.fillStyle = x.createPattern(paperCanvas(paper, { grain: .7 }), 'repeat'); x.fillRect(0, 0, w, h);
  x.strokeStyle = ink; x.globalAlpha = .9; x.lineWidth = 6; x.strokeRect(18, 18, w - 36, h - 36); x.lineWidth = 2; x.strokeRect(34, 34, w - 68, h - 68);
  x.globalAlpha = .35; x.lineWidth = 1.2;                                           // guilloche rosettes
  for (const cx of [w * .2, w * .8]) for (let k = 0; k < 36; k++) { x.beginPath(); for (let a = 0; a <= 6.3; a += .05) { const rr = 70 + 18 * Math.sin(a * 7 + k * .17); const px = cx + Math.cos(a + k * .09) * rr, py = h / 2 + Math.sin(a + k * .09) * rr * .8; a ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
  x.globalAlpha = 1; x.fillStyle = paper; x.beginPath(); x.ellipse(w / 2, h / 2, 118, 150, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = ink; x.lineWidth = 4; x.stroke();
  x.fillStyle = ink; x.globalAlpha = .75;                                           // engraved bust silhouette
  x.beginPath(); x.arc(w / 2, h / 2 - 28, 46, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(w / 2, h / 2 + 92, 86, 70, 0, Math.PI, 0); x.fill();
  x.globalAlpha = .3; x.strokeStyle = paper; for (let yy = h / 2 - 90; yy < h / 2 + 150; yy += 6) { x.beginPath(); x.moveTo(w / 2 - 110, yy); x.lineTo(w / 2 + 110, yy + 3); x.stroke(); }
  x.globalAlpha = 1; x.fillStyle = ink; x.font = `900 ${96}px ${FONTS.serif}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(String(value), 110, 100); x.fillText(String(value), w - 110, h - 90);
  x.font = `700 ${34}px ${FONTS.garamond}`; x.fillText(o.title || 'ONE HUNDRED', w * .76, 98); x.font = `400 ${22}px ${FONTS.garamond}`; x.fillText('LEGAL TENDER FOR ALL DEBTS', w * .27, h - 70);
  return c;
}
export function bill(value = 100, o = {}) {
  const w = o.w ?? 3.4, h = w * 440 / 1024, cv = billCanvas(value, o);
  const m = card({ w, h, curl: o.curl ?? .06, color: '#dfe6d2', draw: (x, W2, H2) => x.drawImage(cv, 0, 0, W2, H2), rough: .8, kind: 'bill' });
  return m;
}
export function billStack(n = 20, value = 100, o = {}) {
  const w = o.w ?? 3.2, h = w * 440 / 1024, g = new THREE.Group(), th = .012;
  const side = solidMat('#cfd8c3', { rough: .9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w * .995, h * .995, n * th), side); body.position.z = n * th / 2; g.add(body);
  const top = bill(value, { ...o, w, curl: 0 }); top.position.z = n * th + .003; g.add(top);
  const band = new THREE.Mesh(new THREE.BoxGeometry(w * .16, h * 1.02, n * th + .01), solidMat(o.band ?? '#d9c7a0', { rough: .8 })); band.position.z = n * th / 2 + .002; g.add(band);
  g.userData.height = n * th; return kind(shadowed(g), 'bills');
}
// desk flip-calendar page: big label on a ring-bound card
export function calendarPage(big, small = 'YEARS', o = {}) {
  const w = o.w ?? 3.2, h = o.h ?? 3.6;
  return card({ w, h, color: C.light, kind: 'calendar', draw: (x, W2, H2) => {
    x.fillStyle = o.band ?? C.accent2; x.fillRect(0, 0, W2, H2 * .2);
    x.fillStyle = C.light; x.font = `700 ${H2 * .085}px ${FONTS.condensed}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(small, W2 / 2, H2 * .11);
    x.fillStyle = C.ink; x.font = `${o.weight ?? 400} ${H2 * .55}px ${FONTS[o.font ?? 'gothic']}`; x.fillText(String(big), W2 / 2, H2 * .6);
    x.fillStyle = '#9a968f'; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(W2 * (.18 + i * .128), H2 * .035, W2 * .02, 0, Math.PI * 2); x.fill(); }
  } });
}

// ---------- keys & typewriter ----------
function letterTex(ch, o = {}) {
  const S = 256, c = mkCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = o.bg ?? '#f1ece0'; x.fillRect(0, 0, S, S);
  if (o.ring) { x.strokeStyle = o.ring; x.lineWidth = 16; x.beginPath(); x.arc(S / 2, S / 2, S * .44, 0, Math.PI * 2); x.stroke(); }
  x.fillStyle = o.color ?? '#1b1a17'; x.font = `${o.weight ?? 700} ${S * (o.size ?? .5)}px ${FONTS[o.font ?? 'sans']}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, S / 2, S / 2 + S * .03);
  return canvasTex(c);
}
function roundedBox(w, h, d, r) {
  const s = new THREE.Shape(); s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: r * .6, bevelSize: r * .5, bevelSegments: 4, curveSegments: 6 }); return g;
}
// modern keycap, top faces the camera (z). press(k 0..1) pushes it down.
export function keycap(ch, o = {}) {
  const s = o.size ?? 1, g = new THREE.Group();
  const body = new THREE.Mesh(roundedBox(s * .9, s * .9, s * .32, s * .14), solidMat(o.color ?? '#efece6', { rough: .45 }));
  const topM = new THREE.MeshStandardMaterial({ map: letterTex(ch, { bg: o.color ?? '#efece6', color: o.ink ?? '#26241f', font: 'sans', weight: 600, size: .46 }), roughness: .5 }); topM.userData.vox = true;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(s * .74, s * .74), topM); top.position.z = s * .32 + s * .085;
  g.add(body, top); g.userData.letter = ch; g.userData.press = k => { g.position.z = (g.userData.z0 ?? 0) - k * s * .14; };
  return kind(shadowed(g), 'key');
}
export function keyRow(letters, o = {}) {
  const g = new THREE.Group(), s = o.size ?? 1, gap = o.gap ?? .1; const keys = {};
  [...letters].forEach((ch, i) => { const k = keycap(ch, o); k.position.x = (i - (letters.length - 1) / 2) * (s + gap); g.add(k); keys[ch] = k; });
  g.userData.keys = keys; return kind(g, 'keys');
}
// A stylised 1870s typewriter (Y-up model; wrap with upright()). Handles: userData.keys[letter], userData.arms[],
// userData.sheet (paper card on the platen), userData.pressKey(letter, k), userData.armUp(i, k)
export function typewriter(o = {}) {
  const g = new THREE.Group(), body = solidMat('#1c1a17', { rough: .38, metal: .3 }), gold = solidMat('#c8a14a', { rough: .3, metal: .9 }), steel = solidMat('#a9a9a4', { rough: .3, metal: .95 });
  const base = new THREE.Mesh(roundedBox(6.4, 3.4, .5, .18), body); base.rotation.x = -Math.PI / 2; base.position.set(0, 0, 1.7); g.add(base);
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(.35, 2.2, 3.2), body); frameL.position.set(-3, 1.2, -.1); g.add(frameL);
  const frameR = frameL.clone(); frameR.position.x = 3; g.add(frameR);
  const plateC = mkCanvas(1024, 160), px = plateC.getContext('2d'); px.fillStyle = '#1c1a17'; px.fillRect(0, 0, 1024, 160);
  px.strokeStyle = '#c8a14a'; px.lineWidth = 5; px.strokeRect(14, 14, 996, 132); px.fillStyle = '#d8b35a'; px.font = `700 70px ${FONTS.garamond}`; px.textAlign = 'center'; px.textBaseline = 'middle'; px.fillText(o.label ?? 'TYPE-WRITER', 512, 84);
  const plateM = new THREE.MeshStandardMaterial({ map: canvasTex(plateC), roughness: .4, metalness: .2 }); plateM.userData.vox = true;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(5.6, .88), plateM); plate.position.set(0, .56, 1.72); g.add(plate);
  const front = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1, .3), body); front.position.set(0, .5, 1.5); g.add(front);
  // keys: 3 staggered rows of round keys on stalks
  const rows = o.rows ?? ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'], keys = {};
  rows.forEach((row, ri) => [...row].forEach((ch, i) => {
    const back = rows.length - 1 - ri, k = new THREE.Group(), x0 = (i - (row.length - 1) / 2) * .56 + ri * .12, z0 = 1.05 - back * .55, y0 = .95 + back * .22;   // QWERTY is the back (top) row
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .5, 8), steel); stalk.position.y = -.25; k.add(stalk);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(.23, .23, .07, 28), steel); k.add(rim);
    const capM = new THREE.MeshStandardMaterial({ map: letterTex(ch, { bg: '#f3eee2', color: '#1a1814', font: 'garamond', weight: 700, size: .62, ring: '#2a2622' }), roughness: .35 }); capM.userData.vox = true;
    const cap = new THREE.Mesh(new THREE.CircleGeometry(.2, 28), capM); cap.rotation.x = -Math.PI / 2; cap.position.y = .037; k.add(cap);
    k.position.set(x0, y0, z0); k.userData.y0 = y0; g.add(k); keys[ch] = k;
  }));
  // type-bar basket: arms fanning to the printing point under the platen
  const arms = [], N = o.arms ?? 26, pivotY = 1.1, printPt = new THREE.Vector3(0, 2.05, -.55);
  for (let i = 0; i < N; i++) {
    const a = (i / (N - 1) - .5) * Math.PI * .92, rad = 2.1;
    const base = new THREE.Vector3(Math.sin(a) * rad, pivotY, -.55 - Math.cos(a) * .2 + .2);
    const arm = new THREE.Group(); arm.position.copy(base);
    const len = base.distanceTo(new THREE.Vector3(0, pivotY, -.55)) * .98;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(.05, .03, len), steel); bar.position.z = len / 2; arm.add(bar);
    const slug = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .1), gold); slug.position.z = len; arm.add(slug);
    arm.lookAt(0, pivotY, -.55);
    arm.userData.rest = arm.quaternion.clone();
    const up = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), printPt.clone().sub(base).normalize());
    arm.userData.up = up; g.add(arm); arms.push(arm);
  }
  // platen + carriage + paper
  const platen = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, 5.6, 32), solidMat('#141312', { rough: .7 })); platen.rotation.z = Math.PI / 2; platen.position.set(0, 2.25, -.9); g.add(platen);
  for (const s2 of [-1, 1]) { const knob = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .3, 24), gold); knob.rotation.z = Math.PI / 2; knob.position.set(s2 * 3.05, 2.25, -.9); g.add(knob); }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(6.3, .12, .12), steel); rail.position.set(0, 2.62, -1.25); g.add(rail);
  if (o.sheet !== false) {
    const sheet = card({ w: 3.4, h: 3.2, color: '#f6f1e3', dynamic: !!o.typed, draw: o.typed, kind: 'paper' }); sheet.position.set(0, 3.55, -.75); sheet.rotation.x = .55; g.add(sheet); g.userData.sheet = sheet;   // leans back toward the typist
  }
  g.userData.keys = keys; g.userData.arms = arms;
  g.userData.pressKey = (ch, k) => { const key = keys[ch]; if (key) key.position.y = key.userData.y0 - .16 * k; };
  g.userData.armUp = (i, k) => { const arm = arms[i]; if (arm) arm.quaternion.copy(arm.userData.rest).slerp(arm.userData.up, k); };
  return kind(shadowed(g), 'typewriter');
}

// ---------- science / diagram illustrations (drawn cards and cut-outs) ----------
// sun: warm disc with soft corona (cut-out sticker) - pair with rays drawn as scribbles or a card
export function sun(o = {}) {
  const d = o.d ?? 3;
  return cutout({ w: d, h: d, border: o.border ?? .08, grain: .3, kind: 'sun', draw: (x, W2, H2) => {
    const g = x.createRadialGradient(W2 * .42, H2 * .4, W2 * .05, W2 / 2, H2 / 2, W2 * .48);
    g.addColorStop(0, '#fff6c9'); g.addColorStop(.55, o.color ?? '#ffc53a'); g.addColorStop(1, o.edge ?? '#f08a1c');
    x.fillStyle = g; x.beginPath(); x.arc(W2 / 2, H2 / 2, W2 * .47, 0, Math.PI * 2); x.fill();
  } });
}
// wave card: a sine wave line (blue short / red long wavelengths) that can travel with t
export function waveCard(o = {}) {
  const { w = 7, h = 1.6, color = '#2c6bd6', wavelength = 1, amp = .55, lineW = .09, label, travel = 1.2, at = 0, bg = null } = o;
  return card({ w, h, bg: !!bg, color: bg || C.paper, dynamic: true, kind: 'wave', draw: (x, W2, H2, t, r) => {
    const draw = clamp((t - at) / .8); if (draw <= 0) return;
    x.strokeStyle = color; x.lineWidth = lineW * r; x.lineCap = 'round'; x.beginPath();
    const ph = (t - at) * travel * Math.PI * 2, n = 240;
    for (let i = 0; i <= n * draw; i++) { const u = i / n, px = u * W2 * .96 + W2 * .02, py = H2 / 2 + Math.sin(u * (W2 / r) / wavelength * Math.PI * 2 - ph) * amp * H2 * .45; i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke();
    if (label) { x.fillStyle = color; x.font = `700 ${H2 * .22}px ${FONTS.condensed}`; x.textAlign = 'right'; x.fillText(label, W2 * .97, H2 * .2); }
  } });
}
// small gas molecule (two bonded atoms, glossy)
export function molecule(o = {}) {
  const g = new THREE.Group(), r = o.r ?? .22, m = solidMat(o.color ?? '#8fb3de', { rough: .25 });
  const a = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), m), b = a.clone(); a.position.x = -r * .8; b.position.x = r * .8; g.add(a, b);
  g.rotation.z = o.rot ?? 0; return kind(shadowed(g), 'molecule');
}
// atmosphere arc: the curved edge of the Earth with a glowing blue layer (card, transparent outside the arc)
export function atmosphere(o = {}) {
  const w = o.w ?? 9.5, h = o.h ?? 4;
  return card({ w, h, bg: false, kind: 'atmosphere', draw: (x, W2, H2) => {
    const R = W2 * 1.6, cx = W2 / 2, cy = H2 + R * .82;
    const air = x.createRadialGradient(cx, cy, R * .99, cx, cy, R * 1.12); air.addColorStop(0, o.air ?? 'rgba(90,160,235,.95)'); air.addColorStop(1, 'rgba(120,180,240,0)');
    x.fillStyle = air; x.beginPath(); x.arc(cx, cy, R * 1.12, 0, Math.PI * 2); x.fill();
    x.fillStyle = x.createPattern(paperCanvas(o.land ?? '#3f7c5a'), 'repeat'); x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = W2 * .004; x.beginPath(); x.arc(cx, cy, R, Math.PI * 1.2, Math.PI * 1.8); x.stroke();
  } });
}
// simple person pictogram (the viewer, "you")
export function person(o = {}) {
  const h = o.h ?? 2.4;
  return cutout({ w: h * .45, h, border: .07, grain: .3, kind: 'person', draw: (x, W2, H2) => {
    x.fillStyle = o.color ?? C.ink; x.beginPath(); x.arc(W2 / 2, H2 * .13, W2 * .2, 0, Math.PI * 2); x.fill();
    rrect(x, W2 * .18, H2 * .29, W2 * .64, H2 * .38, W2 * .18); x.fill(); x.fillRect(W2 * .26, H2 * .6, W2 * .2, H2 * .38); x.fillRect(W2 * .54, H2 * .6, W2 * .2, H2 * .38);
  } });
}
// engraving-style portrait placeholder: an anonymous bust in an oval (for "a person from history" without a photo)
export function engraving(o = {}) {
  const w = o.w ?? 2.6, h = o.h ?? 3.2;
  return card({ w, h, color: o.paper ?? '#efe4c8', kind: 'portrait', draw: (x, W2, H2) => {
    const ink = o.ink ?? '#2b2016'; x.strokeStyle = ink; x.lineWidth = W2 * .012; x.beginPath(); x.ellipse(W2 / 2, H2 * .46, W2 * .4, H2 * .38, 0, 0, Math.PI * 2); x.stroke();
    x.save(); x.beginPath(); x.ellipse(W2 / 2, H2 * .46, W2 * .38, H2 * .36, 0, 0, Math.PI * 2); x.clip();
    for (let y = 0; y < H2; y += W2 * .018) { x.globalAlpha = .28; x.beginPath(); x.moveTo(0, y); x.lineTo(W2, y + W2 * .02); x.stroke(); }
    x.globalAlpha = 1; x.fillStyle = ink;
    x.beginPath(); x.ellipse(W2 / 2, H2 * .36, W2 * .14, H2 * .13, 0, 0, Math.PI * 2); x.fill();                      // head
    x.beginPath(); x.ellipse(W2 / 2, H2 * .47, W2 * .1, H2 * .07, 0, 0, Math.PI); x.fill();                            // beard
    x.beginPath(); x.ellipse(W2 / 2, H2 * .8, W2 * .34, H2 * .26, 0, Math.PI, 0); x.fill();                           // shoulders
    x.fillStyle = o.paper ?? '#efe4c8'; x.beginPath(); x.moveTo(W2 * .45, H2 * .56); x.lineTo(W2 / 2, H2 * .7); x.lineTo(W2 * .55, H2 * .56); x.fill();   // collar
    x.restore();
    if (o.label) { x.fillStyle = ink; x.font = `700 ${H2 * .055}px ${FONTS.garamond}`; x.textAlign = 'center'; x.fillText(o.label, W2 / 2, H2 * .93); }
  } });
}
// rainbow spectrum strip (sunlight holds every colour)
export function spectrum(o = {}) {
  const w = o.w ?? 6, h = o.h ?? .9;
  return card({ w, h, kind: 'spectrum', draw: (x, W2, H2) => {
    const cols = ['#7b2fbf', '#3d5bd9', '#2aa7de', '#3dbb5c', '#f2d027', '#f28a1c', '#e0322a'];
    const g = x.createLinearGradient(0, 0, W2, 0); cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c)); x.fillStyle = g; x.fillRect(0, 0, W2, H2);
  } });
}
export { easeOut, easeInOut, lerp };

// Type-bar basket seen from above: a fan of steel arms around a semicircle, each with a key letter at its base.
// userData.fire(i, k): arm i swings in toward the strike point (k 0..1). Two arms firing together collide = a jam.
export function typeBasket(o = {}) {
  const g = new THREE.Group(), N = o.arms ?? 17, R = o.r ?? 3.4, letters = o.letters ?? 'QWERTYUIOPASDFGHJ';
  const steel = solidMat('#b9b8b2', { rough: .28, metal: .95 }), gold = solidMat('#c8a14a', { rough: .3, metal: .9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + .35, .07, 10, 90, Math.PI), solidMat('#2a2622', { rough: .45, metal: .4 })); ring.rotation.z = Math.PI; ring.position.z = .05; g.add(ring);
  const strike = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .1, 28), gold); strike.rotation.x = Math.PI / 2; strike.position.set(0, 0, .06); g.add(strike);
  const arms = [];
  for (let i = 0; i < N; i++) {
    const a = Math.PI + (i + .5) / N * Math.PI, bx = Math.cos(a) * R, by = Math.sin(a) * R;       // base on the lower half-circle
    const pivot = new THREE.Group(); pivot.position.set(bx, by, .1);
    const len = R * .62, bar = new THREE.Mesh(new THREE.BoxGeometry(len, .07, .05), steel); bar.position.x = len / 2; pivot.add(bar);
    const slug = new THREE.Mesh(new THREE.BoxGeometry(.2, .14, .09), gold); slug.position.x = len; pivot.add(slug);
    const home = Math.atan2(-by, -bx);                                                          // pointing at the centre
    pivot.rotation.z = home; pivot.userData = { home, rest: home, len };                          // rest: pointing at the strike point, retracted
    const key = new THREE.Mesh(new THREE.CircleGeometry(.26, 24), (() => { const m = new THREE.MeshStandardMaterial({ map: (() => { const c = mkCanvas(128, 128), x = c.getContext('2d'); x.fillStyle = '#f3eee2'; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill(); x.strokeStyle = '#2a2622'; x.lineWidth = 8; x.stroke(); x.fillStyle = '#1a1814'; x.font = `700 70px ${FONTS.garamond}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(letters[i] || '', 64, 70); return canvasTex(c); })(), roughness: .4 }); m.userData.vox = true; return m; })());
    key.position.set(bx * 1.2, by * 1.2, .12); g.add(key);
    g.add(pivot); arms.push(pivot);
  }
  g.userData.arms = arms;
  // k 0..1: swing toward the strike point; the tip reaches the centre at k = 1 (bar length is scaled to arrive)
  // k 0..1: the arm extends from its rest length to the strike point; skew (radians) lets two arms cross when they jam
  g.userData.fire = (i, k, skew = 0) => { const p = arms[i]; if (!p) return; const e = clamp(k), L = p.userData.len * (.55 + e * (R * 1.02 / p.userData.len - .55));
    p.rotation.z = p.userData.home + skew * e; p.children[0].scale.x = L / p.userData.len; p.children[0].position.x = L / 2; p.children[1].position.x = L; p.position.z = .1 + e * .14; };
  arms.forEach((_, i) => g.userData.fire(i, 0));
  return kind(shadowed(g), 'typebars');
}
