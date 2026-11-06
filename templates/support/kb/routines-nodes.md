# Routine nodes: inputs
keywords: routine nodes, inputs, topic, topic list, channel ideas, topic finder, find topics, idea generator, my script, my audio, own narration, own recording, schedule node, note, create project, style, look, format, wide 16:9, tall 9:16, length, language, main character, brand colour, nothing starts a video, goes nowhere, needs a project
platforms: both

Input nodes start the videos of a routine: each topic becomes one video. Connect them to **Create project**. Click a node to change its settings (in bold below).

## Inputs
- **Topic**: one video. **Topic**, **Notes for Claude**.
- **Topic list**: one video per line. **Topics (one per line)**, **Notes for every video**.
- **Channel ideas**: takes the next idea cards of a channel on the Channels board. **Channel**, **How many** (1-20).
- **Topic finder**: reads a YouTube channel's public videos, then Claude finds new topics in the same vein and checks each one is not already covered. **Study this YouTube channel** (one you follow on the YouTube page), **Look at** (**Its latest videos** / **All its public videos**), **Never repeat these videos**, **What the channel is about** (only without a YouTube channel), **Videos go to channel**, **New topics per run** (1-20), **Research online too (what people search and ask)**, **Extra notes**.
- **My script**: your own script, Claude writes none. **Title**, **Script** ("## Section" lines are headings, not read aloud).
- **My audio**: your own narration; several files are joined in order. **Title**, **Recordings** (**Add recordings**), **Script (optional, makes timing exact)**.
- **Schedule**: runs the routine by itself (see "Routines: run, schedule, resume"). Only one per routine; it needs no cable.
- **Note**: a note on the canvas, it does nothing.

## Create project
Makes the project and puts it on the channel's board. Settings: **Name** ({topic}, {channel}, {n}, {date}), **Channel**, **Style**, **Look**, **Format** (**Wide 16:9** / **Tall 9:16**), **Length**, **Language**, **Brand colour**, **This project's settings** (as Project settings in the editor). Some styles add their own: **Main character** (Flat explainer), real photos, maps and 3D models (3D reconstruction), **More details** and real images (MS Paint stick figures).

Pixel art, 3D reconstruction and MS Paint stick figures are wide only: pick Wide, and add a **Vertical version** node for a 9:16 cut.

## Messages before a run
- "Nothing starts a video": add an input node, or switch yours on.
- "… goes nowhere: connect it to a Create project".
- "… needs a project (a Create project before it)": connect the step after Create project.
