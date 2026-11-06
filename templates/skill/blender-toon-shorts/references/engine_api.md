# Engine API (the Blender engine: cz, char, cam, clipcheck, faceparams + its tools)

The engine ships with the app (the "engine" folder below: `engine/`, `tools/`, `assets/`, `ref/`); a project holds only
its film files. Every call here was read from the engine's code; every example is taken from a real sequence file of
the night-2 films (names changed where the original came from the study reference). If a call is not on this page,
read the engine file before you use it. Never edit the engine: work around a gap in your own file and say so in your
summary.

Units: metres, Z up. Characters and props face **-Y** (the camera side). Blender 5.2, EEVEE, rendered headless.
Everything that moves is computed per frame in Python and baked to keyframes (no drivers, no simulations).

## 1. Frames and time

- 30 fps. **Global frame numbers are film time: frame 1 = 0.0 s.** `t = (f - 1) / 30`, `f = round(t * 30) + 1`.
  A word at 26.00 s is frame 781.
- Every sequence file has ONE line `F0, F1 = <first>, <last>` with LITERAL integers, at the start of the line, at
  module level (`F0, F1 = 781, 984`). The app, `render_queue.py` and `assemble.py` read that line with a regex: no
  expressions, no variables, no second assignment; a file without it is not a shot.
- `char` and `cam` timeline calls take **seconds** of film time; `cz.bake`, `Char.bake`, `Cam.bake` take **frames**.
- `t = -1` means "already so before the shot starts" (`c.place(-1, x, y, 0)`, `c.face(-1, 'smile')`).
- A shot in a dissolve is rendered OUTSIDE its own range (the outgoing one past F1, the incoming one before F0). Bake
  those pad frames too: `cz.setup(B1)`, `c.bake(B0, B1)`, `cam.bake(B0, B1)` with `B0 = F0 - pad`, `B1 = F1 + pad`
  (example: F0, F1 = 701, 780 baked 700-790). Faces are padded 24 frames by the engine itself.
