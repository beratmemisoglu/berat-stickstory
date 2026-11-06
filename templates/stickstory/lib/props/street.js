// Stick stories props - STREET things and VEHICLES. Owned by the prop agent.
// Vehicles are side elevations at character scale (sets NOTES 6: no outline, 3-5 shapes, black tyres with grey hub
// discs, the flat dark ground band under the body), facing right (facing: -1 = left). Wheels turn by themselves when the
// vehicle moves (their angle follows the prop's x position: animate the position, never the wheels). Cars have real
// window / door openings: someone sitting at userData.seat (driver) or userData.seats (all) is drawn between the
// interior and the body, so a driver shows through the window; open: 'driver' | 'front' | 'rear' | 'back' opens a door.
// Light bars (police, ambulance) swap red / blue every 4 frames when lights: true, with a strong coloured glow.
import { B, PAL, face, edge, hi, arcPts, rrPts, onUpdate } from './kit.js';
import { FPS, rnd } from '../core.js';

const pick = (o, k, d) => o[k] ?? d;
/** wheels that turn with the prop's x position (deterministic: a pure function of where it is) */
function wheels(b, xs, r, o = {}, root = b.g) {
  const gs = [];
  for (const x of xs) {
    if (o.arch !== false) b.circ(x, r, r * 1.12, o.arch || '#151619');
    const w = b.sub('wheel', b.depth() + .004, { at: [x, r] });
    w.circ(0, 0, r, o.tyre || '#16171a'); w.circ(0, 0, r * .55, o.hub || '#7e8080'); w.circ(0, 0, r * .2, face(o.hub || '#7e8080', .25));
    const lug = []; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; lug.push([Math.cos(a) * r * .38, Math.sin(a) * r * .38, r * .04]); } w.dots(lug, face(o.hub || '#7e8080', .12));
    if (o.spokes) { const sp = []; for (let i = 0; i < o.spokes; i++) { const a = i / o.spokes * Math.PI; sp.push([Math.cos(a) * r * .9, Math.sin(a) * r * .9, -Math.cos(a) * r * .9, -Math.sin(a) * r * .9]); } w.lines(sp, r * .025, '#9ea4aa'); }
    gs.push(w.g);
  }
  onUpdate(b.g, () => { const a = -root.position.x / r; for (const g of gs) g.rotation.z = a; });
  return gs;
}
const groundBand = (b, x0, x1, o = {}) => { if (o.shadow === false) return; b.ell((x0 + x1) / 2, .005, (x1 - x0) / 2 + .1, .045, '#000000', { op: o.shadowOp ?? .3, z: 0 }); };
/** a light bar on a roof: two halves that swap red / blue every 4 frames with glows */
function lightBar(b, x, y, w, o) {
  const h = .08, L = b.sub('bar', b.depth() + .01, { at: [x, y] });
  L.box(-w / 2, 0, w / 2, .025, '#2a2b30', { r: .006 });
  const dimR = '#7a3a44', dimB = '#3a4a7a';
  if (!o.lights) { L.box(-w / 2, .02, 0, .02 + h, dimR, { r: [.03, 0, 0, 0] }); L.box(0, .02, w / 2, .02 + h, dimB, { r: [0, .03, 0, 0] }); return; }
  // each half: a dim and a bright copy; the bright one shows on its beat (red, blue, red ... every 4 frames)
  L.box(-w / 2, .02, 0, .02 + h, dimR, { r: [.03, 0, 0, 0], lit: true }); L.box(0, .02, w / 2, .02 + h, dimB, { r: [0, .03, 0, 0], lit: true });
  const red = L.box(-w / 2, .02, 0, .02 + h, '#ff8a96', { r: [.03, 0, 0, 0], lit: true }), blue = L.box(0, .02, w / 2, .02 + h, '#8ab8ff', { r: [0, .03, 0, 0], lit: true });
  const gr = L.glow(-w / 4, .06, o.glowR ?? 1.1, '#ff4a5a', { opacity: .6 }), gb = L.glow(w / 4, .06, o.glowR ?? 1.1, '#4a7aff', { opacity: .6 });
  const set = t => { const k = Math.floor(t * FPS / 4 + 1e-6) % 2; gr.visible = red.visible = !k; gb.visible = blue.visible = !!k; };
  set(0); onUpdate(b.g, set);
}

