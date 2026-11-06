# build.py — generates index.html for the "Claude cut my recording" intro (75.43 s, native 2560x1440 @ 60 fps).
# Doctrine: editing-style.md (snapOut entrances / mid repositions / exitIn exits / drift holds).
# Look: minimal glass cards; every waveform is the real envelope of this intro's audio (env.json).
# Times are 60 fps frame-snapped word onsets from words.json (whisper large-v3-turbo + audio-onset snap).
import json, re, random

W = json.load(open('words.json', encoding='utf-8'))
ENV = json.load(open('env.json'))
DUR = 75.43
def q(t): return round(t * 60) / 60

def T(word, after=0.0, n=0):
    k = 0
    for w in W:
        if w['s'] + 1e-6 < after: continue
        if w['w'].lower().strip('.,?!') == word.lower():
            if k == n: return w['s']
            k += 1
    raise SystemExit(f'word not found: {word} after {after}')

H, JS = [], []
def J(s): JS.append(s)
def scene(i, a, b, inner, track=1):
    H.append(f'<div class="scene clip" id="{i}" data-start="{q(a):.3f}" data-duration="{q(b)-q(a):.3f}" data-track-index="{track}">{inner}</div>')
def rampw(sel, times, **o):
    J(f'rampAt("{sel}",{json.dumps([round(t, 3) for t in times])},{json.dumps(o)});')

def env_bars(n, t0=0.0, t1=None, floor=0.12):
    """n bar heights (0..1) sampled from the real audio envelope between t0 and t1."""
    t1 = t1 or len(ENV) / 60
    out = []
    for i in range(n):
        a, b = int((t0 + (t1 - t0) * i / n) * 60), int((t0 + (t1 - t0) * (i + 1) / n) * 60)
        seg = ENV[a:max(b, a + 1)]
        out.append(round(max(floor, max(seg) if seg else floor), 3))
    return out

def cut_mask(n, frac, seed, min_run=2, max_run=7):
    """deterministic runs of removed bars covering ~frac of n."""
    rnd = random.Random(seed); m = [0] * n; target = round(n * frac); i = 2
    while sum(m) < target and i < n - 2:
        i += rnd.randint(1, 5)
        run = rnd.randint(min_run, max_run)
        for j in range(i, min(n - 2, i + run)):
            if sum(m) < target: m[j] = 1
        i += run
    return m

ICON = {
 'minus': '<svg viewBox="0 0 24 24"><path d="M6 12h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
 'check': '<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 'send':  '<svg viewBox="0 0 24 24"><path d="M12 19V6M6.5 11.5L12 6l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
}

# ═══════════ A · 0–14.6 s — the editor panel on the chest band ═══════════
# phase 1: raw recording waveform (51:00) → the cuts collapse out → 27:00, with what was removed
tRaw = T('raw'); t51 = T('51'); t27 = T('27'); tIt = T('it', 5); tBad = T('bad'); tRes = T('restarts'); tDemo = T('demo'); tKept = T('kept')
t500 = T('500'); tAEnd = T('all', 14.4) - 0.1
NB = 150; BW, BG = 8, 4.4                          # bar width + gap (px); strip = 150 * 12.4 = 1860
heights = env_bars(NB, 0, 75, floor=0.1)
mask = cut_mask(NB, 1 - 27 / 51, seed=51)
bars = json.dumps(heights); maskj = json.dumps(mask)
tracks = ''.join(f'<div class="trk" id="trk{k}"><span class="trk-l">{lab}</span><div class="trk-b {cls}" id="trkb{k}"></div></div>' for k, (lab, cls) in enumerate((('Face cam', 'face'), ('Screen rec', 'scr'))))
scene('pA', tRaw - 0.25, tAEnd + 0.7,
      '<div class="n" id="pA-n"><div class="glass edp" id="edp">'
      '<div class="ed-h"><div class="ed-lab"><span id="lab1">Raw recording</span><span id="lab2">Claude\'s edit</span><span id="lab3">Two tracks, one cut list</span></div>'
      '<div class="ed-num"><span id="cnt1">0:00</span><span id="cnt2">0</span></div></div>'
      '<div class="ed-body"><div class="wave" id="wave1"></div>'
      f'<div class="trks" id="trks">{tracks}<div class="cuts" id="cuts"></div><div class="phd" id="phd"></div></div></div></div>'
      '<div class="chips" id="rmchips">'
      + ''.join(f'<div class="mask"><div class="chip" id="rc{k}"><span class="ci red">{ICON["minus"]}</span>{t}</div></div>' for k, t in enumerate(('Bad takes', 'Restarts', 'The failed demo')))
      + '</div></div>')
