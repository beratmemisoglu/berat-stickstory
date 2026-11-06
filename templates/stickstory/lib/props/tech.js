// Stick stories props - TECH: phone, tablet, laptop, keyboard, mouse, monitor, TV, printer, camera, microphone, router.
// Owned by the prop agent. Screens show a UI (lib/props/screens.js): o.screen = a spec | a string | a draw function
// (ctx, w, h, t) with o.screenFps for animation. Screens are drawn bright and unlit (they glow under the bloom); o.glow
// adds a soft light around the screen (night shots). The same phone design works in a wide (a black rounded rect), a
// medium (notch + UI) and a hand insert (o.detail: 'high' adds the bezel edge, side buttons and the top-down lip).
import { B, PAL, face, edge, hi, screenOn, rrPts } from './kit.js';

/** a smartphone, 9:19, standing on its bottom edge (origin bottom centre). view front | back; lip: top-down thickness lip + contact shadow */
function phone(o = {}) {
  const b = B(o), w = o.w ?? .068, h = o.h ?? w * 19 / 9, r = w * .16, body = o.color || PAL.phone, hiD = o.detail === 'high';
  if (o.lip) {
    b.shadow(w * .08, h / 2 - h * .03, w * .62, h * .54, { opacity: .35 });
    b.box(-w / 2 + w * .06, -h * .03, w / 2 + w * .06, h - h * .03, PAL.phoneSide, { r });
  }
  b.box(-w / 2, 0, w / 2, h, body, { r });
  if (hiD) { b.box(-w / 2 + w * .015, w * .015, w / 2 - w * .015, h - w * .015, '#5e5c5d', { r: r * .92 }); b.box(-w / 2 + w * .035, w * .035, w / 2 - w * .035, h - w * .035, body, { r: r * .85 });
    b.box(w / 2, h * .62, w / 2 + w * .02, h * .74, '#2a2a30'); b.box(-w / 2 - w * .02, h * .7, -w / 2, h * .78, '#2a2a30'); }
  if (o.view === 'back') {
    b.box(-w / 2 + w * .08, h - w * .5, -w / 2 + w * .46, h - w * .08, face(body, -.25), { r: w * .1 });
    b.circ(-w / 2 + w * .19, h - w * .19, w * .07, '#05050a'); b.circ(-w / 2 + w * .35, h - w * .19, w * .07, '#05050a'); b.circ(-w / 2 + w * .19, h - w * .37, w * .05, '#05050a');
    b.circ(0, h * .55, w * .09, face(body, -.15));
  } else {
    const m = w * .055;
    screenOn(b, -w / 2 + m, m * 1.2, w / 2 - m, h - m * 1.2, o.screen ?? { ui: 'lock' }, 'phone', 360, Math.round(360 * (h - m * 2.4) / (w - m * 2)), { fps: o.screenFps, t: o.t, glow: o.glow, glowColor: o.glowColor });
  }
  return b.done({ size: { w, h }, grips: { hand: [0, h * .22], thumb: [w * .48, h * .4], ear: [0, h * .55], top: [0, h], two: [-w * .5, h * .3] }, points: { screen: [0, h / 2] } });
}
/** a tablet (portrait; landscape: true) */
function tablet(o = {}) {
  const land = !!o.landscape, w = o.w ?? (land ? .25 : .18), h = o.h ?? (land ? .18 : .25), b = B(o), body = o.color || '#202128';
  b.box(-w / 2, 0, w / 2, h, body, { r: w * .07 });
  if (o.detail === 'high') b.box(-w / 2 + .003, .003, w / 2 - .003, h - .003, '#4a4a52', { r: w * .065 }), b.box(-w / 2 + .006, .006, w / 2 - .006, h - .006, body, { r: w * .06 });
  const m = .012;
  screenOn(b, -w / 2 + m, m, w / 2 - m, h - m, o.screen ?? { ui: 'home' }, 'tablet', land ? 640 : 480, land ? 460 : 660, { fps: o.screenFps, t: o.t, glow: o.glow });
  return b.done({ size: { w, h }, grips: { hand: [-w * .45, h * .3], left: [-w * .48, h * .35], right: [w * .48, h * .35] }, points: { screen: [0, h / 2] } });
}
/** a laptop on a surface: view front (screen to the camera, default) | back (lid back to the camera) | side; closed: true */
function laptop(o = {}) {
  const b = B(o), W = o.w ?? .34, lid = W * .64, deck = o.deckColor || '#9ea4aa', back = o.color || '#b8bcc2', view = o.view || 'front';
  if (o.closed) { b.box(-W / 2, 0, W / 2, .018, face(back, .1), { r: .004 }); b.poly([[-W / 2, .018], [W / 2, .018], [W / 2 - .02, .04], [-W / 2 + .02, .04]], back);
    return b.done({ size: { w: W, h: .04 }, grips: { hand: [W * .4, .02], left: [-W * .45, .02], right: [W * .45, .02] } }); }
  if (view === 'side') {
    b.line(-W * .45, .008, W * .45, .008, .016, face(deck, .1)); b.line(-W * .45, .012, -W * .5, .012 + lid * .95, .014, back);
    return b.done({ size: { w: W, h: lid }, grips: { hand: [W * .35, .02] } });
  }
  if (view === 'back') {
    b.poly([[-W / 2 - .01, 0], [W / 2 + .01, 0], [W / 2, .02], [-W / 2, .02]], face(deck, .2));
    b.box(-W / 2, .012, W / 2, .012 + lid, back, { r: [.012, .012, .004, .004] }); b.box(-W / 2, .012, W / 2, .02, face(back, .15));
    b.circ(0, .012 + lid * .55, W * .045, hi(back, .35));
    if (o.glow) b.glow(0, .012 + lid * .7, lid * 1.1, o.glowColor || '#9fc3ff', { opacity: typeof o.glow === 'number' ? o.glow : .25 });
    return b.done({ size: { w: W, h: lid + .012 }, grips: { left: [-W * .45, .01], right: [W * .45, .01], hand: [W * .4, .01] } });
  }
  b.box(-W / 2, .03, W / 2, .03 + lid, '#1e2026', { r: [.012, .012, .002, .002] });
  const m = .012;
  screenOn(b, -W / 2 + m, .03 + m * .8, W / 2 - m, .03 + lid - m, o.screen ?? { ui: 'windows' }, 'laptop', 512, Math.round(512 * (lid - m * 1.8) / (W - m * 2)), { fps: o.screenFps, t: o.t, glow: o.glow });
  b.poly([[-W / 2 - .03, 0], [W / 2 + .03, 0], [W / 2, .032], [-W / 2, .032]], deck);
  b.box(-W / 2 - .03, -.006, W / 2 + .03, 0, face(deck, .2));
  if (o.detail !== 'low') b.lines([[-W * .42, .011, W * .42, .011], [-W * .4, .02, W * .4, .02]], .003, face(deck, .25));
  return b.done({ size: { w: W + .06, h: lid + .03 }, grips: { left: [-W * .45, .015], right: [W * .45, .015], hand: [W * .4, .015] }, points: { screen: [0, .03 + lid / 2], keys: [0, .015] } });
}
/** a keyboard lying on a desk (front view: a low band with key rows; view: 'top' = seen from above) */
function keyboard(o = {}) {
  const b = B(o), W = o.w ?? .44, c = o.color || '#1d1e22';
  if (o.view === 'top') { const H = W * .34; b.box(-W / 2, 0, W / 2, H, c, { r: .01 }); const rs = []; for (let r = 0; r < 5; r++) for (let k = 0; k < 14; k++) rs.push([-W / 2 + .015 + k * (W - .03) / 14 + .002, .012 + r * (H - .024) / 5 + .002, -W / 2 + .015 + (k + 1) * (W - .03) / 14 - .002, .012 + (r + 1) * (H - .024) / 5 - .002]); b.rects(rs, hi(c, .12));
    return b.done({ size: { w: W, h: H }, grips: { left: [-W * .25, H * .5], right: [W * .25, H * .5] } }); }
  b.box(-W / 2, 0, W / 2, .012, face(c, .1)); b.poly([[-W / 2, .012], [W / 2, .012], [W / 2 - .015, .034], [-W / 2 + .015, .034]], c);
  b.lines([[-W / 2 + .02, .019, W / 2 - .02, .019], [-W / 2 + .025, .026, W / 2 - .025, .026]], .003, hi(c, .18));
  return b.done({ size: { w: W, h: .034 }, grips: { left: [-W * .25, .025], right: [W * .25, .025] } });
}
/** a computer mouse (front view) */
function mouse(o = {}) { const b = B(o), c = o.color || '#2a2b30'; b.ell(0, .012, .03, .014, c, { arc: [0, Math.PI] }); b.box(-.03, 0, .03, .012, face(c, .1)); return b.done({ size: { w: .06, h: .026 }, grips: { hand: [0, .02] } }); }
/** a monitor on a stand (sister home office): screen spec (default 'windows'), view back; w */
function monitor(o = {}) {
  const b = B(o), W = o.w ?? .56, H = W * .6, c = o.color || '#151619', lift = .14;
  b.poly([[-.12, 0], [.12, 0], [.1, .014], [-.1, .014]], face(c, -.25)); b.box(-.018, .01, .018, lift + .02, face(c, -.2));
  if (o.view === 'back') { b.box(-W / 2, lift, W / 2, lift + H, face(c, -.15), { r: .008 }); b.box(-W * .2, lift + H * .3, W * .2, lift + H * .7, face(c, -.1), { r: .02 });
    if (o.glow) b.glow(0, lift + H * .8, W * .9, o.glowColor || '#8ea0c8', { opacity: typeof o.glow === 'number' ? o.glow : .28, sy: 1.15 });
    return b.done({ size: { w: W, h: lift + H }, top: { y: lift + H, x0: -W / 2, x1: W / 2, z: b.depth(), front: lift + H, back: lift + H } }); }
  b.box(-W / 2, lift, W / 2, lift + H, c, { r: .008 });
  const m = .014;
  screenOn(b, -W / 2 + m, lift + m * 1.4, W / 2 - m, lift + H - m, o.screen ?? { ui: 'windows' }, 'monitor', 640, Math.round(640 * (H - m * 2.4) / (W - m * 2)), { fps: o.screenFps, t: o.t, glow: o.glow, glowColor: o.glowColor || '#8ea0c8', glowR: 1.3 });
  if (o.detail === 'high') b.circ(W / 2 - .03, lift + .007, .003, '#46e08a', { lit: true });
  return b.done({ size: { w: W, h: lift + H }, points: { screen: [0, lift + H / 2] } });
}
/** a flat TV: on a stand foot (stand: true) or on the wall (origin = its bottom edge); screen spec default news */
function tv(o = {}) {
  const b = B(o), W = o.w ?? 1.1, H = W * .5625 + .03, c = o.color || '#101114', lift = o.stand ? .06 : 0;
  if (o.stand) { b.box(-.22, 0, .22, .015, face(c, -.2)); b.box(-.03, .01, .03, lift + .02, face(c, -.15)); }
  b.box(-W / 2, lift, W / 2, lift + H, c, { r: .008 });
  const m = .015;
  screenOn(b, -W / 2 + m, lift + m * 1.4, W / 2 - m, lift + H - m, o.screen ?? { ui: 'news' }, 'tv', 768, Math.round(768 * (H - m * 2.4) / (W - m * 2)), { fps: o.screenFps, t: o.t, glow: o.glow, glowColor: o.glowColor || '#8ea0c8', glowR: 1.1 });
  return b.done({ size: { w: W, h: lift + H }, points: { screen: [0, lift + H / 2] } });
}
/** an office printer (home office white printer) */
function printer(o = {}) {
  const b = B(o), c = o.color || PAL.white, W = o.w ?? .46, H = .24;
  b.box(-W / 2, 0, W / 2, H * .82, face(c, .06), { r: .012 }); b.poly([[-W / 2, H * .82], [W / 2, H * .82], [W / 2 - .03, H], [-W / 2 + .03, H]], c);
  b.box(-W * .36, H * .42, W * .36, H * .48, '#3a3b40', { r: .004 });
  if (o.paper !== false) { b.box(-W * .25, H * .3, W * .25, H * .46, '#f7f6f1'); b.lines([[-W * .2, H * .38, W * .1, H * .38], [-W * .2, H * .34, W * .15, H * .34]], .004, '#b9bcc2'); }
  b.box(W * .28, H * .6, W * .42, H * .72, '#3a3b40', { r: .005 }); b.circ(W * .38, H * .66, .005, '#46e08a', { lit: true });
  return b.done({ size: { w: W, h: H }, top: { y: H * .92, x0: -W / 2 + .04, x1: W / 2 - .04, z: b.depth(), front: H * .82, back: H }, points: { paper: [0, H * .38] } });
}
/** a camera: dslr (default, lens to the camera) | compact | video (camcorder, side) */
function camera(o = {}) {
  const b = B(o), v = o.variant || 'dslr', c = o.color || '#1f2025';
  if (v === 'video') { b.box(-.1, 0, .08, .09, c, { r: .015 }); b.box(.08, .015, .14, .075, face(c, -.2), { r: .01 }); b.circ(.14, .045, .025, '#0b0c10'); b.circ(.14, .045, .012, '#3a4a6a'); b.box(-.06, .09, .02, .12, face(c, -.15)); b.circ(-.08, .075, .006, '#e0453a', { lit: true });
    return b.done({ size: { w: .24, h: .12 }, grips: { hand: [-.02, .045] } }); }
  const W = v === 'compact' ? .11 : .15, H = v === 'compact' ? .065 : .1;
  if (v === 'dslr') b.box(-W * .2, H, W * .15, H + .02, face(c, -.1), { r: .006 });
  b.box(-W / 2, 0, W / 2, H, c, { r: .012 }); b.box(W * .25, 0, W / 2, H, face(c, -.12), { r: [0, .012, .012, 0] });
  b.circ(-W * .05, H * .48, H * .4, '#0b0c10'); b.circ(-W * .05, H * .48, H * .3, '#2a2c34'); b.circ(-W * .05, H * .48, H * .18, '#16243a'); b.circ(-W * .1, H * .56, H * .06, '#6f86a8');
  b.box(W * .28, H * .78, W * .42, H * .9, '#b8bcc2', { r: .003 });
  return b.done({ size: { w: W, h: H + .02 }, grips: { hand: [W * .38, H * .45], left: [-W * .45, H * .4] }, points: { lens: [-W * .05, H * .48] } });
}
/** a microphone: handheld (default) | stand (on a floor stand) | desk (podcast mic on a small stand) */
function microphone(o = {}) {
  const b = B(o), v = o.variant || 'handheld', c = o.color || '#1b1c20';
  const head = (x, y, r) => { b.circ(x, y, r, '#55585f'); b.lines([[x - r * .7, y - r * .3, x + r * .7, y - r * .3], [x - r * .8, y + r * .15, x + r * .8, y + r * .15], [x - r * .3, y - r * .85, x - r * .3, y + r * .85], [x + r * .3, y - r * .85, x + r * .3, y + r * .85]], r * .09, '#33363c'); b.ell(x - r * .3, y + r * .4, r * .25, r * .15, hi('#55585f', .25)); };
  if (v === 'stand') { const H = o.h ?? 1.45; b.line(-.18, 0, 0, .1, .016, c); b.line(.18, 0, 0, .1, .016, c); b.line(0, .02, 0, .1, .016, c); b.line(0, .1, 0, H - .1, .02, c); b.box(-.018, H - .14, .018, H - .03, c, { r: .008 }); head(0, H, .034);
    return b.done({ size: { w: .36, h: H + .035 }, grips: { hand: [0, H - .2], mic: [0, H] } }); }
  if (v === 'desk') { b.ell(0, .008, .07, .012, face(c, -.1)); b.line(0, .01, 0, .12, .014, c); b.box(-.03, .1, .03, .24, c, { r: .03 }); b.box(-.027, .14, .027, .235, '#55585f', { r: .027 }); b.lines([[-.025, .165, .025, .165], [-.025, .19, .025, .19], [-.025, .215, .025, .215]], .004, '#33363c');
    return b.done({ size: { w: .14, h: .24 }, grips: { hand: [0, .14] } }); }
  b.poly([[-.016, .16], [.016, .16], [.01, 0], [-.01, 0]], c); b.box(-.018, .15, .018, .17, '#44474e');
  head(0, .2, .034);
  return b.done({ size: { w: .07, h: .235 }, grips: { hand: [0, .07] }, points: { mic: [0, .2] } });
}
/** a wifi router (sister living room): white box, two antennas, green dots */
function router(o = {}) {
  const b = B(o), c = o.color || PAL.white;
  b.line(-.08, .04, -.1, .17, .008, face(c, .3)); b.line(.08, .04, .1, .17, .008, face(c, .3));
  b.box(-.11, 0, .11, .045, face(c, .05), { r: .008 }); b.poly([[-.11, .045], [.11, .045], [.1, .055], [-.1, .055]], c);
  b.dots([[-.05, .022, .004], [-.02, .022, .004], [.01, .022, .004]], '#46e08a', { lit: true });
  return b.done({ size: { w: .22, h: .17 } });
}

