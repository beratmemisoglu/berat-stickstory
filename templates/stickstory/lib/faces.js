// Stick stories - FACES: cream flat feature shapes on the black head disc, measured on the references
// (experiments/stickstory-style/analysis/characters/NOTES.md sections 4-5). The face is a set of decals on a sphere:
// every feature has a front-view anchor (D units, head centre = 0, +y up) and is projected orthographically for the head's
// yaw (turn) and pitch (nod), so a 3/4 view slides the face across the disc and narrows the far eye (x = .5 sin(yaw + phi)).
// Expressions are parameters, not images: eyes, brows, mouth and extras are separate parts that swap instantly (the
// references never tween a swap), blink (3 closed frames, timed by the animator), talk (the O ring, open 0..1) and mix
// (the slow 3-8 frame crossfades) are numbers given each frame by Figure.setFace().
//
//   EXPRESSIONS / expressions()   the catalogue (neutral, happy, smile, grin, shock, scared, sad, cry, angry, smug, ...)
//   PARTS                         the part kinds (eyes, brows, mouths, extras) for custom faces: { eyes: 'dot', mouth: 'wavy' }
//   new Face(look)                used by rig.js Figure (root goes into the head; set(face, view) every frame)
//   project(x, y, yaw, pitch)     the sphere projection (rig.js uses it for hair, hats, ear items)
import { THREE, Z, mat, rrect, ellipse, circle, ring, stroke, poly, text, glow, clamp, lerp, DEG, mixHex } from './core.js';

export const FACE_COL = {
  feature: '#fdefdb', worried: '#d8cdc0', tear: '#add9fb', tearNight: '#8b99b0', tired: '#68657f', teary: '#6c7485',
  glass: '#eaebf2', glassRef: '#919aa9', glint: '#a7a3b6', ha: '#2a2230', haText: '#fdefdb', sparkle: '#ffffff', glowEye: '#ff9a3c',
  clip: '#26c8be', clipLine: '#11817a', clipHi: '#a8f3ea', slick: '#6f5d55', curl: '#8a6b55', bald: '#2c2733',
  stacheBrown: '#7a5a44', stacheBrownLine: '#553c2c', stacheWhite: '#f1ede6',
};
// front-view anchors in D (measured: eyes x +-.16 y +.05 down, mouth .30 down, brows .18 above the eyes)
export const ANCHOR = { eyeX: .16, eyeY: -.05, mouthY: -.30, browUp: .18 };
const PI = Math.PI;

// ---------- geometry (unit D = 1; shared and cached) ----------
const GC = new Map();
const G = (key, make) => { let g = GC.get(key); if (!g) { g = make(); g.userData.shared = true; GC.set(key, g); } return g; };
const M = (g, m, o = {}) => { const x = new THREE.Mesh(g, m); if (o.at) x.position.set(o.at[0], o.at[1], o.at[2] ?? 0); if (o.rot) x.rotation.z = o.rot; x.userData.noPick = true; return x; };
const grp = (...k) => { const g = new THREE.Group(); k.flat().filter(Boolean).forEach(c => g.add(c)); return g; };
/** a parabola arc through (-w/2, 0), (0, h), (w/2, 0) (h < 0: a cup) */
const arc = (w, h, n = 14) => { const p = []; for (let i = 0; i <= n; i++) { const x = -w / 2 + w * i / n; p.push([x, h * (1 - (2 * x / w) ** 2)]); } return p; };
/** a thick round-capped line through pts (cached by key) */
const line = (key, pts, w) => stroke(pts, w, '#ffffff', { key: 'face|' + key }).geometry;
/** an elliptical ring (stroke s) as one shape with a hole */
export function ellRingGeo(w, h, s) {
  return G(`ering|${w.toFixed(3)}|${h.toFixed(3)}|${s.toFixed(3)}`, () => {
    const n = 56, sh = new THREE.Shape(), ho = new THREE.Path(), a = w / 2, b = h / 2, ia = Math.max(.002, a - s), ib = Math.max(.002, b - s);
    for (let i = 0; i <= n; i++) { const t = 2 * PI * i / n; i ? sh.lineTo(Math.cos(t) * a, Math.sin(t) * b) : sh.moveTo(a, 0); }
    for (let i = 0; i <= n; i++) { const t = -2 * PI * i / n; i ? ho.lineTo(Math.cos(t) * ia, Math.sin(t) * ib) : ho.moveTo(ia, 0); }
    sh.holes.push(ho); return new THREE.ShapeGeometry(sh);
  });
}
/** a rounded-rectangle ring (square glasses) */
function rrRingGeo(w, h, r, s) {
  return G(`rring|${w}|${h}|${r}|${s}`, () => {
    const rr = (P, W, H, R, rev) => { const x = -W / 2, y = -H / 2; const pts = [[x + R, y], [x + W - R, y], [x + W, y, x + W, y + R], [x + W, y + H - R], [x + W, y + H, x + W - R, y + H], [x + R, y + H], [x, y + H, x, y + H - R], [x, y + R], [x, y, x + R, y]];
      if (rev) { P.moveTo(x + R, y); P.quadraticCurveTo(x, y, x, y + R); P.lineTo(x, y + H - R); P.quadraticCurveTo(x, y + H, x + R, y + H); P.lineTo(x + W - R, y + H); P.quadraticCurveTo(x + W, y + H, x + W, y + H - R); P.lineTo(x + W, y + R); P.quadraticCurveTo(x + W, y, x + W - R, y); P.lineTo(x + R, y); return; }
      P.moveTo(pts[0][0], pts[0][1]); P.lineTo(pts[1][0], pts[1][1]); P.quadraticCurveTo(...pts[2]); P.lineTo(...pts[3]); P.quadraticCurveTo(...pts[4]); P.lineTo(...pts[5]); P.quadraticCurveTo(...pts[6]); P.lineTo(...pts[7]); P.quadraticCurveTo(...pts[8]); };
    const sh = new THREE.Shape(); rr(sh, w, h, r); const ho = new THREE.Path(); rr(ho, w - 2 * s, h - 2 * s, Math.max(.005, r - s), true); sh.holes.push(ho);
    return new THREE.ShapeGeometry(sh, 6);
  });
}
const teardropGeo = (w, h) => G(`tear|${w}|${h}`, () => { const s = new THREE.Shape(), r = w / 2; s.moveTo(0, h - r); s.quadraticCurveTo(r * .55, h * .35, r, 0); s.absarc(0, 0, r, 0, -PI, true); s.quadraticCurveTo(-r * .55, h * .35, 0, h - r); return new THREE.ShapeGeometry(s, 10); });
const starGeo = (r, k = .22) => G(`star4|${r}|${k}`, () => { const s = new THREE.Shape(); for (let i = 0; i <= 8; i++) { const a = PI / 2 + i * PI / 4, rr = i % 2 ? r * k : r; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return new THREE.ShapeGeometry(s); });
const heartGeo = r => G(`heart|${r}`, () => { const s = new THREE.Shape(); s.moveTo(0, -r); s.bezierCurveTo(r * 1.3, -r * .1, r * .9, r * 1.05, 0, r * .45); s.bezierCurveTo(-r * .9, r * 1.05, -r * 1.3, -r * .1, 0, -r); return new THREE.ShapeGeometry(s, 10); });
const burstGeo = (r0, r1, n) => G(`burst|${r0}|${r1}|${n}`, () => { const s = new THREE.Shape(); for (let i = 0; i <= n * 2; i++) { const a = i * PI / n, r = i % 2 ? r0 : r1 * (1 - .12 * ((i * 7) % 3) / 2); i ? s.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * .8) : s.moveTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * .8); } return new THREE.ShapeGeometry(s); });
const unitRect = () => G('urect', () => { const g = new THREE.PlaneGeometry(1, 1); g.translate(.5, 0, 0); return g; });

