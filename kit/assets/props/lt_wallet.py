# Brown bifold wallet (LOTTERY L08/L09): two leather halves joined at a spine along Y, lying open face up. Left half
# (-X): the driver licence (KYLE) in a window; right half (+X): three card pockets, a dollar bill and a SUBS card
# peeking out (pictures: film/lottery/tex/st_wallet_L/R.png, st_licence.png, st_dollar.png, st_subs.png).
# Root = the spine's centre on the surface it lies on (z = 0). The left half hangs on the pivot <name>_flap at the spine
# (rotation_euler.y: 0 = open flat, pi = folded shut over the right half). fold=0..1 poses it.
import math, os

META = {'size': (0.34, 0.12, 0.012), 'anchor': 'spine centre, underside; open flat face up, halves along X',
        'animate': ['_flap (rotation_euler.y 0 -> pi folds the left half shut over the right)'],
        'params': 'fold=0.0 (0 open .. 1 shut)'}
TEX = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'film', 'lottery', 'tex')
HW, HD, T = 0.165, 0.118, 0.008     # half width (X), depth (Y), leather thickness


def build(cz, name='lt_wallet', fold=0.0):
    root = cz.empty(name)
    out = cz.toon('lt_wallet_out', img=os.path.join(TEX, 'st_wallet_leather.png'), proj='box', proj_scale=4.0)
    edge = cz.toon('lt_wallet_edge', '#5a331a')
    # right half (fixed)
    cz.box(name + '_right', (HW, HD, T), (HW / 2, 0, T / 2), out, bevel=0.003, ol=0.003, parent=root)
    cz.plane(name + '_rin', HW * 0.98, HD * 0.98, (HW / 2, 0, T + 0.0006),
             cz.toon('lt_wal_st_wallet_R', img=os.path.join(TEX, 'st_wallet_R.png'), lift=0.75), rot=(0, 0, 0), parent=root)
    # peeking dollar + SUBS card at the top pocket
    cz.plane(name + '_dollar', HW * 0.82, HD * 0.2, (HW * 0.5, HD * 0.33, T + 0.0016),
             cz.toon('lt_wal_st_dollar', img=os.path.join(TEX, 'st_dollar.png'), lift=0.75), rot=(0, 0, 0), parent=root)
    cz.plane(name + '_subs', HW * 0.6, HD * 0.16, (HW * 0.42, HD * 0.2, T + 0.0024),
             cz.toon('lt_wal_st_subs', img=os.path.join(TEX, 'st_subs.png'), lift=0.75, alpha_clip=True), rot=(0, 0, 0), parent=root)
    # left half on the hinge pivot (pivot at the spine, on top of the right half's thickness so it folds onto it)
    pv = cz.empty(name + '_flap', (0, 0, T), parent=root)
    cz.box(name + '_left', (HW, HD, T), (-HW / 2, 0, -T / 2), out, bevel=0.003, ol=0.003, parent=pv)
    cz.plane(name + '_lin', HW * 0.98, HD * 0.98, (-HW / 2, 0, 0.0006),
             cz.toon('lt_wal_st_wallet_L', img=os.path.join(TEX, 'st_wallet_L.png'), lift=0.75), rot=(0, 0, 0), parent=pv)
    cz.plane(name + '_lic', HW * 0.78, HD * 0.62, (-HW * 0.5, 0, 0.0014),
             cz.toon('lt_wal_st_licence', img=os.path.join(TEX, 'st_licence.png'), lift=0.75, alpha_clip=True), rot=(0, 0, 0), parent=pv)
    cz.cyl(name + '_spine', 0.0045, HD, (0, -HD / 2, T * 0.5), edge, rot=(-90, 0, 0), ol=0.002, parent=root, verts=12)
    pv.rotation_euler.y = math.pi * fold
    return root