J(f'const WA=buildWave("#wave1",{bars},{BW},{BG},150);')
J(f'S.cardIn(tl,"#edp",{tRaw-0.2:.3f},{{dir:"down",dist:140,dur:0.85}});')
rampw('#lab1', [tRaw, T('recording')], dur=0.5)
J(f'drawWave(WA,{tRaw+0.05:.3f},1.3);')
J(f'tl.fromTo("#cnt1",{{opacity:0,y:20}},{{opacity:1,y:0,duration:0.5,ease:"snapOut"}},q({t51-0.1:.3f}));S.count(tl,"#cnt1",{t51-0.1:.3f},0,51,0.9,mins);')
J(f'markCuts(WA,{maskj},{T("down",2.9):.3f});collapse(WA,{maskj},{t27-0.1:.3f},0.9);')
J(f'S.count(tl,"#cnt1",{t27-0.1:.3f},51,27,0.9,mins);tl.to("#cnt1",{{color:"#ff9f0a",duration:0.3,ease:"none"}},q({t27:.3f}));')
J(f'S.rampOut(tl,"#lab1",{t27-0.2:.3f});')
rampw('#lab2', [t27 + 0.25, t27 + 0.35], dur=0.5)
for k, a in enumerate((tBad, tRes, tDemo)):
    J(f'S.maskUp(tl,"#rc{k}",{a-0.1:.3f});')
# phase 2: face cam + screen rec kept in sync through ~500 cuts
J(f'tl.to("#rmchips .chip",{{yPercent:115,duration:0.4,ease:"exitIn",stagger:0.04}},q({tKept-0.35:.3f}));')
J(f'tl.to("#wave1",{{yPercent:-120,opacity:0,duration:0.45,ease:"exitIn"}},q({tKept-0.2:.3f}));S.rampOut(tl,"#lab2",{tKept-0.25:.3f});tl.to("#cnt1",{{yPercent:-120,opacity:0,duration:0.4,ease:"exitIn"}},q({tKept-0.25:.3f}));')
J(f'gsap.set("#trks",{{yPercent:120,opacity:0}});tl.to("#trks",{{yPercent:0,opacity:1,duration:0.8,ease:"snapOut"}},q({tKept+0.05:.3f}));')
rampw('#lab3', [T('face', 10), T('recording', 10.3), T('screen'), T('sync')], dur=0.5)
J(f'buildCuts("#cuts",64,{T("through",12.4):.3f},{t500+0.35:.3f});')
J(f'tl.fromTo("#phd",{{x:0}},{{x:1540,duration:{tAEnd-tKept-0.4:.2f},ease:"none"}},q({tKept+0.4:.3f}));')
J(f'gsap.set("#cnt2",{{opacity:0}});tl.fromTo("#cnt2",{{opacity:0,y:20}},{{opacity:1,y:0,duration:0.5,ease:"snapOut"}},q({T("through",12.4)-0.1:.3f}));S.count(tl,"#cnt2",{T("through",12.4)-0.1:.3f},0,500,{t500-T("through",12.4)+0.5:.2f},v=>Math.round(v)+" cuts");')
J(f'S.drift(tl,"#pA-n",{tRaw+0.6:.3f},{tAEnd-tRaw:.2f},{{y:-18}});S.cardOut(tl,"#edp",{tAEnd:.3f},{{dir:"down",dist:360,dur:0.5}});')

# ═══════════ B · 14.6–19.2 s — one prompt · Opus 5.5 · low effort (right column) ═══════════
tOne = T('one', 14.8); tPr = T('prompt'); tOp = T('opus', 16.8); tLow = T('low'); tBEnd = T('and', 19) - 0.1
scene('pB', tOne - 0.4, tBEnd + 0.7,
      '<div class="n" id="pB-n"><div class="glass card-r" id="pr" style="top:450px">'
      '<div class="pr-h"><span class="dot"></span><span id="prh">One prompt</span></div>'
      f'<div class="inp"><div class="sk" style="width:62%"></div><div class="sk" style="width:38%"></div><div class="send" id="send">{ICON["send"]}</div></div>'
      '<div class="pr-chips"><div class="mask"><div class="chip" id="pc0">Claude Opus 5.5</div></div><div class="mask"><div class="chip acc" id="pc1">Effort · Low</div></div></div></div></div>')
J(f'S.cardIn(tl,"#pr",{tOne-0.3:.3f},{{dir:"right",dist:200,dur:0.85}});')
rampw('#prh', [tOne, T('single')], dur=0.5)
J(f'tl.to("#send",{{scale:1.12,duration:0.17,ease:"snapOut",yoyo:true,repeat:1}},q({tPr:.3f}));tl.to("#send",{{backgroundColor:"#ff9f0a",duration:0.2,ease:"none"}},q({tPr:.3f}));')
J(f'S.maskUp(tl,"#pc0",{tOp-0.35:.3f});S.maskUp(tl,"#pc1",{tLow-0.12:.3f});')
J(f'S.drift(tl,"#pB-n",{tOne+0.4:.3f},{tBEnd-tOne:.2f},{{y:-16}});S.cardOut(tl,"#pr",{tBEnd:.3f},{{dir:"right",dist:300}});')

# slow push on the clean "in today's video" beat
tTod = T("today's"); tBut = T('but', 22.5)
J(f'tl.to("#cam-drift",{{scale:1.025,duration:{tBut-tTod:.2f},ease:"none",transformOrigin:"50% 40%"}},q({tTod:.3f}));tl.to("#cam-drift",{{scale:1,duration:1.2,ease:"mid"}},q({tBut:.3f}));')

