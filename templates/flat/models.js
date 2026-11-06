// Toon Studio - Flat explainer model library: the character rig (any look: the project's main character, Mo, or
// a generated one), the icon kit and helpers. Every element here passed the element gate (QUALITY_STANDARD.md): one
// light (top-left), shading cut from the outline.
// New elements you add: build them with shaded()/ball()/crescent()/clipPts(), mark shading with withRole('detail'),
// then prove them with check_layout (it measures shading outside the form) and render_frames at full size.
import { THREE, C, E, group, circle, ring, arc, rrect, rrOutline, stick, poly, blob, text, lerp, seg, tint, withRole,
  capsulePts, clipPts, circlePts, shiftPts, rotPts, planesOf, shaded, starPieces, crescent, ball, GY } from './engine.js';
import * as MAIN from './character.js';

// ======================================================================================================================
// Character rig v3. One rig, many looks: a LOOK (data: skin, hair, top, pants, shoes, extras, build) is drawn by the trait
// library below; a character.js may add PARTS (functions drawing what the traits can't: a robot head, a tail, a cape).
// The joints, poses, follow-through and expressions are the same for every character, so drive()/expr()/walkPose()
// work on all of them.
//   character(p)                         the project's MAIN character (character.js: name, look, parts)
//   character(p, { look: {...} })        anyone else: a look (merged over Mo's), e.g. randomLook(seed) for extras
//   character(p, { as: 'mo' })           Mo, the style's original character
// Origin = hips. Feet bottom at FEET (negative); placeOnGround() stands a character on the ground line.
// Proportions: head 0.32 of total height (chibi-leaning, reads at phone size), constant-width capsule limbs.
// Angle convention: armL[0] > 0 swings the viewer-left arm OUTWARD, armR[0] < 0 swings the viewer-right arm outward.
// ======================================================================================================================

export const FEET = -205;
const L1 = 92, L2 = 88, LW = 54, A1 = 86, A2 = 80, AW = 44, HY = 108;
const hx = c => typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c;
const hex = n => '#' + hx(n).toString(16).padStart(6, '0');
// skin in shade: warmer and darker (a plain multiply goes grey), measured from Mo's pair f6b48c -> e8986f
export const warmShade = c => { const n = hx(c), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (Math.round(r * .943) << 16) | (Math.round(g * .845) << 8) | Math.round(b * .793); };
const mixHex = (a, b, k) => { const A = hx(a), B = hx(b), f = s => Math.round(((A >> s) & 255) * (1 - k) + ((B >> s) & 255) * k); return (f(16) << 16) | (f(8) << 8) | f(0); };
const lum = c => { const n = hx(c); return (.299 * ((n >> 16) & 255) + .587 * ((n >> 8) & 255) + .114 * (n & 255)) / 255; };
// points on a circle arc (degrees, counter-clockwise from +x)
const arcPts = (cx, cy, r, a0, a1, n = 12) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });

// Mo: the style's original character (navy side-swept bob + top bun, mustard sweater, navy trousers)
export const MO = { name: 'Mo', skin: '#f6b48c', skinShade: '#e8986f', hair: { style: 'bob', color: '#26306e', hi: '#3a46a0', bun: true },
  top: { style: 'sweater', color: '#ffb51f', dark: '#e39a10' }, pants: '#2b3990', shoes: '#1b1238', extras: [], build: { width: 1, head: 1, legs: 1 } };

// The trait catalog (what randomLook() picks from and what a look may name). Colours are tuned for the style: bright,
// saturated, readable on the night / sky / sunset / lemon / mint / rose backgrounds.
export const TRAITS = {
  hair: ['bob', 'crop', 'curls', 'afro', 'long', 'ponytail', 'spiky', 'buzz', 'bald', 'bun', 'braids'],
  top: ['sweater', 'tee', 'hoodie', 'collar', 'jacket', 'stripes'],
  extras: ['glasses', 'glasses-square', 'freckles', 'beard', 'mustache', 'earrings', 'cap', 'beanie', 'headband', 'headphones', 'scarf', 'bowtie', 'lashes'],
  skin: ['#ffdcc4', '#f9c9a5', '#f6b48c', '#eaa679', '#d99060', '#c27a4a', '#a8653a', '#8d5230', '#6e3f24', '#5a321d'],
  hairColor: ['#1f1a2e', '#2e1f17', '#4a2c18', '#6b3e1f', '#a0612e', '#c8452c', '#d9a35a', '#f2cf74', '#ece6f2', '#9aa0b0'],
  hairFun: ['#26306e', '#2bb3a6', '#ff6fae', '#7b4dff', '#3d7bff'],
  topColor: ['#ffb51f', '#ff5a5f', '#1ec98b', '#2aa8ff', '#ff8a1c', '#ff4fa3', '#ffffff', '#14b8b0', '#e83f6f', '#ffd93d', '#5ad1ff', '#9be15d', '#ff9f8a', '#3459e6'],
  pants: ['#2b3990', '#1f6f8b', '#3a3f58', '#5b3a29', '#1e5aa8', '#2f7d4f', '#6b4bb8', '#d9c7a7', '#22223a'],
  shoes: ['#1b1238', '#ffffff', '#ff5a5f', '#ffb51f', '#3d7bff', '#6b3e1f'],
  accent: ['#ffcd1a', '#ff4fa3', '#1ee8a0', '#2aa8ff', '#ff8a1c', '#ffffff', '#a25cf0', '#ff5a5f'],
  names: ['Ava', 'Kai', 'Noor', 'Theo', 'Zara', 'Leo', 'Maya', 'Omar', 'Iris', 'Finn', 'Lina', 'Ravi', 'Sana', 'Milo', 'Yuki', 'Ezra', 'Nia', 'Jonas',
    'Amara', 'Luca', 'Ines', 'Tariq', 'Ruby', 'Hugo', 'Mei', 'Kofi', 'Elsa', 'Diego', 'Leila', 'Arlo', 'Priya', 'Felix', 'Hana', 'Malik', 'Clara', 'Rafa',
    'Juno', 'Nico', 'Aiko', 'Samir', 'Tess', 'Emil', 'Zuri', 'Oscar', 'Lena', 'Kenji', 'Rosa', 'Idris', 'Pia', 'Mateo', 'Ada', 'Bo', 'Sofia', 'Yusuf',
    'Freya', 'Tomas', 'Asha', 'Rio', 'Greta', 'Dev', 'Lucia', 'Ali', 'Nora', 'Kian', 'Esme', 'Joon', 'Mira', 'Otto', 'Selin', 'Baz', 'Vera', 'Ike',
    'Lola', 'Cyrus', 'Wren', 'Anya', 'Teo', 'Dara', 'Remy', 'Ola', 'Sami', 'Bea', 'Niko', 'Faye', 'Jae', 'Lior', 'Mina', 'Rex', 'Suki', 'Vik'],
};
// what can be worn together: hats need a head shape under them, not a big hairdo
const HAT_OK = { cap: ['bob', 'crop', 'long', 'buzz', 'bald', 'braids', 'ponytail'], beanie: ['bob', 'crop', 'long', 'buzz', 'bald', 'braids', 'ponytail', 'curls'],
  headphones: ['bob', 'crop', 'long', 'buzz', 'bald', 'braids', 'ponytail'], headband: ['bob', 'crop', 'long', 'curls', 'ponytail', 'spiky', 'braids', 'bun'] };
