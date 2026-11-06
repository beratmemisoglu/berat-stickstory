# Checks: what each one means and how to fix it

`cz check <style>` and the app's import run the same checks with the same ids, words and severities. The static checks
are one file (`tools/static.mjs`) that the app bundles too, so the kit and the app cannot disagree. The render checks run
in headless Chrome or Edge here and in the app's hidden render workers there, on the same host page.

Every finding is printed as **finding -> meaning -> fix**. Copy those words into REVIEW.md and PITFALLS.md as they are.

**Severities:** `high` blocks the import (the app will not offer "Add to my styles" while one is open; `cz check` ends
with NOT READY and exit code 1). `medium` is shown on the import page and must be fixed or explained in REVIEW.md before
sign-off. `low` and `info` are notes. A style may RAISE the severity of an engine finding type with a line in
`skill/QUALITY.md`, for example `- severity EMPTY: high` (a style whose whole point is a full frame). It can never lower
one: `- severity CUT: low` is ignored, in the kit and in the app (a shared style must not let a fault through).

**Seeing a check fail on purpose** (a check is trusted only after it was seen to fail): never break the real style. Make a
scratch style on the same base (`cz new scratch --base <base>`), break it there, run `cz check scratch`, read the
finding, then delete `styles/scratch/`. The render checks have their own proof built in: the must-fail views.

## Static checks (on the files, nothing is run)

