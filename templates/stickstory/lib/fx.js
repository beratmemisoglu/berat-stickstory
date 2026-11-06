// Stick stories - EFFECTS. Every effect measured on the references (experiments/stickstory-style/analysis/fx/NOTES.md):
// flat shapes + additive glow, short and restrained, sizes in reference pixels at 1080 (a field's specks stay "9 px"
// whatever the framing). Everything is a pure function of the absolute video time t (seeded tables, no state), so a
// still at t equals the export's frame at t.
//
//   S.fx(kind, { at, until | dur, area: [x0, y0, x1, y1] | around: obj, from / to (point | actor | object), z, density,
//                color, seed, ... })  -> an Object3D (it animates itself through userData.update(t, S))
//   S.impact(at, where, o)  S.freeze({ at, until, from })  S.skill(A, B, { at, dur })   (shorthands, S_HELPERS)
//
// Points: [x, y, z] | Vector3 | actor (chest; { actor, part: 'head'|'hand'|'chest', side }) | Object3D (its box centre)
// | (t) => [x, y, z]. Times are absolute seconds (S.at('word') gives a word's time). Defaults: at = shot start,
// until = shot end. Fields (dust, rain, snow, confetti, bokeh, streaks...) fill the camera's view at 3 depths unless
// given an area; they stay put in the world when the camera pans, and they stop while a `freeze` holds time.
import { THREE, FPS, E, clamp, lerp, seg, rnd, hash, noise1, poly, text } from './core.js';
import { Layer, Ribbons, beam, rgb, viewAt } from './fx/gpu.js';

const F = 1 / FPS, TAU = Math.PI * 2, PX = 1 / 1080, DEG = Math.PI / 180;
export const KINDS = {}, DOCS = {};

// ---------------------------------------------------------------- helpers
const root = (kind, upd) => { const g = new THREE.Group(); g.name = 'fx:' + kind; g.userData.fx = kind; g.userData.noPick = true; if (upd) g.userData.update = upd; return g; };
/** [at, until] of an effect */
function span(S, o, d = {}) {
  const at = o.at ?? d.at ?? S.t0 ?? 0;
  const until = o.until ?? (o.dur != null ? at + o.dur : d.dur != null ? at + d.dur : (S.t1 ?? at + 4));
  return [at, Math.max(at, until)];
}
/** fade in after `at`, fade out before `until` */
const env = (t, at, until, fin = .3, fout = .4) => t < at || t > until ? 0 : Math.min(fin > 0 ? clamp((t - at) / fin) : 1, fout > 0 ? clamp((until - t) / fout) : 1);
/** the clock of fields: frozen while a `freeze` holds time (unless o.free) */
const clk = (S, t, o) => (!o.free && S._fxFreeze) ? S._fxFreeze.time(t) : t;
const table = (n, seed, k = 6) => { const r = rnd(seed), a = new Float32Array(n * k); for (let i = 0; i < a.length; i++) a[i] = r(); return a; };
const pick = (arr, x) => arr[Math.min(arr.length - 1, Math.floor(x * arr.length))];
const fract = x => x - Math.floor(x);
const _b = new THREE.Box3(), _v = new THREE.Vector3();
/** a world point at time t (see the header) */
export function pointOf(S, p, t, o = {}) {
  if (p == null) return null;
  if (typeof p === 'function') return pointOf(S, p(t), t, o);
  if (Array.isArray(p)) return new THREE.Vector3(p[0], p[1] ?? 1, p[2] ?? 0);
  if (p.isVector3) return p.clone();
  if (p.actor) return pointOf(S, p.actor, t, p);
  if (p.isActor || (p.head && p.root)) {
    const part = o.part || 'chest';
    if (part === 'head') return p.head();
    if (part.startsWith('hand')) return p.handPos(o.side || (part === 'handL' ? 'L' : 'R'));
    return p.head().add(new THREE.Vector3(0, -(p.headR ?? .16) * 2.6, .02));
  }
  if (p.isObject3D) { p.updateMatrixWorld(true); _b.setFromObject(p); return _b.isEmpty() ? p.getWorldPosition(new THREE.Vector3()) : _b.getCenter(new THREE.Vector3()); }
  if (typeof p === 'object' && 'x' in p) return new THREE.Vector3(p.x, p.y ?? 1, p.z ?? 0);
  return null;
}
/** a fixed area or one around an object: { rect: [x0, y0, x1, y1], z } or null (= the camera's view) */
function areaOf(o) {
  if (Array.isArray(o.area)) return { rect: o.area, z: o.area[4] ?? o.z ?? 0 };
  if (o.around?.isObject3D || o.around?.root) { const ob = o.around.root || o.around; ob.updateMatrixWorld(true); _b.setFromObject(ob); if (_b.isEmpty()) return null;
    const pw = (_b.max.x - _b.min.x) * (o.pad ?? 0), ph = (_b.max.y - _b.min.y) * (o.pad ?? 0);
    return { rect: [_b.min.x - pw, _b.min.y - ph, _b.max.x + pw, _b.max.y + ph], z: o.z ?? (_b.max.z + .03) }; }
  return null;
}
/** the grade hook: effects add flash / tint / desaturation on top of the shot's own S.grade (composes, never replaces) */
function gradeHook(S, fn) {
  if (!S._fxHooks) {
    S._fxHooks = []; let base = S._grade;
    S.grade = g => { base = g; };
    S._grade = t => { const g = typeof base === 'function' ? { ...(base(t) || {}) } : { ...(base || {}) }; for (const h of S._fxHooks) h(t, g); return g; };
  }
  S._fxHooks.push(fn);
}
const mulTint = (g, tn) => { const a = g.tint || [1, 1, 1]; g.tint = [a[0] * tn[0], a[1] * tn[1], a[2] * tn[2]]; };
const sfx = (S, o, type, t, gain = 0) => { if (o.sound !== false && S.sfx) S.sfx(type, t, { gain }); };
/** layers that fill the view at depths (or an area at z) */
function fieldLayers(S, g, o, specs) {
  const A = areaOf(o);
  return specs.map(sp => {
    const L = new Layer(S, Math.max(1, Math.round(sp.n)), { shape: sp.shape, blend: sp.blend, mode: 'field', area: A?.rect || null, depth: A ? null : sp.depth, base: o.z, size: 'screen', order: sp.order ?? (sp.depth < 1 ? 40 : 22), margin: sp.margin });
    if (A) L.z = A.z + (sp.dz ?? 0);
    L.spec = sp; L.tab = table(L.n, (o.seed ?? 1) * 977 + (sp.salt ?? 0) * 131 + 7, sp.k ?? 8); g.add(L.mesh); return L;
  });
}
/** re-read a moving `around` object's area each frame */
function followArea(o, layers) { if (!o.around || Array.isArray(o.area)) return; const A = areaOf(o); if (A) for (const L of layers) { L.area = A.rect; L.z = A.z + (L.spec.dz ?? 0); } }
/** a world-mode layer (bursts): positions in 'screen' units (frame heights) or 'm', from an origin */
function burstLayer(S, g, n, o) { const L = new Layer(S, n, { mode: 'world', pos: o.pos ?? 'screen', size: o.size ?? 'screen', shape: o.shape, blend: o.blend, order: o.order ?? 45, depthTest: o.depthTest }); g.add(L.mesh); return L; }
const place = (L, p, dz = .03) => { L.origin = [p.x, p.y]; L.z = p.z + dz; };

// ================================================================ FIELDS (screen-filling, 3 depths)
DOCS.dust = 'floating dust specks (the timeloop motes): 40-60 soft cream dots 3-14 px drifting slowly, some big and blurred. { density, color, area | around, z }';
KINDS.dust = (S, o = {}) => {
  const [at, until] = span(S, o), d = o.density ?? 1, col = rgb(o.color || '#fff2d8');
  const g = root('dust');
  const Ls = fieldLayers(S, g, o, [
    { n: 24 * d, depth: 1.22, dz: -.4, shape: 'disc', d: [3.5, 7], a: .6, salt: 1 },
    { n: 20 * d, depth: 1.06, dz: 0, shape: 'disc', d: [7, 13], a: .55, salt: 2 },
    { n: 7 * d, depth: .62, dz: .5, shape: 'soft', d: [22, 38], a: .2, salt: 3 }]);
  g.userData.update = (t, S) => {
    followArea(o, Ls);
    const e = env(t, at, until, o.fadeIn ?? .4, o.fadeOut ?? .5) * (o.opacity ?? 1), tc = clk(S, t, o);
    for (const L of Ls) { const T = L.tab, sp = L.spec, asp = L.aspect;
      for (let i = 0; i < L.n; i++) { const r = k => T[i * 8 + k];
        if (e <= 0) { L.hide(i); continue; }
        const dia = lerp(sp.d[0], sp.d[1], r(2)) * PX * (o.scale ?? 1);
        const u = r(0) + (r(3) - .5) * .012 * tc / asp + .004 * Math.sin(tc * (.3 + r(4) * .4) + r(5) * TAU) / asp;
        const v = r(1) + (.002 + r(6) * .006) * tc + .003 * Math.sin(tc * (.25 + r(7) * .35) + r(4) * TAU);
        L.set(i, u, v, 0, sp.a * e * (.55 + .45 * r(5)), dia, dia, sp.shape === 'disc' ? .35 : 0, col);
      }
      L.commit(); }
  };
  return g;
};

DOCS.rain = 'rain: straight streaks 1.5-2 px x 40-90 px leaning `angle` deg (12; storm 22), fast, 3 depths (far thin/faint, near thick). { density, angle, speed, color, area | around, z, opacity }';
KINDS.rain = (S, o = {}) => {
  const [at, until] = span(S, o), d = o.density ?? 1, col = rgb(o.color || '#dfe6ef'), ang = (o.angle ?? 12) * DEG, sp0 = o.speed ?? 1;
  const g = root('rain');
  const Ls = fieldLayers(S, g, o, [
    { n: 120 * d, depth: 1.35, dz: -.6, shape: 'streak', blend: 'normal', len: [26, 44], w: 1.2, a: .2, v: 1.7, salt: 1 },
    { n: 90 * d, depth: 1.06, dz: 0, shape: 'streak', blend: 'normal', len: [45, 82], w: 1.9, a: .33, v: 2.3, salt: 2 },
    { n: 24 * d, depth: .55, dz: .6, shape: 'streak', blend: 'normal', len: [95, 150], w: 3.2, a: .2, v: 3.1, salt: 3 }]);
  const dx = Math.sin(ang), dy = -Math.cos(ang), rot = Math.atan2(dy, dx);
  g.userData.update = (t, S) => {
    followArea(o, Ls);
    const e = env(t, at, until, o.fadeIn ?? .25, o.fadeOut ?? .3) * (o.opacity ?? 1), tc = clk(S, t, o), frozen = !o.free && !!S._fxFreeze?.frozen(t);
    for (const L of Ls) { const T = L.tab, sp = L.spec, asp = L.aspect;
      for (let i = 0; i < L.n; i++) { const r = k => T[i * 8 + k];
        if (e <= 0) { L.hide(i); continue; }
        const v = sp.v * sp0 * (.85 + .3 * r(2)), s = tc * v;
        const len = lerp(sp.len[0], sp.len[1], r(3)) * PX * (frozen ? .55 : 1);
        L.set(i, r(0) + dx * s / asp, r(1) + dy * s, rot, sp.a * e * (.7 + .3 * r(4)), len, sp.w * PX, 0, col);
      }
      L.commit(); }
  };
  return g;
};

