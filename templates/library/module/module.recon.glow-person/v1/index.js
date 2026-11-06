// module.recon.glow-person v1 - the "glowing orange people" look the owner liked in three shot matches: an emissive body
// (toneMapped false) with a fresnel rim brighter and yellower than the core, a skinned inverted-hull OUTLINE, and for
// sunlit scenes additive back-face HALO shells (bloom can't isolate figures when the lit ground is brighter than them).
// Every material that patches a shader in onBeforeCompile gets its own customProgramCacheKey: three.js caches programs
// by onBeforeCompile.toString(), so shells or bodies that differ only in a captured number would share ONE program.
// Contract: THREE from the project's engine.js; figure() from the recon kit's lib/figures.js; part() from lib/crime.js.
import { THREE } from '../../engine.js';
import { figure } from '../../lib/figures.js';
import { part } from '../../lib/crime.js';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const f3 = a => `vec3(${a.map(v => (+v).toFixed(4)).join(', ')})`;

// Looks (colours are LINEAR; convert reference samples with fromRef in module.recon.canvas-materials):
//   cafe   - warm interior at night: dark-orange core, yellow fresnel rim, opaque yellow outline (café V3, 7/10)
//   night  - moonlit exterior: saturated orange core, thin red-orange rim, softer outline (prison-wall dig, 7/10)
//   sunlit - daylight: a core->rim colour ramp instead of an added rim, roughness 1 and no env (the sun's white specular
//            turned them peach), 3 additive halo shells, no outline (prison tunnel)
// Pair each with settings.post.cap >= .95 (the Investigation grade caps highlights at .775 and turns hot orange pastel).
export const LOOKS = {
  cafe: { body: { mode: 'add', color: 0x4a1404, emissive: 0xe0480a, intensity: .85, rough: .6, rim: [1, .72, .38], rimPow: 2.5, rimK: 1.5 }, outline: { color: 0xffc04a, offset: .006, opacity: .85 } },
  night: { body: { mode: 'add', color: 0x1e0800, emissive: 0xff5a08, intensity: .9, rough: .5, rim: [1, .5, .06], rimPow: 2.2, rimK: .6 }, outline: { color: 0xffa630, offset: .007, opacity: .55 } },
  sunlit: { body: { mode: 'mix', color: 0x3a0c00, rough: 1, env: 0, core: [.86, .13, .006], rim: [1, .42, .07], rimK: 1.3, rimPow: 1.3 }, outline: null,
    halos: [[.006, .2], [.018, .08], [.034, .035]], haloColor: 0xff7a20 },
};

// glowMaterial(b): the body. b.mode 'add' (emissive + fresnel rim added) | 'mix' (emissive = mix(core, rim * rimK, fresnel))
export function glowMaterial(b = LOOKS.cafe.body) {
  const m = new THREE.MeshStandardMaterial({ color: b.color ?? 0x3a0c00, emissive: b.mode === 'mix' ? 0xffffff : (b.emissive ?? 0xff5a08), emissiveIntensity: b.mode === 'mix' ? 1 : (b.intensity ?? .9),
    roughness: b.rough ?? .6, metalness: 0, toneMapped: false, ...(b.env != null ? { envMapIntensity: b.env } : {}) });
  const code = b.mode === 'mix'
    ? `float czF = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
    totalEmissiveRadiance = mix(${f3(b.core)}, ${f3(b.rim)} * ${(+b.rimK).toFixed(4)}, pow(1.0 - czF, ${(+b.rimPow).toFixed(4)}));`
    : `float czFr = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), ${(+b.rimPow).toFixed(4)});
    totalEmissiveRadiance += ${f3(b.rim)} * czFr * ${(+b.rimK).toFixed(4)};`;
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + code); };
  m.customProgramCacheKey = () => 'czglow|' + code;
  return m;
}
// hullMaterial(o): a skinned inverted hull pushed o.offset m out along the normals (an outline or a halo shell)
export function hullMaterial(o = {}) {
  const off = (o.offset ?? .006).toFixed(4), m = new THREE.MeshBasicMaterial({ color: o.color ?? 0xffc04a, side: THREE.BackSide, toneMapped: false, transparent: true, opacity: o.opacity ?? .85,
    ...(o.additive ? { blending: THREE.AdditiveBlending, depthWrite: false } : {}) });
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n transformed += normalize(objectNormal) * ' + off + ';'); };
  m.customProgramCacheKey = () => 'czhull|' + off;
  return m;
}
function hull(m, mat, name) { const o = new THREE.SkinnedMesh(m.geometry, mat); o.name = name; o.frustumCulled = false; o.castShadow = o.receiveShadow = false; o.userData.noContact = true; o.userData.noPick = true;
  o.bindMode = m.bindMode; o.bind(m.skeleton, m.bindMatrix); m.parent.add(o); return o; }

