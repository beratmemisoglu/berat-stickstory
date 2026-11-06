// MUSTFAIL: offframe
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, FW, FH } from '../engine.js';

// ---- mustfail: a number callout pinned at the right edge of the frame (clamp off): half of it is cut ----
shot({ t0: 0, set: 'void-teal', captions: false, build(S) {
  S.callout('1,000,000', { on: () => [FW - 40, FH * .35], at: .1, clamp: false, color: 'yellow' });
  S.camera('orbit', { on: [0, .5, 0], speed: 8 });
  return {};
} });
