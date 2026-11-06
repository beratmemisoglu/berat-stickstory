// Stick stories props - FURNITURE (things people sit on, lie on, put things on) and room lamps. Owned by the prop agent.
// Drawn like the references' frontal-elevation rooms (iq500 kitchen, sister home office / bedroom / living room): the
// top of a table / desk / counter is a lit band seen slightly from above (the cut-out theatre's stylised "raked" top),
// the front a 0.84x face, edges 0.77x lines, far legs darker and inset. Sizes in metres for a 1.70 m standing adult.
//
// Contract (every seat / surface, in the prop's own space; place() + seatOf() / topOf() in props.js give world values):
//   userData.seat  = { x, y (seat height), z (where the sitter's root goes: in front of / behind the prop), depth, facing }
//   userData.seats = [seat, ...] (sofas, benches)       userData.lie = { x0 (head end), x1, y, z, head } (beds, sofas)
//   userData.top   = { y (where things stand: the middle of the top band), x0, x1, z, front, back }
//   userData.front = a child Group drawn in front of a sitter / lier (duvet, bed rail, chair back seen from behind)
//   userData.size  = { w, h } metres
import { B, PAL, face, edge, hi, soft, arcPts, rrPts } from './kit.js';
import { rnd } from '../core.js';

const pick = (o, k, d) => o[k] ?? d;
const SEATZ = .05;                   // a sitter sits this far in front of the furniture's own stack

