# Project and file errors
keywords: project folder is missing, folder missing, moved, deleted, external drive, not a Toon Studio project, zip, import, share, delete project, can't delete, custom style not installed, reference missing, relink, file not found, not there any more
platforms: both

## The project folder is missing
> The project folder is missing: ...
> The project's folder is missing ...
> ... Put it back, or connect its drive, then rename it.

What it means: the folder was moved, renamed or deleted, or it is on a drive that is not connected.

Fix:
1. Connect the drive, or move the folder back to the path the message shows (look in the Recycle Bin on Windows or the Trash on Mac).
2. Try again.

## Projects in OneDrive, or files removed by an antivirus

Projects inside OneDrive (or a folder an antivirus is scanning) open normally: if the app can't refresh a project's files right away, it keeps the old ones and tries again next time. If your antivirus removes some of the app's files, **New project** uses the copy Toon Studio keeps after your first video in a style; otherwise it tells you how to restore them from quarantine and add the Toon Studio folder as an exclusion (Windows Security on Windows).

## Not a Toon Studio project
> That folder has no project.json, so it is not a Toon Studio project.
> That zip has no project.json at its top level, so it is not a Suite project.

Fix: pick the project's own folder (the one with project.json inside), or a .zip made with Share project as .zip.

## The file is gone
> It is not there any more (moved or deleted?): ...

Fix: the file was moved or deleted. Export or make it again.

## Can't delete right now
> Claude is working on this project. Stop it first, then delete.
> This video is being exported. Wait for the export to finish (or cancel it in its Export dialog), then delete it.

Fix: press **Stop** in the Claude panel or wait for the export, then delete.

## Custom style not installed
> The custom style of this project is not installed on this computer, so its engine stays as it is.

What it means: the project uses a custom style that only exists on the computer it was made on.

Fix: the video still opens. To update it, add that custom style to this computer first.

## A reference is missing
> ... is not there any more. Relink it to where the file is now.

Fix: relink the reference to the file's new place, or put the file back.

## Wrong file type
> ... is not a picture, video, sound, PDF or 3D model.
> The picture must be a PNG, JPG or WebP image.

Fix: use one of the file types the message names.
