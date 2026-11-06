LOW-POLY ASSET LIBRARY  (style 'lowpoly' = low poly PS1 shorts)
=====================================================================
A local, indexed library of free 3D characters, mocap animations, animals, props, vehicles, sets and textures.
Every file is CC0 or CC-BY (credit recorded). Everything loads with the repo's three r170 GLTFLoader
(templates/recon/vendor/jsm/loaders/GLTFLoader.js) - no Draco, no Meshopt, no KTX2: only KHR_mesh_quantization
and EXT_texture_webp, which GLTFLoader handles natively.

Size: ~45 MB in the repo (37 MB models + 5 MB previews). 727 index entries (690 local files + 37 'remote' full packs).

FOLDERS
  index.json          the catalogue (edit ONLY through tools/lib.mjs)
  CREDITS.json        one line per author/source/licence + which ids use it (rebuilt on every add)
  characters/         humans on ONE shared skeleton 'ue5-mannequin-65' (+ hair/ and eyebrows to attach)
  animations/         skeleton-only GLBs: clips for 'ue5-mannequin-65' (no meshes)
  animals/            animals + monsters/creatures, each with its own rig and clips inside the GLB
  props/<category>/   casino, home, diner, food, shop, graveyard, lab, street, nature, misc
  vehicles/           cars, buses, trains, boats, aircraft (+ space parts)
  sets/               buildings, interior walls/floors/doors, road tiles
  textures/           256 px tileable colour maps (felt, carpet, wood, marble...), textures/skies/ 1024x512 LDR skies
  previews/           contact sheets (webp) of every category - look here first to pick assets by eye
  tools/lib.mjs       loadIndex / search / get / add / remove / verify / creditsFor / stats (+ CLI)
  tools/anim-runtime.js   prepareClip(), attachToSkeleton(), sampleBones() for the engine (browser, pass THREE in)
  tools/fetch.mjs     downloaders for every source used (itch free packs, Kenney, Poly Pizza, Google Drive, ambientCG, Poly Haven)
  tools/build/        the scripts that produced this library (processing, retargeting, gesture authoring, contact sheets)

CONVENTIONS (all entries)
  Y up, metres, origin at the bottom centre (feet / floor contact), front faces +Z (entry.forward = '+Z').
  size_m = [width x, height y, depth z] of the bind pose (characters: T-pose, so width = arm span).
  Materials: base colour (+ emissive) only; normal/roughness/AO maps were stripped; metalness 0.
  Cameras and lights stripped. Texture max 512 px (characters) / 256 px (props) / 128 px (animals), webp.
  Kenney/KayKit sizes were rescaled to real-world metres per pack from one reference item (scale_applied is recorded);
  oversized game props (KayKit plates, books, pumpkins, flowers) got an extra per-item factor. Expect +-30%.
  Tags: words from the name + pack tags + synonyms + one style tag:
    style-lowpoly (Quaternius realistic-ish low poly: cars, animals, base humans) | style-toy (Kenney/KayKit, rounded)
    style-blocky (crossy-road cubes) | style-cartoon (big-eyed monsters / blob animals)

SEARCH (node, from this folder)
  node tools/lib.mjs search slot machine            -> prop.arcade.gambling_machine ...
  node tools/lib.mjs search dog --kind=animal
  node tools/lib.mjs search --tag=casino
  node tools/lib.mjs credits prop.kf.desk anim.ual1  -> text block for the video description
  node tools/lib.mjs verify                          -> 'OK {...}' or a list of problems (missing files, bad hashes, licences)
  In code: import * as lib from './tools/lib.mjs'; lib.search({ query: 'cow', kind: 'animal' })

