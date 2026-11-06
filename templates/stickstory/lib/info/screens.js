// Full-screen graphics that are SCREENS: the typed terminal, big full-screen numbers / statements, the title card, the
// end card, news broadcasts (lower thirds, ticker, badges, TV bezel) and CCTV feeds. Measured on the references
// (analysis/graphics/NOTES.md 3h, 3i, 3g, 3l, 3m); every timing in frames at 24 fps from absolute times.
import { THREE, FPS, clamp, lerp, seg, E, hash, rnd } from '../core.js';
import * as P from './paint.js';
import { U, fmat, paintCard, textCard, gline, circlePts, anim, setAlpha, popIn, fadeIn, growIn, makeBoard } from './kit.js';

const F = 1 / FPS;
const T = (S, v, lead = 0) => P.when(S, v, lead);
const overlay = (S, what, text, t0, t1, draw) => S.over({ what, text, t0: t0 > -1e8 ? t0 : S.t0, t1: t1 ?? null, draw(x, t) {
  x.setTransform(P.PX, 0, 0, P.PX, 0, 0); const b = draw(x, t); this.box = b ? { x: b.x * P.PX, y: b.y * P.PX, w: b.w * P.PX, h: b.h * P.PX } : null; } });
const barOf = S => (S?._bar ?? 60) / P.PX;

// =====================================================================================================================
// TERMINAL: navy screen, JetBrains Mono caps (cap 88, advance 74, margin 150, pitch 164, +54 between paragraphs),
// 1 character a frame, a block cursor (66 x 120) that blinks 9 frames off / 14 on when a line is done, the block kept
// centred and scrolling up in 6 frames (ease in-out) on every new line, scanlines every 6 px, a soft glow.
// =====================================================================================================================
function wrap(text, max) {
  const out = []; let cur = '';
  for (const w of String(text).split(/\s+/).filter(Boolean)) { if (!cur) cur = w; else if ((cur + ' ' + w).length <= max) cur += ' ' + w; else { out.push(cur); cur = w; } }
  if (cur) out.push(cur); return out.length ? out : [''];
}
export function terminal(S, o = {}) {
  const B = makeBoard(S, { bg: o.bg ?? ['#1b2a50', '#0c1329'], bgR: .5, kind: 'terminal' });
  const cap = o.cap ?? 88, adv = o.adv ?? 74, margin = o.margin ?? 150, pitch = o.pitch ?? 164, gap = o.gap ?? 54, cps = o.cps ?? 24;
  const maxC = o.maxChars ?? 18, color = o.color ?? '#dfe6f1';
  const paras = (o.lines ?? String(o.text ?? '').split('\n')).map(p => typeof p === 'string' ? { text: p } : p);
  // schedule: cursor 3 frames after the cut (or `at`), first character 1 frame later; a wrapped line continues after
  // the 6-frame scroll + 1; a new paragraph after `pause` seconds (or its own at / word)
  const start = o.at != null || o.word != null ? T(S, o.word ?? o.at, 0) : S.t0 + 3 * F;
  const lines = []; let t = start + F, y = 0;
  paras.forEach((p, pi) => {
    if (pi) { const own = p.at != null || p.word != null ? T(S, p.word ?? p.at, 2 * F) : null; t = own ?? t + (p.pause ?? o.pause ?? .9); y += gap; }
    wrap(p.text.toUpperCase?.() ?? p.text, maxC).forEach((tx, li) => { if (li) { t += 7 * F; } if (pi || li) y += pitch; lines.push({ text: o.upper === false ? tx : tx.toUpperCase(), t0: t, y }); t += tx.length / cps; });
  });
  const st = { cap, w: 700, fam: 'mono', track: 0, color, glow: [7, 'rgba(170,195,240,.55)', 2] };
  // the block: children in "block px" (x = frame px, y = px under the first line's cap top); the block's top follows
  // the centring of the lines started so far
  const block = new THREE.Group(); B.put(block, 960, 540);
  const size = cap / P.capK('mono'), scr = document.createElement('canvas').getContext('2d'); scr.font = `700 ${size}px ${P.MONO}`; scr.letterSpacing = '0px';
  st.track = (adv - scr.measureText('M').width) / size;
  // each line: a card of its full text, revealed character by character through its geometry + uv (4 vertices)
  const pad = 16, res = 1.25, base = cap * 1.45;
  for (const L of lines) {
    const W = pad * 2 + Math.max(1, L.text.length) * adv, H = cap * 1.95;
    const card = paintCard(W, H, x => P.drawText(x, L.text, pad, base, st, res), { res, anchor: 'top-left', mip: false });
    const pos = card.geometry.attributes.position, uv = card.geometry.attributes.uv;
    card.position.set((margin - pad - 960) * U, -(L.y - (base - cap)) * U, 0);
    L.reveal = n => { const w = n <= 0 ? 0 : Math.min(W, pad + n * adv + 3); for (const i of [1, 3]) { pos.setX(i, w * U); uv.setX(i, w / W); } pos.needsUpdate = true; uv.needsUpdate = true; card.visible = n > 0; };
    card.renderOrder = 12; block.add(card); L.reveal(0);
  }
  const cursor = new THREE.Mesh(new THREE.PlaneGeometry(66 * U * cap / 88, 120 * U * cap / 88), fmat(color)); cursor.renderOrder = 13; block.add(cursor);
  // scanlines (rows ~10 % darker every 6 px) over everything
  const scan = paintCard(1920, 1080, (x, w, h) => { x.fillStyle = 'rgba(0,0,10,.16)'; for (let yy = 0; yy < h; yy += 6) x.fillRect(0, yy + 3, w, 2); }, { res: 1, mip: false, noPick: true });
  B.put(scan, 960, 540, { order: 20 });
  const fade = paintCard(1920, 360, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(12,19,41,1)'); g.addColorStop(.45, 'rgba(12,19,41,.85)'); g.addColorStop(1, 'rgba(12,19,41,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }, { res: .5, mip: false, noPick: true });
  B.put(fade, 960, 60 + 120, { order: 15 });
  const centreY = o.y ?? 540, chars = (L, t) => Math.min(L.text.length, Math.max(0, Math.floor((t - L.t0) * cps + 1e-4) + 1));
  anim(block, t => {
    // the current line = the last one whose scroll (7 frames before its first character) has begun
    let cur = 0; lines.forEach((L, i) => { if (i && t >= L.t0 - 7 * F) cur = i; });
    lines.forEach((L, i) => L.reveal(i < cur ? L.text.length : i === cur ? chars(L, t) : 0));
    // keep the started lines centred: the block top eases (6 frames, in-out) to its new place on every new line
    const top = i => centreY - (lines[i].y + cap) / 2;
    let bt = lines.length ? top(0) : centreY;
    for (let i = 1; i < lines.length; i++) { const s0 = lines[i].t0 - 7 * F; if (t >= s0) bt = lerp(top(i - 1), top(i), E.inOutQuad(clamp((t - s0) * FPS / 6))); }
    block.position.y = (540 - bt) * U;
    // cursor: 3 frames after the cut, after the last character; blinks 9 off / 14 on when the line is done; hidden while scrolling
    if (!lines.length || t < start) { cursor.visible = false; return; }
    const L = lines[cur], n = chars(L, t), endT = L.t0 + L.text.length / cps, next = lines[cur + 1];
    let on = true; if (t >= endT) on = (Math.floor((t - endT) * FPS + 1e-4) % 23) >= 9;
    cursor.visible = on && !(next && t >= next.t0 - 7 * F);
    cursor.position.set((margin - 960 + n * adv + 6 + 33 * cap / 88) * U, -(L.y + 48 * cap / 88) * U, 0);
  });
  B.lines = lines; B.end = lines.length ? lines[lines.length - 1].t0 + lines[lines.length - 1].text.length / cps : start;
  B.g.userData.board = B; return B.g;
}

