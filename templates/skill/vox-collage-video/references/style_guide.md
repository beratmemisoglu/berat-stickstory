# The look and the motion (from the reference, frame by frame, and the user's corrections)

The reference is a 60 s explainer on the history of the printing press (Alex Patrascu, "Claude + Higgsfield", made
from the brief: newspaper cut-outs, mixed-media collage, layered paper, torn edges, halftone, soft shadows, bold
editorial type; Higgsfield makes every still, all motion and all text are added on top).

## PROHIBITED (the user's rules: each one was seen and rejected)
- **Section cards.** No "I. BEFORE THE PRESS" kickers or chapter labels on panels. Don't announce sections.
- **Slapped-on type.** Nothing slams in: no stamps that pop in big and tilted, no headlines that punch in. Stamps ink
  in (the default: the ink soaks into the paper with a slight press, nearly level, rot within +-2 deg); headlines
  print in (`anim: 'print'`), type in, or rise; tape labels are laid down left to right. `in: 'slam'` does not exist.
- **Anything cut by the frame edge**, or a frame that shows past its panel. Everything is fully in or fully out.
- **Accidental overlaps.** A marker line or circle over anything but its word; a label over a cut-out; a pen over a
  circle; pins over cards. Every overlap is a decision (`over`), never an accident.
- **Invisible or pointless text.** Red on a map, red on kraft, small print that can't be read: if it can't be read,
  give it paper or make it bigger; if it isn't relevant, don't put it there.
- **Imprecision.** A pen that doesn't write where the ink appears, a circle that isn't around its word, elements
  placed by eye. Use the engine's measured tools (`script` pen, `mark({ around, word })`, `wordBox`).
- **Rushed camera.** No snap zooms; the camera eases in and out with real velocity (the engine does this: leave the
  default durations, don't shorten them below 0.7 s for a whip or 1.2 s for a move).

## Structure
- Chapters and pictures follow the build prompt's PACING line (the look's Pictures per minute x the length): 5-9
  chapters of 5-9 s for a one-minute video, more and longer chapters (more framings, more pieces) for longer ones,
  each on its own paper panel. All panels are pieces of ONE front page. Between chapters
  the camera travels across the page (the neighbours blur past); at the end it pulls back to the whole front page:
  blackletter masthead, a thin rule, a small-caps kicker, every panel finished (no "THE END" stamp: red stamp plaques are banned); then it pushes
  back into panel 1 so the video loops.
- Inside a chapter: 1-3 framings. Open closer on the hero (zoom 1.1-1.45, still inside the panel), open up to the
  full panel (zoom 1) as the supporting pieces land. Fewer, calmer framings beat many.

## Composition of a panel (16 x 9 units, origin in the centre)
- One hero cut-out, big (h 5-6), on the left or right third, already placed when the camera arrives.
- The headline/hook on the opposite top (ransom letters, blackletter "Mainz, c.1440", poster type "BY THE MILLION").
- Supporting cut-outs smaller (h 2-4), in a row or an equation (metal type + ink + screw press with red plus signs).
- Dates as inked stamps next to (never on top of) what they date.
- Captions as typed strips or black tape labels directly under the object they name, never touching another object.
- 0.4 units of air at every panel edge and between elements.
- Papers vary per panel inside one family: cream paper, second paper, kraft, a full-panel map, white newsprint.

## Layers (what is over what, always)
paper sheets and newspaper pages (surfaces) < cut-outs (0) < type (1) < labels, counters (2) < stamps, marks (3) <
tape (4) < the pen (6, only while writing). A mark starts only after the pen has lifted away.

## Type (all drawn by the engine)
- Ransom letters for the opening hook, dropped in one by one.
- Script handwriting written by a quill whose nib rides the stroke (measured from the ink), then a marker circle around
  one word (`mark({ type: 'circle', around: scriptElement, word: 'hand' })`).
- Typewriter: dates like "10-22-38 ASTORIA." typed on paper strips.
- Black tape labels in white condensed caps for names.
- Inked dates (unboxed, level, `box: false`; on a map or kraft with `backing: true`). Never a boxed red rubber stamp or a
  verdict word: red stamp plaques are banned in every style.
- Big condensed numbers on a white torn card that count up.
- Poster/fat type for one word per chapter at most ("3D" with a red misregistered plate behind it, `over` set).

## Motion
- Cut-outs are placed on the paper (a short lift with a larger shadow that settles), or slide in from outside the panel.
- Land every element on its spoken word (`cue()`), 0-0.15 s before the word.
- One new thing at a time; nothing wobbles while idle (gears may spin slowly).
- Camera: a slow creep-in per shot, smooth erf-eased travel between panels (with real motion blur and a slight
  pull-out on long pans), calm reframes inside a panel, the pull-back finale, the loop push.

## Images (Higgsfield, via make_image)
- Engraving / etching style, black ink crosshatching, one isolated subject per image, no text, no frame.
- A few with colour are fine when the subject is coloured (illuminated manuscript, red 3D printer).
- The sticker border, torn edges and shadows are added by the engine: don't prompt for them.
- A map or texture that fills a panel: kind "background" (no labels, no names in it).
