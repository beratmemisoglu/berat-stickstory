// Stick stories animation tables: walks, grips, poses and gestures, with the timings measured on the reference videos
// (experiments/stickstory-style/analysis/motion, hands, characters NOTES.md). Frames are at 24 fps. Angles are degrees in
// the "facing-right" space of the Figure contract: an arm / leg angle is measured from hanging straight down, + = toward
// the facing direction (forward / up). Arm angles here are WORLD angles (anim.js adds the torso lean when the rig's arms
// are children of the torso). Lengths: H = the figure's height, D = its head diameter.

// ---------------------------------------------------------------------------------------------------------------------
// WALKS. frames = frames per STEP (half a cycle); stride = distance between two footprints (H); bob = hip drop at contact
// (H); lift = swing-foot height (H); arms = forward / back swing (deg); elbow = bend (deg, + more when forward);
// lean = torso lean (deg); nod = head nod (-1..1, - = down); accel / decel = frames to reach / leave cruise speed;
// dip = the stop dip after the feet come together (H, 2 f down + 3 f up).
// Measured (motion NOTES 1.1-1.4 + BUILD IMPLICATIONS): brisk 5 f/step, 0.064 H/f, bob 3.5 % H, arms +35/-23, foot
// lift 0.07 H, 6 f start ramp, 4 f stop (iq500 s39); normal 8.5-9 f/step (8.7 sister s212), 0.030 H/f, ankle gap 0.28 H,
// bob 4.4 % H, arms +-12, lean 5, swing knee 45, lift 0.08 H, 7 f ease-out stop; medium 7.5 f/step, 5 f ramp + 5 f stop
// (iq500 s25); slow 10 f/step (iq500 s62, s54); kid 5.8 f/step (timeloop s128); adult run 3.5 f/step, lean 15-20, elbows
// 90 (sister s161); kid run 4.2 f/step, bob 25-30 % d (timeloop s169). Last step ~60 % long, feet end ~0.15 H apart;
// stop settle = a 3.5 % H dip (2 f down, 3 f up, iq500 s206) or a 3-frame rise (iq500 s39).
export const WALKS = {
  normal:  { frames: 8.7, stride: .27, bob: .044, lift: .05, armF: 12, armB: 12, elbow: 10, elbowF: 8, lean: 5, nod: 0, accel: 6, decel: 7, dip: .03, desc: 'everyday walk (sister s212, the street pairs): 8.7 f a step, arms +-12' },
  medium:  { frames: 7.5, stride: .29, bob: .04, lift: .075, armF: 20, armB: 16, elbow: 10, elbowF: 12, lean: 4, nod: 0, accel: 5, decel: 5, dip: .03, desc: 'a bit quicker (iq500 s25): 7.5 f a step' },
  brisk:   { frames: 5, stride: .32, bob: .035, lift: .05, armF: 35, armB: 23, elbow: 10, elbowF: 20, lean: 3, nod: 0, accel: 6, decel: 4, dip: 0, desc: 'quick purposeful walk (iq500 s39): 5 f a step, arms +35/-23' },
  slow:    { frames: 10, stride: .25, bob: .04, lift: .06, armF: 8, armB: 8, elbow: 8, elbowF: 6, lean: 8, nod: -.2, accel: 7, decel: 7, dip: .02, desc: 'slow walk, head a little down (iq500 s62, s54): 10 f a step' },
  tired:   { frames: 8.7, stride: .26, bob: .044, lift: .07, armF: 10, armB: 12, elbow: 6, elbowF: 6, lean: 9, nod: -.3, accel: 7, decel: 7, dip: .015, desc: 'tired / heavy walk, head down (sister s212)' },
  sad:     { frames: 10, stride: .22, bob: .03, lift: .05, armF: 6, armB: 6, elbow: 6, elbowF: 4, lean: 11, nod: -.45, accel: 8, decel: 8, dip: 0, desc: 'sad shuffle, head down' },
  sneak:   { frames: 9, stride: .26, bob: .018, lift: .09, crouch: .06, armF: 12, armB: 10, elbow: 70, elbowF: 10, lean: 16, nod: .05, accel: 6, decel: 6, dip: 0, desc: 'tiptoe sneak, knees bent, arms up (not in the references)' },
  kid:     { frames: 5.8, stride: .3, bob: .05, lift: .085, armF: 20, armB: 20, elbow: 14, elbowF: 14, lean: 3, nod: 0, accel: 5, decel: 4, dip: .03, desc: 'child walk (timeloop s128): 5.8 f a step' },
  elderly: { frames: 10, stride: .22, bob: .02, lift: .045, armF: 8, armB: 6, elbow: 16, elbowF: 6, lean: 10, nod: -.15, accel: 8, decel: 8, dip: 0, desc: 'slow elderly walk, bent forward (not in the references: the old man walks at the normal tempo)' },
  jog:     { frames: 4.5, stride: .45, bob: .04, lift: .12, armF: 35, armB: 35, elbow: 85, elbowF: 10, lean: 10, nod: 0, accel: 5, decel: 5, dip: .03, run: true, desc: 'jog' },
  run:     { frames: 3.5, stride: .58, bob: .025, lift: .17, armF: 45, armB: 50, elbow: 90, elbowF: 10, lean: 17, nod: 0, accel: 5, decel: 5, dip: .03, run: true, desc: 'adult run (sister s161): 3.5 f a step, lean 15-20, elbows 90 pumping' },
  kidRun:  { frames: 4.2, stride: .52, bob: .06, lift: .18, armF: 45, armB: 45, elbow: 90, elbowF: 10, lean: 12, nod: 0, accel: 4, decel: 4, dip: .03, run: true, desc: 'child run (timeloop s169, s144): 4.2 f a step, very bouncy' },
};

