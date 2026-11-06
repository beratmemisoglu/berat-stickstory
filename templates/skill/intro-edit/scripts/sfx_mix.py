"""Sound-effects pass: builds the SFX-only stem for the rendered intro from a cue list keyed to the animation times.
Run from work/intro:
    "$CZ_PYTHON" "$SK/sfx_mix.py" --list          # the library: name, kind, length, peak time, what it is for
    "$CZ_PYTHON" "$SK/sfx_mix.py"                 # sfx_cues.json -> output.sfx.wav + sfx_cues.tsv + a report
    "$CZ_PYTHON" "$SK/sfx_mix.py" --preview       # also preview-with-sfx.mp4 (output.mp4 with voice + SFX) for review

sfx_cues.json:
  {"cues": [{"sound": "whoosh_soft", "t": 1.24, "align": "peak", "db": -24, "pan": -0.35, "rate": 1.0,
             "reverse": false, "why": "card enters left"}, ...]}
  t        seconds in output.mp4, or an expression over timing.json names and T(word, after=0, n=0) (a word's start
           in words.json), e.g. "tKeep + 0.3" or "T('seconds', 70) + 0.05"
  align    "peak" (whooshes: their loudest moment lands on t) or "onset" (clicks, blips: they start at t). Default:
           peak for whooshes and the shimmer, onset for everything else
  db       gain (default -24). pan -1..1 (L / R / C = -0.35 / 0.35 / 0). rate: varispeed (0.9-1.1 for variety)

Library: the built-in synthesized sounds (made on first use into work/intro/sfx/lib), plus the user's own sounds if
the Suite passed CZ_SFX_DIR (a folder of wav/mp3/flac/ogg/m4a files, analyzed once into work/intro/sfx/user).
Output: output.sfx.wav, 48 kHz / 24-bit stereo, exactly as long as output.mp4, starting at 0. Stem gain +8 dB, peaks
held under 0.89 (-1 dBFS)."""
import argparse, glob, json, os, re, subprocess, sys, wave
import numpy as np
for _s in (sys.stdout, sys.stderr):                     # UTF-8 output whatever the console code page
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.getcwd()
LIBDIR = os.path.join(WORK, 'sfx', 'lib')
USERDIR = os.path.join(WORK, 'sfx', 'user')


def ffprobe_dur(f):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True)
    return float(r.stdout.strip())


def ensure_builtin():
    if not os.path.exists(os.path.join(LIBDIR, 'lib.json')):
        subprocess.run([sys.executable, os.path.join(HERE, 'make_sfx.py'), LIBDIR], check=True, capture_output=True)
    return {k: dict(v, file=os.path.join(LIBDIR, k + '.wav')) for k, v in json.load(open(os.path.join(LIBDIR, 'lib.json'))).items()}


def analyze(x):
    env = np.convolve(np.abs(x).max(1), np.ones(240) / 240, 'same')
    mono = x.mean(1); spec = np.abs(np.fft.rfft(mono)); fr = np.fft.rfftfreq(len(mono), 1 / SR)
    dur = len(x) / SR; c = int((spec * fr).sum() / (spec.sum() + 1e-9))
    kind = 'click' if dur < 0.45 and c > 2500 else 'blip' if dur < 1.6 and env.argmax() / SR < 0.08 else 'whoosh'
    return {'dur': round(dur, 3), 'peak': round(int(env.argmax()) / SR, 3), 'centroid': c, 'kind': kind, 'desc': 'your sound'}


