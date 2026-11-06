"""berat studio's free local voice: Kokoro 82M through kokoro-onnx (offline, CPU).

  python kokoro_tts.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin --job job.json --out source.wav
  python kokoro_tts.py --model ... --voices ... --voice af_heart [--lang en-us] [--speed 1] --say "A line." --out sample.wav

job.json: {"voice": "af_heart", "lang": "en-us", "speed": 1.0, "items": [{"section": 0, "text": "One sentence.", "gap": 0.28}, ...]}
Each item (one sentence) is spoken on its own, trimmed to the voice, then followed by `gap` seconds of silence, so
sentence, paragraph and section pauses are the app's. Writes one 24 kHz mono 16-bit WAV as it goes (a 45-minute script
never sits in memory). Progress on stdout: "ITEM <i> <n> <section>" before each item, "DONE <seconds> <x real time>".
A character's line has its own "voice" (and "lang") in its item; then (and when the job says "spans": true) every item
also says where its voice is in the file, "SPAN <i> <first frame> <end frame>", so the app can level the characters to
the narrator and keep the deliberate pauses. "pre": seconds of silence before an item (a beat before the first words);
"tail": seconds after the last item (its "gap" is ignored there).
"""
import argparse, json, sys, time, wave

import numpy as np


def trim(x, sr):
    """Cut the silence around the voice, keeping a little air (40 ms before, 120 ms after)."""
    idx = np.where(np.abs(x) > 0.01)[0]
    if not len(idx):
        return x
    return fade(x[max(0, idx[0] - int(.04 * sr)): min(len(x), idx[-1] + int(.12 * sr))].copy(), sr)


def fade(x, sr, ms=8):
    """8 ms equal-power fade in and out (at most a quarter of the piece), same length: no tick where pieces join."""
    n = min(int(round(ms * sr / 1000)), len(x) // 4)
    if n > 0:
        g = np.sin(np.pi / 2 * (np.arange(n) + .5) / n).astype(np.float32)
        x[:n] *= g
        x[-n:] *= g[::-1]
    return x


def speak(k, text, voice, speed, lang):
    """One piece of the script as float samples. Kokoro reads at most 510 phonemes at once and some versions crash on a
    longer run without punctuation (the app already cuts long sentences): a piece it refuses is read in two halves."""
    try:
        samples, sr = k.create(text, voice=voice, speed=speed, lang=lang)
        return trim(np.asarray(samples, dtype=np.float32), sr), sr
    except Exception as e:
        words = text.split()
        if len(words) < 6:
            raise
        print(f'(split a piece it could not read in one go: {type(e).__name__})', file=sys.stderr, flush=True)
        mid = len(words) // 2
        a, sr = speak(k, ' '.join(words[:mid]), voice, speed, lang)
        b, _ = speak(k, ' '.join(words[mid:]), voice, speed, lang)
        return np.concatenate([a, b]), sr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--voices', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--job')
    ap.add_argument('--say')
    ap.add_argument('--voice', default='af_heart')
    ap.add_argument('--lang', default='')
    ap.add_argument('--speed', type=float, default=1.0)
    a = ap.parse_args()
    if a.job:
        with open(a.job, encoding='utf-8') as f:
            job = json.load(f)
    elif a.say:
        job = {'voice': a.voice, 'lang': a.lang, 'speed': a.speed, 'items': [{'section': 0, 'text': a.say, 'gap': 0}]}
    else:
        sys.exit('Give --job or --say.')
    voice = job['voice']
    lang = job.get('lang') or ('en-gb' if voice.startswith('b') else 'en-us')
    speed = min(2.0, max(0.5, float(job.get('speed') or 1.0)))
    items = [it for it in job['items'] if str(it.get('text', '')).strip()]
    if not items:
        sys.exit('Nothing to say.')

    from kokoro_onnx import Kokoro               # after the arguments: a missing package says so plainly
    k = Kokoro(a.model, a.voices)
    for v in [voice] + [it['voice'] for it in items if it.get('voice')]:
        if v not in k.voices:
            sys.exit(f'The voice {v} is not in {a.voices}.')
    cast = job.get('spans') or any(it.get('voice') for it in items)   # say where each item's voice is

    t0, sr, frames = time.time(), 24000, 0
    with wave.open(a.out, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        for i, it in enumerate(items):
            print(f'ITEM {i + 1} {len(items)} {int(it.get("section", 0))}', flush=True)
            pre = int(float(it.get('pre') or 0) * sr)
            if pre > 0:
                w.writeframes(np.zeros(pre, dtype=np.int16).tobytes())
                frames += pre
            y, sr_item = speak(k, it['text'].strip(), it.get('voice') or voice, speed, it.get('lang') or lang)
            if cast:
                print(f'SPAN {i + 1} {frames} {frames + len(y)}', flush=True)
            gap = float(it.get('gap') or 0) if i < len(items) - 1 else float(it.get('tail') or 0)
            if gap > 0:
                y = np.concatenate([y, np.zeros(int(gap * sr_item), dtype=np.float32)])
            w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
            frames += len(y)
    secs = frames / sr
    print(f'DONE {secs:.2f} {secs / max(.01, time.time() - t0):.1f}', flush=True)


if __name__ == '__main__':
    main()
