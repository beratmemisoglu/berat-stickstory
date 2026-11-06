// MAPS (engine v16): a real-place map shot in one call that reads at a glance in every look (docs: the skill's
// references/engine_api.md "Maps and exteriors"). Before v16 crew builds drew km maps as a pale or foggy sheet, tinted by hand
// (docs/CREW_BUILD.md runs 1-4); regionMap() gives the look's map texture (map_dark.jpg in the Investigation look: dark land,
// light roads, runways and taxiways from region.py's aeroway layer), the relief lit by a low raking sun, the airport's
// terminals and hangars standing as prisms with aircraft at the gates, and fog only far past the frame.
//   import { regionMap, marker, strikeArc } from '../lib/maps.js';
//   const M = regionMap(S, { center: { lat: 24.9576, lon: 46.6988 }, radius: 3 });   // after await setup({ region })
//   marker(S, M, { lat: 24.9606, lon: 46.7005 }, { t0: cue('terminal') });           // a pin + pulsing ring on the ground
//   strikeArc(S, M, { bearing: 200, dist: 8 }, { lat: 24.9606, lon: 46.7005 }, { t0: cue('missile'), dur: 2.4 });
// Points: [x, y] km from the map centre (ll(lat, lon) gives them) or { lat, lon }. World units of a map shot: km
// (x = east, -z = north, y up, the lowest ground near the centre at y ~ 0). Data (c) OpenStreetMap contributors, ODbL.
import { THREE, THEME, THEME_ID, selectable } from '../engine.js';
import * as ENG from '../engine.js';
import { terrainMesh, heightAt, ll, AERO, mapMeta } from './world.js';
import { airliner } from '../models.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
// the look's map palette (engine v16 THEME.outdoor.map; older engines: these defaults)
const MAPLOOK = {
  studio: { tex: 'light', bg: 0xdadad6, sun: [0xfff4e6, 2.6, 24], hemi: [0xffffff, 0xb4b3ad, .9], roof: 0xeceae4, wall: 0x9aa4ad, accent: 0xd0342c },
  investigation: { tex: 'dark', bg: 0x07080a, sun: [0xffdcb4, 4.4, 22], hemi: [0x8496ac, 0x1a1c20, 1.2], roof: 0xaeb2b7, wall: 0x2c3138, accent: 0xd30007 },
};
export const mapLook = () => ({ ...MAPLOOK[THEME_ID === 'investigation' ? 'investigation' : 'studio'], ...(THEME?.outdoor?.map || {}) });
/** toKm(p): a map point as [x, y] km: [x, y] km, { lat, lon } or { x, y } */
export function toKm(p) {
  if (Array.isArray(p)) return [+p[0], +p[1]];
  if (p && p.lat != null) return ll(+p.lat, +p.lon);
  if (p && p.x != null) return [+p.x, +p.y];
  throw new Error('maps: a point is [x, y] km (ll(lat, lon)) or { lat, lon }');
}
const centroid = p => { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; };
function closestOnRing(p, ring) {     // the nearest point of a polygon outline to p, its distance and that edge's direction
  let best = null, bd = Infinity, edge = [1, 0];
  for (let i = 0; i < ring.length - 1; i++) { const [ax, ay] = ring[i], [bx, by] = ring[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-12;
    const k = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L2)), q = [ax + dx * k, ay + dy * k], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < bd) { bd = d; best = q; edge = [dx, dy]; } }
  return { q: best, d: bd, edge };
}
const inPoly = (p, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j];
  if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi || 1e-12) + xi) c = !c; } return c; };

/** regionMap(S, o): the map shot's world (km). o: { center (point, default the region's centre), radius (km the shot
 *  covers, default 3), vScale (relief exaggeration, 1.6; the relief is smoothed: o.smooth passes, 4), look ('dark' | 'light': default the look's), res (384), studio
 *  (true: the map's own room: background, light, fog past the frame; false: the scene's), sun: { az, el } (deg; az 0 = from
 *  the north, 90 = from the east; default 225 / the look's), buildings (true: terminals + hangars from aero.json standing),
 *  hScale (building height exaggeration, 2), aircraft (true: airliners at the gates, real size), dof (false) }.
 *  Returns { terrain, center, radius, at(p, up) -> Vector3 on the ground, km(p), buildings: { name: mesh }, aircraft, gates,
 *  sun, look }. Put markers with marker(), paths with strikeArc() or pathline(); name places with place() / placeTag(). */
