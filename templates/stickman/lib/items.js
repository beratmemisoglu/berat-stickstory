// Things a stickman holds (hold= / hold2=) or wears (wear=, back=). Drawn in the hand's frame: grip at (0,0).
// mode 'upright' keeps the item vertical; 'along' continues the forearm direction (+y = away from the elbow).
import { P, dot, seg, stroke, fill, shape, oval, box, circ, tube, line, text, spray } from './paint.js';
const up = draw => ({ mode: 'upright', draw }), along = draw => ({ mode: 'along', draw });

export const ITEMS = {
  spear: up(() => { tube([[0, -60], [0, 90]], 4, P.brown, 2); shape([[-7, 88], [7, 88], [0, 116]], P.silver, 2, .2); }),
  staff: up(() => { tube([[0, -70], [0, 80], [6, 92]], 5, P.lbrown, 2); }),
  torch: up(() => { tube([[0, -18], [0, 40]], 6, P.brown, 2); shape([[-12, 40], [12, 40], [8, 62], [2, 54], [0, 74], [-4, 56], [-10, 64]], P.orange, 2, .5); shape([[-5, 42], [5, 42], [0, 58]], P.yellow, 0, .2); }),
  sign: up(() => { tube([[0, -10], [0, 70]], 4, P.brown, 2); box(-40, 70, 80, 46, P.white, 3, .6); }),
  flag: up(() => { tube([[0, -20], [0, 110]], 3, P.brown, 2); shape([[2, 108], [62, 98], [2, 72]], P.red, 3, .6); }),
  book: up(() => { box(-22, -6, 44, 30, P.red, 3, .5); stroke([[0, -6], [0, 24]], 2, 'black'); }),
  scroll: up(() => { box(-16, -26, 32, 52, P.lyellow, 3, .5); oval(0, 27, 18, 5, P.tan, 2); oval(0, -27, 18, 5, P.tan, 2); for (const y of [14, 4, -6, -16]) stroke([[-9, y], [9, y]], 2, P.gray); }),
  cup: up(() => { shape([[-9, -6], [9, -6], [11, 16], [-11, 16]], P.white, 3, .3); }),
  bottle: up(() => { shape([[-8, -14], [8, -14], [8, 12], [3, 18], [3, 28], [-3, 28], [-3, 18], [-8, 12]], P.lime, 3, .3); }),
  apple: up(() => { dot(0, 6, 12, 'black'); dot(0, 6, 9.5, P.red); seg([0, 16], [3, 24], 3, P.brown); }),
  coin: up(() => { dot(0, 8, 12, 'black'); dot(0, 8, 9.5, P.gold); seg([0, 3], [0, 13], 2, P.olive); }),
  bag: up(() => { shape(circ(0, -22, 20, 22, 18).concat([]), P.tan, 3, .6); stroke([[-6, -1], [6, -1]], 3, P.brown); text('$', 0, -24, { size: 18, color: 'olive', outline: null }); }),
  lantern: up(() => { stroke([[0, 0], [0, -10]], 3); box(-11, -38, 22, 28, P.lyellow, 3, .3); dot(0, -24, 5, P.orange); }),
  skull: up(() => { dot(0, 14, 16, 'black'); dot(0, 14, 13.5, P.white); dot(-5, 15, 4, 'black'); dot(5, 15, 4, 'black'); box(-6, -2, 12, 6, P.white, 2, 0); }),
  gem: up(() => shape([[-12, 8], [12, 8], [16, 16], [0, 34], [-16, 16]], P.aqua, 3, .2)),
  phone: up(() => { box(-9, -8, 18, 32, P.dgray, 3, .2); box(-6, -3, 12, 22, P.cyan, 0, 0); }),
  fish: up(() => { shape([[-24, 0], [-6, 10], [14, 6], [24, 0], [14, -6], [-6, -10]], P.lblue, 3, .5); shape([[-24, 0], [-34, 10], [-34, -10]], P.lblue, 3, .3); dot(14, 2, 2.5, 'black'); }),
  bone: up(() => { tube([[0, -14], [0, 22]], 6, P.white, 2); }),
  sword: along(() => { box(-12, 4, 24, 5, P.gold, 2, 0); shape([[-4, 9], [4, 9], [4, 80], [0, 90], [-4, 80]], P.silver, 2.5, 0); }),
  shovel: along(() => { tube([[0, -30], [0, 70]], 4, P.lbrown, 2); shape([[-13, 70], [13, 70], [11, 96], [0, 104], [-11, 96]], P.gray, 3, .3); }),
  pickaxe: along(() => { tube([[0, -20], [0, 60]], 4, P.lbrown, 2); shape([[-34, 54], [0, 66], [34, 54], [0, 60]], P.gray, 3, .2); }),
  magnifier: along(() => { tube([[0, -4], [0, 22]], 5, P.brown, 2); dot(0, 40, 18, 'black'); dot(0, 40, 14, P.cyan); }),
  stick: along(() => tube([[0, -10], [0, 70]], 4, P.brown, 2)),
  rope: along(() => line([[0, 0], [30, -20], [70, -30]], 4, P.lbrown, .5)),
  map: up(() => { shape([[-30, -6], [30, -2], [28, 36], [-28, 32]], P.lyellow, 3, .8); stroke([[-14, 4], [-2, 14], [10, 8], [18, 22]], 2, P.red); }),
  shield: up(() => { shape([[-26, 30], [26, 30], [26, 0], [0, -34], [-26, 0]], P.red, 3, .3); stroke([[0, 26], [0, -26]], 5, P.gold); }),
  // worn
  backpack: () => box(-26, 22, 18, 34, P.green, 3, .4),
  wear_robe: (side, c) => shape(side ? [[-12, 64], [12, 64], [26, -40], [-22, -40]] : [[-14, 66], [14, 66], [34, -40], [-34, -40]], c || P.lbrown, 3, .8),
  wear_dress: (side, c) => shape(side ? [[-8, 40], [10, 40], [24, -26], [-20, -26]] : [[-10, 40], [10, 40], [34, -28], [-34, -28]], c || P.red, 3, .8),
  wear_vest: (side, c) => shape(side ? [[-10, 66], [10, 66], [10, 14], [-10, 14]] : [[-16, 66], [16, 66], [14, 14], [-14, 14]], c || P.green, 3, .5),
  wear_suit: side => { shape(side ? [[-12, 68], [12, 68], [12, 4], [-12, 4]] : [[-20, 68], [20, 68], [18, 4], [-18, 4]], P.dgray, 3, .3); if (!side) shape([[-4, 66], [4, 66], [3, 30], [0, 24], [-3, 30]], P.red, 0, 0); },
  wear_cape: (side, c) => shape(side ? [[-4, 68], [-16, 64], [-40, -30], [-8, -24]] : [[-26, 66], [26, 66], [36, -36], [-36, -36]], c || P.red, 3, .6),
};
export const ITEM_NAMES = Object.keys(ITEMS).filter(k => !k.startsWith('wear_') && k !== 'backpack');
export const WEAR_NAMES = Object.keys(ITEMS).filter(k => k.startsWith('wear_')).map(k => k.slice(5));
