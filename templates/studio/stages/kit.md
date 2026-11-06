# Stage: kit (every element alone)

**Inputs:** skill/STYLE_GUIDE.md (its Elements section), the approved hero frames, the engine.
**One output:** every element the style needs (props, panels, text treatments, characters, transitions), built in the
engine (lib/ modules or engine.js, registered at the extension points) and shown ALONE in scenes/kit*.js: one element
per shot, full size, on the style's background (and on a light and a dark one when the style uses both: one shot each).
**Gate:** a kit scene exists and the kit view is Clean in check_layout; the USER approves or flags every element in the
kit gallery (one card per kit shot, named after the shot's title). A flag becomes an issue on that element: fix it, the
user approves it afterwards.

## Steps
1. List the elements from STYLE_GUIDE.md "Elements"; one kit shot each, named after the element (the shot title is what the user flags).
   Search first: library_search each element (a module, material or pose that already worked); library_use copies it into library/<id>/ and the kit imports it from there (never edited in place).
2. Build each element where extend.md says (registerElement / a lib module / models.js), with its options documented in a comment above it.
3. Kit shot: the element centred, whole, at least 12 % of the frame and 6 % from every edge (the KIT check), held 1.5 s after it lands.
4. Animated elements: show the entrance and the hold in the same shot.
5. set_view kit; check_preview; check_layout until Clean; render_view kit, one frame per element (scale 1 for text elements), every aspect.
6. File anything not right yet with add_issue (element name in "element").

## Don't
- Nothing goes into a sample that isn't in the kit.
- Don't fake an element with a picture of it (make_image) when the base draws it procedurally, unless the guide says so.
- Don't change the hero scenes here (that was the guide stage).
