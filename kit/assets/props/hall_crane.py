# Bronze crane (the palace symbol of long life) standing on a bronze tortoise-shell rock: a lumpy patinated rock base,
# two thin legs with knee joints, a plump body with folded wings and a fan of tail feathers, a long S-curved neck,
# a small head with a red crown spot, looking up and out with its long beak. Bronze with teal patina accents.
# Floor prop: root = floor centre of the base; the crane faces -Y (mirror=True turns its head the other way).
import math, os, importlib.util

META = {'size': (0.6, 0.7, 1.55), 'anchor': 'floor centre', 'animate': [], 'params': "size=1.0, mirror=False"}


def _tube():
    spec = importlib.util.spec_from_file_location('hall_censer_lib', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hall_censer.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m.tube


def build(cz, name='hall_crane', size=1.0, mirror=False):
    tube = _tube()
    root = cz.empty(name)
    S = size; m = -1 if mirror else 1
    br = cz.toon('hall_bronze', '#9a6a34', tex='grain', tex_strength=0.06)
    dk = cz.toon('hall_bronze_dark', '#5e3e22', tex='grain', tex_strength=0.06)
    pat = cz.toon('hall_patina', '#3f8a78', tex='grain', tex_strength=0.05)
    red = cz.toon('hall_crane_red', '#c8302a')
    # base: a lumpy rock of a few squashed spheres on a round plinth
    cz.cyl(name + '_plinth', 0.3 * S, 0.08 * S, (0, 0, 0), dk, verts=8, bevel=0.012, ol=0.005, parent=root)
    for k, (x, y, r, s) in enumerate(((0, 0, 0.22, 0.45), (0.12, -0.08, 0.13, 0.6), (-0.13, 0.06, 0.14, 0.55), (0.05, 0.13, 0.12, 0.5))):
        cz.sphere(f'{name}_rock{k}', r * S, (x * S, y * S, 0.1 * S), pat if k % 2 else br, scale=(1, 1, s), ol=0.005, parent=root, segs=16, rings=8)
    # legs
    for s in (-1, 1):
        hip = (s * 0.05 * S, 0.02 * S, 0.8 * S); knee = (s * 0.055 * S, 0.06 * S, 0.5 * S); foot = (s * 0.06 * S, 0.0, 0.17 * S)
        tube(cz, f'{name}_leg{s}', [foot, knee, hip], [0.014 * S, 0.016 * S, 0.02 * S], dk, root, segs=8, ol=0.003)
        cz.sphere(f'{name}_knee{s}', 0.024 * S, knee, dk, ol=0.002, parent=root, segs=10, rings=5)
        for k in (-1, 0, 1):    # toes
            cz.box(f'{name}_toe{s}{k}', (0.018 * S, 0.11 * S, 0.018 * S), (s * 0.06 * S + k * 0.025 * S, -0.045 * S, 0.16 * S), dk, rot=(0, 0, k * 25),
                   bevel=0.005, ol=0.002, parent=root)
    # body (slim, tilted nose-up), folded wings with dark flight feathers drooping into a bustle over the tail
    b = cz.sphere(name + '_body', 0.12 * S, (0, 0.03 * S, 0.88 * S), br, scale=(0.95, 1.65, 0.9), ol=0.006, parent=root, segs=24, rings=12)
    b.rotation_euler = (math.radians(-14), 0, 0)
    for s in (-1, 1):
        w = cz.sphere(f'{name}_wing{s}', 0.1 * S, (s * 0.085 * S, 0.06 * S, 0.9 * S), br, scale=(0.35, 1.7, 0.75), ol=0.005, parent=root, segs=18, rings=9)
        w.rotation_euler = (math.radians(-20), 0, math.radians(s * 5))
    for k in range(5):
        a = math.radians(-36 + 18 * k)
        f = cz.cyl(f'{name}_tail{k}', 0.045 * S, 0.26 * S, (math.sin(a) * 0.05 * S, 0.17 * S, 0.9 * S), dk, rot=(-118, 0, math.degrees(a) * 0.7),
                   r2=0.01 * S, verts=8, ol=0.003, parent=root)
        f.scale = (1.0, 0.4, 1.0)
    cz.sphere(name + '_collar', 0.045 * S, (0, -0.13 * S, 0.94 * S), pat, scale=(1, 1, 1.2), ol=0.003, parent=root, segs=14, rings=7)
    # neck: a long S-curve forward, back and up; small head looking up and out; red crown, long beak
    neck = [(0, -0.13 * S, 0.94 * S), (0, -0.2 * S, 1.04 * S), (0, -0.19 * S, 1.16 * S), (m * 0.01 * S, -0.12 * S, 1.27 * S),
            (m * 0.03 * S, -0.1 * S, 1.39 * S), (m * 0.045 * S, -0.14 * S, 1.49 * S), (m * 0.05 * S, -0.18 * S, 1.53 * S)]
    tube(cz, name + '_neck', neck, [0.04 * S, 0.03 * S, 0.026 * S, 0.024 * S, 0.023 * S, 0.024 * S, 0.026 * S], br, root, segs=12, ol=0.004)
    hx, hy, hz = m * 0.052 * S, -0.2 * S, 1.545 * S
    cz.sphere(name + '_head', 0.038 * S, (hx, hy, hz), br, scale=(0.9, 1.25, 0.9), ol=0.004, parent=root, segs=18, rings=9)
    cz.sphere(name + '_crown', 0.02 * S, (hx, hy + 0.006 * S, hz + 0.028 * S), red, scale=(1, 1.3, 0.6), ol=0.002, parent=root, segs=12, rings=6)
    cz.cyl(name + '_beak', 0.013 * S, 0.2 * S, (hx, hy - 0.03 * S, hz - 0.004 * S), dk, rot=(78, 0, -m * 12), r2=0.002, verts=10, ol=0.003, parent=root)
    for s in (-1, 1):
        cz.sphere(f'{name}_eye{s}', 0.007 * S, (hx + s * 0.03 * S, hy - 0.02 * S, hz + 0.01 * S), cz.toon('hall_eye', '#2a2622'), ol=0.0, parent=root, segs=8, rings=4)
    return root
