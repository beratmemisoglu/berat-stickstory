# Style Studio - the playbook

You build ONE of three things, stage by stage, in a workspace the app made:
- **a new style from scratch** on the plain starter engine (2D or 3D),
- **a style on top of an existing one** (its engine, reshaped; it keeps what that engine can do),
- **a look** for an existing style (settings + notes on the style's own engine, which never changes).

The request of every run names the stage, its inputs, its ONE output and its gate. Do that stage, nothing else.

## The workspace
| Path | What | Who writes it |
|---|---|---|
| engine.js, models.js, lib/ | the style's live engine (the package's engine/ at publish) | you, in the stages that allow it |
| fonts/, vendor/ | typefaces (add_font), three.js | the app |
| scenes/hero.js, kit*.js, sample*.js | hero frames, the kit gallery, the sample video | you, per stage |
| scenes/mustfail_*.js | scenes each check MUST flag (proof the check works) | the app (never edit) |
| skill/STYLE_GUIDE.md, QUALITY.md (LOOK.md for a look) | the style's written rules | you, from the templates' headings |
| skill/PITFALLS.md | lessons of fixed issues | the app |
| reference/ANALYSIS.md | the study of the references | you (study stage) |
| reference/stats.json, sheets/, shots/ | what the app measured in the references (cuts, shot lengths, palette, loudness, pauses, words per minute) | the app (study stage) |
| reference/ (everything else), audio/ | the user's references, the sample narration and its timing | the app |
| style.json | the manifest (schema: style.schema.json) | you fill text, controls, defaults; the app owns id, base, from, version, aspects |
| library/<id>/, library/lock.json | Library entries copied in by library_use (import them, never edit them in place) | the app |
| project.json, .suite/, .claude/ | the app's state, issues, these docs | never you |

## Stages
Styles: **brief > study > guide > kit > sample > review (loop) > publish**. Looks: **brief > study > look > review > save**.
| Stage | One output | Gate (checked by the app, not your word) |
|---|---|---|
| study | reference/ANALYSIS.md filled from reference/stats.json + the sheets | every section filled, at least 5 hex colours, Pacing in numbers when a reference is a video (skipped when there are no references) |
| guide | STYLE_GUIDE.md + QUALITY.md, engine restyled, scenes/hero.js (3 hero frames) | both files filled, hero.js present |
| kit | every element alone in scenes/kit*.js | a kit scene, Clean |
| sample | 15-30 s sample (scenes/sample*.js) on the sample narration, from the kit only | a sample scene, Clean in every aspect |
| look | settings (set_look_settings) + skill/LOOK.md | settings set, LOOK.md filled |
| review | fixes for the open issues, each resolved with its lesson | no open high-severity issue |
| publish / save | the app's checklist | the app |
Going back to a stage marks every later stage stale: redo them in order.

## How to work (every stage)
1. studio_state: stage, gate, the files you may write, the views.
2. Read stages/<stage>.md, bases/<base>/extend.md + dont.md, NO_SLOP.md, and the base engine's API (.claude/skills/<base skill>/references/engine_api.md).
   Search first: library_search before building an element, a scene or a fix (modules, recipes, looks, solutions and pitfalls from earlier videos and styles); library_use copies one in at the stages that write scenes/ or lib/, then library_note_outcome.
3. Change the files. After each change: check_preview (loads clean?), then check_layout until Clean.
4. Look: render_view <view> in EVERY aspect the style renders (16:9 and 9:16), at shot start, middle and end; scale 1 for small text.
5. File what you see but can't fix now with add_issue (finding -> meaning -> exact fix). Mark fixed issues with resolve_issue and the lesson.
6. Finish with 1-3 sentences.

## After your turn (the app, not you)
When your turn changed files, the app saves a **version** (a git save point + frames of every view in every aspect) and runs
its own checks on it: scenes that fail to load or throw, the engine's layout check per view and aspect, blank / too-dark
frames, frozen shots, banned calls in scenes/, lib/ and models.js, engine exports removed since the start (contract), and
every must-fail view (it must still report its check, or the check is broken). Each finding becomes an issue (high: boot,
throw, contract, broken check, banned call, cut, caption band, DARK; medium: overlap, small text, contrast; low: empty,
abrupt). A check's issue closes only when a later version no longer reports it; yours and the user's wait for the user's
OK after resolve_issue. Every lesson you give resolve_issue goes into skill/PITFALLS.md (the app writes it; it survives a
rollback).
Those lessons will also be saved to the Library as pitfalls of this base, so library_search finds them in every later video and style: write each as one rule that holds outside this workspace.

In Review the member can add TARGET frames (reference/targets/<id>.jpg, each tied to a view, frame and moment) and run the
match loop ("Run until good"): every version is laid over the targets (overlays in .suite/studio/renders/vN/match/), and a
fresh critic (another Claude that only reads) scores it 1-10 and files "(critic)" issues. Apply them; reject one only with
evidence (stages/fix.md). The loop stops at the member's score with no open high or medium issue.

## Enforced rules (the app refuses, it does not ask)
- No Bash, no web, no helper agents. Renders, checks and analysis are suite tools.
- You write only the paths your stage allows (the refusal names them). Never: project.json, .suite/, .claude/, reference/
  (except ANALYSIS.md), audio/, scenes/mustfail_*.js, qa/mustfail/, vendor/, fonts/ (use add_font), lib/contact.js, lib/collide.js, lib/check.js, lib/scan.js, skill/PITFALLS.md.
- The engine's exports may be ADDED, never removed or renamed: the host page and every project import them. Keep ENGINE_KIND.
- A look never edits the engine.
- Deterministic scenes: no Math.random(, Date.now(, performance.now( in scenes or per-frame code (use the engine's seeded rng where it has one).
- A check is fixed in the scene or the style, never by loosening the check. A must-fail scene must keep failing.
- Images (make_image) count against the workspace's image cap: plan them, make each once.

## Writing findings
One line: **finding -> what it means -> exact fix**, in the words check_layout prints (QUALITY.md lists them). Numbers, not
adjectives ("#1c1c1e on #2a2a2e has contrast 1.3, needs 4.5 -> unreadable -> text #f2f2f0").
