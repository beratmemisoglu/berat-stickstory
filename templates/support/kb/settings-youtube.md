# YouTube settings: API key, Google sign-in, followed channels
keywords: youtube settings, youtube, google api key, api key, youtube api, youtube data api, google cloud, google cloud project, oauth, client id, client secret, desktop app, sign in with google, google sign-in app, follow a channel, followed channels, analytics, full analytics, public stats, setup guide, google hasn't verified this app, signed out after 7 days, publish app, analytics not allowed
platforms: both

**Settings > YouTube** brings your channels' numbers into the app (the YouTube page and the Channels board). Public stats need a free Google API key; full analytics of your own channels need a sign-in with Google. Keys and sign-ins are stored encrypted on this computer.

## Setup guide

Click **Open the guide**: about ten minutes, once, in your own free Google Cloud project (no billing).
1. Make a Google Cloud project.
2. Switch on **YouTube Data API v3** and **YouTube Analytics API** (**Enable**).
3. Public stats: **Create credentials** > **API key**, paste it, **Save key**.
4. Full analytics: set up the sign-in screen in **Google Auth Platform** and add your Google account as a test user.
5. Make a **Desktop app** client and drop its downloaded file in (or paste the client ID and secret), then **Save client**.
6. **Sign in with Google**.

Steps 1-3 are enough for public stats. If the guide says a Google sign-in is built in, steps 4 and 5 are not needed.

## The rows

- **Google API key (public stats)**: **Add key**, **Change** or **Remove**.
- **Google sign-in app (full analytics)**: **Set up**, **Change** or **Remove**.
- Your channels, then **Follow a channel** (any public channel by @handle, link or channel ID) and **Sign in with Google**.

## Sign-in tips

- Pick the Google account that owns the channel and allow both permissions. "Analytics not allowed": sign in again and tick both boxes.
- Google ends sign-ins of apps in Testing after 7 days. Click **Publish app** on the Audience page before you sign in.
- "Google hasn't verified this app": it is your own app; click **Advanced**, then **Go to** your app.
- Several channels: sign in once for each.

YouTube Analytics is a Premium feature.
