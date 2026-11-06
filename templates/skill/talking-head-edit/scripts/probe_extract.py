"""Step 1 - probe every file, check for VFR, extract all working audio, write project.json.

usage (CWD = <footage folder>/Edit/work):
  python probe_extract.py --screen "<screen recording>" --cam "<facecam 1>" [--cam "<facecam 2>" ...]
The screen recording's audio is the MASTER (good mic). Camera audio is only used for sync.
"""
import argparse, json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__)); from common import save, fmt

ap = argparse.ArgumentParser()
ap.add_argument('--screen', required=True); ap.add_argument('--cam', action='append', default=[])
a = ap.parse_args()

def probe(f):
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
        'format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,sample_rate,channels,bit_rate,nb_frames',
        '-of', 'json', f], capture_output=True, text=True).stdout)
    v = next((s for s in j['streams'] if s['codec_type'] == 'video'), None)
    au = [s for s in j['streams'] if s['codec_type'] == 'audio']
    return {'path': os.path.abspath(f), 'duration': float(j['format']['duration']),
            'fps': v['r_frame_rate'] if v else None, 'avg_fps': v['avg_frame_rate'] if v else None,
            'width': v.get('width') if v else None, 'height': v.get('height') if v else None,
            'vcodec': v['codec_name'] if v else None, 'audio_streams': len(au),
            'acodec': au[0]['codec_name'] if au else None, 'abitrate': au[0].get('bit_rate') if au else None}

p = {'screen': probe(a.screen), 'cams': {}, 'vad_db': None}
for c in a.cam:
    key = os.path.splitext(os.path.basename(c))[0]
    p['cams'][key] = probe(c)

s = p['screen']
print(f"SCREEN {os.path.basename(s['path'])}: {fmt(s['duration'])} | {s['width']}x{s['height']} {s['vcodec']} fps {s['fps']} (avg {s['avg_fps']}) | "
      f"audio {s['acodec']} {s['abitrate']} bps, {s['audio_streams']} stream(s)")
if s['audio_streams'] > 1: print('  NOTE: multiple audio tracks - track 0 is used as master. Check which track holds the good mic.')
if s['abitrate'] and int(s['abitrate']) < 96000: print('  NOTE: low-bitrate master audio - edit cannot add quality back; mention it in the report.')
# VFR check on the first 60 s of packets
pk = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-read_intervals', '%+60', '-show_entries', 'packet=pts_time',
                     '-of', 'csv=p=0', s['path']], capture_output=True, text=True).stdout.split()
ts = sorted(float(x) for x in pk if x.strip())
if len(ts) > 10:
    import numpy as np
    d = np.diff(ts); print(f"  frame timing (first 60 s): dt median {np.median(d)*1000:.2f} ms, max {d.max()*1000:.1f} ms, gaps >1.5x: {(d > 1.5*np.median(d)).sum()}")
    if (d > 1.5 * np.median(d)).sum() > 5: print('  WARNING: looks VFR - renderer is timestamp-based so it copes, but verify frame counts carefully.')
tot = 0
for k, c in p['cams'].items():
    tot += c['duration']
    print(f"CAM {k}: {fmt(c['duration'])} | {c['width']}x{c['height']} {c['vcodec']} fps {c['fps']} | audio {c['acodec']}")
if p['cams']:
    print(f"cams total {fmt(tot)} vs screen {fmt(s['duration'])} -> {'~' + fmt(s['duration'] - tot) + ' of screen time has no camera' if tot < s['duration'] else 'cams cover at least the screen length'}")
save(p)

jobs = [['-i', s['path'], '-map', '0:a:0', '-ac', '1', '-ar', '8000', 'scr8k.wav'],
        ['-i', s['path'], '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', 'scr16.wav'],
        ['-i', s['path'], '-map', '0:a:0', '-c:a', 'pcm_f32le', 'scr48f.wav']]
for k, c in p['cams'].items():
    if c['audio_streams']:
        jobs += [['-i', c['path'], '-map', '0:a:0', '-ac', '1', '-ar', '8000', f'cam_{k}_8k.wav'],
                 ['-i', c['path'], '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', f'cam_{k}_16.wav']]
def ex(j):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y'] + j, capture_output=True, text=True)
    if r.returncode: print('EXTRACT FAILED', j[-1], r.stderr[-300:])
with ThreadPoolExecutor(6) as e: list(e.map(ex, jobs))
print('audio extracted:', ' '.join(j[-1] for j in jobs))
