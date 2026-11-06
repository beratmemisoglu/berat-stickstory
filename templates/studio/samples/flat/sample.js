// Flat explainer sample (~20 s): a small real explainer on the sample narration, every beat on its spoken word.
// Narration: "Why does a good night's sleep feel so good? While you sleep, your brain sorts the day into memories. It keeps
// what matters and clears out the rest. After about eight hours, the sun comes up, and you wake up rested and ready."
// Colour = meaning, all video: yellow = the brain / energy, mint = good (kept, rested), sky blue = morning.
// The person is the project's own main character (character.js), the same in every shot.
import { shot, cue, C, VERT, ZONE, GY, W, title, tag, slab, ball, circle, rrect, group, tint, E, seg, lerp, pop } from '../engine.js';
import { character, placeOnGround, drive, expr, mixPose, POSES, icons, badge, bump } from '../models.js';

const cy = (ZONE.y0 + ZONE.y1) / 2;
const scaled = (fn, s, x, y) => { const g = group(null, x, y); fn(g); g.scale.setScalar(s); return g; };   // an icon group at a size
// A wiped tag's clip plane is placed from its world position before the frame's camera push is applied (the push of
// the frame drawn before it): on a seeked frame the pushed tag can lose its right end. Once the wipe has finished the
// plane is opened all the way (the tag is whole from then on).
const unclip = (tg, t, at, dur = .22) => { if (t >= at + dur + .02) tg.userData.plane.constant = 1e5; };

// ---- 1: the question (title card: its words are the narration) ----
// layout: vertical = title on top, character on the ground below it, moon top-right; landscape = character | title | moon
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg('night'); S.ground('#2a1060', '#3c1a80'); const st = {};
  const s = VERT ? 1 : .85, x = VERT ? 0 : -580;
  S.shadow(260 * s, x);
  st.hero = character(null, { scale: s }); placeOnGround(st.hero, x, s);
  // the title pops from its own centre (a wrapper group at the block's middle); landscape: centred over the right two thirds
  st.title = group(null, VERT ? 0 : 300, VERT ? 640 : 300);
  title(st.title, 'Why does a good\nnight\'s sleep\nfeel so good?', { size: VERT ? 100 : 96, y: 0 });
  S.add(st.title, { at: cue('Why', .3), in: 'pop' });
  st.moon = VERT ? scaled(icons.moon, 1.5, 370, 370) : scaled(icons.moon, 1.6, 620, -40);
  S.add(st.moon, { at: cue('night', 1.8) - .1, in: 'rise' });
  return st;
}, update(st, t) {
  const ts = cue('sleep', 2.2), tg = cue('good', 3.34);
  // a yawn-stretch on "sleep": up through in-betweens, held, eased back down
  drive(st.hero, tt => mixPose(POSES.rest, POSES.cheer, .8 * E.inOutCubic(seg(tt, ts - .1, ts + .45)) * (1 - E.inOutCubic(seg(tt, tg, tg + .5)))), t);
  expr(st.hero, t, [[0, 'open', 'smile', 0], [ts - .05, 'half', 'o', -.2], [tg + .2, 'half', 'smile', 0]], .4);
} });

