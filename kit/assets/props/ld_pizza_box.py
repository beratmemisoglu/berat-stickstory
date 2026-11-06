# Stack of two square pizza boxes (Kyle's bedroom floor), slightly misaligned: cream cardboard, a dark lid line round
# the sides, dark front flap notch, the top lid printed "HOT PIZZA" / "THANK YOU!" with a red grease ring.
# Floor prop: root at the floor centre, front -Y. The lid print is tex/ld_pizza_box_lid.png (make_ld_pizza_box.py).
import os

S, T = 0.44, 0.05
META = {'size': (0.47, 0.47, 2 * T), 'anchor': 'floor centre; top lid z = 0.10', 'animate': ['_lid (top box lid, hinge at its back edge: rotation_euler.x negative opens)'],
        'top': 2 * T, 'params': 'count=2 (1..3)'}


def build(cz, name='ld_pizza_box', count=2):
    root = cz.empty(name)
    card = cz.toon(name + '_card', '#d6c8aa', tex='paper', tex_strength=0.05, lift=0.55)
    edge = cz.toon(name + '_edge', '#5a4a3a')
    png = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex', 'ld_pizza_box_lid.png')
    lidm = cz.toon(name + '_lidprint', img=png, lift=0.55) if os.path.exists(png) else card
    offs = [(0.0, 0.0, 0.0), (0.012, -0.014, 4.0), (-0.01, 0.01, -3.0)]
    n = max(1, min(3, int(count)))
    for i in range(n):
        dx, dy, rz = offs[n - 1 - i] if n > 1 else (0, 0, 0)
        b = cz.empty(f'{name}_box{i}', (dx, dy, i * T), parent=root); b.rotation_euler = (0, 0, cz.math.radians(rz)) if hasattr(cz, 'math') else (0, 0, rz * 3.14159 / 180)
        cz.box(f'{name}_base{i}', (S, S, T * 0.62), (0, 0, 0), card, bevel=0.004, ol=0.005, parent=b, origin='bottom')
        # lid: a hinge pivot at the back top edge, the lid slab overlaps the base sides a little (reads as the lid line)
        hz = T * 0.62
        lid = cz.empty(f'{name}_lid' if i == n - 1 else f'{name}_lid{i}', (0, S / 2 + 0.003, hz), parent=b)
        cz.box(f'{name}_lidm{i}', (S + 0.006, S + 0.006, T * 0.38), (0, -S / 2 - 0.003, 0), card, bevel=0.004, ol=0.005, parent=lid, origin='bottom')
        # the dark crease between lid and base, 1.5 mm proud
        cz.box(f'{name}_line{i}', (S + 0.003, S + 0.003, 0.004), (0, 0, hz - 0.004), edge, bevel=0.0, ol=0.0, parent=b, origin='bottom')
        # front flap notch (a dark thumb slot on the lid front)
        cz.box(f'{name}_notch{i}', (0.08, 0.004, 0.008), (0, -S - 0.0068, T * 0.19), edge, bevel=0.002, ol=0.0, parent=lid)
        if i == n - 1:
            cz.plane(f'{name}_print', S - 0.012, S - 0.012, (0, -S / 2 - 0.003, T * 0.38 + 0.0013), lidm, rot=(0, 0, 0), parent=lid)
    return root
