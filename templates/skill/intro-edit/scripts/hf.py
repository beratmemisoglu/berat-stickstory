"""HyperFrames for the intro, with the flags that make it fast and correct on this machine. Run from work/intro:
    "$CZ_PYTHON" "$SK/hf.py" check                       # lint + runtime + layout gate (0 errors before any render)
    "$CZ_PYTHON" "$SK/hf.py" snapshot 1.2,3.45,7.8       # stills at those seconds -> snapshots/ (look at them)
    "$CZ_PYTHON" "$SK/hf.py" render                      # starts the render in its own process and waits up to ~9 min
    "$CZ_PYTHON" "$SK/hf.py" wait                        # keeps waiting (run again while it says STILL RENDERING)
                                                         # -> output.mp4, verified (length, audio): RENDER OK
Render: all workers (the CLI silently drops to one slow worker above ~900 frames otherwise), hardware browser GPU and
GPU encoding when available (falls back to software by itself), delivery quality, the composition's own fps."""
import json, os, re, shutil, subprocess, sys, time
for _s in (sys.stdout, sys.stderr):                     # UTF-8 output whatever the console code page
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

WORK = os.getcwd()


def cli():
    hf = shutil.which('hyperframes')
    if hf: return [hf]
    npx = shutil.which('npx')
    if not npx: sys.exit('NEEDS NODE: HyperFrames runs on Node.js, which is not installed. Tell the user to run the Toon Studio installer again (it adds Node.js).')
    return [npx, '--yes', 'hyperframes@0.8']


def env(extra=None):
    e = dict(os.environ, HYPERFRAMES_SKIP_SKILLS='1', NO_COLOR='1', FORCE_COLOR='0', CI='1')
    e.update(extra or {})
    return e


def run(args, extra=None, tail=60):
    print('$', ' '.join(args[-12:]), flush=True)
    p = subprocess.run(cli() + args, cwd=WORK, env=env(extra), capture_output=True, text=True, encoding='utf-8', errors='replace')
    out = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', (p.stdout or '') + (p.stderr or ''))
    lines = [l for l in out.splitlines() if l.strip() and not re.match(r'^\s*[\d.]+%|frame \d+/|\[INFO\]|\[DEBUG\]', l)]
    print('\n'.join(lines[-tail:]))
    return p.returncode, out


def comp():
    s = open('index.html', encoding='utf-8').read()
    m = re.search(r'id="root"[^>]*', s) or re.search(r'data-composition-id[^>]*', s)
    tag = m.group(0) if m else ''
    g = lambda k, d: float(re.search(rf'{k}="([\d.]+)"', tag).group(1)) if re.search(rf'{k}="([\d.]+)"', tag) else d
    return g('data-duration', 0.0), int(g('data-fps', 30)), int(g('data-width', 3840)), int(g('data-height', 2160))


def has_gpu():
    if sys.platform == 'darwin': return True
    try: return subprocess.run(['nvidia-smi', '-L'], capture_output=True, timeout=10).returncode == 0
    except Exception: return False


def stream(args, extra):
    # the detached worker: everything goes to render.log as it happens (wait() reads the progress from it)
    print('$', ' '.join(args), flush=True)
    return subprocess.run(cli() + args, cwd=WORK, env=env(extra), stdin=subprocess.DEVNULL).returncode


