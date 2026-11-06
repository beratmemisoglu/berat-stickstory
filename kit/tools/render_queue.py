# ONE render queue across several films, N Blenders in total (night 2: three films' pools side by side = 8-10 Blenders
# overflowed the 16 GB card and a frame took 90 s instead of 2 s). Renders only what is MISSING on disk (dissolve pads
# + prerender from each assemble.json, like render_film.py) plus explicit redo ranges for shots whose files changed.
#   .venv/Scripts/python.exe tools/render_queue.py film/lottery film/bell film/tickets --jobs 4
#       [--redo film/bell:b01,film/bell:b07,film/tickets:t03:267-400] [--scale 1.0] [--samples 48] [--dry]
import json, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BL = os.environ.get('CZ_BLENDER') or r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'   # Toon Studio passes CZ_BLENDER
a = sys.argv[1:]
opt = lambda k, d: a[a.index(k) + 1] if k in a else d
films = [os.path.abspath(x) for x in a if not x.startswith('--') and os.path.isdir(x)]
jobs, scale, samples = int(opt('--jobs', '4')), opt('--scale', '1.0'), opt('--samples', '48')
redo = {}
for r in opt('--redo', '').split(','):
    if not r: continue
    parts = r.split(':'); key = (os.path.abspath(parts[0]), parts[1])
    redo[key] = tuple(int(v) for v in parts[2].split('-')) if len(parts) > 2 else 'all'


def rng(py):
    m = re.search(r'^F0\s*,\s*F1\s*=\s*(\d+)\s*,\s*(\d+)', open(py, encoding='utf8').read(), re.M)
    return (int(m.group(1)), int(m.group(2))) if m else None


def ok(p):
    """A frame on disk counts only if it is a whole PNG (a render stopped mid-write leaves a truncated file)."""
    if not os.path.exists(p) or os.path.getsize(p) < 2000: return False
    try:
        from PIL import Image
        with Image.open(p) as im: im.verify()
        return True
    except Exception: return False


PART = '.rendering'   # Blender writes into <shot>/.rendering/ and only whole frames move into <shot>/ (a killed or crashed
                      # render once left a half-written 0841.png that stopped a 3-hour export in assemble.py)


def settle(out):
    """Move every whole frame from <out>/.rendering into <out> (a stopped run's finished frames are kept), drop the rest."""
    tmp = os.path.join(out, PART); n = 0
    if not os.path.isdir(tmp): return 0
    for f in os.listdir(tmp):
        p = os.path.join(tmp, f)
        if re.fullmatch(r'\d{4}\.png', f) and ok(p):
            try: os.replace(p, os.path.join(out, f)); n += 1; continue
            except OSError: pass
        try: os.remove(p)
        except OSError: pass
    return n


def spans(fr):
    """[3, 4, 5, 9] -> '3-5,9'"""
    out, s = [], None
    for f in sorted(fr):
        if s is None: s = e = f
        elif f == e + 1: e = f
        else: out.append(f'{s}-{e}' if e > s else str(s)); s = e = f
    if s is not None: out.append(f'{s}-{e}' if e > s else str(s))
    return ','.join(out)


pre, plan = [], []
for film in films:
    cfg = json.load(open(os.path.join(film, 'assemble.json'), encoding='utf8'))
    sub = cfg.get('dir', 'shots')
    for s, p0, p1 in cfg.get('prerender', []):
        out = os.path.join(film, sub, s); want = set(range(int(p0), int(p1) + 1)); settle(out)
        if redo.get((film, s)) == 'all': todo = want
        else: todo = {f for f in want if not ok(os.path.join(out, f'{f:04d}.png'))}
        if todo: pre.append((film, s, todo, out, '_pre'))
    for s in cfg['shots']:
        py = os.path.join(film, s + '.py'); f0, f1 = rng(py)
        for (x, y, d0, d1) in cfg.get('dissolves', []):
            if s == x: f1 = max(f1, int(d1))
            if s == y: f0 = min(f0, int(d0))
        out = os.path.join(film, sub, s); os.makedirs(out, exist_ok=True); settle(out)
        want = set(range(f0, f1 + 1)); rd = redo.get((film, s))
        todo = {f for f in want if not ok(os.path.join(out, f'{f:04d}.png'))}
        if rd == 'all': todo = want
        elif rd: todo |= set(range(rd[0], rd[1] + 1)) & want
        if todo: plan.append((film, s, todo, out, ''))
plan.sort(key=lambda p: -len(p[2]))
print(f'QUEUE {sum(len(p[2]) for p in pre + plan)} frames in {len(pre) + len(plan)} jobs, {jobs} at a time:', flush=True)
for p in pre + plan: print(f'  {os.path.basename(p[0])}/{p[1]}{p[4]}: {len(p[2])} frames ({spans(p[2])[:60]})', flush=True)
if '--dry' in a: sys.exit(0)
T0 = time.time()


def run(p):
    film, s, todo, out, tag = p; t = time.time()
    lg = os.path.join(film, os.path.basename(os.path.dirname(out)), s + tag + '_q.log')
    with open(lg, 'w', encoding='utf8') as log:
        r = subprocess.run([BL, '-b', '--factory-startup', '-P', os.path.join(LAB, 'engine', 'run.py'), '--', os.path.join(film, s + '.py'),
                            '--frames', spans(todo), '--scale', scale, '--samples', samples, '--out', os.path.join(out, PART)], stdout=log, stderr=subprocess.STDOUT,
                           cwd=LAB, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    settle(out)
    txt = open(lg, encoding='utf8', errors='replace').read()
    bad = [l for l in txt.splitlines() if 'Traceback' in l or ('Error:' in l and 'Shadow buffer' not in l) or 'CZ FACES MISSING' in l]
    n = sum(1 for f in todo if os.path.exists(os.path.join(out, f'{f:04d}.png')))
    print(f'DONE {os.path.basename(film)}/{s}{tag}: {n}/{len(todo)} frames in {(time.time() - t) / 60:.1f} min ({(time.time() - t) / max(1, n):.1f} s/frame)'
          + (f'  PROBLEMS: {bad[:3]}' if bad or r.returncode else ''), flush=True)
    return n


if pre:
    with ThreadPoolExecutor(jobs) as ex: list(ex.map(run, pre))
with ThreadPoolExecutor(jobs) as ex: total = sum(ex.map(run, plan))
print(f'RENDER_QUEUE {total} frames, {(time.time() - T0) / 60:.1f} min, {total / max(1e-6, time.time() - T0):.2f} frames/s', flush=True)
