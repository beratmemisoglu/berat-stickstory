# Stage: review (the loop)

**Inputs:** the open issues (studio_state lists them; the request lists the ones to work on), every view's renders, the
check results, skill/QUALITY.md.
**One output:** fixes for exactly the issues named, each closed with resolve_issue and its lesson.
**Gate:** no open high-severity issue (the app also re-runs the checks after every round).

## Steps
1. For each issue: open where it is (view, aspect, time, file:line), render_view it, read the finding -> meaning -> fix.
2. Fix it in the scene or the style (never by loosening a check, never in a must-fail scene).
   Search first: library_search the finding in a few words; a solution or pitfall that already worked is the fix to try first (then library_note_outcome).
3. Look again (check_layout, render_view the same moment in every aspect). Only then resolve_issue fixed, with the lesson as one rule a future video follows.
   That lesson will also be saved to the Library as a pitfall (library_search finds it in later videos and styles).
4. A fix that touches the engine: check every view still loads (set_view each, check_preview), the exports are all still there.
5. New faults you see on the way: add_issue them; don't silently widen the round.
6. Critic issues ("(critic)"): the match loop's fresh critic filed them from the overlays against the member's target frames
   (reference/targets/; overlays in .suite/studio/renders/vN/match/). Apply every valid one. Reject one only with resolve_issue
   "wontfix" and a lesson that cites the evidence (the overlay, frame or check that shows it is wrong, e.g. "the edge overlay
   of t1 shows the horizon matches within 5 px"); without evidence the app refuses, and the next critic judges it.

## Frame review ("Run review": the request says FRAME REVIEW)
Look, don't fix: change no files in this run.
1. For every view (not the must-fail ones) in every aspect: render_view at each shot's start, middle and end, at full size.
2. Judge each frame against the brief, skill/QUALITY.md (for a look also skill/LOOK.md), NO_SLOP.md and PITFALLS.md:
   cut or crowded elements, text too small or low contrast, colours off the brief, dead shots, things that read as slop.
3. add_issue for each fault: one issue per fault, `where` exact (view, aspect, t, element), severity by what it breaks, the
   meaning in one line, the fix as the exact change (a setting and its value, a line of a scene). Never re-file an issue
   that is already open (the request lists them).
4. Finish with how many you filed and the worst one. The user picks what gets fixed.

## Don't
- Don't mark an issue fixed without looking at it again.
- Don't dismiss an issue a check or the user filed (only your own, with wontfix and the reason).
- Don't rewrite what works to fix one issue: smallest change that removes the fault.
