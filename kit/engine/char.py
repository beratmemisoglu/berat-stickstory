# Characters: bean torso, big white head with sprite face, hair shell, black noodle limbs, ball hands, shoes.
# Timeline API (seconds, global film time) -> bake(f0, f1) keys every frame. Motion numbers: MOTION.md of the toon study.
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Euler
import cz
import faceparams as FP
from cz import Track, clamp, lerp, FPS, back_out
import os

R_HEAD = 0.24
ALL = []          # the characters built in this Blender run (clip_check)


def _bake_scale(o, s):
    """Scale baked into the mesh (object scale distorts the hull outline: ISSUES 16)."""
    o.data.transform(Matrix.Diagonal((s[0], s[1], s[2], 1)))


def _bean(o, rt, ht):
    """The reference's torsos are not a straight capsule (owner, night 2: "it's not one round shape, it's more like
    it's dynamic"): a bean - fuller below the middle, a little narrower toward the shoulders, the belly rounding forward,
    the back flatter. The chest band (0.55-0.95 of the height) keeps its radius so costume details stay on the surface."""
    for v in o.data.vertices:
        x, y, z = v.co; kx, ky = _bean_k(z / max(1e-6, ht), y < 0)
        v.co = (x * kx, y * ky, z)
    o.data.update()


def _bean_k(u, front):
    """The bean profile at height fraction u: (x scale, y scale) - fuller below the middle, narrowing toward the
    shoulders, the belly forward, the back flatter (the reference's torsos)."""
    u = clamp(u)
    pear = 1 + 0.09 * math.sin(math.pi * clamp(u / 0.6)) - 0.11 * cz.smooth((u - 0.58) / 0.42)
    bel = 1 + (0.1 * math.sin(math.pi * clamp(u / 0.55)) if front else -0.05 * math.sin(math.pi * clamp((u - 0.1) / 0.8)))
    return pear, pear * bel


def _bean_children(c):
    """Costume parts on the body (tags, collars, lapels, buttons, belts) follow the bean profile so they stay ON it."""
    for ch in c.body.children:
        if ch.get('cz_bean_done'): continue
        x, y, z = ch.location; kx, ky = _bean_k(z / max(1e-6, c.ht), y < 0)
        ch.location = (x * kx, y * ky, z); ch['cz_bean_done'] = 1


def _rot(lean=0, sway=0, twist=0):
    return (Matrix.Rotation(math.radians(twist), 4, 'Z') @ Matrix.Rotation(math.radians(-lean), 4, 'X') @ Matrix.Rotation(math.radians(sway), 4, 'Y'))