// ---- 2: while you sleep, the brain sorts the day into memories ----
// layout: the day's three badges (built FIRST: they fly into the brain and vanish behind it), the brain hub, the label.
//         vertical = day row on top, brain below; landscape = day column | brain. Once the day is in, the brain eases
//         into the space the day left and its label lands beside / under it.
shot({ t0: cue('While', 4.07) - .25, build(S) {
  S.bg('indigo'); const st = {};
  const days = VERT ? [[-280, 540], [0, 540], [280, 540]] : [[-640, 240], [-640, 15], [-640, -210]], r = VERT ? 110 : 100;
  const hub = VERT ? [0, 110] : [60, 60], rest = VERT ? [0, 300] : [-180, 60];
  ['coffee', 'book', 'phone'].forEach((n, i) => {
    const b = st['day' + i] = badge(null, n, { r, scaleIcon: 1.25, x: days[i][0], y: days[i][1] });
    S.add(b, { at: S.t0 + .12 + i * .12 });
  });
  st.dayLabel = tag(null, 'Your day', { fill: C.pink, size: 56, x: VERT ? 0 : -640, y: VERT ? 735 : 420 });
  S.add(st.dayLabel, { at: S.t0 + .5, in: 'wipe', out: 'fade', outAt: cue('into', 7.11) - .1, outDur: .35 });
  st.brain = badge(null, 'brain', { r: 220, scaleIcon: 2.05, ringCol: C.yellow, x: hub[0], y: hub[1] });
  S.add(st.brain, { at: cue('brain', 5.59) - .05 });
  for (let i = 0; i < 3; i++) st['day' + i].userData.over = [st.brain];     // they fly INTO the brain on purpose
  st.label = tag(null, 'Memories', { fill: C.yellow, size: 60, x: VERT ? 0 : 330, y: VERT ? -10 : 60 });
  S.add(st.label, { at: cue('memories', 7.49), in: 'wipe' });
  st._fly = { days, hub, rest };
  return st;
}, update(st, t, S) {
  const { days, hub, rest } = st._fly, t1 = cue('sorts', 5.97);
  let hits = 0;
  for (let i = 0; i < 3; i++) {
    const a = t1 + i * .3, k = E.inOutCubic(seg(t, a, a + .5)), b = st['day' + i];
    if (k <= 0) continue;
    b.visible = k < 1;
    b.position.set(lerp(days[i][0], hub[0], k), lerp(days[i][1], hub[1], k) + 90 * Math.sin(Math.PI * k), 0);   // a small arc in
    b.scale.setScalar(lerp(1, .3, k));
    hits += bump(t, a + .45, a + .7);                                               // the brain swells as each one lands
  }
  const m = E.inOutCubic(seg(t, t1 + 1.15, t1 + 1.5));                              // then it settles where the day was
  st.brain.position.set(lerp(hub[0], rest[0], m), lerp(hub[1], rest[1], m), 0);
  st.brain.scale.multiplyScalar(1 + .06 * hits);
  unclip(st.dayLabel, t, S.t0 + .5); unclip(st.label, t, cue('memories', 7.49));
} });

// ---- 3: it keeps what matters and clears out the rest ----
// layout: four memory cards (vertical 2 x 2, landscape a row); the kept two get a mint check, the others fade out, the
//         kept two close ranks in the middle
const CARDS = [['book', 1], ['coffee', 0], ['phone', 0], ['star', 1]];   // [icon, kept]
shot({ t0: cue('It', 8.22) - .2, build(S) {
  S.bg('cell'); const st = {};
  const cw = VERT ? 400 : 360, ch = 300;
  const y1 = cy + 150, y2 = cy - 230;
  const at = VERT ? [[-220, y1], [220, y1], [-220, y2], [220, y2]] : [[-630, cy], [-210, cy], [210, cy], [630, cy]];
  const to = VERT ? [[0, y1], null, null, [0, y2]] : [[-220, cy], null, null, [220, cy]];
  st._move = [];
  CARDS.forEach(([icon, kept], i) => {
    const c = st['card' + i] = slab(null, cw, ch, 36, C.white, { x: at[i][0], y: at[i][1], depth: 14 });
    const ic = group(c, -6, -10); icons[icon](ic); ic.scale.setScalar(1.9);
    if (kept) {
      const chk = group(c, cw / 2 - 52, ch / 2 - 52); ball(chk, 34, C.mint, { spec: false }); icons.check(chk, C.white).scale.setScalar(1.25);
      c.userData.chk = chk; st._move.push({ c, from: at[i], to: to[i] });
    }
    S.add(c, kept ? { at: S.t0 + .1 + i * .1 } : { at: S.t0 + .1 + i * .1, out: 'fade', outAt: cue('clears', 10.12) + i * .08, outDur: .4 });
  });
  return st;
}, update(st, t) {
  const tm = cue('matters', 9.36), tr = cue('rest', 11.26);
  st._move.forEach(({ c, from, to }, j) => {
    const p = pop(t, tm + j * .12, .3); c.userData.chk.visible = p > 0; c.userData.chk.scale.setScalar(Math.max(1e-3, p));
    const k = E.inOutCubic(seg(t, tr - .55, tr + .05));                             // after the others have gone
    c.position.set(lerp(from[0], to[0], k), lerp(from[1], to[1], k), 0);
  });
} });

