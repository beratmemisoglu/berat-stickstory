# Props: contract, style, verification

One prop = one file `assets/props/<name>.py` with:

```python
META = {'size': (w, d, h), 'anchor': '...', 'animate': ['_part', ...], 'params': '...'}
def build(cz, name='<name>', **kw):   # returns the root empty; every part parented (directly or not) to it
```

- Units metres, Z up, the prop's front faces **-Y** (the camera usually looks from -Y). Floor props stand on z = 0
  with the root at the floor centre; wall props have their back at y = 0 and are centred on z = 0.
- Scale: characters are ~1.3 m tall (head 0.48 m wide, hip 0.42 m, a seated character's seat at 0.45 m). Desks 0.72 m,
  doors 2.0 x 0.9 m, office chair seat 0.47 m. Slightly chunky, toy-like proportions are right; never realistic thin parts.
- Use only `engine/cz.py` helpers: `cz.box / cyl / sphere / capsule / plane / text / empty`, materials `cz.toon(name,
  color, tex='grain'|'wood'|'paper', tex_scale, tex_strength)`, `cz.glow` (lamps), `cz.screen(name, png)` (lit screens),
  `cz.toon(..., img=png)` (printed graphics), outlines via the `ol=` argument (0.004-0.01 m by part size; tiny parts 0 or
  0.002). Read cz.py for signatures. Name every part `<name>_<part>`; give materials prop-specific names
  (`<name>_wood`), or reuse a shared one on purpose.
- Moving parts get their own pivot empty named `<name>_<part>` placed at the hinge, documented in META['animate']
  (e.g. a door leaf rotating about Z, a drawer sliding in Y, clock hands about Y).
- Printed graphics (labels, screens, calendars, book titles, signs): draw a PNG with Pillow in the lab venv
  (`.venv/Scripts/python.exe`, write the script to `assets/props/tex/make_<name>.py`, output `assets/props/tex/<name>_*.png`),
  bold flat cartoon graphics, big readable shapes, Arial Black / Arial Bold from C:/Windows/Fonts. No Google Flow calls
  (the one Flow window is shared; list any picture you would want from it in your report instead).

## Style (from the reference frames, ref/sheets/s01-s08.png: look at them)

Cel-lit 3D cartoon: simple chunky shapes with soft bevels (`bevel=` 0.005-0.02), thick dark outlines on every
silhouette, saturated but slightly warm colours (no pure white / pure black surfaces: whites ~#f2efe6, darks ~#2a2622),
small amounts of painted texture (`tex='grain'` on walls / plastic at 0.03-0.06, `'wood'` on wood, `'paper'` on paper),
readable silhouettes, a few charming details per prop (screws, a sticker, a coffee ring, a cable), nothing noisy.
Props must read at phone size in a 1080x1920 frame: big shapes first, details second.

## Verify (mandatory, every prop)

```
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P engine/run.py -- tools/propview.py --prop <name> --out renders/props/<name> --scale 0.5
.venv/Scripts/python.exe tools/propsheet.py renders/props/<name>
```
Then LOOK at `renders/props/<name>/sheet.jpg` (Read tool). Iterate until: no floating / interpenetrating parts, no
z-fighting (coplanar faces: offset decals >= 1 mm), outlines present and not doubled on decals, proportions right next
to the 1.3 m scale character, graphics readable, moving parts pivot correctly (render once with the part moved via kw,
e.g. `--kw "{\"open\": 1}"`). Report what failed on the way and how you fixed it (it goes into the style's SOP).
