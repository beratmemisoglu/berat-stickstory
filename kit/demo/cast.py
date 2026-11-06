# The demo's cast (the Blender engine's smoke project in Toon Studio): MAX, a clerk in a blue shirt with dark brown hair.
import cz
import char as ch


def max_():
    return ch.Char('max', shirt='#3d6fb6', hair=ch.hair_cap('#2e180b', front=0.62, sides=-0.02, back=-0.85),
                   face_style={'character': 'max', 'brow_w': 1.0})
