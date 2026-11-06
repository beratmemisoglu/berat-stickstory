// Drawn expression faces (original, never photos of people): painted on a small canvas that the face mask of every
// person shows (lib/actor.js). Low resolution on purpose: it reads like the low-res game textures of the style.
// Layout comes from the head: eyes (u, v of each eye centre), mouth v, face width; all in 0..1 of the mask.
export const EXPRESSIONS = ['neutral', 'happy', 'grin', 'smug', 'shocked', 'scared', 'angry', 'sad', 'crying', 'grimace', 'thinking', 'worried', 'disgust', 'sleep', 'dead', 'wink', 'yell', 'talk', 'laugh', 'blink'];
const P = {   // per expression: brow tilt (+ = inner end up), brow lift, eye open (0..1.4), pupil size, look [x, y], mouth kind
  neutral: { tilt: 0, lift: 0, open: 1, pupil: 1, mouth: 'line' },
  talk: { tilt: 0, lift: .02, open: 1, pupil: 1, mouth: 'open' },
  happy: { tilt: .05, lift: .03, open: .8, pupil: 1, mouth: 'smile', ms: 1.15 },
  grin: { tilt: .02, lift: .03, open: .62, pupil: 1, mouth: 'grin', ms: 1.35 },
  smug: { tilt: -.12, lift: -.01, open: .55, pupil: 1, look: [.15, 0], mouth: 'smirk' },
  shocked: { tilt: .2, lift: .14, open: 1.5, pupil: .5, mouth: 'o', ms: 1.6, es: 1.25 },
  scared: { tilt: .45, lift: .1, open: 1.4, pupil: .5, mouth: 'wobble', ms: 1.3, es: 1.2 },
  angry: { tilt: -.6, lift: -.05, open: .75, pupil: .9, mouth: 'shout', ms: 1.35 },
  yell: { tilt: -.55, lift: -.02, open: 1.15, pupil: .75, mouth: 'yell', ms: 1.6, es: 1.1 },
  sad: { tilt: .6, lift: .02, open: .7, pupil: 1, look: [0, -.3], mouth: 'frown', ms: 1.15 },
  crying: { tilt: .65, lift: .03, open: .4, pupil: 1, mouth: 'cry', tears: true, ms: 1.35 },
  grimace: { tilt: .3, lift: 0, open: .55, pupil: .9, mouth: 'teeth', ms: 1.3 },
  thinking: { tilt: -.1, lift: .03, open: .85, pupil: 1, look: [.35, .35], mouth: 'side' },
  worried: { tilt: .5, lift: .06, open: 1.1, pupil: .8, look: [-.25, 0], mouth: 'wobble', ms: 1.1 },
  disgust: { tilt: -.25, lift: -.02, open: .6, pupil: 1, mouth: 'disgust' },
  sleep: { tilt: 0, lift: -.01, open: 0, pupil: 1, mouth: 'line' },
  dead: { tilt: 0, lift: 0, open: -1, pupil: 1, mouth: 'line' },
  wink: { tilt: .05, lift: .02, open: .9, pupil: 1, mouth: 'smirk', wink: true },
};
// ---------- the generated face sheet (library face.sheet1): the default look of every face ----------
// A 3x3 sheet of eyes + brows + mouths, keyed to alpha. An expression = the eye half of one cell + the mouth half of
// another, each scaled by the eye distance (no stretching) and placed on the head's own eye and mouth positions.
// (The old faces were drawn with canvas strokes over a head that kept its modelled lips: a double mouth, uncanny.)
export let SHEET = null;
const CELL = { neutral: 0, shocked: 1, grin: 2, grimace: 3, crying: 4, smug: 5, scared: 6, thinking: 7, laughing: 8 };
const RECIPE = {   // eyes cell, mouth cell, [mouth scale], [eyesR: right-eye cell for a wink]
  neutral: [0, 0], talk: [0, 1, .62], happy: [2, 2, .85], grin: [2, 2], laugh: [8, 8], laughing: [8, 8], smug: [5, 5], shocked: [1, 1], scared: [6, 6],
  worried: [6, 0], angry: [3, 3], yell: [3, 1, 1.1], sad: [6, 4], crying: [4, 4], grimace: [6, 3], thinking: [7, 7], disgust: [5, 6], sleep: [8, 0],
  dead: [8, 4, .8], wink: [0, 5, 1, 8], blink: [8, 0],
};
export async function loadFaceSheet(lib, entry) {
  const e = entry('face.sheet1'); if (!e) return null;
  const img = new Image(); img.src = lib + e.file;
  try { await img.decode(); } catch { console.warn('face sheet not loaded: drawn faces'); return null; }
  return SHEET = { img, cells: e.cells, n: e.grid?.[0] || 3 };
}
function drawFromSheet(x, w, h, name, L) {
  const r = RECIPE[name] || (CELL[name] != null ? [CELL[name], CELL[name]] : RECIPE.neutral), { img, cells, n } = SHEET, cw = img.width / n, ch = img.height / (2 * n);
  const eyes = L.eyes || [[.34, .56], [.66, .56]], te = eyes.map(([u, v]) => [u * w, (1 - v) * h]);
  const tdx = Math.hypot(te[1][0] - te[0][0], te[1][1] - te[0][1]), tmx = (te[0][0] + te[1][0]) / 2, tmy = (te[0][1] + te[1][1]) / 2;
  // one cell of a layer (0 eyes, 1 mouth), its point (ax, ay) (cell units) placed at (tx, ty), uniform scale from the eye distance
  const put = (layer, k, ax, ay, tx, ty, scale = 1, xs0 = 0, xs1 = 1) => { const c = cells[k], s = tdx * (L.featureScale ?? .95) / ((c.eyes[1][0] - c.eyes[0][0]) * cw) * scale;   // (at the modelled eye spacing the sheet's eyes were goggles)
    const sx = (k % n) * cw, sy = (Math.floor(k / n) + layer * n) * ch;
    const sy2 = s / (L.aspect ?? 1);                                       // the face box is taller than wide: canvas px are not square on the head
    x.drawImage(img, sx + xs0 * cw, sy, (xs1 - xs0) * cw, ch, tx + (xs0 - ax) * cw * s, ty - ay * ch * sy2, (xs1 - xs0) * cw * s, ch * sy2); };
  x.clearRect(0, 0, w, h); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  const eyeAt = (k, xs0, xs1) => { const c = cells[k]; put(0, k, (c.eyes[0][0] + c.eyes[1][0]) / 2, (c.eyes[0][1] + c.eyes[1][1]) / 2, tmx, tmy, 1, xs0, xs1); };
  if (r[3] != null) { eyeAt(r[0], 0, .5); eyeAt(r[3], .5, 1); } else eyeAt(r[0], 0, 1);
  // the mouth: its centre on the head's mouth line, under the eye midpoint (the modelled lips are flattened under it)
  const m = cells[r[1]].mouth; if (m) put(1, r[1], (m[0] + m[2]) / 2, (m[1] + m[3]) / 2, tmx, L.mouthV != null ? (1 - L.mouthV) * h : tmy + tdx * (L.mouthK ?? .8), r[2] ?? 1);
}
/** Draws expression `name` on ctx (w x h, transparent background) for a face layout. */
export function drawFace(x, w, h, name = 'neutral', L = {}, o = {}) {
  if (SHEET && !o.drawn) return drawFromSheet(x, w, h, name, L);
  const p = P[name] || P.neutral;
  const eyes = L.eyes || [[.34, .56], [.66, .56]], mouthV = L.mouth ?? .26, eyeR = (L.eyeR ?? .085) * w * (p.es ?? 1);
  const ink = o.ink || '#2a1a14', iris = o.iris || '#4a2e1c', lip = o.lip || '#9c4a3e', sclera = '#f4efe8';
  x.clearRect(0, 0, w, h); x.lineCap = 'round'; x.lineJoin = 'round';
  const Y = v => (1 - v) * h, X = u => u * w;
  // brows
  eyes.forEach(([u, v], i) => {
    const s = i ? 1 : -1, bx = X(u), by = Y(v + .11 + p.lift), half = eyeR * 1.4, inner = bx - s * half, outer = bx + s * half, tl = p.tilt * eyeR * 1.9;
    x.strokeStyle = o.brow || ink; x.lineWidth = Math.max(3, w * .05);      // bold brows: the expression has to read at 270 px
    x.beginPath(); x.moveTo(inner, by - tl); x.quadraticCurveTo(bx, by - eyeR * .35 - (p.tilt > 0 ? tl * .4 : 0), outer, by + tl * .3); x.stroke();
  });
  // eyes
  eyes.forEach(([u, v], i) => {
    const cx = X(u), cy = Y(v), rx = eyeR * 1.05, open = (p.wink && i === 1) ? 0 : p.open, ry = eyeR * .62 * Math.max(0, open);
    if (open <= 0) {                                                  // closed (sleep / wink) or dead (x x)
      x.strokeStyle = ink; x.lineWidth = Math.max(2, w * .025);
      if (open < 0) { const d = eyeR * .6; x.beginPath(); x.moveTo(cx - d, cy - d); x.lineTo(cx + d, cy + d); x.moveTo(cx + d, cy - d); x.lineTo(cx - d, cy + d); x.stroke(); }
      else { x.beginPath(); x.moveTo(cx - rx, cy); x.quadraticCurveTo(cx, cy + eyeR * .45, cx + rx, cy); x.stroke(); }
      return;
    }
    x.fillStyle = sclera; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill();
    x.save(); x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.clip();
    const lx = cx + (p.look?.[0] ?? 0) * rx * .5, ly = cy - (p.look?.[1] ?? 0) * ry * .5, ir = eyeR * .58 * (open > 1.2 ? .85 : 1);
    x.fillStyle = o.irisColor || iris; x.beginPath(); x.arc(lx, ly, ir, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#100806'; x.beginPath(); x.arc(lx, ly, ir * .5 * p.pupil, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(lx - ir * .45, ly - ir * .55, Math.max(1, ir * .35), Math.max(1, ir * .35));
    x.restore();
    x.strokeStyle = ink; x.lineWidth = Math.max(1.5, w * .022);                                  // upper lid
    x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
    if (p.tears) { x.fillStyle = 'rgba(120,190,255,.9)'; x.fillRect(cx - eyeR * .2, cy + ry, eyeR * .35, eyeR * 2.2); }
  });
  // mouth
  { const nv = (eyes[0][1] + mouthV) / 2 - .02; x.strokeStyle = 'rgba(80,30,20,.35)'; x.lineWidth = Math.max(2, w * .022);   // nose shade (structure in the middle of the face)
    x.beginPath(); x.moveTo(X(.5) + w * .012, Y(nv + .07)); x.lineTo(X(.5) + w * .028, Y(nv)); x.lineTo(X(.5) - w * .02, Y(nv - .005)); x.stroke(); }
  const mx = X(.5), my = Y(mouthV), mw = w * (L.mouthW ?? .2) * (p.ms ?? 1);
  x.strokeStyle = lip; x.fillStyle = '#3a0f0c'; x.lineWidth = Math.max(2, w * .028);
  const teeth = (y0, hh, ww) => { x.fillStyle = '#f2ede4'; x.fillRect(mx - ww / 2, y0, ww, hh); };
  switch (p.mouth) {
    case 'line': x.beginPath(); x.moveTo(mx - mw * .5, my); x.quadraticCurveTo(mx, my + mw * .04, mx + mw * .5, my); x.stroke(); break;
    case 'smile': x.beginPath(); x.moveTo(mx - mw * .55, my - mw * .1); x.quadraticCurveTo(mx, my + mw * .35, mx + mw * .55, my - mw * .1); x.stroke(); break;
    case 'grin': x.beginPath(); x.moveTo(mx - mw * .6, my - mw * .12); x.quadraticCurveTo(mx, my + mw * .55, mx + mw * .6, my - mw * .12); x.closePath(); x.fill(); teeth(my - mw * .1, mw * .16, mw * .9); x.stroke(); break;
    case 'smirk': x.beginPath(); x.moveTo(mx - mw * .45, my + mw * .02); x.quadraticCurveTo(mx + mw * .1, my + mw * .08, mx + mw * .55, my - mw * .16); x.stroke(); break;
    case 'o': x.beginPath(); x.ellipse(mx, my, mw * .22, mw * .32, 0, 0, Math.PI * 2); x.fill(); x.stroke(); break;
    case 'open': x.beginPath(); x.ellipse(mx, my, mw * .32, mw * .14, 0, 0, Math.PI * 2); x.fill(); x.stroke(); break;
    case 'shout': case 'yell': { const k = p.mouth === 'yell' ? 1.4 : 1; x.beginPath(); x.moveTo(mx - mw * .45, my - mw * .12 * k); x.lineTo(mx + mw * .45, my - mw * .12 * k); x.lineTo(mx + mw * .3, my + mw * .3 * k); x.lineTo(mx - mw * .3, my + mw * .3 * k); x.closePath(); x.fill(); teeth(my - mw * .12 * k, mw * .1, mw * .8); x.stroke(); break; }
    case 'frown': x.beginPath(); x.moveTo(mx - mw * .5, my + mw * .12); x.quadraticCurveTo(mx, my - mw * .22, mx + mw * .5, my + mw * .12); x.stroke(); break;
    case 'cry': x.beginPath(); x.moveTo(mx - mw * .5, my + mw * .18); x.quadraticCurveTo(mx, my - mw * .3, mx + mw * .5, my + mw * .18); x.quadraticCurveTo(mx, my - mw * .05, mx - mw * .5, my + mw * .18); x.fill(); x.stroke(); break;
    case 'teeth': x.beginPath(); x.rect(mx - mw * .5, my - mw * .1, mw, mw * .22); x.fill(); teeth(my - mw * .08, mw * .18, mw * .94); x.strokeStyle = '#b9b2a6'; x.lineWidth = 1; for (let k = -2; k <= 2; k++) { x.beginPath(); x.moveTo(mx + k * mw * .18, my - mw * .08); x.lineTo(mx + k * mw * .18, my + mw * .1); x.stroke(); } x.strokeStyle = lip; x.lineWidth = Math.max(2, w * .028); x.strokeRect(mx - mw * .5, my - mw * .1, mw, mw * .22); break;
    case 'wobble': x.beginPath(); x.moveTo(mx - mw * .5, my + mw * .05); for (let k = 1; k <= 6; k++) x.lineTo(mx - mw * .5 + k * mw / 6, my + (k % 2 ? -1 : 1) * mw * .07); x.stroke(); break;
    case 'side': x.beginPath(); x.moveTo(mx - mw * .1, my); x.lineTo(mx + mw * .45, my - mw * .05); x.stroke(); break;
    case 'disgust': x.beginPath(); x.moveTo(mx - mw * .5, my - mw * .05); x.lineTo(mx - mw * .15, my + mw * .1); x.lineTo(mx + mw * .2, my - mw * .02); x.lineTo(mx + mw * .5, my + mw * .12); x.stroke(); break;
  }
}