// ================================================= cars =================================================
/** sedan / police / taxi side profile (facing right). Returns the builder after drawing; seats in userData. */
function carBody(o, b, kind) {
  const L = o.l ?? 4.3, r = .33, c = pick(o, 'color', kind === 'police' ? '#eceae4' : kind === 'taxi' ? '#e8b830' : '#697359'), win = o.glass || '#262c34';
  const xr = -L * .3, xf = L * .31;
  groundBand(b, -L / 2 + .15, L / 2 - .15, o);
  // the interior (behind the occupants): dark cabin + seat backs
  const cab = [[-L * .22, .62], [-L * .19, .9], [-L * .11, 1.3], [L * .12, 1.32], [L * .26, .92], [L * .3, .62]];
  b.poly(cab, o.interior || '#1b1d22'); b.box(-L * .16, .62, -L * .1, 1.06, '#2c2f36', { r: .04 }); b.box(L * .06, .62, L * .12, 1.06, '#2c2f36', { r: .04 });
  if (o.driver) { b.circ(L * .03, 1.08, .12, '#0b0b0f'); b.box(-L * .02, .8, L * .08, 1.0, '#0b0b0f', { r: .06 }); }
  if (o.passenger) { b.circ(-L * .2 + .2, 1.06, .11, '#0b0b0f'); b.box(-L * .2 + .14, .8, -L * .2 + .26, .98, '#0b0b0f', { r: .05 }); }
  const occZ = b.depth() + .03;
  // the body in front, with window holes (and a door hole when a door is open)
  const F = b.sub('body', occZ + .03);
  const outer = [[-L / 2 + .02, .3], [-L / 2 - .01, .58], [-L / 2 + .05, .75], [-L / 2 + .3, .83], [-L * .22, .87], [-L * .12, 1.36], [L * .12, 1.38], [L * .28, .93], [L / 2 - .3, .87], [L / 2 - .08, .81], [L / 2 + .01, .68], [L / 2 - .01, .3]];
  const wRear = [[-L * .19, .9], [-L * .11, 1.29], [-L * .015, 1.3], [-L * .015, .9]], wFront = [[L * .005, .9], [L * .005, 1.3], [L * .11, 1.31], [L * .245, .93]];
  const dFront = [[-L * .005, .38], [-L * .005, 1.31], [L * .115, 1.33], [L * .26, .93], [L * .26, .38]], dRear = [[-L * .2, .38], [-L * .2, .9], [-L * .12, 1.31], [-L * .025, 1.31], [-L * .025, .38]];
  const op = o.open === 'driver' || o.open === 'front' || o.open === true ? 'front' : o.open === 'rear' || o.open === 'back' ? 'rear' : null;
  const holes = [op === 'rear' ? dRear : wRear, op === 'front' ? dFront : wFront];
  F.holes(outer, holes, c);
  F.poly([[-L / 2, .3], [L / 2, .3], [L / 2, .44], [-L / 2, .44]], face(c, .14));                                 // lower body
  F.box(-L / 2 - .03, .3, -L / 2 + .25, .42, face(c, .4), { r: .03 }); F.box(L / 2 - .25, .3, L / 2 + .03, .42, face(c, .4), { r: .03 });   // bumpers
  F.line(-L / 2 + .3, .74, L / 2 - .2, .74, .012, face(c, .2));                                                     // crease
  const seams = []; if (op !== 'front') seams.push([L * .26, .44, L * .26, .9], [-L * .005, .44, -L * .005, .9]); if (op !== 'rear') seams.push([-L * .2, .44, -L * .2, .9]);
  F.lines(seams, .01, edge(c));
  const handles = []; if (op !== 'front') handles.push([L * .17, .79, L * .23, .81]); if (op !== 'rear') handles.push([-L * .1, .79, -L * .04, .81]); F.rects(handles, hi(c, .3));
  F.box(L / 2 - .1, .6, L / 2, .7, o.lights === true || o.headlights ? '#fffbe8' : '#e9e6da', { lit: !!(o.lights === true || o.headlights) }); F.box(-L / 2, .6, -L / 2 + .07, .72, '#c8342c');
  F.poly([[L * .13, 1.0], [L * .16, 1.0], [L * .17, .97], [L * .13, .97]], face(c, .3));                         // mirror
  if (o.headlights) { F.glow(L / 2, .65, .6, '#fff4d2', { opacity: .55 }); F.poly([[L / 2, .62], [L / 2 + 2.6, .2], [L / 2 + 2.6, .9]], '#fff4d2', { op: .12, add: true, lit: true }); }
  if (kind === 'police') { F.box(-L / 2 + .05, .5, L / 2 - .05, .6, o.stripe || '#2a55b8'); F.text(o.text || 'POLICE', -L * .1, .67, { size: .14, color: o.stripe || '#2a55b8' }); }
  if (kind === 'taxi') { const ch = []; for (let i = 0; i < 24; i++) if (i % 2) ch.push([-L * .4 + i * L * .033, .5, -L * .4 + (i + 1) * L * .033, .56]); F.rects(ch, '#1d1e22'); }
  if (o.hood) {   // iq500 car repair: the bonnet propped open, the engine bay with a battery
    const hx0 = L * .29, hx1 = L / 2 - .1, E = F.sub('engine', .015);
    E.poly([[hx0, .9], [hx1, .82], [hx1 + .05, .72], [hx0, .72]], '#1d1e22'); E.box(hx0 + .15, .8, hx0 + .45, .98, '#2a2b30', { r: .02 }); E.box(hx0 + .2, .97, hx0 + .25, 1.0, '#d8392f'); E.box(hx0 + .36, .97, hx0 + .41, 1.0, '#c9ccd2'); E.box(hx0 + .5, .78, hx1 - .05, .9, '#5f646b', { r: .02 });
    const H = F.sub('hoodPanel', .03, { at: [hx0, .92] }); H.poly([[0, 0], [hx1 - hx0, -.06], [hx1 - hx0, -.02], [0, .04]], face(c, .05)); H.g.rotation.z = .95 * b.fx;
    F.line(hx0 + .55, .85, hx0 + .2, 1.25, .015, '#9ea4aa');
  }
  if (op) { const D = F.sub('door', .02); const dp = op === 'front' ? dFront : dRear, hinge = op === 'front' ? L * .26 : -L * .025, w0 = Math.max(...dp.map(p => p[0])) - Math.min(...dp.map(p => p[0]));
    const k = .38; D.poly(dp.map(([x, y]) => [hinge + (x - hinge) * k + .02, y]), face(c, .05)); D.poly((op === 'front' ? wFront : wRear).map(([x, y]) => [hinge + (x - hinge) * k + .02, y]), '#3a4048'); void w0; }
  const wg = b.sub('wheels', occZ + .07); wheels(wg, [xr, xf], r, o, b.g); b.g.userData.wheels = true;
  const seats = [{ x: L * .03, y: .62, z: occZ, depth: .4, name: 'driver' }, { x: -L * .2 + .2, y: .62, z: occZ, depth: .4, name: 'rear' }];
  return { L, seats, wheelsAt: [xr, xf], r };
}
// the wheels sub-builder needs the root's position: give it the root group
function car(o = {}, kind = 'car') {
  const b = B(o);
  const res = carBody(o, b, kind);
  if (kind === 'police' || o.lightBar) lightBar(b, 0, 1.38, .7, o);
  if (kind === 'taxi') { b.box(-.18, 1.38, .18, 1.52, '#f4f1ea', { r: .03 }); b.text('TAXI', 0, 1.45, { size: .08, color: '#1d1e22' }); }
  return b.done({ size: { w: res.L, h: 1.55 }, seats: res.seats, seat: res.seats[0], grips: { door: [res.L * .2, .8], rearDoor: [-res.L * .07, .8], trunk: [-res.L / 2 + .2, .82], hood: [res.L * .4, .84] }, points: { headlight: [res.L / 2, .65], engine: [res.L * .38, .84] }, vehicle: kind });
}
/** a van (sister: grey #707476, sliding door line, small side window, cab window) | ambulance (white, red stripe, cross, light bar) */
function van(o = {}, kind = 'van') {
  const b = B(o), L = o.l ?? 5.2, H = 2.35, r = .36, amb = kind === 'ambulance', c = pick(o, 'color', amb ? '#eceae4' : '#707476'), win = o.glass || '#424a56';
  groundBand(b, -L / 2 + .15, L / 2 - .15, o);
  b.poly([[L * .2, .9], [L * .2, H * .85], [L * .33, H * .85], [L * .43, 1.3], [L * .43, .9]], o.interior || '#1b1d22');
  if (o.driver) { b.circ(L * .3, 1.55, .12, '#0b0b0f'); b.box(L * .25, 1.25, L * .35, 1.45, '#0b0b0f', { r: .06 }); }
  const occZ = b.depth() + .03, F = b.sub('body', occZ + .03);
  const nose = []; for (let i = 0; i <= 8; i++) { const t = i / 8, u = 1 - t; nose.push([u * u * L * .27 + 2 * u * t * L * .45 + t * t * L * .5, u * u * H + 2 * u * t * H + t * t * 1.05]); }
  const outer = [[-L / 2, .32], [-L / 2, H - .08], [-L / 2 + .08, H], ...nose, [L / 2 + .01, .6], [L / 2, .32]];
  const cabWin = [[L * .21, 1.32], [L * .21, H * .82], [L * .32, H * .82], [L * .44, 1.32]];
  F.holes(outer, [cabWin], c);
  F.box(-L / 2, H - .12, L * .3, H, hi(c, .06)); F.box(-L / 2, .32, L / 2, .5, face(c, .16)); F.box(-L / 2 - .03, .3, -L / 2 + .22, .44, face(c, .45), { r: .03 }); F.box(L / 2 - .22, .3, L / 2 + .03, .44, face(c, .45), { r: .03 });
  if (!amb) { F.box(-L * .12, 1.35, L * .05, 1.9, win, { r: .03 }); F.lines([[-L * .2, .5, -L * .2, H - .1], [L * .14, .5, L * .14, H - .1], [L * .19, .5, L * .19, H * .85]], .012, edge(c)); }
  else { F.box(-L / 2, 1.0, L / 2, 1.18, o.stripe || '#d8392f'); F.box(-L * .23 - .08, 1.4, -L * .23 + .08, 1.9, o.stripe || '#d8392f'); F.box(-L * .23 - .25, 1.57, -L * .23 + .25, 1.73, o.stripe || '#d8392f'); F.lines([[L * .14, .5, L * .14, H - .1], [L * .19, .5, L * .19, H * .85]], .012, edge(c)); F.box(-L * .02, 1.35, L * .1, 1.75, win, { r: .03 }); }
  F.box(L * .24, .9, L * .29, .93, hi(c, .3)); F.box(L / 2 - .08, .9, L / 2, 1.05, '#e9e6da'); F.box(-L / 2, .9, -L / 2 + .06, 1.1, '#c8342c');
  if (o.text) F.text(o.text, -L * .15, 1.55, { size: .22, color: amb ? '#d8392f' : '#e8e6e0' });
  if (amb || o.lightBar) lightBar(b, L * .15, H, .9, o);
  const wg = b.sub('wheels', occZ + .07); wheels(wg, [-L * .32, L * .3], r, o, b.g);
  return b.done({ size: { w: L, h: H + .12 }, seats: [{ x: L * .3, y: 1.0, z: occZ, depth: .4, name: 'driver' }], seat: { x: L * .3, y: 1.0, z: occZ, depth: .4 }, grips: { door: [L * .27, 1.1], sliding: [-L * .05, 1.1], back: [-L / 2, 1.1] }, vehicle: kind });
}
/** a city bus (iq500 bus stop: grey-white body, warm lit windows with passenger silhouettes, orange LED route sign) */
function bus(o = {}) {
  const b = B(o), L = o.l ?? 10, H = 3.0, r = .5, c = pick(o, 'color', '#d9dcd8'), lit = o.lit ?? true, R = rnd(o.seed ?? 12);
  groundBand(b, -L / 2 + .2, L / 2 - .2, o);
  const winC = lit ? (o.windowColor || '#e9c27a') : '#3a4250';
  b.box(-L / 2 + .2, 1.15, L / 2 - .9, H - .45, winC, { lit });
  const pax = []; for (let i = 0; i < Math.floor((L - 1.4) / .75); i++) if (R() < (o.passengers ?? .6)) pax.push(-L / 2 + .55 + i * .75 + R() * .2);
  for (const x of pax) { b.circ(x, 1.72, .14, '#2a2430'); b.box(x - .17, 1.15, x + .17, 1.6, '#2a2430', { r: [.1, .1, 0, 0] }); }
  if (lit) b.glow(0, 1.6, L * .5, '#ffd9a0', { opacity: .12, sx: 1, sy: .3 });
  const occZ = b.depth() + .03, F = b.sub('body', occZ + .03);
  const outer = [[-L / 2, .35], [-L / 2, H - .1], [-L / 2 + .1, H], [L / 2 - .2, H], [L / 2, H - .3], [L / 2, .35]];
  const wins = []; const n = Math.floor((L - 1.4) / 1.25); for (let i = 0; i < n; i++) { const x0 = -L / 2 + .25 + i * 1.25; wins.push([[x0, 1.2], [x0 + 1.12, 1.2], [x0 + 1.12, H - .5], [x0, H - .5]]); }
  F.holes(outer, wins, c);
  F.box(-L / 2, .35, L / 2, .62, face(c, .16)); F.box(-L / 2, .95, L / 2, 1.08, o.stripe || '#2a6ab8');
  F.box(L / 2 - .9, .45, L / 2 - .18, H - .35, '#3a4250'); F.line(L / 2 - .54, .45, L / 2 - .54, H - .35, .02, edge(c));                        // door
  F.box(L / 2 - .15, 1.1, L / 2, H - .4, winC, { lit, op: .9 });                                                                              // windscreen edge
  F.box(-L / 2 + .3, H - .4, -L / 2 + 1.6, H - .12, '#141418'); F.text(String(o.route ?? '12'), -L / 2 + .55, H - .26, { size: .17, color: '#ff9a2a', lit: true, font: 'JetBrains Mono', weight: 700 }); if (o.dest) F.text(o.dest, -L / 2 + 1.1, H - .26, { size: .11, color: '#ff9a2a', lit: true, font: 'JetBrains Mono', weight: 700 });
  F.box(L / 2 - .1, .7, L / 2, .85, '#fffbe8', { lit: !!o.headlights }); if (o.headlights) F.glow(L / 2, .78, .8, '#fff4d2', { opacity: .55 });
  const wg = b.sub('wheels', occZ + .07); wheels(wg, [-L * .32, L * .3], r, o, b.g);
  return b.done({ size: { w: L, h: H }, grips: { door: [L / 2 - .54, 1.2] }, points: { door: [L / 2 - .54, 0] }, seats: pax.map(x => ({ x, y: 1.15, z: occZ, depth: .4 })), vehicle: 'bus' });
}
/** a bicycle (timeloop: thin coloured frame, black wheels with spokes); seat + handlebar points for a rider */
function bike(o = {}) {
  const b = B(o), r = .34, c = pick(o, 'color', '#d8392f'), xr = -.52, xf = .52;
  const wg = b.sub('wheels', 0); wheels(wg, [xr, xf], r, { spokes: 8, hub: '#c9ccd2', tyre: '#1a1b1e', arch: false }, b.g);
  const bb = [-.05, r], seatP = [-.2, .9], head = [.38, .92];
  const F = b.sub('frame', .02);
  F.path([[xr, r], bb, seatP, [xr, r]], .028, c, { closed: false }); F.path([bb, [head[0] - .02, head[1] - .1], [seatP[0] + .02, seatP[1] - .08]], .03, c); F.path([[head[0] - .02, head[1] - .1], [xf, r]], .028, c);
  F.line(seatP[0], seatP[1], seatP[0] - .02, seatP[1] + .08, .02, '#2a2b30'); F.box(seatP[0] - .12, seatP[1] + .07, seatP[0] + .06, seatP[1] + .11, '#1d1e22', { r: .02 });
  F.line(head[0], head[1] - .1, head[0] - .02, head[1] + .02, .022, '#2a2b30'); F.path([[head[0] - .02, head[1] + .02], [head[0] + .08, head[1] + .05], [head[0] + .06, head[1] - .02]], .02, '#2a2b30');
  F.circ(bb[0], bb[1], .06, '#2a2b30'); F.line(bb[0], bb[1], bb[0] + .1, bb[1] - .12, .02, '#5f646b'); F.box(bb[0] + .06, bb[1] - .14, bb[0] + .16, bb[1] - .11, '#2a2b30');
  b.g.userData.wheels = true;
  return b.done({ size: { w: 1.42, h: 1.05 }, seat: { x: seatP[0] - .03, y: seatP[1] + .11, z: .05, depth: .2 }, grips: { handlebar: [head[0] + .06, head[1] + .04], hand: [head[0] + .06, head[1] + .04] }, points: { pedal: [bb[0] + .11, bb[1] - .125] }, vehicle: 'bike' });
}
/** a kick scooter | moped (motorbike / scooter with a headlight; headlights: glow) */
function scooter(o = {}) {
  const v = o.variant || 'kick', b = B(o);
  if (v === 'kick') { const c = pick(o, 'color', '#3d7bf0'), r = .09; const wg = b.sub('wheels', 0); wheels(wg, [-.32, .32], r, { hub: '#c9ccd2', arch: false }, b.g);
    const F = b.sub('frame', .02); F.box(-.36, r + .02, .26, r + .06, c, { r: .02 }); F.line(.3, r, .34, .95, .03, '#5f646b'); F.box(.22, .93, .46, .97, '#2a2b30', { r: .02 });
    return b.done({ size: { w: .84, h: .97 }, grips: { handlebar: [.4, .95], hand: [.4, .95] }, seat: { x: -.05, y: r + .06, z: .05, depth: .3 }, vehicle: 'scooter' }); }
  const c = pick(o, 'color', '#3a3d44'), r = .3; const wg = b.sub('wheels', .01); wheels(wg, [-.62, .62], r, { arch: false }, b.g);
  const F = b.sub('body', .03); F.poly([[-.75, .55], [-.2, .5], [.1, .45], [.45, .7], [.55, .95], [.4, 1.0], [.2, .75], [-.25, .8], [-.7, .78]], c); F.box(-.55, .78, -.05, .86, '#1d1e22', { r: .04 }); F.line(.5, .95, .62, r, .04, '#5f646b'); F.line(.45, 1.0, .55, 1.12, .03, '#2a2b30'); F.box(.42, 1.1, .7, 1.14, '#2a2b30', { r: .02 });
  F.box(.6, .88, .68, .98, '#fffbe8', { r: .02, lit: !!o.headlights }); if (o.headlights) { F.glow(.68, .93, .5, '#fff4d2', { opacity: .6 }); F.poly([[.68, .9], [3, .4], [3, 1.2]], '#fff4d2', { op: .12, add: true, lit: true }); }
  return b.done({ size: { w: 1.6, h: 1.14 }, seat: { x: -.3, y: .86, z: .06, depth: .4 }, grips: { handlebar: [.62, 1.12], hand: [.62, 1.12] }, vehicle: 'moped' });
}