// ---------- the part kinds (built at unit D for the RIGHT side: x > 0; the left side mirrors) ----------
// each: build(m) -> Object3D, hw/hh half extents (for keeping it inside the disc), look(o, lx, ly) moves pupils
const EYES = {
  half: { hw: .12, hh: .06, build: m => { const g = grp(M(rrect(.235, .05, .025).geometry, m, { rot: 3 * DEG }), M(ellipse(.058, .058, '#fff', { arc: [PI, 2 * PI] }).geometry, m)); g.userData.pupil = g.children[1]; return g; },
    look: (o, lx) => { o.userData.pupil.position.x = clamp(lx, -1, 1) * .052; } },
  dot: { hw: .065, hh: .065, build: m => { const g = grp(M(circle(.06).geometry, m)); g.userData.pupil = g.children[0]; return g; }, look: (o, lx, ly) => o.userData.pupil.position.set(lx * .03, ly * .03, 0) },
  big: { hw: .08, hh: .08, build: m => { const g = grp(M(circle(.075).geometry, m)); g.userData.pupil = g.children[0]; return g; }, look: (o, lx, ly) => o.userData.pupil.position.set(lx * .03, ly * .03, 0) },
  ring: { hw: .12, hh: .12, build: m => { const g = grp(M(ring(.069, .116).geometry, m), M(circle(.034).geometry, m)); g.userData.pupil = g.children[1]; return g; }, look: (o, lx, ly) => o.userData.pupil.position.set(clamp(lx, -1, 1) * .042, clamp(ly, -1, 1) * .042, 0) },
  happy: { hw: .095, hh: .055, build: m => grp(M(line('happy', arc(.13, .06).map(([x, y]) => [x, y - .02]), .046), m)) },
  laugh: { hw: .09, hh: .06, build: m => { const p = []; for (let i = 0; i <= 14; i++) { const a = PI * 1.12 - i / 14 * PI * 1.24; p.push([Math.cos(a) * .055, Math.sin(a) * .055 - .015]); } return grp(M(line('laugh', p, .046), m)); } },
  closed: { hw: .095, hh: .03, build: m => grp(M(rrect(.185, .055, .0275).geometry, m)) },
  closedDown: { hw: .085, hh: .04, build: m => grp(M(line('cdown', arc(.13, -.045).map(([x, y]) => [x, y + .02]), .045), m)) },
  squeeze: { hw: .1, hh: .1, build: m => grp(M(line('squeeze', [[.05, .068], [-.055, 0], [.05, -.068]], .05), m)) },
  bars: { hw: .03, hh: .085, build: m => grp(M(rrect(.05, .16, .025).geometry, m)) },
  glow: { hw: .12, hh: .06, build: m => EYES.half.build(m), look: (o, lx) => EYES.half.look(o, lx) },
  none: null,
};
const BROW = (h = .018) => m => grp(M(line('brow' + h, arc(.19, h), .05), m));
const BROWS = { brow: { hw: .115, hh: .04, build: BROW() }, arched: { hw: .115, hh: .05, build: BROW(.04) }, none: null };
// brow presets: tilt in degrees (+ = inner end up), dy (D), shape
export const BROW_KINDS = {
  sad: { tilt: 20, dy: 0, shape: 'brow' }, worried: { tilt: 16, dy: .01, shape: 'brow' }, angry: { tilt: -23, dy: -.025, shape: 'brow' },
  mild: { tilt: -12, dy: -.012, shape: 'brow' }, raised: { tilt: 5, dy: .03, shape: 'arched' }, lifted: { tilt: 13, dy: .012, shape: 'brow' }, flat: { tilt: 0, dy: 0, shape: 'brow' },
  up: { tilt: 0, dy: .05, shape: 'arched' },
};
const MOUTHS = {
  line: { hw: .14, hh: .02, build: m => grp(M(rrect(.28, .04, .02).geometry, m)) },
  short: { hw: .085, hh: .02, build: m => grp(M(rrect(.17, .04, .02).geometry, m)) },
  smile: { hw: .145, hh: .045, build: m => grp(M(line('smile', arc(.25, -.05).map(([x, y]) => [x, y + .025]), .042), m)) },
  smileSmall: { hw: .09, hh: .035, build: m => grp(M(line('smiles', arc(.15, -.032).map(([x, y]) => [x, y + .016]), .04), m)) },
  smileBig: { hw: .17, hh: .06, build: m => grp(M(line('smileb', arc(.3, -.075).map(([x, y]) => [x, y + .035]), .045), m)) },
  smirk: { hw: .16, hh: .07, build: m => grp(M(line('smile', arc(.25, -.05).map(([x, y]) => [x, y + .025]), .042), m, { rot: 15 * DEG, at: [.035, .005] })) },
  smirkSide: { hw: .15, hh: .06, build: m => grp(M(line('smirkside', [[-.125, .005], [-.04, -.012], [.03, -.012], [.09, .012], [.125, .05]], .042), m)) },
  grin: { hw: .19, hh: .06, build: m => { const s = new THREE.Shape(); s.moveTo(-.17, .05); s.quadraticCurveTo(0, -.03, .17, .05); s.quadraticCurveTo(.1, -.1, 0, -.085); s.quadraticCurveTo(-.1, -.1, -.17, .05);
    return grp(M(G('grin2', () => new THREE.ShapeGeometry(s, 16)), m, { rot: 6 * DEG }), M(circle(.016).geometry, m, { at: [-.168, .045] }), M(circle(.016).geometry, m, { at: [.168, .068] })); } },
  o: { hw: .12, hh: .11, build: m => grp(M(ellRingGeo(.24, .22, .045), m)) },
  O: { hw: .1, hh: .15, build: m => grp(M(ellRingGeo(.2, .3, .046), m)) },
  oSmall: { hw: .1, hh: .06, build: m => grp(M(ellRingGeo(.2, .12, .04), m)) },
  oTiny: { hw: .065, hh: .05, build: m => grp(M(ellRingGeo(.13, .1, .036), m)) },
  frown: { hw: .125, hh: .04, build: m => grp(M(line('frown', arc(.21, .045).map(([x, y]) => [x, y - .022]), .042), m)) },
  wavy: { hw: .13, hh: .04, build: m => { const p = []; for (let i = 0; i <= 24; i++) { const x = -.105 + .21 * i / 24; p.push([x, .022 * Math.sin(2 * PI * 1.5 * i / 24)]); } return grp(M(line('wavy', p, .04), m)); } },
  grimace: { hw: .18, hh: .11, build: m => grp(M(line('grimA', arc(.22, .085).map(([x, y]) => [x, y + .0]), .046), m), M(rrect(.35, .042, .021).geometry, m, { at: [0, -.075] })) },
  grimaceB: { hw: .18, hh: .1, build: m => { const p = []; for (let i = 0; i <= 20; i++) { const a = PI - i / 20 * PI; p.push([Math.cos(a) * .155, Math.sin(a) * .1 - .035]); } return grp(M(line('grimB', p, .045), m), M(rrect(.37, .045, .0225).geometry, m, { at: [0, -.04] })); } },
  talk: { hw: .13, hh: .14, build: m => { const g = grp(M(ellRingGeo(.25, .12, .045), m)); g.userData.ring = g.children[0]; return g; } },
  none: null,
};
export const PARTS = { eyes: Object.keys(EYES).filter(k => EYES[k]), brows: Object.keys(BROW_KINDS), mouths: Object.keys(MOUTHS).filter(k => MOUTHS[k] && k !== 'talk'),
  extras: ['tears', 'tearL', 'tearR', 'streams', 'streamL', 'streamR', 'underTired', 'underTeary', 'underGrey', 'sweat', 'sparkle', 'glint', 'ha', 'hearts', 'glowEyes'] };

