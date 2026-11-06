// Browser/engine helpers for the library's shared skeleton ("ue5-mannequin-65").
// Plain ES module, no imports: pass THREE in.  Works with three r170 + GLTFLoader + SkeletonUtils.
//
//   import { prepareClip, attachToSkeleton, BONES } from '<library>/tools/anim-runtime.js'
//   const char = SkeletonUtils.clone(charGltf.scene)
//   const clip = prepareClip(THREE, animGltf.animations.find(a => a.name === 'Walk_Loop'), char)
//   new THREE.AnimationMixer(char).clipAction(clip).play()
//
// Why prepareClip: every clip in animations/*.glb is authored on the UAL mannequin (pelvis rest height 0.918 m).
// Clips carry bone ROTATIONS for all bones and TRANSLATION only for `root` and `pelvis` (other bone translations
// were stripped on purpose so a clip never stretches a character whose bones are longer/shorter).
// prepareClip scales the pelvis/root translation to the target's leg length so feet stay on the ground and
// strides match the legs (no foot sliding), and drops tracks for bones the target does not have.

export const SKELETON_ID = 'ue5-mannequin-65';
export const SOURCE_PELVIS_REST = 0.91836; // |pelvis.position| of the UAL mannequin in its bind pose
export const BONES = ['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head',
  'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l', 'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r',
  'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r'];
// + fingers: <index|middle|ring|pinky|thumb>_<01..03, 04_leaf>_<l|r>, ball_leaf_<l|r>  (65 joints total)

const restCache = new WeakMap();
/** Rest (bind) pelvis offset of a character, read once before any animation touches it. */
export function pelvisRest(root) {
  if (restCache.has(root)) return restCache.get(root);
  const p = root.getObjectByName('pelvis');
  const v = p ? p.position.length() : SOURCE_PELVIS_REST;
  restCache.set(root, v);
  return v;
}

/** Returns a new clip fitted to `targetRoot` (call pelvisRest(targetRoot) before playing anything on it). */
export function prepareClip(THREE, clip, targetRoot, { sourcePelvis = SOURCE_PELVIS_REST, name } = {}) {
  const ratio = pelvisRest(targetRoot) / sourcePelvis;
  const have = new Set(); targetRoot.traverse(o => have.add(o.name));
  const tracks = [];
  for (const t of clip.tracks) {
    const [bone, prop] = t.name.split('.');
    if (!have.has(bone)) continue;
    if (prop === 'position' && bone !== 'root' && bone !== 'pelvis') continue;
    const nt = t.clone();
    if (prop === 'position' && Math.abs(ratio - 1) > 1e-3) for (let i = 0; i < nt.values.length; i++) nt.values[i] *= ratio;
    tracks.push(nt);
  }
  return new THREE.AnimationClip(name || clip.name, clip.duration, tracks);
}

/** Bind a skinned attachment (hair, eyebrows, outfit pieces from characters/hair/*) to a character's skeleton. */
export function attachToSkeleton(THREE, charRoot, attachmentScene) {
  let skel = null; charRoot.traverse(o => { if (o.isSkinnedMesh && !skel) skel = o.skeleton; });
  if (!skel) throw new Error('character has no skeleton');
  const meshes = []; attachmentScene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
  for (const m of meshes) {
    const bones = m.skeleton.bones.map(b => skel.bones.find(x => x.name === b.name) || b);
    const sk = new THREE.Skeleton(bones, m.skeleton.boneInverses);
    m.removeFromParent(); charRoot.add(m); m.bind(sk, m.bindMatrix);
  }
  return meshes;
}

/** Sample world positions of named bones (for foot-plant / clipping checks). */
export function sampleBones(THREE, root, mixer, names, t0, t1, fps = 30) {
  const nodes = names.map(n => root.getObjectByName(n)); const out = []; const v = new THREE.Vector3();
  for (let t = t0; t <= t1 + 1e-6; t += 1 / fps) { mixer.setTime(t); root.updateMatrixWorld(true); out.push({ t, p: nodes.map(n => n.getWorldPosition(v).toArray()) }); }
  return out;
}
