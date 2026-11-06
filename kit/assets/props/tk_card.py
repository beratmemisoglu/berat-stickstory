# TIC TAC TREASURE scratch card (film TICKETS, the hero prop): a thin card-stock slab with the printed face
# (film/tickets/tex/card_<X>.png), the printed back, an optional scratch-off silver layer (silver_00 intact .. silver_12
# scratched off; silver='seq' builds all 13 states as stacked planes named <name>_silver00..12, only 00 visible - the
# scene keys hide_render to scratch) and optional analysis overlays (ovA_repeats / ovA_loners / ovA_line_0..7 / ovA_win:
# glowing, alpha-blended planes named <name>_ov_<file>, hidden by default when hidden_ov=True).
# Lies flat by default: face up (+Z), the card's top edge toward +Y (a top-down camera reads it upright).
# upright=True: stands facing -Y (top edge +Z) - for holding up to the camera.
import os
import bpy

META = {'size': (0.15, 0.25, 0.003), 'anchor': 'centre of the card (flat: bottom face at z = 0)',
        'animate': ['_silver00 .. _silver12 (hide_render)', '_ov_<overlay> (hide_render)'],
        'params': "card='A'..'H'|'S', silver=None|0..12|'seq', overlays=(png names), hidden_ov=True, upright=False, "
                  "w=0.15, back=True"}

TEX = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'film', 'tickets', 'tex')


def glow_overlay(cz, name, png, strength=1.15):
    """Alpha-blended glowing picture (rings, lines, stamps): emission where the PNG is opaque, transparent elsewhere."""
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N, L = nt.nodes, nt.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial'); tx = N.new('ShaderNodeTexImage'); tx.image = cz.image(png); tx.interpolation = 'Cubic'
    em = N.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = strength
    tr = N.new('ShaderNodeBsdfTransparent'); mx = N.new('ShaderNodeMixShader')
    L.new(tx.outputs['Color'], em.inputs['Color']); L.new(tx.outputs['Alpha'], mx.inputs['Fac'])
    L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2]); L.new(mx.outputs[0], out.inputs['Surface'])
    for k, v in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
        try: setattr(m, k, v)
        except Exception: pass
    try: m.use_transparent_shadow = True
    except Exception: pass
    return m


def build(cz, name='tk_card', card='A', silver=None, overlays=(), hidden_ov=True, upright=False, w=0.15, back=True):
    h = w * 2560 / 1536
    root = cz.empty(name)
    piv = cz.empty(name + '_piv', parent=root)
    if upright: piv.rotation_euler = (1.5708, 0, 0)          # face -Y, top +Z
    t = 0.0016
    cz.box(name + '_stock', (w, h, t), (0, 0, t / 2), cz.toon('tk_card_stock', '#e9e4d6'), bevel=0.0006, ol=0.0025, parent=piv)
    face = cz.toon('tk_cardface_' + card, img=os.path.join(TEX, f'card_{card}.png'), lift=0.78)
    cz.plane(name + '_face', w * 0.995, h * 0.995, (0, 0, t + 0.0003), face, rot=(0, 0, 0), parent=piv)
    if back:
        cz.plane(name + '_back', w * 0.995, h * 0.995, (0, 0, -0.0003), cz.toon('tk_cardback', img=os.path.join(TEX, 'card_back.png'), lift=0.78),
                 rot=(180, 0, 0), parent=piv)
    z = t + 0.0008
    if silver is not None:
        states = range(13) if silver == 'seq' else [int(silver)]
        for i in states:
            sm = cz.toon(f'tk_silver{i:02d}', img=os.path.join(TEX, f'silver_{i:02d}.png'), lift=0.7, alpha_clip=True)
            p = cz.plane(f'{name}_silver{i:02d}', w * 0.995, h * 0.995, (0, 0, z), sm, rot=(0, 0, 0), parent=piv)
            if silver == 'seq' and i > 0: p.hide_render = True
        z += 0.0006
    for ov in overlays:
        p = cz.plane(f'{name}_ov_{ov}', w * 0.995, h * 0.995, (0, 0, z), glow_overlay(cz, 'tk_ov_' + ov, os.path.join(TEX, ov + '.png')), rot=(0, 0, 0), parent=piv)
        p.visible_shadow = False
        if hidden_ov: p.hide_render = True
        z += 0.0005
    return root
