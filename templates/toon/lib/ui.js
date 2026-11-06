// 2D on top of the 3D: captions (the studied ones: a heavy rounded white sans with a wide dark stroke and a soft shadow,
// centred at 70.5 % of the height, 1-2 words, on 3 frames before the word, swapped instantly, never animated) and a
// few overlay marks (label with a leader line, a red X, an arrow). Everything else is IN the world: signs, posters,
// screens and counters are props (references: no overlay graphics; facts live on in-world signs).
import { SETTINGS, FW, FH, VERT, C, clamp, seg, E } from './core.js';

export const FONT_FILES = [['Inter', 'fonts/inter-800.woff2', '800', 'normal'], ['Inter', 'fonts/inter-600.woff2', '600', 'normal']];
const LEAD = 3 / 30;                                    // captions appear 3 frames before the word
const GLUE = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'and', 'or', 'but', 'so', 'is', 'it', 'its', "it's", 'i', 'you', 'your', 'my', 'his', 'her', 'their', 'our', 'we', 'he', 'she', 'they', 'for', 'by', 'with', 'from', 'as', 'be', 'was', 'are', 'that', 'this', 'just', 'no', 'not', 'up', 'out', 'into', 'if', 'than', 'then', 'can', "can't", 'do', "don't", 'all']);
const strip = w => String(w).toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
/** narration words -> caption chunks: 1-2 words (a short function word is glued to the next), never more than ~15 chars */
export function chunkWords(WORDS, o = {}) {
  const max = o.words ?? SETTINGS.captions?.words ?? 2, maxCh = o.chars ?? 15;
  const out = []; let cur = null;
  const end = () => { if (cur) { out.push(cur); cur = null; } };
  for (let i = 0; i < WORDS.length; i++) {
    const w = WORDS[i], text = String(w.w).trim(); if (!text) continue;
    const sentenceEnd = /[.!?…]["”']?$/.test(text), comma = /[,;:]$/.test(text);
    if (!cur) cur = { s: w.s - LEAD, e: w.e, words: [text], idx: [i] };
    else if (cur.words.length < max && (cur.words.join(' ') + ' ' + text).length <= maxCh) { cur.words.push(text); cur.e = w.e; cur.idx.push(i); }
    else { end(); cur = { s: w.s - LEAD, e: w.e, words: [text], idx: [i] }; }
    const glueNext = GLUE.has(strip(text)) && cur.words.length < max && !sentenceEnd && !comma;
    if (sentenceEnd || comma || (!glueNext && cur.words.length >= 1 && !(GLUE.has(strip(cur.words[0])) && cur.words.length === 1))) end();
  }
  end();
  // a chunk stays until the next one appears (no flicker gaps inside a sentence); after a long pause it clears
  for (let i = 0; i < out.length; i++) { const n = out[i + 1]; out[i].text = out[i].words.join(' '); out[i].until = n ? (n.s - out[i].e < .7 ? n.s : out[i].e + .35) : out[i].e + .5; }
  return out;
}
/** draw a caption chunk; returns its box */
export function drawCaption(x, c, o = {}) {
  const size = Math.round((VERT ? 72 : 64) * (SETTINGS.captions?.size ?? 1) * FW / (VERT ? 1080 : 1920) * (VERT ? 1 : 1.35));
  const y = FH * (SETTINGS.captions?.y ?? (VERT ? .705 : .8));
  const text = (SETTINGS.captions?.case === 'upper' ? c.text.toUpperCase() : c.text);
  x.save();
  x.font = `800 ${size}px Inter, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.miterLimit = 2;
  const w = x.measureText(text).width;
  // soft shadow, then a wide dark stroke, then a white round-join stroke that rounds and thickens the glyphs
  x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = size * .18; x.shadowOffsetY = size * .06;
  x.strokeStyle = C.captionStroke; x.lineWidth = size * .2; x.strokeText(text, FW / 2, y);
  x.shadowColor = 'transparent';
  x.strokeStyle = C.caption; x.lineWidth = size * .055; x.strokeText(text, FW / 2, y);
  x.fillStyle = C.caption; x.fillText(text, FW / 2, y);
  x.restore();
  return { x: FW / 2 - w / 2 - size * .2, y: y - size * .7, w: w + size * .4, h: size * 1.4 };
}

// ---------- overlay marks (sparingly: the world carries the facts) ----------
/** a label with a leader line pointing at a screen point: label('Hypnagogia', { at: () => S.screen(obj), t0, t1 }) */
export function label(text, o = {}) {
  return { what: 'label', text, t0: o.t0, t1: o.t1, draw(x, t) {
    const k = E.outCubic(seg(t, this.t0, this.t0 + 7 / 30)); if (k <= 0) return;
    const [px, py] = typeof o.at === 'function' ? o.at() : o.at || [FW / 2, FH / 2];
    const lx = o.x ?? (px > FW / 2 ? px - FW * .28 : px + FW * .28), ly = o.y ?? py - FH * .08, size = Math.round(FW * .05);
    x.globalAlpha = k; x.strokeStyle = '#fff'; x.lineWidth = FW * .005; x.lineCap = 'round';
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (lx - px) * k, py + (ly - py) * k); x.stroke();
    x.beginPath(); x.arc(px, py, FW * .009, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill();
    x.font = `800 ${size}px Inter, Arial`; x.textAlign = lx < px ? 'right' : 'left'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = size * .2; x.strokeStyle = '#000'; x.strokeText(text, lx, ly - size * .6); x.fillText(text, lx, ly - size * .6);
    const tw = x.measureText(text).width; this.box = { x: lx < px ? lx - tw : lx, y: ly - size * 1.2, w: tw, h: size * 1.3 };
    x.globalAlpha = 1;
  } };
}
/** an arrow from a to b (screen points or functions) */
export function arrow(o = {}) {
  return { what: 'arrow', t0: o.t0, t1: o.t1, draw(x, t) {
    const A = typeof o.from === 'function' ? o.from() : o.from, B = typeof o.to === 'function' ? o.to() : o.to, k = E.outCubic(seg(t, this.t0, this.t0 + 8 / 30)); if (k <= 0 || !A || !B) return;
    const ex = A[0] + (B[0] - A[0]) * k, ey = A[1] + (B[1] - A[1]) * k, an = Math.atan2(B[1] - A[1], B[0] - A[0]), w = FW * .012;
    x.strokeStyle = o.color || '#fff'; x.fillStyle = o.color || '#fff'; x.lineWidth = w; x.lineCap = 'round';
    x.beginPath(); x.moveTo(A[0], A[1]); x.lineTo(ex, ey); x.stroke();
    x.beginPath(); x.moveTo(ex + Math.cos(an) * w * 2, ey + Math.sin(an) * w * 2); x.lineTo(ex + Math.cos(an + 2.5) * w * 3, ey + Math.sin(an + 2.5) * w * 3); x.lineTo(ex + Math.cos(an - 2.5) * w * 3, ey + Math.sin(an - 2.5) * w * 3); x.fill();
  } };
}
void clamp;