// =====================================================================================================================
// BIG NUMBER / STATEMENT SCREEN: "$1,000,000" cream (cap 242) on navy with a slow push; "31:47:59" red (cap 158) under
// "UNTIL MIDNIGHT TOMORROW"; "-1600 M" green in a dark box under "DEPTH". value may count (paint.js valueAt specs).
// =====================================================================================================================
const NUM_STYLES = {
  cream: { color: '#f7e1c2', glow: 'rgba(247,225,194,.12)', bg: ['#1c2236', '#0f1320'], cap: 232, label: '#e8d4b4', track: -.02 },
  red: { color: '#fc4337', glow: 'rgba(252,67,55,.55)', bg: ['#2a161a', '#140c0e'], cap: 158, label: '#e4b4b0' },
  green: { color: '#cfeee0', glow: 'rgba(120,230,170,.45)', bg: ['#2b2f34', '#151719'], cap: 130, label: '#e6c27a' },
  amber: { color: '#fad586', glow: 'rgba(250,190,90,.5)', bg: ['#1d1712', '#0d0a08'], cap: 180, label: '#e8d4b4' },
  white: { color: '#f4f1ea', glow: 'rgba(255,255,255,.2)', bg: ['#151515', '#050505'], cap: 90, label: '#c9c4bb' },
};
export function number(S, o = {}) {
  const sty = { ...NUM_STYLES[o.style ?? o.color ?? 'cream'] ?? NUM_STYLES.cream, ...(o.colors || {}) };
  const hadCam = !!S._cam, B = makeBoard(S, { bg: o.bg ?? sty.bg, kind: 'number' });
  const cap = o.cap ?? sty.cap, spec = o.value ?? o.text ?? '', fmtO = { prefix: o.prefix, suffix: o.suffix, decimals: o.decimals, sep: o.sep };
  const isSpec = spec && typeof spec === 'object';
  const valAt = t => P.format(P.valueAt(S, isSpec ? { at: S.t0, preset: 'money', ...spec } : spec, t, o), fmtO);
  const maxText = isSpec ? P.format(Math.max(Math.abs(spec.from ?? 0), Math.abs(spec.to ?? 0)), fmtO) : String(spec);
  const st = { cap, w: 800, track: o.track ?? sty.track ?? .02, color: sty.color, glow: [cap * .2, sty.glow, 2] };
  const txt = textCard(valAt(S.t0), st, { maxText: maxText + '8', res: o.res ?? 1.25 });
  const y = o.y ?? (o.label ? 560 : 540);
  if (o.box) { const bw = P.measure(document.createElement('canvas').getContext('2d'), maxText, st) + cap * 1.2, bh = cap * 1.6 + (o.label ? 90 : 0);
    const box = paintCard(bw + 20, bh + 20, (x) => { x.beginPath(); x.roundRect(10, 10, bw, bh, 16); x.fillStyle = 'rgba(10,12,12,.35)'; x.fill(); x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,.08)'; x.stroke(); }, { res: 1 });
    B.put(box, 960, y - (o.label ? 30 : 0)); }
  B.put(txt, 960, y);
  const t0 = o.at != null || o.word != null ? P.landed(S, P.startOf(S, o, 2 * F)) : -1e9;
  fadeIn(txt, t0, o.in ?? 4);
  anim(txt, t => txt.userData.setText(valAt(t)));
  if (o.label) { const lb = textCard(o.label, { cap: o.labelCap ?? 34, w: 800, track: .18, color: sty.label, glow: [10, 'rgba(0,0,0,0)', 1] }); B.put(lb, 960, y - cap / 2 - (o.labelGap ?? 70)); fadeIn(lb, t0, o.in ?? 4); }
  if (o.push !== false && !hadCam) S.camera('push', { ...B.view(), amount: typeof o.push === 'number' ? o.push : .05, dur: o.pushDur ?? Math.max(1, S.t1 - S.t0) });
  B.text = txt; B.g.userData.board = B; return B.g;
}

// =====================================================================================================================
// TITLE CARD ("What if you ...?") over any picture: first lines cream (cap 61, +.08 em), the last line amber and big
// (cap 110), a warm same-hue glow; line 1 fades in 4 frames, a thin ring shockwave expands from the centre (6 frames)
// while the last line fades + scales 1.1 -> 1.0 in 4 frames with a light band behind it. style 'outline' = the
// time-loop look (dark brown outline + shadow instead of the glow).
// =====================================================================================================================
export function title(S, o = {}) {
  const L = (o.lines ?? String(o.text ?? '').split('\n')).map(l => typeof l === 'string' ? { text: l } : l);
  const t0 = o.at != null || o.word != null ? P.landed(S, P.startOf(S, o, 0)) : S.t0 + F;
  const outline = o.style === 'outline', last = L.length - 1;
  // the picture behind a title is always soft (sister f676-764 the map, timeloop f340 the capitol, iq500 f430): with no
  // characters in the shot it is defocused and dimmed a little; blur: false keeps it sharp, a number sets the aperture
  if (o.blur !== false && !(S.actors?.length) && S.focus) { S.focus(.2, { aperture: typeof o.blur === 'number' ? o.blur : .5 }); if (!S._grade && o.dim !== false) S.grade({ bright: o.dim ?? .8 }); }
  const capS = o.cap ?? (outline ? 56 : 61), capB = o.bigCap ?? (outline ? 88 : 110);
  const sty = i => i === last && L.length > 1 ? { cap: capB, w: 800, track: outline ? -.01 : .04, color: o.amber ?? (outline ? '#f9ce66' : '#fad586') } : { cap: capS, w: 800, track: outline ? -.01 : .08, color: o.cream ?? '#fcefde' };
  const deco = (st, big) => outline ? { ...st, outline: [st.cap * .07, '#3a2622'], shadow: [0, st.cap * .05, st.cap * .1, 'rgba(20,10,5,.55)'] }
    : big ? { ...st, glow: [st.cap * .4, 'rgba(170,100,45,.8)', 2], outline: [st.cap * .035, '#5a3520'] } : { ...st, glow: [st.cap * .3, 'rgba(120,70,35,.7)', 1], shadow: [0, 2, 6, 'rgba(30,15,5,.6)'] };
  const tl = L.map((l, i) => (l.at != null || l.word != null) ? P.startOf(S, l, 2 * F) : (i === last && L.length > 1 ? t0 + 5 * F : t0));
  return overlay(S, 'title', L.map(l => l.text).join(' '), Math.min(...tl), T(S, o.until), (x, t) => {
    const P0 = o.pos ? (Array.isArray(o.pos) ? o.pos : o.pos === 'left' ? [620, 540] : [960, 540]) : [960, 540];
    const gapS = capS * (outline ? 1 : .55), gapB = capB * (outline ? .6 : .38);
    const H = L.reduce((h, l, i) => h + sty(i).cap + (i ? (i === last ? gapB : gapS) : 0), 0);
    let y = P0[1] - H / 2, box = null;
    L.forEach((l, i) => {
      const s = sty(i); if (i) y += i === last ? gapB : gapS; const base = y + s.cap; y += s.cap;
      const ti = tl[i]; if (t < ti) return;
      const k = clamp(((t - ti) * FPS + 1) / 4), e = E.outCubic(k);
      x.save(); x.globalAlpha = e;
      if (i === last && L.length > 1 && o.ring !== false) {
        // light band + ring shockwave behind the big line
        const fk = clamp((t - ti) * FPS / 7); if (fk > 0 && fk < 1) { const cy = base - s.cap / 2, bh = s.cap * 1.7, g = x.createLinearGradient(0, cy - bh, 0, cy + bh), a = .26 * Math.sin(Math.PI * fk);
          g.addColorStop(0, 'rgba(255,236,200,0)'); g.addColorStop(.5, `rgba(255,236,200,${a})`); g.addColorStop(1, 'rgba(255,236,200,0)'); x.save(); x.globalAlpha = 1; x.fillStyle = g; x.fillRect(0, cy - bh, 1920, 2 * bh); x.restore(); }
        const rk = (t - (ti - F)) * FPS / 6; if (rk >= 0 && rk < 1) { x.save(); x.globalAlpha = (1 - rk) * .85; x.lineWidth = 2.5; x.strokeStyle = '#fbe3b5';
          for (const m of [1, .78]) { x.beginPath(); x.arc(P0[0], base - s.cap / 2, (36 + 300 * E.outQuad(rk)) * m, 0, Math.PI * 2); x.stroke(); } x.restore(); }
        P.about(x, P0[0], base - s.cap / 2, lerp(1.1, 1, e));
      }
      const b = P.drawText(x, l.text, P0[0], base, { ...deco(s, i === last && L.length > 1), align: 'center' }, P.PX); x.restore();
      box = box ? { x: Math.min(box.x, b.x), y: box.y, w: Math.max(box.x + box.w, b.x + b.w) - Math.min(box.x, b.x), h: b.y + b.h - box.y } : b;
    });
    return box;
  });
}

// =====================================================================================================================
// END CARD: dark purple night (#140f19) with specks of stars, a big thin amber ring of light behind the cast standing
// centre-bottom, the question in cream + amber over them, and the engagement row popping on its words: comment bubble,
// Subscribe (flips to "Subscribed" 10 frames later), like, "PART 2".
// =====================================================================================================================
export function endcard(S, o = {}) {
  // the backdrop stands behind the cast (z -.6) and is scaled so that, seen from the camera framing the cast's plane,
  // its pixels land where a flat board's would (floor line at y 1000 = the cast's feet)
  const zb = o.z ?? -.6, yc = (1000 - 540) * U, d = 960 * U / (960 / 1080) / 2 / Math.tan((S.cam.fov * Math.PI / 180) / 2), k = (d - zb) / d;
  if (!S._cam) S.camera('static', { on: [0, yc, 0], frame: { h: 960 * U } });
  const B = makeBoard(S, { bg: ['#2a1d2c', '#120d17'], bgR: .55, pos: [0, yc, zb], kind: 'endcard', camera: false,
    bgPaint: (x, w, h) => { const R = rnd(7); x.fillStyle = 'rgba(255,240,220,.5)'; for (let i = 0; i < 140; i++) { const r = R() < .9 ? .35 : .7; x.globalAlpha = .25 + .6 * R(); x.beginPath(); x.arc(R() * w, R() * h * .8, r, 0, 7); x.fill(); } x.globalAlpha = 1;
      const g = x.createRadialGradient(w / 2, h * .82, 0, w / 2, h * .82, w * .32); g.addColorStop(0, 'rgba(150,95,60,.45)'); g.addColorStop(1, 'rgba(150,95,60,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); } });
  B.g.scale.setScalar(k);
  const ring = gline(circlePts(960, 600, o.ringR ?? 330, o.ringR ?? 330, 120), 4, { color: '#c89a5c', glowColor: '#d9a060', halo: 26, glow: .35, opacity: .75 });
  B.line(ring);
  const ring2 = gline(circlePts(960, 600, (o.ringR ?? 330) - 14, (o.ringR ?? 330) - 14, 120), 2, { color: '#8a6440', opacity: .5 }); B.line(ring2);
  const floor = gline([[300, 1000], [1620, 1000]], 2, { color: '#8a6a50', glowColor: '#b88a60', halo: 6, glow: .3, opacity: .8 }); B.line(floor);
  const t0 = o.at != null || o.word != null ? P.landed(S, P.startOf(S, o, 0)) : S.t0;
  for (const m of [ring, ring2, floor]) fadeIn(m, t0, 10);
  // the cast
  const cast = o.cast ?? ['main'];
  const xs = o.xs ?? (cast.length === 1 ? [960] : cast.length === 2 ? [760, 1160] : cast.map((_, i) => 660 + 600 * i / (cast.length - 1)));
  B.actors = cast.map((id, i) => typeof id === 'object' && id?.isActor ? id : S.char(id, { at: [(xs[i] - 960) * U, 0], facing: xs[i] < 940 ? 1 : xs[i] > 980 ? -1 : 0, ...(o.charOpts || {}) }));
  // the question + the row
  const q = (o.lines ?? String(o.text ?? 'WHAT WOULD YOU DO?').split('\n'));
  const tq = q.map((l, i) => typeof l === 'object' && (l.word || l.at != null) ? P.startOf(S, l, 2 * F) : t0 + (i ? 40 : 20) * F);
  const W = { comment: o.comment, subscribe: o.subscribe, like: o.like, part: o.part };
  const tw = k => W[k] == null || W[k] === false ? null : P.startOf(S, typeof W[k] === 'object' ? W[k] : { word: W[k] === true ? k : W[k] }, 3 * F);
  const tc = tw('comment'), ts = tw('subscribe'), tlk = tw('like'), tp = o.part ? P.startOf(S, typeof o.part === 'object' ? o.part : { word: o.partWord ?? 'part' }, 3 * F) : null;
  overlay(S, 'endcard', q.map(l => l.text ?? l).join(' '), t0, null, (x, t) => {
    let box = null; const add = b => { if (!b) return; box = box ? { x: Math.min(box.x, b.x), y: Math.min(box.y, b.y), w: Math.max(box.x + box.w, b.x + b.w) - Math.min(box.x, b.x), h: Math.max(box.y + box.h, b.y + b.h) - Math.min(box.y, b.y) } : b; };
    q.forEach((l, i) => { const s = typeof l === 'object' ? l.text : l, big = i === q.length - 1 && q.length > 1, a = P.fadeIn(t, tq[i], 4); if (a <= 0) return;
      x.save(); x.globalAlpha = a; if (big) P.about(x, 960, 286, lerp(1.06, 1, a));
      add(P.drawText(x, s, 960, big ? 327 : 210, big ? { cap: o.bigCap ?? 72, w: 800, track: .04, color: '#f7c875', align: 'center', glow: [28, 'rgba(190,120,50,.65)', 2] } : { cap: 54, w: 800, track: .07, color: '#e7ddcb', align: 'center', glow: [16, 'rgba(0,0,0,.4)', 1] }, P.PX)); x.restore(); });
    const row = 470;
    const pop = tt => { if (tt == null || t < tt) return 0; return P.popAt(P.POPBIG, t, tt)[1]; };
    if (tc != null && t >= tc) { const s = pop(tc); x.save(); P.about(x, 560, row, s); add(paintComment(x, 560, row)); x.restore(); }
    if (ts != null && t >= ts) { const s = pop(ts); x.save(); P.about(x, 960, row, s); add(paintSubscribe(x, 960, row, t >= ts + 10 * F)); x.restore(); }
    if (tlk != null && t >= tlk) { const s = pop(tlk); x.save(); P.about(x, 1360, row, s); add(paintLike(x, 1360, row)); x.restore(); }
    if (tp != null && t >= tp) { const s = pop(tp); x.save(); P.about(x, 960, 600, s); add(P.drawText(x, o.partText ?? 'PART 2', 960, 640, { cap: 70, w: 800, track: .1, color: '#f7c875', align: 'center', glow: [26, 'rgba(190,120,50,.7)', 2] }, P.PX)); x.restore(); }
    return box;
  });
  B.g.userData.board = B; return B.g;
}
function paintComment(x, cx, cy) {
  const w = 212, h = 92; x.beginPath(); x.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2); x.fillStyle = '#efe7da'; x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = 12; x.fill(); x.shadowBlur = 0;
  const bx = cx - 50, by = cy - 4; x.fillStyle = '#2a2433'; x.beginPath(); x.roundRect(bx - 30, by - 22, 60, 42, 10); x.fill(); x.beginPath(); x.moveTo(bx - 18, by + 18); x.lineTo(bx - 26, by + 32); x.lineTo(bx - 4, by + 18); x.fill();
  x.fillStyle = '#efe7da'; for (let i = -1; i <= 1; i++) { x.beginPath(); x.arc(bx + i * 13, by - 1, 4, 0, 7); x.fill(); }
  x.fillStyle = '#2a2433'; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(cx + 10 + i * 30, cy, 7, 0, 7); x.fill(); }
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
function paintSubscribe(x, cx, cy, done) {
  const label = done ? 'Subscribed' : 'Subscribe', st = { cap: 40, w: 800, track: 0, color: '#ffffff' }, tw = P.measure(x, label, st), w = tw + 170, h = 100;
  x.beginPath(); x.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2); x.fillStyle = '#e01f18'; x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 14; x.shadowOffsetY = 4; x.fill(); x.shadowBlur = 0; x.shadowOffsetY = 0;
  const bx = cx - w / 2 + 70, by = cy; x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(bx - 16, by + 12); x.quadraticCurveTo(bx - 14, by - 20, bx, by - 22); x.quadraticCurveTo(bx + 14, by - 20, bx + 16, by + 12); x.closePath(); x.fill();
  x.fillRect(bx - 20, by + 10, 40, 6); x.beginPath(); x.arc(bx, by + 20, 6, 0, 7); x.fill(); x.beginPath(); x.arc(bx, by - 24, 4, 0, 7); x.fill();
  P.drawText(x, label, bx + 40, cy + 20, st);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
function paintLike(x, cx, cy) {
  const r = 56; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = '#f2c14e'; x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = 12; x.fill(); x.shadowBlur = 0;
  x.fillStyle = '#2a2018'; x.beginPath(); x.roundRect(cx - 30, cy - 4, 14, 34, 3); x.fill();
  x.beginPath(); x.moveTo(cx - 12, cy - 2); x.lineTo(cx - 2, cy - 30); x.quadraticCurveTo(cx + 8, cy - 36, cx + 8, cy - 22); x.lineTo(cx + 5, cy - 8); x.lineTo(cx + 24, cy - 8); x.quadraticCurveTo(cx + 34, cy - 6, cx + 30, cy + 4);
  x.lineTo(cx + 26, cy + 26); x.quadraticCurveTo(cx + 24, cy + 32, cx + 16, cy + 32); x.lineTo(cx - 12, cy + 32); x.closePath(); x.fill();
  return { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r };
}

// =====================================================================================================================
// NEWS BROADCAST over the shot's picture: style 'blue' (royal-blue lower third #1b398a, white headline cap 45, gold sub
// cap 30, navy ticker scrolling ~62 px/s, NEWS + LIVE badges) or 'red' (red band #c8132c with a light tab "BREAKING" /
// "NEWS", white headline (cap 85 when short, 31 when long), a navy name strap, a small LIVE tag). tv: true draws the TV
// bezel and the wall around it. Build: band at `at`, headline 4 frames later, sub 8 frames later (2-3 frame fades).
// =====================================================================================================================
export function news(S, o = {}) {
  const style = o.style ?? 'blue', t0 = o.at != null || o.word != null ? P.landed(S, P.startOf(S, o, 0)) : -1e9, base = t0 > -1e8 ? t0 : S.t0 - 1;
  const tick = o.ticker === false ? null : (o.ticker ?? [o.headline, o.sub].filter(Boolean).join(' · ')) + ' · ';
  return overlay(S, 'news', o.headline ?? '', t0, T(S, o.until), (x, t) => {
    const bar = barOf(S), top = bar, bot = 1080 - bar, tv = o.tv ? { x0: 70, y0: top + 8, x1: 1850, y1: bot - 4 } : { x0: 0, y0: top, x1: 1920, y1: bot };
    if (o.tv) { x.fillStyle = o.wall ?? '#d6c9b4'; x.fillRect(0, top, 1920, bot - top); x.save(); x.globalCompositeOperation = 'destination-out'; x.fillRect(tv.x0, tv.y0, tv.x1 - tv.x0, tv.y1 - tv.y0); x.restore();
      x.lineWidth = 26; x.strokeStyle = '#141418'; x.strokeRect(tv.x0 - 13, tv.y0 - 13, tv.x1 - tv.x0 + 26, tv.y1 - tv.y0 + 26);
      const g = x.createLinearGradient(tv.x0, tv.y0, tv.x1, tv.y1); g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(.35, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(tv.x0, tv.y0, tv.x1 - tv.x0, tv.y1 - tv.y0); }
    const W = tv.x1 - tv.x0, X0 = tv.x0, f = fr => P.fadeIn(t, base + fr * F, 3);
    if (style === 'red') {
      const h = o.headH ?? 112, y = tv.y1 - (o.tv ? 70 : 64) - h, short = (o.headline ?? '').length <= 18, cap = o.cap ?? (short ? 70 : 31);
      if (t < base) return null;
      x.fillStyle = '#c8132c'; x.fillRect(X0 + 30, y, W - 60, h);
      const tab = o.tab ?? 'BREAKING', tst = { cap: 30, w: 800, track: .04, color: '#71101e' }, tw = P.measure(x, tab, tst) + 60;
      x.fillStyle = '#e8e4e0'; x.fillRect(X0 + 30, y, tw, h); P.drawText(x, tab, X0 + 30 + tw / 2, y + h / 2 + 15, { ...tst, align: 'center' });
      x.save(); x.globalAlpha = f(4); P.drawText(x, o.headline ?? '', X0 + 30 + tw + 40, y + h / 2 + cap / 2, { cap, w: 800, track: .02, color: '#f5f0ed' }); x.restore();
      if (o.strap) { x.save(); x.globalAlpha = f(8); const sst = { cap: 20, w: 800, track: .06, color: '#eef0f6' }, sw = P.measure(x, o.strap, sst) + 50; x.fillStyle = 'rgba(28,36,70,.82)'; x.fillRect(X0 + 50, y - 50, sw, 44); P.drawText(x, o.strap, X0 + 75, y - 28 + 10, sst); x.restore(); }
      if (o.sub) { x.save(); x.globalAlpha = f(8); x.fillStyle = '#f1efeb'; x.fillRect(X0 + 30, y + h, W - 60, 30); P.drawText(x, o.sub, X0 + 50, y + h + 22, { cap: 14, w: 800, track: .06, color: '#2a1a1a' }); x.restore(); }
      if (o.live !== false) { x.fillStyle = '#c8132c'; x.beginPath(); x.roundRect(tv.x1 - 120, tv.y0 + 30, 70, 32, 4); x.fill(); P.drawText(x, 'LIVE', tv.x1 - 85, tv.y0 + 53, { cap: 15, w: 800, track: .08, color: '#ffffff', align: 'center' }); }
      return { x: X0, y, w: W, h };
    }
    // blue
    if (o.badges !== false) { x.fillStyle = '#dfe2ea'; x.beginPath(); x.roundRect(tv.x0 + 42, tv.y0 + 36, 174, 64, 8); x.fill(); P.drawText(x, o.channel ?? 'NEWS', tv.x0 + 129, tv.y0 + 68 + 15, { cap: 30, w: 800, track: .02, color: '#1b2550', align: 'center' });
      x.fillStyle = '#ae2f2c'; x.beginPath(); x.roundRect(tv.x0 + 234, tv.y0 + 46, 106, 44, 6); x.fill(); P.drawText(x, 'LIVE', tv.x0 + 287, tv.y0 + 68 + 10, { cap: 20, w: 800, track: .04, color: '#ffffff', align: 'center' }); }
    if (t < base) return null;
    const by = tv.y1 - (o.tv ? 290 : 280), bh = 228;
    x.fillStyle = '#1b398a'; x.fillRect(X0, by, W, bh);
    const g = x.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,.08)'); x.fillStyle = g; x.fillRect(X0, by, W, bh);
    x.save(); x.globalAlpha = f(4); P.drawText(x, o.headline ?? '', X0 + 68, by + 88, { cap: o.cap ?? 45, w: 800, track: .0, color: '#ebeef5' }); x.restore();
    if (o.sub) { x.save(); x.globalAlpha = f(12); P.drawText(x, o.sub, X0 + 68, by + 164, { cap: 30, w: 800, track: .0, color: '#e5c590' }); x.restore(); }
    if (tick) { const ty = by + bh - 4, th = 54; x.fillStyle = '#0f2056'; x.fillRect(X0, ty, W, th);
      x.save(); x.beginPath(); x.rect(X0, ty, W, th); x.clip(); const st = { cap: 20, w: 800, track: .02, color: '#bfc7e1' }, tw = Math.max(200, P.measure(x, tick, st) + 14);
      const off = ((t - base) * (o.speed ?? 62)) % tw; for (let xx = X0 - off; xx < X0 + W; xx += tw) P.drawText(x, tick, xx, ty + th / 2 + 10, st); x.restore(); }
    return { x: X0, y: by, w: W, h: bh };
  });
}

// =====================================================================================================================
// CCTV FEED over the shot's own picture: style 'iq' (fully grey, dark, strong grain changing every frame, faint band
// noise, a red REC dot + "CCTV · LIVE · 23:41" mono label top-left, a timecode HH:MM:SS:FF top-right counting every video
// frame, thin corner brackets) or 'cam' (keeps colour: "CAM 41 · OFFICE" + "REC ●", an inset frame, optional face box).
// =====================================================================================================================
let NOISE = null;
function noiseTile() {
  if (NOISE) return NOISE; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), im = x.createImageData(256, 256), R = rnd(99);
  for (let i = 0; i < im.data.length; i += 4) { const v = R() < .5 ? 0 : 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = Math.round(R() * 46); }
  x.putImageData(im, 0, 0); NOISE = c; return c;
}
export function cctv(S, o = {}) {
  const style = o.style ?? 'iq';
  if (style !== 'cam' && o.grade !== false) { const prev = S._grade; S._grade = t => ({ ...(typeof prev === 'function' ? prev(t) : prev || {}), grey: 1, bright: o.bright ?? .62, contrast: o.contrast ?? 1.08, lift: [.015, .015, .015], vignette: .45 }); }
  // the timecode runs from the label's time (iq500 f9356 "23:41:07:01"), not from midnight: time '23:41' -> 23:41:07
  const hms = String(o.time ?? '23:41').split(':').map(Number), fromTime = hms.length >= 2 && hms.every(isFinite) ? hms[0] * 3600 + hms[1] * 60 + (hms[2] ?? 7) : 0;
  const t0 = S.t0, clock0 = P.when(S, o.clockAt ?? S.t0) ?? S.t0, start = o.time0 ?? fromTime;
  return overlay(S, 'cctv', o.label ?? 'CCTV', -1e9, null, (x, t) => {
    const bar = barOf(S), f = Math.floor((t - 0) * FPS + 1e-4);
    // grain + band noise (a fresh offset every frame)
    if (o.grain !== false) { x.save(); const pat = x.createPattern(noiseTile(), 'repeat'); const ox = Math.floor(hash(f, 3) * 256), oy = Math.floor(hash(f, 5) * 256);
      x.translate(-ox, -oy); x.fillStyle = pat; x.globalAlpha = style === 'cam' ? .45 : .8; x.fillRect(ox, oy + bar, 1920, 1080 - 2 * bar); x.restore();
      x.save(); x.globalAlpha = 1; for (let i = 0; i < 3; i++) { const yy = bar + ((hash(Math.floor(f / 2), 11 + i) * 1.2 + t * .05 * (i + 1)) % 1) * (1080 - 2 * bar); x.fillStyle = `rgba(255,255,255,${.018 + .02 * hash(f, 20 + i)})`; x.fillRect(0, yy, 1920, 6 + 20 * hash(i, 4)); } x.restore(); }
    const mono = (s, X, Y, cap, color, align = 'left') => P.drawText(x, s, X, Y, { cap, w: 700, fam: 'mono', track: .04, color, align, shadow: [0, 1, 3, 'rgba(0,0,0,.6)'] });
    const sec = start + Math.floor(t - clock0), ff = Math.max(0, Math.floor((t - clock0) * FPS + 1e-4) % FPS), p2 = n => String(Math.max(0, n)).padStart(2, '0');
    const tc = `${p2(Math.floor(sec / 3600) % 24)}:${p2(Math.floor(sec / 60) % 60)}:${p2(sec % 60)}:${p2(ff)}`;
    if (style === 'cam') {
      x.strokeStyle = 'rgba(235,235,235,.55)'; x.lineWidth = 2; x.strokeRect(26, bar + 26, 1868, 1080 - 2 * bar - 52);
      mono(o.label ?? 'CAM 41 · OFFICE', 70, bar + 80, 24, '#e8e8e8');
      const recOn = Math.floor(t * 1.2) % 2 === 0; mono('REC', 1790, bar + 80, 24, '#e8e8e8', 'right'); if (recOn) { x.fillStyle = '#d02525'; x.beginPath(); x.arc(1822, bar + 68, 11, 0, 7); x.fill(); }
      mono(tc, 1850, 1080 - bar - 50, 20, '#d6d6d6', 'right');
      if (o.face) { const q = S.screen(o.face); if (q[2] !== false) { const cx = q[0] / P.PX, cy = q[1] / P.PX + 40, r = o.faceR ?? 110; x.strokeStyle = '#5fe08a'; x.lineWidth = 3; x.strokeRect(cx - r, cy - r, 2 * r, 2 * r); } }
      return { x: 26, y: bar + 26, w: 1868, h: 1080 - 2 * bar - 52 };
    }
    x.fillStyle = '#c02020'; x.beginPath(); x.arc(110, bar + 124, 13, 0, 7); x.fill();
    mono(o.label ?? `CCTV · LIVE · ${o.time ?? '23:41'}`, 142, bar + 137, 26, '#dbdddd');
    mono(tc, 1845, bar + 35, 22, '#8c8d8d', 'right');
    x.strokeStyle = 'rgba(220,220,220,.35)'; x.lineWidth = 2; for (const X of [40, 1880]) { x.beginPath(); x.moveTo(X, bar + 60); x.lineTo(X, bar + 220); x.moveTo(X, 1080 - bar - 60); x.lineTo(X, 1080 - bar - 220); x.stroke(); }
    return { x: 96, y: bar + 100, w: 700, h: 50 };
  });
}
void seg; void setAlpha; void popIn; void growIn;
