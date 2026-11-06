# Pillow textures for assets/props/wall_calendar.py (original drawings):
#   wall_calendar_<D>.png    one day page per date D of the month: month name, a giant date number, the day name in a
#                            big band (weekdays ink, Saturday blue, Sunday red, the Japanese convention) and the day's
#                            kanji in a stamp circle. 856 x 1032 = the 0.214 x 0.258 m page.
#   wall_calendar_header.png the header card printed on the board (Mt-Fuji-like mountain, red sun, the year)
# run: .venv/Scripts/python.exe assets/props/tex/make_wall_calendar.py [--year 2026] [--month 10] [--days 19-26]
#   the default makes the week Mon 19 - Sun 25 October 2026 plus Mon 26 (the page under Sunday).
import os, sys, calendar, datetime
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('CZ_TEX_OUT') or HERE   # (Toon Studio: the project's .suite/btex, never the app's kit)
FD = 'C:/Windows/Fonts/'
S = 2
W, H = 856, 1032
INK = '#2a2622'; PAPER = '#f4f1e8'; RED = '#d93a32'; BLUE = '#2f62b0'
KANJI = ['月', '火', '水', '木', '金', '土', '日']          # Mon..Sun


def P(*v): return [int(round(x * S)) for x in v]
def font(name, px): return ImageFont.truetype(FD + name, int(px * S))


def fit(d, text, name, max_w, max_h, start=400):
    px = start
    while px > 10:
        f = font(name, px); b = d.textbbox((0, 0), text, font=f)
        if (b[2] - b[0]) / S <= max_w and (b[3] - b[1]) / S <= max_h: return f, b
        px -= 4
    return f, b


def centred(d, text, f, b, cx, cy, fill):
    w, h = (b[2] - b[0]) / S, (b[3] - b[1]) / S
    d.text(P(cx - w / 2 - b[0] / S, cy - h / 2 - b[1] / S), text, font=f, fill=fill)


def page(year, month, day):
    wd = datetime.date(year, month, day).weekday()
    name = calendar.day_name[wd].upper()
    col = BLUE if wd == 5 else RED if wd == 6 else INK
    im = Image.new('RGB', (W * S, H * S), PAPER); d = ImageDraw.Draw(im)
    # month line
    f, b = fit(d, calendar.month_name[month].upper(), 'ariblk.ttf', 520, 64)
    centred(d, calendar.month_name[month].upper(), f, b, W / 2 - 50, 92, col)
    d.line(P(60, 140, W - 60, 140), fill=col, width=5 * S)
    # giant date
    f, b = fit(d, str(day), 'ariblk.ttf', 680, 370, 700)
    centred(d, str(day), f, b, W / 2, 352, col)
    # day band
    d.rounded_rectangle(P(36, 580, W - 36, 936), radius=40 * S, fill=col)
    f, b = fit(d, name, 'ariblk.ttf', W - 130, 230)
    centred(d, name, f, b, W / 2, 758, PAPER)
    # kanji stamp (top right) + little footer ticks
    d.ellipse(P(W - 150, 30, W - 50, 130), outline=col, width=6 * S)
    try:
        fk = ImageFont.truetype(FD + 'YuGothB.ttc', 62 * S); bk = d.textbbox((0, 0), KANJI[wd], font=fk)
        centred(d, KANJI[wd], fk, bk, W - 100, 80, col)
    except OSError:
        pass
    for k in range(7):   # week dots, today's filled
        x = W / 2 + (k - 3) * 44
        c = BLUE if k == 5 else RED if k == 6 else INK
        if k == wd: d.ellipse(P(x - 13, 963, x + 13, 989), fill=c)
        else: d.ellipse(P(x - 9, 967, x + 9, 985), outline=c, width=4 * S)
    return im.resize((W, H), Image.LANCZOS), name


def header(year):
    w, h = 1000, 312
    im = Image.new('RGB', (w * S, h * S), PAPER); d = ImageDraw.Draw(im)
    d.rounded_rectangle(P(0, 0, w, h), radius=28 * S, fill='#bfe0ec')
    for k in range(8):
        t = k / 7; c = tuple(int(a + (b_ - a) * t) for a, b_ in zip((150, 206, 226), (232, 240, 236)))
        d.rectangle(P(0, k * 26, w, k * 26 + 27), fill=c)
    d.rounded_rectangle(P(0, 0, w, h), radius=28 * S, outline=INK, width=6 * S)
    d.ellipse(P(330, 40, 450, 160), fill=RED, outline=INK, width=5 * S)
    d.polygon([tuple(P(*p)) for p in ((40, 312), (250, 110), (300, 130), (330, 112), (560, 312))], fill='#4c6a9c', outline=INK, width=6 * S)
    d.polygon([tuple(P(*p)) for p in ((205, 154), (250, 110), (300, 130), (330, 112), (372, 152), (340, 170), (300, 150), (262, 172), (232, 158))],
              fill=PAPER, outline=INK, width=4 * S)
    for k in range(3):
        d.arc(P(450 + k * 34, 250, 520 + k * 34, 284), 200, 340, fill='#4c6a9c', width=6 * S)
    f, b = fit(d, str(year), 'ariblk.ttf', 360, 150)
    centred(d, str(year), f, b, 800, 130, INK)
    f, b = fit(d, 'DAILY CALENDAR', 'arialbd.ttf', 360, 40)
    centred(d, 'DAILY CALENDAR', f, b, 800, 236, INK)
    # clip the rounded corners to transparent so the board colour shows
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle(P(0, 0, w, h), radius=28 * S, fill=255)
    out = im.convert('RGBA'); out.putalpha(m)
    return out.resize((w, h), Image.LANCZOS)


if __name__ == '__main__':
    a = sys.argv[1:]
    year = int(a[a.index('--year') + 1]) if '--year' in a else 2026
    month = int(a[a.index('--month') + 1]) if '--month' in a else 10
    days = a[a.index('--days') + 1] if '--days' in a else '19-26'
    lo, hi = (int(x) for x in days.split('-')) if '-' in days else (int(days), int(days))
    for dd in range(lo, hi + 1):
        im, nm = page(year, month, dd)
        p = os.path.join(OUT, f'wall_calendar_{dd}.png'); im.save(p); print('wrote', p, nm)
    p = os.path.join(OUT, 'wall_calendar_header.png'); header(year).save(p); print('wrote', p)