class Char:
    def __init__(self, name, shirt='#3a5a8c', skin=cz.SKIN_WHITE, scale=1.0, torso=(0.165, 0.46), belly=1.0, leg=0.42, arm=0.47,
                 hair=None, extras=None, limb_r=0.021, shoe='#4a2c1c', face_v=-0.03, face_s=0.84, lift=0.62, palette=None,
                 face_style=None):
        self.name, self.s = name, scale
        ALL.append(self)          # every character of the scene, for clip_check()
        self.skin, self.face_v, self.face_s = skin, face_v, face_s
        self.face_style = face_style or {}       # facegen style: eye_w, brow_w, brow_len, brow_y, mouth_w, mouth_y
        self.gaze = Track((0.0, 0.0))
        self.rt, self.ht = torso[0] * scale, torso[1] * scale
        self.belly = belly
        self.hh = leg * scale            # hip height when standing
        self.L_arm, self.L_leg = arm * scale, leg * scale * 0.985
        self.R = R_HEAD * scale
        self.root = cz.empty(name)
        self.torso_pv = cz.empty(name + '_torso', parent=self.root)
        tor = cz.capsule(name + '_body', self.rt, self.ht, (0, 0, 0), cz.toon(name + '_shirt', shirt, lift, sheen=0.3), scale=(1, 0.8 * belly, 1), ol=0.006 * scale, parent=self.torso_pv)
        _bean(tor, self.rt, self.ht)
        self.body = tor
        self.head_pv = cz.empty(name + '_headpv', (0, 0, self.ht * 0.93), parent=self.torso_pv)
        self.head = cz.sphere(name + '_head', self.R, (0, 0, self.R * 0.86), cz.face_material(name + '_face', skin, 0.55, self.R, fv=face_v, fs=face_s), ol=0.007 * scale, parent=self.head_pv)
        for k, v in (('face', 0.0), ('mouth', 0.0), ('mopen', 1.0), ('extra', -1.0)): self.head[k] = v
        ink = cz.ink(); blk = cz.toon('cz_limb', '#14100c', 0.8)
        self.ctrl = {}
        for k in ('sL', 'sR', 'eL', 'eR', 'hL', 'hR', 'pL', 'pR', 'kL', 'kR', 'fL', 'fR'):
            self.ctrl[k] = cz.empty(f'{name}_{k}', parent=self.root, size=0.02)
        for sd in 'LR':
            cz.limb(f'{name}_arm{sd}', self.ctrl['s' + sd], self.ctrl['e' + sd], self.ctrl['h' + sd], limb_r * scale, blk, self.root)
            cz.limb(f'{name}_leg{sd}', self.ctrl['p' + sd], self.ctrl['k' + sd], self.ctrl['f' + sd], limb_r * 1.1 * scale, blk, self.root)
            cz.sphere(f'{name}_hand{sd}', 0.05 * scale, (0, 0, 0), blk, ol=0, parent=self.ctrl['h' + sd], segs=24, rings=12)
            # shoes: coloured uppers on a dark sole (plain black blobs read as hands when the feet are up on a desk)
            sh = cz.sphere(f'{name}_shoe{sd}', 0.058 * scale, (0, -0.03 * scale, 0.02 * scale), cz.toon(name + '_shoe', shoe, 0.8), ol=0.004, parent=self.ctrl['f' + sd], segs=24, rings=12)
            _bake_scale(sh, (0.95, 1.55, 0.62))
            so = cz.sphere(f'{name}_sole{sd}', 0.058 * scale, (0, -0.03 * scale, -0.002 * scale), cz.toon('cz_sole', '#1a1410', 0.8), ol=0.0, parent=self.ctrl['f' + sd], segs=24, rings=12)
            _bake_scale(so, (1.0, 1.6, 0.3))
        if hair: hair(self)
        if extras: extras(self)
        _bean_children(self)
        # tracks (character-local, metres / degrees)
        self.pos = Track((0.0, 0.0)); self.yaw = Track(0.0)
        self.T = {k: Track(v, arc=0.16 if k in ('hL', 'hR') else 0.0) for k, v in self.rest().items()}   # hands move on arcs
        self.faces = [(-1e9, 'neutral', False)]
        self.talks, self.extras_k, self.walks, self.holds, self.blink_off = [], [], [], [], []
        self.loudness = {}          # (t0, t1) of a talk -> mouth-open multiplier (talk(loud=))
        self.rng = random.Random(__import__('zlib').crc32(name.encode()) & 0xffff)   # stable across runs (str hash() is salted per process: blinks moved between partial re-renders)

    # ---- poses (character-local; hands relative to the torso frame, feet to the root)
    def rest(self):
        s = self.s
        return {'hL': (0.2 * s, -0.02 * s, 0.1 * s), 'hR': (-0.2 * s, -0.02 * s, 0.1 * s),
                'fL': (0.085 * s, 0.0, 0.0), 'fR': (-0.085 * s, 0.0, 0.0),
                'lean': 0.0, 'sway': 0.0, 'twist': 0.0, 'squash': 1.0, 'bodyz': 0.0, 'bodyy': 0.0, 'sitw': 0.0, 'seath': 0.45,
                'hyaw': 0.0, 'hpitch': 0.0, 'hroll': 0.0}

    def P(self, name, **kw):
        """Named pose -> channel values (only the channels it sets)."""
        s, ht = self.s, self.ht
        chest = ht * 0.62
        p = {
            'rest': {'hL': (0.2 * s, -0.02 * s, 0.1 * s), 'hR': (-0.2 * s, -0.02 * s, 0.1 * s)},
            'hips': {'hL': (0.2 * s, 0.02, ht * 0.42), 'hR': (-0.2 * s, 0.02, ht * 0.42)},
            'shrug': {'hL': (0.3 * s, -0.12 * s, ht * 0.7), 'hR': (-0.3 * s, -0.12 * s, ht * 0.7)},
            'cheer': {'hL': (0.26 * s, -0.02, ht * 1.75), 'hR': (-0.26 * s, -0.02, ht * 1.75)},
            'point': {'hR': (-0.12 * s, -0.42 * s, chest + 0.05 * s)},
            'pointup': {'hR': (-0.18 * s, -0.1 * s, ht * 1.6)},
            'wave': {'hR': (-0.28 * s, -0.08 * s, ht * 1.45)},
            'think': {'hR': (-0.03 * s, -0.24 * s, ht * 0.98), 'hL': (0.12 * s, -0.16 * s, ht * 0.5)},
            'phone': {'hL': (0.05 * s, -0.26 * s, chest + 0.02), 'hR': (-0.05 * s, -0.26 * s, chest + 0.02)},
            'type': {'hL': (0.13 * s, -0.36 * s, ht * 0.38), 'hR': (-0.13 * s, -0.36 * s, ht * 0.38)},
            'cross': {'hL': (-0.09 * s, -0.17 * s, ht * 0.58), 'hR': (0.09 * s, -0.17 * s, ht * 0.62)},
            'behind': {'hL': (0.09 * s, 0.17 * s, ht * 0.3), 'hR': (-0.09 * s, 0.17 * s, ht * 0.3)},
            'headrest': {'hL': (0.2 * s, 0.12 * s, ht * 1.35), 'hR': (-0.2 * s, 0.12 * s, ht * 1.35)},
            'present': {'hR': (-0.38 * s, -0.22 * s, chest)},
            'slump': {'lean': 14.0, 'hL': (0.17 * s, -0.04, 0.02), 'hR': (-0.17 * s, -0.04, 0.02)},
            'upright': {'lean': 0.0},
        }[name]
        p = dict(p); p.update(kw); return p

    # ---- timeline
    def place(self, t, x, y, yaw=0.0, dur=0.0, ease='smooth'):
        if dur <= 0: self.pos.key(t - 2e-4, (x, y), 1e-4, 'linear'); self.yaw.key(t - 2e-4, yaw, 1e-4, 'linear')
        else: self.pos.key(t, (x, y), dur, ease); self.yaw.key(t, yaw, dur, ease)
        return self

    def turn(self, t, yaw, dur=0.2, ease='sine'): self.yaw.key(t, yaw, dur, ease); return self

    def pose(self, t, name='rest', dur=0.18, ease='snap', antic=0.0, **kw):
        """Gesture to a pose: lands at t + dur (5-6 frames, ease 'snap' = a small overshoot); body follows 2-3 frames
        later. antic (0..0.3): an anticipation - the hands first dip the other way by that share of the move over 3
        frames (big gestures: a point, a shrug, a cheer), then fire to the pose."""
        for ch, v in self.P(name, **kw).items():
            d, e, t0 = dur, ease, t
            if ch in ('lean', 'sway', 'twist', 'hyaw', 'hpitch', 'hroll'): t0, d, e = t + dur * 0.45, dur * 0.55 + 3 / FPS, 'sine'
            if antic and isinstance(v, tuple) and ch.startswith('h') and len(ch) == 2:
                cur = self.T[ch].at(t); back = tuple(c - (b - c) * antic for c, b in zip(cur, v))
                self.T[ch].key(t, back, 3 / FPS, 'sine'); t0 = t + 3 / FPS
            self.T[ch].key(t0, v, d, e)
        return self

    def set(self, t, dur=0.2, ease='sine', **chans):
        for ch, v in chans.items(): self.T[ch].key(t, v, dur, ease)
        return self

    def _find_seat(self, t, seat_h):
        """The solid under this character's hips at time t (a ray straight down), ignoring every character's own parts.
        Returns (object, top z, distance from the root to the seat's front edge along the character's facing)."""
        x, y = self.pos.at(t); yaw = math.radians(self.yaw.at(t))
        fwd = Vector((math.sin(yaw), -math.cos(yaw), 0.0))
        sc = bpy.context.scene; bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
        mine = tuple(c.name + '_' for c in ALL) + tuple(c.name for c in ALL)
        z0 = (seat_h if seat_h is not None else 0.6) + 0.35
        org = Vector((x, y, z0))
        for _ in range(6):
            hit, loc, nrm, idx, ob, M = sc.ray_cast(dg, org, Vector((0, 0, -1)))
            if not hit: return None, None, None
            if ob.name.startswith(mine) or ob.name in mine or loc.z < 0.06:
                org = loc + Vector((0, 0, -0.002)); continue
            pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
            edge = max((p - Vector((x, y, p.z))).dot(fwd) for p in pts)
            return ob, loc.z, edge
        return None, None, None

    def sit(self, t, seat_h=None, dur=0.5, feet_y=None, feet_z=None, thigh=None, seat=None):
        """Sit ON a seat: the torso bottom rests on the seat top, the THIGHS lie on top of it to the knee just past the
        seat's FRONT EDGE, the shins hang from there to the feet (on the floor, or dangling when the seat is high).
        The seat is found by itself (a ray down under the hips at time t, the set must exist before the characters sit):
        its top gives seat_h when not given, its front edge gives the thigh length - so the legs can never run through
        a chair, a sofa cushion or a stool (night 2: v1 drew each leg as one curve from the hip straight down to the
        feet and clipped in almost every seated shot). Place the root over the seat, ~0.05 m behind its centre.
        thigh / feet_y / feet_z override (feet up on a desk); seat=obj forces the seat object."""
        s = self.s
        ob, top, edge = (seat, None, None) if seat is not None else self._find_seat(t, seat_h)
        if seat is not None:
            x, y = self.pos.at(t); yaw = math.radians(self.yaw.at(t)); fwd = Vector((math.sin(yaw), -math.cos(yaw), 0.0))
            pts = [seat.matrix_world @ Vector(c) for c in seat.bound_box]
            top = max(p.z for p in pts); edge = max((p - Vector((x, y, p.z))).dot(fwd) for p in pts)
        if seat_h is None: seat_h = top if top is not None else 0.45
        pass   # (no seat at call time is fine: _seat_fix checks every frame at bake time and warns there)
        if top is not None and abs(top - seat_h) > 0.06:
            print(f'CZ SIT {self.name} t={t:.2f}: seat_h {seat_h:.2f} but {ob.name} top is {top:.2f} - using the seat top'); seat_h = top
        # the knee corner sits 6 cm past the front edge (the L's inner curve then clears the edge by the leg radius)
        th = thigh if thigh is not None else max(0.16 * s, (edge + 0.075) if edge is not None else 0.25 * s)
        self.thigh_len = th; self.seat_top = seat_h
        self.sit_opts = {'thigh': thigh, 'feet_y': feet_y, 'feet_z': feet_z, 'seat': seat}
        dz = seat_h - self.hh + 0.02
        # the reference's noodle legs stretch: feet on the floor in front of the knees up to a 0.75 m seat, dangling above
        fy = -(th + 0.05 * s) if feet_y is None else feet_y
        fz = (0.0 if seat_h <= 0.75 else seat_h - 0.42 * s) if feet_z is None else feet_z
        # the seat is checked again EVERY FRAME at bake time (_seat_fix) from where the character really is - a later
        # place() (a time cut, a walk to the chair) moved characters off the seat found here (L14: torso 5 cm in a chair)
        self.T['bodyz'].key(t, dz, dur, 'sine'); self.T['sitw'].key(t, 1.0, dur, 'sine'); self.T['seath'].key(t, seat_h, dur, 'sine')
        self.T['fL'].key(t, (0.09 * s, fy, fz), dur, 'sine'); self.T['fR'].key(t, (-0.09 * s, fy, fz), dur, 'sine')
        return self

    def stand(self, t, dur=0.4):
        """Stand up from a sit(): body back to hip height, legs straight, feet under the hips."""
        r = self.rest()
        self.T['bodyz'].key(t, 0.0, dur, 'sine'); self.T['sitw'].key(t, 0.0, dur * 0.8, 'sine')   # (seath stays: harmless at sitw 0)
        self.T['fL'].key(t, r['fL'], dur, 'sine'); self.T['fR'].key(t, r['fR'], dur, 'sine')
        return self

    def face(self, t, name, big=True):
        self.faces.append((t, name, big)); return self

    def talk(self, t0, t1, words, loud=1.0):
        """Lip-sync over the narration words between t0 and t1 (words: [{word,start,end}]).
        loud: mouth-open multiplier (1.6 = screaming: the normal range read as a calm remark on a panicked face)."""
        if loud != 1.0: self.loudness[(t0, t1)] = loud
        self.talks.append((t0, t1, [w for w in words if w['end'] > t0 and w['start'] < t1])); return self

    def extra(self, t0, t1, name): self.extras_k.append((t0, t1, name)); return self

    def walk(self, t0, t1, path, step=5.5, bob=0.07, stride=0.34):
        """Brisk walk along path [(x,y),...] from t0 to t1: quadIn start, linear-speed stop, planted feet.
        Afterwards the character stays where the walk ended, facing its last direction."""
        pts = [Vector((p[0], p[1], 0)) for p in path]
        self.walks.append((t0, t1, pts, step, bob, stride))
        d = (pts[-1] - pts[-2]).normalized()
        self.pos.key(t1 - 2e-4, (pts[-1].x, pts[-1].y), 1e-4, 'linear')
        self.yaw.key(t1 - 2e-4, math.degrees(math.atan2(-d.x, d.y)) + 180, 1e-4, 'linear')
        return self

    def hold(self, obj, hand, t0=-1e9, t1=1e9, offset=(0, -0.02, 0.0), rot=(0, 0, 0), follow='root', aim=None, release='stay'):
        """A prop in the hand from t0 to t1. offset/rot: in the character's frame (follow='root', the default) or in the
        forearm's frame (follow='arm': the prop's +Z runs along the forearm, elbow -> hand - signs, torches, poles tilt
        with the arm). aim=(x, y, z): the prop's front (-Y) turns to that point (a ticket shown to the camera / to a
        character). release='stay' (default): after t1 the prop stays where the hand left it ('reset': back home)."""
        self.holds.append((obj, hand, t0, t1, Vector(offset), Euler([math.radians(a) for a in rot]), follow,
                           Vector(aim) if aim is not None else None, release)); return self

    # ---- evaluation
    def _walk_at(self, t):
        for (t0, t1, pts, step, bob, stride) in self.walks:
            if not (t0 - 0.01 <= t <= t1): continue
            segs = [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
            total = sum((b - a).length for a, b in segs) or 1e-6
            T = t1 - t0
            k = clamp((t - t0) / T)
            ta, tb = 0.25, 0.2   # start / stop shares
            vmax = 1 / (1 - ta / 2 - tb / 2)
            if k < ta: s = vmax * k * k / (2 * ta)
            elif k < 1 - tb: s = vmax * (ta / 2 + (k - ta))
            else: kk = (1 - k); s = 1 - vmax * kk * kk / (2 * tb)
            d = s * total
            acc = 0; p = pts[-1]; dirv = (segs[-1][1] - segs[-1][0]).normalized()
            for a, b in segs:
                L = (b - a).length
                if acc + L >= d: p = a.lerp(b, (d - acc) / max(L, 1e-6)); dirv = (b - a).normalized(); break
                acc += L
            yaw = math.degrees(math.atan2(-dirv.x, dirv.y)) + 180
            moving = 0.0 < k < 1.0
            nsteps = max(1, round(total / stride)); Ls = total / nsteps
            ph = d / Ls
            return p, yaw, ph, moving, bob, Ls, dirv
        return None

    def _yaw_at(self, t):
        w = self._walk_at(t)
        return w[1] if w else self.yaw.at(t)

    def eval(self, t, f):
        out = {ch: tr.at(t) for ch, tr in self.T.items()}
        x, y = self.pos.at(t); yaw = self.yaw.at(t)
        root = Vector((x, y, 0))
        w = self._walk_at(t)
        if w:
            p, wyaw, ph, moving, bob, Ls, dirv = w
            root = p; yaw = wyaw
            if moving:
                # walk v2 (night 2): contact -> passing -> contact per step. At CONTACT (fr 0/1) the legs are spread,
                # the body is LOWEST, the arms are at their extremes (opposite to the legs), the torso is twisted most;
                # at PASSING (fr 0.5) the swing foot is highest and the body rides up. (v1 swung the arms a quarter
                # cycle late - peaking at passing - and bobbed the body the wrong way round.)
                s = self.s
                i = math.floor(ph); fr = ph - i
                lift = 0.075 * s * math.sin(math.pi * fr) ** 0.8
                lead, back = (0.5 * Ls), (-0.5 * Ls)
                swing = lerp(back, lead, cz.in_out_sine(fr)); plant = lerp(lead, back, fr)
                a, b = ('fL', 'fR') if i % 2 == 0 else ('fR', 'fL')
                sx = {'fL': 0.085 * s, 'fR': -0.085 * s}
                out[a] = (sx[a] * 0.92, -swing, lift); out[b] = (sx[b], -plant, 0.0)
                c2 = 0.5 + 0.5 * math.cos(2 * math.pi * fr)           # 1 at contact, 0 at passing
                out['bodyz'] = out['bodyz'] - 0.028 * s * c2 * (bob / 0.07)
                out['squash'] = out['squash'] * (1 - 0.025 * c2)
                arm = math.cos(math.pi * ph)                            # left arm: -1 front .. +1 back, opposite the left leg
                if out['hL'] == self.rest()['hL']:
                    A = 0.17 * s
                    hl, hr = out['hL'], out['hR']
                    out['hL'] = (hl[0] - 0.012 * s * abs(arm), hl[1] - A * arm, hl[2] + 0.03 * s * max(0, -arm))
                    out['hR'] = (hr[0] + 0.012 * s * abs(arm), hr[1] + A * arm, hr[2] + 0.03 * s * max(0, arm))
                out['twist'] = out['twist'] + 5.0 * arm
                out['sway'] = out['sway'] + 2.5 * math.sin(math.pi * ph)
                out['hyaw'] = out['hyaw'] - 3.0 * arm                  # the head stays on target, against the twist
                out['hroll'] = out['hroll'] - 1.5 * math.sin(math.pi * ph)
                out['lean'] = out['lean'] + 5
        # life in holds: a slow breath (0.8 % squash, ~3.4 s, per-character phase) - never a wobble
        out['squash'] = out['squash'] * (1 + 0.008 * math.sin(2 * math.pi * t / 3.4 + (__import__('zlib').crc32(self.name.encode()) % 100) * 0.06))
        # follow-through: the head lags a turn of the body by a few frames, then catches up
        dy = yaw - self._yaw_at(t - 4 / FPS)
        dy = (dy + 180) % 360 - 180
        out['hyaw'] = out['hyaw'] - clamp(dy * 0.3, -22, 22)
        # talking: the head nods into stressed words and sways a touch (the reference's talkers never hold still)
        for (t0, t1, words) in self.talks:
            if not (t0 <= t <= t1): continue
            for w in words:
                dur = w['end'] - w['start']
                if dur > 0.22 and -0.04 <= t - w['start'] <= 0.32:
                    k = clamp((t - w['start'] + 0.04) / 0.36)
                    out['hpitch'] += -3.2 * math.sin(math.pi * k) * min(1.0, dur / 0.4)
            out['hroll'] += 1.6 * math.sin(2 * math.pi * (t - t0) / 1.7)
        # a take (FP.TAKES): the head squashes 2 f, stretches past rest by frame 5, settles by 11 (volume kept)
        A, df = self._take(t)
        if A:
            if df < 2: sz = 1 - 0.1 * A * math.sin(math.pi / 2 * df / 2)
            elif df < 5: sz = 1 - 0.1 * A + 0.19 * A * math.sin(math.pi / 2 * (df - 2) / 3)
            else: sz = 1 + 0.09 * A * math.cos(math.pi * (df - 5) / 6) * math.exp(-(df - 5) / 3)
            out['hsq'] = sz
        self._apply(root, yaw, out, t, f)

    def _seat_fix(self, root, yaw, o, f=None):
        """Per frame: the solid under the hips -> correct the body height to its top, the thigh to its front edge and
        (default feet) the feet to the floor in front of the knees."""
        w = clamp(o.get('sitw', 0.0))
        if w < 1e-3: return
        opts = getattr(self, 'sit_opts', {}) or {}
        key = (round(root.x, 2), round(root.y, 2), round(yaw), round(o['seath'], 2))
        if '_seat_cache' not in self.__dict__: bpy.context.view_layer.update()   # objects built by the scene script: evaluate first
        cache = self.__dict__.setdefault('_seat_cache', {})
        if key not in cache:
            sc = bpy.context.scene
            # the scene AT THIS FRAME: a seat that moves (a car on a carrier, L12) was ray-cast where it stood when the
            # script ran, so a driver riding along found the road ("no seat under the hips"). A new key = a new place,
            # so a still sitter costs one frame_set, a rider one per frame.
            if f is not None and sc.frame_current != f: sc.frame_set(f)
            dg = bpy.context.evaluated_depsgraph_get()
            mine = tuple(c.name + '_' for c in ALL) + tuple(c.name for c in ALL)
            held = {h[0].name for c in ALL for h in getattr(c, 'holds', [])}
            fwd = Vector((math.sin(math.radians(yaw)), -math.cos(math.radians(yaw)), 0.0))
            res = None
            # rays under the hips AND under the thighs (hips over a chair's back gap missed the seat), the highest
            # solid below hip height wins
            for ahead in (0.0, 0.07, 0.14):
                org = Vector((root.x, root.y, root.z + o['seath'] + 0.22)) + fwd * ahead
                for _ in range(24):
                    hit, loc, nrm, idx, ob, M = sc.ray_cast(dg, org, Vector((0, 0, -1)))
                    if not hit: break
                    if ob.name.startswith(mine) or ob.name in mine or ob.name in held:
                        org = loc + Vector((0, 0, -0.002)); continue
                    if loc.z - root.z < 0.06: break                # the floor: sitting on the ground
                    if loc.z - root.z > o['seath'] + 0.16: org = loc + Vector((0, 0, -0.002)); continue   # an armrest / table above
                    sob = opts['seat'] if opts.get('seat') is not None else ob
                    pts = [sob.matrix_world @ Vector(c) for c in sob.bound_box]
                    edge = max((p - Vector((root.x, root.y, p.z))).dot(fwd) for p in pts)
                    # the surface under the HIPS wins; a ray further forward only replaces it when the hip ray fell
                    # into a gap (> 12 cm lower: a chair's back slot) - taking the highest hit let a car seat's front
                    # bolster lift the driver 15 cm off his cushion (L12)
                    h = loc.z - root.z
                    if res is None or h > res[0] + 0.12: res = (h, edge, sob.name)
                    break
            cache[key] = res
            if res is None and o['seath'] > 0.08 and not self.__dict__.get('_warned_air'):
                print(f'CZ SIT {self.name}: no seat under the hips at ({root.x:.2f}, {root.y:.2f}) - sitting on air'); self._warned_air = True
        res = cache[key]
        if res is None: return
        top, edge, _ = res; s = self.s
        o['bodyz'] += w * (top - o['seath'])
        self.seat_top = top
        if opts.get('thigh') is None: self.thigh_len = max(0.16 * s, edge + 0.075)
        if opts.get('feet_y') is None and opts.get('feet_z') is None:
            fy = -(self.thigh_len + 0.05 * s); fz = 0.0 if top <= 0.75 else top - 0.42 * s
            for k, sx in (('fL', 0.09 * s), ('fR', -0.09 * s)):
                cur = o[k]; o[k] = tuple(lerp(a, b, w) for a, b in zip(cur, (sx, fy, fz))) if w < 1 else (sx, fy, fz)

    def _apply(self, root, yaw, o, t, f):
        self._seat_fix(root, yaw, o, f)
        self.vals.setdefault('root', []).append(tuple(root))
        self.vals.setdefault('yaw', []).append(math.radians(yaw))
        M = Matrix.Translation((0, o['bodyy'], self.hh + o['bodyz'])) @ _rot(o['lean'], o['sway'], o['twist']) @ Matrix.Diagonal((1, 1, o['squash'], 1))
        self.vals.setdefault('torso_loc', []).append(tuple(M.to_translation()))
        self.vals.setdefault('torso_rot', []).append(tuple(M.to_euler()))
        self.vals.setdefault('torso_sc', []).append((1, 1, o['squash']))
        self.vals.setdefault('head_rot', []).append((math.radians(o['hpitch']), math.radians(o['hroll']), math.radians(o['hyaw'])))
        hs = o.get('hsq', 1.0); hx = 1 / math.sqrt(max(0.3, hs))
        self.vals.setdefault('head_sc', []).append((hx, hx, hs))
        s = self.s
        for sd, sx in (('L', 1), ('R', -1)):
            sh = M @ Vector((sx * self.rt * 0.86, 0, self.ht * 0.78))
            hp = M @ Vector(o['h' + sd])
            self._noodle('s' + sd, 'e' + sd, 'h' + sd, sh, hp, self.L_arm, Vector((sx * 0.75, 0.3, -0.55)))
            hip = M @ Vector((sx * 0.075 * s, 0, 0.05 * s))
            ft = Vector(o['f' + sd]) + Vector((0, 0, 0.045 * s))
            w = clamp(o.get('sitw', 0.0))
            knee = None
            if w > 1e-3:
                # seated: the thigh lies ON the seat (character-forward = -Y in root space) to a knee corner just past
                # the seat's front edge, at the seat top + the leg's radius; the limb curve bends there like an L
                # (sharpness = w, the knee empty's scale x) and the shin hangs to the foot
                th = getattr(self, 'thigh_len', 0.22 * s)
                top = getattr(self, 'seat_top', hip.z - 0.07 * s)
                knee = Vector((hip.x * 1.04, hip.y - th, top + 0.036 * s))
            self._noodle('p' + sd, 'k' + sd, 'f' + sd, hip, ft, self.L_leg, Vector((sx * 0.15, -1.0, 0.25)), leg=True, knee=knee, kw=w)
        # face (procedural: one parameter dict per frame for tools/facegen.py; the atlas values stay as a fallback)
        self.vals.setdefault('fp', []).append(self._face_params(t, f))
        fc, mo, mopen, ex = self._face_at(t, f)
        self.vals.setdefault('face', []).append(fc); self.vals.setdefault('mouth', []).append(mo)
        self.vals.setdefault('mopen', []).append(mopen); self.vals.setdefault('extra', []).append(ex)

    def _noodle(self, a, b, c, A, C, L, pref, leg=False, knee=None, kw=0.0):
        d = (C - A).length
        chord = (C - A).normalized() if d > 1e-6 else Vector((0, 0, -1))
        n = pref - chord * pref.dot(chord)
        n = n.normalized() if n.length > 1e-6 else Vector((0, 1, 0))
        # rubber hose (motion v2): the reference's arms are one smooth arc that never balloons - the bend grows with
        # the slack but is capped at a fraction of the chord (the old full-length arc made loops at rest)
        slack = math.sqrt(max(0.0, L * L - d * d))
        dev = min(slack * (0.42 if leg else 0.2), (0.34 if leg else 0.26) * d + 0.025)
        B = (A + C) / 2 + n * dev * 2
        if knee is not None and kw > 0: B = B.lerp(knee, kw)      # the corner itself: the cubic's handles sit on it
        for k, v in ((a, A), (b, B), (c, C)): self.vals.setdefault(k, []).append(tuple(v))
        self.vals.setdefault('sharp_' + b, []).append((1.0 + (kw if knee is not None else 0.0), 1.0, 1.0))

    def _face_at(self, t, f):
        F = cz.FACES['faces']
        cur = self.faces[0]; prev = None
        for fk in self.faces:
            if fk[0] <= t + 1e-6: prev, cur = cur, fk
        name = cur[1]; info = F.get(name, F['neutral'])   # (legacy atlas: v3 presets like 'sly' have no sprite)
        cell = info['open']
        df = round((t - cur[0]) * FPS)
        # swap through closed eyes: frame -2 old half, -1 new shut (big) / one shut frame (small)
        nxt = [fk for fk in self.faces if fk[0] > t + 1e-6]
        if nxt:
            nf = round((nxt[0][0] - t) * FPS)
            if nxt[0][2] and nf == 2 and info['eyes']: cell = info['half']
            if nf == 1: cell = F.get(nxt[0][1], F['neutral'])['shut']
        blink = self._blink(f)
        if blink and info['eyes'] and df > 3: cell = info['half'] if blink == 1 else info['shut']
        mouth, mopen = info['mouth'], 1.0
        for (t0, t1, words) in self.talks:
            if t0 <= t <= t1:
                v = self._viseme(t, words)
                if v is not None and v > 0.05:
                    tm = TALK.get(name, 'gape'); mouth, mopen = F[tm]['mouth'], v
        ex = -1
        for (t0, t1, nm) in self.extras_k:
            if t0 <= t <= t1: ex = cz.FACES['extras'][nm]
        return float(cell), float(mouth), float(mopen), float(ex)

    # ---- procedural face (engine/faceparams.py + tools/facegen.py)
    def look(self, t, gx=0.0, gy=0.0, dur=0.07):
        """Pupils to (gx, gy) in -1..1 (eye-radius units, + = character's left / up), in 2 frames ease-out."""
        self.gaze.key(t, (gx, gy), dur, 'out'); return self

    def _preset(self, k):
        P = FP.P.get(k[1], FP.P['neutral'])
        if len(k) > 3 and k[3]: P = dict(P); P.update(k[3])
        return P

    def _take(self, t):
        """The take now playing: (amplitude, frames since it started) - a face key into a TAKES expression (big swap)."""
        for k in reversed(self.faces):
            if k[0] <= t + 1e-6:
                A = FP.TAKES.get(k[1], 0.0) if k[2] else 0.0
                df = (t - k[0]) * FPS
                return (A, df) if A and df < 14 else (0.0, 99.0)
        return 0.0, 99.0

    def _face_params(self, t, f):
        keys = self.faces
        def at(tt):
            i = max([j for j, k in enumerate(keys) if k[0] <= tt + 1e-6] or [0])
            cur = keys[i]; prev = keys[i - 1] if i > 0 else cur
            # an expression lands in 5 frames with an OVERSHOOT (easeOutBack: ~10 % past the target at frame 3-4, then
            # settles) - the reference's brows and mouths snap past their mark and drift back (faces v3)
            k = back_out(((tt - cur[0]) * FPS) / 5.0)
            return FP.mix(self._preset(prev), self._preset(cur), k), cur, (tt - cur[0]) * FPS
        face, cur, df = at(t)
        # a big swap hides behind closed eyes, so the eyes reopen already IN the new shape (the reference's rings are
        # full on the first open frame; a blended lid drew a line across them) - brows and mouth keep the overshoot
        if cur[2] and 0.0 <= df < 6:
            tgt = self._preset(cur)
            for kk in ('eo_L', 'eo_R', 'el_L', 'el_R', 'lt_L', 'lt_R', 'es', 'em', 'pupil'): face[kk] = tgt[kk]
        A, tdf = self._take(t)
        if A:    # a take: the eyes pop past full size and settle (in step with the head squash -> stretch in eval)
            face['pop'] = 1 + 0.17 * A * math.sin(math.pi * clamp((tdf - 1) / 7)) * (1 if tdf >= 1 else 0)
        brows, _, _ = at(t + 2 / FPS)                          # brows lead the eyes and mouth by 2 frames
        for kk in ('bh_L', 'bh_R', 'bt_L', 'bt_R', 'ba_L', 'ba_R', 'bw'): face[kk] = brows[kk]
        mode = int(round(face['em']))
        # big swaps go through closed eyes (MOTION.md): the frame before and the frame of the swap
        nxt = [k for k in keys if k[0] > t + 1e-6]
        near_swap = (cur[2] and -0.5 <= df < 1.0) or (nxt and nxt[0][2] and 0 < (nxt[0][0] - t) * FPS <= 1.5)
        b = self._blink(f)
        if mode in (0, 2):
            if near_swap: face['eo_L'] *= 0.12; face['eo_R'] *= 0.12
            elif b and df > 3 and face['eo_L'] > 0.3:
                m = 0.42 if b == 1 else 0.0
                face['eo_L'] *= m; face['eo_R'] *= m
        g = self.gaze.at(t); face['gx'] += g[0]; face['gy'] += g[1]
        # lip-sync on twos inside the expression (a smiling talker keeps smiling)
        for (t0, t1, words) in self.talks:
            if not (t0 <= t <= t1): continue
            # mouth shapes lead the sound by ~1.5 frames (the reference opens a frame before the word), on twos
            tq = (math.floor((t + 2.5 / FPS) * FPS / 2) * 2) / FPS   # the mouth leads the sound by ~2.5 frames, on twos (reference)
            # co-articulation: in a short gap between two words (< 0.28 s) or just after a word (0.1 s) the mouth does not
            # snap shut - it carries the last letter's shape at ~60 % (the reference talks continuously: f150 "man, Not")
            cw = next((w for w in words if w['start'] <= tq < w['end']), None)
            carry = 1.0
            if cw is None:
                prv = max((w for w in words if w['end'] <= tq), key=lambda w: w['end'], default=None)
                nxt = min((w for w in words if w['start'] > tq), key=lambda w: w['start'], default=None)
                if prv and (tq - prv['end'] < 0.1 or (nxt and nxt['start'] - prv['end'] < 0.28)):
                    cw = dict(prv); cw['_tail'] = True; carry = 0.6
            for w in ([cw] if cw else []):
                if True:
                    txt = ''.join(ch for ch in w['word'].lower() if ch.isalpha()) or 'a'
                    kq = 0.999 if w.get('_tail') else (tq - w['start']) / max(1e-3, w['end'] - w['start'])
                    vo, vw, vr, vt = FP.VIS[FP.viseme_of(letter_at(txt, kq))]
                    if w.get('_tail'):
                        if vo < 0.2: vo, vw, vr, vt = FP.VIS['etc']
                        vo *= carry
                    # the reference's talking mouths are BIG (wide opens ~1/3 of the head): the viseme sets the width,
                    # the expression's resting width only nudges it
                    face['mo'] = vo * (0.9 + 0.35 * min(1.0, face['mo']))
                    face['mw'] = lerp(face['mw'], 1.05 * vw, clamp(0.35 + vo * 1.2 if vt != 2 else 0.85))
                    L = self.loudness.get((t0, t1), 1.0)
                    if L != 1.0: face['mo'] *= L; face['mw'] *= 1 + 0.3 * (L - 1)
                    face['mr'] = max(face['mr'] * 0.5, vr); face['mt'] = vt if vo > 0.3 else face['mt']
                    face['mg'] = 0.35 if vo > 0.6 else 0.0
                    if (w['end'] - w['start']) > 0.3 and (t - w['start']) < 0.2:   # stressed word: a small brow lift
                        lift = 0.012 * math.sin(math.pi * clamp((t - w['start']) / 0.2))
                        face['bh_L'] += lift; face['bh_R'] += lift
                    break
        for (t0, t1, nm) in self.extras_k:
            if t0 <= t <= t1 and 'x_' + nm in face:
                face['x_' + nm] = max(face['x_' + nm], clamp(min(t - t0, t1 - t) * FPS / 3))
        return {k: round(v, 4) for k, v in face.items()}

    def _bake_faces(self, f0, f1):
        """Write this character's per-frame face parameters, draw them (tools/facegen.py) and put the image sequence
        on the head."""
        import json, os, subprocess
        if not cz.FACE_DIR or 'fp' not in self.vals: return
        d = os.path.join(cz.FACE_DIR, self.name); os.makedirs(d, exist_ok=True)
        js = os.path.join(cz.FACE_DIR, self.name + '.json')
        json.dump({'frames': {str(f0 + i): p for i, p in enumerate(self.vals['fp'])}, 'style': self.face_style}, open(js, 'w'))
        # CZ_PY: the Python with Pillow + numpy (Toon Studio passes its own); the lab's .venv otherwise (Windows / macOS)
        py = cz.py()
        r = subprocess.run([py,os.path.join(cz.LAB, 'tools', 'facegen.py'), js, d], capture_output=True, text=True,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        print('CZ', (r.stdout or '').strip()[-200:], (r.stderr or '').strip()[-400:])
        first = os.path.join(d, f'{f0:04d}.png')
        if not os.path.exists(first): print('CZ FACES MISSING', self.name); return
        # pad 24 frames before / after with the first / last face: a dissolve renders a shot outside its own range
        # (before F0 the image sequence pointed at missing files -> a magenta head)
        import shutil
        for pre in ('', 'br_'):
            a, b = os.path.join(d, f'{pre}{f0:04d}.png'), os.path.join(d, f'{pre}{f1:04d}.png')
            for k in range(1, 25):
                if f0 - k >= 1 and os.path.exists(a): shutil.copyfile(a, os.path.join(d, f'{pre}{f0 - k:04d}.png'))
                if os.path.exists(b): shutil.copyfile(b, os.path.join(d, f'{pre}{f1 + k:04d}.png'))
        m = cz.face_material_seq(self.name + '_faceseq', first, f1, self.skin, 0.55, self.R, fv=self.face_v, fs=self.face_s)
        self.head.data.materials[0] = m
        # the brows again on the hair (br_####.png, same projection): raised brows ride up over the hairline (reference)
        bfirst = os.path.join(d, f'br_{f0:04d}.png')
        hair = bpy.data.objects.get(self.name + '_hair')
        if hair and os.path.exists(bfirst) and hair.data.materials:
            hair.data.materials[0] = cz.brow_overlay(hair.data.materials[0], bfirst, f1, self.R, fv=self.face_v, fs=self.face_s)

    def blink(self, t):
        """A blink placed by hand at time t (3 frames: half, shut, half) - the reference blinks on beats (after a take,
        before a side glance). Automatic blinks keep running elsewhere."""
        self._blink(0); self._blinks.add(int(round(t * FPS)) + 1); return self

    def _blink(self, f):
        if not hasattr(self, '_blinks'):
            self._blinks, x = set(), 20 + self.rng.randint(0, 40)
            while x < 30 * 400: self._blinks.add(x); x += self.rng.randint(45, 120)
        for b in self._blinks:
            if 0 <= f - b < 3: return 2 if f - b == 1 else 1
        return 0

    def _viseme(self, t, words):
        # on twos: the mouth holds each shape 2 frames
        tq = (math.floor(t * FPS / 2) * 2) / FPS
        for w in words:
            if w['start'] <= tq < w['end']:
                txt = ''.join(ch for ch in w['word'].lower() if ch.isalpha()) or 'a'
                k = (tq - w['start']) / max(1e-3, w['end'] - w['start'])
                ch = txt[min(len(txt) - 1, int(k * len(txt)))]
                if ch in 'mbp': return 0.0
                if ch in 'aei': return 1.0
                if ch in 'ouy': return 0.72
                if ch in 'fvw': return 0.35
                return 0.55
        return None

    def bake(self, f0, f1):
        # brush-like ink on every character mesh (thick on the shadow side, thin in the light, swelling along the
        # contour - cz.ink_weight), once
        if not getattr(self, '_inked', False):
            stack = [self.root]
            while stack:
                o = stack.pop(); stack.extend(o.children)
                if o.type == 'MESH' and 'cz_outline' in o.modifiers and not any(m.type == 'NODES' for m in o.modifiers):
                    cz.ink_weight(o, seed=__import__('zlib').crc32(o.name.encode()) & 0xffff)
            self._inked = True
        self.vals = {}
        for f in range(f0, f1 + 1): self.eval((f - 1) / FPS, f)
        V = self.vals
        cz.bake(self.root, 'location', V['root'], f0)
        cz.bake(self.root, 'rotation_euler', [(0, 0, y) for y in V['yaw']], f0)
        cz.bake(self.torso_pv, 'location', V['torso_loc'], f0)
        cz.bake(self.torso_pv, 'rotation_euler', V['torso_rot'], f0)
        cz.bake(self.torso_pv, 'scale', V['torso_sc'], f0)
        cz.bake(self.head_pv, 'rotation_euler', V['head_rot'], f0)
        if any(s != (1.0, 1.0, 1.0) for s in V['head_sc']): cz.bake(self.head_pv, 'scale', V['head_sc'], f0)
        for k, e in self.ctrl.items(): cz.bake(e, 'location', V[k], f0)
        for k in ('kL', 'kR', 'eL', 'eR'):          # limb bend sharpness (the knee / elbow empty's scale x)
            if any(v[0] != 1.0 for v in V.get('sharp_' + k, [])): cz.bake(self.ctrl[k], 'scale', V['sharp_' + k], f0)
        for k in ('face', 'mouth', 'mopen', 'extra'): cz.bake(self.head, f'["{k}"]', V[k], f0, interp='CONSTANT')
        self._bake_faces(f0, f1)
        # held props follow the hand (world matrix evaluated per frame after the body keys exist)
        if self.holds:
            sc = bpy.context.scene
            per = {id(h): [] for h in self.holds}
            # the prop keeps its own built orientation (a card made with rot=(90,0,0) stays upright): rot and the hold
            # frame are applied ON TOP of it (night 2: an aimed ticket went edge-on - its own rotation was replaced)
            own = {id(h): h[0].rotation_euler.to_matrix().to_4x4() for h in self.holds}
            for f in range(f0, f1 + 1):
                sc.frame_set(f); t = (f - 1) / FPS
                for h in self.holds:
                    obj, hand, t0, t1, off, rot, follow, aim, release = h
                    if t0 <= t <= t1:
                        hp = self.ctrl['h' + hand].matrix_world.to_translation()
                        Mr = self.root.matrix_world.to_3x3()
                        if follow == 'arm':
                            ep = self.ctrl['e' + hand].matrix_world.to_translation()
                            fa = (hp - ep); fa = fa.normalized() if fa.length > 1e-6 else Vector((0, 0, 1))
                            B = fa.to_track_quat('Z', 'Y').to_matrix()       # +Z along the forearm
                        else: B = Mr
                        if aim is not None:
                            d = aim - hp
                            if d.length > 1e-6: B = (-d.normalized()).to_track_quat('Y', 'Z').to_matrix()   # -Y (front) to the point
                        per[id(h)].append((hp + B @ off, (B.to_4x4() @ rot.to_matrix().to_4x4() @ own[id(h)]).to_euler()))
                    else: per[id(h)].append(None)
            for h in self.holds:
                obj = h[0]; seq = per[id(h)]
                if all(s is None for s in seq): continue
                home = (obj.location.copy(), obj.rotation_euler.copy())
                fill, last = [], None
                for s in seq:        # before the grab: home; after the release: where the hand left it (or home)
                    if s is not None: last = s; fill.append(s)
                    else: fill.append(last if (last is not None and h[8] == 'stay') else home)
                cz.bake(obj, 'location', [tuple(s[0]) for s in fill], f0)
                cz.bake(obj, 'rotation_euler', [tuple(s[1]) for s in fill], f0)


def letter_at(txt, k):
    """The letter sounding at fraction k of a word: vowels take ~2.4x a consonant's time, doubled letters are one sound,
    a silent final e is dropped (v1 split words evenly by letter: 'Sorry' opened on 'o' 3 frames late vs the reference)."""
    t = txt[:-1] if len(txt) > 2 and txt.endswith('e') and txt[-2] not in 'aeiouy' else txt
    seq = [c for i, c in enumerate(t) if i == 0 or c != t[i - 1]] or ['a']
    w = [2.4 if c in 'aeiouy' else 1.0 for c in seq]; tot = sum(w); acc = 0.0
    for c, wi in zip(seq, w):
        acc += wi / tot
        if k < acc: return c
    return seq[-1]


# talking mouth per expression family (scaled open/closed by the viseme)
TALK = {n: 'happy' for n in ('happy', 'smile', 'laugh', 'excited', 'manic', 'blissful', 'love', 'starstruck', 'smug', 'scheming', 'wink', 'calm', 'whistle')}


# ---------------------------------------------------------------- hair / accessories
def hair_cap(color='#2b2320', front=0.52, sides=0.05, back=-0.55, thick=0.028, bangs=0.0, part=0.0, tuft=None, puff=1.06, scale_xyz=(1, 1, 1),
             crown=90.0, bun=None, spikes=0, inkline=True):
    """Hair shell over the head: kept where the direction's height is above a hairline that runs front -> sides -> back.
    bangs: dip of the front hairline in the middle (fringe); part: shift of the dip sideways; tuft: (height, lean) cone."""
    def zline(phi):
        # phi: angle around the head, 0 = front (-Y). Returns the hairline height (sin of elevation)
        dx, fr = math.sin(phi), math.cos(phi)
        if fr >= 0: return lerp(sides, front - bangs * max(0, 1 - abs(dx - part) * 2.2), fr ** 0.8)
        return lerp(sides, back, (-fr) ** 0.8)

    def build(c):
        R = c.R * puff
        # a lofted cap: rings from the crown down to a smooth hairline (no stair-steps)
        bm = bmesh.new(); NU, NV = 96, 28
        e_top = math.radians(crown)          # < 90: bald crown, the hair is a band around the head
        full = crown >= 89.9
        top = bm.verts.new((0, 0, R)) if full else None
        grid = []
        for j in range(1 if full else 0, NV + 1):
            row = []
            for i in range(NU):
                phi = 2 * math.pi * i / NU
                e_end = math.asin(clamp(zline(phi), -0.98, 0.98))
                e = lerp(e_top, e_end, j / NV)
                rr = R * (1 + (0.05 * max(0.0, math.cos(spikes * phi)) * (j / NV) if spikes else 0))
                d = Vector((math.sin(phi) * math.cos(e), -math.cos(phi) * math.cos(e), math.sin(e)))
                row.append(bm.verts.new(d * rr))
            grid.append(row)
        if full:
            for i in range(NU): bm.faces.new((top, grid[0][i], grid[0][(i + 1) % NU]))
        for j in range(NV - 1):
            for i in range(NU):
                bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][(i + 1) % NU], grid[j][(i + 1) % NU]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for v in bm.verts: v.co = Vector((v.co.x * scale_xyz[0], v.co.y * scale_xyz[1], v.co.z * scale_xyz[2]))
        o = cz._mesh_obj(c.name + '_hair', bm, cz.toon(c.name + '_hairm', color, 0.85, tex='hair', tex_scale=1.0 / max(0.5, c.s), sheen=0.4))   # lift 0.85: the reference's hair stays deep brown under warm light
        cz.place(o, (0, 0, 0), parent=c.head)
        so = o.modifiers.new('thick', 'SOLIDIFY'); so.thickness = thick * c.s; so.offset = -1
        cz.outline(o, 0.006 * c.s)
        # the reference draws a dark ink line along the hair's lower edge over the forehead and the sides (an inverted
        # hull only inks silhouettes, so the hairline had no line at all): a thin tube along the hairline ring
        ring = [Vector((v.co.x, v.co.y, v.co.z)) for v in o.data.vertices][-NU:]
        pts = [p * 1.004 for i, p in enumerate(ring) if math.cos(2 * math.pi * i / NU) > -0.35]
        if inkline and len(pts) > 4:          # inkline=False: hair whose edge is drawn by its own outlined pieces (curls)
            cu = bpy.data.curves.new(c.name + '_hairline', 'CURVE'); cu.dimensions = '3D'
            sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
            for k, p in enumerate(pts): sp.points[k].co = (p.x, p.y, p.z, 1)
            cu.bevel_depth = 0.0105 * R / 0.24 * (c.s if c.s < 1 else 1); cu.bevel_resolution = 2; cu.use_fill_caps = True
            lo = bpy.data.objects.new(c.name + '_hairline', cu); cz.place(lo, (0, 0, 0), parent=c.head)
            cu.materials.append(cz.glow('cz_inkline', '#0f0c0a', 1.0))
        if tuft:
            h, lean = tuft
            tf = cz.cyl(c.name + '_tuft', 0.05 * c.s, h * c.s, (0, 0.02, R * 0.92), cz.toon(c.name + '_hairm', color), rot=(lean, 0, 0), r2=0.004, ol=0.005, parent=c.head, verts=16)
        if bun:
            br, bz, by = bun
            cz.sphere(c.name + '_bun', br * c.s, (0, by * R, bz * R), cz.toon(c.name + '_hairm', color), ol=0.005, parent=c.head, segs=32, rings=16)
        return o
    return build


def suit(jacket='#2d3a55', shirt='#f2f0ea', tie='#b02a2a', tag=None):
    """Jacket torso with a shirt V, a tie and an optional name tag (accessories on the body)."""
    def build(c):
        s = c.s; ht, rt = c.ht, c.rt
        v = cz.box(c.name + '_shirtv', (rt * 0.62, 0.01, ht * 0.38), (0, -rt * 0.8 * c.belly - 0.002, ht * 0.68), cz.toon(c.name + '_shirtm', shirt), rot=(0, 0, 0), bevel=0.0, ol=0.0, parent=c.body)
        v.scale = (1, 1, 1)
        # trim the V: two jacket flaps over the shirt panel
        for sx in (1, -1):
            cz.box(c.name + f'_lapel{sx}', (rt * 0.42, 0.012, ht * 0.5), (sx * rt * 0.3, -rt * 0.8 * c.belly - 0.006, ht * 0.62), cz.toon(c.name + '_shirt', jacket), rot=(0, sx * 22, 0), bevel=0.0, ol=0.0, parent=c.body)
        if tie:
            cz.box(c.name + '_tie', (0.032 * s, 0.012, ht * 0.34), (0, -rt * 0.8 * c.belly - 0.01, ht * 0.66), cz.toon(c.name + '_tiem', tie), bevel=0.004, ol=0.003, parent=c.body)
        if tag:
            cz.box(c.name + '_tag', (0.07 * s, 0.008, 0.03 * s), (-rt * 0.45, -rt * 0.8 * c.belly - 0.012, ht * 0.7), cz.toon(c.name + '_tagm', tag), bevel=0.003, ol=0.002, parent=c.body)
    return build


def glasses(color='#1a1410', r=0.055):
    def build(c):
        R = c.R; m = cz.toon('cz_glasses', color, 0.8)
        for sx in (1, -1):
            bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=False, segments=32, radius=r * c.s)
            o = cz._mesh_obj(c.name + f'_lens{sx}', bm, m, smooth=False)
            cz.place(o, (sx * R * 0.29, -R * 0.99, R * 0.02 - 0.0), rot=(90, 0, 0), parent=c.head)
            sk = o.modifiers.new('wire', 'SKIN') if False else None
            w = o.modifiers.new('w', 'WIREFRAME'); w.thickness = 0.008 * c.s
        cz.box(c.name + '_bridge', (R * 0.14, 0.006, 0.007), (0, -R * 1.0, R * 0.04), m, bevel=0, ol=0, parent=c.head)
    return build


def combo(*fs):
    def build(c):
        for f in fs: f(c)
    return build
