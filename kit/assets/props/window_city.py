# Office window onto a Tokyo skyline. The window: a 2.4 x 2.0 m silver curtain-wall section (perimeter frame, two
# mullions, a low transom), a deep sill with an air-con grille (the "perimeter counter" of a Japanese office), the red
# fire-brigade-entry triangle sticker on one pane, optional cartoon glass glints. The exterior (exterior=True): three flat
# cut-out skyline layers (near / mid / far, 1.2 / 2.6 / 4.4 m behind the glass at the centre) standing on arcs that curve
# back toward the wall (any camera inside the room sees a layer at about the same distance, so depth-of-field blur
# stays even), a generic red-and-white lattice radio tower in the mid layer, clouds, and a sky bowl 6 m behind (gradient
# PNGs from tex/make_window_city.py). Everything outside is pure emission (looks the same under any set lighting) and
# casts no shadow (a sun placed outside still shines in through the opening).
#
# Wall prop: the frame's back is at y = 0 (the wall's room-side face), centred on x = 0, z = 0; the room is at -Y.
# The SET must cut an opening in its wall between 2.22 x 1.82 (the glass) and 2.4 x 2.0 (the frame's outer edge),
# centred on the root, and keep the space behind the wall free: the exterior fills y 0.25..6.1, x +-7.3 (+ span/2),
# z -4.5..6.5 (local). Nothing of the room (ceiling, floor slabs) may poke out behind the wall line, or it covers the
# skyline (a ceiling box running 2.5 m past the wall blacked out the top of the view in the first test).
# Composed for a camera ~1.5-4 m inside the room, ~0.4-1.0 m below the window centre (seated / standing eye height with
# the window centre ~1.7 m up), yaw within ~45 deg. A row of windows: give ONE of them exterior=True and
# span = (row width - 2.4) (centred on the row), the others exterior=False.
# Blink the red aviation lights by keyframing the scale of every <name>_beacon<i> (0 = off), or the emission strength
# of material <name>_beaconm.
import math, random

META = {'size': (2.56, 0.3, 2.045), 'anchor': 'back centre on the wall (y = 0); exterior extends to +Y up to 6.1 m',
        'opening': (2.4, 2.0), 'animate': ['_beacon<i> (scale 0/1 blink)'],
        'params': "time='day'|'dusk'|'night', glass=True, exterior=True, span=0.0 (extra straight width of the "
                  "exterior, m), seed=3, sticker=True"}