// ================================================= street furniture =================================================
/** a street lamp: pole + lamp head; lit (default: warm glow + a soft cone on the ground); h */
function lampPost(o = {}) {
  const b = B(o), H = o.h ?? 4.2, c = pick(o, 'color', '#2e3035'), lit = o.lit ?? true;
  if (lit) { b.glow(.45, H - .1, o.glowR ?? 1.4, o.glowColor || '#ffd79a', { opacity: o.glow ?? .45 }); if (o.cone !== false) b.poly([[.3, H - .15], [.6, H - .15], [1.6, 0], [-.7, 0]], '#ffe2b0', { op: .08, add: true, lit: true }); }
  b.box(-.09, 0, .09, .25, face(c, -.1), { r: .02 }); b.box(-.045, .2, .045, H - .2, c); b.path([[0, H - .3], [0, H], [.4, H]], .06, c);
  b.poly([[.25, H - .02], [.65, H - .02], [.58, H - .16], [.32, H - .16]], c); b.box(.33, H - .2, .57, H - .15, lit ? '#fff1cf' : '#9aa0a6', { lit });
  return b.done({ size: { w: .8, h: H }, grips: { pole: [0, 1.1], hand: [0, 1.1] }, light: lit ? { x: .45, y: H - .18, color: '#ffd79a' } : null });
}
/** a traffic light on a pole: state red | yellow | green, or cycle: { t0, red, yellow, green } (seconds) */
function trafficLight(o = {}) {
  const b = B(o), H = o.h ?? 3.0, c = '#2a2c30';
  b.box(-.05, 0, .05, H - .6, '#5f646b'); b.box(-.17, H - .95, .17, H, c, { r: .04 });
  const cols = { red: '#ff4a3a', yellow: '#ffc23a', green: '#3ae08a' }, Y = { red: H - .17, yellow: H - .47, green: H - .77 }, lamps = {};
  for (const k of ['red', 'yellow', 'green']) { b.circ(0, Y[k], .11, '#16171a'); const on = b.sub(k, b.depth() + .002); on.circ(0, Y[k], .1, cols[k], { lit: true }); on.glow(0, Y[k], .5, cols[k], { opacity: .5 }); lamps[k] = on.g; b.circ(0, Y[k], .1, face(cols[k], .7)); }
  const stateAt = t => { if (!o.cycle) return o.state || 'red'; const cy = o.cycle, T = (cy.red ?? 4) + (cy.green ?? 4) + (cy.yellow ?? 1), k = ((t - (cy.t0 ?? 0)) % T + T) % T; return k < (cy.red ?? 4) ? 'red' : k < (cy.red ?? 4) + (cy.green ?? 4) ? 'green' : 'yellow'; };
  const set = t => { const s = stateAt(t); for (const k in lamps) { lamps[k].visible = k === s; lamps[k].position.z = k === s ? .02 : 0; } };
  set(o.cycle?.t0 ?? 0); if (o.cycle) onUpdate(b.g, set);
  return b.done({ size: { w: .34, h: H }, grips: { pole: [0, 1.1] } });
}
/** a sign: stop (red octagon) | street (green name plate on a pole) | bus (round blue BUS sign on a pole, iq500) | exit (green box with a glow: wall, origin centre) | shop (wall shop sign with text: origin centre) | arrow | warning (yellow triangle) | parking | level (yellow LEVEL band sign); text */
function sign(o = {}) {
  const v = o.kind || o.variant || 'street', b = B(o), pole = (h, w = .06) => b.box(-w / 2, 0, w / 2, h, '#7d8288');
  if (v === 'stop') { pole(2.1); const pts = []; for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; pts.push([Math.cos(a) * .32, 2.25 + Math.sin(a) * .32]); } b.poly(pts, '#f4f1ea'); b.poly(pts.map(([x, y]) => [x * .9, 2.25 + (y - 2.25) * .9]), '#c8342c'); b.text(o.text || 'STOP', 0, 2.25, { size: .14, color: '#ffffff' }); return b.done({ size: { w: .64, h: 2.57 } }); }
  if (v === 'bus') { pole(2.2); b.circ(0, 2.35, .24, '#f4f1ea'); b.circ(0, 2.35, .21, '#2a55b8'); b.text(o.text || 'BUS', 0, 2.35, { size: .12, color: '#ffffff' }); if (o.timetable !== false) { b.box(.05, 1.3, .35, 1.8, '#e9e8e2'); b.lines([[.09, 1.7, .31, 1.7], [.09, 1.62, .28, 1.62], [.09, 1.54, .3, 1.54], [.09, 1.46, .26, 1.46]], .012, '#9aa3b2'); } return b.done({ size: { w: .5, h: 2.6 } }); }
  if (v === 'exit') { const W = o.w ?? .5; b.glow(0, 0, W * 1.1, '#9fe0b4', { opacity: .35 }); b.box(-W / 2, -W * .2, W / 2, W * .2, '#87b396', { lit: true, r: .015 }); b.text(o.text || 'EXIT', 0, 0, { size: W * .22, color: '#ffffff', lit: true }); return b.done({ size: { w: W, h: W * .4 }, anchor: 'center', wall: true }); }
  if (v === 'shop' || v === 'banner') { const t = o.text || 'BAKERY', W = o.w ?? Math.max(1.2, t.length * .22), H = o.h ?? .4, c = pick(o, 'color', '#2a3a5a'); b.box(-W / 2 + .03, -H / 2 - .04, W / 2 + .03, H / 2 - .04, '#000000', { op: .18 }); b.box(-W / 2, -H / 2, W / 2, H / 2, c, { r: .02 }); b.text(t, 0, 0, { size: H * .5, color: o.ink || '#f2d28a', lit: !!o.lit }); if (o.lit) b.glow(0, 0, W * .7, o.ink || '#f2d28a', { opacity: .2 }); return b.done({ size: { w: W, h: H }, anchor: 'center', wall: true }); }
  if (v === 'warning') { pole(1.9); b.poly([[-.32, 1.95], [.32, 1.95], [0, 2.5]], '#c8342c'); b.poly([[-.25, 1.99], [.25, 1.99], [0, 2.42]], '#f2c24a'); b.text('!', 0, 2.13, { size: .16, color: '#1d1e22' }); return b.done({ size: { w: .64, h: 2.5 } }); }
  if (v === 'parking') { pole(2.0); b.box(-.25, 2.0, .25, 2.5, '#2a55b8', { r: .04 }); b.text('P', 0, 2.25, { size: .3, color: '#ffffff' }); return b.done({ size: { w: .5, h: 2.5 } }); }
  if (v === 'level') { const W = o.w ?? 2.4; b.box(-W / 2, -.18, W / 2, .18, '#c8ae4f'); b.text(o.text || 'LEVEL -3', -W / 2 + .12, 0, { size: .14, color: '#2a2b30', align: 'left' }); return b.done({ size: { w: W, h: .36 }, anchor: 'center', wall: true }); }
  if (v === 'arrow') { pole(2.3); b.poly([[-.4, 2.25], [.25, 2.25], [.25, 2.17], [.42, 2.35], [.25, 2.53], [.25, 2.45], [-.4, 2.45]], '#f4f1ea'); b.poly([[-.36, 2.28], [.28, 2.28], [.28, 2.23], [.38, 2.35], [.28, 2.47], [.28, 2.42], [-.36, 2.42]], '#2f7a4a'); if (o.text) b.text(o.text, -.06, 2.35, { size: .08, color: '#ffffff' }); return b.done({ size: { w: .84, h: 2.53 } }); }
  pole(2.4); const t = o.text || 'MAPLE ST', W = Math.max(.6, t.length * .085); b.box(-W / 2, 2.32, W / 2, 2.52, '#2f7a4a', { r: .02 }); b.text(t, 0, 2.42, { size: .1, color: '#ffffff' });
  return b.done({ size: { w: W, h: 2.52 }, grips: { pole: [0, 1.1] } });
}
function hydrant(o = {}) { const b = B(o), c = pick(o, 'color', '#c8342c'); b.box(-.15, 0, .15, .05, face(c, .2)); b.box(-.1, .05, .1, .55, c, { r: .02 }); b.box(-.1, .05, -.05, .55, face(c, .12)); b.ell(0, .58, .12, .08, c, { arc: [0, Math.PI] }); b.box(-.03, .63, .03, .68, face(c, .2)); b.box(-.18, .33, .18, .41, face(c, .1), { r: .03 }); b.circ(0, .37, .045, face(c, .3)); return b.done({ size: { w: .36, h: .68 } }); }
function mailbox(o = {}) { const b = B(o), c = pick(o, 'color', '#2a55b8'); b.box(-.05, 0, .05, .5, '#3a3d44'); b.box(-.25, .5, .25, 1.05, c, { r: [.15, .15, .02, .02] }); b.box(-.25, .5, -.18, 1.05, face(c, .12)); b.box(-.15, .85, .15, .88, face(c, .4), { r: .01 }); b.text(o.text || 'MAIL', 0, .66, { size: .07, color: '#ffffff' }); return b.done({ size: { w: .5, h: 1.05 }, points: { slot: [0, .86] } }); }
/** ANIMALS (review 01-pause S13: the story's dog was a grey rat-like card; there were no animals at all). Flat side views
 *  facing right, the same 3-5 flat shapes + a darker far side as every prop; the origin on the ground under the body. */