# ═══════════ C · 22.8–30.1 s — "they already cut silences" (left) ═══════════
tC = T('silent'); tCb = T('bad', 26.5); tGl = T('gling'); tCEnd = T('but', 30) - 0.05
NC = 50; CW_, CG_ = 8, 4
ch = env_bars(NC, 22.9, 29.9, floor=0.14)
sil = [0] * NC
for a, b in ((7, 12), (21, 26), (37, 41)):
    for j in range(a, b): sil[j] = 1; ch[j] = 0.05
bt = [0] * NC
for j in range(28, 34): bt[j] = 1
scene('pC', T("you're") - 0.1, tCEnd + 0.7,
      '<div class="n" id="pC-n"><div class="glass card-l" id="sc" style="top:470px">'
      '<div class="pr-h"><span class="dot"></span><span id="sch">Existing tools</span></div>'
      '<div class="wave sm" id="wave2"></div>'
      '<div class="pr-chips"><div class="mask"><div class="chip" id="sc0"><span class="ci red">' + ICON['minus'] + '</span>Silences</div></div>'
      '<div class="mask"><div class="chip" id="sc1"><span class="ci red">' + ICON['minus'] + '</span>Bad takes</div></div>'
      '<div class="mask"><div class="chip ghost" id="sc2">Gling AI, …</div></div></div></div></div>')
J(f'const WC=buildWave("#wave2",{json.dumps(ch)},{CW_},{CG_},120);')
J(f'S.cardIn(tl,"#sc",{T("okay",24.3)-0.2:.3f},{{dir:"left",dist:200,dur:0.85}});')
rampw('#sch', [T('okay', 24.3), T('okay', 24.3) + 0.1], dur=0.5)
J(f'drawWave(WC,{T("it",24.7):.3f},0.8);')
J(f'markCuts(WC,{json.dumps(sil)},{tC-0.15:.3f});collapse(WC,{json.dumps(sil)},{tC+0.4:.3f},0.7);S.maskUp(tl,"#sc0",{tC:.3f});')
J(f'markCuts(WC,{json.dumps(bt)},{tCb-0.15:.3f});collapse(WC,{json.dumps([max(x, y) for x, y in zip(sil, bt)])},{tCb+0.35:.3f},0.7);S.maskUp(tl,"#sc1",{tCb:.3f});')
J(f'S.maskUp(tl,"#sc2",{tGl-0.1:.3f});')
J(f'S.drift(tl,"#pC-n",{tC:.3f},{tCEnd-tC:.2f},{{y:-16}});S.cardOut(tl,"#sc",{tCEnd:.3f},{{dir:"left",dist:300}});')

# ═══════════ D · 30.2–41.6 s — pay per minute → runs in your subscription, $0 extra (right) ═══════════
tPay = T('pay'); tLong = T('long', 32.8); tWith = T('with', 33.8); tRuns = T('runs'); tSub = T('subscription'); tAdd = T('additional'); tDEnd = T('you', 41.4) - 0.1
scene('pD', tPay - 0.4, tDEnd + 0.7,
      '<div class="n" id="pD-n"><div class="glass card-r" id="co" style="top:420px">'
      '<div class="pr-h"><span class="dot"></span><span class="swap"><span id="coh1">Other tools</span><span id="coh2">This skill</span></span></div>'
      '<div class="row"><span class="r-l">Video length</span></div><div class="trackbar"><div class="fill wt" id="fl1"></div></div>'
      '<div class="row"><span class="r-l">Extra cost</span><span class="r-v" id="cost">$0</span></div><div class="trackbar"><div class="fill red" id="fl2"></div></div>'
      '<div class="pr-chips"><div class="mask"><div class="chip" id="cs0"><span class="ci grn">' + ICON['check'] + '</span>Runs in Claude Code</div></div></div></div></div>')
J(f'S.cardIn(tl,"#co",{tPay-0.3:.3f},{{dir:"right",dist:200,dur:0.85}});')
rampw('#coh1', [tPay - 0.1, tPay], dur=0.5)
J(f'gsap.set("#cost",{{opacity:0}});')
J(f'S.grow(tl,"#fl1",{T("depending"):.3f},{tLong-T("depending")+0.6:.2f});S.grow(tl,"#fl2",{T("depending")+0.08:.3f},{tLong-T("depending")+0.6:.2f});')
J(f'S.rampOut(tl,"#coh1",{tWith-0.3:.3f});')
rampw('#coh2', [tWith, T('skill', 34)], dur=0.5)
J(f'S.maskUp(tl,"#cs0",{tRuns-0.1:.3f});tl.fromTo("#cs0 .ci",{{scale:0.6}},{{scale:1,duration:0.33,ease:"back.out(1.2)"}},q({tSub:.3f}));')
J(f'tl.to("#fl2",{{scaleX:0,duration:0.8,ease:"mid"}},q({tAdd-0.1:.3f}));tl.to("#cost",{{opacity:1,duration:S.OP}},q({tAdd+0.3:.3f}));S.react(tl,"#cost",{tAdd+0.3:.3f});')
J(f'S.drift(tl,"#pD-n",{tPay+0.4:.3f},{tDEnd-tPay:.2f},{{y:-18}});S.cardOut(tl,"#co",{tDEnd:.3f},{{dir:"right",dist:300}});')