// ---------- the catalogue (names a builder understands; ref counts in analysis/characters/NOTES.md LIBRARY LIST) ----------
// eyes / brows may be one kind or [left, right]; look = pupils; mouthX / mouthRot shift the mouth; eyeColor 'worried' = greyer cream
export const EXPRESSIONS = {
  neutral: { eyes: 'half', mouth: 'line', desc: 'the default bored half-lid + flat line (most common face)' },
  bored: { eyes: 'half', mouth: 'line', desc: 'same as neutral' },
  oh: { eyes: 'half', mouth: 'o', desc: 'half-lid + O ring: "oh" / unimpressed remark' },
  talk: { eyes: 'half', mouth: 'line', desc: 'neutral, for dialogue (pass talk 0..1 for the O ring)' },
  calm: { eyes: 'closed', mouth: 'line', desc: 'eyes closed, flat mouth' },
  sigh: { eyes: 'closed', mouth: 'oTiny', desc: 'eyes closed + small o' },
  sleepy: { eyes: 'closed', mouth: 'oTiny', desc: 'drowsy: eyes closed, tiny o' },
  tired: { eyes: 'half', brows: 'lifted', mouth: 'line', extras: ['underTired'], desc: 'raised brows, half-lids, purple under-eye arcs' },
  smile: { eyes: 'dot', mouth: 'smile', desc: 'dot eyes + smile (content)' },
  content: { eyes: 'dot', mouth: 'smile', desc: 'same as smile' },
  happy: { eyes: 'happy', mouth: 'smile', desc: '^ ^ + smile' },
  laugh: { eyes: 'happy', mouth: 'o', desc: '^ ^ + O ring (laughing / cheering)' },
  ha: { eyes: 'happy', mouth: 'o', extras: ['ha'], desc: 'laugh with the HA! sticker beside the head' },
  grin: { eyes: 'half', mouth: 'grin', desc: 'half-lid + thick crescent grin' },
  evil: { eyes: 'half', mouth: 'grin', mouthRot: 8, mouthX: .03, desc: 'the mastermind: half-lids + a tilted thick grin (iq500 f12495)' },
  smug: { eyes: 'half', mouth: 'smirk', desc: 'half-lid + tilted smile' },
  smirk: { eyes: 'half', mouth: 'smirkSide', desc: 'half-lid + one-sided smile' },
  scheming: { eyes: 'half', mouth: 'smirk', extras: ['sparkle'], desc: 'smug + a sparkle on one eye' },
  wink: { eyes: ['closed', 'dot'], mouth: 'smile', desc: 'one eye closed, one dot, smile (iq500 f7381)' }, winkHappy: { eyes: ['dot', 'happy'], mouth: 'smile', desc: 'one ^ eye, one dot' },
  love: { eyes: 'happy', mouth: 'smileBig', extras: ['hearts'], desc: '^ ^ + big smile + two small hearts' },
  surprised: { eyes: 'dot', brows: 'raised', mouth: 'oSmall', desc: 'dot eyes + small o' },
  shock: { eyes: 'ring', mouth: 'O', desc: 'ring eyes + tall O (the big shock face)' },
  shocked: { eyes: 'ring', brows: 'raised', mouth: 'O', desc: 'shock with raised brows' },
  scared: { eyes: 'ring', brows: 'worried', mouth: 'wavy', desc: 'ring eyes, worried brows, wavy mouth' },
  panic: { eyes: 'ring', brows: 'worried', mouth: 'wavy', extras: ['glint'], desc: 'scared + the pale head glint' },
  worried: { eyes: 'dot', eyeColor: 'worried', brows: 'sad', mouth: 'line', extras: ['underGrey'], desc: 'sad brows, grey dot eyes, line' },
  nervous: { eyes: 'dot', eyeColor: 'worried', brows: 'sad', mouth: 'wavy', extras: ['sweat'], desc: 'worried + wavy mouth + sweat drop' },
  sad: { eyes: 'half', brows: 'sad', mouth: 'frown', extras: ['underTeary'], desc: 'sad brows, half-lids, teary under-arcs, frown' },
  teary: { eyes: 'half', brows: 'sad', mouth: 'smileSmall', extras: ['underTeary'], desc: 'moved: sad brows, teary arcs, small smile' },
  cry: { eyes: 'half', brows: 'sad', mouth: 'grimace', extras: ['tearL', 'streamR'], desc: 'crying: arch-over-bar grimace, tear drop + stream' },
  sob: { eyes: 'half', brows: 'sad', mouth: 'grimaceB', desc: 'crying grimace: half-lids, sad brows, dome-over-bar mouth (timeloop f8538)' }, weep: { eyes: 'closedDown', brows: 'sad', mouth: 'grimaceB', extras: ['streams'], desc: 'weeping: closed eyes, dome grimace, tear streams' },
  happyTears: { eyes: 'ring', mouth: 'smile', extras: ['tears'], desc: 'ring eyes + tears + smile' },
  joyTears: { eyes: 'laugh', mouth: 'smile', extras: ['tears'], desc: 'closed laughing arcs + tears + smile' },
  angry: { eyes: 'dot', brows: 'angry', mouth: 'line', desc: 'angry brows (inner end down) + dot eyes' },
  mad: { eyes: 'dot', brows: 'angry', mouth: 'O', desc: 'angry + shouting O' },
  determined: { eyes: 'half', brows: 'mild', mouth: 'line', desc: 'mild angry brows, half-lids' },
  frustrated: { eyes: 'squeeze', mouth: 'o', desc: '> < + O' },
  pained: { eyes: 'squeeze', mouth: 'grimace', desc: '> < + grimace' },
  sideEye: { eyes: 'half', look: [.9, 0], mouth: 'line', desc: 'half-lids looking sideways' },
  thinking: { eyes: 'half', look: [.6, .5], brows: ['raised', 'flat'], mouth: 'short', mouthX: .05, desc: 'looking up-side, one brow raised' },
  confused: { eyes: 'dot', brows: ['raised', 'sad'], mouth: 'wavy', mouthX: .03, desc: 'uneven brows + wavy mouth' },
  disgust: { eyes: 'half', brows: ['angry', 'mild'], mouth: 'frown', mouthRot: -10, mouthX: .04, desc: 'tilted frown, uneven angry brows' },
  genius: { eyes: 'glow', mouth: 'smirkSide', extras: ['glowEyes'], desc: 'half-lids with orange light streaks (the mastermind)' },
  dazed: { eyes: 'bars', mouth: 'grimace', desc: '| | eyes (top-down pain)' },
  blank: { eyes: 'dot', mouth: 'line', desc: 'dot eyes + line' },
  none: { eyes: 'none', mouth: 'none', desc: 'no face' },
};
export const expressions = () => Object.keys(EXPRESSIONS);
export const ALIASES = { scheme: 'scheming', shocked2: 'shock', joy: 'happy', glad: 'smile', upset: 'sad', crying: 'cry', fear: 'scared', afraid: 'scared', annoyed: 'determined', proud: 'smug', excited: 'laugh', laughing: 'laugh', terrified: 'panic', thinking2: 'thinking', idle: 'neutral', default: 'neutral' };
export async function load() { try { await document.fonts?.load?.('700 64px Oswald'); } catch { /* fonts optional */ } }

