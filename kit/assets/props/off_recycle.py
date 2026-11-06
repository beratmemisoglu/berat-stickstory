# Japanese office sorting station: three bins in a row (burnable / PET bottles / cans), each a cream body with a
# coloured lid and its opening (slot / round hole / round hole), the printed label on the front
# (tex/off_bin_burn|pet|can.png). Floor prop: root at the floor centre of the row, labels toward -Y.
import os

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')

META = {'size': (1.0, 0.34, 0.66), 'anchor': 'floor centre of the row, labels -Y', 'animate': [], 'params': 'none'}


def build(cz, name='off_recycle'):
    root = cz.empty(name)
    body = cz.toon('off_bin_body', '#ece7da', tex='grain', tex_strength=0.03)
    hole = cz.toon('off_bin_hole', '#2a2622')
    for i, (key, c, x) in enumerate((('burn', '#d0302a', -0.335), ('pet', '#3a63c4', 0.0), ('can', '#2f8a55', 0.335))):
        cz.box(f'{name}_body{i}', (0.3, 0.32, 0.6), (x, 0, 0), body, bevel=0.02, ol=0.006, parent=root, origin='bottom')
        cz.box(f'{name}_lid{i}', (0.315, 0.335, 0.05), (x, 0, 0.6), cz.toon('off_bin_lid' + key, c, tex='grain', tex_strength=0.04), bevel=0.015, ol=0.006, parent=root, origin='bottom')
        if key == 'burn':
            cz.box(f'{name}_open{i}', (0.2, 0.06, 0.004), (x, -0.04, 0.649), hole, bevel=0.0, ol=0.0, parent=root, origin='bottom')
        else:
            cz.cyl(f'{name}_open{i}', 0.055, 0.004, (x, -0.02, 0.649), hole, verts=24, ol=0.0, parent=root)
        cz.plane(f'{name}_label{i}', 0.22, 0.165, (x, -0.1615, 0.42), cz.toon('off_bin_label' + key, img=os.path.join(TEX, f'off_bin_{key}.png')), parent=root)
    return root