const SLOT = { cap: 'head', beanie: 'head', headband: 'head', headphones: 'head', glasses: 'eyes', 'glasses-square': 'eyes', beard: 'chin', mustache: 'chin',
  scarf: 'neck', bowtie: 'neck', freckles: 'skin', earrings: 'ears', lashes: 'lash' };
const NECK_OK = { scarf: ['sweater', 'tee', 'jacket', 'stripes'], bowtie: ['collar', 'tee'] };

// deterministic random look from a seed (integer). Same seed = same character on every computer.
export function randomLook(seed) {
  let s = (seed >>> 0) || 1; const r = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(r() * a.length)];
  const skin = pick(TRAITS.skin), style = pick(TRAITS.hair);
  let hair = r() < .82 ? pick(TRAITS.hairColor) : pick(TRAITS.hairFun);
  for (let i = 0; i < 6 && Math.abs(lum(hair) - lum(skin)) < .14; i++) hair = pick(TRAITS.hairColor);   // hair must read against the face
  const topStyle = pick(TRAITS.top);
  let top = pick(TRAITS.topColor); for (let i = 0; i < 6 && Math.abs(lum(top) - lum(skin)) < .06; i++) top = pick(TRAITS.topColor);
  let accent = pick(TRAITS.accent); for (let i = 0; i < 6 && accent.toLowerCase() === top.toLowerCase(); i++) accent = pick(TRAITS.accent);
  let pants = pick(TRAITS.pants); for (let i = 0; i < 6 && Math.abs(lum(pants) - lum(top)) < .12; i++) pants = pick(TRAITS.pants);
  const n = (x => x < .35 ? 0 : x < .8 ? 1 : 2)(r()), extras = [], used = new Set();
  for (let tries = 0; extras.length < n && tries < 30; tries++) {
    const e = pick(TRAITS.extras), slot = SLOT[e];
    if (used.has(slot) || (HAT_OK[e] && !HAT_OK[e].includes(style)) || (NECK_OK[e] && !NECK_OK[e].includes(topStyle))) continue;
    if ((e === 'beard' || e === 'mustache') && TRAITS.hairFun.includes(hair)) continue;                 // a pink or teal beard reads as a costume
    if (e === 'beard' && (style === 'braids' || style === 'long' || r() < .3)) continue;   // long hair + a beard of the same colour wraps the whole face
    used.add(slot); extras.push(e);
  }
  return { name: pick(TRAITS.names), skin, hair: { style, color: hair, bun: style === 'bob' && r() < .35 }, top: { style: topStyle, color: top, accent },
    pants, shoes: pick(TRAITS.shoes), extras, extraColor: pick(TRAITS.accent),
    build: { width: pick([.94, 1, 1, 1.06]), head: pick([.97, 1, 1, 1.03]), legs: pick([.95, 1, 1, 1.05]) } };
}

// a look with every field filled in (shades derived). Legacy options (shirt, pants, hair, skin, bun...) still work.
export function resolveLook(look = {}, o = {}) {
  const L = { ...MO, ...look, hair: { ...MO.hair, ...(look.hair?.style && look.hair.style !== 'bob' ? { bun: false, hi: null } : {}), ...(look.hair || {}) },
    top: { ...MO.top, ...(look.top?.color && !look.top?.dark ? { dark: null } : {}), ...(look.top || {}) }, build: { ...MO.build, ...(look.build || {}) },
    extras: [...(look.extras || [])] };
  if (look.skin && !look.skinShade) L.skinShade = null;
  if (look.hair?.color && !look.hair?.hi) L.hair.hi = null;
  if (o.shirt != null) { L.top = { ...L.top, color: o.shirt, dark: o.shirtDark ?? null }; }
  if (o.shirtDark != null) L.top.dark = o.shirtDark;
  if (o.pants != null) L.pants = o.pants;
  if (o.hair != null) L.hair = { ...L.hair, color: o.hair, hi: o.hairHi ?? null };
  if (o.hairHi != null) L.hair.hi = o.hairHi;
  if (o.skin != null) { L.skin = o.skin; L.skinShade = o.skinShade ?? null; }
  if (o.skinShade != null) L.skinShade = o.skinShade;
  if (o.bun != null) L.hair.bun = !!o.bun;
  L.skinShade ??= warmShade(L.skin); L.top.dark ??= tint(L.top.color, lum(L.top.color) > .9 ? -.1 : -.11);
  L.hair.hi ??= tint(L.hair.color, lum(L.hair.color) > .8 ? -.12 : .18); L.top.accent ??= C.yellow; L.extraColor ??= '#ff4fa3';
  L.eyes ??= C.ink; L.brows ??= lum(L.hair.color) > .7 || L.hair.style === 'bald' || L.hair.style === 'buzz' ? tint(L.skin, -.55) : tint(L.hair.color, -.25);
  L.mouth ??= '#9b2c46'; L.cheeks ??= '#ff8f9e';
  return L;
}

