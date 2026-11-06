// Sprite library (lib/sprites): characters and animals drawn by an image model, cut out to transparency, reused across
// projects. A figure in a script uses its sprite when the library has one for that cast name; otherwise the procedural
// rig draws it. Picking: exact key, then the same pose+face without items, then the same pose, then the same face.
import { THREE } from './paint.js';

let IDX = {}; const TEX = new Map(); export const LOG = [];
const ALIAS = { walk2: 'walk', run2: 'run', talkL: 'talk', waveL: 'wave' };
// sheet-scale reference: these poses stand upright with arms below the head, so their height = a full figure
const UPRIGHT = new Set(['stand', 'talk', 'shrug', 'present', 'pointR', 'pointL', 'hips', 'facepalm', 'crossarms', 'shiver', 'walk', 'spoint', 'offer', 'stalk', 'sstand']);
const RATIO = { crouch: .66, kneel: .66, kneelpray: .7, sitchair: .82, sitground: .6, lie: .3, fall: .9, cheer: 1.15, holdup: 1.2, pointUp: 1.12, dance: 1.08, dig: .92, sneak: .85, throw: 1, sscared: 1, jump: 1 };
export const keyOf = (pose, e, hold = '', hold2 = '', xl = false) => { pose = ALIAS[pose] || pose; const it = [hold, hold2].filter(h => h && h !== '-'); return xl ? 'XL-' + e : [pose, e, ...it].join('-'); };

// The image model sometimes leaves a shirt or face unfilled, so the green key cuts it out and the scene shows through
// the figure. Transparent pixels the outside can't reach (enclosed by the outline) are painted white.
function fillHoles(t) {
  const im = t.image, w = im.naturalWidth || im.width, h = im.naturalHeight || im.height; if (!w || !h) return;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
  const id = g.getImageData(0, 0, w, h), d = id.data, out = new Uint8Array(w * h), st = [];
  const push = i => { if (!out[i] && d[i * 4 + 3] < 128) { out[i] = 1; st.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); } for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (st.length) { const i = st.pop(), x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < w * (h - 1)) push(i + w); }
  let n = 0; for (let i = 0; i < w * h; i++) if (!out[i] && d[i * 4 + 3] < 128) { d.set([255, 255, 255, 255], i * 4); n++; }
  if (n) { g.putImageData(id, 0, 0); t.image = cv; t.needsUpdate = true; }
}

// set: 'sprites' (clean) or 'sprites_paint' (MS Paint redraw: drawn with hard pixel edges, no smoothing)
let ROOT = '../assets/sprites';
export async function loadSprites(names, root = ROOT, crisp = true) {
  ROOT = root;
  IDX = await fetch(ROOT + '/index.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  names = names || Object.keys(IDX);
  const loader = new THREE.TextureLoader(), jobs = [];
  for (const c of names) for (const [k, v] of Object.entries(IDX[c]?.sprites || {})) {
    const url = `${ROOT}/${c}/${v.file}?v=${v.w}x${v.h}`; if (TEX.has(url)) continue;
    jobs.push(loader.loadAsync(url).then(t => { fillHoles(t); t.colorSpace = THREE.SRGBColorSpace; if (crisp) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; } else t.anisotropy = 4; TEX.set(url, t); }));
  }
  await Promise.all(jobs.map(j => j.catch(e => console.warn('sprite failed to load: ' + e.message))));
  // per sheet: median height of its upright full-body figures (sets the pixel scale of every figure on that sheet)
  for (const c of names) { const sp = IDX[c]?.sprites || {}, by = {};
    for (const [k, v] of Object.entries(sp)) if (!k.startsWith('XL-') && UPRIGHT.has(k.split('-')[0])) (by[v.sheet] ||= []).push(v.h);
    for (const v of Object.values(sp)) { const hs = (by[v.sheet] || []).sort((a, b) => a - b); v.ref = hs.length ? hs[hs.length >> 1] : null; } }
}
export const has = c => !!IDX[c];
export const castNames = () => Object.keys(IDX);
export function pick(c, key) {
  const sp = IDX[c]?.sprites; if (!sp) return null;
  let k = key;
  if (!sp[k]) { const [pose, e] = key.split('-'), all = Object.keys(sp);
    k = all.find(x => x === `${pose}-${e}`) || all.find(x => x.startsWith(pose + '-' + e)) || all.find(x => x.split('-')[0] === pose) || (key.startsWith('XL-') ? all.find(x => x.startsWith('XL-')) : null) || all.find(x => x.split('-')[1] === e && !x.startsWith('XL-')) || null;
    LOG.push(`${c}: ${key} -> ${k || 'procedural rig'}`); if (!k) return null; }
  const v = sp[k]; return { ...v, key: k, tex: TEX.get(`${ROOT}/${c}/${v.file}?v=${v.w}x${v.h}`) };
}
// frame-pixel height of a figure sprite: a full upright figure is FULL px at s = 1
export const FULL = 288;
export function heightOf(p, s) {
  const pose = p.key.split('-')[0];
  if (p.ref) return p.h / p.ref * FULL * s;
  return FULL * s * (RATIO[pose] ?? 1);
}