Z_LO, Z_HI = -4.5, 6.5      # sky bowl height (local z); the sky PNGs map v 0..1 onto this range
C0 = 1.5                    # the exterior arcs are centred 1.5 m inside the room
D_SKY = 6.0
# vertical sky gradients (local z, sRGB) - shared with tex/make_window_city.py, which draws the PNGs from them
SKY = {
    'day':   [(-4.5, '#f3f1e4'), (-1.0, '#eaf1ea'), (0.2, '#cbe5ee'), (1.6, '#a2d1ee'), (3.5, '#7fbbe8'), (6.5, '#64a8e2')],
    'dusk':  [(-4.5, '#ffd98c'), (-1.0, '#ffc27a'), (-0.2, '#ff9f6e'), (0.8, '#f07a78'), (1.8, '#c0628f'),
              (3.2, '#7c4f9c'), (6.5, '#3a3b78')],
    'night': [(-4.5, '#6a4a88'), (-1.0, '#4d3f80'), (0.2, '#2e3472'), (1.6, '#1f2a5e'), (3.5, '#162050'), (6.5, '#0d1436')],
}
# per time: facade palettes per layer, window colours, strengths
LOOK = {
    'day': dict(
        near=['#5d84ab', '#6c93a8', '#7889b0', '#58789e', '#6a7fa6'], mid=['#8daccb', '#99b2d0', '#8cb3c4', '#a0aed0'],
        far=['#b8cfe2', '#c4d6e7', '#b1cadd'], base=['#4f7397', '#7f9fbe', '#aac3d8'],
        win='#d4ebf7', wlit=None, wcool=None, lit=0.0, ws=1.0,
        radio=('#e0573a', '#f1ece2'), deck='#d4ebf7', cloud='#f8f6ef', beacon=None),
    'dusk': dict(
        near=['#3f3a6e', '#463f7a', '#3a4472', '#4a3b6c'], mid=['#6b4f8e', '#78568f', '#635396', '#70508a'],
        far=['#a9709f', '#b27aa5', '#9d6fa4'], base=['#352f60', '#5d4682', '#94659a'],
        win='#9a78ad', wlit='#ffcf73', wcool=None, lit=0.4, ws=1.3,
        radio=('#e8663f', '#f3c9b0'), deck='#ffd27a', cloud='#ffb39b', beacon='#ff4a3a'),
    'night': dict(
        near=['#1b1f42', '#21254e', '#1a2448', '#24204a'], mid=['#2a2f63', '#30356a', '#28336b', '#332f66'],
        far=['#3e4481', '#454a88', '#3a4684'], base=['#161a38', '#252a5a', '#373d77'],
        win=None, wlit='#ffd47e', wcool='#a8e6ff', lit=0.5, ws=1.5,
        radio=('#ff8a42', '#ffd6a6'), deck='#ffd27a', cloud=None, beacon='#ff3b30'),
}
# layer geometry: depth at the centre, card thickness, ink, tower widths, base-block widths/tops, bottom, window style
LAYERS = [
    ('near', dict(D=1.2, t=0.03, ol=0.006, w=(0.42, 0.78), bw=(0.3, 0.55), base=(-1.12, -0.98), bot=-3.0,
                  win=(0.06, 0.075, 0.11, 0.14), vis=2.0)),
    ('mid', dict(D=2.6, t=0.03, ol=0.005, w=(0.45, 0.85), bw=(0.35, 0.7), base=(-0.92, -0.8), bot=-3.6,
                 win=(0.07, 0.06, 0.13, 0.13), vis=2.8)),
    ('far', dict(D=4.4, t=0.03, ol=0.0, w=(0.55, 1.05), bw=(0.5, 0.9), base=(-0.66, -0.55), bot=-4.3,
                 win=(0.08, 0.07, 0.16, 0.15), vis=3.8)),
]


def sky_color(time, z):
    """sRGB '#rrggbb' of the sky gradient at local height z (the same curve the PNGs are drawn from)."""
    st = SKY[time]
    if z <= st[0][0]: return st[0][1]
    for (z0, c0), (z1, c1) in zip(st, st[1:]):
        if z <= z1:
            k = (z - z0) / (z1 - z0); k = k * k * (3 - 2 * k)
            a = [int(c0[i:i + 2], 16) for i in (1, 3, 5)]; b = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
            return '#%02x%02x%02x' % tuple(round(x + (y - x) * k) for x, y in zip(a, b))
    return st[-1][1]


def _path(D, span, s):
    """Point on a layer at arc length s from its centre: straight for |s| <= span/2, then an arc around (+-span/2, -C0).
    Returns x, y, yaw (deg, the card turned to face the arc centre)."""
    R = D + C0; h = span / 2
    if abs(s) <= h: return s, D, 0.0
    sg = 1 if s > 0 else -1; phi = (abs(s) - h) / R
    return sg * (h + R * math.sin(phi)), -C0 + R * math.cos(phi), -sg * math.degrees(phi)


def _half_len(D, span, ymin=0.25):
    R = D + C0
    return span / 2 + R * math.acos(min(1.0, (ymin + C0) / R))


def build(cz, name='window_city', time='day', glass=True, exterior=True, span=0.0, seed=3, sticker=True):
    time = time if time in LOOK else 'day'
    root = cz.empty(name)
    _frame(cz, name, root, time, glass, sticker)
    if exterior:
        out = cz.empty(name + '_outside', parent=root)
        _outside(cz, name, out, time, span, seed)
        for o in [out] + list(out.children_recursive):
            o.visible_shadow = False
    return root


