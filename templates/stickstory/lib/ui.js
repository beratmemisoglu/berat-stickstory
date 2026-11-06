// The 2D overlay drawn on top of the frame (after the grade, before nothing: always crisp): the persistent HUD (the
// lives-style counter, chapter labels, pro / con corner icons, checklists, countdowns) and the per-shot overlays (pills,
// labels, tags, counters, stat boxes, stamps, typed text...). Full-frame graphics (maps, terminals, charts, cards) are
// shots built with S.info(kind, o) in lib/info.js. The look and every timing come from the references
// (experiments/stickstory-style/analysis/graphics/NOTES.md); the painters are shared with info.js (lib/info/paint.js).
//
// TIMING (every overlay): at = WHEN (a number = exact seconds; a string = a spoken word, which starts the element 2
// frames before the word, the references' 0-3 frame lead), word = the same as a string at, until = when it ends (a hard
// cut unless the element fades out). Without at / word an element is there from the cut. An element whose word fell
// before the shot began is simply there from the cut (cut-safe). Everything is a pure function of the absolute time.
// PLACE: pos = WHERE ('top' | 'bottom' | 'center' | [x, y] design px of a 1920 x 1080 frame | [x, y, z] world metres |
// an actor (above the head) | an object), dx / dy shift it (design px). (at: [x, y] / at: actor still work as places.)
//
// Persistent HUD for a whole video: hud([...]) from a scene file or models.js (or project.json settings.hud.items),
// e.g. hud([{ kind: 'counter', label: 'LIVES', value: [[0, 64], [312.4, 65]], from: 40, to: 480 }]). See HUD_KINDS.
import { SETTINGS, FW, FH, C, clamp, seg, E, lerp } from './core.js';
import { F, PX, DW, DH, PAL, THEMES, theme, fr, when, startOf, landed, posOf, POP, POPBIG, SWAP, STAMP, popAt, fadeIn, fadeOut, valueAt, format,
  drawText, measure, about, pillSize, paintPill, paintLabel, paintLives, paintIcon, paintTag, paintStat, statSize, paintTimer, paintClock, paintElapsed,
  paintCheck, paintStamp, paintWarning, SANS } from './info/paint.js';

export const FONT_FILES = [
  ['Open Sans', 'fonts/OpenSans-800.woff2', '800', 'normal'], ['Open Sans', 'fonts/OpenSans-700.woff2', '700', 'normal'], ['Open Sans', 'fonts/OpenSans-600.woff2', '600', 'normal'],
  ['Open Sans Ext', 'fonts/OpenSans-ext-800.woff2', '800', 'normal'], ['Open Sans Ext', 'fonts/OpenSans-ext-700.woff2', '700', 'normal'],
  ['Kalam', 'fonts/Kalam-400.woff2', '400', 'normal'], ['Kalam', 'fonts/Kalam-700.woff2', '700', 'normal'], ['Kalam Ext', 'fonts/Kalam-ext-400.woff2', '400', 'normal'],
  ['JetBrains Mono', 'fonts/JetBrainsMono-700.woff2', '700', 'normal'], ['JetBrains Mono', 'fonts/JetBrainsMono-400.woff2', '400', 'normal'],
  ['Inter', 'fonts/inter-800.woff2', '800', 'normal'], ['Inter', 'fonts/inter-600.woff2', '600', 'normal'], ['Oswald', 'fonts/oswald-700.woff2', '700', 'normal']];
export { PAL, THEMES };

// ---------- shared helpers ----------
const barOf = S => (S?._bar ?? Math.round((FH - FW / 2) / 2)) / PX;          // the letterbox bar this frame (design px)
const isActor = p => p && (p.isActor || (p.head && p.root));
/** a place -> [x, y] design px (null = behind the camera) */
export function screenPos(S, p, o = {}) {
  let P;
  if (typeof p === 'function') p = p();
  const bar = barOf(S);
  if (p == null || p === 'top') P = [DW / 2, bar + 160];
  else if (p === 'bottom') P = [DW / 2, DH - bar - 90];
  else if (p === 'center' || p === 'middle') P = [DW / 2, DH / 2];
  else if (Array.isArray(p) && p.length === 2) P = [p[0], p[1]];
  else if (Array.isArray(p) || p?.isVector3 || p?.isObject3D || isActor(p)) { const q = S.screen(p); if (q[2] === false) return null; P = [q[0] / PX, q[1] / PX]; }
  else P = [DW / 2, DH / 2];
  return [P[0] + (o.dx ?? 0), P[1] + (o.dy ?? 0)];
}
/** keep a w x h box centred at P inside the picture (between the letterbox bars, 18 px margin): text over a bar is cut */
function inPicture(S, P, w, h, m = 18) {
  const bar = barOf(S), x0 = m + w / 2, x1 = DW - m - w / 2, y0 = bar + m + h / 2, y1 = DH - bar - m - h / 2;
  return [x0 > x1 ? DW / 2 : clamp(P[0], x0, x1), y0 > y1 ? DH / 2 : clamp(P[1], y0, y1)];
}
/** one overlay item: draw(x, t) works in design px (the transform is set); it returns its box */
function item(S, what, text, t0, t1, draw) {
  return { what, text, t0: t0 > -1e8 ? t0 : S.t0, t1: t1 ?? null, draw(x, t) {
    x.setTransform(PX, 0, 0, PX, 0, 0);
    const b = draw(x, t); this.box = b ? { x: b.x * PX, y: b.y * PX, w: b.w * PX, h: b.h * PX } : null;
  } };
}
const untilOf = (S, o) => o.until != null ? when(S, o.until) : null;
const asOpts = (o, k = 'theme') => typeof o === 'string' ? { [k]: o } : (o || {});

// =====================================================================================================================
// PER-SHOT OVERLAYS (each key becomes S.<key>(...))
// =====================================================================================================================