function dog(o = {}) {
  const b = B(o), c = pick(o, 'color', '#8a5a34'), d = face(c, .2), dk = '#17161a', pose = o.pose || 'stand', s = o.size ?? 1;
  const S = v => v * s, collar = pick(o, 'collar', '#c8342c'), up = pose === 'jump' ? .05 : 0;
  // a leg from its top (x, y) at angle a (+ = forward), round-ended
  const leg = (x, y, len, a, col) => b.path([[S(x), S(y)], [S(x + Math.sin(a) * len), S(y - Math.cos(a) * len)]], S(.036), col, { cap: 'round' });
  if (pose === 'sit') {
    // haunches down at the back, front legs straight, chest up (a sitting terrier)
    leg(.1, .2, .2, 0, d); b.ell(S(-.06), S(.1), S(.12), S(.1), d);
    b.ell(S(0), S(.17), S(.15), S(.09), c, { rot: .55 }); b.ell(S(-.06), S(.09), S(.11), S(.09), c); leg(.13, .2, .2, 0, c);
    b.box(S(-.15), S(0), S(-.02), S(.035), c, { r: S(.015) });
    b.path([[S(-.15), S(.08)], [S(-.22), S(.1)], [S(-.26), S(.16)]], S(.024), c, { cap: 'round' });
  } else {
    const fr = pose === 'jump' ? 1.1 : pose === 'run' ? .5 : 0, bk = pose === 'jump' ? -1.1 : pose === 'run' ? -.55 : 0, y0 = .17 + up;
    leg(-.1, y0, .16, bk * .8, d); leg(.1, y0, .16, fr * .8, d);                                          // far legs
    b.ell(S(0), S(y0 + .03), S(.19), S(.08), c); b.ell(S(.11), S(y0 + .04), S(.085), S(.085), c);         // body, chest
    b.ell(S(-.02), S(y0 + .0), S(.15), S(.035), d, { op: .25 });                                          // belly shade
    leg(-.13, y0, .16, bk, c); leg(.13, y0, .16, fr, c);                                                 // near legs
    b.path([[S(-.18), S(y0 + .05)], [S(-.24), S(y0 + .12)], [S(-.25), S(y0 + .17)]], S(.024), c, { cap: 'round' });   // tail up
  }
  // head: up and open-mouthed when barking, forward when jumping (catching a frisbee: o.frisbee)
  const hx = pose === 'sit' ? .1 : .21, hy = pose === 'sit' ? .36 : pose === 'bark' ? .35 : .3 + up, hr = pose === 'bark' ? -.35 : pose === 'jump' ? .15 : 0;
  b.box(S(hx - .05), S(hy - .07), S(hx + .03), S(hy + .02), c, { r: S(.02), rot: .5 });                 // neck
  b.circ(S(hx), S(hy), S(.075), c);
  const sx = hx + .07 * Math.cos(hr), sy = hy - .02 - .07 * Math.sin(hr);
  if (pose === 'bark') { b.poly([[S(sx - .02), S(sy - .005)], [S(sx + .085), S(sy + .05)], [S(sx + .085), S(sy - .03)]], dk); b.box(S(sx - .02), S(sy + .005), S(sx + .085), S(sy + .045), c, { r: S(.02), rot: .35 }); }
  else b.box(S(sx - .02), S(sy - .03), S(sx + .075), S(sy + .03), c, { r: S(.025), rot: -hr * .6 });
  b.circ(S(sx + .07), S(sy + .015 + (pose === 'bark' ? .03 : 0)), S(.017), dk);                         // nose
  b.circ(S(hx + .035), S(hy + .02), S(.011), dk); b.circ(S(hx + .038), S(hy + .024), S(.004), '#ffffff', { lit: true });   // eye
  b.poly([[S(hx - .045), S(hy + .04)], [S(hx - .02), S(hy + .115)], [S(hx + .01), S(hy + .05)]], face(c, .3));   // ear
  b.box(S(hx - .045), S(hy - .085), S(hx + .015), S(hy - .055), collar, { r: S(.012), rot: .45 });     // collar
  if (pose === 'bark' && o.lines !== false) b.lines([[S(sx + .12), S(sy + .07), S(sx + .17), S(sy + .1)], [S(sx + .13), S(sy + .02), S(sx + .19), S(sy + .02)], [S(sx + .12), S(sy - .03), S(sx + .17), S(sy - .06)]], S(.012), '#f4f1ea');
  if (o.frisbee) b.ell(S(sx + .09), S(sy), S(.012), S(.07), o.frisbee === true ? '#e2483c' : o.frisbee, { rot: .2 });
  return b.done({ size: { w: S(.55), h: S(.45) }, grips: { body: [0, S(.2 + up)], collar: [S(hx - .02), S(hy - .07)], leash: [S(hx - .02), S(hy - .07)] }, top: { y: S(.26 + up), x0: S(-.15), x1: S(.15) } });
}
/** a pigeon / small bird (standing, or flying with wings up / down: o.pose 'stand' | 'fly' | 'flap') */
function bird(o = {}) {
  const b = B(o), c = pick(o, 'color', '#7e8794'), d = face(c, .2), pose = o.pose || 'stand', s = o.size ?? 1, S = v => v * s, y0 = pose === 'stand' ? .07 : .0;
  if (pose === 'stand') b.lines([[S(-.005), S(0), S(.0), S(.04)], [S(.02), S(0), S(.02), S(.04)]], S(.008), '#d8834a');
  if (pose !== 'stand') b.poly([[S(-.03), S(y0 + .04)], [S(-.11), S(y0 + (pose === 'fly' ? .16 : -.06))], [S(.03), S(y0 + .05)]], d);
  b.ell(S(0), S(y0 + .04), S(.07), S(.04), c); b.poly([[S(-.06), S(y0 + .05)], [S(-.12), S(y0 + .07)], [S(-.11), S(y0 + .03)]], d);
  b.circ(S(.06), S(y0 + .08), S(.025), c); b.poly([[S(.08), S(y0 + .085)], [S(.105), S(y0 + .078)], [S(.08), S(y0 + .07)]], '#d8a24a');
  b.circ(S(.068), S(y0 + .088), S(.005), '#121214');
  if (pose !== 'stand') b.poly([[S(-.02), S(y0 + .05)], [S(-.08), S(y0 + (pose === 'fly' ? .2 : -.1))], [S(.04), S(y0 + .06)]], c);
  else b.ell(S(-.01), S(y0 + .045), S(.045), S(.025), d);
  return b.done({ size: { w: S(.2), h: S(.14) } });
}
/** a street bin (dark green with a lid) */
function bin(o = {}) { const b = B(o), c = pick(o, 'color', '#2f4a3a'); b.box(-.22, 0, .22, .85, c, { r: .03 }); b.box(-.22, 0, -.15, .85, face(c, .12)); b.lines([[-.13, .1, -.13, .7], [0, .1, 0, .7], [.13, .1, .13, .7]], .014, face(c, .2)); b.box(-.25, .82, .25, .95, face(c, -.1), { r: .04 }); b.box(-.12, .7, .12, .78, '#141418'); return b.done({ size: { w: .5, h: .95 }, points: { inside: [0, .75] } }); }
function cone(o = {}) { const b = B(o), c = pick(o, 'color', '#e8722a'); b.box(-.2, 0, .2, .04, face(c, .2)); b.poly([[-.15, .04], [.15, .04], [.03, .7], [-.03, .7]], c); b.poly([[-.11, .25], [.11, .25], [.08, .4], [-.08, .4]], '#f4f1ea'); b.poly([[-.15, .04], [-.06, .04], [-.01, .7], [-.03, .7]], face(c, .1)); return b.done({ size: { w: .4, h: .7 }, grips: { hand: [0, .65] } }); }
/** a road barrier with hazard stripes (yellow / black, or red / white) */
function barrier(o = {}) { const b = B(o), W = o.w ?? 1.6, c1 = o.colors?.[0] || '#e8c22a', c2 = o.colors?.[1] || '#1d1e22'; b.box(-W / 2 + .1, 0, -W / 2 + .16, .9, '#5f646b'); b.box(W / 2 - .16, 0, W / 2 - .1, .9, '#5f646b'); b.box(-W / 2, .6, W / 2, .9, c1); const st = []; for (let x = -W / 2; x < W / 2 - .05; x += .2) st.push([[x, .6], [x + .1, .6], [x + .2, .9], [x + .1, .9]]); for (const p of st) b.poly(p.map(([x, y]) => [Math.min(x, W / 2), y]), c2); return b.done({ size: { w: W, h: .9 } }); }
/** an ATM in a wall (iq500 bank: lit screen #9fc6ed); origin bottom; text */
function atm(o = {}) { const b = B(o), c = pick(o, 'color', '#5f646b'); b.box(-.4, 0, .4, 1.9, face(c, .2)); b.box(-.33, .8, .33, 1.75, c, { r: .02 }); b.box(-.25, 1.25, .25, 1.6, '#16171a');
  b.box(-.22, 1.28, .22, 1.57, '#9fc6ed', { lit: true }); b.text(o.text || 'INSERT CARD', 0, 1.42, { size: .045, color: '#1f3b73', lit: true }); b.glow(0, 1.42, .8, '#9fc6ed', { opacity: .25 });
  b.box(-.2, 1.0, .2, 1.18, '#2a2b30', { r: .01 }); const keys = []; for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) keys.push([-.18 + k * .06, 1.02 + r * .05, -.13 + k * .06, 1.06 + r * .05]); b.rects(keys, '#9ea4aa'); b.box(.06, 1.12, .19, 1.14, '#141418'); b.box(-.15, .88, .15, .92, '#141418');
  return b.done({ size: { w: .8, h: 1.9 }, grips: { keypad: [-.1, 1.08], slot: [.12, 1.13] }, points: { screen: [0, 1.42] } }); }
