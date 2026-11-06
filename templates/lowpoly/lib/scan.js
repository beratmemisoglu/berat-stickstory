// Which library assets a project's scene code uses. Pure (no DOM, no three.js): the engine runs it in the page to
// preload everything before the first frame, and the Suite runs the same file in node to credit the assets in
// DESCRIPTION.txt. Keep it dependency-free.

// assets the built-in sets (lib/sets.js) and kit pieces (lib/kit.js) load from the library
export const SET_NEEDS = {
  casino: ['prop.arcade.gambling_machine', 'tex.carpet_a', 'tex.felt', 'prop.kf.potted_plant', 'prop.kkr.chair_a'],
  office: ['prop.kf.desk', 'prop.kf.chair_desk', 'prop.kf.computer_screen', 'prop.kf.computer_keyboard', 'prop.kf.bookcase_closed', 'prop.kf.potted_plant', 'prop.kf.lamp_round_floor', 'tex.wood_floor', 'tex.carpet_b'],
  bedroom: ['prop.kf.bed_double', 'prop.kf.cabinet_bed_drawer', 'prop.kf.lamp_round_table', 'prop.kf.rug_rectangle', 'prop.kf.bookcase_open', 'tex.wood_floor'],
  living: ['prop.kf.lounge_sofa', 'prop.kf.cabinet_television', 'prop.kf.rug_rectangle', 'prop.kf.lamp_round_floor', 'prop.kf.potted_plant', 'prop.kf.bookcase_closed_wide', 'tex.wood_floor'],
  kitchen: ['prop.kf.kitchen_fridge', 'prop.kf.kitchen_cabinet', 'prop.kf.kitchen_stove', 'prop.kf.kitchen_sink', 'prop.kf.kitchen_cabinet_upper', 'tex.tiles'],
  diner: ['prop.kkr.table_round_a_small', 'prop.kkr.chair_b', 'prop.kkr.chair_stool', 'prop.kf.kitchen_bar', 'prop.kkr.ketchup', 'prop.kkr.mustard', 'prop.kkr.plate', 'prop.food.burger', 'prop.food.fries', 'tex.tiles'],
  lab: ['prop.station.table', 'prop.station.computer_screen', 'prop.station.container_tall', 'prop.station.computer_system', 'prop.station.chair', 'tex.tiles'],
  hospital: ['prop.pp.bed_single_ianc', 'prop.station.computer', 'prop.kf.bathroom_cabinet', 'tex.tiles'],
  classroom: ['prop.kf.desk', 'prop.kf.chair', 'prop.kf.bookcase_closed', 'tex.wood_floor'],
  courtroom: ['prop.pp.gavel_6yki', 'prop.kf.chair_desk', 'tex.wood', 'tex.wood_floor'],
  street: ['set.commercial.building_a', 'set.commercial.building_d', 'set.commercial.building_h', 'set.commercial.building_skyscraper_a', 'set.commercial.building_skyscraper_c', 'prop.kkcity.streetlight', 'prop.kkcity.firehydrant', 'prop.kkcity.bench', 'prop.kkcity.car_sedan', 'prop.kkcity.car_taxi', 'tex.asphalt', 'tex.paving', 'tex.sky_day'],
  suburb: ['set.suburban.building_type_a', 'set.suburban.building_type_c', 'set.suburban.building_type_e', 'set.suburban.tree_large', 'set.suburban.fence', 'tex.grass', 'tex.asphalt', 'tex.paving', 'tex.sky_day'],
  park: ['prop.nature.tree_oak', 'prop.nature.tree_default', 'prop.nature.tree_detailed', 'prop.nature.plant_bush', 'prop.kkcity.bench', 'prop.nature.flower_yellow_a', 'prop.nature.rock_small_a', 'tex.grass', 'tex.paving', 'tex.sky_day'],
  stadium: ['tex.grass', 'tex.sky_night', 'tex.concrete'],
  desert: ['prop.nature.cactus_tall', 'prop.nature.cactus_short', 'prop.nature.rock_large_a', 'tex.dirt', 'tex.sky_day'],
  farm: ['prop.nature.fence_simple', 'prop.nature.tree_default', 'prop.nature.crop_pumpkin', 'tex.grass', 'tex.dirt', 'tex.sky_day'],
  space: [], void: [], studio: [],
};
const ALL_SET_NEEDS = [...new Set([...Object.values(SET_NEEDS).flat(), 'tex.sky_sunset', 'tex.sky_overcast', 'tex.sky_night', 'tex.sky_day'])];
// the clips every person needs whatever the scene says (idle, walk, gestures)
export const PERSON_NEEDS = ['anim.ual1', 'anim.gestures', 'char.base_m_grey', 'char.base_f_grey', 'char.eyebrows_regular', 'char.eyebrows_female', 'char.hair_simpleparted', 'char.hair_long', 'char.hair_buzzed', 'char.hair_buns', 'char.hair_beard', 'char.hair_buzzedfemale'];
// person({ body }) short names
export const BODY_ALIAS = { m: 'char.base_m_grey', man: 'char.base_m_grey', male: 'char.base_m_grey', f: 'char.base_f_grey', woman: 'char.base_f_grey', female: 'char.base_f_grey', mannequin: 'char.mannequin_m', mannequin_m: 'char.mannequin_m', mannequin_f: 'char.mannequin_f' };
const KIND_PREFIX = { character: 'char.', animation: 'anim.', texture: 'tex.', prop: 'prop.', set: 'set.', vehicle: 'vehicle.', animal: 'animal.' };
const CALL_KIND = { person: 'character', character: 'character', body: 'character', hair: 'character', animal: 'animal', prop: 'prop', item: 'prop', vehicle: 'vehicle', building: 'set', texture: 'texture', tex: 'texture', model: null, asset: null };
const norm = s => String(s || '').toLowerCase();

