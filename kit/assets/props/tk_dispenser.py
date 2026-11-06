# Lottery scratch-ticket dispenser (TICKETS): a clear acrylic counter case, 2 rows x 4 bins, red branding columns
# ("SCRATCH & WIN") left and right, a lit navy header "INSTANT TICKETS" and a little "PLAY HERE! WIN TODAY!" topper.
# Each bin shows the front card of its fan-folded stack (tex/tk_dispenser_card<i>.png, or art=[png, ...]) behind the
# acrylic front (glints only: the view stays clear), a price strip on the lip under it, and a strip of joined tickets
# (perforated) feeding out of the slot at the lip's bottom front. Top-row strips hang down in front of the bottom row
# and land on the surface; bottom-row strips feed out flat onto it; landed tickets fan-fold into a little pile.
# Bins are numbered row-major: top row 0..3 (left to right, seen from the front), bottom row 4..7.
# Surface prop: root at the bottom centre (stand it on a counter top), front -Y.
# Pivots: <name>_strip<i> at bin i's slot (each strip hangs from it: move / rotate / hide it when the clerk pulls one);
# inside it the tickets are chained pivots <name>_strip<i>_t<k> at each perforation.
import math, os

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')

META = {'size': (0.92, 0.27, 0.58), 'anchor': 'bottom centre (stands on a counter top), front -Y',
        'animate': ['_strip0', '_strip1', '_strip2', '_strip3', '_strip4', '_strip5', '_strip6', '_strip7'],
        'clear': 'strips land up to 0.34 m in front of the case (y -0.13 .. -0.34): keep that strip of the counter free',
        'params': "art=None (list of 8 card-face PNG paths, portrait 0.6:1), empty=False (every bin empty + SOLD OUT tag "
                  "on bin 0), bins_empty=[] (indices), strips=None (8 ticket counts per bin, default [3, 0.25, 4, 0.25, 4, 3, 5, 3]; 0 = none, a value below 1 = a stub: torn off flush, the next ticket's bottom quarter peeking out), "
                  "floor=0.0 (local z of the surface the strips land on; None = hang free, e.g. wall-mounted), pulled=[] (bins whose strip "
                  "is held out taut: pivot swung -86 deg about X), seed=1"}

W, D = 0.9, 0.25
COLW = 0.09                       # branding column width
BW = (W - 2 * COLW) / 4           # bin pitch 0.18
TW, TL = 0.105, 0.175             # ticket (0.6 : 1)
LIP, WIN = 0.03, 0.185            # per row: lip band under the window
Z0 = 0.02                         # plinth height
ROWZ = (Z0 + LIP + WIN, Z0)       # bottom of row 0 (top) and row 1 (bottom)
ZH = Z0 + 2 * (LIP + WIN)         # header bottom 0.45
HH = 0.08
FY = -D / 2                       # front face of the case
GAP = 0.0016                      # fan-fold layer gap


def _tex(n): return os.path.join(TEX, n)


def _ticket(cz, nm, pv, face, back, paper, L=TL):
    """One ticket hanging from pivot pv (its top edge): thin card body (ink edge) + printed face / back planes."""
    cz.box(nm + '_body', (TW, 0.001, L), (0, 0, 0), paper, bevel=0, ol=0.002, parent=pv, origin='top')
    cz.plane(nm + '_face', TW - 0.002, L - 0.002, (0, -0.0019, -L / 2), face, parent=pv)
    cz.plane(nm + '_back', TW - 0.002, L - 0.002, (0, 0.0019, -L / 2), back, rot=(90, 0, 180), parent=pv)


