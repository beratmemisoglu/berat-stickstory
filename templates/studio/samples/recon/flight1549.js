// Shared builders of the Style Studio sample (US Airways Flight 1549, 15 January 2009): the grey map of New York, the
// river at real scale, the route, the running clock. hero.js, kit.js and sample.js import them (not a scene of its own).
// Everything is procedural clay (models.js: airliner, goose, ferry, nycMap, cast; lib/world.js: riverWater): no downloads.
// Facts: NTSB accident report AAR-10/03 (take-off LaGuardia runway 4, bird strike at 2,818 ft, ditching off West 48th
// Street about 208 s later, 150 passengers + 5 crew, all survived; NY Waterway ferries alongside within minutes).
import { THREE, E, seg, clamp, lerp, custom, FONT, C, MAT, FW, FH, rr } from '../engine.js';
import { airliner, ferry, nycMap, ll, mp, inst, mesh, hash, AC, ENG } from '../models.js';
import { riverWater } from '../lib/world.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const ENGZ = ENG.s - AC.L / 2;

// ---------- 9:16 (FH > FW): the narrow frame gets its own framing ----------
// The portrait lens (engine v14) shows about half the width a 16:9 key shows, so a shot framed for 16:9 cuts a wide subject
// at the sides, and a flat model spanning most of the narrow frame (the airliner's fuselage and wings) counts as ground for
// the contact check: its fin, engines and doors then read as loose pieces. So wide subjects step back in 9:16:
// tallKeys(keys, k, { l, up }) puts each camera k times as far from what it looks at (same direction; l: a new aim, or one
// per key, up: metres higher); tallOff(offset, k) does the same for a chase offset. In 16:9 both return what they were given.
export const TALL = FH > FW;
export const tallKeys = (keys, k, o = {}) => !TALL ? keys : keys.map((c, i) => {
  const l = V(...(!o.l ? c.l : Array.isArray(o.l[0]) ? o.l[i] : o.l)), p =V(...c.p).sub(V(...c.l)).multiplyScalar(k).add(l); p.y += o.up ?? 0;
  return { ...c, p: p.toArray(), l: l.toArray() }; });
export const tallOff = (off, k) => TALL ? off.map(v => v * k) : off;

// ---------- the map (1 unit = 1 km; x east, -z north; altitude exaggerated x2.2 so the climb reads) ----------
export const ALT = 2.2;
const FT = .0003048 * ALT;
// [lat, lon, feet]: runway 4 at LaGuardia, the climbing left turn over the Bronx, the strike, the turn back south past the
// George Washington Bridge, the glide down the Hudson to the ditching off West 48th Street
export const WAY = [[40.76917, -73.88412, 0], [40.7790, -73.8760, 0], [40.7880, -73.8676, 300], [40.8060, -73.8560, 1200], [40.8230, -73.8640, 2100],
  [40.8400, -73.8790, 2818], [40.8560, -73.8990, 3050], [40.8680, -73.9230, 2700], [40.8650, -73.9470, 2050], [40.8520, -73.9620, 1450],
  [40.8320, -73.9780, 950], [40.8080, -73.9930, 520], [40.7860, -74.0020, 200], [40.7690, -74.0060, 0]];