DOCS.drops = 'rain on a window (timeloop f6545): ~80 round drops 14-46 px (slate-blue body, dark lower edge, a white highlight top-left), a few sliding down leaving a soft trail; pair with bokeh behind. { area | around (the glass), density, scale, color, z }';
KINDS.drops = (S, o = {}) => {
  const [at, until] = span(S, o), d = o.density ?? 1, g = root('drops');
  const n = Math.round(66 * d), m = Math.round(12 * d);
  const [Lt, Ls, Lb, Lh] = fieldLayers(S, g, o, [
    { n: m, depth: .7, dz: -.003, shape: 'rect', blend: 'normal', salt: 2 },
    { n: n + m, depth: .7, dz: -.001, shape: 'disc', blend: 'normal', salt: 1 },
    { n: n + m, depth: .7, dz: 0, shape: 'disc', blend: 'normal', salt: 1 },
    { n: n + m, depth: .7, dz: .001, shape: 'disc', blend: 'normal', salt: 1 }]);
  const cB = rgb(o.color || '#66749a'), cS = rgb(o.shadow || '#070a18'), cH = rgb('#dfe6f4'), cT = rgb(o.trail || '#6a78a2');
  g.userData.update = (t, S) => {
    followArea(o, [Lt, Ls, Lb, Lh]);
    const e = env(t, at, until, .3, .3) * (o.opacity ?? 1), tc = clk(S, t, o), T = Lb.tab;
    for (let i = 0; i < n + m; i++) { const r = k => T[i * 8 + k];
      if (e <= 0) { Lb.hide(i); Ls.hide(i); Lh.hide(i); if (i >= n) Lt.hide(i - n); continue; }
      const dia = lerp(14, 46, r(2) ** 2.2) * PX * (o.scale ?? 1); let v = r(1);
      if (i >= n) { const sp = .03 + r(5) * .05; v = r(1) - tc * sp; const tl = (60 + 240 * r(3)) * PX;   // sliding drops leave a soft trail
        Lt.set(i - n, r(0), v, 0, .32 * e, dia * .32, tl, .3, cT, 0, 0, tl / 2); }
      Ls.set(i, r(0), v, 0, .45 * e, dia, dia * 1.06, .08, cS, 0, dia * .06, -dia * .1);       // the drop's dark lower edge
      Lb.set(i, r(0), v, 0, .92 * e, dia, dia * 1.06, .06, cB);
      Lh.set(i, r(0), v, 0, .9 * e, dia * .24, dia * .24, .1, cH, 0, -dia * .22, dia * .2);
    }
    Lt.commit(); Ls.commit(); Lb.commit(); Lh.commit();
  };
  return g;
};

DOCS.snow = 'snow: soft white flakes 2-24 px falling slowly with a sway, 3 depths. { density, speed, wind, color, area | around, z }';
KINDS.snow = (S, o = {}) => {
  const [at, until] = span(S, o), d = o.density ?? 1, col = rgb(o.color || '#f4f6fa'), sp0 = o.speed ?? 1, wind = o.wind ?? 0;
  const g = root('snow');
  const Ls = fieldLayers(S, g, o, [
    { n: 80 * d, depth: 1.35, dz: -.6, shape: 'disc', blend: 'normal', d: [2, 4], a: .6, v: .07, salt: 1 },
    { n: 50 * d, depth: 1.06, dz: 0, shape: 'disc', blend: 'normal', d: [4, 8], a: .85, v: .11, salt: 2 },
    { n: 12 * d, depth: .55, dz: .6, shape: 'soft', blend: 'normal', d: [14, 26], a: .55, v: .17, salt: 3 }]);
  g.userData.update = (t, S) => {
    followArea(o, Ls);
    const e = env(t, at, until, .5, .5) * (o.opacity ?? 1), tc = clk(S, t, o);
    for (const L of Ls) { const T = L.tab, sp = L.spec, asp = L.aspect;
      for (let i = 0; i < L.n; i++) { const r = k => T[i * 8 + k];
        if (e <= 0) { L.hide(i); continue; }
        const dia = lerp(sp.d[0], sp.d[1], r(2)) * PX, v = sp.v * sp0 * (.8 + .4 * r(3));
        const u = r(0) + (wind * v * tc + .012 * Math.sin(tc * (.7 + r(4) * .8) + r(5) * TAU)) / asp;
        L.set(i, u, r(1) - v * tc, 0, sp.a * e, dia, dia, sp.shape === 'disc' ? .3 : 0, col);
      }
      L.commit(); }
  };
  return g;
};

const CONFETTI = ['#d74145', '#dbbf67', '#f2efe6', '#6c9ec9', '#4d8b72'];
DOCS.confetti = 'confetti: 9 x 4 px paper rects (red, yellow, white, light blue, green) drifting down, spinning and fluttering; { from: point } = a burst that pops up and flutters down. { density, colors, area | around, from, z }';
KINDS.confetti = (S, o = {}) => {
  const [at, until] = span(S, o), d = o.density ?? 1, cols = (o.colors || CONFETTI).map(rgb), g = root('confetti');
  if (o.from) {   // a popper / a throw: up, drag, flutter down
    const n = Math.round(90 * d), L = burstLayer(S, g, n, { shape: 'rect', blend: 'normal' }), T = table(n, (o.seed ?? 3) * 31, 10);
    const spread = (o.spread ?? 70) * DEG, up = (o.dir ?? 90) * DEG;
    g.userData.update = (t, S) => {
      const p = pointOf(S, o.from, t); if (p) place(L, p, .1);
      const e = env(t, at, until, 0, .6), tc = clk(S, t, o);
      for (let i = 0; i < n; i++) { const r = k => T[i * 10 + k], tau = tc - at - r(9) * 3 * F;
        if (tau < 0 || e <= 0) { L.hide(i); continue; }
        const th = up + (r(0) - .5) * spread, sp = (.5 + .7 * r(1)) * (o.power ?? 1), kd = 2.4, gr = .28;
        const ex = (1 - Math.exp(-kd * tau)) / kd, x = Math.cos(th) * sp * ex + .015 * Math.sin(tau * (3 + 2 * r(2)) + r(3) * TAU);
        const y = (Math.sin(th) * sp + gr / kd) * ex - gr * tau / kd;
        const fl = Math.max(.18, Math.abs(Math.cos(tau * (6 + 6 * r(4)) + r(5) * TAU)));
        L.set(i, x, y, r(6) * TAU + (r(7) - .5) * 8 * tau, e, lerp(10, 15, r(8)) * PX, 6 * PX * fl, 0, pick(cols, r(2)));
      }
      L.commit();
    };
    sfx(S, o, 'pop', at, -6);
    return g;
  }
  const Ls = fieldLayers(S, g, o, [
    { n: 200 * d, depth: 1.08, dz: 0, shape: 'rect', blend: 'normal', s: 1, salt: 1, k: 10 },
    { n: 18 * d, depth: .6, dz: .6, shape: 'rect', blend: 'normal', s: 1.8, soft: .18, salt: 2, k: 10 }]);
  g.userData.update = (t, S) => {
    followArea(o, Ls);
    const e = env(t, at, until, .3, .5) * (o.opacity ?? 1), tc = clk(S, t, o);
    for (const L of Ls) { const T = L.tab, sp = L.spec, asp = L.aspect;
      for (let i = 0; i < L.n; i++) { const r = k => T[i * 10 + k];
        if (e <= 0) { L.hide(i); continue; }
        const fall = (.014 + .05 * r(2)) * (o.speed ?? 1), u = r(0) + (.004 * tc * (r(3) - .5) + .018 * Math.sin(tc * (1.1 + r(4)) + r(5) * TAU)) / asp;
        const fl = Math.max(.15, Math.abs(Math.cos(tc * (6.3 + 6.3 * r(6)) + r(7) * TAU)));
        const w = (r(8) < .25 ? 8 : 12.5) * PX * sp.s, h = (r(8) < .25 ? 8 : 6) * PX * sp.s * fl;
        L.set(i, u, r(1) - fall * tc, r(9) * TAU + (r(3) - .5) * 4 * tc, e, w, h, sp.soft ?? 0, pick(cols, r(4)));
      }
      L.commit(); }
  };
  return g;
};

DOCS.bokeh = 'bokeh: soft out-of-focus light discs 35-90 px (warm / cool) for close-up backgrounds, nearly still. { density, colors, area | around, z, opacity }';
KINDS.bokeh = (S, o = {}) => {
  const [at, until] = span(S, o), d = o.density ?? 1, cols = (o.colors || ['#e8c890', '#f2dcb0', '#c9a868', '#9fb8e0']).map(rgb), g = root('bokeh');
  const [L] = fieldLayers(S, g, o, [{ n: 32 * d, depth: 1.7, dz: -.2, shape: 'disc', salt: 1, order: 14 }]);
  g.userData.update = (t, S) => {
    followArea(o, [L]);
    const e = env(t, at, until, .4, .4) * (o.opacity ?? 1), tc = clk(S, t, o), T = L.tab;
    for (let i = 0; i < L.n; i++) { const r = k => T[i * 8 + k];
      if (e <= 0) { L.hide(i); continue; }
      const dia = lerp(40, 120, r(2)) * PX * (o.scale ?? 1), pulse = .85 + .15 * Math.sin(tc * (.4 + r(3) * .5) + r(4) * TAU);
      L.set(i, r(0) + .003 * tc * (r(5) - .5), r(1) + .002 * tc * (r(6) - .5), 0, (.22 + .3 * r(7)) * pulse * e, dia, dia, .42, pick(cols, r(5)));
    }
    L.commit();
  };
  return g;
};

DOCS.streaks = 'moving dashes: thin lines racing in `dir` (deg, 180 = to the left, -90 = down) wrapped in the view or an area. { dir, speed (frame heights / s, 3.5), len: [min, max] px, width px, count, density, color, alpha, add, glints, area | around, z }';
KINDS.streaks = (S, o = {}) => {
  const [at, until] = span(S, o), d = o.density ?? 1, col = rgb(o.color || '#f2f4f8'), dir = (o.dir ?? 180) * DEG, g = root(o._kind || 'streaks');
  const len = o.len || [60, 150], wpx = o.width ?? 2, n = (o.count ?? 14) * d;
  const [L] = fieldLayers(S, g, o, [{ n, depth: o.depth ?? 1.05, dz: 0, shape: 'streak', blend: o.add ? 'add' : 'normal', salt: 1 }]);
  const glint = o.glints ? fieldLayers(S, g, o, [{ n: o.glints, depth: o.depth ?? 1.05, dz: .01, shape: 'star', salt: 5 }])[0] : null;
  const dx = Math.cos(dir), dy = Math.sin(dir);
  g.userData.update = (t, S) => {
    followArea(o, glint ? [L, glint] : [L]);
    const e = env(t, at, until, .15, .25) * (o.opacity ?? 1), tc = clk(S, t, o), T = L.tab, asp = L.aspect;
    for (let i = 0; i < L.n; i++) { const r = k => T[i * 8 + k];
      if (e <= 0) { L.hide(i); continue; }
      const s = tc * (o.speed ?? 3.5) * (.75 + .5 * r(2));
      L.set(i, r(0) + dx * s / asp, r(1) + dy * s, dir, (o.alpha ?? .45) * e * (.6 + .4 * r(3)), lerp(len[0], len[1], r(4)) * PX, wpx * PX, 0, col);
    }
    L.commit();
    if (glint) { const G = glint.tab; for (let i = 0; i < glint.n; i++) { const r = k => G[i * 8 + k], ph = fract(tc * (1.2 + r(2)) + r(3));
      const s = tc * (o.speed ?? 3.5) * .8; glint.set(i, r(0) + dx * s / asp, r(1) + dy * s, 0, e * Math.sin(Math.PI * ph) ** 3, 22 * PX, 22 * PX, 0, col); } glint.commit(); }
  };
  return g;
};
DOCS.speedLines = 'speed lines: thin white dashes 60-150 px racing past (a cockpit / car window, a fast move). Same options as streaks.';
KINDS.speedLines = (S, o = {}) => KINDS.streaks(S, { _kind: 'speedLines', ...o });
DOCS.shower = 'a gold shower (sister f11600): 230 gold streaks with twinkling heads fanning down from a source (money / value pouring back). { at, until, from (source point; default: above the top-left of the view, offset [-.4, .56] frame heights from its centre), dir (deg, -52), spread (deg, 62), speed, count, color, opacity }';
KINDS.shower = (S, o = {}) => {
  const [at, until] = span(S, o), g = root('shower'), n = o.count ?? 230, col = rgb(o.color || '#e8c070'), hot = rgb('#fff3cf'), T = table(n, (o.seed ?? 31) * 7, 8);
  const L = burstLayer(S, g, n, { shape: 'streak', order: 43 }), Hd = burstLayer(S, g, n, { shape: 'dot', order: 44 });
  if (!o.from) for (const X of [L, Hd]) { X.originView = true; X.o.depth = o.depth ?? .85; X.o.base = o.z; X.viewOffset = o.offset || [-.4, .56]; }
  const dir = (o.dir ?? -52) * DEG, spread = (o.spread ?? 62) * DEG;
  g.userData.update = (t, S) => {
    if (o.from) { const p = pointOf(S, o.from, t); if (p) { place(L, p, .02); place(Hd, p, .03); } }
    const e = env(t, at, until, .2, .5) * (o.opacity ?? 1), tc = clk(S, t, o);
    for (let i = 0; i < n; i++) { const r = k => T[i * 8 + k], per = 1.1 + r(0) * 1.2, age = fract((tc - at) / per + r(1)) * per;
      if (e <= 0 || tc - at < age) { L.hide(i); Hd.hide(i); continue; }
      const th = dir + (r(2) - .5) * spread, sp = (.45 + .65 * r(3)) * (o.speed ?? 1), dist = sp * age, len = Math.min(dist, (90 + 180 * r(4)) * PX);
      const hx = Math.cos(th) * dist, hy = Math.sin(th) * dist, a = e * (1 - age / per) ** .6 * (.55 + .45 * r(5));
      L.set(i, hx - Math.cos(th) * len / 2, hy - Math.sin(th) * len / 2, th, .8 * a, len, 2.2 * PX, 0, col);
      const tw = .6 + .4 * Math.sin(tc * 20 + r(6) * TAU); Hd.set(i, hx, hy, 0, a * tw, 9 * PX, 9 * PX, .3, hot);
    }
    L.commit(); Hd.commit();
  };
  return g;
};