def ensure_user():
    src = os.environ.get('CZ_SFX_DIR')
    if not src or not os.path.isdir(src): return {}
    os.makedirs(USERDIR, exist_ok=True)
    idx_f = os.path.join(USERDIR, 'lib.json')
    idx = json.load(open(idx_f)) if os.path.exists(idx_f) else {}
    files = [f for f in glob.glob(os.path.join(src, '**', '*'), recursive=True) if re.search(r'\.(wav|mp3|flac|ogg|m4a|aif|aiff)$', f, re.I)]
    for f in files[:400]:
        name = 'my_' + re.sub(r'[^a-z0-9]+', '_', os.path.splitext(os.path.basename(f))[0].lower()).strip('_')[:40]
        st = os.stat(f); sig = f'{st.st_size}:{int(st.st_mtime)}'
        if idx.get(name, {}).get('sig') == sig and os.path.exists(os.path.join(USERDIR, name + '.wav')): continue
        out = os.path.join(USERDIR, name + '.wav')
        r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-t', '12', '-ac', '2', '-ar', str(SR), '-c:a', 'pcm_s16le', out], capture_output=True)
        if r.returncode: continue
        idx[name] = dict(analyze(load_wav(out)), sig=sig, source=f)
    json.dump(idx, open(idx_f, 'w'), indent=1)
    return {k: dict(v, file=os.path.join(USERDIR, k + '.wav')) for k, v in idx.items()}


