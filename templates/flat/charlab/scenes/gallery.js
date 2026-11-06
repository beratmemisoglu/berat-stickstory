// Character lab: shows this project's main character (character.js) the way videos use it. Claude designs the character
// in character.js; these shots are the element gate for it (check_layout measures every st.* element, render_frames
// looks at it). No narration: times are fixed.
import { shot, VERT, GY, E, seg } from '../engine.js';
import { character, placeOnGround, drive, expr, mixPose, POSES, walkPose, randomLook } from '../models.js';

const cyc = (keys, T) => t => { const u = ((t % T) + T) % T; let i = 0; keys.forEach((k, j) => { if (u >= k[0]) i = j; });
  const a = POSES[keys[Math.max(0, i - 1)][1]], b = POSES[keys[i][1]]; return mixPose(i ? a : b, b, i ? E.inOutCubic(seg(u, keys[i][0], keys[i][0] + .45)) : 1); };

// ---- 1: full body, pose by pose (rest, wave, think, cheer, shrug) ----
shot({ t0: 0, name: 'poses', trans: 'cut',
  build(S) { S.bg('night'); S.ground(0x2a1250); const st = {};
    st.shadow = S.shadow(280, 0, GY); st.hero = character(S.root, { scale: 1.3 }); placeOnGround(st.hero, 0, 1.3); return st; },
  update(st, t) { drive(st.hero, cyc([[0, 'rest'], [.8, 'wave'], [1.6, 'think'], [2.4, 'cheer'], [3.2, 'shrug']], 4), t);
    expr(st.hero, t, [[0, 'open', 'smile', 0], [.8, 'happy', 'grin', .2], [1.6, 'open', 'flat', .5], [2.4, 'happy', 'grin', .1], [3.2, 'open', 'o', -.7]]); } });

// ---- 2: head close-up: every expression and a blink, looking around ----
shot({ t0: 4, name: 'close-up', trans: 'cut',
  build(S) { S.bg('sky'); const st = {}, sc = VERT ? 2.6 : 1.9;      // head centre at y = gy + 523 * sc
    st.hero = character(S.root, { scale: sc }); placeOnGround(st.hero, 0, sc, (VERT ? 150 : -20) - 523 * sc); st.hero.userData.bleed = true; return st; },
  update(st, t) { const u = t - 4; drive(st.hero, () => ({ look: [Math.sin(u * 2) * 10, Math.cos(u * 1.6) * 5], head: Math.sin(u * 1.4) * .05 }), t);
    expr(st.hero, u, [[0, 'open', 'smile', 0], [.6, 'happy', 'grin', .2], [1.2, 'open', 'o', -.8], [1.8, 'half', 'flat', .6], [2.4, 'open', 'frown', -.5]], .3); } });

// ---- 3: walking, then turned the other way (flip) ----
shot({ t0: 7, name: 'walk + flipped', trans: 'cut',
  build(S) { S.bg('sunset'); S.ground(0xd9652b); const st = {};
    st.hero = character(S.root, { scale: 1.15 }); placeOnGround(st.hero, VERT ? -230 : -330, 1.15);
    st.flip = character(S.root, { scale: 1.15, flip: true }); placeOnGround(st.flip, VERT ? 230 : 330, 1.15); return st; },
  update(st, t) { const u = t - 7; drive(st.hero, tt => walkPose((tt - 7) * 1.6, 1), t); drive(st.flip, () => POSES.hipsOut, t);
    expr(st.flip, u, [[0, 'open', 'smile', .3], [1.5, 'happy', 'grin', .2]]); } });

// ---- 4: at phone size among other people: still the one you notice ----
shot({ t0: 10, name: 'phone size', trans: 'cut',
  build(S) { S.bg('mint'); S.ground(0x1fb98a); const st = {}, sc = .62, xs = VERT ? [-300, 0, 300] : [-520, 0, 520];
    st.a = character(S.root, { look: randomLook(17), scale: sc }); placeOnGround(st.a, xs[0], sc);
    st.hero = character(S.root, { scale: sc }); placeOnGround(st.hero, xs[1], sc);
    st.b = character(S.root, { look: randomLook(91), scale: sc, flip: true }); placeOnGround(st.b, xs[2], sc); return st; },
  update(st, t) { drive(st.hero, () => POSES.wave, t); expr(st.hero, t - 10, [[0, 'happy', 'grin', .2]]); } });