// ---------- hair: back (behind the head) and front (over it). Head circle: centre (0, HY - 4), r 104. ----------
const HC = HY - 4;
function swingGroup(h, R, x, y, k = 1) { const g = group(h, x, y); R.swing.push({ g, k }); return g; }
function shine(h, x, y, w, rot, col) { withRole('detail', () => { const s = rrect(h, w, 11, 5.5, col, x, y); s.rotation.z = rot; }); }
const capFront = (hairline) => [...arcPts(0, HC, 110, 12, 168, 10), ...hairline];
const PART_LINE = [[-108, 112], [-82, 134], [-46, 162], [-14, 184], [0, 198], [14, 184], [46, 162], [82, 134], [108, 112]];   // centre part: the hairline rises to it
const CROP_LINE = [[-104, 128], [-72, 154], [-30, 164], [12, 152], [56, 166], [92, 146], [106, 126]];
const HAIR = {
  bob: {
    back(h, L) { blob(h, [[-122, HY - 64], [-130, HY + 10], [-104, HY + 92], [-40, HY + 126], [40, HY + 126], [104, HY + 92], [130, HY + 10], [122, HY - 64], [70, HY - 74], [-70, HY - 74]], L.hair.color); },
    front(h, L) { blob(h, [[-112, HY + 24], [-96, HY + 84], [-30, HY + 116], [56, HY + 112], [108, HY + 70], [112, HY + 30], [70, HY + 48], [10, HY + 60], [-40, HY + 44], [-80, HY + 6]], L.hair.color);
      withRole('detail', () => blob(h, [[-60, HY + 96], [-10, HY + 110], [40, HY + 100], [-6, HY + 92]], L.hair.hi, 0, 0, { opacity: 0.8 })); },
  },
  crop: {
    back(h, L) { poly(h, arcPts(0, HC, 112, -12, 192, 24), L.hair.color); },
    front(h, L) { blob(h, capFront(CROP_LINE), L.hair.color); shine(h, -46, HC + 78, 40, .42, L.hair.hi); },
  },
  curls: {
    back(h, L) { for (let a = -28; a <= 208; a += 26) { const q = a * Math.PI / 180; ball(h, 36, L.hair.color, { x: Math.cos(q) * 110, y: HC + Math.sin(q) * 110, spec: false, shade: -.2 }); } },
    front(h, L) { poly(h, arcPts(0, HC, 104, 16, 164, 16), L.hair.color);
      for (let a = 28; a <= 152; a += 20.6) { const q = a * Math.PI / 180; ball(h, 27, L.hair.color, { x: Math.cos(q) * 90, y: HC + Math.sin(q) * 90, shade: -.18, d: .2, spec: false }); } },
  },
  afro: {
    back(h, L) { const pieces = [circlePts(132, 0, HC + 44, 48)];
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + .2; if (Math.sin(a) < -.8) continue; pieces.push(circlePts(40, Math.cos(a) * 130, HC + 44 + Math.sin(a) * 130, 28)); }
      shaded(h, pieces, L.hair.color, { s: 10, k: -.16 });
      // curl marks, on the part of the cloud outside the face
      withRole('detail', () => { for (const d of [190, 160, 130, 100, 70, 40, 10, -10]) arc(h, 13, 4.5, Math.PI * 1.05, Math.PI * 1.75, tint(L.hair.color, -.16), Math.cos(d * Math.PI / 180) * 118, HC + 44 + Math.sin(d * Math.PI / 180) * 118); }); },
    front(h, L) { blob(h, capFront([[-106, 132], [-62, 156], [0, 162], [62, 156], [106, 132]]), L.hair.color);
      for (const [x, y] of [[-92, 140], [-52, 160], [0, 166], [52, 160], [92, 140]]) circle(h, 18, L.hair.color, x, y); },
  },
  long: {
    back(h, L) { blob(h, [[0, HC + 122], [-96, HC + 96], [-126, HC + 20], [-130, HC - 60], [-118, HC - 140], [-92, HC - 176], [-58, HC - 152], [-46, HC - 104], [0, HC - 92],
      [46, HC - 104], [58, HC - 152], [92, HC - 176], [118, HC - 140], [130, HC - 60], [126, HC + 20], [96, HC + 96]], L.hair.color); },
    front(h, L) { blob(h, capFront(PART_LINE), L.hair.color); shine(h, -46, HC + 78, 40, .42, L.hair.hi); },
  },
  ponytail: {
    back(h, L, R) { poly(h, arcPts(0, HC, 112, -10, 190, 24), L.hair.color);
      const t = swingGroup(h, R, 84, HC + 56, .7); shaded(t, rotPts(capsulePts(150, 56, 28), -0.85, 44, -50), L.hair.color, { s: 6, k: -.2 });
      withRole('detail', () => { const tie = rrect(t, 46, 16, 8, L.top.accent, 13, -15); tie.rotation.z = .72; }); },
    front(h, L) { blob(h, capFront([[-104, 136], [-60, 162], [0, 170], [60, 162], [104, 136]]), L.hair.color); shine(h, -46, HC + 78, 40, .42, L.hair.hi); },
  },
  spiky: {
    back(h, L) { const pts = []; for (let i = 0; i <= 12; i++) { const a = (8 + i * 164 / 12) * Math.PI / 180, r = i % 2 ? 148 : 108; pts.push([Math.cos(a) * r, HC + Math.sin(a) * r]); }
      poly(h, [[112, HC - 6], ...pts, [-112, HC - 6]], L.hair.color); },
    front(h, L) { blob(h, capFront(CROP_LINE), L.hair.color); shine(h, -46, HC + 78, 40, .42, L.hair.hi); },
  },
  buzz: {
    back() {},
    front(h, L) { withRole('detail', () => blob(h, [...arcPts(0, HC, 101, 10, 170, 12), [-99, 124], [-66, 140], [0, 146], [66, 140], [99, 124]], mixHex(L.hair.color, L.skin, .38))); },
  },
  bald: {
    back() {},
    front(h, L) { withRole('detail', () => { const s = rrect(h, 44, 16, 8, tint(L.skin, .35), -40, HC + 64); s.rotation.z = .5; }); },
  },
  bun: {
    back(h, L, R) { poly(h, arcPts(0, HC, 112, -10, 190, 24), L.hair.color);
      const b = swingGroup(h, R, 0, HY + 100); circle(b, 40, L.hair.color, 0, 32); crescent(b, 40, 9, tint(L.hair.color, -0.3), 0, 32); withRole('detail', () => circle(b, 13, L.hair.hi, -12, 46)); },
    front(h, L) { blob(h, capFront([[-104, 134], [-60, 160], [0, 168], [60, 160], [104, 134]]), L.hair.color); shine(h, -46, HC + 78, 40, .42, L.hair.hi); },
  },
  braids: {
    back(h, L, R) { poly(h, arcPts(0, HC, 112, -10, 190, 24), L.hair.color);
      for (const sx of [-1, 1]) { const b = swingGroup(h, R, sx * 102, HC + 4, .55);   // long hanging braids swing less than a bun
        [24, 23, 22, 21, 19].forEach((rr, i) => ball(b, rr, L.hair.color, { x: sx * 4, y: -i * 30, spec: false, shade: -.22 }));
        blob(b, [[sx * 4 - 14, -150], [sx * 4 + 14, -150], [sx * 4 + 18, -176], [sx * 4, -170], [sx * 4 - 18, -176]], L.hair.color);
        rrect(b, 32, 13, 6.5, L.top.accent, sx * 4, -146); } },
    front(h, L) { blob(h, capFront(PART_LINE), L.hair.color); shine(h, -46, HC + 78, 40, .42, L.hair.hi); },
  },
};

