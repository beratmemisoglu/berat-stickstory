# Stage: sample (a 15-30 s video in the style)

**Inputs:** the kit, skill/STYLE_GUIDE.md, the sample narration (audio/timeline.json: the narration tool gives words with
times; script.txt has the text), the engine.
**One output:** scenes/sample*.js: the sample narration as a finished video in the style, in every aspect it renders.
**Gate:** a sample scene exists; check_preview clean; check_layout Clean in every aspect.

## Steps
1. Read the narration (narration tool, 0 to the end). Plan one shot per sentence or clause; write the plan as a comment at the top of the scene.
   Search first: library_search the sample's sets and shots (a recipe or a look may already exist); what you reuse goes in the plan comment.
2. Build only from kit elements. Every element lands on its spoken word (cue('word', near)), eased, held >= 1.5 s once settled.
3. Use the layout values of the engine (SAFE / ZONE / BAND / TITLE or the base's own): nothing in the caption band, nothing cut.
4. set_view sample; check_preview; check_layout until Clean; then render_view sample at each shot's start, middle and end, in 16:9 and 9:16 (when both).
5. File what is still wrong with add_issue; fix what you can now.

## Don't
- No new element kinds (go back to the kit stage for one).
- Don't re-time the narration or edit audio/: the timing is the app's.
- Don't stop at "Clean": the checks catch layout, not taste. Look at every shot.
