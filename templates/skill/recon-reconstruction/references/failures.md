# Reconstruction style: failures, causes, fixes

Every defect that reached a render, why it happened, what fixed it, and the rule or automatic check that now stops it
coming back. Read this before building a new story. The rules themselves are in [QUALITY_STANDARD.md](QUALITY_STANDARD.md),
and how to build is in [PLAYBOOK.md](PLAYBOOK.md).

## v1 to v5 (summary)

| Defect | Cause | Fix / rule |
|---|---|---|
| Washed out, unreadable | Ambient fill too strong, backdrop near-white, thick fog | Darker studio grey, stronger key light, fog pushed out |
| Floating engines, "snowman" mannequins, box cockpit | Assets never checked alone | Asset gallery at full size, from several angles, before any shot (`scenes/assets.js`) |
| Overlays on top of subjects | Placed by eye at thumbnail size | Tags get a leader line, are clamped inside the frame, and sit in empty space |
| Ghosted double images | Cross-dissolving two 3D scenes | Transitions dip through the studio grey |
| Blown out, hard to look at (v5) | Heavy post: bloom, chromatic aberration, vignette, contrast curve, strong DOF | High key: vignette at most .07, grain at most .015, no bloom or CA. Depth comes from AO and the key light |
| Snapping plane and route (v5) | Plane and drawn route were two different paths | One spline sampled by arc length; the route line samples the same curve |

## v6 to v7 (user frame-by-frame review)

| Time | Defect | Root cause | Fix | Now guarded by |
|---|---|---|---|---|
| 0:05 | Plane tilts hard and clips into the map | Pitch came from the exaggerated-altitude spline (5x too steep), bank from raw spline curvature, plane centre at route height | `flightPose()`: real climb angle (altitude exaggeration divided out, max 15 deg), bank from smoothed curvature at real speed (max 25 deg), constant clearance lift; route line drawn at the same lift | `render.mjs probe` (pitch/bank/camera per frame, max step and acceleration) |
| 0:07 | Camera sweeps left to right | Chase camera was attached to the plane's heading, so every heading wobble swung the world | Camera tracks the plane's position only, with an eased fixed world-space offset; heading is averaged over a window | `probe`: camera acceleration ratio 0.02-0.05 |
| 0:10 | Stray blue line across the frame | Route points behind the camera were projected mirrored onto the screen | `S.proj` returns `ok = false` behind the camera; polylines break the pen there | Visual check of stills |
| 0:11-12 | Cabin floor flickers | Three stacked floor planes (carpet, aisle runner, studio floor) 1-3 mm apart, plus a 4000-unit far plane | One floor mesh with the runner and tracks painted into its texture; studio floor off for interiors and moved 4 cm lower under cutaways; near/far set per scene | `S.audit()` (COPLANAR), `render.mjs zfight` |
| 0:15-17 | City shimmers from the air | Sub-pixel building edges, 1 sample per pixel | 2x supersampling of the 3D image (`?ss=`), averaged down; shadow box snapped to shadow-map texels while following the plane (`S.followKey`) | `render.mjs flicker` heat map |
| 0:20 | Geese pop out of existence, in the wrong place | Visibility switched off at the strike time; positions were offsets from a moving point, so the flock never reached the engine | Geese fly straight lines at 15 m/s solved backwards from the exact intake and nose points. Struck geese vanish inside a feather burst. The others pass through lanes the airframe never sweeps, flare and dive away. Engine stall puffs left in the air | Visual check of consecutive frames (`qa_*.png`) |
| 0:25 | Cockpit floor bugging | Cockpit floor on top of the studio floor (1 mm) | Studio floor off in the cockpit; the cockpit floor is the only floor | `audit`, `zfight` |
| 0:31 | Hands look weird | Hands were a single blob oriented by hard-coded Euler angles that ignored the arm | New hand (palm, curling finger block on its own joint, thumb). Contact API `handTo(point, palmNormal, fingerDir, curl, pole)` and `grip()` orient the palm in world space. Sidestick moved to where the hand rests; armrest height taken from the model | `scenes/chars.js` close-ups (lap, grip) |
| 0:34 | Centre screens flicker | Two ECAM quads overlapped 10 cm on the same plane; screens 3 mm proud of the bezel | Screens shortened so they never overlap; 1 cm proud | `zfight` (this is how it was found) |
| 0:50 | Brace scene floor bugging | Same stacked floors as 0:11 | Same fix | `audit`, `zfight` |
| 0:57-60 | Wake drawn ahead of the nose; floe edges shimmer | Wake offset sign error; near plane .5 m at 1 km distances | Wake runs from the touchdown point to the tail; river scenes use near = 2 m | `zfight` |
| 1:00 | Water particles look bad | Solid instanced balls on a matte plane | Reflective `Water` (three.js) with a code-generated tileable normal map. Splash = soft round sprite particles in low wide sheets, scaled by the remaining speed, with foam left on the surface. A hanging mist was tried and removed because it washed the aircraft out | Visual check at full size |
| 1:12 | Captain walk is weird | The gait bent the knee while the leg swung backward (feet slid forward while planted), and walking speed was unrelated to stride | New gait (swing/stance phases, flat planted foot, pelvis bob). `walkAt()` derives phase from distance through a table measured from the rig: planted feet slide 0.0000 m. The captain walks three rows, stops, looks left and right, walks on. The camera is computed after he moves (it used to lag a frame) | `render.mjs probe` foot-slide measure (`scenes/walkqa.js`) |

