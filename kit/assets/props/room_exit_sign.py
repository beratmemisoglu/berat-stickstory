# Emergency exit light (誘導灯) over a door: a slim off-white box with a glowing green panel (a running figure through a
# doorway + 非常口, our own drawing in tex/room_exit_panel.png), a small red inspection LED and a test-switch nub.
# Wall prop: back at y = 0, centred on x = 0, z = 0, front toward -Y. The set adds a little green light for its spill.

META = {'size': (0.38, 0.05, 0.15), 'anchor': 'back centre on the wall, centred on z = 0', 'animate': [],
        'params': "on=True (panel glows), strength=1.25"}

TEX = 'assets/props/tex/'


def build(cz, name='room_exit_sign', on=True, strength=1.25):
    root = cz.empty(name)
    body = cz.toon(name + '_body', '#e6e2d6', tex='grain', tex_strength=0.04)
    cz.box(name + '_box', (0.38, 0.045, 0.15), (0, -0.0225, 0), body, bevel=0.006, ol=0.005, parent=root)
    pm = cz.screen(name + '_panelm', TEX + 'room_exit_panel.png', strength) if on else cz.toon(name + '_paneloff', img=TEX + 'room_exit_panel.png', lift=0.6)
    cz.plane(name + '_panel', 0.345, 0.115, (0, -0.0465, 0.004), pm, parent=root)
    cz.sphere(name + '_led', 0.0045, (0.165, -0.046, -0.062), cz.glow(name + '_ledm', '#ff5a3c', 5.0), ol=0, parent=root)
    cz.box(name + '_test', (0.016, 0.006, 0.008), (-0.16, -0.047, -0.064), cz.toon(name + '_testm', '#8f8c84'), bevel=0.001, ol=0.0015, parent=root)
    return root