// ---------- tops: the torso garment. Body = capsule 188 x 214 at (0, 98); light top-left, shade side x > 70. ----------
const BODY = () => capsulePts(188, 214, 74, 0, 98);
function torsoBase(t, col, dark) {
  rrect(t, 188, 214, 74, dark, 0, 98);
  withRole('detail', () => {        // lit side + top highlight are CUT from the torso outline (loose rects poked out at the corners)
    const body = BODY(), inset = capsulePts(168, 194, 64, 0, 98);
    poly(t, clipPts(body, [-1, 0, 70]), col);
    poly(t, clipPts(inset, [0, 1, -186], [-1, 0, 15], [1, 0, 75]), tint(col, 0.3)); });
}
const neckHole = (t, L) => withRole('detail', () => { poly(t, clipPts(circlePts(30, 0, 214, 40), ...planesOf(BODY())), L.skinShade); });
const TOPS = {
  sweater(t, L) { torsoBase(t, L.top.color, L.top.dark); rrect(t, 160, 26, 13, L.top.dark, 0, 4); rrect(t, 74, 22, 11, L.top.dark, 0, 198); },
  tee(t, L) { torsoBase(t, L.top.color, L.top.dark); neckHole(t, L);
    if (L.top.emblem !== false) withRole('detail', () => { const e = group(t, -26, 128); ball(e, 22, L.top.accent, { shade: -.2, spec: false }); }); },
  hoodie(t, L) {
    shaded(t, capsulePts(156, 72, 36, 0, 192), L.top.dark, { s: 5, k: -.12 });                                // hood around the neck
    torsoBase(t, L.top.color, L.top.dark);
    withRole('detail', () => { rrect(t, 118, 52, 20, tint(L.top.color, -.08), -6, 46); rrect(t, 96, 6, 3, tint(L.top.color, -.16), -6, 69);  // pocket
      for (const sx of [-1, 1]) { stick(t, sx * 16, 194, sx * 20, 146, 6, '#ffffff'); circle(t, 5, '#ffffff', sx * 20, 144); } }); },     // drawstrings
  collar(t, L) { torsoBase(t, L.top.color, L.top.dark);
    withRole('detail', () => { stick(t, 0, 186, 0, 14, 4, tint(L.top.color, -.14)); for (const y of [150, 110, 70, 30]) circle(t, 5, tint(L.top.color, -.28), 0, y);
      const c = lum(L.top.color) > .85 ? tint(L.top.color, -.08) : '#ffffff';
      poly(t, [[-40, 198], [-3, 200], [-20, 170]], c); poly(t, [[3, 200], [40, 198], [20, 170]], tint(c, -.06)); }); },
  jacket(t, L) { torsoBase(t, L.top.color, L.top.dark);
    withRole('detail', () => { poly(t, clipPts(BODY(), [1, 0, 28], [-1, 0, 28]), L.top.accent); neckHole(t, L);
      poly(t, [[-28, 202], [-28, 118], [-58, 186]], tint(L.top.color, -.16)); poly(t, [[28, 202], [58, 186], [28, 118]], tint(L.top.dark, -.12)); }); },
  stripes(t, L) { torsoBase(t, L.top.color, L.top.dark);
    withRole('detail', () => { for (let i = 0; i < 4; i++) { const y0 = 22 + i * 44, y1 = y0 + 18, band = clipPts(BODY(), [0, 1, -y0], [0, -1, y1]);
      poly(t, clipPts(band, [-1, 0, 70]), L.top.accent); poly(t, clipPts(band, [1, 0, -70]), tint(L.top.accent, -.14)); } });
    neckHole(t, L); },
};
const SHORT_SLEEVES = new Set(['tee', 'stripes']);

// ---------- extras ----------
function headwear(h, L, e) {
  const c = L.extraColor;
  // brows sit at y 128..138 (head space): every hat stays above y 140
  if (e === 'cap') { shaded(h, clipPts(circlePts(113, 0, HC, 64), [0, 1, -(HC + 44)]), c, { s: 6, k: -.18 });
    shaded(h, capsulePts(124, 24, 12, -84, HC + 48), tint(c, -.1), { s: 4, k: -.2 }); ball(h, 9, tint(c, -.15), { y: HC + 113, spec: false }); }
  if (e === 'beanie') { shaded(h, clipPts(circlePts(114, 0, HC, 64), [0, 1, -(HC + 58)]), c, { s: 6, k: -.18 });
    shaded(h, capsulePts(204, 36, 18, 0, HC + 56), tint(c, -.1), { s: 5, k: -.16 }); ball(h, 22, '#ffffff', { y: HC + 124, shade: -.14 }); }
  if (e === 'headband') { arc(h, 102, 18, Math.PI * .1, Math.PI * .9, c, 0, HC); withRole('detail', () => arc(h, 105, 5, Math.PI * .55, Math.PI * .85, tint(c, .4), 0, HC)); }
  if (e === 'headphones') { arc(h, 122, 14, Math.PI * .04, Math.PI * .96, tint(c, -.45), 0, HC);
    for (const sx of [-1, 1]) shaded(h, capsulePts(34, 66, 17, sx * 114, HC - 6), c, { s: 4, k: -.2 }); }
}
function faceExtras(f, L) {
  const ex = new Set(L.extras), ink = C.ink;
  if (ex.has('freckles')) for (const sx of [-1, 1]) for (const [x, y] of [[58, -14], [72, -22], [62, -30], [76, -36]]) circle(f, 3.5, tint(L.skin, -.3), sx * x, y);
  if (ex.has('mustache')) blob(f, [[-30, -21], [-16, -13], [0, -16], [16, -13], [30, -21], [16, -25], [0, -21], [-16, -25]], L.hair.color);   // between the eyes (bottom -13) and the mouth (top -24)
  if (ex.has('glasses')) { for (const sx of [-1, 1]) { circle(f, 21, '#ffffff', sx * 40, 2, { opacity: .16 }); ring(f, 24, 6, ink, sx * 40, 2); } stick(f, -17, 6, 17, 6, 5, ink); }
  if (ex.has('glasses-square')) { for (const sx of [-1, 1]) { rrect(f, 46, 36, 10, '#ffffff', sx * 40, 2, { opacity: .16 }); rrOutline(f, 46, 36, 10, 6, ink, sx * 40, 2); } stick(f, -15, 6, 15, 6, 5, ink); }
}

