// Stick stories PLACES (owned by the set agent): dressed sets with named spots, moods and camera hints.
// Contract (ENGINE.md): PLACES = { name: { desc, opts, moods, build(S, o) -> { spots, bounds, ... } } }, build(S, name, o), placeNames().
//
//   const P = S.place('kitchen', { mood: 'night' })   -> { spots, bounds, rim, rimDir, bg, shadows, cam, doors, group, family, mood }
//   S.camera('static', P.cam.wide)                     the references' whole-room wide (feet at 83 %, floor line ~73 %, door ~490 px)
//   P.cam.full / P.cam.<set-specific>                  wider establishing view; mediums on the set's action (table, desk, bed ...)
//   a.walkTo('door') / a.sit('chair1') ...             spots: { x, y, z, kind: 'stand'|'seat'|'bed'|'door'|'counter'|'table', facing, seatY, topY, back }
//   P.doors.door.open(t, dur) / .close(t)              swing a door leaf (opens onto the dark / lit next room)
//
// Every set is built from lib/sets/kit.js (vertex-coloured merged painters, lights baked into the vertices: a dense set is
// ~20-60 meshes), studied in experiments/stickstory-style/analysis/sets/NOTES.md. Families: 'room' (iq500 / sister: muted
// frontal box rooms, ceiling band, plank floor, side walls, no contact shadows) and 'stage' (timeloop: flat side-on rooms,
// one strong hue, near-black furniture, no ceiling, dust motes). Exteriors return shadows: true (soft ellipses under feet).
// Moods recolour the same set: day | dusk | evening | night | candle | alarm | violet | blue | memory | dim.
import * as HOME from './sets/home.js';
import * as WORK from './sets/work.js';
import * as STAGES from './sets/stages.js';
import * as OUT from './sets/outside.js';
import * as SPECIAL from './sets/special.js';
import { MOODS, MOOD_NAMES, ROOM, grade } from './sets/kit.js';

export const PLACES = {};
for (const lib of [HOME, WORK, STAGES, OUT, SPECIAL]) for (const [k, v] of Object.entries(lib)) if (v && typeof v.build === 'function' && v.desc) PLACES[k] = v;

// friendly names a builder might type
export const ALIAS = {
  'dining room': 'kitchen', dining: 'kitchen', 'living room': 'livingroom', living: 'livingroom', lounge: 'livingroom', 'home office': 'homeoffice',
  'office floor': 'office', openoffice: 'office', 'call center': 'callcenter', scam: 'callcenter', hideout: 'workshop',
  laboratory: 'lab', hall: 'hallway', entrance: 'hallway', school: 'classroom', 'school corridor': 'corridor', hospitalCorridor: 'corridor', 'hospital room': 'hospital',
  shop: 'cafe', store: 'cafe', 'coffee shop': 'cafe', car: 'carInterior', 'car interior': 'carInterior', 'bus stop': 'busstop', roof: 'rooftop', city: 'skyline',
  'parking garage': 'garage', parking: 'garage', 'school yard': 'schoolyard', 'police station': 'police',
  // a sports ground at eye level is the 'field' (a real horizon); 'stadium' is the high-angle painted backdrop (lessons 02-handshake)
  'sports field': 'field', pitch: 'field', 'football pitch': 'field', 'football field': 'field', 'soccer field': 'field', 'soccer pitch': 'field',
  'town field': 'field', townfield: 'field', 'playing field': 'field', 'sports ground': 'field', 'running track': 'field',
  interview: 'interrogation', prison: 'cell', 'tv studio': 'studio', talkshow: 'studio', stagehall: 'theatre', 'nap room': 'kindergarten', table: 'tabletop', macro: 'tabletop', plain: 'backdrop',
};
const OPT_FROM_ALIAS = { shop: { kind: 'shop' }, store: { kind: 'shop' }, hospitalCorridor: { kind: 'hospital' }, 'school corridor': { kind: 'school' } };

export function build(S, name, o = {}) {
  let key = PLACES[name] ? name : ALIAS[name] && PLACES[ALIAS[name]] ? ALIAS[name] : null;
  if (!key) { console.warn(`unknown place "${name}": known ${placeNames().join(', ')}`); key = 'stage'; }
  if (o.mood && !MOODS[o.mood]) console.warn(`place ${name}: unknown mood "${o.mood}" (${MOOD_NAMES.join(' | ')})`);
  return PLACES[key].build(S, { ...(OPT_FROM_ALIAS[name] || {}), ...o });
}
export const placeNames = () => Object.keys(PLACES);
export const moods = () => MOOD_NAMES;
export { ROOM };

// scene helpers (engine.js turns each into S.<name>(...))
export const S_HELPERS = {
  /** S.backdrop('#hex' | { like: 'kitchen', mood }): a plain close-up background */
  backdrop: (S, c, o = {}) => S.place('backdrop', typeof c === 'string' ? { ...o, color: c } : (c || {})),
  /** S.tabletop('wood' | 'tiles' | 'desk' | 'sheet' | 'cloth', { mood }): a top-down surface; frame it with r.cam.top */
  tabletop: (S, surface = 'wood', o = {}) => S.place('tabletop', { ...o, surface }),
  /** S.tone('#hex', mood?): a colour graded by the place's mood (or the named one) - for a builder's OWN cards in a set
   *  (models.js), so a night place stays night: rrect(13, 7.5, 0, S.tone('#e7ebf2')). '!#hex' = as is (a lit sign, a lamp).
   *  (review 01-pause S9: a hand-built hospital front kept its day white at midnight) */
  tone: (S, hex, mood) => {
    if (typeof hex !== 'string' || hex[0] === '!') return typeof hex === 'string' ? hex.slice(1) : hex;
    const M = mood ? MOODS[mood] : (S.moodGrade ?? MOODS[S.moodName] ?? MOODS.day);
    return grade(hex, M);
  },
};
