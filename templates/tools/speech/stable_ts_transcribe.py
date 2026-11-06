"""Creatorize speech-to-text: OpenAI Whisper through stable-ts (stable_whisper), on the CPU. No GPU needed, word timings
from Whisper itself (stable-ts steadies them), nothing leaves the computer. Installed by the app (Settings > System check
> Transcription > Whisper on the CPU) into its own Python environment next to this script; the model is downloaded once
into ./models. The model and the languages come from stable-ts.json next to this script (written by the app).

  python transcribe.py INPUT [INPUT ...] [--out DIR] [--no-align] [--lang eng]
  python transcribe.py --setup        # download the model now

Same outputs as the app's other transcribers: <name>.json {source, model, aligned, duration, text,
segments: [{text, start, end}], words: [{word, start, end}]}, <name>.srt, <name>.words.srt, <name>.txt.
"""
import argparse, json, os, sys, time

HOME = os.path.dirname(os.path.abspath(__file__))


def config():
    try:
        with open(os.path.join(HOME, 'stable-ts.json'), encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def whisper_lang(iso3, cfg):
    """--lang is ISO 639-3 (the app's contract); Whisper takes ISO 639-1. None: let Whisper detect it."""
    if not iso3:
        return None
    iso3 = iso3.lower()
    return (cfg.get('iso') or {}).get(iso3) or ('en' if iso3 == 'eng' else iso3 if len(iso3) == 2 else None)


def to_contract(result, source, model):
    """A stable-ts result as the app's json: words trimmed, in order, each start < end (rounded to ms)."""
    segments, words = [], []
    for seg in (getattr(result, 'segments', None) or []):
        seg_words = []
        for w in (getattr(seg, 'words', None) or []):
            t = str(getattr(w, 'word', '') or '').strip()
            if not t:
                continue
            s, e = float(getattr(w, 'start', 0) or 0), float(getattr(w, 'end', 0) or 0)
            s = max(0.0, s)
            prev = seg_words[-1] if seg_words else words[-1] if words else None
            if prev and s < prev['start']:
                s = prev['start']                 # never out of order (the editor cuts between words)
            if e <= s:
                e = s + 0.02
            seg_words.append({'word': t, 'start': round(s, 3), 'end': round(e, 3)})
        words += seg_words
        text = str(getattr(seg, 'text', '') or '').strip() or ' '.join(w['word'] for w in seg_words)
        if text:
            s0 = seg_words[0]['start'] if seg_words else round(float(getattr(seg, 'start', 0) or 0), 3)
            e0 = seg_words[-1]['end'] if seg_words else round(float(getattr(seg, 'end', 0) or 0), 3)
            segments.append({'text': text, 'start': s0, 'end': max(e0, s0 + 0.02)})
    text = str(getattr(result, 'text', '') or '').strip() or ' '.join(s['text'] for s in segments)
    duration = round(max([s['end'] for s in segments] or [0.0]), 3)
    return {'source': os.path.abspath(source), 'model': model, 'aligned': True, 'duration': duration,
            'text': text, 'segments': segments, 'words': words}


def ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


def write(out_dir, source, j):
    name = os.path.splitext(os.path.basename(source))[0]
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.join(out_dir, name)
    with open(base + '.json', 'w', encoding='utf-8') as f:
        json.dump(j, f, ensure_ascii=False, indent=1)
    with open(base + '.srt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(f'{i + 1}\n{ts(s["start"])} --> {ts(s["end"])}\n{s["text"]}\n' for i, s in enumerate(j['segments'])))
    with open(base + '.words.srt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(f'{i + 1}\n{ts(w["start"])} --> {ts(w["end"])}\n{w["word"]}\n' for i, w in enumerate(j['words'])))
    with open(base + '.txt', 'w', encoding='utf-8') as f:
        f.write(j['text'] + '\n')


def load(cfg):
    import stable_whisper
    try:                                   # at most half the cores: the editor, a browser and Claude stay usable
        import torch
        torch.set_num_threads(int(cfg.get('threads') or max(1, (os.cpu_count() or 4) // 2)))
    except Exception:
        pass
    name = cfg.get('model') or 'base'
    models = os.path.join(HOME, 'models'); os.makedirs(models, exist_ok=True)
    return name, stable_whisper.load_model(name, device='cpu', download_root=models)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inputs', nargs='*'); ap.add_argument('--out'); ap.add_argument('--no-align', action='store_true')
    ap.add_argument('--lang'); ap.add_argument('--setup', action='store_true')
    a = ap.parse_args()
    cfg = config()
    t0 = time.time()
    name, model = load(cfg)
    print(f'Whisper {name} (stable-ts) loaded on the CPU in {time.time() - t0:.1f}s', flush=True)
    if a.setup:
        return
    if not a.inputs:
        sys.exit('No input files.')
    language = None if name.endswith('.en') else whisper_lang(a.lang, cfg)
    for i, src in enumerate(a.inputs):
        if not os.path.exists(src):
            sys.exit(f'Not found: {src}')
        t1 = time.time()
        kw = {'language': language} if language else {}
        result = model.transcribe(src, verbose=None, **kw)
        j = to_contract(result, src, f'Whisper {name} (stable-ts)')
        write(a.out or os.path.dirname(os.path.abspath(src)), src, j)
        print(f'[{i + 1}/{len(a.inputs)}] {os.path.basename(src)}: {len(j["words"])} words in {time.time() - t1:.1f}s', flush=True)


if __name__ == '__main__':
    main()
