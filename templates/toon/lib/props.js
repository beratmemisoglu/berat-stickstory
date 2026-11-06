// The prop kit: every prop is made in code in the toon look (rounded, chunky, soft materials, ink outline) and registered
// by name. Domain files (lib/props/*.js) each export REG = { name: { make(o) -> THREE.Group, tags: [...], desc } }.
// prop(name, o) builds one; S.prop(name, { at: [x, z], ry, y, scale, on: otherProp }) puts it in a shot.
// Conventions on the returned group's userData (set by the maker, read by placement, hands and the layout check):
//   top:  height (m, local) of a flat top surface things can stand on (tables, counters, shelves: highest board)
//   seat: height of a seat (chairs, benches, sofas)          grip: { at: [x,y,z], rot: [x,y,z] } where a hand holds it
//   solid: true (default) the layout check flags characters inside it; false for rugs, puddles, decals
//   screen: a canvasTex the scene may redraw (monitors, phones, signs)    light: a THREE.Light inside (lamps)
import { THREE, rnd } from './core.js';
import { REG as indoor } from './props/indoor.js';
import { REG as outdoor } from './props/outdoor.js';
import { REG as tech } from './props/tech.js';
import { REG as worlds } from './props/worlds.js';

export const REG = { ...indoor, ...outdoor, ...tech, ...worlds };
export const propNames = (tag) => Object.keys(REG).filter(n => !tag || REG[n].tags?.includes(tag)).sort();
export const propTags = () => [...new Set(Object.values(REG).flatMap(r => r.tags || []))].sort();
export function prop(name, o = {}) {
  const r = REG[name];
  if (!r) { console.warn(`unknown prop "${name}" (lib/props: ${propNames().length} props)`); const g = new THREE.Group(); g.userData.kind = name; return g; }
  const g = r.make({ seed: o.seed ?? 1, ...o });
  g.name ||= name; g.userData.kind = name; g.userData.pickRoot = true; g.userData.solid ??= true;
  if (o.scale) g.scale.multiplyScalar(o.scale);
  return g;
}
/** place a prop in a shot: at [x, z] (floor) or [x, y, z]; on: a prop with userData.top (stands on it); ry radians */
export function place(S, name, o = {}) {
  const g = typeof name === 'string' ? prop(name, o) : name;
  const at = o.at || [0, 0];
  let y = o.y ?? 0;
  if (o.on) { o.on.updateMatrixWorld(true); const top = o.on.userData.top ?? new THREE.Box3().setFromObject(o.on).max.y - o.on.position.y; y = o.on.position.y + top * (o.on.scale?.y ?? 1); }
  if (at.length === 3) g.position.set(at[0], at[1], at[2]); else g.position.set(at[0], y, at[1]);
  if (o.on && at.length === 2 && o.rel) g.position.add(new THREE.Vector3(o.on.position.x, 0, o.on.position.z));
  if (o.ry != null) g.rotation.y = o.ry;
  g.traverse(m => { if (m.isMesh && !m.userData.isOutline) { m.castShadow = o.shadow !== false; m.receiveShadow = true; } });
  S.add(g); return g;
}
/** scatter copies of props over an area (dressing): names[], area [x0, z0, x1, z1], n, seed, avoid: [[x, z, r]] */
export function scatter(S, names, area, n = 10, o = {}) {
  const R = rnd(o.seed ?? 5), out = [];
  for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
    const x = area[0] + R() * (area[2] - area[0]), z = area[1] + R() * (area[3] - area[1]);
    if ((o.avoid || []).some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r)) continue;
    if (out.some(p => Math.hypot(p.position.x - x, p.position.z - z) < (o.gap ?? .6))) continue;
    const nm = names[Math.floor(R() * names.length)];
    out.push(place(S, nm, { at: [x, z], ry: o.ry ?? R() * Math.PI * 2, scale: (o.scale ?? 1) * (1 + (R() - .5) * (o.vary ?? .3)), seed: Math.floor(R() * 1e6) })); i++;
  }
  return out;
}
