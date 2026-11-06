# Printed graphics for the OFFICE set dressing (film/japan/dress_office.py and the off_* props): company banner,
# slogan boards, org chart, KPI board, in/out board, exit pictogram, fire-extinguisher sign, recycling labels, notices,
# award certificate, desk calendar, name plates, copier panel, water-server label, binder spines, year planner.
# Bold flat cartoon graphics, big readable shapes, Yu Gothic Bold for Japanese, Arial Black for latin.
#   .venv/Scripts/python.exe assets/props/tex/make_off_signs.py      -> assets/props/tex/off_*.png
import math, os, random
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
F = 'C:/Windows/Fonts/'
INK, CREAM, PAPER = '#2a2622', '#f2efe6', '#f6f2e8'
NAVY, RED, ORANGE, YELLOW, GREEN, TEAL, BLUE, PINK = '#22355e', '#d0302a', '#e8812f', '#f2c230', '#2f8a55', '#1f7385', '#3a63c4', '#e86a8a'
PURPLE, SKY, GOLD = '#7d5ab8', '#6fb6e0', '#d9a520'


def jp(size): return ImageFont.truetype(F + 'YuGothB.ttc', size, index=0)
def blk(size): return ImageFont.truetype(F + 'ariblk.ttf', size)
def bold(size): return ImageFont.truetype(F + 'arialbd.ttf', size)


def ctext(d, xy, s, font, fill=INK, stroke=0, sfill=INK, anchor='mm'):
    d.text(xy, s, font=font, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=sfill)


def rrect(d, box, r, fill, outline=INK, width=6):
    d.rounded_rectangle(box, r, fill=fill, outline=outline, width=width)