# ---------------------------------------------------------------- the window itself
def _frame(cz, name, root, time, glass, sticker):
    alu = cz.toon(name + '_alu', '#b9bdc1', tex='grain', tex_scale=2.0, tex_strength=0.03)
    alu2 = cz.toon(name + '_alu2', '#a9aeb4', tex='grain', tex_scale=2.0, tex_strength=0.03)
    W, H, fw, fd = 2.4, 2.0, 0.09, 0.10
    # perimeter frame (back at y = 0)
    cz.box(name + '_top', (W, fd, fw), (0, -fd / 2, H / 2 - fw / 2), alu, bevel=0.012, ol=0.008, parent=root)
    cz.box(name + '_bottom', (W, fd, fw), (0, -fd / 2, -H / 2 + fw / 2), alu, bevel=0.012, ol=0.008, parent=root)
    for sx in (-1, 1):
        cz.box(f'{name}_side{"L" if sx < 0 else "R"}', (fw, fd, H - 2 * fw), (sx * (W / 2 - fw / 2), -fd / 2, 0), alu,
               bevel=0.012, ol=0.008, parent=root)
    # mullions (a bit deeper than the frame) and the low transom
    inner = H - 2 * fw
    for i, mx in enumerate((-0.4, 0.4)):
        cz.box(f'{name}_mullion{i}', (0.07, 0.12, inner), (mx, -0.06, 0), alu2, bevel=0.01, ol=0.007, parent=root)
    zt = -0.5
    cz.box(name + '_transom', (W - 2 * fw, 0.08, 0.06), (0, -0.05, zt), alu2, bevel=0.008, ol=0.006, parent=root)
    # deep sill / perimeter counter top with the air-con grille along the glass
    sill = cz.toon(name + '_sillm', '#e8e3d6', tex='grain', tex_scale=1.5, tex_strength=0.04)
    cz.box(name + '_sill', (2.56, 0.30, 0.045), (0, -0.15, -H / 2 - 0.0225), sill, bevel=0.012, ol=0.008, parent=root)
    gr = cz.toon(name + '_grillem', '#ffffff', img='assets/props/tex/window_city_grille.png')
    for i, gx in enumerate((-0.8, 0.0, 0.8)):
        cz.plane(f'{name}_grille{i}', 0.62, 0.075, (gx, -0.165, -H / 2 + 0.0015), gr, rot=(0, 0, 0), parent=root)
    # the glass plane sits mid-frame at y = -0.045 (no glass object: the view stays clear)
    gy = -0.046
    if sticker:   # red inverted triangle: the Japanese fire-brigade entry marker, on the right upper pane
        cz.cyl(name + '_sticker', 0.075, 0.003, (0.64, gy, -0.3), cz.toon(name + '_stickm', '#e2453a'),
               rot=(90, 180, 0), verts=3, ol=0.002, parent=root)   # (the cone's first corner is at +Y)
    if glass:     # two thin cartoon glints across the upper-left of the left and middle upper panes
        gc = {'day': ('#eef8fc', 1.0), 'dusk': ('#ffe2cf', 0.95), 'night': ('#8f9ccc', 0.6)}[time]
        gm = cz.glow(name + '_glintm', gc[0], gc[1])
        for i, x0 in enumerate((-1.11, -0.365)):
            cx, cz_ = x0 + 0.27, 0.6
            for j, (wd, ln, off) in enumerate(((0.034, 0.4, 0.0), (0.014, 0.24, 0.075))):
                a = math.radians(40)
                px, pz = cx + off * math.cos(a), cz_ - off * math.sin(a)
                cz.box(f'{name}_glint{i}{j}', (wd, 0.002, ln), (px, gy, pz), gm, rot=(0, 40, 0), bevel=0, ol=0,
                       parent=root)


