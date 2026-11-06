// check_layout for Stick stories: what a person checking every frame would flag. Each issue: { t, type, what, other?, detail }.
//  offscreen  the character the shot is about is out of frame
//  cropped    a close framing cuts the subject's eyes / face at the frame edge
//  covered    an overlay (pill, label, HUD) sits over the subject's face
//  through    two characters stand inside each other at the same depth (not hugging / holding)
//  floating   a character's feet are above the floor with nothing under them (not seated, lying, jumping)
//  held       a prop held by a character is not at its hand
//  dark       the frame is too dark to read; dim: the middle (where the subject is) is murky
//  empty      most of the frame is one flat colour (an undressed set)
import { THREE, FW, FH } from './core.js';

function onScreen(S, p) { const q = p.clone().project(S.cam); return { x: (q.x + 1) / 2, y: (1 - q.y) / 2, front: p.clone().applyMatrix4(S.cam.matrixWorldInverse).z < 0 }; }
export function issues(S, def, t, where, ctx = {}) {
  const out = [];
  const push = (type, what, detail, other) => out.push({ t, type, what, other, detail: `${detail} ${where}` });
  const subject = S.subject?.isActor ? S.subject : (S.actors.length === 1 ? S.actors[0] : null);
  for (const a of S.actors) {
    const head = a.head(), R = a.headR ?? .18, s = onScreen(S, head), main = a === subject;
    if (main && (!s.front || s.x < -.03 || s.x > 1.03 || s.y < -.03 || s.y > 1.03)) push('offscreen', a.name, `the head of ${a.name} is out of frame`);
    if (main && s.front) {
      const top = onScreen(S, head.clone().add(new THREE.Vector3(0, R * .35, 0))), bot = onScreen(S, head.clone().add(new THREE.Vector3(0, -R * .5, 0)));
      if (top.y < .01 && bot.y > 0) push('cropped', a.name, `the frame cuts ${a.name}'s eyes at the top: frame wider or lower`);
      const l = onScreen(S, head.clone().add(new THREE.Vector3(-R * .6, 0, 0))), r = onScreen(S, head.clone().add(new THREE.Vector3(R * .6, 0, 0)));
      if ((l.x < 0 && r.x > 0) || (r.x > 1 && l.x < 1)) push('cropped', a.name, `the frame cuts ${a.name}'s face at the side`);
      for (const b of ctx.overlayBoxes || []) { const fx = s.x * FW, fy = s.y * FH, rr = Math.abs(bot.y - top.y) * FH * .9;
        if (fx + rr > b.box.x && fx - rr < b.box.x + b.box.w && fy + rr > b.box.y && fy - rr < b.box.y + b.box.h) push('covered', a.name, `${b.what} sits over ${a.name}'s face: move it`, b.what); }
    }
    if (a.root?.position && !a.seats?.length && !a.moves?.some?.(m => m.air && t >= m.t0 && t <= m.t1) && !a.lying?.(t) && (a.feetY?.(t) ?? 0) > .06 + (a.floorY ?? 0)) push('floating', a.name, `${a.name}'s feet are ${(a.feetY(t) - (a.floorY ?? 0)).toFixed(2)} m above the floor`);
    for (const h of a.holds || []) { if (t < h.t0 || t >= (h.t1 ?? 1e9) || h.side === 'both' || !h.obj?.isObject3D) continue; const hp = a.handPos(h.side), b = new THREE.Box3().setFromObject(h.obj); if (b.isEmpty()) continue; const d = b.distanceToPoint(hp); if (d > .05) push('held', a.name, `${h.obj.name || 'a prop'} held by ${a.name} is ${d.toFixed(2)} m from the hand`, h.obj.name || 'prop'); }
  }
  for (let i = 0; i < S.actors.length; i++) for (let j = i + 1; j < S.actors.length; j++) {
    const A = S.actors[i], B = S.actors[j]; if (A.touching?.(B, t) || B.touching?.(A, t)) continue;
    const pa = A.root.position, pb = B.root.position;
    if (Math.abs(pa.z - pb.z) < .25 && Math.abs(pa.x - pb.x) < (A.headR + B.headR) * 1.1 && Math.abs(pa.y - pb.y) < .3) push('through', A.name, `${A.name} and ${B.name} stand inside each other`, B.name);
  }
  if (ctx.renderer) {
    const w = 64, h = 36;
    try {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(ctx.renderer.domElement, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data;
      const lum = k => (.2126 * d[k] + .7152 * d[k + 1] + .0722 * d[k + 2]) / 255, key = k => (d[k] >> 4) + ',' + (d[k + 1] >> 4) + ',' + (d[k + 2] >> 4);
      let sum = 0; const hist = new Map(); for (let k = 0; k < d.length; k += 4) { sum += lum(k); const q = key(k); hist.set(q, (hist.get(q) || 0) + 1); }
      const mean = sum / (w * h); if (mean < .05 && !def.dark) push('dark', 'frame', `the frame is too dark (mean ${mean.toFixed(3)}): add a practical light or lift the grade`);
      const top = Math.max(...hist.values()) / (w * h); if (top > .7 && !def.plain) push('empty', 'frame', `${Math.round(top * 100)} % of the frame is one flat colour: dress the set`);
    } catch { /* no read-back */ }
  }
  return out;
}
