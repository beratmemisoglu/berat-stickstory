# Sky panoramas for assets/props/night_sky.py (run with the lab venv):
#   .venv/Scripts/python.exe assets/props/tex/make_night_sky.py
# night_sky_<night|dawn>.png: the whole 160-degree arc (x = azimuth -80..80, y = z 26..-4 m): the gradient, painted
# faint stars + the moon halo (night) / the sun glow (dawn), cloud streaks, a far and a near range of rounded karst
# peaks with mist at their feet and a lit rim on the near range.
import math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import night_sky as S   # noqa: E402

W, H = S.IMG_W, S.IMG_H
PPM = W / (S.R * math.radians(S.ARC))          # pixels per metre (both axes)

LOOK = {
    'night': dict(grad=[(-4, '#2c3b78'), (0.5, '#34478a'), (4, '#2a3a7c'), (10, '#1c2860'), (18, '#121a48'), (26, '#0a0f30')],
                  far='#24326a', far_mist='#3a4c8c', near='#161f45', near_rim='#2f3f78', near_mist='#2c3b74',
                  cloud='#30407e', cloud_hi='#4c5d9c', glow=('#8e9fdc', 0.5, 4.6), glow2=('#5d6fb4', 0.35, 9.0)),
    'dawn': dict(grad=[(-4, '#ffd29a'), (0.5, '#ffc790'), (3, '#ffb08a'), (8, '#f48f98'), (15, '#c785b4'), (26, '#8a82c6')],
                 far='#c58fa4', far_mist='#f4b3a2', near='#93688f', near_rim='#d7959c', near_mist='#e7a39f',
                 cloud='#ffd7a4', cloud_hi='#f5a8a9', glow=('#fff1c2', 0.9, 4.5), glow2=('#ffd59a', 0.55, 11.0)),
}


def rgb(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)


def row_z(r): return S.Z1 - (r + 0.5) / H * (S.Z1 - S.Z0)


def x_of(az): return (az + S.ARC / 2) / S.ARC * W


def y_of(z): return (S.Z1 - z) / (S.Z1 - S.Z0) * H


def gradient(stops):
    z = np.array([row_z(r) for r in range(H)])
    out = np.zeros((H, 3), np.float32)
    for (z0, c0), (z1, c1) in zip(stops, stops[1:]):
        m = (z >= z0) & (z <= z1)
        k = (z[m] - z0) / (z1 - z0); k = k * k * (3 - 2 * k)
        out[m] = rgb(c0) * (1 - k[:, None]) + rgb(c1) * k[:, None]
    out[z < stops[0][0]] = rgb(stops[0][1]); out[z > stops[-1][0]] = rgb(stops[-1][1])
    return np.repeat(out[:, None, :], W, axis=1)


def glow(img, az, z, color, peak, radius_m, squash=1.0):
    cx, cy = x_of(az), y_of(z)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d2 = ((xx - cx) ** 2 + ((yy - cy) / squash) ** 2) / (radius_m * PPM) ** 2
    a = (peak * np.exp(-d2))[..., None]
    img[:] = img * (1 - a) + rgb(color) * a


def profile(rnd, peaks, base, base_amp, hmin, hmax, wmin, wmax, step):
    """Height (m) of a mountain range for every pixel column: rounded karst peaks over a rolling base."""
    az = np.array([(x + 0.5) / W * S.ARC - S.ARC / 2 for x in range(W)])
    xm = az / S.ARC * (S.R * math.radians(S.ARC))      # metres along the arc
    p = base + base_amp * np.sin(xm * 0.21 + rnd.uniform(0, 6)) + 0.4 * base_amp * np.sin(xm * 0.53 + rnd.uniform(0, 6))
    x = -S.R * math.radians(S.ARC) / 2
    while x < S.R * math.radians(S.ARC) / 2:
        h = rnd.uniform(hmin, hmax); w = rnd.uniform(wmin, wmax)
        if rnd.random() < peaks:
            t = np.clip(np.abs(xm - x) / w, 0, 1)
            p = np.maximum(p, h * (1 - t ** 1.8) ** 0.85)
        x += rnd.uniform(step * 0.6, step * 1.3)
    return p