DOCS.camFlashes = 'press / crowd camera flashes (timeloop f4519): soft white pops (~170 px glow, bright core) at random places, 3 frames each; { small: true } = tiny pops in far stands (put an area on the stands). { rate (per s, 2.2 / small 10), area | around, z, seed }';
KINDS.camFlashes = (S, o = {}) => {
  const [at, until] = span(S, o), small = !!o.small, slots = small ? 14 : 4, g = root('camFlashes'), col = rgb(o.color || '#ffffff');
  const [L] = fieldLayers(S, g, o, [{ n: slots, depth: small ? 1.3 : .95, dz: .02, shape: 'dot', salt: 1, order: 42 }]);
  const rate = o.rate ?? (small ? 10 : 2.2), sd = (o.seed ?? 1) * 7.31;
  g.userData.update = (t, S) => {
    followArea(o, [L]);
    // flash m happens at at + (m + jitter) / rate and lasts 3 frames; the ones alive at t fill the slots
    let j = 0; const m0 = Math.floor((t - at) * rate) - Math.ceil(3 * F * rate) - 1;
    for (let m = Math.max(0, m0); m <= m0 + Math.ceil(3 * F * rate) + 2 && j < slots; m++) {
      const te = at + (m + .9 * hash(m, sd + 1)) / rate, age = (t - te) / F;
      if (t > until || age < 0 || age >= 3) continue;
      const a = [1, .75, .3][Math.floor(age)], dia = (small ? 12 : 170) * PX * (.8 + .4 * hash(m, sd + 9));
      L.set(j++, .06 + .88 * hash(m, sd + 3), small ? .2 + .55 * hash(m, sd + 5) : .15 + .7 * hash(m, sd + 5), 0, a, dia, dia, small ? .18 : .09, col);
    }
    for (; j < slots; j++) L.hide(j);
    L.commit();
  };
  return g;
};

DOCS.bubbles = 'bubbles: thin rings 4-14 px with a highlight rising and wobbling; { from: point } = a stream from a point. { density, area | around, from, height, z }';
KINDS.bubbles = (S, o = {}) => {
  const [at, until] = span(S, o), d = o.density ?? 1, g = root('bubbles'), col = rgb(o.color || '#d8f0ff');
  if (o.from) {
    const n = Math.round(16 * d), R = burstLayer(S, g, n, { shape: 'ring' }), Hh = burstLayer(S, g, n, { shape: 'soft' }), T = table(n, (o.seed ?? 5) * 17, 8);
    g.userData.update = (t, S) => {
      const p = pointOf(S, o.from, t); if (p) { place(R, p); place(Hh, p, .031); }
      const e = env(t, at, until, .1, .3), tc = clk(S, t, o), hgt = o.height ?? .35;
      for (let i = 0; i < n; i++) { const r = k => T[i * 8 + k], per = hgt / (.12 + .1 * r(0)), age = fract((tc - at) / per + r(1)), y = age * hgt;
        if (e <= 0 || tc < at) { R.hide(i); Hh.hide(i); continue; }
        const dia = lerp(4, 14, r(2)) * PX * (1 + age * .4), x = (r(3) - .5) * .02 + .008 * Math.sin(tc * (5 + 3 * r(4)) + r(5) * TAU), a = e * Math.min(1, age * 8, (1 - age) * 5);
        R.set(i, x, y, 0, .7 * a, dia, dia, .16, col); Hh.set(i, x - dia * .18, y + dia * .2, 0, .5 * a, dia * .35, dia * .35, 0, col);
      }
      R.commit(); Hh.commit();
    };
    return g;
  }
  const [R, Hh] = fieldLayers(S, g, o, [{ n: 30 * d, depth: 1.05, shape: 'ring', salt: 1 }, { n: 30 * d, depth: 1.05, dz: .001, shape: 'soft', salt: 1 }]);
  g.userData.update = (t, S) => {
    followArea(o, [R, Hh]);
    const e = env(t, at, until, .3, .3), tc = clk(S, t, o), T = R.tab, asp = R.aspect;
    for (let i = 0; i < R.n; i++) { const r = k => T[i * 8 + k];
      if (e <= 0) { R.hide(i); Hh.hide(i); continue; }
      const dia = lerp(4, 14, r(2)) * PX, v = r(1) + (.08 + .12 * r(3)) * tc, u = r(0) + .006 * Math.sin(tc * (4 + 3 * r(4)) + r(5) * TAU) / asp;
      R.set(i, u, v, 0, .65 * e, dia, dia, .16, col); Hh.set(i, u, v, 0, .45 * e, dia * .35, dia * .35, 0, col, 0, -dia * .18, dia * .2);
    }
    R.commit(); Hh.commit();
  };
  return g;
};

DOCS.water = 'a water surface: short horizontal light dashes twinkling and drifting, optional glitter column under a light. { area | around (the water), glitter: x (world), density, color, z }';
KINDS.water = (S, o = {}) => {
  const [at, until] = span(S, o), d = o.density ?? 1, g = root('water'), col = rgb(o.color || '#f4e8d8');
  const nc = o.glitter != null ? Math.round(26 * d) : 0, nf = Math.round(40 * d);
  const [L] = fieldLayers(S, g, o, [{ n: nf + nc, depth: 1.1, dz: .01, shape: 'rect', salt: 1, order: 18 }]);
  g.userData.update = (t, S) => {
    followArea(o, [L]);
    const e = env(t, at, until, .4, .4) * (o.opacity ?? 1), tc = clk(S, t, o), T = L.tab;
    const gx = o.glitter != null && L.area ? (o.glitter - L.area[0]) / (L.area[2] - L.area[0]) : .5;
    for (let i = 0; i < L.n; i++) { const r = k => T[i * 8 + k];
      if (e <= 0) { L.hide(i); continue; }
      if (i < nc) {   // the glitter column under the light: stacked dashes, wider and denser near the viewer (bottom), twinkling
        const v = .04 + .9 * (i + .5 * r(0)) / nc, near = 1 - v, tw = .55 + .45 * Math.max(0, Math.sin(tc * (2 + 2 * r(2)) + r(3) * TAU));
        L.set(i, gx + (r(4) - .5) * .015, v, 0, .7 * tw * e, lerp(30, 120, near) * PX * (.7 + .5 * r(5)), lerp(2, 3.5, near) * PX, .3, col, 0, (r(6) - .5) * 30 * PX * near, 0);
        continue; }
      const u = r(0) + .004 * tc * (o.flow ?? 1), tw = Math.max(0, Math.sin(tc * (1.5 + 2.5 * r(2)) + r(3) * TAU)) ** 3;
      L.set(i, u, r(1), 0, .4 * tw * e, lerp(20, 80, r(4)) * PX * (1 - .5 * r(1)), 2.2 * PX, .3, col);
    }
    L.commit();
  };
  return g;
};

// ================================================================ BURSTS (at a point)
/** the white impact flash: ~0.3 lift toward white for 3 frames (sister f10623-10625), via the grade */
function flashHook(S, at, amount = .32, frames = 3) { gradeHook(S, (t, g) => { if (t >= at && t < at + frames * F) g.flash = Math.max(g.flash || 0, amount); }); }

DOCS.impact = 'an impact: 3-frame white lift of the frame + a white-hot disc, 10 rays and a ring at the point (+ burst: "sparks" | "shards" | "dust"). { at, from (point | actor | object), flash (0.32, false = none), burst, color, scale }';
KINDS.impact = (S, o = {}) => {
  const at = o.at ?? S.t0, g = root('impact'), col = rgb(o.color || '#ffffff'), sc = o.scale ?? 1, nr = o.rays ?? 10, T = table(nr + 2, (o.seed ?? 9) * 13, 4);
  const L = burstLayer(S, g, nr + 3, { shape: 'rect' }), D = burstLayer(S, g, 2, { shape: 'dot', order: 46 }), R = burstLayer(S, g, 1, { shape: 'ring', order: 46 });
  if (o.flash !== false) flashHook(S, at, typeof o.flash === 'number' ? o.flash : .32, o.flashFrames ?? 3);
  g.userData.update = (t, S) => {
    const p = pointOf(S, o.from ?? o.where ?? [0, 1.2, 0], t); if (p) { place(L, p); place(D, p, .035); place(R, p, .036); }
    const f = (t - at) / F;
    if (f < 0 || f > 14) { L.hideAll(); D.hideAll(); R.hideAll(); } else {
      for (let i = 0; i < nr; i++) { const a = TAU * i / nr + (T[i * 4] - .5) * .5, len = lerp(60, 92, T[i * 4 + 1]) * PX * sc, r0 = 26 * PX * sc * (1 + f * .25), m = r0 + len / 2;
        L.set(i, Math.cos(a) * m, Math.sin(a) * m, a, f < 4 ? [1, .85, .55, .25][Math.floor(f)] : 0, len, 2.2 * PX * sc, 0, col); }
      D.set(0, 0, 0, 0, f < 2 ? 1 : Math.max(0, 1 - (f - 2) / 5), (f < 2 ? 50 + f * 15 : 70) * PX * sc, (f < 2 ? 50 + f * 15 : 70) * PX * sc, .3, col);
      D.set(1, 0, 0, 0, Math.max(0, .55 - f / 14), 260 * PX * sc, 260 * PX * sc, 0, rgb(o.glow || '#fff3dc'));
      const k = clamp((f - 1.5) / 5), rr = lerp(30, 64, E.outCubic(k)) * PX * sc;
      R.set(0, 0, 0, 0, f >= 1.5 ? .8 * (1 - k) : 0, rr * 2, rr * 2, 1.25 / (rr / PX), col);
    }
    L.commit(); D.commit(); R.commit();
  };
  const bk = o.burst === 'dust' ? 'smoke' : o.burst;
  if (bk && KINDS[bk] && bk !== 'impact') g.add(KINDS[bk](S, { ...o, burst: null, until: undefined, flash: false, scale: sc, _child: true }));
  else if (bk) console.warn('impact: unknown burst ' + bk + ' (sparks | shards | dust | confetti)');
  if (!o._child) sfx(S, o, 'impact', at);
  return g;
};