def head(d, cx, cy, r, body=NAVY):
    """A tiny round-headed stick person bust (our cast's look): white head, coloured shoulders."""
    d.pieslice((cx - r * 1.3, cy + r * 0.55, cx + r * 1.3, cy + r * 3.0), 180, 360, fill=body, outline=INK, width=max(2, r // 6))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill='#f4f3ef', outline=INK, width=max(2, r // 6))
    e = max(2, r // 6)
    d.ellipse((cx - r * 0.42 - e, cy - e, cx - r * 0.42 + e, cy + e), fill=INK)
    d.ellipse((cx + r * 0.42 - e, cy - e, cx + r * 0.42 + e, cy + e), fill=INK)
    d.arc((cx - r * 0.4, cy - r * 0.1, cx + r * 0.4, cy + r * 0.55), 20, 160, fill=INK, width=max(2, r // 8))


def save(im, name):
    p = os.path.join(HERE, name); im.save(p); print('wrote', p, im.size)


def hanko(d, cx, cy, r, s='承認'):
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=RED, width=max(3, r // 7))
    ctext(d, (cx, cy), s[0] if len(s) == 1 else s, jp(int(r * (1.1 if len(s) == 1 else 0.62))), fill=RED)


# ------------------------------------------------------------------ company banner (3.2 x 0.5 m)
def banner():
    W, H = 2048, 320
    im = Image.new('RGB', (W, H), NAVY); d = ImageDraw.Draw(im)
    d.rectangle((14, 14, W - 15, H - 15), outline=YELLOW, width=6)
    # logo: an orange sun rising over two cream waves in a rounded square
    rrect(d, (50, 40, 290, 280), 40, CREAM, outline=INK, width=8)
    d.ellipse((95, 70, 245, 220), fill=ORANGE, outline=INK, width=7)
    for k, y in enumerate((178, 222)):
        pts = [(62 + i * 4, y + 14 * math.sin(i * 0.22 + k)) for i in range(57)]
        d.line(pts, fill=TEAL, width=26)
    rrect(d, (50, 40, 290, 280), 40, None, outline=INK, width=8)
    ctext(d, (900, 140), '日の出商事', jp(170), fill=CREAM, stroke=4, sfill=INK)
    ctext(d, (900, 258), 'HINODE SHOJI  CO., LTD.', blk(52), fill=YELLOW)
    # right: the company motto in a red badge
    rrect(d, (1500, 60, 2000, 260), 30, RED, outline=INK, width=7)
    ctext(d, (1750, 128), '挑戦と誠実', jp(92), fill=CREAM)
    ctext(d, (1750, 215), 'CHALLENGE · SINCERITY', blk(30), fill=YELLOW)
    save(im, 'off_banner.png')


# ------------------------------------------------------------------ framed slogan boards (portrait 0.5 x 0.7 m)
def slogan(name, big, sub, small, accent, vertical=False):
    W, H = 700, 980
    im = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 150), fill=accent); d.line((0, 150, W, 150), fill=INK, width=8)
    ctext(d, (W / 2, 78), sub, blk(64), fill=CREAM, stroke=3, sfill=INK)
    if vertical:
        n = len(big); fs = min(250, int(620 / n))
        y0 = 160 + (640 - n * fs) / 2
        for i, ch in enumerate(big):
            ctext(d, (W / 2, y0 + fs * 0.5 + i * fs), ch, jp(fs), fill=INK)
    else:
        fs = min(300, int(620 / len(big)))
        ctext(d, (W / 2, 470), big, jp(fs), fill=INK)
    ctext(d, (W / 2, 860), small, jp(54), fill='#5d5650')
    hanko(d, W - 95, H - 210, 52, '印')
    save(im, f'off_slogan_{name}.png')


# ------------------------------------------------------------------ org chart (1.3 x 0.95 m)
def orgchart():
    W, H = 1300, 950
    im = Image.new('RGB', (W, H), '#f4f6f2'); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 120), fill=TEAL); d.line((0, 120, W, 120), fill=INK, width=8)
    ctext(d, (W / 2 - 170, 62), '組織図', jp(84), fill=CREAM, stroke=3, sfill=INK)
    ctext(d, (W / 2 + 190, 64), 'ORGANIZATION', blk(54), fill=YELLOW)
    cols = [RED, BLUE, GREEN, ORANGE, PURPLE]

    def card(cx, cy, w, c, label):
        rrect(d, (cx - w / 2, cy - 70, cx + w / 2, cy + 82), 18, '#ffffff', outline=INK, width=6)
        d.rectangle((cx - w / 2 + 6, cy + 40, cx + w / 2 - 6, cy + 76), fill=c)
        head(d, cx, cy - 18, 30, body=c)
        ctext(d, (cx, cy + 59), label, jp(28), fill=CREAM)
    top = (W / 2, 250)
    mids = [(220, 520), (520, 520), (820, 520), (1100, 520)]
    lw = 8
    d.line((top[0], top[1] + 82, top[0], 410), fill=INK, width=lw)
    d.line((mids[0][0], 410, mids[-1][0], 410), fill=INK, width=lw)
    for i, (x, y) in enumerate(mids):
        d.line((x, 410, x, y - 70), fill=INK, width=lw)
        d.line((x, y + 82, x, 690), fill=INK, width=lw)
        for j, dx in enumerate((-62, 62)):
            d.line((x, 690, x + dx, 690), fill=INK, width=lw)
            d.line((x + dx, 690, x + dx, 730), fill=INK, width=lw)
            cx, cy = x + dx, 800
            rrect(d, (cx - 52, cy - 66, cx + 52, cy + 66), 14, '#ffffff', outline=INK, width=5)
            head(d, cx, cy - 18, 24, body=cols[i])
            d.rectangle((cx - 44, cy + 34, cx + 44, cy + 58), fill='#d8d4cc')
    card(*top, 260, NAVY, '社長')
    for i, (x, y) in enumerate(mids):
        card(x, y, 200, cols[i], ['営業部', '経理部', '総務部', '開発部'][i])
    # one card with a red X sticker (the empty seat): a tiny foreshadowing gag
    d.line((1162 - 40, 760, 1162 + 40, 840), fill=RED, width=12); d.line((1162 + 40, 760, 1162 - 40, 840), fill=RED, width=12)
    save(im, 'off_orgchart.png')


# ------------------------------------------------------------------ KPI / monthly target board (1.2 x 0.9 m)
def kpi():
    W, H = 1200, 900
    im = Image.new('RGB', (W, H), '#fbf7ea'); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 130), fill=RED); d.line((0, 130, W, 130), fill=INK, width=8)
    ctext(d, (330, 68), '今月の目標', jp(80), fill=CREAM, stroke=3, sfill=INK)
    ctext(d, (860, 70), 'MONTHLY TARGET', blk(56), fill=YELLOW)
    # bar chart with a dashed target line
    x0, y0, x1, y1 = 90, 200, 760, 800
    d.line((x0, y1, x1, y1), fill=INK, width=8); d.line((x0, y0, x0, y1), fill=INK, width=8)
    vals = [0.42, 0.55, 0.5, 0.68, 0.81, 0.93]
    cs = [BLUE, BLUE, BLUE, GREEN, GREEN, ORANGE]
    bw = (x1 - x0 - 40) / len(vals)
    for i, v in enumerate(vals):
        bx = x0 + 30 + i * bw
        d.rectangle((bx, y1 - v * (y1 - y0), bx + bw * 0.7, y1 - 4), fill=cs[i], outline=INK, width=6)
        ctext(d, (bx + bw * 0.35, y1 + 40), f'{i + 5}月', jp(34))
    ty = y1 - 0.85 * (y1 - y0)
    for xx in range(x0, x1, 40): d.line((xx, ty, xx + 22, ty), fill=RED, width=8)
    ctext(d, (x1 - 20, ty - 30), '目標', jp(38), fill=RED, anchor='rm')
    # right column: a donut "達成率 87 %" and gold stars
    cx, cy, r = 980, 370, 150
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill='#d8d4cc', outline=INK, width=6)
    d.pieslice((cx - r, cy - r, cx + r, cy + r), -90, -90 + 360 * 0.87, fill=GREEN, outline=INK, width=6)
    d.ellipse((cx - r * 0.58, cy - r * 0.58, cx + r * 0.58, cy + r * 0.58), fill='#fbf7ea', outline=INK, width=6)
    ctext(d, (cx, cy - 10), '87%', blk(64)); ctext(d, (cx, cy + 50), '達成率', jp(30))
    for k, (sx, sy, sr) in enumerate(((880, 640, 56), (1010, 600, 70), (1120, 680, 46), (960, 770, 40))):
        pts = []
        for j in range(10):
            a = -math.pi / 2 + j * math.pi / 5; rr = sr if j % 2 == 0 else sr * 0.45
            pts.append((sx + rr * math.cos(a), sy + rr * math.sin(a)))
        d.polygon(pts, fill=YELLOW, outline=INK, width=5)
    save(im, 'off_kpi.png')