/** a tree (flat circles in two greens on a trunk, iq500 street): variant round | tall | pine; h */
function tree(o = {}) { const v = o.variant || 'round', b = B(o), H = o.h ?? 4, g1 = pick(o, 'color', '#718e54'), g2 = face(g1, .1), tr = o.trunk || '#6a4a34', R = rnd(o.seed ?? 3);
  b.box(-.12, 0, .12, H * .55, tr); b.line(0, H * .4, H * .1, H * .55, .08, tr);
  if (v === 'pine') { for (let i = 0; i < 3; i++) b.poly([[-H * (.28 - i * .06), H * (.3 + i * .2)], [H * (.28 - i * .06), H * (.3 + i * .2)], [0, H * (.62 + i * .17)]], i % 2 ? g2 : g1); return b.done({ size: { w: H * .56, h: H * 1.0 } }); }
  const blobs = v === 'tall' ? [[0, .62, .2], [-.08, .78, .17], [.08, .85, .16], [0, .95, .13]] : [[-.15, .62, .22], [.15, .64, .24], [0, .8, .26], [-.05, .66, .2]];
  blobs.forEach(([x, y, r], i) => b.circ(x * H + (R() - .5) * .05, y * H, r * H, i % 2 ? g2 : g1));
  return b.done({ size: { w: H * .8, h: H * 1.05 } }); }
