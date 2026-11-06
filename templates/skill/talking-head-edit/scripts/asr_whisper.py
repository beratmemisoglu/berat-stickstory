"""Whisper fallback with the Parakeet pipeline's interface, for machines without Parakeet (no NVIDIA GPU, macOS).
    python asr_whisper.py FILE [FILE ...] --out DIR [--no-align]
Writes DIR/<stem>.json = {source, model, aligned, duration, text, segments: [{text, start, end}], words: [{word, start, end}]}
plus <stem>.txt, like transcribe.py in ~/tools/parakeet. Uses stable-ts (installed by the Toon Studio installer); the model
loads once for all files. CZ_WHISPER_MODEL overrides the model (default: turbo on CUDA, small.en on CPU)."""
import argparse, json, os, sys

ap = argparse.ArgumentParser()
ap.add_argument('files', nargs='+'); ap.add_argument('--out', default=None); ap.add_argument('--no-align', action='store_true')
ap.add_argument('--lang', default='en')
a = ap.parse_args()
try:
    import torch, stable_whisper
except ImportError as e:
    sys.exit(f'Whisper fallback needs stable-ts ({e}). Run the Toon Studio installer again or: python -m pip install stable-ts')
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
name = os.environ.get('CZ_WHISPER_MODEL') or ('turbo' if dev == 'cuda' else ('small.en' if a.lang == 'en' else 'small'))
model = stable_whisper.load_model(name, device=dev)
for f in a.files:
    out = a.out or os.path.dirname(os.path.abspath(f)); os.makedirs(out, exist_ok=True)
    stem = os.path.splitext(os.path.basename(f))[0]
    r = model.transcribe(f, language=a.lang, word_timestamps=True, fp16=dev == 'cuda', vad=False, regroup=True, verbose=None)
    words = [{'word': w.word.strip(), 'start': round(w.start, 3), 'end': round(w.end, 3)} for s in r.segments for w in (s.words or []) if w.word.strip()]
    segs = [{'text': s.text.strip(), 'start': round(s.start, 3), 'end': round(s.end, 3)} for s in r.segments if s.text.strip()]
    dur = max([w['end'] for w in words] + [0.0])
    j = {'source': os.path.abspath(f), 'model': f'whisper-{name}', 'aligned': not a.no_align, 'duration': dur,
         'text': ' '.join(s['text'] for s in segs), 'segments': segs, 'words': words}
    json.dump(j, open(os.path.join(out, stem + '.json'), 'w', encoding='utf-8'), indent=1)
    open(os.path.join(out, stem + '.txt'), 'w', encoding='utf-8').write(j['text'] + '\n')
    print(f'{stem}: {len(words)} words')
