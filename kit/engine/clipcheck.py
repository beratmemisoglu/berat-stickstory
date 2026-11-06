# Automatic contact check (night 2, owner: "the legs are clipping into the chairs ... almost every single shot ... how
# do you miss it with visual verification?"): after a scene is built, every character's noodle limbs are sampled
# along their curves every few frames and tested against the set's solid meshes (BVH). A limb point inside a mesh, or
# closer to its surface than the limb's radius, is a clip. run.py calls this for every render and prints
#   CZ CLIP <char>.<limb> f<frame> in <object> <depth> cm      (the first 12)
#   CZ CLIPCHECK <n> clipping samples in <frames> frames: <object list>   (or "CZ CLIPCHECK clean")
# so builders, critics and render logs see it without anyone having to notice it in a picture.
import math
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

LIMBS = (('leg', 'p', 'k', 'f', 0.025, (0.22, 0.88)), ('arm', 's', 'e', 'h', 0.023, (0.3, 0.8)))


def _bez(A, B, C, t, sx=1.0):
    """The limb curve exactly as cz.limb_group builds it: a cubic with handles pulled toward B by min(1, sx/3 + 1/3)."""
    k = min(1.0, sx / 3 + 1 / 3); H1 = A + (B - A) * k; H2 = C + (B - C) * k; u = 1 - t
    return A * u ** 3 + H1 * (3 * u * u * t) + H2 * (3 * u * t * t) + C * t ** 3


def _moves(o):
    """Animated itself or through any parent (a yacht hull on a moving boat empty)."""
    while o is not None:
        if o.animation_data is not None and o.animation_data.action is not None: return True
        o = o.parent
    return False


def _world_bounds(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))


def clip_check(chars, f0, f1, step=4, limit=12):
    if not chars: return 0
    sc = bpy.context.scene
    own = set()
    for c in chars:
        # the character's own parts + every prop it holds at any time (a wallet in the lap, a hat in the hand)
        stack = [c.root] + [h[0] for h in getattr(c, 'holds', [])]
        while stack:
            o = stack.pop(); own.add(o.name); stack.extend(o.children)
    prefixes = tuple(c.name + '_' for c in chars)   # costume parts re-parented at run time (a hat taken off)
    # where the characters are during the shot (obstacles are only built near them)
    frames = list(range(f0, f1 + 1, step)) or [f0]
    spots = []
    for f in frames[::max(1, len(frames) // 12)]:
        sc.frame_set(f)
        for c in chars: spots.append(c.root.matrix_world.to_translation())
    sc.frame_set(frames[0])
    obst = []
    for o in sc.objects:
        if o.type != 'MESH' or o.name in own or o.name.startswith(prefixes) or o.hide_render or not o.data.polygons or o.get('cz_contact_ok'): continue
        lo, hi = _world_bounds(o); ext = hi - lo
        if min(ext) < 0.03: continue                      # cards, decals, planes: not solid
        if not any(lo.x - 1.2 < p.x < hi.x + 1.2 and lo.y - 1.2 < p.y < hi.y + 1.2 for p in spots): continue
        moving = _moves(o)
        obst.append([o, lo, hi, None, moving])
    def bvh(rec):
        o = rec[0]; bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world)
        t = BVHTree.FromBMesh(bm); bm.free(); return t
    hits, hit_frames, objs, shown = 0, set(), {}, 0
    for f in frames:
        sc.frame_set(f)
        for rec in obst:
            if rec[4]: rec[1], rec[2] = _world_bounds(rec[0]); rec[3] = None
        for c in chars:
            for (kind, a, b, e, r, (t0, t1)) in LIMBS:
                for sd in 'LR':
                    A = c.ctrl[a + sd].matrix_world.to_translation(); B = c.ctrl[b + sd].matrix_world.to_translation(); sx = c.ctrl[b + sd].scale.x
                    C = c.ctrl[e + sd].matrix_world.to_translation()
                    for i in range(7):
                        p = _bez(A, B, C, t0 + (t1 - t0) * i / 6, sx)
                        for rec in obst:
                            lo, hi = rec[1], rec[2]
                            if not (lo.x - r < p.x < hi.x + r and lo.y - r < p.y < hi.y + r and lo.z - r < p.z < hi.z + r): continue
                            if rec[3] is None: rec[3] = bvh(rec)
                            loc, nrm, idx, dist = rec[3].find_nearest(p)
                            if loc is None: continue
                            if dist > 0.12: continue                 # far from any surface: never a clip (open meshes fool the inside test)
                            inside = (p - loc).dot(nrm) < 0
                            if inside or dist < r * 0.6:
                                depth = (dist + r) if inside else (r - dist)
                                if depth < 0.008: continue          # a graze under 8 mm never shows
                                if depth < 0.02 and p.z > hi.z - 0.03 and kind == 'leg': continue   # resting ON a seat top / over its edge (a cushion gives 2 cm)
                                hits += 1; hit_frames.add(f); objs[rec[0].name] = objs.get(rec[0].name, 0) + 1
                                if shown < limit:
                                    print(f'CZ CLIP {c.name}.{kind}{sd} f{f} in {rec[0].name} {depth * 100:.1f} cm at ({p.x:.2f}, {p.y:.2f}, {p.z:.2f}) curve {i}/6'); shown += 1
                                break
        # seated characters: the torso bottom must rest ON something (no sitting on air, no torso sunk in a cushion)
        dg = bpy.context.evaluated_depsgraph_get()
        for c in chars:
            t = (f - 1) / 30.0
            if 'sitw' not in c.T or c.T['sitw'].at(t) < 0.9: continue
            bot = c.torso_pv.matrix_world.to_translation()
            org = bot + Vector((0, 0, 0.12)); dz = None
            for _ in range(24):          # her own lap drape, apron, dress and legs come first: 6 steps ran out (false "floats 49 cm")
                hit, loc, nrm, idx, ob, M = sc.ray_cast(dg, org, Vector((0, 0, -1)))
                if not hit: break
                if ob.name in own or ob.name.startswith(prefixes): org = loc + Vector((0, 0, -0.002)); continue
                dz = bot.z - loc.z; break
            msg = None
            if dz is None or dz > 0.05: msg = f'floats {((dz or bot.z) * 100):.0f} cm above the seat'
            elif dz < -0.035: msg = f'torso sunk {-dz * 100:.0f} cm into {ob.name}'
            if msg:
                hits += 1; hit_frames.add(f); objs['(sitting) ' + c.name] = objs.get('(sitting) ' + c.name, 0) + 1
                if shown < limit: print(f'CZ SITCHECK {c.name} f{f}: {msg}'); shown += 1
    if hits:
        top = ', '.join(f'{k} x{v}' for k, v in sorted(objs.items(), key=lambda kv: -kv[1])[:6])
        print(f'CZ CLIPCHECK {hits} clipping samples in {len(hit_frames)} frames: {top}')
    else:
        print(f'CZ CLIPCHECK clean ({len(chars)} characters, {len(obst)} solids, {len(frames)} frames)')
    return hits