def do_render():
    dur, fps, w, h = comp()
    workers = str(max(2, min(8, (os.cpu_count() or 4) // 2)))
    gpu = has_gpu()
    base = ['render', '.', '-o', 'output.mp4', '--fps', str(fps), '--workers', workers, '--quality', 'looks']   # CRF 16: visually lossless; the Suite re-encodes the final video anyway
    extra = {'HF_DE_SINGLE_MIN_FRAMES': '0'}
    if gpu: extra['PRODUCER_BROWSER_GPU_MODE'] = 'hardware'
    code = stream(base + (['--gpu'] if gpu else []), extra)
    if (code or not os.path.exists('output.mp4')) and gpu:
        print('GPU render failed; retrying in software.', flush=True)
        extra.pop('PRODUCER_BROWSER_GPU_MODE', None)
        code = stream(base, extra)
    return 0 if code == 0 and os.path.exists('output.mp4') else 1


def running():
    try: job = json.load(open('render.job.json'))
    except Exception: return False
    if os.path.exists('render.status.json'): return False
    try:
        if sys.platform == 'win32':
            r = subprocess.run(['tasklist', '/FI', f"PID eq {job['pid']}", '/NH'], capture_output=True, text=True)
            return str(job['pid']) in r.stdout
        os.kill(job['pid'], 0); return True
    except Exception: return False


def verify():
    dur, fps, w, h = comp()
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', 'output.mp4'], capture_output=True, text=True).stdout)
    v = next((s for s in j['streams'] if s['codec_type'] == 'video'), {}); a = next((s for s in j['streams'] if s['codec_type'] == 'audio'), None)
    got = float(j['format']['duration']); size = int(j['format']['size']) / 1e6
    print(f"output.mp4: {v.get('width')}x{v.get('height')} {v.get('avg_frame_rate')} {got:.3f}s {size:.1f} MB, audio: {'yes' if a else 'NO'}")
    bad = []
    if dur and abs(got - dur) > 2 / fps: bad.append(f'length {got:.3f}s but the composition is {dur:.3f}s')
    if not a: bad.append('no audio track (the voice must be in output.mp4: keep the <audio> element of the skeleton)')
    for b in bad: print('CHECK:', b)
    print('RENDER OK' if not bad else 'RENDER NEEDS A FIX')
    return 1 if bad else 0


def progress():
    try:
        log = open('render.log', encoding='utf-8', errors='replace').read()
        m = re.findall(r'"framesCompleted":(\d+)', log); t = re.findall(r'"totalFrames":(\d+)', log)
        if m and t and int(t[-1]): return f'{int(m[-1]) * 100 // int(t[-1])}% ({m[-1]}/{t[-1]} frames)'
    except Exception: pass
    return 'starting'


def wait(limit=540):
    """Waits for the render up to ~9 minutes (inside any command time limit). Exit 0 = RENDER OK, 3 = still rendering."""
    t0, last = time.time(), 0
    while time.time() - t0 < limit:
        if os.path.exists('render.status.json'):
            st = json.load(open('render.status.json'))
            if st.get('code') != 0:
                tail = [l for l in open('render.log', encoding='utf-8', errors='replace').read().splitlines() if l.strip() and not l.startswith('[INFO]')][-25:]
                print(chr(10).join(tail)); print('RENDER FAILED (the log is in render.log)'); return 1
            return verify()
        if not running() and not os.path.exists('render.status.json'):
            print('No render is running. Start one with: hf.py render'); return 1
        if time.time() - last > 60: print(f'rendering… {progress()}', flush=True); last = time.time()
        time.sleep(3)
    print(f'STILL RENDERING ({progress()}). Run "hf.py wait" again; do not end your turn before RENDER OK.')
    return 3


def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    if not os.path.exists('index.html'): sys.exit('Run this from work/intro (index.html not found). Stage first: stage.py')
    cmd = sys.argv[1]
    if cmd == 'check':
        code, out = run(['check', '.'])
        sys.exit(code)
    if cmd == 'snapshot':
        if len(sys.argv) < 3: sys.exit('snapshot needs times: hf.py snapshot 1.2,3.4')
        code, out = run(['snapshot', '.', '--at', sys.argv[2], '--no-end'])
        sys.exit(code)
    if cmd == 'render':                  # start the render as its own process (it outlives this command), then wait
        if running(): print('A render is already running; waiting for it.')
        else:
            for f in ('output.mp4', 'render.status.json'):
                if os.path.exists(f): os.remove(f)
            flags = dict(creationflags=0x00000008 | 0x00000200) if sys.platform == 'win32' else dict(start_new_session=True)   # DETACHED + NEW_GROUP
            p = subprocess.Popen([sys.executable, os.path.abspath(__file__), '_render'], cwd=WORK, stdout=open('render.log', 'w'), stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, **flags)
            json.dump({'pid': p.pid, 'started': time.time()}, open('render.job.json', 'w'))
            print(f'Render started ({comp()[0]:.1f} s at {comp()[1]} fps, 4K).')
        sys.exit(wait())
    if cmd == 'wait':
        sys.exit(wait())
    if cmd == '_render':                 # the detached worker
        code = do_render()
        json.dump({'code': code, 'finished': time.time()}, open('render.status.json', 'w'))
        sys.exit(code)
    sys.exit(__doc__)


if __name__ == '__main__':
    main()
