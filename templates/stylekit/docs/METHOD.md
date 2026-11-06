# The method: building a style, stage by stage

This is how a style is built in the kit. Every stage has inputs, the files it produces, the command that proves it, a
gate (the exit condition), the typical failure and a time budget. Do the stages in order. Going back to an earlier stage
(a new palette after the kit was approved) makes every later stage stale: redo them in order.

Where this file says `cz <command>`, run the wrapper for your shell (CLAUDE.md, "Running cz").

```
0 setup -> 1 study -> 2 guide + 3 hero frames -> 3 kit -> 4 must-fail first -> 5 sample -> 6 review loop
        -> 7 sign-off -> 8 package -> 9 battle test in the app
             STOP after 2, 3, 5 and 7: the member looks and decides
```

## The style folder

`cz new <name> --base <b> [--aspects 16:9,9:16] [--dim 2d|3d]` makes `styles/<name>/`, laid out like a Toon Studio
project so the real host page, render path and checks run on it:

| Path | What | Who writes it |
|---|---|---|
| engine.js, models.js, lib/ | the style's own engine (a copy of the base engine, restyled) | you, at the base's extension points |
| fonts/, vendor/ | typefaces (+ their licence files), three.js | fonts: you (licensed files only); vendor: never |
| scenes/hero.js, kit*.js, sample*.js | hero frames, the kit gallery, the sample video | you |
| scenes/mustfail_*.js | scenes that MUST make a check fire | the base's: never edit; the style's own: you, written before the check |
| project.json | the views (`"views"`, same shape as the base sample's views.json), `"images"`, the preview settings | you: views and images only |
| audio/timeline.json, script.txt | the sample narration's word timing and its text | the kit (replace only on the member's request, see stage 5) |
| style.json | the manifest (schema 2): name, texts, aspects, controls, defaults, prompts, capabilities. `defaults` (an empty `{}` from `cz new`) is where the style's look settings live: they beat the base's default look (see "How settings reach the engine") | you fill text and settings; `cz package` writes the `kit` block |
| skill/STYLE_GUIDE.md, QUALITY.md, PITFALLS.md | the style's rules: every video built in the style reads them | you |
| looks/<look-id>.json | at least one look (settings + notes) | you |
| reference/ANALYSIS.md | the study, in numbers | you (stage 1) |
| reference/ (everything else) | frames, sheets, scores you measured | you; never packaged |
| assets/ | pictures the scenes use, referenced the way the base API says (most bases: project.json "images") | you, each with a CREDITS.json entry; `cz package` puts them into sample/assets/ and the `"images"` entries whose file is there into sample/views.json |
| CREDITS.json | `[{ file, source, licence, author }]` for every asset not from the base | you |
| REVIEW.md, review/ | open findings, critic ledger and sheets, sign-off record (template: docs/templates/REVIEW.md) | you; never packaged |
| .cz/ | the base engine and skill the style was built on (`base-engine/`, `base-skill/`), stills, last check and package | the kit; never edit |
| .rebase/, out/ | the newer base engine during a `cz rebase`; exported videos | the kit |

The skill/ files are not notes for you: in the app, every video built in this style gets them as its style skill, before
the base skill's look references. Write them for that Claude: rules, numbers, element names, never a diary.

### How settings reach the engine (where a restyle goes)

Every render (a check, a still, an export, every project in the app) hands the engine settings made in this order, each
layer over the one before: **the base's default look** (bases/<base>/look.json; for a starter style the look of its
dim) **< style.json `defaults` < the project's look** (a `looks/*.json`, or what the member set in the Look panel). The
engine merges those settings over its own `DEFAULTS`. The base look sets nearly every key the engine's `DEFAULTS` has
(theme, post grain / vignette, camera, captions, transitions ...), so **a changed value in engine `DEFAULTS` is hidden
for every key the base look sets**: it never shows in a check, a still or a video.
- **New things** (a theme, a palette, a font, an element, a transition, a finish pass) are **defined in the engine** at its
  extension points (`THEMES`, `C`, `FONT_FILES`, `registerElement`, `POST_GLSL` ...: docs/bases/<base>/extend.md).
