# Small window for a bare room with venetian blinds. A 0.9 x 1.1 m aluminium frame holding two Japanese-style sliding
# sashes (the front one carries a crescent lock on its meeting stile), an interior sill with a coffee ring, a blank pale
# sky behind (an emissive plane 0.35 m behind the wall face, casts no shadow so a light placed outside shines in
# through the slats), and outside-mounted cream venetian blinds: headrail on two brackets above the frame, 20 slats on
# their own pivots, ladder cords, a bottom rail just above the sill, a tilt wand (left) and a pull cord with an acorn
# (right). One slat is broken short (broken=True) so a sliver of sky shows even when closed.
# Wall prop: back at y = 0 (the wall's room-side face), centred on x = 0, z = 0 (the frame's centre); room at -Y.
# The set's wall needs an opening between 0.79 x 0.99 (the glass) and 0.9 x 1.1 (the frame's outer edge), and must be
# thinner than sky_dist (0.35 m) behind it.
# Animate: every <name>_slat<i> pivot turns about X: rotation_euler.x = slat_angle(open) (0 = slats flat / open,
# 75 deg = closed, room-side edge down); pose(root, k) sets them all at once.
import math

META = {'size': (1.0, 0.22, 1.2), 'anchor': 'back centre on the wall (y = 0), frame centre at z = 0',
        'opening': (0.9, 1.1), 'animate': ['_slat0 .. _slat19 (rotation_euler.x = slat_angle(open))'],
        'params': "open=1.0 (0 closed .. 1 slats flat), broken=True, glass=True, sky='#dde9ef', sky_dist=0.35, "
                  "blind='#e2d8c2' (aged beige: pure cream vanished against the pale sky)"}

N_SLATS, CLOSED = 20, 75.0
TOP, RAIL = 0.545, -0.515          # first slat pivot height, bottom rail centre
YP = -0.115                        # slat pivot depth (headrail centre)


def slat_angle(open):
    """rotation_euler.x of every slat pivot for open = 0 (closed) .. 1 (flat)."""
    return math.radians(CLOSED * (1 - max(0.0, min(1.0, open))))


def pose(root, open):
    for o in root.children:
        if '_slat' in o.name and o.type == 'EMPTY': o.rotation_euler.x = slat_angle(open)


