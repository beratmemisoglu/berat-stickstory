# Stage: guide (style guide + hero frames)

**Inputs:** reference/ANALYSIS.md (or the brief alone when there are no references), the base engine
(bases/<base>/extend.md, the base skill's engine_api.md), NO_SLOP.md.
**One output:** the style's direction, early and cheap to redo: skill/STYLE_GUIDE.md and skill/QUALITY.md filled, the
engine restyled at its extension points (palette / THEMES, DEFAULTS, fonts via add_font, finish), and scenes/hero.js
with 3 hero shots (stills that show the style at its best: a title moment, a typical explanation frame, a busy one).
**Gate:** every heading of STYLE_GUIDE.md filled (the app compares it with the template) and QUALITY.md filled;
scenes/hero.js with 3 shots that load in every aspect with no high issue open on them (the app renders them after your
turn: they are the user's "first look" at the style, shown large, and the user approves or comments on them).

## Steps
1. Write STYLE_GUIDE.md from ANALYSIS.md: every section with numbers (hex, px, s). Decide the palette roles first.
2. Restyle the engine through its extension points only (extend.md): add a theme / change DEFAULTS values; add exports if needed, never remove one.
3. Fonts: add_font for each family the guide names (no family outside the library), then the engine's font table.
4. Write scenes/hero.js: 3 shots, each holding still long enough to look at (2 s), built from the base engine's own elements.
5. set_view hero; check_preview; check_layout until Clean; render_view hero at the middle of each shot in every aspect, scale 1 once.
6. Fill QUALITY.md: the style's own findings (what would break THIS look) and the one-paragraph bar.

## Don't
- No animation polish yet: the user approves the direction from these stills first.
- Don't build new element kinds here (that is the kit stage); restyle what the engine has.
- Don't leave the base's own look anywhere in the hero frames (its palette, its fonts) unless the guide keeps it on purpose.
