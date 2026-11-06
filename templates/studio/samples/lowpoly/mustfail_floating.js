// MUSTFAIL: floating
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, preload } from '../engine.js';
import { SET_NEEDS } from '../lib/scan.js';

await preload([...SET_NEEDS.farm, 'prop.surv.bucket']);

// ---- mustfail: a library bucket hangs 45 cm above the grass (resting on nothing, not marked airborne) ----
shot({ t0: 0, set: 'farm', captions: false, build(S) {
  const pail = S.prop('prop.surv.bucket', { at: [0, .45, -2], height: .4, name: 'floating bucket' });
  S.camera('push', { on: pail, fill: .4 });
  return { pail };
} });