export function regionMap(S, o = {}) {
  const meta = mapMeta(); if (!meta) throw new Error('regionMap: no region loaded (await setup({ region }) in the first scene file)');
  const L = mapLook(), c = toKm(o.center ?? [0, 0]), R = o.radius ?? 3, vs = o.vScale ?? 1.6, half = (meta.extent[1] - meta.extent[0]) / 2;
  // the lowest ground near the centre sits at y ~ 0
  let base = o.base; if (base == null) { base = Infinity; for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) base = Math.min(base, heightAt([c[0] + i * R / 4, c[1] + j * R / 4])); if (!isFinite(base)) base = 0; }
  const look = o.look ?? L.tex, terrR = Math.min(half * 1.5, o.extent ?? Math.max(R * 3.2, 4)), res = o.res ?? 384, n = res + 1;
  const terrain = terrainMesh({ unit: 'km', center: c, radius: terrR, res, vScale: vs, base, look });
  // smooth the relief (elevation data carries metres of radar noise: under a raking sun a flat airfield would ripple)
  const pos = terrain.geometry.attributes.position, ys = new Float32Array(pos.count); for (let i = 0; i < pos.count; i++) ys[i] = pos.getY(i);
  for (let pass = 0; pass < (o.smooth ?? 4); pass++) { const nx = ys.slice(); for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) { const k = j * n + i; nx[k] = (ys[k] * 4 + ys[k - 1] + ys[k + 1] + ys[k - n] + ys[k + n]) / 8; } ys.set(nx); }
  for (let i = 0; i < pos.count; i++) pos.setY(i, ys[i]); pos.needsUpdate = true; terrain.geometry.computeVertexNormals();
  // the ground height of the drawn (smoothed) surface at a map point, bilinear on its grid: what stands on the map stands on it
  const gw = terrain.geometry.parameters.width, gh = terrain.geometry.parameters.height, mp = terrain.position;
  const hy = k => { const wx = k[0] - c[0], wz = -(k[1] - c[1]), fx = Math.min(res - 1e-4, Math.max(0, (wx - mp.x + gw / 2) / gw * res)), fz = Math.min(res - 1e-4, Math.max(0, (wz - mp.z + gh / 2) / gh * res));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, Y = (a, b) => ys[b * n + a];
    return (Y(i, j) * (1 - u) + Y(i + 1, j) * u) * (1 - v) + (Y(i, j + 1) * (1 - u) + Y(i + 1, j + 1) * u) * v; };
  const km = p => toKm(p), at = (p, up = 0) => { const k = km(p); return V(k[0] - c[0], hy(k) + up, -(k[1] - c[1])); };
  terrain.material.roughness = 1; terrain.material.envMapIntensity = .15; terrain.name = 'map terrain'; S.scene.add(terrain);
  // the room: the look's background, a low raking sun (shadows of the relief and the buildings), sky light, fog past the frame
  let sun = null;
  if (o.studio !== false) {
    const az = (o.sun?.az ?? 225) * D2R, el = (o.sun?.el ?? L.sun[2]) * D2R, d = R * 6;
    const dir = V(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    S.studio({ floor: false, near: Math.max(.005, R * .004), far: Math.max(60, R * 40), fog: [R * 4, R * 9], key: dir.clone().multiplyScalar(d).toArray(), target: [0, 0, 0], area: Math.min(terrR, R * 1.6), shadowFar: d * 2.2, rim: false, hemi: 0 });
    sun = S.key; sun.color.setHex(L.sun[0]); sun.intensity = L.sun[1] * (o.sunI ?? 1); sun.shadow.bias = -.0002; sun.shadow.normalBias = .01;
    S.scene.add(new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]));
    S.scene.background = new THREE.Color(L.bg); S.scene.fog = new THREE.Fog(L.bg, R * 5, R * 13);
    S.post.ao = 0; if (!o.dof) S.post.dof = null;
    S.visibility ??= { dark: .03, darkFrac: .97, crushFrac: .95 };   // a dark map is the look; the place itself must read (it does: light lines)
  }
  // the airport standing: terminals and hangars from aero.json as prisms on the ground (roof light, walls dark glass)
  const buildings = {}, aircraft = [], gates = [], A = AERO;
  if (A && o.buildings !== false) {
    const hs = o.hScale ?? 2, roof = new THREE.MeshStandardMaterial({ color: L.roof, roughness: .7 }), wall = new THREE.MeshStandardMaterial({ color: L.wall, roughness: .35, metalness: .15 });
    for (const [kind, h] of [['terminal', 24], ['hangar', 18]]) for (const b of A[kind] || []) {
      if (!b.area || b.p.length < 4) continue; const cen = centroid(b.p); if (Math.hypot(cen[0] - c[0], cen[1] - c[1]) > terrR) continue;
      let y0 = Infinity; for (const q of b.p) y0 = Math.min(y0, hy(q)); y0 -= .003;    // sunk 3 m: no gap on a slope
      const sh = new THREE.Shape(b.p.slice(0, -1).map(q => new THREE.Vector2(q[0] - cen[0], q[1] - cen[1]))), H = h * .001 * hs + .003;
      const g = new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, [roof, wall]); m.position.set(cen[0] - c[0], y0, -(cen[1] - c[1])); m.castShadow = m.receiveShadow = true;
      const name = b.name || kind; m.name = name; selectable(m, name, 'building'); S.scene.add(m); buildings[buildings[name] ? `${name} ${Object.keys(buildings).length}` : name] = m;
    }
    // aircraft at the gates (real size), nose to the terminal; one per gate, never two within a wingspan
    if (o.aircraft !== false && A.gate?.length) {
      const terms = (A.terminal || []).filter(t => t.area), proto = airliner(null), placed = [];
      proto.scale.setScalar(.001 * (o.aircraftScale ?? 1)); proto.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; } });
      proto.updateMatrixWorld(true); const lift = -new THREE.Box3().setFromObject(proto, true).min.y - .0002;   // its belly on the ground (map scale: no gear needed)
      for (const gt of A.gate) {
        const g = gt.p; if (Math.hypot(g[0] - c[0], g[1] - c[1]) > Math.min(terrR, R * 2)) continue;
        let best = null; for (const t of terms) { const r = closestOnRing(g, t.p); if (!best || r.d < best.d) best = { ...r, t }; }
        if (!best || best.d > .25) continue;
        // outward from the nearest facade: OSM gate nodes sit outside, on or INSIDE the terminal outline (run 5 parked
        // airliners inside the terminals): the edge's normal, turned to the side that is outside the building
        const el = Math.hypot(best.edge[0], best.edge[1]) || 1; let nx = best.edge[1] / el, ny = -best.edge[0] / el;
        if (inPoly([best.q[0] + nx * .005, best.q[1] + ny * .005], best.t.p)) { nx = -nx; ny = -ny; }
        const pc = [best.q[0] + nx * .03, best.q[1] + ny * .03], tail = [best.q[0] + nx * .05, best.q[1] + ny * .05];   // its middle 30 m, its tail 50 m off the facade
        if (terms.some(t => inPoly(pc, t.p) || inPoly(tail, t.p))) continue;               // a stand that would sit in a building: none
        if (placed.some(q => Math.hypot(q[0] - pc[0], q[1] - pc[1]) < .042)) continue; placed.push(pc);
        const a = proto.clone(); a.name = `airliner at gate ${gt.ref ?? ''}`.trim(); a.position.copy(at(pc));
        a.rotation.y = Math.atan2(nx, -ny);   // the built-in airliner's nose is local -Z: it points along (-nx, +ny) in world x / z = toward the terminal
        a.position.y += lift; S.scene.add(a); selectable(a, a.name, 'vehicle'); aircraft.push(a); gates.push({ ref: gt.ref, p: g, v: at(g) });
      }
    }
  }
  const M = { terrain, center: c, radius: R, vScale: vs, base, at, km, hy, buildings, aircraft, gates, sun, look, accent: L.accent };
  return M;
}

