# python tools/fetch_terrain.py <region> <lat_min> <lon_min> <lat_max> <lon_max> [zoom]
# Real elevation from the AWS Terrain Tiles open dataset (Terrarium PNG: h = R*256 + G + B/256 - 32768 metres; sources
# SRTM / GMTED / ETOPO and others, see https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
# Writes data/<region>/elev.npz: { h: float32 grid (rows = north->south), lat0, lat1, lon0, lon1 }.
import sys, math, io, os, urllib.request
import numpy as np
from PIL import Image
region, la0, lo0, la1, lo1 = sys.argv[1], *map(float, sys.argv[2:6]); z = int(sys.argv[6]) if len(sys.argv) > 6 else 13
def tile(lat, lon):
    n = 2 ** z; x = (lon + 180) / 360 * n; y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n; return x, y
x0, y1 = tile(la0, lo0); x1, y0 = tile(la1, lo1)
tx0, tx1, ty0, ty1 = int(x0), int(x1), int(y0), int(y1)
W = (tx1 - tx0 + 1) * 256; H = (ty1 - ty0 + 1) * 256; mosaic = np.zeros((H, W), np.float32)
for ty in range(ty0, ty1 + 1):
    for tx in range(tx0, tx1 + 1):
        url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{tx}/{ty}.png'
        im = np.array(Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Toon StudioResearch/1.0'})).read())).convert('RGB')).astype(np.float32)
        mosaic[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768
# crop to the bbox (pixel coords inside the mosaic)
px0, px1 = int((x0 - tx0) * 256), int((x1 - tx0) * 256); py0, py1 = int((y0 - ty0) * 256), int((y1 - ty0) * 256)
h = mosaic[py0:py1, px0:px1]
os.makedirs(os.path.join('data', region), exist_ok=True)
np.savez_compressed(os.path.join('data', region, 'elev.npz'), h=h, lat0=la0, lat1=la1, lon0=lo0, lon1=lo1)
print(region, 'zoom', z, 'grid', h.shape, 'min %.0f max %.0f m' % (h.min(), h.max()))
