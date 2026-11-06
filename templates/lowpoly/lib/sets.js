// Sets and light. Every set is built from library models + procedural pieces, lit for the look (bright: flat-ish day
// light; moody: dark ambient, a warm key with soft shadows, emissive practicals that bloom), and says where people can
// stand (spots) so nobody is placed inside furniture.
//   S.set('casino' | 'office' | 'bedroom' | 'living' | 'kitchen' | 'diner' | 'lab' | 'hospital' | 'classroom' | 'courtroom' |
//         'street' | 'suburb' | 'park' | 'stadium' | 'desert' | 'farm' | 'void' | 'void-teal' | 'void-grid' | 'void-black' |
//         'void-purple' | 'void-red' | 'space' | 'studio', options)
import { THREE, MOODY, LOOK, SETTINGS, C, rnd, canvasTex, clamp, lerp, pixelText } from './core.js';
import { model, texture, find } from './assets.js';
import { slot, chips, sign } from './kit.js';             // (a cycle with kit.js: both only call each other at build time)

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .85, metalness: 0, ...o });
export const mat = M;
export const glow = (c, i = 1.6) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 1 });
export function box(w, h, d, m, x = 0, y = 0, z = 0, parent) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m.isMaterial ? m : M(m)); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent?.add(b); return b; }
export function cyl(rt, rb, h, m, x = 0, y = 0, z = 0, parent, seg = 12) { const b = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m.isMaterial ? m : M(m)); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent?.add(b); return b; }
/** a library model placed: put(S|group, 'prop.kf.desk', x, z, ry, { y, size, height, tint }) */
export function put(parent, ref, x = 0, z = 0, ry = 0, o = {}) { const m = model(ref, o); m.position.set(x, o.y ?? 0, z); m.rotation.y = ry; (parent.scene || parent).add(m); return m; }