// ---------- the rig ----------
export function character(p, opts = {}) {
  const { x = 0, y = 0, scale = 1, flip = false } = opts;
  const src = opts.look ? { look: opts.look, parts: opts.parts } : opts.as === 'mo' ? { look: MO } : { look: MAIN.look || MO, parts: MAIN.parts };
  const L = resolveLook(src.look, opts), P = src.parts || {}, ex = new Set(L.extras);
  const g = group(p, x, y); g.scale.set(flip ? -scale : scale, scale, 1);
  const bw = L.build.width || 1, lk = L.build.legs || 1, l1 = L1 * lk, l2 = L2 * lk;
  const R = { scale, look: L, swing: [], feet: FEET - (L1 + L2) * (lk - 1), name: src.look?.name ?? MAIN.name ?? 'Mo' };
  const ctx = { look: L, R, HY, tint, warmShade };
  const short = SHORT_SLEEVES.has(L.top.style) && !P.torso;
  const limb = (px, py, a1, a2, w, c1, c2, endFn) => {
    const a = group(g, px, py); stick(a, 0, 0, 0, -a1, w, c1);
    const b = group(a, 0, -a1); stick(b, 0, 0, 0, -a2, w, c2);
    endFn(b, a2); return { a, b };
  };
  P.back?.(g, ctx);
  // back arm first (behind torso) so a raised/swinging arm never cuts the face from behind
  const hand = (side, col) => (b, l) => P.hand ? P.hand(b, l, ctx, side) : circle(b, 27, col, 0, -l);
  R.armR = limb(86 * bw, 172, A1, A2, AW, L.top.dark, short ? L.skinShade : L.top.dark, hand('back', L.skinShade));
  const foot = side => (b, l) => P.foot ? P.foot(b, l, ctx, side) : rrect(b, 84, 36, 18, L.shoes, 12, -l - 4);
  R.legL = limb(-32 * bw, 6, l1, l2, LW, L.pants, L.pants, foot('left'));
  R.legR = limb(32 * bw, 6, l1, l2, LW, L.pants, L.pants, foot('right'));
  // torso: the top (or the character's own), then what is worn around the neck
  R.torso = group(g); R.torso.scale.x = bw;
  if (P.torso) P.torso(R.torso, ctx); else (TOPS[L.top.style] || TOPS.sweater)(R.torso, L);
  if (ex.has('scarf')) { shaded(R.torso, capsulePts(36, 92, 18, 44, 150), tint(L.extraColor, -.08), { s: 4, k: -.18 }); shaded(R.torso, capsulePts(180, 42, 21, 0, 194), L.extraColor, { s: 5, k: -.18 }); }
  if (ex.has('bowtie')) { poly(R.torso, [[-34, 210], [-34, 182], [0, 196]], L.extraColor); poly(R.torso, [[34, 182], [34, 210], [0, 196]], tint(L.extraColor, -.12)); circle(R.torso, 8, tint(L.extraColor, -.2), 0, 196); }
  // head
  R.head = group(g, 0, 214); R.head.scale.setScalar(L.build.head || 1);
  const h = R.head;
  const hs = P.hair ? null : (HAIR[L.hair.style] || HAIR.bob);
  R.bun = group(h, 0, HY + 100);   // Mo's bun pivot (kept for old scenes); every swinging part is in R.swing
  if (L.hair.style === 'bob' && L.hair.bun && !P.hair) { R.swing.push({ g: R.bun, k: 1 }); circle(R.bun, 40, L.hair.color, 0, 32); crescent(R.bun, 40, 9, tint(L.hair.color, -0.3), 0, 32); withRole('detail', () => circle(R.bun, 13, L.hair.hi, -12, 46)); }
  if (P.hairBack) P.hairBack(h, ctx); else hs?.back(h, L, R);
  rrect(h, 52, 40, 18, L.skinShade, 0, 4); withRole('detail', () => rrect(h, 52, 12, 6, tint(L.skinShade, -0.15), 0, 18)); // neck + chin shadow
  if (P.head) P.head(h, ctx);
  else { circle(h, 104, L.skin, 0, HC); crescent(h, 104, 16, L.skinShade, 0, HC);                       // form shade, light top-left
    circle(h, 20, L.skinShade, -102, HY - 10); circle(h, 20, L.skinShade, 102, HY - 10); }               // ears
  if (ex.has('earrings')) for (const sx of [-1, 1]) ball(h, 8, '#ffcd1a', { x: sx * 103, y: HY - 36, spec: false });
  if (ex.has('beard')) blob(h, [[-103, 98], [-99, 50], [-74, 12], [-36, -8], [0, -14], [36, -8], [74, 12], [99, 50], [103, 98], [80, 74], [40, 58], [0, 54], [-40, 58], [-80, 74]], L.hair.color);
  if (P.hair) P.hair(h, ctx); else hs.front(h, L, R);
  for (const e of ['cap', 'beanie', 'headband', 'headphones']) if (ex.has(e)) headwear(h, L, e);
  P.hat?.(h, ctx);
  withRole('detail', () => {
  R.face = group(h, 0, HY - 10);
  R.eyes = [-40, 40].map(ex0 => {
    const e = group(R.face, ex0, 2);
    e.userData.open = group(e); circle(e.userData.open, 15, L.eyes); circle(e.userData.open, 5, C.white, 5, 6);
    if (ex.has('lashes')) stick(e.userData.open, Math.sign(ex0) * 12, 9, Math.sign(ex0) * 21, 17, 5, L.eyes);
    e.userData.shut = arc(e, 15, 7, Math.PI * 1.12, Math.PI * 1.88, L.eyes, 0, 8);
    e.userData.happy = arc(e, 15, 7, Math.PI * 0.12, Math.PI * 0.88, L.eyes, 0, -8);
    e.userData.half = group(e); const hc = circle(e.userData.half, 15, L.eyes, 0, -4); hc.scale.y = 0.45; rrect(e.userData.half, 36, 7, 3.5, L.eyes, 0, 4);
    return e;
  });
  R.brows = [-40, 40].map(bx => { const b = group(R.face, bx, 35); stick(b, -14, 0, 14, 0, 9, L.brows); return b; });
  if (!ex.has('beard')) { circle(R.face, 16, L.cheeks, -66, -26, { opacity: 0.5 }); circle(R.face, 16, L.cheeks, 66, -26, { opacity: 0.5 }); }
  faceExtras(R.face, L);
  R.mouth = {
    smile: arc(R.face, 18, 7, Math.PI * 1.15, Math.PI * 1.85, L.mouth, 0, -16),
    flat: rrect(R.face, 26, 8, 4, L.mouth, 0, -34),
    o: circle(R.face, 11, L.mouth, 0, -38),
    grin: blob(R.face, [[-26, -24], [26, -24], [18, -46], [0, -52], [-18, -46]], L.mouth),
    frown: arc(R.face, 18, 7, Math.PI * 0.2, Math.PI * 0.8, L.mouth, 0, -52),
  };
  P.face?.(R.face, ctx);
  });
  // front arm last
  R.armL = limb(-86 * bw, 172, A1, A2, AW, L.top.color, short ? L.skin : L.top.color, hand('front', L.skin));
  P.front?.(g, ctx);
  g.userData.R = R; g.userData.kind = 'character';
  setFace(g); pose(g, {});
  return g;
}

export function setFace(ch, eyes = 'open', mouth = 'smile', brow = 0) {
  const R = ch.userData.R;
  for (const e of R.eyes) for (const k of ['open', 'shut', 'happy', 'half']) e.userData[k].visible = k === eyes;
  for (const k in R.mouth) R.mouth[k].visible = k === mouth;
  // brow: -1 worried (inner ends up), 0 neutral, +1 determined (inner ends down)
  R.brows[0].rotation.z = -0.28 * brow; R.brows[1].rotation.z = 0.28 * brow;
}