// glow(f, look = 'cafe'): make a figure glow. Uses f.mannequin (a re-bound mannequin's meshes) when set; otherwise the
// figure's largest skinned mesh (the bare body of an outfit 'none' figure) and hides every other mesh (face layers, hair,
// eyes) on layer 31. Returns f.
export function glow(f, look = 'cafe') {
  const L = typeof look === 'string' ? LOOKS[look] : look; let meshes = f.mannequin?.length ? f.mannequin : null;
  if (!meshes) { let body = null, n = 0; f.group.traverse(m => { if (m.isSkinnedMesh && m.geometry.attributes.position.count > n) { n = m.geometry.attributes.position.count; body = m; } });
    if (!body) return f; f.group.traverse(m => { if (m.isMesh && m !== body) m.layers.set(31); }); meshes = [body]; f.mannequin = meshes; }
  const outline = L.outline ? hullMaterial(L.outline) : null, halos = (L.halos ?? []).map(([off, op]) => hullMaterial({ color: L.haloColor ?? 0xff7a20, offset: off, opacity: op, additive: true }));
  for (const m of meshes) { m.material = glowMaterial(L.body); m.castShadow = false;
    if (outline) hull(m, outline, m.name + ' outline'); halos.forEach((h, i) => hull(m, h, m.name + ' halo ' + i)); }
  return f;
}
// bareFigure(name, o, spec): the kit's bare human (outfit 'none', smooth and anatomical, like AI references' figures);
// o = figure placement ({ parent, x, y, z, ry }). Same skeleton, clips and hand IK as every recon figure.
export const bareFigure = (name, o = {}, spec = {}) => figure({ role: 'extra', body: 'm', outfit: 'none', name, ...spec }, o);
// glowPerson(name, o, look): bareFigure + glow in one call
export const glowPerson = (name, o = {}, look = 'cafe', spec = {}) => glow(bareFigure(name, o, spec), look);

// rebindMannequin(f, gltf): draw a user's rigged mannequin glb (e.g. MODELS.man after setup({ models: { man: ... } }))
// instead of the kit body: its skinned meshes are re-bound to the figure's own skeleton by bone NAME (the glb must use the
// kit's bone names: pelvis, spine_01...), the kit meshes are hidden. Sets f.mannequin; call glow(f) after.
export function rebindMannequin(f, gltf) {
  if (!gltf || !f.group) return f; let lib = null; const old = [];
  f.group.traverse(o => { if (o.isMesh) old.push(o); if (!lib && o.isSkinnedMesh && o.skeleton?.bones.some(b => b.name === 'pelvis')) lib = o; });
  if (!lib) return f;
  const inv = new Map(lib.skeleton.bones.map((b, i) => [b.name, lib.skeleton.boneInverses[i]])), byName = new Map(lib.skeleton.bones.map(b => [b.name, b])), made = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(src => { if (!src.isSkinnedMesh) return;
    const bones = src.skeleton.bones.map(b => byName.get(b.name) ?? byName.get('pelvis')), invs = src.skeleton.bones.map((b, i) => (inv.get(b.name) ?? src.skeleton.boneInverses[i]).clone());
    const m = new THREE.SkinnedMesh(src.geometry, new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: .62 })); m.name = `${f.name} ${/joint/i.test(src.material.name) ? 'joints' : 'body'}`;
    m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.bind(new THREE.Skeleton(bones, invs), src.bindMatrix); made.push(m); });
  for (const o of old) o.layers.set(31); for (const m of made) lib.parent.add(m);
  f.mannequin = made; return f;
}

// glowLight(S, f, o): the glow's light on what is near the figure: a warm point light that follows a bone every frame
export function glowLight(S, f, o = {}) {
  const pl = new THREE.PointLight(o.color ?? 0xff7a24, o.i ?? 2.2, o.d ?? 2.8, o.decay ?? 1.6), off = V(...(o.off ?? [0, 0, .5])); S.scene.add(pl);
  S.tick(() => pl.position.copy(f.scenePos(o.bone ?? 'spine_03')).add(off)); return pl;
}

// glowCap(S, f, look): a flat cap in the same glow, riding the posed head (call AFTER the tick that poses the figure)
export function glowCap(S, f, look = 'cafe') {
  const L = typeof look === 'string' ? LOOKS[look] : look, g = new THREE.Group(); g.name = 'flat cap'; g.userData.noContact = true; const mat = glowMaterial(L.body);
  const crown = part(new THREE.SphereGeometry(.112, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.3), mat, [0, 0, -.01], null, g, 'cap crown'); crown.scale.set(1.02, .5, 1.12);
  const brim = part(new THREE.CylinderGeometry(.1, .1, .012, 24), mat, [0, -.004, .09], [.15, 0, 0], g, 'cap brim'); brim.scale.set(1, 1, .55);
  for (const m of [crown, brim]) { m.castShadow = false; const o = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: L.outline?.color ?? 0xffc04a, side: THREE.BackSide, toneMapped: false })); o.scale.setScalar(1.05); m.add(o); }
  S.scene.add(g); const fq = new THREE.Quaternion(), ws = V();
  S.tick(() => { f.group.getWorldQuaternion(fq); f.group.getWorldScale(ws); const s = ws.x, fw = V(0, 0, 1).applyQuaternion(fq);
    g.scale.setScalar(s); g.position.copy(f.scenePos('Head')).add(V(0, .115 * s, 0)).addScaledVector(fw, -.015 * s); g.quaternion.copy(fq); g.rotateY(Math.PI); g.rotateX(-.22); });
  return g;
}
