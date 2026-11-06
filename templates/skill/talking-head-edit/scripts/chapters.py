"""Optional follow-up - transcribe the user's FINAL exported video (with intro, graphics etc.) and print a
timestamped transcript for writing YouTube chapters + tags. Timestamps must come from the final export,
never from the raw edit (the intro shifts everything).
usage: python chapters.py "<final video.mp4>"      -> writes <final>.json/.srt/.txt next to the video
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(__file__)); from common import run_asr, read_asr
src = os.path.abspath(sys.argv[1]); out = os.path.dirname(src)
run_asr([src], out, align=True, p=json.load(open('project.json')) if os.path.exists('project.json') else {})
d = read_asr(os.path.join(out, os.path.splitext(os.path.basename(src))[0] + '.json'))
for s in d['segments']:
    print(f"{int(s['start']//60)}:{int(s['start']%60):02d} {s['text'].strip()}")
