"""Creatorize speech-to-text: NVIDIA Parakeet TDT 0.6B through ONNX Runtime, on the CPU. No PyTorch, no GPU needed,
works the same on Windows and macOS (Apple Silicon and Intel). Installed by the Creatorize installer (or the app) into
its own small Python environment; the model (~0.7 GB, int8) is downloaded once.

  python transcribe.py INPUT [INPUT ...] [--out DIR] [--no-align] [--lang eng] [--model v2|v3] [--precision int8|fp32] [--threads N]
  python transcribe.py --setup [--model v2|v3] [--precision int8|fp32]    # download the model now, print the machine fit

Same outputs as the Parakeet pipeline in ~/tools/parakeet: <name>.json {source, model, aligned, duration, text,
segments: [{text, start, end}], words: [{word, start, end}]}, <name>.srt, <name>.words.srt, <name>.txt.
Long files are cut at pauses into short pieces (memory stays small, no matter the length). Word timings come from the
model's 80 ms frames, then each word's edges are snapped to the audio (where the voice starts and stops).
"""
import argparse, json, os, subprocess, sys, time

MODELS = {'v2': 'nemo-parakeet-tdt-0.6b-v2', 'v3': 'nemo-parakeet-tdt-0.6b-v3'}   # v2 English (best), v3 25 EU languages
SR = 16000
FRAME = 0.08            # Parakeet's encoder step (10 ms features, 8x subsampling)
PIECE = 24.0            # longest piece fed to the model at once (s)
HOME = os.path.dirname(os.path.abspath(__file__))


def models_dir():
    return os.environ.get('CZ_SPEECH_MODELS') or os.path.join(HOME, 'models')   # next to this script


def machine():
    """What this computer can spare: logical cores, total RAM (GB), free disk where the model lives (GB)."""
    cores = os.cpu_count() or 4
    ram = 0.0
    try:
        if sys.platform == 'win32':
            import ctypes
            class M(ctypes.Structure):
                _fields_ = [('l', ctypes.c_ulong), ('load', ctypes.c_ulong), ('total', ctypes.c_ulonglong), ('avail', ctypes.c_ulonglong),
                            ('tp', ctypes.c_ulonglong), ('ap', ctypes.c_ulonglong), ('tv', ctypes.c_ulonglong), ('av', ctypes.c_ulonglong), ('x', ctypes.c_ulonglong)]
            m = M(); m.l = ctypes.sizeof(M); ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)); ram = m.total / 2**30
        elif sys.platform == 'darwin':
            ram = int(subprocess.run(['sysctl', '-n', 'hw.memsize'], capture_output=True, text=True).stdout.strip() or 0) / 2**30
        else:
            ram = os.sysconf('SC_PAGE_SIZE') * os.sysconf('SC_PHYS_PAGES') / 2**30
    except Exception:
        pass
    d = models_dir(); os.makedirs(d, exist_ok=True)
    import shutil
    free = shutil.disk_usage(d).free / 2**30
    return cores, ram, free