// ---- 4: after about eight hours, the sun comes up ----
// layout: the clock spins eight hours, the label names it; the sun rises from behind the hill and the morning sky
//         spreads from where it comes up (an opaque disc, not a fade). Vertical = stacked; landscape = clock | sun
shot({ t0: cue('After', 11.99) - .2, build(S) {
  S.bg('violet'); const st = {};
  const sx = VERT ? 0 : 460, sy1 = VERT ? -190 : 120, sy0 = GY - 200;
  const sky = circle(null, 1, '#2a8cff', sx, GY);                                  // morning: grows from the horizon
  st.sun = scaled(icons.sun, 2.6, sx, sy0); st._fx = { sky, sunY: [sy0, sy1] };   // (_fx: not an element, the check skips it)
  const hill = '#2a3a9e';                                                          // the ground (in front of the rising sun)
  rrect(null, W + 80, 700, 0, hill, 0, GY - 350); rrect(null, W + 80, 14, 0, tint(hill, .25), 0, GY + 4);
  st.clock = icons.clock(null, VERT ? 3 : 2.8); st.clock.position.set(VERT ? 0 : -430, VERT ? 400 : 130, 0);
  S.add(st.clock, { at: S.t0 + .1 });
  st.label = tag(null, '8 hours', { fill: C.yellow, size: 64, x: VERT ? 0 : -430, y: VERT ? 120 : -170 });
  S.add(st.label, { at: cue('eight', 12.75), in: 'wipe' });
  const { min, hr } = st.clock.userData; st._hands = [min.rotation.z, hr.rotation.z];
  return st;
}, update(st, t) {
  const [m0, h0] = st._hands, k = E.inOutSine(seg(t, cue('After', 11.99), cue('hours', 13.13) + .5));
  st.clock.userData.min.rotation.z = m0 - k * 16 * Math.PI;                       // eight turns of the minute hand
  st.clock.userData.hr.rotation.z = h0 - k * 8 * Math.PI / 6;                       // the hour hand moves eight hours
  const ts = cue('sun', 13.89), ku = E.inOutCubic(seg(t, ts - .1, cue('up', 14.65) + .35));
  const { sky, sunY } = st._fx;
  st.sun.visible = ku > 0; st.sun.position.y = lerp(sunY[0], sunY[1], ku);
  const g = E.inOutSine(seg(t, ts + .1, ts + 1.3)); sky.visible = g > 0; sky.scale.setScalar(Math.max(1e-3, g * 2400));
  unclip(st.label, t, cue('eight', 12.75));
} });

// ---- 5: and you wake up rested and ready ----
// layout: the main character on the left third (vertical: left half), the labels on the right, the morning sun above them
shot({ t0: cue('and', 15.38) - .2, build(S) {
  S.bg('sky'); S.ground('#1f6fd8'); const st = {};
  const s = VERT ? 1.15 : 1, x = VERT ? -170 : -420;
  st.sun = VERT ? scaled(icons.sun, 2.2, 260, 650) : scaled(icons.sun, 2.2, 620, 340);
  S.burst(x, GY + 500 * s, { at: cue('ready', 17.66), dur: 1.1, rays: 14, r0: 240, r1: 400, seed: 4 });   // behind the character
  S.shadow(280 * s, x);
  st.hero = character(null, { scale: s }); placeOnGround(st.hero, x, s);
  st.rested = tag(null, 'Rested', { fill: C.mint, size: 60, x: VERT ? 230 : 300, y: VERT ? 360 : 200 });
  S.add(st.rested, { at: cue('rested', 16.9), in: 'wipe' });
  st.ready = tag(null, 'Ready', { fill: C.yellow, size: 60, x: VERT ? 230 : 300, y: VERT ? 210 : 50 });
  S.add(st.ready, { at: cue('ready', 17.66), in: 'wipe' });
  return st;
}, update(st, t) {
  const tw = cue('wake', 16.14), tr = cue('rested', 16.9), ty = cue('ready', 17.66);
  const SLEEPY = mixPose(POSES.rest, POSES.sad, .7);
  drive(st.hero, tt => {
    let p = mixPose(SLEEPY, POSES.cheer, .85 * E.inOutCubic(seg(tt, tw - .05, tw + .4)));   // wakes with a stretch
    p = mixPose(p, POSES.rest, E.inOutCubic(seg(tt, tr - .1, tr + .35)));                    // arms down, pleased
    return mixPose(p, POSES.cheer, E.outBack(seg(tt, ty, ty + .35), 1.4));                   // and cheers on "ready"
  }, t);
  unclip(st.rested, t, tr); unclip(st.ready, t, ty);
  expr(st.hero, t, [[0, 'shut', 'smile', 0], [tw, 'open', 'o', 0], [tw + .45, 'open', 'smile', 0], [tr, 'happy', 'grin', .2]], .9);
  st.sun.rotation.z = -.3 * E.inOutSine(seg(t, 15.2, 20));
} });
