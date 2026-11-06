"""Step 9 - lossless concat of the segments + mux the edited audio (24-bit PCM) + full decode test.
Outputs (OUT, see common.py):  ScreenRecording_Edited.mov, Facecam_Edited.mov (only with synced cameras), Edited_Audio.wav
"""
import os, sys, json, subprocess
from collections import Counter
sys.path.insert(0, os.path.dirname(__file__)); from common import load, fps_of, gate, AUDIO, SCREEN_OUT, CAM_OUT
p = load(); tl = json.load(open('timeline.json')); D = tl[-1][2] + (tl[-1][1] - tl[-1][0])
outs = [('screen', SCREEN_OUT, fps_of(p['screen']['fps']))]
if p.get('sync'):
    outs.append(('cam', CAM_OUT, fps_of(Counter(p['cams'][k]['fps'] for k in p['sync']).most_common(1)[0][0])))
elif os.path.exists(CAM_OUT):
    os.remove(CAM_OUT)                                   # no synced camera any more: never leave a stale facecam behind
rec = {}
for which, dst, fps in outs:
    name = os.path.basename(dst); exp = round(D * fps)
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'seg_{which}/list.txt', '-i', AUDIO,
                        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'pcm_s24le', dst], capture_output=True, text=True)
    if r.returncode: print('MUX FAILED', name, r.stderr[-500:]); rec[which] = {'ok': False, 'error': r.stderr[-300:]}; continue
    pr = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,duration,nb_frames', '-of', 'json', dst], capture_output=True, text=True)
    st = json.loads(pr.stdout)['streams']; v = next(s for s in st if s['codec_type'] == 'video'); a = next(s for s in st if s['codec_type'] == 'audio')
    dec = subprocess.run(['ffmpeg', '-v', 'error', '-i', dst, '-map', '0:v', '-f', 'null', '-'], capture_output=True, text=True)
    frames = int(v.get('nb_frames') or 0); clean = not dec.stderr.strip()
    rec[which] = {'ok': frames == exp and clean, 'file': os.path.abspath(dst), 'frames': frames, 'expected': exp, 'decode_clean': clean,
                  'video_s': float(v['duration']), 'audio_s': float(a['duration']), 'mtime': os.path.getmtime(dst)}
    print(f"{name}: video {float(v['duration']):.3f}s / {frames} frames (expected {exp}) | audio {float(a['duration']):.3f}s | "
          f"{os.path.getsize(dst)/1e9:.2f} GB | full decode: {'CLEAN' if clean else 'ERRORS: ' + dec.stderr[-300:]}")
gate('mux', files=rec, duration=D)