// ================================================= chairs =================================================
/** a wooden kitchen / dining chair: side (default, sitter faces right; facing: -1 left), front, back */
function chair(o = {}) {
  const b = B(o), w = pick(o, 'color', PAL.chair), leg = o.legColor || (o.color ? face(o.color, .22) : PAL.chairLeg), view = o.view || 'side';
  const H = .465;
  if (view === 'side') {
    b.line(-.17, .02, -.15, H - .03, .035, edge(leg));                                  // far rear leg (a hair offset)
    b.line(-.2, 0, -.215, 1.0, .042, leg);                                              // rear leg + back post
    b.box(-.24, .87, -.19, .99, w); b.box(-.24, .87, -.19, .885, edge(w));              // top rail end
    b.box(-.235, .68, -.195, .74, face(w));                                             // middle rail end
    b.line(.18, 0, .18, H - .03, .04, leg);                                             // front leg
    b.line(-.2, .17, .18, .17, .022, face(leg));                                        // stretcher
    b.box(-.235, H - .05, .225, H - .01, face(w)); b.box(-.235, H - .05, .225, H - .042, edge(w));   // seat edge
    b.box(-.235, H - .01, .225, H + .006, hi(w, .08));                                  // seat top (seen just above)
    return b.done({ size: { w: .48, h: 1.0 }, seat: { x: 0, y: H, z: b.depth() + SEATZ, depth: .44 }, kind2: 'chair', view });
  }
  // front / back: the same drawing; seen from the back the sitter goes behind it
  b.line(-.15, .03, -.15, H - .04, .036, edge(leg)); b.line(.15, .03, .15, H - .04, .036, edge(leg));   // rear legs
  b.line(-.19, H, -.2, .97, .04, leg); b.line(.19, H, .2, .97, .04, leg);                // back posts
  b.box(-.19, .66, .19, .71, face(w));                                                  // middle rail
  b.box(-.22, .85, .22, .97, w); b.box(-.22, .85, .22, .865, edge(w));                  // top rail
  b.poly([[-.235, H - .01], [.235, H - .01], [.2, H + .035], [-.2, H + .035]], hi(w, .06));   // seat top band
  b.box(-.235, H - .05, .235, H - .01, face(w)); b.box(-.235, H - .05, .235, H - .043, edge(w));
  b.line(-.205, 0, -.205, H - .05, .042, leg); b.line(.205, 0, .205, H - .05, .042, leg); // front legs
  return b.done({ size: { w: .48, h: .97 }, seat: { x: 0, y: H + .02, z: view === 'back' ? -SEATZ : b.depth() + SEATZ, depth: .42 }, view });
}
/** an office swivel chair (sister home office): side, back (the backrest in front of the sitter), front */
function officeChair(o = {}) {
  const b = B(o), c = pick(o, 'color', PAL.office), dk = face(c, .3), view = o.view || 'side', H = .5;
  const base = () => {
    b.dots([[-.29, .03, .03], [.29, .03, .03], [0, .03, .03]], '#1a1b1e');
    b.poly([[-.31, .05], [.31, .05], [.31, .075], [.05, .105], [-.05, .105], [-.31, .075]], '#2b2c30');
    b.box(-.026, .1, .026, .38, '#3a3b40'); b.box(-.026, .1, -.012, .38, hi('#3a3b40', .15));
    b.box(-.09, .36, .09, .41, '#2b2c30');
  };
  if (view === 'side') {
    base();
    b.path([[-.18, .42], [-.27, .46], [-.3, .58]], .035, '#2b2c30');
    b.box(-.33, .56, -.23, 1.08, c, { r: .045, rot: 6 * Math.PI / 180 });
    b.box(-.31, .6, -.27, 1.03, face(c), { r: .02, rot: 6 * Math.PI / 180 });
    b.box(-.26, .41, .26, H, c, { r: .04 }); b.box(-.26, .41, .26, .43, dk, { r: .01 }); b.box(-.22, H - .012, .22, H, hi(c, .12));
    b.line(.06, H, .06, .64, .03, '#2b2c30'); b.box(-.08, .63, .16, .665, '#2b2c30', { r: .015 });
    return b.done({ size: { w: .64, h: 1.08 }, seat: { x: .02, y: H, z: b.depth() + SEATZ, depth: .46 }, view });
  }
  if (view === 'back') {
    base(); b.box(-.25, .41, .25, H, face(c), { r: .04 });
    b.line(0, .45, 0, .6, .05, '#2b2c30');
    b.box(-.27, .54, .27, 1.06, c, { r: .08 }); b.box(-.27, .54, .27, .58, face(c), { r: [0, 0, .08, .08] });
    b.box(-.21, 1.02, .21, 1.04, hi(c, .1), { r: .01 });
    return b.done({ size: { w: .64, h: 1.06 }, seat: { x: 0, y: H, z: -SEATZ, depth: .46 }, view });
  }
  b.box(-.27, .52, .27, 1.06, face(c), { r: .08 });                                     // front: backrest behind
  base(); b.box(-.27, .41, .27, H, c, { r: .045 }); b.box(-.27, .41, .27, .43, dk, { r: .01 });
  b.box(-.33, .5, -.29, .66, '#2b2c30'); b.box(.29, .5, .33, .66, '#2b2c30');
  return b.done({ size: { w: .66, h: 1.06 }, seat: { x: 0, y: H, z: b.depth() + SEATZ, depth: .46 }, view });
}
/** a school chair: plywood seat and back on a dark tube frame (side default; front) */
function schoolChair(o = {}) {
  const b = B(o), ply = pick(o, 'color', PAL.plywood), tube = o.frame || '#33363c', view = o.view || 'side', H = .44;
  if (view === 'side') {
    b.path([[.17, 0], [.17, H - .02], [-.19, H - .02], [-.2, 0]], .028, tube);
    b.path([[-.19, H - .02], [-.23, .82]], .028, tube);
    b.box(-.21, H - .02, .21, H + .02, ply, { r: .015 }); b.box(-.21, H - .02, .21, H - .005, face(ply));
    b.box(-.27, .6, -.21, .84, ply, { r: .02, rot: 8 * Math.PI / 180 });
    return b.done({ size: { w: .45, h: .84 }, seat: { x: 0, y: H + .02, z: b.depth() + SEATZ, depth: .4 }, view });
  }
  b.line(-.16, .02, -.16, H, .026, edge(tube)); b.line(.16, .02, .16, H, .026, edge(tube));
  b.line(-.18, H, -.18, .82, .026, tube); b.line(.18, H, .18, .82, .026, tube);
  b.box(-.21, .62, .21, .82, ply, { r: .03 }); b.box(-.21, .62, .21, .64, face(ply), { r: .01 });
  b.poly([[-.22, H], [.22, H], [.19, H + .035], [-.19, H + .035]], hi(ply, .05)); b.box(-.22, H - .03, .22, H, face(ply));
  b.line(-.2, 0, -.2, H - .03, .028, tube); b.line(.2, 0, .2, H - .03, .028, tube);
  return b.done({ size: { w: .45, h: .82 }, seat: { x: 0, y: H + .02, z: o.view === 'back' ? -SEATZ : b.depth() + SEATZ, depth: .4 }, view });
}
/** a stool: kitchen (wood, .62), bar (padded top on chrome, .76), low (.45), lab (round metal) */
function stool(o = {}) {
  const v = o.variant || 'kitchen', b = B(o);
  const H = o.h ?? { kitchen: .62, bar: .76, low: .45, lab: .62 }[v] ?? .62;
  const metal = v === 'bar' || v === 'lab', legC = o.legColor || (metal ? '#9aa0a6' : PAL.chairLeg), topC = pick(o, 'color', v === 'bar' ? '#7a3b33' : v === 'lab' ? '#3b3e44' : PAL.chair);
  b.line(-.05, H - .05, -.08, .03, .026, edge(legC)); b.line(.05, H - .05, .08, .03, .026, edge(legC));
  b.line(-.12, H - .05, -.2, 0, .032, legC); b.line(.12, H - .05, .2, 0, .032, legC);
  b.box(-.17, H * .32, .17, H * .32 + .022, metal ? hi(legC, .1) : face(legC));
  if (v === 'bar') { b.box(-.2, H - .075, .2, H - .01, topC, { r: .035 }); b.ell(0, H - .01, .2, .035, hi(topC, .12)); }
  else { b.box(-.19, H - .05, .19, H - .005, face(topC)); b.ell(0, H - .005, .19, .03, topC); }
  // the seat: no back, so it faces nowhere (facing 0: the sitter's own facing wins) and it has a foot rung (the stretcher at
  // .32 H): a sitter whose feet can't reach the floor flat puts them on it (lib/anim.js _seatFoot; lessons 02-handshake)
  return b.done({ size: { w: .42, h: H }, seat: { x: 0, y: H, z: b.depth() + SEATZ, depth: .3, facing: 0, stool: true, rung: H * .32 + .011 }, top: { y: H, x0: -.15, x1: .15, z: b.depth(), front: H - .02, back: H + .02 }, variant: v });
}
/** a bench: park (wood slats, iron ends, backrest), locker (one plank, no back), bus (metal slats), stadium (no back) */
function bench(o = {}) {
  const v = o.variant || 'park', b = B(o), L = o.w ?? (v === 'locker' ? 1.8 : 1.6), H = v === 'locker' ? .42 : .44;
  const slat = pick(o, 'color', v === 'bus' ? '#8d949b' : v === 'locker' ? '#b38a5c' : v === 'stadium' ? '#5a7fa8' : '#8a6a48');
  const iron = o.frame || (v === 'bus' ? '#5e646b' : PAL.iron);
  const back = o.back ?? (v === 'park' || v === 'bus');
  const ends = [-L / 2 + .12, L / 2 - .12];
  if (v === 'locker' || v === 'stadium') {
    for (const x of [ends[0], 0, ends[1]]) { b.line(x * .96 - .02, .03, x * .96 - .02, H - .05, .035, edge(iron)); }
    for (const x of ends) b.line(x, 0, x, H - .05, .045, iron);
    b.poly([[-L / 2, H - .005], [L / 2, H - .005], [L / 2 - .05, H + .05], [-L / 2 + .05, H + .05]], slat);
    b.box(-L / 2, H - .055, L / 2, H - .005, face(slat)); b.box(-L / 2, H - .055, L / 2, H - .047, edge(slat));
  } else {
    for (const x of ends) { b.line(x, .02, x, H + (back ? .45 : 0), .04, edge(iron)); }                    // rear legs / back supports
    if (back) for (const y of [.62, .74, .86]) { b.box(-L / 2 + .03, y, L / 2 - .03, y + .07, face(slat)); b.box(-L / 2 + .03, y + .062, L / 2 - .03, y + .07, hi(slat, .1)); }
    b.poly([[-L / 2, H - .005], [L / 2, H - .005], [L / 2 - .05, H + .06], [-L / 2 + .05, H + .06]], slat);
    b.lines([[-L / 2 + .03, H + .02, L / 2 - .03, H + .02], [-L / 2 + .04, H + .042, L / 2 - .04, H + .042]], .006, edge(slat));
    b.box(-L / 2, H - .05, L / 2, H - .005, face(slat)); b.box(-L / 2, H - .05, L / 2, H - .042, edge(slat));
    for (const x of ends) {
      b.path([[x - .02, 0], [x, H - .05], [x + .01, H + .14]], .045, iron);            // front leg up to the armrest
      if (v === 'park') b.box(x - .08, H + .13, x + .08, H + .165, iron, { r: .015 });
    }
  }
  const n = Math.max(1, Math.floor(L / .55)), seats = [];
  for (let i = 0; i < n; i++) seats.push({ x: -L / 2 + L * (i + .5) / n, y: H + .03, z: b.depth() + SEATZ, depth: .4 });
  return b.done({ size: { w: L, h: back ? H + .5 : H }, seats, seat: seats[Math.floor((n - 1) / 2)], top: { y: H + .03, x0: -L / 2 + .05, x1: L / 2 - .05, z: b.depth(), front: H, back: H + .06 }, lie: { x0: -L / 2 + .1, x1: L / 2 - .1, y: H + .03, z: b.depth() + SEATZ, head: 'left' }, variant: v });
}
/** a sofa (sister living room #433c3e; timeloop red): frontal; seats 2 | 3; o.cushions colour of the throw cushions */
function sofa(o = {}) {
  const b = B(o), c = pick(o, 'color', PAL.sofa), n = o.seats ?? 3, W = o.w ?? (n === 1 ? .95 : n === 2 ? 1.65 : 2.15), arm = n === 1 ? .2 : .19;
  const H = .44, inner = W - arm * 2;
  b.box(-W / 2 + .06, .4, W / 2 - .06, .9, face(c, .2), { r: [.07, .07, 0, 0] });                      // back frame
  for (let i = 0; i < n; i++) { const x0 = -inner / 2 + inner * i / n + .015, x1 = -inner / 2 + inner * (i + 1) / n - .015;   // back cushions
    b.box(x0, .46, x1, .87, soft(c), { r: .08 }); b.box(x0 + .012, .472, x1 - .012, .858, c, { r: .07 }); }
  if (o.pillows !== false && n > 1) { const pc = o.cushions || PAL.cushion;                                    // throw cushions
    b.box(-inner / 2 + .04, .44, -inner / 2 + .3, .66, soft(pc), { r: .06, rot: .12 }); b.box(-inner / 2 + .052, .452, -inner / 2 + .288, .648, pc, { r: .05, rot: .12 });
    b.box(inner / 2 - .3, .44, inner / 2 - .04, .66, soft(pc), { r: .06, rot: -.12 }); b.box(inner / 2 - .288, .452, inner / 2 - .052, .648, pc, { r: .05, rot: -.12 }); }
  b.box(-W / 2 + .03, .07, W / 2 - .03, .34, face(c, .2));                                              // base
  for (let i = 0; i < n; i++) { const x0 = -inner / 2 + inner * i / n + .008, x1 = -inner / 2 + inner * (i + 1) / n - .008;   // seat cushions
    b.box(x0, .3, x1, H, soft(c), { r: .045 }); b.box(x0 + .01, .31, x1 - .01, H - .01, c, { r: .04 }); b.box(x0 + .03, H - .03, x1 - .03, H - .018, hi(c, .1), { r: .01 }); }
  for (const s of [-1, 1]) { const x0 = s < 0 ? -W / 2 : W / 2 - arm, x1 = x0 + arm;                  // arms
    b.box(x0, .07, x1, .66, soft(c), { r: .07 }); b.box(x0 + .012, .082, x1 - .012, .648, c, { r: .06 }); b.box(x0 + .03, .6, x1 - .03, .625, hi(c, .1), { r: .01 }); }
  b.box(-W / 2 + .08, 0, -W / 2 + .14, .07, '#1e1a1a'); b.box(W / 2 - .14, 0, W / 2 - .08, .07, '#1e1a1a');
  const seats = []; for (let i = 0; i < n; i++) seats.push({ x: -inner / 2 + inner * (i + .5) / n, y: H, z: b.depth() + SEATZ, depth: .5 });
  return b.done({ size: { w: W, h: .9 }, seats, seat: seats[Math.floor((n - 1) / 2)], lie: { x0: -inner / 2 + .1, x1: inner / 2 - .05, y: H, z: b.depth() + SEATZ, head: 'left' } });
}
const armchair = (o = {}) => { const g = sofa({ ...o, seats: 1, w: o.w ?? .98, pillows: false }); g.userData.lie = null; return g; };

