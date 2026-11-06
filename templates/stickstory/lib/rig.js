// Stick stories - THE RIG: the drawing of a character (body, clothes, hair, hats, rim light, hands) as rigid flat parts on
// one card, posed by transforms only. Measured on the references (experiments/stickstory-style/analysis/characters/NOTES.md
// + hands/NOTES.md): a perfect-circle head of diameter D, an adult 5.35 D tall, straight two-segment capsule limbs 0.25 D
// thick, black #0b080e with no outline, clothes as flat fills with a darker outline (0.022 D) and a shade tone, far limbs a
// lighter purple-black, and the RIM LIGHT = a one-colour copy of the whole silhouette drawn behind the character, shifted
// ~0.06 D toward the set's light (crisp, no blur).
//
// The contract with lib/anim.js (ENGINE.md "The character contract"):
//   const fig = new Figure(look)       fig.root (Group, feet on y = 0), fig.dims, fig.height, fig.headR, fig.head (head node)
//   fig.setPose(pose)                  every frame (transforms only); pose = POSE0 / pose({ ...overrides })
//   fig.setFace({ expr, blink, talk, look, mix, t, light })      fig.setRim(color | null, dir = [0, 1], o)
//   fig.joint(name)                    'hip' 'neck' 'head' 'headTop' 'shoulderL' 'elbowL' 'wristL' 'handL' 'hipL' 'kneeL' 'ankleL'
//                                      'footL' 'heelL' 'toeL' (and R) in fig.root space after setPose
//   fig.attach(obj, side, o)           parent a held prop to a hand's grip point; fig.detach(obj)
//   Hand(look, { pose })               the detailed glove / flat mitten for hand inserts (a separate card)
import { THREE, C, Z, mat, rrect, ellipse, circle, ring, capsule, stroke, glow, softShadow, clamp, lerp, DEG, shade, mixHex, smooth } from './core.js';
import { Face, project, FACE_COL } from './faces.js';

const PI = Math.PI;
export const COL = {
  body: '#0b080e', far: '#2f2333', extra: '#2a263c', extraWarm: '#332430', extraGrey: '#6d6a74', extraNight: '#1d1a2a',
  face: FACE_COL.feature, white: '#f2efe9', watch: '#dcdde3', watchEdge: '#9a9aa2', string: '#ece6dc', lineDark: '#0c0a0e',
  glove: '#120d12', gloveLine: '#2e2432', gloveHi: '#2c2430', gloveRim: '#e1b78d', mitten: '#0b080e', mittenSheen: '#2a2528', mittenRim: '#e8c48c',
};
/** rim colours per kind of set (measured, analysis/characters/NOTES.md section 2) */
export const RIMS = { warm: '#f8ba74', sunset: '#f5a85f', amber: '#e1995b', peach: '#e09a85', evening: '#de977c', salmon: '#dfa093', night: '#8dc6f2', cool: '#97cbf8', white: '#dfe6f5', grey: '#c9c6cf', pink: '#f0a0b8', green: '#9fe0b0' };
const ADULT_D = 1.70 / 5.35;
/** proportions per age in head diameters D (adult 5.35 D = 1.70 m); measured in NOTES 1.1 / 1.2 and re-measured for seating:
 *  standing hip pivot 0.45 H (iq500 f784 hip bend, motion NOTES 0.44-0.47 H), seated knee pivot ~1.5 D above the soles with the
 *  shin vertical and the thigh level (sister f1906): long shins, short thighs. Seat for level thighs (dims.seatH): adult 0.456 m,
 *  teen 0.41, kid 0.31, small 0.22 */
export const AGES = {
  adult: { D: ADULT_D, neck: .22, torso: 1.72, thigh: .85, shin: 1.46, ankle: .1, upper: .92, fore: .87, limb: .25, torsoW: .52, torsoS: .30, foot: .58, footH: .2, sleeve: .29, pad: .1 },
  teen: { D: ADULT_D * .9, neck: .26, torso: 1.67, thigh: .85, shin: 1.46, ankle: .1, upper: .92, fore: .87, limb: .25, torsoW: .5, torsoS: .29, foot: .56, footH: .2, sleeve: .28, pad: .1 },
  kid: { D: ADULT_D * .96, neck: .18, torso: 1.23, thigh: .67, shin: 1.0, ankle: .08, upper: .7, fore: .66, limb: .16, torsoW: .44, torsoS: .27, foot: .42, footH: .16, sleeve: .21, pad: .08 },
  small: { D: ADULT_D * .94, neck: .14, torso: 1.12, thigh: .5, shin: .72, ankle: .06, upper: .56, fore: .52, limb: .13, torsoW: .4, torsoS: .26, foot: .36, footH: .14, sleeve: .18, pad: .07 },
};
AGES.child = AGES.kid; AGES.toddler = AGES.small; AGES.elder = AGES.adult; AGES.old = AGES.adult;
const S = Z.step;
// depth layers inside one figure, in whole Z.steps (sub-step offsets z-fight at 10-20 m): rim copies at -1 / -2, back hair 0..2,
// far arm behind the torso 3..13, legs 14..19, torso 20, garment 21..28 (panel, skirt, skirt details, shade band, details x2, hood,
// hood inside), neck 29, collar items 30..32, head 33, face 34..37, front hair 38, hat 39..41, far arm in front 42..52, near arm 53..63
const LY = { hairBack: 0, hairAcc: 1, armFB: 3, legF: 14, legN: 17, torso: 20, panel: 21, skirt: 22, skirtDet: 23, d0: 24, d1: 25, d2: 26, hood: 27, hoodIn: 28,
  neck: 29, ca: 30, cb: 31, cc: 32, head: 33, face: 34, hairFront: 38, hat: 39, armFF: 42, armN: 53, top: 64 };
// sub-layers of an arm (x Z.step): upper limb, upper sleeve, forearm (limb / sleeve), sleeve outline, cuff, watch, watch face, held prop (7..8), hand, prop over the hand
// (a sling pouch takes the watch face's layer and a plaster cast sits between the held-prop slot and the hand: _cast)
const AZ = { upper: 0, sleeveU: 1, fore: 2, foreLine: 3, cuff: 4, watch: 5, watchFace: 6, pouch: 6, prop: 7, cast: 8, hand: 9, propFront: 10 };

