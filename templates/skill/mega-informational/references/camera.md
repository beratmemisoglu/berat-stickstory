# The camera (the owner's top priority)

The owner's verdicts on the showcase films: first "jittery, jaggy" (a camera that sat still, then spiked), then, after
a version with a fast zoom at every cut, "3-6 zoom-in transitions under 1 sec ... the camera should follow a path, go
on that, slow down or speed up, zoom in or out, but not be this frantic". And: build something safe and viewable rather
than chase the reference's pace. So: ONE calm, continuous move per shot; plain cuts between shots; nothing else.

## M.Flight (v4)
```python
t = lambda f: (f - 1) / 30
M.Flight([(t(F0), (0, -34, 14), (0, 0, 14), 24),          # (time, eye, target, lens[, roll[, hold]])
          (t(F0 + 30), (-6, -30, 26), (0, 0, 16), 24),
          (t(F1), (-10, -40, 38), (0, 0, 14), 26)]).bake(F0, F1)
```
- The keys only DRAW the path. The camera travels it with ONE smooth speed profile per shot: it eases in, cruises,
  eases out. Close keys never make a burst, and it never stops at a key.
- The path and the look direction are smoothed (smooth=3 frames); a slow creep toward the subject is added.
- No cuts inside a shot (`cuts=` is ignored unless `keep_cuts=True`): need two views? make two shots.
- No zoom transitions, no whips: a shot starts and ends inside its own calm move; the cut is a plain cut.
- Lenses are clamped to 14-50 mm; use 18-35 (wide: it reads scale). One lens per shot, or one slow zoom.
- `up=` for globes (the surface normal). A 6th key item `True` parks the camera at that key.

## Keys that look right
- 2-3 keys per 2-second shot, ONE kind of move: a push toward the thing named, an orbit around what is built, a rise to
  reveal scale, a pull back to show the result. Small distances: the camera moves 5-20 % of its distance to the subject
  in a 2-second shot, a turn of at most ~25 degrees.
- Keep the target on the subject; move the eye. A target that jumps between objects swings the view.
- The eye stays outside solids along the whole path (check the middle of the move too).

## The report
Every bake prints `CZ CAM ... N jerky frames` and `CZ CAMJERK <frames>`; check_layout turns 3+ jerky frames into a
"camera" issue: fewer, closer keys there.
