# The agents' green tackle box full of REEL BIG CASH bait tickets (L17, seen top-down): a long green box with two lids
# hinged on the long sides (pivots <name>_lidL / <name>_lidR, rotation_euler.y; kw open=0..1: the left lid folds right
# over to lie flat beside the box, the right lid stands up past vertical), a cream carry handle along the middle, two
# latches, a GONE FISHIN' sticker on the left lid, felt-green compartments with a ticket hanging on a hook in each
# (2 x 4 in the box, 1 x 4 in the left lid). The box's long axis is Y.
import math, os

META = {'size': (0.56, 1.0, 0.17), 'anchor': 'table top, centre of the box bottom; long axis Y',
        'animate': ['_lidL', '_lidR'], 'params': 'open=0..1, ticket=png, length=1.0 (long axis Y; the reference box is about square with the lids open), rows=4'}


def build(cz, name='lo_tackle_box', open=0.0, ticket=None, length=1.0, rows=4):
    root = cz.empty(name)
    tex = os.path.join(cz.LAB, 'film', 'lottery', 'tex')
    tk = ticket or os.path.join(tex, 'lo_ticket.png')
    W, L, H = 0.56, length, 0.13
    bg = os.path.join(tex, 'lo_box_green.png')
    gm = cz.toon(name + '_green', '#2f8a4a', img=bg, proj='box', proj_scale=1.6) if os.path.exists(bg) else cz.toon(name + '_green', '#2f8a4a', tex='grain', tex_strength=0.05)
    gd = cz.toon(name + '_greendk', '#1f6a38', img=bg, proj='box', proj_scale=1.6, tint='#6a8a70') if os.path.exists(bg) else cz.toon(name + '_greendk', '#1f6a38', tex='grain', tex_strength=0.05)
    felt = os.path.join(tex, 'lo_felt.png')
    fm = cz.toon(name + '_felt', '#3c9a58', img=felt, proj='box', proj_scale=2.5, tint='#b8c8b8')   # felt green ~#3f8a4a (critic r2: too dark) if os.path.exists(felt) else gd
    cream = cz.toon(name + '_cream', '#efe0b8', tex='grain')
    tm = cz.toon('lo_ticketm_' + os.path.basename(tk)[:-4], img=tk, lift=0.8) if os.path.exists(tk) else cz.toon('lo_ticketm', '#3a6ad0')
    hook = cz.toon(name + '_hook', '#c8ccd2')
    # shell: floor + 4 walls (open top), rim
    cz.box(name + '_floor', (W, L, 0.02), (0, 0, 0.01), gd, bevel=0.006, ol=0.006, parent=root)
    for sx in (-1, 1):
        cz.box(f'{name}_wallx{sx}', (0.02, L, H), (sx * (W / 2 - 0.01), 0, H / 2), gm, bevel=0.006, ol=0.007, parent=root)
    for sy in (-1, 1):
        cz.box(f'{name}_wally{sy}', (W, 0.02, H), (0, sy * (L / 2 - 0.01), H / 2), gm, bevel=0.006, ol=0.007, parent=root)
    # compartments: felt floor, dividers, tickets on hooks (2 columns x 5 rows in the box, 1 x 5 in each lid: ref f1585)
    NR = rows
    cz.box(name + '_inner', (W - 0.04, L - 0.04, 0.01), (0, 0, 0.025), fm, bevel=0, ol=0, parent=root)
    cz.box(name + '_divmid', (0.02, L - 0.04, 0.08), (0, 0, 0.07), cz.toon(name + '_divdk', '#16261a'), bevel=0.004, ol=0.005, parent=root)
    for r in range(1, NR):
        cz.box(f'{name}_div{r}', (W - 0.04, 0.016, 0.07), (0, -L / 2 + r * L / NR, 0.065), cz.toon(name + '_divdk', '#16261a'), bevel=0.004, ol=0.005, parent=root)

    def tickets(prefix, xs, z, parent, flip=False):
        for i, x in enumerate(xs):
            for r in range(NR):
                y = -L / 2 + (r + 0.5) * L / NR - 0.008
                cz.plane(f'{name}_{prefix}t{i}{r}', 0.15, 0.21, (x, y, z), tm, rot=(0, 180 if flip else 0, 0), parent=parent)
                cz.cyl(f'{name}_{prefix}h{i}{r}', 0.005, 0.05, (x, y + 0.112, z + (-0.004 if flip else 0.004)), hook, rot=(90, 0, 0), ol=0.002, parent=parent, verts=8)
                cz.box(f'{name}_{prefix}p{i}{r}', (0.034, 0.018, 0.0012), (x + 0.095 * (1 if i % 2 else -1), y + 0.07, z + (-0.002 if flip else 0.002)), cz.toon(name + '_pricetag', '#f2e2a0', tex='paper'), bevel=0, ol=0.0012, parent=parent)   # price stickers (enriched l17)
    tickets('b', (-W / 4, W / 4), 0.034, root)
    # handle along the middle (stays on the centre divider)
    cz.box(name + '_handle', (0.016, L * 0.6, 0.02), (0, 0, H + 0.03), cz.toon(name + '_tan', '#c8a46a', tex='grain'), bevel=0.006, ol=0.004, parent=root)   # a thin tan hinge line, not a fat white bar (critic)
    for sy in (-1, 1):
        cz.box(f'{name}_hpost{sy}', (0.03, 0.03, 0.05), (0, sy * L * 0.3, H + 0.005), cream, bevel=0.006, ol=0.005, parent=root)
    # lids: pivots on the outer top edges; lid panels span toward the centre when closed
    k = max(0.0, min(1.0, open))
    for side, sx in (('L', -1), ('R', 1)):
        pv = cz.empty(f'{name}_lid{side}', (sx * W / 2, 0, H), parent=root)
        ang = 180.0 * k                                   # both lids fold out flat (ref f1585)
        pv.rotation_euler.y = math.radians(sx * ang)      # + about Y lifts the right lid's -X edge; the left lid needs -
        lw = W / 2 - 0.025
        cz.box(f'{name}_lidpanel{side}', (lw, L, 0.02), (-sx * lw / 2, 0, 0.01), gm, bevel=0.008, ol=0.007, parent=pv)
        cz.box(f'{name}_lidinset{side}', (lw - 0.06, L - 0.08, 0.006), (-sx * lw / 2, 0, 0.022), gd, bevel=0.004, ol=0.004, parent=pv)
        # the inside of each lid: compartments + a column of tickets on hooks (seen when the lids lie open)
        cz.box(f'{name}_lidfelt{side}', (lw - 0.03, L - 0.04, 0.006), (-sx * lw / 2, 0, -0.003), fm, bevel=0, ol=0, parent=pv)
        for r in range(1, NR):
            cz.box(f'{name}_liddiv{side}{r}', (lw - 0.03, 0.014, 0.04), (-sx * lw / 2, -L / 2 + r * L / NR, -0.02), cz.toon(name + '_divdk', '#16261a'), bevel=0.003, ol=0.004, parent=pv)
        tickets('l' + side, (-sx * lw / 2,), -0.0075, pv, flip=True)
        if side == 'L':
            gf = os.path.join(tex, 'lo_gone_fishin.png')
            if os.path.exists(gf):
                cz.plane(f'{name}_sticker', 0.17, 0.058, (-sx * lw * 0.45, -L * 0.26, 0.0262), cz.toon(name + '_stickm', img=gf, lift=0.8), rot=(0, 0, 4), parent=pv)
            for j, y in enumerate((L * 0.22, -L * 0.3)):     # latches on the outer edge
                cz.box(f'{name}_latch{j}', (0.03, 0.07, 0.05), (-0.02, y, -0.02), cream, bevel=0.006, ol=0.005, parent=pv)   # on the outer wall face (they were inside the wall)
    return root
