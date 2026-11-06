// Converts one dropped 3D model to an uncompressed binary glTF (.glb) + a small thumbnail. Called by src/main/models.ts:
//   await window.convert({ main: 'chair.fbx', files: { 'chair.fbx': '<base64>', 'wood.png': '<base64>', ... } })
// -> { glb: '<base64>', thumb: 'data:image/png;base64,...', info: {...} }   (throws with a plain message when it can't)
import * as THREE from 'three';
import { GLTFLoader } from './jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from './jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from './jsm/libs/meshopt_decoder.module.js';
import { FBXLoader } from './jsm/loaders/FBXLoader.js';
import { OBJLoader } from './jsm/loaders/OBJLoader.js';
import { MTLLoader } from './jsm/loaders/MTLLoader.js';
import { ColladaLoader } from './jsm/loaders/ColladaLoader.js';
import { STLLoader } from './jsm/loaders/STLLoader.js';
import { PLYLoader } from './jsm/loaders/PLYLoader.js';
import { ThreeMFLoader } from './jsm/loaders/3MFLoader.js';
import { TGALoader } from './jsm/loaders/TGALoader.js';
import { GLTFExporter } from './jsm/exporters/GLTFExporter.js';
import * as fflate from './jsm/libs/fflate.module.js';

const MODEL_ORDER = ['glb', 'gltf', 'fbx', 'obj', 'dae', '3mf', 'stl', 'ply'];
const ext = n => (n.split('.').pop() || '').toLowerCase();
const base = n => decodeURIComponent(String(n)).split(/[\\/]/).pop().split(/[?#]/)[0].toLowerCase();
const b64ToBytes = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const bytesToB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp', gif: 'image/gif' };

function toStandard(m) {
  if (!m || m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isShaderMaterial) return m;
  const s = new THREE.MeshStandardMaterial({ name: m.name, color: m.color ? m.color.clone() : 0xcccccc, map: m.map || null, normalMap: m.normalMap || null,
    emissive: m.emissive ? m.emissive.clone() : 0x000000, emissiveMap: m.emissiveMap || null, alphaMap: m.alphaMap || null, aoMap: m.aoMap || null,
    opacity: m.opacity ?? 1, transparent: !!m.transparent, side: m.side ?? THREE.FrontSide, vertexColors: !!m.vertexColors, roughness: .85, metalness: 0 });
  return s;
}

window.convert = async ({ main, files }) => {
  // every file by its lower-case base name (resources are looked up by name only, whatever folder the model expected)
  let bytes = {};
  for (const [n, b] of Object.entries(files)) bytes[base(n)] = b64ToBytes(b);
  let mainName = base(main);
  if (ext(mainName) === 'zip') {
    const un = fflate.unzipSync(bytes[mainName]); bytes = {};
    for (const [n, u] of Object.entries(un)) if (!n.endsWith('/') && !n.startsWith('__MACOSX')) bytes[base(n)] = u;
    const names = Object.keys(bytes);
    mainName = MODEL_ORDER.map(e => names.find(n => ext(n) === e)).find(Boolean);
    if (!mainName) throw new Error('The zip has no 3D model in it (.glb .gltf .fbx .obj .dae .3mf .stl .ply).');
  }
  const urls = {};
  for (const [n, u] of Object.entries(bytes)) urls[n] = URL.createObjectURL(new Blob([u], { type: MIME[ext(n)] || 'application/octet-stream' }));
  const missing = new Set();
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(u => { if (/^(blob|data):/.test(u)) return u; const b = base(u); if (urls[b]) return urls[b]; missing.add(b); return u; });
  const prog = { loaded: 0, total: 0 };
  manager.onProgress = (_u, l, t) => { prog.loaded = l; prog.total = t; };
  manager.addHandler(/\.tga$/i, new TGALoader(manager));
  const url = urls[mainName], e = ext(mainName);
  let root, animations = [];
  if (e === 'glb' || e === 'gltf') {
    const l = new GLTFLoader(manager); const d = new DRACOLoader(manager); d.setDecoderPath('./jsm/libs/draco/'); d.setDecoderConfig({ type: 'js' });
    l.setDRACOLoader(d); l.setMeshoptDecoder(MeshoptDecoder);
    const g = await l.loadAsync(mainName); root = g.scene; animations = g.animations || [];
  } else if (e === 'fbx') { root = await new FBXLoader(manager).loadAsync(mainName); animations = root.animations || []; }
  else if (e === 'obj') {
    const l = new OBJLoader(manager);
    const mtl = Object.keys(bytes).find(n => ext(n) === 'mtl' && n.slice(0, -4) === mainName.slice(0, -4)) || Object.keys(bytes).find(n => ext(n) === 'mtl');
    if (mtl) { try { const mats = await new MTLLoader(manager).loadAsync(mtl); mats.preload(); l.setMaterials(mats); } catch { /* plain grey */ } }
    root = await l.loadAsync(mainName);
  } else if (e === 'dae') { const c = await new ColladaLoader(manager).loadAsync(mainName); root = c.scene; animations = c.scene.animations || []; }
  else if (e === '3mf') root = await new ThreeMFLoader(manager).loadAsync(mainName);
  else if (e === 'stl' || e === 'ply') {
    const geo = await (e === 'stl' ? new STLLoader(manager) : new PLYLoader(manager)).loadAsync(mainName);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    root = new THREE.Group(); root.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: .85, vertexColors: !!geo.attributes.color })));
  } else throw new Error(`.${e} is not a 3D format the app can convert.`);
  void url;
  // textures load after the loader returns: wait for the manager (at most 15 s)
  for (let i = 0; i < 150 && prog.loaded < prog.total; i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 50));
  // plain materials the exporter understands; drop textures that never loaded (missing file) so the export does not fail
  let meshes = 0, tris = 0, skinned = false; const bones = [];
  root.traverse(o => {
    if (o.isBone) bones.push(o.name);
    if (!o.isMesh) return;
    meshes++; if (o.isSkinnedMesh) skinned = true;
    const g = o.geometry; tris += g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3;
    const fix = m => { const s = toStandard(m); for (const k of ['map', 'normalMap', 'emissiveMap', 'alphaMap', 'aoMap', 'roughnessMap', 'metalnessMap']) { const t = s[k];
      if (t && (!t.image || (t.image.width === 0 && !t.image.data))) s[k] = null; } return s; };
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
  });
  if (!meshes) throw new Error('The file loaded but has no visible mesh in it.');
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  const bl = bones.map(b => b.toLowerCase());
  const humanoid = skinned && ['hip', 'spine', 'head'].every(k => bl.some(b => b.includes(k))) && bl.some(b => /arm|shoulder|hand/.test(b)) && bl.some(b => /leg|thigh|foot|upleg/.test(b));
  const out = await new GLTFExporter().parseAsync(root, { binary: true, animations, onlyVisible: false, maxTextureSize: 4096 });
  // thumbnail (best effort)
  let thumb = null;
  try {
    const W = 256, r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setSize(W, W, false);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 3, 2); sc.add(dl); sc.add(root);
    const c = box.getCenter(new THREE.Vector3()), rad = Math.max(size.x, size.y, size.z) || 1;
    const cam = new THREE.PerspectiveCamera(35, 1, rad / 100, rad * 100); cam.position.copy(c).add(new THREE.Vector3(1, .7, 1.3).normalize().multiplyScalar(rad * 2.6)); cam.lookAt(c);
    r.render(sc, cam); thumb = r.domElement.toDataURL('image/png'); r.dispose();
  } catch { /* no thumbnail */ }
  for (const u of Object.values(urls)) URL.revokeObjectURL(u);
  return { glb: bytesToB64(new Uint8Array(out)), thumb, source: mainName,
    info: { meshes, triangles: Math.round(tris), size: [size.x, size.y, size.z].map(v => +v.toFixed(3)), skinned, bones: bones.length, humanoid,
      animations: animations.map(a => a.name || 'unnamed'), missing: [...missing] } };
};
window.ready = true;