// ---------- light ----------
/** S.light(kind, o): 'bright' | 'day' | 'moody' | 'night' | 'warm' | 'void' | 'neon'. Returns { key, fill } */
export function light(S, kind = MOODY ? 'moody' : 'bright', o = {}) {
  const sc = S.scene, out = {};
  for (const l of S._lights || []) sc.remove(l); S._lights = [];
  const add = l => { sc.add(l); if (l.target) sc.add(l.target); S._lights.push(l); return l; };
  const shadows = o.shadows ?? (SETTINGS.light?.shadows ?? MOODY);
  const amb = SETTINGS.light?.ambient ?? 1;
  const keyAt = o.key || [4, 9, 6], tgt = o.target || [0, .8, 0];
  if (kind === 'bright' || kind === 'day') {
    add(new THREE.HemisphereLight(o.sky ?? 0xdcebf9, o.ground ?? 0x8c8a62, (o.ambient ?? 2.1) * amb));
    const d = add(new THREE.DirectionalLight(o.color ?? 0xfff3e0, o.intensity ?? 1.6)); d.position.set(...keyAt); d.target.position.set(...tgt); out.key = d;
    if (shadows) shadowed(d, o.area ?? 9, o.soft ?? 3);
  } else if (kind === 'moody' || kind === 'warm') {
    add(new THREE.HemisphereLight(o.sky ?? 0x2a3f66, o.ground ?? 0x0a0a12, (o.ambient ?? .55) * amb));
    const s = add(new THREE.SpotLight(o.color ?? 0xffc98a, o.intensity ?? 45, o.range ?? 20, (o.angle ?? 42) * Math.PI / 180, o.penumbra ?? .65, 1.6));
    s.position.set(...(o.key || [0, 4.2, 1.2])); s.target.position.set(...tgt); out.key = s; S._key = s; S._keyFollow = o.follow ?? true;
    if (shadows) shadowed(s, 0, o.soft ?? 4);
    const f = add(new THREE.DirectionalLight(o.fill ?? 0x4a6fb0, o.fillI ?? .45)); f.position.set(-5, 4, -3); out.fill = f;
  } else if (kind === 'night') {
    add(new THREE.HemisphereLight(0x1a2a50, 0x050508, (o.ambient ?? .7) * amb));
    const d = add(new THREE.DirectionalLight(0x8fa8ff, o.intensity ?? .55)); d.position.set(-6, 10, 4); out.key = d; if (shadows) shadowed(d, o.area ?? 10, 3);
  } else if (kind === 'void') {
    add(new THREE.HemisphereLight(0xffffff, 0x445566, (o.ambient ?? 1.4) * amb));
    const d = add(new THREE.DirectionalLight(0xffffff, o.intensity ?? 1.8)); d.position.set(...keyAt); out.key = d;
  } else if (kind === 'neon') {
    add(new THREE.HemisphereLight(0x301050, 0x050208, (o.ambient ?? .6) * amb));
    for (const [c, p] of [[0xff2fb0, [-3, 2.5, 2]], [0x2fe0ff, [3, 2.5, 2]]]) { const pl = add(new THREE.PointLight(c, 18, 12, 1.6)); pl.position.set(...p); }
  }
  return out;
}
function shadowed(l, area, soft) {
  l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.radius = soft; l.shadow.blurSamples = 10; l.shadow.bias = -.0006; l.shadow.normalBias = .03;
  if (area && l.shadow.camera.isOrthographicCamera) Object.assign(l.shadow.camera, { left: -area, right: area, top: area, bottom: -area, near: .5, far: 60 });
  else if (l.shadow.camera.isPerspectiveCamera) { l.shadow.camera.near = .3; l.shadow.camera.far = 30; }
}
/** a point light that is seen (a bulb, a lamp, a neon): emissive mesh + light. lamp(S, [x,y,z], { color, intensity, range, size }) */
export function lamp(S, p, o = {}) {
  const c = o.color ?? 0xffd59a, g = new THREE.Group(); g.position.set(...p);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(o.size ?? .09, 8, 6), glow(c, o.glow ?? 3)); g.add(bulb); bulb.userData.noCheck = true;
  if (o.light !== false) { const l = new THREE.PointLight(c, o.intensity ?? (MOODY ? 9 : 4), o.range ?? 7, 1.8); g.add(l); if (o.shadow) shadowed(l, 0, 3); }
  (S.scene || S).add(g); g.userData.kind = 'lamp'; return g;
}
// ---------- sky / background / fog ----------
export function sky(S, kind = 'day') {
  const sc = S.scene;
  if (/^#|^0x/.test(String(kind)) || typeof kind === 'number') { sc.background = new THREE.Color(kind); return; }
  if (kind === 'black') { sc.background = new THREE.Color(0x000000); return; }
  const id = { day: 'tex.sky_day', sunset: 'tex.sky_sunset', overcast: 'tex.sky_overcast', night: 'tex.sky_night' }[kind];
  try { const t = texture(id); t.mapping = THREE.EquirectangularReflectionMapping; sc.background = t; sc.backgroundIntensity = MOODY ? .8 : 1; }
  catch { sc.background = new THREE.Color(kind === 'night' ? 0x050814 : 0x9cc4ea); }
}
export function fog(S, kind) {
  const k = SETTINGS.fog ?? 1;
  if (!kind || kind === 'none') { S.scene.fog = null; return; }
  if (kind === 'dark') { S.scene.fog = new THREE.FogExp2(0x06080f, .05 * k); S.scene.background = new THREE.Color(0x06080f); }
  else if (kind === 'haze') S.scene.fog = new THREE.Fog(S.scene.background?.isColor ? S.scene.background : new THREE.Color(0xc9dcef), 30, 160 / Math.max(.3, k));
  else if (typeof kind === 'object') S.scene.fog = kind.density ? new THREE.FogExp2(kind.color ?? 0, kind.density) : new THREE.Fog(kind.color ?? 0xc9dcef, kind.near ?? 20, kind.far ?? 120);
}
// ---------- floors, walls, rooms ----------
function texOr(ref, rep, fallback) { try { return texture(ref, { repeat: rep }); } catch { return null; } }
export function floor(S, o = {}) {
  const w = o.w ?? 40, d = o.d ?? 40, m = M(o.color ?? 0xffffff, { roughness: .95 });
  if (o.tex) { const t = texOr(o.tex, [w / (o.tile ?? 2), d / (o.tile ?? 2)]); if (t) m.map = t; else m.color.set(o.color ?? 0x777777); }
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); f.rotation.x = -Math.PI / 2; f.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0); f.receiveShadow = true; f.userData.ground = true; f.name = 'floor';
  (S.scene || S).add(f); return f;
}
/** room({ w, d, h, floor, floorColor, wall, wallTex, trim, ceiling, windows, door, lamps, open }) - an open-front box room centred at x 0, back wall at z = -d/2 */
export function room(S, o = {}) {
  const w = o.w ?? 8, d = o.d ?? 7, h = o.h ?? 3, g = new THREE.Group(); g.name = 'room'; g.userData.kind = 'room';
  floor(S, { w: w + .02, d, tex: o.floor === undefined ? 'tex.wood_floor' : o.floor, color: o.floorColor ?? (o.floor ? 0xffffff : 0x777777), tile: o.tile ?? 1.6 });
  const wm = M(o.wall ?? (MOODY ? 0x2b3346 : 0xe7e2d6));
  if (o.wallTex) { const t = texOr(o.wallTex, [w / 2, h / 2]); if (t) { wm.map = t; } }
  const shell = mesh => { mesh.userData.shell = true; mesh.receiveShadow = true; mesh.castShadow = false; g.add(mesh); return mesh; };
  shell(box(w, h, .12, wm, 0, h / 2, -d / 2 - .06));
  if (o.sides !== false) { shell(box(.12, h, d, wm, -w / 2 - .06, h / 2, 0)); shell(box(.12, h, d, wm, w / 2 + .06, h / 2, 0)); }
  if (o.back !== false) shell(box(w, h, .12, wm, 0, h / 2, d / 2 + .06));   // closed on all sides: a camera can look any way
  if (o.trim !== false) { const tm = M(o.trim ?? (MOODY ? 0x6b5434 : 0xffffff)); shell(box(w, .1, .03, tm, 0, .05, -d / 2 + .02)); if (o.stripe) shell(box(w, .25, .025, M(o.stripe), 0, 1.05, -d / 2 + .015)); }
  // (bright: the ceiling glows a little - lit only by the hemisphere's ground colour it came out olive brown)
  if (o.ceiling !== false) { const cc = o.ceilingColor ?? (MOODY ? 0x161a24 : 0xf2f2ee), c = shell(box(w, .1, d, M(cc, MOODY ? {} : { emissive: cc, emissiveIntensity: .55 }), 0, h + .05, 0)); c.castShadow = false; }
  for (let i = 0; i < (o.windows ?? 0); i++) { const x = -w / 2 + w * (i + 1) / ((o.windows ?? 0) + 1);
    const win = box(1.3, 1.4, .04, glow(o.windowColor ?? (MOODY ? 0x26385a : 0xdcefff), MOODY ? .8 : 1.1), x, 1.6, -d / 2 + .02, g); win.userData.shell = true;
    box(1.4, .07, .06, M(0xf4f4f4), x, .88, -d / 2 + .05, g).userData.shell = true; box(.05, 1.4, .05, M(0xf4f4f4), x, 1.6, -d / 2 + .05, g).userData.shell = true; }
  for (let i = 0; i < (o.windows ?? 0); i++) { const x = -w / 2 + w * (i + 1) / ((o.windows ?? 0) + 1);
    const win = box(1.3, 1.4, .04, glow(o.windowColor ?? (MOODY ? 0x26385a : 0xdcefff), MOODY ? .8 : 1.1), x, 1.6, d / 2 - .02, g); win.userData.shell = true; }
  if (o.door) { const dx = typeof o.door === 'number' ? o.door : w / 2 - 1.2; box(.95, 2.1, .05, M(0x6b4a2e), dx, 1.05, -d / 2 + .03, g).userData.shell = true; box(.06, .06, .08, M(0xd8c070), dx + .35, 1.05, -d / 2 + .08, g); }
  for (const p of o.lamps || []) lamp(S, p, { color: o.lampColor });
  S.scene.add(g); S.bounds = { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2, h };
  return g;
}
// ---------- voids ----------
function wavyTex(c1, c2, seed = 1) {
  return canvasTex(128, 128, (x, w, h) => { const r = rnd(seed); x.fillStyle = c1; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) { const y = r() * h, th = 3 + r() * 9, a = r() * .55 + .15; x.fillStyle = c2; x.globalAlpha = a; x.beginPath(); x.moveTo(0, y);
      for (let xx = 0; xx <= w; xx += 8) x.lineTo(xx, y + Math.sin(xx / w * Math.PI * 2 * (1 + (i % 3)) + i) * 6); for (let xx = w; xx >= 0; xx -= 8) x.lineTo(xx, y + th + Math.sin(xx / w * Math.PI * 2 * (1 + (i % 3)) + i) * 6); x.fill(); }
    x.globalAlpha = 1; }, { nearest: false });
}
export function voidSet(S, kind = 'teal', o = {}) {
  const sc = S.scene;
  if (kind === 'teal' || kind === 'void') { sc.background = new THREE.Color(o.color ?? C.teal); if (o.floor !== false) { const f = floor(S, { color: o.floorColor ?? C.teal, w: 80, d: 80 }); f.material = new THREE.ShadowMaterial({ opacity: .18 }); f.receiveShadow = true; } light(S, 'void'); return; }
  if (kind === 'grid' || kind === 'black') {
    const bg = kind === 'grid' ? (o.color ?? 0x2d5c66) : 0x020203; sc.background = new THREE.Color(bg);
    const lines = kind === 'grid' ? (o.lines ?? 0x7ff7ff) : 0xffffff;
    const grid = new THREE.GridHelper(80, 80, lines, lines); grid.material.transparent = true; grid.material.opacity = kind === 'grid' ? .55 : .35; grid.position.y = .002; grid.userData.ground = true; grid.userData.noPick = true; sc.add(grid);
    const f = floor(S, { color: bg, w: 80, d: 80 }); f.material = M(bg, { roughness: 1 });
    if (kind === 'grid') { grid.material.color = new THREE.Color(lines); grid.material.toneMapped = false; }
    sc.fog = new THREE.Fog(bg, 10, 34); light(S, 'void', { ambient: kind === 'black' ? .9 : 1.3 }); return;
  }
  if (kind === 'purple' || kind === 'red') {
    const [a, b] = kind === 'purple' ? ['#34004d', '#6c0198'] : ['#220000', '#720201'];
    const t = wavyTex(a, b, kind === 'purple' ? 3 : 7); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
    const sph = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false })); sph.userData.ground = true; sph.userData.noPick = true; sph.userData.shell = true; sc.add(sph);
    S.tick(t2 => { t.offset.x = t2 * .02; t.offset.y = Math.sin(t2 * .3) * .03; });
    light(S, 'void', { ambient: 1.1 }); return;
  }
  if (kind === 'space') {
    sc.background = new THREE.Color(0x01020a);
    const n = 900, r = rnd(11), pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), R = 70; pos.set([R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph), R * Math.sin(ph) * Math.sin(th)], i * 3); }
    const st = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
    st.userData.noPick = true; st.userData.ground = true; sc.add(st); light(S, 'void', { ambient: .4, intensity: 2.2, key: [6, 3, 4] });
  }
}
// ---------- the named sets ----------
export function buildSet(S, name, o = {}) {
  const spots = {}, sc = S.scene, r = rnd(o.seed ?? 5);
  const out = { name, spots, props: {} };
  const sp = (k, x, z, ry = 0) => { spots[k] = [x, z, ry]; };
  switch (name) {
    case 'casino': {
      // (moody: the carpet is tinted dark red - the beige texture under a warm key bloomed to white)
      room(S, { w: 14, d: 10, h: 3.6, floor: 'tex.carpet_a', floorColor: MOODY ? 0x8a3040 : undefined, wall: MOODY ? 0x0f1a30 : 0x3b2a4a, trim: 0xb8903c, stripe: 0x6b1020, ceiling: true, ceilingColor: 0x0a0c14 });
      sc.background = new THREE.Color(0x020205);
      if (MOODY) {                       // Loaded Dice slot rows: dark cabinets with neon edges, reels and toppers (kit slot, upright)
        const neon = [0xff2f7a, 0x2fd0ff, 0xffc020], title = ['JACKPOT', 'LUCKY 7', 'DIAMOND', 'BONUS'];
        for (let i = 0; i < 11; i++) { const m = slot({ upright: true, neon: neon[i % 3], title: title[i % 4], result: [i % 6, (i * 2 + 1) % 6, (i + 3) % 6], color: i % 2 ? 0x1c2440 : 0x2a1c3a });
          m.position.set(-5 + i, 0, -4.62); sc.add(m); out.props['slot' + i] = m; }
        for (let i = 0; i < 10; i++) { const m = slot({ upright: true, neon: neon[(i + 1) % 3], title: title[(i + 2) % 4], result: [(i + 2) % 6, i % 6, (i * 5) % 6] }); m.position.set(-4.5 + i, 0, 4.62); m.rotation.y = Math.PI; sc.add(m); }
        for (const z of [-3.3, 3.3]) for (const x of [-3.5, 0, 3.5]) { const l = new THREE.PointLight(0xffb070, 5, 5.5, 1.6); l.position.set(x, 2.7, z); sc.add(l); }   // warm light on the rows (else only the key lit anything)
        // depth for wides: the floor between the rows had nothing on it (a reference casino is full: tables under pendants,
        // a glowing sign over the machines, pillars). Felt tables with chip stacks under their own lamps, a neon sign, pillars.
        out.props.table1 = gamingTable(S, [-3.1, .3], { felt: 0x0d5a2c }); out.props.table2 = gamingTable(S, [3.2, .5], { felt: 0x5a0d1c, ry: .4 });
        const neonSign = sign('CASINO', { w: 3.2, h: .7, bg: '#12040a', color: '#ff3a7a', size: .62, frame: 0x2a0a14 }); neonSign.position.set(0, 3.02, -4.93); neonSign.userData.wall = true; neonSign.userData.noCheck = true; sc.add(neonSign);
        for (const x of [-6.35, 6.35]) for (const z of [-2.2, 2.2]) { const pl = box(.42, 3.6, .42, M(0x1a1420), x, 1.8, z, sc); pl.userData.wall = true; box(.46, .08, .46, M(0xb8903c, { metalness: .4, roughness: .4 }), x, 2.9, z, sc); box(.46, .08, .46, M(0xb8903c, { metalness: .4, roughness: .4 }), x, .25, z, sc); }
      } else {
        for (let i = 0; i < 6; i++) { const x = -5.5 + i * 2.2; const m = put(S, 'prop.arcade.gambling_machine', x, -4.1, 0); out.props['slot' + i] = m;
          box(.06, 1.7, .06, glow(i % 2 ? 0xff3060 : 0x30d0ff, 2.4), x - .66, .95, -3.6, sc).userData.noCheck = true; }
        for (let i = 0; i < 5; i++) put(S, 'prop.arcade.gambling_machine', -4.4 + i * 2.2, 4.1, Math.PI);
      }
      for (const x of [-4, 0, 4]) { const ch = chandelier(S, [x, 3.1, -1]); ch.userData.noCheck = true; }
      put(S, 'prop.kf.potted_plant', -6.3, -3.2, 0); put(S, 'prop.kf.potted_plant', 6.3, -3.2, 0);
      light(S, MOODY ? 'moody' : 'bright', MOODY ? { intensity: 40, angle: 46, ambient: .6 } : { ambient: 1.5 });
      fog(S, MOODY ? 'dark' : null); sp('table', 0, 1.2, Math.PI); sp('player', 0, 2.4, Math.PI); sp('slots', MOODY ? .3 : -1.1, MOODY ? -3.82 : -2.6, Math.PI); sp('door', 5, 3, -Math.PI / 2); break;
    }
    case 'office': {
      room(S, { w: 8, d: 6.5, h: 3, floor: 'tex.carpet_b', floorColor: 0x9aa0a8, wall: MOODY ? 0x2a2017 : 0xd9d2c3, windows: 2, door: -2.6, ceiling: MOODY });
      const desk = put(S, 'prop.kf.desk', 0, -1.6, 0, MOODY ? { tint: 0x3a2416, tintMix: .6 } : {}); out.props.desk = desk;   // (moody: dark wood - the light desk top bloomed white)
      put(S, 'prop.kf.chair_desk', 0, -.75, Math.PI);
      out.props.screen = put(S, 'prop.kf.computer_screen', .1, -1.85, 0, { y: .78 }); put(S, 'prop.kf.computer_keyboard', .1, -1.45, 0, { y: .78 });
      put(S, 'prop.kf.bookcase_closed', -3.3, -2.9, 0); put(S, 'prop.kf.potted_plant', 3.3, -2.8, 0); put(S, 'prop.kf.potted_plant', -3.3, 2.8, 0); put(S, 'prop.kf.lamp_round_floor', -2.2, -2.8, 0);
      light(S, MOODY ? 'moody' : 'bright', MOODY ? { intensity: 40, color: 0xffc078 } : {});
      if (MOODY) lamp(S, [-2.2, 1.62, -2.8], { color: 0xffc070, intensity: 2, glow: 1.5 });
      sp('desk', 0, -.75, Math.PI); sp('front', 0, 1.2, 0); sp('side', 2, -.4, -Math.PI / 2); break;
    }
    case 'bedroom': {
      room(S, { w: 7, d: 6, h: 2.8, floor: 'tex.wood_floor', wall: MOODY ? 0x2a2a3a : 0xcfd9c4, stripe: MOODY ? null : 0x5b890e, windows: 1 });
      out.props.bed = put(S, 'prop.kf.bed_double', -.8, -1.6, 0); put(S, 'prop.kf.cabinet_bed_drawer', .65, -2.55, 0); put(S, 'prop.kf.lamp_round_table', .65, -2.55, 0, { y: .5 });
      put(S, 'prop.kf.rug_rectangle', -.8, .3, 0, { y: .005 }).userData.ground = true; put(S, 'prop.kf.bookcase_open', 2.8, -2.6, 0);
      light(S, MOODY ? 'moody' : 'bright', MOODY ? { key: [.6, 2.4, -1.5], intensity: 40, color: 0xffb070 } : {}); sp('bed', -.8, -1.6, 0); sp('front', 0, 1, 0); break;
    }
    case 'living': {
      room(S, { w: 8, d: 6.5, h: 2.8, floor: 'tex.wood_floor', wall: MOODY ? 0x2c2622 : 0xe4dccb, windows: 2 });
      out.props.sofa = put(S, 'prop.kf.lounge_sofa', 0, -2.4, 0); put(S, 'prop.kf.rug_rectangle', 0, -.6, 0, { y: .005 }).userData.ground = true;   // (a rug is floor: feet may touch it) out.props.tv = put(S, 'prop.kf.cabinet_television', 0, 1.6, Math.PI);
      put(S, 'prop.kf.lamp_round_floor', -1.6, -2.7, 0); put(S, 'prop.kf.potted_plant', 2.8, -2.7, 0); put(S, 'prop.kf.bookcase_closed_wide', -3, -2.9, 0);
      light(S, MOODY ? 'moody' : 'bright'); sp('sofa', 0, -2.25, 0); sp('front', 0, 0, 0); break;
    }
    case 'kitchen': {
      room(S, { w: 7, d: 5.5, h: 2.8, floor: 'tex.tiles', wall: 0xe8e4da, windows: 1 });
      for (let i = 0; i < 4; i++) put(S, i === 1 ? 'prop.kf.kitchen_stove' : i === 2 ? 'prop.kf.kitchen_sink' : 'prop.kf.kitchen_cabinet', -1.35 + i * .9, -2.3, 0);
      put(S, 'prop.kf.kitchen_fridge', 2.4, -2.4, 0); for (let i = 0; i < 3; i++) put(S, 'prop.kf.kitchen_cabinet_upper', -1.35 + i * .9, -2.55, 0, { y: 1.5 });
      light(S, MOODY ? 'moody' : 'bright'); sp('counter', 0, -1.3, Math.PI); sp('front', 0, .6, 0); break;
    }
    case 'diner': {
      room(S, { w: 10, d: 7, h: 3, floor: 'tex.tiles', floorColor: 0xffffff, wall: MOODY ? 0x3a1414 : 0xf1e3c8, stripe: 0xc2201c, windows: 3 });
      for (const x of [-3, 0, 3]) { put(S, 'prop.kkr.table_round_a_small', x, -1, 0); put(S, 'prop.kkr.chair_b', x - .75, -1, Math.PI / 2); put(S, 'prop.kkr.chair_b', x + .75, -1, -Math.PI / 2); put(S, 'prop.kkr.ketchup', x - .1, -1, 0, { y: .74 }); put(S, 'prop.kkr.mustard', x + .1, -1.05, 0, { y: .74 }); }
      for (let i = 0; i < 5; i++) put(S, 'prop.kf.kitchen_bar', -3.6 + i * .9, -3, 0); for (let i = 0; i < 4; i++) put(S, 'prop.kkr.chair_stool', -3.2 + i * 1.1, -2.2, 0);
      light(S, MOODY ? 'moody' : 'bright'); sp('booth', 0, -.25, Math.PI); sp('counter', 0, -2.2, 0); break;
    }
    case 'lab': {
      room(S, { w: 10, d: 7, h: 3.2, floor: 'tex.tiles', floorColor: 0xcfe3ea, wall: MOODY ? 0x14222e : 0xe8f0f2, stripe: 0x197b95, ceiling: true, ceilingColor: 0xdfe8ea });
      out.props.table = put(S, 'prop.station.table', 0, -1.4, 0); put(S, 'prop.station.computer_screen', -3, -2.9, 0); put(S, 'prop.station.computer_system', 3, -2.8, 0);
      for (const x of [-4, -3]) { const tank = cryoTank(S, [x, 0, -.8]); tank.userData.kind = 'tank'; }
      light(S, MOODY ? 'moody' : 'bright', MOODY ? { color: 0xb8e8ff, intensity: 80 } : {}); sp('table', 0, -.5, Math.PI); sp('front', 0, 1, 0); break;
    }
    case 'hospital': {
      room(S, { w: 10, d: 7, h: 3, floor: 'tex.tiles', floorColor: 0xd6e6ee, wall: 0xdde6e8, stripe: 0x216da2, ceiling: true, ceilingColor: 0xe9eef0 });
      for (const x of [-2.4, 1.2]) { out.props['bed' + x] = put(S, 'prop.pp.bed_single_ianc', x, -1.9, 0); ivStand(S, [x + 1, 0, -2.3]); }
      for (const x of [-3, 0, 3]) lamp(S, [x, 2.95, -.5], { color: 0xf4fbff, size: .05, glow: 4, intensity: MOODY ? 6 : 2, range: 6 });
      light(S, MOODY ? 'moody' : 'bright', MOODY ? { color: 0xd8f0ff } : { ambient: 2.4 }); sp('bed', -2.4, -1.9, 0); sp('aisle', 0, .2, 0); break;
    }
    case 'classroom': {
      room(S, { w: 10, d: 8, h: 3, floor: 'tex.wood_floor', wall: 0xe9e3cf, windows: 3 });
      chalkboard(S, [0, 1.55, -3.95], o.board || '');
      for (let row = 0; row < 3; row++) for (let c = 0; c < 3; c++) { const x = -2.6 + c * 2.6, z = -.9 + row * 1.6; put(S, 'prop.kf.desk', x, z, Math.PI, { width: 1.1 }); put(S, 'prop.kf.chair', x, z + .55, Math.PI); }
      light(S, MOODY ? 'moody' : 'bright'); sp('teacher', 0, -3, 0); sp('student', 0, 2.75, Math.PI); break;
    }
    case 'courtroom': {
      room(S, { w: 12, d: 9, h: 4, floor: 'tex.wood_floor', wall: 0x6a3316, wallTex: 'tex.wood', trim: 0x2a1408, windows: 0 });
      const bench = box(4.2, 1.25, 1.2, M(0x5a2a10), 0, .62, -3.6, sc); bench.name = 'judge bench'; bench.userData.kind = 'bench'; box(4.4, .08, 1.3, M(0x3a1808), 0, 1.28, -3.6, sc);
      box(1.4, 1, .9, M(0x5a2a10), 3.2, .5, -2.2, sc).name = 'witness stand';
      for (let i = 0; i < 3; i++) box(3.6, .5, .5, M(0x4a220c), -2, .25, 1 + i * 1.2, sc), box(3.6, .5, .5, M(0x4a220c), 2.6, .25, 1 + i * 1.2, sc);
      out.props.gavel = put(S, 'prop.pp.gavel_6yki', .5, -3.4, 0, { y: 1.32 });
      light(S, MOODY ? 'moody' : 'bright', MOODY ? { key: [0, 3.6, -1.6], target: [0, 1, -3.6], intensity: 80 } : {}); sp('judge', 0, -4.2, 0); sp('witness', 3.2, -2.6, 0); sp('lawyer', -1.2, -1.4, Math.PI); break;
    }
    case 'street': case 'suburb': {
      const sub = name === 'suburb';
      sky(S, o.sky || (MOODY ? 'sunset' : 'day')); floor(S, { w: 140, d: 140, tex: sub ? 'tex.grass' : 'tex.paving', tile: 3 });
      const road = floor(S, { w: 8, d: 140, tex: 'tex.asphalt', tile: 4, y: .01 }); road.name = 'road';
      const ids = sub ? ['set.suburban.building_type_a', 'set.suburban.building_type_c', 'set.suburban.building_type_e'] : ['set.commercial.building_a', 'set.commercial.building_d', 'set.commercial.building_h', 'set.commercial.building_skyscraper_a', 'set.commercial.building_skyscraper_c'];
      for (const side of [-1, 1]) for (let i = 0; i < 7; i++) { const z = -48 + i * 12 + (side > 0 ? 5 : 0); const b = put(S, ids[(i * 3 + (side > 0 ? 1 : 0)) % ids.length], side * (sub ? 13 : 11.5), z, side > 0 ? -Math.PI / 2 : Math.PI / 2); b.userData.kind = 'building'; }
      for (let i = 0; i < 6; i++) { put(S, sub ? 'set.suburban.tree_large' : 'prop.kkcity.streetlight', (i % 2 ? 1 : -1) * 5.2, -30 + i * 9, (i % 2 ? -1 : 1) * Math.PI / 2); }
      if (!sub) { put(S, 'prop.kkcity.firehydrant', -5, 3, 0); put(S, 'prop.kkcity.bench', 6.2, -2, -Math.PI / 2); out.props.car = put(S, 'prop.kkcity.car_sedan', 2.4, -8, 0); put(S, 'prop.kkcity.car_taxi', -2.4, 12, Math.PI); }
      else for (let i = 0; i < 6; i++) put(S, 'set.suburban.fence', -8, -18 + i * 2.6, Math.PI / 2);
      light(S, MOODY ? 'day' : 'bright', { shadows: MOODY, area: 20, ambient: MOODY ? 1.2 : 2.1 }); fog(S, 'haze');
      sp('sidewalk', -6, 0, 0); sp('road', 0, 0, 0); sp('door', -8.5, -2, Math.PI / 2); break;
    }
    case 'park': case 'farm': case 'desert': {
      sky(S, o.sky || (name === 'desert' ? 'day' : MOODY ? 'sunset' : 'day'));
      floor(S, { w: 160, d: 160, tex: name === 'desert' ? 'tex.dirt' : 'tex.grass', tile: 3, color: name === 'desert' ? 0xe0c89a : 0xffffff });
      const pick = name === 'desert' ? ['prop.nature.cactus_tall', 'prop.nature.cactus_short', 'prop.nature.rock_large_a'] : name === 'farm' ? ['prop.nature.tree_default', 'prop.nature.crop_pumpkin'] : ['prop.nature.tree_oak', 'prop.nature.tree_default', 'prop.nature.tree_detailed', 'prop.nature.plant_bush'];
      for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, d = 7 + r() * 30; put(S, pick[i % pick.length], Math.cos(a) * d, Math.sin(a) * d - 6, r() * 6); }
      if (name === 'park') { floor(S, { w: 2.4, d: 60, tex: 'tex.paving', tile: 1.2, y: .01 }); put(S, 'prop.kkcity.bench', 2.2, -1.5, -Math.PI / 2); for (let i = 0; i < 12; i++) put(S, 'prop.nature.flower_yellow_a', -2 - r() * 3, -r() * 8, r() * 6); }
      if (name === 'farm') { for (let i = 0; i < 8; i++) put(S, 'prop.nature.fence_simple', -10 + i * 2.9, -6, 0); barn(S, [8, 0, -14]); }
      light(S, MOODY ? 'day' : 'bright', { shadows: MOODY, area: 20, ambient: MOODY ? 1.1 : 2.1, color: name === 'desert' ? 0xfff0d0 : undefined }); fog(S, 'haze');
      sp('path', 0, 0, Math.PI); sp('bench', 2.2, -1.5, -Math.PI / 2); break;
    }
    case 'stadium': {
      sky(S, 'night'); floor(S, { w: 120, d: 80, tex: 'tex.grass', tile: 2.2, color: 0x9ab070 });
      const lines = canvasTex(256, 160, (x, w, h) => { x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 2; x.strokeRect(8, 8, w - 16, h - 16); x.beginPath(); x.moveTo(w / 2, 8); x.lineTo(w / 2, h - 8); x.stroke(); x.beginPath(); x.arc(w / 2, h / 2, 22, 0, 7); x.stroke(); x.strokeRect(8, h / 2 - 40, 34, 80); x.strokeRect(w - 42, h / 2 - 40, 34, 80); }, { nearest: false });
      const pitch = new THREE.Mesh(new THREE.PlaneGeometry(68, 42), new THREE.MeshBasicMaterial({ map: lines, transparent: true })); pitch.rotation.x = -Math.PI / 2; pitch.position.y = .02; pitch.userData.ground = true; sc.add(pitch);
      for (const s of [-1, 1]) { stands(S, [0, 0, s * 27], s < 0 ? 0 : Math.PI, 70); }
      for (const [x, z] of [[-36, -24], [36, -24], [-36, 24], [36, 24]]) { cyl(.3, .4, 26, M(0x777777), x, 13, z, sc); const lp = box(4, 2, .6, glow(0xffffff, 3), x, 26, z, sc); lp.lookAt(0, 0, 0); lp.userData.noCheck = true; }
      light(S, 'night', { intensity: 1.4, ambient: 1.4 }); fog(S, { color: 0x05070c, near: 40, far: 140 }); sp('center', 0, 0, 0); sp('goal', -30, 0, Math.PI / 2); break;
    }
    case 'studio': { sc.background = new THREE.Color(o.color ?? (MOODY ? 0x101318 : 0xd8dde3)); const f = floor(S, { color: o.color ?? (MOODY ? 0x101318 : 0xd8dde3) }); f.material.roughness = 1; light(S, MOODY ? 'moody' : 'bright', MOODY ? { key: [2, 4, 3], intensity: 70 } : {}); if (MOODY) fog(S, 'dark'); sp('center', 0, 0, 0); break; }
    case 'space': voidSet(S, 'space'); sp('center', 0, 0, 0); break;
    default: {
      const v = name.replace(/^void-?/, '') || 'teal'; voidSet(S, v, o); sp('center', 0, 0, 0);
    }
  }
  return out;
}
// ---------- set pieces ----------
/** a casino felt table (roulette / blackjack look) with chip stacks and a pendant lamp over it: gamingTable(S, [x, z], { felt, ry }) */
export function gamingTable(S, [x, z], o = {}) {
  const g = new THREE.Group(); g.name = 'gaming table'; g.userData.pickRoot = true; g.position.set(x, 0, z); g.rotation.y = o.ry ?? 0;
  const wood = M(0x3a1e10, { roughness: .6 }), gold = M(0xb8903c, { metalness: .5, roughness: .35 });
  cyl(.12, .2, .74, wood, 0, .37, 0, g, 10);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .06, 28), wood); top.scale.set(1.15, 1, .72); top.position.y = .77; top.castShadow = top.receiveShadow = true; g.add(top);
  const felt = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .02, 28), M(o.felt ?? 0x0d5a2c, { roughness: 1 })); felt.scale.set(1.15, 1, .72); felt.position.y = .805; felt.receiveShadow = true; g.add(felt);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.95, .025, 4, 28), gold); rim.rotation.x = Math.PI / 2; rim.scale.set(1.15, .72, 1); rim.position.y = .8; g.add(rim);
  [['red', -.4, .05, 14], ['blue', -.25, .2, 9], ['black', .15, .1, 18], ['green', .45, -.05, 7], ['white', .3, .28, 11]].forEach(([c, cx, cz, n]) => { const ch = chips(n, c); ch.position.set(cx, .815, cz); ch.scale.setScalar(1.6); g.add(ch); });
  for (const s of [-1, 1]) { const card = box(.07, .004, .1, M(0xf4f4f0), s * .1, .817, -.25, g); card.rotation.y = s * .2; }
  S.scene.add(g); lamp(S, [x, 2.35, z], { color: 0xffc070, intensity: 3.2, glow: 1.2 });
  return g;
}
export function chandelier(S, p) {
  const g = new THREE.Group(); g.position.set(...p); g.name = 'chandelier'; g.userData.kind = 'lamp';
  cyl(.01, .01, .6, M(0x8a6a2a), 0, .3, 0, g);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.42, .03, 4, 14), M(0xb8903c, { metalness: .2 })); ring.rotation.x = Math.PI / 2; g.add(ring);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 4), glow(0xffd28a, 4)); b.position.set(Math.cos(a) * .42, .05, Math.sin(a) * .42); g.add(b); }
  for (let i = 0; i < 6; i++) { const cr = new THREE.Mesh(new THREE.OctahedronGeometry(.04), glow(0xfff0d0, 1.4)); cr.position.set(Math.cos(i) * .2, -.15 - (i % 3) * .06, Math.sin(i) * .2); g.add(cr); }
  const l = new THREE.PointLight(0xffc880, MOODY ? 14 : 4, 8, 1.6); l.position.y = -.1; g.add(l);
  S.scene.add(g); return g;
}
export function ivStand(S, p) { const g = new THREE.Group(); g.position.set(...p); g.name = 'IV stand'; const m = M(0x8a9096, { metalness: .3 });
  cyl(.015, .015, 1.9, m, 0, .95, 0, g); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const leg = box(.3, .02, .02, m, Math.cos(a) * .15, .05, Math.sin(a) * .15, g); leg.rotation.y = -a; }
  box(.12, .2, .04, M(0xd8ecff, { transparent: true, opacity: .8 }), .06, 1.75, 0, g); S.scene.add(g); return g; }
