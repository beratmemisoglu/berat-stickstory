# Assemble a film from per-shot frame folders with cross-dissolves (the reference dissolves between some shots):
#   .venv/Scripts/python.exe tools/assemble.py film/lottery [--out frames_final]
# reads film/<film>/assemble.json: {"shots": ["l01", "l02", ...], "dissolves": [["l04", "l05", 175, 185], ...],
#   "dir": "shots"}  - each shot's frames in film/<film>/<dir>/<shot>/NNNN.png (global frame numbers; a dissolve's
#   outgoing shot renders past its F1 and the incoming one from before its F0 over the window).
# Every frame of the film gets exactly one source (the last shot that covers it) or a blend inside a dissolve window.
import json, os, re, shutil, sys
from PIL import Image

film = os.path.abspath(sys.argv[1])
out = os.path.join(film, sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'frames_final')
cfg = json.load(open(os.path.join(film, 'assemble.json'), encoding='utf8'))
root = os.path.join(film, sys.argv[sys.argv.index('--dir') + 1] if '--dir' in sys.argv else cfg.get('dir', 'shots'))
os.makedirs(out, exist_ok=True)


def bad(p, e):
    """A rendered frame that can't be read (a render stopped mid-write): it goes, so the next render pass makes it again;
    the app reads BADFRAME, re-renders only the missing frames and assembles again (Toon Studio 0.19.1)."""
    try: os.remove(p)
    except OSError: pass
    print('BADFRAME', p, e, flush=True); sys.exit(3)


def frame(p):
    try: return Image.open(p).convert('RGB')
    except Exception as e: bad(p, e)


def whole(p):
    try:
        with Image.open(p) as im: im.verify()
    except Exception as e: bad(p, e)


have = {}
for s in cfg['shots']:
    d = os.path.join(root, s)
    have[s] = {int(f[:4]) for f in os.listdir(d) if f[:4].isdigit() and f.endswith('.png')} if os.path.isdir(d) else set()
rng = {}
for s in cfg['shots']:
    pyf = os.path.join(film, s + '.py'); src = open(pyf, encoding='utf8').read() if os.path.exists(pyf) else ''
    m = re.search(r'^F0\s*,\s*F1\s*=\s*(\d+)\s*,\s*(\d+)', src, re.M)
    rng[s] = (int(m.group(1)), int(m.group(2))) if m else (min(have[s] or [0]), max(have[s] or [0]))
last = max(r[1] for r in rng.values())
diss = [(a, b, int(f0), int(f1)) for a, b, f0, f1 in cfg.get('dissolves', [])]
missing, blended = [], 0
FILL = None
if "--fill" in sys.argv:
    any_png = next((os.path.join(root, s, f"{f:04d}.png") for s in cfg["shots"] for f in sorted(have[s])[:1]), None)
    if any_png: FILL = Image.new("RGB", Image.open(any_png).size, (8, 8, 10))
# match cuts ("matchcuts": [{"from": "l14", "frame": 1308, "to": "l15", "f0": 1309, "f1": 1318, "boxes": "l15_print.json",
#   "card": "tex/lo_pol_kyle.png", "photo": [26, 26, 414, 370], "crop_y": 0.24}]): the outgoing shot's last frame
# shrinks in 2D onto a print in the incoming shot (the reference's L14 -> L15), tracking the print's screen box per
# frame, cropping from the full frame to the print's crop and fading into the 3D print over the last 3 frames
MC = []
for m in cfg.get('matchcuts', []):
    bx = json.load(open(os.path.join(film, m['boxes'])))
    MC.append(dict(m, boxes={int(k): v for k, v in bx.items()}, card_im=Image.open(os.path.join(film, m['card'])).convert('RGB'),
                   src=frame(os.path.join(root, m['from'], f"{m['frame']:04d}.png"))))


