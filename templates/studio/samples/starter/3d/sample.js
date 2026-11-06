// Starter sample (3D): five shots on the sample narration (audio/timeline.json, ~20 s). Metres, y up, the ground at
// y = 0; text, labels and cards sit on the HUD (pixels) over the 3D picture. Works in 16:9 and 9:16 (VERT).
import { shot, cue, C, VERT, TITLE, box, sphere, cyl, title, text, label, tag, card, counter } from '../engine.js';
import { table } from '../models.js';

const k = VERT ? .7 : 1, sx = VERT ? .95 : 1.5, back = VERT ? 1.35 : 1;   // narrower spacing and a step back in 9:16

// ---- 1: every style starts somewhere ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg(); S.ground(); const st = {};
  st.box = box(null, k, k, k, C.accent, { x: -sx, ry: .4 }); S.add(st.box, { at: cue('style', .7), in: 'drop', dur: .5 });
  st.ball = sphere(null, .5 * k, C.accent2); S.add(st.ball, { at: cue('starts', 1.1), in: 'drop', dur: .5 });
  st.can = cyl(null, .42 * k, 1.2 * k, C.good, { x: sx }); S.add(st.can, { at: cue('somewhere', 1.4), in: 'drop', dur: .5 });
  st.title = title(null, 'Every style\nstarts somewhere', { size: VERT ? 100 : 110 }); S.add(st.title, { at: cue('every', .3), in: 'rise' });
  return st;
} });

// ---- 2: a frame, a palette, a few shapes ----
shot({ t0: cue('this', 2.2) - .1, build(S) {
  S.bg(); S.ground(); S.view(VERT ? [1.2, 2.6, 7.6] : [2.6, 2.1, 4.6], [0, .6, 0]); const st = {};   // (9:16: more frontal, further back)
  st.table = table(null, { w: 1.6, d: .9 }); S.add(st.table, { at: cue('frame', 4.3), in: 'grow' });
  st.dot = [C.accent, C.accent2, C.good, C.bad, C.ink].map((c, i) => { const s = sphere(null, .1, c, { x: (i - 2) * .28, y: .75 }); S.add(s, { at: cue('palette', 5) + i * .08 }); return s; });
  // (the tall frame is narrower: the shapes come in, in front of the table)
  st.shape = [box(null, .4, .4, .4, C.accent, VERT ? { x: -.6, z: 1.3, ry: .5 } : { x: -1.5, z: .6, ry: .5 }), cyl(null, .2, .5, C.good, VERT ? { x: .9, z: .95 } : { x: 1.5, z: .5 }),
    sphere(null, .22, C.accent2, VERT ? { x: .6, z: 1.65 } : { x: 1.1, z: 1.2 })];
  st.shape.forEach((s, i) => S.add(s, { at: cue('shapes', 6.9) + i * .06 }));
  st.cap = label(null, 'a plain frame', { size: 48, y: TITLE.y }); S.add(st.cap, { at: cue('plain', 3.3), in: 'rise' });
  return st;
} });

// ---- 3: words land on the beat, the camera eases in ----
shot({ t0: cue('words', 7.7) - .1, trans: 'push-left', build(S) {
  S.bg(); S.ground(); const st = {}, t0 = cue('words', 7.7) - .1;
  S.move([{ t: t0, pos: [-3.5 * back, 2.3, 6.5 * back], look: [0, .7, 0] }, { t: t0 + 4.5, pos: [3.5 * back, 2, 6.5 * back], look: [0, .7, 0] }]);
  st.step = ['land', 'on', 'beat'].map((w, i) => { const b = box(null, .8 * k, .8 * k, .8 * k, [C.accent, C.accent2, C.good][i], { x: (i - 1) * 1.2 * k });
    S.add(b, { at: cue(w, 8 + i * .5), in: 'drop', dur: .5 }); return b; });
  st.word = label(null, 'on the beat', { size: 56, fill: C.accent, y: TITLE.y }); S.add(st.word, { at: cue('beat', 9.2) });
  st.cam = text(null, 'the camera eases in', { size: 48, weight: 600, color: C.muted, y: TITLE.y - 100 }); S.add(st.cam, { at: cue('camera', 10.1), in: 'fade' });
  st.clear = tag(null, 'the caption band stays clear', { y: TITLE.y - 190 }); S.add(st.clear, { at: cue('nothing', 11.8), in: 'rise' });
  return st;
} });

// ---- 4: shapes count, label and point ----
shot({ t0: cue('shapes', 14) - .1, build(S) {
  S.bg('bg2', 'bg'); S.ground(); S.view([0, 2.4, 7 * back], [0, .9, 0]); const st = {};
  st.stack = [[1.2, C.accent], [.9, C.accent2], [.6, C.good]].map(([s, c], i) => { const b = box(null, s, .5, s, c, { y: i * .5, ry: i * .25 }); S.add(b, { at: cue('shapes', 14) + i * .15, in: 'drop', dur: .45 }); return b; });
  st.n = counter(null, { from: 0, to: 128, at: cue('count', 14.8), dur: 1, size: 120, y: TITLE.y }); S.add(st.n, { at: cue('count', 14.8) - .1 });
  const [px, py] = S.toScreen([.3, 1.5, 0]);                 // the top of the stack, on screen
  st.lab = label(null, 'a label', { size: 48, x: px + (VERT ? 160 : 330), y: py + 120 }); S.add(st.lab, { at: cue('label', 15.2) });
  st.pt = S.arrow(px + (VERT ? 110 : 230), py + 90, px + 30, py + 10, 10, C.accent2, { at: cue('point', 15.9) });
  return st;
} });

// ---- 5: the Studio makes it yours ----
shot({ t0: cue('then', 16.6) - .1, build(S) {
  S.bg(); S.ground(); S.view([0, 2.2, 7.5 * back], [0, .8, 0]); const st = {};
  st.pillar = [-1, 1].map(s => cyl(null, .3, 1.6, C.line, { x: s * 1.6 * k }));
  st.plinth = box(null, .8, .8, .8, C.surface);
  st.gem = sphere(null, .3, C.brand, { y: .8 }); S.add(st.gem, { at: cue('yours', 18.5), in: 'drop', dur: .5 });
  st.card = card(null, { w: VERT ? 860 : 900, h: 230, x: VERT ? 0 : -330, y: VERT ? TITLE.y - 20 : TITLE.y - 20, title: 'Your style', body: 'Palette, type, elements and motion, reshaped in the Studio.' }); S.add(st.card, { at: cue('studio', 17.4), in: 'rise' });
  st.tag = tag(null, 'yours', { size: 48, x: VERT ? 0 : 560, y: VERT ? TITLE.y - 220 : TITLE.y - 20 }); S.add(st.tag, { at: cue('yours', 18.5) });
  return st;
} });