- Sequence files are named letters + digits: `s01.py`, `s02.py` ... (the app's rule: `^[a-z]+\d+\.py$`). Helper modules
  must not match it: `cast.py`, `sets.py`, `common.py`, `dress_room.py`, `store_common.py` are fine; `sets2.py` is not.

## 2. A sequence file

```python
# S05 FRONT ROOM night, 28.92-32.67 s (f869-980): "She's sitting in the dark with a shovel by the door ..."
import math, os, sys

F0, F1 = 869, 980


def build(ctx):
    cz, ch, cam = ctx.cz, ctx.char, ctx.cam
    here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
    import sets, cast, common
    cz.setup(F1)                                  # scene, EEVEE, 1080x1920, frames 1..F1
    sets.front_room('night')                      # the set (layout + light; its dressing file is called from it)
    rx, ry = sets.ROOM
    m = cast.maud()
    m.place(-1, rx - 0.4, ry - 0.46, 0)           # root ~5 cm behind the seat centre, facing -Y
    import bpy; bpy.context.view_layer.update()   # matrix_world is stale right after a set is built
    m.sit(-1, dur=0.01, seat=cz.find('f_rocker_cushion'))
    m.face(-1, 'unimpressed'); m.look(-1, -0.4, 0.1); m.set(-1, dur=0.01, hyaw=-10, hroll=4)
    m.look(30.3, 0.5, 0.2)                        # a glance at the shovel
    m.look(31.0, -0.6, 0.2); m.set(31.0, dur=0.3, hyaw=-24)
    m.blink(31.4); m.face(31.5, 'knowing')
    m.bake(F0, F1)                                # characters BEFORE the camera (shot() reads where they are)
    c = cam.Cam(lens=20, fstop=2.4, min_fstop=2.4, bounds=((rx - 3.0, ry - 2.4, 0.3), (rx + 3.0, ry + 2.4, 2.75)))
    mh = (m.head, (0, 0, 0))
    c.frame(28.92, (rx + 1.9, ry - 2.3, 1.35), (rx - 0.7, ry + 0.4, 0.85), lens=19, focus=mh, fly=0, creep=0.0022, fstop=7.0)
    c.shot(31.0, mh, 'mcu', yaw=18, rel=m, pitch=3, lens=35, head_y=0.4, head_x=0.45, focus=mh, fly=12, creep=0.003)
    c.push((F1 - 1) / 30, 0.22, 0.4)              # push into the cut
    c.bake(F0, F1)                                # LAST: it keys the ink width of every outlined object
    return F0, F1
```

Order inside `build()`: `cz.setup` -> set -> cast -> all timeline calls -> `Char.bake` for every character -> props
animated by hand (`cz.bake`) -> camera framings -> `Cam.bake` -> small fixes that only add keys to existing objects.
Objects made after `Cam.bake` get no constant-width ink.

`ctx` holds `ctx.cz`, `ctx.char`, `ctx.cam`, `ctx.args` (the render's `--key value` options: your own debug flags work,
`ctx.args.get('raydebug')`), `ctx.dir` (= your project folder), `ctx.words()` (= `cz.words()`, the narration) and
`ctx.lab` (= the ENGINE kit, read-only: never write there, never read your own files through it).

Your project's files come first everywhere: a relative picture path (`cz.image`, `cz.toon(img=...)`, `cz.poster`) is
looked up in the project folder, then in the kit (`assets/tex/...`, `assets/props/tex/...`); `cz.prop('kind')` loads
your own `props/kind.py` when it exists (a new prop, or a changed copy of a kit prop), else the kit's
`assets/props/kind.py`. Pictures a prop draws from your words (door signs, headstone text, stamps, calendar pages) go
to `.suite/btex/` in the project by themselves.

## 3. Rendering a sequence (run.py)

```
<blender> -b --factory-startup -P <engine>/engine/run.py -- s05.py --frames 880,915,960 --scale 0.4 --samples 12 --out renders/test/s05_r1
```
- `<blender>`, `<engine>`, `<python>`: the Blender, the engine folder and the Python (Pillow + numpy + OpenCV) the app
  found; the project's CLAUDE.md names them. Set `CZ_PY=<python>` in the render's environment or the faces are not
  drawn ("CZ FACES MISSING"). bash: `CZ_PY="<python>" "<blender>" -b ...`; PowerShell: `$env:CZ_PY = '<python>'; & '<blender>' -b ...`.
- Options: `--frames a-b` or `a,b,c` (default F0-F1), `--scale 0.4` (resolution share), `--samples N` (EEVEE TAA,
  default 48), `--out dir` (ALWAYS give it: the default is inside the engine folder), `--save file.blend` (writes the
  built scene, headless, for debugging).
- Always `-b --factory-startup`: no window, no user add-ons. Never start Blender any other way.
- It prints `CZ built in <s>s frames F0-F1`, the contact report (§9), `CZ frame <f> <s>s` per frame (the first one
  includes the shader compile) and `CZ rendered N frames to <dir>`. Blender exits 0 even when your script throws:
  a `Traceback` in the log is a failure. Also read `CZ PROP FAILED`, `CZ PLACEHOLDER`, `CZ DRESS FAILED` (your own
  loader's line), `CZ FACES MISSING`, `CZ POSTER MISSING`, `CZ SIT`, `CZ CAM`, `Shadow buffer full`.
- Test renders: `--scale 0.3-0.4 --samples 12`, 2-6 frames, into a NEW folder per round under `renders/` (the app's
  watcher ignores `renders/`, `faces/`, `shots/`, `frames_*`: writing pictures anywhere else in the project restarts
  the preview).

## 4. cz: scene, materials, meshes, props, lights, baking

### Scene
- `cz.setup(frame_end, res=(1080, 1920), samples=48, world='#2a2622', world_strength=0.6, gi=False)`: EEVEE, Standard
  view transform, shadow pool 1024 MB, jittered depth of field, the world colour. Returns the scene.
- `cz.find(name)` -> the object or None. `cz.FPS` = 30, `cz.LAB` = the engine folder, `cz.INK`, `cz.SKIN_WHITE`.
- `cz.col('#rrggbb')` -> linear RGBA (also accepts a 3- or 4-tuple). `cz.srgb(hex, a=1.0)`.

### Materials (reused BY NAME: the same name returns the first material made with it, whatever the arguments)
- `cz.toon(name, color='#cccccc', lift=0.62, img=None, uv='UV', scale=(1, 1), emit=0.0, emit_color=None,
  alpha_clip=False, tint=None, sheen=0.0, tex=None, tex_scale=1.0, tex_strength=0.06, proj=None, proj_scale=1.0,
  pattern=None, ramp=None)`: the cel material (diffuse -> Shader to RGB -> `light ** lift` x base x AO, ends in
  Emission). Plain colours get a little painted grain by default.
  - `tex`: `'grain'` (soft mottling), `'wood'` (grain along the object's X), `'paper'`, `'hair'` (glossy streaks).
  - `img=<absolute png path>`: a picture on the UVs (planes); `alpha_clip=True` for cut-outs; `tint='#hex'` multiplies it.
  - `proj='box', proj_scale=k`: a picture box-projected on any mesh without UVs (k repeats per metre; walls, floors).
  - `pattern=('tiles', size_m, grout_hex)` | `('planks', length_m, width_m, gap_hex)` | `('carpet', size_m, hex2)` |
    `('speckle', density, hex2)`.
  - `ramp=(shadow, lit, lo, hi)`: colour-scripted light: the colour comes from HOW MUCH light lands (smoothstep lo..hi),
    shadow / lit are multipliers (hex, or linear tuples that may exceed 1). See §11 for how to measure lo / hi.
  - With `proj`, `pattern` or `ramp` the rich variant is built: it ignores `alpha_clip`, `sheen`, `uv`, `scale`, `emit_color`.
  ```python
  cz.toon('ap_floor', '#8a5630', pattern=('planks', 1.2, 0.16, '#4a2c18'), tex='wood', tex_scale=2, tex_strength=0.1, ramp=fr)
  cz.toon('ap_wallpaper', '#cccccc', img=T('wallpaper.png'), proj='box', proj_scale=1.1, tint='#8ab8c8', ramp=wr)
  cz.toon('gb_padm', '#e8dcc8', tex='paper', tex_strength=0.06)
  ```
- `cz.glow(name, color, strength=4.0)`: unlit emission (bulbs, flames, neon; blooms in the grade).
- `cz.screen(name, img, strength=1.6)`: a picture as a lit screen (always a new material). Use ~1.15: 1.6 clips.
- `cz.ink()`: the outline material. `cz.outline(obj, t=0.008)`: an inverted-hull outline of design width `t` m (the
  camera turns it into a constant on-screen width per frame). `cz.ink_weight(obj, ...)`: brush-weight line (heavy on
  the shadow side); the engine applies it to every character mesh itself.
- `cz.image(path, colorspace='sRGB')`: loads (or reuses) a picture. A RELATIVE path is read from the engine folder:
  give project pictures as absolute paths, `os.path.join(HERE, 'tex', 'wallpaper.png')`.
- `cz.AO = {'strength': 0.55, 'dist': 0.35}`: contact shading inside every toon material (`CZ_AO=0` turns it off).

### Meshes (name every part `<prefix>_<part>`: a click in the preview answers with that name)
- `cz.box(name, size, loc=(0,0,0), mat='#cccccc', rot=(0,0,0), bevel=0.01, ol=0.006, parent=None, origin='center'|'bottom'|'top')`
- `cz.cyl(name, r, h, loc, mat, rot, verts=40, bevel=0.0, ol=0.006, parent=None, r2=None, origin='bottom')` (r2 = top radius: cones)
- `cz.sphere(name, r, loc, mat, scale=None, ol=0.006, parent=None, segs=48, rings=24)`
- `cz.capsule(name, r, h, loc, mat, scale=None, ol=0.006, parent=None)` (stands on its base, total height h)
- `cz.plane(name, w, h, loc, mat=None, rot=(90, 0, 0), parent=None, ol=0.0)`: an upright card facing -Y with UVs 0..1;
  `rot=(0, 0, 0)` lies flat facing +Z.
- `cz.text(name, body, size=0.1, loc, mat='#ffffff', rot=(90, 0, 0), extrude=0.004, font=None, align='CENTER', parent=None)`:
  3D text (default font Arial Black from the Windows fonts folder: pass `font=` on a Mac).
- `cz.empty(name, loc=(0,0,0), parent=None, size=0.05)`; `cz.place(obj, loc, rot, scale, parent, outline_t, bevel, segs)`.
- `cz.limb(name, a, b, c, radius, mat, parent)`: a black noodle through three empties (a stand-in arm from off screen).
- `mat` may be a hex string (`'#3a2418'`): a toon material `c_<hex>` is made. Rotations are degrees.
- Never give `scale=` to an outlined mesh: object scale distorts the hull. Bake it into the mesh:
  `o.data.transform(Matrix.Diagonal((sx, sy, sz, 1)))`.

### Props (the library: catalog.md)
- `cz.prop(kind, name=None, loc=(0,0,0), rot=0.0, scale=1.0, parent=None, **kw)`: builds `assets/props/<kind>.py`
  (engine folder) at `loc`, turned `rot` degrees about Z, uniform `scale`; `**kw` are the prop's own options. Returns
  the root empty. A prop that fails prints `CZ PROP FAILED` and becomes a magenta `CZ PLACEHOLDER` box.
  ```python
  cz.prop('window_city', 'ap_window', (X0 + 0.02, 0.5, 1.45), rot=90, time='night')
  cz.prop('tk_floor_lamp', 'ap_lamp', (LAMP[0], LAMP[1], 0), on=True, light=True, power=150)
  hb = cz.prop('gb_hand_bell', 'hbell', (0, 0, 0))
  bill = cz.prop('gb_bill', f'bill{i}', (0, 0, -50), kind=i % 6, crumple=0.3, seed=i)     # parked below the floor until held
  ```
- A prop's numbers (seat height, grip point, moving parts) are in its `META`: `cz._PROPS['ld_suv'].META['driver']`
  after it was built once. Moving parts are empties named `<name>_<part>` (`cz.find('hbell_clapper')`).
- `cz.poster(name, img, w, loc, rot=0.0, frame='#2b2622', frame_w=0.025, parent=None, h=None)`: a framed picture
  whose back is on the wall (faces -Y before rot); height from the picture's aspect.
- `cz.no_shadow(substr=('glass', 'Glass', 'pane', 'sky'))`: meshes whose name contains one of these cast no shadow
  (call it at the end of a set; add your own words, e.g. `'outside'`).

### Lights
- `cz.light(name, kind='AREA'|'POINT'|'SPOT'|'SUN', loc=(0,0,3), rot=(0,0,0), color='#fff3e0', power=200, size=1.0,
  shadow=True, target=None)`: `size` = area size (AREA), soft radius (POINT / SPOT), angle in degrees (SUN); `target`
  aims it. SPOT cone: `ls.data.spot_size = 1.0; ls.data.spot_blend = 0.35` afterwards.
  ```python
  cz.light('ap_moon', 'AREA', (X0 - 0.8, 0.5, 1.8), rot=(0, -90, 0), color='#7ea6ff', power=110, size=1.8, target=(0, 0.5, 0.4))
  ls = cz.light('ap_lampspot', 'SPOT', (LAMP[0] + 0.15, LAMP[1] - 0.15, 1.22), color='#ffb466', power=900, size=0.15, target=(0.5, 0.45, 0.0))
  kl = cz.light('maud_facekick', 'POINT', (0, 0, 0), color='#b0b8ff', power=16, size=0.3, shadow=False)
  kl.parent = m.head_pv; kl.location = (-0.35, -0.55, 0.05)        # a face kick that rides the head (after m.bake)
  ```
- `cz.aim(obj, target)`: points an object's -Z at a point (lights, cards).

### Baking
- `cz.bake(obj, path, values, f0, index=-1, interp='LINEAR'|'CONSTANT')`: one value per frame from `f0` on (a scalar
  or a tuple) -> keyframes on `obj.<path>` (any animatable path: `'location'`, `'rotation_euler'`, `'scale'`,
  `'energy'` on a light's data, `'modifiers["x"].thickness'` ...). Before the first and after the last key the value holds.
  ```python
  cz.bake(clap, 'rotation_euler', [(0, math.radians(25 * math.sin(2 * math.pi * ((f - 1) / 30 - 34.3) * 5)), 0) for f in range(F0, F1 + 1)], F0)
  cz.bake(al.data, 'energy', [70.0 * cz.smooth(((f - 1) / 30 - 31.78) / 0.1) for f in range(F0, F1 + 1)], F0)
  cz.bake(root, 'scale', [(1, 1, 1) if t_in <= (f - 1) / 30 < t_out else (0.001,) * 3 for f in range(F0, F1 + 1)], F0, interp='CONSTANT')
  ```
- Easings (`k` 0..1 in, 0..1 out): `cz.clamp, lerp, vlerp, smooth, in_out_sine, out_cubic, in_cubic, out_quad,
  gesture, back_out(k, s=1.25), snap`. By name (the `ease=` of char calls): `'linear' 'smooth' 'sine' 'out' 'in'
  'gesture' 'outquad' 'back' 'snap'`.
- `cz.Track(v0, arc=0.0)` with `.key(t, v, dur=0.2, ease='gesture')` and `.at(t)`: the timeline type every character
  channel uses (floats or tuples; `arc` bends 3D tuples up and forward mid-move).

## 5. char: the characters

### Building one
`char.Char(name, shirt='#3a5a8c', skin=SKIN_WHITE, scale=1.0, torso=(0.165, 0.46), belly=1.0, leg=0.42, arm=0.47,
hair=None, extras=None, limb_r=0.021, shoe='#4a2c1c', face_v=-0.03, face_s=0.84, lift=0.62, palette=None, face_style=None)`

- A pear-bean torso (`torso` = radius, height; `belly` pushes the front out), a white ball head (radius 0.24 x scale:
  0.48 m wide), black noodle arms and legs between empties, ball hands, coloured shoes on dark soles. About 1.3 m tall;
  hips at 0.42 m; head centre ~1.05 m.
- `hair=` one builder, `extras=` one builder or `char.combo(a, b, ...)`. A builder is a function `build(c)` that adds
  parts parented to `c.body` or `c.head`.
- `face_style` (drawn by facegen): `eye_w`, `line_w`, `lid_len`, `brow_w`, `brow_len`, `brow_y`, `brow_flat` (True),
  `mouth_w`, `mouth_y`, `mustache` ('#hex': a bushy horseshoe moustache drawn into the face), `dot_eyes` (True: small
  grey dots, for characters behind thick glasses), `soft`.
```python
def maud(name='maud'):
    hair = ch.hair_cap('#5a2a1a', front=0.56, sides=0.08, back=-0.55, thick=0.03, puff=1.06, bun=(0.12, 0.95, 0.25))
    return ch.Char(name, shirt='#1e6a6a', torso=(0.16, 0.47), hair=hair, shoe='#2a1a14',
                   extras=ch.combo(skirt('#1e6a6a', 0.36, 1.34, trim='#123e3e', apron='#ece4d0'), lace_collar(), brooch(), comb()),
                   face_style={'brow_w': 1.05})
```
- `char.hair_cap(color='#2b2320', front=0.52, sides=0.05, back=-0.55, thick=0.028, bangs=0.0, part=0.0, tuft=None,
  puff=1.06, scale_xyz=(1,1,1), crown=90.0, bun=None, spikes=0, inkline=True)`: a lofted shell over the head.
  front / sides / back = the hairline height (sine of the elevation: 0.52 ~ 31 deg, 0.68 ~ 43 deg); `sides < 0` =
  low sides (a bowl cut, never a beanie); `bangs` dips the front, `part` shifts the dip; `tuft=(height, lean)`;
  `bun=(radius, z, y)` in head radii; `crown < 90` = bald crown; `inkline=False` for hair whose edge is drawn by its
  own pieces (curls). It also draws a dark ink tube along the hairline and the brows again ON the hair.
- `char.suit(jacket, shirt, tie, tag)`, `char.glasses(color, r)`, `char.combo(*builders)`.
- Costume parts on the torso: the torso carries its depth as object scale, so a child placed "on the surface" ends
  up inside it. Use the cast helper `_chest(c, x, z)` (in every night-2 cast.py) to get a point on the visual surface:
  ```python
  def _chest(c, x, z, lift=0.006):
      rt, h = c.rt, c.ht
      r = rt if z <= h - rt else math.sqrt(max(0.0, rt * rt - (z - (h - rt)) ** 2))
      r = max(r, 1e-4); k = max(0.0, 1 - (x / r) ** 2)
      sy = 0.8 * c.belly
      y = -r * math.sqrt(k) - lift / sy
      ang = math.degrees(math.asin(max(-1.0, min(1.0, x / r)))) * 0.85
      return (x, y, z), ang
  def decal(c, name, img, w, h, x, z, parent=None):      # a name tag / badge / logo on the chest
      loc, ang = _chest(c, x, z)
      return cz.plane(name, w, h, loc, cz.toon(name + 'm', img=img, alpha_clip=True, lift=0.75), rot=(90, 0, ang), parent=parent or c.body)
  ```
- Useful attributes: `c.root`, `c.torso_pv`, `c.body`, `c.head_pv`, `c.head`, `c.ctrl['hL'|'hR'|'eL'|'eR'|'sL'|'sR'|
  'fL'|'fR'|'kL'|'kR'|'pL'|'pR']` (the limb empties), `c.R` (head radius), `c.rt`, `c.ht`, `c.hh` (hip height), `c.s`,
  `c.T[channel].at(t)` (a channel's value at t), `c.pos.at(t)`, `c.yaw.at(t)`, `c.faces`.

### Channels (all set with `pose` / `set` / `sit`; character-local)
| channel | meaning |
|---|---|
| `hL`, `hR` | hands (x, y, z) in metres in the TORSO frame: +x = the character's left, -y = forward, z up from the hips. Rest `(+-0.2 s, -0.02 s, 0.1 s)` |
| `fL`, `fR` | feet (x, y, z) in the root frame. Rest `(+-0.085 s, 0, 0)` |
| `lean` | degrees: + tips the torso BACK (lying on the back = +90), - leans forward over a table |
| `sway` | degrees: + tips the top toward the character's left (screen right when it faces the camera) |
| `twist` | degrees about Z |
| `squash` | torso Z scale (1 = rest) |
| `bodyz`, `bodyy` | torso offset up / forward-back (m); `sit()` owns bodyz while seated |
| `hyaw` | degrees: + turns the head to the character's left |
| `hpitch` | degrees: + tips the face DOWN, - lifts it |
| `hroll` | degrees: + tips the top of the head to the character's left |
| `sitw`, `seath` | set by `sit()` / `stand()` (seated weight, seat height): never by hand |
Signs are TESTED, never reasoned out: a 3-frame 0.4x render settles one in ~12 s.

### Timeline (seconds)
- `place(t, x, y, yaw=0.0, dur=0.0, ease='smooth')`: dur 0 = instant (a time cut), dur > 0 = a slide without steps.
  **yaw 0 faces -Y (the camera side), 90 faces +X, 180 faces +Y.**
- `turn(t, yaw, dur=0.2, ease='sine')`: the number interpolates, so turn to the equivalent angle nearest the current
  one: `y_end = c.yaw.at(t0); c.turn(t0, 14 + 360 * round((y_end - 14) / 360), 0.3)`.
- `walk(t0, t1, path, step=5.5, bob=0.07, stride=0.34)`: `path = [(x, y), ...]` world points from where it stands.
  Contact / passing cycle, arms opposite the legs (only while the left hand is at its rest spot: a held pose stops the
  swing), twist, sway, head counter-turn;
  eases in over the first 25 %, out over the last 20 %. Afterwards the character stays at the last point facing the
  last direction.
  ```python
  derek.walk(44.6, 45.6, [(px, py), (1.5, 1.05), (1.86, 1.42), (1.86, 1.84)])
  derek.turn(45.6, 205, 0.3); derek.face(45.6, 'scheming')
  ```
- `pose(t, name='rest', dur=0.18, ease='snap', antic=0.0, **kw)`: a named pose (catalog.md) that LANDS at `t + dur`
  with a small overshoot; the body follows 2-3 frames later; `antic=0.1-0.15` dips the hands the other way for 3
  frames first; `**kw` overrides channels (`pose(34.66, 'cheer', dur=0.2, hL=(0.42, -0.14, 0.8), hR=(-0.42, -0.14, 0.8))`).
  A named pose sets ALL its channels: `pose('rest', hL=...)` also sends hR to rest.
- `set(t, dur=0.2, ease='sine', **chans)`: any channels, nothing else. One hand only: `set(t, hR=(...))`.
  ```python
  H.pose(42.95, 'present', dur=0.18, antic=0.12); H.pose(44.0, 'rest', dur=0.2)
  m.set(44.28, dur=0.12, lean=22, hR=(-0.12, -0.34, m.ht * 0.3))
  derek.set(t, dur=0.18, hR=(-0.2, -0.38, -0.12))
  ```
- `sit(t, seat_h=None, dur=0.5, feet_y=None, feet_z=None, thigh=None, seat=None)` / `stand(t, dur=0.4)`: sitting.md.
- `face(t, name, big=True)`: an expression (catalog.md) that lands in 5 frames with an overshoot, brows leading by 2
  frames. `big=True` swaps through closed eyes (2 frames) and plays a TAKE on take presets (the head squashes 2 f,
  stretches past rest by f5, settles by f11, the eyes pop 17 %); `big=False` blends without the blink.
  Per-shot changes to a preset: append the key with overrides yourself (the engine reads a 4th item):
  ```python
  lady.faces.append((28.62, 'grin', True, {'em': 0, 'eo_L': 0.9, 'eo_R': 0.9}))   # a teeth grin with the eyes open
  ```
- `look(t, gx=0.0, gy=0.0, dur=0.07)`: pupils to (gx, gy), -1..1 eye radii, + = the character's left / up, in 2 frames.
- `blink(t)`: a 3-frame blink on a beat (after a take, before a side glance); automatic blinks run every 1.5-4 s.
- `talk(t0, t1, words, loud=1.0)`: lip-sync over the words between t0 and t1 (`words` = `[{'word', 'start', 'end'}]`,
  §12 makes them from audio/timeline.json). On twos, leading the sound by 2.5 frames, vowel-weighted letters,
  co-articulation in gaps under 0.28 s, nods + brow lifts on stressed words, inside the current expression.
  `loud=1.6-2.0` = shouting. Quoted speech only: the narrator is not a character.
- `extra(t0, t1, name)`: `'sweat' 'blush' 'tears' 'stress' 'sparkle' 'vein' 'gloom'` (any other name crashes the bake).
- `hold(obj, hand, t0=-1e9, t1=1e9, offset=(0, -0.02, 0.0), rot=(0, 0, 0), follow='root', aim=None, release='stay')`:
  a prop root in hand 'L' or 'R'. `offset` / `rot` in the character's frame (`follow='root'`) or the forearm's
  (`follow='arm'`: +Z along elbow -> hand, signs and poles tilt with the arm); `aim=(x, y, z)` turns the prop's
  front (-Y) to a point; `release='stay'` leaves it where the hand let go, `'reset'` sends it home. The prop keeps its
  own built rotation (rot applies on top). Before t0 it stays where it is: park it out of sight. Clear a prop's parent
  before holding it.
  ```python
  H.hold(hb, 'R', -1, TX, offset=(0, -0.02, -0.135))
  M.hold(sh, 'R', 43.4, 99, offset=(0.0, -0.02, -0.72))                       # the shovel gripped at its handle
  k.hold(ticket, 'R', (140 - 1) / 30, (160 - 1) / 30, offset=(0.0, -0.02, 0.06), rot=(90, 0, 0), aim=(0.0, -2.5, 1.0))   # shown to the camera
  ```
- `bake(f0, f1)`: evaluates every frame, keys the rig, draws the faces (facegen via CZ_PY into `faces/<seq>/<char>/`),
  bakes the holds. Call once per character, after all its timeline calls, before the camera.

## 6. cam: the camera (details, numbers and recipes: camera.md)
- `cam.Cam(name='cam', lens=32, fstop=2.2, sensor=24, bounds=None, min_fstop=1.9)`: a 24 mm VERTICAL sensor
  (hfov = 2 atan(6.75 / lens)); `bounds=((xmin, ymin, zmin), (xmax, ymax, zmax))` = the room minus a margin (the eye is
  pulled in and the lens widened when a framing would land outside); `min_fstop` caps the depth of field.
- `frame(t, eye, target, lens=None, fstop=None, focus=None, creep=0.0019, fly=13, path=None, roll=0.0, follow=None,
  follow_k=1.0)`: a framing REACHED at t (its flight starts at `t - fly / 30`); `fly=0` = a cut; `focus` = object,
  (object, offset) or point; `path` = eye waypoints; `follow` = an object the framing rides with.
- `shot(t, subject, size='cu', yaw=0.0, pitch=8.0, lens=None, head_y=0.40, head_x=0.5, head_d=0.48, rel=None, at=None, **frame_kw)`:
  a framing by shot size `'ecu' 'cu' 'mcu' 'ms' 'mws' 'ws' 'xws'` (or a number of head widths); `rel=<Char>` = yaw
  relative to its facing; `at=` read the subject at another time (the landing time of a walk or turn).
- `push(t_cut, amount=0.32, dur=0.6, lens_k=1.0)`: accelerate into a cut. `jolt(t, amp=0.035, frames=8)`: only on a hit.
- `bake(f0, f1, motion_blur=True, ink_px=7.0)`: keys eye, rotation (unwrapped), lens, f-stop, focus and every outline's
  width per frame; shutter 0.3 (`CZ_SHUTTER` overrides), 1 motion-blur step. `c.obj` is the camera object
  (`c.obj.data.clip_end = 3000` for skies far away).

## 7. faceparams: faces as numbers
- `FP.P[name]`: the 49 presets (catalog.md); `FP.BASE`: every key with its default; `FP.TAKES`: presets that play a
  take and their strength; `FP.VIS`: the visemes; `FP.mix(a, b, k)`.
- Keys you may override: brows `bh_L/R` (height), `bt_L/R` (tilt deg, + = inner end up), `ba_L/R` (arch), `bw`;
  eyes `eo_L/R` (open 0..1), `el_L/R` (lower lid), `lt_L/R` (lid tilt), `es` (size), `gx`, `gy`, `em` (mode: 0 grey
  oval, 1 happy arcs, 2 rings + pupil, 3 stars, 4 hearts, 5 spirals, 6 X), `pupil`, `pop`; mouth `mw` (width), `mo`
  (open), `ms` (smile), `mt` (teeth: 0, 1 top band, 2 clenched grid), `mg` (tongue), `mr` (round), `mk` (skew), `mv`
  (wave), `my`, `mz` (tooth dividers); extras `x_sweat x_blush x_tears x_stress x_sparkle x_vein x_gloom` (0..1).
- Review every preset on a white head: `<python> <engine>/tools/facegen.py --sheet renders/faces_sheet.jpg '{"dot_eyes": true}'`
  (the JSON = a face_style to try).

## 8. The preview server (serve.py: the app's, never yours to run)
The app builds each shot once in a hidden `blender -b -P serve.py -- <seq.py>` and asks it for frames: Solid
(Workbench, ~130 ms) while scrubbing, Look (EEVEE, few samples) when the playhead rests, picks (a ray through the
clicked pixel, through glass). It runs with the contact check OFF. Any edit to a .py / .json / picture outside
`faces/ shots/ renders/ frames_*` restarts it.

## 9. clipcheck: the contact report on every run.py render
Printed after the build (the first 12 problems, then the total):
```
CZ CLIP horace.legL f1045 in f_chair1_seat 3.4 cm at (1.62, 1.48, 0.41) curve 2/6
CZ SITCHECK maud f965: floats 9 cm above the seat          (or: torso sunk 6 cm into f_rocker_cushion)
CZ CLIPCHECK 31 clipping samples in 12 frames: ld_suv_rim x20, (sitting) horace x2
CZ CLIPCHECK clean (2 characters, 63 solids, 28 frames)
```
Limbs are sampled along their curves every `CZ_CLIPSTEP` (4) frames against every solid mesh near the cast; grazes
under 8 mm and legs resting under 2 cm on a seat top are not clips; cards thinner than 3 cm and hidden objects are not
solids. `obj['cz_contact_ok'] = 1` exempts an object that touches by design (a character head-first in a bin, a prop
parked under the floor during a time cut, a heap of bills lying on a body, light cards and fog). `CZ_CLIPCHECK=0`
skips the check: never for a render you judge.

## 10. Tools (engine `tools/`, run with `<python>`)
- `facegen.py <faces.json> <out_dir>` (the engine calls it) / `--sheet <out.jpg> [style json]`.
- `assemble.py <project> [--out frames_final] [--dir shots] [--fill]`: shots' frames + dissolves + match cuts -> one
  frame folder. Reads `assemble.json`:
  ```json
  {"dir": "shots", "shots": ["s01", "s02", "s03"],
   "dissolves": [["s01", "s02", 74, 80]],
   "matchcuts": [{"from": "s07", "frame": 1308, "to": "s08", "f0": 1309, "f1": 1318, "boxes": "s08_print.json",
                  "card": "tex/print.png", "photo": [26, 26, 414, 370], "crop_y": 0.24}],
   "prerender": [["s05", 649, 662]]}
  ```
  `shots` = playback order (the app reads it too); a dissolve `[out, in, f0, f1]` blends over f0..f1 (smoothstep) and
  the incoming shot owns everything after it; a match cut lays the outgoing shot's `frame` over the incoming shot,
  shrinking onto a box the incoming file writes per frame (`boxes`), fading into the 3D print over the last 3 frames;
  `prerender` = frames another shot needs before it renders (a picture of one shot inside the next).
- `render_queue.py <project> --jobs 4 [--redo <project>:s03,<project>:s05:400-460] [--scale 1.0] [--samples 48] [--dry]`:
  ONE queue, N Blenders, renders only frames missing on disk (whole PNGs only) plus the dissolve pads and prerenders
  from assemble.json, into `shots/<seq>/NNNN.png`, a log per job in `shots/<seq>_q.log`, `DONE ... PROBLEMS:` lines.
  Needs `CZ_BLENDER=<blender>` and `CZ_PY=<python>` in its environment.
- `post.py <film> --vo <audio> --words <json> --out <name.mp4> [--sat --gain --lift --curve --bloom --grain --sharpen]`:
  the lab's finish (bloom, curve, saturation, unsharp, vignette, grain, captions, voice). In the app the export does
  the finish; its grade options are what you choose with gradeprobe.
- `gradeprobe.py <frames_dir> --step 20 --try "sat=1.2" "sat=1.0,gain=1.15" "sat=1.0,bloom=0.3,curve=0/0 0.15/0.27 0.5/0.68 0.85/0.91 1/1"`:
  grades a sample of frames with ffmpeg and prints luminance / saturation / contrast / sharpness against the reference's
  measured means (`ref/measure.json`), `ok` / `FAIL` per number and the graded samples' folder. LOOK at the samples.
  Needs `ffmpeg` on the PATH (and OpenCV in `<python>`).

## 11. Environment switches
`CZ_PY` (the Python for faces), `CZ_BLENDER` (render_queue), `CZ_SHUTTER` (motion-blur shutter, default 0.3),
`CZ_AO=0` (no contact shading), `CZ_GI=1` (EEVEE raytracing: no visible effect on these shaders), `CZ_JITTER=0` (post
DOF instead of jittered), `CZ_CLIPCHECK=0`, `CZ_CLIPSTEP=N`.

Measuring a ramp's lo..hi (how the tickets film tuned its walls): make your set's ramps switchable and render the
key frame with a debug ramp, so brightness = light / 6:
```python
def ramps(key):
    if os.environ.get('CZ_RAMPPROBE'): return ('#000000', '#ffffff', 0.0, 6.0)      # debug: grey = light amount / 6
    return RAMPS.get(key)
```
Render the key frame with `CZ_RAMPPROBE=1 CZ_AO=0`, then read the light amount in a region (the lab's probe: undo the
sRGB view, divide by the surface's own base colour, undo the smoothstep, x 6):
```python
# renders/rampprobe.py <render.png> x0,y0,x1,y1 <base_texture_or_swatch.png>   (region in 0-1 of the frame)
import sys
import numpy as np
from PIL import Image
img = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float) / 255
x0, y0, x1, y1 = [float(v) for v in sys.argv[2].split(',')]
H, W = img.shape[:2]; reg = img[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)]
lin = lambda c: np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
lum = lambda c: 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
tex = lin(np.asarray(Image.open(sys.argv[3]).convert('RGB')).astype(float) / 255).mean(axis=(0, 1))
s = np.clip(lum(lin(reg)) / max(1e-6, float(lum(tex[None, None, :])[0, 0])), 0, 1)
xs = np.linspace(0, 1, 2001); x = np.interp(s, 3 * xs ** 2 - 2 * xs ** 3, xs) * 6.0
for q in (5, 25, 50, 75, 95): print(f'light p{q:02d} = {np.percentile(x, q):.3f}')
```
Set lo just above the shadow's light and hi just below the lit patch's (the cork: shadow stripes ~2.0, the sun 3+; a
guessed 0.35..0.8 came out flat brown). A ramp is tuned to the light levels: never change those lights afterwards
without re-measuring.

## 12. The words, and helpers you write
The engine reads the narration for you:
- `cz.words()` -> `[{'word', 'start', 'end'}]` from `audio/timeline.json` (the shape `talk()` reads; seconds).
- `cz.at(W, 'ticket', n=1, after=0.0)` -> the n-th spoken "ticket" at or after `after` s (case and punctuation
  ignored; a KeyError names the word when it isn't there, so a changed script fails loudly instead of drifting).
- `cz.frame_of(t)` -> the global frame of a time (30 fps, frame 1 = 0 s).

The rest are the films' own helpers: copy what you need into common.py.
```python
import math, os
from mathutils import Matrix, Vector
import cz
FPS = 30
fr = cz.frame_of

def visible(obj, spans, f0, f1):
    """hide_render keys so obj (and its children) shows only inside the spans [(t_on, t_off), ...]."""
    for o in [obj] + list(obj.children_recursive):
        for f in range(f0, f1 + 1):
            t = (f - 1) / FPS
            on = any(a <= t < b for a, b in spans)
            prev = None if f == f0 else (not any(a <= (f - 2) / FPS < b for a, b in spans))
            if f == f0 or prev != (not on):
                o.hide_render = not on; o.keyframe_insert('hide_render', frame=f)

def show(root, t_on=-1e9, t_off=1e9, F0=1, F1=2, away=(0, 0, -80)):
    """Keep a root in place only between t_on and t_off (parked far below the floor otherwise)."""
    base = root.location.copy()
    cz.bake(root, 'location', [tuple(base) if t_on <= (f - 1) / FPS < t_off else tuple(base + Vector(away))
                               for f in range(F0, F1 + 1)], F0, interp='CONSTANT')

def lie(c, loc, roll=35.0, head='-X'):
    """Lay c on its back at loc: head toward -X, face up, rolled toward the camera side (-Y). Place c at (0, 0, 0)."""
    pv = cz.empty(c.name + '_liepv', loc)
    M = Matrix.Rotation(math.radians(roll), 4, 'X') @ Matrix.Rotation(math.radians(90 if head == '-X' else -90), 4, 'Z') @ Matrix.Rotation(math.radians(-90), 4, 'X')
    pv.rotation_euler = M.to_euler(); c.root.parent = pv
    return pv

def lift(c, z):
    """Stand c on a raised floor (a porch, a hidden step behind a counter): the root rides an empty at height z."""
    pv = cz.empty(c.name + '_liftpv', (0, 0, z)); c.root.parent = pv; return pv

def to_local(c, t, world):
    """A world point -> c's torso-local hand coordinates at time t (for set(hR=...)); keep lean / twist ~0 while reaching."""
    x, y = c.pos.at(t); yaw = c.yaw.at(t)
    d = Matrix.Rotation(math.radians(-yaw), 3, 'Z') @ (Vector(world) - Vector((x, y, 0)))
    return (d.x, d.y - c.T['bodyy'].at(t), d.z - (c.hh + c.T['bodyz'].at(t)))

def wall_y(name, y, x0, x1, H, mat, holes=(), t=0.1):
    """A wall along X at y with real rectangular holes [(xa, xb, za, zb)] (doors, windows: light gets in)."""
    xs = sorted({x0, x1} | {h[0] for h in holes} | {h[1] for h in holes})
    for i in range(len(xs) - 1):
        a, b = xs[i], xs[i + 1]
        hs = [h for h in holes if h[0] <= a + 1e-6 and h[1] >= b - 1e-6]
        if not hs: cz.box(f'{name}_{i}', (b - a, t, H), ((a + b) / 2, y, H / 2), mat, bevel=0, ol=0); continue
        za, zb = hs[0][2], hs[0][3]
        if za > 0.001: cz.box(f'{name}_{i}lo', (b - a, t, za), ((a + b) / 2, y, za / 2), mat, bevel=0, ol=0)
        if zb < H - 0.001: cz.box(f'{name}_{i}hi', (b - a, t, H - zb), ((a + b) / 2, y, (H + zb) / 2), mat, bevel=0, ol=0)

def dress(modname, **kw):
    """Call dress_<set>.py's dress(cz, **kw); a broken dressing file must not stop the shot (it prints why)."""
    import importlib, sys
    if HERE not in sys.path: sys.path.insert(0, HERE)
    if not os.path.exists(os.path.join(HERE, modname + '.py')): return
    try:
        mod = importlib.import_module(modname); importlib.reload(mod); mod.dress(cz, **kw)
    except Exception as e:
        import traceback; print('CZ DRESS FAILED', modname, repr(e)); traceback.print_exc(limit=4)
```
`wall_x` is the same along Y. Other film helpers worth copying when the beat needs them: `hand_pose(c, hand, f, off,
rot)` + `carry(obj, f0, f1, fn)` (a prop slid by hand, then picked up), `key_path(obj, f0, f1, [(t, (x, y, z)), ...])`,
`pop(obj, t, f0, f1, dur=0.2, overshoot=1.25)` (scale pop-in), a clock-hands baker (rotation_euler.y, + = clockwise
from the front), `seated_dress(cz, m)` (sitting.md), `insert_hand(...)` (a cuffed forearm + mitten for top-down
inserts, PITFALLS), `path_cam(...)` (camera.md).