def _strip(cz, nm, parent, n, h, rnd, face, back, paper):
    """n joined tickets hanging from parent (at height h above the landing surface; h=None: hang free).
    Angles th are absolute (0 = hanging straight down, +90 = lying flat toward the front)."""
    ths, landed, prev = [], False, 0.0
    z = h
    for k in range(n):
        if landed:
            th = prev + (174 if (k - land_k) % 2 == 1 else -174)
        else:
            th = (4.0 if k == 0 else 1.5) + rnd.uniform(-1.0, 1.0)
            if h is not None and z - TL * math.cos(math.radians(th)) < 0:
                th = math.degrees(math.acos(max(-1.0, min(1.0, z / TL))))
                landed, land_k = True, k
            if h is not None: z -= TL * math.cos(math.radians(th))
        ths.append(th); prev = th
    if landed and (n - 1 - land_k) % 2 == 1:      # the top of a fan-fold pile shows a face, not a back
        ths.append(prev + (174 if (n - land_k) % 2 == 1 else -174))
    pv, last = parent, 0.0
    for k, th in enumerate(ths):
        d = th - last
        off = 0.0
        if k and abs(d) > 90: off = -GAP if d > 0 else GAP      # a fold lies on the side it swings toward
        loc = (0, 0, 0) if k == 0 else (rnd.uniform(-0.002, 0.002), off, -TL)
        pv = cz.empty(f'{nm}_t{k}', loc, parent=pv, size=0.02)
        pv.rotation_euler = (math.radians(-d), 0, math.radians(rnd.uniform(-1.2, 1.2)))
        _ticket(cz, f'{nm}_t{k}', pv, face, back, paper)
        last = th


