# Characters: the rig, the trait catalog, character.js

Every flat project has a MAIN character in `character.js` (the app writes it when the project is made: the user's
default, a random new one, or one designed in a character lab). `character(p, { scale })` draws them. They star in the
whole video: never redesign them in a scene, never swap them for Mo.

## One rig, many looks
All characters share the rig in models.js: hips at the origin, legs, a torso, a head group with the face, two arms,
the same joints, `POSES`, `drive()` (drag, follow-through, breathing), `expr()` (eyes open/happy/shut/half, mouths
smile/flat/o/grin/frown, brows -1..1) and `walkPose()`. What changes is the LOOK (data) and optional PARTS (drawing).

```js
character(p)                                   // the project's main character (character.js)
character(p, { look: randomLook(17) })         // a background person (deterministic per seed)
character(p, { look: { hair: { style: 'afro', color: '#2e1f17' }, top: { style: 'hoodie', color: '#ff5a5f' } } })
character(p, { as: 'mo' })                     // Mo, the style's original character
character(p, { scale, flip, x, y })            // as before; flip faces the other way
placeOnGround(ch, x, scale)                    // feet on GY (uses the character's own leg length)
```
Side characters must look clearly different from the main one (another hair style AND another top colour).

## The look (every field optional; missing ones come from Mo)
| Field | Values |
|---|---|
| `skin` | hex (shade derived warmer + darker: `warmShade`) - `TRAITS.skin` lists the tested range |
| `hair.style` | `bob crop curls afro long ponytail spiky buzz bald bun braids` |
| `hair.color` / `hair.hi` | hex / highlight (derived) ; `hair.bun: true` adds Mo's top bun to a bob |
| `top.style` | `sweater tee hoodie collar jacket stripes` (tee and stripes have short sleeves) |
| `top.color` / `top.dark` / `top.accent` | hex / shade side (derived) / stripes, jacket inner shirt, tee badge, hair ties |
| `pants`, `shoes` | hex |
| `extras` | any of `glasses glasses-square freckles beard mustache earrings cap beanie headband headphones scarf bowtie lashes` (one per slot: head, eyes, chin, neck) |
| `extraColor` | hats, scarf, bow tie, headphone cups |
| `eyes`, `brows`, `mouth`, `cheeks` | hex (brows derive from the hair) |
| `build` | `{ width: .94-1.06, head: .97-1.03, legs: .95-1.05 }` |
Hats only sit on head shapes (not on afro, spiky or bun). Brows live at y 128-138 in head space: nothing may cover them.

## character.js
```js
import { shaded, ball, crescent, capsulePts, clipPts, circlePts, rotPts, blob, stick, tint, withRole } from './engine.js';
// Design: (silhouette, palette, what must read at phone size) - write it here first
export const name = 'Ivy';
export const about = 'A botanist with a green bucket hat, round glasses and a leaf-print shirt.';
export const look = { skin: '#c27a4a', hair: { style: 'curls', color: '#1f1a2e' }, top: { style: 'collar', color: '#1ec98b' },
  pants: '#3a3f58', shoes: '#6b3e1f', extras: ['glasses'], extraColor: '#2f7d4f' };
export const parts = {
  hat(h, ctx) { /* drawn on the head after the hair: a bucket hat */ },
};
```
Import only from `./engine.js` (never models.js). Keep `name` a short first name and `about` one sentence (the app
shows both in the user's library).

### Parts: the contract
Each part is a function that draws into a group of the rig, in that group's own coordinates. Draw with the engine
primitives, light from the top-left, shading CUT from the outline (`shaded()`, `ball()`, `crescent()`, `clipPts`),
details inside their form with `withRole('detail', ...)`. `ctx = { look, R, HY, tint, warmShade }` (look = the resolved
look with every colour filled in).
| Part | Group, coordinates | Replaces |
|---|---|---|
| `back(g)` | whole body, hips at 0,0, behind everything (tails, capes, wings, backpacks) | - |
| `torso(t)` | torso: body capsule 188 x 214 centred (0, 98), shoulders at y ~190, hem at y ~0 | the top |
| `hairBack(h)` | head group, behind the head circle | the hair's back |
| `head(h)` | head group: head circle centre (0, 104) r 104, ears at (+-102, 98) r 20, neck at (0, 4) | head circle, shade, ears |
| `hair(h)` | head group, over the head | the hair's front |
| `hat(h)` | head group, over the hair | - |
| `face(f)` | face group (moves with `look`): eyes at (+-40, 2) r 15, brows at y 35, mouth y -16..-52 | - (adds) |
| `hand(b, len, ctx, side)` | forearm group, the hand at (0, -len) | the round hand |
| `foot(b, len, ctx, side)` | shin group, the foot at (12, -len - 4), ~84 x 36 | the shoe |
| `front(g)` | whole body, over everything (props held in front) | - |
Non-human characters (a robot, an animal, a cartoon object): replace `head` (keep the face group readable on it:
eyes, brows and mouth are what expressions move), `torso`, `hand`, `foot`, add `back` for tails. Ears or antennae go in
`hat`. Keep the overall size of a person (about 300-500 x 640 px at scale 1): the scenes are composed for it.

## The gate (same law as every element: QUALITY_STANDARD.md)
A character passes when, in every pose and expression, flipped, walking, close up and at phone size:
- no shading, highlight or detail is drawn outside its form (`check_layout` measures it on every `st.*` element);
- nothing floats or detaches when it moves (parts on the head turn with the head, hats move with the bob);
- every expression reads (eyes and mouth never covered), brows visible;
- the silhouette is recognisable at 0.6 scale among other people, and clearly different from the user's other
  characters;
- 3-4 colours, readable on night purple, sky blue, sunset orange and mint.
The app checks again when a character lab task finishes and refuses to save a design that fails.
