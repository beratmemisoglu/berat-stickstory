# Night sky: a big curved sky backdrop for the hill scenes. A 160-degree arc of 40 vertical cards (radius 20 m, ~39 m
# wide across, z -4..26 m) facing its centre, carrying one painted panorama (tex/make_night_sky.py): the gradient,
# faint painted stars, a soft moon halo, two ranges of distant karst-mountain silhouettes with mist bands, a few cloud
# streaks. In front of it: a big pale moon disc with craters, small glowing star dots and a handful of four-point
# twinkle stars. time='dawn': a pink-orange dawn gradient, a pale sun glow behind the mountains, gold-lit clouds, no
# moon and no stars.
# Everything is unlit emission (looks the same under any set lighting) and casts no shadow.
# Root = the centre of the arc (stand it at the middle of the set, z = 0 = the ground); the arc covers azimuth -80..+80
# degrees around +Y (rotate the root about Z to aim it: the camera should look roughly toward +Y). The painted horizon
# (mountain feet) is at z ~ 0, the moon centre at azimuth +24 deg, z 14.5 m.
# Animate: <name>_star<i> scale (twinkle; the four-point stars are <name>_star0..5), <name>_moon (the moon disc; its
# halo is painted into the sky, so keep it in place or switch moon=False).
import math, random

R = 20.0                    # arc radius
ARC = 160.0                 # degrees, centred on +Y
Z0, Z1 = -4.0, 26.0         # card bottom / top
NF = 40                     # cards
MOON = (24.0, 14.5, 1.7)    # azimuth (deg, + = toward +X), height, radius
IMG_W = 4096
IMG_H = int(round(IMG_W * (Z1 - Z0) / (R * math.radians(ARC))))

META = {'size': (39.4, 16.5, 30.0), 'anchor': 'centre of the arc on the ground; the arc spans azimuth -80..80 deg '
        'around +Y at radius 20 m, z -4..26',
        'animate': ['_star0.._star5 (four-point twinkle stars, scale)', '_star6.. (dots, scale)', '_moon'],
        'params': "time='night'|'dawn', moon=None (default: night only), stars=None (default: night only), seed=4"}


def to_uv(az, z):
    """Panorama coordinates (0..1) of azimuth az (deg) and height z (m) on the arc."""
    return (az + ARC / 2) / ARC, (z - Z0) / (Z1 - Z0)


def _on_arc(az, z, rr=R):
    a = math.radians(az)
    return (rr * math.sin(a), rr * math.cos(a), z)


def _star_pts(r1, r0, n=4, rot=0.0):
    pts = []
    for k in range(2 * n):
        a = rot + math.pi * k / n
        r = r1 if k % 2 == 0 else r0
        pts.append((r * math.cos(a), r * math.sin(a)))
    return pts


def _prism(cz, name, pts, depth, mat, loc=(0, 0, 0), rot=(0, 0, 0), ol=0.0, parent=None):
    area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
    if area < 0: pts = pts[::-1]
    n = len(pts)
    o = cz.cyl(name, 1.0, depth, loc, mat, rot=rot, verts=n, ol=ol, parent=parent)
    vs = o.data.vertices
    a0 = math.atan2(vs[0].co.y, vs[0].co.x); step = 2 * math.pi / n
    for v in vs:
        k = int(round(((math.atan2(v.co.y, v.co.x) - a0) % (2 * math.pi)) / step)) % n
        v.co.x, v.co.y = pts[k]
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    return o


def _card(cz, name, az, z, mat, parent, rr):
    """A small flat disc / shape standing on the arc at radius rr, facing the centre: an empty turned like the cards."""
    pv = cz.empty(name, _on_arc(az, z, rr), parent=parent)
    pv.rotation_euler = (math.radians(90), 0, math.radians(-az))
    return pv


def build(cz, name='night_sky', time='night', moon=None, stars=None, seed=4):
    time = time if time in ('night', 'dawn') else 'night'
    moon = (time == 'night') if moon is None else bool(moon)
    stars = (time == 'night') if stars is None else bool(stars)
    rnd = random.Random(seed)
    root = cz.empty(name)
    sky = cz.screen(f'{name}_sky_{time}', f'assets/props/tex/night_sky_{time}.png', 1.0)
    d = ARC / NF
    chord = 2 * R * math.sin(math.radians(d) / 2) * 1.015
    for i in range(NF):
        az = -ARC / 2 + (i + 0.5) * d
        o = cz.plane(f'{name}_card{i}', chord, Z1 - Z0, _on_arc(az, (Z0 + Z1) / 2), sky, rot=(90, 0, -az), parent=root)
        uvl = o.data.uv_layers[0]
        for lp in uvl.data:     # this card shows its slice of the panorama
            u, v = lp.uv
            lp.uv = ((i + 0.5 + (u - 0.5) * 1.015) / NF, v)
    if moon:
        maz, mz, mr = MOON
        pv = _card(cz, name + '_moon', maz, mz, None, root, R - 0.4)
        cz.cyl(name + '_moondisc', mr, 0.04, (0, 0, 0), cz.glow(name + '_moonm', '#f3ead0', 1.25), verts=64, ol=0.0, parent=pv)
        crm = cz.glow(name + '_craterm', '#ddd0aa', 1.1)
        for i, (x, y, r) in enumerate(((-0.55, 0.45, 0.36), (0.5, -0.35, 0.28), (0.25, 0.72, 0.17), (-0.2, -0.75, 0.22))):
            cz.cyl(f'{name}_crater{i}', r, 0.01, (x, y, 0.0415), crm, verts=32, ol=0.0, parent=pv)
    if stars:
        sm = cz.glow(name + '_starm', '#fff4d2', 2.0)
        k = 0
        for i in range(6):     # four-point twinkle stars
            for _ in range(60):
                az = rnd.uniform(-72, 72); z = rnd.uniform(11, 23)
                if math.hypot(az - MOON[0], (z - MOON[1]) * 2.6) > 18: break
            pv = _card(cz, f'{name}_star{k}', az, z, None, root, R - 0.3)
            s = rnd.uniform(0.28, 0.42)
            _prism(cz, f'{name}_star{k}_m', _star_pts(s, s * 0.2, rot=math.radians(rnd.uniform(-8, 8))), 0.02, sm, (0, 0, -0.02),
                   parent=pv)
            k += 1
        for i in range(46):    # small dots
            for _ in range(60):
                az = rnd.uniform(-78, 78); z = rnd.uniform(8.5, 25)
                if math.hypot(az - MOON[0], (z - MOON[1]) * 2.6) > 14: break
            pv = _card(cz, f'{name}_star{k}', az, z, None, root, R - 0.2)
            cz.cyl(f'{name}_star{k}_m', rnd.uniform(0.05, 0.11), 0.02, (0, 0, -0.02), sm, verts=12, ol=0.0, parent=pv)
            k += 1
    for o in [root] + list(root.children_recursive):
        if o.type == 'MESH': o.visible_shadow = False
    return root
