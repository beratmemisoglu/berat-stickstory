// II. China & Korea: woodblocks, the Diamond Sutra, Bi Sheng's clay type, Korea's metal type
import { panel, shot, drawn, rng } from '../engine.js';

export const P2 = panel(1, { bg: 'paper2', title: 'China & Korea' });

// ---- 3: China printed first ----
// frame: x -1 +- 6.4, y 1.2 +- 3.6
shot({ at: 6.48 - .1, panel: P2, x: -1.0, y: .9, zoom: 1.25 });
P2.cutout('woodblock', { x: -5.4, y: 1.7, h: 3.4, rot: -2, at: 6.48 - .5 });
P2.cutout('sutra', { x: 1.2, y: 2.2, h: 2.5, rot: 1, at: 6.82 });
P2.label('The Diamond Sutra · oldest dated printed book', { x: 1.2, y: .55, size: .27, style: 'strip', at: 6.82 + .45 });
P2.stamp('868', { x: 4.2, y: 3.55, size: .75, at: 7.82 });

// ---- 4: Bi Sheng's clay type, Korea's metal type ----
shot({ at: 9.94 - .3, panel: P2, zoom: 1 });
const tile = (fill, edge, seed) => (x, k, t, W, H) => {
  const r = rng(seed); x.fillStyle = edge; x.fillRect(W * .04, H * .08, W * .92, H * .9); x.fillStyle = fill; x.fillRect(0, 0, W * .92, H * .9);
  x.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 4; i++) x.fillRect(W * (.2 + r() * .4), H * (.2 + r() * .4), W * (.08 + r() * .25), H * .07);
};
for (let i = 0; i < 18; i++) {
  const col = i % 6, row = Math.floor(i / 6);
  drawn(P2, { name: 'clay type', x: -6.9 + col * .66, y: -1.35 - row * .66, w: .56, h: .56, rot: (i * 37 % 7) - 3, at: 12.46 + i * .035, in: 'pop', dur: .22,
    draw: tile(['#b5462f', '#a53d28', '#c05537'][i % 3], '#6d2415', i + 1), sfx: i % 4 ? false : 'pop', shadow: false });
}
P2.stamp('c.1040', { x: -2.3, y: -1.9, size: .6, at: 9.94 + .1, backing: true });
P2.label('Bi Sheng · movable type in baked clay', { x: -7.2, y: -3.6, size: .3, style: 'black', anchor: 'left', at: 10.8 });
P2.cutout('jikji', { x: 4.9, y: -2.2, h: 2.7, rot: 2, at: 13.34 });
P2.stamp('1377', { x: 1.4, y: -2.9, size: .72, at: 14.22 });
P2.label('Jikji · oldest surviving metal-type book', { x: 7.3, y: -4.0, size: .24, style: 'strip', anchor: 'right', at: 14.22 + .35 });
