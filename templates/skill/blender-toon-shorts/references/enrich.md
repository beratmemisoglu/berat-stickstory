# The enrich loop (the Ultraedit method): our own previs, made richer, then built for real

Owner-approved on night 2 ("that's exactly what I want you to do, keep doing that"). It took the cut-away grave from
flat to the target's density in one round and the critic called that sequence the best of its film.

Why this and not an invented target: text-only targets ("a 3D cartoon graveyard in the style of image 2") came back as
2D illustrations and the owner rejected them. A target must look exactly like OUR render: same characters, same
faces, same camera, same shaders, same palette, only richer.

## 1. Previs

Render the key frame of every framing that shows a set (2-6 per shot; the night-2 films used 19, 37 and 21 keys):
a HELD frame a few frames after the framing lands, not mid-flight, not an f/1.4 close-up.
```
<blender> -b --factory-startup -P <engine>/engine/run.py -- s03.py --frames 262,300,440 --scale 0.5 --samples 24 --out renders/previs/s03
```

## 2. Enrich

The previs (image 1) and a style frame (image 2: a frame of the user's reference if the request gave one, else the
best-looking frame of this film so far) go to the image model with this prompt (the lab's, unchanged in substance):

> Image 1 is a frame rendered in Blender from our 3D animated short. Image 2 is a frame whose look we match. Return
> image 1 as the SAME Blender 3D render, only richer: keep the exact camera, framing, composition and lens; keep every
> character exactly as it is (same white round heads, same drawn grey faces and expressions, same hair, same clothes,
> same black noodle limbs and ball hands, same proportions and poses); keep the same toon shaders, the same thick dark
> outlines, the same colour palette and the same lighting direction. It must still look exactly like a Blender EEVEE
> render with our shaders - not a painting, not a 2D illustration, not a different art style. Add only environment
> detail the way a top set dresser would: more small props and clutter on every shelf and surface, labels, posters,
> price tags, wear, scuffs, grain and texture on walls, floors and wood, plants, cables, little lights - more density
> and richness everywhere in the set, as rich as image 2 or richer. Make the light a little more beautiful (warmer
> glow on practical lamps, soft bloom, soft contact shadows) without changing its direction. No new characters, no
> text changes on signs that already exist, no captions.

- One picture at a time (~25-70 s each once the service is warm). A key that is policy-blocked twice is skipped: its
  set is covered by the shot's other keys.
- The tool must take your RENDER as image 1. The app's `make_image` takes `ref` only as a style swatch (it tells the
  model NOT to copy the reference's subject): that is the opposite of an enrich and cannot do this step. Use the enrich
  step the build offers; when there is none, do step 3 from a written list instead: for each key frame, name every
  extra a top set dresser would add (the categories in the prompt), then build them.
- Re-enrich a shot whose previs changed a lot (a new camera, a new layout).

## 3. Build every extra for real

The characters, faces and camera stay exactly as they are; only the set grows.
- **Flat things** (posters, notices, signs, labels, price tags, rug prints, stickers, charts, maps): lift them out of
  the enriched image, perspective-corrected, and put them on `cz.plane` cards 1.2 mm off the surface, without outline
  (`cz.toon(name, img=<png>, alpha_clip=True, lift=0.75)` for cut-outs). A lift script to run with `<python>`:
  ```python
  # tex/lift.py <image> "x0,y0 x1,y1 x2,y2 x3,y3" <out.png> [--w 512]   (the 4 corners in 0-1 image coords, TL TR BR BL)
  import sys
  import cv2, numpy as np
  img_p, pts, out = sys.argv[1], sys.argv[2], sys.argv[3]; a = sys.argv[4:]
  im = cv2.imread(img_p, cv2.IMREAD_UNCHANGED); H, W = im.shape[:2]
  P = np.array([[float(v) for v in p.split(',')] for p in pts.split()], np.float32) * np.array([W, H], np.float32)
  w_ = (np.linalg.norm(P[1] - P[0]) + np.linalg.norm(P[2] - P[3])) / 2; h_ = (np.linalg.norm(P[3] - P[0]) + np.linalg.norm(P[2] - P[1])) / 2
  ow = int(a[a.index('--w') + 1]) if '--w' in a else int(round(w_ * 2)); oh = int(round(ow * h_ / max(1, w_)))
  M = cv2.getPerspectiveTransform(P, np.array([[0, 0], [ow, 0], [ow, oh], [0, oh]], np.float32))
  cv2.imwrite(out, cv2.warpPerspective(im, M, (ow, oh), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE))
  print('DECAL', out, ow, 'x', oh)
  ```
  The image model's lettering is garbled: lifted as it is, it reads as misspelt. Lift the pictures, REDRAW the words
  (Pillow, a heavy sans; CJK needs a CJK font) and paint out anything grim (a cartoon bone was painted out of a grave).
- **Faint flat things** (grime, scuffs, water stains, crumbs, confetti): `alpha_clip` drops every pixel under 50 %, so
  faint ones vanish. Use a LIT alpha-blended material:
  ```python
  def decal_mat(name, png, lift=0.7):
      m = bpy.data.materials.get(name)
      if m: return m
      m = bpy.data.materials.new(name); m.use_nodes = True; N, L = m.node_tree.nodes, m.node_tree.links; N.clear()
      out = N.new('ShaderNodeOutputMaterial')
      dif = N.new('ShaderNodeBsdfDiffuse'); s2r = N.new('ShaderNodeShaderToRGB'); L.new(dif.outputs[0], s2r.inputs[0])
      gam = N.new('ShaderNodeGamma'); gam.inputs['Gamma'].default_value = lift; L.new(s2r.outputs['Color'], gam.inputs['Color'])
      tx = N.new('ShaderNodeTexImage'); tx.image = cz.image(png)
      mul = N.new('ShaderNodeVectorMath'); mul.operation = 'MULTIPLY'; L.new(tx.outputs['Color'], mul.inputs[0]); L.new(gam.outputs[0], mul.inputs[1])
      em = N.new('ShaderNodeEmission'); L.new(mul.outputs[0], em.inputs['Color'])
      tr = N.new('ShaderNodeBsdfTransparent'); mx = N.new('ShaderNodeMixShader')
      L.new(tx.outputs['Alpha'], mx.inputs['Fac']); L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2])
      L.new(mx.outputs[0], out.inputs['Surface'])
      m.surface_render_method = 'BLENDED'
      return m
  ```
- **3D things** (cables, coins, a pen, a tape dispenser, plants, boxes, lamps, coils, chairs, life rings): library
  props (catalog.md) or quick primitives in the set's dressing file. Cables live on walls and ceilings, never hanging
  in front of a character (one read as a rope past a shoulder).
- **Surface richness** (grime, scuffs, grain, worn paint, stains, patched holes, pale "ghost" rectangles where things
  hung, a worn path from the door): painted textures (a Pillow texture maker in `tex/`, run with `<python>`) on the
  walls, floors, ceilings and wood. Floor "scuff strips" built as thin boxes read as sticks: scuffs belong in the texture.
- **Placement that survives camera changes.** Ray-casting the target's corners through the previs camera is exact
  only while the camera stays the previs camera; every camera fix moved those decals. Place by the wall: the wall plane
  is known (x, z on a back wall), so map 4-8 landmarks of the image (frame corners of signs whose world spot you know)
  to that plane with a homography (`cv2.findHomography`), or measure the spot by eye in world units. When you do cast
  rays, the inverted-hull ink shells (5-8 mm in front of every surface) and the characters get hit: turn the outline
  modifiers off and hide the cast first.
- **One set, many targets**: different targets invent different things on the same patch of wall. Keep one per patch
  (a skip list), or move one aside.
- **Inside the frustum.** Build every extra where THIS camera sees it and check it in a test render of the key frame:
  clutter that went into the dressing file but never reached the frame cost one film four critic rounds.
- What reads at phone size: big extras (rope coils, deck chairs, life rings, glints, wall notes, a calendar, floor mess,
  headlight glow, grime). Small console switches vanish below MCU. What hurt: a trailing ivy of spheres (a bead
  string), a tape roll (a white ball), a pen on the ticket spot (a black bar): removed.

## 4. Loop

Render the key frame at the previs settings, make a sheet `previs | ours now | enriched`, LOOK, add, repeat until ours
carries the enriched image's density and light. Composition is never traded for density: the reference rebuild LOST
likeness exactly where builders chased the enriched targets (-0.09 and -0.05 on two shots). Keep a change only when it
moves the measured number or the critic's axis it was made for (qa.md).

## 5. The crew (when the build runs as one)

| role | does | never |
|---|---|---|
| director (the main session) | the plan, the engine-level fixes, faces and acting, merges, re-tasking, the final render and the QA gate | lets two writers touch one file |
| builders (one per set family or per film) | their own files only: a set's `dress_<set>.py`, their sequences, their texture makers; a NOTES file: failure -> cause -> fix, one line each | edit the engine, another builder's files, shared docs |
| critic(s) | render the builders' CURRENT files themselves (`--scale 0.4 --samples 16`, 3-4 frames per framing), put them beside the targets, score the rubric (qa.md), send each builder its top fixes every round | build anything |

- Every round renders into a NEW folder (`renders/critic/r3/`): never clear a folder with a wildcard.
- Freeze, then let measured fixes in: at the freeze builders stop; the critic keeps scoring; only changes that move a
  measured number toward the target come back in.
- Every brief repeats the machine rules (headless only, the one render queue, no heredocs / inline code / wildcard
  deletes): agents break them under pressure even after a warning.
- Check the ASSEMBLED film, not the shots: a dissolve bug existed only in the assembly and the critic found it by
  scoring the final frames.
