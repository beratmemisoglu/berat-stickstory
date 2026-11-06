# Sky drum: a full 360-degree painted panorama backdrop for the outdoor sets (gate, hill, rubble) - one cylinder of
# radius 26 m, z -6..34, facing inward, showing one panorama PNG (tex/make_out.py: out_sky_<set>_<time>.png: the
# gradient, sun / moon with its halo, stars, cartoon clouds, streaks, three ranges of karst mountains with mist, birds,
# far pagodas / smoke / the inventor's hill as flat silhouettes). Unlit emission, casts no shadow, so it reads the same
# under any set light. Unlike night_sky (a 160 deg arc) no camera direction ever sees the world colour behind it.
# Root = the drum's centre on the ground (z = 0); the panorama's u runs with the azimuth from +Y (u 0.5 = +Y, + toward +X);
# its painted horizon (mountain feet) is at z ~ 0, so a ground plane at z = 0 meets it cleanly.
import math

META = {'size': (52.0, 52.0, 40.0), 'anchor': 'centre of the drum on the ground (z = 0); radius 26 m, z -6..34',
        'animate': [], 'params': "img='assets/props/tex/out_sky_hill_night.png', radius=26.0, z0=-6.0, z1=34.0, segs=144, "
                                 "strength=1.0 (emission)"}


def build(cz, name='out_sky_drum', img='assets/props/tex/out_sky_hill_night.png', radius=26.0, z0=-6.0, z1=34.0, segs=144,
          strength=1.0):
    import bmesh
    root = cz.empty(name)
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    lo, hi = [], []
    for i in range(segs + 1):              # the seam column is doubled so u runs 0..1 without a wrap face
        a = math.radians(-180.0 + 360.0 * i / segs)
        x, y = radius * math.sin(a), radius * math.cos(a)
        lo.append(bm.verts.new((x, y, z0))); hi.append(bm.verts.new((x, y, z1)))
    for i in range(segs):
        f = bm.faces.new((lo[i], lo[i + 1], hi[i + 1], hi[i]))
        for lp, uv in zip(f.loops, ((i / segs, 0.0), ((i + 1) / segs, 0.0), ((i + 1) / segs, 1.0), (i / segs, 1.0))):
            lp[uvl].uv = uv
    m = cz.screen(name + '_skym', img, strength)
    o = cz._mesh_obj(name + '_sky', bm, m, smooth=True)
    cz.place(o, (0, 0, 0), (0, 0, 0), None, root, 0.0, 0.0)
    o.visible_shadow = False
    return root
