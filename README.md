# Black Box Atlas

An interactive world map of notable aviation accidents, inspired by the
CrashAtlas idea, plus something it doesn't have: **every crash links straight
to a YouTube video and a written article about it.**

## Features

- **3D globe or flat map** with satellite, terrain or dark map styles (layers
  button, top right). Tiles come from Esri's free basemaps, so there's no API
  key and they work on GitHub Pages.
- **Markers or heatmap**: each crash is a plane icon colored by cause and sized
  by fatalities. Heatmap mode shows where accidents cluster, weighted by deaths.
- **Search bar** with instant suggestions (name, flight, aircraft, airline,
  place, country). Press `/` to jump to it.
- **Filters**: year range, cause, flight type and minimum deaths.
- **Detail panel** (left side; bottom sheet on phones): flight number,
  airline, date, country, aircraft, operator, phase of flight, flight type,
  fatalities, survivors, location, cause and summary. Nothing is locked.
- **▶ Watch on YouTube** and **📰 Read the full article** on every crash, plus
  a "Sources" list. Paste any YouTube link to **pin a video** to a crash: the
  Watch button then goes straight to it and it plays in the panel (saved in
  your browser).
- **Browse** list (sort newest, oldest or deadliest), **Statistics** (by cause,
  decade, phase, country, deadliest), **About**, **Random** and **Get App**.
- **Shareable links**: the selected crash goes in the URL (e.g. `#tenerife-1977`).

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

React 18, TypeScript, Vite, Tailwind, MapLibre GL. No backend.