export const kmV = ([la, lo, ft = 0]) => { const [x, y] = ll(la, lo); return V(x, ft * FT, -y); };
export const ROUTE = (() => { const c = new THREE.CatmullRomCurve3(WAY.map(kmV), false, 'centripetal'); c.arcLengthDivisions = 3000; return c; })();
// u (0..1 along the route) nearest a waypoint
export const uOfWay = i => { const P = kmV(WAY[i]); let best = 0, bd = 1e9; for (let k = 0; k <= 2000; k++) { const d = ROUTE.getPointAt(k / 2000).distanceToSquared(P); if (d < bd) { bd = d; best = k / 2000; } } return best; };
const HSM = .012;
function headingAt(u) { const h = V(0, 0, 0); for (let k = -2; k <= 2; k++) { const T = ROUTE.getTangentAt(clamp(u + k * HSM / 2)); h.add(V(T.x, 0, T.z).normalize()); } return h.normalize(); }
// the aircraft on the route at u: nose along the smoothed horizontal tangent, the real climb angle, banked into the turn
export function flyAt(plane, u, lift = 0) {
  const uu = clamp(u), P = ROUTE.getPointAt(uu), H = headingAt(uu), du = .004, A = ROUTE.getPointAt(clamp(uu - du)), B = ROUTE.getPointAt(clamp(uu + du));
  const pitch = clamp(Math.atan2((B.y - A.y) / ALT, Math.hypot(B.x - A.x, B.z - A.z) || 1e-6), 0, .26);
  const H0 = headingAt(uu - HSM), H1 = headingAt(uu + HSM), L = ROUTE.getLength() * 2 * HSM;
  const kappa = Math.atan2(H0.x * H1.z - H0.z * H1.x, H0.x * H1.x + H0.z * H1.z) / Math.max(L, 1e-6), bank = clamp(Math.atan(.0064 * kappa / .0098), -.44, .44);
  plane.position.copy(P).add(V(0, lift, 0)); plane.rotation.order = 'YXZ'; plane.rotation.set(pitch, Math.atan2(-H.x, -H.z), -bank);
  return P;
}
export const HERO = new THREE.MeshStandardMaterial({ color: 0x8fb0e4, roughness: .62 });   // the aircraft on the map: the style's subject blue
export const MAP_SC = .0065, MAP_LIFT = MAP_SC * 3.4 + .004;                              // a ~245 m model: readable at map scale
export function mapWorld(S, o = {}) {
  S.studio({ floor: false, near: .02, far: 120, fog: [40, 70], area: o.area ?? 12, target: o.target ?? [2, 0, -3], key: [-10, 22, 9], soft: 3, keyI: 1.5 });
  nycMap(S.scene); S.post.ao = .06;
  const p = airliner(S.scene, { mat: HERO }); p.scale.setScalar(MAP_SC); p.userData.airborne = true; p.name = 'Flight 1549';
  return p;
}
// the flown part of the route, drawn through the camera up to the aircraft (u0..uAt(t)), with its shadow on the map
export function routeLine(uAt, o = {}) {
  const N = 400, pts = [...Array(N + 1)].map((_, i) => ROUTE.getPointAt(i / N)), lift = o.lift ?? MAP_LIFT;
  return custom((x, t, a, S) => {
    const u = uAt(t), n = Math.round(u * N); if (n < 1) return;
    const draw = (onGround, style) => { x.beginPath(); let pen = false;
      for (let i = Math.round((o.u0 ?? 0) * N); i <= n; i++) { const p = pts[i].clone(); if (onGround) p.y = .002; else p.y += lift; const [X, Y, ok] = S.proj(p); if (!ok) { pen = false; continue; } pen ? x.lineTo(X, Y) : x.moveTo(X, Y); pen = true; }
      style(); x.stroke(); };
    x.lineCap = x.lineJoin = 'round';
    draw(true, () => { x.strokeStyle = 'rgba(40,46,54,.24)'; x.lineWidth = 3; x.setLineDash([8, 9]); });
    x.setLineDash([]); draw(false, () => { x.strokeStyle = C.accent; x.lineWidth = 5; });
  }, { t0: o.t0 ?? 0, t1: o.t1, fin: .01, what: 'route line', text: 'flight path' });
}
// soft area names on the map (projected through the camera), kept clear of the corner cards
const AREAS = [['MANHATTAN', 40.783, -73.968], ['QUEENS', 40.762, -73.90], ['THE BRONX', 40.842, -73.885], ['NEW JERSEY', 40.80, -74.045]];
export const mapLabels = (o = {}) => custom((x, t, a, S) => { x.font = FONT.m(22); x.letterSpacing = '7px'; x.textAlign = 'center'; x.fillStyle = 'rgba(62,68,74,.62)';
  const keep = [[0, 0, 760, 230], [FW - 420, 0, FW, 120], [0, FH - 200, 900, FH], ...(o.keepOut || [])];
  for (const [n, la, lo] of AREAS) { if (o.skip?.includes(n)) continue; const [X, Y, ok] = S.proj(mp(ll(la, lo)));
    if (!ok || X < 180 || X > FW - 180 || Y < 150 || Y > FH - 80 || keep.some(([a1, b1, c1, d1]) => X > a1 - 130 && X < c1 + 130 && Y > b1 - 24 && Y < d1 + 24)) continue; x.fillText(n, X, Y); }
  x.textAlign = 'left'; }, { t0: o.t0 ?? 0, t1: o.t1, what: 'map labels', text: 'area names' });

// ---------- the running clock: narration time mapped onto the real 208 s from the strike to the water ----------
export const clock = (strike, touch, o = {}) => custom((x, t) => {
  const s = Math.round(clamp((t - strike) / (touch - strike)) * 208), mm = String(Math.floor(s / 60)).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
  x.save(); x.fillStyle = 'rgba(246,246,244,.9)'; rr(x, 56, 48, 320, 112, 5); x.fill(); x.restore();
  x.fillStyle = '#2f3438'; x.font = FONT.m(22); x.letterSpacing = '3px'; x.fillText('SINCE BIRD STRIKE', 78, 84);
  x.fillStyle = t >= touch ? C.accent : C.ink; x.font = FONT.m(50, 700); x.letterSpacing = '0px'; x.fillText(`${mm}:${ss}`, 76, 138);
}, { t0: o.t0 ?? 0, t1: o.t1, what: 'clock', text: 'time since the bird strike' });

