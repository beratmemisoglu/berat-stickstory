# The camera's motion curves in the picture, ours vs the reference, for one frame range - the target a builder matches
# (pan x / pan y in % of frame per frame, zoom %/f, roll deg/f; measure.py's per-frame similarity transforms):
#   .venv/Scripts/python.exe tools/camcurve.py <ours measure.json | ours frames dir> <ref measure.json> <f0> <f1> <out.png>
# Ours can be a frame folder (a shot's render): it is measured on the fly (ORB, like measure.py).
import json, os, sys
import numpy as np, cv2

def from_json(p, f0, f1):
    F = {f['f']: f for f in json.load(open(p))['frames']}
    D0 = {'tx': 0, 'ty': 0, 'zoom': 1, 'rot': 0}   # a frame the json lacks = no motion (zoom 1, not 0: builder D)
    return np.array([[F.get(f, {}).get(k, D0[k]) or D0[k] for k in ('tx', 'ty', 'zoom', 'rot')] for f in range(f0, f1 + 1)])

def from_dir(d, f0, f1):
    orb = cv2.ORB_create(1500); bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    out, prev = [], None
    for f in range(f0, f1 + 1):
        p = os.path.join(d, f'{f:04d}.png')
        if not os.path.exists(p): p = os.path.join(d, f'{f:04d}.jpg')
        g = cv2.imread(p, cv2.IMREAD_GRAYSCALE)
        g = cv2.resize(g, (360, int(g.shape[0] * 360 / g.shape[1])))
        k, ds = orb.detectAndCompute(g, None)
        row = [0, 0, 1, 0]
        if prev is not None and ds is not None and prev[1] is not None:
            ms = bf.match(prev[1], ds)
            if len(ms) > 20:
                a = np.float32([prev[0][m.queryIdx].pt for m in ms]); b = np.float32([k[m.trainIdx].pt for m in ms])
                M, inl = cv2.estimateAffinePartial2D(a, b)
                if inl is not None and int(inl.sum()) < 40: M = None   # a cut: two different views matched by chance (builder C) - no motion read
                if M is not None:
                    s = float(np.hypot(M[0, 0], M[1, 0]))
                    row = [M[0, 2] / g.shape[1] * 100, M[1, 2] / g.shape[0] * 100, s, float(np.degrees(np.arctan2(M[1, 0], M[0, 0])))]
        out.append(row); prev = (k, ds)
    return np.array(out)

src, ref, f0, f1, outp = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
if os.path.isdir(src):     # measure the folder exactly like the reference was measured (zoom centred, cuts dropped)
    import subprocess, tempfile
    tj = os.path.join(tempfile.gettempdir(), f'camcurve_{os.getpid()}.json')
    subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'measure_dir.py'), src, str(f0), str(f1), tj], check=True)
    O = from_json(tj, f0, f1)
else: O = from_json(src, f0, f1)
R = from_json(ref, f0, f1)
names = ['pan x %/f', 'pan y %/f', 'zoom %/f', 'roll deg/f']
W, H = 900, 180
img = np.full((H * 4, W, 3), 255, np.uint8)
for i in range(4):
    a = O[:, i].copy(); b = R[:, i].copy()
    if i == 2: a, b = (a - 1) * 100, (b - 1) * 100
    lim = max(1e-3, np.percentile(np.abs(np.concatenate([a, b])), 98)) * 1.15
    y0 = i * H + H // 2
    cv2.line(img, (0, y0), (W, y0), (220, 220, 220), 1)
    for arr, colr in ((b, (60, 60, 60)), (a, (30, 120, 255))):
        pts = [(int(j * (W - 1) / max(1, len(arr) - 1)), int(y0 - arr[j] / lim * (H // 2 - 8))) for j in range(len(arr))]
        cv2.polylines(img, [np.array(pts, np.int32)], False, colr, 2)
    cv2.putText(img, f'{names[i]}  (grey = reference, orange = ours)  +-{lim:.2f}', (8, i * H + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
cv2.putText(img, f'frames {f0}-{f1}', (W - 150, H * 4 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
cv2.imwrite(outp, img)
err = float(np.mean(np.abs(O[:, :2] - R[:, :2]))) + float(np.mean(np.abs((O[:, 2] - R[:, 2]) * 100)))
print(f'CAMCURVE {f0}-{f1} mean abs difference {err:.3f} (pan %/f + zoom %/f) -> {outp}')