// ---------------------------------------------------------------------------------------------------------------------
// GRIPS (hands NOTES section 1.2 + BUILD IMPLICATIONS B). The hand (nub centre) target, in D, from an anchor of the body
// ('head' centre, 'chest', 'hip', 'shoulder'), + x = toward the facing side, + y = up. tilt = the prop's world tilt in
// degrees (+ = its top leans back toward the face); both = two hands (far hand target too); front = the prop draws over
// the hand (phone shown to the camera); hand = the hand shape; look / nod = the eyes / head while holding; follow = the
// prop turns with the forearm.
export const GRIPS = {
  'phone-look': { anchor: 'chest', at: [.58, .1], tilt: 15, hand: 'mitten', look: [.5, -.7], nod: -.25, desc: 'looking at a phone held at chest height, elbow down (iq500 f3940)' },
  'phone-ear':  { anchor: 'head', at: [-.22, -.6], tilt: 22, hand: 'grip', bend: 1, desc: 'phone at the ear: elbow down in front of the chest, the hand at the jaw, the phone up along the cheek (iq500 f10350)' },
  'phone-show': { anchor: 'head', at: [.85, -.55], tilt: 0, front: true, hand: 'mitten', desc: 'phone held up, screen to the camera (iq500 f220)' },
  'phone-text': { anchor: 'chest', at: [.62, -.1], tilt: 35, hand: 'mitten', both: [-.05, 0], look: [.5, -.8], nod: -.4, desc: 'texting with both hands, looking down' },
  phone:        { alias: 'phone-look' },
  mug:          { anchor: 'chest', at: [.55, -.32], tilt: 0, hand: 'mitten', desc: 'mug held at the chest (iq500 f6775)' },
  cup:          { alias: 'mug' },
  sip:          { anchor: 'head', at: [.36, -.38], tilt: 28, hand: 'mitten', desc: 'mug at the mouth (iq500 f372)' },
  glass:        { anchor: 'shoulder', at: [.55, .05], tilt: 0, hand: 'mitten', desc: 'glass / flute, forearm vertical, hand at shoulder height (timeloop f10450)' },
  book:         { anchor: 'head', at: [.62, -.45], tilt: 0, hand: 'mitten', both: [.0, 0], front: false, look: [.4, -.4], nod: -.15, desc: 'book read at the face, both hands at the bottom corners (iq500 f6070)' },
  sheet:        { anchor: 'chest', at: [.62, .05], tilt: 0, hand: 'mitten', both: [-.05, 0], desc: 'paper / drawing shown at the chest, both hands at the bottom corners (iq500 f6503)' },
  box:          { anchor: 'chest', at: [.62, -.35], tilt: 0, hand: 'mitten', both: [-.1, 0], desc: 'box carried in both arms at the belly' },
  gift:         { anchor: 'hip', at: [.25, -.2], tilt: 0, hand: 'mitten', desc: 'gift box at the hip, arm down (iq500 f7740)' },
  bag:          { anchor: 'shoulder', at: [.12, -2.0], tilt: 0, hand: 'mitten', hang: true, desc: 'bag / briefcase, arm straight down (iq500 f2655)' },
  briefcase:    { alias: 'bag' },
  jar:          { anchor: 'chest', at: [.75, -.35], tilt: 0, hand: 'mitten', desc: 'small jar standing on the hand, forearm forward (iq500 f1013)' },
  marker:       { anchor: 'shoulder', at: [.85, .55], tilt: -20, hand: 'grip', desc: 'marker on a board, upper arm raised forward (sister f12775)' },
  pen:          { anchor: 'chest', at: [.7, -.45], tilt: -30, hand: 'grip', desc: 'pen / pencil writing on a desk' },
  tool:         { anchor: 'chest', at: [.8, -.55], tilt: -90, follow: true, hand: 'fist', desc: 'tool / torch held forward, elbow 90 at the waist (sister f4230)' },
  gun:          { alias: 'tool' },
  rifle:        { anchor: 'chest', at: [.55, -.25], tilt: -55, hand: 'fist', both: [.45, .3], desc: 'long thing held diagonally in both hands (sister f6257)' },
  hang:         { anchor: 'shoulder', at: [.1, -2.0], tilt: 0, hand: 'nub', hang: true, desc: 'arm hanging, the prop dangles' },
  food:         { anchor: 'chest', at: [.6, -.15], tilt: 0, hand: 'mitten', desc: 'food / small thing held at the chest' },
  ball:         { alias: 'food' },
  sign:         { anchor: 'head', at: [.3, 1.3], tilt: 0, hand: 'fist', both: [-.1, 0], front: false, desc: 'protest sign held up overhead in both hands (timeloop s100)' },
};
export const gripOf = name => { let g = GRIPS[name]; for (let i = 0; g?.alias && i < 4; i++) g = GRIPS[g.alias]; return g || GRIPS.mug; };
// which grip a prop name gets by default
export const DEFAULT_GRIP = { phone: 'phone-look', smartphone: 'phone-look', mug: 'mug', cup: 'mug', coffee: 'mug', tea: 'mug', glass: 'glass', flute: 'glass', wine: 'glass', book: 'book', notebook: 'sheet', paper: 'sheet', sheet: 'sheet', letter: 'sheet', drawing: 'sheet', photo: 'sheet', box: 'box', parcel: 'box', package: 'box', gift: 'gift', present: 'gift', bag: 'bag', briefcase: 'bag', suitcase: 'bag', handbag: 'bag', jar: 'jar', can: 'jar', bottle: 'glass', marker: 'marker', pen: 'pen', pencil: 'pen', tool: 'tool', wrench: 'tool', hammer: 'tool', torch: 'tool', flashlight: 'tool', gun: 'tool', remote: 'phone-look', card: 'phone-look', ticket: 'phone-look', sign: 'sign', placard: 'sign', apple: 'food', sandwich: 'food', burger: 'food', ball: 'ball', key: 'food', keys: 'food', money: 'food', cash: 'food', wallet: 'food' };