# ═══════════ E · 41.6–48.0 s — reads the transcript, keeps what matters (left) ═══════════
tRd = T('reads'); tKeep = T('keep'); tRid = T('rid'); tEEnd = T('and', 47.9) - 0.05
LW = [88, 72, 94, 60, 80, 90, 56, 76]; KEEP = [1, 0, 1, 1, 0, 0, 1, 0]
lines = ''.join(f'<div class="tl" id="tl{k}" style="top:{k*46}px"><div class="tl-b" style="width:{w}%"></div></div>' for k, w in enumerate(LW))
scene('pE', tRd - 0.5, tEEnd + 0.7,
      '<div class="n" id="pE-n"><div class="glass card-l" id="tr" style="top:420px">'
      '<div class="pr-h"><span class="dot"></span><span id="trh">Transcript</span></div>'
      f'<div class="tlines" id="tlines">{lines}<div class="scan" id="scan"></div></div></div></div>')
J(f'S.cardIn(tl,"#tr",{tRd-0.4:.3f},{{dir:"left",dist:200,dur:0.85}});')
rampw('#trh', [tRd - 0.1], dur=0.5)
J(f'tl.fromTo("#tlines .tl",{{opacity:0,x:-30}},{{opacity:1,x:0,duration:0.6,ease:"snapOut",stagger:0.05}},q({tRd-0.2:.3f}));')
J(f'gsap.set("#scan",{{opacity:0}});tl.to("#scan",{{opacity:1,duration:S.OP}},q({tRd:.3f}));tl.fromTo("#scan",{{y:-10}},{{y:{len(LW)*46},duration:{tKeep-tRd-0.3:.2f},ease:"mid"}},q({tRd:.3f}));tl.to("#scan",{{opacity:0,duration:0.2}},q({tKeep-0.3:.3f}));')
k2 = 0
for k, keep in enumerate(KEEP):
    if keep:
        J(f'tl.to("#tl{k} .tl-b",{{backgroundColor:"rgba(255,255,255,.92)",duration:0.3,ease:"none"}},q({tKeep-0.1+k*0.03:.3f}));tl.to("#tl{k}",{{y:{(k2-k)*46},duration:0.7,ease:"mid"}},q({tRid+0.2:.3f}));')
        k2 += 1
    else:
        J(f'tl.to("#tl{k} .tl-b",{{backgroundColor:"rgba(255,69,58,.75)",duration:0.25,ease:"none"}},q({tRid-0.15+k*0.02:.3f}));tl.to("#tl{k}",{{scaleX:0.2,opacity:0,duration:0.45,ease:"exitIn",transformOrigin:"left center"}},q({tRid+0.05:.3f}));')
J(f'gsap.set("#tr",{{height:{76+70+len(LW)*46}}});tl.to("#tr",{{height:{76+70+sum(KEEP)*46},duration:0.7,ease:"mid"}},q({tRid+0.25:.3f}));')
J(f'S.drift(tl,"#pE-n",{tRd:.3f},{tEEnd-tRd:.2f},{{y:-16}});S.cardOut(tl,"#tr",{tEEnd:.3f},{{dir:"left",dist:300}});')

# ═══════════ F · 48.0–56.6 s — self-iteration loop: check → find → fix → final (right) ═══════════
tLoop = T('loop'); tChk = T('checking'); tMul = T('multiple'); tFind = T('finding'); tFix = T('fixing'); tFinal = T('final', 55.5); tFEnd = T('so', 56.6) - 0.05
NODES = [('Check', 0), ('Find', 120), ('Fix', 240)]
R = 170
import math
nodes = ''.join(f'<div class="nd" id="nd{k}" style="left:{250+R*math.sin(math.radians(a))-60:.0f}px;top:{250-R*math.cos(math.radians(a))-24:.0f}px">{lab}</div>' for k, (lab, a) in enumerate(NODES))
scene('pF', tLoop - 0.5, tFEnd + 0.7,
      '<div class="n" id="pF-n"><div class="glass card-r loop" id="lp" style="top:330px">'
      '<div class="pr-h"><span class="dot"></span><span id="lph">Self-check loop</span><span class="pass" id="pass">Pass 1</span></div>'
      f'<div class="ring"><svg viewBox="0 0 500 500"><circle cx="250" cy="250" r="{R}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="3"/></svg>'
      f'<div class="orb" id="orb"><i></i></div>{nodes}'
      f'<div class="core" id="core"><span class="core-i" id="corei">{ICON["check"]}</span><span class="core-t" id="coret">Final</span></div></div></div></div>')