- They are **selected and tuned in style.json `defaults`**: `{ "theme": "midnight", "post": { "vignette": 0.08 } }`.
  That is the style's look; looks/*.json change it per look.
- **Engine `DEFAULTS`** only for keys no look sets: a new switch the style adds (`sparkle: { on: true }`), read by its
  own code.
`cz check` and `cz package` warn (`looks`, medium) when engine.js `DEFAULTS` differs from the base's on a key the base
look sets: "this change is hidden by the look". Move that value into style.json `defaults`.

## Stage 0: setup (5-10 min)

**Inputs:** the member's request, their references (`refs/` in the kit folder, or wherever they point).
**Do:**
1. `cz doctor` (once per session): runtime, browser, ffmpeg, the app's resources. Fix what it reports first.
2. Ask only what only the member knows, in one message: the style's name, the formats (16:9, 9:16 or both), what the
   videos are about (topics, length, short or long form), who appears in them (a main character, people, no one), and
   the base if it isn't obvious from the references (offer 2 bases with one reason each; docs/ENGINES.md).
3. `cz new <name> --base <base> --aspects <a> [--dim 2d|3d]`. `<name>` is lowercase with `-` (`midnight-files`; the
   display name "Midnight Files" and the id `custom-midnight-files` come from it). List every format the member wants
   (`--aspects 16:9,9:16`): without it the style gets only the base's first one. `--dim` is for the starter only.
