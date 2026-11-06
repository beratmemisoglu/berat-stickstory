# Characters (lib/figures.js, engine v16+)

Every person in a 3D reconstruction is one of **two bodies in one style**: smooth faceless mannequins with darker joint
pieces, moved by the CC0 motion-capture clips on one 65-bone skeleton. No clothes, no faces, no hair: a person is told
apart by **body + finish + colour**.

| body | what it is |
|---|---|
| `male` | the jointed mannequin (Mixamo Y Bot), 1.80 m |
| `female` | his sister (CC0 Quaternius female mannequin), 1.68 m |

| finish | look |
|---|---|
| `matte` | clay-like, roughness ~.85, joints dark |
| `glossy` | porcelain clearcoat, joints dark |
| `glow` | emissive body, bright fresnel rim, outline hull (pair with `settings.post.cap >= .95`) |

## Who looks how: roles, settings, groups

A scene names the ROLE, never a look: `figure('suspect', { parent: S.scene, x, z, ry, act: 'sit', t })`.
Roles: main, suspect, victim, detective, witness, accomplice, official, prisoner, police, swat, unknown, extra.
Defaults: main = male glossy orange (#e8742a); victim and witness = female; everyone else male matte, one colour per role.

`settings.figures` (the user's **Look > Characters** table writes main / roles):

```json
{ "main": { "body": "female", "finish": "glow", "color": "#e8742a" },
  "roles": { "suspect": { "body": "male", "finish": "glossy", "color": "#c9343a" } },
  "groups": { "cops": { "roles": ["police", "swat"], "finish": "glossy", "color": "#2b3a57" } } }
```

Resolution, first wins: the scene's own options > the role's settings entry > its group > the role's default.
**The user's per-role picks always win over groups.** Groups in code (no settings change):

```js
import { figure, figureGroup } from '../lib/figures.js';
figureGroup('ghosts', { finish: 'glow', color: '#58a6ff' });            // once, top of the scene file
const a = figure('extra', { group: 'ghosts', parent: S.scene, x: 1 });  // every member shares it
a.look({ finish: 'matte' });                                            // one figure, from now on
```

Old projects: `rig` (human / porcelain / faceted / masked / ual / mixamo / model), `outfit` and `colors` still load and
draw the two bodies (body `f` = female, porcelain = glossy, outfit `glow` = glow, `colors.top` = the colour). Write the new
fields; never write `rig` / `outfit` in new work.

## The API (one figure = `f`)

- Motion: `f.act(name, { t })`, `f.sequence([{ act, t0, ... }], t)` (stateless crossfades), `f.walkAt(from, dir, dist)`,
  `f.play(clip, t, w).apply()`. Acts: stand, walk, run, jog, sit, sitDown, standUp, typing, phone, talk, point, think,
  shrug, handsOnHead, cuffed, carry, pickup, door, fall, crouch, lie, ... (`HUMAN_ACTS`), and ANY clip of the animation
  catalog by name (lib/anims.js: `findAnims('phone')`; the user's own Mixamo imports too, e.g. `f.act('Talking On Phone', { t })`).
  A clip whose name says phone puts a phone in the right hand.
  Seated acts sit on a 0.45 m seat (`{ seat: y }` moves the root; `sitOn()` in lib/props.js fits any chair).
- Hands: `f.handTo('L'|'R', point, { palmNormal, fingerDir, pole, weight, curl })` puts the **palm centre of the drawn
  hand** on the point (after the act of this frame); `f.grip(obj, { hand, at })`, `f.holdTwoHand(obj, { leftAt, rightAt })`,
  `f.hold(obj, { hand })` (lies on the palm: obj +Y along the fingers, +Z out of the palm), `f.curl(hand, 0..1)`.
- Seated: `sitOn(S, f, chair, { act })` (lib/props.js) fits any seat; then seated clips only. The soles go onto the floor
  (or onto what is right under a foot: a table's foot bar, a footrest) by the knee (a shorter body points the toes down
  rather than pushing the calf into the seat front), the back leans to the backrest as much as it needs (up to 30 deg,
  less when an elbow would reach the backrest's posts). Seated at a table or desk, the hands rest ON its top (`rest`, while a
  resting clip plays: sit, sitChair, typing; `sitOn(..., { rest: false })` to opt out).
- Sitting down / standing up: NEVER `act: 'sitDown'` at the seated spot (it starts standing inside the chair). After
  `sitOn`, use the measured steps in a sequence:
  ```js
  sitOn(S, f, chair);                                                  // measures the seat, the standing spot, the clearance
  const seq = [{ act: 'stand', t0: 0, ...f.standSpot(chair) },         // or a walk step whose `to` is f.standSpot(chair)
    ...f.sitDown(chair, { t0: .5 }),                                    // Sitting_Enter from the spot, slides onto the seat
    ...f.standUp(chair, { t0: 3.4 })];                                  // Sitting_Exit back to the spot, then 'stand'
  f.sequence(seq, t);                                                   // every frame, the scene time
  ```
  `f.sitDown(seat, { t0, dur?, act? (the seated act after it), settle? .35 })`, `f.standUp(seat, { t0, dur?, act? 'stand' })`
  -> sequence steps; `f.standSpot(seat)` -> `{ x, y, z, ry }` (the figure's parent space). Chairs, sofas, armchairs and
  office chairs (seats with a back).
- Measure: `f.palm(side)` -> `{ position, normal, forward, center }`, `f.fingertip(side, 'index')`, `f.bone(name)` (every
  bone: pelvis, spine_01..03, neck_01, Head, clavicle/upperarm/lowerarm/hand_l|r, index|middle|ring|pinky|thumb_01..03_l|r,
  thigh/calf/foot/ball_l|r), `f.bones()`, `f.scenePos(bone)`, `f.caps()` (capsules measured on the drawn body, for
  `S.collide`), `f.contactReport()`, `f.root` / `f.group` (place / parent it).

## What Claude may and may not do

- MAY: pick each role's body / finish / colour when the user has not (settings.figures roles, or figureGroup in code);
  give a group one look (all police glossy navy, ghosts glow); use `look()` for a story beat (a figure lights up = glow).
- MAY NOT: recolour a role per shot without a story reason (the colour is the identity); override the user's per-role
  picks; add clothes, faces, hair or other bodies; load other character models as people; edit lib/figures.js or the GLBs.
- A glow figure ignores the grade (toneMapped off): in bright scenes use matte/glossy or raise `post.cap`.

## Your own characters

The user can upload their own rigged humanoid in the app (FBX, GLB, GLTF with everything embedded, or VRM: Mixamo,
Unreal, Unity / VRoid, Blender Rigify, Character Creator, Daz and most other skeletons map by themselves). The app
converts it once and keeps it in `<workspace>/characters3d/<id>/`, served to the project at `__chars3d/<id>/`
(`__chars3d/index.json` lists the usable ones: `{ characters: [{ id, name, height, rig }] }`).

- A role wears it as body `custom:<id>` (settings.figures, or `figure('main', { body: 'custom:my-hero' })`). It is
  the same figure: every act, clip, `walkAt`, `handTo`, `hold` works, and the hands land where the built-in body's would.
  Its own materials and textures are kept; `finish` / `color` do not repaint it unless the user asks for the finish.
- Load it before the figure is made (top-level await in the scene file): `loadFigures(['mq', 'custom:<id>'])`, or
  directly `import { loadCustomChar, customBody } from '../lib/customchar.js'; await loadCustomChar('<id>')`.
- Low level (what figures.js does for `custom:<id>`): `customBody(id, f.root, { mat?, hide? })` binds the model's meshes
  onto that figure's skeleton and hides the mannequin; `mat(isJoint, ownMaterial)` swaps in a material.
- The figure takes the character's real height (meta `height`, 1.5 - 2.0 m): use `f.height` for seats, doors, framing.
- Engine v21: it keeps its OWN proportions, bind pose and skin. The figure's skeleton takes the character's joints (neck
  length, shoulder width, arm / leg lengths) and every clip is retargeted onto it rest-relative (the clip's rotations
  from our rest pose, an A-pose turned to our rest first; the hips' travel scaled by its legs), so a stylised character
  (long neck, short legs, big hands) stays exactly as modelled, clothes included. Its reach and seat height are its own:
  holds, `handTo`, `sitOn` and grounding measure it. Never scale or stretch its bones from a scene.
  `proportionCheck(f)` (lib/customchar.js) says whether a figure keeps them: `{ ok, worst, bindError, lengths }`.
  (Engine v20 and older moved its joints onto the mannequin's: necks stretched, shirts sheared - Update engine.)
- Never edit `characters3d/` files or the mapping from a scene. A character with `status: 'needs-mapping'` (not in the
  index) cannot be used: the user maps its bones in the app first (the app gives a prompt you can answer with a JSON
  `{ "ourBone": "theirBone" }` - our bones are the UE5 names in this file).
- Before a render: the app's test sheet (T-pose, idle, walk, sit, phone, point, typing; front + side) must show no
  warnings; look at one frame of every shot the character is in (hands on props, seated height).
