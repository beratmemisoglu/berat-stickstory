# The demo's office (both shots build it the same way): floor, back wall, a desk with its chair, a plant, a clock, light.
import cz


def office():
    cz.box('d_floor', (10, 8, 0.1), (0, 0, -0.05), cz.toon('d_floorm', '#cdb89a', tex='grain'), bevel=0, ol=0)
    cz.box('d_wall', (10, 0.2, 4), (0, 2.2, 2.0), cz.toon('d_wallm', '#8fb0a8', tex='grain'), bevel=0, ol=0)
    cz.box('d_skirt', (10, 0.04, 0.12), (0, 2.08, 0.06), cz.toon('d_skirtm', '#6b5a48'), bevel=0.005, ol=0.003)
    cz.prop('office_desk', 'd_desk', (0.6, 0.9, 0), rot=0)
    cz.prop('office_chair', 'd_chair', (0.42, 0.4, 0), rot=0)
    cz.prop('potted_plant', 'd_plant', (-1.6, 1.7, 0))
    cz.prop('wall_clock', 'd_clock', (-0.6, 2.09, 2.3))
    cz.light('d_key', 'AREA', (-2.0, -3.5, 3.6), color='#fff0dc', power=900, size=4, target=(0, 0.6, 1.0))
    cz.light('d_rim', 'AREA', (2.4, 2.0, 3.0), color='#e8f0ff', power=320, size=3, target=(0, 0.6, 1.0))
