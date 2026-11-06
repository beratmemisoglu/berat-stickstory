// Backdrops. Each set paints the whole 960x540 frame and returns its ground line (y where figures stand).
import { P, rnd, dot, seg, stroke, fill, shape, box, oval, circ, line, wob, spray, rect } from './paint.js';
import { PROPS } from './props.js';

const sky = c => rect(-10, -10, 980, 560, c);
const groundBand = (y, c, edge = 2) => shape([[-20, -20], [-20, y + 4], [240, y - 4], [480, y + 6], [720, y - 3], [980, y + 3], [980, -20]], c, 3, edge);
const dirt = (c, y) => { for (let i = 0; i < 6; i++) { const x = 60 + i * 160 + rnd() * 60, yy = 20 + rnd() * (y - 50); shape(circ(x, yy, 40 + rnd() * 30, 8 + rnd() * 5, 12), c, 0, 2); } };
const grass = (y, c) => { for (let i = 0; i < 26; i++) { const x = rnd() * 960, yy = 10 + rnd() * (y - 20); stroke([[x, yy], [x + 4, yy + 10], [x + 8, yy]], 2, c); } };
const stars = (n, y0 = 200) => { for (let i = 0; i < n; i++) { const x = rnd() * 960, y = y0 + rnd() * (540 - y0), s = 2 + rnd() * 3; seg([x - s, y], [x + s, y], 2, P.yellow); seg([x, y - s], [x, y + s], 2, P.yellow); } };
const range = (y, c, cap = true) => { shape([[-20, y], [80, y + 150], [180, y + 80], [300, y + 190], [420, y + 60], [520, y + 160], [650, y + 70], [780, y + 200], [900, y + 90], [980, y + 120], [980, y]], c, 3, 1.5); if (cap) for (const [x, h] of [[300, 190], [780, 200]]) shape([[x - 34, y + h - 40], [x, y + h], [x + 36, y + h - 40], [x + 12, y + h - 30], [x - 4, y + h - 46], [x - 18, y + h - 30]], P.white, 2, .5); };

