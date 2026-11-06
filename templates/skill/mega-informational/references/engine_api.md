# engine_api: mega.py (`import mega as M`)

Generated from engine/mega.py (blender-lab tools/mega_api_doc.py). Primitives come from cz: `cz.box(name, (w, d, h), loc, mat,
rot=(deg), bevel=, ol=0)`, `cz.cyl(name, r, h, loc, mat, verts=, ol=0)`, `cz.sphere`, `cz.plane(name, w, h, loc, mat, rot)`,
`cz.text(name, body, size, loc, mat, rot, extrude)`, `cz.empty`, `cz.bake(obj, path, values, f0)`, `cz.find(name)`. ALWAYS
pass `ol=0` (no outlines in this look) and M.* materials. Time: `t = (f - 1) / 30`, a word at s seconds = frame round(s*30)+1;
`W = cz.words()` and `cz.at(W, "word", n)` give the narration words.

### `setup(frame_end, sun_elev=28, sun_rot=135, sun_power=3.2, sky_strength=0.16, samples=4, mb=0.5, res=None, exposure=-0.2, ao=False, haze=0.0, sky_sat=1.7, light_sat=0.55, light_k=1.3, sun_disc=True)`

Fast realistic EEVEE: physical sky world (multiple scattering), a matching sun lamp with soft shadows,
AgX, motion blur (shutter mb, 0 = off). sun_rot: degrees around Z (0 = light from +Y toward -Y).

### `sun_dir()`



### `pbr(name, color='#888888', rough=0.6, metal=0.0, img=None, scale=1.0, bump=0.0, bump_scale=8.0, coord='Object', emit=None, emit_strength=0.0, spec=0.5, coat=0.0, tint=None, noise=0.0)`

Principled BSDF. img: a seamless texture (box-projected in object coords * scale), tint multiplies it.
bump: procedural noise bump strength (bump_scale its frequency). noise: colour variation 0..1.

### `rock(name='rock', color='#4a4b50', dark='#1e1f23', scale=1.0, bump=0.9, img=None, pits=True)`

Dark pitted basalt (the slab): two-tone voronoi pits + noise, strong bump. img= a Flow rock texture instead.

### `snow_rock(name='snowrock', rock_col='#5a5650', snow_col='#f4f7ff', thresh=0.55, scale=1.0, img_rock=None, img_snow=None, bump=0.5, snow_noise=0.18)`

Terrain shader: snow on flat ground (normal.z above thresh, broken by noise), rock on steep faces.

### `xray(name='xray', color='#22e83a', alpha=0.55, strength=0.9, fresnel=True)`

The reference's highlight: see-through emissive green (rim brighter). Animate visibility with xray_fade().

### `xray_fade(mat, keys, f0=1)`

keys [(t, 0..1)]: keyframes the material's overall opacity (the 'gate' node, or 'alpha' without fresnel).

### `emit(name, color, strength=5.0)`



### `steel(name='steel', color='#b8bcc4', rough=0.22, panels=0.0, panel_scale=4.0, img=None, scale=1.0)`

Polished steel; panels>0 draws panel seams (brick texture mortar as dark grooves + bump).

### `water(name='water', color='#0b3a4a', rough=0.04)`

Deep teal sea. Pair with ocean() geometry for real waves (sun glints come from the sun lamp + low roughness).

### `cloud_mat(name='cloud', img=None, strength=1.6)`

Flow cloud picture on black -> brightness is the alpha (assets/mega/clouds.png). Use on cz.plane cards.

### `card_mat(name, img, alpha=True, emit_strength=0.0, shadeless=False)`

A picture on a card (Flow clouds, signs, the ALASKA map...). shadeless: emission only (sky cards).

### `fbm(x, y, seed=0, octaves=6, ridged=False, lac=2.0, gain=0.5)`



### `heightfield(name, size, res, fn, mat=None, loc=(0, 0, 0), smooth=True)`

A grid mesh size=(w, d) with res=(nx, ny) vertices; fn(X, Y) -> Z (numpy arrays, local coords).

### `mountain_fn(peak_h=1.0, radius=1.0, seed=3, ridge=0.55, base=0.0, sharp=1.6, detail=0.04)`

An Everest-like peak: a radial cone shaped by ridged fbm (sharp arêtes) + small detail.

