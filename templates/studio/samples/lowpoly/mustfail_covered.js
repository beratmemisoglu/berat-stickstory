// MUSTFAIL: covered
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot } from '../engine.js';

// ---- mustfail: two callouts drawn on top of each other ----
shot({ t0: 0, set: 'void-teal', captions: false, build(S) {
  S.callout('BEST', { on: [.5, .3], at: .1, color: 'yellow', style: 'pixel' });
  S.callout('FRIENDS', { on: [.52, .31], at: .1, color: 'green', style: 'pixel' });
  S.camera('orbit', { on: [0, .5, 0], speed: 8 });
  return {};
} });