# ---------------------------------------------------------------- outside
def _outside(cz, name, out, time, span, seed):
    lk = LOOK[time]
    rnd = random.Random(seed)
    cache = {}

    def gm(key, color, strength=1.0):
        k = (key, color, strength)
        if k not in cache: cache[k] = cz.glow(f'{name}_{key}{len(cache)}', color, strength)
        return cache[k]

    beacons = []
    # sky bowl: identical gradient facets (the centre one carries the sun / moon), lid and floor in the end colours
    Rs = D_SKY + C0; Ls = _half_len(D_SKY, span)
    n = max(3, int(round(2 * Ls / 1.33)) | 1)
    fwid = 2 * Ls / n
    sky = cz.screen(f'{name}_skym', f'assets/props/tex/window_city_sky_{time}.png', 1.0)
    skc = cz.screen(f'{name}_skycm', f'assets/props/tex/window_city_sky_{time}_c.png', 1.0)
    for i in range(n):
        s = -Ls + (i + 0.5) * fwid
        x, y, yaw = _path(D_SKY, span, s)
        chord = fwid if abs(s) <= span / 2 - fwid / 2 else 2 * Rs * math.sin(fwid / Rs / 2)
        cz.plane(f'{name}_sky{i}', chord * 1.02, Z_HI - Z_LO, (x, y, (Z_HI + Z_LO) / 2), skc if i == n // 2 else sky,
                 rot=(90, 0, yaw), parent=out)
    wx = span / 2 + Rs + 0.2
    cz.box(name + '_skylid', (2 * wx, D_SKY + 0.1, 0.02), (0, (D_SKY + 0.1) / 2 + 0.05, Z_HI + 0.01),
           gm('sk', sky_color(time, Z_HI)), bevel=0, ol=0, parent=out)
    cz.box(name + '_skyfloor', (2 * wx, D_SKY + 0.1, 0.02), (0, (D_SKY + 0.1) / 2 + 0.05, Z_LO - 0.01),
           gm('sk', sky_color(time, Z_LO)), bevel=0, ol=0, parent=out)
    _clouds(cz, name, out, time, span, random.Random(seed + 101), gm)
    for lay, P in LAYERS:
        _layer(cz, name, out, lay, P, lk, time, span, rnd, gm, beacons, seed)
    if lk['beacon']:
        bm = cz.glow(name + '_beaconm', lk['beacon'], 2.0)
        for i, (pv, x, z, r) in enumerate(beacons):
            cz.sphere(f'{name}_beacon{i}', r, (x, -0.05, z), bm, ol=0, parent=pv, segs=16, rings=8)


def _card(cz, nm, out, D, span, s, yo=0.0):
    x, y, yaw = _path(D, span, s)
    pv = cz.empty(nm, (x, y, 0), parent=out)
    pv.rotation_euler = (0, 0, math.radians(yaw))
    return pv


def _layer(cz, name, out, lay, P, lk, time, span, rnd, gm, beacons, seed):
    # rnd drives the layout only and is consumed identically for every time of day (same skyline at day / dusk /
    # night); which windows are lit comes from a per-card generator (lr)
    D, t, ol, bot = P['D'], P['t'], P['ol'], P['bot']
    L = _half_len(D, span)
    vis = P['vis'] + span / 2
    pal = lk[lay]; bcol = lk['base'][['near', 'mid', 'far'].index(lay)]
    ww, wh, px, pz = P['win']
    base_hi = P['base'][1]
    # low blocks: a continuous front row across the whole arc
    s, i = -L, 0
    while s < L:
        w = rnd.uniform(*P['bw']); top = rnd.uniform(*P['base'])
        pv = _card(cz, f'{name}_{lay}b{i}', out, D, span, s + w / 2)
        cz.box(pv.name + '_body', (w + 0.03, t, top - bot), (0, -0.06, (top + bot) / 2), gm('f', bcol), bevel=0, ol=ol,
               parent=pv)
        if lk['wlit'] and time == 'night':
            lr = random.Random(f'{seed}:{pv.name}')
            for k in range(lr.randint(1, 3)):
                bw_ = lr.uniform(0.08, 0.25); bx = lr.uniform(-w / 2 + bw_ / 2 + 0.03, w / 2 - bw_ / 2 - 0.03)
                bz = top - 0.06 - k * 0.09
                cz.box(f'{pv.name}_l{k}', (bw_, 0.004, 0.035), (bx, -0.06 - t / 2 - 0.003, bz),
                       gm('w', lk['wlit'], lk['ws']), bevel=0, ol=0, parent=pv)
        s += w; i += 1
    # towers
    s, i = -L + rnd.uniform(0.0, 0.25), 0
    radio_s = 0.55 if lay == 'mid' else None
    signs = []
    while s < L:
        w = rnd.uniform(*P['w']); sc = s + w / 2
        x = _path(D, span, sc)[0]
        u = min(1.0, abs(x) / vis)
        if radio_s is not None and abs(sc - radio_s) < 0.45:
            s = radio_s + 0.45; _radio(cz, f'{name}_radio', out, D, span, radio_s, lk, time, gm, beacons); radio_s = None
            continue
        if lay == 'near':     # a valley in the middle, tall towers framing the sides
            top = -0.8 + 1.35 * (u ** 1.3) + rnd.uniform(-0.12, 0.18)
        elif lay == 'mid':
            top = rnd.uniform(-0.62, 0.3) + (0.45 if rnd.random() < 0.18 else 0.0)
        else:
            top = rnd.uniform(-0.36, 0.42)
        top = max(top, base_hi + 0.12)
        style = rnd.choice({'near': ['grid', 'grid', 'cols'], 'mid': ['bands', 'grid', 'cols'],
                            'far': ['bands', 'dots']}[lay])
        shape = rnd.choice(['slab', 'slab', 'setback', 'crown', 'spire', 'dome'] if lay != 'far' else
                           ['slab', 'slab', 'setback', 'spire'])
        pv = _card(cz, f'{name}_{lay}{i}', out, D, span, sc)
        yo = rnd.choice((0.0, 0.05, 0.1))
        col = pal[int(rnd.random() * 997) % len(pal)]   # (palettes differ in length per time: keep rnd in step)
        _tower(cz, pv, w, top, bot, t, yo, ol, gm('f', col), shape, style, P, lk, time, rnd, gm, beacons, base_hi,
               random.Random(f'{seed}:{pv.name}'))
        side = 1 if x > 0 else -1
        if lay == 'near' and side not in signs and 0.25 < u < 0.75 and top > -0.15 and shape != 'setback':
            _sign(cz, pv, w, top, t, yo, time, len(signs), -side, gm); signs.append(side)
        s += w * rnd.uniform(0.7, 1.2); i += 1