## v8 (the three-film test: Tacoma Narrows 1940, Apollo 13, Tham Luang cave)

Found by our own checks before anything was shown, grouped by kind. Each line names the guard that now catches it.

### Engine and post

| Defect | Root cause | Fix | Now guarded by |
|---|---|---|---|
| Black slab in the middle of the Tacoma map, only with post on | three.js draws a texture `scene.background` as a 2x2 quad mesh. GTAO's normal/depth pass renders with `overrideMaterial`, so the quad was drawn as real geometry at the world origin. Hudson never showed it because its subject hid the origin | `GTAOPass.renderOverride` and `BokehPass` clear `scene.background` for their override passes (patched vendor files) | The AO bisect recipe below. Any dark blob that disappears with `?ao=0` is this kind |
| The audit printed nothing for three films | Puppeteer reports `console.warn` as type `'warn'`, but `render.mjs` only forwarded `'warning'`. Every COPLANAR line since v7 was silently dropped | Forward `'warn'` too. Re-auditing Hudson, Tacoma and Apollo found one real hit (Apollo orbit tubes 9 mm apart), now fixed | Calibration: `scenes/zf.js` must print COPLANAR. If it does not, the audit pipe is broken |
| Cliff and chamber vault invisible | A patch inserted a statement after a `//` comment on the same line, which commented the code out | Split the line. A scan of every source file found no other code after a comment | Patch scripts insert whole lines and never append to a commented line |

### Data and world

| Defect | Root cause | Fix | Now guarded by |
|---|---|---|---|
| The 1940 Tacoma map showed today's roads and two modern bridges | The baker drew every layer it found, and the elevation and coastline data contain the 1950 and 2007 bridges | **Period rule:** a region lists only layers that existed at the time. Land thinner than about 40 m (bridge decks, piers) is removed | `bake_region.py` `layers` per region |
| Hillshade looked like orange peel; highlights clipped | Radar noise on flat ground, and the shade gain was too high | About 30 m of gaussian smoothing before shading; shade clamped so highlights never clip | Full-size map preview |
| Seabed z-fought the water plane | Water cells were set to exactly the water level | Seabed sits 10 m below the water level | `zfight` |

### Assets (downloaded and procedural)

| Defect | Root cause | Fix | Now guarded by |
|---|---|---|---|
| Bridge deck read as a tube | Smoothed normals on an extruded H-profile | `flatShading` on swept profiles | Asset gallery |
| Fallen deck stretched sheets down to the water | The collapsed stretch was made by moving its vertices to y = -500 | The index is rebuilt without the fallen stations. Both broken ends, and the falling pieces, get a real triangulated cap | Asset gallery |
| Car fenders showed flat discs | Closed cylinder caps | Open-ended half cylinders | Asset gallery |
| Smithsonian CM scan stood tilted 24 deg | The scan's axis in the file is not +y | `model(key, { upright: true })` turns the symmetry axis to +y. It finds the axis whose silhouette is round, with all 18 projected widths equal. Three earlier methods failed on this squat cone: PCA (the spreads are nearly equal), radius symmetry (the open tunnel breaks it), and smallest footprint (side and top are equally wide) | Front and side tilt-check views for every downloaded body of revolution |
| LM floated off the CM, leaving a gap in the docked stack | Bounding boxes include antennas, so the top of the box is not the docking port | `hitAlong()` raycasts along the axis to the real surface | Asset gallery (stack view) |
| Rescaled scan came out the wrong size | `Box3.setFromObject` on a rotated mesh uses the loose, inflated box | `setFromObject(obj, true)` (precise) | Asset gallery |
| High-gain antenna floated beside the SM | Its group was offset diagonally instead of mounted on the hull | Boom runs out radially from the aft bulkhead, with the dishes on its end | Full-size frame from the MP4 |
| Rock geometry cracked into a grid | Displacing a mesh that was not welded moved each face along its own normal | `roughen()` welds (`mergeVertices`) before displacing | Asset gallery |
| Earth and Moon rendered black in the first frames | Textures loaded asynchronously, so the frame rendered before they arrived | `story.json "textures"` are preloaded before the scenes run | First frame of the asset gallery |

