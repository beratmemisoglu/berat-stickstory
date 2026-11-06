# Recon: where a style may hook into this engine

API: `.claude/skills/recon-reconstruction/references/engine_api.md` (shots, overlays, models, figures, lighting/camera rigs,
checks). Rules: `references/quality.md` (hard rules 1-20), `references/no_slop.md`, `references/signoff.md`,
`references/playbook.md`. Every change still has to pass the sign-off checks (coplanar, flicker, contact, collide).

Exports are only ever ADDED, never renamed or removed (host.js, the editor's Graphics panel and click-to-select import
them); `ENGINE_KIND` stays `'recon'`; bump `ENGINE_VERSION` (engine.js line ~16) when engine.js changes. Frame is 16:9
(`FW` 1920 x `FH` 1080) or, since engine v14, vertical 9:16 (`settings.format`): read `FW`/`FH`, never hard-code 1920.

## Extension points (engine.js unless noted)
- **`THEMES`** (line ~35; schema in the comment above it): the look. Each theme sets `pal` (C overrides), `bg`, `env`,
  `exposure`, `fov`, `hemi`, `hemiInterior`, `key`, `rim`, `lamp`, `floor`, `post` ({ ao, dof, bloom } shot defaults),
  `bloomAt`, `grade`, `figure` (mannequin material), `prop` (clay greys), `tag` (corner badge text/style), `ov` (overlay
  text colours + the one text shadow), `broll` (archival grade). Add a key with ALL of these. `THEME_ID` (line ~60) only
  accepts `'investigation'`, else `'studio'`: to select a new theme, change it to
  `THEMES[SETTINGS.theme] ? SETTINGS.theme : 'studio'` and set `"theme": "<yours>"` in the style's `defaults`
  (style.json; it beats the base look). Keep `studio` and `investigation` (code branches on
  `THEME_ID === 'investigation'` for practicals, the hemi rig and BRAND).
- **`C`** (line ~96): palette (`bg`, `bgHex`, `clay*`, `ink`, `accent`, `red`, `crimson`, `hl` ...). Prefer `THEME.pal`
  overrides; keep every key (overlays and kits read them). `BRAND` (line ~120) derives from it.
- **`MAT`** (line ~122): shared materials `clay clay2 clay3 dark glass blue white shadow` (+ `joint` with a figure
  theme). Retune colour/roughness here or via `THEME.prop` / `THEME.figure`; keep the keys (models.js and lib/ use them).
- **`DEFAULTS`** (line ~21): `quality.ss` 2, `post.grain` .014, `post.vignette` .07, `post.ao`. The base's default look
  sets all of these, and settings (base look < the style's `defaults` in style.json < the project's look) are merged over
  DEFAULTS: a value changed here never shows. Tune them in style.json `defaults` (`{ "post": { "vignette": 0.05 } }`);
  add only new keys here.
- **Grade** (`GRADE`, line ~194): the Studio shader; a theme with `grade` { contrast, pivot, desat, cap, knee, crush,
  lift, tint, vig, ca } gets the documentary pass (line ~215). A new finish = a new theme `grade`, not a third shader.
- **`LIGHTING`** (line ~560): rig presets `threePoint lowKey window practical topDown void`, each
  `key/fill/rim: [az deg, el deg, intensity or ratio, colour]`, `wash`, `amb`. Add a preset key; `S.lighting(name, o)`.
- **`CAMERA_LIMITS`** (line ~642): `maxDeg` 25, `minPush` 2.5 s, `accel` 2.4, `peakDeg` 60. Tune with a reason, never
  delete; `S.cameraRig` (push, drift, arc, crane, rack, hold) is the way to move.
- **Transitions** (`TRANS_KINDS`, line ~1084; `FX`, `transSpan`, `transFx`): `cut dip dissolve flash glitch black iris`.
  A new effect cut = name in `TRANS_KINDS` + `FX`, its span in `transSpan`, its drawing in `transFx`. Still never two
  3D scenes on screen at once (dip, not cross-dissolve).
- **Fonts** (`FONT_FILES` line ~394, `F` / exported `FONT` line ~396 / 1024; lib/crimeover.js `CF`): families `Inter`
  (h) and `JBM` (m). Add the file via add_font, a `FONT_FILES` row, then point `F.h` / `F.m` (and `CF`) at it.
- **2D overlays** (lines ~749-1023): `tag quote big timecard chapter list headline callout pathline place source photo
  footage broll cite custom`, drawn on the overlay canvas with `drawText` / `textShadow` and `THEME.ov`. Restyle the
  card shapes; keep signatures and the `{ t0, t1, what, text, draw }` item shape (sound pass + editor read it).
- **Corner badge** (`reconTag`, line ~763): driven by `THEME.tag` { text, style: 'card' | 'small' | null }; drawn only when the
  project's Look turns it on (`settings.badge === true`, Look > Corner tag, engine v20+; off by default).
- **`LAYOUT_CHECKS`** (line ~1282): push `fn(S, t, def) -> [{ type, detail }]`; examples: lib/crime.js `STRINGEND`,
  lib/crimeover.js `TEXTPLACE` / `PIXELATED`. **`VISIBILITY`** (line ~1326): DARK/CRUSHED/SUBJECT/BLUR thresholds
  (dark .10, crushFrac .60, subject .18, contrast .04): tune, never remove.
- **models.js**: procedural clay assets (`box`, `mesh`, `POSE`, `walk`, `walkAt`, `cabin`, `airliner`, `water`, ...).
  Add assets as new exports; QA each alone before use.
- **lib/ kits**: `crime.js` (3D sets: `crimeBoard`, `networkGrid`, `setBedroom` ... `setGallery`), `crimeover.js` (2D cards:
  `placeTag`, `lowerThird`, `chapterCard`, `titleCard`, `headlineCard`), `figures.js` (`RIGS`, `OUTFITS` line ~582,
  `ROLES` line ~604: add outfits/roles; the user picks them in Look > Characters), `library.js` (`model()` restyles
  downloaded CC0/CC-BY models, `actor()` rigged people). A style may add a new lib file.

## Never touched by a style
`lib/contact.js`, `lib/collide.js` (the sign-off checks), `S.audit`, the z-fight probe and `layoutIssues` logic, the v9
Graphics layer (`applyGraphics`, `getGraphics`, `GRAPHICS_KEYS`: the user's panel wins over scenes and looks).

## Restyle in 5 steps
1. **Room + palette**: a new `THEMES` entry (`bg`, `floor`, `pal`, `prop`), `THEME_ID` taught to pick it, `"theme"` in
   the style's `defaults` selecting it.
2. **Light**: `hemi`, `key`, `rim`, `env`, `exposure`, then `LIGHTING` presets; every shot still passes the visibility
   gate (frame mean >= 45 dark looks / 90 bright, subject >= 70 and 1.4x its ring).
3. **Materials + people**: `MAT` / `THEME.figure`, `OUTFITS`, `ROLES`; asset galleries at full 1920 x 1080.
4. **Type + overlays**: `FONT_FILES`, `F`, `THEME.ov` (neutral shadow only), card shapes, `THEME.tag`.
5. **Motion + finish**: `THEME.grade`, `post` (ao/dof/bloom per theme; grain / vignette in the style's `defaults`),
   effect transitions. Then the full sign-off: check_layout
   Clean (coplanar, flicker, floating, through, overlap, DARK) on hero, kit, samples; mustfail scenes still fail.
