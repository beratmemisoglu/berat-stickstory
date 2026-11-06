# The camera grammar measured on the reference (ref/ANSWER_KEY.md): framings (holds with a slow creep) linked by fast
# in-out flights through the set (median 13 f, speed peak mid-flight, motion blur). Focus follows the framing's subject
# (focus distance keyed per frame from the subject's real position, also during flights).
import bpy, math
from mathutils import Vector
import cz
from cz import FPS, clamp, lerp


def ease_flight(k, p=2.6):
    """In-out with the speed peak in the middle (a symmetric power ease)."""
    k = clamp(k)
    return 0.5 * (2 * k) ** p if k < 0.5 else 1 - 0.5 * (2 * (1 - k)) ** p


class Cam:
    def __init__(self, name='cam', lens=32, fstop=2.2, sensor=24, bounds=None, min_fstop=1.9):
        """bounds: ((xmin, ymin, zmin), (xmax, ymax, zmax)) the camera must stay inside (the set's walls, minus a margin).
        min_fstop: depth of field never shallower than this (f/1.4 CUs blurred the dressed sets to mush: the reference's
        backgrounds are soft but still read)."""
        self.bounds = (Vector(bounds[0]), Vector(bounds[1])) if bounds else None
        self.min_fstop = min_fstop
        cd = bpy.data.cameras.new(name); cd.lens = lens; cd.sensor_fit = 'VERTICAL'; cd.sensor_height = sensor
        cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop; cd.clip_start = 0.02; cd.clip_end = 200
        self.obj = bpy.data.objects.new(name, cd); bpy.context.scene.collection.objects.link(self.obj)
        bpy.context.scene.camera = self.obj
        self.F = []

    def frame(self, t, eye, target, lens=None, fstop=None, focus=None, creep=0.0019, fly=13, path=None, roll=0.0, follow=None, follow_k=1.0):
        """A framing that is reached at time t (the flight to it ends at t). focus: object, (object, offset) or point.
        creep: dolly toward the target per frame during the hold (0.19 %/f measured). fly: flight frames (0 = cut).
        path: optional waypoints (eye positions) the flight passes through. follow: an object the framing rides with
        (eye and target move by follow_k x its motion since t: tracking shots of walkers)."""
        f0 = None
        if follow is not None:
            bpy.context.scene.frame_set(int(round(t * FPS)) + 1); f0 = follow.matrix_world.to_translation().copy()
        self.F.append(dict(t=t, eye=Vector(eye), target=Vector(target), lens=lens or (self.F[-1]['lens'] if self.F else self.obj.data.lens),
                           fstop=fstop or (self.F[-1]['fstop'] if self.F else self.obj.data.dof.aperture_fstop),
                           focus=focus, creep=creep, fly=fly, path=[Vector(p) for p in (path or [])], roll=roll,
                           follow=follow, follow0=f0, follow_k=follow_k))
        return self

    def push(self, t_cut, amount=0.32, dur=0.6, lens_k=1.0):
        """Push into a cut (MOTION.md: cubicIn, the speed peaks ON the transition): from the framing held at t_cut - dur,
        dolly `amount` of the way to its target, accelerating until the cut at t_cut."""
        eye, tgt, lens, fstop, _, roll = self._at(t_cut - dur)
        self.frame(t_cut, eye + (tgt - eye) * amount, tgt, lens=lens * lens_k, fstop=fstop, focus=self.F[-1]['focus'],
                   creep=0.0, fly=int(round(dur * FPS)), roll=roll,
                   follow=self.F[-1].get('follow'), follow_k=self.F[-1].get('follow_k', 1.0))
        self.F[-1]['ease'] = 'in'
        if self.F[-1]['follow0'] is not None and self.F[-2].get('follow0') is not None:
            self.F[-1]['follow0'] = self.F[-2]['follow0']   # keep riding the same subject offset
        return self

    def jolt(self, t, amp=0.035, frames=8):
        """An impact jolt (a slam, a fall): the camera kicks and settles over `frames`, decaying. Holds stay dead still
        otherwise (the reference never wobbles), so use it only on a hit."""
        self.jolts = getattr(self, 'jolts', []) + [(t, amp, frames)]
        return self

    def _jolt_at(self, t):
        off = Vector()
        for (t0, amp, n) in getattr(self, 'jolts', []):
            k = (t - t0) * FPS
            if 0 <= k < n:
                d = amp * (1 - k / n) ** 2
                off += Vector((math.sin(k * 2.3) * d, 0.0, math.cos(k * 3.1) * d * 0.8))
        return off

    def _follow(self, f):
        if f.get('follow') is None: return Vector()
        d = f['follow'].matrix_world.to_translation() - f['follow0']; d.z = 0     # floor path only, never bobs
        return d * f['follow_k']

    def shot(self, t, subject, size='cu', yaw=0.0, pitch=8.0, lens=None, head_y=0.40, head_x=0.5, head_d=0.48, rel=None, **kw):
        """A framing by shot size (MOTION.md, 9:16): the frame's width spans SPAN[size] head diameters, the subject point
        (a head centre: Vector, object or (object, offset)) sits at head_x across and head_y down from the top.
        yaw: camera azimuth around the subject in degrees (0 = from -Y, + = from the subject's left / +X side),
        rel: a Char: yaw is then relative to the way that character faces at t (0 = straight in front of them).
        pitch: degrees above the subject (camera looks down). If the camera would land outside self.bounds (walls),
        it moves in along its line of sight and widens the lens so the framing stays the same.
        at: read the subject's position and facing at this time instead of t (a subject still walking or turning when
        the flight starts: frame where they will be when the camera lands, e.g. at=t + fly / 30)."""
        te = kw.pop('at', None); te = t if te is None else te
        if rel is not None: yaw += rel.yaw.at(te) if not rel.walks else rel._walk_at(te)[1] if rel._walk_at(te) else rel.yaw.at(te)
        SPAN = {'ecu': 0.78, 'cu': 1.75, 'mcu': 2.5, 'ms': 3.7, 'mws': 5.2, 'ws': 9.0, 'xws': 14.0}
        is_obj = isinstance(subject, bpy.types.Object) or (isinstance(subject, (tuple, list)) and subject and isinstance(subject[0], bpy.types.Object))
        if is_obj:   # where the subject is at time t (characters are baked before the camera)
            bpy.context.scene.frame_set(int(round(te * FPS)) + 1)
            sub = _focus_point({'focus': subject}, bpy.context.scene)
        else: sub = Vector(subject)
        lens = lens or (self.F[-1]['lens'] if self.F else self.obj.data.lens)
        sw = self.obj.data.sensor_height * 9 / 16
        hf = 2 * math.atan(sw / 2 / lens)
        span = SPAN.get(size, size) if isinstance(size, str) else size
        W = span * head_d; Hh = W * 16 / 9
        d = (W / 2) / math.tan(hf / 2)
        y, p = math.radians(yaw), math.radians(pitch)
        back = Vector((math.sin(y) * math.cos(p), -math.cos(y) * math.cos(p), math.sin(p)))
        inside = self.bounds and all(self.bounds[0][i] <= sub[i] <= self.bounds[1][i] for i in range(3))
        if self.bounds and not inside:
            print(f'CZ CAM t={t:.2f}: subject outside the set bounds, no wall clamp (shoot it from inside instead)')
        if inside:
            lo, hi = self.bounds; dmax = d
            for i in range(3):
                if abs(back[i]) < 1e-6: continue
                lim = (hi[i] if back[i] > 0 else lo[i]) - sub[i]
                dmax = min(dmax, max(0.15, lim / back[i]))
            if dmax < d:
                lens = lens * dmax / d; d = dmax
                print(f'CZ CAM t={t:.2f} {size}: wall at {d:.2f} m, lens -> {lens:.1f} mm')
        eye = sub + back * d
        fwd = -back; right = fwd.cross(Vector((0, 0, 1))).normalized(); up = right.cross(fwd).normalized()
        target = sub + up * ((head_y - 0.5) * Hh) + right * ((0.5 - head_x) * W) + fwd * 0.0
        tgt = eye + (target - eye).normalized() * d
        return self.frame(t, eye, tgt, lens=lens, focus=kw.pop('focus', subject if not isinstance(subject, Vector) else tuple(sub)), **kw)

    def _at(self, t):
        F = self.F
        i = max([j for j, f in enumerate(F) if f['t'] - f['fly'] / FPS <= t + 1e-6] or [0])
        cur = F[i]
        fl = cur['fly'] / FPS
        if i > 0 and fl > 0 and t < cur['t']:
            prev = F[i - 1]
            e0, t0, l0, fs0 = self._hold(prev, cur['t'] - fl)
            kk = (t - (cur['t'] - fl)) / fl
            k = clamp(kk) ** 3 if cur.get('ease') == 'in' else ease_flight(kk)
            pts = [e0] + cur['path'] + [cur['eye']]
            eye = _bez(pts, k)
            tgt = t0.lerp(cur['target'], k)
            lens = math.exp(lerp(math.log(l0), math.log(cur['lens']), k))
            fstop = lerp(fs0, cur['fstop'], k)
            return eye, tgt, lens, fstop, (prev, cur, k), lerp(prev['roll'], cur['roll'], k)
        eye, tgt, lens, fstop = self._hold(cur, t)
        return eye, tgt, lens, fstop, (cur, cur, 1.0), cur['roll']

    def _hold(self, f, t):
        n = max(0.0, (t - f['t']) * FPS)
        d = f['target'] - f['eye']
        k = 1 - (1 - f['creep']) ** n          # dolly in by creep per frame
        k = min(k, 0.35)
        return f['eye'] + d * k, f['target'], f['lens'], f['fstop']

    def bake(self, f0, f1, motion_blur=True, ink_px=7.0):
        """ink_px: outline width on screen in pixels of the full-size frame (1080x1920, or 1920x1080: the same pixels on
        the same 1080 px short side) for a standard 6 mm line (the reference keeps its lines the same width at any
        distance; a fixed-thickness hull goes hairline in wide shots)."""
        sc = bpy.context.scene
        locs, rots, lenses, fst, foc = [], [], [], [], []
        inked = [o for o in sc.objects if o.type == 'MESH' and 'cz_outline' in o.modifiers and 'cz_ol' in o]
        ink_vals = {o.name: [] for o in inked}
        H = float(sc.render.resolution_y); sh = self.obj.data.sensor_height   # (the sensor fits the frame's height)
        # bounds of objects that never move are measured once (a 930-object prop made every frame cost seconds)
        def moving(o):
            while o is not None:
                if o.animation_data and o.animation_data.action: return True
                o = o.parent
            return False
        sc.frame_set(f0)
        static_bb = {}
        for o in inked:
            if not moving(o):
                pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
                static_bb[o.name] = (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
                                     Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))),
                                     max(1e-4, sum(o.matrix_world.to_scale()) / 3))
        for fr in range(f0, f1 + 1):
            t = (fr - 1) / FPS
            eye, tgt, lens, fstop, (a, b, k), roll = self._at(t)
            sc.frame_set(fr)
            fd = self._follow(a).lerp(self._follow(b), k) if a is not b else self._follow(b)
            eye, tgt = eye + fd, tgt + fd
            jo = self._jolt_at(t); eye = eye + jo; tgt = tgt + jo * 0.4
            locs.append(tuple(eye)); lenses.append(lens); fst.append(max(fstop, self.min_fstop))
            q = (tgt - eye).to_track_quat('-Z', 'Y')
            if roll: q = q @ __import__('mathutils').Quaternion((0, 0, 1), math.radians(roll))
            rots.append(tuple(q.to_euler()))
            pa, pb = _focus_point(a, sc), _focus_point(b, sc)
            fp = (pa if pa is not None else a['target']).lerp(pb if pb is not None else b['target'], k)
            foc.append(max(0.05, (fp - eye).length))
            # constant-width ink: metres per pixel at the object's nearest point = d * sensor / (lens * H)
            mpp = sh / (lens * H)
            for o in inked:
                if o.name in static_bb: lo, hi, scl = static_bb[o.name]
                else:
                    mw = o.matrix_world
                    pts = [mw @ Vector(c) for c in o.bound_box]
                    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
                    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
                    scl = max(1e-4, sum(mw.to_scale()) / 3)
                near = Vector((min(max(eye.x, lo.x), hi.x), min(max(eye.y, lo.y), hi.y), min(max(eye.z, lo.z), hi.z)))
                d = max(0.05, (near - eye).length)
                base = o['cz_ol']; px = ink_px * min(1.6, max(0.5, base / 0.006))
                # the reference's lines are NOT constant on screen: a close-up head carries ~2.5 % of its width in ink
                # (22 px on a 900 px head), a wide shot ~5 px: a floor proportional to the object's size (capped for
                # walls) on top of the pixel width (night 2)
                ext = min(0.6, max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z))
                ink_vals[o.name].append(min(base * 4.0, max(base * 0.35, px * d * mpp, 0.022 * ext)) / scl)
        # keep every euler channel continuous: a camera looking about -Y sits at z ~ +-180 deg and a pan across it
        # flipped the key +179 -> -179, which EEVEE's motion blur drew as a 358 deg spin (L05 f269-273 pure smear, STORE)
        for i in range(1, len(rots)):
            prev, cur = rots[i - 1], list(rots[i])
            for j in range(3):
                while cur[j] - prev[j] > math.pi: cur[j] -= 2 * math.pi
                while cur[j] - prev[j] < -math.pi: cur[j] += 2 * math.pi
            rots[i] = tuple(cur)
        cz.bake(self.obj, 'location', locs, f0)
        cz.bake(self.obj, 'rotation_euler', rots, f0)
        cz.bake(self.obj.data, 'lens', lenses, f0)
        cz.bake(self.obj.data, 'dof.aperture_fstop', fst, f0)
        cz.bake(self.obj.data, 'dof.focus_distance', foc, f0)
        for o in inked: cz.bake(o, 'modifiers["cz_outline"].thickness', ink_vals[o.name], f0)
        sc.render.use_motion_blur = motion_blur
        # 1 step = vector blur from the frame itself: several steps sample sub-frames, where the face image sequence
        # already shows the next face -> ghost double brows on every expression swap
        # shutter 0.3 (was 0.5: fast flights smeared to pure blur, ISSUES 101); CZ_SHUTTER overrides it for A/B tests
        if motion_blur: sc.render.motion_blur_shutter = float(__import__('os').environ.get('CZ_SHUTTER', 0.3)); sc.eevee.motion_blur_steps = 1


def _focus_point(f, sc):
    fo = f['focus']
    if fo is None: return None
    if isinstance(fo, (tuple, list)) and fo and isinstance(fo[0], bpy.types.Object):
        return fo[0].matrix_world.to_translation() + Vector(fo[1])
    if isinstance(fo, bpy.types.Object): return fo.matrix_world.to_translation()
    return Vector(fo)


def _bez(pts, k):
    """Bezier through control points (de Casteljau): waypoints bend the flight path."""
    p = [Vector(x) for x in pts]
    while len(p) > 1: p = [p[i].lerp(p[i + 1], k) for i in range(len(p) - 1)]
    return p[0]