# ------------------------------------------------------------------ in/out board 行先表示板 (1.2 x 0.85 m)
def inout():
    W, H = 1200, 850
    im = Image.new('RGB', (W, H), '#fdfdfb'); d = ImageDraw.Draw(im)
    names = ['田中', '佐藤', '鈴木', '高橋', '伊藤', '渡辺', '山本', '中村']
    dest = ['', '会議室A', '', '出張 大阪', '', '直帰', '', '外出']
    ctext(d, (W / 2, 55), '行先表示板  WHERE ARE WE?', jp(56), fill=NAVY)
    d.line((30, 100, W - 30, 100), fill=NAVY, width=6)
    cols = (40, 260, 380, 500, 1160)
    ctext(d, (150, 132), '名前', jp(36)); ctext(d, (320, 132), '在席', jp(36)); ctext(d, (440, 132), '外出', jp(36)); ctext(d, (830, 132), '行先', jp(36))
    for i, n in enumerate(names):
        y = 170 + i * 82
        d.line((30, y, W - 30, y), fill='#9aa3ad', width=4)
        rrect(d, (52, y + 10, 248, y + 72), 10, ['#ffe08a', '#bfe3f2', '#ffd1dc', '#c9efc4'][i % 4], outline=INK, width=4)
        ctext(d, (150, y + 42), n, jp(44))
        inn = dest[i] == ''
        cx = 320 if inn else 440
        d.ellipse((cx - 26, y + 15, cx + 26, y + 67), fill=GREEN if inn else RED, outline=INK, width=5)
        if dest[i]: ctext(d, (560, y + 42), dest[i], jp(44), fill=BLUE, anchor='lm')
    for x in cols[1:4]: d.line((x, 110, x, 170 + 8 * 82), fill='#9aa3ad', width=4)
    save(im, 'off_inout.png')


