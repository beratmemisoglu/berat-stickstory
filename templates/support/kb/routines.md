# Routines (automatic videos)
keywords: routines, routine, automation, automate, autopilot, automatic videos, make videos automatically, batch, canvas, nodes, add node, connect nodes, cable, routine settings, hard limits, videos per day, videos at the same time, when a video fails, claude model for routine, effort, import routine, export routine, share routine, demo, run, n to fix, warnings, premium
platforms: both

**Routines** (Faceless Brand sidebar, under Workspace) make videos end to end by themselves: topic, script, voice, build, checks, render, thumbnail, upload. Premium: on Standard the page shows a lock.

## Start a routine
- Click a template under **Templates** in the left list (see "Routine templates"), or **New** for an empty routine.
- With no routine open: **Start from a template** (makes "Explainer from a topic") or **Empty routine**.
- Click the name at the top to rename it. Routines in the list have **Duplicate** and **Delete**.

## The canvas
- Each step is a node. **Add node** (or N, right-click or double-click the canvas) adds one. What each does: "Routine nodes: inputs", "Routine nodes: script, voice, build, render" and "Routine nodes: thumbnail, title, approval, upload".
- Drag from a node's output dot onto another node to connect them. Click a cable and press Delete to remove it.
- Click a node to change its settings on the right. Its **On** switch (or M) switches it off without removing it: runs pass through it.
- Ctrl/⌘ + Z undo, Ctrl/⌘ + D duplicate, Delete removes, Shift + 1 fits everything, + / - zoom.

## Routine settings
Click an empty spot of the canvas to see them on the right:
- **Before it can run**: what is missing. **Show** jumps to that node.
- **Hard limits**: **Videos per run, at most** (default 10), **Videos per day, at most** (default 20), **Videos at the same time** (1, 2 or 3), **When a video fails** (**Go on with the next** / **Stop the run**).
- **Claude for this routine**: **Model** and **Effort** (**Same as Settings**, or pick one).

Routine steps never stop to ask for permission. Their edits stay inside each video's folder and can be reverted in the editor.

## The top bar
- **Ready**, or how many problems to fix or warnings are left.
- **Run** starts it now (see "Routines: run, schedule, resume").
- **Import** / **Export**: a routine as a .json file. After an import, check its channels and files.
- **Demo**: plays the last run back on the canvas, sped up, for a screen recording. Nothing real happens.