/**
 * STATEMENT PILL (the references' signature): S.pill('STUN · HARMLESS', { theme, word, pos, row, h, strike, chosen, until })
 *   theme: fact (gold, default) | danger (red) | success (green) | gadget (blue) | predict (violet) | neutral (white) | chosen (amber fill)
 *   pos 'top' (default, centred in the top band) | 'bottom' | [x, y] | an actor / object (next to it: dx / dy); row: stack index (pitch 1.35 h)
 *   h: 100 (default) / 60 for options; strike: a time / word -> a grey line draws through in 5 frames, then the pill greys out
 *   chosen: a time / word -> turns into the amber highlight with a pop. In: a 3-frame pop landing 2 frames before the word.
 */
function pill(S, text, o = {}) {
  o = asOpts(o);
  const t0 = landed(S, startOf(S, o)), ts = when(S, o.strike, 0), tc = when(S, o.chosen, 2 * F);
  const base = o.small ? { h: 60, cap: .47 } : {};
  return item(S, 'pill', text, t0, untilOf(S, o), (x, t) => {
    const [a0, s0] = popAt(POP, t, t0); if (a0 <= 0) return null;
    const h = o.h ?? base.h ?? 100, at0 = posOf(o) ?? 'top', P0 = screenPos(S, at0, o); if (!P0) return null;
    // rows stack DOWN from the top band and UP from the bottom band (review 01-pause: a bottom row: 1 sat under the bar)
    P0[1] += (at0 === 'bottom' ? -1 : 1) * (o.row ?? 0) * (o.pitch ?? 1.35) * h;
    const P = inPicture(S, P0, pillSize(x, text, { ...base, ...o, h }).w, h);
    let th = o.theme, a = a0, s = s0;
    if (tc != null && t >= tc) { th = 'chosen'; const [, s2] = popAt(POP, t, tc); s *= s2; }
    const strike = ts != null ? clamp((t - ts) * 24 / 5) : 0, grey = ts != null ? clamp(((t - ts) * 24 - 8) / 5) : 0;
    x.globalAlpha = a; about(x, P[0], P[1], s);
    return paintPill(x, P[0], P[1], text, { ...base, ...o, h, theme: th, strike, grey }, PX);
  });
}

/**
 * OPTION LIST: S.options([{ text: 'STEAL IT BACK', word: 'steal' }, { text: 'RUIN THEM', word: 'ruin', strike: 'like' },
 *   { text: 'THE TRUTH', word: 'truth', theme: 'chosen', h: 76 }], { pos: [960, 300], h: 60 }) - pills popping one under the
 *   other on their words (pitch 1.35 h), struck ones grey out, the answer pops in amber.
 */
function options(S, list, o = {}) {
  const items = list.map(it => typeof it === 'string' ? { text: it } : it);
  const t0s = items.map(it => landed(S, startOf(S, it))), tss = items.map(it => when(S, it.strike, 0)), tcs = items.map(it => when(S, it.chosen, 2 * F));
  return item(S, 'options', items.map(i => i.text).join(' / '), Math.min(...t0s), untilOf(S, o), (x, t) => {
    const P = screenPos(S, posOf(o) ?? 'top', o); if (!P) return null; let box = null, y = P[1];
    items.forEach((it, i) => {
      const h = it.h ?? o.h ?? 60, cap = it.cap ?? o.cap ?? .47; if (i) y += (o.pitch ?? 1.35) * ((items[i - 1].h ?? o.h ?? 60) + h) / 2;
      const [a, s0] = popAt(POP, t, t0s[i]); if (a <= 0) return;
      let s = s0, th = it.theme ?? o.theme; if (tcs[i] != null && t >= tcs[i]) { th = 'chosen'; s *= popAt(POP, t, tcs[i])[1]; }
      const ts = tss[i], strike = ts != null ? clamp((t - ts) * 24 / 5) : 0, grey = ts != null ? clamp(((t - ts) * 24 - 8) / 5) : 0;
      x.save(); x.globalAlpha = a; about(x, P[0], y, s);
      const b = paintPill(x, P[0], y, it.text, { h, cap, theme: th, strike, grey }, PX); x.restore();
      box = box ? { x: Math.min(box.x, b.x), y: Math.min(box.y, b.y), w: Math.max(box.x + box.w, b.x + b.w) - Math.min(box.x, b.x), h: Math.max(box.y + box.h, b.y + b.h) - Math.min(box.y, b.y) } : b;
    });
    return box;
  });
}

/**
 * CHAPTER / TIME LABEL (top-left "LIFE #8 · AGE 7" + optional gold second line): S.label('TUESDAY · THE HARBOR', { sub: 'PORT',
 *   corner: 'tl' | 'tr' | 'bl' | 'br', until, fade: 6 }) - cream caps (cap 43) with a dark brown outline, fades in over
 *   4 frames starting 1 frame after the cut (or at / word), no motion; out by the cut, or a 6-frame fade ending at until.
 *   style: 'later' = the quieter lower-left "ONE WEEK LATER" (cream caps, wide tracking, no outline).
 */
function label(S, text, o = {}) {
  o = asOpts(o, 'sub');
  const t0 = o.at != null || o.word != null ? landed(S, startOf(S, o, F)) : S.t0 + F, t1 = untilOf(S, o);
  return item(S, 'label', text, t0, t1, (x, t) => {
    const a = (t0 < -1e8 ? 1 : fadeIn(t, t0, o.in ?? 4)) * (t1 != null && o.fade !== 0 ? fadeOut(t, t1, o.fade ?? 6) : 1); if (a <= 0) return null;
    x.globalAlpha = a; const bar = barOf(S), cr = o.corner ?? (o.style === 'later' ? 'bl' : 'tl');
    if (o.style === 'later') { const cap = o.cap ?? 28, X = cr.endsWith('r') ? DW - 110 : 110, Y = cr.startsWith('t') ? bar + 70 + cap : DH - bar - 28;
      return drawText(x, text, X, Y, { cap, w: 800, track: .25, color: o.color ?? '#d2c7bc', align: cr.endsWith('r') ? 'right' : 'left', shadow: [0, 1, 6, 'rgba(0,0,0,.5)'] }, PX); }
    const P = posOf(o) ? screenPos(S, posOf(o), o) : null, cap = o.cap ?? 43;
    const X = P ? P[0] : cr.endsWith('r') ? DW - 76 : 76;
    const hgt = cap + (o.sub ? cap * .84 + (o.subCap ?? cap * .465) : 0);
    const Y = P ? P[1] : cr.startsWith('b') ? DH - bar - 40 - hgt : bar + 40;
    return paintLabel(x, X, Y, text, { ...o, align: P ? (o.align ?? 'left') : cr.endsWith('r') ? 'right' : 'left' }, PX);
  });
}