# ------------------------------------------------------------------ emergency exit pictogram (green, lit)
def exit_sign():
    W, H = 800, 320
    im = Image.new('RGB', (W, H), '#1f9a4e'); d = ImageDraw.Draw(im)
    # white door opening on the left, a running figure heading into it
    d.rectangle((40, 40, 230, 280), fill='#f4fff4'); d.rectangle((70, 66, 205, 280), fill='#1f9a4e')
    g = '#f4fff4'
    d.ellipse((322, 52, 382, 112), fill=g)
    body = [(300, 130), (360, 118), (330, 205)]
    d.line(body, fill=g, width=40, joint='curve')
    d.line([(330, 200), (270, 240), (250, 290)], fill=g, width=34, joint='curve')
    d.line([(330, 200), (380, 240), (430, 236)], fill=g, width=34, joint='curve')
    d.line([(350, 125), (290, 165), (255, 150)], fill=g, width=28, joint='curve')
    d.line([(350, 125), (400, 160), (430, 140)], fill=g, width=28, joint='curve')
    # arrow and text
    d.polygon([(470, 160), (520, 110), (520, 140), (600, 140), (600, 180), (520, 180), (520, 210)], fill=g)
    ctext(d, (700, 125), '非常口', jp(66), fill=g)
    ctext(d, (700, 210), 'EXIT', blk(70), fill=g)
    save(im, 'off_exit.png')


def fire_sign():
    W, H = 260, 640
    im = Image.new('RGB', (W, H), RED); d = ImageDraw.Draw(im)
    d.rectangle((10, 10, W - 11, H - 11), outline=CREAM, width=8)
    for i, ch in enumerate('消火器'):
        ctext(d, (W / 2, 120 + i * 175), ch, jp(150), fill=CREAM)
    save(im, 'off_fire_sign.png')


def bin_labels():
    for key, txt, en, c in (('burn', '可燃ごみ', 'BURNABLE', RED), ('pet', 'ペットボトル', 'PET', BLUE), ('can', '缶・びん', 'CANS', GREEN)):
        W, H = 400, 300
        im = Image.new('RGB', (W, H), CREAM); d = ImageDraw.Draw(im)
        d.rectangle((0, 0, W, 90), fill=c)
        ctext(d, (W / 2, 46), en, blk(52), fill=CREAM)
        ctext(d, (W / 2, 175), txt, jp(min(86, int(360 / len(txt) * 1.05))), fill=INK)
        # a simple pictogram row
        if key == 'burn':
            d.polygon([(W / 2 - 30, 280), (W / 2, 220), (W / 2 + 30, 280)], fill=ORANGE, outline=INK)
        elif key == 'pet':
            d.rounded_rectangle((W / 2 - 18, 218, W / 2 + 18, 290), 10, fill=SKY, outline=INK, width=4)
        else:
            d.rectangle((W / 2 - 24, 225, W / 2 + 24, 290), fill='#c9cdd2', outline=INK, width=4)
        save(im, f'off_bin_{key}.png')