### `range_fn(height=0.3, scale=1.0, seed=5, ridged=True, floor=0.0)`

Endless snowy ridges for backgrounds (ridged fbm).

### `displace(ob, strength=0.1, scale=0.5, detail=6, subdiv=0, seed_offset=(0, 0, 0))`

Procedural displacement (Blender clouds texture) - roughen a cylinder / box into rock.

### `ocean(name='sea', size=400.0, res=10, scale=1.0, wave=0.6, choppy=1.0, mat=None, f0=1, f1=1800, loc=(0, 0, 0), spatial=1.0)`

Blender's ocean modifier plane, animated over [f0, f1] (time keyed).

## class `Flight`

The camera (v2, 2026-10-27: the owner called v1's moves "jittery, jaggy"). keys: (t, eye, target[, lens[, roll]]).
v1 eased every span in and out on its own, so the camera STOPPED at every key and re-accelerated, and uneven key
spacing made the speed jump at each key. v2: one time-continuous spline (non-uniform Catmull-Rom on the key TIMES:
the velocity is continuous through every key), then the baked path is smoothed (gaussian, `smooth` frames sigma),
the LOOK DIRECTION is smoothed as a unit vector (a near target no longer swings the view), lens and roll too.
cuts=[t, ...]: hard cuts inside the shot (nothing is smoothed across them, the spline restarts there).
hold=True on a key (a 6th item, or keys repeated) parks the camera there: velocity 0 at that key only.
ease: kept for old shot files and IGNORED unless strict_ease=True. Every bake prints `CZ CAM` - the measured
smoothness (max angular acceleration deg/f^2, max speed change %/f) - and `CZ CAMJERK` frames over the limit.

### `Flight.__init__(keys, name='cam', lens=24, clip=(0.05, 5000), sensor=24, dof=None, ease='inout', ease_p=1.6, up=None, smooth=3.0, cuts=(), strict_ease=False, lens_range=(14, 50), push=0.0, push_frames=7, creep=0.0006, retime=True, speed_ease=0.6, keep_cuts=False)`

up: a vector or a function of t giving the camera's up (default world Z; a globe wants the surface normal).
lens_range: lenses outside it are clamped (the reference shoots wide: 14-50 mm on a 24 mm vertical sensor).

### `Flight.at(t)`



### `Flight.bake(f0, f1, shake=0.0, seed=1)`



### `cam_report(F, E, D, L, seg, acc_lim=0.6, spd_lim=12.0, skip=())`

Measured camera smoothness: angular velocity (deg/f) and its change (deg/f^2), eye speed change (% per frame),
lens change (mm/f). Prints CZ CAM (maxima) and CZ CAMJERK <frame> ... for frames over the limits (not at cuts).

### `Quat_roll(deg)`



### `visible(obj, spans, f0, f1, children=True)`

Show obj only during spans [(t0, t1)] (seconds), keyed hide_render per frame boundaries.

### `bake_path(obj, f0, f1, pos=None, rot=None, scale=None, stepped=False)`

Per-frame keys from functions of time t (seconds): pos(t)->xyz, rot(t)->degrees xyz, scale(t)->xyz or float.

### `join(name, objs, apply=False)`

Join many meshes into one object (fewer draw calls = faster EEVEE). apply=True also applies the result's
transform (otherwise the first part's rotation rides along into copies placed later: reactors lay on their side).

### `scatter(make, n, area, seed=1, z=0.0, rot=True, scale=(0.8, 1.2), avoid=None)`

Call make(i, (x, y, z), rotZ_deg, s) n times over area ((x0, y0), (x1, y1)); avoid(x, y) -> True skips.

### `text3d(name, body, size, loc, rot=(90, 0, 0), mat=None, extrude=0.02, align='CENTER', font=None)`



### `count_text(obj, fmt, keys, f0, f1)`

Animated number text: a frame-change handler is not available headless in render jobs we bake as separate
text objects per frame - instead swap the body in a frame_change_pre handler (works in -b renders).

### `column(name, r, h, mat=None, rough=0.06, seed=1, nu=256, nv=96, taper=0.0, loc=(0, 0, 0), top=True, pits=0.5)`

A rock column (the cut slab): a cylinder mesh whose radius is perturbed by fbm (vertical strata + lumps) and
pitted. rough = relative radius variation. top=False leaves it open (a cap mesh sits there).

