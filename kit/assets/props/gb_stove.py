# BELL: pot-bellied cast-iron stove with nickel trim. Four curved legs on ball feet, an ash pit with a half-open ash
# pan (grey ash, a little spilled on the stove board), the round belly with a band and a fire door (vertical grate bars
# over the firebox: dark when cold, orange glow when lit), a top plate with a copper kettle, a stovepipe rising 1.6 m
# with joint rings and a damper handle, a tin stove board under it.
# kw lit=True: glowing grate + ash-pit slits + a warm POINT light <name>_light just in front of the door.
# Floor prop: root at the floor centre, the fire door faces -Y.
import math

META = {'size': (0.75, 0.75, 2.53), 'anchor': 'floor centre; fire door faces -Y',
        'animate': [], 'top_z': 0.915, 'pipe_top_z': 2.515, 'door_center': (0.0, -0.29, 0.6),
        'params': "lit=False|True (glow + POINT light <name>_light, energy kw light_w=60), board=True (tin stove board), kettle=True"}


def build(cz, name='gb_stove', lit=False, light_w=60.0, board=True, kettle=True):
    root = cz.empty(name)
    ir = cz.toon(name + '_ironm', '#3d3936', tex='grain', tex_scale=3.0, tex_strength=0.1)
    nk = cz.toon(name + '_nickelm', '#7c786f', tex='grain', tex_strength=0.05)
    fire = cz.glow(name + '_firem', '#f06018', 1.9) if lit else cz.toon(name + '_coldm', '#24191a')
    # stove board (tin floor protector)
    if board:
        cz.box(name + '_board', (0.78, 0.78, 0.01), (0, -0.04, 0), cz.toon(name + '_boardm', '#8d8a80', pattern=('tiles', 0.13, '#6e6a62'), tex='grain', tex_strength=0.06),
               bevel=0.004, ol=0.004, parent=root, origin='bottom')
    z0 = 0.01 if board else 0.0
    # legs + feet
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        a = math.degrees(math.atan2(sy, sx))
        leg = cz.box(f'{name}_leg{i}', (0.05, 0.035, 0.2), (sx * 0.16, sy * 0.16, z0 + 0.1), ir, rot=(sy * -14, sx * 14, 0), bevel=0.012, ol=0.006, parent=root)
        cz.sphere(f'{name}_foot{i}', 0.03, (sx * 0.185, sy * 0.185, z0 + 0.028), ir, ol=0.005, parent=root, segs=16, rings=8)
    # base + ash pit
    cz.cyl(name + '_base', 0.25, 0.05, (0, 0, z0 + 0.17), ir, bevel=0.01, ol=0.008, parent=root, verts=40)
    cz.cyl(name + '_base_trim', 0.258, 0.018, (0, 0, z0 + 0.2), nk, ol=0.005, parent=root, verts=40)
    cz.cyl(name + '_ashpit', 0.2, 0.14, (0, 0, z0 + 0.22), ir, ol=0.008, parent=root, verts=40)
    # ash pan pulled half out at the front
    cz.box(name + '_ashpan', (0.22, 0.12, 0.07), (0, -0.21, z0 + 0.235), ir, bevel=0.006, ol=0.006, parent=root, origin='bottom')
    cz.box(name + '_ashpan_lip', (0.24, 0.015, 0.09), (0, -0.275, z0 + 0.23), ir, bevel=0.005, ol=0.005, parent=root, origin='bottom')
    cz.box(name + '_ashpan_ash', (0.19, 0.09, 0.012), (0, -0.2, z0 + 0.296), cz.toon(name + '_ashm', '#8a857c', tex='grain', tex_scale=6.0, tex_strength=0.15), bevel=0.004, ol=0, parent=root, origin='bottom')
    cz.sphere(name + '_ashpan_knob', 0.016, (0, -0.29, z0 + 0.275), nk, ol=0.003, parent=root, segs=12, rings=6)
    for j, (x, y, r) in enumerate(((0.12, -0.33, 0.022), (0.16, -0.36, 0.014), (0.07, -0.37, 0.012))):
        cz.sphere(f'{name}_ashspill{j}', r, (x, y, z0 - r * 0.45), cz.toon(name + '_ashm', '#8a857c'), ol=0.0, parent=root, segs=12, rings=6)
    # draft slits on the ash pit (glow when lit)
    for j in range(3):
        x = -0.06 + j * 0.06
        cz.box(f'{name}_draft{j}', (0.025, 0.01, 0.05), (x, -0.198, z0 + 0.33), fire, bevel=0.002, ol=0.0, parent=root)
    # belly
    cz.cyl(name + '_neck', 0.2, 0.06, (0, 0, z0 + 0.34), ir, r2=0.23, ol=0.007, parent=root, verts=40)
    cz.sphere(name + '_belly', 0.27, (0, 0, z0 + 0.6), ir, ol=0.009, parent=root, segs=48, rings=24)
    cz.cyl(name + '_band', 0.279, 0.035, (0, 0, z0 + 0.57), nk, bevel=0.006, ol=0.005, parent=root, verts=48)
    # fire door: frame, grate bars over the firebox glow, handle, hinges
    cz.box(name + '_door', (0.22, 0.04, 0.18), (0, -0.27, z0 + 0.66), nk, bevel=0.012, ol=0.007, parent=root)
    cz.box(name + '_door_hole', (0.16, 0.004, 0.11), (0, -0.2915, z0 + 0.66), fire, bevel=0.0, ol=0, parent=root)
    for j in range(5):
        x = -0.064 + j * 0.032
        cz.box(f'{name}_grate{j}', (0.012, 0.012, 0.12), (x, -0.297, z0 + 0.66), ir, bevel=0.003, ol=0.002, parent=root)
    cz.cyl(name + '_door_handle', 0.012, 0.035, (0.08, -0.29, z0 + 0.66), nk, rot=(90, 0, 0), ol=0.003, parent=root, verts=12)
    cz.sphere(name + '_door_handle_k', 0.02, (0.08, -0.33, z0 + 0.66), cz.toon(name + '_knobm', '#2a2622'), ol=0.003, parent=root, segs=12, rings=6)
    for j, zz in enumerate((0.61, 0.71)):
        cz.cyl(f'{name}_hinge{j}', 0.012, 0.03, (-0.115, -0.285, z0 + zz - 0.015), nk, ol=0.003, parent=root, verts=12)
    # maker's plate above the door + rivets on the band
    cz.box(name + '_plate', (0.14, 0.012, 0.045), (0, -0.2, z0 + 0.79), nk, rot=(-45, 0, 0), bevel=0.006, ol=0.004, parent=root)
    cz.text(name + '_plate_txt', 'ACORN', size=0.03, loc=(0, -0.2055, z0 + 0.7955), mat=cz.toon(name + '_platetxtm', '#2a2622'), rot=(45, 0, 0), extrude=0.0015, parent=root)
    for j in range(16):
        a = math.radians(j * 22.5 + 11.25)
        cz.sphere(f'{name}_rivet{j}', 0.008, (0.283 * math.cos(a), 0.283 * math.sin(a), z0 + 0.5875), nk, ol=0, parent=root, segs=10, rings=5)
    # top
    cz.cyl(name + '_collar', 0.19, 0.06, (0, 0, z0 + 0.8), ir, ol=0.007, parent=root, verts=40)
    cz.cyl(name + '_top', 0.25, 0.035, (0, 0, z0 + 0.86), ir, bevel=0.008, ol=0.008, parent=root, verts=40)
    cz.cyl(name + '_top_trim', 0.255, 0.014, (0, 0, z0 + 0.858), nk, ol=0.004, parent=root, verts=40)
    zt = z0 + 0.895
    # stovepipe
    cz.cyl(name + '_pipe_collar', 0.085, 0.05, (0, 0.09, zt), ir, ol=0.006, parent=root, verts=32)
    cz.cyl(name + '_pipe', 0.065, 1.6, (0, 0.09, zt), cz.toon(name + '_pipem', '#3a3734', tex='grain', tex_scale=2.0, tex_strength=0.08), ol=0.007, parent=root, verts=32)
    for j, zz in enumerate((0.55, 1.1)):
        cz.cyl(f'{name}_pipe_ring{j}', 0.07, 0.025, (0, 0.09, zt + zz), ir, ol=0.004, parent=root, verts=32)
    cz.box(name + '_damper', (0.12, 0.016, 0.016), (0.11, 0.09, zt + 0.32), nk, bevel=0.004, ol=0.003, parent=root)
    cz.sphere(name + '_damper_k', 0.016, (0.175, 0.09, zt + 0.32), cz.toon(name + '_knobm', '#2a2622'), ol=0.003, parent=root, segs=12, rings=6)
    # copper kettle on the front of the top plate
    if kettle:
        cu = cz.toon(name + '_copperm', '#7e3a1e', tex='grain', tex_strength=0.07)
        cul = cz.toon(name + '_copperlitm', '#e09a5a', lift=0.8)
        kx, ky = -0.05, -0.08
        cz.cyl(name + '_kettle', 0.11, 0.11, (kx, ky, zt), cu, r2=0.08, bevel=0.012, ol=0.006, parent=root, verts=36)
        cz.cyl(name + '_kettle_lid', 0.07, 0.025, (kx, ky, zt + 0.108), cu, r2=0.05, bevel=0.006, ol=0.004, parent=root, verts=28)
        cz.sphere(name + '_kettle_knob', 0.018, (kx, ky, zt + 0.14), cz.toon(name + '_knobm', '#2a2622'), ol=0.003, parent=root, segs=12, rings=6)
        sp = cz.cyl(name + '_kettle_spout', 0.02, 0.13, (kx - 0.07, ky, zt + 0.03), cu, r2=0.011, rot=(0, -55, 0), ol=0.004, parent=root, verts=14)
        for j, (sz, lc) in enumerate((((0.014, 0.014, 0.1), (kx - 0.07, ky, zt + 0.15)), ((0.014, 0.014, 0.1), (kx + 0.07, ky, zt + 0.15)), ((0.16, 0.02, 0.02), (kx, ky, zt + 0.205)))):
            cz.box(f'{name}_kettle_bail{j}', sz, lc, cz.toon(name + '_bailm', '#2e2a26'), bevel=0.005, ol=0.003, parent=root)
        cz.box(name + '_kettle_grip', (0.09, 0.03, 0.03), (kx, ky, zt + 0.21), cz.toon(name + '_gripm', '#6b3e20', tex='wood'), bevel=0.012, ol=0.004, parent=root)
        cz.box(name + '_kettle_shine', (0.018, 0.003, 0.05), (kx - 0.04, ky - 0.1, zt + 0.055), cul, rot=(0, 0, 25), bevel=0.003, ol=0, parent=root)
    if lit:
        cz.light(name + '_light', 'POINT', (0, -0.42, z0 + 0.6), color='#ff9a48', power=light_w, size=0.15)
        bpy = __import__('bpy'); L = bpy.data.objects.get(name + '_light')
        if L: L.parent = root
    return root
