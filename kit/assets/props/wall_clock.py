# Wall clock: round white face in a dark rim, 12 tick marks, hour/minute hands on their own pivots (animate
# rotation_euler.y of <name>_hour / <name>_minute; 0 = pointing up, POSITIVE = clockwise seen from the front:
# a rotation about +Y moves the top toward +X, which is screen-right for a camera at -Y).
# Hangs on a wall: the back is at y = 0, the face looks toward -Y, centre at z = 0.
import math

META = {'size': (0.36, 0.06, 0.36), 'anchor': 'back centre on the wall', 'animate': ['_hour', '_minute']}


def build(cz, name='wall_clock', r=0.18, rim='#2a2f3a', face='#f6f1e4', hands='#1a1410', time=(10, 10)):
    root = cz.empty(name)
    cz.cyl(name + '_rim', r, 0.05, (0, 0, 0), cz.toon(name + '_rimm', rim), rot=(90, 0, 0), ol=0.007, parent=root, bevel=0.008)
    cz.cyl(name + '_face', r * 0.86, 0.012, (0, -0.045, 0), cz.toon(name + '_facem', face, tex='paper', tex_strength=0.03), rot=(90, 0, 0), ol=0.0, parent=root)
    for i in range(12):
        a = math.radians(i * 30); big = i % 3 == 0
        rr = r * 0.72
        cz.box(f'{name}_tick{i}', (0.012 if big else 0.007, 0.004, 0.034 if big else 0.02), (rr * math.sin(a), -0.059, rr * math.cos(a)), hands, rot=(0, math.degrees(a), 0), bevel=0, ol=0, parent=root)
    hm = cz.toon(name + '_handm', hands, 0.8)
    for nm, L, w, ang in (('_hour', r * 0.45, 0.018, (time[0] % 12 + time[1] / 60) * 30), ('_minute', r * 0.66, 0.012, time[1] * 6)):
        pv = cz.empty(name + nm, (0, -0.062 - (0.004 if nm == '_minute' else 0), 0), parent=root)
        pv.rotation_euler = (0, math.radians(ang), 0)
        cz.box(name + nm + '_bar', (w, 0.004, L), (0, 0, L / 2 - 0.02), hm, bevel=0.002, ol=0.0, parent=pv)
    cz.cyl(name + '_cap', 0.014, 0.012, (0, -0.07, 0), hm, rot=(90, 0, 0), ol=0, parent=root)
    return root
