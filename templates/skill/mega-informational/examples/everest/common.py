# Shared pieces of the Everest rebuild (scale: 1 unit = ~100 m; the slab is R=10, 16 tall, Everest cap ~7 on top).
import bpy, math, os
import numpy as np
from mathutils import Vector
import cz, mega as M

HERE = os.path.dirname(os.path.abspath(__file__))
R, H, CAP = 10.0, 16.0, 7.0          # slab radius, slab height (below the snow line), Everest above it
T = lambda name: os.path.join(cz.LAB, 'assets', 'mega', name)
has = lambda name: os.path.exists(T(name))


def mats():
    """The film's materials (made once; Flow textures when present, procedural otherwise)."""
    return dict(
        rock=M.rock('ev_rock', scale=0.5, bump=1.4, img=T('basalt.png') if has('basalt.png') else None),
        snow=M.snow_rock('ev_snow', thresh=0.78, scale=0.25, img_rock=T('mountain_rock.png') if has('mountain_rock.png') else None,
                         img_snow=T('snow.png') if has('snow.png') else None),
        ground=M.pbr('ev_ground', '#2a2c33', rough=0.9, img=T('dirt_dark.png') if has('dirt_dark.png') else None, scale=0.2, bump=0.4, noise=0.5),
        lava=M.pbr('ev_lava', '#0b1020', rough=0.9, img=T('lava_cracks.png') if has('lava_cracks.png') else None, scale=0.08,
                   emit='#ff3a1a' if not has('lava_cracks.png') else None),
        steel=M.steel('ev_steel', panels=0.9, panel_scale=3.0, img=T('steel_panels.png') if has('steel_panels.png') else None, scale=0.25),
        copper=M.pbr('ev_copper', '#c8743a', rough=0.32, metal=1.0),
        yellow=M.pbr('ev_yellow', '#e7b53a', rough=0.45, metal=0.2, noise=0.15),
        red=M.pbr('ev_red', '#b8322a', rough=0.45, metal=0.4),
        dark=M.pbr('ev_dark', '#18191c', rough=0.5, metal=0.5),
        xray=M.xray('ev_xray'),
    )


def cap(name, mt, r=R, z=H, h=CAP, seed=3, res=180):
    """Everest on top of the slab: a heightfield peak inside a disc (vertices outside the disc fall to the rim)."""
    f = M.mountain_fn(peak_h=h * 1.35, radius=r * 1.05, seed=seed, ridge=0.92, sharp=1.35, detail=0.12)
    def fn(X, Y):
        rr = np.sqrt(X * X + Y * Y)
        Z = f(X, Y) + 0.6
        k = np.clip((rr - r * 0.92) / (r * 0.08), 0, 1)
        Z = Z * (1 - k) + 0.0 * k
        s = np.minimum(1, r / np.maximum(rr, 1e-6))     # pull outside points onto the rim circle
        return Z, s
    w = 2 * r
    xs = np.linspace(-w / 2, w / 2, res); X, Y = np.meshgrid(xs, xs)
    Z, s = fn(X, Y)
    def zf(XX, YY): return Z
    ob = M.heightfield(name, (w, w), res, zf, mat=mt['snow'], loc=(0, 0, z))
    co = np.zeros(len(ob.data.vertices) * 3, np.float32); ob.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    sv = s.ravel(); co[:, 0] *= sv; co[:, 1] *= sv
    ob.data.vertices.foreach_set('co', co.ravel()); ob.data.update()
    return ob


def slab(name='slab', mt=None, r=R, h=H, z0=0.0, cap_on=True, seed=3, rough=0.7, flare=0.1, rock=None):
    """The cut crust cylinder: rough basalt sides (displaced), Everest cap on top."""
    mt = mt or mats()
    rm = M.rock('ev_rock_' + rock.lstrip('#'), color=rock, scale=0.5, bump=1.4, img=T('basalt.png') if has('basalt.png') else None) if rock else mt['rock']
    c = M.column(name + '_body', r, h, mat=rm, rough=0.05 * rough / 0.7, seed=seed, top=not cap_on, taper=-flare)
    root = cz.empty(name, (0, 0, z0))
    c.parent = root; c.location = (0, 0, 0)
    if cap_on:
        k = cap(name + '_cap', mt, r=r * (1 + flare), z=h, seed=seed); k.parent = root; k.location = (0, 0, h)
    return root


def snow_range(name, mt, size=600, res=260, height=34, scale=26, z=-2, hole=None, seed=5):
    """Far snowy ranges around everything. hole=(r): flatten (dig) a disc for the trench / slab."""
    f = M.range_fn(height=height, scale=scale, seed=seed)
    def fn(X, Y):
        Z = f(X, Y) * np.clip((np.sqrt(X * X + Y * Y) - 30) / 80, 0.15, 1)
        if hole:
            rr = np.sqrt(X * X + Y * Y)
            Z = np.where(rr < hole, -60.0, Z)
        return Z
    return M.heightfield(name, size, res, fn, mat=mt['snow'], loc=(0, 0, z))