J(f'S.cardIn(tl,"#lp",{tLoop-0.4:.3f},{{dir:"right",dist:200,dur:0.85}});')
rampw('#lph', [T('self-iteration') - 0.05, tLoop], dur=0.5)
J(f'gsap.set(".nd",{{opacity:0.35}});gsap.set("#pass",{{opacity:0}});gsap.set(["#corei","#coret"],{{opacity:0}});')
J(f'tl.to("#pass",{{opacity:1,duration:S.OP}},q({tChk:.3f}));')
steps = [(tChk, 0, 0), (tFind, 1, 120), (tFix, 2, 240)]
J(f'tl.fromTo("#orb",{{rotation:-60}},{{rotation:0,duration:0.8,ease:"snapOut"}},q({tChk-0.2:.3f}));')
# multiple passes: the orb laps the ring twice on "multiple times" (mid), the pass counter ticks
J(f'tl.to("#orb",{{rotation:360,duration:0.55,ease:"mid"}},q({tMul-0.1:.3f}));tl.set("#pass",{{textContent:"Pass 2"}},q({tMul+0.3:.3f}));tl.set("#orb",{{rotation:0}},q({tMul+0.46:.3f}));')
J(f'tl.to("#orb",{{rotation:360,duration:0.55,ease:"mid"}},q({tMul+0.5:.3f}));tl.set("#pass",{{textContent:"Pass 3"}},q({tMul+0.9:.3f}));tl.set("#orb",{{rotation:0}},q({tMul+1.06:.3f}));')
for t, k, a in steps:
    if k: J(f'tl.to("#orb",{{rotation:{a},duration:0.6,ease:"mid"}},q({t-0.3:.3f}));')
    J(f'tl.to("#nd{k}",{{opacity:1,duration:0.25,ease:"none"}},q({t:.3f}));tl.fromTo("#nd{k}",{{scale:0.9}},{{scale:1,duration:0.5,ease:"snapOut"}},q({t:.3f}));')
J(f'tl.to("#orb",{{rotation:360,duration:0.7,ease:"mid"}},q({tFinal-0.55:.3f}));')
J(f'tl.to("#corei",{{opacity:1,duration:S.OP}},q({tFinal-0.05:.3f}));S.react(tl,"#corei",{tFinal-0.05:.3f});')
rampw('#coret', [T('result', 55.9)], dur=0.5)
J(f'tl.to("#pass",{{color:"#30d158",duration:0.3}},q({tFinal:.3f}));')
J(f'S.drift(tl,"#pF-n",{tLoop:.3f},{tFEnd-tLoop:.2f},{{y:-18}});S.cardOut(tl,"#lp",{tFEnd:.3f},{{dir:"right",dist:300}});')

# ═══════════ G · 56.8–60.6 s — raw footage next to the edit: two small glass frames ═══════════
tRw = T('raw', 58); tEd = T('edit'); tGEnd = T('and', 60.4) - 0.05
scene('pG', tRw - 0.4, tGEnd + 0.7,
      '<div class="n" id="pG-n"><div class="pair">'
      '<div class="glass fr" id="fr0"><div class="fr-in"><div class="fr-bar"></div><div class="fr-bar s"></div></div><div class="fr-l">Raw footage</div></div>'
      '<div class="glass fr" id="fr1"><div class="fr-in"><div class="fr-bar a"></div><div class="fr-bar s"></div></div><div class="fr-l acc">Claude\'s edit</div></div></div></div>')
J(f'S.cardIn(tl,"#fr0",{tRw-0.3:.3f},{{dir:"down",dist:160,dur:0.8}});S.cardIn(tl,"#fr1",{tEd-0.3:.3f},{{dir:"down",dist:160,dur:0.8}});')
J(f'S.drift(tl,"#pG-n",{tRw:.3f},{tGEnd-tRw:.2f},{{y:-12}});S.cardOut(tl,"#fr0",{tGEnd:.3f},{{dir:"down",dist:260}});S.cardOut(tl,"#fr1",{tGEnd+0.05:.3f},{{dir:"down",dist:260}});')

# slow push on the personal beat ("I messed up so many times")
tIns = T('insane'); tAt = T('at', 64.5)
J(f'tl.to("#cam-drift",{{scale:1.03,duration:{tAt-tIns+0.4:.2f},ease:"none",transformOrigin:"50% 40%"}},q({tIns-0.4:.3f}));tl.to("#cam-drift",{{scale:1,duration:1.2,ease:"mid"}},q({tAt:.3f}));')

# ═══════════ H · 64.7–71.0 s — one section: 0:50 → 0:10 (right) ═══════════
tSec = T('sections'); t50 = T('50'); tCutd = T('cut', 68.5); t10 = T('10'); tHEnd = T('so', 71) - 0.05
NH = 70; HW_, HG_ = 6.5, 2.07
hh = env_bars(NH, 64.7, 70.7, floor=0.14)
hm = cut_mask(NH, 0.8, seed=10, min_run=3, max_run=9)
scene('pH', tSec - 0.45, tHEnd + 0.7,
      '<div class="n" id="pH-n"><div class="glass card-r" id="sx" style="top:470px">'
      '<div class="pr-h"><span class="dot"></span><span id="sxh">One section</span><span class="pass big" id="sxn">0:00</span></div>'
      '<div class="wave sm" id="wave3"></div>'
      '<div class="pr-chips"><div class="mask"><div class="chip acc" id="sx0">−80%</div></div></div></div></div>')
