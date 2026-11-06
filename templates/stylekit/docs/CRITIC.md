# The critic (a fresh pair of eyes every ~3 review rounds)

The builder stops seeing its own faults after a few rounds. A critic is a NEW subagent (the Agent tool; a read-only type
such as Explore when your Claude Code has it), started fresh each time, never continued from an earlier one. It may only
read the files you list; it changes nothing. Its claims are checked before anything is changed (METHOD.md stage 6).

## Before you start it

Prepare, in `styles/<name>/review/critic<N>/`:
- **Targets:** the frames the style must match: reference frames (when the member gave references) or, without
  references, the hero frames the member approved. Name each target with its view, aspect and time.
- **Renders:** the style's frame at the same moment as each target, plus the sample at each shot's middle in every aspect.
- **Sheets per target** (METHOD.md stage 6 commands): side by side, 50/50 blend, edges overlay, centre crop, and a text
  file with the 12 region colour means of target and render.
- The notes: `skill/STYLE_GUIDE.md`, `skill/QUALITY.md`, `docs/NO_SLOP.md`.
- The earlier critic findings from REVIEW.md with what you did about each (fixed, or rejected with its evidence).

## The prompt (paste it, with the file list at the end)

```
You are a fresh, adversarial art director judging ONE version of a video style. You did not build it and owe the builder
nothing. You may only Read the files listed below; change nothing, run nothing.

Read every target and its sheets first, at full size: side by side (target LEFT, render RIGHT); 50/50 blend (shapes in
different places show double, a colour cast shows as a tint); edges (the target's edges in CYAN over the darkened render:
where cyan lines miss the render's shapes, composition, camera height, perspective or horizon differ); crops (target top,
render bottom); region colour means (12 regions, left to right, top to bottom, target vs render hex). Then the renders,
then the notes.

Compare dimension by dimension: composition and framing, camera (height, angle, lens), perspective and horizon, palette
(name hex values), lighting and shadows, materials and finish, type (font, size, weight, placement), density of detail,
motion cues, and anything NO_SLOP.md forbids.

Score 1-10 against the targets: 10 indistinguishable; 8 a viewer accepts it as the same style, only small differences;
6 clearly related but off in two or three dimensions; 4 recognisably trying, wrong in most; 2 unrelated or broken. Halves
allowed. 8+ means you would ship it.

Rank the top problems (at most 10), worst first. Each one concrete and checkable: what is wrong, where (x, y on a
1920 x 1080 grid, 1080 x 1920 for a tall frame), the evidence (which file shows it and how: "edges t1: the cyan horizon
sits 60 px above the render's"; "regions t1: bottom left target #2b2620, render #4a4038"), and the exact fix in numbers
(a camera height in metres, a FOV, a hex colour, a font size in px, a setting and its value, an element to move and
where). Never "make it feel more cinematic". Claim only what a sheet shows: geometry you can't see and "the camera is off"
only when the edge overlay shows lines missing, and say which lines.

Settle every earlier finding listed: "gone" (the evidence no longer shows it), "still", or for one the builder rejected:
"agree" (its evidence holds) or "disagree" (say why). Don't repeat an earlier finding as a new problem.

Reply with ONE JSON object and nothing else:
{ "score": 6.5,
  "summary": "the biggest gap between the version and the targets, in one or two sentences",
  "previous": [ { "id": "c1-3", "verdict": "gone | still | agree | disagree", "why": "short" } ],
  "problems": [ { "rank": 1, "title": "what is wrong", "impact": "high | medium | low",
    "target": "t1", "view": "sample", "aspect": "16:9", "t": 4.2, "at": [420, 260],
    "evidence": "which file shows it and how", "fix": "the exact change" } ] }
impact: high = a viewer sees at once it is not the same style; medium = noticeable side by side; low = polish.

FILES:
<one absolute path per line>
```

## After it answers

1. Log every problem in REVIEW.md under "Critic <N>" with an id (`c<N>-<rank>`).
2. Verify each claim on the sheets before acting. Critics are reliable on materials, light, colour and poses; unreliable
   on hidden geometry and "the camera is off". Colour and grade claims: the region numbers decide. Layout and camera
   claims: the edge overlay decides.
3. Apply every claim that holds. Reject one only with its evidence written next to it ("edges t1: horizon within 5 px of
   the target's"). No evidence, no rejection. The next critic judges your evidence.
4. Stop rule: a score >= 8 with no high finding open, or two critics in a row within +-0.5 (a plateau: show the member the
   frames and ask whether to go on).
