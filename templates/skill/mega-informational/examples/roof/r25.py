# R25 "They are a sign your house is leaking heat" 1811-1866 (thermal: icicles flash red, heat leaks out at the eave)
F0, F1 = 1811, 1866


def build(ctx):
    import os, sys, math, random
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, props_r2 as R
    R.world(F1, 'thermal')
    mt = R.mats(winter=True)
    P = R.cottage(mt, snow=0.4)
    R.land(mt, winter=True, n=14, clouds=False)
    ic = R.icicles('icic', mt['ice'], -R.W / 2 - R.OVER, R.W / 2 + R.OVER, -(R.EY + 0.12), P['gutter_z'] - 0.08, n=160, lmax=1.25, seed=11)
    eave = R.thermal_mat('th_eave', 0.3, strength=1.8)
    R.thermal_key(eave, [(1815, 0.3), (1840, 0.72)])
    ich = R.thermal_mat('th_icicle', 0.12, strength=2.0)
    ich = M.emit('th_icicle_red', '#3a50ff', 1.5)
    em = ich.node_tree.nodes['Emission']
    for f, c, s in ((1843, '#3a50ff', 1.5), (1848, '#ff1a08', 9.0), (1853, '#ff2a10', 4.0), (1857, '#ff1a08', 8.0), (1866, '#ff2a10', 5.0)):
        em.inputs[0].default_value = cz.col(c); em.inputs[0].keyframe_insert('default_value', frame=f)
        em.inputs[1].default_value = s; em.inputs[1].keyframe_insert('default_value', frame=f)
    def rule(o):
        n = o.name
        if n.startswith('icic'): return ich
        if n.startswith(('shrowa', 'decka')) and ('a1' in n[5:7] or n[-2:] in ('15', '14', '13')): return eave
        if n.startswith(('wF', 'wB', 'wR', 'wL')): return 0.36
        if n.startswith(('gable', 'chimney')): return 0.42
        if n.startswith('shrow'): return 0.2
        if n.startswith('snow'): return 0.07
        if n.startswith('hill'): return 0.03
        if n.startswith(('trough', 'fascia', 'hanger')): return 0.45
        return 0.1
    R.thermalize(rule)
    # heat leaking: warm wisps rising off the eave line
    wm = R.wisp_mat('r2_heatwisp', '#ff9a40', strength=1.6, alpha=0.4, nscale=0.9)
    R.wisps('heat', wm, lambda i, r: (r.uniform(-4.3, 4.3), -(R.EY - 0.2) - r.uniform(0, 0.4), R.surf_z(R.EY - 0.2) + 0.2), F0, F1, n=26, w=(1.6, 2.6), h=(2.0, 3.2), rise=(0.4, 0.7))
    R.flight([(1811, (3.6, -7.6, 1.7), (0.6, -3.6, 2.4), 28),
              (1866, (4.6, -8.2, 1.4), (0.2, -3.4, 2.8), 26)], F0, F1)
    return F0, F1
