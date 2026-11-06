# Measure a frame folder like tools/measure.py does (from builder D, 2026-10-27; camcurve uses it for frame folders):
# the frame centre is not counted as pan) and write a measure-style json camcurve.py can read.
#   .venv/Scripts/python.exe tools/measure_dir.py <frames dir> f0 f1 <out.json>
# (camcurve's own from_dir leaves the zoom-about-origin term in tx/ty, so every push-in reads as a pan up-left.)
import json, os, sys
import numpy as np, cv2
d, f0, f1, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
orb = cv2.ORB_create(1500); bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
W = 360; prev = None; fr = []
for f in range(f0, f1 + 1):
    p = os.path.join(d, f'{f:04d}.png')
    if not os.path.exists(p): p = os.path.join(d, f'{f:04d}.jpg')
    g = cv2.imread(p, cv2.IMREAD_GRAYSCALE); h = int(g.shape[0] * W / g.shape[1]); g = cv2.resize(g, (W, h), interpolation=cv2.INTER_AREA)
    k, ds = orb.detectAndCompute(g, None)
    rec = {'f': f, 'zoom': 1.0, 'tx': 0.0, 'ty': 0.0, 'rot': 0.0}
    if prev is not None and ds is not None and prev[1] is not None:
        ms = sorted(bf.match(prev[1], ds), key=lambda x: x.distance)[:400]
        if len(ms) > 20:
            a = np.float32([prev[0][m.queryIdx].pt for m in ms]); b = np.float32([k[m.trainIdx].pt for m in ms])
            M, inl = cv2.estimateAffinePartial2D(a, b, method=cv2.RANSAC, ransacReprojThreshold=2.0)
            if M is not None and int(inl.sum()) >= 12:   # < 12 inliers = measure.py's cut test: no camera transform there
                sc = float(np.hypot(M[0, 0], M[1, 0]))
                tx, ty = M[0, 2] + (sc - 1) * W / 2, M[1, 2] + (sc - 1) * h / 2
                rec.update(zoom=sc, tx=tx / W * 100, ty=ty / h * 100, rot=float(np.degrees(np.arctan2(M[1, 0], M[0, 0]))))
    fr.append(rec); prev = (k, ds)
json.dump({'frames': fr}, open(out, 'w'))
print('MEASURED', len(fr), out)
