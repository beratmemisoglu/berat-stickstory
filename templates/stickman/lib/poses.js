// Pose library. Angles in degrees; every bone hangs down by default and +angle swings it toward +x
// (side view: forward; front view: screen right). L = near side (side view) / screen-left limb (front view).
// plant: feet (default) | seat (pelvis sits on a prop at seat height) | lie (body on the ground) | float (no planting)
// A pose is only listed here after it passed checkPose() + the visual pose sheet (see poses.png / VERIFY.md).
const restArms = { upperL: -10, foreL: 8, upperR: 10, foreR: -8 };
const legsF = { thighL: -7, footL: -90, thighR: 7, footR: 90 };
const legsS = { thighL: 3, footL: 90, thighR: -3, footR: 90 };
const sw = a => { const o = {}; for (const [k, v] of Object.entries(a)) o[k.endsWith('L') ? k.slice(0, -1) + 'R' : k.endsWith('R') ? k.slice(0, -1) + 'L' : k] = v; return o; }; // swap sides
const mir = a => { const o = {}; for (const [k, v] of Object.entries(a)) o[k.endsWith('L') ? k.slice(0, -1) + 'R' : k.endsWith('R') ? k.slice(0, -1) + 'L' : k] = -v; return o; }; // mirror a front pose
const F = (a, extra = {}) => ({ view: 'front', a: { ...legsF, ...restArms, ...a }, ...extra });
const S = (a, extra = {}) => ({ view: 'side', a: { ...legsS, upperL: 8, foreL: 12, upperR: -6, foreR: 10, ...a }, ...extra });

const walkA = { spine: -6, thighL: 28, shinL: -6, footL: 68, thighR: -18, shinR: -28, footR: 136, upperL: -24, foreL: 18, upperR: 26, foreR: 30 };
const runA = { spine: -16, neck: 8, thighL: 62, shinL: -50, footL: 78, thighR: -30, shinR: -78, footR: 160, upperL: -50, foreL: 95, upperR: 55, foreR: 70 };
const kneel = { spine: -4, thighL: 86, shinL: -86, footL: 90, thighR: -4, shinR: -86, footR: 0 };

