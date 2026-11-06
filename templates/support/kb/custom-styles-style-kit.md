# Custom styles and the Style Kit
keywords: style kit, get the style kit, custom style, custom styles, own style, my own style, new style, make a style, create a style, build a style, from scratch, import style, import a style, style package, zip, let claude fix it, copy fix list, add to my styles, re-check, export package, go back to version, older version, style version, update style, engine update, needs fixes, import failed, checklist red
platforms: both

Your own styles (new elements, sets, characters) are built in Claude Code with the **Style Kit**, then imported into
berat studio. The app itself makes looks only (see "Style Studio"). Premium.

## Get the kit and build a style

1. **Styles > Custom > Get the Style Kit**, and pick a folder (for example Documents). The kit folder opens with its
   step-by-step guide.
2. Start Claude Code in that folder. On Windows: open Terminal or PowerShell, type `cd ` and paste the folder path,
   then type `claude`. On Mac: open Terminal, type `cd `, drag the folder from Finder onto the window, press Return,
   then type `claude`.
3. Tell Claude what you want, for example "Study the videos in refs/ and make a style called Midnight Files". When it
   is done, ask Claude to "package it".

## Import it

1. **Styles > Custom > Import style** and pick the package (its .zip, or its folder).
2. The Import page runs the checklist live: each problem says what was found, what it means and how to fix it.
3. Something failed? **Let Claude fix it** (only this style's files, re-checked after each round, up to 3), or
   **Copy fix list** and paste it into Claude Code in your Style Kit.
4. When everything passed: **Add to my styles**, then **Use it in a new project**.

If Claude fixed it in the app, click **Export package** on the style's card and tell Claude in the kit "Bring this
package back: (the file)", or your next package undoes those fixes.

## Use and update it

- New project: switch **Built-in** to **Custom styles** above the style picker. Routines and the Look panel list them too.
- Import a changed package of the same style and it becomes v2. Videos keep their version; the editor offers
  "(name) v2 is available · Update" (one History step you can undo).
- The card's **…** menu has **Go back to v…** (the last 3 versions are kept). **Re-check** runs the checks again.
- A newer engine on the card? Click **How?**: get the kit again into the same folder and ask Claude to update your
  style. Until then it keeps working as it is.