// ---------------------------------------------------------------------------------------------------------------------
// POSES: held arm / body configurations. Each arm is { sh, el } (degrees, world, facing-right) or { to: [anchor, x, y],
// bend } (an IK target in D from an anchor). side = the 3/4 and profile version (turn >= .5), front = the front version
// (turn < .5; armL is given already mirrored to the screen). lean (deg), head { tilt (deg), nod, turn }, hip (H, + = up),
// hand shapes. seated: meant for a sitting body.
const A = (sh, el) => ({ sh, el });
export const POSES = {
  stand:       { desc: 'arms hanging relaxed', side: { R: A(3, 8), L: A(-3, 8) }, front: { R: A(6, 6), L: A(-6, -6) } },
  armsCrossed: { desc: 'arms crossed over the chest (iq500 s138)', side: { R: { to: ['chest', .3, .02] }, L: { to: ['chest', .22, .12] } }, front: { R: A(22, -118), L: A(-22, 118) }, hand: 'nub' },
  handsOnHips: { desc: 'hands on the hips, elbows out', side: { R: { to: ['hip', .12, .22], bend: -1 }, L: { to: ['hip', -.12, .22], bend: -1 } }, front: { R: { to: ['hip', .42, .18], bend: -1 }, L: { to: ['hip', -.42, .18], bend: 1 } } },
  thinking:    { desc: 'hand on the chin, the other arm across the belly', side: { R: { to: ['head', .32, -.48] }, L: { to: ['chest', .45, -.45] } }, front: { R: { to: ['head', .1, -.5] }, L: { to: ['chest', .15, -.45], bend: 1 } }, head: { tilt: 6 }, look: [.4, .5] },
  handsOnHead: { desc: 'both hands on the head, panic / disbelief (iq500 s138)', side: { R: { to: ['head', .1, .32] }, L: { to: ['head', -.05, .34] } }, front: { R: { to: ['head', .42, .22], bend: -1 }, L: { to: ['head', -.42, .22], bend: 1 } } },
  cheer:       { desc: 'both arms up in a V (timeloop s189, iq500 s206)', side: { R: A(162, 6), L: A(150, 10) }, front: { R: A(150, 0), L: A(-150, 0) }, hand: 'fist' },
  armsUp:      { desc: 'hands up, surrender', side: { R: A(120, 60), L: A(110, 64) }, front: { R: A(95, 85), L: A(-95, -85) }, hand: 'open' },
  shrug:       { desc: 'forearms out, palms up, head tilted', side: { R: A(18, 78), L: A(8, 84) }, front: { R: A(32, 70), L: A(-32, -70) }, head: { tilt: 8 }, hand: 'open' },
  cower:       { desc: 'arms up in front of the face, shrinking back', side: { R: { to: ['head', .42, -.05] }, L: { to: ['head', .36, .1] } }, front: { R: { to: ['head', .2, -.05], bend: -1 }, L: { to: ['head', -.2, .05], bend: 1 } }, lean: -8, hip: -.03, head: { nod: -.3 } },
  facepalm:    { desc: 'hand over the face, head down', side: { R: { to: ['head', .3, .02] }, L: A(-3, 8) }, front: { R: { to: ['head', .05, 0] }, L: A(-6, -6) }, head: { nod: -.4 } },
  point:       { desc: 'near arm straight forward at shoulder height, pointing', side: { R: A(88, 4), L: A(-3, 8) }, front: { R: A(84, 4), L: A(-6, -6) }, hand: 'point' },
  present:     { desc: 'open hand presenting something to the side', side: { R: A(55, 18), L: A(-3, 8) }, front: { R: A(55, 15), L: A(-6, -6) }, hand: 'open' },
  explain:     { desc: 'talking with one hand, palm up', side: { R: A(22, 72), L: A(-3, 8) }, front: { R: A(25, 70), L: A(-6, -6) }, hand: 'open' },
  handUp:      { desc: 'talking with the hand raised to the shoulder, palm out, elbow down (timeloop s108 f4912)', side: { R: A(16, 128), L: A(-3, 8) }, front: { R: A(20, 140), L: A(-6, -6) }, hand: 'open' },
  fidget:      { desc: 'hands together in front of the belly, nervous', side: { R: { to: ['hip', .38, .28] }, L: { to: ['hip', .32, .3] } }, front: { R: { to: ['hip', .08, .25], bend: 1 }, L: { to: ['hip', -.08, .25], bend: -1 } }, head: { nod: -.15 } },
  handsBack:   { desc: 'hands behind the back', side: { R: A(-22, 40), L: A(-18, 44) }, front: { R: A(-4, 0), L: A(4, 0) } },
  pockets:     { desc: 'hands in the pockets', side: { R: { to: ['hip', .18, -.02], bend: -1 }, L: { to: ['hip', .1, -.02], bend: -1 } }, front: { R: { to: ['hip', .3, -.05], bend: -1 }, L: { to: ['hip', -.3, -.05], bend: 1 } } },
  wave:        { desc: 'near arm raised, forearm up, open hand (iq500 s115)', side: { R: A(140, 40), L: A(-3, 8) }, front: { R: A(145, 35), L: A(-6, -6) }, hand: 'open' },
  fist:        { desc: 'one fist raised (timeloop s53)', side: { R: A(172, 4), L: { to: ['hip', .35, .3] } }, front: { R: A(170, 2), L: { to: ['hip', .05, .25], bend: -1 } }, hand: 'fist' },
  bow:         { desc: 'bowing', side: { R: A(5, 10), L: A(0, 10) }, front: { R: A(5, 5), L: A(-5, -5) }, lean: 35, head: { nod: -.3 } },
  stretch:     { desc: 'arms stretched up overhead', side: { R: A(175, 10), L: A(170, 14) }, front: { R: A(165, 20), L: A(-165, -20) }, lean: -4, hand: 'open' },
  // seated
  upright:     { seated: true, desc: 'sitting upright, hands on the thighs (iq500 s228)', side: { R: { to: ['knee', -.3, .18] }, L: { to: ['knee', -.35, .2] } }, front: { R: { to: ['hip', .3, .2], bend: -1 }, L: { to: ['hip', -.3, .2], bend: 1 } } },
  slumped:     { seated: true, desc: 'slumped in the seat, arms hanging', side: { R: A(12, 20), L: A(6, 20) }, front: { R: A(6, 6), L: A(-6, -6) }, lean: -7, head: { nod: -.3 } },
  leanTable:   { seated: true, desc: 'leaning on the table, forearms on the table top', side: { R: { to: ['table', .9, 0] }, L: { to: ['table', .7, 0] } }, front: { R: { to: ['table', .4, 0], bend: -1 }, L: { to: ['table', -.4, 0], bend: 1 } }, lean: 16 },
  headInHands: { seated: true, desc: 'elbows on the table, head in the hands', side: { R: { to: ['head', .28, -.18] }, L: { to: ['head', .2, -.1] } }, front: { R: { to: ['head', .4, -.15], bend: 1 }, L: { to: ['head', -.4, -.15], bend: -1 } }, lean: 26, head: { nod: -.5 } },
  typing:      { seated: true, desc: 'typing / working at a desk: torso forward, forearms level to the desk top (iq500 s37)', side: { R: { to: ['table', 1.15, .12], bend: 1 }, L: { to: ['table', 1.0, .12], bend: 1 } }, front: { R: { to: ['table', .25, .1], bend: 1 }, L: { to: ['table', -.25, .1], bend: -1 } }, lean: 10, look: [.3, -.3] },
  eating:      { seated: true, desc: 'eating at a table (near hand goes to the mouth, see a.eat)', side: { R: { to: ['table', .95, .1] }, L: { to: ['table', .8, .05] } }, front: { R: { to: ['table', .3, .05], bend: -1 }, L: { to: ['table', -.3, .05], bend: 1 } }, lean: 8 },
  phoneLap:    { seated: true, desc: 'seated, phone held low in both hands, looking down (iq500 s217)', side: { R: { to: ['knee', -.1, .5] }, L: { to: ['knee', -.18, .5] } }, front: { R: { to: ['hip', .08, .45], bend: 1 }, L: { to: ['hip', -.08, .45], bend: -1 } }, head: { nod: -.4 }, look: [.4, -.8] },
};

