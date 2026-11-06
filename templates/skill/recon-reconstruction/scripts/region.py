# python region.py <project-dir> <name> --lat 47.269 --lon -122.5517 --half 7.5 [--layers coast,parks] [--zoom 13] [--water-level 0]
# One command for a real map of any place on Earth, as the reconstruction engine uses it (loadWorld / terrainMesh):
#  1. elevation: AWS Terrain Tiles (Terrarium PNG; SRTM, GMTED, ETOPO and others) over the square of `half` km around the centre
#  2. map layers: OpenStreetMap via the Overpass API (ODbL; several public mirrors, retried), only the layers you list
#     (PERIOD RULE: a story in 1940 lists no roads built later; land thinner than ~40 m, i.e. modern bridges, is removed)
#  3. bake: map.jpg (high-key clay relief), map_dark.jpg (the Investigation look's dark map), land_mask.png, height.bin,
#     map.json (+ aero.json with the aeroway layer) into <project>/assets/map/<name>/
# Raw downloads are cached in <project>/.suite/map-data/<name>/ (not in git). Layers: coast water rivers roads parks border aeroway.
import argparse, json, math, os, subprocess, sys, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('project'); ap.add_argument('name')
ap.add_argument('--lat', type=float, required=True); ap.add_argument('--lon', type=float, required=True)
ap.add_argument('--half', type=float, default=7.5, help='half the side of the square, km')
ap.add_argument('--layers', default='coast,water,rivers,roads,parks')
ap.add_argument('--zoom', type=int, default=13); ap.add_argument('--water-level', type=float, default=None)
a = ap.parse_args()
proj = os.path.abspath(a.project); data = os.path.join(proj, '.suite', 'map-data', a.name); os.makedirs(data, exist_ok=True)
layers = [l.strip() for l in a.layers.split(',') if l.strip()]
ky, kx = 110.57, 111.32 * math.cos(math.radians(a.lat)); m = 1.08                       # bbox a little larger than the bake
la0, la1 = a.lat - a.half * m / ky, a.lat + a.half * m / ky; lo0, lo1 = a.lon - a.half * m / kx, a.lon + a.half * m / kx

# 1. elevation
if not os.path.exists(os.path.join(data, 'elev.npz')):
    r = subprocess.run([sys.executable, os.path.join(HERE, 'fetch_terrain.py'), a.name, str(la0), str(lo0), str(la1), str(lo1), str(a.zoom)], cwd=os.path.join(proj, '.suite', 'map-data', '..'))
    if r.returncode: sys.exit('terrain download failed')
    os.replace(os.path.join(proj, '.suite', 'data', a.name, 'elev.npz'), os.path.join(data, 'elev.npz'))

# 2. OSM layers
Q = {
  'coast':  'way["natural"="coastline"]({b});',
  'water':  '(way["natural"="water"]({b});relation["natural"="water"]({b});way["waterway"="riverbank"]({b}););',
  'rivers': 'way["waterway"~"^(river|stream|canal)$"]({b});',
  'roads':  'way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"]({b});',
  'parks':  '(way["leisure"="park"]({b});way["landuse"="forest"]({b}););',
  'border': 'way["boundary"="administrative"]["admin_level"="2"]({b});',
  # an airport: runways, taxiways, aprons, terminals, hangars and gates (painted into the map, and aero.json for lib/maps.js)
  'aeroway': '(way["aeroway"~"^(runway|taxiway|apron|terminal|hangar)$"]({b});relation["aeroway"~"^(apron|terminal)$"]({b});node["aeroway"="gate"]({b}););',
}
MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
bbox = f'{la0},{lo0},{la1},{lo1}'
for l in layers:
    f = os.path.join(data, l + '.json')
    if os.path.exists(f) or l not in Q: continue
    body = urllib.parse.urlencode({'data': f'[out:json][timeout:120];{Q[l].format(b=bbox)}out geom;'}).encode()
    for attempt in range(6):
        url = MIRRORS[attempt % len(MIRRORS)]
        try:
            txt = urllib.request.urlopen(urllib.request.Request(url, data=body, headers={'User-Agent': 'Toon StudioSuite/recon (map research)'}), timeout=180).read()
            json.loads(txt); open(f, 'wb').write(txt); print(l, len(json.loads(txt)['elements']), 'elements'); break
        except Exception as e:
            print(l, 'retry', attempt + 1, url.split('/')[2], str(e)[:80]); time.sleep(4 + attempt * 4)
    else: sys.exit(f'OpenStreetMap layer {l} could not be downloaded (all mirrors failed)')

# 3. bake
cfg = {'lat0': a.lat, 'lon0': a.lon, 'half': a.half, 'layers': [l for l in layers if l != 'coast'], 'coast': 'coast' in layers}
if a.water_level is not None: cfg['water_level'] = a.water_level
r = subprocess.run([sys.executable, os.path.join(HERE, 'bake_region.py'), a.name, '--config', json.dumps(cfg), '--data', data, '--out', os.path.join(proj, 'assets', 'map', a.name)])
sys.exit(r.returncode)