export const REST = { armL: [0.14, 0.12], armR: [-0.14, -0.12], legL: [0.02, 0], legR: [-0.02, 0], head: 0, look: [0, 0], bob: 0, lean: 0, bun: 0, breath: 0 };
export function pose(ch, o) {
  const P = { ...REST, ...o }, R = ch.userData.R;
  R.armL.a.rotation.z = -P.armL[0]; R.armL.b.rotation.z = -P.armL[1];
  R.armR.a.rotation.z = -P.armR[0]; R.armR.b.rotation.z = -P.armR[1];
  R.legL.a.rotation.z = P.legL[0]; R.legL.b.rotation.z = P.legL[1];
  R.legR.a.rotation.z = P.legR[0]; R.legR.b.rotation.z = P.legR[1];
  R.head.rotation.z = P.head; R.face.position.x = P.look[0]; R.face.position.y = 98 + P.look[1];
  R.head.position.y = 214 + P.bob + P.breath * 3; R.torso.position.y = P.bob * 0.5; R.torso.rotation.z = P.lean;
  R.torso.scale.y = 1 + P.breath * 0.012;
  for (const s of R.swing || [{ g: R.bun, k: 1 }]) s.g.rotation.z = P.bun * s.k;      // bun, ponytail, braids: secondary motion
}
// V3 follow-through: evaluate the pose function at t and slightly earlier; the difference drives the drag.
// Forearms trail the upper arm, the bun trails the head and the bob, the body breathes. Pure function of t.
export function drive(ch, f, t, { breathe = true } = {}) {
  const P = { ...REST, ...f(t) }, Q = { ...REST, ...f(t - 0.08) };
  const drag = (p, q) => [p[0], p[1] + 0.7 * (q[0] - p[0])];
  pose(ch, { ...P, armL: drag(P.armL, Q.armL), armR: drag(P.armR, Q.armR),
    // soft limit (tanh): linear for head turns, saturates near 17 deg; walking used to throw the bun and hair 40 deg a step
    bun: P.bun + 0.3 * Math.tanh((1.6 * (Q.head - P.head) - 0.012 * (P.bob - Q.bob) * 10) / 0.3) + 0.03 * Math.sin(t * 2.3 - 0.8),
    breath: breathe ? Math.sin(t * 2.3) : 0 });
}
// blink with in-between frames: open -> half -> shut -> half -> open (5 frames at 60 fps)
export function blinkState(t, seed = 0, base = 'open') {
  const u = (t + seed) % 3.4;
  if (base !== 'open') return base;
  return u < 0.033 ? 'half' : u < 0.066 ? 'shut' : u < 0.1 ? 'half' : 'open';
}
export const mixPose = (a, b, k) => {
  const o = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[key] ?? REST[key], vb = b[key] ?? REST[key];
    o[key] = Array.isArray(va) ? va.map((v, i) => lerp(v, vb[i], k)) : lerp(va, vb, k);
  }
  return o;
};
// named poses (scenes should use these, not raw angles)
export const POSES = {
  rest: {},
  hipsOut: { armL: [0.5, -1.6], armR: [-0.5, 1.6] },                      // hands on hips
  shrug: { armL: [0.9, 1.2], armR: [-0.9, -1.2], head: 0.06 },            // palms up
  cheer: { armL: [2.6, 0.25], armR: [-2.6, -0.25], bob: 6 },
  wave: { armR: [-2.4, -0.6] },
  stop: { armR: [-1.5, -1.3], armL: [0.2, 0.3] },                         // palm out toward screen-right
  sad: { armL: [0.05, 0.05], armR: [-0.05, -0.05], head: -0.1, look: [0, -8], bob: -6 },
  think: { armL: [0.15, 0.1], armR: [-0.4, -2.4], head: 0.08, look: [10, 6] }, // hand to chin
};
// walk cycle: phase in cycles (1 = one full stride pair). amt fades it in/out.
export function walkPose(phase, amt = 1, base = {}) {
  const s = Math.sin(phase * Math.PI * 2), c = Math.cos(phase * Math.PI * 2);
  const k = amt;
  return mixPose(base, {
    legL: [0.42 * s * k, Math.max(0, -c) * -0.7 * k], legR: [-0.42 * s * k, Math.max(0, c) * -0.7 * k],
    armL: [0.14 - 0.45 * s * k, 0.25 * k], armR: [-0.14 - 0.45 * s * k, -0.25 * k],
    bob: Math.abs(c) * 8 * k, head: 0.03 * s * k,
  }, 1);
}
// deterministic blink: returns true for ~5 frames every ~3.1 s
export const blinking = (t, seed = 0) => ((t + seed) % 3.1) < 0.09;

// V4: expression timeline. keys = [[time, eyes, mouth, brow], ...] (first key at 0).
// Nothing snaps: brows ease, the old mouth shrinks out (0.06 s) and the new one grows in with overshoot (0.1 s),
// eyes changing between open/happy pass through 'shut' for 3 frames, 'open' eyes blink with in-betweens.
export function expr(ch, t, keys, seed = 0) {
  const R = ch.userData.R;
  let i = 0; keys.forEach((k, j) => { if (t >= k[0]) i = j; });
  const [kt, eyes, mouth, brow = 0] = keys[i], prev = keys[Math.max(0, i - 1)];
  const since = t - kt;
  let e = eyes;
  if (i > 0 && prev[1] !== eyes && since < 0.05) e = 'shut';
  else if (e === 'open') e = blinkState(t, seed);
  setFace(ch, e, mouth, 0);
  const b = i > 0 ? lerp(prev[3] ?? 0, brow, E.inOutCubic(seg(t, kt, kt + 0.2))) : brow;
  R.brows[0].rotation.z = -0.28 * b; R.brows[1].rotation.z = 0.28 * b;
  for (const k in R.mouth) R.mouth[k].scale.set(1, 1, 1);
  if (i > 0 && prev[2] !== mouth && since < 0.16) {
    if (since < 0.06) { for (const k in R.mouth) R.mouth[k].visible = k === prev[2]; R.mouth[prev[2]].scale.set(1 + 0.2 * since / 0.06, Math.max(0.05, 1 - since / 0.06 * 0.85), 1); }
    else { const k = E.outBack(seg(since, 0.06, 0.16), 2.4); R.mouth[mouth].scale.set(Math.max(0.05, 1.2 - 0.2 * k), Math.max(0.05, 0.15 + 0.85 * k), 1); }
  }
}
// smooth hump 0 -> 1 -> 0 over [a, b]
export const bump = (t, a, b) => Math.sin(Math.PI * seg(t, a, b));

// Reusable kit: our own character rig + icon set, all rounded primitives, no outlines.


