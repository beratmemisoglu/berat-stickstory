# Camera: the grammar, the calls, the recipes

Measured frame by frame on the owner's own short (the style's reference) and proven in five films. The finding that
redesigned the camera: the reference almost never cuts. The camera FLIES through one continuous set from framing to
framing; cut detection found 18 "shots" where there were 26 framings joined by flights.

## 1. The grammar (the numbers)

| | reference | how we author it |
|---|---|---|
| framings per 10 s | **4.5** (26 in 58 s) | 4.5-5.5; merge two framings before adding one; an extra push inside a framing is creep, not a framing |
| hold (framing) | median **21.5 f** (0.72 s), long holds where a scene plays out | the hold list is what the measure ranks (below) |
| flight | median **13 f** (6-30), speed peak in the MIDDLE (in-out ease) | `fly=16-20` (up to 22): the measure counts only the fast middle of an ease, so 18 authored frames read as ~12-13 |
| creep in holds | **0.19 % per frame** (never dead still) | `creep=0.0019` (the default); 0.0004 for a long hold near a foreground head |
| cuts | only on a set change or a time jump | `fly=0` |
| into a set change | a push that accelerates into the cut | `c.push(t_cut, 0.22-0.32, 0.4-0.6)` |
| a hit | a short decaying kick | `c.jolt(t)`; nothing else ever wobbles |

- Every framing ARRIVES 0-3 frames before its word, and the new framing opens on the new face: expression changes
  land as a flight arrives.
- Passing films: Japan 5.8 framings / 10 s, hold 27 f, flight 12 f, speed peak 0.50, creep 0.08 %/f; Jar 5.7, 26 f,
  11 f, 0.44, 0.17 %/f (margins: framings +-30 %, holds +-35 %, flights +-35 %, peak +-0.15, creep +-60 %).

## 2. The calls

`c = cam.Cam(name='cam', lens=32, fstop=2.2, sensor=24, bounds=None, min_fstop=1.9)`
- The sensor is 24 mm VERTICAL (9:16): horizontal field of view `hfov = 2 atan(6.75 / lens)` (18 mm: 41 deg, 24 mm:
  31.4 deg, 35 mm: 21.8 deg). Anything placed "in frame" from a 36 mm assumption lands outside.
- `bounds` = the room's walls minus a margin (`((x0 + 0.1, y0 + 0.1, 0.3), (x1 - 0.1, y1 - 0.1, H - 0.15))`). A framing
  whose eye would land outside is pulled in along its line of sight and the lens widened so the framing stays the same
  (a dolly-zoom): `CZ CAM t=31.40 mcu: wall at 2.02 m, lens -> 15.4 mm`. A big lens change there means the framing
  cannot fit: move the subject, or the bound. `CZ CAM t=..: subject outside the set bounds, no wall clamp` = you are
  framing something beyond the room (a corridor through a door): shoot it from inside, through the opening.

`c.frame(t, eye, target, lens=None, fstop=None, focus=None, creep=0.0019, fly=13, path=None, roll=0.0, follow=None, follow_k=1.0)`
- An exact framing, REACHED at t; its flight starts at `t - fly / 30` from wherever the previous hold has crept to.
  `lens`, `fstop` carry over from the previous framing when not given. `focus`: an object, `(object, offset)` or a
  point (default: the target). `path`: eye waypoints the flight bends through (a Bezier through them). `follow`: an
  object the framing rides with on the floor plane (`follow_k` of its motion).
- Creep: the eye dollies toward the target by `creep` per frame during the hold, capped at 35 % of the distance.

`c.shot(t, subject, size='cu', yaw=0.0, pitch=8.0, lens=None, head_y=0.40, head_x=0.5, head_d=0.48, rel=None, at=None, **frame_kw)`
- A framing by shot size: the frame's WIDTH spans `SPAN[size]` head widths (head_d 0.48 m):
  `ecu 0.78, cu 1.75, mcu 2.5, ms 3.7, mws 5.2, ws 9.0, xws 14.0` (or a number). The subject point (a head:
  `(c.head, (0, 0, 0))`) sits `head_x` across and `head_y` down from the top (head_y is the head CENTRE: the hair cap
  and tuft make a head read ~0.05 higher than the number).