/** a microchip (iq500 tweezers insert): black square with pins; led: a tiny light that turns on at o.ledAt */
function chip(o = {}) {
  const b = B(o), s = .022, c = o.color || '#16171a';
  const pins = []; for (let i = 0; i < 5; i++) { const t = -s * .4 + i * s * .2; pins.push([t - .0012, -s * .5 - .004, t + .0012, -s * .5], [t - .0012, s * .5, t + .0012, s * .5 + .004], [-s * .5 - .004, t - .0012, -s * .5, t + .0012], [s * .5, t - .0012, s * .5 + .004, t + .0012]); }
  b.rects(pins, '#b8bcc2'); b.box(-s / 2, -s / 2, s / 2, s / 2, c, { r: .001 }); b.circ(-s * .3, s * .3, s * .06, hi(c, .3));
  if (o.led) { const L = b.sub('led', b.depth() + .001); L.circ(s * .25, -s * .25, s * .08, '#46e08a', { lit: true }); L.glow(s * .25, -s * .25, s * 1.2, '#46e08a', { opacity: .5 }); if (o.ledAt != null) { const at = o.ledAt; L.g.visible = false; b.g.userData.update = t => { L.g.visible = t >= at; }; } }
  return b.done({ size: { w: s + .008, h: s + .008 }, centered: true, grips: { pinch: [0, 0] } });
}

