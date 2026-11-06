# python tools/bake_region.py <region>   -> src/assets/map/<region>/{map.jpg, map_dark.jpg, land_mask.png, height.bin, map.json, aero.json}
# Any place on Earth as a high-key clay map (map.jpg) and a dark one for the Investigation look (map_dark.jpg), with real
# relief. Inputs (data/<region>/): elev.npz (tools/fetch_terrain.py), coast.json (OSM natural=coastline, optional), water.json /
# rivers.json / roads.json / parks.json / border.json / aeroway.json (Overpass "out geom", all optional; aeroway also
# writes aero.json: runways, taxiways, aprons, terminals, hangars, gates in map km). OSM data (c) OpenStreetMap contributors, ODbL.
# Projection (km): x = (lon - lon0) * kx, y = (lat - lat0) * ky, kx = 111.32 cos(lat0), ky = 110.57.
# PERIOD RULE: a region config lists only the layers that existed at the time of the story (Tacoma 1940: no roads).
import json, math, os, struct, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

REGIONS = {
    # centre = the story's focal point; half = half the square extent in km
    'tacoma':   dict(lat0=47.2690, lon0=-122.5517, half=7.5, layers=['parks'], coast=True, water_level=0),
    'thaicave': dict(lat0=20.3817, lon0=99.8681, half=9.0, layers=['water', 'rivers', 'roads', 'border'], coast=False),
}
region = sys.argv[1]
# standalone: a REGIONS entry, data/<region>, src/assets/map/<region>; from region.py: --config JSON --data DIR --out DIR
arg = lambda k: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else None
R = json.loads(arg('--config')) if arg('--config') else REGIONS[region]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DD = arg('--data') or os.path.join(HERE, 'data', region); OUT = arg('--out') or os.path.join(HERE, 'src', 'assets', 'map', region); os.makedirs(OUT, exist_ok=True)
def D(name):
    if name != 'coast' and name not in R['layers']: return []          # PERIOD RULE: only the layers this region lists
    f = os.path.join(DD, name + '.json')
    if not os.path.exists(f): return []
    try: return json.load(open(f, encoding='utf-8'))['elements']
    except Exception: print('unreadable', name); return []
lat0, lon0, half = R['lat0'], R['lon0'], R['half']; kx, ky = 111.32 * math.cos(math.radians(lat0)), 110.57
X0, X1, Y0, Y1 = -half, half, -half, half; N = 4096
P = lambda lat, lon: ((lon - lon0) * kx, (lat - lat0) * ky)
px = lambda x, y: ((x - X0) / (X1 - X0) * N, (Y1 - y) / (Y1 - Y0) * N)
pts = lambda g: [px(*P(q['lat'], q['lon'])) for q in g]

# ---------- elevation resampled onto the map grid ----------
E = np.load(os.path.join(DD, 'elev.npz')); h = E['h']; eh, ew = h.shape
def elev_grid(n):
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    x = X0 + (xx + .5) / n * (X1 - X0); y = Y1 - (yy + .5) / n * (Y1 - Y0)
    lon = lon0 + x / kx; lat = lat0 + y / ky
    # elev.npz grid is Web-Mercator rows (north->south): map lat through mercator y
    my = lambda la: math.asinh(math.tan(math.radians(la)))
    m0, m1 = my(float(E['lat1'])), my(float(E['lat0']))
    r = (np.arcsinh(np.tan(np.radians(lat))) - m0) / (m1 - m0) * (eh - 1)
    c = (lon - float(E['lon0'])) / (float(E['lon1']) - float(E['lon0'])) * (ew - 1)
    return ndimage.map_coordinates(h, [r, c], order=1, mode='nearest')
hN = elev_grid(N)

