# tk_desk_phone LCD: a backlit teal-green display (3:1) with the line, the time and a voicemail count.
#   .venv/Scripts/python.exe assets/props/tex/make_tk_desk_phone.py
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FB, FA = 'C:/Windows/Fonts/ariblk.ttf', 'C:/Windows/Fonts/arialbd.ttf'
S = 2
im = Image.new('RGB', (300 * S, 100 * S), (150, 226, 196))
d = ImageDraw.Draw(im)
for y in range(100 * S):                       # brighter backlight in the middle
    k = 1 - abs(y / (100 * S) - 0.5) * 0.25
    d.line([(0, y), (300 * S, y)], fill=(int(150 * k), int(226 * k), int(196 * k)))
ink = (28, 64, 54)
d.text((14 * S, 8 * S), 'LINE 1', font=ImageFont.truetype(FB, 30 * S), fill=ink)
d.text((14 * S, 50 * S), '10:42', font=ImageFont.truetype(FB, 38 * S), fill=ink)
d.rounded_rectangle((190 * S, 12 * S, 286 * S, 44 * S), radius=6 * S, fill=ink)
d.text((200 * S, 14 * S), 'VM 3', font=ImageFont.truetype(FB, 22 * S), fill=(150, 226, 196))
d.text((190 * S, 58 * S), 'PM', font=ImageFont.truetype(FB, 26 * S), fill=ink)
im = im.resize((300, 100), Image.LANCZOS)
im.save(os.path.join(HERE, 'tk_desk_phone_lcd.png'))
print('tk_desk_phone texture done')
