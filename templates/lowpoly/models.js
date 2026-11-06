// This project's own reusable pieces (the cast, recurring props). Scenes import from here and from ../engine.js.
// The engine preloads every library id written in this file too, so keep ids as plain strings.
import { THREE, OUTFITS } from './engine.js';

// The recurring protagonist ("you" in every hypothetical) = the project's MAIN CHARACTER, picked in the app (Look >
// Characters, settings.characters.main): never write a body / skin / hair here, the user changes it there.
export const HERO = { role: 'main' };
// More of the cast = roles the user can recast in the app (dealer, doctor, friend, partner, boss, stranger, expert, clerk, police):
export const DEALER = { role: 'dealer', name: 'the dealer' };

// A helper of your own goes here, e.g. a prop built from library models:
// export function deskWithLaptop(S, x, z) { const d = S.prop('prop.kf.desk', { at: [x, z] }); ... return d; }
export { THREE, OUTFITS };