export const REG = {
  chip: { tags: ['tech', 'handheld'], desc: 'microchip (black square with pins), ORIGIN = CENTRE; led (green light), ledAt (time it lights)', make: chip },
  phone: { tags: ['handheld', 'tech'], desc: "smartphone 9:19 (.068 x .144). screen: spec | 'text' | fn(ctx,w,h,t) ({ ui: lock | home | call {name, status, timer} | chat {name, msgs:[{text, me}]} | signal | battery {level} | bank {amount} | map | video | notify {title,text} | timer | alarm | text | off | photo }), screenFps, view front | back, detail high (bezel, buttons, top-down lip), lip, glow; grips hand, thumb, ear, top, two", make: phone },
  tablet: { tags: ['handheld', 'tech'], desc: 'tablet (portrait; landscape: true). screen spec (default home), glow, detail; grips hand, left, right', make: tablet },
  laptop: { tags: ['tech', 'office'], desc: "laptop on a surface. view front (screen to camera) | back (lid back) | side; closed; screen spec (default 'windows'), glow; grips left, right", make: laptop },
  keyboard: { tags: ['tech', 'office'], desc: "keyboard on a desk (front view band; view 'top' for top-down); color", make: keyboard },
  mouse: { tags: ['tech', 'office'], desc: 'computer mouse', make: mouse },
  monitor: { tags: ['tech', 'office'], desc: "monitor on a stand (.56 wide). screen spec (default 'windows'; 'lines' = office-night blue screen; code | doc | chart | email | desktop | login), view back, glow (night monitor bloom), w", make: monitor },
  tv: { tags: ['tech', 'home'], desc: "flat TV (1.1 wide). screen spec (default news { headline, tag, ticker }; sport | static | text | off), stand (on a foot; else origin = its bottom edge for the wall), glow, w", make: tv },
  printer: { tags: ['tech', 'office'], desc: 'office printer, white, paper in the tray; paper: false', make: printer },
  camera: { tags: ['handheld', 'tech'], desc: 'camera. variant dslr (lens to the camera) | compact | video (camcorder); grips hand, left', make: camera },
  microphone: { tags: ['handheld', 'tech'], desc: 'microphone. variant handheld | stand (floor stand, h) | desk (podcast mic); grips hand', make: microphone },
  router: { tags: ['tech', 'home'], desc: 'wifi router: white box, two antennas, green LEDs', make: router },
};
