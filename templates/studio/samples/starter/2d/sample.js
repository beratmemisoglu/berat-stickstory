// Starter sample (2D): five shots on the sample narration (audio/timeline.json, ~20 s). Every position comes from the
// engine's layout values (ZONE, BAND, VERT), so the same file works in 16:9 and 9:16.
import { shot, cue, C, VERT, ZONE, BAND, title, text, label, tag, card, counter, rrect, rect, circle, poly, group } from '../engine.js';

const cy = (ZONE.y0 + ZONE.y1) / 2;                       // the middle of the content zone

// ---- 1: every style starts somewhere ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg(); const st = {};
  st.title = title(null, 'Every style\nstarts somewhere', { y: cy + 60, size: VERT ? 110 : 120 }); S.add(st.title, { at: cue('every', .3), in: 'rise' });
  st.rule = rrect(null, VERT ? 520 : 760, 12, 6, C.accent, 0, cy - (VERT ? 160 : 140)); S.add(st.rule, { at: cue('somewhere', 1.4), in: 'grow' });
  return st;
} });

// ---- 2: a frame, a palette, a few shapes ----
shot({ t0: cue('this', 2.2) - .1, build(S) {
  S.bg(); const st = {};
  const fw = VERT ? 860 : 1500, fh = VERT ? 1000 : 640;
  st.frame = group(null, 0, cy);
  for (const [w, h, x, y] of [[fw, 8, 0, fh / 2], [fw, 8, 0, -fh / 2], [8, fh, -fw / 2, 0], [8, fh, fw / 2, 0]]) rect(st.frame, w, h, C.line, x, y);
  st.frame.userData.over = true;                          // a container: what is inside it is meant to be inside it
  S.add(st.frame, { at: cue('frame', 4.3), in: 'fade', dur: .4 });
  st.cap = label(null, 'a plain frame', { y: cy + fh / 2 - 70 }); S.add(st.cap, { at: cue('plain', 3.3), in: 'rise' });
  const r = VERT ? 60 : 70, gap = VERT ? 150 : 180;
  st.swatch = [C.accent, C.accent2, C.good, C.bad, C.ink].map((c, i) => { const s = circle(null, r, c, (i - 2) * gap, cy + (VERT ? 180 : 90)); S.add(s, { at: cue('palette', 5) + i * .08 }); return s; });
  const sy = cy - (VERT ? 200 : 150), sx = VERT ? 260 : 300, k = VERT ? .85 : 1;
  st.shape = [rrect(null, 200 * k, 140 * k, 28, C.accent, -sx, sy), circle(null, 75 * k, C.accent2, 0, sy), poly(null, [[-85 * k, -70 * k], [85 * k, -70 * k], [0, 80 * k]], C.good, sx, sy)];
  st.shape.forEach((s, i) => S.add(s, { at: cue('shapes', 6.9) + i * .06 }));
  return st;
} });

// ---- 3: words land on the beat ----
shot({ t0: cue('words', 7.7) - .1, trans: 'push-left', build(S) {
  S.bg(); const st = {};
  const y = VERT ? cy + 420 : cy + 110;
  st.word = label(null, 'Words', { size: 64, x: VERT ? 0 : -560, y }); S.add(st.word, { at: cue('words', 7.7) });
  st.beat = label(null, 'on the beat', { size: 64, fill: C.accent, x: VERT ? 0 : 460, y: VERT ? cy + 70 : y }); S.add(st.beat, { at: cue('beat', 9.2) });
  st.arrow = VERT ? S.arrow(0, y - 70, 0, cy + 140, 10, C.ink, { at: cue('land', 8), dur: cue('beat', 9.2) - cue('land', 8) })
    : S.arrow(-400, y, 220, y, 10, C.ink, { at: cue('land', 8), dur: cue('beat', 9.2) - cue('land', 8) });
  st.cam = text(null, 'the camera eases in', { size: 48, weight: 600, color: C.muted, y: VERT ? cy - 120 : cy - 80 }); S.add(st.cam, { at: cue('camera', 10.1), in: 'fade' });
  st.clear = tag(null, 'the caption band stays clear', { y: BAND.y1 + 90 }); S.add(st.clear, { at: cue('nothing', 11.8), in: 'rise' });
  return st;
} });

// ---- 4: shapes count, label and point ----
shot({ t0: cue('shapes', 14) - .1, build(S) {
  S.bg('bg2', 'bg'); const st = {};
  st.n = counter(null, { from: 0, to: 128, at: cue('count', 14.8), dur: 1, size: VERT ? 300 : 280, x: VERT ? 0 : -400, y: VERT ? cy + 300 : cy + 40 }); S.add(st.n, { at: cue('count', 14.8) - .1 });
  st.lab = label(null, 'a label', { size: 64, x: VERT ? 0 : 440, y: VERT ? cy - 200 : cy + 170 }); S.add(st.lab, { at: cue('label', 15.2) });
  // the arrow points from the label at the number
  st.pt = VERT ? S.arrow(0, cy - 130, 0, cy + 100, 14, C.accent2, { at: cue('point', 15.9) }) : S.arrow(300, cy + 85, -120, cy + 35, 14, C.accent2, { at: cue('point', 15.9) });
  return st;
} });

// ---- 5: the Studio makes it yours ----
shot({ t0: cue('then', 16.6) - .1, build(S) {
  S.bg(); const st = {};
  st.card = card(null, { w: VERT ? 820 : 900, h: 380, y: cy + 60, title: 'Your style', body: 'Palette, type, elements and motion, reshaped in the Studio.' }); S.add(st.card, { at: cue('studio', 17.4), in: 'rise' });
  st.tag = tag(null, 'yours', { size: 48, y: cy - 230 }); S.add(st.tag, { at: cue('yours', 18.5) });
  return st;
} });