def fill_range(img, prof, color, mist, mist_h, z_floor=None, rim=None):
    col = rgb(color); mc = rgb(mist)
    zr = np.array([row_z(r) for r in range(H)])[:, None]
    m = zr <= prof[None, :]
    # mist: the range fades toward the mist colour near its feet
    k = np.clip(1 - (zr - (z_floor if z_floor is not None else 0.0)) / mist_h, 0, 1) ** 1.5
    c = col[None, None, :] * (1 - 0.65 * k[..., None]) + mc[None, None, :] * (0.65 * k[..., None])
    img[:] = np.where(m[..., None], c, img)
    if rim:   # a lit rim along the top edge (3-4 px)
        rc = rgb(rim)
        top = np.array([y_of(h) for h in prof])
        for x in range(W):
            y0 = int(round(top[x]))
            img[max(0, y0):max(0, y0) + 4, x] = rc


def cloud(d, az, z, length, thick, col, hi):
    """Stylised flat-bottomed cloud streak with two or three bumps; lit top edge."""
    x0, x1 = x_of(az - length / 2), x_of(az + length / 2); y = y_of(z); t = thick * PPM
    # two-tone: a light body (bar + bumps), a darker flat underside band
    d.rounded_rectangle([x0, y - t / 2, x1, y + t / 2], radius=t / 2, fill=hi)
    for k, (f, s) in enumerate(((0.3, 1.0), (0.55, 1.4), (0.75, 0.9))):
        cx = x0 + (x1 - x0) * f; r = t * 0.75 * s
        d.ellipse([cx - r, y - t / 2 - r * 0.9, cx + r, y + t * 0.3], fill=hi)
    d.rounded_rectangle([x0, y + t * 0.02, x1, y + t / 2], radius=t * 0.24, fill=col)


def make(time):
    L = LOOK[time]; rnd = random.Random(21)
    img = gradient(L['grad'])
    if time == 'night':
        maz, mz, mr = S.MOON
        glow(img, maz, mz, *L['glow2']); glow(img, maz, mz, *L['glow'])
    else:
        glow(img, -18, 1.0, L['glow2'][0], L['glow2'][1], L['glow2'][2], squash=0.55)
        glow(img, -18, 1.5, L['glow'][0], L['glow'][1], L['glow'][2])
    img += np.random.default_rng(3).uniform(-1.6, 1.6, img.shape).astype(np.float32)   # dither: no 8-bit banding
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    if time == 'night':   # faint painted stars (the bright ones are geometry in front)
        for i in range(1400):
            az = rnd.uniform(-80, 80); z = 3 + (S.Z1 - 3) * rnd.random() ** 0.7
            if math.hypot(az - S.MOON[0], (z - S.MOON[1]) * 2.6) < 13: continue
            x, y = x_of(az), y_of(z); r = rnd.choice((1.0, 1.2, 1.5, 2.0))
            b = rnd.uniform(0.35, 0.85) * min(1.0, (z - 3) / 6)
            c = tuple(int(v) for v in (rgb('#1a2458') * (1 - b) + rgb('#e8ecff') * b))
            d.ellipse([x - r, y - r, x + r, y + r], fill=c)
    # clouds
    ccol = tuple(int(v) for v in rgb(L['cloud'])); chi = tuple(int(v) for v in rgb(L['cloud_hi']))
    spots = ([(-52, 12.5, 26, 0.9), (-14, 17.5, 20, 0.7), (40, 11.0, 30, 0.85), (14, 12.2, 16, 0.6)] if time == 'night' else
             [(-50, 9.5, 30, 1.0), (-8, 13.5, 26, 0.8), (36, 10.5, 34, 1.1), (62, 15.5, 18, 0.6)])
    for az, z, ln, th in spots:
        cloud(d, az, z, ln, th, ccol, chi)
    img = np.asarray(im).astype(np.float32).copy()
    # mountains: far range (tall karst peaks, hazy), near range (lower, darker, lit rim)
    far = profile(random.Random(5), 0.8, 1.6, 0.5, 3.5, 8.5, 2.2, 4.2, 5.5)
    fill_range(img, far, L['far'], L['far_mist'], 3.0, z_floor=0.5)
    near = profile(random.Random(9), 0.5, 0.9, 0.6, 1.8, 4.2, 2.5, 5.0, 7.0)
    fill_range(img, near, L['near'], L['near_mist'], 1.6, z_floor=-0.6, rim=L['near_rim'])
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    out = os.path.join(HERE, f'night_sky_{time}.png'); im.save(out); print('wrote', out, im.size)


for t in ('night', 'dawn'):
    make(t)