# ------------------------------------------------------------------ notices (A4-ish, 0.21 x 0.297)
def notices():
    random.seed(7)
    specs = [('health', '健康診断', 'HEALTH CHECK', TEAL), ('drill', '防災訓練', 'FIRE DRILL', RED),
             ('power', '節電', 'SAVE POWER', ORANGE), ('duty', '今週の当番', 'THIS WEEK', BLUE),
             ('lunch', '社食メニュー', 'LUNCH MENU', GREEN), ('party', '歓迎会', 'WELCOME PARTY', PINK)]
    for key, jt, en, c in specs:
        W, H = 420, 594
        im = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(im)
        d.rectangle((0, 0, W, 120), fill=c)
        ctext(d, (W / 2, 52), jt, jp(min(76, int(380 / len(jt)))), fill=CREAM)
        ctext(d, (W / 2, 102), en, blk(28), fill=CREAM)
        if key in ('duty', 'lunch'):
            for r in range(5):
                y = 160 + r * 74
                d.rectangle((30, y, W - 30, y + 60), outline=INK, width=4)
                d.rectangle((30, y, 120, y + 60), fill=['#ffe08a', '#bfe3f2', '#ffd1dc', '#c9efc4', '#e8dcff'][r], outline=INK, width=4)
                ctext(d, (75, y + 30), '月火水木金'[r], jp(36))
                d.line((140, y + 30, 140 + random.randint(120, 230), y + 30), fill='#8a847a', width=10)
        elif key == 'health':
            for r in range(5):
                for cc in range(7):
                    x, y = 40 + cc * 50, 170 + r * 50
                    d.rectangle((x, y, x + 44, y + 44), outline='#9aa3ad', width=3, fill=(RED if (r, cc) in ((2, 3), (2, 4)) else None))
            ctext(d, (W / 2, 470), '10/28-29', blk(52), fill=RED)
            d.line((60, 540, W - 60, 540), fill='#8a847a', width=10)
        elif key == 'drill':
            d.pieslice((110, 170, 310, 370), 180, 360, fill=YELLOW, outline=INK, width=6)   # helmet
            d.rectangle((90, 268, 330, 290), fill=YELLOW, outline=INK, width=6)
            ctext(d, (W / 2, 420), '11/5 14:00', blk(50), fill=INK)
            for k in range(2): d.line((60, 490 + k * 40, W - 60 - k * 80, 490 + k * 40), fill='#8a847a', width=10)
        elif key == 'power':
            d.ellipse((140, 170, 280, 310), fill=YELLOW, outline=INK, width=6); d.rectangle((180, 305, 240, 350), fill='#9aa3ad', outline=INK, width=5)
            ctext(d, (W / 2, 420), '28°C', blk(80), fill=ORANGE)
            d.line((60, 520, W - 60, 520), fill='#8a847a', width=10)
        else:
            for k in range(6):
                x, y = 70 + (k % 3) * 120, 200 + (k // 3) * 130
                d.ellipse((x - 40, y - 40, x + 40, y + 40), fill=[YELLOW, PINK, SKY][k % 3], outline=INK, width=5)
            ctext(d, (W / 2, 480), '11/8 (金)', jp(60), fill=INK)
        save(im, f'off_notice_{key}.png')


def certificate():
    W, H = 600, 440
    im = Image.new('RGB', (W, H), '#fffaf0'); d = ImageDraw.Draw(im)
    for k, c in enumerate((GOLD, '#fffaf0', GOLD)):
        d.rectangle((12 + k * 10, 12 + k * 10, W - 13 - k * 10, H - 13 - k * 10), outline=c, width=8)
    ctext(d, (W / 2, 110), '表彰状', jp(96), fill=INK)
    ctext(d, (W / 2, 190), 'CERTIFICATE', blk(36), fill=GOLD)
    for k in range(3): d.line((110, 250 + k * 40, W - 110 - (k == 2) * 120, 250 + k * 40), fill='#9a958a', width=8)
    hanko(d, W - 120, H - 85, 46, '賞')
    save(im, 'off_certificate.png')


def desk_calendar():
    W, H = 360, 280
    im = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 70), fill=RED)
    ctext(d, (W / 2, 36), '10月  OCT', jp(44), fill=CREAM)
    for r in range(4):
        for c in range(7):
            x, y = 22 + c * 46, 90 + r * 46
            ctext(d, (x + 18, y + 18), str(1 + r * 7 + c), bold(26), fill=(RED if c == 0 else BLUE if c == 6 else INK))
    d.ellipse((22 + 4 * 46 - 4, 90 + 3 * 46 - 6, 22 + 4 * 46 + 42, 90 + 3 * 46 + 42), outline=RED, width=5)
    save(im, 'off_desk_calendar.png')