// =====================================================================================================================
// geometry helpers (metres; cached + shared by key)
// =====================================================================================================================
const GC = new Map();
const G = (key, make) => { let g = GC.get(key); if (!g) { g = make(); g.userData.shared = true; GC.set(key, g); } return g; };
const f4 = v => (+v).toFixed(4);
const shapeOf = pts => { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); return s; };
const pathOf = pts => { const s = new THREE.Path(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); return s; };
const fillGeo = (key, pts) => G('f|' + key, () => new THREE.ShapeGeometry(shapeOf(pts())));
const ringGeo = (key, outer, inner) => G('r|' + key, () => { const s = shapeOf(outer()); s.holes.push(pathOf(inner().slice().reverse())); return new THREE.ShapeGeometry(s); });
/** capsule from (0,0) down to (0,-len), radius r (+ grow) */
function capPts(len, r) { const p = [], n = 14; for (let i = 0; i <= n; i++) { const a = PI * i / n; p.push([Math.cos(a) * r, Math.sin(a) * r]); } for (let i = 0; i <= n; i++) { const a = PI + PI * i / n; p.push([Math.cos(a) * r, -len + Math.sin(a) * r]); } return p; }
/** a polygon with circular-arc rounded corners (radius per vertex; clamped so neighbouring arcs never overlap) */
function roundPoly(P, R, n = 7) {
  const out = [], N = P.length;
  for (let i = 0; i < N; i++) {
    const p = P[i], a = P[(i + N - 1) % N], b = P[(i + 1) % N];
    let r = R[i] || 0;
    const v1 = [a[0] - p[0], a[1] - p[1]], v2 = [b[0] - p[0], b[1] - p[1]], l1 = Math.hypot(...v1) || 1e-9, l2 = Math.hypot(...v2) || 1e-9;
    const u1 = [v1[0] / l1, v1[1] / l1], u2 = [v2[0] / l2, v2[1] / l2], th = Math.acos(clamp(u1[0] * u2[0] + u1[1] * u2[1], -1, 1));
    if (r <= 1e-6 || th < 1e-3 || th > PI - 1e-3) { out.push([p[0], p[1]]); continue; }
    let t = r / Math.tan(th / 2); const tmax = Math.min(l1, l2) * .5 * .9999; if (t > tmax) { t = tmax; r = t * Math.tan(th / 2); }
    const T1 = [p[0] + u1[0] * t, p[1] + u1[1] * t], T2 = [p[0] + u2[0] * t, p[1] + u2[1] * t];
    const bx = u1[0] + u2[0], by = u1[1] + u2[1], bl = Math.hypot(bx, by) || 1e-9, d = r / Math.sin(th / 2), Cx = p[0] + bx / bl * d, Cy = p[1] + by / bl * d;
    const a1 = Math.atan2(T1[1] - Cy, T1[0] - Cx), a2 = Math.atan2(T2[1] - Cy, T2[0] - Cx); let da = a2 - a1; while (da > PI) da -= 2 * PI; while (da < -PI) da += 2 * PI;
    for (let k = 0; k <= n; k++) { const an = a1 + da * k / n; out.push([Cx + Math.cos(an) * r, Cy + Math.sin(an) * r]); }
  }
  return out;
}
/** rounded rect centred at 0, radii [tl, tr, br, bl] */
const rrPts = (w, h, rad) => roundPoly([[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2]], rad);
/** rounded trapezoid: top edge at y = 0 (width wt), bottom at y = -h (width wb) */
const trapPts = (wt, wb, h, rt, rb) => roundPoly([[-wt / 2, 0], [wt / 2, 0], [wb / 2, -h], [-wb / 2, -h]], [rt, rt, rb, rb]);
const EMPTY = new THREE.BufferGeometry(); EMPTY.userData.shared = true;
const ms = (g, m, z = 0, name) => { const x = new THREE.Mesh(g || EMPTY, m); x.position.z = z; if (name) x.name = name; return x; };
const node = (parent, x = 0, y = 0, z = 0, name) => { const n = new THREE.Group(); n.position.set(x, y, z); if (name) n.name = name; parent?.add(n); return n; };
/** dome = the part of a circle (radius r, centre 0) above the chord y = y0 */
function domePts(r, y0, n = 28) { const a0 = Math.asin(clamp(y0 / r, -1, 1)), p = []; for (let i = 0; i <= n; i++) { const a = a0 + (PI - 2 * a0) * i / n; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; }
/** band = the part of a circle between chords y0 < y1 */
function bandPts(r, y0, y1, n = 16) { const a0 = Math.asin(clamp(y0 / r, -1, 1)), a1 = Math.asin(clamp(y1 / r, -1, 1)), p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([Math.cos(a) * r, Math.sin(a) * r]); } for (let i = 0; i <= n; i++) { const a = PI - a1 + (a1 - a0) * i / n; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; }
const lineGeo = (key, pts, w) => stroke(pts, w, '#fff', { key: 'rig|' + key }).geometry;
/** the outline of a limb sleeve WITHOUT its top end (sides + bottom), lying just outside the fill so both share one depth:
 *  a sleeve going down from y = 0 to y = -len, width w; flat = a squared end with corner radius rr instead of a round cap */
function uLineGeo(len, w, lw, flat, rr = 0) {
  return G(`uline|${f4(len)}|${f4(w)}|${f4(lw)}|${flat ? 1 : 0}|${f4(rr)}`, () => {
    const o = lw / 2, R = w / 2 + o, p = [[-R, 0]];
    if (flat) { const c = Math.max(rr, .0001), cx = w / 2 - c, cy = -len + c;
      for (let i = 0; i <= 6; i++) { const a = PI + PI / 2 * i / 6; p.push([-cx + Math.cos(a) * (c + o), cy + Math.sin(a) * (c + o)]); }
      for (let i = 0; i <= 6; i++) { const a = -PI / 2 + PI / 2 * i / 6; p.push([cx + Math.cos(a) * (c + o), cy + Math.sin(a) * (c + o)]); } }
    else { for (let i = 0; i <= 16; i++) { const a = PI + PI * i / 16; p.push([Math.cos(a) * R, -len + Math.sin(a) * R]); } }
    p.push([R, 0]);
    return stroke(p, lw, '#fff', { key: `rigU|${f4(len)}|${f4(w)}|${f4(lw)}|${flat ? 1 : 0}|${f4(rr)}` }).geometry;
  });
}

// =====================================================================================================================
// looks
// =====================================================================================================================
/** the garment kinds (outfit.top); each is data the garment builder reads (hem: 'hip' | 'low' | 'knee' | 'shin') */
export const GARMENTS = {
  none: { desc: 'no top: the plain black body' },
  hoodie: { hem: 'hip', sleeves: 'long', collar: 'hood', pocket: true, strings: true, cuff: true, desc: 'hoodie: hood bump, drawstrings, kangaroo pocket, cuffs (the "you" heroes)' },
  tee: { hem: 'hip', sleeves: 'short', collar: 'crew', desc: 't-shirt, short sleeves' },
  tank: { hem: 'hip', sleeves: 'none', collar: 'crew', desc: 'sleeveless top' },
  sweater: { hem: 'hip', sleeves: 'long', collar: 'crew', rib: true, cuff: true, desc: 'knit sweater with ribbed hem and cuffs' },
  shirt: { hem: 'hip', sleeves: 'long', collar: 'shirt', buttons: true, cuff: true, color: '#e6e5ee', desc: 'collared shirt (+ tie: outfit.tie)' },
  suit: { hem: 'low', sleeves: 'long', collar: 'lapel', shirtV: true, tie: true, cuffColor: '#eceaf2', color: '#9396a6', desc: 'suit jacket, white shirt V, kite tie, white cuffs' },
  jacket: { hem: 'low', sleeves: 'long', collar: 'stand', zip: true, cuff: true, color: '#967839', desc: 'zip jacket (ochre work jacket, + badge: outfit.badge)' },
  track: { hem: 'low', sleeves: 'long', collar: 'stand', zip: true, cuff: true, stripes: true, color: '#3482ba', desc: 'track jacket with zip and sleeve stripes' },
  coat: { hem: 'knee', flare: .14, sleeves: 'long', collar: 'lapel', belt: true, folds: 2, buttons: true, cuff: true, color: '#a17447', desc: 'long coat / trench to the knee with belt and folds' },
  labcoat: { hem: 'knee', flare: .1, sleeves: 'long', collar: 'lapel', open: true, inner: '#67594f', folds: 1, pockets: true, color: '#b8cbdf', desc: 'white lab coat open over a vest' },
  dress: { hem: 'knee', flare: .4, waist: true, sleeves: 'short', collar: 'crew', color: '#f2c24a', desc: 'dress flaring from the waist to the knee' },
  coatdress: { hem: 'shin', flare: .22, sleeves: 'long', collar: 'v', belt: '#e8b830', folds: 1, cuff: true, color: '#38877d', desc: 'long coat-dress with a coloured belt' },
  skirt: { hem: 'knee', flare: .3, waist: true, sleeves: 'short', collar: 'crew', skirt: true, desc: 'top + skirt (outfit.color2) to the knee' },
  robe: { hem: 'shin', flare: .34, sleeves: 'wide', collar: 'v', stripes: 4, color: '#7e7d80', desc: 'wide robe with stripes (prison robe)' },
  gown: { hem: 'shin', flare: .34, sleeves: 'wide', collar: 'v', color: '#2c2f3e', desc: 'graduation gown (+ hat gradcap)' },
  scrubs: { hem: 'hip', sleeves: 'short', collar: 'v', pants: 'self', chestPocket: true, color: '#4fa6a0', desc: 'medical scrubs, trousers in the same colour' },
  apron: { hem: 'hip', sleeves: 'short', collar: 'crew', apron: '#f2efe9', color: '#d8433b', desc: 'tee + long apron (outfit.apron colour)' },
  uniform: { hem: 'hip', sleeves: 'long', collar: 'shirt', buttons: true, chestPocket: true, badge: 'star', belt: '#1c1c22', cuff: true, color: '#2f4f86', desc: 'uniform shirt with pockets, star badge, belt' },
  armor: { hem: 'hip', sleeves: 'long', collar: 'none', armor: true, pants: 'self', color: '#3a3d45', desc: 'segmented dark armour with glowing joint rings (+ hat helmet)' },
  vest: { hem: 'hip', sleeves: 'none', collar: 'v', buttons: true, color: '#67594f', desc: 'sleeveless vest' },
};
/** normalise a look: accepts { shirt } (old), { outfit: 'hoodie' }, { outfit: { top, color } }, age aliases */
export function normLook(look = {}) {
  const L = { ...look };
  let o = L.outfit;
  if (typeof o === 'string') o = { top: o };
  o = { ...(o || {}) };
  if (!o.top) o.top = L.extra ? 'none' : (L.shirt || o.color ? 'hoodie' : 'none');
  if (!GARMENTS[o.top]) o.top = 'tee';
  o.color = o.color || L.shirt || GARMENTS[o.top].color || '#2c64c9';
  L.outfit = o;
  if (L.age === 'elder' || L.age === 'old') { L.elder = true; L.age = 'adult'; }
  if (!AGES[L.age]) L.age = 'adult';
  return L;
}

// =====================================================================================================================
// the pose
// =====================================================================================================================
export const BODY = { height: 1.7, head: ADULT_D, limb: ADULT_D * .25, D: ADULT_D, ages: AGES };
export const POSE0 = Object.freeze({
  facing: 1, turn: 0, back: false, hip: null, lean: 0,
  head: { tilt: 0, nod: 0, turn: 0 },
  armL: { sh: 0, el: 0 }, armR: { sh: 0, el: 0 },
  legL: { hip: 0, knee: 0, foot: 0 }, legR: { hip: 0, knee: 0, foot: 0 },
  handL: 'nub', handR: 'nub', near: 'R',
});
const deep = (a, b) => { const o = Array.isArray(a) ? a.slice() : { ...a }; for (const k in b || {}) { const v = b[k]; o[k] = v && typeof v === 'object' && !Array.isArray(v) && a?.[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? deep(a[k], v) : v; } return o; };
/** a copy of POSE0 with overrides (deep for head / arms / legs) */
export const pose = (over = {}) => deep(POSE0, over);

// =====================================================================================================================
// THE FIGURE
// =====================================================================================================================
let FIG_ID = 0;
export class Figure {
  constructor(look0 = {}) {
    const look = this.look = normLook(look0);
    const A = AGES[look.age], k = (look.scale ?? 1), D = A.D * k, u = v => v * D;
    this.id = ++FIG_ID; this.D = D;
    const kH = look.headScale ?? 1, H = D * kH + u(A.neck + A.torso + A.thigh + A.shin + A.ankle); this.HD = D; this.kH = kH;
    this.dims = { height: H, headD: D, headR: D / 2, headScale: kH, D, neck: u(A.neck), torso: u(A.torso), upperArm: u(A.upper), foreArm: u(A.fore), thigh: u(A.thigh), shin: u(A.shin),
      foot: u(A.foot), footH: u(A.footH), ankle: u(A.ankle), limbW: u(A.limb), shoulderW: u(A.torsoW + A.limb), hipW: u(A.limb * 2.1), hipY: u(A.ankle + A.shin + A.thigh),
      neckY: u(A.ankle + A.shin + A.thigh + A.torso), sleeveW: u(A.sleeve), age: look.age, depth: LY.top * S, nub: u(A.limb * 1.08),
      kneeY: u(A.ankle + A.shin), seatH: u(A.ankle + A.shin) - u(A.limb) / 2, floorK2: .62 };
    // seatH: the seat on which a seated figure has level thighs, vertical shins, flat feet. floorK2: the shin length factor (pose k2)
    // for shins lying on the floor (kneeling, sitting on the heels / on the floor): the references draw the lying shin + foot only
    // ~1 D long (timeloop f7400) while a seated shin is ~1.4 D (sister f1906), so floor poses shorten it
    this.height = H; this.headR = D * kH / 2; this.A = A; this.u = u;
    const extra = !!look.extra;
    this.bodyCol = look.body || (extra ? (look.tint || COL.extra) : COL.body);
    this.farCol = look.farBody || (extra ? shade(this.bodyCol, -.25) : COL.far);
    this.mBody = mat(this.bodyCol); this.mFar = mat(this.farCol);
    this.root = new THREE.Group(); this.root.name = 'figure:' + (look.name || look.id || 'someone');
    this.root.userData.figure = this;
    // contact shadow on the floor (1.6 D x 0.2 D, ~30 %)
    this.shadow = softShadow(u(.85), u(.16), { opacity: look.shadow ?? .3 }); this.shadow.rotation.x = -PI / 2; this.shadow.position.y = .004; this.root.add(this.shadow);
    this.body = node(this.root, 0, 0, 0, 'body');
    this.rimMat = mat(RIMS.warm, { unique: true }); this.rimMat.userData.own = true;
    this.turnParts = []; this.segs = {}; this.hairItems = []; this.held = []; this.backOnly = []; this.frontOnly = [];
    this._build();
    this.rims = []; this._rimDir = [.35, .94]; this._rimOn = look.rim !== null && look.rim !== false;
    this.face = null; this.faceState = { expr: look.expr || 'neutral' };
    if (!extra && look.face !== false) { this.face = new Face(look, { head: this.bodyCol }); this.face.root.scale.set(D, D, 1); this.face.root.position.z = LY.face * S; this.headNode.add(this.face.root); }
    this._view = { yaw: 0, pitch: 0, back: false, mirror: 1 };
    this.J = {};
    this.setRim(look.rim === undefined ? RIMS.warm : look.rim, look.rimDir || this._rimDir);
    this.setPose(POSE0);
    this.setFace(this.faceState);
  }
  // ---------------------------------------------------------------- build
  _build() {
    const { u, A, look, dims } = this, o = look.outfit, G0 = GARMENTS[o.top] || GARMENTS.none;
    this.G0 = G0;
    // hips (legs hang from here, no lean) and the torso bone (leans)
    this.hips = node(this.body, 0, dims.hipY, 0, 'hips');
    this.torsoBone = node(this.hips, 0, 0, 0, 'torso');
    // ---- legs
    this.legs = {};
    for (const side of ['L', 'R']) this.legs[side] = this._leg(side);
    // ---- torso (black capsule; width follows the turn)
    this.torsoMesh = ms(null, this.mBody, LY.torso * S, 'torso'); this.torsoMesh.userData.sil = true; this.torsoBone.add(this.torsoMesh);
    const tW = t => u(lerp(A.torsoW, A.torsoS, t)), tLen = dims.torso + u(.08);
    this._turnGeo(this.torsoMesh, t => { const w = tW(t), r = Math.min(w / 2, u(.2)); return fillGeo(`torso|${f4(w)}|${f4(tLen)}|${f4(r)}`, () => rrPts(w, tLen, [r, r, r * .6, r * .6]).map(([x, y]) => [x, y + tLen / 2 - u(.08)])); });
    // ---- neck (a limb-thick capsule from the head centre to below the collar, drawn over the garment)
    const neckW = Math.max(dims.limbW, u(.17)), neckLen = this.HD / 2 + u(A.neck + .07);
    this.neckBone = node(this.torsoBone, 0, dims.torso, 0, 'neck');
    this.headNode = node(this.neckBone, 0, dims.neck + dims.headR, (LY.head - LY.torso) * S * 0, 'head');
    const neck = ms(G(`neck|${f4(neckLen)}|${f4(neckW)}`, () => capsule(neckLen, neckW).geometry), this.mBody, (LY.neck - LY.head) * S, 'neck');
    neck.userData.sil = true; this.headNode.add(neck); this.neckMesh = neck; this._neckLen = neckLen;
    // the head node sits at z of the head layer relative to the torso bone
    this.headNode.position.z = 0; this.neckBone.position.z = 0;
    const head = ms(circle(dims.headR).geometry, this.mBody, LY.head * S, 'headDisc'); head.userData.sil = true; this.headNode.add(head);
    neck.position.z = LY.neck * S;
    this.headDisc = head; this.head = this.headNode;   // (fig.head: the head node, for the placeholder Actor's head())
    // ---- arms
    this.arms = {};
    for (const side of ['L', 'R']) this.arms[side] = this._arm(side);
    // ---- clothes, hair, hats
    this._garment();
    this._hair();
    this._hat();
    this._accessories();
    this._cast();
    // keep the head node z = 0 (its children carry absolute layer z); everything under torsoBone is at absolute layer z too
  }
  /** register a mesh whose geometry depends on the turn (quantised to 0.1) */
  _turnGeo(mesh, make, extra) { this.turnParts.push({ mesh, make, extra }); }
  // ---- limb segments with a length factor (pose k1 / k2: foreshortening toward the camera; geometry swaps, quantised to 0.05) ----
  _seg(key, len) { return this.segs[key] ??= { len, k: 1, parts: [], moves: [], scales: [] }; }
  _segPart(key, len, mesh, make) { this._seg(key, len).parts.push({ mesh, make }); }
  _segMove(key, len, obj) { this._seg(key, len).moves.push({ obj, y0: obj.position.y }); }
  /** a node whose y scale follows the segment's length factor (the plaster cast on a foreshortened forearm) */
  _segScale(key, len, obj) { this._seg(key, len).scales.push(obj); }
  _segK(key, k) {
    const s = this.segs[key]; if (!s) return 1;
    const kq = Math.round(clamp(k ?? 1, .15, 1) * 20) / 20; if (kq === s.k) return kq;
    s.k = kq; for (const p of s.parts) p.mesh.geometry = p.make(s.len * kq); for (const m of s.moves) m.obj.position.y = m.y0 * kq;
    for (const o of s.scales) o.scale.y = kq;
    return kq;
  }
  _leg(side) {
    const { u, dims } = this, g = node(this.hips, 0, 0, 0, 'leg' + side);
    const thigh = node(g, 0, 0, 0, 'thigh' + side), shin = node(thigh, 0, -dims.thigh, 0, 'shin' + side), foot = node(shin, 0, -dims.shin, 0, 'foot' + side);
    const mT = ms(capsule(dims.thigh, dims.limbW).geometry, this.mBody, 0); mT.userData.sil = true; thigh.add(mT);
    const mS = ms(capsule(dims.shin, dims.limbW).geometry, this.mBody, 0); mS.userData.sil = true; shin.add(mS);
    this._segPart(side + 'thigh', dims.thigh, mT, L => capsule(L, dims.limbW).geometry); this._segMove(side + 'thigh', dims.thigh, shin);
    this._segPart(side + 'shin', dims.shin, mS, L => capsule(L, dims.limbW).geometry); this._segMove(side + 'shin', dims.shin, foot);
    const mF = ms(null, this.mBody, 0); mF.userData.sil = true; foot.add(mF);
    const fLen = t => lerp(dims.limbW * 1.12, dims.foot, smooth(clamp(t * 1.25)));
    this._turnGeo(mF, t => { const L = fLen(t), h = dims.footH; return G(`foot|${f4(L)}|${f4(h)}`, () => rrect(L, h, h / 2).geometry); },
      (t, m, yaw, lvl) => { const L = fLen(lvl); m.position.x = Math.max(0, L / 2 - dims.limbW * .56); m.position.y = 0; });
    return { g, thigh, shin, foot, meshes: [mT, mS, mF], pants: [], shoes: [mF] };
  }
  _arm(side) {
    const { u, dims } = this, g = node(this.torsoBone, 0, 0, 0, 'arm' + side); g.userData.rimDepth = true;
    const upper = node(g, 0, 0, AZ.upper * S, 'upper' + side), fore = node(upper, 0, -dims.upperArm, (AZ.fore - AZ.upper) * S, 'fore' + side), hand = node(fore, 0, -dims.foreArm, 0, 'hand' + side);
    const mU = ms(capsule(dims.upperArm, dims.limbW).geometry, this.mBody, 0); mU.userData.sil = true; upper.add(mU);
    const mF = ms(capsule(dims.foreArm, dims.limbW).geometry, this.mBody, 0); mF.userData.sil = true; fore.add(mF);
    this._segPart(side + 'upper', dims.upperArm, mU, L => capsule(L, dims.limbW).geometry); this._segMove(side + 'upper', dims.upperArm, fore);
    this._segPart(side + 'fore', dims.foreArm, mF, L => capsule(L, dims.limbW).geometry); this._segMove(side + 'fore', dims.foreArm, hand);
    const clothed = this.G0.sleeves && this.G0.sleeves !== 'none' && this.look.outfit.top !== 'none';
    // nub: 0.27 D, coming out of the sleeve end (mostly hidden in it) or the rounded end of a bare arm (hands NOTES A.1)
    const nubR = clothed ? Math.max(dims.limbW * .56, this.dims.sleeveW * .44) : dims.limbW * .54, grip = clothed ? nubR * .55 : dims.limbW * .32;
    const slot = node(hand, 0, -grip, (AZ.prop - AZ.fore) * S, 'slot' + side), slotFront = node(hand, 0, -grip, (AZ.propFront - AZ.fore) * S, 'slotFront' + side);
    const shapes = node(hand, 0, 0, (AZ.hand - AZ.fore) * S, 'shapes' + side);
    return { side, g, upper, fore, hand, slot, slotFront, shapes, limbs: [mU, mF], nubR, grip, cur: null, objs: {}, sleeves: [], sleeveFills: [] };
  }
  /** the medium-framing hand shapes (nub, mitten, fist, point, open, grip, glove:<pose>) - built lazily */
  _handShape(arm, kind) {
    if (arm.objs[kind]) return arm.objs[kind];
    const { u } = this, R = arm.nubR, m = this.mBody, g = new THREE.Group(); g.name = 'hand:' + kind;
    const add = (geo, x = 0, y = 0, rot = 0) => { const x0 = ms(geo, m, 0); x0.position.set(x, y, 0); x0.rotation.z = rot; x0.userData.sil = true; g.add(x0); return x0; };
    const gy = -arm.grip;
    if (kind === 'nub') add(circle(R).geometry, 0, gy);
    else if (kind === 'mitten') { add(rrect(u(.3), u(.27), u(.12)).geometry, 0, gy - u(.02)); add(ellipse(u(.07), u(.1)).geometry, u(.12), gy + u(.05), -.4); }
    else if (kind === 'grip') { add(rrect(u(.29), u(.24), u(.11)).geometry, 0, gy - u(.01)); add(capsule(u(.12), u(.09)).geometry, u(.13), gy + u(.07), .5); }
    else if (kind === 'fist') add(rrect(u(.3), u(.3), u(.13)).geometry, 0, gy - u(.02));
    else if (kind === 'point') { add(circle(R * .95).geometry, 0, gy); add(capsule(u(.27), u(.09)).geometry, u(.02), gy - u(.02), 0); }
    else if (kind === 'open') { add(rrect(u(.27), u(.24), u(.1)).geometry, 0, gy - u(.03)); [-18, -6, 6, 18].forEach((a, i) => add(capsule(u(.16 - Math.abs(i - 1.5) * .02), u(.065)).geometry, u(-.09 + i * .06), gy - u(.11), a * DEG)); add(capsule(u(.13), u(.075)).geometry, u(.13), gy, 55 * DEG); }
    else if (kind.startsWith('glove:')) { const h = new GloveHand(this.look, { pose: kind.slice(6), size: u(.31), style: this.look.handStyle || 'glove', sleeve: false, rim: false }); h.root.rotation.z = PI; h.root.position.y = gy * .2; h.root.scale.z = .07; g.add(h.root); g.userData.glove = h; g.userData.noSil = true; }
    else add(circle(R).geometry, 0, gy);
    arm.shapes.add(g); arm.objs[kind] = g; this._rimDirty = true; return g;
  }
  // ---------------------------------------------------------------- clothes
  _garment() {
    const { u, A, dims, look } = this, o = look.outfit, G0 = this.G0, top = o.top;
    if (top === 'none') { this._pants(o); return; }
    const col = o.color, line = o.line || mixHex(col, COL.lineDark, .62), shd = o.shade || shade(col, -.15), lw = u(.022);
    const mC = mat(col), mL = mat(line), mS = mat(shd);
    this.cloth = { col, line, shd, mC, mL, mS, lw };
    // front: as wide as the hanging sleeves' centre lines (the sleeves cover the sides); side: the body plus the cloth's bulk
    const sl = (o.sleeves || G0.sleeves) && (o.sleeves || G0.sleeves) !== 'none', tb = this.torsoBone, padF = sl ? A.torsoW + A.limb - .1 : A.torsoW + A.pad, padS = A.torsoS + (sl ? .24 : .16);
    const topY = dims.torso + u(.06);
    // hems relative to the hip pivot: a hoodie ends 0.41 H above the soles, just below the hip (line-up iq500 f12650)
    const hemRel = { hip: -dims.thigh * .22, low: -dims.thigh * .45, knee: -dims.thigh + u(.08), shin: -dims.thigh - dims.shin * .5 }[o.hem || G0.hem || 'hip'];
    const long = hemRel < -u(.45);
    const panelBot = long ? u(-.02) : hemRel, ph = topY - panelBot;
    const W = t => u(lerp(padF, padS, t));
    // the body panel (outline ring + fill, same depth), rounded shoulders
    const rTop = u(.12), rBot = u(.05);
    const pFill = ms(null, mC, LY.panel * S, 'panel'), pLine = ms(null, mL, LY.panel * S, 'panelLine'); pLine.userData.sil = true;
    tb.add(pFill, pLine);
    const panelPts = (w, g) => rrPts(w + 2 * g, ph + 2 * g, [rTop + g, rTop + g, rBot + g, rBot + g]).map(([x, y]) => [x, y + (topY + panelBot) / 2]);
    this._turnGeo(pFill, t => { const w = W(t); return fillGeo(`panel|${f4(w)}|${f4(ph)}|${f4(topY)}`, () => panelPts(w, 0)); });
    this._turnGeo(pLine, t => { const w = W(t); return ringGeo(`panel|${f4(w)}|${f4(ph)}|${f4(topY)}|${f4(lw)}`, () => panelPts(w, lw), () => panelPts(w, 0)); });
    // shade band on the side away from the light (inset so it never sticks out)
    const band = ms(null, mS, LY.d0 * S, 'shadeBand'); tb.add(band);
    this._turnGeo(band, t => { const w = W(t) * .26, h = ph - rTop - rBot; return G(`band|${f4(w)}|${f4(h)}`, () => rrect(w, h, 0).geometry); },
      (t, m) => { const w = W(t); m.position.set(-this._shadeSide * (w / 2 - w * .13), (topY - rTop + panelBot + rBot) / 2, LY.d0 * S); });
    this._shadeSide = 1;
    // the skirt of a long garment: from the waist to the hem, follows the thighs (sitting folds it forward)
    if (long) {
      const fl = u(G0.flare ?? .12), sh = -hemRel + u(.06), skW = t => W(t) * (G0.waist ? .82 : 1), skCol = G0.skirt ? (o.color2 || '#3a3a46') : col;
      const mK = mat(skCol), mKL = mat(G0.skirt ? mixHex(skCol, COL.lineDark, .62) : line);
      this.skirt = node(this.hips, 0, u(.04), 0, 'skirt');
      const sF = ms(null, mK, LY.skirt * S), sL = ms(null, mKL, LY.skirt * S); sL.userData.sil = true; this.skirt.add(sF, sL);
      const sp = (w, g) => trapPts(w + 2 * g, w + fl * 2 + 2 * g, sh + 2 * g, u(.03) + g, u(.05) + g).map(([x, y]) => [x, y + g]);
      this._turnGeo(sF, t => { const w = skW(t); return fillGeo(`skirt|${f4(w)}|${f4(fl)}|${f4(sh)}`, () => sp(w, 0)); });
      this._turnGeo(sL, t => { const w = skW(t); return ringGeo(`skirt|${f4(w)}|${f4(fl)}|${f4(sh)}|${f4(lw)}`, () => sp(w, lw), () => sp(w, 0)); });
      this.skirtLen = sh;
      // folds: darker vertical stripes on long garments
      const nf = o.folds ?? G0.folds ?? 0, ns = G0.stripes || 0;
      for (let i = 0; i < nf + ns; i++) { const st = ms(G(`fold|${f4(sh * .82)}`, () => rrect(u(.035), sh * .82, u(.017)).geometry), i < nf ? mat(shade(skCol, -.2)) : mat(shade(skCol, -.22)), LY.skirtDet * S); st.position.y = -sh * .5; this.skirt.add(st); st.userData.fold = i; st.userData.nf = nf + ns; this._turnGeo(st, null, (t, m) => { const w = skW(t) + fl, n = m.userData.nf; m.position.x = (n === 1 ? .05 : -.32 + .64 * m.userData.fold / Math.max(1, n - 1)) * w * (1 - t * .3) + t * w * .1; }); }
      if (G0.open) { // the open front of a lab coat shows the inner layer on the skirt too
        const inn = ms(G(`inner|${f4(sh)}`, () => rrect(u(.16), sh * .55, u(.02)).geometry), mat(G0.inner || '#67594f'), LY.skirtDet * S); inn.position.y = -sh * .25; this.skirt.add(inn); this.frontOnly.push(inn);
        this._turnGeo(inn, null, (t, m) => { m.position.x = W(t) * .38 * t; m.scale.x = 1 - t * .6; m.visible = !this._back; });
      }
    }
    // stripes on a robe body too
    if (G0.stripes && G0.stripes > 1) for (let i = 0; i < 3; i++) { const st = ms(G(`rstripe|${f4(ph)}`, () => rrect(u(.035), ph * .75, u(.017)).geometry), mat(shade(col, -.2)), LY.d0 * S); st.position.y = (topY + panelBot) / 2 - u(.08); tb.add(st); this._turnGeo(st, null, (t, m) => { m.position.x = (-.25 + .25 * i) * W(t); }); }
    this._collar(G0, o, topY, W);
    this._details(G0, o, topY, panelBot, W, hemRel);
    this._sleeves(G0, o);
    this._pants(o);
  }
  _collar(G0, o, topY, W) {
    const { u, dims } = this, { mC, mL, lw, col } = this.cloth, tb = this.torsoBone, c = o.collar || G0.collar;
    if (c === 'hood' && o.hood !== 'up') {
      // hood down: in front view a collar rising behind the neck up the lower head sides; in profile a bump 0.25 D behind the back, 0.6 D long
      const hF = ms(null, mC, LY.hood * S, 'hood'), hL = ms(null, mL, LY.hood * S, 'hoodLine'); hL.userData.sil = true; tb.add(hF, hL);
      // front view (iq500 f12650): a collar 0.9 D wide rising behind the neck to about the mouth line on both sides of the head
      const hp = (t, g) => { const w = u(lerp(.8, .44, t)), h = u(lerp(.95, .64, t)), r = Math.min(w, h) * .48; return rrPts(w + 2 * g, h + 2 * g, [r + g, r + g, r * .7 + g, r * .7 + g]); };
      const hpos = (t, m) => m.position.set(-u(lerp(0, .25, smooth(t))), dims.torso + u(lerp(.27, -.12, smooth(t))), (this._back ? LY.cb : LY.hood) * S);   // seen from behind the hood covers the neck
      this._turnGeo(hF, t => fillGeo(`hood|${t.toFixed(1)}|${f4(dims.D)}`, () => hp(t, 0)), hpos);
      this._turnGeo(hL, t => ringGeo(`hood|${t.toFixed(1)}|${f4(dims.D)}|${f4(lw)}`, () => hp(t, lw), () => hp(t, 0)), hpos);
      // the hood's inside seen at the collar: a darker V notch behind the neck (iq500 f4313), front and 3/4 views
      const notchPts = g => roundPoly([[-u(.24) - g, u(.08) + g], [u(.24) + g, u(.08) + g], [0, -u(.2) - g]], [u(.03), u(.03), u(.04)]);
      const inside = ms(fillGeo(`hoodNotch|${f4(dims.D)}`, () => notchPts(0)), mat(shade(col, -.32)), LY.hoodIn * S, 'hoodInside'), insideL = ms(ringGeo(`hoodNotch|${f4(dims.D)}|${f4(lw)}`, () => notchPts(lw), () => notchPts(0)), mL, LY.hoodIn * S);
      const ins = node(tb, 0, 0, 0, 'hoodNotch'); ins.add(inside, insideL); this.frontOnly.push(ins);
      this._turnGeo(null, null, t => { ins.position.set(u(lerp(0, .12, t)), dims.torso + u(.0), 0); ins.scale.x = 1 - t * .6; ins.visible = !this._back && t < .8; });
      if (o.strings ?? G0.strings) {
        const sm = mat(o.stringColor || COL.string);
        for (const s of [-1, 1]) { const st = ms(G(`string|${f4(dims.D)}`, () => rrect(u(.02), u(.46), u(.01)).geometry), sm, LY.ca * S, 'string'); const tip = ms(G(`stringTip|${f4(dims.D)}`, () => rrect(u(.034), u(.06), u(.015)).geometry), sm, 1 * S); tip.position.y = -u(.23);
          const sg = node(tb, 0, 0, 0, 'string'); sg.add(st); st.add(tip); st.position.y = -u(.0); this.frontOnly.push(sg);
          this._turnGeo(null, null, t => { sg.position.set(u(lerp(s * .115, .2 + s * .02, smooth(t))), dims.torso - u(.25) + u(lerp(0, .02, t)), 0); sg.visible = !this._back && (t < .8 || s > 0); }); }
      }
    } else if (c === 'hood' && o.hood === 'up') {
      // hood up: a rounded hood around the head (behind the head disc, in the garment colour) with its rim outline
      const hu = node(this.headNode, 0, 0, 0, 'hoodUp');
      const R = dims.headR * 1.3, hF = ms(circle(R).geometry, mC, LY.hairBack * S), hL = ms(ring(R, R + lw).geometry, mL, LY.hairBack * S); hL.userData.sil = true; hF.userData.sil = true;
      const opening = ms(ring(dims.headR, dims.headR + u(.05)).geometry, mat(shade(col, -.3)), LY.face * S); hu.add(hF, hL, opening);
      hF.position.y = hL.position.y = -u(.1); hu.position.z = 0;
      this._turnGeo(null, null, t => { hF.position.x = hL.position.x = -u(.12) * smooth(t); });
    } else if (c === 'crew' || c === 'v' || c === 'shirt' || c === 'stand' || c === 'lapel') {
      const neckLine = ms(null, mL, LY.d2 * S, 'collar'); tb.add(neckLine); this.frontOnly.push(neckLine);
      if (c === 'crew') neckLine.geometry = G(`crew|${f4(dims.D)}`, () => lineGeo(`crew${f4(dims.D)}`, [[-u(.15), u(.0)], [-u(.08), -u(.07)], [0, -u(.09)], [u(.08), -u(.07)], [u(.15), 0]], lw * 1.3));
      else neckLine.geometry = G(`vneck|${f4(dims.D)}|${c}`, () => lineGeo(`v${c}${f4(dims.D)}`, [[-u(.15), u(.0)], [0, -u(c === 'v' ? .32 : c === 'lapel' ? .55 : .16)], [u(.15), 0]], lw * 1.3));
      this._turnGeo(neckLine, null, (t, m) => { m.position.set(u(lerp(0, .18, t)), dims.torso + u(.03), LY.d2 * S); m.scale.x = 1 - .55 * t; m.visible = !this._back; });
      if (c === 'v' || c === 'lapel') { // the V shows the black body (or a shirt)
        const vIn = ms(G(`vin|${f4(dims.D)}|${c}`, () => new THREE.ShapeGeometry(shapeOf([[-u(.15), 0], [0, -u(c === 'v' ? .32 : .55)], [u(.15), 0]]))), G0.shirtV ? mat(o.shirt || '#eceaf2') : G0.open ? mat(G0.inner || '#67594f') : this.mBody, LY.d1 * S, 'vIn');
        tb.add(vIn); this.frontOnly.push(vIn);
        this._turnGeo(vIn, null, (t, m) => { m.position.set(u(lerp(0, .18, t)), dims.torso + u(.03), LY.d1 * S); m.scale.x = 1 - .55 * t; m.visible = !this._back; });
      }
      if (c === 'shirt') { // collar points
        for (const s of [-1, 1]) { const cp = ms(G(`cpt|${f4(dims.D)}`, () => new THREE.ShapeGeometry(shapeOf([[0, 0], [u(.13), u(.0)], [u(.05), -u(.11)]]))), mat(shade(col, .15)), LY.d1 * S); const n0 = node(tb, 0, 0, 0); n0.add(cp); cp.scale.x = s; this.frontOnly.push(n0);
          this._turnGeo(null, null, t => { n0.position.set(u(lerp(s * .02, .16, t)), dims.torso + u(.04), 0); n0.scale.x = 1 - .5 * t; n0.visible = !this._back && (t < .8 || s > 0); }); }
      }
    }
  }
  _details(G0, o, topY, bot, W, hemRel) {
    const { u, dims } = this, { mC, mL, mS, lw, col } = this.cloth, tb = this.torsoBone;
    const at = (m, fx, y, scaleX = true) => this._turnGeo(null, null, t => { m.position.x = u(lerp(fx[0], fx[1], t)) * (W(t) / u(.6)); m.position.y = y; if (scaleX) m.scale.x = 1 - .45 * t; m.visible = !this._back; });
    if (o.pocket ?? G0.pocket) { // kangaroo pocket on the hem
      const pw = u(.5), phh = u(.4), pk = node(tb, 0, 0, LY.d1 * S, 'pocket');
      const pp = g => trapPts(pw * .78 + 2 * g, pw + 2 * g, phh + 2 * g, u(.03) + g, u(.02) + g).map(([x, y]) => [x, y + g]);
      const pf = ms(fillGeo(`pocket|${f4(pw)}`, () => pp(0)), mat(shade(col, -.13)), 0), po = ms(ringGeo(`pocket|${f4(pw)}|${f4(lw)}`, () => pp(lw * .8), () => pp(0)), mL, 0);
      const pl = ms(G(`pocketTop|${f4(pw)}`, () => lineGeo(`pocketTop${f4(pw)}`, [[-pw * .37, -lw], [pw * .37, -lw]], lw * 1.1)), mat(mixHex(col, '#ffffff', .3)), 1 * S); pk.add(pf, po, pl);
      at(pk, [0, .14], bot + phh + u(.01)); this.frontOnly.push(pk);
    }
    if (o.zip ?? G0.zip) { const z = ms(G(`zip|${f4(topY - bot)}`, () => rrect(lw * 1.1, topY - bot - u(.1), 0).geometry), mL, LY.d2 * S); tb.add(z); at(z, [0, .27], (topY + bot) / 2 - u(.05), false); this.frontOnly.push(z); }
    if (o.buttons ?? G0.buttons) { const bm = mat(shade(col, -.35)); for (let i = 0; i < 4; i++) { const b = ms(circle(u(.022)).geometry, bm, LY.d2 * S); tb.add(b); at(b, [G0.collar === 'lapel' ? .05 : 0, .28], dims.torso - u(.3) - i * (topY - bot - u(.4)) / 4, false); this.frontOnly.push(b); } }
    if (o.belt ?? G0.belt) { const bc = typeof (o.belt ?? G0.belt) === 'string' ? (o.belt ?? G0.belt) : shade(col, -.3); const b = ms(null, mat(bc), LY.d1 * S, 'belt'); tb.add(b);
      this._turnGeo(b, t => { const w = W(t) + lw * 2; return G(`belt|${f4(w)}`, () => rrect(w, u(.09), u(.02)).geometry); }, (t, m) => { m.position.set(0, u(.12), LY.d1 * S); }); }
    if (o.chestPocket ?? G0.chestPocket) { const p = ms(G(`cpk|${f4(dims.D)}`, () => rrect(u(.15), u(.14), u(.02)).geometry), mS, LY.d1 * S); tb.add(p); at(p, [.15, .3], dims.torso - u(.45)); this.frontOnly.push(p); }
    if ((o.badge ?? G0.badge) === 'star') { const b = ms(G('star5|' + f4(dims.D), () => { const s = []; for (let i = 0; i < 10; i++) { const a = PI / 2 + i * PI / 5, r = i % 2 ? u(.03) : u(.07); s.push([Math.cos(a) * r, Math.sin(a) * r]); } return new THREE.ShapeGeometry(shapeOf(s)); }), mat('#e8c14a'), LY.d2 * S); tb.add(b); at(b, [-.15, .1], dims.torso - u(.4)); this.frontOnly.push(b); }
    if (o.badge === 'card' || o.lanyard) { // ID card on a lanyard
      const ln = ms(G(`lany|${f4(dims.D)}`, () => lineGeo(`lany${f4(dims.D)}`, [[-u(.1), u(.05)], [0, -u(.55)], [u(.1), u(.05)]], u(.02))), mat('#26262e'), LY.ca * S), card = ms(G(`card|${f4(dims.D)}`, () => rrect(u(.17), u(.22), u(.02)).geometry), mat('#f4f2ec'), LY.cb * S), stripe = ms(G(`cardS|${f4(dims.D)}`, () => rrect(u(.17), u(.05), 0).geometry), mat('#d8433b'), LY.cc * S);
      const g = node(tb, 0, 0, 0, 'lanyard'); g.add(ln, card, stripe); card.position.y = -u(.65); stripe.position.y = -u(.6); this.frontOnly.push(g);
      this._turnGeo(null, null, t => { g.position.set(u(lerp(0, .18, t)), dims.torso, 0); g.scale.x = 1 - .5 * t; g.visible = !this._back; });
    }
    if (o.whistle) { const g = node(tb, 0, 0, 0, 'whistle'); g.add(ms(G(`lany|${f4(dims.D)}`, () => lineGeo(`lany${f4(dims.D)}`, [[-u(.1), u(.05)], [0, -u(.55)], [u(.1), u(.05)]], u(.02))), mat('#e6e2da'), LY.ca * S)); const w = ms(G(`whis|${f4(dims.D)}`, () => rrect(u(.1), u(.07), u(.03)).geometry), mat('#cfd3da'), LY.cb * S); w.position.y = -u(.58); g.add(w); this.frontOnly.push(g); this._turnGeo(null, null, t => { g.position.set(u(lerp(0, .18, t)), dims.torso, 0); g.scale.x = 1 - .5 * t; g.visible = !this._back; }); }
    if (o.tie ?? G0.tie) {
      const tc = typeof (o.tie ?? G0.tie) === 'string' ? (o.tie ?? G0.tie) : (o.color2 || '#2f6fd8'), tl = mixHex(tc, COL.lineDark, .5), L = u(1.25);
      const kite = (g) => [[0, g], [u(.05) + g, -u(.08)], [u(.065) + g, -L * .8], [0, -L - g], [-u(.065) - g, -L * .8], [-u(.05) - g, -u(.08)]];
      const tg = node(tb, 0, 0, 0, 'tie'); const tf = ms(fillGeo(`tie|${f4(L)}`, () => kite(0)), mat(tc), LY.ca * S), tli = ms(ringGeo(`tie|${f4(L)}|${f4(lw)}`, () => kite(lw * .8), () => kite(0)), mat(tl), LY.ca * S);
      const knot = ms(G(`knot|${f4(dims.D)}`, () => rrect(u(.1), u(.08), u(.025)).geometry), mat(tc), LY.cb * S); knot.position.y = -u(.02); tg.add(tf, tli, knot); this.frontOnly.push(tg);
      this._turnGeo(null, null, t => { tg.position.set(u(lerp(0, .2, t)), dims.torso - u(.05), 0); tg.scale.x = 1 - .55 * t; tg.visible = !this._back; });
    }
    if (G0.rib) { const r = ms(null, mS, LY.d1 * S); tb.add(r); this._turnGeo(r, t => { const w = W(t); return G(`rib|${f4(w)}`, () => rrect(w, u(.1), u(.03)).geometry); }, (t, m) => m.position.set(0, bot + u(.05), LY.d1 * S)); }
    if (G0.apron || o.apron) { const ac = o.apron || G0.apron, am = mat(ac), al = mat(mixHex(ac, COL.lineDark, .35));
      const bib = ms(G(`bib|${f4(dims.D)}`, () => rrect(u(.36), u(.5), u(.04)).geometry), am, LY.d1 * S); bib.position.y = dims.torso - u(.45); const g = node(tb, 0, 0, 0, 'apron'); g.add(bib);
      const sk = ms(G(`apsk|${f4(dims.D)}`, () => new THREE.ShapeGeometry(shapeOf(trapPts(u(.5), u(.62), u(1.25), u(.03), u(.05))))), am, LY.d1 * S); sk.position.y = u(.45); g.add(sk);
      const tie = ms(G(`aptie|${f4(dims.D)}`, () => rrect(u(.62), u(.05), 0).geometry), al, LY.d2 * S); tie.position.y = u(.45); g.add(tie); this.frontOnly.push(g);
      this._turnGeo(null, null, t => { g.position.x = u(lerp(0, .12, t)); g.scale.x = 1 - .4 * t; g.visible = !this._back; }); }
    if (G0.armor) { const lm = mat(shade(col, -.35)), glowM = mat('#5ff2f0'); for (let i = 0; i < 4; i++) { const s = ms(null, lm, LY.d1 * S); tb.add(s); this._turnGeo(s, t => { const w = W(t) * .9; return G(`aseg|${f4(w)}`, () => rrect(w, lw * 1.4, 0).geometry); }, (t, m) => m.position.set(0, dims.torso - u(.45) - i * u(.38), LY.d1 * S)); }
      const core = ms(ring(u(.05), u(.08)).geometry, glowM, LY.d2 * S); tb.add(core); at(core, [0, .2], dims.torso - u(.35)); this.frontOnly.push(core); }
    void hemRel; void mC;
  }
  _sleeves(G0, o) {
    const kind = o.sleeves || G0.sleeves; if (!kind || kind === 'none') return;
    const { u, dims } = this, { mC, mL, mS, lw, col, shd } = this.cloth, sw = kind === 'wide' ? dims.sleeveW * 1.35 : dims.sleeveW;
    const cuffCol = o.cuffColor || G0.cuffColor || null;
    for (const side of ['L', 'R']) {
      const arm = this.arms[side];
      // upper sleeve: a capsule over the upper arm (short sleeves end half way)
      const ul = kind === 'short' ? dims.upperArm * .5 : dims.upperArm;
      const upF = ms(null, mC, 0, 'sleeveU'), upL = ms(null, mL, 0, 'sleeveULine'); upL.userData.sil = true; upF.userData.sil = true;
      const capOrBox = (len, w, g, flatEnd) => flatEnd ? rrPts(w + 2 * g, len + w / 2 + 2 * g, [w / 2 + g, w / 2 + g, u(.05) + g, u(.05) + g]).map(([x, y]) => [x, y - (len - w / 2) / 2]) : capPts(len, w / 2 + g);
      upF.geometry = fillGeo(`slvU|${f4(ul)}|${f4(sw)}|${kind}`, () => capOrBox(ul, sw, 0, kind === 'short'));
      upL.geometry = uLineGeo(ul, sw, lw, kind === 'short', u(.05));   // no outline across the shoulder end: the sleeve merges into the garment
      upF.position.z = upL.position.z = AZ.sleeveU * S; arm.upper.add(upF, upL);
      arm.sleeves.push(upL); arm.sleeveFills.push(upF);
      const ur = ul / dims.upperArm, short = kind === 'short';
      this._segPart(side + 'upper', dims.upperArm, upF, L => fillGeo(`slvU|${f4(L * ur)}|${f4(sw)}|${kind}`, () => capOrBox(L * ur, sw, 0, short)));
      this._segPart(side + 'upper', dims.upperArm, upL, L => uLineGeo(L * ur, sw, lw, short, u(.05)));
      if (kind !== 'short') {
        arm.limbs[0].visible = false; arm.limbs[0].userData.covered = true;
        const fl = dims.foreArm - u(.04);
        // the forearm sleeve: its outline is a U (sides + cuff end) so a straight arm reads as one sleeve, no line at the elbow
        const foF = ms(fillGeo(`slvF|${f4(fl)}|${f4(sw)}`, () => capOrBox(fl, sw, 0, true)), mC, 0, 'sleeveF'), foL = ms(uLineGeo(fl, sw, lw, true, u(.05)), mL, 0, 'sleeveFLine'); foL.userData.sil = true; foF.userData.sil = true;
        arm.fore.add(foF, foL); arm.sleeves.push(foL); arm.sleeveFills.push(foF);
        arm.limbs[1].visible = false; arm.limbs[1].userData.covered = true;
        // cuff band (darker, ~0.1 D) or a white shirt cuff; a white watch strap on whoever wears one
        if (o.cuff ?? G0.cuff ?? !!cuffCol) { const cf = ms(G(`cuff|${f4(sw)}`, () => rrect(sw, u(.1), [0, 0, u(.05), u(.05)]).geometry), cuffCol ? mat(cuffCol) : mat(shade(col, -.2)), (AZ.cuff - AZ.fore) * S, 'cuff'); cf.position.y = -fl + u(.05); arm.fore.add(cf); }
        if (o.watch === true || o.watch === side || (o.watch === 'both')) { const wa = ms(G(`watch|${f4(sw)}`, () => rrect(sw * 1.04, u(.075), u(.02)).geometry), mat(o.watchColor || COL.watch), (AZ.watch - AZ.fore) * S, 'watch'); wa.position.y = -fl + u(.035); arm.fore.add(wa);
          const face = ms(circle(u(.026)).geometry, mat('#5a5c66'), (AZ.watchFace - AZ.fore) * S); face.position.set(sw * .12, wa.position.y, (AZ.watchFace - AZ.fore) * S); arm.fore.add(face); }
        if (G0.stripes === true) { const st = ms(G(`tstripe|${f4(fl)}`, () => rrect(u(.04), fl * .8, 0).geometry), mat('#f2efe9'), (AZ.foreLine - AZ.fore) * S); st.position.set(sw * .28, -fl * .45, 0); arm.fore.add(st); }
        // foreshortening (pose k2): the forearm sleeve shortens, the cuff / watch / stripes follow its end
        const sk = side + 'fore', cut = u(.04);
        this._segPart(sk, dims.foreArm, foF, L => fillGeo(`slvF|${f4(L - cut)}|${f4(sw)}`, () => capOrBox(L - cut, sw, 0, true)));
        this._segPart(sk, dims.foreArm, foL, L => uLineGeo(L - cut, sw, lw, true, u(.05)));
        for (const c of arm.fore.children) if (c.isMesh && c !== foF && c !== foL && c !== arm.limbs[1]) this._segMove(sk, dims.foreArm, c);
      }
      if (G0.armor) { const ring1 = ms(ring(u(.07), u(.1)).geometry, mat('#5ff2f0'), (AZ.cuff - AZ.fore) * S); arm.fore.add(ring1); const ring0 = ms(ring(u(.07), u(.1)).geometry, mat('#5ff2f0'), 2 * S); ring0.position.y = 0; arm.upper.add(ring0); }
      arm.shade = mS; arm.fill = mC; void shd;
    }
  }
  _pants(o) {
    const pc = o.pants === 'self' || (o.pants === undefined && this.G0.pants === 'self') ? o.color : o.pants;
    const { dims, u } = this;
    if (pc) {
      const lw = u(.022), m = mat(pc), ml = mat(mixHex(pc, COL.lineDark, .6)), pw = dims.limbW + u(.07);
      for (const side of ['L', 'R']) { const L = this.legs[side];
        for (const [bone, len, key, full, cut] of [[L.thigh, dims.thigh, side + 'thigh', dims.thigh, 0], [L.shin, dims.shin - u(.06), side + 'shin', dims.shin, u(.06)]]) { const f = ms(fillGeo(`pant|${f4(len)}|${f4(pw)}`, () => capPts(len, pw / 2)), m, 0), l = ms(uLineGeo(len, pw, lw, false), ml, 0); l.userData.sil = true; f.userData.sil = true; f.position.z = l.position.z = 1 * S; bone.add(f, l); L.pants.push(f, l);
          this._segPart(key, full, f, Ln => fillGeo(`pant|${f4(Ln - cut)}|${f4(pw)}`, () => capPts(Ln - cut, pw / 2))); this._segPart(key, full, l, Ln => uLineGeo(Ln - cut, pw, lw, false)); }
        L.meshes[0].visible = L.meshes[1].visible = false; L.meshes[0].userData.covered = L.meshes[1].userData.covered = true; L.pantsFill = m; L.pantsShade = mat(shade(pc, -.15)); }
    }
    if (o.shoes) for (const side of ['L', 'R']) this.legs[side].meshes[2].material = mat(o.shoes);
    if (this.G0.armor) for (const side of ['L', 'R']) { const k = ms(ring(u(.07), u(.1)).geometry, mat('#5ff2f0'), 2 * S); this.legs[side].shin.add(k); }
  }
  // ---------------------------------------------------------------- hair (black shapes outside the disc, placed on the head sphere)
  _hairItem(obj, o) { const n = node(this.headNode, 0, 0, 0, 'hair'); n.add(obj); n.userData = { lon: o.lon ?? 0, lat: o.lat ?? 90, out: o.out ?? 0, back: o.layer || 'back', rot: o.rot || 0, hang: !!o.hang, spread: !!o.spread, follow: o.follow ?? 1, minVz: o.minVz ?? -2 }; obj.traverse(c => { if (c.isMesh && o.sil !== false && !c.userData.noSil) c.userData.sil = true; }); this.hairItems.push(n); return n; }
  _hair() {
    const { u, dims, look } = this, h = look.hair || 'none', R = dims.headR, mB = this.mBody, hc = look.hairColor;
    const mH = hc ? mat(hc) : mB, accC = look.hairAcc || look.accent || FACE_COL.clip;
    const mA = mat(accC), mAL = mat(mixHex(accC, COL.lineDark, .45));
    const blob = (r, m = mH) => ms(circle(r).geometry, m, 0);
    if (h === 'tuft') { const s = new THREE.Shape(); s.moveTo(-u(.05), 0); s.quadraticCurveTo(-u(.01), u(.08), u(.04), u(.14)); s.quadraticCurveTo(u(.03), u(.06), u(.06), 0); this._hairItem(ms(G('tuft' + f4(dims.D), () => new THREE.ShapeGeometry(s)), mH), { lat: 90, out: -.02 }); }
    if (h === 'bun' || h === 'topbun') { const g = new THREE.Group(); g.add(blob(u(.12))); const rg = ms(ring(u(.085), u(.105), '#fff', { arc: [.3, 2.6] }).geometry, mat(look.bunRing || '#6d6873'), 1 * S); g.add(rg); this._hairItem(g, { lat: 78, lon: 180, out: .06 }); }
    if (h === 'buns') for (const s of [-1, 1]) this._hairItem(blob(u(.13)), { lat: 55, lon: s * 70, out: .07 });
    if (h === 'topknot' || h === 'ponytail-top') {
      // the sister look: a ball on the top-back with a coloured scrunchie bow and a strand hanging down behind the head
      const ball = blob(u(.13)); this._hairItem(ball, { lat: 60, lon: 180, out: .1 });
      // the strand arcs out behind the head and hangs to the chin (drawn toward -x = the back; it swings with pose.hair)
      const strand = new THREE.Shape(); strand.moveTo(u(.05), u(.04)); strand.quadraticCurveTo(-u(.44), -u(.02), -u(.42), -u(.7)); strand.quadraticCurveTo(-u(.4), -u(1.0), -u(.29), -u(.96)); strand.quadraticCurveTo(-u(.33), -u(.7), -u(.3), -u(.42)); strand.quadraticCurveTo(-u(.24), -u(.12), u(.06), -u(.05));
      const st = ms(G('strand3' + f4(dims.D), () => new THREE.ShapeGeometry(strand, 12)), mH, 0); this._hairItem(st, { lat: 60, lon: 180, out: .1, hang: true, spread: true });
      const bow = new THREE.Group(); const b1 = ms(G('bowL' + f4(dims.D), () => rrect(u(.13), u(.065), u(.032)).geometry), mA, 0); b1.rotation.z = .8; b1.position.set(-u(.05), u(.05), 0); const b2 = b1.clone(); b2.rotation.z = -.4; b2.position.set(u(.07), u(.06), 0); const knot = ms(circle(u(.04)).geometry, mA, 1 * S); const kl = ms(ring(u(.04), u(.052)).geometry, mAL, 1 * S); bow.add(b1, b2, knot, kl);
      this._hairItem(bow, { lat: 68, lon: 180, out: .26, layer: 'acc' });
    }
    if (h === 'ponytail') { const s = new THREE.Shape(); s.moveTo(0, u(.05)); s.quadraticCurveTo(-u(.16), -u(.15), -u(.06), -u(.62)); s.quadraticCurveTo(u(.02), -u(.4), u(.08), u(.0)); this._hairItem(ms(G('pony' + f4(dims.D), () => new THREE.ShapeGeometry(s, 10)), mH), { lat: 30, lon: 180, out: .02, hang: true });
      const tie = ms(rrect(u(.08), u(.06), u(.02)).geometry, mA, 0); this._hairItem(tie, { lat: 32, lon: 180, out: .06, layer: 'acc' }); }
    if (h === 'long' || h === 'bob' || h === 'bunlong') {
      // a hair curtain behind the head, down to the shoulders (long) or the chin (bob)
      const len = h === 'bob' ? u(.95) : u(1.45), w = h === 'bob' ? u(1.12) : u(1.1);
      const g = ms(G(`curtain|${f4(len)}|${f4(w)}`, () => rrect(w, len, [w / 2, w / 2, u(.14), u(.14)]).geometry), mH, 0); g.position.y = -len / 2 + w / 2 - u(.05);
      const c = new THREE.Group(); c.add(g);
      if (h === 'bunlong' || look.strands) { const sm = mat(look.strandColor || '#6b5a55'); [-.22, 0, .22].forEach((x, i) => { const l = ms(G(`strandl${i}|${f4(len)}`, () => lineGeo(`strandl${i}${f4(len)}`, [[u(x), -u(.35)], [u(x * 1.15), -len * .7]], u(.018))), sm, 1 * S); c.add(l); }); }
      this._hairItem(c, { lat: 0, lon: 180, out: 0, follow: .35, layer: 'back' });
      if (h === 'bunlong') { const b = new THREE.Group(); b.add(blob(u(.15))); b.add(ms(ring(u(.1), u(.125), '#fff', { arc: [.4, 2.4] }).geometry, mat('#6d6873'), 1 * S)); this._hairItem(b, { lat: 62, lon: 180, out: .08 }); }
    }
    if (h === 'curls' || h === 'afro') {
      // scalloped outline over the top: bumps outside the disc (+ brown "c" marks drawn by the face decals)
      const g = new THREE.Group(), big = h === 'afro', rr = big ? R * 1.38 : R * 1.08, n = big ? 14 : 11;
      if (big) g.add(ms(circle(R * 1.3).geometry, mH, 0));
      for (let i = 0; i < n; i++) { const a = (big ? -20 : 5) * DEG + i / (n - 1) * (big ? 220 : 170) * DEG, b = ms(circle(u(big ? .14 : .1)).geometry, mH, 0); b.position.set(Math.cos(a) * rr, Math.sin(a) * rr + (big ? u(.05) : 0), 0); g.add(b); }
      this._hairItem(g, { lat: 0, lon: 0, out: 0, follow: 0, layer: 'back' });
    }
    if (h === 'spikes') { const s = []; for (let i = 0; i <= 8; i++) { const a = (25 + i * 16.25) * DEG, r = i % 2 ? R * 1.0 : R * 1.22; s.push([Math.cos(a) * r, Math.sin(a) * r]); } s.push([0, 0]); this._hairItem(ms(G('spikes' + f4(dims.D), () => new THREE.ShapeGeometry(shapeOf(s))), mH), { lat: 0, lon: 0, follow: .2 }); }
    if ((h === 'greybun' || h === 'grey' || h === 'white' || h === 'greyShort') && look.hat) {
      // under a hat the grey hair is not drawn: a full hair cap read as a white band under the cap, side tufts as ears (video 1 review)
      void 0;
    } else if (h === 'greybun' || h === 'grey' || h === 'white' || h === 'greyShort') {
      // a light grey hair cap over the top of the head (+ a bun on the top-back), drawn ON the head
      const gc = look.hairColor || (h === 'white' ? '#dcdad6' : '#a8a8a8'), m = mat(gc), cap = ms(G(`hcap|${f4(R)}`, () => new THREE.ShapeGeometry(shapeOf(bandPts(R * 1.005, R * .1, R * 1.0, 20).slice(0, 21).concat([[-R * .99, R * .1]]).map(p => p)))), m, 0);
      const g = new THREE.Group(); const capPts0 = []; for (let i = 0; i <= 24; i++) { const a = (8 + i / 24 * 164) * DEG; capPts0.push([Math.cos(a) * R * 1.01, Math.sin(a) * R * 1.01]); } capPts0.push([-R * .9, R * .05], [-R * .3, R * .32], [R * .3, R * .32], [R * .9, R * .05]);
      cap.geometry = G(`hcap2|${f4(R)}`, () => new THREE.ShapeGeometry(shapeOf(capPts0)));
      g.add(cap); const hl = ms(G(`hcapline|${f4(R)}`, () => lineGeo(`hcl${f4(R)}`, [[-R * .55, R * .55], [-R * .1, R * .75], [R * .4, R * .62]], u(.018))), mat(shade(gc, -.2)), 1 * S); g.add(hl);
      this._hairItem(g, { lat: 0, lon: 0, follow: .45, layer: 'front', sil: true });
      if (h === 'greybun') { const b = new THREE.Group(); b.add(ms(circle(u(.13)).geometry, m, 0)); b.add(ms(ring(u(.08), u(.1), '#fff', { arc: [.4, 2.4] }).geometry, mat(shade(gc, -.25)), 1 * S)); this._hairItem(b, { lat: 55, lon: 180, out: .07 }); }
    }
  }
  // ---------------------------------------------------------------- hats and head gear
  _hat() {
    const { u, dims, look } = this, kind = look.hat, R = dims.headR; if (!kind) return;
    const DEF = { cap: '#d8433b', beanie: '#e98a3a', hardhat: '#f2c24a', cowboy: '#9a6b44', fedora: '#7a5a40', flatcap: '#28304b', headband: '#f2c24a', gradcap: '#1c1d26', helmet: '#3a3d45', headset: '#4a4c55', headphones: '#8a8d96', toque: '#f2efe9', beret: '#b33a3a', crown: '#f2c24a', bandana: '#d8433b', party: '#5fa0e0' };
    const col = look.hatColor || DEF[kind] || '#555', lw = u(.022), mC = mat(col), mL = mat(mixHex(col, COL.lineDark, .6)), mD = mat(shade(col, -.25));
    const g = node(this.headNode, 0, 0, LY.hat * S, 'hat'); this.hat = g;
    const out = (key, pts, z = 0) => { const f = ms(fillGeo(`${key}`, () => pts(0)), mC, z * S), l = ms(ringGeo(`${key}|l`, () => pts(lw), () => pts(0)), mL, z * S); l.userData.sil = true; g.add(f, l); return [f, l]; };
    const dome = (r, y0) => gg => domePts(r + gg, y0 - gg);
    if (kind === 'flatcap') {
      // a soft cloth dome a little wider than the head over its top 30 % (timeloop f9632 coach, the shopkeeper), no band:
      // in front view only a thin dark brim edge along its bottom, in 3/4 / profile a short peak toward the face
      // timeloop f9632: a flat lens of cloth on the top quarter of the head, overhanging the sides, ~0.3 D tall
      const capP = [[-1.04, .62], [-.78, .98], [0, 1.13], [.78, 1.0], [1.06, .66], [.72, .5], [0, .45], [-.72, .5]];
      const [cF, cL] = out(`hat|flatcap3|${f4(R)}`, gg => roundPoly(capP.map(([x, y]) => [x * R * (1 + gg / R * .9), (y - .78) * R * (1 + gg / R * 1.6) + .78 * R]), capP.map(() => R * .22)));
      const peak = ms(G(`fcPeak2|${f4(R)}`, () => new THREE.ShapeGeometry(shapeOf(roundPoly([[0, R * .62], [R * .52, R * .54], [R * .55, R * .47], [0, R * .5]], [0, R * .04, R * .04, 0])))), mD, -1 * S); peak.userData.sil = true; g.add(peak);
      this._turnGeo(null, null, (t, f, yaw) => { const k = clamp(Math.abs(yaw) / (55 * DEG)); peak.visible = k >= .35 && !this._back; peak.position.x = R * .78 * Math.sign(yaw || 1); peak.scale.x = Math.sign(yaw || 1); cF.position.x = cL.position.x = Math.sin(yaw) * R * .1; });
    } else if (kind === 'cap') {
      const flat = false;
      out(`hat|${kind}|${f4(R)}`, flat ? gg => domePts(R * 1.04 + gg, R * .12 - gg).map(([x, y]) => [x, (y - R * .12) * .62 + R * .12]) : dome(R * 1.04, R * .2));
      // brim: a band across the forehead in front view, a visor toward the facing side in profile
      const bf = ms(G(`brimF|${f4(R)}`, () => rrect(R * 1.7, u(.08), u(.04)).geometry), mD, 1 * S); bf.position.y = flat ? R * .14 : R * .2; g.add(bf);
      const bs = ms(G(`brimS|${f4(R)}`, () => rrect(R * .95, u(.07), u(.035)).geometry), mD, 1 * S); bs.userData.sil = true; bs.position.y = flat ? R * .12 : R * .2; g.add(bs);
      this._turnGeo(null, null, (t, f, yaw) => { const k = clamp(Math.abs(yaw) / (60 * DEG)); bf.visible = k < .5 && !this._back; bs.visible = k >= .5; bs.position.x = R * .9 * Math.sign(yaw || 1); });
      if (!flat) { const btn = ms(circle(u(.035)).geometry, mD, 1 * S); btn.position.y = R * 1.03; g.add(btn); }
    } else if (kind === 'beanie') {
      out(`hat|beanie|${f4(R)}`, gg => domePts(R * 1.05 + gg, R * .02 - gg).map(([x, y]) => [x, y * 1.05]));
      const band = ms(fillGeo(`bband|${f4(R)}`, () => bandPts(R * 1.06, R * .02, R * .26)), mD, 1 * S); g.add(band);
      if (look.pompom !== false) { const p = ms(circle(u(.09)).geometry, mC, -1 * S); p.position.y = R * 1.12; p.userData.sil = true; g.add(p); }
    } else if (kind === 'hardhat') {
      out(`hat|hard|${f4(R)}`, dome(R * 1.06, R * .22)); const br = ms(G(`hbrim|${f4(R)}`, () => rrect(R * 2.45, u(.075), u(.035)).geometry), mD, 1 * S); br.position.y = R * .24; br.userData.sil = true; g.add(br);
      const ridge = ms(G(`hridge|${f4(R)}`, () => rrect(u(.06), R * .75, u(.03)).geometry), mat(shade(col, .2)), 2 * S); ridge.position.y = R * .65; g.add(ridge);
    } else if (kind === 'cowboy' || kind === 'fedora') {
      const cw = kind === 'cowboy' ? R * 1.25 : R * 1.12, chh = kind === 'cowboy' ? R * .62 : R * .55, base = R * .55;
      out(`hat|${kind}crown|${f4(R)}`, gg => trapPts(cw * .82 + 2 * gg, cw + 2 * gg, chh + 2 * gg, R * .25 + gg, u(.02) + gg).map(([x, y]) => [x, y + base + chh + gg]), .2);
      const bandM = ms(G(`hband|${f4(R)}|${kind}`, () => rrect(cw, R * .14, 0).geometry), mat(kind === 'fedora' ? shade(col, -.45) : shade(col, -.3)), 1 * S); bandM.position.y = base + R * .1; g.add(bandM);
      const bw = kind === 'cowboy' ? R * 3.0 : R * 2.55;
      const brim = gg => kind === 'cowboy' ? (() => { const p = []; for (let i = 0; i <= 20; i++) { const x = -bw / 2 + bw * i / 20, e = (2 * x / bw) ** 4; p.push([x * (1 + gg / bw), base + R * .02 + e * R * .3 + gg]); } for (let i = 20; i >= 0; i--) { const x = -bw / 2 + bw * i / 20, e = (2 * x / bw) ** 4; p.push([x * (1 + gg / bw), base - R * .1 + e * R * .3 - gg]); } return p; })() : rrPts(bw + 2 * gg, R * .13 + 2 * gg, [R * .06 + gg, R * .06 + gg, R * .06 + gg, R * .06 + gg]).map(([x, y]) => [x, y + base]);
      const [bf, bl] = out(`hat|${kind}brim|${f4(R)}`, brim, .4); if (kind === 'fedora') { bf.rotation.z = bl.rotation.z = -5 * DEG; }
    } else if (kind === 'headband') {
      const b = ms(fillGeo(`hb|${f4(R)}`, () => bandPts(R * 1.0, R * .28, R * .5)), mC, 0); g.add(b);
    } else if (kind === 'gradcap') {
      out(`hat|gradskull|${f4(R)}`, dome(R * 1.03, R * .35));
      const board = ms(fillGeo(`gboard|${f4(R)}`, () => [[-R * 1.25, R * .95], [0, R * 1.18], [R * 1.25, R * .95], [0, R * .72]]), mC, 1 * S); board.userData.sil = true; g.add(board);
      const tas = ms(G(`tassel|${f4(R)}`, () => lineGeo(`tas${f4(R)}`, [[0, R * .95], [R * .7, R * .85], [R * .85, R * .3]], u(.025))), mat('#e8c14a'), 2 * S); g.add(tas);
    } else if (kind === 'helmet') {
      out(`hat|helmet|${f4(R)}`, gg => { const p = []; for (let i = 0; i <= 40; i++) { const a = -40 * DEG + i / 40 * 260 * DEG; p.push([Math.cos(a) * (R * 1.14 + gg), Math.sin(a) * (R * 1.14 + gg)]); } return p; }, -.2);
      const visor = ms(G(`visor|${f4(R)}`, () => rrect(R * 1.3, R * .62, R * .2).geometry), mat(look.visorColor || '#2a6f5e'), 1 * S); visor.position.set(R * .05, -R * .05, 0); g.add(visor); this.visor = visor;
      const vl = ms(G(`visorGlow|${f4(R)}`, () => lineGeo(`vg${f4(R)}`, [[-R * .4, -R * .05], [-R * .15, R * .1], [R * .05, -R * .1], [R * .3, R * .12]], u(.025))), mat('#7dffb0'), 1 * S); visor.add(vl); vl.position.z = 1 * S;
      this._turnGeo(null, null, (t, f, yaw) => { const p = project(.05, -.05, yaw, 0); visor.position.x = p.x * this.D * 1.1; visor.scale.x = Math.max(.35, p.kx); visor.visible = !this._back; });
    } else if (kind === 'headset' || kind === 'headphones') {
      const band = ms(G(`hsband|${f4(R)}`, () => lineGeo(`hsb${f4(R)}`, (() => { const p = []; for (let i = 0; i <= 16; i++) { const a = (10 + i / 16 * 160) * DEG; p.push([Math.cos(a) * R * 1.06, Math.sin(a) * R * 1.06]); } return p; })(), u(.05))), mC, 0); band.userData.sil = true; g.add(band);
      for (const s of [-1, 1]) { const cup = new THREE.Group(); cup.add(ms(G(`cup|${f4(R)}`, () => rrect(u(.2), u(.3), u(.09)).geometry), mC, 0)); if (kind === 'headset') cup.add(ms(ring(u(.035), u(.05), '#fff', { arc: [-.5, 3.3] }).geometry, mat('#5fc7ff'), 1 * S));
        cup.traverse(c => { if (c.isMesh) c.userData.sil = true; });
        const n = this._hairItem(cup, { lat: -5, lon: s * 90, out: -.05, layer: 'auto' }); n.position.z = 0;
        if (kind === 'headset' && s < 0) { const boom = ms(G(`boom|${f4(R)}`, () => lineGeo(`boom${f4(R)}`, [[0, 0], [u(.12), -u(.15)], [u(.28), -u(.2)]], u(.03))), mC, 2 * S); const mic = ms(circle(u(.04)).geometry, mC, 2 * S); mic.position.set(u(.28), -u(.2), 0); cup.add(boom, mic); cup.userData.boom = boom; } }
    } else if (kind === 'toque') {
      const tq = new THREE.Group(); [[-.2, .55, .2], [.0, .62, .24], [.2, .55, .2]].forEach(([x, y, r]) => { const c = ms(circle(u(r)).geometry, mC, 0); c.position.set(u(x), R + u(y) - R * .6, 0); c.userData.sil = true; tq.add(c); });
      const b = ms(G(`tqband|${f4(R)}`, () => rrect(R * 1.5, R * .4, u(.04)).geometry), mat(shade(col, -.06)), 1 * S); b.position.y = R * .72; tq.add(b); g.add(tq);
    } else if (kind === 'beret') { out(`hat|beret|${f4(R)}`, gg => domePts(R * 1.1 + gg, R * .25 - gg).map(([x, y]) => [x + R * .12, (y - R * .25) * .55 + R * .3]));
    } else if (kind === 'crown') { const p = gg => { const w = R * 1.1 + gg, b = R * .55 - gg, t = R * 1.2 + gg; return [[-w / 2, b], [w / 2, b], [w / 2, t], [w / 4, b + (t - b) * .55], [0, t], [-w / 4, b + (t - b) * .55], [-w / 2, t]]; }; out(`hat|crown|${f4(R)}`, p);
    } else if (kind === 'party') { const p = gg => [[-R * .38 - gg, R * .72 - gg], [R * .38 + gg, R * .72 - gg], [0, R * 1.8 + gg]]; out(`hat|party|${f4(R)}`, p); }
  }
  _accessories() {
    const { u, dims, look } = this, sc = look.scarf;
    if (sc) {
      const col = typeof sc === 'string' ? sc : '#eee0c3', st = mixHex(col, '#9c7b53', .35), lw = u(.02), mC = mat(col), mS = mat(st), mL = mat(mixHex(col, COL.lineDark, .45));
      const g = node(this.torsoBone, 0, dims.torso + u(.04), 0, 'scarf');
      // a thick knit band around the neck (cream, stripes) and one end hanging down the front (iq500 f868, f12650)
      const BW = u(.5), BH = u(.27), EW = u(.21), EL = u(.8);
      const band = ms(G(`scarfB|${f4(dims.D)}`, () => rrect(BW, BH, u(.11)).geometry), mC, LY.cb * S), bl = ms(G(`scarfBL|${f4(dims.D)}`, () => rrect(BW + lw * 2, BH + lw * 2, u(.11) + lw).geometry), mL, LY.ca * S); bl.userData.sil = true;
      const end = ms(G(`scarfE|${f4(dims.D)}`, () => rrect(EW, EL, u(.04)).geometry), mC, LY.face * S);
      const endL = ms(G(`scarfEL|${f4(dims.D)}`, () => rrect(EW + lw * 2, EL + lw * 2, u(.04) + lw).geometry), mL, LY.head * S); endL.userData.sil = true;
      g.add(band, bl, end, endL);
      const stripes = [];
      for (let i = 0; i < 5; i++) { const s = ms(G(`scarfS|${f4(dims.D)}`, () => rrect(EW, u(.026), 0).geometry), mS, (LY.face + 1) * S); g.add(s); stripes.push([s, -EL * .3 - i * u(.075)]); }
      for (let i = 0; i < 4; i++) { const s = ms(G(`scarfSB|${f4(dims.D)}`, () => rrect(u(.026), BH * .8, 0).geometry), mS, LY.cc * S); s.position.set(-BW * .36 + i * BW * .24, 0, LY.cc * S); g.add(s); }
      this._turnGeo(null, null, t => { g.scale.x = 1 - .12 * t; const ex = u(lerp(.07, .2, smooth(t))); end.position.set(ex, -EL / 2 + u(.02), LY.face * S); endL.position.set(ex, -EL / 2 + u(.02), LY.head * S); for (const [s, y] of stripes) s.position.set(ex, y, (LY.face + 1) * S); });
    }
  }
  // ---------------------------------------------------------------- a plaster cast + sling (a broken wrist / arm)
  /** look.cast: 'L' | 'R' (true = 'L'): a white plaster cast on that forearm, from just below the elbow over the wrist to the
   *  hand, drawn ON the sleeve as part of the arm: it shows in every framing (wides, mediums, close-ups), follows every pose and
   *  foreshortens with the forearm. look.sling: true adds a pale-blue sling: a cloth pouch round the cast forearm and a strap
   *  up to the neck (the arm's pose across the chest is lib/anim.js's: an Actor whose look has a sling keeps that forearm in
   *  it all shot and uses the other hand). look.castColor / slingColor. Hand inserts (Hand(look, { side })) draw the same cast
   *  when their side has it. (Video 02: Grandpa's broken wrist was a white card laid over the arm from models.js every frame;
   *  it went missing in close-ups and was hand-drawn again for the inserts.) */
  _cast() {
    const c = this.look.cast, side = c === 'R' || c === 'L' ? c : c ? 'L' : null; if (!side) return;
    const { u, dims } = this, arm = this.arms[side], lw = u(.022), fa = dims.foreArm;
    const col = this.look.castColor || '#f1eee6', line = mixHex(col, COL.lineDark, .3), shd = shade(col, -.12);
    const w = Math.max(dims.sleeveW, dims.limbW * 1.3) * 1.12, y0 = -fa * .14, y1 = -fa - arm.nubR * .35, L = y0 - y1, ym = (y0 + y1) / 2;
    // under the plaster: no cuff, watch or sleeve stripe
    for (const m of arm.fore.children) if (m.isMesh && !arm.sleeves.includes(m) && !arm.sleeveFills.includes(m) && !arm.limbs.includes(m)) m.visible = false;
    const g = node(arm.fore, 0, 0, (AZ.cast - AZ.fore) * S, 'cast'); this.castG = g; this.castSide = side;
    const pts = gg => rrPts(w + 2 * gg, L + 2 * gg, [w * .32 + gg, w * .32 + gg, w * .42 + gg, w * .42 + gg]).map(([x, y]) => [x, y + ym]);
    const f = ms(fillGeo(`cast|${f4(w)}|${f4(L)}|${f4(ym)}`, () => pts(0)), mat(col), 0, 'castFill');
    const o = ms(ringGeo(`cast|${f4(w)}|${f4(L)}|${f4(ym)}|${f4(lw)}`, () => pts(lw), () => pts(0)), mat(line), 0, 'castLine');
    f.userData.sil = o.userData.sil = true; f.userData.kind = o.userData.kind = 'cast'; g.add(f, o);
    // the shade down one side and the padding roll at the top edge (one layer up, clear of the hand at the wrist end)
    const sh = ms(G(`castS|${f4(w)}|${f4(L)}`, () => rrect(w * .24, L * .7, w * .1).geometry), mat(shd), S); sh.position.set(w * .27, y0 - L * .42, S);
    const pad = ms(G(`castP|${f4(w)}`, () => rrect(w * .9, u(.06), u(.02)).geometry), mat(shade(col, -.07)), S); pad.position.set(0, y0 - u(.05), S);
    g.add(sh, pad);
    this._segScale(side + 'fore', fa, g);
    if (!this.look.sling) return;
    // the sling: a pouch round the forearm (behind the plaster) and a strap from the pouch's wrist end up to the neck
    const sc = this.look.slingColor || '#8fb3d9', sl = mixHex(sc, COL.lineDark, .4), pw = w * 1.5, pL = L * .86, py = ym + L * .03;
    const pp = gg => rrPts(pw + 2 * gg, pL + 2 * gg, [pw * .22 + gg, pw * .22 + gg, pw * .3 + gg, pw * .3 + gg]).map(([x, y]) => [x, y + py]);
    const pg = node(arm.fore, 0, 0, (AZ.pouch - AZ.fore) * S, 'slingPouch');
    const pf = ms(fillGeo(`pouch|${f4(pw)}|${f4(pL)}|${f4(py)}`, () => pp(0)), mat(sc), 0, 'slingFill'), pl = ms(ringGeo(`pouch|${f4(pw)}|${f4(pL)}|${f4(py)}|${f4(lw)}`, () => pp(lw), () => pp(0)), mat(sl), 0, 'slingLine');
    pf.userData.sil = pl.userData.sil = true; pf.userData.kind = pl.userData.kind = 'sling'; pg.add(pf, pl); this._segScale(side + 'fore', fa, pg);
    const strap = ms(G(`strap|${f4(dims.D)}`, () => rrect(u(.12), 1, 0).geometry), mat(sc), LY.cb * S, 'slingStrap');
    strap.userData.kind = 'sling'; this.body.add(strap); this.slingStrap = strap;
  }
  /** the sling strap follows the pose: from the neck to the pouch's wrist end (body space: the body node is mirrored by facing) */
  _placeStrap() {
    const m = this.slingStrap, s = this.castSide, J = this.J, f = this._facing ?? 1, n = J.neck, e = J['elbow' + s], w = J['wrist' + s];
    if (!m || !n || !e || !w) return;
    const p = [n.x * f, n.y - this.u(.06)], q = [lerp(e.x, w.x, .82) * f, lerp(e.y, w.y, .82)], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || .01;
    m.position.set((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, LY.cb * S); m.rotation.z = Math.atan2(dy, dx) - PI / 2; m.scale.y = len;
  }
  // ---------------------------------------------------------------- per frame
  setRim(color, dir = [0, 1], o = {}) {
    const c = color && RIMS[color] ? RIMS[color] : color;
    this._rimOn = !!c; if (c) this.rimMat.color.set(c);
    if (Array.isArray(dir)) this._rimDir = dir; else if (typeof dir === 'string') this._rimDir = ({ up: [0, 1], left: [-.55, .83], right: [.55, .83], 'up-left': [-.4, .92], 'up-right': [.4, .92], back: [0, 1] })[dir] || [0, 1];
    const [dx, dy] = this._rimDir, n = Math.hypot(dx, dy) || 1;
    this._rimK = o.size ?? 1; this._rimU = [dx / n, Math.max(-.2, dy / n)];
    this._second = o.second ? (RIMS[o.second] || o.second) : null;
    // halo: a backlight (light behind the character, sister s264 f16300) also lines the sides and the bottom: extra copies
    // offset left / right / down by halo x the main offset, in the rim colour
    this._halo = clamp(o.halo ?? 0, 0, 1.5);
    this._shadeSide = Math.abs(dx) < .15 ? 1 : (dx > 0 ? 1 : -1);
    this._rimDirty = true; this._syncRim();
    return this;
  }
  /** the rim copies wanted now: [{ dx, dy (x the offset), z (steps), second }] */
  _rimSpecs() {
    if (!this._rimOn) return [];
    const [ux, uy] = this._rimU, out = [{ dx: ux, dy: uy, z: -1 }];
    if (this._second) out.push({ dx: -ux * .65, dy: uy * .35, z: -2, second: true });
    if (this._halo > 0) { const h = this._halo; out.push({ dx: -h, dy: 0, z: -1 }, { dx: h, dy: 0, z: -1 }, { dx: 0, dy: -h * .8, z: -1 }); }
    return out;
  }
  _ensureRims() {
    const specs = this._rimSpecs();
    while (this.rims.length < specs.length) {
      const i = this.rims.length, hold = node(this.root, 0, 0, -S, 'rim' + i), m = this.rimMat;
      const pairs = []; const dst = this._mirror(this.body, m, pairs); hold.add(dst);
      this.rims.push({ hold, body: dst, pairs, m });
    }
    this.rims.forEach((r, i) => {
      const sp = specs[i]; r.hold.visible = !!sp; if (!sp) return;
      const m = sp.second ? (this._secondMat ??= mat('#8e7975', { unique: true })) : this.rimMat;
      if (r.m !== m) { r.m = m; for (const [, d] of r.pairs) if (d.isMesh) d.material = m; }
      r.spec = sp;
    });
  }
  /** a silhouette copy of a subtree: same nodes, only the meshes marked sil (flattened to one depth), one material */
  _mirror(src, m, pairs) {
    const dst = new THREE.Group(); pairs.push([src, dst]);
    for (const c of src.children) {
      if (c.isMesh) { if (!c.userData.sil || c.userData.noSil) continue; const d = new THREE.Mesh(c.geometry, m); d.userData.noPick = true; pairs.push([c, d]); dst.add(d); }
      else if (!c.userData.noRim && c !== this.face?.root) { if (c.userData.noSil) continue; dst.add(this._mirror(c, m, pairs)); }
    }
    return dst;
  }
  _syncRim() {
    if (this._rimDirty) { for (const r of this.rims) { r.hold.remove(r.body); r.pairs.length = 0; r.body = this._mirror(this.body, r.m, r.pairs); r.hold.add(r.body); } this._rimDirty = false; }
    this._ensureRims();
    if (!this._rimOn) return;
    // offset 0.075 D toward the light (heads measured 0.053-0.068 D in close-ups; wides read ~5-6 px at 1080 on a 400 px figure,
    // sister s264): setRim(.., { size }) scales it, the close-up head scale too
    const off = this.D * .075 * this._rimK * Math.max(1, this._kH ?? 1);
    if (this._secondMat && this._second) this._secondMat.color.set(this._second);
    this.rims.forEach(r => {
      if (!r.hold.visible || !r.spec) return;
      r.hold.position.set(r.spec.dx * off, r.spec.dy * off, r.spec.z * S);
      // an arm's rim copy keeps the arm's own depth (one step behind it), not the figure's back: a far arm hidden behind the
      // torso keeps its rim hidden too, and a near arm's rim never pokes out beside the body as a detached tan arm / hand
      // (video 02: ~14 'ghost arms'); everything else stays flattened behind the whole figure
      for (const [s, d] of r.pairs) { d.position.x = s.position.x; d.position.y = s.position.y; d.position.z = s.userData.rimDepth ? s.position.z : (s.userData.zx || 0); d.rotation.z = s.rotation.z; d.scale.x = s.scale.x; d.scale.y = s.scale.y; d.visible = s.visible; if (s.isMesh && d.geometry !== s.geometry) d.geometry = s.geometry; }
    });
  }
  setFace(face = {}) {
    this.faceState = face;
    if (this.face) this.face.set(face, this._view);
    return this;
  }
  setPose(P = POSE0) {
    const { dims, u, A } = this, f = (P.facing ?? 1) < 0 ? -1 : 1, turn = clamp(P.turn ?? 0, 0, 1), back = !!P.back;
    this.pose = P; this._back = back; this._facing = f; this._turn = turn;
    this.body.scale.x = f;
    // hip (fig.root space -> body space)
    let hx = 0, hy = dims.hipY; const hp = P.hip; if (Array.isArray(hp)) { hx = hp[0] ?? 0; hy = hp[1] ?? dims.hipY; } else if (typeof hp === 'number') hy = hp; else if (hp && typeof hp === 'object') { hx = hp.x ?? 0; hy = hp.y ?? dims.hipY; }
    this.hips.position.set(hx * f, hy, 0);
    const lean = P.lean || 0; this.torsoBone.rotation.z = -lean;
    // turn-dependent parts (geometry swaps are quantised to 0.1; positions follow continuously)
    // face yaw: a body profile (turn 1) shows the face at ~58 deg (the references draw profile bodies with a 3/4 face: both lenses of mom's glasses show);
    // head.turn adds up to the rim (88 deg)
    const hd = P.head || {}, yaw = clamp(turn * 58 + (hd.turn || 0) * 60, -88, 88) * DEG, pitch = clamp(hd.nod || 0, -1, 1) * 50 * DEG;
    const lvl = Math.round(turn * 10) / 10;
    for (const tp of this.turnParts) {
      if (tp.mesh && tp.make && tp.mesh.userData.lvl !== lvl) { tp.mesh.geometry = tp.make(lvl); tp.mesh.userData.lvl = lvl; }
      if (tp.extra) tp.extra(turn, tp.mesh, yaw * (back ? -1 : 1), lvl);
    }
    this._hairAngle = P.hair || 0;
    // legs: near leg on the back side (screen-left when facing right), far leg on the front side, both side by side in front view
    const nearSide = P.near === 'L' ? 'L' : 'R', farSide = nearSide === 'R' ? 'L' : 'R';
    const legX = lerp(dims.limbW * .58, u(.03), smooth(turn)), armX = lerp(u(A.torsoW / 2 + A.limb / 2) - (this.arms.R.sleeves.length ? u(.05) : 0), u(.11), smooth(turn));
    const farTone = turn >= .3;
    for (const side of ['L', 'R']) {
      const L = this.legs[side], lp = (side === 'L' ? P.legL : P.legR) || {}, near = side === nearSide;
      // z: metres added to this leg's depth (+ toward the camera); k1 / k2: thigh / shin length factor (foreshortened toward the camera)
      L.g.position.set(near ? -legX : legX, 0, (near ? LY.legN : LY.legF) * S + (lp.z || 0)); L.g.userData.zx = lp.z || 0;
      this._segK(side + 'thigh', lp.k1); this._segK(side + 'shin', lp.k2);
      L.thigh.rotation.z = lp.hip || 0; L.shin.rotation.z = -(lp.knee || 0); L.foot.rotation.z = lp.foot || 0;
      const m = !near && farTone ? this.mFar : this.mBody; for (const x of L.meshes) if (!(x === L.meshes[2] && this.look.outfit.shoes)) x.material = m;
      if (L.pantsFill) for (let i = 0; i < L.pants.length; i += 2) L.pants[i].material = !near && farTone ? L.pantsShade : L.pantsFill;
    }
    // arms: near arm in front of everything; the far arm in front of the torso in front views, behind it from 3/4 on
    for (const side of ['L', 'R']) {
      const a = this.arms[side], ap = (side === 'L' ? P.armL : P.armR) || {}, near = side === nearSide;
      const front = near || turn < .35;
      // layer: the near arm in front of everything; the far arm in front of the torso in front views, behind it from 3/4 on.
      // A raised far arm (hand above the shoulder: a cheer, a wave) goes behind the head and the torso (timeloop f2464):
      // drawn in front it would cover the face with its sleeve. ap.layer: 'back' | 'front' | 'near' overrides.
      const a1 = -lean + (ap.sh || 0), wy = -Math.cos(a1) * dims.upperArm - Math.cos(a1 + (ap.el || 0)) * dims.foreArm, raised = wy > -dims.upperArm * .2;
      let lay = near ? LY.armN : front ? LY.armFF : LY.armFB;
      if (raised && front && (!near || turn >= .2)) lay = LY.armFB;   // in 3/4 views the near arm too: faces stay readable (the references never cross a face with a raised arm)
      if (ap.layer === 'back') lay = LY.armFB; else if (ap.layer === 'front') lay = LY.armFF; else if (ap.layer === 'near') lay = LY.armN;
      // z: metres added to this arm's depth (+ toward the camera: a hug / a hand on a shoulder wraps in front of another body)
      a.g.position.set(near ? -armX : armX, dims.torso - dims.limbW * .5 - u(.02) - (this.cloth && this.arms[side].sleeves.length ? u(.05) * (1 - smooth(turn)) : 0), lay * S + (ap.z || 0));
      a.g.userData.zx = ap.z || 0;
      this._segK(side + 'upper', ap.k1); this._segK(side + 'fore', ap.k2);
      a.upper.rotation.z = ap.sh || 0; a.fore.rotation.z = ap.el || 0;
      const hv = side === 'L' ? P.handL : P.handR, hk = (hv && typeof hv === 'object' ? hv.shape : hv) || 'nub';
      a.hand.rotation.z = hv && typeof hv === 'object' ? (hv.rot || 0) : 0;
      if (a.cur !== hk) { if (a.cur && a.objs[a.cur]) a.objs[a.cur].visible = false; const o = this._handShape(a, hk); o.visible = hk !== 'none'; a.cur = hk; }
      const far = !near && farTone;
      for (const x of a.limbs) x.material = far ? this.mFar : this.mBody;
      const hs = a.objs[a.cur]; if (hs) hs.traverse(c => { if (c.isMesh && !c.userData.ownMat && !hs.userData.glove) c.material = far ? this.mFar : this.mBody; });
      // sleeves: the one on the side away from the light takes the shade tone (light from behind: the near sleeve, else the far one)
      if (a.fill) { const lightBack = (this._rimU?.[0] || 0) * f < -.15, dark = turn >= .3 && (lightBack ? near : !near); for (const x of a.sleeveFills) x.material = dark ? a.shade : a.fill; }
    }
    // head: tilt (roll) about the neck base; the face slides on the sphere for yaw / pitch.
    // headScale: the references draw the head ~1.5-1.6x bigger (and sunk into the collar) in close-ups: pose.headScale (default look.headScale)
    const kH = this._kH = clamp(P.headScale ?? this.kH, .5, 2.5);
    this.neckBone.rotation.z = -(hd.tilt || 0);
    this.headNode.scale.set(kH, kH, 1); this.headNode.position.y = this._headY(kH);
    const sinkL = Math.max(0, kH - 1) * .57 * this.D / kH; this.neckMesh.scale.y = Math.max(.3, (this._neckLen - sinkL * .45) / this._neckLen);   // a sunk head keeps a short neck
    // the face is NOT mirrored with the body (a hair clip / smirk stays on the same side of the head, like the references):
    // its root counter-mirrors and the yaw is given in screen space
    this._view.yaw = back ? 0 : yaw * f; this._view.pitch = pitch; this._view.back = back; this._view.mirror = f;
    if (this.face) this.face.root.scale.x = this.HD * f;
    // hair items on the sphere
    for (const n of this.hairItems) this._placeHair(n, back ? PI : yaw, pitch, back);
    for (const n of this.frontOnly) if (back) n.visible = false;
    if (this.face) this.face.set(this.faceState, this._view);
    // held props: upright and readable
    this._fk(P, hx, hy, lean, f);
    if (this.slingStrap) this._placeStrap();
    for (const h of this.held) this._placeHeld(h);
    // shadow under the feet
    const ax = (this.J.ankleL.x + this.J.ankleR.x) / 2, ay = Math.min(this.J.ankleL.y, this.J.ankleR.y);
    this.shadow.position.x = ax; this.shadow.material.opacity !== undefined && (this.shadow.visible = ay < u(1.2) && this.look.shadow !== false);
    this._syncRim();
    return this;
  }
  /** head centre height above the neck base for a head scale k (a bigger close-up head sits lower: 0.57 D per unit of scale) */
  _headY(k) { return this.dims.neck + this.D / 2 * k - Math.max(0, k - 1) * .57 * this.D; }
  _placeHair(n, yaw, pitch, back) {
    const ud = n.userData, R = this.dims.headR;
    if (ud.lon === 0 && ud.lat === 0 && ud.follow !== 1) { // whole-head items (curls, spikes, caps): shift a little toward the back with the turn
      n.position.x = -Math.sin(yaw) * R * .24 * ud.follow; n.rotation.z = Math.sin(yaw) * .35 * ud.follow;
      n.position.z = (ud.back === 'front' || back ? LY.hairFront : ud.back === 'acc' ? LY.hairAcc : LY.hairBack) * S;
      return;
    }
    const lat = ud.lat * DEG, lon = ud.lon * DEG + (ud.follow ?? 1) * 0, cl = Math.cos(lat);
    const x0 = cl * Math.sin(lon), y0 = Math.sin(lat), z0 = cl * Math.cos(lon);
    const cp = Math.cos(pitch), sp = Math.sin(pitch), y2 = y0 * cp + z0 * sp, zp = -y0 * sp + z0 * cp, cy = Math.cos(yaw), sy = Math.sin(yaw), x1 = x0 * cy + zp * sy, z2 = -x0 * sy + zp * cy;
    const r = R * (1 + ud.out), px = x1 * r, py = y2 * r;
    if (ud.lon === 180 && ud.lat === 0) { n.position.x = px * ud.follow; n.position.y = 0; } else { n.position.x = px; n.position.y = py; }
    // pose.hair: the ponytail / strand swing (radians, + = the tail end moves toward the facing side); accessories bounce a third of it
    if (ud.hang) n.rotation.z = this._hairAngle || 0; else if (ud.back === 'acc') n.rotation.z = (this._hairAngle || 0) * .35;
    if (ud.spread) n.scale.x = Math.max(.12, Math.abs(Math.sin(yaw)));   // a strand drawn toward the back: flat in front view
    // layer: black hair behind everything; an item on the visible side of the head (ear cups) in front of the head
    let z = ud.back === 'acc' ? LY.hairAcc : LY.hairBack;
    if (ud.back === 'auto') z = z2 > .05 ? LY.hairFront : LY.hairBack;
    if (ud.back === 'front') z = LY.hairFront;
    if (back && ud.back !== 'auto') z = LY.hairFront + (ud.back === 'acc' ? .5 : 0);
    n.position.z = z * S;
    // the mic boom points to the face side
    const boom = n.children[0]?.userData?.boom; if (boom) n.children[0].scale.x = z2 > 0 ? 1 : -1;
  }
  _fk(P, hx, hy, lean, f) {
    const { dims, u } = this, J = this.J, rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    const V = (x, y, z = 0) => new THREE.Vector3(x * f, y, z), K = key => this.segs[key]?.k ?? 1;
    const at = -lean, H = [hx * f, hy];   // body-local hip
    const nb = rot(0, dims.torso, at); const neck = [H[0] + nb[0], H[1] + nb[1]];
    const ht = -((P.head || {}).tilt || 0), kH = this._kH ?? 1, hcy = this._headY(kH), hc = rot(0, hcy, at + ht), head = [neck[0] + hc[0], neck[1] + hc[1]], htop = rot(0, hcy + this.D / 2 * kH, at + ht);
    J.hip = V(H[0], H[1], LY.torso * S); J.neck = V(neck[0], neck[1], LY.neck * S); J.head = V(head[0], head[1], LY.head * S); J.headTop = V(neck[0] + htop[0], neck[1] + htop[1], LY.head * S);
    for (const side of ['L', 'R']) {
      const a = this.arms[side], ap = (side === 'L' ? P.armL : P.armR) || {};
      const sp = rot(a.g.position.x, a.g.position.y, at), sh = [H[0] + sp[0], H[1] + sp[1]];
      const az = a.g.position.z, a1 = at + (ap.sh || 0), e = rot(0, -dims.upperArm * K(side + 'upper'), a1), el = [sh[0] + e[0], sh[1] + e[1]];
      const a2 = a1 + (ap.el || 0), w = rot(0, -dims.foreArm * K(side + 'fore'), a2), wr = [el[0] + w[0], el[1] + w[1]];
      const a3 = a2 + a.hand.rotation.z, g = rot(0, -a.grip, a3), gp = [wr[0] + g[0], wr[1] + g[1]];
      J['shoulder' + side] = V(...sh, az); J['elbow' + side] = V(...el, az + AZ.fore * S); J['wrist' + side] = V(...wr, az + AZ.fore * S); J['hand' + side] = V(...gp, az + AZ.prop * S);   // z = the arm's real layer depth (the held-prop slot for the hand)
      a.angle = a3;
      const L = this.legs[side], lp = (side === 'L' ? P.legL : P.legR) || {}, hj = [H[0] + L.g.position.x, H[1]];
      const lz = L.g.position.z, b1 = lp.hip || 0, k = rot(0, -dims.thigh * K(side + 'thigh'), b1), kn = [hj[0] + k[0], hj[1] + k[1]];
      const b2 = b1 - (lp.knee || 0), s = rot(0, -dims.shin * K(side + 'shin'), b2), an = [kn[0] + s[0], kn[1] + s[1]];
      const b3 = b2 + (lp.foot || 0), fl = lerp(dims.limbW * 1.12, dims.foot, smooth(clamp(this._turn * 1.25)));
      const toe = rot(fl - dims.limbW * .56, -dims.footH / 2, b3), heel = rot(-dims.limbW * .5, -dims.footH / 2, b3);
      J['hip' + side] = V(...hj, lz); J['knee' + side] = V(...kn, lz); J['ankle' + side] = V(...an, lz); J['foot' + side] = V(an[0], an[1], lz);
      J['toe' + side] = V(an[0] + toe[0], an[1] + toe[1], lz); J['heel' + side] = V(an[0] + heel[0], an[1] + heel[1], lz);
    }
    // skirt follows the thighs
    if (this.skirt) { const t = ((P.legL?.hip || 0) + (P.legR?.hip || 0)) / 2; this.skirt.rotation.z = clamp(t, -.6, 1.6) * .85; }
  }
  /** a joint's position (THREE.Vector3, fig.root space) after setPose: hip neck head headTop shoulderL elbowL wristL handL hipL kneeL ankleL footL heelL toeL (and R) */
  joint(name) { const v = this.J[name]; return v ? v.clone() : null; }
  /** the grip point of a hand (= joint('handL'/'handR')): where a held prop's grip sits */
  grip(side = 'R') { return this.joint('hand' + (side === 'L' ? 'L' : 'R')); }
  /**
   * hold a prop: its grip point (o.grip = a name in obj.userData.grips, or [x, y] in the prop's own space) goes to the hand's grip point.
   * o: { grip, at: [dx, dy] (m, extra offset), rot (radians, + = counter-clockwise when facing right), upright (default true: the prop
   *      keeps its world angle instead of turning with the forearm), front (prop drawn OVER the hand: a phone / mug shown to camera),
   *      keep (default true: never mirrored, so text stays readable), rim (default true: the prop gets the rim light too) }
   */
  attach(obj, side = 'R', o = {}) {
    side = side === 'L' ? 'L' : 'R'; this.detach(obj);
    const a = this.arms[side], grips = obj.userData?.grips || {};
    let g = o.grip; if (typeof g === 'string') g = grips[g]; if (!g) g = grips.hand || grips.grip || Object.values(grips)[0] || [0, 0];
    const base = { x: obj.scale.x, y: obj.scale.y };
    const h = { obj, side, o, g, base, sx: Math.abs(obj.scale.x) || 1 };
    (o.front ? a.slotFront : a.slot).add(obj);
    obj.traverse(c => { if (c.isMesh && o.rim !== false && !(c.material?.transparent) && !c.userData.noRim && c.material?.visible !== false && !c.userData.text) c.userData.sil = true; });
    this.held.push(h); this._rimDirty = true; this._placeHeld(h); this._syncRim();
    return obj;
  }
  // the prop's rim copy goes with it NOW (video 02 f3044: a put-away guitar left a cream silhouette for one frame)
  detach(obj) { const i = this.held.findIndex(h => h.obj === obj); if (i < 0) return null; const h = this.held[i]; this.held.splice(i, 1); obj.parent?.remove(obj); obj.scale.x = h.base.x; this._rimDirty = true; if (this.rims) this._syncRim(); return obj; }
  _placeHeld(h) {
    const { obj, o, g } = h, a = this.arms[h.side], f = this._facing ?? 1;
    const keep = o.keep !== false, upright = o.upright !== false;
    obj.scale.x = keep ? h.sx * f : h.sx;
    const r = (o.rot || 0) - (upright ? (a.angle || 0) : 0);
    obj.rotation.z = r;
    // the grip point of the prop lands on the slot origin: p_slot = R(r) * S * (-g)
    const sx = obj.scale.x, sy = obj.scale.y, gx = -g[0] * sx, gy = -g[1] * sy, c = Math.cos(r), s = Math.sin(r);
    obj.position.x = gx * c - gy * s + (o.at?.[0] || 0); obj.position.y = gx * s + gy * c + (o.at?.[1] || 0);
  }
  box() { return new THREE.Box3().setFromObject(this.body); }
  headPos() { return this.joint('head'); }
}

// =====================================================================================================================
// HAND INSERTS: the detailed glove (iq500 / sister) and the flat mitten (timeloop) - a separate card, fingers up (+y) from the
// wrist at the origin, the back of a RIGHT hand facing the camera (thumb on the left); side 'L' mirrors.
// =====================================================================================================================
// finger spec: [spread deg, bend1, bend2, bend3, fold 0..1]; thumb: [spread deg, bend1, bend2, fold]
export const HAND_POSES = {
  flat: { f: [[7, 0, 0, 0, 0], [2, 0, 0, 0, 0], [-3, 0, 0, 0, 0], [-9, 0, 0, 0, 0]], t: [16, 4, 0, 0], desc: 'resting flat, fingers together' },
  open: { f: [[18, 0, 0, 0, 0], [5, 0, 0, 0, 0], [-9, 0, 0, 0, 0], [-24, 0, 0, 0, 0]], t: [72, 0, 0, 0], desc: 'spread open hand / wave / palm up' },
  fist: { f: [[3, 0, 0, 0, .92], [0, 0, 0, 0, .95], [-2, 0, 0, 0, .95], [-4, 0, 0, 0, .9]], t: [0, 12, 0, 0], tb: [-.4, .46, -84], tk: .82, tFront: true, desc: 'fist (CPR, punch, bang)' },
  point: { f: [[2, 0, 0, 0, 0], [0, 0, 0, 0, .86], [-2, 0, 0, 0, .88], [-4, 0, 0, 0, .86]], t: [0, 15, 0, 0], tb: [-.4, .4, -62], tk: .78, tFront: true, desc: 'index pointing / pressing a button' },
  press: { f: [[2, 0, 0, 0, .1], [0, 0, 0, 0, .86], [-2, 0, 0, 0, .88], [-4, 0, 0, 0, .86]], t: [0, 15, 0, 0], tb: [-.4, .4, -62], tk: .78, tFront: true, desc: 'pressing with the index tip' },
  grip: { f: [[4, 0, 10, 10, .55], [1, 0, 10, 10, .58], [-2, 0, 10, 10, .58], [-5, 0, 10, 10, .55]], t: [38, 0, 0, 0], desc: 'closed around a handle (the prop goes in the hold slot)' },
  pinch: { f: [[18, 0, 28, 28, .25], [2, 0, 0, 0, .7], [-2, 0, 0, 0, .74], [-6, 0, 0, 0, .72]], t: [30, -12, -6, 0], tFront: true, desc: 'thumb and index tips together (tweezers, a lighter, a coin)' },
  pen: { f: [[14, 0, 18, 10, .2], [0, 0, 0, 0, .66], [-3, 0, 0, 0, .74], [-6, 0, 0, 0, .74]], t: [34, -10, 0, 0], tFront: true, desc: 'holding a pen between thumb and index' },
  'hold-phone': { f: [[0, 0, 0, 0, .8], [0, 0, 0, 0, .8], [0, 0, 0, 0, .8], [0, 0, 0, 0, .78]], t: [0, 0, 0, 0], fFront: true, tFront: true, palmSide: true, slot: [.35, 1.25], slotZ: 'mid',
    fb: [[.96, 2.02, 94], [.98, 1.72, 91], [.98, 1.42, 88], [.95, 1.12, 85]], tb: [-.14, .5, 3], tk: 1.35, desc: 'a phone held up (iq500 f3845): the palm behind its lower half, four fingertips wrapping OVER the right edge, the thumb over the left edge' },
  'phone-back': { f: [[6, 0, 0, 0, .3], [2, 0, 0, 0, .28], [-2, 0, 0, 0, .3], [-6, 0, 0, 0, .4]], t: [-8, 0, 0, 0], front: true, desc: 'a phone upright, screen out (iq500 f220): phone OVER the hand, fingertips and thumb peek past its edges' },
  'phone-pov': null,
  'phone-ear': { f: [[10, 0, 6, 0, .1], [4, 0, 6, 0, .1], [-2, 0, 6, 0, .12], [-8, 0, 6, 0, .2]], t: [40, 0, 0, 0], fFront: true, desc: 'at the ear: 4 fingers across the back of the phone' },
  'hold-cup': { f: [[6, 0, 0, 0, .58], [2, 0, 0, 0, .6], [-2, 0, 0, 0, .62], [-6, 0, 0, 0, .6]], t: [70, -20, 0, 0], fFront: true, desc: 'fingers curled around a mug (mug behind the fingers)' },
  sheet: { f: [[4, 0, 0, 0, 0], [1, 0, 0, 0, 0], [-3, 0, 0, 0, 0], [-7, 0, 0, 0, 0]], t: [40, 0, 0, 0], tFront: true, desc: 'holding a sheet: thumb over the edge, fingers behind' },
  // (lessons 02-handshake: the clasp's thumb stood 50 deg off the hand, so two clasped inserts showed both thumbs up in a V;
  // a hand round another hand lays its thumb along the top, curled over the other hand's back)
  clasp: { f: [[8, 0, 12, 12, .42], [3, 0, 12, 12, .42], [-3, 0, 12, 12, .42], [-8, 0, 12, 12, .45]], t: [8, -14, -10, 0], fFront: true, tFront: true, desc: 'holding another hand (wraps over it), the thumb along the top' },
  // a HANDSHAKE seen from the side (S.hand(null, { shake: 'who' }) builds both, like the 🤝 sign / timeloop f10540): the near
  // hand shows its back, its fingers curl down over the other hand (in front of it), its thumb lies along the top; the far
  // hand is behind it (palm and fingers), only its thumb crosses over the near hand's knuckles. Nothing sticks up.
  shake: { f: [[4, 0, 24, 28, .22], [1, 0, 26, 30, .22], [-2, 0, 26, 30, .24], [-5, 0, 24, 28, .28]], t: [6, -16, -12, 0], fFront: true, tz: 21, desc: 'a handshake, the near hand: back to the camera, fingers curled down over the other hand, thumb along the top' },
  shakeWrap: { f: [[6, 0, 16, 14, .5], [2, 0, 16, 14, .5], [-2, 0, 16, 14, .52], [-6, 0, 16, 14, .56]], t: [10, -12, -8, 0], pz: 5, fz: 3, tz: 22, desc: 'a handshake, the far hand: behind the near hand, only its thumb over the near knuckles' },
  // TWO-HAND CLOSE-UPS beyond the handshake (S.handshake(a, b, { kind: 'hold' | 'pinky' | 'bump' }), video 01 review: builders
  // stacked two whole gloves - one hand with ~10 fingers, two fists bumping, a pinky promise drawn as two index fingers).
  // Holding hands is the handshake's clasp ('shake' over 'shakeWrap') with the arms in a V; holdOpen = the holder's hand
  // before its fingers close round the other
  holdOpen: { f: [[12, 0, 4, 2, 0], [4, 0, 4, 2, 0], [-4, 0, 4, 2, 0], [-12, 0, 4, 2, 0]], t: [36, 0, 0, 0], fFront: true, desc: 'holding hands, the holder before the fingers close (open, relaxed)' },
  // a pinky promise (seen from the side, fists pointing at each other): a fist with the little finger straight out of it,
  // a bit long (fl) and jointed end to end (chain); pinkyHook curls it toward the little-finger side (down for a right hand
  // pointing right), pinkyHookUp the other way, so the pair interlocks
  pinky: { f: [[3, 0, 0, 0, .92], [0, 0, 0, 0, .95], [-2, 0, 0, 0, .95], [0, 0, 3, 3, 0]], t: [0, 12, 0, 0], tb: [-.4, .46, -84], tk: .82, tFront: true, chain: true, fl: [1, 1, 1, 1.6], desc: 'a fist with the little finger straight out (before the pinky promise hooks)' },
  pinkyHook: { f: [[3, 0, 0, 0, .92], [0, 0, 0, 0, .95], [-2, 0, 0, 0, .95], [0, 0, 55, 100, .15]], t: [0, 12, 0, 0], tb: [-.4, .46, -84], tk: .82, tFront: true, chain: true, fl: [1, 1, 1, 1.6], desc: 'a pinky promise: a fist, the little finger out and hooked (down for a right hand pointing right)' },
  pinkyHookUp: { f: [[3, 0, 0, 0, .92], [0, 0, 0, 0, .95], [-2, 0, 0, 0, .95], [0, 0, -55, -100, .15]], t: [0, 12, 0, 0], tb: [-.4, .46, -84], tk: .82, tFront: true, chain: true, fl: [1, 1, 1, 1.6], desc: 'a pinky promise, the other hand: the little finger out and hooked the other way (up)' },
  dangle: { f: [[4, 0, 20, 20, .25], [1, 0, 0, 0, .55], [-3, 0, 0, 0, .6], [-7, 0, 0, 0, .6]], t: [32, -8, 0, 0], tFront: true, desc: 'an object dangling from the fingertips' },
  cup: { f: [[10, 0, 18, 12, .2], [3, 0, 18, 12, .2], [-3, 0, 18, 12, .2], [-10, 0, 18, 12, .25]], t: [60, 10, 0, 0], desc: 'cupped hand / palm up with coins' },
  wave: { f: [[14, 0, 0, 0, 0], [4, 0, 0, 0, 0], [-6, 0, 0, 0, 0], [-16, 0, 0, 0, 0]], t: [62, 0, 0, 0], desc: 'open hand, fingers slightly apart' },
};
HAND_POSES['phone-pov'] = HAND_POSES['hold-phone']; HAND_POSES.palm = HAND_POSES.open; HAND_POSES['open-palm'] = HAND_POSES.cup; HAND_POSES.phone = HAND_POSES['hold-phone']; HAND_POSES.mug = HAND_POSES['hold-cup'];
export const handPoses = () => Object.keys(HAND_POSES);

class GloveHand {
  constructor(look = {}, o = {}) {
    look = normLook(look);
    this.look = look; this.o = o;
    const style = this.style = o.style || look.handStyle || 'glove';      // 'glove' | 'light' | 'flat'
    // palm width: 8 cm for an adult (the references' palm ~ a phone's width next to the props), scaled for younger ages
    const W = this.W = o.size ?? .08 * ((AGES[look.age]?.D ?? ADULT_D) / ADULT_D) * (look.scale ?? 1);
    this.root = new THREE.Group(); this.root.name = 'hand:' + style; this.root.userData.hand = this;
    this.inner = node(this.root, 0, 0, 0, 'handInner'); if (o.side === 'L') this.inner.scale.x = -1;
    const flat = style === 'flat';
    // colour: black by default; another character's glove can be coloured (iq500 s64: the friend's plum glove ~#4a3040)
    const custom = o.color || look.handColor || look.glove || look.skin || null;
    const fill = custom || (style === 'light' ? '#4e4047' : flat ? COL.mitten : COL.glove);
    this.mF = mat(fill);
    this.mLine = mat(custom ? mixHex(custom, '#0b080e', .62) : style === 'light' ? '#1d121b' : COL.gloveLine);
    this.mHi = mat(custom ? mixHex(custom, '#ffffff', .2) : style === 'light' ? '#67595d' : COL.gloveHi);
    this.mTend = mat(custom ? mixHex(custom, '#0b080e', .25) : '#231b26'); this.mSheen = mat(custom ? mixHex(custom, '#ffffff', .12) : COL.mittenSheen);
    this.rimMat = mat(flat ? COL.mittenRim : COL.gloveRim, { unique: true }); this.rimMat.userData.own = true;
    this.fingers = []; this.held = [];
    const z = k => k * S;
    // sleeve + cuff + watch (the arm comes from the frame edge in clothing colour)
    const sleeveCol = o.sleeve === false ? null : (typeof o.sleeve === 'string' ? o.sleeve : look.outfit.top !== 'none' ? look.outfit.color : null);
    if (sleeveCol) {
      const sw = W * (flat ? 1.14 : 1.05), sl = W * (o.sleeveLen ?? 3), gap = flat ? W * .08 : -W * .05;
      const sg = node(this.inner, 0, -W * .32 - gap, z(flat ? 0 : 6), 'sleeve');
      const sm = ms(G(`hsl|${f4(sw)}|${f4(sl)}`, () => rrect(sw, sl, flat ? W * .06 : W * .04).geometry), mat(sleeveCol), 0); sm.position.y = -sl / 2; sm.userData.sil = true;
      const sd = ms(G(`hsd|${f4(sw)}|${f4(sl)}`, () => rrect(sw * .32, sl, 0).geometry), mat(shade(sleeveCol, -.2)), S * .3); sd.position.set(sw * .34, -sl / 2, S * .3);
      const band = ms(G(`hcf|${f4(sw)}`, () => rrect(sw, W * .2, flat ? W * .04 : 0).geometry), flat ? mat('#000000', { opacity: .25 }) : mat(shade(sleeveCol, -.25)), S * .6); band.position.y = -W * .1;
      const hi = ms(G(`hhi|${f4(sw)}|${f4(sl)}`, () => rrect(W * .025, sl * .9, 0).geometry), mat(mixHex(sleeveCol, '#ffffff', .55)), S * .5); hi.position.set(-sw * .47, -sl * .5, S * .5);
      sg.add(sm, sd, band); if (!flat) sg.add(hi);
      const watch = o.watch ?? look.outfit.watch;
      if (watch && !flat) { const wb = ms(G(`hwb|${f4(W)}`, () => rrect(W * 1.0, W * .22, W * .04).geometry), mat('#c9ccd3'), S * .8), wd = ms(circle(W * .2).geometry, mat('#9a9ca4'), S * .9), wf = ms(circle(W * .17).geometry, mat('#f4f4f6'), S), h1 = ms(G(`hwh1|${f4(W)}`, () => lineGeo(`hwh1${f4(W)}`, [[0, 0], [W * .09, W * .05]], W * .025)), mat('#2a2a30'), S * 1.1), h2 = ms(G(`hwh2|${f4(W)}`, () => lineGeo(`hwh2${f4(W)}`, [[0, 0], [-W * .02, W * .12]], W * .025)), mat('#2a2a30'), S * 1.1);
        for (const m of [wb, wd, wf, h1, h2]) m.position.y = -W * .32; sg.add(wb, wd, wf, h1, h2); wb.userData.sil = true; }
      this.sleeve = sg;
    }
    // a plaster cast on this arm (look.cast = this insert's side; true = 'L'): a white plaster tube from the knuckles down the
    // forearm in place of the sleeve, and the sling's band across it (look.sling) - the same cast as the Figure's (_cast)
    const cs = look.cast === true ? 'L' : look.cast;
    if (cs && cs === (o.side === 'L' ? 'L' : 'R')) {
      if (this.sleeve) this.sleeve.traverse(m => { if (m.isMesh) m.visible = false; });
      const sl = W * (o.sleeveLen ?? 3), cw = W * (flat ? 1.2 : 1.14), top = W * .4, len = top + sl + W * .32, col = look.castColor || '#f1eee6';
      const cg = node(this.inner, 0, 0, z(flat ? 1 : 7), 'cast'); this.cast = cg;
      const line = ms(G(`hcastL|${f4(cw)}|${f4(len)}`, () => rrect(cw + W * .06, len + W * .06, cw * .26).geometry), mat(mixHex(col, COL.lineDark, .3)), -S), fill = ms(G(`hcast|${f4(cw)}|${f4(len)}`, () => rrect(cw, len, cw * .24).geometry), mat(col), 0);
      line.position.y = fill.position.y = top - len / 2; line.userData.sil = fill.userData.sil = true; line.userData.kind = fill.userData.kind = 'cast';
      const sh = ms(G(`hcastS|${f4(cw)}|${f4(len)}`, () => rrect(cw * .26, len * .7, cw * .1).geometry), mat(shade(col, -.12)), S); sh.position.set(cw * .3, W * .2 - len * .36, S);
      cg.add(line, fill, sh);
      if (look.sling) { const band = ms(G(`hsling|${f4(cw)}`, () => rrect(cw * 1.22, W * .8, W * .05).geometry), mat(look.slingColor || '#8fb3d9'), S * 2);
        band.position.set(0, -W * 1.25, S * 2); band.rotation.z = .1; band.userData.kind = 'sling'; cg.add(band); }
    }
    // palm (a rounded trapezoid, knuckles at the top) + wrist
    const pz = z(flat ? 2 : 8);
    this.palm = node(this.inner, 0, 0, pz, 'palm');
    if (flat) {
      const wr = ms(G(`mw|${f4(W)}`, () => rrect(W * .77, W * .35, W * .03).geometry), this.mF, 0); wr.position.y = -W * .12; wr.userData.sil = true;
      const pb = ms(G(`mp|${f4(W)}`, () => rrect(W * .98, W * .88, W * .4).geometry), this.mF, S * .2); pb.position.y = W * .38; pb.userData.sil = true;
      const sheen = ms(ellipse(W * .165, W * .215).geometry, this.mSheen, S * .4); sheen.position.set(-W * .14, W * .42, S * .4); sheen.rotation.z = .25;
      this.palm.add(wr, pb, sheen);
    } else {
      const pts = g => trapPts(W * 1.04 + 2 * g, W * .84 + 2 * g, W * 1.0 + 2 * g, W * .32 + g, W * .22 + g).map(([x, y]) => [x, y + W * .8 + g]);
      const pf = ms(fillGeo(`gp|${f4(W)}`, () => pts(0)), this.mF, S * .2), pl = ms(ringGeo(`gp|${f4(W)}|l`, () => pts(W * .02), () => pts(0)), this.mLine, S * .2); pf.userData.sil = true; pl.userData.sil = true;
      this.palm.add(pf, pl);
      // tendon lines and the knuckle row glows
      const tm = this.mTend;
      [-.24, -.06, .12, .28].forEach((x, i) => { const t = ms(G(`tend${i}|${f4(W)}`, () => lineGeo(`tend${i}${f4(W)}`, [[W * x * .7, W * .05], [W * x, W * .55]], W * .018)), tm, S * .4); this.palm.add(t); (this.tendons ??= []).push(t); });
    }
    // fingers: base on the knuckle row, index at the thumb side (-x for a right hand's back)
    const flen = flat ? [.7, .7, .7, .7] : [1.08, 1.2, 1.12, .9], fx = flat ? [-.33, -.11, .11, .33] : [-.36, -.12, .12, .35], fw = flat ? .22 : .245;
    for (let i = 0; i < 4; i++) {
      const L = W * flen[i], t = W * (i === 3 && !flat ? .215 : fw), segL = flat ? [L, 0, 0] : [L * .44, L * .31, L * .25];
      const base = node(this.palm, W * fx[i], flat ? W * .78 : W * .74, S * (1.2 + (3 - i) * .9), 'finger' + i);
      const segs = []; let parent = base;
      for (let k = 0; k < 3; k++) {
        if (!segL[k]) break;
        const n = node(parent, 0, k ? segs[k - 1].len : 0, k ? S * .3 : 0, `f${i}s${k}`);
        const fm = ms(G(`fs|${f4(segL[k])}|${f4(t)}`, () => new THREE.ShapeGeometry(shapeOf(capPts(segL[k], t / 2)))), this.mF, 0); fm.rotation.z = PI; fm.userData.sil = true;
        const ol = flat ? null : ms(uLineGeo(segL[k], t, W * .026, false), this.mLine, 0);   // sides + tip only: a straight finger reads as one capsule
        if (ol) { ol.rotation.z = PI; ol.userData.sil = true; }
        n.add(fm); if (ol) n.add(ol);
        if (!flat && k === 1) { const hi = ms(G(`fh|${f4(segL[1])}|${f4(W)}`, () => rrect(W * .045, segL[1] * .9 + segL[0] * .3, W * .022).geometry), this.mHi, S * .1); hi.position.set(-t * .18, segL[1] * .35, S * .1); n.add(hi); }
        if (!flat && k < 2) { const gl = glow(W * .12, '#c88a5a', { opacity: .2, add: true }); gl.position.set(0, segL[k], S * .2); n.add(gl); }
        segs.push({ n, len: segL[k], mesh: fm });
      }
      this.fingers.push({ base, segs, L, segL, t, bx: base.position.x, by: base.position.y });
    }
    // thumb (2 segments) from the lower thumb side of the palm
    const tl = W * (flat ? .42 : .7), tt = W * (flat ? .24 : .25);
    this.thumbBase = node(this.palm, -W * (flat ? .43 : .42), W * (flat ? .32 : .18), S * 1.0, "thumb"); this._tb0 = [this.thumbBase.position.x, this.thumbBase.position.y];
    this.thumb = []; let par = this.thumbBase;
    const tseg = flat ? [tl] : [tl * .55, tl * .45];
    tseg.forEach((len, k) => { const n = node(par, 0, k ? tseg[k - 1] : 0, k ? S * .3 : 0); const fm = ms(G(`fs|${f4(len)}|${f4(tt)}`, () => new THREE.ShapeGeometry(shapeOf(capPts(len, tt / 2)))), this.mF, 0); fm.rotation.z = PI; fm.userData.sil = true; n.add(fm);
      if (!flat) { const ol = ms(uLineGeo(len, tt, W * .026, false), this.mLine, 0); ol.rotation.z = PI; ol.userData.sil = true; n.add(ol);
        if (k === 0) { const hi = ms(G(`th|${f4(len)}|${f4(W)}`, () => rrect(W * .035, len * .8, W * .017).geometry), this.mHi, S * .1); hi.position.set(-tt * .15, len * .5, S * .1); n.add(hi); } }
      this.thumb.push({ n, len, mesh: fm }); par = n; });
    // hold slots: behind the fingers (in front of the palm) and in front of everything
    this.slot = node(this.inner, 0, W * .9, S * (flat ? 1.6 : 7.5), 'slot');
    this.slotFront = node(this.inner, 0, W * .9, S * 14, 'slotFront');
    this.rimHold = null; this._rimDir = [-.6, .8];
    this.setPose(o.pose || 'flat');
    if (o.rim !== false) this.setRim(o.rim || (flat ? COL.mittenRim : COL.gloveRim), o.light || [-.6, .8]);
  }
  /** a named pose (HAND_POSES) or { f: [[spread, b1, b2, b3, fold] x4], t: [spread, b1, b2, fold], front, tFront, fFront } */
  setPose(p) {
    const P = typeof p === 'string' ? (HAND_POSES[p] || HAND_POSES.flat) : p; this.poseName = typeof p === 'string' ? p : 'custom'; this.P = P;
    P.f.forEach((s, i) => this.finger(i, { spread: s[0], bend: [s[1], s[2], s[3]], fold: s[4], chain: !!P.chain, len: P.fl?.[i] ?? 1 }));
    this.thumbPose({ spread: P.t[0], bend: [P.t[1], P.t[2]], fold: P.t[3] });
    // a wrapping grip may place the finger bases / thumb itself (fb: [[x, y, deg] x4], tb: [x, y, deg], in palm widths; tk: thumb length)
    const W = this.W;
    this.fingers.forEach((F, i) => { const b = P.fb?.[i]; F.base.position.x = b ? b[0] * W : F.bx; F.base.position.y = b ? b[1] * W : F.by; if (b) F.base.rotation.z = b[2] * DEG; });
    this.thumbBase.position.x = P.tb ? P.tb[0] * W : this._tb0[0]; this.thumbBase.position.y = P.tb ? P.tb[1] * W : this._tb0[1]; if (P.tb) this.thumbBase.rotation.z = P.tb[2] * DEG;
    this.thumbBase.scale.y = P.tk ?? 1;
    for (const t of this.tendons || []) t.visible = !P.palmSide;   // the palm side shows no tendon lines
    // the hold slot: where a held prop's grip sits (palm widths) and its depth: 'back' behind the palm, 'mid' between palm and fingers
    const sp = P.slot || [0, .9], flat = this.style === 'flat';
    this.slot.position.set(sp[0] * W, sp[1] * W, (P.slotZ === 'mid' ? (flat ? 2.6 : 8.6) : (flat ? 1.6 : 7.5)) * S);
    this.slotFront.position.set(sp[0] * W, sp[1] * W, 14 * S);
    // layering: fingers / thumb in front of a held object (fFront / tFront). Two interlocked hands (the handshake) set the
    // layers in whole Z.steps from the hand's root: pz the palm, fz the first finger base, tz the thumb (the far hand's palm
    // between the near hand's fingers and palm, its fingers in front of the near palm)
    const pzA = P.pz ?? (flat ? 2 : 8); this.palm.position.z = pzA * S;
    this.fingers.forEach((f, i) => { f.base.position.z = (P.fz != null ? P.fz + (3 - i) * .9 - pzA : P.fFront ? (flat ? 2.2 : 9) + (3 - i) * .9 : (flat ? 1.2 : 1.2) + (3 - i) * .9) * S; });
    this.thumbBase.position.z = (P.tz != null ? P.tz - pzA : P.tFront ? 13 : 1.0) * S;
    if (this.rimMat) this._syncRim(); return this;
  }
  /** one finger (0 index .. 3 pinky): spread (deg, + = toward the thumb), bend [deg x3] (in-plane curl), fold 0..1 (curled toward the palm: shortens).
   *  The segments are siblings on the knuckle (each bend is its own angle, the classic poses rely on it); chain: true joins
   *  them end to end with the bends adding up (a real hook: the pinky promise), len: a length factor (a cartoon-long finger) */
  finger(i, { spread = 0, bend = [0, 0, 0], fold = 0, chain = false, len = 1 } = {}) {
    const F = this.fingers[i]; if (!F) return this;
    F.base.rotation.z = spread * DEG;
    const fl = clamp(fold, 0, 1);
    let ang = 0, px = 0, py = 0;
    F.segs.forEach((s, k) => {
      // fold: the outer segments shrink first (seen from the back a curled finger is a short stub)
      const keep = k === 0 ? 1 - fl * .55 : k === 1 ? clamp(1 - fl * 1.6) : clamp(1 - fl * 2.6);
      if (chain) {
        if (k) { const p = F.segs[k - 1], L = p.len * p.n.scale.y; px -= Math.sin(ang) * L; py += Math.cos(ang) * L; }
        ang += -(bend[k] || 0) * DEG; s.n.rotation.z = ang; s.n.position.x = px; s.n.position.y = py; s.n.position.z = k ? S * .3 : 0;
      } else {
        s.n.rotation.z = (k ? -(bend[k] || 0) : -(bend[0] || 0)) * DEG;
        s.n.position.x = 0; s.n.position.y = k ? F.segs[k - 1].len : 0; s.n.position.z = k ? S * .3 : 0;
      }
      s.n.scale.y = Math.max(.001, keep * len); s.n.visible = keep > .02;
    });
    this._dirty = true; return this;
  }
  thumbPose({ spread = 50, bend = [0, 0], fold = 0 } = {}) {
    this.thumbBase.rotation.z = spread * DEG;
    this.thumb.forEach((s, k) => { s.n.rotation.z = (bend[k] || 0) * DEG; const keep = k === 0 ? 1 - fold * .4 : clamp(1 - fold * 1.5); s.n.scale.y = Math.max(.001, keep); s.n.visible = keep > .02; });
    this._dirty = true; return this;
  }
  /** a point in the hand's root space: 'palm' 'wrist' 'tip0'..'tip3' (fingertips) 'thumbTip' 'pinch' (between thumb and index tips) 'hold' (the hold slot) */
  grip(name = 'hold') {
    this.root.updateMatrixWorld(true);
    const toRoot = o => { const v = new THREE.Vector3(); o.getWorldPosition(v); return this.root.worldToLocal(v); };
    if (name === 'wrist') return new THREE.Vector3();
    if (name === 'palm') return toRoot(this.palm).add(new THREE.Vector3(0, this.W * .4, 0));
    if (name === 'hold') return toRoot(this.slot);
    const tip = F => { const s = F.segs.filter(x => x.n.visible).pop() || F.segs[0]; const v = new THREE.Vector3(0, s.len * s.n.scale.y, 0); s.n.localToWorld(v); return this.root.worldToLocal(v); };
    if (/^tip\d$/.test(name)) return tip(this.fingers[+name[3]]);
    const tt = () => { const s = this.thumb[this.thumb.length - 1]; const v = new THREE.Vector3(0, s.len * s.n.scale.y, 0); s.n.localToWorld(v); return this.root.worldToLocal(v); };
    if (name === 'thumbTip') return tt();
    if (name === 'pinch') return tip(this.fingers[0]).add(tt()).multiplyScalar(.5);
    return toRoot(this.slot);
  }
  /** put an object in the hand: o.front (over the hand) or behind the fingers (default); o.at = [x, y] (m) or a grip name */
  hold(obj, o = {}) {
    const sl = (o.front ?? this.P?.front) ? this.slotFront : this.slot; sl.add(obj); obj.position.set(0, 0, obj.position.z);
    if (o.at) { const p = typeof o.at === 'string' ? this.grip(o.at) : new THREE.Vector3(o.at[0], o.at[1], 0); this.root.updateMatrixWorld(true); const w = this.root.localToWorld(p.clone()); sl.worldToLocal(w); obj.position.x = w.x; obj.position.y = w.y; }
    this.held.push(obj); return obj;
  }
  setRim(color, dir = [-.6, .8]) {
    this._rimOn = !!color; if (color) this.rimMat.color.set(RIMS[color] || color); this._rimDir = dir; this._syncRim(); return this;
  }
  /** call after finger() / thumbPose() edits so the rim copy follows (setPose does it) */
  update() { this._syncRim(); return this; }
  _syncRim() {
    if (!this._rimOn) { if (this.rimHold) this.rimHold.visible = false; return; }
    if (!this.rimHold) {
      this.rimHold = new THREE.Group(); this.root.add(this.rimHold); this.rimPairs = [];
      const copy = src => { const d = new THREE.Group(); this.rimPairs.push([src, d]);
        for (const c of src.children) { if (c.isMesh) { if (c.userData.sil) { const m = new THREE.Mesh(c.geometry, this.rimMat); this.rimPairs.push([c, m]); d.add(m); } } else if (c !== this.slot && c !== this.slotFront) d.add(copy(c)); }
        return d; };
      this.rimHold.add(copy(this.inner));
    }
    for (const [s, d] of this.rimPairs) { d.position.set(s.position.x, s.position.y, 0); d.rotation.z = s.rotation.z; d.scale.copy(s.scale); d.visible = s.visible; }
    // the light direction is in screen space: undo the card's own rotation
    const [dx, dy] = this._rimDir, n = Math.hypot(dx, dy) || 1, off = this.W * (this.style === 'flat' ? .075 : .03), a = -this.root.rotation.z, c = Math.cos(a), s = Math.sin(a);
    const wx = dx / n * off, wy = dy / n * off;
    this.rimHold.position.set(wx * c - wy * s, wx * s + wy * c, -S); this.rimHold.visible = true;
  }
  /** turn the whole hand card (radians; the rim light stays toward the screen-space light) */
  setAngle(a) { this.root.rotation.z = a; this._syncRim(); return this; }
}
/** a hand-insert card: Hand(look, { pose, side: 'R' | 'L', style: 'glove' | 'light' | 'flat', size (palm width m), sleeve: true | colour | false, sleeveLen (x W), watch, rim, light }) */
export function Hand(look = {}, o = {}) { return new GloveHand(look, o); }
export { GloveHand };
void C; void ring; void ellipse;