/** marker(S, M, p, o): a place marked on the map: a dot resting on the ground and a ring that pulses outward (crimson in
 *  the Investigation look). o: { t0 (appears; default the shot's start), size (km, default radius / 45), color, pulse (true),
 *  period (1.6 s), title / sub (a place() tag on it) }. Returns the group. */
export function marker(S, M, p, o = {}) {
  const r = o.size ?? M.radius / 45, col = o.color ?? M.accent, t0 = o.t0 ?? S.t0 ?? 0, pos = M.at(p);
  const g = new THREE.Group(); g.name = o.name ?? 'map marker'; g.position.copy(pos); g.userData.noContact = true; g.userData.airborne = true; S.scene.add(g);
  const mat = new THREE.MeshBasicMaterial({ color: col, toneMapped: false }), rm = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .9, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * .35, 40), mat); dot.position.y = r * .15; dot.name = 'marker dot'; g.add(dot);
  const halo = new THREE.Mesh(new THREE.RingGeometry(r * 1.25, r * 1.55, 64), rm.clone()); halo.rotation.x = -Math.PI / 2; halo.position.y = r * .45; halo.name = 'marker halo'; g.add(halo);
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * .9, r * 1.15, 64), rm); ring.rotation.x = -Math.PI / 2; ring.position.y = r * .5; ring.name = 'marker ring'; g.add(ring);
  g.traverse(m => { m.userData.noContact = true; m.castShadow = false; m.receiveShadow = false; });
  S.tick(t => {
    const k = Math.min(1, Math.max(0, (t - t0) / .35)), e = 1 - Math.pow(1 - k, 3); g.visible = t >= t0; g.scale.setScalar(Math.max(.001, e));
    if (o.pulse !== false) { const u = (((t - t0) / (o.period ?? 1.6)) % 1 + 1) % 1; ring.scale.setScalar(1 + u * 2.6); ring.material.opacity = .9 * (1 - u) * e; }
  });
  if (o.title) S.over(ENG.place(pos.clone().add(V(0, r * .5, 0)), o.title, { sub: o.sub, t0, ...(o.tag || {}) }));
  return g;
}

