// This project's own reusable pieces (recurring characters, props, places). Scenes import from here and from ../engine.js.
import { THREE } from './engine.js';

// The recurring protagonist ("you" in every hypothetical) = the project's MAIN CHARACTER, picked in the app
// (settings.characters.main): S.char('main'). Others are cast ids from lib/cast.js: S.char('juno'), S.char('dex', { outfit: 'astronaut' }).
export const HERO = 'main';

// A helper of your own goes here, e.g. a dressed corner reused by several shots:
// export function kitchen(S) { S.room({ wall: '#7d8f8a', floorKind: 'tiles' }); ... }
export { THREE };