// ---------- sphere projection ----------
/** project a front-view face point (x, y in D, head centre 0, +y up) on the head sphere for yaw (+ = toward +x) and pitch
 *  (+ = look up): { x, y, z (>0 = visible), kx, ky (foreshortening relative to the front view) } */
export function project(x, y, yaw = 0, pitch = 0) {
  const sy = clamp(2 * y, -1, 1), lat = Math.asin(sy), cl = Math.cos(lat), sx = cl > 1e-4 ? clamp(2 * x / cl, -1, 1) : 0, lon = Math.asin(sx);
  const vx = cl * Math.sin(lon), vy = sy, vz = cl * Math.cos(lon);
  // nod first (about the head's own left-right axis), then the turn
  const cp = Math.cos(pitch), sp = Math.sin(pitch), y2 = vy * cp + vz * sp, zp = -vy * sp + vz * cp;
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), x1 = vx * cyw + zp * syw, z2 = -vx * syw + zp * cyw;
  const h0 = Math.hypot(vx, vz) || 1e-6, h1 = Math.hypot(x1, z2) || 1e-6;
  const kx = (z2 / h1) / Math.max(.05, vz / h0), ky = h1 / Math.max(.05, h0);
  return { x: x1 / 2, y: y2 / 2, z: z2, kx: Math.max(0, kx), ky: Math.max(.05, Math.min(1.4, ky)) };
}