J(f'const WH=buildWave("#wave3",{json.dumps(hh)},{HW_},{HG_},120);')
J(f'S.cardIn(tl,"#sx",{tSec-0.4:.3f},{{dir:"right",dist:200,dur:0.85}});')
rampw('#sxh', [T('certain') - 0.05, tSec], dur=0.5)
J(f'gsap.set("#sxn",{{opacity:0}});tl.to("#sxn",{{opacity:1,duration:S.OP}},q({t50-0.1:.3f}));drawWave(WH,{t50-0.1:.3f},0.9);S.count(tl,"#sxn",{t50-0.1:.3f},0,50,0.9,mmss);')
J(f'markCuts(WH,{json.dumps(hm)},{tCutd-0.2:.3f});collapse(WH,{json.dumps(hm)},{t10-0.35:.3f},0.8);')
J(f'S.count(tl,"#sxn",{t10-0.35:.3f},50,10,0.8,mmss);tl.to("#sxn",{{color:"#ff9f0a",duration:0.3,ease:"none"}},q({t10:.3f}));S.maskUp(tl,"#sx0",{T("seconds",70)+0.05:.3f});')
J(f'S.drift(tl,"#pH-n",{tSec:.3f},{tHEnd-tSec:.2f},{{y:-18}});S.cardOut(tl,"#sx",{tHEnd:.3f},{{dir:"right",dist:300}});')

# ═══════════ I · "So let's jump in" — one slow push to the end ═══════════
J(f'tl.to("#cam-drift",{{scale:1.05,duration:{DUR-tHEnd:.2f},ease:"none",transformOrigin:"50% 40%"}},q({tHEnd:.3f}));')