// ================================================= beds =================================================
/**
 * a bed seen along its long side, headboard at the left (facing: -1 puts it right). variant single | double | hospital.
 * duvet: 'flat' (default) | 'body' (bumped over someone lying) | 'folded' | false. The duvet / hospital rail is
 * userData.front (in front of a lier at lie.z); hide it with bed.userData.front.visible = false.
 */
function bed(o = {}) {
  const v = o.variant || 'double', b = B(o), L = o.w ?? 2.1;
  if (v === 'hospital') return hospitalBed(o, b, L);
  const wood = pick(o, 'color', '#6b4d36'), mat_ = o.mattress || PAL.mattress, mside = face(mat_, .1), pil = o.pillow || PAL.pillow, duv = o.duvet === false ? null : (o.duvetColor || PAL.duvet);
  // sister bedroom: a thick light mattress (top band + front face) on a dark wooden base with corner legs, a pile of big
  // oval pillows at the head end, the duvet over the body half with a scalloped lace hem hanging over the mattress front
  const T = .6, mt = .28, band = .12;   // mattress top, thickness, visible top band
  const hb = o.headboard ?? 'low';
  if (hb) { const hh = hb === 'tall' ? 1.05 : .78; b.box(-L / 2 - .06, .02, -L / 2 + .04, hh, wood, { r: [.03, .03, 0, 0] }); b.box(-L / 2 - .06, hh - .04, -L / 2 + .04, hh, hi(wood, .1), { r: [.03, .03, 0, 0] }); }
  b.box(-L / 2 + .03, 0, -L / 2 + .1, .1, face(wood, .3)); b.box(L / 2 - .1, 0, L / 2 - .03, .1, face(wood, .3));                                  // legs
  b.box(-L / 2 + .02, .08, L / 2 - .02, T - mt + .01, face(wood, .1)); b.box(-L / 2 + .02, T - mt, L / 2 - .02, T - mt + .012, edge(wood));      // base
  b.poly([[-L / 2 + .02, T], [L / 2, T], [L / 2 - .06, T + band], [-L / 2 + .08, T + band]], mat_);                                              // mattress top
  b.box(-L / 2 + .02, T - mt, L / 2, T, mside, { r: [0, .03, 0, 0] }); b.box(-L / 2 + .02, T - .012, L / 2, T, hi(mat_, .06));
  const pile = o.pillows ?? (v === 'double' ? 3 : 1);
  const PIL = [[.32, .07, .26, .1, 0], [.3, .17, .24, .12, .35], [.26, .28, .22, .13, .62]];
  for (let i = 0; i < pile; i++) { const [cx, cy, rx, ry, rot] = PIL[i % 3]; const x = -L / 2 + .06 + cx, y = T + band * .5 + cy;
    if (!i) b.shadow(x + .05, y - ry * .8, rx * 1.1, .04, { opacity: .25 });
    b.ell(x, y, rx, ry, soft(pil), { rot: -rot }); b.ell(x, y, rx - .014, ry - .014, pil, { rot: -rot }); }
  const lieZ = b.depth() + SEATZ;
  let front = null;
  if (duv) {
    const f = b.sub('duvet', lieZ + .05);
    const x0 = o.duvet === 'folded' ? L / 2 - .75 : -L / 2 + L * .4, x1 = L / 2 + .02, top = o.duvet === 'body' ? T + band + .14 : T + band * .6, bot = T - mt * .55;
    const pts = [[x0, bot], ...arcPts(x0 + .07, top - .07, .07, .07, Math.PI, Math.PI / 2, 5).slice(0), [x1 - .06, top], ...arcPts(x1 - .06, top - .06, .06, .06, Math.PI / 2, 0, 4), [x1, bot]];
    f.poly(pts, duv); f.poly([[x0 + .07, top - .02], [x1 - .08, top - .02], [x1 - .08, top - .005], [x0 + .07, top - .005]], hi(duv, .08));
    f.lines([[x0 + .35, top - .03, x0 + .38, bot + .1], [x0 + .8, top - .03, x0 + .82, bot + .1]], .006, face(duv, .1));                       // soft folds
    // the lace hem: a scalloped light band along the bottom
    const sc = [], r = .03; sc.push([x0, bot + .055], [x1, bot + .055]); for (let x = x1 - r; x > x0 + r / 2; x -= 2 * r) sc.push(...arcPts(x, bot, r, r * .8, 0, -Math.PI, 5));
    f.poly(sc, o.lace || PAL.lace);
    front = f.g;
  }
  return b.done({ size: { w: L + .1, h: hb === 'tall' ? 1.05 : Math.max(.78, T + band + .4) }, lie: { x0: -L / 2 + .32, x1: L / 2 - .05, y: T + band * .5, z: lieZ, head: 'left' },
    seat: { x: .25, y: T, z: (front ? lieZ + .12 : lieZ), depth: .3 }, top: { y: T + band * .5, x0: -L / 2 + .1, x1: L / 2 - .1, z: front ? lieZ + .1 : lieZ, front: T, back: T + band }, front, variant: v });
}
function hospitalBed(o, b, L) {
  const frame = '#aeb5bc', sheet = '#e8ecef', blanket = o.duvetColor || '#a9c3d6', T = .62;
  b.box(-L / 2 - .02, .3, -L / 2 + .05, 1.0, '#d8dde2', { r: .03 }); b.box(-L / 2 + .005, .52, -L / 2 + .025, .95, face('#d8dde2'));     // head panel
  b.box(L / 2 - .05, .3, L / 2 + .02, .82, '#d8dde2', { r: .03 });
  for (const x of [-L / 2 + .12, L / 2 - .12]) { b.line(x, .07, x, .3, .035, face(frame)); b.circ(x, .055, .055, '#2a2c30'); b.circ(x, .055, .02, '#8a9097'); }
  b.box(-L / 2 + .04, .26, L / 2 - .04, .33, frame); b.box(-L / 2 + .04, .26, L / 2 - .04, .275, edge(frame));
  b.box(-L / 2 + .06, .33, L / 2 - .06, T - .08, face(frame, .08));
  // the raised head section
  b.poly([[-L / 2 + .06, T - .08], [-L / 2 + .7, T - .08], [-L / 2 + .7, T], [-L / 2 + .14, T + .32], [-L / 2 + .06, T + .3]], face(sheet, .06));
  b.poly([[-L / 2 + .7, T - .08], [L / 2 - .06, T - .08], [L / 2 - .06, T], [-L / 2 + .7, T]], sheet);
  b.box(-L / 2 + .14, T + .18, -L / 2 + .5, T + .36, soft('#f1f3f5'), { r: .08, rot: -.45 }); b.box(-L / 2 + .152, T + .192, -L / 2 + .488, T + .348, '#f1f3f5', { r: .07, rot: -.45 });
  const lieZ = b.depth() + SEATZ;
  const f = b.sub('rail', lieZ + .05);
  if (o.duvet !== false) { f.poly([[-L / 2 + .55, T - .1], [L / 2 - .05, T - .1], [L / 2 - .05, T + .08], [-L / 2 + .62, T + .1]], blanket); f.box(-L / 2 + .58, T + .06, L / 2 - .05, T + .1, hi(blanket, .25)); }
  f.box(-L / 2 + .25, T + .14, L / 2 - .35, T + .17, '#c4cad0', { r: .015 }); f.box(-L / 2 + .25, T + .02, L / 2 - .35, T + .045, '#c4cad0', { r: .01 });
  for (const x of [-L / 2 + .3, -L / 2 + .75, L / 2 - .4]) f.line(x, T - .05, x, T + .16, .02, '#b3b9bf');
  return b.done({ size: { w: L + .05, h: 1.0 }, lie: { x0: -L / 2 + .25, x1: L / 2 - .1, y: T, z: lieZ, head: 'left', raised: .45 }, seat: { x: .3, y: T, z: lieZ + .12, depth: .3 }, front: f.g, variant: 'hospital' });
}

