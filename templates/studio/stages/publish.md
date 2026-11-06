# Stage: publish (styles) / save (looks)

The app runs this stage, not you: a checklist that must be all green, shown live to the user item by item:
- every earlier gate passes again (guide headings + hero frames, every kit element approved, the sample, the review);
- style.json valid against style.schema.json, with a name no other style has (the app rewrites id, base, from, version,
  aspects, official, aliases itself);
- every engine export of the start (and every one the host page needs) still there, no banned calls;
- per frame: every view loads, the runtime sweep is clean, no high layout issue, a 5 s export succeeds;
- no open high-severity issue; every must-fail scene still flagged; the looks validate;
- a preview video and poster made.
Then the style appears under the member's "Your styles" everywhere at once (New project, Routines, the Styles page);
publishing again from this workspace updates the same style and raises its engine version, so projects in it are
offered Update engine. (A look is saved, not published.)

If asked to help here, you may only polish style.json text (name, tagline, description, prompts.brief / build / context /
qualityBar / reframe / imageStyle) and STYLE_GUIDE.md / QUALITY.md wording. prompts.* are what every future video in the
style is told: short, concrete, in the guide's numbers. prompts.qualityBar left empty = QUALITY.md's "The bar" paragraph.