/** strikeArc(S, M, from, to, o): a path through the air that draws itself (a missile, a flight), with a glowing head and an
 *  impact flash + shockwave ring where it lands. from: a point, or { bearing (deg, where it comes FROM: 0 = north), dist (km) }
 *  for a launch site off the map. o: { t0, dur (2.4 s), h (apex height km, default a quarter of the length), color, width
 *  (km, default radius / 160), impact (true), trail (1: the whole path stays; 0.3: only the last 30 %) }. Returns { group,
 *  point(u) -> Vector3, t1 (impact time) }. */
export function strikeArc(S, M, from, to, o = {}) {
  const t0 = o.t0 ?? S.t0 ?? 0, dur = o.dur ?? 2.4, col = o.color ?? M.accent, p1 = M.at(to, .002);
  let p0; if (from && from.bearing != null) { const b = from.bearing * D2R, d = from.dist ?? M.radius * 2.5, k = M.km(to); p0 = M.at([k[0] + Math.sin(b) * d, k[1] + Math.cos(b) * d], .002); } else p0 = M.at(from, .002);
  const len = p0.distanceTo(p1), h = o.h ?? len * .25, mid = p0.clone().lerp(p1, .5); mid.y = Math.max(p0.y, p1.y) + h * 2;   // quadratic: the apex reaches h
  const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1), N = 160, w = o.width ?? M.radius / 160;
  const geo = new THREE.TubeGeometry(curve, N, w, 8, false), per = geo.index.count / N;
  const mat = new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: true, opacity: .95 });
  const tube = new THREE.Mesh(geo, mat); tube.name = o.name ?? 'strike path'; tube.frustumCulled = false;
  const head = new THREE.Mesh(new THREE.SphereGeometry(w * 2.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); head.name = 'strike head';
  const glow = new THREE.Mesh(new THREE.SphereGeometry(w * 6, 16, 12), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .45, toneMapped: false, depthWrite: false })); head.add(glow);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe8d0, transparent: true, toneMapped: false, depthWrite: false })); flash.position.copy(p1); flash.name = 'impact flash';
  const wave = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide })); wave.rotation.x = -Math.PI / 2; wave.position.copy(p1).add(V(0, .001, 0)); wave.name = 'impact ring';
  const g = new THREE.Group(); g.name = 'strike arc'; g.add(tube, head, flash, wave); S.scene.add(g);
  g.traverse(m => { m.userData.noContact = true; m.userData.airborne = true; m.castShadow = m.receiveShadow = false; });
  const t1 = t0 + dur, trail = o.trail ?? 1, R0 = o.impactSize ?? M.radius / 14;
  S.tick(t => {
    const u = Math.min(1, Math.max(0, (t - t0) / dur)), e = u < 1 ? u * u * (3 - 2 * u) * .25 + u * .75 : 1;   // eases in, arrives fast
    const n = Math.round(e * N), s0 = trail >= 1 ? 0 : Math.max(0, Math.round((e - trail) * N));
    geo.setDrawRange(s0 * per, Math.max(0, n - s0) * per); tube.visible = t >= t0 && n > 0;
    head.visible = t >= t0 && u < 1; if (head.visible) head.position.copy(curve.getPoint(e));
    const k = (t - t1) / .9; flash.visible = wave.visible = o.impact !== false && k >= 0 && k <= 1;
    if (flash.visible) { flash.scale.setScalar(R0 * (.3 + .7 * Math.sqrt(k))); flash.material.opacity = (1 - k) * .95; wave.scale.setScalar(R0 * (.4 + 2.2 * k)); wave.material.opacity = (1 - k) * .9; }
  });
  return { group: g, curve, point: u => curve.getPoint(u), t1 };
}
