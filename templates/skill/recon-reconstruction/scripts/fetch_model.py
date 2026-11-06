# python fetch_model.py <project> <url> <file.glb> --title "..." --author "..." --license "CC0 1.0" --source "<page url>" [--notes "..."]
# Downloads one free 3D model (or texture) into <project>/assets/models/<file> and records its credit in
# assets/models/CREDITS.json (the video description names every artist from it). Refuses licences that are not
# CC0 / public domain / CC-BY (no NC, no ND, no "editorial", no unclear terms) and files that are not glTF binary / gltf /
# jpg / png. Check the licence on the model's own page before you run this (the site default is not enough).
import argparse, json, os, sys, urllib.request
ap = argparse.ArgumentParser()
ap.add_argument('project'); ap.add_argument('url'); ap.add_argument('file')
for k in ['title', 'author', 'license', 'source']: ap.add_argument('--' + k, required=True)
ap.add_argument('--notes', default='')
a = ap.parse_args()
lic = a.license.upper().replace('-', ' ')
ok = any(x in lic for x in ['CC0', 'PUBLIC DOMAIN', 'CC BY']) and not any(x in lic for x in [' NC', ' ND', 'NONCOMMERCIAL', 'NODERIV', 'EDITORIAL'])
if not ok: sys.exit(f'Licence "{a.license}" is not allowed: only CC0, public domain or CC-BY (no NC / ND).')
ext = os.path.splitext(a.file)[1].lower()
if ext not in ('.glb', '.gltf', '.bin', '.jpg', '.jpeg', '.png'): sys.exit('Only .glb / .gltf (+ .bin) / .jpg / .png files.')
d = os.path.join(os.path.abspath(a.project), 'assets', 'models'); os.makedirs(d, exist_ok=True)
out = os.path.join(d, a.file)
data = urllib.request.urlopen(urllib.request.Request(a.url, headers={'User-Agent': 'Toon StudioSuite/recon (free 3D models)'}), timeout=180).read()
if ext == '.glb' and data[:4] != b'glTF': sys.exit('Not a binary glTF file (the URL returned something else, e.g. a web page). Find the direct download link.')
if len(data) > 40e6: sys.exit(f'{len(data) / 1e6:.0f} MB is too big for a scene asset (limit 40 MB): pick a lighter model.')
open(out, 'wb').write(data)
cf = os.path.join(d, 'CREDITS.json')
cr = json.load(open(cf, encoding='utf-8')) if os.path.exists(cf) else []
cr = [c for c in cr if c.get('file') != a.file] + [{'file': a.file, 'title': a.title, 'author': a.author, 'license': a.license, 'source_url': a.source, 'download_url': a.url, 'notes': a.notes}]
json.dump(cr, open(cf, 'w', encoding='utf-8'), indent=1)
print(f'saved assets/models/{a.file} ({len(data) / 1e6:.1f} MB), credit recorded ({len(cr)} models credited)')