/** search({ query, kind, tags, limit }, entries) -> entries ranked by match (same rule as tools/lib.mjs) */
export function searchEntries({ query = '', tags = [], kind, limit = 50 } = {}, entries = []) {
  const words = norm(query).split(/[\s,_]+/).filter(Boolean), out = [];
  for (const e of entries) {
    if (kind && e.kind !== kind) continue;
    if (tags.length && !tags.every(t => (e.tags || []).map(norm).includes(norm(t)))) continue;
    if (e.remote && !e.file) continue;                                 // not on disk: can't be loaded
    const hay = [e.id, e.name, ...(e.tags || []), ...(e.animations || []).map(a => a.name || a)].map(norm).join(' ');
    let score = 0;
    for (const w of words) { if ((e.tags || []).map(norm).includes(w)) score += 3; else if (norm(e.name).includes(w)) score += 2; else if (hay.includes(w)) score += 1; else { score = -1; break; } }
    if (score >= 0 && words.length > 1) { const tg = (e.tags || []).map(norm), ph = [words.join('-'), words.join(' '), words.join('_')]; if (ph.some(p => tg.includes(p) || norm(e.name) === p)) score += 6; }   // the whole phrase as a tag / name
    if (score >= 0) out.push({ score: score - (/style-(cartoon|blocky)/.test(hay) ? .5 : 0), e });   // the analysed look prefers the realistic low-poly sets
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.e);
}
/** An entry by exact id, or by the id without its kind prefix ('base_m_grey' -> 'char.base_m_grey', 'kf.desk' -> 'prop.kf.desk'). */
export function resolveExact(ref, byId, kind) {
  if (!ref) return null;
  if (byId.has(ref)) return byId.get(ref);
  const kinds = kind ? [kind] : Object.keys(KIND_PREFIX);
  for (const k of kinds) { const e = byId.get(KIND_PREFIX[k] + ref); if (e) return e; }
  // animals and a few props carry a pack prefix (animal.q.cow, animal.mon.alien, prop.pp.gavel_6yki)
  for (const k of kinds) for (const p of ['q.', 'mon.', 'pp.', 'k.', 'kf.', 'qt.']) { const e = byId.get(KIND_PREFIX[k] + p + ref); if (e) return e; }
  return null;
}
/** An entry by id, else by name, else the best search hit. */
export function resolveRef(ref, entries, byId, kind) {
  const ex = resolveExact(ref, byId, kind); if (ex) return ex;
  const byName = entries.filter(e => (!kind || e.kind === kind) && norm(e.name) === norm(ref) && e.file);
  if (byName.length) return byName[0];
  return searchEntries({ query: ref, kind, limit: 1 }, entries)[0] || null;
}
/** Every library id the given sources (scene files, models.js) use: string literals that are ids, the first argument of
 *  the asset calls (searched like the engine does), clip names (their animation file), set names (their props). */
export function scanIds(sources, entries) {
  const byId = new Map(entries.map(e => [e.id, e])), ids = new Set();
  const clipFile = new Map(); for (const e of [...entries].sort((a, b) => /_rm$/.test(a.id) - /_rm$/.test(b.id))) if (e.kind === 'animation') for (const a of e.animations || []) if (!clipFile.has(a.name || a)) clipFile.set(a.name || a, e.id);   // in-place clips before root-motion ones
  const add = e => { if (e && e.file) ids.add(e.id); };
  for (const src of sources) {
    const text = String(src || '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of text.matchAll(/(['"`])([\w .\-/]{2,60}?)\1/g)) {
      const lit = m[2].trim();
      add(resolveExact(lit, byId));
      if (clipFile.has(lit)) ids.add(clipFile.get(lit));
      if (SET_NEEDS[lit] || /^void-|^set$/.test(lit)) for (const id of ALL_SET_NEEDS) add(byId.get(id));   // (a set may reuse another set's pieces: load them all, ~5 MB)
    }
    for (const m of text.matchAll(/\b(person|character|body|hair|animal|prop|item|vehicle|building|texture|tex|model|asset)\(\s*(['"`])([^'"`]{2,60})\2/g)) add(resolveRef(m[3], entries, byId, CALL_KIND[m[1]] || undefined));
    for (const m of text.matchAll(/\b(body|hair|beard|brows|eyebrows)\s*:\s*(['"`])([\w.\-]{2,60})\2/g)) add(byId.get(BODY_ALIAS[m[3]]) || resolveExact(m[3], byId, 'character') || resolveExact('hair_' + m[3], byId, 'character') || resolveExact('eyebrows_' + m[3], byId, 'character'));
    if (/\b(person|character|crowd)\s*\(/.test(text)) for (const id of PERSON_NEEDS) add(byId.get(id));
  }
  return [...ids].sort();
}
/** The description text for these ids: required CC-BY credit lines first, then thanks for CC0 authors. */
export function creditsText(ids, entries) {
  const use = entries.filter(e => ids.includes(e.id)), req = new Set(), thanks = new Set();
  for (const e of use) { if (/^CC-BY/.test(e.licence)) req.add(e.credit_text || `${e.name} by ${e.author} (${e.licence}) ${e.source_url}`); else if (e.licence !== 'OWN-CC0' && e.author) thanks.add(e.author); }
  const lines = [...req];
  if (thanks.size) lines.push(`Free CC0 3D assets by ${[...thanks].join(', ')}.`);
  return lines.join('\n');
}
