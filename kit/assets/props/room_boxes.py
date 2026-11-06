# A stack of forgotten archive boxes (文書保存箱): kraft document boxes with lids, printed label forms filled in by
# hand (old fiscal years, 営業二課 / 総務), hand-hold slots, the top box slightly askew with a dented corner, dust on
# the top lid. Floor prop: root at the floor centre of the bottom box, labels face -Y.

META = {'size': (0.40, 0.32, 0.78), 'anchor': 'floor centre, labels toward -Y', 'animate': [],
        'params': "n=1..3 (boxes in the stack), color='#c39a62' (kraft)"}

TEX = 'assets/props/tex/'
W, D, H = 0.40, 0.32, 0.26
LID = 0.05


def _box(cz, name, parent, loc, rz, k, kraft, dent=False):
    import math
    pv = cz.empty(name, loc, parent=parent); pv.rotation_euler.z = math.radians(rz)
    card = cz.toon('room_boxes_card', kraft, tex='paper', tex_scale=0.6, tex_strength=0.07)
    lidm = cz.toon('room_boxes_lid', '#b88c54', tex='paper', tex_scale=0.6, tex_strength=0.07)
    cz.box(name + '_body', (W, D, H - 0.004), (0, 0, 0), card, bevel=0.004, ol=0.006, parent=pv, origin='bottom')
    cz.box(name + '_lid', (W + 0.008, D + 0.008, LID), (0, 0, H - LID), lidm, bevel=0.004, ol=0.006, parent=pv, origin='bottom')
    yf = -D / 2 - 0.0015
    cz.plane(name + '_label', 0.18, 0.12, (-0.07, yf, 0.12), cz.toon(f'room_boxes_lbl{k}', img=f'{TEX}room_box_label{k}.png', lift=0.66), parent=pv)
    cz.box(name + '_slot', (0.085, 0.003, 0.026), (0.13, -D / 2 - 0.0005, 0.15), cz.toon('room_boxes_slot', '#3a2a1c'), bevel=0.003, ol=0, parent=pv)
    # the lid's front edge printed with a dark band + a strap line down the side
    cz.box(name + '_band', (W + 0.0085, 0.0012, 0.012), (0, -D / 2 - 0.0043, H - 0.02), cz.toon('room_boxes_band', '#5a6a8a'), bevel=0, ol=0, parent=pv)
    if dent:   # a crushed front corner: a darker wedge pushed in
        o = cz.box(name + '_dent', (0.06, 0.01, 0.05), (W / 2 - 0.035, -D / 2 + 0.002, H - 0.06), cz.toon('room_boxes_dentm', '#8a6a40'), bevel=0.002, ol=0.003, parent=pv)
        o.rotation_euler = (math.radians(20), math.radians(25), 0)
    return pv


def build(cz, name='room_boxes', n=3, color='#c39a62'):
    root = cz.empty(name)
    spots = [((0, 0, 0), 0, 0), ((0.006, -0.004, H), 3.5, 1), ((-0.012, 0.006, 2 * H), -6, 2)]
    for i in range(max(1, min(3, n))):
        loc, rz, k = spots[i]
        pv = _box(cz, f'{name}_b{i}', root, loc, rz, k, color, dent=(i == n - 1))
    # dust film on the top lid (follows the top box's turn)
    cz.box(name + '_dust', (W - 0.006, D - 0.006, 0.0015), (0, 0, H + 0.0011), cz.toon('room_dust', '#cfc8b2', lift=0.7), bevel=0, ol=0, parent=pv)
    return root