// ================================================= tables =================================================
/** the top band + edge of a table / desk (lit top seen slightly from above) */
function topBand(b, x0, x1, y, band, inset, c, edgeH = .035, edgeC = null) {
  b.box(x0, y - edgeH, x1, y, edgeC || face(c, .2));
  b.poly([[x0, y], [x1, y], [x1 - inset, y + band], [x0 + inset, y + band]], c);
  b.box(x0 + inset * .3, y + .002, x1 - inset * .3, y + .008, hi(c, .1));
}
/** a cloth over a table: check pattern, front drape with a scalloped hem (iq500 kitchen) */
function clothOn(b, x0, x1, H, band, inset, c, lineC, drop = .26, check = true) {
  const top = [[x0 - .03, H - .005], [x1 + .03, H - .005], [x1 - inset + .01, H + band + .006], [x0 + inset - .01, H + band + .006]];
  b.poly(top, c);
  const bot = H - drop, r = .036, front = [[x1 + .03, H], [x0 - .03, H], [x0 - .03, bot]];
  const nS = Math.max(3, Math.round((x1 - x0 + .06) / (2 * r))), rr = (x1 - x0 + .06) / nS / 2;
  for (let i = 0; i < nS; i++) front.push(...arcPts(x0 - .03 + rr * (2 * i + 1), bot, rr, rr * .85, Math.PI, Math.PI * 2, 6).slice(1));
  front.push([x1 + .03, bot]);
  b.poly(front, face(c, .06));
  if (check) {
    const segs = [], n = Math.max(2, Math.round((x1 - x0) / .15));
    for (let i = 1; i < n; i++) { const t = i / n, xb = x0 - .03 + (x1 - x0 + .06) * t, xt = x0 + inset + (x1 - x0 - 2 * inset) * t; segs.push([xb, H, xt, H + band], [xb, H - .004, xb, bot + .01]); }
    for (const k of [.22, .48, .76]) { const yy = H + band * k; segs.push([x0 - .03 + inset * k, yy, x1 + .03 - inset * k, yy]); }
    segs.push([x0 - .03, H - .045, x1 + .03, H - .045]);
    b.lines(segs, .007, lineC);
  }
}
/** a table: kitchen (cloth: 'check' default), dining (longer, darker), coffee (low), cafe (round, one column), side */
function table(o = {}) {
  const v = o.variant || 'kitchen', b = B(o);
  if (v === 'cafe') {
    const c = pick(o, 'color', '#4b4e55'), H = o.h ?? .74, R = (o.w ?? .7) / 2;
    b.ell(0, .02, .2, .035, face(c, .2)); b.box(-.03, .02, .03, H - .03, face(c, .1));
    b.box(-R, H - .035, R, H, face(c, .2)); b.ell(0, H, R, .05, c, { segs: 40 }); b.ell(0, H + .005, R * .92, .038, hi(c, .06), { segs: 40 });
    return b.done({ size: { w: R * 2, h: H + .05 }, top: { y: H + .01, x0: -R + .05, x1: R - .05, z: b.depth(), front: H - .03, back: H + .045 }, variant: v });
  }
  const W = o.w ?? { kitchen: 1.4, dining: 1.9, coffee: 1.05, side: .5, desk: 1.2 }[v] ?? 1.4, H = o.h ?? { coffee: .42, side: .55 }[v] ?? .74;
  const wood = pick(o, 'color', v === 'dining' ? PAL.walnut : v === 'coffee' ? '#6e5240' : PAL.chair), leg = o.legColor || face(wood, .2);
  const band = o.band ?? (v === 'coffee' ? .12 : v === 'side' ? .11 : .18), inset = band * .55, cloth = o.cloth ?? (v === 'kitchen' ? 'check' : false);
  const lw = v === 'coffee' ? .05 : .05;
  b.line(-W / 2 + .14, .03, -W / 2 + .14, H - .05, lw * .85, edge(leg)); b.line(W / 2 - .14, .03, W / 2 - .14, H - .05, lw * .85, edge(leg));   // far legs
  if (v === 'coffee' && o.shelf !== false) b.box(-W / 2 + .08, .1, W / 2 - .08, .13, face(wood, .25));
  if (!cloth) { b.box(-W / 2 + .04, H - .1, W / 2 - .04, H - .035, face(wood, .12)); b.box(-W / 2 + .04, H - .1, W / 2 - .04, H - .093, edge(wood)); }   // apron
  b.line(-W / 2 + .065, 0, -W / 2 + .065, H - .035, lw, leg); b.line(W / 2 - .065, 0, W / 2 - .065, H - .035, lw, leg);                   // near legs
  if (cloth) clothOn(b, -W / 2, W / 2, H, band, inset, o.clothColor || PAL.cloth, o.clothLine || PAL.clothLine, Math.min(.3, H * .4), cloth !== 'plain');
  else topBand(b, -W / 2, W / 2, H, band, inset, wood, .035, edge(wood));
  return b.done({ size: { w: W, h: H + band }, top: { y: H + band * .45, x0: -W / 2 + inset + .03, x1: W / 2 - inset - .03, z: b.depth(), front: H, back: H + band }, variant: v, behind: -.25 });
}
/** a desk: office (steel legs + hanging drawer, sister), home (wooden drawer pedestal), school (small, tube frame), reception */
function desk(o = {}) {
  const v = o.variant || 'office', b = B(o);
  if (v === 'school') {
    const W = o.w ?? .72, H = o.h ?? .72, top = pick(o, 'color', PAL.birch), tube = o.frame || '#33363c';
    b.line(-W / 2 + .1, .03, -W / 2 + .1, H - .03, .026, edge(tube)); b.line(W / 2 - .1, .03, W / 2 - .1, H - .03, .026, edge(tube));
    b.box(-W / 2 + .05, H - .17, W / 2 - .05, H - .04, '#3d4148'); b.box(-W / 2 + .05, H - .17, W / 2 - .05, H - .16, hi('#3d4148', .12));   // book tray
    b.line(-W / 2 + .05, 0, -W / 2 + .05, H - .03, .03, tube); b.line(W / 2 - .05, 0, W / 2 - .05, H - .03, .03, tube);
    topBand(b, -W / 2, W / 2, H, .13, .06, top, .028, edge(top));
    return b.done({ size: { w: W, h: H + .13 }, top: { y: H + .06, x0: -W / 2 + .08, x1: W / 2 - .08, z: b.depth(), front: H, back: H + .13 }, variant: v, behind: -.25 });
  }
  const W = o.w ?? (v === 'home' ? 1.35 : v === 'reception' ? 2.0 : 1.6), H = o.h ?? .76, wood = pick(o, 'color', PAL.oak);
  if (v === 'reception') {
    const front = o.front || '#5d6670';
    b.box(-W / 2, 0, W / 2, 1.05, front); b.box(-W / 2, 0, W / 2, .06, face(front, .3));
    b.rects([[-W / 2 + .1, .2, -W / 2 + .14, .95], [W / 2 - .14, .2, W / 2 - .1, .95]], face(front));
    topBand(b, -W / 2 - .03, W / 2 + .03, 1.05, .16, .06, wood, .045, edge(wood));
    return b.done({ size: { w: W, h: 1.21 }, top: { y: 1.12, x0: -W / 2 + .1, x1: W / 2 - .1, z: b.depth(), front: 1.05, back: 1.21 }, variant: v, behind: -.25 });
  }
  if (v === 'office') {
    const steel = o.legColor || PAL.steel;
    b.line(-W / 2 + .16, .04, -W / 2 + .16, H - .04, .03, edge(steel)); b.line(W / 2 - .16, .04, W / 2 - .16, H - .04, .03, edge(steel));
    b.line(-W / 2 + .07, 0, -W / 2 + .07, H - .04, .035, steel); b.line(W / 2 - .07, 0, W / 2 - .07, H - .04, .035, steel);
    if (o.drawer !== false) { const d0 = W / 2 - .6, d1 = W / 2 - .14;
      b.box(d0, H - .2, d1, H - .04, PAL.drawer); b.box(d0, H - .2, d1, H - .19, edge(PAL.drawer)); b.box((d0 + d1) / 2 - .05, H - .125, (d0 + d1) / 2 + .05, H - .11, '#d9d4cc'); }
  } else {   // home: a drawer pedestal on the right, a side panel on the left
    b.box(-W / 2 + .03, 0, -W / 2 + .08, H - .04, face(wood, .2));
    const p0 = W / 2 - .48, p1 = W / 2 - .03; b.box(p0, .02, p1, H - .04, face(wood, .1));
    const dh = (H - .08) / 3; for (let i = 0; i < 3; i++) { const y0 = .03 + i * dh; b.box(p0 + .025, y0 + .012, p1 - .025, y0 + dh - .012, face(wood, .04)); b.box((p0 + p1) / 2 - .045, y0 + dh * .62, (p0 + p1) / 2 + .045, y0 + dh * .62 + .014, hi(wood, .35)); }
    b.box(-W / 2 + .1, H - .16, p0 - .02, H - .04, face(wood, .08)); b.box((-W / 2 + p0) / 2 - .05, H - .108, (-W / 2 + p0) / 2 + .05, H - .094, hi(wood, .35));
  }
  topBand(b, -W / 2, W / 2, H, .16, .06, wood, .04, o.color ? edge(wood) : PAL.oakDark);
  return b.done({ size: { w: W, h: H + .16 }, top: { y: H + .07, x0: -W / 2 + .08, x1: W / 2 - .08, z: b.depth(), front: H, back: H + .16 }, variant: v, behind: -.25 });
}
/** a counter: kitchen (green cabinets, light top; sink / oven / hob options), bar (wood panels, brass rail), lab, shop */
function counter(o = {}) {
  const v = o.variant || 'kitchen', b = B(o), W = o.w ?? 2.0;
  const H = o.h ?? (v === 'bar' ? 1.05 : .9);
  const front = pick(o, 'color', { kitchen: PAL.cabinet, bar: '#6a4a33', lab: '#b1b3b3', shop: '#7d6a58' }[v] || PAL.cabinet);
  const top = o.top || { kitchen: PAL.counter, bar: '#3e2b20', lab: '#c2c0bc', shop: '#d8d0c2' }[v] || PAL.counter;
  b.box(-W / 2 + .03, 0, W / 2 - .03, .08, face(front, .35));                                          // plinth
  if (v === 'lab') b.grad(-W / 2, .08, W / 2, H - .05, [[0, face(front, .22)], [1, front]]); else b.box(-W / 2, .08, W / 2, H - .05, front);
  const n = Math.max(1, Math.round(W / (v === 'bar' ? .35 : .5))), dw = W / n, segs = [];
  const oven = o.oven === true ? Math.floor(n / 2) : typeof o.oven === 'number' ? o.oven : -1, sink = o.sink === true ? Math.max(0, Math.floor(n / 2) - 1) : typeof o.sink === 'number' ? o.sink : -1;
  for (let i = 1; i < n; i++) segs.push([-W / 2 + i * dw, .08, -W / 2 + i * dw, H - .05]);
  if (v === 'kitchen' || v === 'lab') segs.push([-W / 2, H - .21, W / 2, H - .21]);
  b.lines(segs, v === 'bar' ? .012 : .008, v === 'kitchen' ? PAL.cabLine : edge(front));
  if (v === 'kitchen' || v === 'lab' || v === 'shop') {
    const hs = []; for (let i = 0; i < n; i++) { if (i === oven) continue; const cx = -W / 2 + (i + .5) * dw; hs.push([cx - .04, H - .145, cx + .04, H - .133]); hs.push([i % 2 ? -W / 2 + i * dw + .05 : -W / 2 + (i + 1) * dw - .07, H - .4, i % 2 ? -W / 2 + i * dw + .062 : -W / 2 + (i + 1) * dw - .058, H - .3]); }
    b.rects(hs, v === 'kitchen' ? '#c9cfc6' : hi(front, .35));
  }
  if (oven >= 0) { const x0 = -W / 2 + oven * dw + .03, x1 = x0 + dw - .06; b.box(x0, .12, x1, H - .25, PAL.oven, { r: .01 }); b.box(x0 + .04, .16, x1 - .04, H - .36, '#2f3340'); b.box(x0 + .05, H - .3, x1 - .05, H - .28, PAL.chrome, { r: .008 }); }
  if (v === 'bar') { b.box(-W / 2 + .02, .2, W / 2 - .02, .225, '#b49a5c', { r: .01 }); b.box(-W / 2 + .02, .2, W / 2 - .02, .205, face('#b49a5c', .2)); }
  if (v === 'lab') b.box(-W / 2 - .02, H - .07, W / 2 + .02, H - .05, '#3c3b3e');
  const TB = o.band ?? .18;
  topBand(b, -W / 2 - .02, W / 2 + .02, H, TB, .06, top, .05, face(top, .1));
  if (sink >= 0) { const cx = -W / 2 + (sink + 1) * dw, cy = H + TB * .5; b.ell(cx, cy, .3, .07, face(PAL.sink, -.06)); b.ell(cx, cy - .003, .27, .058, PAL.sink); b.ell(cx, cy - .02, .045, .01, face(PAL.sink, .3));
    b.path([[cx, cy + .06], [cx, cy + .3], [cx + .08, cy + .32], [cx + .12, cy + .26]], .025, PAL.chrome); b.box(cx - .035, cy + .05, cx + .035, cy + .075, face(PAL.chrome, .1)); }
  if (o.hob) { const cx = -W / 2 + ((typeof o.hob === 'number' ? o.hob : n - 1) + .5) * dw, cy = H + TB * .5; b.ell(cx - .11, cy, .085, .03, '#2c2e33'); b.ell(cx + .11, cy, .085, .03, '#2c2e33'); }
  return b.done({ size: { w: W + .04, h: H + TB }, top: { y: H + TB * .45, x0: -W / 2 + .05, x1: W / 2 - .05, z: b.depth(), front: H, back: H + TB }, variant: v, behind: -.25,
    points: sink >= 0 ? { sink: [-W / 2 + (sink + 1) * dw, H + TB * .5] } : {} });
}
/** a nightstand with a drawer (sister bedroom #876846) */
function nightstand(o = {}) {
  const b = B(o), c = pick(o, 'color', PAL.night), W = o.w ?? .48, H = o.h ?? .56;
  b.box(-W / 2 + .03, 0, -W / 2 + .07, .06, face(c, .3)); b.box(W / 2 - .07, 0, W / 2 - .03, .06, face(c, .3));
  b.box(-W / 2, .06, W / 2, H - .03, face(c, .1));
  b.box(-W / 2 + .03, H - .2, W / 2 - .03, H - .06, c); b.circ(0, H - .13, .016, hi(c, .4));
  b.box(-W / 2 + .03, .1, W / 2 - .03, H - .23, face(c, .05));
  topBand(b, -W / 2 - .01, W / 2 + .01, H, .1, .035, c, .03, edge(c));
  return b.done({ size: { w: W, h: H + .1 }, top: { y: H + .045, x0: -W / 2 + .05, x1: W / 2 - .05, z: b.depth(), front: H, back: H + .1 } });
}
/** shelving: metal (home office, open, boxes), book (wooden bookcase, spines), wall (one floating shelf) - items: boxes | books | binders | mixed | none */
function shelf(o = {}) {
  const v = o.variant || 'metal', b = B(o), R = rnd(o.seed ?? 7);
  const W = o.w ?? (v === 'wall' ? 1.0 : v === 'book' ? .95 : 1.05), H = o.h ?? (v === 'wall' ? .04 : 1.65);
  const frame = pick(o, 'color', v === 'book' ? '#5f4532' : PAL.drawer);
  const items = o.items ?? (v === 'book' ? 'books' : v === 'wall' ? 'mixed' : 'boxes');
  let levels;
  if (v === 'wall') {
    levels = [0]; b.box(-W / 2, -.03, W / 2, 0, face(frame, .1)); b.poly([[-W / 2, 0], [W / 2, 0], [W / 2 - .02, .03], [-W / 2 + .02, .03]], frame);
    b.line(-W / 2 + .12, -.03, -W / 2 + .12, -.1, .02, PAL.steel); b.line(W / 2 - .12, -.03, W / 2 - .12, -.1, .02, PAL.steel);
  } else {
    const n = o.levels ?? 4; levels = []; for (let i = 0; i < n; i++) levels.push(.08 + (H - .14) * i / (n - 1));
    if (v === 'book') { b.box(-W / 2, 0, W / 2, H, face(frame, .35)); b.box(-W / 2, 0, -W / 2 + .035, H, frame); b.box(W / 2 - .035, 0, W / 2, H, frame); b.box(-W / 2, H - .04, W / 2, H, frame); b.box(-W / 2, 0, W / 2, .06, face(frame, .2)); }
    else { b.line(-W / 2 + .05, .03, -W / 2 + .05, H, .02, edge(frame)); b.line(W / 2 - .05, .03, W / 2 - .05, H, .02, edge(frame)); }
  }
  // the things on the shelves first (they stand on each board), then the board fronts over their bottoms
  const fill = (y, x0, x1, kind) => {
    let x = x0 + .02;
    while (x < x1 - .06) {
      const k = kind === 'mixed' ? ['books', 'books', 'boxes', 'binders', 'gap'][Math.floor(R() * 5)] : kind;
      if (k === 'none') break;
      if (k === 'gap') { x += .08 + R() * .1; continue; }
      if (k === 'boxes') { const w = .15 + R() * .07, h = .1 + R() * .05, c = PAL.boxes[Math.floor(R() * PAL.boxes.length)]; if (x + w > x1 - .02) break; b.box(x, y, x + w, y + h, c); b.box(x, y + h - .012, x + w, y + h, hi(c, .12)); x += w + .025 + R() * .04; }
      else if (k === 'binders') { const n = 3 + Math.floor(R() * 4); for (let i = 0; i < n && x + .055 < x1 - .02; i++) { const c = PAL.binders[i % PAL.binders.length]; b.box(x, y, x + .05, y + .27, c); b.box(x + .012, y + .17, x + .038, y + .2, hi(c, .5)); x += .053; } x += .03; }
      else { const n = 3 + Math.floor(R() * 6); for (let i = 0; i < n; i++) { const w = .025 + R() * .025, h = .17 + R() * .1, c = PAL.books[Math.floor(R() * PAL.books.length)]; if (x + w > x1 - .02) break;
        if (i === n - 1 && R() < .35) { b.box(x, y, x + w, y + h, c, { rot: -.25 }); x += w + .04; break; }
        b.box(x, y, x + w, y + h, c); b.box(x + w * .2, y + h * .7, x + w * .8, y + h * .78, hi(c, .45)); x += w + .003; } x += .02; }
    }
  };
  const lv = v === 'wall' ? levels : levels.slice(0, -1);
  if (items !== 'none') for (let i = 0; i < lv.length; i++) { const y = lv[i] + (v === 'wall' ? .015 : .025); const kind = Array.isArray(items) ? items[i % items.length] : items; fill(y, -W / 2 + .05, W / 2 - .05, kind); }
  if (v !== 'wall') for (const y of levels) { b.box(-W / 2 + (v === 'book' ? .035 : 0), y - .012, W / 2 - (v === 'book' ? .035 : 0), y + .016, v === 'book' ? hi(frame, .05) : frame); }
  if (v === 'metal') { b.line(-W / 2, 0, -W / 2, H, .026, frame); b.line(W / 2, 0, W / 2, H, .026, frame); }
  const tops = levels.map(y => y + (v === 'wall' ? .015 : .02));
  return b.done({ size: { w: W, h: H }, top: { y: tops[tops.length - 1], x0: -W / 2 + .05, x1: W / 2 - .05, z: b.depth(), front: tops[tops.length - 1] - .01, back: tops[tops.length - 1] + .02 }, shelves: tops, variant: v });
}
/** a wardrobe (sister home office #69523a): two doors, two long handles */
function wardrobe(o = {}) {
  const b = B(o), c = pick(o, 'color', PAL.wardrobe), W = o.w ?? .9, H = o.h ?? 1.68;
  b.box(-W / 2 + .03, 0, -W / 2 + .08, .05, face(c, .3)); b.box(W / 2 - .08, 0, W / 2 - .03, .05, face(c, .3));
  b.box(-W / 2, .05, W / 2, H, c); b.box(-W / 2, H - .04, W / 2, H, hi(c, .06)); b.box(-W / 2, .05, W / 2, .08, face(c, .2));
  b.line(0, .08, 0, H - .04, .008, edge(c));
  b.rects([[-.045, H * .5, -.028, H * .62], [.028, H * .5, .045, H * .62]], '#d6d0c6');
  return b.done({ size: { w: W, h: H }, top: { y: H, x0: -W / 2 + .05, x1: W / 2 - .05, z: b.depth(), front: H, back: H } });
}
/** a rug on the floor: oval (sister home office) or rect with a border line. Lies flat: a wide low ellipse card. */
function rug(o = {}) {
  const b = B(o), c = pick(o, 'color', PAL.rug), W = o.w ?? 2.2, D = o.d ?? .3;
  if ((o.variant || 'oval') === 'oval') { b.ell(0, D / 2, W / 2, D / 2, c, { segs: 64 }); b.ell(0, D / 2, W / 2 * .82, D / 2 * .76, hi(c, .12), { segs: 64 }); b.ell(0, D / 2, W / 2 * .82 - .012, D / 2 * .76 - .006, c, { segs: 64 }); }
  else { b.poly([[-W / 2, 0], [W / 2, 0], [W / 2 - D * .4, D], [-W / 2 + D * .4, D]], c); b.path([[-W / 2 + .08, .04], [W / 2 - .08, .04], [W / 2 - D * .4 - .04, D - .04], [-W / 2 + D * .4 + .04, D - .04]], .012, hi(c, .25), { closed: true }); }
  b.g.userData.ground = true;
  return b.done({ size: { w: W, h: D }, flat: true });
}