### manifest (high)
**What:** style.json valid against `templates/stylekit/style.schema.json` (generated from the zod schema; in the kit:
`style.schema.json` at the kit's root); id `custom-*`; base is a built-in base; `kit` block present.
**Means:** the app can't read the style, or would mistake it for another one.
**Typical causes:** a hand-edited style.json with a trailing comma or a wrong type (`"aspects": "16:9"` instead of
`["16:9"]`); an id without the `custom-` prefix; a base that is not one of `pixel-art collage flat stickman recon lowpoly
starter`; a package made by hand instead of by `cz package` (no `kit` block).
**Fix:** correct the field the finding names; let `cz package` write the `kit` block and the app-owned fields.
**See it fail:** in the scratch style set `"aspects": "16:9"`, run `cz check scratch`.

### files (high)
**What:** limits + extensions + zip-slip + secrets + mixamo (PACKAGE.md, "Limits").
**Means:** the package is too big, contains a file type the app won't take, a path that could write outside the style, a
secret, or a Mixamo file (never allowed: licence).
**Typical causes:** a video, render or download left in a folder that is packaged (`lib/`, `fonts/`, `assets/`); a
`.env` or `api_key.txt`; a `.glb` named `mixamo_*` or the Y Bot; a file over 50 MB; a symlink.
**Fix:** move the file out of the packaged folders (references live in `refs/`, measurements in `reference/`, exports
in `out/`: none of those are packaged), or replace the asset with a licensed one. `.env*`, key / secret / token files, `.git/`, `node_modules/`, `out/` are left
out with a warning; everything else on the list is refused.
**See it fail:** copy any `.exe` or a file named `mixamo_test.glb` into the scratch style's `lib/`.

### contract (high)
**What:** `engine/engine.js` must export `SHOTS compose outCanvas loadTimeline loadImages finalizeShots renderer W H THREE
cue activeIndex exportVideo collectEvents ENGINE_KIND ENGINE_VERSION`, `ENGINE_KIND` equal to the base's,
`export const ENGINE_VERSION = N` in that exact format; every optional name the base exports and host.js uses (`FONT_FILES
SUITE setKeep PREVIEW_SCALE SS getGraphics applyGraphics prewarm PICKABLE pickTarget layoutIssues checkTimes SETTINGS AW AH
FW FH C`) is still exported if the base exports it.
**Means:** the host page and every project made in the style import these names; without one they break.
**Typical causes:** an export renamed while restyling; a function turned into a local; `ENGINE_VERSION` written as
`export let` or computed; `ENGINE_KIND` changed.
**Fix:** export the name again (an alias is fine when you renamed it: `export { newName as oldName }`). Exports are only
ever added. Pixel art: the base engine exports no `ENGINE_KIND` (host.js reads a missing one as `'pixel'`), so `cz new`
adds `export const ENGINE_KIND = 'pixel';` at the end of a pixel-art style's engine.js. Keep that line.
**See it fail:** in the scratch style rename `export function cue` to `export function cueAt`.

### banned (high)
**What:** in engine/**/*.js and sample/scenes: `eval(`, `new Function`, `Math.random(`, `Date.now(`, `performance.now(`,
`setTimeout(`, `setInterval(`, `requestAnimationFrame(`, `document.`/`window.` DOM writes outside the base's own uses,
`localStorage`; and everything that reaches outside the style: an absolute address loaded (`fetch(`/`import(`/`from` of
`https://` or `//host`, `.src = 'https://...'`, `setAttribute('src', 'https://...')`, `url(https://...)`,
`new Image/Audio('https://...')`, `loader.load('https://...')`), `fetch(`/`import(` from the server root (`'/...'`) or a
scheme (`data:`, `blob:`), `navigator.sendBeacon`, `new WebSocket`, `new EventSource`, `XMLHttpRequest`,
`RTCPeerConnection`, `window.open`, a page navigation (`location.href =`, `location.assign/replace`, `window.location =`).
A `fetch(`/`import(` whose address is computed (`fetch(url)`, `` fetch(`${base}/x`) ``, `new URL(...)`) is **medium**: the
base engines build their own files' addresses that way. Lines identical to the base's are reported as one low note (base
debt), not blockers.
**Means:** the video would not be the same on every render (preview, stills, export, another computer), or it runs code
from outside the style, or it sends something somewhere. A style never does: the app's host page refuses every request
outside the project's own files (its Content-Security-Policy) and the app blocks navigation, so such code only fails.
**Typical causes:** random jitter for "life" (`Math.random()`); a timer-driven animation; a font or texture fetched from a
CDN; a copied snippet from a web page that used `requestAnimationFrame` or an analytics beacon.
**Fix:** the base's seeded generator (`rng(seed)`, `S.rng()`, `rnd()`, `hash()`: docs/ENGINES.md per base); time is only
the `t` the engine passes in, every value a pure function of it; ship files inside the style and load them by a quoted
relative path (`'assets/map.json'`, `` `scenes/${name}.js` ``) instead of fetching them; never send anything anywhere.
**See it fail:** add `const j = Math.random();` to the scratch style's `models.js`.

### text (high)
**What:** UTF-8 without BOM, LF only in .js/.json, no code after a `//` on the same line where a previous edit glued it
(`// ...;\s*\w+\(`).
**Means:** a BOM or CRLF breaks the static parsers; code glued after a comment is silently commented out (this hid a cliff
and a cave vault in one recon film).
**Typical causes:** files written by PowerShell (`Set-Content`, `Out-File` add a BOM and CRLF); a patch script that
appended a statement to a commented line; a Python script writing in text mode on Windows.
**Fix:** write files with the Write / Edit tools; split the glued line; re-save as UTF-8 without BOM, LF.
**See it fail:** in the scratch style append `// note; foo();` to a line of `models.js` (comment, then code).

### sample (high)
**What:** sample/views.json has sample, hero, kit and >= 1 must-fail view; every scene file exists; timeline.json parses.
**Means:** the app can't re-check the style (now or after a later app update) without these views.
**Typical causes:** the hero or kit view removed from project.json; a scene renamed without updating its view; a
hand-edited timeline.json.
**Fix:** restore the view entries (`"hero": { "scenes": ["hero"], "end": 6 }` shape); keep the scene file names in step.
`cz package` builds sample/ from project.json's views and audio/.
**See it fail:** remove the `kit` view from the scratch style's project.json.

### looks (high)
**What:** every looks/*.json valid; its settings validate against the package controls (`controlsFor` + `validateByControls`).
**Means:** a member picking that look would get settings the style's controls reject.
**Typical causes:** a range value outside the control's min/max; a select value that isn't one of its options; a colour not
written as `#rrggbb`; `format` set to an aspect the style doesn't declare.
**Fix:** change the value to one the control allows, or widen the control only if the engine really handles it (then show
it with `--controls`). A look that names a `format` keeps it (it is checked, never replaced by the style's first aspect).
Render a look before you trust it: `cz check <style> --look <id>`, `cz stills ... --look <id>`.
**See it fail:** in the scratch style set a look's colour setting to `"red"`.

**Kit only, medium, same id: engine DEFAULTS hidden by the look.** `cz check` and `cz package` compare the style's
engine.js `DEFAULTS` with the base's (its snapshot `.cz/base-engine/`); a key the style changed that the base's default
look also sets is reported: "engine.js DEFAULTS.theme is "midnight" (the base's: "base"), but the base's default look sets
theme ("base"), and a look beats DEFAULTS: this change is hidden by the look". Every render, in the kit and in the app, is
base look < style.json `defaults` < the project's look, merged over `DEFAULTS`. **Fix:** set the value in style.json
`defaults` (the finding prints the JSON); keep engine `DEFAULTS` for new keys only (METHOD.md, "How settings reach the
engine"). **See it fail:** in the scratch style change `theme` (starter) or `post.vignette` (flat) in engine.js `DEFAULTS`.

### prompts (medium)
**What:** `prompts.build`, `prompts.context`, `prompts.qualityBar` non-empty; every file the skill/prompts name exists; no
other style's vocabulary in a derived style's prompts (e.g. "front page" outside collage).
**Means:** videos built in the style get no instructions, point at files that aren't there, or are told to make another
style's things.
**Typical causes:** prompts left empty; a skill file renamed; text copied from the base's own brief.
**Fix:** write the three prompts from STYLE_GUIDE.md and QUALITY.md (METHOD.md stage 7); fix the file names; describe
the style in its own words. A file named in backticks in the skill or prompts (`skill/STYLE_GUIDE.md`, `PITFALLS.md`) must
be in the package: never point at kit files such as `docs/...`. The words that belong to one base and are flagged in a
style on another: collage "front page", "newspaper collage", "cut-out collage"; stickman "ms paint", "stick figure";
pixel-art "16-colour palette", "pixel-art explainer"; recon "matte clay", "3d reconstruction"; lowpoly "game-capture",
"ps1 style"; flat "flat-vector".
**See it fail:** empty `prompts.qualityBar` in the scratch style.

### credits (medium)
**What:** every non-base asset in engine/ and sample/assets has a CREDITS.json entry with an allowed licence (CC0, PD,
CC-BY*, OFL, MIT, Apache-2.0, own).
**Means:** the style ships something nobody may legally hand on, or an author who must be credited isn't.
**Typical causes:** a downloaded model or texture with no entry; "free" art whose licence was never checked; CC-BY-NC or
"editorial use only" files (not allowed).
**Fix:** add `{ "file", "source", "licence", "author" }` (file = its path inside the style folder, e.g.
`assets/harbour.jpg` or `lib/models/boat.glb`; source = the page you checked the licence on), or replace the asset.
`own` only for what the member made themselves. Files identical to the base's need no entry.
**See it fail:** copy any picture into the scratch style's `lib/` without an entry.

### fonts (medium)
**What:** every font file has a licence file next to it; charsets declared in `fonts.charsets` covered.
**Means:** a font without its licence can't be redistributed; a declared charset (e.g. Vietnamese) the font files don't
cover draws boxes.
**Typical causes:** a font copied without its OFL.txt; `fonts.charsets` listing a set no file covers.
**Fix:** put the licence text in the same folder; add the subset file for the charset or remove the charset.
**See it fail:** copy a .woff2 into the scratch style's `fonts/` with no licence file.

### version (info)
**What:** base engine in this app newer than `from.engineVersion` -> "Flat engine v9 is available (yours: v7)".
**Means:** nothing is wrong; a newer base engine exists. The style keeps its own engine until the member chooses to move.
**Fix:** only when the member wants it: `cz rebase <style>` (PACKAGE.md, "Moving to a newer engine").

## Render checks (the real host page, every declared aspect)

### boot (high)
**What:** every view boots in every declared aspect with zero page errors, zero 404s, zero "not loaded"/fallback warnings.
**Means:** nothing in that view renders, or it renders with a stand-in (a grey placeholder, a fallback font, a skipped
transition) that the app would show the same way.
**Typical causes:** a syntax error; an import path that only exists in one place; a texture or font file missing from the
style; an image key not in project.json "images"; a transition key added inside a shot's build (compiled once, falls back
to dissolve); lowpoly: an asset id built at run time (`'prop.' + name`) is never preloaded.
**Fix:** the printed error names the file and line, or the URL that 404'd. Ship the file, fix the path, use plain-string
asset ids, add transitions at module load.
**See it fail:** in the scratch style import a file that doesn't exist from `scenes/hero.js`.

### layout (high/med)
**What:** engine `layoutIssues` (+ recon collide probe) on sample, hero, kit: no high finding.
**Means:** the engine's own measurement of the frame found a fault (the finding types are below).
**Fix:** at the cause, in the scene or the style, never by loosening a threshold. Mark intent only when it is true:
`userData.over = [other]` (one thing meant to sit on another), `userData.bleed` (an intended crop), `S.sparse` (emptiness
is the idea), `S.visibility = false` (a deliberately dark shot), `userData.airborne` (it really flies or falls).
**See it fail:** the base's must-fail views (overlap, cut, caption, floating ...) are exactly this.

The finding words differ per base; each base's are in docs/bases/<base>/dont.md and its skill. The common ones:

| Finding (as printed) | Means | Fix |
|---|---|---|
| cut | within ~36 px of / crosses the frame edge | inside SAFE, or `bleed` if the crop is intended |
| caption / band | in the caption band while captions show | move into the content zone (ZONE) |
| overlap | two elements cover > 12 % of the smaller (collage: 4 %, marks 1 %) | separate them, or `over` if intended |
| small | text under the engine's minimum on screen | bigger type (titles 90+ px at 1080) |
| contrast | text below the engine's minimum against what is behind it | `legibleOn` / `textOn`, or a plate behind it |
| empty | under 12 % of the content zone used | bigger subject, the thing the narration names, or `S.sparse` |
| kit | a kit element not whole and comfortably in frame | whole, >= 12 % of the frame, >= 6 % from every edge |
| DARK / CRUSHED | too dark to read / too much crushed black | light the subject, lighter grounds; never turn text up |
| SUBJECT / BLUR (recon) | the subject doesn't separate / is out of focus | aim the key at it, rim + wall wash; focus on it |
| ABRUPT | the camera starts, stops or jumps too hard | ease from rest to rest over >= 1.5 s (pushes >= 2.5 s), or cut |
| floating | a solid rests on nothing | rest it on what holds it, or `airborne` |
| through | solids pass through each other | move one so they touch without passing |
| coplanar / flicker | two surfaces at one depth z-fight | lift one >= 1 cm, or make it one surface; set near/far |
| shading (flat) | detail drawn outside the element's own form | cut shading from the outline (`shaded`, `clipPts`, `crescent`) |
| frame / mark (collage) | a zoom shows past the panel / a mark crosses a non-target | keep zoom inside the panel; mark only its target |
| nocollide (recon) | a shot with people has no `S.collide`, so bodies are never checked | declare `S.collide = { bodies, solids }` |
| support / sunk (recon) | a person hangs in the air / goes into the floor or seat | rest the body within 3 cm of the surface / lift it |
| HOLD / PLACEMENT (recon) | a hand isn't on what it holds / a prop is placed through something | `hold()` with a VERIFIED grip; `place` / `sitOn` / `beside` |
| feet, hand, bodies, camera, offframe, covered, subject, scale (lowpoly) | see docs/bases/lowpoly/dont.md | the fixes listed there |

Pixel art and stickman export no `layoutIssues`: this check has nothing to run there and the frames check is the machine
check. Say so in REVIEW.md and look at more frames.

### frames (high)
**What:** BLANK / DARK / FROZEN / SAME stats on sample (per aspect).
**Means (from the rendered stills of each shot):** BLANK (high): the shot shows nothing but its background (a scene drew
nothing, or everything is hidden or off-frame). It is measured as structure, not as one colour, so a gradient ground, a
vignette, grain, a horizon or the base's corner badge never hide an empty shot: on a 64 px wide copy of the frame,
everything that changes along one axis only (fills, gradients, horizons, vignettes) is removed, and the edges left are
summed ("structure"; the same over the frame without its outer 10 %: "centre"). Under 0.5 overall and under 0.3 in the
centre is BLANK. Empty grounds of every base measure at most 0.25 / 0.13; the sparsest real frames (one small word, a
dot, a thin line) 0.4 / 0.6 and more. DARK (high): too dark to read (bases without a layout check; the others report it in
`layout`). FROZEN (medium): nothing moves for a whole sample shot of 2.5 s or longer. SAME (medium): two shots in a row
look the same, so the cut says nothing.
**Typical causes:** a scene that throws quietly and draws its background only; a shot built at the wrong time; a camera
with no move and no entrances; two shots of the same framing back to back.
**Fix:** BLANK: check boot output, then that elements are inside the frame and visible. DARK: light the subject, lighten
the ground. FROZEN: bring elements in on their spoken words, or move the camera / an element over the shot. SAME: change
what the second shot shows (subject, framing, layout) or merge the two. Stickman pictures are stills by design: keep each
picture short (2-3 s) and use `@word` beats so a still never fills a 2.5 s shot.
**See it fail:** pixel art and stickman ship `mustfail_blank` and `mustfail_dark`; elsewhere, in the scratch style, make a
sample shot that only sets a background (`S.bg()` and nothing else; collage: an empty `panel()`; recon: `S.studio()` and a
camera): BLANK fires on it in every aspect.

### mustfail (high)
**What:** every must-fail view fires its `expect` finding (a check never seen to fail is not trusted).
**Means:** if a must-fail view comes back clean, the check it exists for is broken, so every "clean" result of that check
means nothing.
**Typical causes:** someone "fixed" the must-fail scene; a threshold was loosened; a style restyled an element so the
check no longer measures it (a new text element the contrast check can't see: set `userData.bg` on plates that carry
text); a `LAYOUT_CHECKS` function that throws (it is caught and reports nothing).
**Fix:** restore the must-fail scene (the base's are never edited); repair the check, not the scene. For a style's own
check: write the must-fail first, see it red, then the check (METHOD.md stage 4).
**See it fail:** this is the check that watches the others; its own proof is that it reports a must-fail you broke.

### export (high)
**What:** a 5 s export of the sample in each aspect produces a playable video.
**Means:** the app's render path fails on the style, so no video in it could be exported.
**Typical causes:** something that only works in the live preview (a resource loaded late, a frame drawn on a timer);
`exportVideo` or `collectEvents` changed; a frame that throws only when rendered in order.
**Fix:** `cz export <style> sample --to 5 --aspect <a>` (the video lands in `styles/<style>/out/`) and read its error;
every frame must be a pure function of `t`. `cz doctor` says whether the browser has the H.264 encoder the export needs.

### repeat (high)
**What:** a frame rendered after seeking elsewhere equals the same frame rendered fresh (determinism). Tested at one moment
per shot of the sample (its middle; at most 12, spread over the video), each drawn fresh, then after jumping to other
moments, then after playing the second before it. High when more than 0.1 % of the pixels change by more than 16 levels,
or more than 64 pixels by more than 48 (something drawn in another place); fewer is GPU rounding (low; pixel art's dither
and outlines turn it into 1-2 art pixels). Known faults of a base engine itself are medium ("base debt").
**Means:** the preview, the stills, the export and a re-render on another computer show different pictures.
**Typical causes:** state carried across frames (`obj.x += 2` in an update); `%` on a position for a loop (it jumps); a
mixer that skips unchanged bones; a wipe drawn before the camera moved; anything random or clock-based.
**Fix:** set every value from `t` (`x = x0 + v * (t - t0)`), periodic motion with `Math.sin(t * w + phase)`, seed every
variation. Lowpoly: shots are stepped once at their start; don't depend on frames before.

### controls (medium)
**What:** kit only (`cz check --controls`): every added control changes pixels at min vs max.
**Means:** a control in the Look panel that does nothing on screen (the member moves a slider and nothing happens).
**Typical causes:** a setting path the engine never reads; a value read once at module load before settings merge; a
control whose effect only shows in a view the check doesn't render.
**Fix:** read the setting where it is drawn (from `SETTINGS`, merged over `DEFAULTS`); or remove the control.