// ---------- one face ----------
class Slot {
  constructor(parent, kinds, sgn, z) { this.node = new THREE.Group(); this.node.position.z = z; parent.add(this.node); this.kinds = kinds; this.sgn = sgn; this.objs = {}; this.cur = undefined; this.mat = null; }
  show(kind, m) {
    if (kind === this.cur && m === this.mat) return this.objs[kind] || null;
    if (this.cur && this.objs[this.cur]) this.objs[this.cur].visible = false;
    this.cur = kind;
    const K = kind && this.kinds[kind];
    if (!K) { this.node.visible = false; return null; }
    this.node.visible = true;
    let o = this.objs[kind];
    if (!o) { o = K.build(m); this.node.add(o); this.objs[kind] = o; }
    if (m !== this.mat || o.userData.m !== m) { o.traverse(c => { if (c.isMesh && !c.userData.ownMat) c.material = m; }); o.userData.m = m; }
    this.mat = m; o.visible = true; return o;
  }
}
const ZS = Z.step;          // depth step between face layers (whole Z.steps: finer steps z-fight in wide shots)
const TALK_Q = .01;         // talk ring height quantum (D)

export class Face {
  /** look: the character look (glasses, moustache, clip, hair marks, face colours); o.head = head colour */
  constructor(look = {}, o = {}) {
    this.look = look; this.root = new THREE.Group(); this.root.name = 'face';
    this.head = o.head || '#0b080e'; this.featureCol = look.faceColor || FACE_COL.feature;
    this.sets = [0, 1].map(i => {
      const mF = mat(this.featureCol, { unique: true }), mE = mat(this.featureCol, { unique: true }), mB = mat(this.featureCol, { unique: true });
      const L = new THREE.Group(); L.position.z = i * ZS; this.root.add(L);
      return { mF, mE, mB, layer: L, eyeL: new Slot(L, EYES, -1, 0), eyeR: new Slot(L, EYES, 1, 0), browL: new Slot(L, BROWS, -1, 0), browR: new Slot(L, BROWS, 1, 0), mouth: new Slot(L, MOUTHS, 1, 0) };
    });
    this.extras = {}; this.extraLayer = new THREE.Group(); this.extraLayer.position.z = 2 * ZS; this.root.add(this.extraLayer);
    this.decals = []; this.decalLayer = new THREE.Group(); this.decalLayer.position.z = 3 * ZS; this.root.add(this.decalLayer);
    this._buildDecals();
    this.state = null;
  }
  // ---- decals from the look: glasses, moustache, hair clip, hair marks (slicked lines, curls, bald shine) ----
  _decal(obj, x, y, o = {}) { obj.traverse(c => { if (c.isMesh) c.userData.noPick = true; }); const n = new THREE.Group(); n.add(obj); n.userData = { x, y, hw: o.hw ?? .1, hh: o.hh ?? .1, rot: o.rot || 0, sgn: o.sgn || 1, fixed: !!o.fixed, minZ: o.minZ ?? .12 }; (o.layer || this.decalLayer).add(n); this.decals.push(n); return n; }
  _buildDecals() {
    const L = this.look, gl = L.glasses;
    if (gl) {
      const col = L.glassesColor || FACE_COL.glass, m = mat(col), mr = mat(FACE_COL.glassRef, { opacity: .32 });
      for (const s of [-1, 1]) {
        const lens = gl === 'square' ? M(rrRingGeo(.27, .22, .06, .024), m) : M(ring(.122, .145).geometry, m);
        const refl = grp(M(line('gref1', [[-.05, .02], [-.01, .06]], .016), mr), M(line('gref2', [[-.035, -.025], [.025, .035]], .016), mr));
        refl.position.z = -ZS * .5;
        const g = grp(refl, lens); this._decal(g, s * ANCHOR.eyeX, ANCHOR.eyeY + .01, { hw: .15, hh: .15, sgn: s, minZ: .02 });
        // the temple: a thin bar from the lens edge to the ear (sized every frame)
        const t = M(unitRect(), m); t.scale.set(.1, .02, 1); t.userData.temple = s; const tn = new THREE.Group(); tn.add(t); tn.userData = { temple: s, x: s * .3, y: ANCHOR.eyeY + .03 }; this.decalLayer.add(tn); this.decals.push(tn);
      }
      this._decal(grp(M(line('bridge', arc(.06, .02), .02), m)), 0, ANCHOR.eyeY + .045, { hw: .04, hh: .02, minZ: .02 });
    }
    if (L.moustache) {
      const white = L.moustache === 'white' || L.moustache === 'grey';
      let g;
      if (white) { const p = []; for (let i = 0; i <= 26; i++) { const x = -.14 + .28 * i / 26; p.push([x, .02 * Math.sin(2 * PI * 2 * i / 26) - .012 * (1 - (x / .14) ** 2) * 0]); } g = grp(M(line('stacheW', p, .034), mat(FACE_COL.stacheWhite))); }
      else {
        const s = new THREE.Shape(); s.moveTo(0, .02); s.bezierCurveTo(.06, .07, .2, .06, .2, -.045); s.bezierCurveTo(.14, -.02, .06, -.05, 0, -.03); s.bezierCurveTo(-.06, -.05, -.14, -.02, -.2, -.045); s.bezierCurveTo(-.2, .06, -.06, .07, 0, .02);
        const mm = mat(L.moustacheColor || FACE_COL.stacheBrown), ml = mat(FACE_COL.stacheBrownLine);
        const lines = [-.12, -.06, 0, .06, .12].map((x, i) => { const l = M(line('stl' + i, [[x, .03 - Math.abs(x) * .3], [x * 1.1, -.025 - Math.abs(x) * .15]], .014), ml); l.position.z = ZS * .5; return l; });
        g = grp(M(G('stacheB', () => new THREE.ShapeGeometry(s, 12)), mm), ...lines);
      }
      this._decal(g, 0, -.17, { hw: .2, hh: .06 });
    }
    if (L.clip) {
      const c = typeof L.clip === 'string' ? L.clip : FACE_COL.clip, ol = M(rrect(.19, .085, .042).geometry, mat(mixHex(c, '#0b080e', .45))), fi = M(rrect(.166, .062, .031).geometry, mat(c)), hi = M(rrect(.1, .016, .008).geometry, mat(mixHex(c, '#ffffff', .6)));
      fi.position.z = ZS * .3; hi.position.set(-.01, .012, ZS * .6);
      this._decal(grp(ol, fi, hi), .25, .23, { hw: .1, hh: .06, rot: 25 * DEG });
    }
    const hm = L.hairMarks || ({ slick: 'slick', curls: 'curls', bald: 'bald', afro: 'curls' })[L.hair];
    if (hm === 'slick') { const m = mat(L.hairMarkColor || FACE_COL.slick); [0, 1, 2, 3, 4].forEach(i => { const w = .62 - i * .07, h = .1 - i * .006; this._decal(grp(M(line('slk' + i, arc(w, h), .022), m)), 0, .2 + i * .045, { hw: w / 2, hh: .04, minZ: -.2 }); }); }
    if (hm === 'curls') { const m = mat(L.hairMarkColor || FACE_COL.curl); const c = []; for (let i = 0; i <= 10; i++) { const a = PI * .15 + i / 10 * PI * 1.1; c.push([Math.cos(a) * .035, Math.sin(a) * .035]); }
      const spots = [[-.25, .18], [-.12, .2], [.01, .2], [.14, .19], [.27, .17], [-.2, .31], [-.07, .33], [.07, .33], [.2, .31], [-.12, .42], [.02, .44], [.14, .42]];
      spots.forEach(([x, y], i) => this._decal(grp(M(line('curl', c, .02), m)), x, y, { hw: .05, hh: .05, rot: (i * 37 % 40 - 20) * DEG, minZ: -.2 })); }
    if (hm === 'bald') this._decal(grp(M(ellipse(.11, .055).geometry, mat(FACE_COL.bald))), -.17, .3, { hw: .11, hh: .06, rot: 30 * DEG, fixed: true });
  }
  _extra(name) {
    let e = this.extras[name]; if (e) return e;
    const L = this.extraLayer, add = o => { const n = new THREE.Group(); n.add(o); L.add(n); return n; };
    const tearCol = this.look.night ? FACE_COL.tearNight : FACE_COL.tear;
    if (name === 'tearL' || name === 'tearR') e = add(M(teardropGeo(.05, .1), mat(tearCol)));
    else if (name === 'streamL' || name === 'streamR') { const r = M(rrect(.034, .15, .017).geometry, mat(tearCol, { opacity: .6 })); r.position.y = -.075; e = add(r); }
    else if (name.startsWith('under')) { const col = name === 'underTired' ? FACE_COL.tired : name === 'underTeary' ? FACE_COL.teary : FACE_COL.tired; const op = name === 'underGrey' ? .55 : .85;
      e = new THREE.Group(); for (const s of [-1, 1]) { const g = grp(M(line('ua1', arc(.165, -.04), .036), mat(col, { opacity: op })), name === 'underGrey' ? null : M(line('ua2', arc(.14, -.034), .032), mat(col, { opacity: op * .8 }), { at: [0, -.05] })); g.userData.sgn = s; e.add(g); } L.add(e); }
    else if (name === 'sweat') { const d = M(teardropGeo(.075, .13), mat(FACE_COL.tear)); e = add(d); }
    else if (name === 'sparkle') { const g = grp(glow(.09, '#ffffff', { opacity: .5 }), M(starGeo(.065), mat(FACE_COL.sparkle)), M(starGeo(.035, .3), mat(FACE_COL.sparkle), { rot: PI / 4 })); g.children[0].scale.setScalar(1); e = add(g); }
    else if (name === 'glint') { const p = []; for (let i = 0; i <= 12; i++) { const a = (112 + i / 12 * 40) * DEG; p.push([Math.cos(a) * .425, Math.sin(a) * .425]); } e = add(M(line('glint', p, .022), mat(FACE_COL.glint, { opacity: .85 }))); e.userData.fixed = true; }
    else if (name === 'hearts') { const m = mat('#f07a8a'); e = add(grp(M(heartGeo(.06), m, { at: [.0, 0] }), M(heartGeo(.04), m, { at: [.13, .1], rot: -.3 }))); }
    else if (name === 'glowEyes') { e = new THREE.Group(); for (const s of [-1, 1]) { const st = glow(.12, FACE_COL.glowEye, { opacity: .55, sx: .55, sy: 2.2 }); st.userData.sgn = s; e.add(st); } L.add(e); e.userData.fixed = true; }
    else if (name === 'ha') {
      const g = new THREE.Group(), ol = M(burstGeo(.27, .38, 11), mat(FACE_COL.haText)), bg = M(burstGeo(.24, .345, 11), mat(FACE_COL.ha));
      bg.position.z = ZS * .4; g.add(ol, bg);
      try { const t = text('HA!', { size: .2, px: 1400, font: 'Oswald', weight: 700, color: FACE_COL.haText }); t.position.z = ZS; t.renderOrder = 9; g.add(t); } catch { /* text needs a DOM */ }
      e = add(g); e.userData.fixed = true;
    } else e = add(new THREE.Group());
    // own materials (mat() shares them by colour across every face), so this face's crossfade can fade its extras alone
    e.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.userData.op0 = c.material.opacity; } });
    e.visible = false; this.extras[name] = e; return e;
  }
  /** place a slot's node on the sphere */
  _put(node, ax, ay, hw, hh, sgn, rot, view) {
    const p = project(ax, ay, view.yaw, view.pitch);
    if (p.z < .08 || p.kx < .08) { node.visible = false; return null; }
    let r = Math.hypot(p.x, p.y); const ux = r ? p.x / r : 0, uy = r ? p.y / r : 0;
    const e = Math.hypot(hw * p.kx * ux, hh * p.ky * uy), lim = .485 - e;
    if (r > lim) { const k = Math.max(0, lim) / r; p.x *= k; p.y *= k; }
    node.visible = true; node.position.x = p.x; node.position.y = p.y; node.scale.set(sgn * p.kx, p.ky, 1); node.rotation.z = rot;
    return p;
  }
  _resolve(name) { if (name && typeof name === 'object') return name; const n = ALIASES[name] || name; return EXPRESSIONS[n] || EXPRESSIONS.neutral; }
  /**
   * face: { expr, blink 0..1, talk 0..1, look [x, y], mix: { expr2, k }, t (seconds, for tear / sparkle motion), light 0..1,
   *         eyes, brows, mouth, extras (overrides for this frame) }
   * view: { yaw, pitch (radians), back (bool), mirror (+1 / -1: the body's facing, keeps the HA! text readable) }
   */
  set(face = {}, view = {}) {
    if (view.back) { this.root.visible = false; return; }
    this.root.visible = true;
    const k = clamp(face.mix?.k ?? 0, 0, 1), light = clamp(face.light ?? 1, 0, 1.2);
    const A = this._resolve(face.expr || 'neutral'), B = k > 0.001 && face.mix?.expr2 ? this._resolve(face.mix.expr2) : null;
    const useA = !(B && k >= .999);
    const shown = new Set(), exw = new Map();
    // a crossfade fades only the parts that change: eyes / brows / mouth the two expressions share stay at full strength
    // (fading both copies dimmed the whole face for two frames, a flicker of its own)
    let wA = { e: 1, b: 1, m: 1 }, wB = null;
    if (B && useA) {
      const sig = this._partSig.bind(this, face), sa = sig(A), sb = sig(B), w = p => sa[p] === sb[p];
      wA = { e: w('e') ? 1 : 1 - k, b: w('b') ? 1 : 1 - k, m: w('m') ? 1 : 1 - k };
      wB = { e: w('e') ? 0 : k, b: w('b') ? 0 : k, m: w('m') ? 0 : k };
    }
    this._setOne(this.sets[0], useA ? A : B, face, view, wA, useA ? (B ? 1 - k : 1) : 1, light, exw);
    if (wB) this._setOne(this.sets[1], B, face, view, wB, k, light, exw);
    else this._hideSet(this.sets[1]);
    // extras: each at the summed weight of the expressions that have it, so a crossfade fades them too
    for (const [n, w] of exw) if (w > .02) this._showExtra(n, view, face, shown, Math.min(1, w));
    for (const [n, e] of Object.entries(this.extras)) if (!shown.has(n)) e.visible = false;
    // decals (glasses, moustache, clip, hair marks)
    for (const d of this.decals) {
      const u = d.userData;
      if (u.temple) { this._temple(d, u.temple, view); continue; }
      if (u.fixed) { d.visible = true; d.position.set(u.x, u.y, 0); d.rotation.z = u.rot; continue; }
      const p = project(u.x, u.y, view.yaw, view.pitch);
      if (p.z < u.minZ || p.kx < .05) { d.visible = false; continue; }
      d.visible = true; d.position.x = p.x; d.position.y = p.y; d.scale.set(u.sgn * Math.max(.05, p.kx), p.ky, 1); d.rotation.z = u.rot;
      if (u.minZ < 0) d.position.z = 0;
    }
  }
  _temple(d, s, view) {
    const a = project(s * .3, ANCHOR.eyeY + .02, view.yaw, view.pitch), b = project(s * .5, ANCHOR.eyeY + .06, view.yaw, view.pitch);
    // shown when the ear end is on the visible side or the lens edge sits near the rim (3/4: the far temple to the head edge)
    if (a.z < .02) { d.visible = false; return; }
    let bx = b.x, by = b.y; if (b.z < 0) { const r = Math.hypot(bx, by) || 1; bx = bx / r * .5; by = by / r * .5; }
    const dx = bx - a.x, dy = by - a.y, len = Math.hypot(dx, dy);
    if (len < .02) { d.visible = false; return; }
    d.visible = true; d.position.set(a.x, a.y, 0); d.rotation.z = Math.atan2(dy, dx); d.scale.set(1, 1, 1); d.children[0].scale.set(len, .02, 1);
  }
  _hideSet(S) { for (const k of ['eyeL', 'eyeR', 'browL', 'browR', 'mouth']) { S[k].show(null); } }
  /** what each part of an expression draws (with this frame's overrides): equal strings = the same picture */
  _partSig(face, E) {
    const talk = (face.talk ?? 0) > .02;
    return { e: JSON.stringify([face.eyes ?? E.eyes ?? 'half', E.eyeColor || '', face.look ?? E.look ?? [0, 0]]),
      b: JSON.stringify([face.brows !== undefined ? face.brows : E.brows ?? null, E.browY || 0]),
      m: talk && (face.mouth ?? E.mouth) !== 'none' ? 'talk' : JSON.stringify([face.mouth ?? E.mouth ?? 'line', E.mouthX || 0, E.mouthY || 0, E.mouthRot || 0]) };
  }
  /** draw one expression into a layer set; pw = per-part strength { e: eyes, b: brows, m: mouth } (0 hides the part),
   *  k = this expression's share of the extras */
  _setOne(S, E, face, view, pw, k, light, exw) {
    const head = this.head;
    const fc = E.eyeColor === 'worried' ? FACE_COL.worried : E.eyeColor || this.featureCol;
    S.mF.color.set(mixHex(head, this.featureCol, clamp(pw.m * light, 0, 1)));
    S.mB.color.set(mixHex(head, this.featureCol, clamp(pw.b * light, 0, 1)));
    S.mE.color.set(mixHex(head, fc, clamp(pw.e * light, 0, 1)));
    // eyes
    const blink = (face.blink ?? 0) >= .5;
    let eyes = face.eyes ?? E.eyes ?? 'half'; if (!Array.isArray(eyes)) eyes = [eyes, eyes];
    const look0 = face.look ?? E.look ?? [0, 0], look = [look0[0] * (view.mirror || 1), look0[1] || 0];   // look x + = toward the facing side
    const brows0 = face.brows !== undefined ? face.brows : E.brows ?? null;
    const browsArr = Array.isArray(brows0) ? brows0 : [brows0, brows0];
    for (const [i, side, sgn] of [[0, 'eyeL', -1], [1, 'eyeR', 1]]) {
      let kind = pw.e > .001 ? eyes[i] : null, tilt = 0;
      if (blink && kind && kind !== 'none') { tilt = (kind === 'half' || kind === 'glow') ? 6 * DEG : 0; kind = 'closed'; }
      const sl = S[side], o = sl.show(kind, S.mE);
      if (!o) continue;
      const K = EYES[kind];
      const p = this._put(sl.node, sgn * ANCHOR.eyeX + look[0] * .012, ANCHOR.eyeY + look[1] * .01, K.hw, K.hh, sgn, sgn * tilt, view);
      if (p && K.look) K.look(o, look[0] * sgn, look[1]);
    }
    // brows (angry brows hide during a blink, as measured)
    for (const [i, side, sgn] of [[0, 'browL', -1], [1, 'browR', 1]]) {
      const bk = browsArr[i], B = bk && BROW_KINDS[bk];
      const sl = S[side];
      if (!B || pw.b <= .001 || (blink && bk === 'angry')) { sl.show(null); continue; }
      sl.show(B.shape, S.mB);
      this._put(sl.node, sgn * (ANCHOR.eyeX + .005), ANCHOR.eyeY + ANCHOR.browUp + B.dy + (E.browY || 0), .115, .05, sgn, -sgn * B.tilt * DEG, view);
    }
    // mouth: the talking mouth is always the O ring (open 0..1 -> height .115 .. .27 D, 1.5 % D lower than the rest mouth)
    const talk = clamp(face.talk ?? 0, 0, 1);
    let mk = pw.m > .001 ? face.mouth ?? E.mouth ?? 'line' : 'none';
    const sl = S.mouth;
    if (mk === 'none') sl.show(null);
    else if (talk > .02) {
      const o = sl.show('talk', S.mF), h = Math.round((.115 + .155 * talk) / TALK_Q) * TALK_Q, w = .25 + .02 * talk;
      o.userData.ring.geometry = ellRingGeo(+w.toFixed(3), +h.toFixed(3), .045);
      this._put(sl.node, 0, ANCHOR.mouthY - .015, w / 2, h / 2, 1, 0, view);
    } else {
      const o = sl.show(mk, S.mF);
      if (o) { const K = MOUTHS[mk]; this._put(sl.node, (E.mouthX || 0), ANCHOR.mouthY + (E.mouthY || 0), K.hw, K.hh, 1, (E.mouthRot || 0) * DEG, view); }
    }
    // extras
    const ex = new Set([...(E.extras || []), ...(face.extras || [])]);
    for (const n0 of ex) for (const n of ({ tears: ['tearL', 'tearR'], streams: ['streamL', 'streamR'] })[n0] || [n0]) exw.set(n, (exw.get(n) || 0) + k);
  }
  _showExtra(n, view, face, shown, w = 1) {
    const e = this._extra(n); shown.add(n); e.visible = true;
    if (e.userData.w !== w) { e.userData.w = w; e.traverse(c => { if (c.isMesh) c.material.opacity = c.userData.op0 * w; }); }
    const t = face.t ?? 0;
    if (e.userData.fixed) {
      if (n === 'ha') {
        // pops in over 2 frames, then wiggles its rotation every 2-3 frames (iq500 f11739-11745)
        const t0 = face.haAt ?? face.exprAt ?? null, age = t0 == null ? 1 : t - t0;
        // iq500 f2140 (and lib/fx.js 'ha'): ~1.2 D wide, centre ~0.75 D above and ~0.7 D beside the head centre, a 2-frame pop at .55, then a +-6 deg wiggle every 2 frames
        const s = age < 1 / 24 ? .55 : 1, w = Math.floor(t * 24 / 2 + 1e-6) % 2 ? 1 : -1;
        const side = -(view.mirror || 1), k = 1.3; e.position.set(.7 * side, .75, 0); e.scale.set(s * k, s * k, 1); e.rotation.z = w * 6 * DEG;
      } else if (n === 'glowEyes') { e.children.forEach(c => { const p = project(c.userData.sgn * ANCHOR.eyeX, ANCHOR.eyeY + .2, view.yaw, view.pitch); c.position.set(p.x, p.y, 0); c.visible = p.z > .1; }); }
      return;
    }
    let ax = 0, ay = 0, hw = .05, hh = .05, sgn = 1, dy = 0;
    if (n === 'tearL' || n === 'tearR') { sgn = n === 'tearL' ? -1 : 1; ax = sgn * (ANCHOR.eyeX + .015); const fall = face.t == null ? .03 : ((t * .45) % .26); ay = ANCHOR.eyeY - .085 - fall; hw = .03; hh = .06; }
    else if (n === 'streamL' || n === 'streamR') { sgn = n === 'streamL' ? -1 : 1; ax = sgn * (ANCHOR.eyeX + .01); ay = ANCHOR.eyeY - .05; hw = .02; hh = .02; }
    else if (n.startsWith('under')) { e.children.forEach(c => { const s = c.userData.sgn; this._put(c, s * ANCHOR.eyeX, ANCHOR.eyeY - .088, .09, .03, s, 0, view); }); return; }
    else if (n === 'sweat') { ax = .31; ay = .2 - ((face.t == null ? 0 : (t * .06) % .06)); hw = .04; hh = .07; }
    else if (n === 'sparkle') { ax = ANCHOR.eyeX + .03; ay = ANCHOR.eyeY + .045; hw = .03; hh = .03; const tw = face.t == null ? 1 : .8 + .2 * Math.sin(t * 9); e.children[0].children.forEach(c => c.scale.setScalar(tw)); }
    else if (n === 'hearts') { e.position.set(.38, .5 + (face.t == null ? 0 : .03 * Math.sin(t * 3)), 0); return; }
    const p = this._put(e, ax, ay + dy, hw, hh, 1, 0, view);
    if (!p) { e.visible = false; return; }
    if (n === 'streamL' || n === 'streamR' || n === 'tearL' || n === 'tearR') e.scale.y = 1;
    e.visible = true; void sgn;
  }
}
void poly; void lerp;