def build(cz, name='tk_dispenser', art=None, empty=False, bins_empty=(), strips=None, floor=0.0, pulled=(), seed=1):
    import random
    rnd = random.Random(seed)
    root = cz.empty(name)

    def M(key, c, **k): return cz.toon(f'tk_disp_{key}', c, **k)
    red = M('red', '#a8102b', tex='grain', tex_strength=0.05)
    navy = M('navy', '#121c52', tex='grain', tex_strength=0.05)
    back_navy = M('backnavy', '#1a2a6a', tex='grain', tex_strength=0.06)
    dark = M('dark', '#25222a', tex='grain', tex_strength=0.04)
    acryl = M('acryl', '#a6dbe6', lift=0.5, emit=0.12)
    chrome = M('chrome', '#c3c8cf', lift=0.5)
    paper = M('paper', '#efe8d6', tex='paper', tex_strength=0.04)
    tback = cz.toon('tk_disp_tback', img=_tex('tk_dispenser_back.png'), lift=0.7)
    arts = list(art) if art else [_tex(f'tk_dispenser_card{i}.png') for i in range(8)]
    faces = [cz.toon('tk_disp_face_' + os.path.splitext(os.path.basename(p))[0], img=p, lift=0.72) for p in arts]
    gone = set(range(8)) if empty else set(bins_empty)
    counts = list(strips) if strips is not None else [3, 0.25, 4, 0.25, 4, 3, 5, 3]

    # ---- plinth, branding columns, back, header, topper
    cz.box(name + '_plinth', (W + 0.02, D + 0.02, Z0), (0, 0, 0), dark, bevel=0.004, ol=0.005, parent=root, origin='bottom')
    for s in (-1, 1):
        x = s * (W / 2 - COLW / 2)
        cz.box(f'{name}_col{s:+d}', (COLW, D, ZH - Z0), (x, 0, Z0), red, bevel=0.008, ol=0.006, parent=root, origin='bottom')
        cz.plane(f'{name}_colart{s:+d}', COLW - 0.016, ZH - Z0 - 0.03, (x, FY - 0.0013, (Z0 + ZH) / 2),
                 cz.toon('tk_disp_side', img=_tex('tk_dispenser_side.png'), lift=0.7), parent=root)
        for zz in (Z0 + 0.012, ZH - 0.012):        # screws
            cz.cyl(f'{name}_screw{s:+d}_{zz:.2f}', 0.005, 0.002, (x, FY - 0.0015, zz), chrome, rot=(90, 0, 0), verts=12, ol=0.0, parent=root)
    # a 21+ sticker low on the left column; a coin scratcher on a bead chain from the right column's corner
    cz.plane(name + '_sticker21', 0.07, 0.05, (-W / 2 + COLW / 2 + 0.004, FY - 0.0026, Z0 + 0.075),
             cz.toon('tk_disp_21', img=_tex('tk_dispenser_21.png'), alpha_clip=True, lift=0.75), rot=(90, 5, 0), parent=root)
    hx = W / 2 - 0.012
    cz.cyl(name + '_hook', 0.004, 0.012, (hx, FY - 0.012, ZH - 0.04), chrome, rot=(90, 0, 0), verts=10, ol=0.0015, parent=root)
    chain = cz.empty(name + '_scratcher', (hx, FY - 0.018, ZH - 0.04), parent=root, size=0.02)
    chain.rotation_euler = (math.radians(-4), math.radians(6), 0)
    for k in range(12):
        cz.sphere(f'{name}_bead{k}', 0.0028, (0, 0, -0.008 - k * 0.0105), chrome, ol=0.0, parent=chain, segs=10, rings=6)
    cz.box(name + '_scratcher_m', (0.034, 0.006, 0.05), (0, 0, -0.138), M('scratch', '#ffd23a', tex='grain'), bevel=0.004, ol=0.0018, parent=chain, origin='top')
    cz.cyl(name + '_scratcher_coin', 0.011, 0.004, (0, -0.003, -0.168), M('coin', '#c9ced4', lift=0.5), rot=(90, 0, 0), verts=16, ol=0.0012, parent=chain)
    cz.box(name + '_backpanel', (W - 2 * COLW + 0.004, 0.012, ZH - Z0), (0, D / 2 - 0.006, Z0), back_navy, bevel=0.0, ol=0.0, parent=root, origin='bottom')
    cz.plane(name + '_backprint', W - 2 * COLW, ZH - Z0, (0, D / 2 - 0.012 - 0.0013, (Z0 + ZH) / 2),
             cz.toon('tk_disp_backprint', img=_tex('tk_dispenser_backpanel.png'), lift=0.7), parent=root)
    cz.box(name + '_header', (W, D, HH), (0, 0, ZH), navy, bevel=0.01, ol=0.007, parent=root, origin='bottom')
    cz.plane(name + '_sign', W - 0.04, HH - 0.012, (0, FY - 0.0013, ZH + HH / 2), cz.screen(name + '_signm', _tex('tk_dispenser_header.png'), 1.15), parent=root)
    cz.box(name + '_signtrim', (W - 0.02, 0.006, 0.006), (0, FY - 0.002, ZH + 0.003), cz.glow('tk_disp_neon', '#ff4fb0', 3.0), bevel=0.0, ol=0.0, parent=root)
    cz.box(name + '_topper', (0.5, 0.014, 0.048), (0, 0.03, ZH + HH), navy, bevel=0.004, ol=0.004, parent=root, origin='bottom')
    cz.plane(name + '_topperart', 0.49, 0.0435, (0, 0.03 - 0.0083, ZH + HH + 0.024), cz.toon('tk_disp_band', img=_tex('tk_dispenser_band.png'), lift=0.75), parent=root)
    for s in (-1, 1):
        cz.box(f'{name}_topperfoot{s:+d}', (0.03, 0.04, 0.008), (s * 0.2, 0.03, ZH + HH), dark, bevel=0.002, ol=0.003, parent=root, origin='bottom')

    # ---- rows
    for r in range(2):
        zb = ROWZ[r]
        cz.box(f'{name}_lip{r}', (W - 2 * COLW + 0.004, D + 0.008, LIP), (0, -0.004, zb), dark, bevel=0.003, ol=0.005, parent=root, origin='bottom')
        cz.plane(f'{name}_prices{r}', W - 2 * COLW - 0.01, LIP - 0.006, (0, FY - 0.008 - 0.0013, zb + LIP / 2),
                 cz.toon(f'tk_disp_prices{r}', img=_tex(f'tk_dispenser_prices{r}.png'), lift=0.75), parent=root)
        # acrylic: dividers between bins, a clear front with glints, its top and side edges
        for b in range(5):
            x = -W / 2 + COLW + b * BW
            if 0 < b < 4:     # clear divider: only its front and back edges show
                for yy in (FY + 0.008, D / 2 - 0.02):
                    cz.box(f'{name}_glassdiv{r}_{b}_{yy:+.2f}', (0.006, 0.008, WIN - 0.004), (x, yy, zb + LIP), acryl, bevel=0.0, ol=0.002, parent=root, origin='bottom')
        cz.box(f'{name}_glassrail{r}', (W - 2 * COLW, 0.008, 0.01), (0, FY + 0.001, zb + LIP + WIN - 0.005), acryl, bevel=0.002, ol=0.003, parent=root)
        g = cz.plane(f'{name}_glass{r}', W - 2 * COLW - 0.004, WIN - 0.012, (0, FY + 0.002, zb + LIP + WIN / 2),
                     cz.toon('tk_disp_glints', img=_tex('tk_dispenser_glints.png'), alpha_clip=True, lift=0.9, emit=0.4), parent=root)
        g.visible_shadow = False
        for b in range(4):
            i = r * 4 + b
            x = -W / 2 + COLW + (b + 0.5) * BW
            # slot mouth (always there)
            cz.box(f'{name}_slot{i}', (TW + 0.012, 0.012, 0.007), (x, FY - 0.006, zb + 0.0035), M('slot', '#0f0d10'), bevel=0.002, ol=0.002, parent=root)
            if i in gone:
                continue
            # the fan-folded stack (cream block, ticket-coloured end) and the front card leaning back
            st = cz.empty(f'{name}_stack{i}', (x, -0.02, zb + LIP + 0.004), parent=root)
            st.rotation_euler = (math.radians(-9), 0, 0)
            cz.box(f'{name}_stack{i}_m', (TW, 0.11, TL), (0, 0.055, 0), paper, bevel=0.002, ol=0.003, parent=st, origin='bottom')
            pv = cz.empty(f'{name}_card{i}', (0, -0.0015, TL), parent=st, size=0.02)
            _ticket(cz, f'{name}_card{i}', pv, faces[i % len(faces)], tback, paper)
            # the strip feeding out of the slot
            n = counts[i] if i < len(counts) else 3
            if 0 < n < 1 and i not in pulled:
                # torn off flush: only the bottom quarter of the next ticket peeks out of the slot
                sp = cz.empty(f'{name}_strip{i}', (x, FY - 0.012, zb + 0.004), parent=root, size=0.03)
                sp.rotation_euler = (math.radians(-5), 0, 0)
                art_i = arts[i % len(arts)]
                stub = cz.toon('tk_disp_stub_' + os.path.splitext(os.path.basename(art_i))[0], img=art_i, lift=0.72, scale=(1, 0.25))
                _ticket(cz, f'{name}_strip{i}_t0', sp, stub, tback, paper, L=TL * 0.25)
            elif n > 0:
                n = max(1, int(round(n)))
                sp = cz.empty(f'{name}_strip{i}', (x, FY - 0.012, zb + 0.004), parent=root, size=0.03)
                if i in pulled:    # held out taut toward the customer by the clerk: free hang, pivot swung forward
                    h = None; sp.rotation_euler = (math.radians(-86), 0, 0)
                elif floor is None: h = None
                elif r == 1: h = zb + 0.004 - floor - 0.0015
                else:
                    below = counts[i + 4] if (i + 4) < len(counts) and (i + 4) not in gone and counts[i + 4] >= 1 else 0
                    h = zb + 0.004 - floor - (0.003 + 0.0026 * below if below else 0.0015)
                _strip(cz, f'{name}_strip{i}', sp, n, h, rnd, faces[i % len(faces)], tback, paper)
    # SOLD OUT tag taped to bin 0's glass
    if 0 in gone:
        x = -W / 2 + COLW + 0.5 * BW
        tg = cz.empty(name + '_soldout', (x, FY - 0.003, ROWZ[0] + LIP + WIN * 0.55), parent=root)
        tg.rotation_euler = (0, math.radians(-9), 0)
        cz.plane(name + '_soldout_m', 0.13, 0.062, (0, 0, 0), cz.toon('tk_disp_soldout', img=_tex('tk_dispenser_soldout.png'), alpha_clip=True, lift=0.75), parent=tg)
        cz.plane(name + '_soldout_tape', 0.03, 0.016, (0, -0.0013, 0.03), M('tape', '#e9dfb8', lift=0.8), rot=(90, 0, 12), parent=tg)
    return root
