# Stage: look (settings + notes for an existing style)

**Inputs:** reference/ANALYSIS.md (or the brief), the style's Look controls (studio_state names the style; its settings
and ranges are the ones its Look panel shows; the base skill's references describe them), the sample scenes.
**One output:** the look: its settings through set_look_settings, and skill/LOOK.md filled in.
**Gate:** settings set and LOOK.md filled; render_view sample in every aspect looks like the brief.

## Steps
1. Map the analysis onto the style's controls: palette / theme, finish (grain, vignette, contrast), camera, transitions, captions. Only controls the style has.
2. set_look_settings with the changed values only (it validates them; a refusal names the setting and its range).
3. render_view sample (and hero) at a few moments in every aspect; adjust; repeat.
4. Fill LOOK.md: what changed and why, notes for the build (what Claude should show and avoid in videos of this look), quality bar additions, never.

## Don't
- Never edit the engine, scenes or project.json: a look is settings + notes (that is how engine fixes keep reaching it).
- Don't use a setting the style doesn't have; if the look needs engine code, tell the user it must be a style on top of this one.
