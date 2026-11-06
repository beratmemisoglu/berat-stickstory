# YouTube page: connect your channels
keywords: youtube setup, connect youtube, link youtube, sign in with google, google sign in, follow a channel, add youtube channel, api key, google api key, google cloud, setup guide, set up youtube, oauth, client id, client secret, desktop app, publish app, testing, google hasn't verified this app, test users, waiting for google, not connected, can't sign in to youtube, youtube analytics api, youtube data api
platforms: both

The **YouTube** page (sidebar, under Analytics; Premium) reads your numbers through your own free Google Cloud project. It takes about ten minutes, once.

## Two levels
- **Public stats** (subscribers, views, likes, comments of any channel): guide steps 1 to 3, then **Follow a channel**.
- **Full analytics** of your own channels (watch time, how long people watch, where they come from): all six steps, then **Sign in with Google**.

## The Setup guide
Click **Setup guide** on the YouTube page (or open **Settings > YouTube**):
1. **Make a Google Cloud project**: **Open Google Cloud**, sign in with your YouTube Google account, name it, Create. No billing needed.
2. **Switch on the two YouTube APIs**: open **YouTube Data API v3** and **YouTube Analytics API**, click **Enable** on each.
3. **Public stats: make an API key**: on Credentials, **Create credentials > API key**, paste it, **Save key**.
4. **Full analytics: set up the sign-in screen**: in **Google Auth Platform** click **Get started**, choose **External**, then under **Audience** add your Google account as a test user. Click **Publish app**, or Google signs you out after 7 days.
5. **Make the sign-in client**: on **Clients**, **Create client**, type **Desktop app**. Drop the downloaded JSON file in the guide (or paste the client ID and secret), then **Save client**.
6. **Sign in with Google**.

If the guide says the app has a Google sign-in built in, skip steps 4 and 5.

## Signing in
Your browser opens Google's sign-in (**Waiting for Google…**; **Open the page again** reopens it). Pick the account that owns the channel and allow both permissions. "Google hasn't verified this app": it is your own app, click **Advanced**, then **Go to** your app.
- One channel per sign-in: sign in once for each channel.
- A channel you only manage through YouTube Studio permissions can't be read: use the account that owns it.
- Then pick which of your Toon Studio channels it is (see "Channels: make, edit and link a channel").

Keys and sign-ins are stored encrypted on this computer.

## Follow a channel
**Follow a channel** (or **+**): an @handle, a youtube.com/@handle address or a channel ID. Any public channel: yours, or one you learn from.