export function cryoTank(S, p) { const g = new THREE.Group(); g.position.set(...p); g.name = 'cryo tank';
  cyl(.42, .42, .18, M(0x3a4048), 0, .09, 0, g); cyl(.42, .42, .18, M(0x3a4048), 0, 2.1, 0, g);
  const glass = cyl(.38, .38, 1.84, new THREE.MeshStandardMaterial({ color: 0x8fe8ff, emissive: 0x2a9ab8, emissiveIntensity: .8, transparent: true, opacity: .45, roughness: .1 }), 0, 1.1, 0, g); glass.castShadow = false;
  S.scene.add(g); return g; }
export function barn(S, p) { const g = new THREE.Group(); g.position.set(...p); g.name = 'barn'; box(6, 4, 8, M(0xa82a20), 0, 2, 0, g);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 8.4, 3, 1, false), M(0x3a3a3a)); roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.position.y = 4.6; roof.scale.set(1, 1, .55); g.add(roof);
  box(2.2, 2.6, .05, M(0xf2f2f2), 0, 1.3, 4.01, g); S.scene.add(g); return g; }
export function stands(S, p, ry, len) {
  const g = new THREE.Group(); g.position.set(...p); g.rotation.y = ry; g.name = 'stands';
  const crowdTex = canvasTex(256, 32, (x, w, h) => { const r = rnd(4); for (let i = 0; i < 900; i++) { x.fillStyle = `hsl(${r() * 360},${40 + r() * 40}%,${25 + r() * 45}%)`; x.fillRect(r() * w, r() * h, 2, 3); } });
  crowdTex.wrapS = THREE.RepeatWrapping; crowdTex.repeat.set(len / 12, 1);
  for (let i = 0; i < 8; i++) { const st = box(len, .5, 1.1, M(0x55585e), 0, .25 + i * .5, -i * 1.1, g); const c = new THREE.Mesh(new THREE.PlaneGeometry(len, .7), new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 1 })); c.position.set(0, .75 + i * .5, -i * 1.1 + .1); g.add(c); }
  S.scene.add(g); return g;
}
export function chalkboard(S, p, text = '') {
  const t = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#1f3a2c'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.75)'; x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '700 16px Inter, Arial'; x.textAlign = 'center';
    String(text).split('\n').forEach((l, i) => x.fillText(l, w / 2, 34 + i * 22)); });
  const g = new THREE.Group(); g.position.set(...p); g.name = 'chalkboard';
  box(3.6, 1.6, .06, M(0x6b4a2e), 0, 0, 0, g); const b = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.4), new THREE.MeshStandardMaterial({ map: t, roughness: 1 })); b.position.z = .035; g.add(b);
  S.scene.add(g); g.userData.board = t; return g;
}
