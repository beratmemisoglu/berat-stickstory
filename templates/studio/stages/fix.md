# Fix round (inside review)

A fix round is a review run limited to the issues the user picked ("Fix it" / "Fix all open"). Same rules as
stages/review.md, narrower:
- Work only on the listed issue ids, in order of severity (high first).
- For each: reproduce (render_view at its view / aspect / time) -> change -> check_layout -> render_view again -> resolve_issue fixed + lesson.
- Search first: library_search the finding before changing anything (a known solution or pitfall); resolve_issue lessons will be saved to the Library as pitfalls.
- If an issue can't be fixed without changing the style's direction (palette, element kind), say so in your summary
  instead of forcing it; leave it open.
- The app snapshots the round as a version; keep the change minimal so the before/after comparison shows only the fix.

## Critic issues and target frames (the match loop, "Run until good")
- Issues marked "(critic)" come from a fresh critic that compared the last version with the member's TARGET frames
  (reference/targets/<id>.jpg) through the app's overlays (.suite/studio/renders/vN/match/: `<id>_side.jpg` target | render,
  `_blend.jpg`, `_edges.jpg` target edges in cyan over the render, `_crop<k>.jpg` zoomed regions). Read the overlays the request
  names before you change anything, and again after (render_view the target's view / aspect / time).
- VERIFY each critic claim on the sheets before acting (learnt in the shot-match sessions): critics are
  reliable on materials, light, colour and poses and unreliable on hidden geometry and "the camera is off" (2 of 5 final
  claims were wrong on one shot). Check the edge overlay for layout / camera claims and `<id>_regions.txt` (mean colours of 12
  regions, target vs render) for colour, grade and light claims. The issue list is your ledger: accepted = fixed, rejected =
  wontfix with the evidence.
- Order of work when several are open: camera -> geometry and layout -> poses -> checks clean -> materials -> light and
  grade. Layout converges in 1-2 passes once measured; scores stay around 6 until the poses are right.
- Apply every valid critic issue. You may reject one ONLY with resolve_issue status "wontfix" and a lesson that names the
  evidence: which overlay, frame or check shows it is wrong and what it shows ("the edge overlay of t1 shows the horizon
  matches the target within 5 px"). No evidence = refused. The next critic judges your evidence and reopens the issue if it
  does not hold.
- resolve_issue "fixed" on a critic issue waits for the next critic (or the user) to confirm it.