# ---------- water ----------
water = np.zeros((N, N), bool)
if R.get('coast'):
    # each pixel takes the side of its nearest coastline segment (OSM: land on the left), see bake_map.py
    M = 2048; sc = M / N; segs = []
    for e in D('coast'):
        if e['type'] != 'way' or 'geometry' not in e: continue
        p = [(x * sc, y * sc) for x, y in pts(e['geometry'])]; segs += [(a, b) for a, b in zip(p, p[1:]) if a != b]
    ids = Image.new('I', (M, M), 0); idd = ImageDraw.Draw(ids)
    for i, (a, b) in enumerate(segs): idd.line([a, b], fill=i + 1, width=2)
    ID = np.array(ids); _, (iy, ix) = ndimage.distance_transform_edt(ID == 0, return_indices=True); seg = ID[iy, ix] - 1
    S = np.array(segs, np.float32); ax, ay, bx, by = S[seg, 0, 0], S[seg, 0, 1], S[seg, 1, 0], S[seg, 1, 1]
    gy, gx = np.mgrid[0:M, 0:M].astype(np.float32)
    cross = (bx - ax) * (gy - ay) - (by - ay) * (gx - ax); tt = ((gx - ax) * (bx - ax) + (gy - ay) * (by - ay)) / np.maximum((bx - ax) ** 2 + (by - ay) ** 2, 1e-6)
    ws = cross > 0; unsure = ((tt < -.02) | (tt > 1.02)) & (ndimage.distance_transform_edt(ID == 0) > 2)
    _, (uy, ux) = ndimage.distance_transform_edt(unsure, return_indices=True); ws = ws[uy, ux]
    water = np.array(Image.fromarray((ws * 255).astype(np.uint8)).resize((N, N), Image.BILINEAR)) > 127
    # sanity: the lowest elevation cells are water; flip if the handedness came out reversed
    if hN[water].mean() > hN[~water].mean(): water = ~water
wi = Image.new('L', (N, N), 0); wd = ImageDraw.Draw(wi)
for e in D('water'):
    geoms = [e['geometry']] if e['type'] == 'way' and 'geometry' in e else [m['geometry'] for m in e.get('members', []) if m.get('role') == 'outer' and 'geometry' in m]
    for g in geoms:
        if len(g) > 2: wd.polygon(pts(g), fill=255)
W_RIV = {'river': 14, 'stream': 4}
for e in D('rivers'):
    if 'geometry' in e: wd.line(pts(e['geometry']), fill=255, width=W_RIV.get(e['tags'].get('waterway'), 3))
water |= np.array(wi) > 0
land = ~water
# remove land thinner than ~40 m (modern bridge decks and piers in the coastline/elevation data: anachronisms for 1940)
k = max(1, int(.02 / ((X1 - X0) / N)))
land = ndimage.binary_opening(land, iterations=k); water = ~land

# ---------- paint: high-key land with soft hillshade + elevation tint ----------
hS = ndimage.gaussian_filter(hN.astype(np.float32), sigma=max(2, N / ((X1 - X0) / .03)))     # ~30 m smoothing: radar noise on flat ground must not read as texture
gyy, gxx = np.gradient(hS, (X1 - X0) * 1000 / N)          # metres per metre
lx, ly, lz = -.6, .55, .58                                                    # light from the north-west
shade = (-gxx * lx - (-gyy) * ly + lz) / np.sqrt(gxx ** 2 + gyy ** 2 + 1)
shade = (shade - lz) * 1.6                                                    # 0 on flat ground
hn = (hN - hN[land].min()) / max(1, np.ptp(hN[land])) if land.any() else hN * 0
del hS, gyy, gxx
C = lambda c: np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)], np.float32)
dist_w = ndimage.distance_transform_edt(water); band = np.clip(1 - dist_w / 60, 0, 1) * water; del dist_w
yy, xx = np.mgrid[0:N, 0:N]; fade = np.clip(np.minimum(np.minimum(xx, N - 1 - xx), np.minimum(yy, N - 1 - yy)) / (N * .08), 0, 1) ** 1.5; del yy, xx