// ---------- the river at real scale (1 unit = 1 m): the aircraft comes to rest at the origin, heading down-river (+z) ----------
export const HD = V(0, 0, 1);                 // down-river = south
export const rv = (along, east, up = 0) => V(east, up, along);
export function riverWorld(S, o = {}) {
  S.studio({ floor: false, near: o.near ?? 1, far: 9000, fog: [1400, 4200], area: o.area ?? 70, target: [0, 0, 0], key: [-260, 420, 160], soft: 4, keyI: 1.55, shadowFar: 1500 });
  S.sky('#b3c3d1', '#e3e3de', '#d3d9dc'); S.post.ao = .9;
  const w = riverWater(S.scene, { sun: V(-260, 420, 160), size: 9000 }); S.tick(t => w.userData.tick(t));
  // the banks: Manhattan to the east (x > 520), New Jersey to the west (x < -780), each one slab of land 2.2 m above the water
  const land = new THREE.MeshStandardMaterial({ color: 0xe1e0db, roughness: .95 });
  for (const [x0, x1, nm] of [[520, 4520, 'Manhattan'], [-4780, -780, 'New Jersey']]) { const m = mesh(new THREE.BoxGeometry(x1 - x0, 8, 9000), land, [(x0 + x1) / 2, 2.2 - 4, 0], [0, 0, 0], S.scene); m.name = nm; m.userData.ground = true; m.userData.noPick = true; }
  // buildings standing on the banks (seeded, so every render is the same): tall Midtown to the east, low Weehawken to the west
  let sd = 5; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647), M = [];
  for (let z = -2600; z < 2600; z += 34 + r() * 18) for (let x = 560; x < 1500; x += 38 + r() * 26) { const h = 24 + Math.pow(r(), 2.2) * (z > -900 && z < 700 ? 230 : 120), wx = 16 + r() * 14, wz = 16 + r() * 14;
    M.push(new THREE.Matrix4().compose(V(x + wx / 2, 2.2 + h / 2, z), new THREE.Quaternion(), V(wx, h, wz))); }
  for (let z = -2600; z < 2600; z += 40 + r() * 30) for (let x = -1500; x < -820; x += 44 + r() * 30) { const h = 10 + Math.pow(r(), 2) * 55, wx = 16 + r() * 16, wz = 16 + r() * 16;
    M.push(new THREE.Matrix4().compose(V(x + wx / 2, 2.2 + h / 2, z), new THREE.Quaternion(), V(wx, h, wz))); }
  const city = inst(S.scene, [{ geo: new THREE.BoxGeometry(1, 1, 1), mat: MAT.clay2, cast: false }], M)[0]; city.name = 'city blocks'; city.userData.noPick = true;
  // January: broken ice drifting down-river, never where the aircraft is
  if (o.ice !== false) { const F = [];
    for (let i = 0; i < 160; i++) { const z = (hash(i, 1) - .5) * 1400, x = (hash(i, 2) - .5) * 900; if (Math.abs(x) < 60 && z > -340 && z < 90) continue; const sc = .8 + hash(i, 3) * 2.4;
      F.push(new THREE.Matrix4().compose(V(x, .03, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, hash(i, 4) * 6.3, 0)), V(sc * (1 + hash(i, 5)), 1, sc))); }
    const fg = new THREE.CylinderGeometry(1, 1.06, .14, 20), floes = inst(S.scene, [{ geo: fg, mat: new THREE.MeshStandardMaterial({ color: 0xf3f5f5, roughness: .9 }), cast: false }], F)[0];
    floes.name = 'ice floes'; S.tick(t => floes.position.set(0, 0, t * .6)); }
  return w;
}
export const FLOAT = 1.05;                      // fuselage axis above the water: wing roots at the waterline
// The full-size airframe (37.6 m) is bigger than contact.js judges as one prop (14 m): its fuselage and wings count as
// environment and its fin, pylons and nacelles as loose props of their own, so the check would call the airliner's own
// joints "floating" / "through". It rests in the water by construction (FLOAT: the hull below the surface), so it opts out.
export function fullPlane(S) { const p = airliner(S.scene); p.name = 'Flight 1549'; p.userData.noContact = true; return p; }
// The same for the ferry (27.6 m at 1.15x): its decks sit on the hull by construction, the hull below the waterline. Keep it
// axis-aligned (rotation.y = +-PI/2): the coplanar audit compares world bounding boxes, and the two deck rails of a ferry
// turned at an angle have overlapping boxes at the same height although they are 9 m apart.
export function fullFerry(S, name = 'NY Waterway ferry') { const f = ferry(S.scene); f.scale.setScalar(1.15); f.rotation.y = -Math.PI / 2; f.name = name; f.userData.noContact = true; return f; }
export function restOn(p) { p.position.set(0, FLOAT, 0); p.rotation.order = 'YXZ'; p.rotation.set(-.025, Math.PI, .012); }   // nose down-river (+z)
