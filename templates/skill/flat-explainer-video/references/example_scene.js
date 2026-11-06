// Example scene file (scenes/s01_intro.js). Copy patterns, not content. Runs in the smoke test, so it stays correct.
// Narration (example): "Your brain runs on tiny messengers. ... When you finish something, they flood in."
import { shot, cue, C, GY, title, tag, ring, dopa, tint, seg, E, lerp } from '../engine.js';
import { character, placeOnGround, drive, expr, mixPose, POSES, badge } from '../models.js';

// ---- 1: the brain and its messengers ----
// layout: brain badge at (0, 260) r 190; label under it at y -10; content zone only (y > -420)
shot({ t0: 0, build(S) {
  S.bg('night');
  const st = {};
  // the messengers are built BEFORE the brain: they come from behind it, never pop on top of it
  st.dots = []; for (let i = 0; i < 8; i++) { const d = dopa(S.root, 22); d.userData.a = i / 8 * Math.PI * 2; st.dots.push(d); }
  st.brain = badge(S.root, 'brain', { r: 190, scaleIcon: 2.1, y: 260, ringCol: C.yellow });
  S.add(st.brain, { at: cue('brain', .4) });
  st.label = tag(S.root, 'Messengers', { fill: C.yellow, size: 56, y: -10 });
  S.add(st.label, { at: cue('messengers', 1.2), in: 'wipe' });
  st.label.userData.over = [st.brain];                 // sits just under the badge on purpose
  return st;
}, update(st, t) {
  const t1 = cue('messengers', 1.2);
  st.dots.forEach((d, i) => {                          // out from behind the brain, then a seamless orbit (periodic, no %)
    const k = E.outCubic(seg(t, t1 + i * .04, t1 + .5 + i * .04)), a = d.userData.a + t * .6;
    d.visible = k > 0; d.position.set(Math.cos(a) * 290 * k, 260 + Math.sin(a) * 290 * k, 0);
  });
} });

// ---- 2: Mo finishes something and the messengers flood in ----
shot({ t0: 3, build(S) {
  S.bg('sky'); S.ground('#1f6fd8');
  const st = {};
  st.sh = S.shadow(300, 0);
  st.glow = ring(S.root, 230, 14, tint('#2aa8ff', .25), 0, 0); st.glow.visible = false;   // opaque lighter tint, not a fade
  st.mo = character(S.root, { scale: 1.1 }); placeOnGround(st.mo, 0, 1.1);
  st.glow.userData.over = [st.mo];                     // the halo sits behind Mo's head on purpose
  st.title = title(S.root, 'Done!', { y: 720, size: 110 });   // centred, safe from the top edge
  S.add(st.title, { at: cue('finish', 3.6), in: 'pop' });
  S.burst(0, 330, { at: cue('flood', 4.4), r0: 220, r1: 520 });
  return st;
}, update(st, t) {
  const tf = cue('finish', 3.6);
  // the cheer is a weighted blend inside drive(): drag, bun follow-through and breathing come for free
  drive(st.mo, tt => mixPose(POSES.rest, POSES.cheer, E.outBack(seg(tt, tf, tf + .3), 1.6)), t);
  expr(st.mo, t, [[0, 'open', 'smile', 0], [tf, 'happy', 'grin', 0]], .7);
  const g = seg(t, tf + .1, tf + .45); st.glow.visible = g > 0; st.glow.position.y = 330; st.glow.scale.setScalar(lerp(.6, 1.15, E.outCubic(g)));
} });