// ================================================= lamps =================================================
/** a floor lamp: base, pole, drum shade (lit by default: shade #f5e4b6 + a warm glow) */
function floorLamp(o = {}) {
  const b = B(o), on = o.lit !== false, H = o.h ?? 1.6, pole = o.poleColor || '#2f2a26', shadeC = on ? (o.shadeLit || PAL.shadeLit) : pick(o, 'color', PAL.shadeOff);
  if (on) b.glow(0, H - .15, o.glowR ?? 1.5, o.glowColor || PAL.lampGlow, { opacity: o.glow ?? .32 });
  b.ell(0, .02, .17, .03, face(pole, .1)); b.box(-.17, 0, .17, .02, pole);
  b.box(-.012, .02, .012, H - .25, pole);
  b.poly([[-.24, H - .32], [.24, H - .32], [.15, H], [-.15, H]], shadeC, { lit: on });
  b.box(-.24, H - .32, .24, H - .3, on ? hi(shadeC, .3) : face(shadeC), { lit: on });
  if (on) b.box(-.2, H - .34, .2, H - .32, PAL.bulb, { lit: true, op: .9 });
  return b.done({ size: { w: .48, h: H }, light: { x: 0, y: H - .15, color: PAL.lampGlow, on }, grips: { pole: [0, 1.0] } });
}
/** a table / bedside lamp: round base, short stem, drum shade */
function tableLamp(o = {}) {
  const b = B(o), on = o.lit !== false, vase = o.variant === 'vase', base = pick(o, 'color', vase ? '#c9b79a' : '#4a3a2e'), shadeC = on ? (o.shadeLit || PAL.shadeLit) : (o.shade || PAL.shadeOff);
  if (vase) {
    if (on) b.glow(0, .4, o.glowR ?? 1.1, o.glowColor || PAL.lampGlow, { opacity: o.glow ?? .34 });
    b.box(-.08, 0, .08, .02, face(base, .2)); b.ell(0, .1, .07, .09, base); b.box(-.012, .17, .012, .3, face(base, .3));
    b.poly([[-.16, .28], [.16, .28], [.1, .48], [-.1, .48]], shadeC, { lit: on }); b.box(-.16, .28, .16, .295, on ? hi(shadeC, .3) : face(shadeC), { lit: on });
    return b.done({ size: { w: .32, h: .48 }, light: { x: 0, y: .38, color: PAL.lampGlow, on }, grips: { base: [0, .1] } });
  }
  // the sister bedside lamp: small dark base, thin stem, small cream drum shade
  if (on) b.glow(0, .36, o.glowR ?? 1.1, o.glowColor || PAL.lampGlow, { opacity: o.glow ?? .34 });
  b.ell(0, .012, .065, .016, face(base, -.1)); b.box(-.065, 0, .065, .012, base); b.box(-.007, .01, .007, .29, base);
  b.poly([[-.1, .27], [.1, .27], [.065, .42], [-.065, .42]], shadeC, { lit: on }); b.box(-.1, .27, .1, .28, on ? hi(shadeC, .3) : face(shadeC), { lit: on });
  return b.done({ size: { w: .2, h: .42 }, light: { x: 0, y: .35, color: PAL.lampGlow, on }, grips: { base: [0, .1] } });
}
/** a desk lamp: weighted base, two-part arm, cone shade aimed down-right (facing: -1 aims left) */
function deskLamp(o = {}) {
  const b = B(o), on = o.lit !== false, c = pick(o, 'color', '#3a3d44');
  if (on) b.glow(.22, .18, o.glowR ?? .6, o.glowColor || '#ffe3b0', { opacity: o.glow ?? .28, sy: .7 });
  b.box(-.09, 0, .09, .03, c, { r: .01 }); b.box(-.09, .025, .09, .03, hi(c, .15));
  b.line(-.02, .03, -.07, .3, .02, c); b.line(-.07, .3, .14, .44, .02, c); b.circ(-.07, .3, .02, face(c, .2));
  b.poly([[.1, .47], [.18, .43], [.27, .3], [.12, .32]], c);
  b.poly([[.12, .32], [.27, .3], [.25, .285], [.14, .3]], on ? (o.shadeLit || PAL.deskShade) : face(c, .2), { lit: on });
  return b.done({ size: { w: .36, h: .47 }, light: { x: .2, y: .28, color: '#ffe3b0', on }, grips: { head: [.18, .4] } });
}
/** a pendant lamp hanging from the ceiling: ORIGIN AT THE CEILING (draws downward). o.cord (m), shade 'cone' | 'dome' | 'bulb' */
function pendant(o = {}) {
  const b = B(o), on = o.lit ?? true, cord = o.cord ?? .9, c = pick(o, 'color', PAL.pendant), kind = o.shade || 'cone';
  const y = -cord;
  if (on) { b.glow(0, y - .12, o.glowR ?? .9, o.glowColor || '#ffe6bd', { opacity: o.glow ?? .3, sy: 1 }); if (o.cone) b.grad(-.9, y - 2.2, .9, y - .1, [[0, '#ffe6bd', 0], [1, '#ffe6bd', .18]], 'v', { lit: true }); }
  b.line(0, 0, 0, y, .012, '#1b1b1d');
  if (kind === 'bulb') { b.box(-.02, y - .04, .02, y, '#2a2a2c'); b.circ(0, y - .08, .045, on ? PAL.bulb : '#d8d4c8', { lit: on }); }
  else if (kind === 'dome') { b.ell(0, y - .14, .2, .14, c, { arc: [0, Math.PI] }); b.box(-.2, y - .145, .2, y - .13, on ? '#e5cb9b' : face(c), { lit: on }); }
  else { b.box(-.03, y - .05, .03, y, face(c, .2)); b.poly([[-.06, y - .04], [.06, y - .04], [.24, y - .22], [-.24, y - .22]], c); b.poly([[-.24, y - .22], [.24, y - .22], [.2, y - .24], [-.2, y - .24]], on ? '#e5cb9b' : face(c, .25), { lit: on }); if (on) b.ell(0, y - .23, .07, .015, PAL.bulb, { lit: true }); }
  return b.done({ size: { w: .48, h: cord + .25 }, light: { x: 0, y: y - .2, color: '#ffe6bd', on }, hangs: true });
}