export const POSES = {
  // ---- front view ----
  stand: F({}),
  talk: F({ upperR: 32, foreR: 58 }),                       // one hand out, explaining
  talk2: F({ upperL: -32, foreL: -58, upperR: 32, foreR: 58 }), // both hands out
  shrug: F({ upperL: -45, foreL: -75, upperR: 45, foreR: 75 }),
  present: F({ upperL: -60, foreL: -40, upperR: 60, foreR: 40 }),
  pointR: F({ upperR: 90, foreR: 0 }),
  pointL: F({ upperL: -90, foreL: 0 }),
  pointUp: F({ upperR: 120, foreR: 55 }),
  wave: F({ upperR: 110, foreR: 50 }),
  cheer: F({ upperL: -125, foreL: -20, upperR: 125, foreR: 20, thighL: -12, thighR: 12 }),
  scared: F({ upperL: -125, foreL: -40, upperR: 125, foreR: 40, thighL: -14, shinL: 6, thighR: 14, shinR: -6 }),
  hips: F({ upperL: -50, foreL: 99, upperR: 50, foreR: -99, thighL: -10, thighR: 10 }),
  think: F({ upperL: -75, foreL: -155, upperR: 5, foreR: -95 }, { touch: ['head'] }),
  facepalm: F({ upperL: -110, foreL: -124 }, { touch: ['head'] }),
  crossarms: F({ upperL: -15, foreL: 110, upperR: 15, foreR: -110 }),
  pray: F({ upperL: -30, foreL: 167, upperR: 30, foreR: -167 }),
  fight: F({ upperL: -40, foreL: -161, upperR: 40, foreR: 161, thighL: -14, thighR: 14 }),
  holdup: F({ upperL: -128, foreL: -36, upperR: 128, foreR: 36 }),  // lifting something overhead
  shiver: F({ upperL: -20, foreL: 112, upperR: 20, foreR: -112, thighL: 8, shinL: -14, thighR: -8, shinR: 14 }),
  sit: F({ thighL: -26, shinL: 26, thighR: 26, shinR: -26, upperL: -14, foreL: 30, upperR: 14, foreR: -30 }, { len: { thighL: .35, thighR: .35 }, plant: 'seat' }),
  crosslegged: F({ thighL: -118, shinL: 168, footL: 0, thighR: 118, shinR: -168, footR: 0, upperL: -30, foreL: 100, upperR: 30, foreR: -100 }, { plant: 'feet' }),
  dance: F({ upperL: -130, foreL: -30, upperR: 60, foreR: 80, thighL: -25, shinL: 30, thighR: 10 }),
  // ---- side view (faces +x; dir=l mirrors) ----
  sstand: S({}),
  stalk: S({ upperL: 40, foreL: 60 }),
  walk: S(walkA), walk2: S(sw(walkA)),
  run: S(runA), run2: S(sw(runA)),
  spoint: S({ upperL: 92, foreL: 0, neck: 4 }),
  offer: S({ spine: -8, thighL: 20, shinL: -8, footL: 78, thighR: -10, shinR: -6, footR: 106, upperL: 78, foreL: 12, upperR: 4, foreR: 10 }),
  carry: S({ spine: -4, ...walkA, upperL: 20, foreL: 90, upperR: 14, foreR: 96 }),
  push: S({ spine: -28, neck: 18, thighL: 34, shinL: -14, footL: 70, thighR: -38, shinR: -4, footR: 110, upperL: 100, foreL: 6, upperR: 94, foreR: 10 }),
  pull: S({ spine: 22, neck: -10, thighL: 30, shinL: 0, footL: 70, thighR: -10, shinR: -24, footR: 120, upperL: 66, foreL: 6, upperR: 60, foreR: 10 }),
  throw: S({ spine: 8, thighL: 30, shinL: -6, footL: 66, thighR: -24, shinR: -10, footR: 120, upperL: -140, foreL: 20, upperR: 60, foreR: 30 }),
  dig: S({ spine: -32, neck: 14, thighL: 18, footL: 72, thighR: -14, footR: 104, upperL: 70, foreL: 20, upperR: 52, foreR: 36 }),
  kneel: S({ ...kneel }),
  crouch: S({ ...kneel, spine: -18, neck: 10, upperL: 72, foreL: 28, upperR: 62, foreR: 38 }),   // behind a gun / looking closely
  kneelpray: S({ ...kneel, upperL: 40, foreL: 112, upperR: 34, foreR: 116 }),
  sitchair: S({ thighL: 90, shinL: -90, footL: 90, thighR: 86, shinR: -86, footR: 90, upperL: 28, foreL: 50, upperR: 22, foreR: 56 }, { plant: 'seat' }),
  sitground: S({ thighL: 140, shinL: -160, footL: 110, thighR: 132, shinR: -150, footR: 108, upperL: 60, foreL: 40, upperR: 52, foreR: 46 }),
  lie: S({ upperL: 6, foreL: 0, upperR: -4, foreR: 0 }, { rot: 90, plant: 'lie' }),
  fall: S({ thighL: 55, shinL: -30, footL: 90, thighR: 15, shinR: -25, footR: 90, upperL: 112, foreL: 30, upperR: 96, foreR: 40, neck: -10 }, { rot: 28 }),
  jump: S({ thighL: 70, shinL: -110, footL: 100, thighR: 50, shinR: -100, footR: 100, upperL: 120, foreL: 24, upperR: 104, foreR: 30 }, { plant: 'float' }),
  bow: S({ spine: -62, neck: -10, upperL: 62, foreL: 0, upperR: 56, foreR: 4 }),
  sneak: S({ spine: -22, neck: 12, thighL: 40, shinL: -40, footL: 90, thighR: -16, shinR: -40, footR: 140, upperL: 50, foreL: 70, upperR: 30, foreR: 80 }),
  swave: S({ upperL: 128, foreL: 14 }),
  sscared: S({ spine: 14, neck: -6, upperL: 116, foreL: 30, upperR: 100, foreR: 40, thighL: 18, footL: 80, thighR: -16, footR: 100 }),
  ride: S({ thighL: 34, shinL: -22, footL: 78, thighR: 28, shinR: -18, footR: 80, upperL: 34, foreL: 44, upperR: 26, foreR: 50 }, { plant: 'seat' }),
};
// convenience mirrors for front poses that point/hold with one side
POSES.talkL = { ...POSES.talk, a: { ...POSES.talk.a, ...mir({ upperR: 32, foreR: 58 }), upperR: 10, foreR: -8 } };
POSES.waveL = { ...POSES.wave, a: { ...POSES.wave.a, ...mir({ upperR: 110, foreR: 50 }), upperR: 10, foreR: -8 } };
export const POSE_NAMES = Object.keys(POSES);