def matchcut(m, f):
    B = frame(os.path.join(root, m['to'], f'{f:04d}.png')); W, H = B.size
    k = (f - m['f0'] + 1) / (m['f1'] - m['f0'] + 1); k = 1 - (1 - k) ** 3          # fast out of the cut, settles on the print
    cx0, cy0, cx1, cy1 = m['boxes'][f]; cw, chh = m['card_im'].size; p = m['photo']
    # the print's photo area on screen (the card box minus its borders)
    px0, py0 = cx0 + (cx1 - cx0) * p[0] / cw, cy0 + (cy1 - cy0) * p[1] / chh
    px1, py1 = cx0 + (cx1 - cx0) * p[2] / cw, cy0 + (cy1 - cy0) * p[3] / chh
    L = lambda a, b: a + (b - a) * k
    ph = [L(0, px0), L(0, py0), L(1, px1), L(1, py1)]                                   # photo box, full frame -> print
    S = m['src']; sw, sh = S.size; cy = m['crop_y']; ch = sw * (p[3] - p[1]) / (p[2] - p[0]) / sh
    crop = S.crop((0, int(L(0, cy) * sh), sw, int(L(1, cy + ch) * sh)))
    # the card around it, scaled with the photo
    fx = (ph[2] - ph[0]) / ((p[2] - p[0]) / cw); fy = (ph[3] - ph[1]) / ((p[3] - p[1]) / chh)
    card = [ph[0] - fx * p[0] / cw, ph[1] - fy * p[1] / chh]; card += [card[0] + fx, card[1] + fy]
    O = B.copy()
    box = lambda r: (int(round(r[0] * W)), int(round(r[1] * H)), int(round(r[2] * W)), int(round(r[3] * H)))
    cb = box(card)
    if cb[2] - cb[0] > 2 and cb[3] - cb[1] > 2:
        sh_ = Image.new('RGB', (cb[2] - cb[0], cb[3] - cb[1]), (0, 0, 0))
        O.paste(Image.blend(O.crop((cb[0] + 6, cb[1] + 8, cb[2] + 6, cb[3] + 8)).resize(sh_.size), sh_, 0.35), (cb[0] + 6, cb[1] + 8))   # soft drop shadow
        O.paste(m['card_im'].resize((cb[2] - cb[0], cb[3] - cb[1]), Image.LANCZOS), cb[:2])
    pb = box(ph); O.paste(crop.resize((max(1, pb[2] - pb[0]), max(1, pb[3] - pb[1])), Image.LANCZOS), pb[:2])
    fade = max(0.0, min(1.0, (f - (m['f1'] - 3)) / 4))
    return Image.blend(O, B, fade) if fade > 0 else O


for f in range(1, last + 1):
    dst = os.path.join(out, f'{f:04d}.png')
    mc = next((m for m in MC if m['f0'] <= f <= m['f1'] and f in have[m['to']] and f in m['boxes']), None)
    if mc: matchcut(mc, f).save(dst); blended += 1; continue
    win = next((d for d in diss if d[2] <= f <= d[3] and f in have[d[0]] and f in have[d[1]]), None)
    if win:
        a, b, f0, f1 = win; k = (f - f0) / max(1, f1 - f0); k = k * k * (3 - 2 * k)
        A = frame(os.path.join(root, a, f'{f:04d}.png')); B = frame(os.path.join(root, b, f'{f:04d}.png'))
        if B.size != A.size: B = B.resize(A.size)
        Image.blend(A, B, k).save(dst); blended += 1; continue
    owner = None
    for s in cfg['shots']:
        if rng[s][0] <= f <= rng[s][1] and f in have[s]: owner = s
    # around a dissolve the transition decides, not the shot ranges: after its window the incoming shot owns the frames
    # still inside the outgoing shot's range, before it the outgoing one owns the incoming's early frames (CRITIC-L r7:
    # L12 776 -> 777-780 jumped back to Kyle in the car after the office had dissolved in)
    for a, b, d0, d1 in diss:
        if d1 < f <= rng[a][1] and f in have[b]: owner = b
        elif rng[b][0] <= f < d0 and f in have[a]: owner = a
    if owner is None:
        owner = next((s for s in reversed(cfg['shots']) if f in have[s]), None)
    if owner is None:
        missing.append(f)
        if FILL is not None: FILL.save(dst)   # --fill black: rough cuts with shots still missing
        continue
    whole(os.path.join(root, owner, f'{f:04d}.png'))
    shutil.copyfile(os.path.join(root, owner, f'{f:04d}.png'), dst)
print('ASSEMBLED', out, last, 'frames,', blended, 'blended,', len(missing), 'missing', (missing[:10] if missing else ''))
