# A sideways push transition (the Everest reference's E13 -> E14 "black bar slide"): the incoming shot slides in from
# the right, a black bar between the two, the outgoing shot is pushed out to the left. Writes into an assembled frame
# folder in place:
#   .venv/Scripts/python.exe tools/slide.py <assembled_dir> <out_dir_of_outgoing_shot> <hold_frame> <in_shot_dir> <f0> <f1> [--bar 0.06]
# Frames f0..f1 of the film become the slide; the outgoing picture is its frame <hold_frame> (before its own exit
# effects), the incoming one is its own frame f (render the incoming shot early: run.py --frames f0-f1).
import os, sys
from PIL import Image

A, outd, hold, ind, f0, f1 = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], int(sys.argv[5]), int(sys.argv[6])
bar = float(sys.argv[sys.argv.index('--bar') + 1]) if '--bar' in sys.argv else 0.06
pic = lambda d, f: Image.open(os.path.join(d, f'{f:04d}.png')).convert('RGB')
old = pic(outd, hold); W, H = old.size; bw = int(W * bar)
for f in range(f0, f1 + 1):
    k = (f - f0 + 1) / (f1 - f0 + 1)
    k = k * k * (3 - 2 * k)                      # ease
    x = int(round((W + bw) * k))                 # how far the incoming panel has come in
    new = pic(ind, f)
    fr = Image.new('RGB', (W, H), (0, 0, 0))
    fr.paste(old, (-x, 0))
    fr.paste(new, (W + bw - x, 0))
    fr.save(os.path.join(A, f'{f:04d}.png'))
print('SLIDE', f0, f1, 'into', A)