def load_wav(f):
    with wave.open(f) as w:
        ch, sw = w.getnchannels(), w.getsampwidth()
        raw = w.readframes(w.getnframes())
    if sw == 2: x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    elif sw == 3:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3)
        x = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
        x = ((x ^ 0x800000) - 0x800000).astype(np.float32) / 8388608
    else: sys.exit(f'{f}: unsupported sample width {sw}')
    x = x.reshape(-1, ch)
    return np.repeat(x, 2, 1) if ch == 1 else x[:, :2]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--list', action='store_true'); ap.add_argument('--preview', action='store_true')
    ap.add_argument('--cues', default='sfx_cues.json'); ap.add_argument('--video', default='output.mp4')
    ap.add_argument('--out', default='output.sfx.wav')
    a = ap.parse_args()
    LIB = ensure_builtin(); LIB.update(ensure_user())
    if a.list:
        for kind in ('whoosh', 'click', 'blip', 'impact'):
            print(f'-- {kind}' + (' (align by peak)' if kind == 'whoosh' else ' (align by onset)'))
            for k, v in LIB.items():
                if v['kind'] == kind: print(f"  {k:22} {v['dur']:5.2f}s  peak {v['peak']:.3f}s  {v['desc']}")
        return
    video = a.video if os.path.exists(a.video) else 'input-video.mp4'
    DUR = ffprobe_dur(video)
    spec = json.load(open(a.cues, encoding='utf-8'))
    cues = spec['cues'] if isinstance(spec, dict) else spec
    timing = json.load(open('timing.json', encoding='utf-8')) if os.path.exists('timing.json') else {}
    words = json.load(open('words.json', encoding='utf-8')) if os.path.exists('words.json') else []

    def T(word, after=0.0, n=0):
        k = 0
        for w in words:
            if w['s'] + 1e-6 < after: continue
            if w['w'].lower().strip('.,?!:;"\'') == word.lower():
                if k == n: return w['s']
                k += 1
        raise ValueError(f'word not found: {word!r} after {after}')
    env = dict(timing, T=T, min=min, max=max, abs=abs, round=round)

    out = np.zeros((int(DUR * SR) + 4 * SR, 2), np.float32)
    rows, problems, cache = [], [], {}
    for i, c in enumerate(cues):
        name = c.get('sound') or c.get('name')
        if name not in LIB: problems.append(f'cue {i + 1}: unknown sound {name!r} (see --list)'); continue
        try: t = float(eval(str(c['t']), {'__builtins__': {}}, env)) if isinstance(c['t'], str) else float(c['t'])
        except Exception as e: problems.append(f'cue {i + 1} ({name}): bad t {c.get("t")!r}: {e}'); continue
        info = LIB[name]; rate = float(c.get('rate', 1.0)); rev = bool(c.get('reverse', False))
        align = c.get('align') or ('peak' if info['kind'] == 'whoosh' else 'onset')
        db = float(c.get('db', -24)); pan = max(-1.0, min(1.0, float(c.get('pan', 0.0))))
        key = (name, rate, rev)
        if key not in cache:
            x = load_wav(info['file'])
            if rate != 1.0:
                idx = np.arange(0, len(x) - 1, rate)
                x = np.stack([np.interp(idx, np.arange(len(x)), x[:, ch]) for ch in (0, 1)], 1).astype(np.float32)
            if rev:
                x = x[::-1].copy(); f = int(0.03 * SR); x[:f] *= np.linspace(0, 1, f)[:, None]
            cache[key] = x
        x = cache[key]
        pk = info['peak'] / rate
        if rev: pk = len(x) / SR - pk
        start = t - (pk if align == 'peak' else 0.0)
        gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)      # equal-power pan
        y = x * (10 ** (db / 20)) * np.array([gl, gr], np.float32) * np.sqrt(2)
        s = int(round(start * SR))
        if s >= int(DUR * SR): problems.append(f'cue {i + 1} ({name}) at {t:.2f}s is after the end ({DUR:.2f}s): skipped'); continue
        if s < 0: y = y[-s:]; s = 0
        out[s:s + len(y)] += y[:len(out) - s]
        rows.append((round(start, 3), round(t, 3), name + (' (reversed)' if rev else ''), align, db, pan, c.get('why', '')))

    n = int(round(DUR * SR))
    tail = float(np.abs(out[n:]).max()) if len(out) > n else 0.0
    out = out[:n] * 10 ** (8 / 20)                          # stem gain, then keep true headroom
    pk = float(np.abs(out).max())
    if pk > 0.89: out *= 0.89 / pk
    pcm = (np.clip(out, -1, 1) * 8388607).astype('<i4')
    b24 = pcm.view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(a.out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR); w.writeframes(b24)
    with open('sfx_cues.tsv', 'w', encoding='utf-8') as f:
        f.write('file_start\tsync_point\tsound\talign\tgain_db\tpan\twhat it marks\n')
        for r in sorted(rows): f.write('\t'.join(str(v) for v in r) + '\n')

    # report: level against the voice, density, repeats, collisions
    print(f'{a.out}: {len(rows)} cues, {n / SR:.3f} s (video {DUR:.3f} s), peak {20 * np.log10(np.abs(out).max() + 1e-9):.1f} dBFS')
    try:
        r = subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vn', '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True)
        v = np.frombuffer(r.stdout, np.float32).reshape(-1, 2)[:n]
        blk = SR // 10
        def rms_db(x): return 20 * np.log10(np.sqrt((x[:len(x) // blk * blk].reshape(-1, blk, 2) ** 2).mean((1, 2))) + 1e-9)
        vd, sd = rms_db(v), rms_db(out[:len(v)])
        both = (vd > -45) & (sd > -70)
        if both.any(): print(f'SFX under the voice: median {np.median(vd[both] - sd[both]):.1f} dB (aim 12-20; under 10 = too loud, over 24 = inaudible)')
    except Exception as e:
        print('voice comparison skipped:', e)
    per5 = np.bincount([int(r[1] // 5) for r in rows], minlength=int(DUR // 5) + 1)
    print('cues per 5 s:', ' '.join(str(x) for x in per5), '(busy > 8, empty stretches are fine on clean-footage moments)')
    srt = sorted(rows, key=lambda r: r[1])
    for p, q in zip(srt, srt[1:]):
        if p[2] == q[2] and q[1] - p[1] < 1.5 and 'tick' not in p[2]: problems.append(f'{p[2]} twice within {q[1] - p[1]:.2f}s at {p[1]:.2f}s: vary it (another sound or rate)')
    if tail > 0.02: problems.append('a sound runs past the end of the video and is cut off: end it earlier or shorten it')
    for p in problems: print('CHECK:', p)
    if a.preview and os.path.exists(video):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-i', a.out, '-filter_complex',
                        '[0:a][1:a]amix=inputs=2:normalize=0:duration=first[a]', '-map', '0:v', '-map', '[a]', '-c:v', 'copy',
                        '-c:a', 'aac', '-b:a', '256k', 'preview-with-sfx.mp4'], check=True)
        print('preview-with-sfx.mp4 written')


if __name__ == '__main__':
    main()
