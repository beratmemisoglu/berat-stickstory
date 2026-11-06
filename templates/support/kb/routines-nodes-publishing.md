# Routine nodes: thumbnail, title, approval, upload
keywords: routine nodes, thumbnail node, reference thumbnails, analyse with claude, variations, claude picks the best, global style key, picture service, title & description, title and description, chapters, tags, approval, approve, reject, move to stage, notify, notification, upload to youtube, allow uploads, private, unlisted, public, scheduled upload, publish after, auto upload
platforms: both

These nodes finish a video and send it out.

## Thumbnail
Makes the video's thumbnail. **How**:
- **AI picture designed by Claude**: learns from a YouTube channel's thumbnails (**Learn from the thumbnails of**, **How many of its thumbnails**); can **Find reference pictures online**.
- **AI picture in the style of my reference thumbnails**: add 1-5 **Reference thumbnails**, then **Analyse with Claude**. You can edit the formula it writes; every run writes new prompts from it.
- **AI picture from my prompt template**: your **Prompt template** ({title}, {topic}).
- **A frame of the video**: **Frame at** (%).

AI pictures also have **Global style key** (added word for word to every prompt), **Picture service and model** (**As in Settings** or a service), **Variations** (1-8, each one a picture on your service) and **Claude picks the best**. All variations are kept.

## Title & description
Claude learns how the channel builds its titles, then writes a new title, the description and tags. **Match the titles of**, **Chapters in the description**, **Learn the title style again every run**.

## Approval
Waits until you press **Approve** or **Reject** in the run; **What to check** is your reminder. Reject stops this video.

## Move to stage
Moves the video's card on the Channels board to the **Stage** you pick.

## Notify
The last step: tells you in the app (and on the desktop when the app is in the background) and opens the folder with the exported video. **Message**, **Open the folder with the exports**.

## Upload to YouTube
Uploads the video with its thumbnail, title, description and tags. **YouTube channel**, **Visibility** (**Private**, **Unlisted**, **Public**, or **Scheduled** with **Publish after** hours).
- "Sign in a YouTube channel first (YouTube page)": sign in with Google for your channel on the **YouTube** page.
- A channel marked "(uploads not allowed yet)": select the node, press **Allow uploads (sign in with Google)** and allow uploads at Google.
- "Upload to YouTube has no Approval before it": a warning. Put an **Approval** node before it so nothing goes up unseen.
