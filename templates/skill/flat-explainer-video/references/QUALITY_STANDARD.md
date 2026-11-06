# Element quality standard (mandatory for every procedural element)

**Rule zero: elements are approved before scenes are built.** If every element is right on its own, the scenes come out
right. A scene may only use elements that passed this gate. (This rule exists because the style's reviewer found
pill shading drawn outside the pill, after the whole film had been built.)

## 1. The gate (every new or changed element)
1. Put it alone in a temporary test shot, scaled to fill ~600 px, on the background it will live on.
2. `render_frames` on that shot and look at it closely against the checklist in §3.
3. `check_layout` on that shot. Besides layout, it measures, once per element on `st`, how many pixels of
   shading/highlight/detail fall OUTSIDE the element's own form. Any "SHADING" issue is a fail.
4. Fix, repeat until clean, then remove the test shot.

How the measure works: every mesh carries a role. `form` (default) builds the silhouette, `detail` = shading,
highlights, features, screen content (must lie inside the form), `thickness` = intended depth under a card or sticker
(allowed outside), `text` = glyphs. Wrap shading in `withRole('detail', () => ...)`; `shaded()`, `ball()`,
`crescent()` already do it for you.

## 2. How elements are built (so they pass by construction)
- **One shading primitive:** `shaded(parent, pieces, color, { s, k })`. A form is a union of convex pieces
  (`capsulePts`, `circlePts`, `starPieces`, any convex CCW point list). The whole form is drawn in the shade tint, the
  lit part = form ∩ (form shifted `s` px toward the top-left light) on top. It can't leave the form, and the light and
  band look identical on every element.
- **Balls / round things:** `ball()` (crescent shade + specular dot). The recurring actor `dopa()` is a ball.
- **Shading is cut, never laid on.** Shade or highlight shapes come from the element's own outline (`clipPts` with
  half-planes, `planesOf`). Loose rectangles or strips laid on top are forbidden.
- **Strokes thinner than ~14 px** (rays, steam, connectors, cutlery) stay flat: a shade band on a thin stroke reads as
  an error.
- **Features sit inside their parent** (door inside the wall, screen inside the phone) and are `detail`.
- **Composite objects are elements in models.js**, never assembled ad hoc inside a scene.

## 3. Eye-review checklist (every element, every change)
1. Nothing pokes out: shade, highlight, feature or seam outside the silhouette.
2. Light from the top-left: shade bottom-right, highlight top-left, same band width as its neighbours (s 4-7 px).
3. Shading follows the form (round ends, star valleys, curves), not a flat strip across it.
4. Clean seams: two-colour objects split with a straight cut, no bumps or slivers at the join.
5. Reads on its background: no edge disappears.
6. Physically sensible: handles attached, a clock shows a real time (10:10, never both hands on 12), a hand holds a
   thing from the correct sides (fingers wrap one edge, thumb on the other, in front).
7. Features clear of each other (brows clear of the fringe, eyes clear of hair).
8. Belongs to the set: same corner radii, stroke weights and palette logic as the existing elements.

## 4. Never again
- A shading or highlight shape that isn't derived from the object's outline.
- An element used in a scene before it passed the gate.
- An element judged only at scene size.
- One element shaded and its neighbour flat.