DOCS.sparks = 'sparks: bright yellow-white motion streaks thrown from a point with gravity and a warm glow; a burst at `at`, or crackling until `until` with { rate }. { at, until, from, count, dir (deg) + spread, rate, color, scale }';
KINDS.sparks = (S, o = {}) => {
  const at = o.at ?? S.t0, cont = o.rate != null || (o.until != null && o.until > at + .2), until = cont ? (o.until ?? S.t1) : at + .6, g = root('sparks');
  const n = o.count ?? (cont ? 24 : 16), sc = o.scale ?? 1, L = burstLayer(S, g, n, { shape: 'streak' }), Gl = burstLayer(S, g, 1, { shape: 'soft', order: 44 }), T = table(n, (o.seed ?? 21) * 7, 8);
  const hot = rgb('#fffbe8'), warm = rgb(o.color || '#ffb347'), spread = (o.spread ?? 360) * DEG, dir0 = (o.dir ?? 90) * DEG, rate = o.rate ?? 9;
  g.userData.update = (t, S) => {
    const p = pointOf(S, o.from ?? o.where ?? [0, 1, 0], t); if (p) { place(L, p, .04); place(Gl, p, .035); }
    for (let i = 0; i < n; i++) { const r = k => T[i * 8 + k];
      let born = at + r(0) * 2 * F;
      if (cont) { const per = n / rate, k = Math.floor((t - at - r(0) * per) / per); born = at + r(0) * per + k * per; if (born > until) { L.hide(i); continue; } }
      const life = (4 + 6 * r(1)) * F * (o.life ?? 1), tau = t - born;
      if (tau < 0 || tau > life || t < at) { L.hide(i); continue; }
      const seedK = cont ? hash(Math.floor((t - at - r(0) * (n / rate)) / (n / rate)), i) : r(2);
      const th = dir0 + (seedK - .5) * spread, sp = (.35 + .55 * r(3)) * sc, gr = 1.4 * sc;
      const vx = Math.cos(th) * sp, vy = Math.sin(th) * sp - gr * tau, x = Math.cos(th) * sp * tau, y = Math.sin(th) * sp * tau - gr * tau * tau / 2;
      const k = tau / life, len = Math.max(8 * PX, Math.hypot(vx, vy) * 1.6 * F) * (1 - .5 * k);
      const c = [lerp(hot[0], warm[0], k), lerp(hot[1], warm[1], k), lerp(hot[2], warm[2], k)];
      L.set(i, x, y, Math.atan2(vy, vx), 1 - k * k, len, 2.6 * PX * sc, 0, c);
    }
    const gk = cont ? env(t, at, until, .05, .1) * (.6 + .4 * Math.abs(noise1(t * 14, 3))) : Math.max(0, 1 - (t - at) / (8 * F)) * (t >= at ? 1 : 0);
    const gs = (cont ? 90 : lerp(70, 120, clamp((t - at) / (6 * F)))) * PX * sc;
    Gl.set(0, 0, 0, 0, .7 * gk, gs, gs, 0, rgb(o.glow || '#ffd27a'));
    L.commit(); Gl.commit();
  };
  if (!o._child) sfx(S, o, 'click', at, -6);
  return g;
};

DOCS.shards = 'glass shards: 42 thin pale-blue slivers 34-130 px flying out from the hit, spinning, falling; white-hot the first 2 frames, with the impact flash and a warm glow at the hole. { at, from, count, dir + spread, life (1.6 s), flash, color, scale }';
KINDS.shards = (S, o = {}) => {
  const at = o.at ?? S.t0, g = root('shards'), n = o.count ?? 42, sc = o.scale ?? 1, life = o.life ?? 1.6, T = table(n, (o.seed ?? 17) * 11, 10);
  const L = burstLayer(S, g, n, { shape: 'tri', blend: 'normal', order: 47 }), Gl = burstLayer(S, g, 2, { shape: 'soft', order: 44 });
  const pale = rgb(o.color || '#a9b9d3'), white = rgb('#ffffff'), spread = (o.spread ?? 360) * DEG, dir0 = (o.dir ?? 90) * DEG;
  if (o.flash !== false) flashHook(S, at, typeof o.flash === 'number' ? o.flash : .32);
  g.userData.update = (t, S) => {
    const p = pointOf(S, o.from ?? o.where ?? [0, 1.2, 0], t); if (p) { place(L, p, .06); place(Gl, p, .02); }
    const tau = t - at, f = tau / F;
    for (let i = 0; i < n; i++) { const r = k => T[i * 10 + k];
      if (tau < 0 || tau > life) { L.hide(i); continue; }
      const th = dir0 + (r(0) - .5) * spread, sp = (.36 + .42 * r(1)) * sc * (o.power ?? 1), gr = .7 * sc, r0 = r(2) * 40 * PX * sc;
      const x = Math.cos(th) * (r0 + sp * tau), y = Math.sin(th) * (r0 + sp * tau) - gr * tau * tau / 2;
      const len = lerp(34, 130, r(3) * r(3)) * PX * sc, wid = len * lerp(.28, .5, r(4)), a = (f < 2 ? 1 : .85) * clamp((life - tau) / .4);
      L.set(i, x, y, r(5) * TAU + (r(6) - .5) * 14 * tau, a, len, wid, 0, f < 2 ? white : pale, (r(7) - .5) * .1);
    }
    const hk = tau < 0 ? 0 : tau < 2 * F ? 1 : Math.max(0, 1 - (tau - 2 * F) / (3 * F));
    Gl.set(0, 0, 0, 0, hk, 150 * PX * sc, 150 * PX * sc, 0, white);
    Gl.set(1, 0, 0, 0, tau < 0 ? 0 : .18 * clamp((life + .5 - tau) / .6), 260 * PX * sc, 300 * PX * sc, 0, rgb(o.glow || '#e8c58a'));
    L.commit(); Gl.commit();
  };
  if (!o._child) sfx(S, o, 'impact', at, 2);
  return g;
};

DOCS.crack = 'a glass crack: white polylines radiating from the hit with cross links (a cell network), drawn on in 3 frames, then static. { at, from (point) | around (the glass), size (radius m), width (m), dur, color }';
KINDS.crack = (S, o = {}) => {
  const at = o.at ?? S.t0, g = root('crack'), A = areaOf(o);
  const c = pointOf(S, o.from ?? o.where ?? (A ? [(A.rect[0] + A.rect[2]) / 2, (A.rect[1] + A.rect[3]) / 2, A.z] : [0, 1.2, 0]), at) || new THREE.Vector3(0, 1.2, 0);
  const R = o.size ?? (A ? Math.min(A.rect[2] - A.rect[0], A.rect[3] - A.rect[1]) * .55 : .35), w = o.width ?? R * .022, r = rnd((o.seed ?? 4) * 101);
  const ns = o.spokes ?? 9, spokes = [];
  for (let i = 0; i < ns; i++) { const a0 = TAU * (i + r() * .6) / ns, pts = []; let a = a0; const m = 4 + Math.floor(r() * 3);
    for (let k = 0; k <= m; k++) { const rr = R * (k === 0 ? .03 : (k / m) * (.75 + .25 * r())); a += (r() - .5) * .35; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); } spokes.push(pts); }
  const segs = [];
  for (const P of spokes) for (let k = 0; k + 1 < P.length; k++) segs.push([P[k], P[k + 1]]);
  for (let i = 0; i < ns; i++) { const P = spokes[i], Q = spokes[(i + 1) % ns];
    for (let k = 1; k < Math.min(P.length, Q.length) - 1; k++) if (r() < .55) { const a = P[k], b = Q[Math.min(Q.length - 1, k + (r() < .3 ? 1 : 0))], m = [(a[0] + b[0]) / 2 * (.9 + .15 * r()), (a[1] + b[1]) / 2 * (.9 + .15 * r())]; segs.push([a, m], [m, b]); } }
  segs.sort((A1, B1) => Math.min(Math.hypot(...A1[0]), Math.hypot(...A1[1])) - Math.min(Math.hypot(...B1[0]), Math.hypot(...B1[1])));
  const build = (wd) => { const pos = [], idx = [], cum = [];
    const quad = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-6, nx = -dy / l * wd / 2, ny = dx / l * wd / 2, k = pos.length / 3;
      pos.push(a[0] + nx, a[1] + ny, 0, a[0] - nx, a[1] - ny, 0, b[0] + nx, b[1] + ny, 0, b[0] - nx, b[1] - ny, 0); idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); };
    const disc = p => { const k = pos.length / 3, n = 8; pos.push(p[0], p[1], 0); for (let i = 0; i <= n; i++) { const a = TAU * i / n; pos.push(p[0] + Math.cos(a) * wd / 2, p[1] + Math.sin(a) * wd / 2, 0); if (i) idx.push(k, k + i, k + i + 1); } };
    for (const [a, b] of segs) { quad(a, b); disc(b); cum.push(idx.length); }
    const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ge.setIndex(idx); return { ge, cum }; };
  const core = build(w), halo = build(w * 3.2);
  const mk = (b, color, op, add) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    m.userData.own = true; const me = new THREE.Mesh(b.ge, m); me.renderOrder = add ? 33 : 34; me.userData.noPick = true; me.userData.cum = b.cum; return me; };
  const m1 = mk(halo, o.color || '#ffffff', .16, true), m2 = mk(core, o.color || '#f6f8fb', .95, false);
  g.add(m1, m2); g.position.set(c.x, c.y, (A?.z ?? c.z) + .02);
  const dur = o.dur ?? 3 * F, [, until] = span(S, o);
  g.userData.update = t => {
    const k = t < at || t > until ? 0 : clamp((t - at + F) / (dur + F)), nseg = Math.ceil(k * segs.length);
    for (const me of [m1, m2]) { me.visible = nseg > 0; me.geometry.setDrawRange(0, nseg > 0 ? me.userData.cum[nseg - 1] : 0); }
  };
  if (!o._child && o.sound) sfx(S, o, 'impact', at, -8);
  return g;
};

