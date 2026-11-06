# REEL BIG CASH scratch ticket (LOTTERY): a stiff card lying flat, the printed face up (+Z), the top of the graphic
# toward +Y (seen upright from the customer side, -Y). Root at the card's centre on its underside (z = 0 = the surface it
# lies on). Printed graphic: film/lottery/tex/st_ticket.png (make_store.py). For a held ticket turn the root
# (rotation_euler.x = 90 deg stands it up facing -Y).
import os

META = {'size': (0.12, 0.18, 0.004), 'anchor': 'card centre, underside (z = 0), face up, graphic top toward +Y',
        'animate': [], 'params': "w=0.12, small=False (low-res picture for distant copies), back='#e9e3d2'"}
TEX = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'film', 'lottery', 'tex')


def build(cz, name='lt_ticket', w=0.12, small=False, back='#e9e3d2'):
    root = cz.empty(name)
    h = w * 1.5; t = 0.0012          # flat paper (a 3.5 mm card read as a grey slab in the ECU)
    cz.box(name + '_card', (w, h, t), (0, 0, t / 2), cz.toon('lt_ticket_back', back, tex='paper', tex_strength=0.04),
           bevel=0.0003, ol=0.0008, parent=root)
    img = os.path.join(TEX, 'st_ticket_small.png' if small else 'st_ticket.png')
    cz.plane(name + '_face', w * 0.995, h * 0.995, (0, 0, t + 0.0006), cz.toon('lt_ticketm_' + os.path.basename(img), img=img, lift=0.35, emit=0.55),
             rot=(0, 0, 0), parent=root)
    return root
