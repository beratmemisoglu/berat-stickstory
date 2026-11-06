# Office water server (ウォーターサーバー): slim cream cabinet with a coloured front panel, red (hot) and blue (cold) taps
# over a drip tray, the water label (tex/off_water_label.png), a 12 l blue bottle upside down on top, a paper-cup
# tube on the side. Floor prop: root at the floor centre, front -Y.
import os

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')

META = {'size': (0.42, 0.38, 1.4), 'anchor': 'floor centre, front -Y', 'animate': [],
        'params': "panel='#3a63c4' (front panel colour), bottle=True"}


def build(cz, name='off_water_server', panel='#3a63c4', bottle=True):
    root = cz.empty(name)

    def M(key, c, **k):
        return cz.toon(f'off_ws_{key}', c, **k)
    body = M('body', '#efebe2', tex='grain', tex_strength=0.03)
    pm = M('panel_' + panel.lstrip('#'), panel, tex='grain', tex_strength=0.04)
    dark = M('dark', '#2e3136')
    W, Dp, H = 0.32, 0.36, 1.02
    cz.box(name + '_plinth', (W - 0.02, Dp - 0.02, 0.04), (0, 0, 0), dark, bevel=0.004, ol=0.004, parent=root, origin='bottom')
    cz.box(name + '_body', (W, Dp, H - 0.04), (0, 0, 0.04), body, bevel=0.03, ol=0.007, parent=root, origin='bottom')
    fy = -Dp / 2
    cz.box(name + '_panel', (W - 0.05, 0.012, 0.38), (0, fy - 0.004, 0.75), pm, bevel=0.01, ol=0.005, parent=root)
    cz.box(name + '_recess', (W - 0.09, 0.01, 0.2), (0, fy - 0.011, 0.69), dark, bevel=0.006, ol=0.0, parent=root)
    for i, (dx, c) in enumerate(((-0.06, '#d0302a'), (0.06, '#3a8fd6'))):
        cz.box(f'{name}_tap{i}', (0.05, 0.045, 0.04), (dx, fy - 0.03, 0.765), M('tap' + str(i), c), bevel=0.01, ol=0.004, parent=root)
        cz.cyl(f'{name}_spout{i}', 0.009, 0.03, (dx, fy - 0.035, 0.725), M('chrome', '#c9cdd2'), verts=12, ol=0.002, parent=root)
    cz.box(name + '_drip', (W - 0.1, 0.07, 0.025), (0, fy - 0.035, 0.6), M('grate', '#5b6068', pattern=('tiles', 0.012, '#2e3136')), bevel=0.004, ol=0.004, parent=root)
    cz.plane(name + '_label', 0.13, 0.13, (0, fy - 0.0105, 0.88), cz.toon('off_ws_labelm', img=os.path.join(TEX, 'off_water_label.png')), parent=root)
    cz.box(name + '_door', (W - 0.05, 0.012, 0.4), (0, fy - 0.004, 0.3), body, bevel=0.008, ol=0.004, parent=root)
    cz.box(name + '_handle', (0.1, 0.012, 0.02), (0, fy - 0.014, 0.46), dark, bevel=0.005, ol=0.003, parent=root)
    if bottle:
        water = cz.toon('off_ws_water', '#7cc2ee', tex='grain', tex_strength=0.04, emit=0.15)
        cz.cyl(name + '_collar', 0.07, 0.03, (0, 0, H), dark, verts=24, ol=0.004, parent=root)
        cz.cyl(name + '_neck', 0.05, 0.05, (0, 0, H + 0.03), water, verts=24, ol=0.003, parent=root)
        cz.cyl(name + '_bottle', 0.14, 0.3, (0, 0, H + 0.08), water, r2=0.13, verts=40, bevel=0.03, ol=0.007, parent=root)
        for k, z in enumerate((0.15, 0.25)):
            cz.cyl(f'{name}_rib{k}', 0.142, 0.012, (0, 0, H + 0.08 + z), M('rib', '#5aa9dc'), verts=40, ol=0.0, parent=root)
    # paper-cup tube on the right side
    cz.cyl(name + '_cups', 0.04, 0.3, (W / 2 + 0.045, -0.06, 0.62), M('tube', '#dfe6ea', tex='grain'), verts=20, ol=0.004, parent=root)
    cz.cyl(name + '_cup', 0.036, 0.05, (W / 2 + 0.045, -0.06, 0.575), M('cup', '#f6f3ea'), r2=0.042, verts=20, ol=0.003, parent=root)
    cz.box(name + '_bracket', (0.04, 0.03, 0.04), (W / 2 + 0.01, -0.06, 0.8), dark, bevel=0.004, ol=0.0, parent=root)
    return root
