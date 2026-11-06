# The ticket printer on the agents' table (seen top-down): a beige desktop laser printer with a top paper tray, a front
# output slot, a STATE LOTTERY property label + barcode, a status LED and vents. The printed ticket slides out of the
# slot on the pivot <name>_out (location.y toward -Y; the ticket card <name>_ticket is its child, hide it until printing).
import os

META = {'size': (0.4, 0.34, 0.18), 'anchor': 'table top centre; output slot faces -Y', 'animate': ['_out'],
        'params': 'ticket=png (default film/lottery/tex/lo_ticket.png), out=0..1 (ticket pushed out)'}


def build(cz, name='lo_printer', ticket=None, out=0.0):
    root = cz.empty(name)
    tex = os.path.join(cz.LAB, 'film', 'lottery', 'tex')
    bg = cz.toon(name + '_beige', '#d8c49a', tex='grain', tex_strength=0.05)
    dk = cz.toon(name + '_dark', '#3a3430')
    cz.box(name + '_body', (0.4, 0.34, 0.14), (0, 0, 0.07), bg, bevel=0.015, ol=0.008, parent=root)
    cz.box(name + '_lid', (0.36, 0.24, 0.03), (0, 0.04, 0.152), cz.toon(name + '_lidm', '#c9b388', tex='grain'), bevel=0.01, ol=0.006, parent=root)
    cz.box(name + '_traylip', (0.34, 0.02, 0.012), (0, -0.085, 0.16), dk, bevel=0.003, ol=0.003, parent=root)
    cz.box(name + '_slot', (0.3, 0.03, 0.022), (0, -0.165, 0.04), dk, bevel=0.004, ol=0.004, parent=root)
    cz.box(name + '_shelf', (0.3, 0.05, 0.008), (0, -0.185, 0.026), cz.toon(name + '_shelfm', '#b9a57c'), bevel=0.003, ol=0.003, parent=root)
    lab = os.path.join(tex, 'lo_printer_label.png')
    if os.path.exists(lab):
        cz.plane(name + '_label', 0.13, 0.048, (-0.08, -0.03, 0.1395), cz.toon(name + '_labm', img=lab, lift=0.8), rot=(0, 0, 0), parent=root)
    cz.cyl(name + '_led', 0.008, 0.004, (0.02, -0.06, 0.139), cz.glow(name + '_ledm', '#4cff7a', 3.0), ol=0, parent=root, verts=12)
    for i in range(6):
        cz.box(f'{name}_vent{i}', (0.006, 0.05, 0.003), (0.08 + i * 0.016, -0.06, 0.1405), dk, bevel=0, ol=0, parent=root)
    pv = cz.empty(name + '_out', (0, -0.16 - 0.14 * out, 0.032), parent=root)
    tk = ticket or os.path.join(tex, 'lo_ticket.png')
    if os.path.exists(tk):
        cz.plane(name + '_ticket', 0.1, 0.15, (0, 0.0, 0.0), cz.toon('lo_ticketm_' + os.path.basename(tk)[:-4], img=tk, lift=0.8), rot=(0, 0, 0), parent=pv)      # upright for the top-down camera (it read upside down)
    return root