def fit(precision=None, threads=None):
    """The best setup that leaves the machine usable: int8 unless there is RAM to spare for full precision (a small
    accuracy gain, twice the memory and download), and at most half the cores so the editor and Claude keep running."""
    cores, ram, free = machine()
    if not precision:
        precision = 'fp32' if ram >= 24 and free >= 20 else 'int8'
    if not threads:
        threads = max(2, min(8, cores // 2))
    return precision, threads, (cores, ram, free)


def load(model_key, precision, threads):
    import onnxruntime as rt
    from onnx_asr.loader import Manager
    so = rt.SessionOptions(); so.intra_op_num_threads = threads; so.inter_op_num_threads = 1
    so.log_severity_level = 3
    name, path = MODELS[model_key], model_path(model_key, precision)
    ready = os.path.join(path, '.ready')
    if not os.path.exists(ready):
        print('Downloading the speech model (once, ~%s) ...' % ('2.5 GB' if precision == 'fp32' else '0.7 GB'), flush=True)
    m = Manager(so, ['CPUExecutionProvider']).create_asr(name, path, quantization=None if precision == 'fp32' else 'int8',
                                                         offline=os.path.exists(ready))
    open(ready, 'w').close()        # a download cut short resumes next time instead of loading half a model
    return m.with_timestamps()


def model_path(model_key, precision):
    return os.path.join(models_dir(), MODELS[model_key] + ('' if precision == 'fp32' else '-int8'))


def read_audio(src):
    """Any audio/video ffmpeg can read -> 16 kHz mono float32."""
    import numpy as np
    r = subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', src, '-vn', '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                       capture_output=True)
    if r.returncode:
        sys.exit(f'ffmpeg could not read {src}: {r.stderr.decode(errors="replace")[-400:]}')
    return np.frombuffer(r.stdout, dtype=np.int16).astype(np.float32) / 32768.0


def energy(a, hop=0.01):
    """RMS per 10 ms, in dB."""
    import numpy as np
    n = int(SR * hop); k = len(a) // n
    if k == 0:
        return np.zeros(0)
    e = np.sqrt(np.mean(a[:k * n].reshape(k, n) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(e)


def pieces(a, db):
    """Cut points at the quietest moment of the last few seconds before each PIECE limit."""
    import numpy as np
    total = len(a) / SR; out = []; t = 0.0
    while total - t > PIECE:
        lo, hi = int((t + PIECE - 6) / 0.01), int((t + PIECE) / 0.01)
        w = db[lo:hi]
        # quietest 200 ms run: a pause between words, not a gap inside one
        s = np.convolve(w, np.ones(20) / 20, mode='valid') if len(w) > 20 else w
        cut = (lo + int(np.argmin(s)) + 10) * 0.01
        out.append((t, cut)); t = cut
    out.append((t, total))
    return out


def to_words(res, offset):
    """Parakeet's sentencepiece tokens ('▁' starts a word) with frame times -> words with start and a first end guess."""
    words = []
    for tok, ts in zip(res.tokens or [], res.timestamps or []):
        piece = tok.replace('▁', ' ')
        if piece.startswith(' ') or not words:
            words.append({'word': piece.strip(), 'start': offset + ts, 'last': offset + ts})
        else:
            words[-1]['word'] += piece; words[-1]['last'] = offset + ts
    return [w for w in words if w['word']]


def snap(words, db, total):
    """Word edges from the audio: a word starts where the voice rises just before its first token and ends where it falls
    after its last one (but never past the next word). Within ~1-2 frames of forced alignment on clean narration."""
    import numpy as np
    if not len(db):
        return words
    floor = np.percentile(db, 10); peak = np.percentile(db, 95)
    thr = floor + 0.25 * (peak - floor)          # voiced vs pause, from this recording's own levels
    voiced = db > thr
    n = len(db)
    for i, w in enumerate(words):
        prev_end = words[i - 1]['end'] if i else 0.0
        nxt = words[i + 1]['start'] if i + 1 < len(words) else total
        # start: step back from the first token while the voice is on (max 2 frames), then forward over any silence
        s = int(w['start'] / 0.01); lo = max(int(prev_end / 0.01), s - 16)
        while s > lo and voiced[min(s - 1, n - 1)]:
            s -= 1
        while s < min(n - 1, int((w['last'] + FRAME) / 0.01)) and not voiced[s]:
            s += 1
        # end: from the last token, run on while voiced, up to the next word (and at most 0.6 s)
        e = int((w['last'] + FRAME) / 0.01); hi = min(n, int(nxt / 0.01), e + 60)
        while e < hi and voiced[min(e, n - 1)]:
            e += 1
        while e > s + 3 and not voiced[min(e - 1, n - 1)]:
            e -= 1
        w['start'] = round(max(prev_end, s * 0.01), 3)
        w['end'] = round(max(w['start'] + 0.04, min(e * 0.01, nxt)), 3)
    for w in words:
        w.pop('last', None)
    return words


def plain(words):
    for w in words:
        w['start'] = round(w['start'], 3); w['end'] = round(w.pop('last') + FRAME, 3)
    return words


def ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'


def srt(cues):
    return '\n'.join(f'{i}\n{ts(a)} --> {ts(b)}\n{t}\n' for i, (a, b, t) in enumerate(cues, 1))


def segments_from_words(words, max_chars=42, max_gap=0.6):
    segs, cur = [], []
    for w in words:
        if cur and (w['start'] - cur[-1]['end'] > max_gap or len(' '.join(x['word'] for x in cur + [w])) > max_chars
                    or cur[-1]['word'][-1:] in '.?!'):
            segs.append(cur); cur = []
        cur.append(w)
    if cur:
        segs.append(cur)
    return [{'text': ' '.join(x['word'] for x in s), 'start': s[0]['start'], 'end': s[-1]['end']} for s in segs]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inputs', nargs='*')
    ap.add_argument('--out')
    ap.add_argument('--model', choices=MODELS, help='v2 (English, the best for it) or v3 (25 European languages); by default from --lang')
    ap.add_argument('--precision', choices=['int8', 'fp32'])
    ap.add_argument('--threads', type=int)
    ap.add_argument('--no-align', action='store_true', help='keep the raw 80 ms model timings')
    ap.add_argument('--lang', default='eng', help='ISO 639-3 code of the language spoken: eng uses v2, any other v3 (which hears the language itself)')
    ap.add_argument('--setup', action='store_true', help='download the model and print what this machine gets')
    a = ap.parse_args()
    a.model = a.model or ('v2' if a.lang.lower() in ('eng', 'en') else 'v3')

    precision, threads, (cores, ram, free) = fit(a.precision, a.threads)
    print(f'Speech model: Parakeet TDT 0.6B {a.model} ({precision}) on the CPU, {threads} of {cores} threads '
          f'(RAM {ram:.0f} GB, {free:.0f} GB free disk)', flush=True)
    if free < 2 and not os.path.exists(os.path.join(model_path(a.model, precision), '.ready')):
        sys.exit(f'Not enough free disk space for the speech model (needs ~1 GB, {free:.1f} GB free).')
    t0 = time.time()
    model = load(a.model, precision, threads)
    print(f'Model ready in {time.time() - t0:.1f}s', flush=True)
    if a.setup:
        import numpy as np
        r = model.recognize(np.zeros(SR, dtype=np.float32))    # proves the model runs on this machine
        print('SPEECH OK', flush=True)
        return

    for inp in a.inputs:
        src = os.path.abspath(inp)
        outdir = os.path.abspath(a.out) if a.out else os.path.dirname(src)
        os.makedirs(outdir, exist_ok=True)
        t1 = time.time()
        audio = read_audio(src); total = len(audio) / SR
        db = energy(audio)
        words = []
        parts = pieces(audio, db)
        for i, (s, e) in enumerate(parts):
            r = model.recognize(audio[int(s * SR):int(e * SR)])
            words += to_words(r, s)
            if len(parts) > 3 and (i + 1) % 10 == 0:
                print(f'  {min(e, total) / total * 100:.0f}% ({e:.0f} of {total:.0f}s)', flush=True)
        words = plain(words) if a.no_align else snap(words, db, total)
        text = ' '.join(w['word'] for w in words)
        segs = segments_from_words(words)
        base = os.path.join(outdir, os.path.splitext(os.path.basename(src))[0])
        json.dump({'source': src, 'model': 'nvidia/parakeet-tdt-0.6b-' + a.model + ('' if precision == 'fp32' else ' (int8, onnx)'),
                   'aligned': not a.no_align, 'duration': round(total, 3), 'text': text, 'segments': segs, 'words': words},
                  open(base + '.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        open(base + '.srt', 'w', encoding='utf-8').write(srt((x['start'], x['end'], x['text']) for x in segs))
        open(base + '.words.srt', 'w', encoding='utf-8').write(srt((x['start'], x['end'], x['word']) for x in words))
        open(base + '.txt', 'w', encoding='utf-8').write(text + '\n')
        dt = time.time() - t1
        print(f'{os.path.basename(src)}: {total:.1f}s audio in {dt:.1f}s ({total / max(dt, 0.01):.0f}x realtime), {len(words)} words', flush=True)


if __name__ == '__main__':
    main()
