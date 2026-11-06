# Small building fixtures of a tired Japanese office room, one kind per instance:
#   wall (back at y = 0, centred on x = 0, z = 0, front -Y):
#     'switch'  a 2-gang light switch plate, rocker switches, a tiny orange locator light
#     'outlet'  a 2-socket wall outlet (vertical slot pairs), one with a scorch-grey smudge
#     'speaker' a ceiling-line PA speaker box with a round grille and a volume knob
#     'alarm'   corridor fire-alarm group: red indicator lamp (glows), push-button box (発信機), a small bell
#     'nail'    a lone nail left in the wall
#   ceiling (top at z = 0, hangs toward -Z):
#     'smoke'   a round smoke detector with a red LED
#     'sprinkler' chrome rosette, body and deflector
#     'vent'    a square air diffuser (stepped rings) with a grey dust halo, 0.5 m (fills one ceiling tile)

META = {'size': (0.5, 0.5, 0.06), 'anchor': 'wall kinds: back centre on the wall; ceiling kinds: top centre at z = 0',
        'animate': [], 'params': "kind='switch'|'outlet'|'speaker'|'alarm'|'nail'|'smoke'|'sprinkler'|'vent', lit=True"}

TEX = 'assets/props/tex/'


def build(cz, name='room_fixtures', kind='switch', lit=True):
    root = cz.empty(name)
    cream = cz.toon('room_fx_cream', '#e9e2cf', tex='grain', tex_strength=0.04)
    dark = cz.toon('room_fx_dark', '#33312c')
    metal = cz.toon('room_fx_metal', '#a9aeb4')
    if kind == 'switch':
        cz.box(name + '_plate', (0.075, 0.008, 0.12), (0, -0.004, 0), cream, bevel=0.004, ol=0.003, parent=root)
        for s in (-1, 1):
            r = cz.box(f'{name}_rock{s}', (0.026, 0.007, 0.056), (s * 0.0165, -0.009, 0), cz.toon('room_fx_rocker', '#f3eee0'), bevel=0.002, ol=0.0018, parent=root)
            r.rotation_euler.x = 0.1 * s
        cz.sphere(name + '_loc', 0.003, (0.0165, -0.0135, -0.021), cz.glow('room_fx_orange', '#ffa040', 4.0) if lit else dark, ol=0, parent=root)
    elif kind == 'outlet':
        cz.box(name + '_plate', (0.07, 0.008, 0.115), (0, -0.004, 0), cream, bevel=0.004, ol=0.003, parent=root)
        for z in (0.025, -0.025):
            cz.box(f'{name}_mod{z}', (0.046, 0.003, 0.036), (0, -0.0085, z), cz.toon('room_fx_mod', '#ddd6c2'), bevel=0.002, ol=0.0012, parent=root)
            for s in (-1, 1):
                cz.box(f'{name}_slot{z}{s}', (0.003, 0.002, 0.012), (s * 0.0065, -0.0105, z), dark, bevel=0, ol=0, parent=root)
        cz.sphere(name + '_smudge', 0.012, (0.0, -0.0098, 0.042), cz.toon('room_fx_smudge', '#9c9585'), scale=(1, 0.08, 0.5), ol=0, parent=root)
    elif kind == 'speaker':
        cz.box(name + '_box', (0.24, 0.1, 0.24), (0, -0.05, 0), cz.toon('room_fx_spk', '#d9d2bf', tex='grain', tex_strength=0.05), bevel=0.012, ol=0.006, parent=root)
        cz.cyl(name + '_grille', 0.085, 0.006, (0, -0.1, 0.012), cz.toon('room_fx_grille', '#6b6a64'), rot=(90, 0, 0), verts=40, ol=0.003, parent=root)
        for k, r in enumerate((0.065, 0.045, 0.025)):
            cz.cyl(f'{name}_ring{k}', r, 0.004, (0, -0.1035, 0.012), cz.toon('room_fx_grille2', '#4a4944'), rot=(90, 0, 0), verts=40, ol=0.0018, parent=root)
        cz.cyl(name + '_knob', 0.012, 0.012, (0.085, -0.1, -0.09), dark, rot=(90, 0, 0), verts=20, ol=0.002, parent=root)
        cz.box(name + '_cable', (0.012, 0.012, 0.16), (-0.08, -0.03, 0.2), cream, bevel=0.002, ol=0.002, parent=root)
    elif kind == 'alarm':
        red = cz.toon('room_fx_red', '#c63a32', tex='grain', tex_strength=0.04)
        cz.box(name + '_box', (0.14, 0.05, 0.14), (0, -0.025, 0), red, bevel=0.006, ol=0.004, parent=root)
        cz.plane(name + '_face', 0.12, 0.12, (0, -0.0515, 0), cz.toon('room_fx_alarmface', img=TEX + 'room_alarm_face.png', lift=0.62), parent=root)
        cz.cyl(name + '_lampbase', 0.045, 0.02, (0, -0.0, 0.17), red, rot=(90, 0, 0), verts=32, ol=0.003, parent=root)
        lm = cz.glow('room_fx_lamp', '#ff3a26', 3.0) if lit else red
        cz.sphere(name + '_lamp', 0.036, (0, -0.02, 0.17), lm, scale=(1, 0.8, 1), ol=0.003, parent=root)
        cz.cyl(name + '_bellbase', 0.012, 0.03, (0, 0, -0.14), metal, rot=(90, 0, 0), verts=16, ol=0.002, parent=root)
        cz.sphere(name + '_bell', 0.05, (0, -0.035, -0.14), red, scale=(1, 0.55, 1), ol=0.004, parent=root)
    elif kind == 'thermo':   # thermo-hygrometer: two dials on a little wooden plaque hanging from a nail
        cz.box(name + '_plaque', (0.2, 0.014, 0.12), (0, -0.007, 0), cz.toon('room_fx_plaque', '#8a5e38', tex='wood', tex_strength=0.08), bevel=0.006, ol=0.004, parent=root)
        for s in (-1, 1):
            cz.cyl(f'{name}_bezel{s}', 0.047, 0.012, (s * 0.05, -0.014, 0), cz.toon('room_fx_bezel', '#c9b07a'), rot=(90, 0, 0), verts=32, ol=0.003, parent=root)
        cz.plane(name + '_dials', 0.19, 0.095, (0, -0.0275, 0), cz.toon('room_fx_dials', img=TEX + 'room_thermo_face.png', alpha_clip=True, lift=0.66), parent=root)
        cz.cyl(name + '_string', 0.0015, 0.08, (0, -0.007, 0.06), cz.toon('room_fx_string', '#5a4a3a'), verts=8, ol=0, parent=root)
    elif kind == 'remotebox':   # the AC remote locked in a clear wall box (nobody may touch the setting)
        clear = cz.toon('room_fx_clear', '#cfe2e6', lift=0.7)
        cz.box(name + '_back', (0.1, 0.008, 0.19), (0, -0.004, 0), cream, bevel=0.003, ol=0.003, parent=root)
        cz.box(name + '_remote', (0.055, 0.02, 0.15), (0, -0.018, -0.005), cz.toon('room_fx_remote', '#e8e6e0'), bevel=0.008, ol=0.003, parent=root)
        cz.box(name + '_lcd', (0.04, 0.002, 0.025), (0, -0.0285, 0.045), cz.toon('room_fx_lcd', '#9db08e'), bevel=0, ol=0.001, parent=root)
        for i, (x, z, c) in enumerate(((-0.012, 0.005, '#d24a3a'), (0.012, 0.005, '#3a7ad0'), (-0.012, -0.03, '#8d8a80'), (0.012, -0.03, '#8d8a80'), (0, -0.055, '#8d8a80'))):
            cz.cyl(f'{name}_btn{i}', 0.0065, 0.004, (x, -0.028, z), cz.toon(f'room_fx_btn{c}', c), rot=(90, 0, 0), verts=12, ol=0.001, parent=root)
        for s in (-1, 1):   # the clear cover's edges (no face: reads as clear plastic)
            cz.box(f'{name}_cv{s}', (0.006, 0.04, 0.19), (s * 0.047, -0.024, 0), clear, bevel=0.002, ol=0.002, parent=root)
            cz.box(f'{name}_ch{s}', (0.1, 0.04, 0.006), (0, -0.024, s * 0.092), clear, bevel=0.002, ol=0.002, parent=root)
        cz.box(name + '_lock', (0.022, 0.012, 0.022), (0, -0.05, -0.1), cz.toon('room_fx_brass', '#c9a24a'), bevel=0.003, ol=0.002, parent=root)
        cz.cyl(name + '_shackle', 0.007, 0.003, (0, -0.05, -0.084), metal, rot=(90, 0, 0), verts=16, ol=0.0015, parent=root)
    elif kind == 'nail':
        cz.cyl(name + '_shaft', 0.0018, 0.028, (0, 0, 0), metal, rot=(90, 0, 0), verts=12, ol=0.001, parent=root)
        cz.cyl(name + '_head', 0.0048, 0.0022, (0, -0.028, 0), metal, rot=(90, 0, 0), verts=16, ol=0.0012, parent=root)
    elif kind == 'smoke':
        cz.cyl(name + '_base', 0.075, 0.016, (0, 0, -0.016), cream, verts=40, bevel=0.004, ol=0.003, parent=root)
        cz.cyl(name + '_dome', 0.056, 0.024, (0, 0, -0.04), cz.toon('room_fx_white', '#f0ebdd'), verts=40, r2=0.05, bevel=0.004, ol=0.003, parent=root)
        cz.cyl(name + '_slits', 0.0575, 0.006, (0, 0, -0.031), dark, verts=40, ol=0, parent=root)
        cz.sphere(name + '_led', 0.004, (0.03, 0, -0.041), cz.glow('room_fx_redled', '#ff3a2a', 5.0) if lit else dark, ol=0, parent=root)
    elif kind == 'sprinkler':
        cz.cyl(name + '_rose', 0.03, 0.008, (0, 0, -0.008), metal, verts=32, bevel=0.002, ol=0.002, parent=root)
        cz.cyl(name + '_body', 0.009, 0.03, (0, 0, -0.036), metal, verts=16, ol=0.0015, parent=root)
        cz.capsule(name + '_bulb', 0.003, 0.016, (0, 0, -0.044), cz.toon('room_fx_bulb', '#e0483a', 0.7), ol=0, parent=root)
        cz.cyl(name + '_defl', 0.018, 0.003, (0, 0, -0.048), metal, verts=20, ol=0.0015, parent=root)
    elif kind == 'vent':
        cz.box(name + '_dust', (0.62, 0.62, 0.001), (0, 0, -0.0012), cz.toon('room_fx_dusthalo', '#a9a593'), bevel=0, ol=0, parent=root)
        for k, (s, z) in enumerate(((0.5, 0.0), (0.4, -0.012), (0.3, -0.022), (0.2, -0.03), (0.11, -0.036))):
            m = cream if k % 2 == 0 else cz.toon('room_fx_gap', '#5a5850')
            cz.box(f'{name}_ring{k}', (s, s, 0.012), (0, 0, z - 0.006), m, bevel=0.002, ol=0.003 if k % 2 == 0 else 0, parent=root)
    return root
