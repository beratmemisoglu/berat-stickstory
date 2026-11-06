// module.recon.canvas-materials v1 - procedural canvas textures (colour + bump from ONE pattern) sized in metres, and the
// material presets that survived critique in the three shot-match scenes (night café, prison-wall dig, prison tunnel).
// Every preset is drawn once per parameter set and cached; materials clone the textures with their own repeat.
// Contract: THREE from the project's engine.js, hh (deterministic noise) from the recon kit's lib/crimeover.js.
//
//   const set = brick({ soot: .5, grime: .55, dark: .78, grey: .38 });   // a texture set: { map, bumpMap, bumpScale, tile }
//   part(box(6, 3, .3), tiled(set, 6, 3, { rough: .9 }), ...)            // repeat = face metres / tile metres
//   part(metricBox(6, 3, .3), perMetre(set, { rough: .9 }), ...)         // geometry with metric UVs (module.any.metric-box)
import { THREE } from '../../engine.js';
import { hh } from '../../lib/crimeover.js';

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const CACHE = new Map();
// texSet(key, w, h, paint(ctx, W, H, bump), { bump, tile: [tw, th] metres one canvas covers, rot }) -> cached set
export function texSet(key, w, h, paint, o = {}) {
  if (CACHE.has(key)) return CACHE.get(key);
  const s = { map: canvasTex(w, h, (x, W, H) => paint(x, W, H, false)), bumpMap: canvasTex(w, h, (x, W, H) => paint(x, W, H, true), false), bumpScale: o.bump ?? 2, tile: o.tile ?? [2, 2], key };
  CACHE.set(key, s); return s;
}
// tiled(set, w, h, o): a material for a w x h face (0..1 UVs, e.g. a plain BoxGeometry face): repeat = w / tile.
// o: color, rough, metal, bump (bumpScale), unit (square tile override in m), repeat [rx, ry] (explicit), ox, oy,
// rot (radians: Math.PI / 2 turns the grain to run along a vertical member), physical (MeshPhysicalMaterial), x (extra params)
export function tiled(set, w = 1, h = 1, o = {}) {
  const [tw, th] = o.unit ? [o.unit, o.unit] : set.tile, rep = o.repeat ?? [w / tw, h / th], m = {};
  for (const k of ['map', 'bumpMap']) { const t = set[k].clone(); t.repeat.set(rep[0], rep[1]); t.offset.set(o.ox ?? 0, o.oy ?? 0); if (o.rot) t.rotation = o.rot; t.needsUpdate = true; m[k] = t; }
  return new (o.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({ color: o.color ?? 0xffffff, roughness: o.rough ?? .85, metalness: o.metal ?? 0, bumpScale: o.bump ?? set.bumpScale, ...m, ...(o.x ?? {}) });
}
// perMetre(set, o): a material for geometry whose UVs are in metres (metricBox, relief, frustum): repeat = 1 / tile
export const perMetre = (set, o = {}) => tiled(set, 1, 1, o);
// sRGB colour sampled from a reference -> the LINEAR colour three.js materials expect ('#e65f14' -> (.78, .12, .008))
export const fromRef = hex => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
const rgb = (c, k = 1) => `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;

// ---------------------------------------------------------------------------------------------------------------------
// BUILDING
// ---------------------------------------------------------------------------------------------------------------------
// brick: one canvas = 2 m x 3 m (38 courses, 8 bricks a row, running bond), soot at the top, grime at the foot.
// o: seed, dark (brightness x), grey (0..1 toward grey), mortar '#5a534c', soot, grime, blots (5), streaks (0)
const BRICK_PAL = [[104, 56, 44], [112, 60, 46], [96, 52, 42], [118, 66, 50], [90, 50, 40], [108, 62, 50], [100, 58, 48], [114, 68, 54]];
export function brick(o = {}) {
  return texSet('brick' + JSON.stringify(o), 1024, 1536, (x, W, H, bump) => {
    const rows = 38, cols = 8, rh = H / rows, cw = W / cols, mo = 4, sd = o.seed ?? 0, dk = o.dark ?? 1;
    x.fillStyle = bump ? '#1c1c1c' : (o.mortar ?? '#5a534c'); x.fillRect(0, 0, W, H);
    if (!bump) for (let i = 0; i < 9000; i++) { const v = hh(i, 41 + sd); x.fillStyle = v < .5 ? `rgba(0,0,0,${.05 + v * .15})` : `rgba(255,240,220,${(v - .5) * .08})`; x.fillRect(hh(i, 42) * W, hh(i, 43) * H, 2, 2); }
    for (let r = 0; r < rows; r++) for (let c = -1; c <= cols; c++) {
      const cc = ((c % cols) + cols) % cols, id = r * 97 + cc * 13 + sd * 1009, bx = c * cw + (r % 2) * cw / 2 + mo / 2, by = r * rh + mo / 2, bw = cw - mo, bh = rh - mo;
      if (bump) { const v = 170 + hh(id, 5) * 50; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(bx, by, bw, bh);
        x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(bx, by + bh - 2, bw, 2); x.fillRect(bx + bw - 2, by, 2, bh);
        x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(bx, by, bw, 1.5);
        for (let k = 0; k < 14; k++) { x.fillStyle = `rgba(0,0,0,${.15 + hh(id + k, 9) * .3})`; x.fillRect(bx + hh(id + k, 10) * bw, by + hh(id + k, 11) * bh, 2 + hh(id + k, 12) * 5, 2); }
        if (hh(id, 13) < .3) { x.fillStyle = '#1c1c1c'; const cx = hh(id, 14) < .5 ? bx : bx + bw - 6; x.fillRect(cx, hh(id, 15) < .5 ? by : by + bh - 5, 6 + hh(id, 16) * 6, 4 + hh(id, 17) * 3); }
        continue; }
      let col = BRICK_PAL[(hh(id, 1) * BRICK_PAL.length) | 0], k = (.9 + hh(id, 2) * .13) * dk;
      if (hh(id, 3) < .05) k *= .74;                                    // a burnt brick
      if (o.grey) { const a = (col[0] + col[1] + col[2]) / 3; col = col.map(v => v * (1 - o.grey) + a * o.grey); }
      x.fillStyle = rgb(col, k); x.fillRect(bx, by, bw, bh);
      const g = x.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, 'rgba(255,220,190,.07)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); x.fillStyle = g; x.fillRect(bx, by, bw, bh);
      if (hh(id, 4) < .03) { x.fillStyle = 'rgba(160,150,140,.1)'; x.fillRect(bx, by, bw, bh); }   // efflorescence
      for (let k2 = 0; k2 < 40; k2++) { const v = hh(id * 3 + k2, 6); x.fillStyle = v < .6 ? `rgba(0,0,0,${.08 + v * .2})` : `rgba(255,210,170,${(v - .6) * .15})`; x.fillRect(bx + hh(id + k2, 7) * bw, by + hh(id + k2, 8) * bh, 1 + hh(k2, id) * 3, 1 + hh(k2 + 5, id) * 2); }
      if (hh(id, 13) < .3) { x.fillStyle = o.mortar ?? '#5a534c'; const cx = hh(id, 14) < .5 ? bx : bx + bw - 6; x.fillRect(cx, hh(id, 15) < .5 ? by : by + bh - 5, 6 + hh(id, 16) * 6, 4 + hh(id, 17) * 3); }
    }
    if (bump) return;
    if (o.soot) { const g = x.createLinearGradient(0, 0, 0, H * .3); g.addColorStop(0, `rgba(8,6,5,${o.soot})`); g.addColorStop(1, 'rgba(8,6,5,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H * .3); }
    if (o.grime) { const g = x.createLinearGradient(0, H, 0, H * .86); g.addColorStop(0, `rgba(14,10,8,${o.grime})`); g.addColorStop(1, 'rgba(14,10,8,0)'); x.fillStyle = g; x.fillRect(0, H * .86, W, H * .14); }
    for (let i = 0; i < (o.blots ?? 5); i++) { x.fillStyle = `rgba(0,0,0,${.03 + hh(i, 51 + sd) * .04})`; x.beginPath(); x.ellipse(hh(i, 52 + sd) * W, hh(i, 53 + sd) * H, 60 + hh(i, 54) * 200, 40 + hh(i, 55) * 160, 0, 0, 7); x.fill(); }
    for (let i = 0; i < (o.streaks ?? 0); i++) { const sx = hh(i, 61 + sd) * W, len = H * (.15 + hh(i, 62) * .5), g = x.createLinearGradient(0, 0, 0, len); g.addColorStop(0, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(sx, 0, 6 + hh(i, 63) * 26, len); }
  }, { tile: [2, 3], bump: 1.8 });
}
// rowlock coping: bricks on edge across a wall top (u: 0.6 m = 8 brick ends, v: across the wall)
export function coping() {
  return texSet('coping', 512, 128, (x, W, H, bump) => { x.fillStyle = bump ? '#1c1c1c' : '#5a5148'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) { const bx = i * 64 + 2, id = i * 31 + 7; if (bump) { const v = 180 + hh(id, 1) * 60 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(bx, 3, 60, H - 6); continue; }
      { const c0 = BRICK_PAL[(hh(id, 2) * 8) | 0], a = (c0[0] + c0[1] + c0[2]) / 3; x.fillStyle = rgb(c0.map(v => v * .45 + a * .55), .8 + hh(id, 3) * .3); } x.fillRect(bx, 3, 60, H - 6);
      for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(0,0,0,${hh(id + k, 4) * .25})`; x.fillRect(bx + hh(k, id) * 60, 3 + hh(k + 1, id) * (H - 6), 2, 2); } } }, { tile: [.6, .3], bump: 2.4 });
}
// cast concrete (café slabs): 2 m tile, mottled, pores, rain-stain drips from the top edge, faint formwork lines. o.drips
export function castConcrete(base = '#36383c', o = {}) {
  return texSet('conc' + base + JSON.stringify(o), 1024, 1024, (x, W, H, bump) => { x.fillStyle = bump ? '#808080' : base; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1), a = bump ? .05 : .025 + hh(i, 2) * .03, c = hh(i, 1) < .55 ? '0,0,0' : '255,255,255';
      g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`); x.save(); x.translate(hh(i, 3) * W, hh(i, 4) * H); x.rotate(hh(i, 7) * 3); x.scale(40 + hh(i, 5) * 160, 25 + hh(i, 6) * 110); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore(); }
    for (let i = 0; i < 26000; i++) { const v = hh(i, 8); x.fillStyle = v < .5 ? `rgba(0,0,0,${.05 + hh(i, 9) * .15})` : `rgba(255,255,255,${.02 + hh(i, 9) * .07})`; x.fillRect(hh(i, 10) * W, hh(i, 11) * H, 1 + hh(i, 12) * 2, 1 + hh(i, 13) * 2); }
    for (let i = 0; i < 900; i++) { const r = .6 + hh(i, 14) ** 3 * 2.2; x.fillStyle = bump ? 'rgba(0,0,0,.7)' : 'rgba(10,10,10,.35)'; x.beginPath(); x.arc(hh(i, 15) * W, hh(i, 16) * H, r, 0, 7); x.fill(); }
    if (!bump) { for (let i = 0; i < (o.drips ?? 0); i++) { const sx = hh(i, 17) * W, len = H * (.1 + hh(i, 18) * .5), g = x.createLinearGradient(0, 0, 0, len); g.addColorStop(0, `rgba(0,0,0,${.12 + hh(i, 19) * .18})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(sx, 0, 4 + hh(i, 20) * 30, len); }
      x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = 2; for (const y of [256, 768]) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); } } }, { tile: [2, 2], bump: 2.2 });
}
// board-formed concrete (prison cell): pale grey, pits and air holes, faint vertical stains, damp blotches;
// o.base colour, o.seams (form-panel joints), o.ties (form-tie holes in rows). 2 m tile.
export function boardConcrete(o = {}) {
  const base = o.base ?? '#8e8c88';
  return texSet('bconc' + JSON.stringify(o), 1024, 1024, (x, W, H, bump) => { x.fillStyle = bump ? '#808080' : base; x.fillRect(0, 0, W, W);
    for (let i = 0; i < 26000; i++) { const v = hh(i, 1), s = 1 + hh(i, 4) * 2.5; x.fillStyle = bump ? (v < .5 ? `rgba(0,0,0,${.15 + hh(i, 2) * .3})` : `rgba(255,255,255,${.1 + hh(i, 2) * .2})`) : (v < .55 ? `rgba(0,0,0,${.03 + hh(i, 2) * .08})` : `rgba(255,255,255,${.02 + hh(i, 2) * .06})`); x.fillRect(hh(i, 5) * W, hh(i, 6) * W, s, s); }
    for (let i = 0; i < 200; i++) { const r = .8 + hh(i, 21) ** 4 * 3; x.fillStyle = bump ? 'rgba(0,0,0,.85)' : 'rgba(30,28,26,.55)'; x.beginPath(); x.ellipse(hh(i, 22) * W, hh(i, 23) * W, r, r * (.6 + hh(i, 24) * .5), 0, 0, 7); x.fill(); }
    if (!bump) { for (let i = 0; i < 60; i++) { const X = hh(i, 31) * W, g = x.createLinearGradient(0, 0, 0, W); g.addColorStop(0, 'rgba(40,36,32,0)'); g.addColorStop(.5, `rgba(40,36,32,${.04 + hh(i, 32) * .08})`); g.addColorStop(1, 'rgba(40,36,32,0)');
        x.fillStyle = g; x.fillRect(X, hh(i, 33) * W * .5, 4 + hh(i, 34) * 30, W * (.3 + hh(i, 35) * .6)); }
      for (let i = 0; i < 140; i++) { x.fillStyle = `rgba(30,26,22,${.03 + hh(i, 41) * .05})`; x.fillRect(hh(i, 42) * W, hh(i, 43) * W, 1 + hh(i, 44) * 3, 20 + hh(i, 45) * 120); }
      x.filter = 'blur(18px)'; for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(35,32,28,${.06 + hh(i, 51) * .08})`; x.beginPath(); x.ellipse(hh(i, 52) * W, hh(i, 53) * W, 30 + hh(i, 54) * 90, 20 + hh(i, 55) * 70, hh(i, 56) * 3, 0, 7); x.fill(); } x.filter = 'none'; }
    if (o.ties) for (const Y of [W * .2, W * .55, W * .9]) for (let k = 0; k < 4; k++) { x.fillStyle = bump ? 'rgba(0,0,0,.9)' : 'rgba(25,23,20,.7)'; x.beginPath(); x.arc(W * (.125 + k * .25), Y, 5, 0, 7); x.fill(); }
    if (o.seams) { x.strokeStyle = bump ? 'rgba(0,0,0,.6)' : 'rgba(30,28,25,.25)'; x.lineWidth = 3; for (const X of [W * .25, W * .75]) { x.beginPath(); x.moveTo(X, 0); x.lineTo(X, W); x.stroke(); } }
  }, { tile: [2, 2], bump: o.bump ?? 2.5 });
}
// precast wall concrete (prison wall panels, footings, tower): vertical streaks, blotches, speckle. 3.2 m tile
export function panelConcrete() {
  return texSet('pconc', 1024, 1024, (x, W, H, bump) => { x.fillStyle = bump ? '#808080' : '#7d8186'; x.fillRect(0, 0, W, W);
    for (let i = 0; i < 160; i++) { const X = hh(i, 1) * W; x.fillStyle = bump ? 'rgba(0,0,0,.03)' : `rgba(30,32,36,${.02 + hh(i, 2) * .04})`; x.fillRect(X, hh(i, 3) * W * .3, 2 + hh(i, 4) * 8, W * (.3 + hh(i, 5) * .7)); }
    for (let i = 0; i < 90; i++) { x.fillStyle = bump ? 'rgba(0,0,0,.05)' : `rgba(${hh(i, 31) < .5 ? '20,22,26' : '200,204,210'},${.04 + hh(i, 32) * .07})`; x.beginPath(); x.ellipse(hh(i, 33) * W, hh(i, 34) * W, 30 + hh(i, 35) * 120, 20 + hh(i, 36) * 80, hh(i, 37) * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 30000; i++) { const v = hh(i, 6); x.fillStyle = bump ? (v < .5 ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.2)') : (v < .5 ? `rgba(0,0,0,${hh(i, 7) * .12})` : `rgba(255,255,255,${hh(i, 7) * .08})`); x.fillRect(hh(i, 8) * W, hh(i, 9) * W, 1 + hh(i, 10) * 2, 1 + hh(i, 10) * 2); }
    for (let i = 0; i < 60; i++) { x.fillStyle = bump ? 'rgba(0,0,0,.4)' : 'rgba(40,40,42,.25)'; x.beginPath(); x.arc(hh(i, 11) * W, hh(i, 12) * W, 1 + hh(i, 13) * 1.5, 0, 7); x.fill(); } }, { tile: [3.2, 3.2], bump: 1.2 });
}

// ---------------------------------------------------------------------------------------------------------------------
// WOOD AND LEATHER
// ---------------------------------------------------------------------------------------------------------------------
// floor planks: 2 m x 2 m, 16 boards of 12.5 cm, staggered butt joints, grain, knots, wear blotches
export function planks() {
  return texSet('planks', 1024, 1024, (x, W, H, bump) => { const rows = 16, rh = H / rows; x.fillStyle = bump ? '#101010' : '#1a110b'; x.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) { let X = -hh(r, 1) * W * .6; let k = 0;
      while (X < W) { const len = W * (.45 + hh(r * 7 + k, 2) * .5), id = r * 19 + k, v = hh(id, 3), y0 = r * rh + 1.5;
        for (const ox of [0, -W, W]) { const X0 = X + ox + 1.5;
          if (bump) { const b = 190 + v * 50 | 0; x.fillStyle = `rgb(${b},${b},${b})`; x.fillRect(X0, y0, len - 3, rh - 3); continue; }
          x.fillStyle = `rgb(${76 + v * 30 | 0},${54 + v * 20 | 0},${42 + v * 14 | 0})`; x.fillRect(X0, y0, len - 3, rh - 3);
          for (let gq = 0; gq < 10; gq++) { x.strokeStyle = `rgba(${hh(gq, id) < .5 ? '0,0,0' : '255,200,150'},${.05 + hh(gq + 3, id) * .08})`; x.lineWidth = 1 + hh(gq, id + 1) * 2; const yy = y0 + 3 + hh(gq + 9, id) * (rh - 9);
            x.beginPath(); x.moveTo(X0, yy); x.bezierCurveTo(X0 + len * .3, yy + (hh(gq, 77) - .5) * 6, X0 + len * .7, yy + (hh(gq, 78) - .5) * 6, X0 + len, yy + (hh(gq, 79) - .5) * 4); x.stroke(); }
          const g = x.createLinearGradient(0, y0, 0, y0 + rh); g.addColorStop(0, 'rgba(0,0,0,.12)'); g.addColorStop(.5, 'rgba(255,220,180,.04)'); g.addColorStop(1, 'rgba(0,0,0,.16)'); x.fillStyle = g; x.fillRect(X0, y0, len - 3, rh - 3);
          if (hh(id, 5) < .2) { x.fillStyle = 'rgba(30,18,10,.5)'; x.beginPath(); x.ellipse(X0 + hh(id, 6) * len, y0 + rh / 2, 5, 3, 0, 0, 7); x.fill(); } }
        X += len; k++; } }
    if (!bump) for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(0,0,0,${.05 + hh(i, 91) * .07})`; x.beginPath(); x.ellipse(hh(i, 92) * W, hh(i, 93) * H, 50 + hh(i, 94) * 150, 30 + hh(i, 95) * 80, 0, 0, 7); x.fill(); } }, { tile: [2, 2], bump: 1.2 });
}
// furniture wood: fine grain along u (base colour). Half-metre tile.
export function furnitureWood(base = '#3a2618') {
  return texSet('fwood' + base, 512, 512, (x, W, H, bump) => { x.fillStyle = bump ? '#909090' : base; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 140; i++) { const y = hh(i, 1) * H; x.strokeStyle = bump ? `rgba(0,0,0,${.1 + hh(i, 2) * .2})` : `rgba(${hh(i, 3) < .6 ? '0,0,0' : '255,210,160'},${.05 + hh(i, 2) * .1})`; x.lineWidth = 1 + hh(i, 4) * 3;
      x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(W * .33, y + (hh(i, 5) - .5) * 14, W * .66, y + (hh(i, 6) - .5) * 14, W, y); x.stroke(); } }, { tile: [.5, .5], bump: .6 });
}
// weathered planks (grey-brown, wavy grain, dark knots). Grain runs along u: for vertical members pass rot: Math.PI / 2
// to tiled()/perMetre() (pitfall.any.wood-grain-direction). 2 m tile.
export function weatheredWood() {
  return texSet('wwood', 512, 512, (x, W, H, bump) => { x.fillStyle = bump ? '#808080' : '#6a5c4c'; x.fillRect(0, 0, W, W);
    for (let g = 0; g < 70; g++) { const y = hh(g, 1) * W; x.strokeStyle = bump ? `rgba(0,0,0,${.2 + hh(g, 2) * .4})` : `rgba(${hh(g, 3) < .5 ? '20,14,8' : '150,130,105'},${.1 + hh(g, 2) * .2})`; x.lineWidth = 1 + hh(g, 4) * 2;
      x.beginPath(); x.moveTo(0, y); for (let X = 0; X <= W; X += 32) x.lineTo(X, y + Math.sin(X / 60 + g) * 3); x.stroke(); }
    for (let i = 0; i < 12; i++) { x.fillStyle = bump ? 'rgba(0,0,0,.6)' : 'rgba(25,18,10,.5)'; x.beginPath(); x.ellipse(hh(i, 9) * W, hh(i, 10) * W, 6, 3, 0, 0, 7); x.fill(); } }, { tile: [2, 2], bump: 1.5 });
}
// lining boards (mine gallery): rows of planks with grain and knots, 8 rows per canvas. 2.6 m tile
export function liningBoards() {
  return texSet('lining', 1024, 1024, (x, W, H, bump) => { x.fillStyle = bump ? '#101010' : '#1d140d'; x.fillRect(0, 0, W, W); const rows = 8;
    for (let r = 0; r < rows; r++) for (let k = 0; k < 2; k++) { const off = hh(r, 9) * W, len = W / 1.6, X = (off + k * len) % W, v = hh(r * 3 + k, 1), y0 = r * W / rows;
      x.fillStyle = bump ? '#d0d0d0' : `rgb(${84 + v * 36 | 0},${66 + v * 26 | 0},${50 + v * 18 | 0})`; x.fillRect(X + 3, y0 + 4, len - 6, W / rows - 8);
      if (X + len > W) x.fillRect(X - W + 3, y0 + 4, len - 6, W / rows - 8);
      if (!bump) for (let g = 0; g < 26; g++) { x.strokeStyle = `rgba(${hh(g, 5) < .5 ? '0,0,0' : '255,220,170'},${.05 + hh(g, r + k) * .1})`; x.lineWidth = 1 + hh(g, 7) * 2; x.beginPath(); const y = y0 + 8 + hh(g, r * 3 + k) * (W / rows - 16); x.moveTo(0, y); x.bezierCurveTo(W * .3, y + (hh(g, 8) - .5) * 8, W * .6, y + (hh(g, 9) - .5) * 8, W, y); x.stroke(); }
      if (!bump) for (let n = 0; n < 2; n++) { x.fillStyle = 'rgba(20,12,6,.6)'; x.beginPath(); x.ellipse(X + hh(r + n, 3) * len, y0 + W / rows / 2, 7, 4, 0, 0, 7); x.fill(); } } }, { tile: [2.6, 2.6], bump: 1.6 });
}
// deck boards seen from above: weathered grey-brown streaks, dark gaps, nail heads at both ends. 2.4 m tile
export function deckBoards() {
  return texSet('deck', 1024, 1024, (x, W, H, bump) => { x.fillStyle = bump ? '#202020' : '#4a4038'; x.fillRect(0, 0, W, W);
    for (let i = 0; i < 300; i++) { const v = hh(i, 1); x.fillStyle = bump ? 'rgba(255,255,255,.1)' : `rgba(${120 + v * 60 | 0},${108 + v * 52 | 0},${96 + v * 44 | 0},.18)`; x.fillRect(hh(i, 2) * W, hh(i, 3) * W, 40 + hh(i, 4) * 300, 2 + hh(i, 5) * 5); }
    for (let i = 0; i < 20000; i++) { x.fillStyle = `rgba(0,0,0,${hh(i, 6) * .25})`; x.fillRect(hh(i, 7) * W, hh(i, 8) * W, 2, 1); }
    for (const y of [W * .15, W * .85]) for (let k = 0; k < 4; k++) { x.fillStyle = bump ? '#000' : '#1a1612'; x.beginPath(); x.arc(W * (k + .5) / 4, y, 6, 0, 7); x.fill(); } }, { tile: [2.4, 2.4], bump: 1.2 });
}
// leather: mottled, fine creases; channels = vertical tufting (4 channels per canvas). Use explicit repeats on cushions.
export function leather(channels = false) {
  return texSet('leather' + channels, 512, 512, (x, W, H, bump) => { x.fillStyle = bump ? '#909090' : '#43302a'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(${hh(i, 1) < .5 ? '0,0,0' : '255,200,170'},${.03 + hh(i, 2) * .05})`; x.beginPath(); x.ellipse(hh(i, 3) * W, hh(i, 4) * H, 20 + hh(i, 5) * 70, 10 + hh(i, 6) * 40, hh(i, 7) * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 260; i++) { x.strokeStyle = `rgba(0,0,0,${.06 + hh(i, 8) * .1})`; x.lineWidth = 1; x.beginPath(); const px = hh(i, 9) * W, py = hh(i, 10) * H; x.moveTo(px, py); x.lineTo(px + (hh(i, 11) - .5) * 30, py + (hh(i, 12) - .5) * 14); x.stroke(); }
    if (channels) for (let c = 0; c < 4; c++) { const x0 = c * W / 4, g = x.createLinearGradient(x0, 0, x0 + W / 4, 0);
      g.addColorStop(0, bump ? 'rgba(0,0,0,.9)' : 'rgba(0,0,0,.45)'); g.addColorStop(.08, 'rgba(0,0,0,.1)'); g.addColorStop(.45, bump ? 'rgba(255,255,255,.35)' : 'rgba(255,210,180,.07)'); g.addColorStop(.92, 'rgba(0,0,0,.1)'); g.addColorStop(1, bump ? 'rgba(0,0,0,.9)' : 'rgba(0,0,0,.45)');
      x.fillStyle = g; x.fillRect(x0, 0, W / 4, H); } }, { tile: [.6, .6], bump: 1.2 });
}

// ---------------------------------------------------------------------------------------------------------------------
// EARTH AND ROCK
// ---------------------------------------------------------------------------------------------------------------------
// dark broken rock and packed soil (café cut-away earth block): jagged clods lit from the top left. 2.4 m tile
export function earthClods() {
  return texSet('earth', 1024, 1024, (x, W, H, bump) => { x.fillStyle = bump ? '#202020' : '#24211e'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 2200; i++) { const r = 6 + hh(i, 1) ** 1.6 * 34, X0 = hh(i, 2) * W, Y0 = hh(i, 3) * H, v = hh(i, 4), n = 7 + (hh(i, 5) * 4 | 0);
      const pts = []; for (let k = 0; k < n; k++) { const a = k / n * 6.283 + hh(i, 5), rr = r * (.5 + hh(i * 7 + k, 6) * .7); pts.push([Math.cos(a) * rr, Math.sin(a) * rr * .7]); }
      for (const [ox, oy] of [[0, 0], [W, 0], [-W, 0], [0, H], [0, -H]]) { const X = X0 + ox, Y = Y0 + oy; if (X < -60 || X > W + 60 || Y < -60 || Y > H + 60) continue;
        const path = () => { x.beginPath(); pts.forEach(([a, b], k) => k ? x.lineTo(X + a, Y + b) : x.moveTo(X + a, Y + b)); x.closePath(); };
        if (bump) { path(); const b = 110 + v * 120 | 0; x.fillStyle = `rgb(${b},${b},${b})`; x.fill(); continue; }
        const g = x.createLinearGradient(X - r, Y - r, X + r, Y + r), b = 34 + v * 44;
        g.addColorStop(0, `rgb(${b * 1.28 | 0},${b * 1.18 | 0},${b * 1.05 | 0})`); g.addColorStop(.5, `rgb(${b | 0},${b * .97 | 0},${b * .95 | 0})`); g.addColorStop(1, `rgb(${b * .5 | 0},${b * .48 | 0},${b * .47 | 0})`);
        path(); x.fillStyle = g; x.fill(); x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 1.5; x.stroke(); } }
    for (let i = 0; i < 50000; i++) { x.fillStyle = `rgba(0,0,0,${hh(i, 7) * .45})`; x.fillRect(hh(i, 8) * W, hh(i, 9) * H, 1 + hh(i, 10) * 2, 1 + hh(i, 11) * 2); }
    for (let i = 0; i < 60; i++) { x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 1 + hh(i, 12) * 2; x.beginPath(); let px = hh(i, 13) * W, py = hh(i, 14) * H; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (hh(i * 9 + k, 15) - .5) * 60; py += hh(i * 9 + k, 16) * 40; x.lineTo(px, py); } x.stroke(); } }, { tile: [2.4, 2.4], bump: 5 });
}
// dark root-laced soil band (right under a floor slab): crumbs and branching roots, darker at the top. 2 m x 0.25 m tile
export function rootSoil() {
  return texSet('rootsoil', 1024, 256, (x, W, H, bump) => { x.fillStyle = bump ? '#303030' : '#1f1915'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { const v = hh(i, 1); x.fillStyle = bump ? `rgba(255,255,255,${v * .3})` : `rgba(${60 + v * 40 | 0},${48 + v * 30 | 0},${36 + v * 22 | 0},${.2 + v * .4})`; x.fillRect(hh(i, 2) * W, hh(i, 3) * H, 1 + hh(i, 4) * 4, 1 + hh(i, 5) * 3); }
    for (let i = 0; i < 26; i++) { x.strokeStyle = bump ? 'rgba(255,255,255,.6)' : `rgba(${70 + hh(i, 6) * 30 | 0},${50 + hh(i, 6) * 20 | 0},${34},${.55 + hh(i, 7) * .3})`; let px = hh(i, 8) * W, py = hh(i, 9) * H * .3; x.lineWidth = 1 + hh(i, 10) * 3;
      x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 5; k++) { const nx = px + (hh(i * 5 + k, 11) - .5) * 120, ny = py + 20 + hh(i * 5 + k, 12) * 40; x.quadraticCurveTo((px + nx) / 2 + (hh(k, i) - .5) * 40, (py + ny) / 2, nx, ny); px = nx; py = ny; x.lineWidth *= .8; } x.stroke(); }
    if (!bump) { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); } }, { tile: [2, .25], bump: 3 });
}
// lumpy soil of a cut face (dig): clods first, faint strata after (strong stripes read as planks), pebbles. 4 m tile
export function strataSoil() {
  return texSet('strata', 1024, 1024, (x, W, H, bump) => { x.fillStyle = bump ? '#606060' : '#3e342c'; x.fillRect(0, 0, W, W);
    for (let i = 0; i < 700; i++) { const v = hh(i, 21), r = 8 + hh(i, 22) ** 2 * 50; x.fillStyle = bump ? `rgba(${v > .5 ? '255,255,255' : '0,0,0'},.16)` : `rgba(${50 + v * 40 | 0},${36 + v * 28 | 0},${26 + v * 18 | 0},.5)`;
      x.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283, rr = r * (.6 + hh(i * 9 + k, 23) * .6); x.lineTo(hh(i, 24) * W + Math.cos(a) * rr, hh(i, 25) * W + Math.sin(a) * rr * .7); } x.fill(); }
    for (let i = 0; i < 14; i++) { const y = hh(i, 1) * W, h = 10 + hh(i, 2) * 50, v = hh(i, 3);
      x.fillStyle = bump ? `rgba(${v > .5 ? 255 : 0},${v > .5 ? 255 : 0},${v > .5 ? 255 : 0},.1)` : `rgba(${70 + v * 50 | 0},${48 + v * 32 | 0},${30 + v * 20 | 0},.3)`;
      x.beginPath(); x.moveTo(0, y); for (let k = 0; k <= 16; k++) x.lineTo(k / 16 * W, y + (hh(i * 17 + k, 4) - .5) * 18); for (let k = 16; k >= 0; k--) x.lineTo(k / 16 * W, y + h + (hh(i * 19 + k, 5) - .5) * 18); x.fill(); }
    for (let i = 0; i < 2200; i++) { const r = 1.5 + hh(i, 6) ** 3 * 11, X = hh(i, 7) * W, Y = hh(i, 8) * W, v = hh(i, 9);
      x.fillStyle = bump ? `rgb(${150 + v * 100},${150 + v * 100},${150 + v * 100})` : `rgb(${58 + v * 34 | 0},${46 + v * 26 | 0},${38 + v * 20 | 0})`;
      x.beginPath(); x.ellipse(X, Y, r * 1.6, r * .7, hh(i, 10) * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 40000; i++) { x.fillStyle = `rgba(0,0,0,${hh(i, 11) * .35})`; x.fillRect(hh(i, 12) * W, hh(i, 13) * W, 2, 2); } }, { tile: [4, 4], bump: 6 });
}
// loose soil (prison tunnel): soft blurred crumbs (hard polygons read as cartoon gravel), grey stones, dark gaps. 2.2 m tile
export function looseSoil() {
  return texSet('loose', 1024, 1024, (x, W, H, bump) => { x.fillStyle = bump ? '#5a5a5a' : '#48403a'; x.fillRect(0, 0, W, W); x.filter = 'blur(1.5px)';
    for (let i = 0; i < 5000; i++) { const r = 3 + hh(i, 1) ** 2 * 18, X = hh(i, 2) * W, Y = hh(i, 3) * W, v = hh(i, 4);
      x.fillStyle = bump ? `rgba(${90 + v * 120 | 0},${90 + v * 120 | 0},${90 + v * 120 | 0},.7)` : `rgba(${64 + v * 50 | 0},${58 + v * 45 | 0},${52 + v * 41 | 0},.6)`;
      x.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283, rr = r * (.6 + hh(i * 7 + k, 5) * .6); x.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr * .8); } x.fill(); }
    x.filter = 'none';
    for (let i = 0; i < 90; i++) { const r = 2 + hh(i, 61) ** 2 * 8, X = hh(i, 62) * W, Y = hh(i, 63) * W, v = hh(i, 64);
      x.fillStyle = bump ? `rgb(${170 + v * 80 | 0},${170 + v * 80 | 0},${170 + v * 80 | 0})` : `rgb(${80 + v * 40 | 0},${76 + v * 38 | 0},${70 + v * 36 | 0})`;
      x.beginPath(); x.ellipse(X, Y, r, r * (.6 + hh(i, 65) * .4), hh(i, 66) * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 30000; i++) { x.fillStyle = hh(i, 9) < .7 ? `rgba(0,0,0,${hh(i, 6) * .3})` : `rgba(255,240,220,${hh(i, 6) * .08})`; x.fillRect(hh(i, 7) * W, hh(i, 8) * W, 2, 2); } }, { tile: [2.2, 2.2], bump: .6 });
}
// broken rock of an end face: angular plates. 5 m tile
export function rockFace() {
  return texSet('rockface', 1024, 1024, (x, W, H, bump) => { x.fillStyle = bump ? '#303030' : '#3e3630'; x.fillRect(0, 0, W, W);
    for (let i = 0; i < 1100; i++) { const r = 8 + hh(i, 1) ** 2 * 55, X = hh(i, 2) * W, Y = hh(i, 3) * W, v = hh(i, 4);
      x.fillStyle = bump ? `rgb(${110 + v * 140},${110 + v * 140},${110 + v * 140})` : `rgb(${92 + v * 84 | 0},${82 + v * 74 | 0},${70 + v * 62 | 0})`;
      x.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283, rr = r * (.6 + hh(i * 7 + k, 5) * .6); x.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr * .75); } x.fill(); }
    for (let i = 0; i < 50000; i++) { x.fillStyle = `rgba(0,0,0,${hh(i, 6) * .4})`; x.fillRect(hh(i, 7) * W, hh(i, 8) * W, 2, 2); } }, { tile: [5, 5], bump: 9 });
}
// frosty ground top under a moon: grey-blue dust and gravel. 5 m tile
export function frostTop() {
  return texSet('frost', 1024, 1024, (x, W, H, bump) => { x.fillStyle = bump ? '#808080' : '#868c94'; x.fillRect(0, 0, W, W);
    for (let i = 0; i < 60; i++) { x.fillStyle = bump ? 'rgba(0,0,0,.05)' : `rgba(${hh(i, 1) < .5 ? '30,34,40' : '170,180,192'},${.1 + hh(i, 2) * .16})`; x.beginPath(); x.ellipse(hh(i, 3) * W, hh(i, 4) * W, 40 + hh(i, 5) * 160, 20 + hh(i, 6) * 80, hh(i, 7) * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 26000; i++) { const v = hh(i, 8), s = 1 + hh(i, 9) * 4; x.fillStyle = bump ? (v < .5 ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.35)') : (v < .45 ? `rgba(20,22,26,${.2 + hh(i, 10) * .3})` : `rgba(200,210,222,${.1 + hh(i, 10) * .25})`); x.fillRect(hh(i, 11) * W, hh(i, 12) * W, s, s); } }, { tile: [5, 5], bump: 2 });
}
// a pale gravel road with tyre ruts. 4 m tile
export function gravelRoad() {
  return texSet('road', 1024, 1024, (x, W, H, bump) => { x.fillStyle = bump ? '#808080' : '#b4b0a8'; x.fillRect(0, 0, W, W);
    for (let i = 0; i < 30; i++) { x.strokeStyle = bump ? 'rgba(0,0,0,.25)' : 'rgba(60,62,66,.18)'; x.lineWidth = 4 + hh(i, 1) * 10; const y = hh(i, 2) * W; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(W / 3, y + 20, W * .66, y - 20, W, y + (hh(i, 3) - .5) * 30); x.stroke(); }
    for (let i = 0; i < 20000; i++) { const v = hh(i, 4); x.fillStyle = bump ? (v < .5 ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.3)') : (v < .5 ? `rgba(40,40,44,${hh(i, 5) * .3})` : `rgba(230,232,238,${hh(i, 5) * .25})`); x.fillRect(hh(i, 6) * W, hh(i, 7) * W, 2, 2); } }, { tile: [4, 4], bump: 1.5 });
}
// packed dirt floor with pebbles (gallery floor, dirt piles, cart load). 2.2 m tile
export function dirtFloor() {
  return texSet('dirt', 1024, 1024, (x, W, H, bump) => { x.fillStyle = bump ? '#808080' : '#6a5c4e'; x.fillRect(0, 0, W, W);
    for (let i = 0; i < 80; i++) { x.fillStyle = bump ? 'rgba(255,255,255,.06)' : `rgba(${hh(i, 1) < .5 ? '40,28,18' : '140,110,80'},${.08 + hh(i, 2) * .12})`; x.beginPath(); x.ellipse(hh(i, 3) * W, hh(i, 4) * W, 30 + hh(i, 5) * 120, 15 + hh(i, 6) * 60, hh(i, 7) * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 2600; i++) { const r = 1.5 + hh(i, 8) ** 3 * 9, v = hh(i, 9); x.fillStyle = bump ? `rgb(${170 + v * 80},${170 + v * 80},${170 + v * 80})` : `rgb(${110 + v * 70 | 0},${92 + v * 56 | 0},${74 + v * 44 | 0})`; x.beginPath(); x.ellipse(hh(i, 10) * W, hh(i, 11) * W, r, r * .8, 0, 0, 7); x.fill(); }
    for (let i = 0; i < 30000; i++) { x.fillStyle = `rgba(0,0,0,${hh(i, 12) * .3})`; x.fillRect(hh(i, 13) * W, hh(i, 14) * W, 2, 2); } }, { tile: [2.2, 2.2], bump: 3 });
}

// ---------------------------------------------------------------------------------------------------------------------
// METAL AND SIGNS
// ---------------------------------------------------------------------------------------------------------------------
// riveted rusty sheet steel (mine cart tub): rust blotches, two rivet rows. 1 m tile
export function rivetedSteel() {
  return texSet('rivets', 1024, 1024, (x, W, H, bump) => { x.fillStyle = bump ? '#808080' : '#7a7a7c'; x.fillRect(0, 0, W, W);
    for (let i = 0; i < 70; i++) { x.fillStyle = bump ? 'rgba(0,0,0,.1)' : `rgba(${hh(i, 1) < .5 ? '110,70,40' : '30,30,32'},${.12 + hh(i, 2) * .2})`; x.beginPath(); x.ellipse(hh(i, 3) * W, hh(i, 4) * W, 20 + hh(i, 5) * 90, 10 + hh(i, 6) * 60, 0, 0, 7); x.fill(); }
    for (const y of [40, W - 40]) for (let k = 0; k < 16; k++) { x.fillStyle = bump ? '#ffffff' : '#7a746c'; x.beginPath(); x.arc(30 + k * (W - 60) / 15, y, 9, 0, 7); x.fill(); }
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(0,0,0,${hh(i, 7) * .3})`; x.fillRect(hh(i, 8) * W, hh(i, 9) * W, 2, 2); } }, { tile: [1, 1], bump: 2 });
}
// a chalkboard menu (sRGB texture, use as map + emissiveMap at ~.14 so it reads in a dark room)
export function chalkMenu() {
  return canvasTex(1024, 400, (x, W, H) => { x.fillStyle = '#121513'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(220,225,215,${.006 + hh(i, 1) * .012})`; x.beginPath(); x.ellipse(hh(i, 2) * W, hh(i, 3) * H, 40 + hh(i, 4) * 160, 10 + hh(i, 5) * 40, 0, 0, 7); x.fill(); }
    x.fillStyle = 'rgba(225,228,220,.06)'; x.font = '600 40px serif'; x.fillText('MENU', 70, 70); x.font = '24px serif';
    for (let i = 0; i < 12; i++) { const c = i > 5 ? 520 : 70, y = 120 + (i % 6) * 44; x.fillRect(c, y - 8, 140 + hh(i, 6) * 120, 2); x.fillRect(c + 330, y - 8, 40, 2); }
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(255,255,255,${hh(i, 7) * .025})`; x.fillRect(hh(i, 8) * W, hh(i, 9) * H, 2, 2); } });
}
// a soft radial blob decal (a dirt patch on ground): rgba stops from the centre out
export function blobDecal(stops = [[0, 'rgba(150,96,58,.9)'], [.6, 'rgba(130,86,54,.5)'], [1, 'rgba(120,80,50,0)']]) {
  return canvasTex(256, 256, (x, W, H) => { const g = x.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W / 2); for (const [a, c] of stops) g.addColorStop(a, c); x.fillStyle = g; x.fillRect(0, 0, W, H); });
}
// a 1D alpha ramp (feathered decal edges): stops [[pos, '#rrggbb'], ...] across v
export function alphaRamp(stops) {
  return canvasTex(4, 256, (x, W, H) => { const g = x.createLinearGradient(0, 0, 0, H); for (const [a, c] of stops) g.addColorStop(a, c); x.fillStyle = g; x.fillRect(0, 0, W, H); }, false);
}
