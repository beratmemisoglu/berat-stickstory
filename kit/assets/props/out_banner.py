# Banner pole: a tall lacquered pole on a stone foot with a gold spear-tip finial and a short top arm; a long vertical
# cloth banner (tex/make_out.py out_banner_<i>.png: border, emblem disc, two big characters, a swallowtail foot) hangs
# from the arm beside the pole, rippling, tied to the pole by three cord loops. kind='flag': a short pole with a
# triangular pennant with a flame edge (out_flag_<i>.png) for wall tops and carts.
# Floor prop: root at the floor centre of the pole foot; the cloth hangs toward +X of the pole, its face toward -Y.
# Animate: <name>_cloth (rotation z: the banner swings a little about the pole).
import math

META = {'size': (1.0, 0.4, 5.0), 'anchor': 'floor centre of the pole foot (kind=flag: the pole foot, 1.7 m pole)',
        'animate': ['_cloth (rotation z about the pole)'],
        'params': "kind='banner'|'flag', design=0..3 (banner) / 0..2 (flag), height=4.6, cloth_w=0.75, cloth_h=2.6, wave=0.06, "
                  "pole='#5a1a14', seed=1"}

TEX = 'assets/props/tex/'


def _wave_card(cz, name, w, h, mat, parent, amp=0.05, nx=6, nz=18, phase=0.0, taper=0.0):
    """A rippling cloth card in the XZ plane: x 0..w (from the pole), z 0..-h (hanging down), UV 0..1; ripples grow
    away from the pole."""
    import bmesh
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    V = [[None] * (nx + 1) for _ in range(nz + 1)]
    for j in range(nz + 1):
        for i in range(nx + 1):
            u, v = i / nx, j / nz
            x = u * w * (1 - taper * v); z = -v * h
            y = amp * math.sin(u * 2.6 * math.pi + phase + v * 1.3) * u ** 0.7 + amp * 0.6 * math.sin(v * 5.0 + phase) * u
            V[j][i] = bm.verts.new((x, y, z))
    for j in range(nz):
        for i in range(nx):
            f = bm.faces.new((V[j][i], V[j + 1][i], V[j + 1][i + 1], V[j][i + 1]))
            for lp, (a, b) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                lp[uvl].uv = (a / nx, 1 - b / nz)
    o = cz._mesh_obj(name, bm, mat, smooth=True)
    return cz.place(o, (0, 0, 0), (0, 0, 0), None, parent, 0.0, 0.0)


def build(cz, name='out_banner', kind='banner', design=0, height=4.6, cloth_w=0.75, cloth_h=2.6, wave=0.06, pole='#5a1a14', seed=1):
    root = cz.empty(name)
    pm = cz.toon(f'out_banner_pole{pole}', pole, tex='wood', tex_scale=12.0, tex_strength=0.07)
    gold = cz.toon('out_banner_gold', '#d0a23a', tex='grain', tex_strength=0.05)
    stone = cz.toon('out_banner_stone', '#9d968a', tex='grain', tex_scale=1.5, tex_strength=0.08)
    cord = cz.toon('out_banner_cord', '#e0c27a')
    if kind == 'flag':
        H = 1.7
        cz.cyl(name + '_pole', 0.025, H, (0, 0, 0), pm, verts=10, ol=0.004, parent=root)
        cz.sphere(name + '_knob', 0.045, (0, 0, H + 0.03), gold, ol=0.004, parent=root, segs=12, rings=8)
        fm = cz.toon(f'out_banner_flag{design}', img=TEX + f'out_flag_{design % 3}.png', alpha_clip=True, lift=0.62)
        pv = cz.empty(name + '_cloth', (0.02, 0, H - 0.02), parent=root)
        c = _wave_card(cz, name + '_flagcloth', 0.75, 0.47, fm, pv, amp=wave * 0.8, nx=8, nz=5, phase=seed)
        return root
    cz.box(name + '_foot', (0.42, 0.42, 0.28), (0, 0, 0.14), stone, bevel=0.03, ol=0.007, parent=root)
    cz.cyl(name + '_footcap', 0.13, 0.12, (0, 0, 0.28), stone, verts=8, ol=0.005, parent=root, r2=0.08)
    cz.cyl(name + '_pole', 0.045, height, (0, 0, 0.3), pm, verts=12, ol=0.006, parent=root)
    top = 0.3 + height
    cz.cyl(name + '_ring', 0.06, 0.06, (0, 0, top - 0.06), gold, verts=12, ol=0.004, parent=root)
    cz.cyl(name + '_tipbase', 0.04, 0.06, (0, 0, top), gold, verts=10, ol=0.004, parent=root)
    tip = cz.sphere(name + '_tip', 1.0, (0, 0, top + 0.06), gold, ol=0.004, parent=root, segs=12, rings=8)
    for v in tip.data.vertices: v.co = (v.co.x * 0.05, v.co.y * 0.05, (v.co.z + 1) * 0.13)
    tip.data.update()
    cz.cyl(name + '_arm', 0.025, cloth_w + 0.12, (0, 0, top - 0.25), pm, rot=(0, 90, 0), verts=8, ol=0.004, parent=root)
    cz.sphere(name + '_armend', 0.04, (cloth_w + 0.12, 0, top - 0.25), gold, ol=0.003, parent=root, segs=10, rings=6)
    mat = cz.toon(f'out_banner_cloth{design}', img=TEX + f'out_banner_{design % 4}.png', alpha_clip=True, lift=0.62)
    pv = cz.empty(name + '_cloth', (0.05, 0, top - 0.27), parent=root)
    _wave_card(cz, name + '_bannercloth', cloth_w, cloth_h, mat, pv, amp=wave, nx=6, nz=18, phase=seed * 1.7)
    for k in range(3):
        cz.cyl(f'{name}_tie{k}', 0.055, 0.03, (0, 0, top - 0.5 - k * cloth_h * 0.35), cord, verts=10, ol=0.003, parent=root)
    return root