CSS = r'''
@font-face{font-family:"Inter";src:url("fonts/Inter-400-latin.woff2") format("woff2");font-weight:400;font-display:block}
@font-face{font-family:"Inter";src:url("fonts/Inter-Medium.ttf") format("truetype");font-weight:500;font-display:block}
@font-face{font-family:"Inter";src:url("fonts/Inter-700-latin.woff2") format("woff2");font-weight:700;font-display:block}
:root{--lg:#e5e5ea;--mg:#aeaeb2;--acc:#ff9f0a;--red:#ff453a;--grn:#30d158;--sh:0 4px 16px rgba(0,0,0,.4)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:2560px;height:1440px;overflow:hidden;background:#000;font-family:"Inter",ui-sans-serif,system-ui,sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
#root{position:relative;width:2560px;height:1440px;overflow:hidden;background:#000}
.cam{position:absolute;inset:0;will-change:transform}
#stage{position:absolute;inset:0}
#stage>video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#gfx{position:absolute;inset:0}
.scene{position:absolute;inset:0;pointer-events:none}
.n{position:absolute;inset:0}
.mask{overflow:hidden;padding:6px 60px;margin:0 -60px}
.w{display:inline-block;white-space:pre;will-change:transform,opacity,filter}
.acc{color:var(--acc)}
/* glass */
.glass{position:absolute;border-radius:32px;background:linear-gradient(160deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.06) 45%,rgba(255,255,255,.03) 100%),rgba(18,18,20,.34);
  backdrop-filter:blur(30px) saturate(1.6);-webkit-backdrop-filter:blur(30px) saturate(1.6);
  box-shadow:0 30px 70px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.38),inset 0 0 0 1.5px rgba(255,255,255,.14)}
.card-r{left:1720px;width:680px;padding:36px 40px 40px}
.card-l{left:160px;width:680px;padding:36px 40px 40px}
.pr-h{display:flex;align-items:center;gap:14px;font-size:30px;font-weight:500;color:var(--lg);margin-bottom:30px;height:40px}
.pr-h .dot{width:12px;height:12px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 5px rgba(255,159,10,.18)}
.pass{margin-left:auto;font-size:28px;font-weight:700;font-variant-numeric:tabular-nums;color:#fff}
.pass.big{font-size:44px}
.swap{position:relative;display:inline-block;height:40px;min-width:300px}.swap>span{position:absolute;left:0;top:0;white-space:nowrap}
.chip{display:inline-flex;align-items:center;gap:12px;padding:12px 24px;border-radius:999px;font-size:28px;font-weight:500;white-space:nowrap;
  background:rgba(255,255,255,.1);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 0 0 1.5px rgba(255,255,255,.12),0 12px 30px rgba(0,0,0,.25)}
.chip.acc{color:#1c1c1e;background:rgba(255,159,10,.92);box-shadow:0 12px 30px rgba(0,0,0,.25);font-weight:700}
.chip.ghost{color:var(--mg)}
.ci{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;padding:5px;color:#fff;flex:none}.ci svg{width:100%;height:100%}
.ci.red{background:var(--red)}.ci.grn{background:var(--grn)}
.pr-chips{display:flex;gap:14px;margin-top:30px;flex-wrap:wrap}
/* waveform */
.wave{position:relative;height:150px}
.wave.sm{height:120px}
.bar{position:absolute;bottom:0;border-radius:3px;background:rgba(255,255,255,.88);transform-origin:center center}
/* A · editor panel */
.edp{left:330px;top:1040px;width:1900px;height:300px;padding:30px 20px 0 20px}
.ed-h{display:flex;justify-content:space-between;align-items:center;height:48px;margin:0 0 26px;padding:0 4px}
.ed-lab{position:relative;height:44px;width:900px;font-size:32px;font-weight:500;color:var(--lg)}
.ed-lab>span{position:absolute;left:0;top:0;white-space:nowrap}
.ed-num{position:relative;width:420px;height:52px;font-size:46px;font-weight:700;font-variant-numeric:tabular-nums;text-align:right}
.ed-num>span{position:absolute;right:0;top:-4px;white-space:nowrap}
.ed-body{position:relative;height:160px;overflow:hidden}
.ed-body .wave{position:absolute;left:10px;top:4px}
.trks{position:absolute;left:0;right:0;top:0;height:160px}
.trk{position:relative;height:62px;margin-bottom:14px;display:flex;align-items:center}
.trk-l{width:170px;font-size:24px;font-weight:500;color:var(--lg);padding-left:10px}
.trk-b{flex:1;height:52px;border-radius:12px;margin-right:12px}
.trk-b.face{background:linear-gradient(90deg,rgba(255,159,10,.55),rgba(255,159,10,.35))}
.trk-b.scr{background:linear-gradient(90deg,rgba(100,210,255,.5),rgba(100,210,255,.3))}
.cuts{position:absolute;left:170px;right:12px;top:0;height:128px}
.cut{position:absolute;top:0;width:3px;height:128px;border-radius:2px;background:rgba(10,10,12,.85);box-shadow:0 0 0 1px rgba(255,255,255,.08);transform-origin:center top}
.phd{position:absolute;left:170px;top:-6px;width:4px;height:140px;border-radius:2px;background:#fff;box-shadow:0 0 12px rgba(255,255,255,.6)}
.chips{position:absolute;left:0;right:0;top:944px;display:flex;justify-content:center;gap:18px}
.chips .chip{font-size:30px}
/* B · prompt */
.inp{position:relative;height:120px;border-radius:24px;background:rgba(0,0,0,.28);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.12);padding:28px 30px}
.sk{height:16px;border-radius:8px;background:rgba(255,255,255,.3);margin-bottom:22px}
.send{position:absolute;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;padding:14px;color:#fff}
.send svg{width:100%;height:100%}
/* D · cost */
.row{display:flex;justify-content:space-between;align-items:baseline;margin:10px 0 12px}
.r-l{font-size:28px;font-weight:500;color:var(--lg)}.r-v{font-size:40px;font-weight:700;color:var(--grn);display:inline-block}
.trackbar{height:16px;border-radius:8px;background:rgba(255,255,255,.12);overflow:hidden;margin-bottom:26px}
.fill{height:100%;border-radius:8px;transform-origin:left center;transform:scaleX(0)}
.fill.wt{background:rgba(255,255,255,.85)}.fill.red{background:var(--red)}
/* E · transcript */
.tlines{position:relative;height:368px}
.tl{position:absolute;left:0;right:0;height:22px}
.tl-b{height:20px;border-radius:10px;background:rgba(255,255,255,.34)}
.scan{position:absolute;left:-14px;right:-14px;top:0;height:3px;border-radius:2px;background:var(--acc);box-shadow:0 0 16px rgba(255,159,10,.8)}
#tr{overflow:hidden}
/* F · loop */
.loop{padding-bottom:20px}
.ring{position:relative;width:500px;height:500px;margin:0 auto}
.ring svg{position:absolute;inset:0;width:100%;height:100%}
.orb{position:absolute;left:0;top:0;width:500px;height:500px;transform-origin:250px 250px}
.orb i{position:absolute;left:239px;top:69px;width:22px;height:22px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 7px rgba(255,159,10,.22)}
.nd{position:absolute;width:120px;height:48px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;
  background:rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 0 0 1.5px rgba(255,255,255,.14)}
.core{position:absolute;left:170px;top:170px;width:160px;height:160px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.core-i{width:74px;height:74px;border-radius:50%;background:var(--grn);padding:16px;color:#fff;display:flex}.core-i svg{width:100%;height:100%}
.core-t{font-size:28px;font-weight:700}
/* G · pair */
.pair{position:absolute;left:0;right:0;top:1060px;height:260px}
.fr{top:0;width:420px;height:250px;padding:18px}
#fr0{left:820px}#fr1{left:1320px}
.fr-in{height:160px;border-radius:18px;background:rgba(0,0,0,.3);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.1);padding:22px}
.fr-bar{height:14px;width:92%;border-radius:7px;background:rgba(255,255,255,.35);margin-bottom:16px}.fr-bar.s{width:60%}.fr-bar.a{width:48%;background:rgba(255,159,10,.8)}
.fr-l{font-size:28px;font-weight:500;margin-top:16px;padding-left:4px;color:var(--lg)}
'''