// ---------- icons (each fits ~ a 100 px circle, centred) ----------
// ---- held phone: right hand holding a phone from behind. Layer order (back -> front):
// sleeve, forearm, palm (behind) | phone thickness, body, screen | fingertips over the LEFT edge | screen content
// (callback) | thumb in front on the RIGHT edge. Same top-left light as everything else.
export function heldPhone(p, screenFn, { skin = C.skin, shade = C.skinShade, shirt = C.shirt, shirtShade = 0xe39a10 } = {}) {
  const g = group(p);
  const back = group(g);
  stick(back, 210, -300, 330, -700, 180, shade); withRole('detail', () => stick(back, 200, -300, 316, -700, 160, skin));          // forearm
  stick(back, 262, -470, 360, -760, 205, shirtShade); withRole('detail', () => stick(back, 254, -470, 350, -760, 190, shirt));   // sleeve
  withRole('detail', () => { const cuff = group(back, 258, -478); cuff.rotation.z = Math.atan2(-290, 98); rrect(cuff, 30, 204, 14, 0xd88f0c); });
  circle(back, 112, shade, 132, -228); withRole('detail', () => circle(back, 104, skin, 124, -222));                            // palm
  withRole('thickness', () => rrect(g, 372, 662, 62, 0x0d0a20, 6, -8));
  rrect(g, 360, 650, 56, C.ink);
  withRole('detail', () => { rrect(g, 324, 610, 40, 0x6fd3ff); rrect(g, 120, 18, 9, C.ink, 0, 296); rrect(g, 10, 520, 5, tint(0x6fd3ff, 0.35), -150, 20); });
  [[-40, 58, 46], [-112, 62, 48], [-184, 60, 46], [-250, 50, 40]].forEach(([y, w, h]) => {
    const f = group(g, -170, y); f.rotation.z = -0.12;
    withRole('thickness', () => rrect(f, w, h, h / 2, shade, 4, -5)); rrect(f, w, h, h / 2, skin);
    withRole('detail', () => rrect(f, w * 0.45, 8, 4, tint(skin, 0.35), -w * 0.12, h * 0.22)); });
  const screen = group(g); if (screenFn) withRole('detail', () => screenFn(screen));
  const thumb = group(g);
  stick(thumb, 236, -300, 164, -150, 64, shade); withRole('detail', () => stick(thumb, 230, -300, 160, -152, 58, skin));
  withRole('detail', () => { const nail = group(thumb, 166, -162); nail.rotation.z = -1.1; rrect(nail, 30, 22, 10, tint(skin, 0.28)); });
  return g;
}

