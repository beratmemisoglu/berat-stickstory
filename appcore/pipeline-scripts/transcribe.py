#!/usr/bin/env python3
"""Step 2: transcribe audio/clean.wav to plain text (audio/transcript_raw.txt).

  python transcribe.py <project> [--model turbo|large-v3|medium.en] [--whisper-cpp <dir>] [--lang en]

Uses whisper.cpp if --whisper-cpp points at a build (fastest on GPU), otherwise openai-whisper via
stable-ts (installed by setup.py; uses CUDA automatically when available).

The raw transcript is only a draft. Next, READ it and fix proper nouns, product names, numbers and
homophones ("learned two" -> "learned to"), using the topic's real spellings (look names up when
unsure). Save the corrected text as audio/transcript.txt - align.py force-aligns that exact text, so
what you write there is what the timings and captions will contain.
"""
import argparse, glob, os, shutil, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument('project'); ap.add_argument('--model', default=None); ap.add_argument('--whisper-cpp'); ap.add_argument('--lang', default='en')
a = ap.parse_args()
A = os.path.join(os.path.abspath(a.project), 'audio'); clean = os.path.join(A, 'clean.wav'); out = os.path.join(A, 'transcript_raw.txt')
if not os.path.exists(clean): sys.exit('run audio_prep.py first')

if a.whisper_cpp:
    wc = os.path.abspath(a.whisper_cpp)
    cli = next((p for p in glob.glob(os.path.join(wc, '**', 'whisper-cli*'), recursive=True) if os.path.isfile(p)), None)
    model = a.model if a.model and os.path.exists(a.model) else next(iter(glob.glob(os.path.join(wc, '**', 'ggml-*.bin'), recursive=True)), None)
    if not cli or not model: sys.exit('whisper.cpp build or ggml model not found under ' + wc)
    wav16 = os.path.join(A, 'clean16k.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', clean, '-ar', '16000', '-ac', '1', wav16], check=True)
    subprocess.run([cli, '-m', model, '-f', wav16, '-l', a.lang, '-otxt', '-of', os.path.join(A, 'transcript_raw'), '-t', '8'], check=True)
    txt = open(out, encoding='utf-8').read()
else:
    import torch, stable_whisper
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    model = a.model or ('turbo' if dev == 'cuda' else 'medium.en' if a.lang == 'en' else 'medium')
    print(f'transcribing with openai-whisper "{model}" on {dev} ...')
    m = stable_whisper.load_model(model, device=dev)
    res = m.transcribe(clean, language=a.lang, vad=False, regroup=True)
    txt = res.text
txt = ' '.join(txt.split())
open(out, 'w', encoding='utf-8').write(txt)
print(f'{len(txt.split())} words -> {out}\nNow proofread it and save the corrected version as audio/transcript.txt')
