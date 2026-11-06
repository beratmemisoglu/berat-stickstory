# Handheld barcode scanner (LOTTERY, the clerk's): a chunky charcoal gun-shaped body, a bright orange nose block with a
# dark window at the front, a trigger, a coiled cable out of the butt, and a red laser fan (part <name>_beam, glowing,
# semi-transparent) that shoots forward out of the window. Root = the grip centre (where the ball hand holds it); the
# handle runs down -Z from the head, the nose points -Y. Hold: char.hold(root, 'L', offset=(0, -0.02, 0.02), rot=...)
# with a pitch of +40..+70 deg about X to aim it down at the counter. beam=False hides the laser (or hide _beam later).
import math

META = {'size': (0.07, 0.24, 0.2), 'anchor': 'grip centre; nose toward -Y, handle down -Z',
        'animate': ['_beam (hide_render / scale.y: the laser fan, 0.3 m long along -Y from the window)'],
        'params': 'beam=True, beam_len=0.3, cable=True'}


def build(cz, name='lt_scanner', beam=True, beam_len=0.3, cable=True):
    import bpy
    root = cz.empty(name)
    body = cz.toon(name + '_bodym', '#3a3f47', tex='grain', tex_strength=0.05)
    dark = cz.toon(name + '_darkm', '#1d2026')
    orange = cz.toon(name + '_orangem', '#d9700f', tex='grain', tex_strength=0.04)
    # handle (tilted back a little), head on top running forward
    cz.box(name + '_grip', (0.05, 0.06, 0.13), (0, 0.012, -0.035), body, rot=(-14, 0, 0), bevel=0.014, ol=0.005, parent=root)
    cz.box(name + '_head', (0.066, 0.17, 0.075), (0, -0.03, 0.055), body, bevel=0.016, ol=0.006, parent=root)
    cz.box(name + '_nose', (0.074, 0.06, 0.086), (0, -0.125, 0.055), orange, bevel=0.012, ol=0.006, parent=root)
    cz.box(name + '_window', (0.05, 0.004, 0.05), (0, -0.157, 0.055), cz.glow(name + '_winm', '#ff3b30', 1.6), bevel=0.002, ol=0.0, parent=root)
    cz.box(name + '_trigger', (0.026, 0.024, 0.04), (0, -0.035, 0.0), orange, rot=(18, 0, 0), bevel=0.006, ol=0.004, parent=root)
    cz.box(name + '_stripe', (0.068, 0.06, 0.012), (0, 0.03, 0.094), dark, bevel=0.004, ol=0.0, parent=root)
    cz.cyl(name + '_butt', 0.016, 0.02, (0, 0.03, -0.1), dark, rot=(-14, 0, 0), ol=0.003, parent=root, verts=16)
    if cable:   # a few coils hanging out of the butt
        cm = cz.toon(name + '_cablem', '#16181c')
        for i in range(5):
            cz.cyl(f'{name}_coil{i}', 0.014, 0.006, (0, 0.035 + 0.004 * i, -0.118 - 0.012 * i), cm, rot=(70, 0, 0), ol=0.0, parent=root, verts=14)
    if beam:
        pv = cz.empty(name + '_beam', (0, -0.158, 0.055), parent=root)
        m = bpy.data.materials.get('lt_laser')
        if m is None:
            m = bpy.data.materials.new('lt_laser'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
            out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
            em.inputs['Color'].default_value = cz.col('#ff2a22'); em.inputs['Strength'].default_value = 3.0
            tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader'); mx.inputs[0].default_value = 0.26
            nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs['Surface'])
            try: m.surface_render_method = 'BLENDED'
            except Exception: pass
        # a flat fan: narrow at the window, wide at the far end
        import bmesh
        bm = bmesh.new()
        L = beam_len; a = bm.verts.new((-0.006, 0, 0)); b = bm.verts.new((0.006, 0, 0))
        c = bm.verts.new((0.03, -L, 0)); d = bm.verts.new((-0.03, -L, 0))
        bm.faces.new((a, b, c, d))
        o = cz._mesh_obj(name + '_beamfan', bm, m, smooth=False); cz.place(o, (0, 0, 0), parent=pv)
        o.visible_shadow = False
        cz.cyl(name + '_beamcore', 0.0035, L, (0, 0, 0), m, rot=(90, 0, 0), ol=0.0, parent=pv, verts=8).visible_shadow = False
    return root