// ---------------------------------------------------------------------------------------------------------------------
// GESTURES: a pose reached and left with the measured timing (frames). in / out = frames to reach / leave it, ease /
// easeOut = how, hold = default frames held, loop = a repeating motion on top (period frames), pre = an anticipation pose
// first (frames). Timings: cheer 6 f in (no anticipation) / 3-6 f out (timeloop s189, iq500 s206); point 5 f in
// accelerating with a hard stop, 5 f out (iq500 s122); hands on head 2 f snap (iq500 s138); arms cross 7-8 f; wave every
// 2-3 f, ~4.7 f a full swing, 4 cycles (iq500 s115); clap every 3 f (timeloop s4); laugh 3 f lean then a 6 f bob
// (iq500 s35, s57); arms drop 2-4 f from a raised pose (hands NOTES E).
export const GESTURES = {
  wave:        { pose: 'wave', in: 5, out: 5, hold: 24, ease: 'outQuad', loop: { period: 4.7, el: 17 }, desc: 'wave hello / goodbye: arm up, forearm swings every 2-3 frames' },
  point:       { pose: 'point', in: 5, out: 5, hold: 28, ease: 'inQuad', easeOut: 'outQuad', creep: true, desc: 'point at something (target): accelerating 5 f, hard stop, slow creep, 5 f down' },
  reach:       { pose: 'point', in: 4, out: 4, hold: 24, ease: 'outQuad', easeOut: 'inQuad', creep: true, hand: 'open', desc: 'reach toward someone / something, stopping 0.3 D short' },
  shrug:       { pose: 'shrug', in: 5, out: 6, hold: 16, ease: 'outQuad', desc: 'shrug' },
  crossArms:   { pose: 'armsCrossed', in: 8, out: 6, hold: 48, ease: 'inOutQuad', desc: 'cross the arms' },
  thinking:    { pose: 'thinking', in: 6, out: 6, hold: 40, ease: 'inOutQuad', desc: 'hand to the chin' },
  chin:        { alias: 'thinking' },
  facepalm:    { pose: 'facepalm', in: 4, out: 6, hold: 24, ease: 'outQuad', desc: 'facepalm' },
  handsOnHead: { pose: 'handsOnHead', in: 2, out: 7, hold: 18, ease: 'lin', easeOut: 'inOutQuad', desc: 'hands snap onto the head (2 f, no in-betweens)' },
  fistPump:    { pose: 'fist', in: 3, out: 5, hold: 14, ease: 'outQuad', pre: { pose: { side: { R: A(10, 120) }, front: { R: A(10, 120) } }, frames: 3 }, desc: 'fist pump: fist down 3 f, punch up 3 f' },
  cheer:       { pose: 'cheer', in: 6, out: 5, hold: 28, ease: 'inOutQuad', easeOut: 'outQuad', desc: 'both arms up in a V: 6 f, no anticipation' },
  celebrate:   { pose: 'cheer', in: 6, out: 5, hold: 36, ease: 'inOutQuad', bounce: { period: 6, amp: .022 }, desc: 'arms up and bouncing' },
  clap:        { pose: 'fidget', in: 4, out: 4, hold: 30, ease: 'outQuad', clap: { period: 3 }, desc: 'clap at chest height, one clap every 3 frames' },
  cower:       { pose: 'cower', in: 4, out: 8, hold: 30, ease: 'outQuad', desc: 'cower behind the arms' },
  handsOnHips: { pose: 'handsOnHips', in: 6, out: 6, hold: 40, ease: 'inOutQuad', desc: 'hands on the hips' },
  fidget:      { pose: 'fidget', in: 5, out: 5, hold: 48, ease: 'inOutQuad', loop: { period: 12, rub: .05 }, desc: 'nervous fidget, hands rubbing' },
  talk:        { pose: 'explain', in: 5, out: 5, hold: 20, ease: 'outQuad', loop: { period: 14, el: 7 }, desc: 'talking hand gesture with small beats' },
  explain:     { alias: 'talk' },
  present:     { pose: 'present', in: 6, out: 6, hold: 30, ease: 'outQuad', desc: 'open-hand presenting gesture' },
  handUp:      { pose: 'handUp', in: 4, out: 5, hold: 30, ease: 'outQuad', desc: 'hand raised to the shoulder, palm out, while talking (timeloop s108)' },
  armsUp:      { pose: 'armsUp', in: 3, out: 6, hold: 30, ease: 'outQuad', desc: 'hands up (surrender)' },
  stretch:     { pose: 'stretch', in: 10, out: 8, hold: 20, ease: 'inOutSine', desc: 'stretch' },
  bow:         { pose: 'bow', in: 8, out: 8, hold: 10, ease: 'inOutSine', desc: 'bow' },
  laugh:       { pose: 'fidget', in: 3, out: 6, hold: 36, ease: 'outQuad', laugh: { period: 6, lean: 34, amp: .22 }, desc: 'laugh: snap forward 3 f into a 30-40 deg bend, then a 6-frame bob (iq500 s35, s57)' },
  headScratch: { pose: { side: { R: { to: ['head', -.05, .42] }, L: A(-3, 8) }, front: { R: { to: ['head', .35, .3], bend: -1 }, L: A(-6, -6) } }, in: 6, out: 6, hold: 30, ease: 'inOutQuad', loop: { period: 5, rub: .04 }, desc: 'scratch the head' },
  fist:        { pose: 'fist', in: 5, out: 5, hold: 40, ease: 'outQuad', desc: 'one fist raised and held' },
};
export const gestureOf = name => { let g = GESTURES[name]; for (let i = 0; g?.alias && i < 4; i++) g = GESTURES[g.alias]; return g || null; };