- `yaw`: the camera's azimuth around the subject (0 = from -Y, + = from the subject's +X side); `pitch`: degrees above
  it, looking down. `rel=<Char>`: yaw is relative to that character's facing at the framing time (0 = straight in
  front of it). `at=`: read the subject's position and facing at that time instead (a subject still walking or turning
  when the flight starts: `at=t_walk_end`). Characters must be baked BEFORE shot() is called.
- Distance: `d = (span x 0.48 / 2) / tan(hfov / 2)`: a 32 mm MWS needs ~6 m, so small rooms get 18-24 mm wides (the
  bounds clamp does it for you).

`c.push(t_cut, amount=0.32, dur=0.6, lens_k=1.0)`: from the framing held at `t_cut - dur`, dolly `amount` of the way to
its target, cubic-in (the speed peaks ON the cut). `c.jolt(t, amp=0.035, frames=8)`: a decaying kick on an impact.
`c.bake(f0, f1, motion_blur=True, ink_px=7.0)`: LAST call of the file.

## 3. Timing framings (holds and flights)

- Two framings 0.7 s apart with 16-20 f flights leave NO hold: the next flight starts a frame after the previous one
  lands. Check `t_next - fly_next / 30 >= t_prev + 0.3` (0.4 s for a wide that has to read).