SIGNS = [('#d9534f', '#ff5d8f'), ('#2f9fb0', '#3fe0e8'), ('#e0a13a', '#ffc24a')]


def _sign(cz, pv, w, top, t, yo, time, k, sx, gm):
    """A vertical shop sign sticking out of a tower's edge (sx: which edge): coloured box + three pale 'glyph'
    blocks (no text), high enough to show in the upper panes."""
    day, lit = SIGNS[k % len(SIGNS)]
    x = sx * (w / 2 + 0.015); z = top - 0.16; y = yo - t / 2 - 0.013
    sm = gm('f', day) if time == 'day' else gm('w', lit, 1.5)
    gc = gm('f', '#f4ead2') if time == 'day' else gm('w', '#fff2f6', 1.6)
    cz.box(pv.name + '_sign', (0.085, 0.02, 0.34), (x, y, z), sm, bevel=0, ol=0.003, parent=pv)
    for j in range(3):
        cz.box(f'{pv.name}_glyph{j}', (0.045, 0.004, 0.06 if j != 1 else 0.07), (x, y - 0.0125, z + 0.1 - j * 0.1), gc,
               bevel=0, ol=0, parent=pv)


def _tower(cz, pv, w, top, bot, t, yo, ol, fm, shape, style, P, lk, time, rnd, gm, beacons, base_hi, lr):
    nm = pv.name
    body_top = top
    tt = t * 0.85          # add-on pieces are a little thinner so their faces sit inside the body's (no z-fight)
    if shape == 'setback':
        h1 = top - rnd.uniform(0.18, 0.32)
        cz.box(nm + '_body', (w, t, h1 - bot), (0, yo, (h1 + bot) / 2), fm, bevel=0, ol=ol, parent=pv)
        w2 = w * rnd.uniform(0.55, 0.75)
        cz.box(nm + '_upper', (w2, t, top - h1 + 0.02), (0, yo + 0.004, (top + h1) / 2 - 0.01), fm, bevel=0, ol=ol, parent=pv)
        zones = [(w2, top, h1), (w, h1, base_hi)]
    else:
        cz.box(nm + '_body', (w, t, top - bot), (0, yo, (top + bot) / 2), fm, bevel=0, ol=ol, parent=pv)
        zones = [(w, top, base_hi)]
    if shape == 'crown':
        cw = w * rnd.uniform(0.3, 0.5); ch = rnd.uniform(0.06, 0.12)
        cz.box(nm + '_crown', (cw, tt, ch + 0.02), (rnd.uniform(-1, 1) * (w - cw) / 3, yo, top + ch / 2 - 0.01), fm,
               bevel=0, ol=ol, parent=pv)
        body_top = top + ch
    elif shape == 'spire':
        sh = rnd.uniform(0.18, 0.32)
        cz.box(nm + '_mast', (0.025, tt, sh + 0.02), (0, yo, top + sh / 2 - 0.01), fm, bevel=0, ol=min(ol, 0.003), parent=pv)
        beacons.append((pv, 0, top + sh + 0.012, 0.018))
        body_top = top + sh
    elif shape == 'dome':
        cz.cyl(nm + '_dome', w / 2, tt, (0, yo + tt / 2, top), fm, rot=(90, 0, 0), verts=32, ol=ol, parent=pv)
        body_top = top + w / 2
    if body_top > 0.5 and shape != 'spire' and rnd.random() < 0.7:
        beacons.append((pv, rnd.uniform(-0.3, 0.3) * w, body_top + 0.012, 0.016))
    # windows
    ww, wh, px, pz = P['win']
    fy = yo - t / 2 - 0.003
    lit = lk['lit']
    j = 0
    for zw, z0, z1 in zones:
        z0 -= pz * 0.6
        if style in ('grid', 'dots'):
            nc = max(1, int((zw - 0.06) / px)); x0 = -(nc - 1) * px / 2
            z = z0
            while z > z1 + wh / 2:
                for c in range(nc):
                    if style == 'dots' and lr.random() > 0.35: continue
                    wc = _wcol(lk, time, lr, lit)
                    if wc:
                        cz.box(f'{nm}_w{j}', (ww, 0.004, wh), (x0 + c * px, fy, z), gm('w', wc[0], wc[1]), bevel=0, ol=0,
                               parent=pv); j += 1
                z -= pz
        elif style == 'bands':
            z = z0
            while z > z1 + wh / 2:
                wc = _wcol(lk, time, lr, lit)
                if wc:
                    cz.box(f'{nm}_w{j}', (zw - 0.08, 0.004, wh * 0.8), (0, fy, z), gm('w', wc[0], wc[1]), bevel=0, ol=0,
                           parent=pv); j += 1
                z -= pz
        else:   # cols: vertical glass strips (lit at night as an LED facade on some)
            nc = max(2, int((zw - 0.05) / (px * 0.9))); x0 = -(nc - 1) * px * 0.9 / 2
            if time == 'night' and lr.random() < 0.5: continue
            for c in range(nc):
                wc = (lk['win'], lk['ws'] * 0.8) if lk['win'] else (lk['wcool'], 0.85)
                cz.box(f'{nm}_w{j}', (ww * 0.45, 0.004, z0 - z1), (x0 + c * px * 0.9, fy, (z0 + z1) / 2),
                       gm('w', wc[0], wc[1]), bevel=0, ol=0, parent=pv); j += 1


