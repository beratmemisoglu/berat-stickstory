# Framed wall board for the office: kind='sign' (printed board in a slim dark frame with two mount screws), 'white'
# (whiteboard: aluminium frame, marker tray with three markers and an eraser, coloured magnets) or 'cork' (notice board:
# wood frame, cork face, pinned papers with round pin heads). The face picture is any PNG (cork: the pinned papers).
# Wall prop: the back is at y = 0, centred on x = 0 and z = 0, the face looks toward -Y.
import math, os, random

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
LAB = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

META = {'size': ('w + 2 * frame', 0.045, 'h + 2 * frame'), 'anchor': 'back centre on the wall (y = 0), centred on z = 0, face -Y',
        'animate': [],
        'params': "img=png (file name in assets/props/tex or a path; the face), w=1.2 (face width m), h=None (from the image "
                  "aspect), kind='sign'|'white'|'cork', frame=None (colour), tray=None (white: marker tray, default on), "
                  "magnets=0 (white: n magnets), papers=() (cork: (png, w, x, z, tilt_deg) pinned, x/z in face metres), seed=1"}


def _path(img):
    if not img: return None
    if os.path.isabs(img): return img
    for p in (os.path.join(TEX, img), os.path.join(LAB, img)):
        if os.path.exists(p): return p
    return None


def build(cz, name='off_board', img=None, w=1.2, h=None, kind='sign', frame=None, tray=None, magnets=0, papers=(), seed=1):
    root = cz.empty(name)
    rnd = random.Random(seed)
    path = _path(img)
    if h is None:
        if path:
            im = cz.image(path); h = w * im.size[1] / max(1, im.size[0])
        else: h = w * 0.7
    fw = {'sign': 0.022, 'white': 0.03, 'cork': 0.045}[kind]
    fc = frame or {'sign': '#2b2622', 'white': '#b9bdc2', 'cork': '#8a5a32'}[kind]
    fm = cz.toon('off_board_frame_' + fc.lstrip('#'), fc, tex='wood' if kind == 'cork' else 'grain', tex_strength=0.05)
    D = 0.032 if kind != 'sign' else 0.024
    # backing + face
    if kind == 'cork':
        cork = cz.toon('off_board_cork', img=os.path.join(LAB, 'assets', 'tex', 'corkboard.png'), proj='box', proj_scale=2.5)
        cz.box(name + '_face', (w, 0.016, h), (0, -0.008, 0), cork, bevel=0, ol=0, parent=root)
        fy = -0.0175
    else:
        cz.box(name + '_back', (w, 0.012, h), (0, -0.006, 0), cz.toon('off_board_backing', '#e9e6df'), bevel=0, ol=0, parent=root)
        if path:
            cz.plane(name + '_face', w, h, (0, -0.0125, 0), cz.toon(name + '_facem', img=path, lift=0.78), parent=root)
        fy = -0.014
    # frame bars, proud of the face (they throw a little shadow on it)
    for s in (-1, 1):
        cz.box(f'{name}_fz{s}', (w + 2 * fw, D, fw), (0, -D / 2, s * (h / 2 + fw / 2)), fm, bevel=0.005, ol=0.005, parent=root)
        cz.box(f'{name}_fx{s}', (fw, D, h), (s * (w / 2 + fw / 2), -D / 2, 0), fm, bevel=0.005, ol=0.005, parent=root)
    if kind == 'sign':
        scr = cz.toon('off_board_screw', '#c9cdd2')
        for s in (-1, 1):
            cz.cyl(f'{name}_screw{s}', 0.006, 0.003, (s * (w / 2 + fw / 2), -D - 0.0005, h / 2 + fw / 2), scr, rot=(90, 0, 0), verts=12, ol=0, parent=root)
    if kind == 'white':
        if tray is None or tray:
            tw = min(0.6, w * 0.5)
            cz.box(name + '_tray', (tw, 0.07, 0.018), (w * 0.12, -0.04, -h / 2 - fw - 0.009), fm, bevel=0.004, ol=0.004, parent=root)
            cz.box(name + '_traylip', (tw, 0.008, 0.03), (w * 0.12, -0.072, -h / 2 - fw - 0.003), fm, bevel=0.002, ol=0.003, parent=root)
            for i, c in enumerate(('#d0302a', '#3a63c4', '#2a2622')):
                cz.cyl(f'{name}_marker{i}', 0.011, 0.13, (w * 0.12 - tw / 2 + 0.06 + i * 0.05, -0.045, -h / 2 - fw + 0.011), cz.toon('off_marker' + str(i), c),
                       rot=(0, 90, 0), verts=12, ol=0.002, parent=root)
            cz.box(name + '_eraser', (0.13, 0.05, 0.035), (w * 0.12 + tw / 2 - 0.1, -0.042, -h / 2 - fw + 0.0175), cz.toon('off_eraser', '#3a3d44'), bevel=0.006, ol=0.003, parent=root)
        cols = ('#d0302a', '#f2c230', '#3a63c4', '#4f9a6a', '#e86a8a')
        for i in range(magnets):
            x, z = rnd.uniform(-w / 2 + 0.06, w / 2 - 0.06), rnd.uniform(-h / 2 + 0.06, h / 2 - 0.06)
            cz.cyl(f'{name}_mag{i}', 0.017, 0.012, (x, fy, z), cz.toon('off_mag' + str(i % 5), cols[i % 5]), rot=(90, 0, 0), verts=16, ol=0.002, parent=root)
    if kind == 'cork':
        pins = ('#d0302a', '#f2c230', '#3a63c4', '#4f9a6a', '#e86a8a')
        for i, (png, pw, x, z, tilt) in enumerate(papers):
            pp = _path(png)
            if not pp: continue
            im = cz.image(pp); ph = pw * im.size[1] / max(1, im.size[0])
            mat = cz.toon('off_paper_' + os.path.splitext(os.path.basename(pp))[0], img=pp, tex='paper', tex_strength=0.03, lift=0.75)
            cz.plane(f'{name}_paper{i}', pw, ph, (x, fy - 0.0005 * i, z), mat, rot=(90, tilt, 0), parent=root)
            t = math.radians(tilt)
            px, pz = x + (ph / 2 - 0.02) * math.sin(t), z + (ph / 2 - 0.02) * math.cos(t)
            cz.sphere(f'{name}_pin{i}', 0.011, (px, fy - 0.012, pz), cz.toon('off_pin' + str(i % 5), pins[i % 5]), ol=0.002, parent=root, segs=14, rings=7)
    return root