- A beat spoken during a flight is lost (the critics' most common defect): the framing lands 0-3 f before the word and
  holds through it; the next flight starts after the line ends.
- Grammar check from your own files (no renders needed): list every framing of the film in order as (t, fly). Hold
  i = `(t[i+1] - fly[i+1] / 30) - t[i]` in frames x 30; framings per 10 s = count / length x 10. Compare the median
  hold and the median flight with the table above.
- The median is a RANK: merging two short framings can jump the median from 22 to 31 f when the hold list has a gap.
  Adding frames to every flight does not help. Shorten the few holds just above the median by starting their next
  flight earlier (fly +6) and re-render only those frames. Moving a time cut onto the next phrase (+0.19 s) shrinks the
  hold after it and grows the one before. A slower reveal split into two holds made it worse: simulate the hold list
  before changing it.
- Settle the grade first, then the holds (the grade changes the pixel differences the hold measure uses).

## 4. Flights

- A straight flight between two far camera spots crosses what stands between (a column row, a round prop, a house):
  give it a `path=[(x, y, z)]` waypoint on the open side, outside every prop's footprint and clear of the cast, and
  check that the waypoint itself is not inside something (one landed inside a hut).
  ```python
  # an orbit round a big round prop: a long flight bent through a point in front of it, between the column rows
  # (the straight line between the two camera spots went through a column)
  c.shot(10.40, jc, 'mws', yaw=40, pitch=18, lens=24, head_d=0.5, head_y=0.45, focus=jc, fly=80, creep=0,
         path=[(jc[0] - 0.4, jc[1] - 4.6, 1.9)])
  ```
- A flight that ends INSIDE an open door leaf, an armrest, a tall prop or a head: the bounds know walls only. Check
  every camera spot against doors, furniture and the cast; pick the other side.
- **The lens blends during a flight** (log-lerp from the old lens to the new). A long-to-wide change mid-flight (40 ->
  15 mm) throws the subject's torso across the frame and, with the motion blur, reads as "the camera passes through
  him". Change the lens BEFORE or AFTER a flight: give both framings the same lens and put the lens change in a hold
  (a cut, or a separate short framing).
- Motion blur: shutter 0.3 by default (0.5 smeared fast flights to pure blur; at 0.3 eyes, mouths and ornament stay
  readable while the move still reads as motion). For a very fast move key a short shutter on those frames only:
  ```python
  def shutter_spans(lo, spans):          # e.g. shutter_spans(0.08, [(81, 86)])
      sc = bpy.context.scene; hi = sc.render.motion_blur_shutter
      for f, v in [(1, hi)] + [p for a, b in spans for p in ((a - 1, hi), (a, lo), (b, lo), (b + 1, hi))]:
          sc.render.motion_blur_shutter = v; sc.keyframe_insert(data_path='render.motion_blur_shutter', frame=f)
      sc.render.motion_blur_shutter = hi
  ```
  Call it after `c.bake` (which sets the shutter). Streaming backgrounds that must stay crisp (fields past a moving
  car): `c.bake(B0, B1, motion_blur=False)`.
- **Euler unwrap.** A camera looking about -Y sits at z ~ +-180 deg; a pan across it flipped the key +179 -> -179 and
  EEVEE's vector blur drew a 358 deg spin (whole frames of smear; clean with `CZ_SHUTTER=0.01`). `cam.bake` unwraps
  every channel now. Anything else whose rotation you key across +-180 (a turning prop, a camera you bake yourself)
  must be unwrapped the same way:
  ```python
  def unwrap_euler(obj):
      for fc in cz._fcurves(obj.animation_data.action, obj, 'rotation_euler'):
          prev = None
          for kp in fc.keyframe_points:
              v = kp.co[1]
              if prev is not None:
                  while v - prev > math.pi: v -= 2 * math.pi
                  while prev - v > math.pi: v += 2 * math.pi
              kp.co[1] = v; kp.handle_left[1] = v; kp.handle_right[1] = v; prev = v
          fc.update()
  ```

## 5. Framing rules (9:16, phone size)

- Every narration line gets its exact picture: an angle that SHOWS the thing ("his chair is pushed in" needed a high
  side angle; flat things on the floor or a table need a high camera or top-down).
- Never the back of a head in a close shot: angles relative to the character (`rel=`), turns finished before the
  camera arrives (or `at=` the landing time). Never a dead-frontal head: 15-20 deg of yaw plus a tilt.
- Inner-thought reactions turn to the camera first (a reaction CU of someone facing a partner puts the partner's head
  in the foreground).
- Subject on a third, the whole head in, ~10 % headroom; a sign is whole in the frame or out of it (a plaque cut by
  the frame edge was flagged in five shots).
- A reveal pull-out aimed at the set's centre pushes an off-centre subject out of the frame by its end: aim between
  the subject and the set (subject in a third), checked with hfov.
- A reverse over a foreground character: compute the azimuths of the foreground character, the subject and the prop
  and pick the lens so all fit inside +-hfov / 2 (18 mm: +-20.5 deg).
- Sitters in big furniture: MCU from above the seat's front edge (pitch +14); a CU camera spot can be inside an
  armrest.
- Counter / table inserts: shoot from above, the eye beyond the reach of the nearest character's hair.
- Don't repeat a framing: the same bell CU four times was flagged as repetition. Vary height, side, lens, subject.
- Computed aims were off by ~0.1 of the frame (the rig's head sits higher than the arithmetic): render the framing,
  measure where the head is, correct the aim (+0.11..0.16 m was typical).
- Once a framing is measured as matching, change the camera or the set, not both, and never a dimension other
  framings depend on.
- Lenses that worked: wides in rooms 16-24 mm, MS / MCU 24-35 mm, CU inserts 40 mm, top-down inserts 13-35 mm from
  0.2-2.5 m, long-lens CUs (40-45 mm) to make a background big and soft.
- Depth: a foreground element in many shots (a big out-of-focus shoulder, a hat, a lamp, a plant).

## 6. Depth of field

Focus follows the framing's subject every frame (also mid-flight). `min_fstop` caps how shallow it gets: 1.9 by
default, 2.4 for densely dressed sets (f/1.4-1.8 CUs blurred a dressed hall to mush and capped detail parity at 0.44
whatever the set held). A wide of a room reads sharp in the reference: f/5-7 (`fstop=7.0, min_fstop=4.5`). A road or
landscape: f/8-11. Wide lenses barely show DOF (28 mm f/2): CU inserts at 40 mm. Jittered DOF is on (smooth bokeh on
out-of-focus foreground edges).

## 7. Recipes (from the films)

```python
c = cam.Cam(lens=24, fstop=2.4, bounds=((-2.85, -2.35, 0.15), (2.85, 2.35, 2.48)), min_fstop=2.0)
dh = (derek.head, (0, 0, 0))
c.frame(27.80, (0.25, 0.02, 2.45), (0.25, 0.42, 0.0), lens=13, focus=(0.4, 0.4, 0.0), fly=0, creep=0.0012, fstop=4.0)   # top-down: the floor of cards
c.frame(29.62, (0.25, -1.75, 0.62), (0.68, 0.55, 0.62), lens=26, focus=dh, fly=20, creep=0.0022, fstop=2.0)           # low MS: he stares
c.shot(42.85, dh, 'mcu', yaw=-14, pitch=6, lens=30, head_y=0.4, head_x=0.45, focus=dh, fly=18, creep=0.0022)             # the eureka
c.push(F1 / 30, 0.3, 0.5)
c.bake(F0, F1)
```
- Relative MCU on a talker: `c.shot(31.0, mh, 'mcu', yaw=18, rel=m, pitch=3, lens=35, head_y=0.4, head_x=0.45, focus=mh, fly=12, creep=0.003)`.
- Framing a subject that is still moving: `c.shot(43.3, mh, 'ms', yaw=14, rel=M, pitch=5, lens=28, head_y=0.33, focus=mh, fly=14, at=43.3)`.
- Tracking a walker: `c.shot(29.40, ih, 'mws', yaw=70, pitch=8, lens=24, head_y=0.36, focus=ih, fly=0, creep=0, follow=inv.head, follow_k=1.0)`.
- A slow truck across a room = one long flight: `c.shot(38.6, hh, 3.6, yaw=2, pitch=12, lens=16, head_x=0.64, head_y=0.62, focus=hh, fly=84, creep=0.0006)`.
- A whip into the next shot's first framing: the last framing of the shot is the next file's first, reached with `fly=4`.
- A CU of a prop (the shovel by the door): `shp = (rx - 0.45, Y1 - 0.42, 0.62); c.shot(30.1, shp, 'cu', yaw=14, pitch=6, lens=40, head_d=0.7, head_y=0.46, focus=shp, fly=16, creep=0.0019)`
  (`head_d` = the width in metres the size counts in; 0.7 here, the prop's own scale). Top-down inserts are exact
  `c.frame()` calls with the eye straight above the target (the card floor above).
- A camera that never stops, riding with a moving subject (a boat, a car): subclass Cam and replace `_at` with a
  Catmull-Rom path through keys `[(frame, eye, target, lens), ...]`, offset by an anchor; `bake` stays the engine's
  (ink widths, DOF, blur):
  ```python
  def path_cam(cam_mod, keys, anchor=None, fstop=4.0, focus=None, min_fstop=2.0, bounds=None):
      class PathCam(cam_mod.Cam):
          def _at(self, t):
              f = t * 30 + 1; ks = keys
              if f <= ks[0][0]: i, k = 0, 0.0
              elif f >= ks[-1][0]: i, k = len(ks) - 2, 1.0
              else:
                  i = max(j for j in range(len(ks) - 1) if ks[j][0] <= f); k = (f - ks[i][0]) / (ks[i + 1][0] - ks[i][0])
              def cr(idx):
                  p0, p1, p2, p3 = [Vector(ks[max(0, min(len(ks) - 1, i + d))][idx]) for d in (-1, 0, 1, 2)]
                  k2, k3 = k * k, k * k * k
                  return 0.5 * ((2 * p1) + (-p0 + p2) * k + (2 * p0 - 5 * p1 + 4 * p2 - p3) * k2 + (-p0 + 3 * p1 - 3 * p2 + p3) * k3)
              eye, tgt = cr(1), cr(2)
              lens = math.exp(cz.lerp(math.log(ks[i][3]), math.log(ks[i + 1][3]), cz.smooth(k)))
              if anchor is not None: off = anchor(f); eye, tgt = eye + off, tgt + off
              fo = focus(f) if focus else tgt
              d = dict(t=t, eye=eye, target=tgt, lens=lens, fstop=fstop, focus=tuple(fo), creep=0, fly=0, path=[], roll=0,
                       follow=None, follow0=None, follow_k=1.0)
              return eye, tgt, lens, fstop, (d, d, 1.0), 0.0
      c = PathCam(lens=keys[0][3], fstop=fstop, min_fstop=min_fstop, bounds=bounds)
      c.frame(0, keys[0][1], keys[0][2], fly=0)
      return c
  ```
- A split screen in ONE render (two rooms side by side): put the camera in the dividing plane and a thin wedge wall
  there whose half-thickness grows with the distance from the eye (k x distance): it projects to a constant-width
  dark line. Zoom only by lens (moving the eye breaks the constant width). A glowing divider reads as a light leak:
  keep it dark and thin.
- Sky shots: `c.obj.data.clip_end = 3000` (the default 200 m cuts off a sky drum or a moon far away).
