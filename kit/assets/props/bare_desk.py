# Bare desk: an old plain grey-green steel office desk (1.2 x 0.65 x 0.72 m), the kind left in a banishment room.
# Linoleum top in a dark edge band, a left side panel, a modesty panel, a pedestal of three drawers on the right
# (bar pulls, empty label cards, a lock on the top one) and a shallow centre drawer over the knee hole. Old-desk
# details: the bottom drawer sits a little crooked, two cartoon dents, paint chips, a torn asset-tag sticker.
# The top is empty except kw items='paper' (one sheet). Drawers slide on pivot empties toward -Y (location.y).
# Floor prop: root at the floor centre, the user's side (drawers, knee hole) faces -Y.
import os

META = {'size': (1.2, 0.65, 0.72), 'anchor': 'floor centre; drawers + knee hole face -Y',
        'animate': ['_drawer1', '_drawer2', '_drawer3', '_drawer_mid'],
        'params': "items='none'|'paper', drawer=0..1 (top pedestal drawer, slides 0.32 m toward -Y), drawer2, drawer3, "
                  "mid (centre drawer) 0..1, color (body), top (linoleum)"}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')


def build(cz, name='bare_desk', items='none', drawer=0.0, drawer2=0.0, drawer3=0.0, mid=0.0, color='#8a9c8a', top='#9ea596'):
    root = cz.empty(name)
    W, D, H = 1.2, 0.65, 0.72
    bm = cz.toon(name + '_bodym', color, tex='grain', tex_strength=0.04)
    im = cz.toon(name + '_innerm', '#66726a', tex='grain', tex_strength=0.04)
    em = cz.toon(name + '_edgem', '#4f5953', tex='grain', tex_strength=0.03)
    tm = cz.toon(name + '_topm', top, tex='grain', tex_strength=0.05)
    km = cz.toon(name + '_kickm', '#5b655d')
    mm = cz.toon(name + '_metalm', '#adaba2', tex='grain', tex_strength=0.04)
    rm = cz.toon(name + '_rubberm', '#2f2c29')
    cm = cz.toon(name + '_cardm', '#efe9da', tex='paper', tex_strength=0.04)
    chm = cz.toon(name + '_chipm', '#a3a69e')
    dk = cz.toon(name + '_darkm', '#2a2622')
    lin = cz.col(color)
    dentm = cz.toon(name + '_dentm', img=os.path.join(TEX, 'bare_desk_dent.png'), alpha_clip=True, tint=tuple(c * 1.3 for c in lin[:3]))

    # ---- top: dark edge band + linoleum mat (3 mm proud of the band)
    cz.box(name + '_top', (W, D, 0.03), (0, 0, 0.702), em, bevel=0.008, ol=0.008, parent=root)
    cz.box(name + '_mat', (W - 0.03, D - 0.03, 0.004), (0, 0, 0.718), tm, bevel=0.0015, ol=0, parent=root)
    zt = 0.687                                         # underside of the top
    # ---- carcass: left side panel, pedestal sides + back + recessed plinth, modesty panel, feet
    ph = zt - 0.02
    cz.box(name + '_side_l', (0.025, 0.60, ph), (-0.5775, 0, 0.02 + ph / 2), bm, bevel=0.006, ol=0.007, parent=root)
    cz.box(name + '_ped_in', (0.02, 0.60, ph), (0.18, 0, 0.02 + ph / 2), bm, bevel=0.005, ol=0.007, parent=root)
    cz.box(name + '_ped_out', (0.025, 0.60, ph), (0.5775, 0, 0.02 + ph / 2), bm, bevel=0.006, ol=0.007, parent=root)
    cz.box(name + '_ped_back', (0.375, 0.02, zt - 0.07), (0.3775, 0.29, 0.07 + (zt - 0.07) / 2), bm, bevel=0.003, ol=0.005, parent=root)
    cz.box(name + '_plinth', (0.375, 0.55, 0.05), (0.3775, 0.005, 0.045), km, bevel=0.003, ol=0.004, parent=root)
    cz.box(name + '_modesty', (0.735, 0.015, 0.50), (-0.1975, 0.2925, zt - 0.25), bm, bevel=0.004, ol=0.006, parent=root)
    for i, (x, y) in enumerate([(-0.5775, -0.26), (-0.5775, 0.26), (0.18, -0.26), (0.18, 0.26), (0.5775, -0.26), (0.5775, 0.26)]):
        cz.cyl(f'{name}_foot{i}', 0.018, 0.02, (x, y, 0), rm, ol=0.003, parent=root, verts=20)

    # ---- drawers: pivot at the front centre of each drawer (y = -0.30), slide = location.y
    def drawer_unit(key, x, z, w, h, depth, travel, k, pull_z, label_z=None, lock=False, crooked=False, dent=None):
        pv = cz.empty(f'{name}_{key}', (x, -0.30 - travel * max(0.0, min(1.0, float(k))), z), parent=root)
        par = pv
        if crooked:                                    # an old, slightly crooked drawer (a child empty, so the pivot stays clean)
            par = cz.empty(f'{name}_{key}_crooked', (0, -0.004, 0), parent=pv)
            par.rotation_euler = (0, 0.014, 0)
        cz.box(f'{name}_{key}_front', (w, 0.02, h), (0, -0.01, 0), bm, bevel=0.005, ol=0.006, parent=par)
        bw, bh = w - 0.06 if w < 0.5 else w - 0.035, max(0.03, h - 0.05)
        cz.box(f'{name}_{key}_bottom', (bw, depth, 0.008), (0, depth / 2, -h / 2 + 0.02), im, bevel=0, ol=0.003, parent=par)
        for sx in (-1, 1):
            cz.box(f'{name}_{key}_side{sx + 1}', (0.008, depth, bh), (sx * (bw / 2 - 0.004), depth / 2, -h / 2 + 0.024 + bh / 2), im, bevel=0, ol=0.003, parent=par)
        cz.box(f'{name}_{key}_back', (bw, 0.008, bh), (0, depth - 0.004, -h / 2 + 0.024 + bh / 2), im, bevel=0, ol=0.003, parent=par)
        # bar pull on two posts
        pw = 0.13 if w < 0.5 else 0.22
        cz.box(f'{name}_{key}_pull', (pw, 0.018, 0.022), (0, -0.044, pull_z), mm, bevel=0.007, ol=0.004, parent=par)
        for i, px in enumerate((-pw / 2 + 0.018, pw / 2 - 0.018)):
            cz.box(f'{name}_{key}_post{i}', (0.016, 0.026, 0.014), (px, -0.033, pull_z), mm, bevel=0.003, ol=0.003, parent=par)
        if label_z is not None:                        # label holder with an empty card
            cz.box(f'{name}_{key}_holder', (0.085, 0.004, 0.036), (0, -0.022, label_z), mm, bevel=0.001, ol=0.002, parent=par)
            cz.plane(f'{name}_{key}_card', 0.071, 0.024, (0, -0.0255, label_z), cm, parent=par)
        if lock:
            cz.cyl(f'{name}_{key}_lock', 0.012, 0.006, (w / 2 - 0.04, -0.02, h / 2 - 0.028), mm, rot=(90, 0, 0), bevel=0.0015, ol=0.002, parent=par, verts=20)
            cz.box(f'{name}_{key}_keyslot', (0.003, 0.002, 0.012), (w / 2 - 0.04, -0.0268, h / 2 - 0.028), dk, bevel=0, ol=0, parent=par)
        if dent:
            cz.plane(f'{name}_{key}_dent', 0.09, 0.045, (dent[0], -0.0215, dent[1]), dentm, parent=par)
        return pv

    drawer_unit('drawer1', 0.3775, 0.612, 0.414, 0.14, 0.5, 0.32, drawer, 0.03, -0.025, lock=True)
    drawer_unit('drawer2', 0.3775, 0.452, 0.414, 0.17, 0.5, 0.32, drawer2, 0.045, -0.01)
    drawer_unit('drawer3', 0.3775, 0.218, 0.414, 0.288, 0.5, 0.34, drawer3, 0.104, 0.05, crooked=True, dent=(-0.07, -0.075))
    drawer_unit('drawer_mid', -0.1975, 0.650, 0.725, 0.064, 0.44, 0.28, mid, -0.012)

    # ---- wear: a dent and a torn asset tag on the left side, paint chips on the edges
    cz.plane(name + '_dent_side', 0.11, 0.055, (-0.5915, -0.10, 0.30), dentm, rot=(90, 0, -90), parent=root)
    cz.plane(name + '_tag', 0.075, 0.035, (-0.5915, -0.205, 0.60), cz.toon(name + '_tagm', img=os.path.join(TEX, 'bare_desk_tag.png'), alpha_clip=True),
             rot=(90, 0, -90), parent=root)
    for i, (x, z, w) in enumerate([(-0.33, 0.701, 0.016), (0.43, 0.698, 0.01)]):
        cz.box(f'{name}_chip{i}', (w, 0.0015, 0.006), (x, -0.3258, z), chm, bevel=0, ol=0, parent=root)
    cz.box(name + '_chip2', (0.01, 0.0015, 0.014), (-0.579, -0.3012, 0.43), chm, bevel=0, ol=0, parent=root)

    # ---- the only thing allowed on top
    if items == 'paper':
        cz.plane(name + '_paper', 0.21, 0.297, (-0.2, -0.04, 0.7212),
                 cz.toon(name + '_paperm', img=os.path.join(TEX, 'bare_desk_paper.png'), tex='paper', tex_strength=0.03), rot=(0, 0, -11), parent=root)
    return root
