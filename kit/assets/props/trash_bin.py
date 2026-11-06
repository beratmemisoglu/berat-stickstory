# Trash bin: a small tapered office waste bin with a rolled rim, a dark opening (cartoon cheat: the body is solid, a
# dark disc with an inner-wall ring reads as the hole from the usual front/above views), a "燃えるゴミ" (burnable trash)
# sticker wrapped around the front, and crumpled paper balls: papers=1..2 sit in the opening, the 3rd is a missed
# throw on the floor beside the bin. Floor prop: root at the floor centre, sticker toward -Y. No moving parts.
import math, random
from mathutils import Euler

META = {'size': (0.29, 0.29, 0.33), 'anchor': 'floor centre, sticker toward -Y', 'animate': [],
        'params': 'papers=0..3 (1-2 in the bin, the 3rd on the floor at +X), color=#hex, sticker=True'}

STRIPS = 6                                         # sticker slices (tex/make_trash_bin.py N)
TEX = 'assets/props/tex/'
R0, R1, Z0, H = 0.11, 0.135, 0.01, 0.29             # body: bottom radius, top radius, bottom z, height


def _crumple(o, amt, seed, rot=(0, 0, 0), floor=None):
    """Crumpled paper: push every vertex of a low-poly sphere in or out a little and shade it flat, so the facets read
    as creases under cel light (mesh edit; the outline modifier follows). rot = the ball's rotation (radians); with
    floor=z the ball is lifted so its lowest point rests on that height."""
    rnd = random.Random(seed)
    for v in o.data.vertices:
        v.co = v.co * (1 + rnd.uniform(-amt, amt))
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons))
    o.data.update()
    o.rotation_euler = rot
    if floor is not None:
        M = Euler(rot).to_matrix()
        o.location.z = floor - min((M @ v.co).z for v in o.data.vertices)


def _wrap(cz, name, prefix, n, r_at, zc, w, h, phi0, parent, tilt=0.0):
    """A printed sticker wrapped around a round wall: n narrow cards (one PNG slice each) on the facets of the wall,
    1.8 mm proud of it, leaning with the wall's taper (tilt degrees, top outward). phi0 = centre angle (0 = -Y)."""
    r = r_at(zc) + 0.0018
    dphi = w / n / r
    for i in range(n):
        phi = phi0 + (i + 0.5 - n / 2) * dphi
        m = cz.toon(f'{name}_m{i}', img=TEX + f'{prefix}{i}.png', lift=0.55, alpha_clip=True)
        cz.plane(f'{name}{i}', 2 * r * math.sin(dphi / 2) * 1.02, h, (r * math.sin(phi), -r * math.cos(phi), zc), m,
                 rot=(90 + tilt, 0, math.degrees(phi)), parent=parent)


def build(cz, name='trash_bin', papers=2, color='#4d8a8c', sticker=True):
    root = cz.empty(name)
    body = cz.toon(name + '_body', color, tex='grain', tex_strength=0.05)
    rim = cz.toon(name + '_rimm', '#5fa3a3' if color == '#4d8a8c' else color, tex='grain', tex_strength=0.04)
    dark = cz.toon(name + '_dark', '#2a2622')
    cz.cyl(name + '_foot', R0 - 0.006, 0.016, (0, 0, 0), cz.toon(name + '_footm', '#33494b'), bevel=0.004, ol=0.0, parent=root, verts=48)
    cz.cyl(name + '_body', R0, H, (0, 0, Z0), body, r2=R1, bevel=0.005, ol=0.007, parent=root, verts=48)
    zr = Z0 + H - 0.012
    cz.cyl(name + '_rim', R1 + 0.008, 0.026, (0, 0, zr), rim, bevel=0.011, ol=0.007, parent=root, verts=48)
    top = zr + 0.026
    # the opening: inner wall in shadow (ring) + the dark depth, nudged toward the viewer so the far wall shows more
    cz.cyl(name + '_wall', R1 - 0.006, 0.003, (0, 0, top - 0.0015), cz.toon(name + '_wallm', '#3c4f50'), ol=0.0, parent=root, verts=48)
    cz.cyl(name + '_hole', R1 - 0.028, 0.003, (0, -0.008, top - 0.0003), dark, ol=0.0, parent=root, verts=48)
    if sticker:
        a = math.degrees(math.atan((R1 - R0) / H))
        _wrap(cz, name + '_sticker', 'trash_bin_sticker', STRIPS, lambda z: R0 + (R1 - R0) * (z - Z0) / H, 0.165, 0.10, 0.08, 0.0, root, a)
    # crumpled paper balls
    spots = [((0.03, -0.025, top + 0.012), 0.05, '#f2efe6'), ((-0.06, 0.035, top + 0.022), 0.045, '#f1e4b2'),
             ((0.215, -0.09, 0.041), 0.044, '#f2efe6')]
    for i, (loc, r, c) in enumerate(spots[:max(0, min(3, int(papers)))]):
        b = cz.sphere(f'{name}_paper{i}', r, loc, cz.toon(f'{name}_paper_{c[1:]}', c, tex='paper', tex_strength=0.06), ol=0.004, parent=root, segs=12, rings=8)
        # the floor ball turns about Z only: a tilted object's bound box overshoots and the viewer would lift the bin
        _crumple(b, 0.17, 11 + i, (0, 0, 2.2) if i == 2 else (0.4 * i, 0.7 * i + 0.3, 1.1 * i), floor=0.0 if i == 2 else None)
    return root