/**
 * COUNTER for one shot: S.counter('LIVES', { value: 64 | { from: 1, to: 64, preset: 'counter' } | [[time, v], ...], big, pos })
 *   small (default): the bottom-right lives counter (cap 26, cream, soft dark halo; right edge 89 px in, baseline 57 px over
 *   the bottom bar); a change in a [[time, value]] list dips the counter to 15 % for 8 frames, swaps while invisible and
 *   fades back in 5 frames. big: the centred chapter-opener variant (cap 109, dark outline), counting with the value spec
 *   (preset 'counter' = easeInOutSine 37 frames from the cut; 'money' = ease-out 20 f; 'attempts' = accelerating 73 f;
 *   or frames / until / ease). prefix / suffix / decimals / sep format the number.
 */
function counter(S, lab, o = {}) {
  if (typeof lab === 'object' && lab) { o = lab; lab = o.label; }
  const big = !!o.big, val = o.value ?? 0, t0 = o.at != null || o.word != null ? landed(S, startOf(S, o, F)) : -1e9;
  const spec = val && typeof val === 'object' && !Array.isArray(val) ? { at: S.t0, preset: big ? 'counter' : 'money', ...val } : val;
  const changes = Array.isArray(val) ? val.slice(1).map(([tt]) => typeof tt === 'number' ? tt : when(S, tt)) : [];
  return item(S, 'counter', lab, t0, untilOf(S, o), (x, t) => {
    let a = t0 < -1e8 ? 1 : fadeIn(t, t0, 4);
    for (const c of changes) if (o.dip !== false && t >= c - 8 * F && t < c + 5 * F) a *= t < c ? lerp(1, .15, clamp((t - (c - 8 * F)) * 24 / 2)) : lerp(.15, 1, clamp((t - c) * 24 / 5 + .2));
    if (a <= 0) return null;
    const v = format(valueAt(S, spec, t, o), o), s = `${lab ? lab + ': ' : ''}${v}`, bar = barOf(S);
    x.globalAlpha = a;
    if (big) { const P = screenPos(S, posOf(o) ?? 'center', o); const cap = o.cap ?? 109; return paintLives(x, P[0], P[1] + cap / 2, s, { big: true, cap, align: 'center' }, PX); }
    const P = posOf(o) ? screenPos(S, posOf(o), o) : [DW - 89, DH - bar - 57];
    return paintLives(x, P[0], P[1], s, { cap: o.cap, align: posOf(o) ? (o.align ?? 'right') : 'right' }, PX);
  });
}

/**
 * PRO / CON CORNER ICON: S.plusminus('+' | '-', { at | word, born: actor | [x, y] | [x, y, z], fly: word | time, corner })
 *   a boiling 15-sided disc (+ gold top-left at (150, 116 under the bar), - blue-grey top-right) with a glowing glyph.
 *   Without born: pops 3 frames after the cut (scale .6 -> 1.05 -> 1). With born: a big glyph pops over the place (4 frames,
 *   easeOutBack), flies to its corner and shrinks in 6 frames at `fly`, then the disc pops round it in 3 frames.
 *   pop: false = there from the cut. (also S.icon)
 */
function plusminus(S, sign = '+', o = {}) {
  o = asOpts(o, 'corner');
  const plus = sign !== '-' && sign !== 'minus', born = o.born ?? null;
  const t0 = o.at != null || o.word != null ? landed(S, startOf(S, o)) : (o.pop === false ? -1e9 : S.t0 + 3 * F);
  const tf = born ? (when(S, o.fly, 0) ?? (t0 > -1e8 ? t0 + 30 * F : S.t0 + 30 * F)) : null;
  return item(S, 'icon', plus ? '+' : '-', born ? t0 : t0, untilOf(S, o), (x, t) => {
    const bar = barOf(S), cr = o.corner ?? (plus ? 'tl' : 'tr'), r = o.r ?? 72;
    const home = posOf(o) && !born ? screenPos(S, posOf(o), o) : [cr.endsWith('l') ? 150 : DW - 150, cr.startsWith('t') ? bar + 116 : DH - bar - 116];
    const f = fr(t, t0 > -1e8 ? t0 : -1e9);
    if (!born) { const [, s] = t0 > -1e8 ? popAt(SWAP, t, t0) : [1, 1]; if (s <= 0) return null; about(x, home[0], home[1], s); return paintIcon(x, home[0], home[1], { r, sign, frame: fr(t, 0) }, PX); }
    if (t < t0) return null;
    const bp = screenPos(S, born, o) ?? [DW / 2, DH / 2], R = o.bigR ?? r * 1.7, k = E.inOutQuad(seg(t, tf, tf + 6 * F));
    const cx = lerp(bp[0], home[0], k), cy = lerp(bp[1], home[1], k), rr = lerp(R, r, k);
    const s = t < tf ? popAt(POPBIG, t, t0)[1] : 1, ring = t < tf + 6 * F ? 0 : clamp(((t - tf) * 24 - 6 + 1) / 3);
    const rs = ring > 0 && ring < 1 ? lerp(.85, 1, ring) : 1;
    about(x, cx, cy, s * rs); void f;
    return paintIcon(x, cx, cy, { r: rr, sign, frame: fr(t, 0), ring, glow: .6 + .4 * Math.sin(t * 5.2) ** 2 }, PX);
  });
}

/**
 * OBJECT TAG with a leader line, pinned to a thing (moves with the camera): S.tag('MUG · 60.0°C', { pos: mug | actor | [x, y, z],
 *   dx: 0, dy: -120, style: 'amber' (dark + amber border) | 'navy' (no border) | a pill theme, word, until }) - capsule h 60,
 *   cap 24, tracking +.12 em, 1-2 px leader to the anchor; 3-frame pop.
 */