def nameplates():
    for i, (n, en) in enumerate((('田中', 'TANAKA'), ('佐藤', 'SATO'), ('鈴木', 'SUZUKI'), ('高橋', 'TAKAHASHI'),
                                 ('伊藤', 'ITO'), ('山本', 'YAMAMOTO'), ('中村', 'NAKAMURA'), ('小林', 'KOBAYASHI'))):
        W, H = 400, 120
        im = Image.new('RGB', (W, H), '#2b3a5c' if i % 2 else '#f2efe6'); d = ImageDraw.Draw(im)
        fg = CREAM if i % 2 else INK
        ctext(d, (W / 2, 50), n, jp(64), fill=fg)
        ctext(d, (W / 2, 102), en, blk(22), fill=YELLOW if i % 2 else '#8a5a32')
        save(im, f'off_nameplate{i}.png')


def copier_panel():
    W, H = 400, 220
    im = Image.new('RGB', (W, H), '#2c4f86'); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 44), fill='#173055')
    ctext(d, (W / 2, 23), 'READY  準備完了', jp(26), fill='#bfe3f2')
    for k, (t, c) in enumerate((('コピー', ORANGE), ('スキャン', GREEN), ('FAX', SKY))):
        x = 20 + k * 126
        rrect(d, (x, 64, x + 110, 196), 14, c, outline='#173055', width=4)
        ctext(d, (x + 55, 166), t, jp(24 if len(t) > 3 else 30), fill='#ffffff')
        d.rectangle((x + 32, 82, x + 78, 136), fill='#ffffff')
    save(im, 'off_copier_panel.png')


def water_label():
    W, H = 300, 300
    im = Image.new('RGB', (W, H), '#ffffff'); d = ImageDraw.Draw(im)
    d.polygon([(150, 40), (205, 140), (150, 190), (95, 140)], fill=SKY, outline=INK)
    d.ellipse((95, 95, 205, 200), fill=SKY, outline=INK, width=5)
    ctext(d, (150, 240), '天然水', jp(56), fill=BLUE)
    save(im, 'off_water_label.png')


def binder_spines():
    """A strip of 12 spine labels (white label with a title + number), sampled per binder by UV offset."""
    W, H = 1200, 400
    im = Image.new('RGB', (W, H), '#ffffff'); d = ImageDraw.Draw(im)
    t = ['経理', '営業', '総務', '人事', '契約', '会議', '見積', '請求', '報告', '計画', '資料', '議事録']
    for i in range(12):
        x = i * 100
        d.rectangle((x + 2, 2, x + 97, H - 3), fill='#fbfaf5', outline='#cfcac0', width=3)
        for j, ch in enumerate(t[i][:3]):
            ctext(d, (x + 50, 60 + j * 78), ch, jp(64))
        ctext(d, (x + 50, H - 60), str(2020 + i % 7), bold(30), fill=RED)
    save(im, 'off_binder_spines.png')


