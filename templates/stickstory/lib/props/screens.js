// Stick stories props - SCREEN CONTENT for phones, tablets, laptops, monitors, TVs, ATMs and medical monitors. Owned by
// the prop agent. A screen is a canvas texture drawn once (cached by its spec) or, for animated content, redrawn only
// when its picture changes (o.screenFps). The UIs are simplified like the references' (white app screens with dark text
// and one green / red accent, dark call screens, chat bubbles, a news lower third); every name and brand is invented.
//
// spec = a function (ctx, w, h, t) | a string (shown as big text) | { ui, ...fields }:
//   phone / tablet: lock { time, date, note } | home | call { name, status, timer: t0 } | chat { name, msgs: [{ text, me }] }
//     | signal { text } | battery { level 0..1 } | bank { bank, amount, label, note } | map | video | notify { title, text }
//     | text { text, bg, color } | off | photo { colors } | timer { t0, label } | alarm { time, label }
//     | signin { title, name, dots, button, color } (an app log-in: crest, NAME / PASSWORD, a pill button; iq500 s64)
//   monitor / laptop: windows (dark panels, sister office) | code | doc { title } | chart { title } | email { from, subject }
//     | desktop | login { name } | text | off | lines (the office-night screens: blue with white text lines + an orange dot)
//   tv: news { headline, tag, ticker } | static | text | off | sport { a, b, score }
//   ecg (heart monitor) { bpm, spo2, flat } | atm { text }
import { canvasTex } from '../core.js';

const F = (w, px, weight = 700, fam = 'Open Sans') => `${weight} ${Math.round(px)}px "${fam}", "Inter", Arial, sans-serif`;
const rr = (x, X, Y, W, H, r) => { x.beginPath(); x.roundRect(X, Y, W, H, r); };
function wrap(x, text, maxW) { const words = String(text).split(/\s+/), lines = []; let l = ''; for (const w of words) { const t = l ? l + ' ' + w : w; if (x.measureText(t).width > maxW && l) { lines.push(l); l = w; } else l = t; } if (l) lines.push(l); return lines; }
const fmtT = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