function tag(S, text, o = {}) {
  o = asOpts(o, 'style');
  const t0 = landed(S, startOf(S, o));
  // check: true | time | word - a "✓ " joins the front of the tag (iq500 "✓ WALK: LEO" f2408; "LEAK · TODAY" gets its tick at f1074)
  const tc = o.check === true ? -1e9 : o.check != null ? when(S, o.check, 0) : null;
  return item(S, 'tag', text, t0, untilOf(S, o), (x, t) => {
    const [a, s0] = popAt(POP, t, t0); if (a <= 0) return null;
    const A = screenPos(S, posOf(o) ?? 'center', { dx: 0, dy: 0 }); if (!A) return null;
    const th = o.h ?? 60, tw = measure(x, (tc != null ? '✓ ' : '') + text, { cap: o.cap ?? th * .4, w: 800, track: .12 }) + th * .75;
    const P = inPicture(S, [A[0] + (o.dx ?? 0), A[1] + (o.dy ?? -110)], tw, th), ticked = tc != null && t >= tc;
    const s = ticked && tc > -1e8 ? s0 * popAt(POP, t, tc)[1] : s0;
    x.globalAlpha = a; about(x, P[0], P[1], s);
    return paintTag(x, P[0], P[1], (ticked ? '✓ ' : '') + text, { ...o, to: o.line === false ? null : A }, PX);
  });
}

/**
 * STAT BOX (label over a big value, dark fill, themed border): S.stat('GUARDS', 50, { corner: 'tl' | 'tr', pos, theme: 'danger',
 *   value: { from: 0, to: 1000000, preset: 'money' }, prefix: '$', states: [[time | word, { theme, value, label }]] })
 *   e.g. "7 DAYS / $1,000,000" counting up ease-out over 20 frames, "RESCUE · SIMULATED / 999 / 1000 FAILED" swapping red -> green.
 */
function stat(S, lab, value, o = {}) {
  if (typeof lab === 'object' && lab) { o = lab; lab = o.label; value = o.value; }
  if (value && typeof value === 'object' && !Array.isArray(value) && value.to == null && o.value === undefined) { o = value; value = o.value; }
  const t0 = o.at != null || o.word != null ? landed(S, startOf(S, o, F)) : -1e9;
  const states = (o.states || []).map(([tt, st]) => [typeof tt === 'number' ? tt : when(S, tt), st]);
  const spec = value && typeof value === 'object' && !Array.isArray(value) ? { at: S.t0, ...value } : value;
  return item(S, 'stat', lab, t0, untilOf(S, o), (x, t) => {
    const a = t0 < -1e8 ? 1 : fadeIn(t, t0, 4); if (a <= 0) return null;
    let cur = { theme: o.theme ?? 'fact', label: lab, value: spec }; for (const [tt, st] of states) if (t >= tt) cur = { ...cur, ...st };
    const v = format(valueAt(S, cur.value, t, o), o), bar = barOf(S), cr = o.corner ?? 'tl';
    const P = posOf(o) ? screenPos(S, posOf(o), o) : [cr.endsWith('r') ? DW - 66 : 66, cr.startsWith('t') ? bar + 30 : DH - bar - 30];
    x.globalAlpha = a;
    return paintStat(x, P[0], P[1], { label: cur.label, value: v, cap: o.cap ?? 53, theme: cur.theme, align: posOf(o) ? (o.align ?? 'center') : cr, minW: o.minW, center: o.center }, PX);
  });
}

/**
 * COUNTDOWN BOX (top-right, flush under the top bar, red digits with a glow): S.timer({ from: '31:47:59' | seconds, dir: -1,
 *   at, format: 'hms' | 'ms' | 'hm', prefix: 'VAN · ' }) - ticks once a second (every 24 frames), a hard digit swap.
 */