DOCS.zap = 'a stun dart / energy shot: a white streak with a bright head flies from A to B leaving thin shock rings, then the hit (disc, rays, ring). { at, from, to (points | actors), dur (4 frames), color, flash (on the hit: false), scale }';
KINDS.zap = (S, o = {}) => {
  const at = o.at ?? S.t0, dur = o.dur ?? 4 * F, g = root('zap'), col = rgb(o.color || '#ffffff');
  const L = burstLayer(S, g, 1, { shape: 'streak', pos: 'm', size: 'm', order: 46 }), H = burstLayer(S, g, 1, { shape: 'dot', pos: 'm', order: 47 }), Rg = burstLayer(S, g, 3, { shape: 'ring', pos: 'm', size: 'm', order: 45 });
  g.userData.update = (t, S) => {
    const A = pointOf(S, o.from, t), B = pointOf(S, o.to, t); if (!A || !B) return;
    for (const X of [L, H, Rg]) { X.origin = [0, 0]; X.z = (A.z + B.z) / 2 + .05; }
    const k = (t - at) / dur, ang = Math.atan2(B.y - A.y, B.x - A.x), D = Math.hypot(B.x - A.x, B.y - A.y);
    if (k < 0 || k > 1) { L.hide(0); H.hide(0); } else {
      const hx = lerp(A.x, B.x, k), hy = lerp(A.y, B.y, k), tl = Math.min(k * D, Math.max(.12, D * .3)), mx = hx - Math.cos(ang) * tl / 2, my = hy - Math.sin(ang) * tl / 2;
      L.set(0, mx, my, ang, 1, tl, o.width ?? .008, 0, col); H.set(0, hx, hy, 0, 1, 16 * PX, 16 * PX, .3, col);
    }
    for (let i = 0; i < 3; i++) { const ki = (i + 1) / 4, ti = at + ki * dur, age = (t - ti) / F;
      if (age < 0 || age > 6) { Rg.hide(i); continue; }
      const rx = lerp(A.x, B.x, ki), ry = lerp(A.y, B.y, ki), rr = .05 * (1 + age * .1) * (o.scale ?? 1);
      Rg.set(i, rx, ry, ang, .5 * (1 - age / 6), rr * .5, rr * 2, .07, col);
    }
    L.commit(); H.commit(); Rg.commit();
  };
  g.add(KINDS.impact(S, { at: at + dur, from: o.to, flash: o.flash ?? false, scale: (o.scale ?? 1) * .9, rays: 11, _child: true, seed: o.seed }));
  sfx(S, o, 'whoosh', at, -8); sfx(S, o, 'impact', at + dur, -4);
  return g;
};

DOCS.electric = 'electric crackle: 3 jagged cyan-white arcs around a point, re-drawn every 2 frames, with a pulsing glow (stun gun, shorted lock, damaged suit). { at, until, from, radius (frame heights, .07), color, scale }';
KINDS.electric = (S, o = {}) => {
  const [at, until] = span(S, o, { dur: .6 }), g = root('electric'), na = o.arcs ?? 3, ns = 7, col = rgb(o.color || '#cfefff'), sc = o.scale ?? 1;
  const L = burstLayer(S, g, na * ns, { shape: 'rect', order: 46 }), Gl = burstLayer(S, g, 1, { shape: 'soft', order: 44 });
  g.userData.update = (t, S) => {
    const p = pointOf(S, o.from ?? o.where ?? [0, 1, 0], t); if (p) { place(L, p, .05); place(Gl, p, .04); }
    const on = t >= at && t <= until, fr = Math.floor(t * FPS / 2), R0 = (o.radius ?? .07) * sc;
    for (let a = 0; a < na; a++) { const h = q => hash(fr * 13 + a * 7 + q, (o.seed ?? 2) + 1), th0 = h(1) * TAU, th1 = th0 + (h(2) < .5 ? -1 : 1) * (.7 + h(3)), r0 = R0 * (.3 + .4 * h(4)), r1 = R0 * (.6 + .5 * h(5));
      let px = Math.cos(th0) * r0, py = Math.sin(th0) * r0;
      for (let s = 0; s < ns; s++) { const k = (s + 1) / ns, th = lerp(th0, th1, k), rr = lerp(r0, r1, k) + (s < ns - 1 ? (h(10 + s) - .5) * R0 * .5 : 0), qx = Math.cos(th) * rr, qy = Math.sin(th) * rr;
        const len = Math.hypot(qx - px, qy - py), i = a * ns + s;
        if (on && h(30) > .15) L.set(i, (px + qx) / 2, (py + qy) / 2, Math.atan2(qy - py, qx - px), .95, len + 2 * PX, 2.2 * PX * sc, 0, col); else L.hide(i);
        px = qx; py = qy; } }
    const gl = on ? .22 + .18 * Math.abs(noise1(t * 20, 5)) : 0;
    Gl.set(0, 0, 0, 0, gl, R0 * 2.4, R0 * 2.4, 0, col);
    L.commit(); Gl.commit();
  };
  return g;
};

const FW_COLS = ['#e8a0d8', '#b8e8c0', '#f2d38a', '#a8c8f0', '#f4b0a0'];
DOCS.fireworks = 'fireworks (timeloop f10466, f10695): ray bursts (36 thin rays with a soft glow expanding to ~95-140 px in 10 frames, then drooping and fading over 16) and rings of 18 dots, a new one every `every` s (0.7), 3 alive at once; in the upper sky of the view, or inside an area / around a window (sized to it). { every, colors, area | around, z, depth, scale }';
KINDS.fireworks = (S, o = {}) => {
  const [at, until] = span(S, o), g = root('fireworks'), slots = 3, nr = 36, A = areaOf(o), cols = (o.colors || FW_COLS).map(rgb), every = o.every ?? .7, sc = o.scale ?? 1;
  const L = new Layer(S, slots * (nr + 1), { mode: 'world', shape: 'rect', pos: A ? 'm' : 'screen', size: A ? 'm' : 'screen', order: 16 });
  const Gl = new Layer(S, slots, { mode: 'world', shape: 'soft', pos: A ? 'm' : 'screen', size: A ? 'm' : 'screen', order: 15 });
  for (const X of [L, Gl]) { g.add(X.mesh); if (!A) { X.o.depth = o.depth ?? 1.7; X.o.base = o.z; X.originView = true; } }
  g.userData.update = (t, S) => {
    let U = 1, asp = S.cam?.aspect ?? 16 / 9, cx = 0, cy = 0;
    const Ar = A ? areaOf(o) : null;
    if (Ar) { const [x0, y0, x1, y1] = Ar.rect; U = y1 - y0; asp = (x1 - x0) / U; cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; for (const X of [L, Gl]) { X.origin = [cx, cy]; X.z = Ar.z + (X === L ? .002 : 0); } }
    const px = PX * (A ? U * 1.6 : 1) * sc;
    for (let j = 0; j < slots; j++) {
      const m = Math.floor((t - at - j * every) / (slots * every)); let e = j + slots * m, te = at + e * every + (hash(e, 3) - .5) * every * .5;
      if (te > t) { e -= slots; te = at + e * every + (hash(e, 3) - .5) * every * .5; }
      const age = (t - te) / F, alive = e >= 0 && t <= until + 1 && te <= until && age >= 0 && age < 26;
      const ring = hash(e, 5) < .3, c = pick(cols, hash(e, 7)), bx = (hash(e, 11) - .5) * asp * .78, by = A ? (hash(e, 13) - .5) * .7 : .05 + hash(e, 13) * .33;
      const R = (ring ? lerp(40, 70, hash(e, 17)) : lerp(95, 140, hash(e, 17))) * px, k = E.outCubic(clamp(age / 10)), r = R * (ring ? .4 + .6 * k : k);
      const fade = age < 10 ? 1 : Math.max(0, 1 - (age - 10) / 16), droop = Math.max(0, age - 10) ** 2 * .9 * px;
      for (let i = 0; i < nr; i++) { const idx = j * (nr + 1) + i;
        if (!alive || (ring && i >= 18)) { L.hide(idx); continue; }
        const a = TAU * i / (ring ? 18 : nr) + hash(e * 31 + i, 19) * .12, tw = .7 + .3 * hash(e * 31 + i + Math.floor(age / 2), 23);
        if (ring) { const dd = 4 * px; L.set(idx, (bx * U) + Math.cos(a) * r, (by * U) + Math.sin(a) * r - droop, 0, fade * tw, dd, dd, .5, c); }
        else { const r0 = r * .32, len = Math.max(px, r - r0), mm = r0 + len / 2; L.set(idx, bx * U + Math.cos(a) * mm, by * U + Math.sin(a) * mm - droop * (.5 + .5 * Math.sin(a) ** 2), a, fade * tw, len, 2.2 * px, 0, c); }
      }
      L.hide(j * (nr + 1) + nr);
      if (alive) Gl.set(j, bx * U, by * U - droop * .5, 0, .42 * fade * (1 - k * .3), R * 1.7, R * 1.7, 0, c); else Gl.hide(j);
    }
    L.commit(); Gl.commit();
  };
  return g;
};

DOCS.smoke = 'smoke: soft round puffs - one puff at `at` (a shot, a pop), or a rising plume with { rate } (chimney, fire, thruster). { at, until, from, rate, size (frame heights, .035), rise, wind, color, opacity, scale }';
KINDS.smoke = (S, o = {}) => {
  const [at, until0] = span(S, o), cont = o.rate != null, g = root('smoke'), sc = o.scale ?? 1, col = rgb(o.color || '#e2e6ea');
  const life = o.life ?? (cont ? 2.4 : .32), rate = o.rate ?? 0, n = cont ? Math.ceil(rate * life) + 2 : 4, T = table(n, (o.seed ?? 8) * 19, 8);
  const L = burstLayer(S, g, n, { shape: 'puff', blend: 'normal', order: 41 }), until = cont ? until0 : at + life;
  g.userData.update = (t, S) => {
    const p = pointOf(S, o.from ?? o.where ?? [0, 1, 0], t); if (p) place(L, p, .05);
    const tc = clk(S, t, o), base = (o.size ?? .035) * sc, rise = (o.rise ?? (cont ? .07 : .02)) * sc, wind = (o.wind ?? 0) * sc;
    for (let i = 0; i < n; i++) { const r = k => T[i * 8 + k];
      let born = at + r(0) * F, idx = i;
      if (cont) { const per = n / rate, m = Math.floor((tc - at - i / rate) / per); born = at + i / rate + m * per; idx = i + m * n; }
      const tau = tc - born, k = tau / life;
      if (tau < 0 || k >= 1 || born > until || t < at) { L.hide(i); continue; }
      const h = q => cont ? hash(idx, q) : r(q), dia = base * 2 * (cont ? lerp(.8, 1.3, h(1)) : lerp(.7, 1.2, h(1))) * (1 + k * (cont ? 2.2 : .7));
      const ox = cont ? (h(2) - .5) * base * .8 : (h(2) - .5) * base * 1.6, oy = cont ? 0 : (h(3) - .5) * base * 1.2;
      const x = ox + wind * tau + (cont ? .01 * Math.sin(tau * 2 + h(4) * TAU) * sc : 0), y = oy + rise * tau;
      const a = (o.opacity ?? (cont ? .4 : .62)) * (cont ? Math.min(1, k * 6) * (1 - k) ** 1.4 : (1 - k) ** 1.3);
      L.set(i, x, y, 0, a, dia, dia, 0, col);
    }
    L.commit();
  };
  return g;
};

DOCS.steam = 'steam (iq500 f2290): 3 white ribbons (round ends, ~50 %) rising in slow S-curves from a cup / pot, each growing from the rim, then thinning away from the bottom (2.1 s cycle). Size it to the cup: a mug close-up wants height ~2.5x the mug, width ~0.25x the mug. { from (the rim point), height (m, .3), width (m, height * .08), count, sway, period, color, opacity }';
KINDS.steam = (S, o = {}) => {
  const [at, until] = span(S, o), g = root('steam'), nr = o.count ?? 3, np = 26, Hh = o.height ?? .3, Ww = (o.width ?? Hh * .08) / 2, T = table(nr, (o.seed ?? 6) * 23, 4);
  const R = new Ribbons(nr, np, o.color || '#f2f5f8', { order: 26 }); g.add(R.mesh);
  const L = [];
  g.userData.update = (t, S) => {
    const p = pointOf(S, o.from ?? o.where ?? [0, 1, 0], t); if (p) R.mesh.position.set(p.x, p.y, p.z + .02);
    const e = env(t, at, until, .5, .6) * (o.opacity ?? .5), tc = clk(S, t, o), per = o.period ?? 2.1;
    for (let r = 0; r < nr; r++) {
      const c = fract((tc - at) / per + r / nr + T[r * 4] * .12), s1 = Math.min(1, c * 3), s0 = Math.max(0, (c - .6) * 2.5), ph = T[r * 4 + 1] * TAU, xo = (r - (nr - 1) / 2) * Ww * 1.6 + (T[r * 4 + 2] - .5) * Ww;
      L.length = 0;
      for (let k = 0; k < np; k++) { const s = lerp(s0, s1, k / (np - 1)), y = s * Hh;
        const x = xo + (o.sway ?? .016) * (Hh / .3) * (.15 + .85 * s) * Math.sin(TAU * (s * .62 - tc * .42) + ph);
        const cap = Math.sqrt(clamp(Math.min(k, np - 1 - k) / 2.2)), wd = Ww * (1 - .35 * s) * cap;
        const a = s1 - s0 < .02 ? 0 : e * (1 - .55 * s) * clamp(s1 * 4) * clamp((1 - c) * 6);
        L.push([x, y, wd, a]); }
      R.line(r, L);
    }
    R.commit();
  };
  return g;
};