HUMANS: ONE SKELETON, ALL CLIPS
  Characters: char.mannequin_m, char.mannequin_f (orange/purple mannequins, recolour per role),
              char.base_m_grey / base_m_black / base_f_grey / base_f_black (realistic base bodies in underwear;
              grey/black = underwear colour, NOT skin tone), hair: char.hair_* and char.eyebrows_* (skinned to Head).
  All share skeleton 'ue5-mannequin-65' (UE5-mannequin names: root, pelvis, spine_01..03, neck_01, Head,
  clavicle/upperarm/lowerarm/hand_<l|r>, 5 fingers x 3 joints + leaf per hand, thigh/calf/foot/ball_<l|r>).
  Clip files (all on that skeleton):
    anim.ual1     43 Quaternius UAL1 mocap clips, in place      anim.ual1_rm  9 root-motion versions (walk/jog/sprint/...)
    anim.ual2     43 Quaternius UAL2 clips (phone, carry, yes/no, get-up, knockback, zombie...)   anim.ual2_rm 7 RM
    anim.kaykit_ue 35 KayKit clips retargeted (wave, cheer, sit chair/floor, lie/get up, falls, pick up, crawl...)
    anim.gestures  12 authored on UAL idle mocap (point, shrug, facepalm, hands on head, typing, hold up, thrust prop, clap)
  Per-clip notes (use, loop) are in each animation entry's 'animations' list.

  Usage in three.js:
    import { prepareClip, attachToSkeleton, pelvisRest } from '<lib>/tools/anim-runtime.js'
    const char = SkeletonUtils.clone((await loader.loadAsync('<lib>/characters/base_m_grey.glb')).scene)
    pelvisRest(char)                                   // read the bind pose BEFORE any animation plays
    attachToSkeleton(THREE, char, (await loader.loadAsync('<lib>/characters/hair/hair_simpleparted.glb')).scene)
    const anims = (await loader.loadAsync('<lib>/animations/ual1.glb')).animations
    const mixer = new THREE.AnimationMixer(char)
    mixer.clipAction(prepareClip(THREE, anims.find(a => a.name === 'Walk_Loop'), char)).play()
  ALWAYS go through prepareClip: it scales the pelvis/root translation to the character's leg length (no floating /
  sinking feet, no foot sliding) and drops tracks for missing bones. Clips carry rotations for every bone and
  translation only for root + pelvis (on purpose: bone-length translations would stretch other bodies).
  Walking: Walk_Loop is 1.33 s per cycle = 1.5 steps/s and covers 1.30 m per cycle on the mannequin (0.98 m/s).
  For the analysed ~2 steps/s: action.timeScale = 1.33 and move the character at 1.30 m/s (in-place clip),
  or use anim.ual1_rm and let the root move. Measured: toe slide <= 5 cm per ground contact, feet alternate.

ANIMALS
  Each animal GLB holds its own rig + clips (names like Walk, Gallop, Idle, Eating, Death, Attack...). They are NOT on
  the human skeleton: play them directly (no prepareClip). Quaternius Ultimate Animated Animals (horse, cow, bull, deer,
  stag, donkey, alpaca, fox, wolf, husky, shiba, white horse) have 12-13 clips; old farm-pack pig/sheep/pug/llama
  only have Idle (+Jump), zebra 6; fish have Swim only.

ADDING NEW FINDS (so nothing is ever downloaded twice)
  1. Search first: node tools/lib.mjs search <words>. Check previews/ too.
  2. Download with tools/fetch.mjs into a folder OUTSIDE the repo (e.g. ...\ps1-research\assets-raw\dl\<pack>);
     a .source.json with page, licence text seen, sha256 lands next to every file. Unzip each archive into its own
     new empty folder. Never run anything from a download.
  3. Licence gate: CC0, public domain or CC-BY (3.0/4.0) only. Reject NC, ND, SA, 'free for personal use', Mixamo,
     anything unclear. CC-BY needs credit_text (exact line for the description).
  4. Process to GLB (tools/build/process.mjs processModel(): strips cameras/lights/extra maps, webp textures, bottom-centre
     origin, scale, quantize) - FBX/OBJ/.blend go through Blender headless first (tools/build/fbx2glb.py, obj2glb.py,
     blend2glb.py; blender -b --factory-startup --disable-autoexec -P ...).
  5. lib.add(entry, file): copies into <kind>s/<id>.glb (or entry.file), hashes it, appends to index.json, rebuilds
     CREDITS.json. Same file content already indexed -> returns the existing entry instead of adding a copy.
     Required: id ([a-z0-9_.-]), kind (character|animation|animal|prop|set|texture|vehicle), name, tags, licence
     (CC0-1.0 | PD | CC-BY-3.0 | CC-BY-4.0 | OWN-CC0), author, source_url, credit_text (CC-BY). Recommended:
     size_m, poly_count, animations, skeleton, licence_quote, pack, note, forward.
     Big packs you don't want in the repo: add with no file and remote: { via, url, sha256, ... } (see remote.* entries);
     node tools/fetch.mjs remote <id> <dir> fetches them again.
  6. Look at it: tools/build/render.mjs + job.mjs render contact sheets headless (Chrome, no window). Then lib verify.

REMOTE (not shipped, indexed): remote.downtown (235 MB city megakit), remote.scifi, remote.nature (150 nature models),
  remote.ubc (full base characters with 2K textures), remote.ual1/ual2 (sources), remote.kenney_* (17 full kits),
  remote.k* (KayKit packs incl. space base + prototype), remote.ufood / uhome / utransport / bgposed / uaa / umon (Drive).

See docs/ps1-style/ASSETS (txt/md) for the clip list, bone map, known issues and pitfalls.