# ---------- aeroway (an airport; region.py --layers ...,aeroway): vectors for lib/maps.js + painted into both maps ----------
AERO = {'runway': [], 'taxiway': [], 'apron': [], 'terminal': [], 'hangar': [], 'gate': []}
MPP = (X1 - X0) * 1000 / N                                                     # metres per map pixel
km = lambda q: [round(v, 4) for v in P(q['lat'], q['lon'])]
for e in D('aeroway'):
    t = e.get('tags', {}); k = t.get('aeroway')
    if e.get('type') == 'node':
        if k == 'gate' and 'lat' in e: AERO['gate'].append({'ref': t.get('ref') or t.get('name'), 'p': km(e)})
        continue
    if k not in AERO: continue
    rings = [e['geometry']] if e.get('type') == 'way' and 'geometry' in e else [m['geometry'] for m in e.get('members', []) if m.get('role') in ('outer', '') and 'geometry' in m]
    for g in rings:
        if len(g) < 2: continue
        closed = len(g) > 3 and g[0]['lat'] == g[-1]['lat'] and g[0]['lon'] == g[-1]['lon']
        try: w = float(str(t.get('width', '')).replace('m', '').strip())
        except ValueError: w = None
        AERO[k].append({'name': t.get('name') or t.get('ref'), 'w': w, 'area': bool(closed and (k != 'taxiway' and (k != 'runway' or t.get('area') == 'yes'))), 'p': [km(q) for q in g]})
def dashes(dr, pp, on, off, fill, width):                                      # a dashed polyline (pixels), dash lengths in pixels
    run, draw = 0.0, True
    for (ax, ay), (bx, by) in zip(pp, pp[1:]):
        L = math.hypot(bx - ax, by - ay); s = 0.0
        while s < L:
            step = min((on if draw else off) - run, L - s); s2 = s + step
            if draw: dr.line([(ax + (bx - ax) * s / L, ay + (by - ay) * s / L), (ax + (bx - ax) * s2 / L, ay + (by - ay) * s2 / L)], fill=fill, width=width)
            run += step; s = s2
            if run >= (on if draw else off) - 1e-6: run, draw = 0.0, not draw
def paint_aero(dr, pal):
    pix = lambda p: [px(x, y) for x, y in p]
    for a in AERO['apron']:
        if a['area']: dr.polygon(pix(a['p']), fill=pal['apron'])
    for a in AERO['taxiway']: dr.line(pix(a['p']), fill=pal['taxiway'], width=max(2, round(23 / MPP)), joint='curve')
    for a in AERO['runway']:
        if a['area']: dr.polygon(pix(a['p']), fill=pal['runway']); continue
        w = max(3, round((a['w'] or 45) / MPP)); pp = pix(a['p'])
        dr.line(pp, fill=pal['edge'], width=w + 2, joint='curve'); dr.line(pp, fill=pal['runway'], width=w, joint='curve')
        dashes(dr, pp, max(3, 30 / MPP), max(2, 20 / MPP), pal['mark'], max(1, round(1.5 / MPP + .5)))     # the white centreline (30 m dashes, 20 m gaps)
    for a in AERO['hangar']:
        if a['area']: dr.polygon(pix(a['p']), fill=pal['hangar'], outline=pal['outline'])
    for a in AERO['terminal']:
        if a['area']: dr.polygon(pix(a['p']), fill=pal['terminal'], outline=pal['outline'])

