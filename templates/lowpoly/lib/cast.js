// The character roster: ready-made people the user picks in the app (project settings.characters = { main: '<id>',
// cast: { <role>: '<id>' } }). S.person({ character: 'alex' }) / S.person({ role: 'main' }) / S.person({ role: 'dealer' })
// resolve here, so changing the main character or a role in the app changes every scene without editing them.
// Keep ids + names in sync with src/shared/lowpolyCast.ts (the picker) - thumbnails: library/characters/roster/<id>.png.
// Extension point: a library 'character' entry tagged 'roster' with a `roster: { ...person options }` field and a
// `thumb` file joins the roster automatically (rosterEntries()).
import { SETTINGS } from './core.js';
import { ENTRIES } from './assets.js';

export const ROSTER = [
  { id: 'alex', name: 'Alex', o: { body: 'm', build: 'slim', skin: 'light', outfit: 'everyman', hair: 'buzzed', hairColor: '#3a2a1e' } },
  { id: 'maya', name: 'Maya', o: { body: 'f', build: 'normal', skin: 'tan', outfit: { top: '#c9a227', sleeves: 'short', bottom: '#2f4468', shoes: '#f0f0f0' }, hair: 'long', hairColor: '#2a1a12' } },
  { id: 'marcus', name: 'Marcus', o: { body: 'm', build: 'normal', skin: 'brown', outfit: 'hoodie', hair: 'buzzed', hairColor: '#141010', beard: true } },
  { id: 'jen', name: 'Jen', o: { body: 'f', build: 'slim', skin: 'pale', outfit: { top: '#b03a3a', sleeves: 'long', bottom: '#232323', shoes: '#262626' }, hair: 'buns', hairColor: '#8a4a22' } },
  { id: 'tom', name: 'Tom', o: { body: 'm', build: 'slim', skin: 'pale', outfit: 'business', hair: 'simpleparted', hairColor: '#b08a4a', glasses: true } },
  { id: 'rosa', name: 'Rosa', o: { body: 'f', build: 'normal', skin: 'dark', outfit: { top: '#5a7a3a', sleeves: 'short', bottom: '#4a3b2a', shoes: '#efefef' }, hair: 'buzzedfemale', hairColor: '#141010' } },
  { id: 'frank', name: 'Frank', o: { body: 'm', build: 'heavy', skin: 'medium', outfit: 'sweater', hair: 'simpleparted', hairColor: '#8c8c8c', beard: true } },
  { id: 'lena', name: 'Lena', o: { body: 'f', build: 'slim', skin: 'light', outfit: 'business', hair: 'long', hairColor: '#d9b46a' } },
];
// roles a scene may ask for, and who plays them when the user hasn't chosen (the outfit of the role is kept: a dealer
// stays in the dealer's vest, only the person changes)
export const ROLE_DEFAULTS = { main: 'alex', friend: 'marcus', partner: 'maya', boss: 'tom', dealer: 'frank', doctor: 'lena', stranger: 'jen', expert: 'rosa', clerk: 'jen', police: 'marcus' };
export const ROLE_OUTFITS = { dealer: 'dealer', doctor: 'doctor', police: 'police', clerk: 'business', boss: 'suit' };

/** library characters tagged 'roster' (the user's own later): { id, name, o } */
export function rosterEntries(entries = ENTRIES) {
  const EXTRA = entries.filter(e => e.kind === 'character' && (e.tags || []).includes('roster') && e.roster).map(e => ({ id: e.id, name: e.name, o: { body: e.roster.body || e.id, ...e.roster } }));
  return [...ROSTER, ...EXTRA];
}
const byId = id => rosterEntries().find(c => c.id === id);
/** who plays a role in this project: settings.characters.cast[role] (main: settings.characters.main), else the default */
export function castId(role) {
  const ch = SETTINGS.characters || {};
  const pick = role === 'main' ? ch.main : ch.cast?.[role];
  return pick && byId(pick) ? pick : ROLE_DEFAULTS[role] || null;
}
/** person options for a roster character / role, under the scene's own options (the scene's options win, except the body
 *  parts that make the person: a role's chosen character replaces any body / skin / hair the scene wrote) */
export function resolveCast(o = {}) {
  let id = o.character, role = o.role;
  if (!id && role) id = castId(role);
  if (id === 'main') id = castId('main');
  const c = id ? byId(id) : null;
  if (!c) return o;
  const { character, ...rest } = o; void character;
  const outfit = rest.outfit ?? (role && ROLE_OUTFITS[role]) ?? c.o.outfit;
  // a role picked in the app overrides the body the scene wrote (so old scenes follow the picker too)
  const body = role ? { body: c.o.body, skin: c.o.skin, hair: c.o.hair, hairColor: c.o.hairColor, beard: c.o.beard, build: c.o.build } : {};
  return { ...c.o, ...rest, ...body, outfit, castId: c.id, name: rest.name ?? (role === 'main' ? 'You' : c.name) };
}
/** the cast this project uses now (hostState info: the picker's preview + Claude's check) */
export function castInfo() { const roles = Object.keys(ROLE_DEFAULTS); return Object.fromEntries(roles.map(r => [r, castId(r)])); }
