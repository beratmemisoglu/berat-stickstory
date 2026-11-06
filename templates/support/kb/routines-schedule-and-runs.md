# Routines: run, schedule, resume
keywords: run routine, run now, run anyway, fix these first, schedule, scheduled routine, every day, daily, every few hours, routine didn't run, routine stuck, routine failed, retry, resume, interrupted, cancel run, stop routine, runs, run history, approve, reject, waiting for your approval, where are the videos, routine results, notification, nothing made, limit reached, already running
platforms: both

A routine runs when you press **Run**, or by itself with a **Schedule** node.

## Run now
1. Open the routine and press **Run** (top right).
2. Problems show first: **Fix these first** (each with **Show**), or, with only warnings, **Run anyway**.
3. **Cancel run** stops it.

## Schedule
Add a **Schedule** node (no cable needed): **On**, **When** (**Every day**, **On these days**, **Every few hours**), **At**, **Days**, **Every** (hours).
- It runs only while the app is open, on your computer's clock. A run missed while the app was closed runs once at the next start.
- The next run shows at the top ("Next …") and in the routine list.
- If the routine is still running when it is due again, that time is skipped.

## The Runs list
Click **Runs** at the bottom of the page: each run shows its state (**Running**, **Finished**, **Finished with problems**, **Failed**, **Cancelled**, **Interrupted**). Click one to see its videos:
- Each video shows its step ("Step 3 of 9: Build video") and time.
- **Approve** / **Reject** when it waits at an **Approval** node.
- **Retry**: makes a failed, cancelled or interrupted video again from the step that did not finish. **Resume**: goes on with every unfinished video of the run.
- Both use the node settings as they are now: fix a voice, key or model first.
- The run's bin button removes it from the list; the videos stay.

## Where the videos are
Each video is a normal project, on **Projects** and its channel's board. In the run, a video's buttons open it in the editor or show the exported video in File Explorer (Windows) or Finder (Mac).

## Messages
- **Interrupted** ("The app closed while this run was going"): press **Resume**.
- "Nothing made: this routine already made N videos today": the **Videos per day, at most** limit.
- "Nothing to make: the inputs gave no topics": no ideas left on the channel, or an empty list.
- "Claude is already working on this project": wait for the editor's edit, then **Retry**.
- "This routine is already running": wait, or **Cancel run**.

You get a notification when a run finishes, a video fails or one waits for approval.
