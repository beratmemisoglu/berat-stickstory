# Folding screen for the throne: N lacquer panels standing in a shallow zig-zag on carved block feet. One painted
# picture runs across all panels (each panel shows its strip of the PNG), under each picture a carved skirt board with
# a gold rosette boss, gold corner fittings, gold hinges at the joins, a gold-edged top rail, a little cloud crest on
# every panel and a big centre crest: a gold flame ring round a red pearl.
# Floor prop: root = floor centre of the screen's back line (the panel joins at the back touch y = 0); front -Y.
import math, bmesh

META = {'size': (5.6, 0.24, 4.1), 'anchor': 'floor centre of the back line (front -Y)', 'animate': [],
        'params': "img='assets/props/tex/hall_screen_crop.png', width=5.6, panels=6, pic_h=2.6, zig=0.2 (depth of the "
                  "zig-zag), lacquer='#2e1a16', skirt_h=0.55, feet=0.16"}


def build(cz, name='hall_screen', img='assets/props/tex/hall_screen_crop.png', width=5.6, panels=6, pic_h=2.6, zig=0.2,
          lacquer='#2e1a16', skirt_h=0.55, feet=0.16):
    root = cz.empty(name)
    lac = cz.toon(name + '_lac', lacquer, tex='grain', tex_scale=2.0, tex_strength=0.05)
    gold = cz.toon('hall_gold', '#d2a23e', tex='grain', tex_scale=3.0, tex_strength=0.04)
    red = cz.toon('hall_lac_red', '#9a2a1e', tex='grain', tex_strength=0.04)
    pic = cz.toon(name + '_picm', img=img, lift=0.74)
    B = 0.05                      # frame border round the picture
    rail = 0.1
    H = skirt_h + B + pic_h + B + rail
    step = width / panels
    xs = [-width / 2 + k * step for k in range(panels + 1)]
    ys = [0.0 if k % 2 == 0 else -zig for k in range(panels + 1)]
    for k in range(panels):
        x0, x1, y0, y1 = xs[k], xs[k + 1], ys[k], ys[k + 1]
        pw = math.hypot(x1 - x0, y1 - y0); a = math.degrees(math.atan2(y1 - y0, x1 - x0))
        c = cz.empty(f'{name}_p{k}', ((x0 + x1) / 2, (y0 + y1) / 2, 0), parent=root); c.rotation_euler.z = math.radians(a)
        # the panel board (local: x along the panel, front -Y, back at y = +0.03)
        cz.box(f'{name}_p{k}_board', (pw - 0.012, 0.05, H), (0, 0.0, feet + H / 2), lac, bevel=0.01, ol=0.007, parent=c)
        # picture strip
        z_pic = feet + skirt_h + B + pic_h / 2
        pl = cz.plane(f'{name}_p{k}_pic', pw - 2 * B, pic_h, (0, -0.0262, z_pic), pic, parent=c)
        uv = pl.data.uv_layers[0].data
        for lp in uv:
            lp.uv = ((k + lp.uv[0]) / panels, lp.uv[1])
        # skirt board: red inset with a gold boss
        zs = feet + skirt_h / 2 + 0.01
        cz.box(f'{name}_p{k}_skirt', (pw - 2 * B - 0.04, 0.012, skirt_h - 0.08), (0, -0.028, zs), red, bevel=0.006, ol=0.004, parent=c)
        cz.cyl(f'{name}_p{k}_boss', 0.11, 0.02, (0, -0.033, zs), gold, rot=(90, 0, 0), verts=24, bevel=0.006, ol=0.004, parent=c)
        cz.cyl(f'{name}_p{k}_boss2', 0.055, 0.02, (0, -0.045, zs), red, rot=(90, 0, 0), verts=20, bevel=0.005, ol=0.003, parent=c)
        # gold rule between skirt and picture, top rail edge
        cz.box(f'{name}_p{k}_rule', (pw - 0.03, 0.01, 0.03), (0, -0.03, feet + skirt_h + B * 0.5), gold, bevel=0.003, ol=0.003, parent=c)
        cz.box(f'{name}_p{k}_rail', (pw - 0.012, 0.064, 0.045), (0, 0.0, feet + H - 0.02), gold, bevel=0.006, ol=0.004, parent=c)
        # corner fittings at the picture corners
        for sx in (-1, 1):
            for sz, zz in ((-1, feet + skirt_h + B), (1, feet + skirt_h + B + pic_h)):
                cz.box(f'{name}_p{k}_fit{sx}{sz}', (0.09, 0.008, 0.09), (sx * (pw / 2 - B - 0.03), -0.03, zz - sz * 0.03), gold, bevel=0.002, ol=0.003, parent=c)
        # block feet
        for sx in (-1, 1):
            cz.box(f'{name}_p{k}_foot{sx}', (0.16, 0.2, feet), (sx * (pw / 2 - 0.12), -0.02, feet / 2), lac, bevel=0.012, ol=0.005, parent=c)
        # a little cloud crest per panel
        cr =cz.cyl(f'{name}_p{k}_crest', 0.16, 0.04, (0, 0.02, feet + H + 0.0), lac, rot=(90, 0, 0), verts=20, ol=0.005, parent=c)
        cr.scale = (1.4, 0.55, 1.0)
        cz.cyl(f'{name}_p{k}_crestg', 0.07, 0.02, (0, -0.02, feet + H + 0.04), gold, rot=(90, 0, 0), verts=16, ol=0.003, parent=c)
    # hinges at the joins
    for k in range(1, panels):
        for zz in (feet + 0.4, feet + H * 0.5, feet + H - 0.4):
            cz.box(f'{name}_hinge{k}_{zz:.1f}', (0.05, 0.05, 0.1), (xs[k], ys[k] - 0.0, zz), gold, bevel=0.005, ol=0.003, parent=root)
    # the centre crest: a flame ring round a red pearl over the middle join
    zc = feet + H + 0.22
    kmid = panels // 2
    ring = cz.cyl(name + '_ring', 0.26, 0.05, (xs[kmid], ys[kmid] - 0.02, zc), gold, rot=(90, 0, 0), verts=28, bevel=0.01, ol=0.006, parent=root)
    cz.cyl(name + '_ringin', 0.19, 0.06, (xs[kmid], ys[kmid] - 0.02, zc), lac, rot=(90, 0, 0), verts=28, ol=0.0, parent=root)
    cz.sphere(name + '_pearl', 0.13, (xs[kmid], ys[kmid] - 0.07, zc), cz.toon('hall_pearl', '#d8432e'), ol=0.005, parent=root, segs=24, rings=12)
    for j in range(7):        # flame tongues round the ring
        a = math.radians(-60 + j * 20 + 0)
        ax, az = math.sin(a), math.cos(a)
        f = cz.cyl(f'{name}_flame{j}', 0.06, 0.2, (xs[kmid] + ax * 0.24, ys[kmid] - 0.01, zc + az * 0.24), gold, rot=(0, math.degrees(a), 0),
                   r2=0.005, verts=8, ol=0.004, parent=root)
    # the crest's stand down to the rail
    cz.box(name + '_cstand', (0.16, 0.05, 0.12), (xs[kmid], ys[kmid] - 0.01, feet + H + 0.02), gold, bevel=0.01, ol=0.004, parent=root)
    return root
