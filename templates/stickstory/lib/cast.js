// Stick stories - THE CAST: ready looks (every name is our own). A look is plain data that rig.js Figure draws:
//   { id, name, role, age: 'adult' | 'teen' | 'kid' | 'small' | 'elder', outfit: { top, color, color2, pants, shoes, watch, cuff,
//     pocket, strings, hood, tie, belt, badge, lanyard, whistle, apron, hem, sleeves }, hair, hairColor, hairAcc, hat, hatColor,
//     glasses: 'round' | 'square', moustache: 'brown' | 'white', clip (colour), scarf (colour), rim, expr (default face),
//     extra (faceless background person), tint (extra's colour), handStyle: 'glove' | 'flat' (hand inserts),
//     cast: 'L' | 'R' (a white plaster cast on that forearm, every framing + hand inserts on that side), sling: true (the cast
//     arm rests in a pale-blue sling across the chest; holds and gestures use the other hand), castColor, slingColor }
//   A cast for part of the story: S.char('abe', { cast: 'L', sling: true }) in every shot from the break on, or one look in
//   models.js (export const ABE_HURT = { base: 'abe', cast: 'L', sling: true }; S.char(ABE_HURT)) - lessons 02-handshake.
// Identity rule (analysis/characters/NOTES.md 3.2): one saturated signature colour on the top + at most 1-2 accessories.
//   resolve('main', SETTINGS)   the project's main character (settings.characters.main = a cast id), default 'you'
//   resolve('pip')              a cast look;  resolve('you@kid') the same look at another age
//   resolve({ base: 'you', outfit: { color: '#e05' } })   a variation;  resolve(lookObject) as is
//   resolve('anyNewName')       a stable random look for that name (so unnamed side characters still vary)
//   crowd(n, seed)              n different flat-colour looks for a party / audience; extras(n, seed, tint) faceless extras
export const CAST = {
  you: { name: 'You', role: 'the blue-hoodie "you" hero (default main character)', age: 'adult', outfit: { top: 'hoodie', color: '#2c64c9', watch: 'L' } },
  rae: { name: 'Rae', role: 'the red-hoodie hero (any age: rae@kid, rae@small)', age: 'adult', outfit: { top: 'hoodie', color: '#dd4336' } },
  pip: { name: 'Pip', role: 'little sister: top-knot with a teal bow and hair clip, plain black body', age: 'teen', hair: 'topknot', clip: '#26c8be', hairAcc: '#26c8be' },
  nora: { name: 'Nora', role: 'mother: round glasses and a cream knit scarf (a slightly smaller head, as in the line-up)', age: 'adult', headScale: .9, glasses: 'round', scarf: '#eee0c3' },
  vera: { name: 'Vera', role: 'mother: teal coat-dress with a yellow belt, bun with long hair', age: 'adult', hair: 'bunlong', outfit: { top: 'coatdress', color: '#38877d', belt: '#e8b830' } },
  hal: { name: 'Hal', role: 'father: grey suit, blue tie, white cuffs, watch', age: 'adult', outfit: { top: 'suit', color: '#9396a6', tie: '#2f6fd8', watch: 'L' } },
  gus: { name: 'Gus', role: 'father: blue track jacket, yellow headband', age: 'adult', hat: 'headband', hatColor: '#f2c24a', outfit: { top: 'track', color: '#3482ba' } },
  bree: { name: 'Bree', role: 'girl: pink hoodie, top bun', age: 'teen', hair: 'bun', outfit: { top: 'hoodie', color: '#ef8597', pocket: false } },
  krane: { name: 'Dr. Krane', role: 'villain: bald, brown moustache, lab coat over a brown vest', age: 'adult', hair: 'bald', moustache: 'brown', outfit: { top: 'labcoat', color: '#b8cbdf' } },
  sterling: { name: 'Sterling', role: 'boss: navy suit, slicked hair, dark tie', age: 'adult', hair: 'slick', outfit: { top: 'suit', color: '#28304b', tie: '#1b1f2e' } },
  remy: { name: 'Remy', role: 'call-centre worker: curly hair, headset, ochre jacket with an ID card', age: 'adult', hair: 'curls', hat: 'headset', outfit: { top: 'jacket', color: '#967839', badge: 'card' } },
  walt: { name: 'Walt', role: 'old man: fedora, round glasses, white moustache, tan trench coat', age: 'elder', hat: 'fedora', glasses: 'round', moustache: 'white', outfit: { top: 'coat', color: '#a17447' } },
  edna: { name: 'Edna', role: 'old woman: grey hair with a bun, round glasses, cream scarf', age: 'elder', hair: 'greybun', glasses: 'round', scarf: '#eee0c3' },
  dale: { name: 'Coach Dale', role: 'coach: green hoodie, navy flat cap, whistle', age: 'adult', hat: 'flatcap', hatColor: '#28304b', outfit: { top: 'hoodie', color: '#3f9a5c', whistle: true, strings: false } },
  kit: { name: 'Kit', role: 'small kid (about 5): red hoodie, a hair tuft', age: 'small', hair: 'tuft', outfit: { top: 'hoodie', color: '#dd4336', pocket: false } },
  teo: { name: 'Teo', role: 'kid (about 10): yellow t-shirt, red cap', age: 'kid', hat: 'cap', hatColor: '#d8433b', outfit: { top: 'tee', color: '#f2c24a' } },
  zed: { name: 'Zed', role: 'kid: green t-shirt, orange beanie', age: 'kid', hat: 'beanie', hatColor: '#e98a3a', outfit: { top: 'tee', color: '#5f9e6a' } },
  lulu: { name: 'Lulu', role: 'small girl: pigtail buns, purple dress', age: 'small', hair: 'buns', outfit: { top: 'dress', color: '#8a63c8' } },
  ada: { name: 'Dr. Ada', role: 'doctor: teal scrubs, ponytail', age: 'adult', hair: 'ponytail', hairAcc: '#f2efe9', outfit: { top: 'scrubs', color: '#4fa6a0' } },
  ivy: { name: 'Ivy', role: 'scientist: lab coat, square glasses, bob hair', age: 'adult', hair: 'bob', glasses: 'square', outfit: { top: 'labcoat', color: '#d9e3ee', inner: '#3b4a66' } },
  tess: { name: 'Ms. Tess', role: 'teacher: yellow dress, top bun', age: 'adult', hair: 'bun', outfit: { top: 'dress', color: '#f2c24a' } },
  june: { name: 'June', role: 'young woman: white dress, long hair', age: 'adult', hair: 'long', outfit: { top: 'dress', color: '#eeeae2' } },
  finn: { name: 'Finn', role: 'builder: yellow hard hat, orange t-shirt', age: 'adult', hat: 'hardhat', outfit: { top: 'tee', color: '#e98a3a' } },
  cody: { name: 'Cody', role: 'rancher: cowboy hat, denim shirt', age: 'adult', hat: 'cowboy', outfit: { top: 'shirt', color: '#4a6ea8' } },
  sam: { name: 'Sam', role: 'graduate: gown and mortarboard', age: 'teen', hat: 'gradcap', outfit: { top: 'gown', color: '#2c2f3e' } },
  ozzy: { name: 'Ozzy', role: 'prisoner: grey striped robe', age: 'adult', outfit: { top: 'robe', color: '#7e7d80' } },
  bo: { name: 'Chef Bo', role: 'cook: white toque, red t-shirt, white apron', age: 'adult', hat: 'toque', outfit: { top: 'apron', color: '#d8433b' } },
  max: { name: 'Officer Max', role: 'police officer: blue uniform, star badge, navy cap', age: 'adult', hat: 'cap', hatColor: '#1f2b4a', outfit: { top: 'uniform', color: '#2f4f86' } },
  abe: { name: 'Grandpa Abe', role: 'grandfather: white hair, glasses, brown sweater', age: 'elder', hair: 'white', glasses: 'round', outfit: { top: 'sweater', color: '#8a5a3c' } },
  nell: { name: 'Nell', role: 'office worker: white shirt, red tie, ponytail', age: 'adult', hair: 'ponytail', outfit: { top: 'shirt', color: '#eceaf2', tie: '#c8383c' } },
  jax: { name: 'Jax', role: 'teen: purple hoodie, headphones', age: 'teen', hat: 'headphones', outfit: { top: 'hoodie', color: '#7a4fc0' } },
  rook: { name: 'Guard', role: 'armoured guard: helmet with a green visor, no face (repeat for squads)', age: 'adult', hat: 'helmet', face: false, outfit: { top: 'armor', color: '#3a3d45' } },
  extra: { name: 'Extra', role: 'faceless background person (purple silhouette)', extra: true, tint: '#2a263c' },
  'extra-warm': { name: 'Extra', role: 'faceless background person for warm crowds', extra: true, tint: '#332430' },
  'extra-grey': { name: 'Extra', role: 'faceless person for grey memory scenes', extra: true, tint: '#6d6a74' },
  'extra-night': { name: 'Extra', role: 'faceless person for night scenes', extra: true, tint: '#1d1a2a' },
};
for (const [id, c] of Object.entries(CAST)) c.id = id;
export const castIds = () => Object.keys(CAST);
const deep = (a, b) => { const o = { ...a }; for (const k in b || {}) { const v = b[k]; o[k] = v && typeof v === 'object' && !Array.isArray(v) && a?.[k] && typeof a[k] === 'object' ? deep(a[k], v) : v; } return o; };
const AGE = { adult: 1, teen: 1, kid: 1, small: 1, elder: 1, child: 1, toddler: 1, old: 1 };
const hashOf = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
// saturated signature colours seen on the references' tops (hoodies, jackets, dresses)
export const PALETTE = ['#2c64c9', '#dd4336', '#ef8597', '#3f9a5c', '#38877d', '#f2c24a', '#e98a3a', '#7a4fc0', '#3482ba', '#967839', '#a17447', '#4fa6a0', '#c8383c', '#5a6ad8'];
const TOPS = ['hoodie', 'hoodie', 'tee', 'tee', 'sweater', 'shirt', 'jacket', 'dress'];
const HATS = [null, null, null, null, 'cap', 'beanie'];
const HAIRS = [null, null, null, 'bun', 'ponytail', 'curls', 'bob', 'spikes', 'long'];
/** a stable random look from a seed (number or name) */
export function randomLook(seed, o = {}) {
  const r = rng(typeof seed === 'number' ? seed * 7919 + 13 : hashOf(seed)), pick = a => a[Math.floor(r() * a.length) % a.length];
  const top = o.top || pick(TOPS);
  const look = { id: typeof seed === 'string' ? seed : 'rand' + seed, name: typeof seed === 'string' ? seed : 'Someone', age: o.age || 'adult', outfit: { top, color: pick(PALETTE) }, hair: pick(HAIRS) };
  const hat = pick(HATS); if (hat) { look.hat = hat; look.hatColor = pick(PALETTE); }
  if (r() < .18) look.glasses = r() < .5 ? 'round' : 'square';
  if (top === 'dress' && !look.hair) look.hair = 'bun';
  return look;
}
/** n different looks for a party / audience (each its own flat colour, some hats and glasses) */
export function crowd(n = 6, seed = 1, o = {}) { const out = [], used = new Set(); for (let i = 0; i < n; i++) { let L, k = 0; do { L = randomLook(seed * 101 + i * 17 + k++, o); } while (used.has(L.outfit.color) && k < 6); used.add(L.outfit.color); out.push(L); } return out; }
/** n faceless background extras (tint: day purple #2a263c, warm #332430, grey #6d6a74, night #1d1a2a) */
export function extras(n = 4, seed = 1, tint = '#2a263c') { return Array.from({ length: n }, (_, i) => ({ id: 'extra' + i, name: 'Extra', extra: true, tint, age: i % 5 === 3 ? 'teen' : 'adult', hair: [null, null, 'bun', 'ponytail', null][(seed + i) % 5] })); }
/**
 * a look for an id: 'main' (settings.characters.main), a cast id, 'id@age', a project character (settings.characters.custom[id]),
 * a look object ({ base: 'castId', ...changes } merges onto that cast look) or any other name (a stable random look)
 */
export function resolve(id, SETTINGS = {}) {
  const own = SETTINGS?.characters?.custom || {};
  if (id && typeof id === 'object') { if (id.base) return deep(resolve(id.base, SETTINGS), { ...id, base: undefined }); return id; }
  if (id == null || id === '' || id === 'main' || id === 'hero') { const m = SETTINGS?.characters?.main; return m && m !== 'main' ? resolve(m, SETTINGS) : { ...CAST.you }; }
  const s = String(id);
  if (s.includes('@')) { const [base, age] = s.split('@'); const L = resolve(base, SETTINGS); return AGE[age] ? { ...L, age, id: s } : L; }
  if (CAST[s]) return deep(CAST[s], {});
  if (own[s]) return own[s].base ? resolve(own[s], SETTINGS) : own[s];
  return randomLook(s);
}