export function clockText(sec, fmt = 'hms') {
  const s = Math.max(0, Math.floor(sec + 1e-6)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60, p = n => String(n).padStart(2, '0');
  return fmt === 'ms' ? `${p(Math.floor(s / 60))}:${p(ss)}` : fmt === 'hm' ? `${p(h)}:${p(m)}` : `${p(h)}:${p(m)}:${p(ss)}`;
}
export const parseClock = v => typeof v === 'number' ? v : String(v).split(':').map(Number).reduce((a, b) => a * 60 + b, 0);
function timer(S, o = {}) {
  o = typeof o === 'string' || typeof o === 'number' ? { from: o } : o;
  const t0 = o.at != null || o.word != null ? landed(S, startOf(S, o, F)) : -1e9, ref = t0 > -1e8 ? t0 : S.t0, start = parseClock(o.from ?? 0);
  const fmtK = o.format ?? (typeof o.from === 'string' && o.from.split(':').length === 2 ? 'ms' : 'hms');
  return item(S, 'timer', String(o.from), t0, untilOf(S, o), (x, t) => {
    if (t0 > -1e8 && t < t0) return null;
    const sec = start + (o.dir ?? -1) * Math.floor((t - ref) + 1e-6) * (o.rate ?? 1), bar = barOf(S);
    const P = posOf(o) ? screenPos(S, posOf(o), o) : [DW - 54, bar];
    return paintTimer(x, P[0], P[1], (o.prefix ?? '') + clockText(sec, fmtK), o, PX);
  });
}

/**
 * COUNTDOWN RING (a limited budget of seconds: the frozen minute, a bomb, a breath): S.ring({ from: 48 } | { value: 48 } |
 *   { value: [[time | word, 48], ['seconds', 47]] } | { value: t => n }, { at | word, until, stop, max: 60, corner: 'tr' |
 *   'tl' | 'br' | 'bl', big: true (centred, r 200: "the ring big in frame"), label: 'SEC' | false, warn: 5, r, pos })
 *   a dark disc, a faint track, a blue arc that shrinks with value / max (red at <= warn), the number in the middle; each
 *   change of the number pulses the ring 1.08 -> 1 over 4 frames. from: counts down one a second from `at` (default the
 *   cut), holding at `stop` (a time / word: the hand opens with one second left). ONE look for a whole video (review
 *   01-pause: three crew parts drew the same countdown three different ways) - or the HUD kind 'ring' across shots.
 */
const RING_BLUE = '#5aa9ff', RING_RED = '#ff5a4e';
function ringSpec(S, o, wh) {
  if (o.from != null || o.start != null) {
    const start = parseClock(o.from ?? o.start), ref = wh(o.at ?? o.word) ?? S.t0, stop = wh(o.stop), rate = o.rate ?? 1;
    return t => { const tt = stop != null ? Math.min(t, stop) : t, k = Math.max(0, Math.floor((tt - ref) * rate + 1e-6)); return { v: Math.max(0, start - k), tc: k > 0 ? ref + k / rate : -1e9 }; };
  }
  const val = o.value ?? 0;
  if (Array.isArray(val)) { const steps = val.map(([tt, v]) => [typeof tt === 'number' ? tt : wh(tt), v]);
    return t => { let v = steps[0]?.[1] ?? 0, tc = -1e9; for (const [tt, vv] of steps) if (t >= tt) { if (vv !== v) tc = tt; v = vv; } return { v, tc }; }; }
  if (typeof val === 'function') return t => ({ v: val(t), tc: -1e9 });
  return () => ({ v: val, tc: -1e9 });
}
function paintRing(x, cx, cy, r, v, o, pulse, k) {
  const max = o.max ?? 60, frac = clamp(v / max), warn = v <= (o.warn ?? 5), col = o.color ?? (warn ? RING_RED : RING_BLUE);
  x.save(); about(x, cx, cy, pulse);
  x.beginPath(); x.arc(cx, cy, r, 0, 2 * Math.PI); x.fillStyle = o.fill ?? 'rgba(12,16,26,.84)'; x.fill();
  x.lineWidth = r * .13; x.lineCap = 'round';
  x.beginPath(); x.arc(cx, cy, r * .78, 0, 2 * Math.PI); x.strokeStyle = 'rgba(255,255,255,.16)'; x.stroke();
  if (frac > 0) { x.beginPath(); x.arc(cx, cy, r * .78, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * frac); x.strokeStyle = col; x.shadowBlur = r * .22 * k; x.shadowColor = col; x.stroke(); x.shadowBlur = 0; }
  const lab = o.label === false ? null : o.label ?? (o.big ? 'SECONDS' : null), cap = r * (o.big ? .5 : .5);
  drawText(x, String(Math.round(v)), cx, cy + cap * .5 - (lab ? r * .07 : 0), { cap, w: 800, color: warn ? '#ffe3df' : PAL.cream, align: 'center' }, k);
  if (lab) drawText(x, lab, cx, cy + r * .47, { cap: r * .12, w: 800, track: .22, color: 'rgba(251,239,221,.72)', align: 'center' }, k);
  x.restore();
  return { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r };
}
function ringAt(S, o, bar) {
  if (o.big) return [o.r ?? 200, ...(o.pos ? screenPos(S, o.pos, o) : [DW / 2, DH / 2])];
  const r = o.r ?? 66, cr = o.corner ?? 'tr', m = r + 50;
  return [r, cr.endsWith('l') ? m : DW - m, cr.startsWith('t') ? bar + r + 34 : DH - bar - r - 34];
}
function ring(S, o = {}) {
  o = typeof o === 'number' ? { value: o } : o;
  const t0 = o.at != null || o.word != null ? landed(S, startOf(S, o, F)) : -1e9;
  const spec = ringSpec(S, o, v => v == null ? null : when(S, v, 0));
  return item(S, 'ring', 'ring', t0, untilOf(S, o), (x, t) => {
    const a = t0 < -1e8 ? 1 : fadeIn(t, t0, 4); if (a <= 0) return null; x.globalAlpha = a;
    const { v, tc } = spec(t), [r, cx, cy] = ringAt(S, o, barOf(S)), pulse = 1 + .08 * (1 - clamp((t - tc) * 24 / 4));
    return paintRing(x, cx, cy, r, v, o, pulse, PX);
  });
}

/**
 * CLOCK STAMP: S.clock('3:52 P.M.', { style: 'box' (bottom-right, flush on the bottom bar) | 'mint' (top-left caption with a
 *   glow, no box) | 'pill' (a neutral statement pill), at, until })
 */
function clock(S, text, o = {}) {
  o = asOpts(o, 'style');
  if (o.style === 'pill') return pill(S, text, { theme: 'neutral', ...o });
  const t0 = o.at != null || o.word != null ? landed(S, startOf(S, o, F)) : -1e9;
  return item(S, 'clock', text, t0, untilOf(S, o), (x, t) => {
    const a = t0 < -1e8 ? 1 : fadeIn(t, t0, 4); if (a <= 0) return null; x.globalAlpha = a; const bar = barOf(S);
    if (o.style === 'mint') { const P = posOf(o) ? screenPos(S, posOf(o), o) : [71, bar + 71]; return paintClock(x, P[0], P[1], text, o, PX); }
    const P = posOf(o) ? screenPos(S, posOf(o), o) : [DW - 56, DH - bar]; return paintClock(x, P[0], P[1], text, o, PX);
  });
}

/** ELAPSED-TIME TAB: S.elapsed('+1 YEAR', { at, x: 74 }) - a torn paper tab hanging from the top bar (red band, zig-zag edge) */
function elapsed(S, text, o = {}) {
  const t0 = o.at != null || o.word != null ? landed(S, startOf(S, o, F)) : -1e9;
  return item(S, 'elapsed', text, t0, untilOf(S, o), (x, t) => {
    const k = t0 < -1e8 ? 1 : E.outCubic(clamp((t - t0) * 24 / 4)); if (k <= 0) return null; const bar = barOf(S);
    x.globalAlpha = Math.min(1, k * 1.5);
    x.save(); x.beginPath(); x.rect(0, bar, DW, DH); x.clip();
    const b = paintElapsed(x, o.x ?? 74, bar - (1 - k) * 60, text, o, PX); x.restore(); return b;
  });
}

/**
 * CHECKLIST (top-right achievements): S.checklist(['CHESS', ['PIANO', 'piano'], ['12 LANGUAGES', 31.2]], { until })
 *   right-aligned gold caps with a ✓ (cap 27.5, pitch 52, 3 px outline); an item with a time / word fades + scales
 *   .85 -> 1 in 5 frames; items without one are there from the cut.
 */
function checklist(S, items, o = {}) {
  const L = items.map(it => Array.isArray(it) ? { text: it[0], at: it[1] } : typeof it === 'string' ? { text: it } : it);
  const ts = L.map(it => it.at != null || it.word != null ? landed(S, startOf(S, it, 0)) : -1e9);
  return item(S, 'checklist', L.map(i => i.text).join(', '), Math.min(...ts), untilOf(S, o), (x, t) => {
    const bar = barOf(S), P = posOf(o) ? screenPos(S, posOf(o), o) : [DW - 79, bar + 53]; let box = null;
    L.forEach((it, i) => { const t0 = ts[i], f = t0 < -1e8 ? 99 : fr(t, t0); if (f < 0) return; const k = Math.min(1, (f + 1) / 5), e = E.outQuad(k);
      const Y = P[1] + i * (o.pitch ?? 52), cap = o.cap ?? 27.5; x.save(); x.globalAlpha = e;
      const w = measure(x, '✓ ' + it.text, { cap, w: 800, track: .2 }); about(x, P[0] - w / 2, Y + cap / 2, .85 + .15 * e);
      const b = paintCheck(x, P[0], Y, it.text, { cap, mark: it.mark }, PX); x.restore();
      box = box ? { x: Math.min(box.x, b.x), y: box.y, w: Math.max(box.x + box.w, b.x + b.w) - Math.min(box.x, b.x), h: b.y + b.h - box.y } : b; });
    return box;
  });
}

/** RUBBER STAMP: S.stamp('FROZEN', { pos, theme: 'red' | 'green', rot: -4, cap: 40, word }) - slams in 3 frames (scale 1.15 -> 1, opacity .4 -> 1) */
function stamp(S, text, o = {}) {
  o = asOpts(o);
  const t0 = landed(S, startOf(S, o));
  return item(S, 'stamp', text, t0, untilOf(S, o), (x, t) => {
    const [a, s] = popAt(STAMP, t, t0); if (a <= 0) return null; const P = screenPos(S, posOf(o) ?? 'center', o); if (!P) return null;
    x.globalAlpha = a; about(x, P[0], P[1], s); return paintStamp(x, P[0], P[1], text, o, PX);
  });
}

/** PUBLIC-SERVICE BAR: S.warning(['A REAL BANK NEVER ASKS YOU TO MOVE MONEY.', 'HANG UP. CALL THE NUMBER ON YOUR CARD.']) - fades in 4 frames after the cut */
function warning(S, lines, o = {}) {
  const t0 = o.at != null || o.word != null ? landed(S, startOf(S, o, F)) : S.t0 + F;
  return item(S, 'warning', Array.isArray(lines) ? lines.join(' ') : lines, t0, untilOf(S, o), (x, t) => {
    const a = t0 < -1e8 ? 1 : fadeIn(t, t0, 4); if (a <= 0) return null; x.globalAlpha = a;
    const L = Array.isArray(lines) ? lines : String(lines).split('\n'), cap = o.cap ?? 28, h = o.h ?? Math.max(100, L.length * cap * 1.72 + cap * 2.3);
    return paintWarning(x, DW / 2, DH - barOf(S) - 20 - h, L, { ...o, h }, PX);
  });
}

/**
 * TYPED TEXT (types on one character a frame, 24 cps): S.typed('LEO · 26', { pos: [600, 700] | 'bottom', cap: 40, fam: 'sans' |
 *   'mono' | 'hand', color, glow: true, cursor: true, cps: 24, align: 'left' | 'center', at | word, until })
 */
function typed(S, text, o = {}) {
  o = asOpts(o, 'color');
  const t0 = landed(S, startOf(S, o, 0)), cps = o.cps ?? 24, str = String(text);
  return item(S, 'typed', str, t0, untilOf(S, o), (x, t) => {
    const n = t0 < -1e8 ? str.length : Math.min(str.length, Math.floor((t - t0) * cps + 1e-4) + 1); if (n <= 0 && !o.cursor) return null;
    const cap = o.cap ?? 40, fam = o.fam ?? 'sans', color = o.color ?? PAL.amber, P = screenPos(S, posOf(o) ?? 'bottom', o);
    const st = { cap, w: fam === 'hand' ? 700 : 800, fam, track: o.track ?? (fam === 'mono' ? 0 : .06), color, align: 'left', glow: o.glow === false ? null : [cap * .35, 'rgba(250,200,110,.45)', 1] };
    const full = measure(x, str, st), X = o.align === 'center' ? P[0] - full / 2 : o.align === 'right' ? P[0] - full : P[0];
    const b = drawText(x, str.slice(0, Math.max(0, n)), X, P[1], st, PX);
    if (o.cursor) { const on = n < str.length || ((fr(t, t0) - str.length) % 23) >= 9; if (on) { x.fillStyle = color; x.fillRect(X + b.w + cap * .12, P[1] - cap * 1.1, cap * .12, cap * 1.3); } }
    return { x: X, y: P[1] - cap, w: full, h: cap };
  });
}

export const OVERLAYS = { pill, options, label, counter, plusminus, icon: plusminus, tag, stat, timer, ring, clock, elapsed, checklist, stamp, warning, typed };
/** one line per overlay for the skill docs (S.<name>(...)); at / word / until on all of them */
export const OVERLAY_DOCS = {
  pill: "S.pill('STUN · HARMLESS', { theme: 'fact'|'danger'|'success'|'gadget'|'predict'|'neutral'|'chosen', word, pos: 'top'|'bottom'|[x, y]|actor|object, dx, dy, row, h: 100, small, strike: word, chosen: word, until }) - statement capsule, 3-frame pop 2 frames before the word",
  options: "S.options([{ text, word, strike, chosen, theme, h }], { pos, h: 60 }) - option pills popping one under the other; struck ones grey out, the answer in amber",
  label: "S.label('LIFE #8 · AGE 7', { sub: 'FRIDAY', corner: 'tl'|'tr'|'bl'|'br', style: 'later', until, fade: 6 }) - chapter / time label, 4-frame fade 1 frame after the cut",
  counter: "S.counter('LIVES', { value: 64 | { from, to, word, preset, land: true } | [[time, v], ...], big, pos, prefix, suffix }) - bottom-right lives counter (dip-swap-fade on a change) or the big centred count-up",
  plusminus: "S.plusminus('+'|'-', { born: actor|[x, y], word, fly: word, corner, pop: false }) - boiling pro / con corner icon (also S.icon); born big then flies to its corner in 6 frames",
  tag: "S.tag('MUG · 60.0°C', { pos: thing|[x, y, z], dx, dy: -110, style: 'amber'|'navy'|theme, word, line: false, check: true|time|word }) - small capsule pinned to a thing with a leader line; check adds the ✓ (now or on its word)",
  stat: "S.stat('GUARDS', 50 | { from, to, word, preset, land: true (ends on the word) }, { corner: 'tl'|'tr', pos, theme, cap: 53, prefix, suffix, states: [[word, { theme, value, label }]] }) - stat box (label over value)",
  timer: "S.timer({ from: '31:47:59' | seconds, dir: -1, at, format: 'hms'|'ms'|'hm', prefix }) - red countdown box flush under the top bar, ticks every 24 frames",
  ring: "S.ring({ from: 48 (counts down 1/s from the cut or at) | value: 48 | [[time|word, v], ...] | t => v, stop: word, max: 60, corner: 'tr', big: true, label: 'SEC'|false, warn: 5 }) - the countdown ring (dark disc, blue arc shrinking, number inside, red at <= warn, pulses on each change)",
  clock: "S.clock('3:52 P.M.', { style: 'box'|'mint'|'pill' }) - clock stamp flush on the bottom bar, the mint caption top-left, or a pill",
  elapsed: "S.elapsed('+1 YEAR', { at, x: 74 }) - torn paper tab hanging from the top bar",
  checklist: "S.checklist(['CHESS', ['PIANO', 'piano']], {}) - top-right gold ✓ list, items pop (5 frames) on their words",
  stamp: "S.stamp('FROZEN', { pos, theme: 'red'|'green', rot: -4, cap: 40, word }) - rubber stamp slam (3 frames)",
  warning: "S.warning(['LINE ONE.', 'LINE TWO.']) - public-service bar at the bottom, 4-frame fade",
  typed: "S.typed('LEO · 26', { pos, cap: 40, fam: 'sans'|'mono'|'hand', color, cursor, cps: 24, align, word }) - text typing on one character a frame",
};
export const HUD_DOCS = {
  counter: "{ kind: 'counter', label: 'LIVES', value: 64 | [[time|word, value], ...] | t => v, from, to, corner: 'br' } - persistent lives counter; a change dips, swaps, fades back in 5 frames",
  label: "{ kind: 'label', text, sub, from, to, fade } - a chapter label for a time range",
  icon: "{ kind: 'icon', sign: '+'|'-', from, to } - a pro / con corner icon for a time range",
  checklist: "{ kind: 'checklist', items: [[text, time|word], ...], from, to } - growing achievements list top-right",
  timer: "{ kind: 'timer', start: '31:47:59', at, dir: -1, from, to } - the red countdown across shots",
  ring: "{ kind: 'ring', start: 48, at (time|word it shows start), stop, value: [[time|word, v], ...] (instead of start), max: 60, corner, label, warn, from, to } - the countdown ring across shots (shots with hud: false hide it)",
  clock: "{ kind: 'clock', text: '6:00 P.M.', style, from, to } - a clock stamp across shots",
};

// =====================================================================================================================
// PERSISTENT HUD (a whole video): hud([...]) - each item { kind, from, to, ... }; times are numbers, or words resolved near
// `near` (default `from`). A shot with hud: false hides it.
// =====================================================================================================================
let HUD = null;
/** set the video's persistent HUD items (from a scene file or models.js) */
export function hud(items) { HUD = items; return items; }
const gwhen = (S, it, v, lead = 0) => { if (v == null || typeof v === 'number') return v; it._c ??= {}; const key = JSON.stringify(v); if (it._c[key] == null) it._c[key] = typeof v === 'string' ? S.at(v, { near: it.near ?? it.from ?? 0 }) - lead : when(S, v, lead); return it._c[key]; };
export function globalHud(S, t) {
  const items = HUD ?? SETTINGS.hud?.items ?? [];
  if (S.def.hud === false) return [];
  return items.filter(it => (gwhen(S, it, it.from) ?? -1e9) <= t && t < (gwhen(S, it, it.to) ?? 1e9)).map(it => HUD_KINDS[it.kind || 'counter']?.(it, S)).filter(Boolean);
}
const hudItem = (S, what, text, draw) => ({ what: 'hud', text, t0: -1e9, draw(x, t) { x.setTransform(PX, 0, 0, PX, 0, 0); const b = draw(x, t); this.box = b ? { x: b.x * PX, y: b.y * PX, w: b.w * PX, h: b.h * PX } : null; } });
export const HUD_KINDS = {
  /** LIVES: 64 bottom-right. value: number | [[time, value], ...] (a change dips 8 frames, swaps, fades back in 5) | t => v; label, cap, corner */
  counter: (it, S) => hudItem(S, 'counter', it.label, (x, t) => {
    const val = it.value, ch = Array.isArray(val) ? val.slice(1).map(([tt]) => gwhen(S, it, tt)) : [];
    let a = it.alpha ?? 1;
    for (const c of ch) if (it.dip !== false && t >= c - 8 * F && t < c + 5 * F) a *= t < c ? lerp(1, .15, clamp((t - (c - 8 * F)) * 24 / 2)) : lerp(.15, 1, clamp((t - c) * 24 / 5 + .2));
    let v = val; if (Array.isArray(val)) { v = val[0]?.[1]; val.forEach(([tt, vv]) => { if (t >= gwhen(S, it, tt)) v = vv; }); } else if (typeof val === 'function') v = val(t);
    const s = `${it.label ? it.label + ': ' : ''}${format(v ?? '', it)}`, bar = barOf(S), cr = it.corner ?? 'br';
    x.globalAlpha = a;
    return paintLives(x, cr.endsWith('l') ? 89 : DW - 89, cr.startsWith('t') ? bar + 57 + (it.cap ?? 26) : DH - bar - 57, s, { cap: it.cap, align: cr.endsWith('l') ? 'left' : 'right' }, PX);
  }),
  /** a chapter label for a time range: { kind: 'label', text, sub, from, to, corner } (fades in 4 frames 1 frame after from) */
  label: (it, S) => hudItem(S, 'label', it.text, (x, t) => {
    const t0 = gwhen(S, it, it.from) ?? -1e9, t1 = gwhen(S, it, it.to), a = (t0 < -1e8 ? 1 : fadeIn(t, t0 + F, 4)) * (it.fade ? fadeOut(t, t1, it.fade) : 1); if (a <= 0) return null;
    x.globalAlpha = a; const bar = barOf(S), cr = it.corner ?? 'tl';
    return paintLabel(x, cr.endsWith('r') ? DW - 76 : 76, bar + 40, it.text, { ...it, align: cr.endsWith('r') ? 'right' : 'left' }, PX);
  }),
  /** a pro / con corner icon for a time range: { kind: 'icon', sign: '+' | '-', from, to } (pops 3 frames after from) */
  icon: (it, S) => hudItem(S, 'icon', it.sign, (x, t) => {
    const t0 = (gwhen(S, it, it.from) ?? -1e9) + 3 * F, plus = it.sign !== '-', bar = barOf(S), cr = it.corner ?? (plus ? 'tl' : 'tr');
    const [, s] = it.pop === false ? [1, 1] : popAt(SWAP, t, t0); if (s <= 0) return null;
    const P = [cr.endsWith('l') ? 150 : DW - 150, bar + 116]; about(x, P[0], P[1], s);
    return paintIcon(x, P[0], P[1], { r: it.r ?? 72, sign: it.sign, frame: fr(t, 0) }, PX);
  }),
  /** achievements top-right: { kind: 'checklist', items: [[text, time], ...], from, to } */
  checklist: (it, S) => hudItem(S, 'checklist', '', (x, t) => {
    const bar = barOf(S); let box = null;
    (it.items || []).forEach((e, i) => { const [text, tt] = Array.isArray(e) ? e : [e, null]; const t0 = tt == null ? -1e9 : gwhen(S, it, tt); const f = t0 < -1e8 ? 99 : fr(t, t0); if (f < 0) return;
      const k = E.outQuad(Math.min(1, (f + 1) / 5)), Y = bar + 53 + i * 52; x.save(); x.globalAlpha = k;
      const w = measure(x, '✓ ' + text, { cap: 27.5, w: 800, track: .2 }); about(x, DW - 79 - w / 2, Y + 14, .85 + .15 * k);
      const b = paintCheck(x, DW - 79, Y, text, {}, PX); x.restore(); box = box ? { x: Math.min(box.x, b.x), y: box.y, w: DW - 79 - Math.min(box.x, b.x), h: b.y + b.h - box.y } : b; });
    return box;
  }),
  /** the red countdown top-right: { kind: 'timer', start: '31:47:59', at: (the time that value shows), dir: -1, from, to } */
  timer: (it, S) => hudItem(S, 'timer', '', (x, t) => {
    const ref = gwhen(S, it, it.at ?? it.from) ?? 0, sec = parseClock(it.start ?? 0) + (it.dir ?? -1) * Math.floor(t - ref + 1e-6);
    return paintTimer(x, DW - 54, barOf(S), (it.prefix ?? '') + clockText(sec, it.format ?? 'hms'), it, PX);
  }),
  /** the countdown ring across shots: { kind: 'ring', start: 48, at, stop, value, max, corner, label, warn, from, to } */
  ring: (it, S) => hudItem(S, 'ring', '', (x, t) => {
    it._spec ??= ringSpec(S, { ...it, from: it.start, at: it.at ?? it.from }, v => gwhen(S, it, v));
    // fades in like the counters (4 frames from 1 frame after its `from`): it popped on in one frame (video 02, 6 cuts)
    const tf = gwhen(S, it, it.from); if (tf != null) x.globalAlpha *= fadeIn(t, tf + F, 4);
    const { v, tc } = it._spec(t), [r, cx, cy] = ringAt(S, it, barOf(S)), pulse = 1 + .08 * (1 - clamp((t - tc) * 24 / 4));
    return paintRing(x, cx, cy, r, v, it, pulse, PX);
  }),
  /** a clock stamp for a time range: { kind: 'clock', text, style, from, to } */
  clock: (it, S) => hudItem(S, 'clock', it.text, (x) => { const bar = barOf(S); return it.style === 'mint' ? paintClock(x, 71, bar + 71, it.text, it, PX) : paintClock(x, DW - 56, DH - bar, it.text, it, PX); }),
};

// ---------- captions (off by default: the references burn none - key words become pills instead) ----------
export function chunkWords(WORDS, o = {}) {
  const max = o.words ?? SETTINGS.captions?.words ?? 4, out = []; let cur = null;
  for (const w of WORDS) { const tx = String(w.w).trim(); if (!tx) continue; if (!cur) cur = { s: w.s - .08, e: w.e, words: [tx] }; else if (cur.words.length < max) { cur.words.push(tx); cur.e = w.e; } else { out.push(cur); cur = { s: w.s - .08, e: w.e, words: [tx] }; } if (/[.!?,]$/.test(tx)) { out.push(cur); cur = null; } }
  if (cur) out.push(cur);
  for (let i = 0; i < out.length; i++) { const n = out[i + 1]; out[i].text = out[i].words.join(' '); out[i].until = n ? Math.min(n.s, out[i].e + .5) : out[i].e + .5; }
  return out;
}
export function drawCaption(x, c) {
  const size = 46 * PX * (SETTINGS.captions?.size ?? 1), y = FH * (SETTINGS.captions?.y ?? .86);
  x.font = `800 ${size}px ${SANS}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  x.strokeStyle = '#1a1210'; x.lineWidth = size * .16; x.strokeText(c.text, FW / 2, y); x.fillStyle = PAL.cream; x.fillText(c.text, FW / 2, y);
  const w = x.measureText(c.text).width; return { x: FW / 2 - w / 2, y: y - size * .7, w, h: size * 1.4 };
}
void C; void pillSize; void statSize; void theme;