DOCS.ripple = 'a ripple ring: style "genius" (default: one thin white ring + a follower 3 frames later expanding to ~0.7 frame heights in 12 frames: the "he sees it" / time-stops moment), "water" (flat ellipses every 8 frames), "shock" (one small fast ring). { at, until, from, style, radius (frame heights), flat, every, color, alpha, reverse }';
KINDS.ripple = (S, o = {}) => {
  const st = o.style || 'genius', at = o.at ?? S.t0, g = root('ripple'), col = rgb(o.color || '#ffffff');
  const P = { genius: { n: 2, every: 3, life: 12, r0: .09, R: .7, w: 2.4, a: .68, flat: 1, loop: false }, water: { n: 3, every: 11, life: 33, r0: .03, R: .2, w: 3, a: .7, flat: .28, loop: true }, shock: { n: 1, every: 0, life: 6, r0: .02, R: .07, w: 2.2, a: .8, flat: 1, loop: false } }[st] || {};
  const Q = { ...P, ...(o.radius != null ? { R: o.radius } : {}), ...(o.flat != null ? { flat: o.flat } : {}), ...(o.every != null ? { every: o.every * FPS } : {}), ...(o.alpha != null ? { a: o.alpha } : {}), ...(o.count != null ? { n: o.count } : {}) };
  const until = o.until ?? (Q.loop ? S.t1 : at + (Q.every * (Q.n - 1) + Q.life) * F);
  const L = burstLayer(S, g, Q.n, { shape: 'ring', order: 48 });
  if (o.from == null) { L.o.depth = .5; L.originView = true; }
  g.userData.update = (t, S) => {
    const p = o.from != null ? pointOf(S, o.from, t) : null; if (p) place(L, p, .08);
    for (let i = 0; i < Q.n; i++) {
      let age;
      if (Q.loop) { const per = Q.every * Q.n, m = Math.floor(((t - at) * FPS - i * Q.every) / per); age = (t - at) * FPS - i * Q.every - m * per; if (t > until || age > Q.life) { L.hide(i); continue; } }
      else age = (t - at) * FPS - i * Q.every;
      if (age < 0 || age > Q.life || t < at) { L.hide(i); continue; }
      const u = age / Q.life, k = o.reverse ? 1 - u : u;
      const r = lerp(Q.r0, Q.R, o.reverse ? E.inQuad(k) : E.outQuad(k)) * (i ? .92 : 1), a = Q.a * (i ? .55 : 1) * (o.reverse ? Math.sin(Math.PI * u) ** .8 : (1 - k) ** 1.1 * Math.min(1, age + .5));
      L.set(i, 0, 0, 0, a, r * 2, r * 2 * Q.flat, (Q.w * (i ? .7 : 1) / 2) / (r / PX), col);
    }
    L.commit();
  };
  return g;
};

DOCS.glint = 'a glint: a white 4-point star (~30 px) with a soft glow popping for 5 frames on an eye, a gem, a lens, an idea. { at, from, size (px, 30), color }';
KINDS.glint = (S, o = {}) => {
  const at = o.at ?? S.t0, g = root('glint'), col = rgb(o.color || '#ffffff'), sz = (o.size ?? 30) * PX;
  const L = burstLayer(S, g, 2, { shape: 'star', order: 49 });
  g.userData.update = (t, S) => {
    const p = pointOf(S, o.from ?? o.where ?? [0, 1.4, 0], t); if (p) place(L, p, .06);
    const f = (t - at) / F, k = f < 0 || f > 6 ? 0 : f < 2 ? .5 + f * .25 : f < 3 ? 1 : 1 - (f - 3) / 3;
    L.set(0, 0, 0, .12, k, sz * (.6 + .4 * k), sz * (.6 + .4 * k), 0, col);
    L.set(1, 0, 0, .9, k * .45, sz * .55, sz * .55, 0, col);
    L.commit();
  };
  if (o.sound) sfx(S, o, 'blip', at, -10);
  return g;
};

DOCS.sparkles = 'magic specks: tiny warm dots (5-10 px with a halo, a few 4-point stars 14-22 px) rising and twinkling around a point / actor (the age-jump look). { at, until, from, radius (frame heights, .12), count, color, rise }';
KINDS.sparkles = (S, o = {}) => {
  const [at, until] = span(S, o), g = root('sparkles'), n = o.count ?? 18, col = rgb(o.color || '#fff1c8'), T = table(n, (o.seed ?? 12) * 29, 8);
  const L = burstLayer(S, g, n, { shape: 'dot', order: 48 }), Ls = burstLayer(S, g, n, { shape: 'star', order: 48 });
  g.userData.update = (t, S) => {
    const p = pointOf(S, o.from ?? o.where ?? [0, 1.2, 0], t, o); if (p) { place(L, p, .08); place(Ls, p, .081); }
    const e = env(t, at, until, .15, .35), R = o.radius ?? .12;
    for (let i = 0; i < n; i++) { const r = k => T[i * 8 + k], per = .7 + .6 * r(0), age = fract((t - at) / per + r(1)), life = .85, star = r(4) < .2;
      L.hide(i); Ls.hide(i);
      if (e <= 0 || age > life || t < at) continue;
      const an = r(2) * TAU, rr = Math.sqrt(r(3)) * R, x = Math.cos(an) * rr * 1.1, y = Math.sin(an) * rr * .9 + (o.rise ?? .07) * age * per;
      const a = e * Math.sin(Math.PI * age / life) ** 1.5, dia = (star ? 14 + 8 * r(5) : 5.5 + 4.5 * r(5)) * PX;
      (star ? Ls : L).set(i, x, y, 0, a * (star ? .9 : 1), dia, dia, star ? 0 : .22, col);
    }
    L.commit(); Ls.commit();
  };
  return g;
};

DOCS.aura = 'an energy glow around an actor / object: a big soft glow behind + a faint one in front, slowly pulsing, with a few rising specks (restrained). { at, until, around | from (actor / object / point), color, strength (.35), size (m), specks }';
KINDS.aura = (S, o = {}) => {
  const [at, until] = span(S, o), g = root('aura'), col = rgb(o.color || '#ffd9a0'), who = o.around ?? o.from ?? o.on;
  const L = burstLayer(S, g, 2, { shape: 'soft', pos: 'm', size: 'm', order: 13 }), Lf = burstLayer(S, g, 1, { shape: 'soft', pos: 'm', size: 'm', order: 50 });
  g.userData.update = (t, S) => {
    const p = pointOf(S, who, t) || new THREE.Vector3(0, 1, 0); place(L, p, -.08); place(Lf, p, .1);
    const hgt = o.size ?? (who?.height ?? (who?.isObject3D ? Math.max(.3, (_b.setFromObject(who), _b.max.y - _b.min.y)) : 1.6));
    const e = env(t, at, until, .35, .5) * (o.strength ?? .35), pulse = .88 + .12 * Math.sin(TAU * (t - at) / 1.6);
    L.set(0, 0, 0, 0, e * pulse * .7, hgt * 1.25, hgt * 1.45, 0, col); L.set(1, 0, 0, 0, e * pulse, hgt * .55, hgt * .7, 0, col);
    Lf.set(0, 0, 0, 0, e * .3 * pulse, hgt * .6, hgt * .75, 0, col);
    L.commit(); Lf.commit();
  };
  if (o.specks !== false) g.add(KINDS.sparkles(S, { at, until, from: who, radius: o.radius ?? .14, count: o.count ?? 12, color: o.color || '#fff1c8', seed: o.seed }));
  return g;
};

// ================================================================ LIGHT
DOCS.lightShaft = 'light shafts: "window" (2-3 parallel soft bands at `angle` deg from straight down, +15 L warm, on the wall), "fan" (god rays fanning down from a hot spot), "cone" (spot / street lamp / flashlight / searchlight with a glow at the source and an optional floor pool). { mode, from (source point) | around (the window), angle, spread (deg), len (m), width (m), bands, color, alpha, z, dust: true, pool: true }';
KINDS.lightShaft = (S, o = {}) => {
  const [at, until] = span(S, o), mode = o.mode || 'window', g = root('lightShaft'), A = areaOf(o), col = o.color || (mode === 'cone' ? '#fff1d6' : '#ffe9c4');
  let src = pointOf(S, o.from ?? o.where ?? null, at);
  if (!src && A) src = new THREE.Vector3((A.rect[0] + A.rect[2]) / 2, mode === 'window' ? (A.rect[1] + A.rect[3]) / 2 : A.rect[3], A.z);
  src = src || new THREE.Vector3(0, 3, -2);
  const z = o.z ?? (A ? A.z + .02 : src.z), ang = (o.angle ?? (mode === 'window' ? 38 : 0)) * DEG, rot = Math.PI + ang;
  const items = [];
  if (mode === 'window') {
    const W = o.width ?? (A ? A.rect[2] - A.rect[0] : 1.1), len = o.len ?? 3.4, nb = o.bands ?? 3;
    for (let i = 0; i < nb; i++) { const w = W / nb * (.55 + .3 * hash(i, 4)), off = (i - (nb - 1) / 2) * W / nb;
      const b = beam(len, w, col, { alpha: (o.alpha ?? .13) * (.75 + .5 * hash(i, 7)), taper: 1, soft: .32, fade: 1.3, start: .02, order: 11 });
      b.position.set(src.x + off * Math.cos(ang), src.y + off * Math.sin(ang), z); b.rotation.z = rot; g.add(b); items.push(b); }
  } else if (mode === 'fan') {
    const len = o.len ?? 7, spread = (o.spread ?? 64) * DEG, w = 2 * len * Math.tan(spread / 2);
    const b = beam(len, w, col, { alpha: o.alpha ?? .3, taper: .05, soft: .12, fade: .9, start: .03, bands: o.bands ?? 8, gap: .7, order: 11 }); b.position.set(src.x, src.y, z); b.rotation.z = rot; g.add(b); items.push(b);
    const hz = new Layer(S, 1, { mode: 'world', pos: 'm', size: 'm', shape: 'soft', order: 12 }); hz.origin = [src.x, src.y]; hz.z = z + .01; hz.set(0, 0, 0, 0, o.alpha ?? .3, len * .55, len * .32, 0, rgb(col)); hz.commit(); g.add(hz.mesh); items.push(hz);
  } else {
    const len = o.len ?? 2.6, half = (o.spread ?? 30) * DEG / 2, w = 2 * len * Math.tan(half);
    const b = beam(len, w, col, { alpha: o.alpha ?? .15, taper: .07, soft: .26, fade: .55, start: .02, order: 11 }); b.position.set(src.x, src.y, z); b.rotation.z = rot; g.add(b); items.push(b);
    const gl = new Layer(S, 2, { mode: 'world', pos: 'm', size: 'm', shape: 'soft', order: 12 }); gl.origin = [src.x, src.y]; gl.z = z + .02;
    gl.set(0, 0, 0, 0, .5, len * .24, len * .24, 0, rgb(col));
    if (o.pool) { const ex = Math.sin(ang) * len * .97, ey = -Math.cos(ang) * len * .97; gl.set(1, ex, ey, 0, .18, w * 1.1, w * .22, 0, rgb(col)); }
    gl.commit(); g.add(gl.mesh); items.push(gl);
  }
  for (const it of items) if (it.userData?.u) it.userData.a0 = it.userData.u.uAlpha.value;
  g.userData.update = t => {
    const e = env(t, at, until, o.fadeIn ?? 0, o.fadeOut ?? 0) * (o.breathe ? .97 + .03 * Math.sin(t * .8) : 1);
    for (const it of items) {
      if (it.userData?.u) { it.visible = e > 0; it.userData.u.uAlpha.value = it.userData.a0 * e; }
      else it.opacity = e;
    }
  };
  if (o.dust) { const wB = (o.len ?? 3) * .8; g.add(KINDS.dust(S, { at, until, density: .55, area: [src.x - wB * .3 + Math.sin(ang) * wB * .5, src.y - wB, src.x + wB * .7 + Math.sin(ang) * wB * .5, src.y + .2], z: z + .05, seed: o.seed })); }
  return g;
};