def _wcol(lk, time, rnd, lit):
    r = rnd.random()
    if time == 'day': return (lk['win'], lk['ws'])
    if r < lit: return (lk['wlit'], lk['ws'])
    if time == 'night':
        return (lk['wcool'], lk['ws'] * 0.9) if r < lit + 0.08 else None
    return (lk['win'], 1.0)


def _radio(cz, nm, out, D, span, s, lk, time, gm, beacons):
    """Generic lattice broadcast tower: tapering red/white legs, X braces, two decks, a striped mast."""
    pv = _card(cz, nm, out, D, span, s)
    yo = -0.03
    red, white = lk['radio']
    st = 1.0 if time == 'day' else 1.25
    mr, mw = gm('f', red, st), gm('f', white, st)
    zb, zt, xb, xt = -0.85, 1.05, 0.3, 0.05
    xl = lambda z: xb + (xt - xb) * (z - zb) / (zt - zb)
    nseg = 6
    zs = [zb + (zt - zb) * k / nseg for k in range(nseg + 1)]
    for k in range(nseg):
        za, zc = zs[k], zs[k + 1]
        for sx in (-1, 1):
            x0, x1 = sx * xl(za), sx * xl(zc)
            ln = math.hypot(x1 - x0, zc - za) + 0.01
            a = math.degrees(math.atan2(x1 - x0, zc - za))
            cz.box(f'{nm}_leg{"LR"[sx > 0]}{k}', (0.04, 0.025, ln), ((x0 + x1) / 2, yo, (za + zc) / 2),
                   mr if k % 2 == 0 else mw, rot=(0, a, 0), bevel=0, ol=0.003, parent=pv)
        for b, sx in enumerate((-1, 1)):    # X brace
            x0, x1 = sx * xl(za), -sx * xl(zc)
            ln = math.hypot(x1 - x0, zc - za)
            a = math.degrees(math.atan2(x1 - x0, zc - za))
            cz.box(f'{nm}_brace{k}{b}', (0.018, 0.012, ln), ((x0 + x1) / 2, yo + 0.012 + 0.004 * b, (za + zc) / 2), mw,
                   rot=(0, a, 0), bevel=0, ol=0.002, parent=pv)
    dl = lk['deck']
    for k, (zd, dw, dh) in enumerate(((0.12, 0.42, 0.1), (0.72, 0.22, 0.07))):
        cz.box(f'{nm}_deck{k}', (dw, 0.05, dh), (0, yo - 0.01, zd), mw, bevel=0, ol=0.004, parent=pv)
        cz.box(f'{nm}_deckwin{k}', (dw - 0.04, 0.004, dh * 0.4), (0, yo - 0.038, zd), gm('w', dl, 1.4 if time != 'day' else 1.0),
               bevel=0, ol=0, parent=pv)
    mz0, mz1 = zt - 0.02, zt + 0.55
    for k in range(3):
        za = mz0 + (mz1 - mz0) * k / 3
        cz.box(f'{nm}_mast{k}', (0.03, 0.02, (mz1 - mz0) / 3 + 0.005), (0, yo, za + (mz1 - mz0) / 6), mr if k % 2 == 0 else mw,
               bevel=0, ol=0.002, parent=pv)
    beacons.append((pv, 0, mz1 + 0.015, 0.022))