# two looks of the same place: map.jpg (Studio: high-key clay) and map_dark.jpg (Investigation: dark land, light roads and
# runways, so the place reads at a glance on the dark look; lib/world.js picks it by the theme)
LOOKS = {
    'map.jpg': dict(land='#e2e1dc', tint=.05, shade=(-.3, .12, .32), water='#b7c4cf', band='#9eb0bf', park=(200, 210, 190, 140), road=(250, 250, 248, 255),
                    border=(120, 124, 130, 200), bg='#dadad6',
                    aero=dict(apron=(206, 206, 201, 255), taxiway=(194, 194, 189, 255), runway=(168, 168, 164, 255), edge=(238, 238, 234, 255),
                              mark=(252, 252, 250, 255), hangar=(184, 184, 179, 255), terminal=(146, 148, 152, 255), outline=(110, 112, 116, 255))),
    'map_dark.jpg': dict(land='#2a2c30', tint=.12, shade=(-.28, .16, .38), water='#10161d', band='#1c2731', park=(44, 56, 46, 150), road=(120, 124, 130, 255),
                         border=(112, 116, 122, 210), bg='#07080a',
                         aero=dict(apron=(62, 64, 68, 255), taxiway=(88, 90, 94, 255), runway=(126, 128, 132, 255), edge=(192, 194, 198, 255),
                                   mark=(240, 240, 236, 255), hangar=(52, 54, 58, 255), terminal=(20, 21, 24, 255), outline=(150, 154, 160, 255))),
}
for fname, L in LOOKS.items():
    lo, hi, amp = L['shade']
    img = C(L['land'])[None, None] * (1 + L['tint'] * hn[..., None]) + 255 * np.clip(shade, lo, hi)[..., None] * amp     # highlights never clip
    img[water] = C(L['water'])
    img = img * (1 - band[..., None] * .2) + C(L['band']) * band[..., None] * .2
    im = Image.fromarray(img.clip(0, 255).astype(np.uint8)); del img; dr = ImageDraw.Draw(im, 'RGBA')
    for e in D('parks'):
        if 'geometry' in e and len(e['geometry']) > 2: dr.polygon(pts(e['geometry']), fill=L['park'])
    for e in D('roads'):
        if 'geometry' not in e: continue
        w = {'trunk': 7, 'primary': 6, 'secondary': 4, 'tertiary': 3}.get(e['tags'].get('highway'), 3)
        dr.line(pts(e['geometry']), fill=L['road'], width=w)
    paint_aero(dr, L['aero'])
    for e in D('border'):
        if e.get('type') == 'way' and 'geometry' in e: dr.line(pts(e['geometry']), fill=L['border'], width=5)
        for m in e.get('members', []):
            if 'geometry' in m and m.get('type') == 'way': dr.line(pts(m['geometry']), fill=L['border'], width=5)
    arr = np.array(im).astype(np.float32); bg = C(L['bg'])
    Image.fromarray((arr * fade[..., None] + bg * (1 - fade[..., None])).astype(np.uint8)).save(os.path.join(OUT, fname), quality=90); del arr, im
if any(AERO.values()): json.dump(AERO, open(os.path.join(OUT, 'aero.json'), 'w'))
Image.fromarray((land * 255).astype(np.uint8)).resize((2048, 2048), Image.LANCZOS).save(os.path.join(OUT, 'land_mask.png'))

# ---------- height grid (int16 metres), water flattened to the water level ----------
G = 512; hG = elev_grid(G); landG = np.array(Image.fromarray((land * 255).astype(np.uint8)).resize((G, G), Image.BILINEAR)) > 127
wl = R.get('water_level', None)
if wl is not None: hG = np.where(landG, np.maximum(hG, wl + 1), wl - 10)     # seabed 10 m under the water plane: never coplanar with it
open(os.path.join(OUT, 'height.bin'), 'wb').write(np.round(hG).astype('<i2').tobytes())
json.dump({'lat0': lat0, 'lon0': lon0, 'kx': kx, 'ky': ky, 'extent': [X0, X1, Y0, Y1], 'size': N, 'texture': 'map.jpg', 'textureDark': 'map_dark.jpg',
           **({'aero': 'aero.json'} if any(AERO.values()) else {}),
           'height': {'n': G, 'min': float(hG.min()), 'max': float(hG.max())}, 'buildings': 0,
           'attribution': '(c) OpenStreetMap contributors, ODbL; elevation: AWS Terrain Tiles (SRTM and others)'}, open(os.path.join(OUT, 'map.json'), 'w'))
print(region, 'water %.2f' % water.mean(), 'height %.0f..%.0f m' % (hG.min(), hG.max()))