const FLICK = {
  lamp: (t, s) => { const k = Math.floor(t / 2.3), h = hash(k, s), dip = (t - k * 2.3) / F, at = 6 + h * 30; return h < .6 && dip > at && dip < at + 2 + h * 5 ? (dip - at < 1 ? .15 : .45) : 1; },
  fluorescent: (t, s) => { const k = Math.floor(t / 1.9); if (hash(k, s) > .55) return 1; const f = Math.floor(t * FPS / (2 + Math.floor(hash(Math.floor(t * 6), s + 3) * 4))); return hash(f, s + 7) < .5 ? .06 : 1; },
  screen: (t, s) => .93 + .04 * Math.sin(TAU * 3.1 * t) + .03 * (hash(Math.floor(t * 4), s) - .5),
  blink: (t, s, o) => fract(t / (o.period ?? 1)) < (o.duty ?? .5) ? 1 : .03,
  candle: (t, s) => .9 + .1 * noise1(t * 5, s),
};
DOCS.flicker = 'a light that changes: "lamp" (rare 2-6 frame dips), "fluorescent" (failing tube bursts), "screen" (subtle shimmer), "blink" (LED on/off, { period, duty }), "candle"; a soft glow at the point, and { target } (an object) is shown / hidden with it. { mode, from | around, size (frame heights, .25), color, strength, target }';
KINDS.flicker = (S, o = {}) => {
  const [at, until] = span(S, o), g = root('flicker'), mode = FLICK[o.mode] ? o.mode : 'lamp', col = rgb(o.color || (mode === 'screen' ? '#9fb4e0' : '#ffd9a8'));
  const L = burstLayer(S, g, 2, { shape: 'soft', order: 13 }), seed = o.seed ?? 3;
  g.userData.update = (t, S) => {
    const p = pointOf(S, o.from ?? o.around ?? o.where ?? [0, 2, -2], t); if (p) place(L, p, .03);
    const lv = t < at || t > until ? 1 : FLICK[mode](t, seed, o), s = o.size ?? .25, a = (o.strength ?? .45) * lv * (t < at || t > until ? (o.keep === false ? 0 : 1) : 1);
    L.set(0, 0, 0, 0, a, s * 2, s * 2, 0, col); L.set(1, 0, 0, 0, a * .8, s * .55, s * .55, 0, col);
    if (o.target) o.target.visible = lv > .5;
    L.commit();
  };
  return g;
};

DOCS.siren = 'police lights: a red / blue bar glow swapping every 4 frames and the whole picture washing red / blue with it. { at, until, from (bar point) | around (the car: bar on its roof), wash (.6), period (8 frames), scale }';
KINDS.siren = (S, o = {}) => {
  const [at, until] = span(S, o), g = root('siren'), red = rgb(o.red || '#ff5a6e'), blue = rgb(o.blue || '#5f8eff'), per = (o.period ?? 8) * F, sc = o.scale ?? 1;
  const L = burstLayer(S, g, 4, { shape: 'dot', order: 47 });
  const phase = t => { const x = fract((t - at) / per); return x < .5 ? 0 : 1; };
  const lvl = (t, which) => { const x = fract((t - at) / per) * 2, own = which === 0 ? x < 1 : x >= 1; return own ? 1 : 0; };
  g.userData.update = (t, S) => {
    let p; if (o.around && !o.from) { const ob = o.around.root || o.around; ob.updateMatrixWorld(true); _b.setFromObject(ob); p = new THREE.Vector3((_b.min.x + _b.max.x) / 2, _b.max.y + .03, _b.max.z); } else p = pointOf(S, o.from ?? o.where ?? [0, 1.4, 0], t);
    if (p) place(L, p, .04);
    const e = env(t, at, until, 0, 0), off = (o.spacing ?? .16);
    for (let w = 0; w < 2; w++) { const a = e * lvl(t, w), c = w ? blue : red;
      L.set(w * 2, (w ? off : -off), 0, 0, a, 70 * PX * sc, 70 * PX * sc, .24, c); L.set(w * 2 + 1, (w ? off : -off), 0, 0, a, 640 * PX * sc, 520 * PX * sc, 0, c); }
    L.commit();
  };
  gradeHook(S, (t, gr) => { if (t < at || t > until) return; const w = (o.wash ?? .9) * env(t, at, until, .1, .1), b = phase(t);
    mulTint(gr, b ? [1 - .07 * w, 1 - .01 * w, 1 + .16 * w] : [1 + .14 * w, 1 - .05 * w, 1 + .01 * w]); gr.bright = (gr.bright ?? 1) * (1 + .08 * w); });
  return g;
};

DOCS.screenGlow = 'a screen lighting a face: a cool plume rising above the screen and a soft light on the face (monitor #8ea0c8; { phone: true } = brighter, from below). { from (the screen point / object), face (actor), color, strength, shimmer }';
KINDS.screenGlow = (S, o = {}) => {
  const [at, until] = span(S, o), g = root('screenGlow'), col = rgb(o.color || (o.phone ? '#cfe0ff' : '#8ea0c8'));
  const L = burstLayer(S, g, 2, { shape: 'soft', order: 13 }), Fc = burstLayer(S, g, 1, { shape: 'soft', order: 12 });
  const src = o.from ?? o.where ?? [0, 1, 0];
  g.userData.update = (t, S) => {
    const p = pointOf(S, src, t); if (p) place(L, p, .02);
    // the screen's size: from the object, else a monitor (.5 m) or a phone (.08 m)
    let sw = o.size ?? (o.phone ? .08 : .5), sh = sw * .6, top = 0;
    if (src?.isObject3D) { src.updateMatrixWorld(true); _b.setFromObject(src); if (!_b.isEmpty()) { sw = _b.max.x - _b.min.x; sh = _b.max.y - _b.min.y; top = _b.max.y - (p?.y ?? 0); } }
    const e = env(t, at, until, .2, .2) * (o.strength ?? 1) * (o.shimmer === false ? 1 : FLICK.screen(t, o.seed ?? 5));
    // the cool bloom rising above the screen (iq500 f8692: +40 L, ~1.6 x 2 screens) + a soft halo on the screen itself
    L.set(0, 0, top + sh * .55, 0, .3 * e, sw * 1.9, sh * 3.2, 0, col); L.set(1, 0, 0, 0, .28 * e, sw * 1.4, sh * 1.6, 0, col);
    if (o.face) { const h = pointOf(S, o.face, t, { part: 'head' }); if (h && p) { const dx = clamp(p.x - h.x, -1, 1); Fc.origin = [h.x + dx * .12, h.y + (o.phone ? -.08 : 0)]; Fc.z = h.z - .15; Fc.set(0, 0, 0, 0, .2 * e, .2, .2, 0, col); } }
    else Fc.hide(0);
    L.commit(); Fc.commit();
  };
  return g;
};

DOCS.reset = 'the time-loop reset: a soft white light grows (20 frames), then a white wall of light with a soft edge sweeps across the frame (~30 frames) and holds white - cut the next shot with trans "flash" (or "whiteout"). { at, from (where the light starts), dir ("right" = sweeps left to right), sweep (s, 1.25), until }';
KINDS.reset = (S, o = {}) => {
  const at = o.at ?? S.t0, g = root('reset'), sweep = o.sweep ?? 1.25, grow = o.grow ?? 20 * F, until = o.until ?? S.t1, white = rgb(o.color || '#f4f4f1');
  const Gl = burstLayer(S, g, 2, { shape: 'soft', order: 60 }), W = new Layer(S, 1, { mode: 'world', pos: 'screen', size: 'screen', shape: 'rect', blend: 'normal', order: 61, depth: .3 });
  W.originView = true; g.add(W.mesh);
  const dir = o.dir === 'left' ? -1 : 1;
  g.userData.update = (t, S) => {
    const p = pointOf(S, o.from ?? o.where ?? [0, 1.4, 0], t); if (p) place(Gl, p, .3);
    const k1 = clamp((t - at) / grow), on = t >= at && t <= until;
    Gl.set(0, 0, 0, 0, on ? .25 + .35 * k1 : 0, .1 + .22 * k1, .1 + .22 * k1, 0, white); Gl.set(1, 0, 0, 0, on ? .35 * k1 : 0, .5 * k1 + .05, .5 * k1 + .05, 0, white);
    const k2 = clamp((t - at - grow) / sweep), asp = S.cam?.aspect ?? 16 / 9, Wq = asp * 3, edge = lerp(-asp / 2 - .08, asp / 2 + .12, E.inSine(k2));
    W.set(0, dir * (edge - Wq / 2), 0, 0, on && k2 > 0 ? .97 : 0, Wq, 1.4, (60 / 1920) / 3, white);
    Gl.commit(); W.commit();
  };
  return g;
};

// ================================================================ STORY EFFECTS: freeze, skill
DOCS.freeze = 'time stops: the picture goes flat and cool (sat .42, bright .86, cool tint, eased in 3 frames), a thin ripple ring runs out from `from` when time stops and back in when it restarts, specks hang in the air, and every field effect (rain, dust, snow, confetti, smoke, steam...) stops. Returns a handle: fz.frozen(t), fz.k(t) (0..1 look), fz.time(t) (the world clock: holds at `at` while frozen) - drive frozen actors / props with fz.time(t). Whoever is inside the minute keeps FULL colour: every S.char(..., { free: true }) and what it holds (or keep: [actors / objects]; keep: false = all grey). { at, until, from (point | actor: where the ring starts), ring: false, dust: false, restart: "in" | "out", strength, keep }';
KINDS.freeze = (S, o = {}) => {
  const [at, until] = span(S, o), g = root('freeze'), st = o.strength ?? 1;
  const K = t => Math.min(E.outQuad(seg(t, at, at + 3 * F)), 1 - E.inQuad(seg(t, until, until + 4 * F))) * (t >= at ? 1 : 0);
  g.frozen = t => t >= at && t < until; g.k = K; g.time = t => t < at ? t : t < until ? at : t - (until - at); g.at = at; g.until = until;
  S._fxFreeze = g;
  // whoever is inside the minute keeps FULL colour (review 01-pause S1): the free actors (S.char(..., { free: true })) and
  // what they hold, or o.keep: [actors / objects]; keep: false = everything greys (the old look)
  // (hand inserts - S.hand or any object with userData.kind 'hand' - are the hero's hand: kept too; userData.free = kept)
  const keepList = () => o.keep === false ? [] : Array.isArray(o.keep) ? o.keep
    : [...(S.actors || []).filter(a => a.free && !a.extra), ...(S.scene?.children || []).filter(c => c.userData?.free || c.userData?.kind === 'hand')];
  gradeHook(S, (t, gr) => { const k = K(t) * st; if (k <= 0) return;
    const f = { sat: 1 - .48 * k, bright: 1 - .14 * k, contrast: 1 - .06 * k, tint: [1 - .1 * k, 1 - .03 * k, 1 + .14 * k] };
    gr.sat = (gr.sat ?? 1) * f.sat; gr.bright = (gr.bright ?? 1) * f.bright; gr.contrast = (gr.contrast ?? 1) * f.contrast;
    mulTint(gr, f.tint);
    const objs = keepList(); if (objs.length) gr.keep = { S, objs, ...f }; });
  if (o.ring !== false) {
    g.add(KINDS.ripple(S, { at, from: o.from, style: 'genius', seed: o.seed }));
    if (until < S.t1 - 2 * F || o.restart) g.add(KINDS.ripple(S, { at: until, from: o.from, style: 'genius', reverse: (o.restart ?? 'in') === 'in', alpha: .6, seed: (o.seed ?? 1) + 1 }));
  }
  if (o.dust !== false) {
    const d = KINDS.dust(S, { at, until: until + 3 * F, density: o.density ?? .8, color: '#eef3ff', seed: (o.seed ?? 1) + 40, fadeIn: .25, fadeOut: .12, opacity: .9, area: o.area, around: o.around, z: o.z });
    g.add(d);
  }
  if (!o.silent) sfx(S, o, 'whoosh', at, -10);
  g.userData.update = () => {};
  return g;
};

