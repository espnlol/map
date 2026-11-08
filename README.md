# Black Box Atlas

An interactive world map of notable aviation accidents, inspired by the
CrashAtlas idea, plus something it doesn't have: **every crash links straight
to a YouTube video and a written article about it.**

## Features

- **World map** (Leaflet + CARTO dark tiles). Each crash is a circle sized by
  fatalities and colored by cause. Hover for a quick label, click for details.
- **Detail panel** with date, location, flight number, operator, aircraft,
  phase of flight, fatalities, survivors, and a short summary of what happened.
- **▶ Find on YouTube**: opens a YouTube search for that crash
  (e.g. "US Airways Flight 1549 2009 crash").
- **📰 Read article**: opens the crash's Wikipedia article.
- **Pin your own video**: paste any YouTube link into a crash's panel. It
  replaces the search button with a direct "Watch video" link and embeds the
  player right in the panel. It's saved in your browser (localStorage).
- **Filters**: search (flight, airline, aircraft, place), year range, cause,
  type (commercial / cargo / military & state / general aviation), and
  minimum deaths. Sort by newest, oldest or deadliest.
- **🎲 Random** picks a crash from the current filter.
- **Shareable links**: the selected crash goes in the URL hash
  (e.g. `/#tenerife-1977`).
- Works on phones: toggle between map and list, details in a bottom sheet.

## Data

`src/data/crashes.ts` holds 80 hand-written entries for well-documented
accidents from 1937 to 2025. Positions are approximate (a few km), and MH370's
marker shows the search area, since the wreck was never found. To make a
crash's YouTube button go straight to a specific video for everyone, add
`video: 'https://www.youtube.com/watch?v=…'` to its entry.

## Online version (GitHub Pages)

Every push to this branch builds Black Box Atlas and publishes it into the
`crashes/` folder of the `gh-pages` branch (`.github/workflows/pages.yml`).
It's live at **https://espnlol.github.io/map/crashes/**, next to SkyWatch at
`/map/`. The workflow only replaces `crashes/` and leaves SkyWatch's files alone.
To publish again without a code change, go to **Actions → Publish Black Box
Atlas website → Run workflow**.

## On your phone

Open https://espnlol.github.io/map/crashes/ in Safari, tap Share, then
**Add to Home Screen** to get a full-screen app icon. (On Android, open it in
Chrome and tap **Install app**.)

## On a Windows PC

1. Install Node.js once from https://nodejs.org (the LTS version).
2. Double-click **Start Black Box Atlas.bat**. The first run installs
   everything, then your browser opens on the app. Keep the black window open
   while you use it; close it to stop.
3. To get the latest version, double-click **Update Black Box Atlas.bat**,
   then start it again.

## Running it (developers)

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

React 18, TypeScript, Vite, Tailwind, react-leaflet. No backend.