// ---------------------------------------------------------------------------------------------------------------------
// Measured curves (fractions of the move per frame)
// stand up from a chair, iq500 s228 f11975-11985: head rise per frame 2.3 8.3 13.4 6.9 2.7 0.8 0.2 1.0 0.6 0.2 px
export const STANDUP_Y = [0, .063, .291, .659, .849, .923, .929, .956, .973, .995, 1];
export const STANDUP_LEAN = [5, 21, 15, 6, 2, 0, 0, 0, 0, 0, 0];
// mug to the mouth, iq500 s11 f355-364: 10 15 22 31 26 17 11 7 3 px
export const SIP_UP = [0, .07, .176, .331, .549, .732, .852, .93, .979, 1];
// the hip of an insert hand entering, hands NOTES 2.6: .53 .30 .13 .04
export const ENTER_OUT = [0, .53, .83, .96, 1];
// face: blink 3 closed frames (19 of 24), 4 in 5 of 24; one blink every 3.5-4 s +- 1 s; lip-sync peaks every 5-8 f
export const BLINK = { every: 3.75, jitter: 1, closed: 3, closed4: .2, minFirst: .9 };
export const TALK = { syll: [5, 8], open: [2, 3], close: 3, lead: 1.5, tail: 2, gapKeep: 8, thin: .08 };
// phone talk: the head rises 2.4 % D over 5 f, falls over 6 f, holds 10 f (period ~21.5 f, iq500 s167)
export const PHONE_NOD = { up: 5, down: 6, hold: 10.5, amp: .024 };
// idles (motion NOTES 4): frozen + blinks (the most common, the default for extras and listeners); slow sway 60-80 f,
// +-1-2 % H, < 1 px/f, x and y in phase when seated (~80 f); breathing bob 36-40 f, p-p 0.1 d (emotional close-ups)
export const IDLE = { swayPeriod: [60, 80], swayAmp: .012, seatPeriod: [72, 88], seatAmp: .01, breathPeriod: [36, 40], breathAmp: .05, autoSway: .35 };
// one-shot body moves (frames, ease): crouch drop 5 f quadOut (head -0.15 H); slow kneel 30 f cubicInOut (-0.35 H);
// slide down to the floor 22 f quadInOut; bend over 14 f quadInOut (hips 70); hug wrap 4-5 f, settle lean 16 f (~0.1 H)
export const MOVES = { crouch: [5, 'outQuad'], kneelSlow: [30, 'inOutCubic'], kneel: [8, 'inOutQuad'], floor: [22, 'inOutQuad'], bend: [14, 'inOutQuad'], sitDown: [12, 'inOutQuad'], lieDown: [18, 'inOutSine'], getUp: [16, 'inOutQuad'], hugWrap: 5, hugSettle: 16 };
