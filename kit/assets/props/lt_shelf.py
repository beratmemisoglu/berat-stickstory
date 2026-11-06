# Wall shelving full of colourful products (LOTTERY store aisle): a white-grey metal back panel with uprights, n shelves
# with price-tag strips (yellow tag strip, little tags), each shelf packed with boxes / cans whose fronts are the
# product pictures film/lottery/tex/st_prod_0..11.png. Wall prop: back at y = 0, front toward -Y, root at the floor
# below the back's centre.
import os, random

META = {'size': ('w', 0.42, 'h'), 'anchor': 'floor, back centre at y = 0, products face -Y', 'animate': [],
        'params': 'w=1.6, h=1.9, shelves=5, seed=3, z0=0.2'}
TEX = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'film', 'lottery', 'tex')


def build(cz, name='lt_shelf', w=1.6, h=1.9, shelves=5, seed=3, z0=0.22, d=0.38):
    root = cz.empty(name)
    rnd = random.Random(seed)
    metal = cz.toon('lt_shelf_metal', '#d8dadb', tex='grain', tex_strength=0.04)
    back = cz.toon('lt_shelf_back', '#b9bec2', tex='grain', tex_strength=0.05)
    cz.box(name + '_back', (w, 0.03, h), (0, -0.015, h / 2), back, bevel=0.004, ol=0.006, parent=root)
    for sx in (-1, 1):
        cz.box(f'{name}_up{sx}', (0.04, d, h), (sx * (w / 2 - 0.02), -d / 2, h / 2), metal, bevel=0.006, ol=0.006, parent=root)
    cz.box(name + '_kick', (w, d, z0 - 0.02), (0, -d / 2, (z0 - 0.02) / 2), cz.toon('lt_shelf_kick', '#5d6268'), bevel=0.004, ol=0.005, parent=root)
    mats = [cz.toon(f'lt_prod_st_prod_{i}', img=os.path.join(TEX, f'st_prod_{i}.png'), lift=0.78) for i in range(12)]
    side = [cz.toon(f'lt_prodside{i}', c, tex='grain', tex_strength=0.04) for i, c in enumerate(
        ('#c8282a', '#e9b820', '#2f6fd0', '#2e9a48', '#e25aa0', '#7c4cc0', '#ee7a22', '#1fa3a0', '#c42a3a', '#c98a3a', '#7ac83a', '#5ab0e8'))]
    tag = cz.toon('lt_shelf_tag', '#f2d23a')
    step = (h - z0 - 0.05) / shelves
    for s in range(shelves):
        z = z0 + s * step
        cz.box(f'{name}_sh{s}', (w - 0.06, d, 0.025), (0, -d / 2, z), metal, bevel=0.004, ol=0.005, parent=root)
        cz.box(f'{name}_strip{s}', (w - 0.06, 0.008, 0.035), (0, -d - 0.004, z - 0.005), tag, bevel=0.002, ol=0.002, parent=root)
        x = -w / 2 + 0.06
        while x < w / 2 - 0.1:
            k = rnd.randrange(12); bw = rnd.choice((0.1, 0.12, 0.14)); bh = min(step - 0.05, bw * rnd.uniform(1.3, 1.6)); bd = 0.18
            x += bw / 2
            if x + bw / 2 > w / 2 - 0.05: break
            # one facing box (picture on the front) with a second behind it (depth)
            cz.box(f'{name}_b{s}_{x:.2f}', (bw, bd, bh), (x, -d + 0.03 + bd / 2, z + 0.0125 + bh / 2), side[k], bevel=0.006, ol=0.004, parent=root)
            cz.plane(f'{name}_f{s}_{x:.2f}', bw * 0.96, bh * 0.96, (x, -d + 0.03 - 0.0012, z + 0.0125 + bh / 2), mats[k], rot=(90, 0, 0), parent=root)
            if rnd.random() < 0.35:
                cz.box(f'{name}_t{s}_{x:.2f}', (0.04, 0.004, 0.025), (x, -d - 0.009, z - 0.002), cz.toon('lt_pricetag', '#f7f3e6'), bevel=0.001, ol=0.0015, parent=root)
            x += bw / 2 + 0.012
    return root