### Characters (CC0 rigged mannequin and our own rig)

| Defect | Root cause | Fix | Now guarded by |
|---|---|---|---|
| Divers stood upright in the water | `Swim_Idle_Loop` is a treading-water pose | Hovering divers play `Swim_Fwd_Loop` slowly; a sedated boy holds one glide frame | `scenes/actorqa.js` (every clip we use, full size) |
| Dive tank sat on the chest | `bodyFrame`'s back vector was up x side, which points out of the chest | side x up | Asset gallery (diver) |
| Crawling Coatsworth's tag hung in the air | `Person.world()` returns positions in cast space, and his cast rides the twisting deck | `Person.scenePos()` for overlays and cameras | Stills |
| Swigert floated through Lovell, and the cabin camera saw only an arm | Three bodies in a 2.4 m cabin, filmed from inside | Cabin cutaway (`lmCabin({ cutaway: true })`) with the camera outside; Swigert floats along the ceiling behind the other two | Stills |
| Walkers would slide | In-place walk clips have no ground speed | `clipSpeed()` measures the planted-foot speed of the clip, and walkers move at exactly that speed, scaled by height | Feet-slide rule (measured, not guessed) |

### Shots and effects

| Defect | Root cause | Fix | Now guarded by |
|---|---|---|---|
| Collapse splash looked like snow, or cotton balls | Big sprites at uniform heights | Small sprites: 78 % are ballistic jets with a crown profile along the piece, 22 % are foam. The splash carries over the cut into the next shot | 6 consecutive MP4 frames |
| Venting oxygen looked like a cotton cloud | Same cause | A fine, fast spray fan of 5,200 sprites | Stills |
| Collapse played wide and far away | Tear and fall shared one shot | 6a is close on mid-span with the car still on the deck. It cuts mid-fall to 6b, wide, with the splash | Consecutive frames across the cut |
| Flutter diagram was unreadable | Streak particles across the section | `streamlines()` helper: dashes along flow lines, bent around the section, with a wake rolling in step with the twist. Camera sits on the section's axis | Stills |
| Parachutes stayed in the air after splashdown | They were never released | The canopies are cut loose, sink and lie flat on the water | Stills |
| CO2 graph covered the crew | The card was placed where the subject was | Card moved to the empty left third | Stills |
| Mailbox parts flew in from outside the frame | Offsets were treated as absolute positions | Offsets are added to each part's own base position | Stills |
| Divers invisible in the pool | Opaque water at chest height | The divers surface with head and shoulders clear. A see-through pool over a basin with a hole in the floor was tried and dropped, because the hole left jagged slivers | Stills |
| Tunnel cutaway floated in the sky | Only the tube was modelled | Rock masses above and below with a lighter cut face; silt particles make it read as water | Stills |
| Two tags on screen at once (mask, diver to diver) | Overlapping time windows | The first tag ends before the next begins | 6 consecutive MP4 frames |

## Detector notes (so the checks are trusted)

- **`zfight` changes only the camera near plane** (+0.5%, +1.3%, -0.7%), so nothing moves on screen, only depth precision. A known-bad calibration scene (`scenes/zf.js`, two floors 1 mm apart) gives about 160,000 px; a clean scene gives 0. The threshold is 150 px.
- **Planar reflections (`Water`) must be off for `zfight`.** Their mirror camera copies the near plane, which gave false positives (7,000 px on clean water). The probe disables them and tests geometry only.
- **`flicker` counts luminance reversals between consecutive 30 fps frames.** It also fires on legitimate fast fine detail (a moving city, ripples, a crowd bracing). Use it to find where to look, then confirm with consecutive frames at full size. `zfight` is the pass/fail test.
- **AO artifacts:** if a dark shape disappears with `?ao=0` (or `?post=0`), bisect it with a debug scene (`scenes/dbg.js`) by hiding groups until it goes. If it survives with an empty scene, the renderer is at fault (v8: the background quad).
- **The audit pipe:** `scenes/zf.js` (two floors 1 mm apart) must print COPLANAR. If it prints nothing, `render.mjs` is not forwarding warnings.

