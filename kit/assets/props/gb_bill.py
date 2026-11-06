# A paper bill / IOU sheet (BELL film, Horace's debts): ~0.21 x 0.28 m, upright facing -Y like a card, slightly curled,
# kind=0..5 printed PNG (tex/make_gb_grave.py: "I.O.U. $40", "FINAL NOTICE", "PAY UP BRIGGS!", "OWED: 12 DOLLARS",
# "DEBT - FEED & SEED", "RENT DUE"; old print, a red stamp, a signature), crumple=0..1 (creased facets + shrink).
# Flat-shaded grid with a real 0.8 mm thickness (so the hull outline works on a sheet) + a 2.5 mm outline.
# Root = sheet centre; a hand holds it by its top edge (META 'grip'). To lie flat face-up: rotation_euler.x = -90 deg.
import math, os, random, subprocess
import bmesh

W, HH = 0.21, 0.28
META = {'size': (W, 0.02, HH), 'anchor': 'sheet centre (upright, printed face toward -Y)', 'animate': [],
        'grip': (0.0, 0.0, HH / 2),
        'params': "kind=0..5 (text), crumple=0.0..1.0, curl=1.0 (top edge curls back toward +Y), seed=0. Lying flat face-up: rotation_euler.x = -90 deg."}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')


def _tex(cz, n):
    p = os.path.join(TEX, n)
    if not os.path.exists(p):
        py = cz.py()
        try:
            subprocess.run([py, os.path.join(TEX, 'make_gb_grave.py'), 'static'], timeout=120, check=True, capture_output=True,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except Exception as e:
            print('CZ gb_bill: png failed', e)
    return p if os.path.exists(p) else None


def build(cz, name='gb_bill', kind=0, crumple=0.0, curl=1.0, seed=0):
    root = cz.empty(name)
    kind = int(kind) % 6
    rnd = random.Random(seed * 31 + kind)
    c = max(0.0, min(1.0, float(crumple)))
    png = _tex(cz, f'gb_bill_{kind}.png')
    mat = cz.toon(f'gb_bill_paper{kind}', '#d6c8a4', img=png, lift=0.45) if png else cz.toon('gb_bill_plain', '#d6c8a4', tex='paper', lift=0.45)
    nx, nz = 9, 12
    creases = [(rnd.uniform(-W / 2, W / 2), rnd.uniform(-HH / 2, HH / 2), rnd.uniform(0, math.pi), rnd.uniform(0.5, 1.0) * rnd.choice((-1, 1)),
                rnd.uniform(0.05, 0.11)) for _ in range(3 + int(c * 6))]
    shrink = 1 - 0.2 * c
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); grid = []
    for j in range(nz + 1):
        row = []
        for i in range(nx + 1):
            u, v = i / nx, j / nz
            x, z = (u - 0.5) * W, (v - 0.5) * HH
            y = 0.0
            for (cx, cz_, a, amp, per) in creases:
                d = (x - cx) * math.sin(a) - (z - cz_) * math.cos(a)
                tri = abs(((d / per) % 1.0) - 0.5) * 2 - 0.5          # triangle wave -0.5..0.5: sharp ridges
                y += amp * tri * 0.022 * c
            if 0 < i < nx and 0 < j < nz: y += rnd.uniform(-1, 1) * 0.003 * c
            y += curl * (0.028 * max(0.0, v - 0.55) ** 2 / 0.2 + 0.006 * (2 * u - 1) ** 2)      # top curls back, sides cup a little
            row.append(bm.verts.new((x * shrink * (1 - 0.05 * c * math.sin(v * 7 + seed)), y, z * shrink)))
        grid.append(row)
    for j in range(nz):
        for i in range(nx):
            f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            for lp, (uu, vv) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uvl].uv = (uu / nx, vv / nz)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # the printed side must face -Y: flip if the normals came out +Y
    if sum(f.normal.y for f in bm.faces) > 0: bmesh.ops.reverse_faces(bm, faces=bm.faces)
    o = cz.place(cz._mesh_obj(name + '_sheet', bm, mat, smooth=False), (0, 0, 0), parent=root)
    th = o.modifiers.new('thick', 'SOLIDIFY'); th.thickness = 0.0008; th.offset = 0; th.use_rim = True
    cz.outline(o, 0.0025)
    return root
