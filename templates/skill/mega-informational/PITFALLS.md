# PITFALLS (every failure of the two showcase films, as rules)

## Camera
- A camera that holds still then spikes reads as jaggy: every shot moves (M.Flight creeps by itself), 2-4 keys per shot.
- Sideways whips at the shot edges read as twitches, and a fast zoom at every cut read as "frantic, horrible": no
  whips, no zoom transitions, no cuts inside a shot - one calm move per shot (M.Flight travels it with one speed curve).
- Long lenses (60-85 mm) flatten the scale: 18-35 mm.
- Hand-keyed cameras bypass the cut grammar: always M.Flight.
- A one-frame black flash at a cut is not a transition: never change the picture to satisfy a measurement.

## Models and materials
- Plain boxes as machines / equipment piles read as placeholders: real parts (models.md).
- Joined parts lost their bevels (fixed in M.join): still bevel each part before joining.
- BLENDED cut-out materials ghost (see-through bushes): DITHERED + alpha clip for leaves, feathers, clouds-as-cards.
- A full fresnel water reflection goes white at grazing angles: use M.water (diffuse teal + 40 % tinted gloss).
- Bright yellow / green emission washes out to cream under AgX: emission <= 1.5, push the colour's saturation instead.
- The sky node's own sun disc sits elsewhere than the lamp: M.setup draws the sun on the lamp (sun_disc=False hides it).

## Light
- A saturated sky as the light turns every shadow deep blue: M.setup lights with a calmer copy (light_sat, light_k).
- Flat, bright frames: lower the sun (15-25 deg), less fill (light_k 1.0), a rim from behind.

## Pictures
- The image service once handed back another scene's picture: LOOK at every enrich target before building from it.
