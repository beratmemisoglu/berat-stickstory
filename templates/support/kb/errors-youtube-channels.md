# YouTube and channel errors
keywords: youtube, google, sign in with google, quota, quota exceeded, api key, AIza, client id, client secret, GOCSPX, not switched on, api not enabled, analytics, handle, @handle, channel not found, uploads, allow uploads, could not reach youtube, 403
platforms: both

## Today's YouTube quota is used up
> Your Google project used up today's YouTube quota. It starts again at midnight Pacific time...

Fix: wait until the quota resets. The app keeps showing the numbers it already has.

## The API is not switched on
> ... is not switched on in your Google Cloud project.

Fix: switch it on in Google Cloud (step 2 of the guide in **Settings > YouTube**), wait a minute, then try again.

## The API key is wrong or restricted
> Google did not accept the API key. Check that you copied all of it (Settings > YouTube).
> This API key is not allowed to use the ...

Fix: copy the API key (it starts with AIza) from Google Cloud > APIs & Services > Credentials into **Settings > YouTube**. If it has restrictions, allow the YouTube APIs on it.

## Client ID or secret not accepted
> Google did not accept your app's client ID or secret. Check them in Settings > YouTube (step 5 of the guide).
> That is a Web application client. Make a client of the type "Desktop app"...

Fix: follow step 5 of the guide in **Settings > YouTube**: use a "Desktop app" client and paste both its ID and secret.

## Signed out by Google
> Google ended this sign-in (it was removed, it expired, or the password changed). Sign in with Google again.
> You did not allow the app to see your YouTube account when you signed in.

Fix: click **Sign in with Google** again and tick every box Google shows.

## No channel on this account
> This Google account has no YouTube channel.

Fix: sign in again and pick the account (or brand account) that owns the channel.

## Channel can't be found
> That is not a YouTube channel. Use its @handle (like @mychannel)...
> YouTube has no channel with the handle @...

Fix: type the channel's @handle exactly as shown under its name on YouTube, or its channel ID (starts with UC).

## Could not reach YouTube
> Could not reach YouTube. Check the internet connection and try again.

Fix: check the internet connection, then try again.
