// Project helpers built from the collage engine's primitives (this file is the project's own copy: add yours here).
import { drawn, label, headline, C, FONTS, clamp, easeOut, lerp, fmt } from './engine.js';

// gauge(P, { x, y, size, from, to, max, unit, at, dur }): a round dial whose needle swings up to a value (speed, output)
export function gauge(P, o = {}) {
  const max = o.max ?? 100, from = o.from ?? 0, to = o.to ?? max * .7, size = o.size ?? 3;
  return drawn(P, { name: 'gauge', x: o.x ?? 0, y: o.y ?? 0, w: size, h: size, at: o.at ?? 0, animDur: o.dur ?? 1.4, rot: o.rot ?? 0,
    key: t => Math.round(clamp((t - (o.at ?? 0)) / (o.dur ?? 1.4)) * 90),
    draw: (x, k, t, W, H) => {
      const cx = W / 2, cy = H / 2, R = W * .46;
      x.fillStyle = C.light; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
      x.strokeStyle = C.ink; x.lineWidth = W * .025; x.stroke();
      const a0 = Math.PI * .75, a1 = Math.PI * 2.25;
      for (let i = 0; i <= 10; i++) { const a = lerp(a0, a1, i / 10); x.lineWidth = i % 5 ? W * .006 : W * .012; x.beginPath(); x.moveTo(cx + Math.cos(a) * R * .78, cy + Math.sin(a) * R * .78); x.lineTo(cx + Math.cos(a) * R * .9, cy + Math.sin(a) * R * .9); x.stroke(); }
      x.fillStyle = C.ink; x.font = `${Math.round(W * .07)}px ${FONTS.typewriter}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) { const a = lerp(a0, a1, i / 4); x.fillText(fmt(max * i / 4), cx + Math.cos(a) * R * .6, cy + Math.sin(a) * R * .6); }
      x.strokeStyle = C.red; x.lineWidth = W * .03; x.beginPath(); x.arc(cx, cy, R * .9, lerp(a0, a1, .78), a1); x.stroke();
      const v = lerp(from, to, easeOut(k)), a = lerp(a0, a1, v / max);
      x.strokeStyle = C.red; x.lineWidth = W * .02; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * R * .72, cy + Math.sin(a) * R * .72); x.stroke();
      x.fillStyle = C.ink; x.beginPath(); x.arc(cx, cy, W * .04, 0, Math.PI * 2); x.fill();
      if (o.unit) { x.font = `700 ${Math.round(W * .05)}px ${FONTS.condensed}`; x.fillText(o.unit.toUpperCase(), cx, cy + R * .8); }
    } });
}

// row(n, { x0, x1, y }) -> [[x, y], ...]: n evenly spaced positions (for rows of cut-outs or plus-sign equations)
export const row = (n, { x0 = -5, x1 = 5, y = 0 } = {}) => Array.from({ length: n }, (_, i) => [n === 1 ? (x0 + x1) / 2 : lerp(x0, x1, i / (n - 1)), y]);

// equation(P, [a, b, c], { y, at, gap, captions }): "metal type + ink + press" - cut-outs joined by red plus signs
export function plusSign(P, o = {}) {
  return headline(P, '+', { x: o.x ?? 0, y: o.y ?? 0, size: o.size ?? .9, font: 'heavy', color: C.red, anim: 'grow', at: o.at ?? 0, dur: .3, sfx: 'pop' });
}