def _clouds(cz, name, out, time, span, rnd, gm):
    c = LOOK[time]['cloud']
    if not c: return
    D = 5.6
    m = gm('cl', c, 1.0)
    if time == 'day':
        spots = [(-4.6, 2.6, 1.0), (-2.3, 1.7, 0.8), (0.4, 2.9, 1.1), (2.6, 1.9, 0.85), (4.9, 2.7, 1.0)]
    else:
        spots = [(-3.8, 1.2, 1.2), (-1.0, 0.75, 1.0), (1.6, 1.45, 1.3), (4.2, 0.9, 1.0)]
    for i, (s, z, k) in enumerate(spots):
        pv = _card(cz, f'{name}_cloud{i}', out, D, span, s * (1 + span / 20))
        if time == 'day':   # puffy: a flat-bottomed bar + three bumps
            w = 1.1 * k
            cz.box(pv.name + '_base', (w, 0.02, 0.2 * k), (0, 0, z + 0.1 * k), m, bevel=0, ol=0, parent=pv)
            for j, (bx, br) in enumerate(((-0.3, 0.2), (0.02, 0.3), (0.32, 0.18))):
                cz.cyl(f'{pv.name}_p{j}', br * k, 0.02, (bx * w, 0.01 + 0.002 * j, z + 0.2 * k * 0.5 + br * k * 0.35), m,
                       rot=(90, 0, 0), verts=28, ol=0, parent=pv)
        else:               # dusk: long thin streaks with rounded ends
            w = 1.6 * k; h = 0.09 * k
            cz.box(pv.name + '_base', (w, 0.02, h), (0, 0, z), m, bevel=0, ol=0, parent=pv)
            for j, sx in enumerate((-1, 1)):
                cz.cyl(f'{pv.name}_e{j}', h / 2, 0.02, (sx * w / 2, 0.002, z), m, rot=(90, 0, 0), verts=20, ol=0, parent=pv)
            cz.box(pv.name + '_top', (w * 0.5, 0.02, h * 0.8), (rnd.uniform(-0.2, 0.2) * w, 0.004, z + h * 0.6), m,
                   bevel=0, ol=0, parent=pv)
