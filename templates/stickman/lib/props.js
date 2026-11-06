// Prop library. Ground props are drawn bottom-centre at (x, y); float props (float: true) are centred on (x, y).
// Sizes are in frame pixels at s = 1 (the frame is 960x540). c = main colour override, text = label for props that show one.
import { P, D, col, rnd, dot, seg, stroke, fill, shape, oval, box, circ, tube, line, wob, spray, text, group, lerp } from './paint.js';

const G = (draw, o = {}) => ({ draw: a => group(a.x, a.y, (a.s || 1) * (a.flip ? -1 : 1), a.s || 1, a.rot || 0, () => draw(a)), ...o });
const F = (draw, o = {}) => G(draw, { float: true, ...o });

export const PROPS = {
  // ---------- nature ----------
  tree: G(a => { shape([[-12, 0], [12, 0], [9, 90], [-9, 90]], P.brown); for (const [x, y, r] of [[-38, 110, 42], [36, 112, 40], [0, 150, 50], [0, 100, 44]]) oval(x, y, r, r * .9, col(a.c || 'green'), 3); }),
  pine: G(a => { box(-8, 0, 16, 24, P.brown, 3, .5); for (let k = 0; k < 3; k++) { const b = 18 + k * 34, w = 64 - k * 16; shape([[-w, b], [w, b], [0, b + 66]], col(a.c || 'dgreen'), 3, .6); } }),
  palm: G(() => { tube([[0, 0], [8, 70], [4, 150]], 12, P.lbrown); for (const a of [20, 60, 120, 160, 200]) { const t = a * D; shape([[4, 150], [4 + Math.cos(t) * 80, 150 + Math.sin(t) * 40 - 20], [4 + Math.cos(t) * 40, 158 + Math.sin(t) * 26]], P.green, 3, .8); } }),
  bush: G(a => { for (const [x, y, r] of [[-26, 24, 26], [26, 24, 26], [0, 38, 30]]) oval(x, y, r, r * .85, col(a.c || 'lime'), 3); }),
  deadtree: G(() => { shape([[-10, 0], [10, 0], [6, 150], [-6, 150]], P.gray); tube([[0, 90], [-30, 120], [-38, 140]], 6, P.gray); tube([[0, 110], [28, 135], [34, 158]], 6, P.gray); }),
  stump: G(() => { box(-24, 0, 48, 30, P.brown, 3, .6); oval(0, 30, 24, 7, P.tan, 3); }),
  rock: G(a => shape([[-46, 0], [-40, 34], [-16, 50], [22, 48], [44, 28], [42, 0]], col(a.c || 'gray'))),
  boulder: G(a => shape(circ(0, 60, 80, 62, 20, -10, 190).concat([[80, 0], [-80, 0]]), col(a.c || 'gray'), 3, 2)),
  mountain: G(a => { shape([[-220, 0], [-40, 300], [10, 250], [60, 290], [220, 0]], col(a.c || 'silver')); shape([[-78, 230], [-40, 300], [10, 250], [-6, 238], [-30, 262]], P.white, 2, .5); }),
  volcano: G(a => { shape([[-240, 0], [-60, 240], [60, 240], [240, 0]], col(a.c || 'gray')); oval(0, 240, 60, 12, a.text === 'off' ? P.dgray : P.dorange, 3); if (a.text !== 'off') for (let i = 0; i < 5; i++) shape([[-50 + i * 25, 240], [-40 + i * 25, 290 + (i % 2) * 30], [-30 + i * 25, 240]], P.red, 2, 1); }),
  hill: G(a => shape(circ(0, 0, 260, 110, 30, 0, 180), col(a.c || 'lime'))),
  crater: G(() => { oval(0, 0, 150, 34, P.lbrown, 3); oval(0, -4, 110, 22, P.brown, 3); }),
  lake: G(a => { oval(0, 0, 200, 40, col(a.c || 'blue'), 3); stroke([[-80, 4], [-40, 4]], 3, P.cyan); stroke([[30, -10], [80, -10]], 3, P.cyan); }),
  iceberg: G(() => { shape([[-90, 0], [-60, 90], [-10, 140], [40, 100], [90, 0]], P.white); shape([[-10, 140], [40, 100], [10, 70]], P.cyan, 2, .5); }),
  cloud: F(a => { for (const [x, y, r] of [[-40, 0, 32], [0, 14, 42], [42, 0, 32], [0, -8, 34]]) oval(x, y, r, r * .8, col(a.c || 'white'), 3); }),
  raincloud: F(() => { for (const [x, y, r] of [[-40, 0, 32], [0, 14, 42], [42, 0, 32], [0, -8, 34]]) oval(x, y, r, r * .8, P.gray, 3); for (let i = 0; i < 7; i++) seg([-54 + i * 18, -40], [-62 + i * 18, -70], 3, P.blue); }),
  sun: F(() => { dot(0, 0, 42, 'black'); dot(0, 0, 39, P.yellow); for (let i = 0; i < 10; i++) { const t = i * 36 * D; seg([Math.cos(t) * 52, Math.sin(t) * 52], [Math.cos(t) * 74, Math.sin(t) * 74], 4, P.orange); } }),
  moon: F(a => { dot(0, 0, 36, 'black'); dot(0, 0, 33, P.lyellow); dot(16, 10, 30, col(a.c || 'navy')); }),
  star: F(a => shape(Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 14 : 34, t = (90 + i * 36) * D; return [Math.cos(t) * r, Math.sin(t) * r]; }), col(a.c || 'yellow'), 3, .2)),
  lightning: F(() => shape([[-10, 90], [20, 90], [4, 20], [26, 20], [-20, -90], [-4, -6], [-26, -6]], P.yellow, 3, .3)),
  fire: G(a => { shape([[-60, -12], [60, 12], [64, 2], [-56, -22]], P.brown); shape([[-60, 12], [-56, 22], [64, -10], [60, -20]], P.brown); shape([[-40, 0], [-30, 46], [-16, 26], [-6, 80], [6, 38], [18, 62], [28, 30], [40, 52], [42, 0]], P.red); shape([[-24, 0], [-14, 34], [-4, 20], [6, 50], [16, 24], [28, 0]], P.orange, 2); shape([[-10, 0], [-2, 22], [6, 12], [14, 0]], P.yellow, 2); }),
  flames: F(a => { const w = 120; shape([[-w, -40], [-w * .8, 30], [-w * .6, 0], [-w * .4, 60], [-w * .2, 10], [0, 80], [w * .2, 14], [w * .4, 56], [w * .6, 0], [w * .8, 34], [w, -40]], P.red, 3, 2); shape([[-w * .7, -40], [-w * .5, 10], [-w * .3, -6], [0, 40], [w * .3, -4], [w * .5, 10], [w * .7, -40]], P.orange, 2, 1.5); shape([[-w * .35, -40], [0, 10], [w * .35, -40]], P.yellow, 2, 1); }),
  smoke: F(a => { for (let i = 0; i < 5; i++) oval(Math.sin(i) * 14, i * 30, 24 + i * 6, 18 + i * 4, col(a.c || 'silver'), 2); }),
  explosion: F(() => { const star = (r1, r2, c, n = 14) => shape(Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? r1 : r2, t = (i * 180 / n + rnd() * 6) * D; return [Math.cos(t) * r, Math.sin(t) * r]; }), c, 3, 1); star(70, 120, P.red); star(48, 84, P.orange, 12); star(26, 48, P.yellow, 10); }),
  meteor: F(() => { for (let i = 0; i < 3; i++) shape([[0, 22 - i * 4], [180 - i * 40, 120 - i * 30], [200 - i * 50, 80 - i * 30], [26 - i * 4, -18 + i * 4]], [P.red, P.orange, P.yellow][i], 2, 2); shape(circ(0, 0, 42, 38, 16), P.dgray, 3, 3); dot(-10, 6, 7, P.gray); dot(14, -10, 5, P.gray); }),
  wave: F(a => { const w = 200; shape([[-w, -30], [-w, 10], [-w * .6, 40], [-w * .2, 20], [w * .2, 50], [w * .6, 26], [w, 46], [w, -30]], col(a.c || 'blue'), 3, 1.5); line([[-w * .8, 22], [-w * .5, 34], [-w * .3, 22]], 4, P.cyan); line([[w * .3, 36], [w * .5, 44], [w * .7, 32]], 4, P.cyan); }),
  bubbles: F(() => { for (let i = 0; i < 9; i++) { const x = (rnd() - .5) * 80, y = i * 22; dot(x, y, 6 + rnd() * 5, 'black'); dot(x, y, 4 + rnd() * 3, P.cyan); } }),
  // cross-section of stacked layers (strata, cities, ocean depths): text="top|...|bottom" labels, hi=index (0 = top) highlighted
  layers: F(a => { const L = String(a.text || 'A|B|C|D').split('|'), n = L.length, w = 380, h = 34, top = n * h / 2, hi = a.hi === undefined ? -1 : +a.hi;
    const cols = [P.tan, P.lbrown, '#b07040', P.brown, '#a06030', P.olive];
    L.forEach((t, i) => { const y = top - (i + 1) * h; shape([[-w / 2, y], [w / 2, y], [w / 2, y + h], [-w / 2, y + h]], i === hi ? col(a.c || 'orange') : cols[i % cols.length], 3, 1.2); text(t, w / 2 + 14, y + h / 2, { size: 22, color: i === hi ? 'red' : 'black', outline: null, align: 'left' }); });
    if (a.cut) shape([[-70, top + 4], [70, top + 4], [16, -top + h * 1.5], [-16, -top + h * 1.5]], P.white, 3, 2); }, { thumb: .45 }),
  woodhorse: G(() => { box(-120, 20, 240, 22, P.brown); for (const x of [-90, -30, 30, 90]) { dot(x, 18, 18, 'black'); dot(x, 18, 13, P.lbrown); }
    for (const x of [-80, -55, 50, 75]) box(x - 9, 42, 18, 90, P.lbrown, 3, .5);
    shape([[-100, 126], [100, 126], [106, 200], [-96, 196]], P.lbrown); for (let i = 1; i < 4; i++) stroke([[-98, 126 + i * 18], [102, 126 + i * 18]], 2, P.brown);
    shape([[70, 186], [120, 300], [160, 296], [168, 262], [130, 250], [104, 184]], P.lbrown); dot(140, 280, 5, 'black'); tube([[-100, 190], [-130, 140]], 8, P.brown, 2); stroke([[96, 220], [128, 302]], 8, P.brown); box(-30, 150, 40, 30, P.brown, 2, .3); }),
  // top-down blast map: trees knocked flat, all pointing away from the centre (text = label at the centre)
  burst: F(a => { oval(0, 0, 230, 200, P.lime, 3); oval(0, 0, 70, 60, P.olive, 2);
    for (let i = 0; i < 36; i++) { const t = (i * 10 + rnd() * 5) * D; for (const r of [90, 140, 190]) { if (r > 150 && i % 2) continue; const x = Math.cos(t) * r, y = Math.sin(t) * r * .87; seg([x, y], [x + Math.cos(t) * 30, y + Math.sin(t) * 26], 4, P.brown); dot(x + Math.cos(t) * 32, y + Math.sin(t) * 28, 6, P.dgreen); } }
    for (let i = 0; i < 6; i++) { const t = i * 60 * D; dot(Math.cos(t) * 30, Math.sin(t) * 24, 5, P.brown); }
    text('X', 0, 0, { size: 40, color: 'red' }); }, { thumb: .4 }),
  // ---------- buildings ----------
  hut: G(a => { box(-56, 0, 112, 64, col(a.c || 'tan'), 3, 1); shape([[-80, 60], [0, 140], [80, 60]], P.olive, 3, 1.4); for (let i = 0; i < 5; i++) seg([-50 + i * 25, 70], [-30 + i * 20, 110], 2, P.brown); shape(circ(0, 0, 18, 40, 14, 0, 180), P.dgray, 3, .5); }),
  house: G(a => { box(-70, 0, 140, 100, col(a.c || 'lyellow')); shape([[-86, 96], [0, 170], [86, 96]], P.red); box(-18, 0, 36, 56, P.brown); box(30, 46, 28, 28, P.cyan); box(-58, 46, 28, 28, P.cyan); }),
  cabin: G(() => { box(-74, 0, 148, 90, P.lbrown); for (let i = 1; i < 5; i++) stroke([[-74, i * 18], [74, i * 18]], 2, P.brown); shape([[-90, 86], [0, 150], [90, 86]], P.brown); box(-16, 0, 32, 54, P.brown); }),
  castle: G(a => { const c = col(a.c || 'silver'); box(-120, 0, 240, 140, c); for (const x of [-150, 90]) { box(x, 0, 60, 200, c); for (let i = 0; i < 3; i++) box(x + i * 22, 200, 16, 18, c, 3, .3); } for (let i = 0; i < 5; i++) box(-110 + i * 46, 140, 26, 20, c, 3, .3); shape(circ(0, 0, 30, 70, 16, 0, 180), P.dgray, 3, .5); box(-130, 120, 18, 30, P.dgray, 2, 0); box(112, 120, 18, 30, P.dgray, 2, 0); }),
  pyramid: G(a => { shape([[-200, 0], [0, 200], [200, 0]], col(a.c || 'gold')); for (let i = 1; i < 6; i++) stroke([[-200 + i * 33, i * 33], [200 - i * 33, i * 33]], 2, P.olive); }),
  temple: G(() => { box(-130, 0, 260, 18, P.white); for (let i = 0; i < 6; i++) box(-116 + i * 44, 18, 20, 120, P.white, 3, .4); box(-140, 138, 280, 18, P.white); shape([[-140, 156], [0, 210], [140, 156]], P.white); }),
  ruins: G(() => { box(-130, 0, 260, 14, P.lgray); for (const [x, h] of [[-110, 120], [-60, 70], [10, 130], [70, 40]]) box(x, 14, 22, h, P.lgray, 3, .8); shape([[-30, 14], [10, 30], [20, 14]], P.lgray); }),
  tower: G(a => { box(-34, 0, 68, 260, col(a.c || 'silver')); for (let i = 0; i < 3; i++) box(-34 + i * 26, 260, 16, 18, col(a.c || 'silver'), 3, .3); box(-10, 180, 20, 30, P.dgray, 2, 0); }),
  tent: G(a => { shape([[-90, 0], [0, 110], [90, 0]], col(a.c || 'lbrown')); shape([[-24, 0], [0, 60], [24, 0]], P.brown); }),
  wall: G(a => { box(-200, 0, 400, 90, col(a.c || 'tan')); for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) stroke([[-200 + i * 50 + (r % 2) * 25, r * 22], [-200 + i * 50 + (r % 2) * 25, r * 22 + 22]], 2, P.brown); for (let r = 1; r < 4; r++) stroke([[-200, r * 22], [200, r * 22]], 2, P.brown); }),
  city: G(() => { for (const [x, w, h, c] of [[-230, 70, 160, P.gray], [-150, 60, 240, P.silver], [-80, 80, 190, P.dgray], [10, 60, 280, P.silver], [80, 70, 150, P.gray], [160, 80, 210, P.dgray]]) { box(x, 0, w, h, c); for (let r = 20; r < h - 20; r += 30) for (let q = 10; q < w - 14; q += 22) box(x + q, r, 10, 14, P.lyellow, 0, 0); } }),
  lighthouse: G(() => { shape([[-30, 0], [30, 0], [18, 200], [-18, 200]], P.white); for (const y of [40, 110]) shape([[-28, y], [28, y], [26, y + 30], [-26, y + 30]], P.red, 2, 0); box(-24, 200, 48, 34, P.lyellow); shape([[-30, 234], [0, 262], [30, 234]], P.red); }),
  factory: G(() => { box(-140, 0, 280, 110, P.lbrown); for (let i = 0; i < 4; i++) shape([[-140 + i * 70, 110], [-140 + i * 70, 150], [-70 + i * 70, 110]], P.lbrown); box(90, 110, 30, 110, P.dgray); PROPS.smoke.draw({ x: 105, y: 250, s: .7 }); }),
  // ---------- objects ----------
  boat: G(a => { shape([[-90, 30], [90, 30], [64, 0], [-64, 0]], col(a.c || 'brown')); stroke([[-80, 20], [80, 20]], 2, P.maroon); }),
  ship: G(a => { shape([[-120, 50], [120, 50], [90, 0], [-90, 0]], P.brown); tube([[0, 50], [0, 230]], 5, P.brown, 2); shape([[6, 220], [90, 130], [6, 80]], col(a.c || 'white'), 3, 1); shape([[-6, 210], [-80, 120], [-6, 90]], col(a.c || 'white'), 3, 1); shape([[0, 230], [40, 222], [0, 214]], P.red, 2, 0); }),
  bell: G(() => { shape([[-40, 0], [40, 0], [30, 20], [24, 70], [0, 84], [-24, 70], [-30, 20]], P.olive); dot(0, -4, 9, P.olive); }),
  chest: G(() => { box(-54, 0, 108, 56, P.brown); shape(circ(0, 56, 54, 26, 16, 0, 180), P.lbrown, 3, .5); box(-10, 40, 20, 22, P.gold, 2, 0); for (let i = 0; i < 6; i++) dot(-34 + i * 14, 66 + (i % 2) * 8, 8, P.gold); }),
  gold: G(() => { for (let r = 0; r < 4; r++) for (let i = 0; i < 6 - r; i++) { dot(-60 + r * 12 + i * 24, 10 + r * 16, 13, 'black'); dot(-60 + r * 12 + i * 24, 10 + r * 16, 10.5, P.gold); } }),
  skull: G(() => { dot(0, 34, 30, 'black'); dot(0, 34, 27, P.white); box(-14, 0, 28, 14, P.white, 3, .3); dot(-11, 34, 8, 'black'); dot(11, 34, 8, 'black'); shape([[-3, 20], [3, 20], [0, 26]], 'black', 0, 0); }),
  arrows: G(() => { for (const [x, a] of [[-50, 20], [0, -15], [44, 30]]) group(x, 0, 1, 1, a, () => { stroke([[0, 0], [0, 70]], 4, P.brown); shape([[-9, 58], [0, 76], [9, 58], [0, 64]], P.white, 2, 0); shape([[-6, 0], [0, -8], [6, 0]], P.gray, 0, 0); }); }),
  bones: G(() => { tube([[-40, 8], [40, 22]], 8, P.white, 2); tube([[-36, 26], [44, 4]], 8, P.white, 2); }),
  sword: G(() => { shape([[-6, 0], [6, 0], [6, 120], [0, 134], [-6, 120]], P.silver); box(-24, -6, 48, 10, P.gold, 3, .2); box(-5, -34, 10, 28, P.brown, 3, .2); }),
  shield: F(a => { shape([[-40, 40], [40, 40], [40, 0], [0, -50], [-40, 0]], col(a.c || 'red')); stroke([[0, 34], [0, -40]], 6, P.gold); stroke([[-34, 16], [34, 16]], 6, P.gold); }),
  crown: F(() => shape([[-50, -20], [50, -20], [56, 30], [26, 4], [0, 40], [-26, 4], [-56, 30]], P.gold)),
  scroll: F(() => { box(-50, -60, 100, 120, P.lyellow, 3, 1); oval(0, 62, 56, 10, P.tan); oval(0, -62, 56, 10, P.tan); for (let i = 0; i < 6; i++) stroke([[-34, 38 - i * 16], [34 - (i % 3) * 10, 38 - i * 16]], 3, P.gray); }),
  book: F(a => { box(-50, -36, 100, 72, col(a.c || 'red')); box(-42, -30, 8, 60, P.maroon, 0, 0); }),
  letter: F(() => { box(-50, -32, 100, 64, P.white); stroke([[-50, 32], [0, -4], [50, 32]], 3); }),
  map: F(() => { shape([[-90, -60], [90, -50], [84, 60], [-86, 54]], P.lyellow, 3, 1.5); shape([[-50, -20], [-10, 20], [30, 0], [40, -30], [0, -40]], P.lime, 2, 2); stroke([[-60, 30], [-30, 10], [0, 0], [20, -10]], 3, P.red); text('X', 26, -16, { size: 28, color: 'red', outline: null }); }),
  hourglass: F(() => { box(-34, 56, 68, 10, P.brown, 3, 0); box(-34, -66, 68, 10, P.brown, 3, 0); shape([[-26, 56], [26, 56], [4, 0], [26, -56], [-26, -56], [-4, 0]], P.cyan, 3, .3); shape([[-14, 36], [14, 36], [2, 6], [-2, 6]], P.gold, 0, 0); shape([[-22, -56], [22, -56], [0, -30]], P.gold, 0, 0); }),
  clock: F(() => { dot(0, 0, 48, 'black'); dot(0, 0, 44, P.white); for (let i = 0; i < 12; i++) { const t = i * 30 * D; seg([Math.cos(t) * 36, Math.sin(t) * 36], [Math.cos(t) * 40, Math.sin(t) * 40], 3); } seg([0, 0], [0, 30], 4); seg([0, 0], [20, 0], 4); }),
  globe: F(() => { dot(0, 0, 60, 'black'); dot(0, 0, 57, P.blue); shape([[-30, 30], [-6, 44], [10, 20], [-4, -10], [-34, 0]], P.lime, 2, 2); shape([[16, -20], [40, -6], [44, -34], [24, -46]], P.lime, 2, 2); }),
  planet: F(a => { dot(0, 0, 50, 'black'); dot(0, 0, 47, col(a.c || 'orange')); stroke(circ(0, 0, 90, 18, 30, 200, 340), 5, P.tan); }),
  rocket: G(() => { shape([[-24, 30], [24, 30], [24, 150], [0, 200], [-24, 150]], P.white); dot(0, 130, 12, 'black'); dot(0, 130, 9, P.cyan); shape([[-24, 30], [-50, 0], [-24, 70]], P.red); shape([[24, 30], [50, 0], [24, 70]], P.red); shape([[-14, 30], [14, 30], [0, -30]], P.orange, 2, 1); }),
  car: G(a => { shape([[-90, 14], [90, 14], [90, 50], [50, 54], [30, 86], [-40, 86], [-60, 54], [-90, 50]], col(a.c || 'red')); box(-30, 56, 30, 24, P.cyan, 2, 0); box(8, 56, 28, 24, P.cyan, 2, 0); for (const x of [-52, 52]) { dot(x, 14, 18, 'black'); dot(x, 14, 8, P.silver); } }),
  cart: G(() => { box(-70, 30, 140, 50, P.lbrown); for (const x of [-40, 40]) { dot(x, 26, 26, 'black'); dot(x, 26, 21, P.brown); seg([x - 20, 26], [x + 20, 26], 3); seg([x, 6], [x, 46], 3); } }),
  table: G(() => { box(-80, 70, 160, 12, P.lbrown); seg([-66, 0], [-66, 70], 6, P.brown); seg([66, 0], [66, 70], 6, P.brown); }),
  chair: G(() => { box(-26, 46, 52, 8, P.lbrown); seg([-22, 0], [-22, 46], 5, P.brown); seg([22, 0], [22, 46], 5, P.brown); seg([-22, 54], [-22, 110], 5, P.brown); }),
  bed: G(() => { box(-110, 20, 220, 30, P.white); box(-110, 0, 220, 20, P.brown); box(-110, 0, 14, 80, P.brown); oval(-80, 58, 26, 12, P.white); }),
  computer: G(() => { box(-70, 40, 140, 96, P.silver); box(-60, 50, 120, 76, P.blue, 0, 0); box(-16, 0, 32, 40, P.silver); box(-60, 0, 120, 10, P.silver); }),
  sign: G(a => { tube([[0, 0], [0, 90]], 6, P.brown, 2); box(-70, 80, 140, 60, P.lyellow); if (a.text) text(a.text, 0, 110, { size: 22, color: 'black', outline: null }); }),
  flag: G(a => { tube([[0, 0], [0, 200]], 4, P.brown, 2); shape([[3, 196], [90, 180], [3, 150]], col(a.c || 'red')); }),
  bomb: G(() => { dot(0, 40, 40, 'black'); dot(-12, 52, 8, P.dgray); tube([[18, 72], [30, 92], [44, 94]], 4, P.tan, 2); PROPS.star.draw({ x: 50, y: 98, s: .4, c: 'orange' }); }),
  barrel: G(() => { shape([[-34, 0], [34, 0], [40, 40], [34, 80], [-34, 80], [-40, 40]], P.lbrown); for (const y of [16, 64]) stroke([[-38, y], [38, y]], 4, P.dgray); }),
  crate: G(() => { box(-46, 0, 92, 84, P.tan); stroke([[-46, 0], [46, 84]], 3, P.lbrown); stroke([[-46, 84], [46, 0]], 3, P.lbrown); }),
  ladder: G(() => { seg([-24, 0], [-24, 220], 5, P.brown); seg([24, 0], [24, 220], 5, P.brown); for (let y = 20; y < 220; y += 30) seg([-24, y], [24, y], 4, P.brown); }),
  well: G(() => { box(-60, 0, 120, 60, P.lgray); for (let i = 0; i < 3; i++) stroke([[-60, i * 20], [60, i * 20]], 2, P.gray); seg([-50, 60], [-50, 140], 5, P.brown); seg([50, 60], [50, 140], 5, P.brown); shape([[-70, 136], [0, 176], [70, 136]], P.brown); }),
  statue: G(a => { box(-50, 0, 100, 40, P.gray); const c = col(a.c || 'lgray'); shape([[-20, 40], [20, 40], [24, 150], [-24, 150]], c); dot(0, 180, 30, 'black'); dot(0, 180, 27, c); }),
  totem: G(() => { for (let i = 0; i < 3; i++) { box(-30, i * 60, 60, 60, [P.red, P.lbrown, P.green][i]); dot(-12, i * 60 + 38, 7, 'black'); dot(12, i * 60 + 38, 7, 'black'); stroke([[-14, i * 60 + 16], [14, i * 60 + 16]], 4); } }),
  gravestone: G(a => { shape(circ(0, 60, 40, 30, 16, 0, 180).concat([[40, 0], [-40, 0]]), P.silver); text(a.text || 'RIP', 0, 50, { size: 20, color: 'black', outline: null }); }),
  // ---------- creatures ----------
  bird: F(a => { stroke([[-26, 10], [-12, 0], [0, 6], [12, 0], [26, 10]], 4, col(a.c || 'black')); }),
  fishy: F(a => { shape([[-40, 0], [-10, 18], [24, 10], [40, 0], [24, -10], [-10, -18]], col(a.c || 'orange')); shape([[-40, 0], [-58, 16], [-58, -16]], col(a.c || 'orange'), 3, .4); dot(24, 3, 4, 'black'); }),
  shark: F(() => { shape([[-110, 0], [-40, 26], [50, 22], [110, 0], [50, -24], [-40, -20]], P.gray); shape([[-110, 0], [-140, 30], [-130, 0], [-140, -30]], P.gray); shape([[-10, 24], [10, 70], [30, 22]], P.gray); dot(70, 6, 5, 'black'); stroke([[70, -10], [96, -6]], 3); }),
  whale: F(() => { shape(circ(0, 0, 150, 60, 30, 20, 340).concat([[180, 30], [200, 40], [190, 0], [200, -40], [180, -30]]), P.dblue); oval(-30, -30, 110, 26, P.lblue, 0); dot(-110, 10, 6, 'black'); }),
  horse: G(a => { const c = col(a.c || 'lbrown'); for (const x of [-50, -36, 40, 54]) box(x - 6, 0, 12, 70, c, 3, .4); shape([[-66, 66], [66, 66], [72, 110], [-62, 116]], c); shape([[52, 100], [96, 168], [120, 160], [110, 140], [80, 98]], c); dot(100, 156, 3, 'black'); tube([[-66, 106], [-90, 70]], 6, P.brown, 2); stroke([[58, 116], [92, 170]], 6, P.brown); }),
  cow: G(() => { for (const x of [-50, -36, 40, 54]) box(x - 6, 0, 12, 56, P.white, 3, .4); box(-70, 52, 140, 66, P.white); oval(-20, 90, 20, 14, 'black', 0); oval(30, 70, 14, 10, 'black', 0); shape([[70, 80], [118, 84], [118, 120], [70, 118]], P.white); oval(112, 94, 12, 10, P.pink, 2); dot(96, 112, 3, 'black'); stroke([[80, 120], [74, 136]], 4); }),
  dog: G(a => { const c = col(a.c || 'lbrown'); for (const x of [-34, -22, 26, 38]) box(x - 4, 0, 8, 36, c, 3, .3); box(-44, 32, 92, 34, c); oval(58, 72, 22, 20, c); shape([[48, 86], [40, 106], [56, 92]], P.brown, 2, .2); dot(66, 76, 3, 'black'); dot(80, 70, 4, 'black'); tube([[-44, 58], [-62, 80]], 4, c, 2); }),
  snake: G(() => { tube([[-90, 6], [-50, 20], [-10, 4], [30, 20], [60, 10], [80, 20]], 10, P.lime); dot(86, 22, 10, 'black'); dot(86, 22, 8, P.lime); dot(90, 26, 2, 'black'); stroke([[94, 20], [106, 22]], 2, P.red); }),
  mammoth: G(() => { for (const x of [-60, 40]) box(x - 12, 0, 24, 62, P.maroon, 3, .5); shape([[-80, 52], [-96, 100], [-72, 150], [-15, 174], [42, 164], [78, 160], [106, 142], [112, 110], [100, 84], [70, 60], [50, 46], [-60, 44]], P.brown, 3, 1.4); for (const x of [-36, 54]) box(x - 12, 0, 24, 54, P.brown, 3, .5); oval(66, 124, 15, 22, P.maroon); dot(91, 126, 4, 'black'); tube([[106, 96], [114, 70], [114, 40], [108, 18], [98, 16]], 14, P.brown); tube([[100, 84], [122, 66], [142, 70], [150, 90]], 6, P.white); }),
  dino: G(a => { const c = col(a.c || 'green'); tube([[-30, 50], [-30, 0], [-14, 0]], 12, c); tube([[10, 50], [10, 0], [26, 0]], 12, c); shape([[-140, 70], [-60, 90], [10, 120], [40, 170], [110, 180], [118, 150], [70, 140], [40, 100], [30, 60], [-40, 50]], c, 3, 1.4); dot(96, 168, 4, 'black'); for (let i = 0; i < 4; i++) fill([[78 + i * 9, 146], [82 + i * 9, 140], [86 + i * 9, 146]], P.white); tube([[40, 120], [60, 104], [66, 96]], 5, c, 2); }),
  dragon: F(() => { shape([[-90, 0], [-20, 30], [60, 20], [100, 50], [130, 40], [110, 20], [70, 0], [10, -20], [-80, -20]], P.red, 3, 1.5); shape([[-20, 26], [-60, 110], [10, 70], [40, 120], [40, 24]], P.maroon, 3, 1.5); dot(118, 40, 3, 'black'); shape([[130, 40], [190, 56], [170, 34], [196, 30]], P.orange, 2, 1); }),
  monster: G(a => { const c = col(a.c || 'purple'); shape([[-80, 0], [-90, 140], [-50, 200], [50, 200], [90, 140], [80, 0]], c, 3, 2); for (const x of [-30, 30]) { dot(x, 150, 18, 'black'); dot(x, 150, 15, P.yellow); dot(x, 148, 6, 'black'); } shape([[-50, 90], [50, 90], [30, 60], [-30, 60]], 'black', 0, 1); for (let i = 0; i < 5; i++) fill([[-40 + i * 20, 90], [-30 + i * 20, 90], [-35 + i * 20, 76]], P.white); }),
  // emu (side view, faces +x): run=1 legs mid-stride, e=angry|happy, helmet=1, crown=1
  emu: G(a => { const B = '#5a4632', N = '#8a7a66', run = a.run;
    const leg = (x, ang) => group(x, 74, 1, 1, ang, () => { stroke([[0, 0], [4, -36], [0, -74]], 4, P.dgray); stroke([[0, -74], [14, -74]], 4, P.dgray); });
    leg(-14, run ? 30 : 4); leg(8, run ? -30 : -4);
    oval(-10, 98, 52, 34, B, 3); for (let i = 0; i < 7; i++) stroke([[-48 + i * 13, 92 + (i % 2) * 10], [-54 + i * 13, 80 + (i % 2) * 10]], 3, '#3a2a1a');
    tube([[26, 112], [38, 140], [42, 170]], 9, N); oval(46, 178, 13, 11, N, 3); shape([[56, 182], [74, 176], [56, 172]], P.dgray, 2, 0);
    dot(48, 181, 4, 'black'); dot(49, 182, 1.5, 'white');
    if (a.e === 'angry') stroke([[40, 190], [54, 186]], 3); if (a.e === 'happy') stroke([[42, 186], [48, 190], [54, 186]], 3);
    if (a.helmet) shape(circ(46, 186, 15, 12, 14, 0, 180), P.green, 2.5, .3);
    if (a.crown) shape([[34, 186], [58, 186], [60, 204], [52, 194], [46, 206], [40, 194], [32, 204]], P.gold, 2.5, .2);
    if (run) for (let i = 0; i < 3; i++) seg([-80 - i * 6, 80 + i * 16], [-110 - i * 6, 80 + i * 16], 3, 'black'); }),
  machinegun: G(a => { seg([-30, 0], [-10, 34], 4, P.dgray); seg([30, 0], [10, 34], 4, P.dgray); box(-70, 30, 130, 14, P.dgray, 3, .2); box(-30, 26, 50, 22, P.olive, 3, .2); box(60, 34, 50, 6, P.dgray, 2, 0); oval(-20, 56, 22, 6, P.dgray, 2); box(-100, 24, 34, 18, P.brown, 3, .2);
    if (a.fire) { PROPS.impact.draw({ x: 130, y: 37, s: .45 }); for (let i = 0; i < 3; i++) seg([150 + i * 30, 37], [168 + i * 30, 37], 3, P.orange); } }),
  truck: G(a => { box(-130, 22, 170, 40, col(a.c || 'olive')); shape([[40, 22], [120, 22], [120, 70], [96, 106], [40, 106]], col(a.c || 'olive')); box(70, 72, 30, 26, P.cyan, 2, 0); for (const x of [-90, 80]) { dot(x, 20, 22, 'black'); dot(x, 20, 9, P.silver); } }),
  wheat: G(a => { const w = a.len || 420; for (let x = -w / 2; x < w / 2; x += 16) { const h = 70 + rnd() * 30; stroke([[x, 0], [x + 3, h]], 3, P.olive); oval(x + 3, h + 8, 5, 12, P.gold, 2); } }),
  fence: G(a => { const w = a.len || 360; for (let x = -w / 2; x <= w / 2; x += 60) box(x - 5, 0, 10, 70, P.lbrown, 2.5, .3);
    for (const y of [22, 50]) a.broken ? (stroke([[-w / 2, y], [-20, y + 4]], 6, P.lbrown), stroke([[30, y - 10], [w / 2, y]], 6, P.lbrown)) : stroke([[-w / 2, y], [w / 2, y]], 6, P.lbrown); }),
  // goat (side, faces +x): e=happy|angry, c= body colour
  goat: G(a => { const c = col(a.c || 'white');
    for (const [x, r] of [[-34, 4], [-24, -4], [24, 4], [34, -4]]) group(x, 50, 1, 1, r, () => stroke([[0, 0], [0, -50]], 5, P.dgray));
    oval(0, 66, 50, 26, c, 3); tube([[-48, 74], [-60, 90]], 3, c, 2);
    tube([[34, 74], [48, 92]], 14, c, 3);
    stroke([[56, 112], [48, 126], [40, 128]], 5, P.gray); stroke([[64, 112], [62, 128], [54, 132]], 5, P.gray);
    shape([[44, 100], [36, 92], [40, 108]], P.gray, 2, 0); oval(60, 100, 17, 13, c, 3); oval(76, 94, 10, 8, c, 3); dot(81, 96, 2, 'black');
    shape([[72, 88], [74, 78], [80, 86]], P.white, 2, 0); dot(62, 104, 3.5, 'black');
    if (a.e === 'happy') stroke([[70, 88], [75, 91], [80, 88]], 2.5); if (a.e === 'angry') stroke([[56, 110], [68, 107]], 3); }),
  coffeebush: G(() => { box(-8, 0, 16, 40, P.brown, 3, .5); for (const [x, y, r] of [[-44, 70, 40], [40, 74, 40], [0, 108, 48], [0, 62, 40]]) oval(x, y, r, r * .9, P.green, 3);
    for (let i = 0; i < 16; i++) { const x = -60 + rnd() * 120, y = 50 + rnd() * 90; dot(x, y, 6, 'black'); dot(x, y, 4.5, P.red); } }),
  mug: G(a => { stroke(circ(34, 34, 14, 18, 16, -90, 90), 6, 'black'); stroke(circ(34, 34, 14, 18, 16, -90, 90), 3, col(a.c || 'white'));
    shape([[-30, 0], [30, 0], [34, 66], [-34, 66]], col(a.c || 'white'), 3, .4); oval(0, 66, 34, 8, P.brown, 3);
    if (a.steam !== '0') for (const x of [-14, 4, 20]) line([[x, 78], [x - 6, 92], [x + 4, 106], [x - 2, 120]], 3, P.silver, .5); }),
  church: G(a => { box(-90, 0, 180, 120, col(a.c || 'tan')); shape([[-104, 116], [0, 170], [104, 116]], P.brown); box(-20, 150, 40, 70, col(a.c || 'tan'), 3, .4); shape([[-28, 216], [0, 246], [28, 216]], P.brown, 3, .3);
    seg([0, 246], [0, 276], 5, 'black'); seg([-12, 264], [12, 264], 5, 'black'); shape(circ(0, 0, 22, 54, 16, 0, 180), P.dgray, 3, .3); for (const x of [-60, 60]) shape(circ(x, 60, 12, 24, 12, 0, 180).concat([[x + 12, 40], [x - 12, 40]]), P.cyan, 2, 0); }),
  beans: G(() => { for (let r = 0; r < 3; r++) for (let i = 0; i < 6 - r * 2; i++) { const x = -40 + r * 14 + i * 16, y = 8 + r * 12; oval(x, y, 8, 6, P.brown, 2); stroke([[x - 4, y], [x + 4, y]], 1.5, P.maroon); } }),
  mortar: G(() => { tube([[10, 40], [44, 96]], 8, P.lbrown, 3); shape(circ(0, 40, 50, 40, 20, 180, 360).concat([[50, 46], [-50, 46]]), P.gray, 3, .5); oval(0, 46, 50, 8, P.dgray, 3); }),
  note: F(a => { for (const [x, y] of [[0, 0], [40, 18]]) { oval(x, y, 11, 8, col(a.c || 'black'), 0); seg([x + 9, y], [x + 9, y + 44], 4, col(a.c || 'black')); } seg([9, 44], [49, 62], 7, col(a.c || 'black')); }),
  // a plain block (a layer of salt/water/mud over a scene): len= width, h= height, text= label
  slab: F(a => { const w = a.len || 400, h = +a.h || 100; shape([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], col(a.c || 'white'), 3, 1.5); if (a.text) text(a.text, 0, 0, { size: 40, color: 'red' }); }),
  river: F(a => { const q = [[-60, 130], [-20, 80], [-50, 30], [10, -20], [-10, -70], [40, -130]]; stroke(wob(q, 2, 16, false), 34, 'black'); stroke(wob(q, 1, 16, false), 26, col(a.c || 'blue')); }),
  shaker: G(a => { shape([[-30, 0], [30, 0], [26, 110], [-26, 110]], P.white, 3, .4); shape(circ(0, 110, 26, 20, 16, 0, 180), P.silver, 3, .3); for (const [x, y] of [[-8, 120], [0, 126], [8, 120]]) dot(x, y, 2.5, 'black'); text(a.text || 'S', 0, 50, { size: 34, color: 'black', outline: null }); }),
  scales: G(a => { box(-50, 0, 100, 14, P.brown, 3, .2); seg([0, 14], [0, 170], 7, P.brown); const t = (+a.tilt || 0) * D, L = 130, dy = Math.sin(t) * L;
    seg([-Math.cos(t) * L, 170 - dy], [Math.cos(t) * L, 170 + dy], 6, P.gold); dot(0, 170, 9, P.gold);
    for (const sx of [-1, 1]) { const x = sx * Math.cos(t) * L, y = 170 + sx * dy; seg([x, y], [x - 34, y - 60], 2, 'black'); seg([x, y], [x + 34, y - 60], 2, 'black'); shape(circ(x, y - 60, 44, 14, 16, 180, 360), P.gold, 3, .2); } }),
  // ---------- annotations ----------
  arrow: F(a => { const len = a.len || 120, c = col(a.c || 'red'); shape([[0, -8], [len - 30, -8], [len - 30, -22], [len, 0], [len - 30, 22], [len - 30, 8], [0, 8]], c, 3, .6); }, { thumb: .8 }),
  curvedarrow: F(a => { const c = col(a.c || 'red'), q = circ(0, -60, 90, 60, 14, 160, 30); stroke(q, 9, 'black'); stroke(q, 5, c); const e = q[q.length - 1]; shape([[e[0] - 18, e[1] + 10], [e[0] + 16, e[1] + 10], [e[0] + 6, e[1] - 22]], c, 3, .3); }),
  xmark: F(a => { const c = col(a.c || 'red'); seg([-60, -60], [60, 60], 14, c); seg([-60, 60], [60, -60], 14, c); }),
  check: F(() => { seg([-50, 0], [-14, -40], 14, P.lime); seg([-14, -40], [56, 50], 14, P.lime); }),
  question: F(a => text('?', 0, 0, { size: 90 * (a.big || 1), color: col(a.c || 'black'), outline: null })),
  exclaim: F(a => text('!', 0, 0, { size: 90, color: col(a.c || 'red') })),
  speech: F(a => { const t = a.text || '...', w = Math.max(60, t.length * 12 + 30); shape(circ(0, 0, w / 2 + 10, 34, 30), P.white, 3, .6); shape([[-w * .2, -26], [-w * .35 - 10, -62], [-w * .05, -30]], P.white, 3, .3); fill([[-w * .2 + 2, -24], [-w * .05 - 2, -28], [-w * .12, -36]], P.white); text(t, 0, 2, { size: 24, color: 'black', outline: null }); }),
  thought: F(a => { const t = a.text || '...', w = Math.max(60, t.length * 12 + 30); for (const [x, y, r] of [[-w * .3, -40, 10], [-w * .4, -60, 6]]) oval(x, y, r, r, P.white, 3); shape(circ(0, 0, w / 2 + 14, 36, 30).map(([x, y], i) => [x + (i % 2) * 4, y + (i % 2) * 6]), P.white, 3, 1.4); text(t, 0, 2, { size: 24, color: 'black', outline: null }); }),
  label: F(a => text(a.text || 'Label', 0, 0, { size: a.size || 30, color: col(a.c || 'accent') })),
  circle: F(a => { const r = a.r || 70; stroke(wob(circ(0, 0, r, r * .8, 26), 2, 18), 6, col(a.c || 'red'), true); }),
  dashes: F(a => { const len = a.len || 400, c = col(a.c || 'red'); for (let x = -len / 2; x < len / 2; x += 26) seg([x, 0], [Math.min(x + 15, len / 2), 0], 5, c, undefined, false); }),
  measure: F(a => { const h = a.len || 160, c = col(a.c || 'red'); seg([0, -h / 2], [0, h / 2], 4, c); seg([-12, -h / 2], [12, -h / 2], 4, c); seg([-12, h / 2], [12, h / 2], 4, c); }),
  impact: F(a => { shape(Array.from({ length: 24 }, (_, i) => { const r = i % 2 ? 40 : 80, t = (i * 15 + rnd() * 6) * D; return [Math.cos(t) * r, Math.sin(t) * r * .8]; }), P.yellow, 3, 1); if (a.text) text(a.text, 0, 0, { size: 26, color: 'black', outline: null, rot: 10 }); }),
  sparkle: F(() => { for (const [x, y, s] of [[0, 0, 1], [40, 30, .6], [-36, 24, .5]]) shape(Array.from({ length: 8 }, (_, i) => { const r = i % 2 ? 6 * s : 24 * s, t = i * 45 * D; return [x + Math.cos(t) * r, y + Math.sin(t) * r]; }), P.yellow, 2, 0); }),
  heart: F(a => { const q = []; for (let i = 0; i < 30; i++) { const t = i / 30 * 6.2832; q.push([16 * Math.sin(t) ** 3 * 2, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 2]); } shape(q, col(a.c || 'red'), 3, 0); }),
  zzz: F(() => { for (let i = 0; i < 3; i++) { const k = 1 - i * .2, x = i * 26, y = i * 28, w = 18 * k; stroke([[x, y + w], [x + w, y + w], [x, y], [x + w, y]], 4); } }),
  sweat: F(() => { fill([[0, 20], [-10, -2], [10, -2]], P.blue); dot(0, -6, 11, P.blue); }),
  motion: F(a => { for (let i = 0; i < 3; i++) seg([-60, i * 22 - 22], [0 - i * 10, i * 22 - 22], 4, col(a.c || 'black')); }),
  shock: F(() => { for (const a of [30, 60, 90, 120, 150]) { const t = a * D; seg([Math.cos(t) * 60, Math.sin(t) * 60], [Math.cos(t) * 84, Math.sin(t) * 84], 4); } }),
  money: F(() => { box(-50, -26, 100, 52, P.lgreen); oval(0, 0, 16, 18, P.lgreen, 2); text('$', 0, 0, { size: 24, color: 'green', outline: null }); }),
  number: F(a => text(a.text || '1', 0, 0, { size: a.size || 70, color: col(a.c || 'accent') })),
};
export const PROP_NAMES = Object.keys(PROPS);