export const SETS = {
  white: () => { sky(P.white); return 60; },
  paper: () => { sky(P.lyellow); for (let i = 0; i < 14; i++) stroke([[0, 40 + i * 36], [960, 40 + i * 36]], 1, '#e0d890'); return 60; },
  field: () => { sky(P.sky); groundBand(150, P.lime); dirt(P.olive, 150); grass(150, P.green); return 110; },
  plains: () => { sky(P.white); groundBand(150, P.lime); dirt(P.lbrown, 150); grass(150, P.green); return 110; },
  desert: () => { sky(P.sky); groundBand(160, P.gold); for (let i = 0; i < 18; i++) { const x = rnd() * 960, y = 10 + rnd() * 130; stroke([[x, y], [x + 22, y + 2]], 2, P.lbrown); } return 110; },
  snow: () => { sky(P.cyan); range(170, P.silver); groundBand(170, P.white); for (const [x, y] of [[80, 120], [600, 60], [300, 30]]) line([[x, y], [x + 120, y + 4]], 2, P.silver); return 110; },
  mountains: () => { sky(P.sky); range(160, P.lblue); groundBand(160, P.lime); grass(160, P.green); return 110; },
  forest: () => { sky(P.sky); groundBand(170, P.lime); for (let i = 0; i < 9; i++) PROPS[i % 3 ? 'tree' : 'pine'].draw({ x: 40 + i * 110 + rnd() * 30, y: 150 + rnd() * 18, s: .8 + rnd() * .3 }); grass(140, P.green); return 100; },
  jungle: () => { sky(P.lgreen); groundBand(160, P.green); for (let i = 0; i < 8; i++) PROPS[i % 2 ? 'palm' : 'tree'].draw({ x: 30 + i * 130, y: 140 + rnd() * 20, s: .9, c: 'green' }); for (let i = 0; i < 6; i++) PROPS.bush.draw({ x: 80 + i * 160, y: 110, s: .9, c: 'green' }); return 90; },
  village: () => { sky(P.sky); groundBand(160, P.lime); dirt(P.lbrown, 150); for (const [x, s] of [[120, .7], [840, .8], [470, .55]]) PROPS.hut.draw({ x, y: 150, s }); return 100; },
  town: () => { sky(P.sky); groundBand(150, P.lgray); for (const [x, c] of [[90, 'lyellow'], [300, 'pink'], [660, 'lyellow'], [880, 'tan']]) PROPS.house.draw({ x, y: 140, s: .9, c }); return 100; },
  city: () => { sky(P.sky); PROPS.city.draw({ x: 480, y: 150, s: 1.6 }); groundBand(150, P.gray, .5); for (let i = 0; i < 8; i++) box(i * 130 + 20, 70, 60, 8, P.white, 0, 0); return 100; },
  sea: () => { sky(P.sky); rect(-10, -10, 980, 230, P.sea); for (let i = 0; i < 12; i++) { const x = rnd() * 960, y = 20 + rnd() * 180; line([[x, y], [x + 18, y + 8], [x + 36, y]], 3, P.cyan); } stroke(wob([[-10, 220], [970, 220]], 2, 30, false), 3, 'black'); return 200; },
  beach: () => { sky(P.sky); rect(-10, 150, 980, 70, P.sea); stroke([[-10, 220], [970, 220]], 3, 'black'); groundBand(150, P.tan); for (let i = 0; i < 4; i++) line([[i * 250 + 40, 180], [i * 250 + 70, 186], [i * 250 + 100, 180]], 3, P.cyan); return 90; },
  underwater: () => { sky(P.deep); rect(-10, 260, 980, 300, P.dblue); rect(-10, 420, 980, 140, P.sea); for (let i = 0; i < 20; i++) { const x = rnd() * 960, y = 120 + rnd() * 400; dot(x, y, 3 + rnd() * 3, P.cyan); } groundBand(90, P.tan); for (let i = 0; i < 5; i++) line([[60 + i * 200, 80], [50 + i * 200, 130], [70 + i * 200, 170]], 6, P.green); return 70; },
  night: () => { sky(P.navy); stars(40, 200); PROPS.moon.draw({ x: 820, y: 460, s: .9, c: 'navy' }); groundBand(150, P.dgreen); return 110; },
  glownight: () => { sky(P.navy); for (const [y, c] of [[150, P.purple], [200, P.maroon], [250, P.dorange], [290, P.orange]]) rect(-10, y, 980, 300 - y + 40 > 0 ? 60 : 0, c); rect(-10, 150, 980, 40, P.gold); stars(25, 360); groundBand(150, P.dgreen); return 110; },
  space: () => { sky('#000010'); stars(70, 0); return 270; },
  sky: () => { sky(P.sky); for (const [x, y, s] of [[160, 420, 1.1], [520, 470, .8], [800, 380, 1.2], [340, 200, .7], [760, 120, .9]]) PROPS.cloud.draw({ x, y, s }); return 0; },
  storm: () => { sky(P.gray); PROPS.raincloud.draw({ x: 200, y: 460, s: 1.4 }); PROPS.raincloud.draw({ x: 720, y: 480, s: 1.6 }); for (let i = 0; i < 60; i++) { const x = rnd() * 980, y = 160 + rnd() * 300; seg([x, y], [x - 8, y - 26], 2, P.blue); } groundBand(150, P.green); return 110; },
  volcanic: () => { sky(P.maroon); range(150, P.dgray, false); groundBand(150, P.dgray); for (let i = 0; i < 4; i++) shape(circ(100 + i * 250, 60 + (i % 2) * 40, 70, 12, 14), P.dorange, 2, 1.5); return 110; },
  cave: () => { sky(P.dgray); shape([[-20, 560], [-20, 140], [120, 260], [80, 420], [200, 560]], P.gray, 3, 3); shape([[980, 560], [980, 160], [840, 280], [880, 440], [760, 560]], P.gray, 3, 3); for (let i = 0; i < 7; i++) shape([[100 + i * 120, 545], [120 + i * 120, 470 - (i % 3) * 20], [140 + i * 120, 545]], P.gray, 2, .5); groundBand(140, P.brown); return 100; },
  indoor: () => { sky(P.lyellow); box(-10, 120, 980, 14, P.lbrown, 3, 0); groundBand(120, P.tan, .5); for (let i = 1; i < 8; i++) stroke([[i * 120, 0], [i * 120 + 30, 120]], 2, P.lbrown); box(640, 300, 180, 130, P.cyan, 4, .5); stroke([[730, 300], [730, 430]], 4); stroke([[640, 365], [820, 365]], 4); return 90; },
  lab: () => { sky(P.white); box(-10, 120, 980, 10, P.silver, 3, 0); groundBand(120, P.lgray, .5); box(600, 260, 260, 10, P.gray, 3, 0); for (let i = 0; i < 5; i++) PROPS.bottle?.draw?.({}); for (let i = 0; i < 5; i++) { const x = 620 + i * 50; shape([[x, 270], [x + 24, 270], [x + 20, 320], [x + 4, 320]], [P.lime, P.pink, P.cyan, P.yellow, P.lblue][i], 3, .3); } return 90; },
  arena: () => { sky(P.sky); for (let r = 0; r < 4; r++) box(-10, 160 + r * 40, 980, 40, [P.tan, P.lbrown, P.tan, P.lbrown][r], 3, .5); groundBand(160, P.gold); return 110; },
};
export const SET_NAMES = Object.keys(SETS);