4. `cz check <style>` once on the untouched copy: no high finding, every must-fail view firing (warnings about the
   base's own files, "base debt", are expected). A high finding here means the kit or the machine is broken: tell the
   member before building anything on it.
5. Make a save point: `git init` inside `styles/<name>/` with a `.gitignore` of `.cz/stills/`, `out/`,
   `reference/shots/`, `reference/sheets/` and `review/`, and commit after every approved stage (git comes with
   Toon Studio's installer). "Go back to before the fonts change" is then one command.

**Gate:** the style folder exists and its untouched copy has no high finding.

## Stage 1: study (15-30 min)

**Inputs:** the references (videos, pictures), the brief. No references: write the brief into ANALYSIS.md in numbers
(palette in hex, sizes, durations) and skip the measuring.
**Output:** `reference/ANALYSIS.md`, every heading of docs/templates/STUDY.md filled. Nothing else changes.
**Gate:** no "_(to fill)_" left; at least 5 hex colours; the Pacing section in numbers when a reference is a video.
**Typical failure:** adjectives instead of numbers ("moody, cinematic") and re-estimating what ffmpeg can measure.

The style takes the LOOK of the references, never their content: no faces, logos, characters or artwork traced or copied.
The member's reference files never go into a package (only reference/ANALYSIS.md does).

### Measure, then look (bash; on Windows Claude Code's shell is Git Bash, so these work as written)

Run from the kit folder. Below, `$R` is the reference (e.g. `refs/video1.mp4`) and `$O` is `styles/<name>/reference`
(make `$O/shots` and `$O/sheets` first). Each reference gets a short tag (v1, v2, img1) used in every file name.

1. **What it is:** `ffprobe -v error -show_entries format=duration:stream=codec_type,width,height,r_frame_rate -of compact "$R"`
2. **Scene scores for every frame** (the cut detector's raw material; low scores are kept on purpose, dissolves live there):
   ```
   ffmpeg -hide_banner -nostats -i "$R" -map 0:v:0 -an \
     -vf "scale=256:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score" -f null - 2> "$O/scores_v1.txt"
   ```
3. **Cuts and shot lengths:** save this as `$O/cuts.mjs` and run `node "$O/cuts.mjs" "$O/scores_v1.txt" <seconds>`.
   It is the rule the app's own study used: a hard cut is a score >= 0.3; a soft cut (dissolve, whip, fast push) is a
   spike >= 0.12 and >= 3.5x the median of the 12 frames on each side; cuts closer than 0.3 s are one.
   ```js
   import fs from 'node:fs';
   const [file, len] = [process.argv[2], +process.argv[3]];
   const sc = []; let t = -1;
   for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
     const a = /pts_time:([\d.]+)/.exec(l); if (a) { t = +a[1]; continue; }
     const b = /scene_score=([\d.]+)/.exec(l); if (b && t >= 0) sc.push({ t, s: +b[1] });
   }
   const cuts = [];
   sc.forEach(({ t, s }, i) => {
     if (t <= 0.3 || t >= len - 0.05 || s < 0.12) return;
     let hit = s >= 0.3;
     if (!hit) {
       const w = [...sc.slice(Math.max(0, i - 12), i), ...sc.slice(i + 1, i + 13)].map(x => x.s).sort((x, y) => x - y);
       hit = s >= 3.5 * Math.max(w[w.length >> 1] ?? 0, 0.02);
     }
     if (hit && t - (cuts.at(-1) ?? 0) > 0.3) cuts.push(+t.toFixed(3));
   });
   const starts = [0, ...cuts], lens = starts.map((s, i) => +((starts[i + 1] ?? len) - s).toFixed(2));
   const q = (v, p) => { const s = [...v].sort((a, b) => a - b), x = (s.length - 1) * p, lo = Math.floor(x); return +(s[lo] + (s[Math.ceil(x)] - s[lo]) * (x - lo)).toFixed(2); };
   console.log(JSON.stringify({ shots: lens.length, cutsPerMin: +(cuts.length / (len / 60)).toFixed(1),
     shotLen: { median: q(lens, .5), p10: q(lens, .1), p90: q(lens, .9), mean: +(len / lens.length).toFixed(2) }, cuts, lens }));
   ```
   A long dissolve spreads over many frames of small scores and can slip under both rules. Cross-check with a low
   threshold: `ffmpeg -hide_banner -i "$R" -an -vf "scale=320:-2,select='gt(scene,0.1)',showinfo" -f null - 2>&1 | grep -o "pts_time:[0-9.]*"`.
   A candidate that is not in the cut list: look at frames 0.3 s before and after it, then decide (and say so in ANALYSIS.md).
4. **One frame per shot** (0.4 s into the shot, or its middle when shorter), numbered in order from 001:
   `ffmpeg -v error -ss <t> -i "$R" -frames:v 1 -q:v 3 "$O/shots/v1_007.jpg"`
5. **Contact sheets for the overview only** (never as proof of anything):
   `ffmpeg -v error -framerate 1 -i "$O/shots/v1_%03d.jpg" -vf "scale=320:-2,tile=6x4:padding=4" "$O/sheets/v1_%02d.jpg"`
6. **Motion of a shot** (how things enter, how the camera moves): a 12 fps strip of its first second:
   `ffmpeg -v error -ss <t> -t 1 -i "$R" -vf "fps=12,scale=320:-2,tile=6x2" -frames:v 1 "$O/shots/v1_007_motion.jpg"`
7. **Palette:** every shot frame, weighted by its shot's length, clustered (k-means, k = 8, fixed seed: the same frames
   always give the same palette). Accents are the saturated clusters under 25 % share (a saturated background belongs to
   the palette, not the accents). Save as `$O/palette.mjs`, run `node "$O/palette.mjs" "$O/shots/v1_001.jpg=2.95" "$O/shots/v1_002.jpg=5.9" ...`
   (`=<shot length in s>`):
   ```js
   import { spawnSync } from 'node:child_process';
   const px = [];
   for (const arg of process.argv.slice(2)) {
     const [file, w = '1'] = arg.split('=');
     const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=48:-1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: 1 << 24 }).stdout;
     const n = raw.length / 3;
     for (let i = 0; i < n; i++) px.push([raw[i * 3], raw[i * 3 + 1], raw[i * 3 + 2], +w / n]);
   }
   let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
   const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
   function kmeans(P, k) {
     if (!P.length) return [];
     const C = [P[Math.floor(rnd() * P.length)].slice(0, 3)];
     while (C.length < k) {
       const D = P.map(p => Math.min(...C.map(c => d2(p, c))) * p[3]), sum = D.reduce((a, b) => a + b, 0);
       if (!sum) break; let r = rnd() * sum, i = 0; while ((r -= D[i]) > 0 && i < D.length - 1) i++; C.push(P[i].slice(0, 3));
     }
     let W = [];
     for (let it = 0; it < 20; it++) {
       const S = C.map(() => [0, 0, 0, 0]);
       for (const p of P) { let b = 0; C.forEach((c, j) => { if (d2(p, c) < d2(p, C[b])) b = j; }); S[b][0] += p[0] * p[3]; S[b][1] += p[1] * p[3]; S[b][2] += p[2] * p[3]; S[b][3] += p[3]; }
       S.forEach((s, j) => { if (s[3]) C[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; }); W = S.map(s => s[3]);
     }
     const out = [];
     C.map((c, j) => ({ c, w: W[j] })).sort((a, b) => b.w - a.w).forEach(x => {
       const m = out.find(o => Math.sqrt(d2(o.c, x.c)) < 22);
       if (m) { const t = m.w + x.w; m.c = m.c.map((v, i) => (v * m.w + x.c[i] * x.w) / t); m.w = t; } else out.push(x);
     });
     return out;
   }
   const total = px.reduce((a, p) => a + p[3], 0);
   const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
   const fmt = L => L.map(x => ({ hex: hex(x.c), share: +(x.w / total).toFixed(3) })).filter(x => x.share >= 0.005);
   const sat = p => { const mx = Math.max(p[0], p[1], p[2]), mn = Math.min(p[0], p[1], p[2]); return mx > 40 && (mx - mn) / mx > 0.45; };
   console.log(JSON.stringify({ palette: fmt(kmeans(px, 8)), accents: fmt(kmeans(px.filter(sat), 5)).filter(x => x.share < 0.25).slice(0, 4) }));
   ```
   Quick region check of one frame (12 regions, 4 x 3, mean colour each, left to right, top to bottom):
   `ffmpeg -v error -i "$O/shots/v1_007.jpg" -vf "scale=4:3:flags=area" -f rawvideo -pix_fmt rgb24 pipe:1 | xxd -p -c 3`
8. **Sound:** `ffmpeg -hide_banner -nostats -i "$R" -map 0:a:0 -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|LRA:|Peak:"`
   (integrated LUFS, loudness range, true peak). Pauses: `-af silencedetect=noise=<I - 20>dB:d=0.25`.
9. **Words per minute and cuts on words** need a transcript with word times: subtitles that came with the video
   (`ffmpeg -v error -i "$R" -map 0:s:0 "$O/v1.srt"` when they are embedded), a transcript the member gives you, or none. With word
   starts: words per minute, pauses between words, and the share of cuts within 0.15 s of a word start next to the share
   chance would give (the total length of all [start - 0.15, start + 0.15] windows divided by the duration). No
   transcript: write "skipped: no transcript" in Pacing. Never guess these numbers.
10. **Then look:** read every contact sheet, then single shot frames at full size where detail matters (type, edges,
    texture), and the motion strips of the shots whose movement you describe. Measure what ffmpeg can't: sizes in px at
    1920 wide (1080 wide for 9:16), durations of moves in seconds, shares of running time.

Write ANALYSIS.md from docs/templates/STUDY.md. The "Narration trigger -> visual" rules (at least five) are the most useful
part for later: what happens on screen when a number, a name, a place or a date is said, and how fast.

## Stage 2: style guide + 3 hero frames (30-45 min). STOP after it.

**Inputs:** ANALYSIS.md (or the brief), docs/bases/<base>/extend.md + dont.md, the base API
(`bases/<base>/skill/references/engine_api.md`; stickman: `script.md` + `catalog.md`), docs/NO_SLOP.md.
**Output:** skill/STYLE_GUIDE.md and skill/QUALITY.md filled (docs/templates/); the engine restyled at its extension points
(a new theme / palette in THEMES or C, fonts, finish) and selected and tuned in style.json `defaults` (theme, post, camera:
"How settings reach the engine" above); `scenes/hero.js` with 3 shots held still for 2 s each: a title moment, a
typical explanation frame, a busy frame. A `hero` view in project.json (it is there from `cz new`).
**Command:** `cz check <style> --views hero`, then `cz stills <style> hero --times 1,3,5 --scale 1` in every declared
aspect (`--aspect 9:16` for the tall one). Read every still at full size.
**Gate:** every heading of STYLE_GUIDE.md and QUALITY.md filled with numbers; hero boots in every aspect with no high
finding; you looked at all 3 frames in every aspect; **the member approved them.**
**Typical failure:** building new elements here (that is the kit stage), leaving the base's own palette or fonts in a
frame, and polishing motion before the direction is approved.

Steps:
1. Decide palette roles first (background, ink, surface, 1-3 accents, good / bad), as hex, and check every text / ground
   pair for contrast (>= 4.5:1 target; the engine's own minimum is the floor, not the target).
2. Restyle through the extension points only (extend.md): define the new theme / palette / finish in the engine (add a
   `THEMES` key, `C` values, a post pass, exports), then **select and tune it in style.json `defaults`**
   (`"theme": "<yours>"`, `"post": { ... }`, `"camera": { ... }`): those beat the base's default look. Changing a value in
   engine `DEFAULTS` that the base look also sets does nothing (`cz check` warns: "hidden by the look"); `DEFAULTS` is for
   new keys only. Never remove or rename an export. Bump `ENGINE_VERSION` in engine.js (exact format
   `export const ENGINE_VERSION = N`).
3. Fonts: only licensed files (OFL, Apache-2.0, or the member's own). Copy the file into `fonts/` with its licence text
   next to it, add the `FONT_FILES` row, point the font table at the family. The fonts the bases already ship are free to
   reuse: Inter, JetBrains Mono, Orbitron, Share Tech Mono and the collage set are OFL (collage's typewriter face,
   Special Elite, is Apache-2.0).
4. Hero first in the main aspect, show it, then make the other aspect hold before the stage closes.
5. **Show the member** (CLAUDE.md, "Showing the member"): the 3 frames, the palette with hex, the fonts, one sentence on
   what you took from the references. Ask for approval or changes. Do not start the kit before a yes.

## Stage 3: the element kit (30-90 min). STOP after it.

**Inputs:** STYLE_GUIDE.md "Elements", the approved hero frames, the engine.
**Output:** every element the style needs (panels, cards, labels, props, characters' outfits, transitions, caption
treatment) built where extend.md says (a registerElement / a lib module / models.js), and shown ALONE in `scenes/kit*.js`:
one element per shot, whole, centred, at full size, held 1.5 s after it lands, **once on a light ground and once on a dark
ground** (an edge that vanishes on one of them shows there). Animated elements show their entrance and their hold.
Shot titles are the element names (the member flags elements by name).
**Command:** `cz check <style> --views kit`; `cz stills <style> kit --times <one per element, after it settles> --scale 1` in every
aspect; `cz preview <style> kit` for the member.
**Gate:** kit view clean; each element looked at full size (crop small text 1:1, see "Looking" below); **the member approved
every element** (or each flag was fixed and approved).
**Typical failure:** shading or highlights drawn outside an element's own outline; one element shaded and its neighbour
flat; judging an element only at scene size; a composite assembled inside a scene instead of the kit.

Rules: nothing goes into a sample that is not in the kit. An element is judged alone at roughly 600 px before any scene
uses it (flat's element gate; true for every base). Same stroke weights, corner radii and light direction across the set.

## Stage 4: must-fail scenes, written FIRST (15-30 min)

A check is trusted only after it was seen to fail on a known-bad case. A check that prints nothing at all is a broken
pipe until proven otherwise (the recon audit went silent for three films because warnings were not forwarded).

**Inputs:** the base's must-fail views (already in project.json from `cz new`), QUALITY.md "This style's own findings".
**Output:** for every rule the style adds that a machine can check, and for every base check whose subject the style
restyled, a `scenes/mustfail_<what>.js` that breaks exactly that rule, and a view
`"mustfail_<what>": { "scenes": ["mustfail_<what>"], "end": 3, "expect": "<FINDING TYPE>" }`.
**Order (test first):**
1. Write the must-fail scene, run `cz check <style> --views mustfail_<what>`. For a new rule it must come back red
   (`mustfail`: the view did not fire, because the check doesn't exist yet). Seeing it red is the point. For a base check
   on a restyled element it should fire at once; if it doesn't, the check can't see your element (a text plate without
   `userData.bg`, an element kept out of `st`): fix the element, not the check.
2. Write the check (a `LAYOUT_CHECKS` entry, or the base's documented hook: extend.md).
3. Run it again: the must-fail view now fires its `expect`, and hero, kit and sample stay clean of that type.
**Gate:** every must-fail view fires; the base's must-fail scenes are untouched and still fire.
**Typical failure:** "fixing" a must-fail scene so it passes (it exists to fail); loosening a threshold until the real
scenes pass; a check that throws (it is caught, printed once as "layout check: ..." and finds nothing).

Examples of style rules worth a check: "one accent colour on screen at a time", "titles never below the top third",
"a card never covers the subject's box". Pixel art and stickman have no layout check: their must-fails exercise the frame
check (BLANK, DARK); a style may add `layoutIssues` / `checkTimes` exports there (host.js calls them when present) and then
writes must-fails for them.

## Stage 5: the sample (30-60 min). STOP after it.

**Inputs:** the kit, STYLE_GUIDE.md, the sample narration (`audio/timeline.json`: words with times; `script.txt`).
**Output:** `scenes/sample*.js`: 15-30 s of the narration as a finished video in the style, in every declared aspect,
from kit elements only. A plan comment at the top of the scene: one shot per sentence or clause, what lands on which word.
**Command:** `cz check <style> --views sample` (all aspects); `cz stills ... --scale 1` at every shot's start, middle and end in every
aspect; consecutive frames at every transition and every contact ("Looking" below); `cz export <style> sample --to 5`
once per aspect; `cz preview <style> sample` for the member.
**Gate:** sample clean in every aspect (boot, layout, frames); every element lands 0-0.15 s before its word (use
`cue('word', near)`, never raw seconds; stickman: the `>` lines and `@word` beats); text held >= 1.5 s after it settles;
**the member watched it and approved.**
**Typical failure:** stopping at "clean" (checks catch layout, not taste); numbers that fit one aspect only (x = 700 is
off-frame in 9:16: derive from W, H, ZONE, SAFE or the base's layout values); a new element kind invented here.

The member's own narration for the sample: they make a Toon Studio project with that voice-over (the app transcribes it),
and you copy its `audio/timeline.json` into the style's `audio/` and its `script.txt` into the style folder. Never edit
timings by hand.

## Stage 6: the review loop (10-20 min a round, 3-8 rounds)

**Inputs:** every view's checks and frames, QUALITY.md, NO_SLOP.md, PITFALLS.md, REVIEW.md (open findings).
**One round:**
1. Run `cz check <style>` (every view, every aspect). Add each new finding to REVIEW.md as
   `finding -> meaning -> fix`, in the words the check printed.
2. Frame review (look, don't fix): every view except must-fails, every aspect, each shot at start, middle and end at full
   size; consecutive frames wherever something moves near something else, at every grab and release, every transition.
   Judge against STYLE_GUIDE.md, QUALITY.md, NO_SLOP.md and these questions no check measures: is anyone hidden or
   headless? Is the subject covered? Does the picture show what its words say? Would a first-time viewer get it without
   sound? File each fault in REVIEW.md with view, aspect, time and element.
3. Fix, worst first, in this order when several are open: camera -> geometry and layout -> poses -> checks clean ->
   materials -> light and grade -> type and motion polish. Fix at the cause; the smallest change that removes the fault.
4. Look again only at the moments you changed, in every aspect. Then mark the finding fixed in REVIEW.md and write its
   lesson as one line in skill/PITFALLS.md (a rule that holds outside this style, e.g. "a label on a busy photo gets a
   plate: contrast 1.9:1 on #8a7f6e failed").
5. Every ~3 rounds: a **fresh critic** (docs/CRITIC.md). Verify each claim before acting (below), log it in REVIEW.md as
   accepted (then fixed) or rejected (with the evidence).

**Stop rule:** no high finding; no medium finding unless REVIEW.md says why it is intended; the critic's score >= 8 with
target frames (>= 8 against the notes without them), or two critics in a row within +-0.5 (a plateau: show the member
and ask), or 8 rounds (show the member what is left).

**Verifying a critic's claim** (critics are reliable on materials, light, colour and poses; unreliable on hidden
geometry, and "the camera is off" was wrong in 2 of 5 cases in the shot-match tests):
- side by side: `ffmpeg -v error -i target.jpg -i render.png -filter_complex "[0:v]scale=-2:960[a];[1:v]scale=-2:960[b];[a][b]hstack" side.jpg`
- 50/50 blend (shapes in different places show double, a colour cast shows as a tint):
  `ffmpeg -v error -i target.jpg -i render.png -filter_complex "[1:v][0:v]scale2ref[b][a];[a][b]blend=all_mode=average" blend.jpg`
- the target's edges in cyan over the darkened render (where cyan misses the render's shapes, composition, camera height or
  horizon differ):
  `ffmpeg -v error -i target.jpg -i render.png -filter_complex "[0:v]edgedetect=low=0.08:high=0.2,dilation,format=gbrp,colorchannelmixer=rr=0:gg=1:bb=1[e];[1:v][e]scale2ref[r][e2];[r]format=gbrp,colorchannelmixer=rr=.45:gg=.45:bb=.45[d];[d][e2]blend=all_mode=lighten" edges.jpg`
- the same region of both, stacked (centre third shown; change the crop for another region):
  `ffmpeg -v error -i target.jpg -i render.png -filter_complex "[0:v]crop=iw/3:ih/3:iw/3:ih/3,scale=640:-2[a];[1:v]crop=iw/3:ih/3:iw/3:ih/3,scale=640:-2[b];[a][b]vstack" crop.jpg`
- region colour means (12 regions, 4 x 3, left to right, top to bottom) for palette, grade and light claims:
  `ffmpeg -v error -i X -vf "scale=4:3:flags=area" -f rawvideo -pix_fmt rgb24 pipe:1 | xxd -p -c 3` on both, then compare.
A claim with no evidence on these sheets is rejected with that evidence written down ("the edge overlay shows the horizon
within 5 px of the target's"). Layout converges in 1-2 passes once measured; scores stay around 6 until poses are right.

## Stage 7: sign-off (15-30 min). STOP after it.

Nothing is packaged before every line is true; write the record into REVIEW.md ("looked fine" is not a record):
- `cz check <style>`: no high finding in any view or aspect; every must-fail fires; `repeat` and `export` pass.
- `cz check <style> --controls`: every control the style added changes pixels between its min and max.
- The frame review of the last round covered every shot of sample, hero and kit in every aspect (list the times).
- docs/NO_SLOP.md section 7 answered for the sample: visibility, physical accuracy, camera, readability, banned overlays,
  sound, pacing. Grep the scenes for banned overlays (`stamp(`, verdict words, any AI-voice notice): zero hits.
- style.json texts written for the member and for every future video: `name`, `tagline`, `description`, and `prompts`:
  `build` (told on every build: short, concrete, in the guide's numbers), `context` (written into each project's notes),
  `qualityBar` (the one paragraph every shot is judged by), `reframe` when the style has both aspects, `imageStyle` when
  videos use generated pictures, `ignoreBaseRefs` (base skill files whose LOOK the style replaces). No other style's
  vocabulary ("front page" outside a newspaper style).
- At least one look in `looks/`; its settings validate against the style's controls (`cz check`, `looks`), and every look
  was rendered and looked at: `cz check <style> --look <id>` (the render checks with that look's settings over the style's)
  and `cz stills <style> sample --times ... --scale 1 --look <id>` (files named `<view>_<aspect>_<look>_t<time>.png`). A look
  that names a `format` keeps it: it must be one of the style's aspects.
- CREDITS.json covers every asset not from the base; every font has its licence file next to it.
- `ENGINE_VERSION` raised since the last package if engine.js changed.
**Show the member** the final sample (`cz preview`) and the sign-off record. Package on their yes.

## Stage 8: package (5-10 min)

`cz package <style>` writes `dist/<id>/` and `dist/<id>.zip` (id = `custom-<name>`) with the manifest's `kit` block,
`preview.mp4` and `poster.jpg`, and runs the static checks on the result. When the engine changed since the last package
and `ENGINE_VERSION` did not rise, it raises it in the style's engine.js and says so (the app installs a re-import as a
new version only when the engine version rose with its content). Its render checks are `cz check`, already clean from
sign-off. Then hand over (CLAUDE.md, "Hand-over"). The import in the app runs the same checks with the same words
(docs/CHECKS.md).

## Stage 9: battle test in the app (the member, with you on call)

A style is proven by real videos, not by its sample. After the import, the member makes 1-3 real videos in it: their
real topics, the length they really publish (a long-form style needs one long video), each declared format once. They
watch every one in full. Every fault they find comes back here as a finding: reproduce it in a view (often the sample, or a
new view built from the video's scene), fix, add the lesson to PITFALLS.md, `cz check`, `cz package`, re-import (a new
version). If the app's own Claude fixed something during import, bring that back first: the member exports the package
from the style card and you run `cz import-package <zip>` (docs/PACKAGE.md).

## Looking at frames (the proof)

- **Full-size frames are the proof.** `cz stills <style> <view> --times ... --scale 1` renders real frames through the
  same host page the app uses into `styles/<style>/.cz/stills/` (`<view>_<aspect>_t<time>.png`) and prints the paths.
  Read each one. The default scale is 0.5: fine for a quick look, never for judging text, edges or contact. Contact
  sheets are only an overview and never prove anything. `--look <id>` renders with a look from `looks/` (stills, check,
  export and preview all take it).
- **Small text and edges:** crop the region 1:1 and read the crop:
  `ffmpeg -v error -i still.png -vf "crop=640:360:<x>:<y>" crop.png`.
- **Consecutive frames** 0.1-0.3 s apart at every transition, contact, grab or release, entrance and exit, fast move:
  `cz stills <style> sample --times 4.0,4.1,4.2,4.3,4.4,4.5 --scale 1`. For a quick overview, tile the six files (copy them to
  `seq1.png` ... `seq6.png`, then `ffmpeg -v error -i seq%d.png -vf "scale=640:-2,tile=3x2" seq.png`), then read single
  frames where something touches.
- **Motion and timing:** `cz export <style> sample --to 5` (into `styles/<style>/out/`) and pull 6 consecutive frames from the encoded file
  (`ffmpeg -v error -ss <t> -i <the exported mp4> -vf "scale=640:-2,tile=3x2" -frames:v 1 seq.jpg`): what the export shows
  is what the member gets.
- Look again only at the moments you changed. Don't re-render a whole video to check one moment.

## Writing findings

One line: **finding -> what it means -> exact fix**, in the words the check prints, with numbers:
- `overlap: label "1440" covers 18% of cutout "press" -> the date hides the subject -> move the label to y -3.2 (own row)`
- `DARK: too dark to read (mean 0.072 < 0.1) -> the shot reads as a black screen -> fill at 40 % of the key, a lamp in frame`
- `contrast: #1c1c1e on #2a2a2e is 1.3:1, needs 4.5 -> unreadable -> text #f2f2f0`
Never "a bit hard to read", never "looks off". Colours as hex, times in seconds, sizes in px or units, loudness in LUFS.

## Making styles fast

- **First visible result early:** the hero frames within the first hour. Restyle what the base already draws before
  building anything new; most of a look is palette, type, finish and camera feel.
- **Don't polish before the direction is approved:** no motion polish, no kit, no sample until the member said yes to the
  hero frames. A rejected direction costs 30 minutes then, a day later.
- Build in the main aspect, check the other one at each gate (not at the end).
- Batch: one `cz stills` call with all the times you need; one `cz check` per round, not per edit.
- Fix at the cause once, write the lesson, move on. Never hide a finding with an "intended" flag that isn't true
  (`over`, `bleed`, `sparse`, `airborne`).
- When the direction is unclear, ask one question with 2-3 options and the frames that show them.

## Time budget (Claude's working time; the member's waiting is the scarce part)

| Stage | Budget | Over budget means |
|---|---|---|
| 0 setup | 5-10 min | the kit or machine is broken: report it |
| 1 study | 15-30 min | too many references: measure 3, skim the rest |
| 2 guide + hero | 30-45 min | building elements too early |
| 3 kit | 30-90 min | too many elements: ask which ones the videos need first |
| 4 must-fail | 15-30 min | a check the base can't support: say so, rely on frames |
| 5 sample | 30-60 min | elements missing from the kit: go back to stage 3 |
| 6 review | 10-20 min a round | the same finding twice: the fix is at the wrong place |
| 7 sign-off | 15-30 min | |
| 8 package | 5-10 min | |