const CONTACT = .44;   // the fraction of the skill's run when the light passes the joined hands (inOutSine over ~40 % of the path)
/** a joint of an actor in world space (rig contract fig.joint; fallbacks from head / hands) */
function joint(a, name, side) {
  a.root?.updateMatrixWorld?.(true);
  const fig = a.fig;
  if (fig?.joint && fig.root) { try { const j = fig.joint(name + side); if (j) { const v = Array.isArray(j) ? new THREE.Vector3(j[0], j[1], j[2] ?? 0) : j.clone(); return fig.root.localToWorld(v); } } catch { /* fall back */ } }
  const head = a.head(), hand = a.handPos ? a.handPos(side) : head, R = a.headR ?? .16;
  const sh = head.clone().add(new THREE.Vector3((hand.x - head.x) * .12, -R * 1.9, .01));
  if (name === 'shoulder') return sh;
  if (name === 'elbow') return sh.clone().lerp(hand, .5).add(new THREE.Vector3(0, -R * .35, 0));
  return hand;
}
DOCS.skill = 'a skill flowing from A to B in a handshake (restrained, the references\' age-jump look): two thin threads of warm light + specks run from A\'s shoulder along the arm, through the joined hands (a soft glow pops there) up B\'s arm into B (a gentle glow + rising specks). { from: actor A, to: actor B, at (the contact), dur (1.2 s), sideA, sideB ("R"), color, strength }';
KINDS.skill = (S, o = {}) => {
  const A = o.from, B = o.to, at = o.at ?? S.t0, dur = o.dur ?? 1.2, g = root('skill'), col = rgb(o.color || '#ffd890'), hot = rgb('#fff6dc'), sa = o.sideA ?? 'R', sb = o.sideB ?? 'R';
  const nt = 2, nk = 36, nl = 22, T = table(nl, (o.seed ?? 14) * 41, 6), st = o.strength ?? 1;
  // the light runs ON the arms: drawn over the figures (no depth test), so the rig's own layering never hides it
  const L = burstLayer(S, g, nt * nk + nl, { shape: 'dot', pos: 'm', order: 52, depthTest: false }), Gl = burstLayer(S, g, 2, { shape: 'soft', pos: 'm', order: 51, depthTest: false });
  const Gb = burstLayer(S, g, 2, { shape: 'soft', pos: 'm', order: 13 });   // the big glows stay BEHIND the figures
  const path = t => { const P = [joint(A, 'shoulder', sa), joint(A, 'elbow', sa), joint(A, 'hand', sa)], hb = joint(B, 'hand', sb);
    P.push(P[2].clone().lerp(hb, .5), hb, joint(B, 'elbow', sb), joint(B, 'shoulder', sb), pointOf(S, B, t)); return P; };
  const along = (P, cum, s) => { let i = 0; while (i + 2 < P.length && cum[i + 1] < s) i++; const k = clamp((s - cum[i]) / ((cum[i + 1] - cum[i]) || 1e-6)); return [P[i].clone().lerp(P[i + 1], k), Math.atan2(P[i + 1].y - P[i].y, P[i + 1].x - P[i].x)]; };
  g.userData.update = (t, S) => {
    for (const X of [L, Gl, Gb]) { X.origin = [0, 0]; X.z = 0; }
    if (t < at - .05 || t > at + dur + 1.6) { for (const X of [L, Gl, Gb]) { X.hideAll(); X.commit(); } return; }
    const P = path(t), cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + P[i].distanceTo(P[i - 1]));
    const Ltot = cum[cum.length - 1] || 1;
    const k = E.inOutSine(clamp((t - at) / dur)), sF = k * Ltot, tail = Ltot * .32, fade = clamp((at + dur + .5 - t) / .5);
    for (let th = 0; th < nt; th++) for (let j = 0; j < nk; j++) { const i = th * nk + j, u = j / (nk - 1), s = sF - tail * u;
      if (s < 0 || t < at || fade <= 0) { L.hide(i); continue; }
      const [p, an] = along(P, cum, s), amp = .011 * (1 - u * .4), off = amp * Math.sin(s * 38 + t * 9 + th * Math.PI) * (th ? 1 : -1);
      L.set(i, p.x - Math.sin(an) * off, p.y + Math.cos(an) * off, 0, st * fade * (1 - u) ** 1.4 * .9, (6.5 - 2.5 * u) * PX, (6.5 - 2.5 * u) * PX, .3, u < .1 ? hot : col, p.z + .05); }
    for (let j = 0; j < nl; j++) { const i = nt * nk + j, r = q => T[j * 6 + q], s = sF - tail * r(0) * 1.2 + .04 * Math.sin(t * 3 + r(1) * TAU);
      if (s < 0 || t < at || fade <= 0) { L.hide(i); continue; }
      const [p] = along(P, cum, clamp(s, 0, Ltot)), tw = Math.max(0, Math.sin(t * (6 + 5 * r(2)) + r(3) * TAU));
      L.set(i, p.x + (r(4) - .5) * .06, p.y + (r(5) - .5) * .06 + .02 * tw, 0, st * fade * tw * .8 * (1 - r(0) * .6), 2.6 * PX, 2.6 * PX, .4, hot, p.z + .06); }
    const [front] = along(P, cum, Math.min(sF, Ltot));
    Gl.set(0, front.x, front.y, 0, t >= at && t <= at + dur ? .7 * st : 0, .12, .12, 0, col, front.z + .05);
    const tc = at + dur * CONTACT, hand = P[3], pk = t < tc ? clamp((t - tc + 3 * F) / (3 * F)) : Math.exp(-(t - tc) / .55);
    Gl.set(1, hand.x, hand.y, 0, .5 * st * pk, .22, .22, 0, col, hand.z + .06);
    Gb.set(0, hand.x, hand.y, 0, .5 * st * pk, .8, .8, 0, col, hand.z - .4);
    const tb = at + dur, bk = t < tb - .15 ? 0 : t < tb ? (t - tb + .15) / .15 : Math.exp(-(t - tb) / .6), bc = P[P.length - 1];
    Gb.set(1, bc.x, bc.y, 0, .4 * st * bk, .45, .6, 0, col, bc.z - .1);
    L.commit(); Gl.commit(); Gb.commit();
  };
  g.add(KINDS.ripple(S, { at: at + dur * CONTACT, from: t => path(t)[3], style: 'shock', radius: .06, alpha: .6, seed: o.seed }));
  g.add(KINDS.sparkles(S, { at: at + dur - .1, until: at + dur + 1.2, from: B, radius: .1, count: 12, color: o.color || '#fff1c8', seed: (o.seed ?? 1) + 3 }));
  if (o.sound !== false) S.sfx?.('blip', at + dur * .45, { gain: -12 });
  return g;
};

// ---------------------------------------------------------------- HA! stickers (laughing extras)
// The faces carry a "ha" sticker for characters with a face (expression 'ha'); faceless extras and crowds get it here.
// characters NOTES 4.5: a dark spiky starburst with cream text, ~0.7-0.9 D wide, beside the laughing head; pops in over 2
// frames, then wiggles in rotation every 2-3 frames (iq500 s35 f2121-2177, s223, s224).
DOCS.ha = 'HA! stickers beside laughing heads (faceless extras / crowds; characters with a face use face "ha"): a dark spiky burst with cream "HA!", ~0.8 D wide, pops in 2 frames, wiggles every 2 frames. { on: actor | [actors], at, until, side: 1 | -1 }';
const HA_DARK = '#2a2230', HA_CREAM = '#fdefdb';
const burstPts = (r0, r1, n) => { const p = []; for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n, r = i % 2 ? r0 : r1 * (1 - .12 * ((i * 7) % 3) / 2); p.push([Math.cos(a) * r * 1.25, Math.sin(a) * r * .8]); } return p; };
function haSticker() {
  const g = new THREE.Group(), s = .0015;
  const ol = poly(burstPts(.27, .38, 11), HA_CREAM), bg = poly(burstPts(.24, .345, 11), HA_DARK); bg.position.z = s;
  g.add(ol, bg);
  try { const t = text('HA!', { size: .2, px: 1400, font: 'Oswald', weight: 700, color: HA_CREAM }); t.position.z = s * 2; t.renderOrder = 9; g.add(t); } catch { /* text needs a DOM */ }
  g.traverse(m => { m.userData.noPick = true; });
  return g;
}
KINDS.ha = (S, o = {}) => {
  const [at, until] = span(S, o);
  const list = (Array.isArray(o.on) ? o.on : [o.on ?? o.from]).filter(Boolean), g = root('ha');
  const items = list.map((a, i) => { const st = haSticker(); g.add(st); return { a, st, side: o.side ?? (hash(i + 1, o.seed ?? 3) < .5 ? -1 : 1), ph: Math.floor(hash(i + 1, 11) * 2) }; });
  g.userData.update = t => {
    for (const it of items) {
      if (t < at || t > until) { it.st.visible = false; continue; }
      const f = Math.floor((t - at) * FPS + 1e-6), D = (it.a.headR ?? .16) * 2, h = pointOf(S, it.a, t, { part: 'head' }); if (!h) continue;
      // iq500 f2140: ~1.2 D wide, its centre ~0.75 D above and ~0.7 D beside the head centre
      it.st.visible = true; it.st.position.set(h.x + it.side * .7 * D, h.y + .75 * D, h.z + .2);
      it.st.scale.setScalar(D * 1.3 * (f < 1 ? .55 : 1)); it.st.rotation.z = ((((f + it.ph) >> 1) % 2) ? 1 : -1) * 6 * DEG;
    }
  };
  return g;
};

// ---------------------------------------------------------------- registry
export function make(S, kind, o = {}) { const f = KINDS[kind]; if (!f) { console.warn('unknown fx ' + kind + ' (fx: ' + Object.keys(KINDS).join(', ') + ')'); return null; } const obj = f(S, o); if (obj) S.add(obj); return obj; }
export const fxNames = () => Object.keys(KINDS);
/** shorthands: S.impact(at, where, o), S.freeze(o), S.skill(A, B, o) */
export const S_HELPERS = {
  // (through S.fx so a spoken word works for at / until, like everywhere else)
  impact: (S, at, where, o = {}) => (S.fx ?? ((k, x) => make(S, k, x)))('impact', { ...o, at, from: where }),
  freeze: (S, o = {}) => (S.fx ?? ((k, x) => make(S, k, x)))('freeze', o),
  skill: (S, A, B, o = {}) => (S.fx ?? ((k, x) => make(S, k, x)))('skill', { ...o, from: A, to: B }),
};
void viewAt;