/** a hedge (dark green rounded block, iq500 park night) */
function hedge(o = {}) { const b = B(o), W = o.w ?? 2, H = o.h ?? .9, c = pick(o, 'color', '#2f4a32'); b.box(-W / 2, 0, W / 2, H, c, { r: .25 }); const R = rnd(o.seed ?? 5), ds = []; for (let i = 0; i < W * 6; i++) ds.push([-W / 2 + .1 + R() * (W - .2), .1 + R() * (H - .2), .03 + R() * .03]); b.dots(ds, face(c, .12)); return b.done({ size: { w: W, h: H } }); }

export const REG = {
  car: { tags: ['vehicle', 'street'], desc: "sedan, side view facing right (4.3 m; iq500 #697359). color, driver / passenger (silhouettes), open 'driver' | 'rear' (door swung, opening), hood (bonnet up, engine + battery), headlights (glow + beam), lightBar, glass; wheels turn with x; seats driver / rear (between interior and body); grips door, trunk, hood", make: o => car(o, 'car') },
  policeCar: { tags: ['vehicle', 'street', 'security'], desc: 'police car (white, blue stripe, POLICE text, light bar). lights: true (red / blue swap every 4 frames with a strong glow), + car options', make: o => car({ ...o }, 'police') },
  taxi: { tags: ['vehicle', 'street'], desc: 'taxi (yellow, checker stripe, roof sign); + car options', make: o => car(o, 'taxi') },
  van: { tags: ['vehicle', 'street'], desc: 'panel van (sister #707476): sliding door line, side window, cab window; driver, text, lightBar; seat driver', make: o => van(o, 'van') },
  ambulance: { tags: ['vehicle', 'street', 'medical'], desc: 'ambulance van (white, red stripe and cross, light bar); lights: true (swapping glow), driver, text', make: o => van(o, 'ambulance') },
  bus: { tags: ['vehicle', 'street'], desc: 'city bus (10 m; iq500): lit warm windows with passenger silhouettes (passengers 0..1, seed), route (LED number), dest, lit, headlights, stripe; points door', make: bus },
  bike: { tags: ['vehicle', 'street', 'sports'], desc: 'bicycle (timeloop: thin coloured frame, spoked wheels); color; seat + grips handlebar + points pedal for a rider', make: bike },
  scooter: { tags: ['vehicle', 'street'], desc: 'scooter. variant kick (kick scooter) | moped (motor scooter / motorbike, headlights glow); seat, grips handlebar', make: scooter },
  motorbike: { tags: ['vehicle', 'street'], desc: 'motorbike (= scooter variant moped); headlights, color', make: o => scooter({ ...o, variant: 'moped' }) },
  lampPost: { tags: ['street', 'light'], desc: 'street lamp; lit (default: warm glow + a soft light cone on the ground), cone: false, h, glow', make: lampPost },
  trafficLight: { tags: ['street'], desc: "traffic light; state red | yellow | green, or cycle { t0, red, green, yellow } seconds", make: trafficLight },
  sign: { tags: ['street', 'wall'], desc: "sign. kind street (green name plate; text) | stop | bus (round BUS sign + timetable) | arrow | warning | parking | exit (green EXIT box with glow, wall, origin centre) | shop (wall shop sign, text, lit) | level (yellow LEVEL band, wall)", make: sign },
  hydrant: { tags: ['street'], desc: 'fire hydrant (red)', make: hydrant },
  mailbox: { tags: ['street'], desc: 'mailbox on a post (blue); text', make: mailbox },
  bin: { tags: ['street'], desc: 'street bin (dark green, lid)', make: bin },
  cone: { tags: ['street'], desc: 'traffic cone (orange, white stripe)', make: cone },
  barrier: { tags: ['street'], desc: 'road barrier with hazard stripes; w, colors', make: barrier },
  atm: { tags: ['street', 'tech'], desc: 'ATM (iq500 bank: lit blue screen, keypad, card slot); text', make: atm },
  tree: { tags: ['street', 'nature'], desc: 'tree: flat circles in two greens on a trunk. variant round | tall | pine; h, color', make: tree },
  hedge: { tags: ['street', 'nature'], desc: 'hedge (dark green rounded block); w, h', make: hedge },
  dog: { tags: ['animal', 'street', 'home'], desc: "small dog (a terrier, side view facing right, ~0.4 m). pose stand | run | jump (legs stretched: lift it with at: [x, y, z]) | sit | bark (head up, mouth open, bark lines; lines: false), color, collar, frisbee: true | '#hex' (in the mouth), size; grips body (carry it) / collar / leash", make: dog },
  bird: { tags: ['animal', 'street', 'nature'], desc: 'pigeon / small bird (side view facing right, 0.2 m). pose stand | fly (wings up) | flap (wings down) - hang a frozen one in the air with at: [x, y, z]; color, size', make: bird },
  pigeon: { tags: ['animal', 'street'], desc: 'a pigeon (= bird)', make: o => bird(o) },
};