def year_planner():
    W, H = 1600, 700
    im = Image.new('RGB', (W, H), '#fdfdfb'); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 100), fill=NAVY)
    ctext(d, (W / 2, 52), '2026 年間予定表   YEAR PLANNER', jp(58), fill=CREAM)
    random.seed(3)
    for m in range(12):
        x = 30 + m * 128
        d.rectangle((x, 115, x + 120, 165), fill=['#ffe08a', '#bfe3f2', '#ffd1dc', '#c9efc4'][m % 4], outline=INK, width=3)
        ctext(d, (x + 60, 140), f'{m + 1}月', jp(32))
        for r in range(9):
            y = 180 + r * 56
            d.rectangle((x, y, x + 120, y + 50), outline='#cfd3d6', width=2)
            if random.random() < 0.38:
                c = random.choice([RED, BLUE, GREEN, ORANGE, PURPLE, TEAL])
                w = random.randint(40, 120)
                d.rounded_rectangle((x + 4, y + 10, x + min(116, 4 + w), y + 40), 8, fill=c)
    save(im, 'off_planner.png')


def banner_slogan():
    """Fabric slogan banner above the windows: 'everyone together: hit the target!' on cream with red bands."""
    W, H = 2048, 220
    im = Image.new('RGB', (W, H), '#fbf5e6'); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 22), fill=RED); d.rectangle((0, H - 22, W, H), fill=RED)
    ctext(d, (W / 2 - 120, H / 2 + 2), '全員で 目標達成！', jp(118), fill=RED, stroke=3, sfill='#7a1410')
    ctext(d, (W - 250, H / 2 + 4), 'ALL TOGETHER!', blk(44), fill=NAVY)
    for x in (70, W - 520):
        pts = []
        for j in range(10):
            a = -math.pi / 2 + j * math.pi / 5; rr = 52 if j % 2 == 0 else 23
            pts.append((x + rr * math.cos(a), H / 2 + rr * math.sin(a)))
        d.polygon(pts, fill=YELLOW, outline=INK, width=4)
    save(im, 'off_banner_slogan.png')


def dept_signs():
    for key, jt, en, c in (('sales', '営業部', 'SALES', RED), ('soumu', '総務部', 'GENERAL AFFAIRS', GREEN), ('keiri', '経理部', 'ACCOUNTING', BLUE)):
        W, H = 720, 240
        im = Image.new('RGB', (W, H), c); d = ImageDraw.Draw(im)
        d.rectangle((10, 10, W - 11, H - 11), outline=CREAM, width=8)
        ctext(d, (W / 2, 100), jt, jp(110), fill=CREAM, stroke=3, sfill=INK)
        ctext(d, (W / 2, 196), en, blk(40), fill=YELLOW)
        save(im, f'off_dept_{key}.png')


def photos():
    """Framed company photos (4:3): the head-office building, the founder (sepia), the team, a trophy win, the trip."""
    def base(sky):
        im = Image.new('RGB', (400, 300), sky); return im, ImageDraw.Draw(im)
    im, d = base('#9fd1ee')                                       # head office tower with the logo on top
    d.rectangle((0, 240, 400, 300), fill='#7fae6a')
    d.rectangle((130, 50, 270, 260), fill='#5d84ab', outline=INK, width=5)
    for r in range(6):
        for c in range(4): d.rectangle((145 + c * 32, 70 + r * 30, 165 + c * 32, 88 + r * 30), fill='#d4ebf7')
    d.ellipse((175, 10, 225, 60), fill=ORANGE, outline=INK, width=4)
    d.rectangle((20, 180, 110, 260), fill='#8daccb', outline=INK, width=4); d.rectangle((290, 150, 380, 260), fill='#a0aed0', outline=INK, width=4)
    save(im, 'off_photo_bldg.png')
    im, d = base('#d9c39a')                                       # the founder, sepia
    d.rectangle((0, 0, 400, 300), fill='#cdb88f'); d.rectangle((20, 20, 380, 280), outline='#8a7350', width=6)
    head(d, 200, 120, 62, body='#5a4632')
    d.line((165, 150, 235, 150), fill=INK, width=10)            # moustache
    d.ellipse((150, 100, 190, 135), outline=INK, width=5); d.ellipse((210, 100, 250, 135), outline=INK, width=5)
    save(im, 'off_photo_founder.png')
    im, d = base('#bfe3f2')                                       # the team
    d.rectangle((0, 230, 400, 300), fill='#e8dcc6')
    for k, (x, c) in enumerate(((70, RED), (140, BLUE), (210, GREEN), (280, ORANGE), (350, PURPLE))):
        head(d, x, 150 - (k % 2) * 14, 30, body=c)
    rrect(d, (90, 30, 310, 80), 10, RED, outline=INK, width=4); ctext(d, (200, 56), '2025 チーム', jp(30), fill=CREAM)
    save(im, 'off_photo_team.png')
    im, d = base('#ffe7a3')                                       # trophy win
    for x, c in ((130, BLUE), (270, GREEN)): head(d, x, 150, 40, body=c)
    d.polygon([(175, 120), (225, 120), (215, 190), (185, 190)], fill=GOLD, outline=INK, width=5)
    d.rectangle((178, 190, 222, 215), fill='#5a4030', outline=INK, width=4)
    for k in range(12):
        x, y = 30 + k * 31 % 360, 30 + (k * 53) % 90
        d.rectangle((x, y, x + 12, y + 8), fill=[RED, BLUE, GREEN, PINK][k % 4])
    save(im, 'off_photo_trophy.png')
    im, d = base('#a2d1ee')                                       # the company trip
    d.polygon([(60, 230), (200, 60), (340, 230)], fill='#5d84ab', outline=INK, width=5)
    d.polygon([(160, 108), (200, 60), (240, 108), (220, 100), (200, 115), (180, 100)], fill='#f6f2e8')
    d.rectangle((0, 230, 400, 300), fill='#7fae6a')
    for k, x in enumerate((110, 170, 230, 290)): head(d, x, 235, 22, body=[RED, NAVY, TEAL, ORANGE][k])
    save(im, 'off_photo_trip.png')