function statusBar(x, w, u, o = {}) {
  const c = o.dark ? '#ffffff' : '#1d2330';
  x.fillStyle = c; x.font = F(w, u * 1.05, 700); x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillText(o.time || '7:42', u * 1.2, u * 1.6);
  for (let i = 0; i < 4; i++) { x.globalAlpha = i < (o.bars ?? 4) ? 1 : .3; x.fillRect(w - u * 5.6 + i * u * .55, u * 2.1 - u * (.4 + i * .28), u * .38, u * (.4 + i * .28)); }
  x.globalAlpha = 1; x.strokeStyle = c; x.lineWidth = u * .12; rr(x, w - u * 3, u * 1.15, u * 1.8, u * .95, u * .2); x.stroke();
  x.fillRect(w - u * 1.15, u * 1.45, u * .15, u * .35); x.fillStyle = (o.battery ?? 1) < .2 ? '#e0453a' : c; x.fillRect(w - u * 2.85, u * 1.3, u * 1.5 * (o.battery ?? .8), u * .65);
}
function notch(x, w, u) { x.fillStyle = '#0a0a0e'; rr(x, w / 2 - u * 2.4, u * .6, u * 4.8, u * 1.3, u * .65); x.fill(); }
function avatar(x, cx, cy, r, bg = '#9aa3b2') { x.fillStyle = bg; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); x.fillStyle = '#5c6575'; x.beginPath(); x.arc(cx, cy - r * .18, r * .38, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(cx, cy + r * .62, r * .62, r * .42, 0, Math.PI, 0); x.fill(); }
/** a round contact icon: bank (columns) | heart | school | work (briefcase) | person; ring glow like the iq500 bank call */
function icon(x, kind, cx, cy, r) {
  x.fillStyle = 'rgba(120,150,220,.18)'; x.beginPath(); x.arc(cx, cy, r * 1.25, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#2c3a66'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#8ea6e0'; x.lineWidth = r * .07; x.stroke();
  x.fillStyle = '#ffffff'; const s = r * .55;
  if (kind === 'bank') { x.beginPath(); x.moveTo(cx - s, cy - s * .35); x.lineTo(cx, cy - s * .95); x.lineTo(cx + s, cy - s * .35); x.fill(); for (let i = 0; i < 4; i++) x.fillRect(cx - s * .8 + i * s * .5, cy - s * .25, s * .2, s * .8); x.fillRect(cx - s, cy + s * .62, s * 2, s * .22); }
  else if (kind === 'heart') { x.beginPath(); x.arc(cx - s * .4, cy - s * .2, s * .45, Math.PI, 0); x.arc(cx + s * .4, cy - s * .2, s * .45, Math.PI, 0); x.lineTo(cx, cy + s * .8); x.closePath(); x.fill(); }
  else if (kind === 'school') { x.beginPath(); x.moveTo(cx - s, cy - s * .2); x.lineTo(cx, cy - s * .7); x.lineTo(cx + s, cy - s * .2); x.lineTo(cx, cy + s * .3); x.fill(); x.fillRect(cx - s * .55, cy, s * 1.1, s * .5); }
  else if (kind === 'work') { x.fillRect(cx - s * .85, cy - s * .4, s * 1.7, s * 1.1); x.strokeStyle = '#ffffff'; x.lineWidth = s * .16; x.strokeRect(cx - s * .35, cy - s * .75, s * .7, s * .4); }
  else { x.beginPath(); x.arc(cx, cy - s * .3, s * .42, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(cx, cy + s * .75, s * .75, s * .55, 0, Math.PI, 0); x.fill(); }
}
function phoneIcon(x, cx, cy, s, rot = 0) { x.save(); x.translate(cx, cy); x.rotate(rot); x.strokeStyle = '#ffffff'; x.lineCap = 'round'; x.lineWidth = s * .28; x.beginPath(); x.arc(0, s * .55, s * .9, Math.PI * 1.2, Math.PI * 1.8); x.stroke(); x.restore(); }

// ---------------- phone / tablet UIs ----------------
const PHONE = {
  lock(x, w, h, s, u) {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, s.top || '#2b3a63'); g.addColorStop(1, s.bottom || '#7a5a8c'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.arc(w * .8, h * .75, w * .5, 0, Math.PI * 2); x.fill();
    statusBar(x, w, u, { dark: true, time: '' , ...s.status });
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.font = F(w, u * 2.4, 600); x.fillText(s.date || 'Tuesday, March 4', w / 2, h * .17);
    x.font = F(w, u * 7.5, 700); x.fillText(s.time || '7:42', w / 2, h * .27);
    if (s.note) { x.fillStyle = 'rgba(255,255,255,.88)'; rr(x, u * 1.5, h * .4, w - u * 3, u * 6, u * 1.6); x.fill(); x.fillStyle = '#1d2330'; x.textAlign = 'left'; x.font = F(w, u * 1.6, 800); x.fillText(s.noteTitle || 'MESSAGES', u * 3, h * .4 + u * 1.8); x.font = F(w, u * 1.8, 600); wrap(x, s.note, w - u * 6).slice(0, 2).forEach((l, i) => x.fillText(l, u * 3, h * .4 + u * (3.8 + i * 2))); }
    x.fillStyle = 'rgba(255,255,255,.8)'; rr(x, w / 2 - u * 4, h - u * 1.6, u * 8, u * .5, u * .25); x.fill();
  },
  home(x, w, h, s, u) {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#3d5f8c'); g.addColorStop(1, '#c47b6b'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    statusBar(x, w, u, { dark: true, ...s.status });
    const cols = ['#5ba077', '#e0b440', '#d85a4a', '#4a7fd0', '#8a63c9', '#f0f0f0', '#3c3f46', '#e98a3a', '#3a9c96', '#e783a8', '#6f8195', '#c65c46', '#7c79c7', '#5ba077', '#4a7fd0', '#e0b440'];
    const cs = (w - u * 3) / 4; cols.forEach((c, i) => { x.fillStyle = c; rr(x, u * 1.5 + (i % 4) * cs + cs * .14, h * .12 + Math.floor(i / 4) * cs * 1.25, cs * .72, cs * .72, cs * .18); x.fill(); });
    x.fillStyle = 'rgba(255,255,255,.25)'; rr(x, u * 1.2, h - u * 7, w - u * 2.4, u * 5.4, u * 2); x.fill();
    ['#5ba077', '#4a7fd0', '#f0f0f0', '#e0b440'].forEach((c, i) => { x.fillStyle = c; rr(x, u * 1.5 + i * cs + cs * .14, h - u * 6.3, cs * .72, cs * .72, cs * .18); x.fill(); });
  },
  call(x, w, h, s, u, t) {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a3346'); g.addColorStop(1, '#151a26'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    statusBar(x, w, u, { dark: true, ...s.status });
    if (s.icon) icon(x, s.icon, w / 2, h * .28, u * 4.6); else avatar(x, w / 2, h * .28, u * 4.6, s.avatar || '#9aa3b2');
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.font = F(w, u * 3.1, 800); x.fillText(s.name || 'MOM', w / 2, h * .45);
    x.fillStyle = '#b8c0cf'; x.font = F(w, u * 1.6, 600); x.fillText(s.timer != null ? fmtT(t - s.timer) : s.status_text || s.statusText || 'calling...', w / 2, h * .5);
    if (s.incoming !== false && s.timer == null) {
      x.fillStyle = '#e0453a'; x.beginPath(); x.arc(w * .27, h * .82, u * 2.9, 0, Math.PI * 2); x.fill(); phoneIcon(x, w * .27, h * .82, u * 1.6, Math.PI * .75);
      x.fillStyle = '#35b86b'; x.beginPath(); x.arc(w * .73, h * .82, u * 2.9, 0, Math.PI * 2); x.fill(); phoneIcon(x, w * .73, h * .82, u * 1.6, 0);
    } else { x.fillStyle = '#e0453a'; x.beginPath(); x.arc(w / 2, h * .82, u * 2.9, 0, Math.PI * 2); x.fill(); phoneIcon(x, w / 2, h * .82, u * 1.6, Math.PI * .75); }
  },
  chat(x, w, h, s, u) {
    x.fillStyle = '#f4f5f7'; x.fillRect(0, 0, w, h); statusBar(x, w, u, s.status);
    x.fillStyle = '#ffffff'; x.fillRect(0, u * 3, w, u * 5.5); x.fillStyle = '#dde1e7'; x.fillRect(0, u * 8.5, w, u * .15);
    x.fillStyle = s.color || '#2fb5a4'; x.beginPath(); x.arc(w / 2, u * 4.8, u * 1.2, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#1d2330'; x.textAlign = 'center'; x.font = F(w, u * 1.6, 800); x.fillText(s.name || 'Mia', w / 2, u * 7.2);
    let y = u * 11; x.textAlign = 'left'; x.font = F(w, u * 1.75, 600);
    for (const m of s.msgs || [{ text: s.text || 'Where are you??' }]) {
      const lines = wrap(x, m.text, w * .62), bw = Math.max(...lines.map(l => x.measureText(l).width)) + u * 2.4, bh = lines.length * u * 2.3 + u * 1.4, bx = m.me ? w - bw - u * 1.4 : u * 1.4;
      x.fillStyle = m.me ? '#3d7bf0' : '#e3e6eb'; rr(x, bx, y, bw, bh, u * 1.4); x.fill();
      x.fillStyle = m.me ? '#ffffff' : '#1d2330'; lines.forEach((l, i) => x.fillText(l, bx + u * 1.2, y + u * (1.85 + i * 2.3)));
      y += bh + u * 1.1;
    }
    x.fillStyle = '#ffffff'; x.fillRect(0, h - u * 5, w, u * 5); x.fillStyle = '#e3e6eb'; rr(x, u * 1.4, h - u * 4, w - u * 6, u * 2.8, u * 1.4); x.fill();
    x.fillStyle = '#3d7bf0'; x.beginPath(); x.arc(w - u * 2.6, h - u * 2.6, u * 1.4, 0, Math.PI * 2); x.fill();
  },
  signal(x, w, h, s, u) {
    x.fillStyle = s.bg || '#f4f5f7'; x.fillRect(0, 0, w, h); statusBar(x, w, u, { bars: 0, ...s.status });
    const cx = w / 2, by = h * .45; for (let i = 0; i < 4; i++) { x.fillStyle = i < (s.bars ?? 0) ? '#1d2330' : '#c9ced6'; rr(x, cx - u * 4.4 + i * u * 2.4, by - u * (1.8 + i * 1.5), u * 1.7, u * (1.8 + i * 1.5), u * .3); x.fill(); }
    if (!(s.bars > 0)) { x.strokeStyle = '#e0453a'; x.lineWidth = u * .7; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx - u * 5, by - u * 7); x.lineTo(cx + u * 5, by + u * .6); x.stroke(); }
    x.fillStyle = '#1d2330'; x.textAlign = 'center'; x.font = F(w, u * 2.4, 800); x.fillText(s.text || 'No Service', cx, h * .58);
  },
  battery(x, w, h, s, u) {   // iq500 macro: dark screen, an amber battery with a bolt, BATTERY / 31 DAYS
    const lv = s.level ?? .04, c = s.color || (lv < .2 && s.level != null ? '#e0453a' : '#f0b43a'); x.fillStyle = '#12151c'; x.fillRect(0, 0, w, h); statusBar(x, w, u, { dark: true, battery: lv, ...s.status });
    const bw = w * .5, bh = bw * .46, bx = (w - bw) / 2 - u * .5, by = h * .3; x.strokeStyle = c; x.lineWidth = u * .55; rr(x, bx, by, bw, bh, u * 1.1); x.stroke();
    x.fillStyle = c; rr(x, bx + bw + u * .35, by + bh * .3, u * .9, bh * .4, u * .3); x.fill();
    if (s.level != null) { x.globalAlpha = .9; rr(x, bx + u * .9, by + u * .9, Math.max(u * .8, (bw - u * 1.8) * lv), bh - u * 1.8, u * .5); x.fill(); x.globalAlpha = 1; }
    x.fillStyle = s.level != null && lv > .35 ? '#12151c' : c; x.beginPath(); const cx = bx + bw / 2, cy = by + bh / 2; x.moveTo(cx + u * .5, cy - bh * .36); x.lineTo(cx - u * 1.2, cy + u * .3); x.lineTo(cx, cy + u * .3); x.lineTo(cx - u * .5, cy + bh * .36); x.lineTo(cx + u * 1.2, cy - u * .3); x.lineTo(cx, cy - u * .3); x.closePath(); x.fill();
    x.fillStyle = c; x.textAlign = 'center'; x.font = F(w, u * 1.5, 800); x.fillText(s.label || 'BATTERY', w / 2, by + bh + u * 4);
    x.font = F(w, u * 3, 800); x.fillText(s.text || (s.level != null ? Math.round(lv * 100) + '%' : '31 DAYS'), w / 2, by + bh + u * 7.4);
  },
  bank(x, w, h, s, u) {
    x.fillStyle = '#f7f8fa'; x.fillRect(0, 0, w, h); statusBar(x, w, u, s.status);
    x.fillStyle = s.color || '#1f3b73'; x.fillRect(0, u * 3, w, u * 5); x.fillStyle = '#ffffff'; x.textAlign = 'left'; x.font = F(w, u * 1.8, 800); x.fillText(s.bank || 'NOVA BANK', u * 1.6, u * 5.6);
    x.fillStyle = '#6b7383'; x.font = F(w, u * 1.3, 700); x.fillText((s.label || 'Available balance').toUpperCase(), u * 1.6, u * 11);
    x.fillStyle = '#141a26'; x.font = F(w, u * 3.6, 800); x.fillText(s.amount || '$31,240.00', u * 1.6, u * 14.3);
    if (s.note !== false) { x.fillStyle = s.noteColor || '#35b86b'; rr(x, u * 1.6, u * 16.4, u * 11, u * 2.2, u * 1.1); x.fill(); x.fillStyle = '#ffffff'; x.font = F(w, u * 1.2, 800); x.textAlign = 'center'; x.fillText((s.note || '+ RECEIVED').toUpperCase(), u * 7.1, u * 17.55); x.textAlign = 'left'; }
    for (let i = 0; i < 5; i++) { const y = u * (22 + i * 3.4); x.fillStyle = '#e3e6eb'; x.fillRect(u * 1.6, y + u * 2.2, w - u * 3.2, u * .12); x.fillStyle = '#3a4252'; x.fillRect(u * 1.6, y, w * (.25 + (i * 37 % 20) / 100), u * .7); x.fillStyle = i % 2 ? '#e0453a' : '#35b86b'; x.fillRect(w - u * 7, y, u * 5.4, u * .7); }
  },
  signin(x, w, h, s, u) {   // iq500 s64 f3845: an app sign-in - navy title bar with a crest, a big shield crest, NAME / PASSWORD lines, a navy pill button
    x.fillStyle = '#f7f8fa'; x.fillRect(0, 0, w, h); statusBar(x, w, u, s.status);
    const nv = s.color || '#1f2f5e'; x.fillStyle = nv; x.fillRect(0, u * 3, w, u * 3.4); x.fillStyle = '#ffffff'; x.textAlign = 'left'; x.font = F(w, u * 1.6, 800);
    const sh = (cx, cy, r, fill, line) => { x.beginPath(); x.moveTo(cx - r, cy - r * .9); x.lineTo(cx + r, cy - r * .9); x.lineTo(cx + r, cy + r * .1); x.quadraticCurveTo(cx + r * .9, cy + r * .85, cx, cy + r * 1.2); x.quadraticCurveTo(cx - r * .9, cy + r * .85, cx - r, cy + r * .1); x.closePath(); x.fillStyle = fill; x.fill(); if (line) { x.strokeStyle = line; x.lineWidth = r * .14; x.stroke(); } };
    sh(u * 2.2, u * 4.6, u * .8, '#ffffff'); x.fillStyle = '#ffffff'; x.fillText((s.title || 'SCHOOL').toUpperCase(), u * 3.6, u * 4.75);
    const cy = h * .3, r = w * .2; sh(w / 2, cy, r, '#ffffff', nv); x.fillStyle = nv; x.beginPath(); x.moveTo(w / 2 - r * .55, cy - r * .3); x.lineTo(w / 2, cy - r * .05); x.lineTo(w / 2 + r * .55, cy - r * .3); x.lineTo(w / 2 + r * .55, cy + r * .4); x.lineTo(w / 2, cy + r * .62); x.lineTo(w / 2 - r * .55, cy + r * .4); x.closePath(); x.fill();
    x.fillStyle = '#ffffff'; x.fillRect(w / 2 - u * .12, cy - r * .05, u * .24, r * .67);
    const fld = (label, y, val) => { x.fillStyle = '#6b7383'; x.font = F(w, u * 1.05, 700); x.textAlign = 'left'; x.fillText(label, u * 2, y); x.fillStyle = '#c9ced8'; x.fillRect(u * 2, y + u * 2.4, w - u * 4, u * .14); if (val) { x.fillStyle = '#1d2330'; x.font = F(w, u * 1.3, 800); x.fillText(val, u * 2, y + u * 1.4); } };
    fld((s.user || 'NAME').toUpperCase(), h * .52, s.name || ''); fld((s.pass || 'PASSWORD').toUpperCase(), h * .62, '•'.repeat(s.dots ?? 6));
    x.fillStyle = nv; rr(x, w * .2, h * .74, w * .6, u * 2.4, u * 1.2); x.fill(); x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.font = F(w, u * 1.1, 800); x.fillText((s.button || 'LOG IN').toUpperCase(), w / 2, h * .74 + u * 1.25);
  },
  map(x, w, h, s, u) {
    x.fillStyle = '#e8e4da'; x.fillRect(0, 0, w, h); x.fillStyle = '#cfe0c2'; x.fillRect(w * .05, h * .55, w * .4, h * .2); x.fillStyle = '#b9d3e6'; x.fillRect(w * .6, h * .15, w * .5, h * .14);
    x.strokeStyle = '#ffffff'; x.lineWidth = u * 1.4; for (const [a, b, c, d] of [[0, .3, 1, .38], [.3, 0, .38, 1], [0, .7, 1, .62], [.7, 0, .8, 1]]) { x.beginPath(); x.moveTo(a * w, b * h); x.lineTo(c * w, d * h); x.stroke(); }
    x.strokeStyle = '#3d7bf0'; x.lineWidth = u * .9; x.beginPath(); x.moveTo(w * .34, h * .9); x.lineTo(w * .35, h * .5); x.lineTo(w * .74, h * .4); x.stroke();
    x.fillStyle = '#e0453a'; x.beginPath(); x.arc(w * .74, h * .36, u * 1.6, Math.PI * .9, Math.PI * 2.1); x.lineTo(w * .74, h * .42); x.fill(); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(w * .74, h * .36, u * .6, 0, Math.PI * 2); x.fill();
    statusBar(x, w, u, s.status);
  },
  video(x, w, h, s, u) { x.fillStyle = '#0d0f14'; x.fillRect(0, 0, w, h); x.fillStyle = s.color || '#3a4a6a'; x.fillRect(0, h * .3, w, h * .32); x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.moveTo(w / 2 - u * 1.6, h * .46 - u * 2); x.lineTo(w / 2 + u * 2.2, h * .46); x.lineTo(w / 2 - u * 1.6, h * .46 + u * 2); x.fill(); x.fillStyle = '#e0453a'; x.fillRect(0, h * .62 - u * .3, w * .4, u * .3); statusBar(x, w, u, { dark: true, ...s.status }); },
  notify(x, w, h, s, u) { PHONE.lock(x, w, h, { ...s, note: s.text || s.note || 'You have a new message', noteTitle: s.title }, u); },
  text(x, w, h, s, u) { x.fillStyle = s.bg || '#f4f5f7'; x.fillRect(0, 0, w, h); statusBar(x, w, u, { dark: /^#[0-3]/.test(s.bg || ''), ...s.status }); x.fillStyle = s.color || '#1d2330'; x.textAlign = 'center'; x.font = F(w, u * (s.size || 2.6), 800); const ls = wrap(x, s.text || '', w - u * 3); ls.forEach((l, i) => x.fillText(l, w / 2, h / 2 + (i - (ls.length - 1) / 2) * u * (s.size || 2.6) * 1.25)); },
  off(x, w, h) { x.fillStyle = '#07080b'; x.fillRect(0, 0, w, h); const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.45, 'rgba(255,255,255,.07)'); g.addColorStop(.55, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); },
  photo(x, w, h, s, u) { const c = s.colors || ['#7fa6c9', '#e8c39a', '#5a7a4a']; const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c[0]); g.addColorStop(.6, c[1]); g.addColorStop(1, c[2]); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#1b1b22'; x.beginPath(); x.arc(w / 2, h * .55, w * .16, 0, Math.PI * 2); x.fill(); x.fillRect(w / 2 - w * .2, h * .66, w * .4, h * .4); statusBar(x, w, u, { dark: true, ...s.status }); },
  timer(x, w, h, s, u, t) { x.fillStyle = '#0d0f14'; x.fillRect(0, 0, w, h); statusBar(x, w, u, { dark: true, ...s.status }); x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.font = F(w, u * 6, 600, 'JetBrains Mono'); x.fillText(fmtT(s.down != null ? s.down - (t - (s.t0 ?? 0)) : t - (s.t0 ?? 0)), w / 2, h * .42); x.fillStyle = '#b8c0cf'; x.font = F(w, u * 1.8, 700); x.fillText(s.label || 'TIMER', w / 2, h * .32); x.fillStyle = '#e0453a'; x.beginPath(); x.arc(w / 2, h * .72, u * 3, 0, Math.PI * 2); x.fill(); },
  alarm(x, w, h, s, u) { PHONE.lock(x, w, h, { ...s, top: '#3a2a20', bottom: '#d9824a' }, u); x.fillStyle = 'rgba(255,255,255,.9)'; rr(x, u * 2, h * .62, w - u * 4, u * 4.5, u * 2.2); x.fill(); x.fillStyle = '#1d2330'; x.textAlign = 'center'; x.font = F(w, u * 2, 800); x.fillText(s.label || 'ALARM', w / 2, h * .62 + u * 2.9); },
};
// ---------------- computer / TV UIs ----------------
const DESK = {
  windows(x, w, h, s, u) {   // sister home office: dark desktop with darker panels
    x.fillStyle = s.bg || '#1b1e25'; x.fillRect(0, 0, w, h);
    for (const [a, b, c, d] of [[.06, .1, .42, .42], [.52, .14, .4, .5], [.1, .58, .3, .3]]) { x.fillStyle = '#0f1116'; rr(x, a * w, b * h, c * w, d * h, u * .4); x.fill(); x.fillStyle = '#2a2f3a'; x.fillRect(a * w, b * h, c * w, u * 1.1); }
  },
  lines(x, w, h, s, u) {   // the office-night screens: blue with white text lines and one orange dot
    x.fillStyle = s.bg || '#7189a6'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 6; i++) x.fillRect(w * .1, h * (.16 + i * .12), w * (.35 + ((i * 29) % 40) / 100), u * .9);
    x.fillStyle = s.dot || '#f08a3a'; x.beginPath(); x.arc(w * .84, h * .2, u * 1.4, 0, Math.PI * 2); x.fill();
  },
  code(x, w, h, s, u) {
    x.fillStyle = '#161a22'; x.fillRect(0, 0, w, h); x.fillStyle = '#222836'; x.fillRect(0, 0, w * .18, h);
    const cols = ['#6fb3e0', '#e6b35a', '#9ccf7a', '#d77fb3', '#c9d1dc']; for (let i = 0; i < 16; i++) { const ind = (i * 7) % 4; x.fillStyle = cols[(i * 3) % cols.length]; x.fillRect(w * .22 + ind * u * 1.6, h * (.07 + i * .055), w * (.12 + ((i * 41) % 35) / 100), u * .8); }
  },
  doc(x, w, h, s, u) { x.fillStyle = '#d9dde3'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffffff'; x.fillRect(w * .2, h * .06, w * .6, h * .94); x.fillStyle = '#1d2330'; x.font = F(w, u * 2, 800); x.textAlign = 'left'; x.fillText(s.title || 'REPORT', w * .25, h * .16); x.fillStyle = '#9aa3b2'; for (let i = 0; i < 10; i++) x.fillRect(w * .25, h * (.24 + i * .065), w * (.38 + ((i * 13) % 12) / 100), u * .55); },
  chart(x, w, h, s, u) { x.fillStyle = '#f4f5f7'; x.fillRect(0, 0, w, h); x.fillStyle = '#1d2330'; x.font = F(w, u * 2, 800); x.textAlign = 'left'; x.fillText(s.title || 'SALES', w * .07, h * .14); const v = s.values || [.3, .45, .4, .62, .55, .78, .9]; v.forEach((k, i) => { x.fillStyle = i === v.length - 1 ? '#35b86b' : '#3d7bf0'; x.fillRect(w * (.1 + i * .12), h * .9 - k * h * .62, w * .08, k * h * .62); }); x.fillStyle = '#c9ced6'; x.fillRect(w * .07, h * .9, w * .86, u * .3); },
  email(x, w, h, s, u) { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = '#eef0f4'; x.fillRect(0, 0, w * .3, h); for (let i = 0; i < 7; i++) { x.fillStyle = i === 0 ? '#dce6fb' : '#eef0f4'; x.fillRect(0, h * (.08 + i * .12), w * .3, h * .11); x.fillStyle = '#6b7383'; x.fillRect(w * .03, h * (.11 + i * .12), w * .2, u * .6); } x.fillStyle = '#1d2330'; x.font = F(w, u * 1.9, 800); x.textAlign = 'left'; x.fillText(s.subject || 'Urgent: read this', w * .34, h * .14); x.fillStyle = '#6b7383'; x.font = F(w, u * 1.3, 600); x.fillText('from ' + (s.from || 'Dana'), w * .34, h * .22); x.fillStyle = '#9aa3b2'; for (let i = 0; i < 7; i++) x.fillRect(w * .34, h * (.32 + i * .075), w * (.5 - (i % 3) * .07), u * .55); },
  desktop(x, w, h, s, u) { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2f5d8a'); g.addColorStop(1, '#8a5d7a'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, h - u * 2.2, w, u * 2.2); for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(255,255,255,.85)'; rr(x, u * 1.2, u * (1.2 + i * 3.4), u * 2.2, u * 2.2, u * .4); x.fill(); } },
  login(x, w, h, s, u) { DESK.desktop(x, w, h, s, u); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, w, h); avatar(x, w / 2, h * .38, u * 3); x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.font = F(w, u * 1.8, 700); x.fillText(s.name || 'Alex', w / 2, h * .58); x.fillStyle = 'rgba(255,255,255,.85)'; rr(x, w * .35, h * .64, w * .3, u * 2.2, u * .5); x.fill(); x.fillStyle = '#1d2330'; x.fillText('••••••', w / 2, h * .64 + u * 1.5); },
  news(x, w, h, s, u) {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#16285a'); g.addColorStop(1, '#2b5aa0'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 6; i++) x.fillRect(w * (.55 + i * .07), 0, u * .4, h * .7);
    x.fillStyle = '#0b0b0f'; x.beginPath(); x.arc(w * .3, h * .38, h * .12, 0, Math.PI * 2); x.fill(); rr(x, w * .3 - h * .2, h * .5, h * .4, h * .3, h * .08); x.fill();
    x.fillStyle = '#d8392f'; x.fillRect(0, h * .68, w * .2, h * .1); x.fillStyle = '#ffffff'; x.fillRect(w * .2, h * .68, w * .8, h * .1);
    x.font = F(w, h * .055, 800); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(s.tag || 'LIVE', w * .04, h * .73); x.fillStyle = '#141a26'; x.fillText((s.headline || 'BREAKING: CITY WAKES UP TO SILENCE').toUpperCase(), w * .23, h * .73);
    x.fillStyle = '#141a26'; x.fillRect(0, h * .78, w, h * .07); x.fillStyle = '#e8e8e8'; x.font = F(w, h * .038, 700); x.fillText(s.ticker || 'MARKETS STEADY  •  WEATHER: RAIN LATER  •  TRAFFIC CLEAR ON 9TH', w * .03, h * .815);
  },
  sport(x, w, h, s, u) { x.fillStyle = '#3f7d3a'; x.fillRect(0, 0, w, h); x.fillStyle = '#4a8a44'; for (let i = 0; i < 8; i += 2) x.fillRect(i * w / 8, 0, w / 8, h); x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = u * .4; x.strokeRect(w * .05, h * .1, w * .9, h * .8); x.beginPath(); x.moveTo(w / 2, h * .1); x.lineTo(w / 2, h * .9); x.stroke(); x.fillStyle = '#141a26'; x.fillRect(w * .03, h * .04, w * .3, h * .1); x.fillStyle = '#ffffff'; x.font = F(w, h * .06, 800); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(`${s.a || 'RED'} ${s.score || '2-1'} ${s.b || 'BLU'}`, w * .18, h * .09); },
  static(x, w, h) { const im = x.createImageData(w, h); let a = 12345; for (let i = 0; i < im.data.length; i += 4) { a = (a * 1103515245 + 12345) & 0x7fffffff; const v = (a >> 8) & 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); },
  ecg(x, w, h, s, u, t) {
    x.fillStyle = '#060b0a'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(80,200,140,.12)'; x.lineWidth = 1; for (let i = 1; i < 10; i++) { x.beginPath(); x.moveTo(i * w / 10, 0); x.lineTo(i * w / 10, h); x.stroke(); }
    const bpm = s.bpm ?? 72, per = 60 / bpm, sweep = (t % 4) / 4, gx = w * .7;
    x.strokeStyle = '#46e08a'; x.lineWidth = u * .45; x.lineJoin = 'round'; x.beginPath();
    for (let i = 0; i <= 200; i++) { const px = i / 200 * gx; if (Math.abs(px / gx - sweep) < .03) { x.stroke(); x.beginPath(); continue; }
      const tt = (px / gx) * 4, ph = (tt % per) / per; let v = 0; if (!s.flat) { if (ph > .1 && ph < .14) v = -.08; else if (ph > .18 && ph < .21) v = .55; else if (ph > .21 && ph < .25) v = -.25; else if (ph > .4 && ph < .5) v = .1 * Math.sin((ph - .4) / .1 * Math.PI); }
      const py = h * .45 - v * h * .5; i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke();
    x.textAlign = 'right'; x.textBaseline = 'middle'; x.fillStyle = '#46e08a'; x.font = F(w, h * .16, 800); x.fillText(s.flat ? '0' : String(bpm), w * .96, h * .3); x.font = F(w, h * .06, 700); x.fillText('HR', w * .96, h * .14);
    x.fillStyle = '#5ac8f0'; x.font = F(w, h * .13, 800); x.fillText(String(s.spo2 ?? 98), w * .96, h * .66); x.font = F(w, h * .06, 700); x.fillText('SpO2', w * .96, h * .52);
  },
  atm(x, w, h, s, u) { x.fillStyle = '#9fc6ed'; x.fillRect(0, 0, w, h); x.fillStyle = '#1f3b73'; x.fillRect(0, 0, w, h * .2); x.fillStyle = '#ffffff'; x.font = F(w, h * .1, 800); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s.bank || 'NOVA BANK', w / 2, h * .1); x.fillStyle = '#1d2330'; x.font = F(w, h * .09, 700); x.fillText(s.text || 'INSERT CARD', w / 2, h * .55); },
};
DESK.text = PHONE.text; DESK.off = PHONE.off; DESK.lock = PHONE.lock; DESK.photo = PHONE.photo; DESK.video = PHONE.video;
PHONE.ecg = DESK.ecg;

/** draw a spec on a canvas context (kind: phone | tablet | laptop | monitor | tv | ecg | atm) at time t */
export function drawScreen(x, w, h, spec, kind = 'phone', t = 0) {
  x.save(); x.clearRect(0, 0, w, h); x.textBaseline = 'middle';
  const u = (kind === 'phone' || kind === 'tablet' ? w : h) / (kind === 'phone' ? 26 : kind === 'tablet' ? 32 : 30);
  try {
    if (typeof spec === 'function') spec(x, w, h, t);
    else {
      const s = typeof spec === 'string' ? { ui: 'text', text: spec } : spec || {};
      const ui = s.ui || (s.text ? 'text' : kind === 'tv' ? 'news' : kind === 'ecg' ? 'ecg' : kind === 'atm' ? 'atm' : kind === 'phone' || kind === 'tablet' ? 'lock' : 'windows');
      const fn = (kind === 'phone' || kind === 'tablet' ? PHONE[ui] || DESK[ui] : DESK[ui] || PHONE[ui]) || PHONE.text;
      fn(x, w, h, s, u, t);
      if ((kind === 'phone') && s.notch !== false && ui !== 'off') notch(x, w, u);
    }
  } finally { x.restore(); }
}
const CACHE = new Map();
/** a screen texture: cached for data specs, or animated: { tex, update(t) } when fps > 0 / the UI moves (call timer, ecg, timer) */
export function screenTexture(spec, kind, w, h, o = {}) {
  const moving = typeof spec === 'function' ? (o.fps ?? 0) > 0 : !!spec && typeof spec === 'object' && (spec.timer != null || spec.ui === 'timer' || spec.ui === 'ecg' || kind === 'ecg' || (o.fps ?? 0) > 0);
  const key = typeof spec === 'function' || moving ? null : kind + '|' + w + 'x' + h + '|' + JSON.stringify(spec ?? null);
  if (key && CACHE.has(key)) return { tex: CACHE.get(key), update: null };
  const t0 = o.t ?? 0;
  const tex = canvasTex(w, h, (x, cw, ch) => drawScreen(x, cw, ch, spec, kind, t0));
  if (key) { tex.userData.keep = true; CACHE.set(key, tex); return { tex, update: null }; }
  const fps = o.fps || (kind === 'ecg' || spec?.ui === 'ecg' ? 12 : 1);
  let last = -1;
  return { tex, update: t => { const k = Math.floor(t * fps); if (k === last) return; last = k; const c = tex.userData.canvas; drawScreen(c.getContext('2d'), c.width, c.height, spec, kind, k / fps); tex.needsUpdate = true; } };
}