JS_LIB = r'''
function mmss(v){const s=Math.round(v);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");}
function mins(v){return Math.round(v)+":00";}
function buildWave(sel,hs,bw,bg,H){const el=document.querySelector(sel);el.style.width=(hs.length*(bw+bg))+"px";el.style.height=H+"px";
  return hs.map((h,i)=>{const b=document.createElement("div");b.className="bar";b.style.left=(i*(bw+bg))+"px";b.style.width=bw+"px";
    const hh=Math.max(6,Math.round(h*H));b.style.height=hh+"px";b.style.bottom=Math.round((H-hh)/2)+"px";el.appendChild(b);return b;});}
function drawWave(bars,at,span){bars.forEach((b,i)=>{tl.fromTo(b,{scaleY:0.04,opacity:0},{scaleY:1,opacity:1,duration:0.55,ease:"snapOut"},q(at+span*i/bars.length));});}
function markCuts(bars,mask,at){bars.forEach((b,i)=>{if(mask[i])tl.to(b,{backgroundColor:"rgba(255,69,58,.95)",duration:0.25,ease:"none"},q(at+0.004*i));});}
function collapse(bars,mask,at,dur){const pitch=parseFloat(bars[1].style.left)-parseFloat(bars[0].style.left);let k=0;
  bars.forEach((b,i)=>{if(mask[i]){tl.to(b,{scaleY:0,opacity:0,duration:dur*0.5,ease:"exitIn"},q(at));}
    else{tl.to(b,{x:(k-i)*pitch,duration:dur,ease:"mid"},q(at+dur*0.25));k++;}});}
function buildCuts(sel,n,a,b){const el=document.querySelector(sel);const W=el.getBoundingClientRect().width||1540;
  let r=7;const rnd=()=>{r=(r*16807)%2147483647;return r/2147483647;};const xs=[];for(let i=0;i<n;i++)xs.push((i+0.2+rnd()*0.6)/n);
  xs.forEach((x,i)=>{const c=document.createElement("div");c.className="cut";c.style.left=(x*100)+"%";el.appendChild(c);
    tl.fromTo(c,{scaleY:0,opacity:0},{scaleY:1,opacity:1,duration:0.35,ease:"snapOut"},q(a+(b-a)*i/n));});}
'''

JSOUT = chr(10).join(re.sub(r'tl\.set\(((?:"[^"]*"|\[[^\]]*\])),(\{[^{}]*\}),0\);', lambda m: 'gsap.set(' + m.group(1) + ',' + m.group(2) + ');', j) for j in JS)
PAGE = f'''<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=2560, height=1440"/>
<!-- generated by build.py · doctrine: editing-style.md · motion: motion/smooth.js -->
<style>{CSS}</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-fps="60" data-width="2560" data-height="1440">
<div class="cam" id="cam-drift"><div class="cam" id="cam-snap"><div id="stage">
  <video id="a-roll" class="clip" src="input-video.mp4" muted playsinline data-start="0" data-duration="{DUR}" data-track-index="0"></video>
  <div id="gfx">
{chr(10).join(H)}
  </div>
</div></div></div>
<audio id="a-roll-audio" src="input-video.mp4" data-start="0" data-duration="{DUR}" data-track-index="40" data-volume="1"></audio>
<script src="vendor/gsap.min.js"></script>
<script src="motion/smooth.js"></script>
<script>
(function(){{
const S=SMOOTH,q=S.q;
const tl=gsap.timeline({{paused:true}});
gsap.set(["#cam-snap","#cam-drift"],{{transformOrigin:"50% 40%"}});
function rampAt(sel,times,o){{o=o||{{}};const el=document.querySelector(sel);const ws=S.words(el);const d=o.dur||0.5,st=o.stagger==null?0.085:o.stagger;
  ws.forEach((w,k)=>{{const t=k<times.length?times[k]-0.08:times[times.length-1]-0.08+(k-times.length+1)*st;
    tl.fromTo(w,{{y:"0.9em",opacity:0,filter:"blur(0.12em)"}},{{y:0,opacity:1,filter:"blur(0em)",duration:d,ease:"snapOut"}},q(t));
    tl.fromTo(w,{{opacity:0}},{{opacity:1,duration:S.OP,ease:"none",immediateRender:false}},q(t));}});
  if(o.hit)tl.fromTo(el,{{scale:1.05,transformOrigin:"left center"}},{{scale:1,duration:0.6,ease:"snapOut"}},q(times[0]-0.08));}}
{JS_LIB}
{JSOUT}
window.__timelines=window.__timelines||{{}};window.__timelines["main"]=tl;
}})();
</script>
</div></body></html>'''
open('index.html', 'w', encoding='utf-8').write(PAGE)
print('html blocks:', len(H), 'js lines:', len(JS))