def build(cz, name='window_blinds', open=1.0, broken=True, glass=True, sky='#dde9ef', sky_dist=0.35, blind='#e2d8c2'):
    root = cz.empty(name)
    alu = cz.toon(name + '_alu', '#aeb3b6', tex='grain', tex_scale=2.0, tex_strength=0.04)
    alu2 = cz.toon(name + '_alu2', '#9ea4a8', tex='grain', tex_scale=2.0, tex_strength=0.04)
    W, H, fw, fd = 0.9, 1.1, 0.055, 0.06
    # outer frame
    for sz in (-1, 1):
        cz.box(f'{name}_frame{"BT"[sz > 0]}', (W, fd, fw), (0, -fd / 2, sz * (H / 2 - fw / 2)), alu, bevel=0.008,
               ol=0.006, parent=root)
    for sx in (-1, 1):
        cz.box(f'{name}_frame{"LR"[sx > 0]}', (fw, fd, H - 2 * fw), (sx * (W / 2 - fw / 2), -fd / 2, 0), alu,
               bevel=0.008, ol=0.006, parent=root)
    # two sliding sashes: left one in front (room side), right one behind, overlapping at the middle
    xi, zi = W / 2 - fw, H / 2 - fw
    sw, sd = 0.035, 0.022
    for k, (xa, xb, yc) in enumerate(((-xi, 0.015, -0.042), (-0.015, xi, -0.017))):
        cx, w = (xa + xb) / 2, xb - xa
        for sz in (-1, 1):
            cz.box(f'{name}_sash{k}{"BT"[sz > 0]}', (w, sd, sw), (cx, yc, sz * (zi - sw / 2)), alu2, bevel=0.004,
                   ol=0.004, parent=root)
        for sx in (-1, 1):
            cz.box(f'{name}_sash{k}{"LR"[sx > 0]}', (sw, sd, 2 * zi - 2 * sw), (cx + sx * (w / 2 - sw / 2), yc, 0), alu2,
                   bevel=0.004, ol=0.004, parent=root)
    # crescent lock on the front sash's meeting stile
    lock = cz.toon(name + '_lockm', '#d7d3c9')
    lx, ly = 0.015 - sw / 2, -0.042 - sd / 2
    cz.box(name + '_lockbase', (0.026, 0.008, 0.06), (lx, ly - 0.004, 0.02), lock, bevel=0.003, ol=0.002, parent=root)
    cz.box(name + '_locklever', (0.05, 0.008, 0.012), (lx - 0.012, ly - 0.012, 0.03), lock, rot=(0, -25, 0), bevel=0.003,
           ol=0.002, parent=root)
    cz.sphere(name + '_lockknob', 0.009, (lx - 0.034, ly - 0.013, 0.04), lock, ol=0.002, parent=root, segs=16, rings=8)
    # interior sill with a coffee ring
    sillm = cz.toon(name + '_sillm', '#ddd5c4', tex='grain', tex_scale=1.5, tex_strength=0.05)
    cz.box(name + '_sill', (1.0, 0.22, 0.035), (0, -0.11, -H / 2 - 0.0175), sillm, bevel=0.008, ol=0.006, parent=root)
    cz.cyl(name + '_ring', 0.034, 0.001, (0.28, -0.183, -H / 2 + 0.001), cz.toon(name + '_ringm', '#b39a7a'), verts=32,
           ol=0, parent=root)
    cz.cyl(name + '_ringin', 0.0285, 0.001, (0.28, -0.183, -H / 2 + 0.002), sillm, verts=32, ol=0, parent=root)
    # glass glints (the glass itself is not modelled, the view stays clear)
    if glass:
        gm = cz.glow(name + '_glintm', '#f4f9fa', 1.0)
        for k, (x0, y) in enumerate(((-xi + sw, -0.042), (0.015 + 0.02, -0.017))):
            for j, (wd, ln, off) in enumerate(((0.024, 0.26, 0.0), (0.01, 0.16, 0.05))):
                a = math.radians(40)
                cz.box(f'{name}_glint{k}{j}', (wd, 0.002, ln), (x0 + 0.13 + off * math.cos(a), y, 0.3 - off * math.sin(a)), gm,
                       rot=(0, 40, 0), bevel=0, ol=0, parent=root)
    # blank pale sky
    skyp = cz.plane(name + '_sky', 1.6, 1.8, (0, sky_dist, 0), cz.glow(name + '_skym', sky, 1.0), parent=root)
    skyp.visible_shadow = False
    # blinds: headrail on two brackets above the frame
    bl = cz.toon(name + '_blindm', blind, tex='grain', tex_scale=3.0, tex_strength=0.04)
    cz.box(name + '_headrail', (0.94, 0.07, 0.05), (0, YP, 0.605), bl, bevel=0.008, ol=0.005, parent=root)
    for sx in (-1, 1):
        cz.box(f'{name}_bracket{"LR"[sx > 0]}', (0.04, 0.085, 0.062), (sx * 0.4, -0.0425, 0.605), bl, bevel=0.004,
               ol=0.004, parent=root)
    s = (TOP - RAIL) / N_SLATS
    ang = slat_angle(open)
    for i in range(N_SLATS):
        pv = cz.empty(f'{name}_slat{i}', (0, YP, TOP - i * s), parent=root)
        pv.rotation_euler = (ang, 0, 0)
        L, x = 0.92, 0.0
        if broken and i == 13: L, x = 0.69, -0.115     # snapped off at the right end
        cz.box(f'{name}_slat{i}_board', (L, 0.06, 0.009), (x, 0, 0), bl, bevel=0.002, ol=0.002, parent=pv)
    cz.box(name + '_rail', (0.93, 0.066, 0.025), (0, YP, RAIL), bl, bevel=0.006, ol=0.004, parent=root)
    cordm = cz.toon(name + '_cordm', '#d9d1bf')
    for k, cx in enumerate((-0.3, 0.3)):     # ladder cords in front of the slats
        cz.cyl(f'{name}_ladder{k}', 0.0032, 0.58 - RAIL, (cx, YP - 0.036, RAIL), cordm, verts=8, ol=0, parent=root)
    # tilt wand (left) and pull cord with an acorn (right), each out of a little guide under the headrail front
    # (kept 5 mm+ in front of the slats' front edges: an acorn level with a slat used to cut into it)
    for k, gx in enumerate((-0.43, 0.43)):
        cz.box(f'{name}_guide{k}', (0.03, 0.032, 0.026), (gx, -0.156, 0.57), bl, bevel=0.004, ol=0.003, parent=root)
    cz.cyl(name + '_wand', 0.0065, 0.5, (-0.43, -0.162, 0.07), cz.toon(name + '_wandm', '#e6e1d3'), verts=12, ol=0.002,
           parent=root)
    cz.cyl(name + '_pull', 0.003, 0.52, (0.43, -0.165, 0.05), cordm, verts=8, ol=0, parent=root)
    acorn = cz.toon(name + '_acornm', '#b98a5a', tex='wood', tex_scale=4.0, tex_strength=0.08)
    cz.capsule(name + '_acorn', 0.014, 0.05, (0.43, -0.165, 0.002), acorn, ol=0.002, parent=root)
    return root