export const REG = {
  chair: { tags: ['furniture', 'seat', 'kitchen', 'home'], desc: 'wooden kitchen / dining chair. view side (default, sitter faces right) | front | back; color, legColor, facing', make: chair },
  officeChair: { tags: ['furniture', 'seat', 'office'], desc: 'office swivel chair (#4a4b4f). view side | back (backrest in front of the sitter) | front; color', make: officeChair },
  schoolChair: { tags: ['furniture', 'seat', 'school'], desc: 'school chair, plywood on a dark tube frame. view side | front; color, frame', make: schoolChair },
  stool: { tags: ['furniture', 'seat', 'kitchen'], desc: 'stool. variant kitchen (.62) | bar (.76 padded) | low (.45) | lab; h, color', make: stool },
  bench: { tags: ['furniture', 'seat', 'street', 'sports'], desc: 'bench, frontal. variant park (slats + backrest + iron ends) | locker | bus | stadium; w, back, color; seats[] along it', make: bench },
  sofa: { tags: ['furniture', 'seat', 'home'], desc: 'sofa, frontal (#433c3e). seats 1-3, color, cushions (throw colour), pillows: false; seats[] + lie', make: sofa },
  armchair: { tags: ['furniture', 'seat', 'home'], desc: 'armchair, frontal, one seat; color', make: armchair },
  bed: { tags: ['furniture', 'home', 'medical'], desc: 'bed along its long side, headboard left. variant double | single | hospital; duvet flat | body | folded | false, duvetColor, color; lie + seat (edge) + userData.front (duvet / rail)', make: bed },
  table: { tags: ['furniture', 'kitchen', 'home'], desc: 'table with a lit top band. variant kitchen (check cloth) | dining | coffee | side | cafe (round); cloth check | plain | false, w, h, color', make: table },
  desk: { tags: ['furniture', 'office', 'school', 'home'], desc: 'desk. variant office (steel legs, hanging drawer) | home (drawer pedestal) | school | reception; w, h, color', make: desk },
  counter: { tags: ['furniture', 'kitchen', 'shop'], desc: 'counter. variant kitchen (green cabinets) | bar | lab | shop; w, h, sink (true | index), oven, hob, color, top', make: counter },
  nightstand: { tags: ['furniture', 'home'], desc: 'nightstand with a drawer (#876846); color', make: nightstand },
  shelf: { tags: ['furniture', 'home', 'office', 'school'], desc: 'shelving. variant metal (open, boxes) | book (bookcase, spines) | wall (one board, origin at the board); items boxes | books | binders | mixed | none | [per level]; levels, seed', make: shelf },
  wardrobe: { tags: ['furniture', 'home'], desc: 'wardrobe, two doors (#69523a); w, h, color', make: wardrobe },
  rug: { tags: ['furniture', 'home'], desc: 'rug lying on the floor (a low card). variant oval | rect; w, d, color', make: rug },
  floorLamp: { tags: ['furniture', 'light', 'home'], desc: 'floor lamp with a drum shade; lit (default true: lit shade + warm glow), glow, glowR', make: floorLamp },
  tableLamp: { tags: ['furniture', 'light', 'home'], desc: 'table / bedside lamp; lit, color (base), glow', make: tableLamp },
  deskLamp: { tags: ['furniture', 'light', 'office'], desc: 'angled desk lamp aiming right (facing -1: left); lit, color', make: deskLamp },
  pendant: { tags: ['furniture', 'light', 'kitchen'], desc: 'pendant lamp, ORIGIN AT THE CEILING; cord (m), shade cone | dome | bulb, lit, cone (light cone), color', make: pendant },
};
