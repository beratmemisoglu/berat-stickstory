# The Vox editorial style - what to aim for

Distilled from Vox, Johnny Harris and the editors who break their work down. The quality bar: every frame looks like a
designed page of a magazine that is being physically assembled on a desk while the camera floats over it.

## 1. Backgrounds are layered, never flat
Flat solid backgrounds lose the editorial identity. Use a board with texture: paper, graph grid, dotted grid, wood,
felt, cork, plaster, chalkboard, or tinted `newsprint` (a scanned-newspaper page tinted into the palette, blacks
lifted to dark grey, whites pulled down so it stays subtle). Put a second layer on the board when the shot is sparse:
a torn newspaper clipping, a document, an index card.

## 2. Collage at real depth
Everything is a physical object at a height above the board: cards 0.05-0.3, stickers and tags 0.3-1.0, props on
top. Height gives the soft drop shadows that make it tactile. For depth, put one out-of-focus foreground object close
to the camera (z 2.5-4) and set `S.dof` (0.4-1.0). Parallax comes free: the camera always moves.

## 3. The camera never holds still
Every shot drifts (`S.drift`, default +4.5% zoom over the shot) and many travel (`S.moves`) to the next element as it
lands. Moves use strong ease in/out. Frame the hero large; leave the edges for secondary pieces.

## 4. Cuts are smooth: cut the curve
Shots connect with motion that matches across the cut: the outgoing camera accelerates, the hard cut happens at peak
speed with motion blur, the incoming camera decelerates in the same direction (`trans: 'slide-left'` etc.). Rack focus
(`'blur'`) for topic changes, zoom-through (`'push'`) to dive into a detail, `'paper'` wipes for chapter changes,
`'cut'` for punchy beats on a word. Vary them; don't use the same one three times in a row.

## 5. Texture is the secret sauce
Print texture over everything: paper grain (adjusted by luminance, not opacity, so colours stay clean), a fine halftone
screen that shimmers slightly as the camera moves (moire), film grain, a soft vignette, lifted blacks. Printed photos
are halftone or duotone with a white sticker border. The look settings (Look panel) control the global amounts;
per element use `photo({ style: 'halftone' | 'duotone' })`, `halftone()`, `duotone()`, `roughen()`.

## 6. Type
Editorial serif for headlines (Playfair), condensed gothic for numbers and punch words (League Gothic / Oswald),
a heavy poster sans for stickers (Archivo Black), mono for counters and data (Space Mono), a book serif for archival
labels (EB Garamond). Animations that feel "Vox":
- `fill`: the word sweeps in in the accent colour (Vox yellow), then settles to charcoal for legibility
- `odometer`: letters roll in like a slot machine (numbers, dates, big stats)
- `random`: letters appear in random order
- `type`: typewriter with caret (quotes, documents)
- `rise`: word by word
- highlight: a marker swipe behind the key words (`highlight: { match: 'word' }`), underline scribbles
Only one text animation at a time, so the viewer knows what to read. Monospace for counting numbers (no jitter).

## 7. Annotations are hand-made
Marker circles around the key number, arrows that draw on, underlines, crosses, checkmarks: `scribble()`. Red or the
accent colour, drawn on the spoken word, 0.3-0.5 s.

## 8. Tactile props
Pushpins, masking tape, paperclips, red string between pins, stamps and wax seals, price stickers, calendar pages,
coins and banknotes, keycaps, frames, pencils. They make the collage physical and each one makes a small sound.

## 9. Looks (themes)
- Editorial: cream paper, charcoal ink, Vox yellow + red marker. Business, money, explainers.
- Archive: sepia paper, wood and plaster, spotlight, wax red + gold, garamond labels. History.
- Newsroom: white dotted grid, bold red keylines, offset black shadow blocks behind cards (the "Netflix story" card).
  Tech, data, science.
- Tabletop: saturated felt/grid tabletop, money and hands, heavy condensed yellow type. Finance, hype, contrasts.

## 10. Vertical shorts (9:16)
A shot every 1.5-3.5 s, the hook in the first second, the hero element in the middle 60% of the frame, text in the
upper third or lower third (never across the middle of the hero). Numbers huge. Keep x inside [-4, 4].

## Checklist per shot (render_frames)
- Does the frame explain the sentence being spoken right now?
- Is the hero present at the first frame and big enough to read on a phone?
- Is anything clipped by the frame edge or covered by another element?
- One text animation at a time? Accent colour used once?
- Is there depth (shadows, a layer, a foreground blur) and motion (drift/move)?