def caution():
    """Face of the yellow A-frame floor sign: 足元注意 (watch your step) with a slipping round-headed figure."""
    W, H = 400, 620
    im = Image.new('RGB', (W, H), YELLOW); d = ImageDraw.Draw(im)
    d.rectangle((14, 14, W - 15, H - 15), outline=INK, width=10)
    rrect(d, (40, 40, W - 40, 150), 16, INK, outline=INK, width=4)
    ctext(d, (W / 2, 95), '注意', jp(84), fill=YELLOW)
    # warning triangle with the slipping figure
    d.polygon([(W / 2, 175), (W - 50, 430), (50, 430)], fill='#fbf5e6', outline=INK, width=10)
    d.ellipse((205, 255, 255, 305), fill='#f4f3ef', outline=INK, width=6)
    d.line([(222, 305), (190, 360)], fill=INK, width=14)
    d.line([(190, 360), (150, 380), (130, 410)], fill=INK, width=12); d.line([(190, 360), (240, 385), (275, 372)], fill=INK, width=12)
    d.line([(212, 320), (160, 310)], fill=INK, width=10); d.line([(212, 320), (262, 340)], fill=INK, width=10)
    d.line((80, 415, 320, 415), fill='#3a8fd6', width=10)
    ctext(d, (W / 2, 495), '足元注意', jp(66), fill=INK)
    ctext(d, (W / 2, 568), 'WATCH YOUR STEP', blk(28), fill=INK)
    save(im, 'off_caution.png')


if __name__ == '__main__':
    banner(); banner_slogan(); dept_signs(); photos(); caution()
    slogan('horenso', '報連相', 'HO-REN-SO', '報告・連絡・相談', BLUE, vertical=True)
    slogan('kaizen', '改善', 'KAIZEN', '毎日すこしずつ', GREEN, vertical=True)
    slogan('kokyaku', '顧客第一', 'CUSTOMER FIRST', 'お客様のために', ORANGE)
    slogan('seiri', '整理整頓', 'KEEP IT TIDY', 'きれいな職場', TEAL)
    orgchart(); kpi(); inout(); exit_sign(); fire_sign(); bin_labels(); notices(); certificate()
    desk_calendar(); nameplates(); copier_panel(); water_label(); binder_spines(); year_planner()
