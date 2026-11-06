// Stick stories sets: HOMES (kitchen, bedroom, living room, home office, hallway). Owned by the set agent.
// The iq500 / sister "lived-in flat interiors": frontal box rooms, ceiling band, plank floor, thin side walls, 10-25 props,
// muted palettes, motivated light, the same set recoloured per mood. Numbers: analysis/sets/NOTES.md 1.3, 1.5, 2.2.
import { THREE } from '../core.js';
import { setCtx, shell, finish, door, win, clock, calendar, frame, lightSwitch, cabinets, plant, shelf, pendant, light, glowAt, dropShadow,
  diningSet, prop, FALLBACK, seatOf, topOf, lieOf, mul, Painter, XY, XZ, ROOM, sign, paper, cone, camWide, camFull, camOn, monitor, deskLamp, mug, wheel, radiator, tvWall, floorRug } from './kit.js';

const D = ROOM.D;

// ---------------------------------------------------------------------------------------------------------------------
// KITCHEN (iq500 f784 / f10663 / f4879 / f7758 / f8174, sister f13507): door | clock + calendar | counter run with upper
// cabinets, hood, spice shelf, tiles, sink, oven | window with curtains + pendant over the table | photo + TV | fridge
// ---------------------------------------------------------------------------------------------------------------------
export const kitchen = {
  desc: 'the family kitchen (iq500 / sister): door, clock, calendar, green cabinets, tiled counter with sink and oven, window with yellow curtains, pendant lamp over a dining table with a check cloth and 3 chairs, family photo, wall TV, fridge',
  opts: "mood: day | dusk | evening | night | candle (+ memory, dim); party: true (bunting); door: 'closed'|'open'|'lit'|'ajar' (night default lit); lamp: true|false (night + lamp: true = the warm lamp-lit night of sister f15720: dark browns, black doorway, warm rims; night alone = iq500's cool grey-violet); table: false (no dining set); chairs: ['left','right','back'] ; tv: 'news' | false",
  moods: ['day', 'dusk', 'evening', 'night', 'candle'],
  build(S, o = {}) {
    // night + lamp: true = sister's lamp-lit night (f15720, f16300, measured): warm dark browns (wall #312c27, floor #2a211a),
    // a black open doorway, no moon shaft, warm rims. Night without the lamp stays iq500's cool grey-violet (f7758).
    const warmNight = o.mood === 'night' && o.lamp === true;
    const ctx = setCtx(S, 'kitchen', o, {
      ...(warmNight ? { gradeAs: { night: { k: .42, sat: .45, tint: [1.06, .98, .88] } } } : {}),
      x0: -5.1, x1: 6.3, camX: .3, mood: 'day',
      pal: { wall: '#a08f7b', ceiling: '#988a74', cornice: '#b9ac96', skirting: '#8f8270', side: '#7b6f61', floor: '#7c5d40', line: '#6c513a',
        door: '#251e17', doorFrame: '#b6b4ac', winFrame: '#e4e0d6', curtain: '#d6b77a', cabinet: '#697869', counter: '#d9cdb7', tiles: '#c3c4b8', grout: '#a8a79e',
        fridge: '#c4c4bb', fridgeSide: '#9d9e94', oven: '#242732' },
      moods: {
        dusk: { wall: '#7f7265', ceiling: '#6b6058', cornice: '#8e8273', floor: '#5a4636', line: '#4e3c2e', cabinet: '#424943', side: '#5a5048' },
        evening: { wall: '#766657', ceiling: '#5f4e3d', floor: '#493728', line: '#3e2f22', cabinet: '#4b5249', side: '#55493e' },
        night: warmNight ? { wall: '#352f29', ceiling: '#2a2520', cornice: '#3b342d', floor: '#2c231b', line: '#221a14', cabinet: '#282d29', side: '#2b2621', skirting: '#2e2924', counter: '#4c473f', tiles: '#453d36',
          doorFrame: '#3a332c', door: '#0b0c0a', curtain: '#5e4c30', winFrame: '#4a433a', fridge: '#4a4945', fridgeSide: '#3a3936' }
          : { wall: '#3d3a42', ceiling: '#2f2d34', cornice: '#47444c', floor: '#2e262b', line: '#262025', cabinet: '#263037', side: '#2c2a30', skirting: '#34313a', counter: '#5d5a5c', tiles: '#47474d' },
        candle: { wall: '#2a1f1b', ceiling: '#1d1613', cornice: '#2f2420', floor: '#171110', line: '#120d0c', cabinet: '#1d1c19', side: '#1e1714' },
      },
      rim: { night: warmNight ? '#efa862' : '#9fb0c8', candle: '#f0ba84' }, rimDir: { day: [1, .35], night: [-1, .25], candle: [1, .1] },
      ...(warmNight ? { propMood: { night: 'dusk' } } : {}),
    });
    const m = ctx.mood, P = ctx.wall;
    // ---- light: daylight from the window + a soft fill (the brighter middle of the day wall)
    light(ctx, { p: [3.0, 1.7, ctx.z + .3], color: '#fff2d8', gain: .5, rh: 1.4, rc: 5, glow: false, moods: ['day', 'memory', 'dim'] });
    light(ctx, { p: [-.4, 1.8, ctx.z + .4], color: '#fff2d8', gain: .22, rh: 2.6, rc: 7, glow: false, moods: ['day', 'memory', 'dim'] });
    // ---- the left: door, switch, clock, calendar
    const doorState = o.door ?? (warmNight ? 'open' : m === 'night' ? 'lit' : 'closed');
    door(ctx, -4.1, { state: doorState, name: 'door' });
    lightSwitch(ctx, -3.42, 1.2);
    clock(ctx, -3.12, 2.08, { time: o.time || (m === 'day' ? [7, 42] : m === 'night' || m === 'candle' ? [11, 5] : [6, 35]) });
    calendar(ctx, -3.12, 1.42);
    // ---- the counter run
    const cx0 = -2.45, cx1 = 1.55, zc = ctx.z + .62, C2 = ctx.at(zc);
    // tiles behind the counter (backsplash): light tiles with 2 px grout
    P.rect(cx0, 1.0, cx1, 1.6, 'tiles', 1);
    for (let y = 1.0 + .135; y < 1.6; y += .135) P.rect(cx0, y - .005, cx1, y + .005, 'grout', 2);
    for (let x = cx0 + .13; x < cx1; x += .13) P.rect(x - .005, 1.0, x + .005, 1.6, 'grout', 2);
    // upper cabinets
    dropShadow(ctx, cx0, 1.6, -.62, 2.3);
    cabinets(ctx, P, cx0, 1.6, -.62, 2.3, 4, 'cabinet', { handles: 'bottom', l: 3 });
    // cooker hood: chimney + trapezoid
    P.rect(-.25, 1.84, .07, ctx.H, '#b4b6b6', 3); P.rect(.03, 1.84, .07, ctx.H, mul(ctx.c('#b4b6b6'), .86), 4);
    P.poly([[-.5, 1.66], [.32, 1.66], [.13, 1.86], [-.31, 1.86]], '#b4b6b6', 3); P.rect(-.52, 1.63, .34, 1.67, mul(ctx.c('#b4b6b6'), .8), 4);
    // spice shelf with 4 jars
    shelf(ctx, P, .58, 1.5, 1.66, { items: 'jars', n: 4, colors: ['#c8783f', '#6c8a50', '#d8c070', '#b44a3c'], l: 3 });
    // base cabinets + oven + top
    C2.rect(cx0, 0, cx1, .08, mul(ctx.c('cabinet'), .55), 0);
    cabinets(ctx, C2, cx0, .08, cx1, .84, 6, 'cabinet', { handles: 'top', l: 1 });
    C2.rect(.12, .12, .78, .8, 'oven', 3); C2.rect(.2, .2, .7, .58, mul(ctx.c('oven'), 1.35), 4); C2.rect(.24, .68, .66, .7, '#9aa0a8', 4);
    C2.rect(cx0 - .02, .84, cx1 + .02, .9, mul(ctx.c('counter'), .82), 5); C2.rect(cx0 - .02, .9, cx1 + .02, 1.02, 'counter', 5); C2.rect(cx0 - .02, .84, cx1 + .02, .852, mul(ctx.c('counter'), .7), 6);
    // sink (ellipse in the top) + faucet
    C2.ellipse(-1.15, .96, .4, .045, mul(ctx.c('#8a8c8c'), .9), 6); C2.ellipse(-1.15, .962, .37, .036, '#737575', 7);
    P.pline([[-1.15, 1.02], [-1.15, 1.25], [-1.02, 1.25], [-1.02, 1.17]], .022, '#c9cccc', 4);
    // kettle + dish rack on the counter
    C2.rrect(.86, 1.0, 1.08, 1.17, .04, '#c9cdd0', 6); C2.ellipse(.97, 1.17, .07, .03, '#9fa4a8', 7); C2.ring(.97, 1.2, .05, .065, '#3a3d42', 5, 1, 20); C2.poly([[1.08, 1.1], [1.15, 1.13], [1.15, 1.11], [1.08, 1.06]], '#c9cdd0', 6);
    for (let k = 0; k < 5; k++) C2.rect(1.2 + k * .045, 1.02, 1.212 + k * .045, 1.15, '#e6e6e2', 6); C2.rect(1.18, 1.0, 1.43, 1.03, '#d0d0cc', 7);
    ctx.spot('counter', { x: -1.15, z: zc + .3, facing: 0, kind: 'counter', topY: .98, back: true });
    ctx.spot('sink', { x: -1.15, z: zc + .3, kind: 'counter', topY: .98, back: true });
    ctx.spot('stove', { x: .45, z: zc + .3, kind: 'counter', topY: .98, back: true });
    ctx.spots.counterTop = { x: .2, y: 1.0, z: zc + .05, kind: 'counter', topY: 1.0, x0: cx0, x1: cx1 };
    // ---- the window with curtains, plant, (party bunting)
    win(ctx, 3.0, { w: 1.7, h: 1.28, sill: 1.02, panes: [2, 1], curtains: true, view: 'city', plant: 'right', shaftDir: -1, moon: !warmNight, shaftK: .13 });
    if (o.party) { const B = ctx.at(ctx.z + .06), cols = ['#d9534f', '#f0c24b', '#5bb0d8', '#7cc576', '#e68ac0']; let k = 0;
      for (let x = 2.0; x < 4.0; x += .13, k++) { const y = 2.45 - Math.sin((x - 2) / 2 * Math.PI) * .18; B.poly([[x - .045, y], [x + .045, y], [x, y - .1]], cols[k % 5], 1); }
      B.pline([...Array(17)].map((_, i) => { const x = 2.0 + i * .125; return [x, 2.45 - Math.sin((x - 2) / 2 * Math.PI) * .18 + .005]; }), .006, '#3b3530', 0); }
    // ---- photo, TV, fridge on the right
    frame(ctx, 4.72, 2.08, { w: .52, h: .38, art: 'family', frame: '#3e3229' });
    if (o.tv === 'off' || (o.tv !== false && m === 'candle')) { const tx = 4.72, ty = 1.48; dropShadow(ctx, tx - .34, ty - .21, tx + .34, ty + .21); P.rrect(tx - .34, ty - .21, tx + .34, ty + .21, .015, '#141418', 4); P.rect(tx - .31, ty - .18, tx + .31, ty + .18, '#1d2026', 5); }
    else if (o.tv !== false) { const tx = 4.72, ty = 1.48; dropShadow(ctx, tx - .34, ty - .21, tx + .34, ty + .21); P.rrect(tx - .34, ty - .21, tx + .34, ty + .21, .015, '#141418', 4);
      P.rect(tx - .31, ty - .18, tx + .31, ty + .18, '!' + (m === 'day' ? '#2d3f66' : '#3b5288'), 5); P.rect(tx - .31, ty - .18, tx + .31, ty - .09, '!#1b2440', 6); P.rect(tx - .29, ty - .12, tx + .05, ty - .1, '!#e8edf6', 7); P.rect(tx - .29, ty - .155, tx - .02, ty - .145, '!#9fb0d0', 7);
      P.rect(tx - .31, ty - .09, tx - .2, ty - .07, '!#d24a3c', 7); P.circle(tx + .05, ty + .05, .055, '!#20262f', 6); P.rrect(tx + .01, ty - .09, tx + .09, ty + .01, .02, '!#20262f', 6);
      if (ctx.M.lamps) glowAt(ctx, tx, ty, ctx.z + .05, { r: .7, color: '#8ea0c8', peak: .18 }); }
    const fz = ctx.z + .38, F = ctx.at(fz), fx = 5.62;
    F.gradH(fx - .36, .02, fx + .36, 1.78, 'fridge', mul(ctx.c('fridge'), .94), 0); F.rect(fx + .3, .02, fx + .36, 1.78, 'fridgeSide', 1);
    F.rect(fx - .36, 1.14, fx + .36, 1.16, mul(ctx.c('fridge'), .8), 1); F.rect(fx + .2, 1.25, fx + .225, 1.55, mul(ctx.c('fridge'), .76), 2); F.rect(fx + .2, .55, fx + .225, 1.0, mul(ctx.c('fridge'), .76), 2);
    F.rect(fx - .36, 0, fx + .36, .03, mul(ctx.c('fridge'), .6), 1);
    [['#d9534f', -.18, .82], ['#5b8fd0', .02, .7], ['#7cb36b', -.12, .45]].forEach(([c, dx, y]) => { F.rect(fx + dx - .07, y - .08, fx + dx + .07, y + .08, '#f2efe6', 2); F.circle(fx + dx, y + .07, .02, c, 3); F.ring(fx + dx, y - .005, .035, .045, c, 3, 1, 16); F.rect(fx + dx - .05, y - .06, fx + dx + .05, y - .055, c, 3); });
    ctx.spot('fridge', { x: fx - .1, z: fz + .45, kind: 'stand', back: true });
    // ---- the dining set under the pendant
    const tx = 2.2, tz = .25;
    if (o.table !== false) diningSet(ctx, tx, tz, { chairs: o.chairs });
    const lampOn = o.lamp ?? (m === 'dusk' || m === 'evening');
    pendant(ctx, tx, 2.05, tz - .05, { on: lampOn, moods: lampOn ? true : [], shade: '#3e4c44' });
    if (m === 'candle') { // the candle pool on the table (a cake candle: the prop agent's 'candle' / 'cake' if any)
      const T = ctx.spots.table, cy = (T?.topY ?? .78) + .12; const cz = tz + .05;
      prop(ctx, ['candle', 'birthday cake', 'cake'], { x: tx + .1, y: T?.topY ?? .78, z: cz + .02 }, (c) => { const g = new THREE.Group(), Pp = new Painter(c, { map: XY(0) }); Pp.rect(-.12, 0, .12, .09, '#e9dcc8', 0); Pp.rect(-.12, .07, .12, .09, '#f3e6d2', 1); Pp.rect(-.008, .09, .008, .16, '#f2efe6', 1); Pp.ellipse(0, .18, .014, .026, '!#ffd27a', 2); g.add(Pp.mesh()); return g; });
      light(ctx, { p: [tx + .1, cy + .04, cz + .1], color: '#ffb070', gain: 2.6, rh: .9, rc: 4.5, peak: .13, gr: 1.25, moods: true, core: 2.5 });
    }
    // ---- spots
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -2.2, z: 0 }); ctx.spot('right', { x: 2.0, z: .1 });
    ctx.spot('window', { x: 3.0, z: ctx.z + .9, back: true });
    ctx.spot('entry', { x: -4.1, z: -1.2, facing: 1 });   // a step into the room from the door
    shell(ctx, { side: 'both' });
    return finish(ctx, { cam: { wide: camWide(-.4), full: camFull(.6), right: camWide(2.6), table: camOn(2.5, 1.2, .25, 2.65), counter: camOn(-1.0, 1.3, -2.6, 2.4) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// BEDROOM (sister f13788 lamp night, f11744 door-light, iq500 f4269 blue night): window with brown side curtains (rain at
// night), wall clock, nightstand + bedside lamp + photo, double bed (purple duvet), floor lamp, door at the right
// ---------------------------------------------------------------------------------------------------------------------
export const bedroom = {
  desc: 'a bedroom (sister / iq500): window with brown curtains (rain at night), wall clock, nightstand with a bedside lamp and photo, double bed with a purple duvet, floor lamp, door at the right',
  opts: "mood: night (lamp-lit warm, default) | day | dusk | blue (moonlit, iq500) | candle; lamp: false (night without the lamp: blue); door: 'closed'|'ajar'|'lit'|'litAjar' (door-light variant: mood 'blue', door 'lit'); rain: true|false; duvet: '#hex'; kid: true (single bed)",
  moods: ['night', 'day', 'dusk', 'blue'],
  build(S, o = {}) {
    const lampNight = o.lamp !== false;
    const ctx = setCtx(S, 'bedroom', o, {
      x0: -4.1, x1: 4.1, mood: 'night',
      pal: { wall: '#a8957f', ceiling: '#958571', cornice: '#b2a08a', skirting: '#7d6b5a', side: '#7d6d5d', floor: '#6b4a33', line: '#5c3f2b', door: '#5b4636', doorFrame: '#8f7c66', winFrame: '#3e2f28', curtain: '#5e4337' },
      moods: lampNight ? { night: { wall: '#6f5e4f', ceiling: '#5f5145', cornice: '#6b5b4d', floor: '#402a1e', line: '#33221a', side: '#3c312b', skirting: '#4e4035', doorFrame: '#5e4f42', door: '#2e241d', curtain: '#4c362e', winFrame: '#2a201b' },
        blue: { wall: '#262942', ceiling: '#1e2036', floor: '#191a2a', line: '#14152a', side: '#1a1c30', skirting: '#22243a', curtain: '#2a2436' } } : { night: { wall: '#303542', ceiling: '#262936', floor: '#181927', line: '#14141f', side: '#22252f' } },
      rim: { night: lampNight ? '#cf9c64' : '#9fb0c8' }, rimDir: { night: [-1, .3], blue: [1, .2] }, propMood: lampNight ? { night: 'dusk' } : {},
    });
    const m = ctx.mood, P = ctx.wall, lampOn = !!((m === 'night' && lampNight) || m === 'dusk' || o.lampOn);
    // the bedside lamp lights the wall (warm falloff, measured +52 L above the shade)
    if (lampOn) light(ctx, { p: [-1.25, .95, -1.2], color: '#ffd9a8', gain: 2.2, rh: 1.5, rc: 5, glow: true, peak: .13, gr: 1.6 });
    light(ctx, { p: [-2.2, 1.6, ctx.z + .3], color: '#fff2d8', gain: .4, rh: 1.6, rc: 5, glow: false, moods: ['day'] });
    win(ctx, -2.3, { w: 1.5, h: 1.05, sill: 1.08, panes: [2, 1], view: m === 'day' ? 'city' : 'sky', rain: o.rain ?? (m !== 'day'), sillLedge: false, shaftDir: 1 });
    // brown side curtains: plain panels hanging from above the window to below the sill
    for (const s of [-1, 1]) { const cx = -2.3 + s * (.75 + .17); P.rect(cx - .17, .88, cx + .17, 2.42, 'curtain', 6); P.rect(cx - .17, .88, cx + .17, .9, mul(ctx.c('curtain'), .8), 7); dropShadow(ctx, cx - .17, .88, cx + .17, 2.42); }
    clock(ctx, -.5, 2.12, { r: .14, time: [10, 35] });
    // nightstand + lamp + photo (props), the bed, the floor lamp
    const ns = prop(ctx, 'nightstand', { x: -1.25, z: -1.3 }, FALLBACK.nightstand);
    const nsTop = topOf(ns); ctx.spot('nightstand', nsTop);
    prop(ctx, 'tableLamp', { x: -1.13, y: nsTop.y, z: -1.32, lit: lampOn }, (c, oo) => FALLBACK.lamp(c, { ...oo, on: lampOn }));
    const ph = new Painter(ctx, { map: XY(-1.26) }); ph.rect(-1.42, nsTop.y, -1.27, nsTop.y + .19, '#d8d0c2', 0); ph.rect(-1.4, nsTop.y + .02, -1.29, nsTop.y + .17, '#7aa0c8', 1); ph.rect(-1.4, nsTop.y + .02, -1.29, nsTop.y + .08, '#e0c060', 2); ctx.painters.set('photo', ph);
    const bed = prop(ctx, 'bed', { x: .45, z: -.7, variant: o.kid ? 'single' : 'double', duvetColor: o.duvet || '#816479' }, (c, oo) => FALLBACK.bed(c, { ...oo, duvet: o.duvet || '#816479' }));
    ctx.spot('bed', lieOf(bed)); ctx.spot('bedside', seatOf(bed, { facing: 0 }));
    prop(ctx, 'floorLamp', { x: 2.35, z: ctx.z + .3, lit: lampOn }, (c, oo) => FALLBACK.floorlamp(c, { ...oo, on: lampOn }));
    door(ctx, 3.1, { state: o.door ?? (m === 'blue' ? 'lit' : 'closed'), hinge: 'right', litColor: m === 'blue' ? '!#eccb9c' : undefined, door: 'door' });
    ctx.spot('window', { x: -2.3, z: ctx.z + .9, back: true }); ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -2.2, z: 0 }); ctx.spot('right', { x: 2.2, z: 0 });
    ctx.spot('entry', { x: 3.1, z: -1.3 });
    shell(ctx, { side: 'both' });
    return finish(ctx, { cam: { wide: camWide(0), full: camFull(0, { h: 4.6 }), bed: camOn(.4, 1.0, ctx.z + 1.3, 2.4) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// LIVING ROOM (sister f12373 / f12437 evening, iq500 f11186): door, a row of small frames, sofa with cushions, coffee
// table, rug, floor lamp, sideboard with a plant and a router, window optional
// ---------------------------------------------------------------------------------------------------------------------
export const livingroom = {
  desc: 'a living room (sister): door, a row of small framed pictures, sofa, coffee table on a rug, floor lamp, sideboard with plant and router, wall TV option',
  opts: "mood: evening (warm lamp, default) | day | night | dusk | blue; tv: true (a TV on the wall above the sideboard); window: true; sofa: '#hex'",
  moods: ['evening', 'day', 'night', 'dusk'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'livingroom', o, {
      x0: -4.6, x1: 4.6, mood: 'evening',
      pal: { wall: '#9a8670', ceiling: '#8a7865', cornice: '#a8947d', skirting: '#6b5848', side: '#6e5d4d', floor: '#6b4a33', line: '#5a3e2b', door: '#5a4636', doorFrame: '#8c7a66', winFrame: '#d4cdc0', curtain: '#8c6f55' },
      moods: { evening: { wall: '#56473b', ceiling: '#483a32', cornice: '#5c4c40', floor: '#3d271b', line: '#311f16', side: '#3a2f28', skirting: '#43362d', door: '#3a2c22', doorFrame: '#5a4a3d' } },
      rim: { evening: '#efc49a' }, rimDir: { evening: [1, .35] },
    });
    const m = ctx.mood, P = ctx.wall, lampOn = ctx.M.lamps || m === 'evening';
    if (lampOn) light(ctx, { p: [2.1, 1.5, ctx.z + .45], color: '#ffd9a8', gain: 1.25, rh: 1.1, rc: 4.6, glow: false });
    light(ctx, { p: [0, 1.8, ctx.z + .3], color: '#fff2d8', gain: .3, rh: 2.2, rc: 7, glow: false, moods: ['day'] });
    door(ctx, -3.7, { state: o.door ?? 'closed', panels: true });
    // the row of small frames (heights vary like the reference)
    [[-2.5, 1.85, .26, .34, 'figure'], [-1.95, 1.95, .22, .26, 'landscape'], [-1.45, 1.82, .3, .38, 'portrait'], [-.2, 1.9, .26, .32, 'figure'], [.95, 1.88, .3, .36, 'abstract']].forEach(([x, y, w, h, art]) => frame(ctx, x, y, { w, h, art, frame: '#c9bfae', fw: .022 }));
    if (o.window) win(ctx, -1.0, { w: 1.4, h: 1.15, sill: 1.0, curtains: true, view: 'city' });
    const sofa = prop(ctx, 'sofa', { x: -.25, z: ctx.z + .75, seats: 3, color: o.sofa || '#433c3e' }, (c, oo) => FALLBACK.sofa(c, { ...oo, color: o.sofa || '#433c3e' }));
    const seats = sofa.userData.seats?.length || 3; for (let i = 0; i < seats; i++) ctx.spot(`sofa${i + 1}`, seatOf(sofa, { i, facing: 0 }));
    ctx.spot('sofa', seatOf(sofa, { i: Math.floor(seats / 2), facing: 0 })); if (sofa.userData.lie) ctx.spot('sofaLie', lieOf(sofa));
    floorRug(ctx, -.25, -1.2, 3.6, 2.2, '#3c1f17');
    const ct = prop(ctx, 'table', { x: -.25, z: -1.25, variant: 'coffee', w: 1.2 }, (c, oo) => FALLBACK.table(c, { ...oo, w: 1.2, h: .42 }));
    ctx.spot('table', topOf(ct));
    prop(ctx, 'floorLamp', { x: 2.1, z: ctx.z + .4, lit: lampOn }, (c, oo) => FALLBACK.floorlamp(c, { ...oo, on: lampOn }));
    // sideboard (built in against the wall) with a plant and a router
    const sz = ctx.z + .25, SB = ctx.at(sz), sx = 3.25;
    SB.rect(sx - .6, .08, sx + .6, .74, '#6e5440', 0); SB.rect(sx - .6, .7, sx + .6, .76, mul(ctx.c('#6e5440'), 1.15), 1); SB.rect(sx - .6, 0, sx + .6, .08, '#2b221c', 0);
    SB.rect(sx - .006, .1, sx + .006, .68, mul(ctx.c('#6e5440'), .77), 1); SB.rect(sx - .14, .42, sx - .06, .44, '#c9bfae', 2); SB.rect(sx + .06, .42, sx + .14, .44, '#c9bfae', 2);
    plant(ctx, SB, sx - .35, .76, { s: 1.1, l: 3 });
    SB.rect(sx + .15, .76, sx + .45, .82, '#e8e6e0', 3); SB.rect(sx + .19, .82, sx + .2, 1.02, '#e8e6e0', 3); SB.rect(sx + .4, .82, sx + .41, 1.02, '#e8e6e0', 3); SB.circle(sx + .25, .79, .008, '!#7cff9a', 4); SB.circle(sx + .29, .79, .008, '!#7cff9a', 4);
    ctx.spot('sideboard', { x: sx, z: sz + .45, kind: 'counter', topY: .76, back: true });
    if (o.tv) tvWall(ctx, P, sx, 1.6, { w: 1.0, h: .58, screen: o.tv === true ? 'news' : o.tv });
    ctx.spot('door', ctx.spots.door); ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -2.3, z: 0 }); ctx.spot('right', { x: 2.3, z: 0 }); ctx.spot('entry', { x: -3.7, z: -1.3 });
    shell(ctx, { side: 'both' });
    return finish(ctx, { cam: { wide: camWide(0), full: camFull(0), sofa: camOn(-.25, .95, ctx.z + 1.2, 2.3) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// HOME OFFICE (sister f1906 day, iq500 f2241 day, iq500 f8692 night): panelled door, wardrobe, open metal shelf with
// coloured boxes + bicycle wheel + printer, 3 blueprints, desk with monitor / lamp / mug, office chair, round rug, window
// ---------------------------------------------------------------------------------------------------------------------
export const homeoffice = {
  desc: 'a home office / study (sister + iq500): panelled door, wardrobe, metal shelf with coloured boxes, a bicycle wheel and a printer, three blueprints, desk with monitor, desk lamp and mug, office chair, round rug, window with a skyline',
  opts: "mood: day (cool, default) | night (monitor bloom, moon) | dusk | blue | evening; screen: 'dark' | 'text' | 'code' | 'chart' | 'off'",
  moods: ['day', 'night', 'dusk'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'homeoffice', o, {
      x0: -4.4, x1: 4.6, mood: 'day',
      pal: { wall: '#7e8390', ceiling: '#60666e', cornice: '#8a8e98', skirting: '#5a5f69', side: '#585d67', floor: '#55463a', line: '#483b31', door: '#453b32', doorFrame: '#8d8f95', winFrame: '#c9ccd0' },
      moods: { night: { wall: '#2a2f3e', ceiling: '#22262f', cornice: '#30354a', floor: '#19181d', line: '#141317', side: '#1e222c', skirting: '#22252f', door: '#1f1c1a', doorFrame: '#3a3e4a', winFrame: '#4a4f5c' } },
      rim: { day: '#d0cfc9', night: '#91caf6' }, rimDir: { day: [1, .4], night: [1, .2] },
    });
    const m = ctx.mood, P = ctx.wall;
    light(ctx, { p: [3.4, 1.6, ctx.z + .3], color: '#eef3ff', gain: .35, rh: 1.6, rc: 5, glow: false, moods: ['day'] });
    if (m === 'night' || m === 'blue') light(ctx, { p: [1.3, 1.2, ctx.z + .7], color: '#8ea0c8', gain: 1.1, rh: .8, rc: 3.4, glow: false });
    door(ctx, -3.75, { panels: true, state: o.door ?? 'closed', handle: '#202024' });
    const wr = prop(ctx, 'wardrobe', { x: -2.55, z: ctx.z + .3, w: .95, h: 1.95 }, FALLBACK.wardrobe); void wr;
    const sh = prop(ctx, 'shelf', { x: -1.0, z: ctx.z + .22, variant: 'metal', items: 'boxes', w: 1.3, h: 1.85 }, (c) => { const g = new THREE.Group(), Q = new Painter(c, { map: XY(0), lit: false }), u = '#70563f';
      Q.rect(-.66, 0, -.62, 1.85, u, 0); Q.rect(.62, 0, .66, 1.85, u, 0); for (const y of [.05, .62, 1.22, 1.82]) Q.rect(-.66, y, .66, y + .03, u, 1);
      ['#5ba077', '#c7ab50', '#a8a8a8', '#c65c46', '#7c79c7'].forEach((cc, i) => Q.rect(-.58 + i * .24, 1.25, -.4 + i * .24, 1.38, cc, 2)); ['#a97644', '#6f8195', '#966551', '#7a8d67'].forEach((cc, i) => Q.rect(-.56 + i * .3, .08, -.32 + i * .3, .3, cc, 2));
      g.add(Q.mesh()); return g; });
    const SP = ctx.at(ctx.z + .3); wheel(ctx, SP, -.8, .95, .33, { l: 3 });
    if (!sh || !sh.userData.size) { SP.rect(-1.5, .65, -1.05, .9, '#e6e3dc', 3); SP.rect(-1.45, .82, -1.1, .84, '#3a3a3e', 4); }
    // blueprints
    frame(ctx, -1.0, 2.32, { w: .62, h: .32, art: 'blueprint', frame: '#5a7bb0', fw: .02 });
    frame(ctx, .55, 1.95, { w: .66, h: .34, art: 'blueprint', frame: '#5a7bb0', fw: .02 });
    frame(ctx, 1.6, 1.98, { w: .66, h: .34, art: 'blueprint', frame: '#5a7bb0', fw: .02 });
    // the desk with its dressing
    const dz = ctx.z + .55, desk = prop(ctx, 'desk', { x: 1.05, z: dz, variant: 'home', w: 2.0 }, (c, oo) => FALLBACK.desk(c, { ...oo, w: 2.0 }));
    const T = topOf(desk); ctx.spot('desk', T);
    const DP = ctx.at(dz + .02); const scr = o.screen || (m === 'night' ? 'dark' : 'dark');
    monitor(ctx, DP, 1.35, T.y, { w: .62, h: .4, ui: scr, z: dz + .02, bloom: m === 'night' ? .12 : .06 }); deskLamp(ctx, DP, 2.0, T.y, { facing: -1, z: dz + .05, on: m === 'dusk' || m === 'evening' }); mug(ctx, DP, .3, T.y);
    const ch = prop(ctx, 'officeChair', { x: .7, z: dz + .75, view: 'side', facing: 1 }, FALLBACK.chair);
    ctx.spot('chair', seatOf(ch, { facing: 1 }));
    floorRug(ctx, .9, .5, 3.6, 3.0, '#464b5c', { round: true });
    win(ctx, 3.45, { w: 1.55, h: 1.2, sill: .98, panes: [2, 1], view: m === 'day' ? 'city' : 'skyline', moon: true, shaftDir: -1, shaft: m !== 'day', haze: .05 });
    ctx.spot('window', { x: 3.45, z: ctx.z + .9, back: true }); ctx.spot('shelf', { x: -1.0, z: ctx.z + .8, back: true }); ctx.spot('wardrobe', { x: -2.55, z: ctx.z + .85, back: true });
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -2.2, z: 0 }); ctx.spot('right', { x: 2.4, z: 0 }); ctx.spot('entry', { x: -3.75, z: -1.3 });
    shell(ctx, { side: 'both' });
    return finish(ctx, { cam: { wide: camWide(.1), full: camFull(.1), desk: camOn(1.1, 1.05, dz + .6, 2.0) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// HALLWAY (iq500 f2407): light beige wall, two doors, a family photo, coats on hooks, a long red-brown runner rug
// ---------------------------------------------------------------------------------------------------------------------
export const hallway = {
  desc: 'an apartment hallway / entrance (iq500): beige wall, front door + a room door, family photo, coats on hooks, runner rug, shoe rack',
  opts: "mood: day | evening | night; front: 'closed'|'open'|'lit'|'ajar' (the front door, spot 'door'); room: state of the room door (spot 'roomDoor')",
  moods: ['day', 'evening', 'night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'hallway', o, {
      x0: -4.4, x1: 4.4, mood: 'day',
      pal: { wall: '#c7b9a3', ceiling: '#b3a58f', cornice: '#d2c6b2', skirting: '#a19179', side: '#998b76', floor: '#7a5c42', line: '#684e38', door: '#d9cfbf', doorFrame: '#e4dccd', runner: '#603b2c' },
      rim: { day: '#f0ba84' }, rimDir: { day: [-1, .3] },
    });
    const P = ctx.wall;
    light(ctx, { p: [0, 2.4, ctx.z + .6], color: '#fff2d8', gain: .35, rh: 2.0, rc: 6, glow: false, moods: ['day', 'evening', 'night', 'dusk'] });
    door(ctx, -2.9, { state: o.room ?? 'closed', name: 'roomDoor', glass: '#c8d8c8', panels: false, color: 'door', handle: '#8a8478' });
    door(ctx, 1.4, { state: o.front ?? 'open', name: 'door', color: '#7a5a3e', back: '#2a221c' });
    frame(ctx, -1.0, 1.72, { w: .55, h: .4, art: 'family', frame: '#5a4a3d' });
    // coat hooks: a rail with two coats and a hat
    const hx = 3.05; P.rect(hx - .55, 1.78, hx + .55, 1.83, '#6e5844', 4); dropShadow(ctx, hx - .55, 1.78, hx + .55, 1.83);
    for (const [dx, c, len] of [[-.32, '#7d7f86', .95], [.1, '#8c6a4f', 1.05], [.38, '#5b5f6a', .8]]) { P.circle(hx + dx, 1.76, .02, '#2a2622', 5); P.poly([[hx + dx - .12, 1.74], [hx + dx + .12, 1.74], [hx + dx + .17, 1.74 - len], [hx + dx - .17, 1.74 - len]], c, 5); P.rect(hx + dx - .005, 1.74 - len, hx + dx + .005, 1.7, mul(ctx.c(c), .8), 6); dropShadow(ctx, hx + dx - .17, 1.74 - len, hx + dx + .17, 1.74); }
    // runner rug on the floor
    floorRug(ctx, -.3, .5, 6.2, 3.2, 'runner', { margin: .2, lineK: 1.3, fringe: true });
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -2.2, z: 0 }); ctx.spot('right', { x: 2.2, z: 0 }); ctx.spot('coats', { x: 3.05, z: ctx.z + .7, back: true }); ctx.spot('entry', { x: 1.4, z: -1.6 });
    shell(ctx, { side: 'both' });
    return finish(ctx, { cam: { wide: camWide(0), full: camFull(0) } });
  },
};