## v8.1 (user review of the three films)

| Time | Defect | Root cause | Fix | Now guarded by |
|---|---|---|---|---|
| Apollo 0:30-0:40 | Characters glitch through each other and through objects: Swigert's arm through Lovell's head, his head into Haise's, his body hanging through a solid ceiling, both crew's knees through the console | Positions and poses placed by eye. The float pose bent the knees forward into the console, the ceiling had no hole, and the cabin is too small for three bodies at those spots. **The review missed it:** stills of the shot were judged on composition rather than checked body against body; consecutive frames were only taken at effects; rule 11 had no automatic check | Crew stand at the windows with hands on the console via `handTo`, as they really did in restraints. The ceiling has a real hole under the tunnel. Swigert comes down through it and floats in the gap between the other two, low enough that his head clears the hatch ring. Cameras moved closer to front-on | **`render.mjs collide`** (new, `src/collide.js`): calibrated on the broken cabin (49/49 frames failed); now clean |
| Cave 0:08-0:10 | Two walkers' arms pass through each other (up to 4 cm); nobody had noticed | Files 0.8 m apart minus random jitter of up to 0.4 m, with swinging arms | Files 0.95 m apart, jitter of 0.16 m at most | `collide` (it found this on its first run) |
| Apollo 0:33-0:40 (during the fix) | Swigert hid Lovell, then looked headless | Collision-free but badly framed: he stood behind Lovell, then floated so high his head went up into the tunnel | Moved into the gap between them and lowered | Manual readability review, item 4 in SIGNOFF.md |
| v8 patches (twice) | Code silently commented out | A patch appended code after a `//` comment on the same line | Lines fixed | `tools/check_syntax.sh` (part of the sign-off gate) |
| crime-style v1 (Mona Lisa, owner review 2026-10-13) | Red stamps 'FERME' / 'LOCKED'; 'AI-generated voice' notice | Kit offered stamp() and a notice example for reenacted voices | stamp() is a no-op, notice() drops AI-voice text, docs + prompts ban both in every style | no_slop.md B1-B2; reconcrimeprompts greps the skills |
| crime-style v1 | Shots where nothing is visible (navy-black salon, black 'frame dropped' shot), grey blurred close-ups | Dark theme taken as underexposure; DOF on the subject | Three-point light + practicals per scene, lit set, focus on subject | no_slop.md L1-L5 visibility gates (engine checker pending) |
| crime-style v1 | Painting lifted/carried with arms not attached, frame through body; static plumber 'opening' a door | Props moved on their own path; no IK, no clip | IK hands on grip points, prop parented to hand, matching mocap clip | no_slop.md I1-I6, stills 0.3 s apart at contact |
| crime-style v1 | Abrupt push (sec 11); cards held 0.7 s; scrambles unresolved at the cut; fast cuts over weak frames | Pacing numbers copied from a reference channel over readability | Eased push >= 2.5 s; text holds >= 1.5 s after settle; cut on read time | no_slop.md C1-C6, R1-R5, P1-P4 |
| crime-style v1 | Egg-head mannequins look cheap; drawn oval as a thumbprint; disruptive sound effects | Primitives standing in for people and evidence; kit sfx on by default | Realistic library character + mocap; real evidence textures; kit overlays silent unless { sound: true } | no_slop.md F3, F9, B3 |
| Ultraedit+ shot-match runs (2026-10-14) | Big floors, walls and table tops plateau at 6-7/10 against the target; one tile stretched over a whole face reads as streaks | Procedural canvas materials have a ceiling; box UVs at repeat 1 | Only when the make_texture tool is offered (image service = Google Flow, free): a seamless 2K texture per big surface, RepeatWrapping, repeat = surface metres / tile_m, subtle and stylized; small things stay procedural. Without the tool: canvas-materials as before | make_texture's prompt (flat, top-down, no text) + its seam blend |