export const icons = {
  brain(p, s = 1, col = C.pink) {
    // lobes = overlapping circles (reads as "brain" at any size), grooves = short capsules
    const g = group(p); g.scale.setScalar(s);
    const dark = 0xd8327f, hi = 0xff9fcb;
    for (const [x, y, r] of [[-44, 22, 40], [0, 34, 42], [44, 22, 40], [-52, -18, 34], [52, -18, 34], [-18, -30, 34], [20, -30, 34]]) circle(g, r + 6, dark, x, y - 4);
    for (const [x, y, r] of [[-44, 22, 40], [0, 34, 42], [44, 22, 40], [-52, -18, 34], [52, -18, 34], [-18, -30, 34], [20, -30, 34]]) circle(g, r, col, x, y);
    stick(g, 0, -52, 0, 64, 7, dark);
    for (const [a, b, c, d] of [[-62, 20, -30, 34], [-56, -18, -26, -10], [30, 34, 62, 20], [26, -10, 56, -18], [-30, 52, -14, 40], [14, 40, 30, 52]]) stick(g, a, b, c, d, 8, dark);
    for (const [x, y] of [[-40, 40], [10, 52]]) circle(g, 8, hi, x, y);
    return g;
  },
  // ---- V4.2: every icon below is shaded with engine.shaded() (one light, top-left). Strokes thinner than ~14 px
  //      (rays, bars, steam, connectors) stay flat by rule. Small features sit inside their parent form.
  book(p) { const g = group(p);
    rrect(g, 70, 90, 9, 0x1d3f9e, 8, -6);                                                    // back cover (darkest, offset bottom-right)
    shaded(g, capsulePts(64, 84, 6, 5, -2), C.white, { s: 5, k: -0.12 });                    // pages
    shaded(g, capsulePts(70, 90, 9, -4, 2), 0x3d7bff, { s: 6 });                             // front cover
    withRole('detail', () => { rrect(g, 36, 8, 4, C.white, -4, 20); rrect(g, 26, 8, 4, 0xa9c2ff, -9, 4); }); return g; },
  gamepad(p) { const g = group(p); shaded(g, capsulePts(110, 62, 31), C.lilac, { s: 7 });
    withRole('detail', () => { rrect(g, 30, 9, 4, C.ink, -26, 0); rrect(g, 9, 30, 4, C.ink, -26, 0); });
    ball(g, 8, C.yellow, { x: 24, y: 8, spec: false }); ball(g, 8, C.pink, { x: 38, y: -6, spec: false }); return g; },
  phone(p, s = 1) { const g = group(p); g.scale.setScalar(s); shaded(g, capsulePts(64, 112, 14), 0x241a52, { s: 5, k: -0.3 });
    withRole('detail', () => { shaded(g, capsulePts(52, 90, 8, -1, 3), C.sky, { s: 4, k: -0.18 }); circle(g, 11, C.pink, -1, 15); rrect(g, 32, 8, 4, C.white, -1, -12); rrect(g, 22, 8, 4, C.white, -6, -26); }); return g; },
  coffee(p) { const g = group(p);
    stick(g, -10, 46, -6, 60, 6, 0xd9c8ff); stick(g, 8, 46, 12, 62, 6, 0xd9c8ff);              // steam (stroke: flat)
    ring(g, 16, 9, 0xd8d3ea, 34, 2);                                                           // handle is on the shade side
    const mug = capsulePts(64, 74, 14, 0, -4); shaded(g, mug, C.white, { s: 6, k: -0.12 });
    withRole('detail', () => { const band = clipPts(mug, [0, 1, -6], [0, -1, 24]); poly(g, band, tint(C.orange, -0.2)); poly(g, clipPts(band, ...planesOf(shiftPts(mug, -6, 6))), C.orange); }); return g; },
  bell(p) { const g = group(p);
    const dome = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; dome.push([Math.cos(a) * 38, -20 + Math.sin(a) * 62]); }
    ball(g, 9, C.yellow, { x: 0, y: 48, spec: false }); shaded(g, dome, C.yellow, { s: 6, k: -0.18 });
    shaded(g, capsulePts(92, 16, 8, 0, -26), C.yellow, { s: 4, k: -0.18 }); ball(g, 11, C.orange, { x: 0, y: -40, spec: false }); return g; },
  star(p, s = 1, col = C.yellow) { const g = group(p); g.scale.setScalar(s); shaded(g, starPieces(50, 22), col, { s: 6, k: -0.18 }); return g; },
  clock(p, s = 1) { const g = group(p); g.scale.setScalar(s);
    shaded(g, circlePts(66), C.orange, { s: 6, k: -0.2 }); withRole('detail', () => shaded(g, circlePts(54), C.white, { s: 6, k: -0.1 }));
    withRole('detail', () => { for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; circle(g, i % 3 ? 3 : 5, C.ink, Math.cos(a) * 42, Math.sin(a) * 42); } });
    g.userData.min = withRole('detail', () => stick(g, 0, 0, 0, 38, 7, C.ink)); g.userData.hr = withRole('detail', () => stick(g, 0, 0, 0, 25, 9, C.ink));
    g.userData.min.rotation.z = Math.PI / 2 - Math.PI / 3; g.userData.hr.rotation.z = Math.PI / 2 + Math.PI / 3 + 0.1; // 10:10, never both hands on 12
    withRole('detail', () => circle(g, 7, C.pink)); return g; },
  dna(p) { const g = group(p); for (let i = 0; i < 7; i++) { const y = -48 + i * 16, x = Math.sin(i * 0.9) * 26; stick(g, -x, y, x, y, 6, 0x9fe8ff); ball(g, 8, C.pink, { x: -x, y, spec: false }); ball(g, 8, C.mint, { x, y, spec: false }); } return g; },
  house(p) { const g = group(p);
    shaded(g, capsulePts(76, 56, 6, 0, -24), C.cream, { s: 5, k: -0.14 });
    shaded(g, [[-50, 4], [50, 4], [0, 50]], C.orange, { s: 5, k: -0.2 });
    withRole('detail', () => shaded(g, capsulePts(20, 32, 4, 0, -36), C.purple, { s: 3 })); return g; },
  network(p) { const g = group(p); const pts = [[-36, 30], [30, 38], [40, -20], [-24, -36], [0, 4]];
    for (const [a, b] of [[0, 4], [1, 4], [2, 4], [3, 4], [0, 1], [2, 3]]) stick(g, ...pts[a], ...pts[b], 6, 0x7fd6ff);
    pts.forEach(([x, y]) => ball(g, 10, C.white, { x, y, shade: -0.14, spec: false })); return g; },
  plate(p) { const g = group(p); stick(g, -64, 30, -64, -40, 7, 0xc9d0ff); stick(g, 64, 30, 64, -40, 7, 0xc9d0ff);
    shaded(g, circlePts(46), C.white, { s: 6, k: -0.12 }); withRole('detail', () => circle(g, 30, 0xe7ecff)); return g; },
  moon(p) { const g = group(p);                                                                 // full moon: a shaded ball with craters (the
    ball(g, 42, 0xfff0a8, { shade: -0.16, spec: false });                                       // crescent-as-pasted-disc read as an overlap)
    withRole('detail', () => { for (const [x, y, r] of [[-14, 12, 9], [12, -10, 6], [-6, -20, 5], [18, 16, 4]]) circle(g, r, tint(0xfff0a8, -0.12), x, y); });
    for (const [x, y] of [[-58, 40], [52, -40], [56, 34]]) circle(g, 4, C.white, x, y); return g; },
  check(p, col = C.mint) { const g = group(p);
    const stroke = (x1, y1, x2, y2, w) => rotPts(capsulePts(Math.hypot(x2 - x1, y2 - y1) + w, w, w / 2), Math.atan2(y2 - y1, x2 - x1), (x1 + x2) / 2, (y1 + y2) / 2);
    shaded(g, [stroke(-22, 0, -6, -16, 12), stroke(-6, -16, 24, 18, 12)], col, { s: 3, k: -0.2 }); return g; },
  pill(p, s = 1, a = C.pink, b = C.white) { const g = group(p); g.scale.setScalar(s);
    // V4.1: every layer is cut from the pill's EXACT outline, so shade/highlights can never leave its form
    // (V3/V4 used plain 8 px strips whose square ends stuck out past the rounded caps by ~4 px).
    const cap = capsulePts(75, 26, 13, 7.5, 0), inner = capsulePts(63, 19, 9.5, 7.5, 1.5);
    const L = [-1, 0, 4], R = [1, 0, -4];                       // keep a*x+b*y+c >= 0: L = x <= 4, R = x >= 4 (seam at x = 4)
    poly(g, clipPts(cap, L), tint(a, -0.25)); poly(g, clipPts(cap, R), tint(b, -0.16));          // shade = whole half
    withRole('detail', () => {
      poly(g, clipPts(cap, L, [0, 1, 4]), a); poly(g, clipPts(cap, R, [0, 1, 4]), b);            // lit = above y = -4
      poly(g, clipPts(inner, [-1, 0, -4], [0, 1, -5], [0, -1, 10]), tint(a, 0.45));               // highlights: inset outline, x <= -4,
      poly(g, clipPts(inner, [-1, 0, 36], [1, 0, -14], [0, 1, -5], [0, -1, 10]), tint(b, 0.6)); }); // band y 5..10
    return g; }, // highlights
  calendar(p, label = 'MON', col = C.pink) { const g = group(p);
    const body = capsulePts(120, 120, 18, 0, -4), lit = clipPts(body, ...planesOf(shiftPts(body, -6, 6)));
    poly(g, body, tint(C.white, -0.12)); withRole('detail', () => {
      poly(g, lit, C.white);
      poly(g, clipPts(body, [0, 1, -22]), tint(col, -0.2)); poly(g, clipPts(lit, [0, 1, -22]), col);   // header cut from the body outline
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) rrect(g, 16, 12, 3, 0xd5ccf5, -36 + c * 24, 4 - r * 22); });
    text(g, label, { size: 24, color: '#fff', y: 40 }); return g; },
  sun(p) { const g = group(p); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; stick(g, Math.cos(a) * 40, Math.sin(a) * 40, Math.cos(a) * 52, Math.sin(a) * 52, 8, C.yellow); }
    shaded(g, circlePts(30), C.yellow, { s: 5, k: -0.16 }); return g; },
  dumbbell(p) { const g = group(p); stick(g, -36, 0, 36, 0, 10, 0xc9d0ff);
    for (const x of [-38, 38]) shaded(g, capsulePts(20, 52, 6, x, 0), C.orange, { s: 4 });
    for (const x of [-56, 56]) shaded(g, capsulePts(14, 36, 5, x, 0), C.orange, { s: 3 }); return g; },
};

// icon in a ring badge (hub-and-spoke node)
export function badge(p, iconName, { r = 64, ringCol = C.lilac, fill = 0x341063, x = 0, y = 0, scaleIcon = 0.85 } = {}) {
  const g = group(p, x, y);
  circle(g, r, fill); crescent(g, r, r * 0.16, tint(fill, -0.35)); // V3: inner form shade
  const inner = group(g); inner.scale.setScalar(scaleIcon);
  icons[iconName](inner);
  g.userData.ring = ring(g, r, 11, ringCol); withRole('detail', () => arc(g, r, 5, Math.PI * 0.6, Math.PI * 0.95, tint(ringCol, 0.45))); // ring glint top-left
  g.userData.inner = inner;
  return g;
}

// stand a character on the ground line (feet at GY) at x (a character with longer legs has its own feet line)
export const placeOnGround = (ch, x = 0, scale = ch.userData.R?.scale ?? 1, gy = GY) => { ch.position.set(x, gy - (ch.userData.R?.feet ?? FEET) * scale, 0); return ch; };
