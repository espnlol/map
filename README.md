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
- **Statistics**: an overview (top airlines, aircraft, countries, oceans and
  seas, decades, causes), a page for **every airline**, aircraft family and
  country/sea (crashes, deaths, survivors, deadliest, causes, aircraft, a full
  list and "show these on the map"), and **Top 5s**: deadliest crashes, sole
  survivors, everyone-walked-away, great escapes, unluckiest months and
  weekdays, Friday the 13th, holiday crashes, farthest north/south and more.
- **Route lines**: the flown leg and the unfinished leg to the destination.
- **Browse** list (sort newest, oldest or deadliest), **About**, **Random** and
  **Get App**.
- **Shareable links**: the selected crash goes in the URL (e.g. `#tenerife-1977`).

## Data: Wikipedia, refreshed weekly

`public/data/crashes.json` holds every aviation accident that has an English
Wikipedia article and a known location (about 2,000). `scripts/build-crashes.mjs`
builds it:

1. **Wikidata** (Wikipedia's structured-data twin) lists every aviation
   accident with its date, coordinates, deaths, survivors, operator, aircraft,
   country, cause and route airports.
2. Each crash's **Wikipedia article infobox** adds the summary line, crash
   site, exact coordinates, aircraft type, operator, tail number, flight number,
   origin/destination and casualty counts. Wikipedia's values win over
   Wikidata's.
3. The cause (mechanical, weather, human error, ...) and phase of flight are
   sorted automatically from the summary line; crashes over water get their
   ocean or sea from the crash-site text.

The 80 hand-written entries in `src/data/crashes.ts` sit on top: they keep
their longer summaries and reviewed causes, while dates, numbers, aircraft and
routes come from Wikipedia. To make a crash's YouTube button go straight to a
video for everyone, add `video: 'https://www.youtube.com/watch?v=…'` to its
hand-written entry.

### Automatic refresh

- `.github/workflows/refresh-crashes.yml` (this branch) rebuilds the data,
  commits it if anything changed, and republishes the site. Run it any time
  from **Actions → Refresh crash data → Run workflow**.
- GitHub only runs *scheduled* workflows from the repository's default branch,
  so `.github/workflows/scheduled-refreshes.yml` lives on the default branch and
  starts the refresh every Monday at 04:23 UTC.

To rebuild locally: `node scripts/build-crashes.mjs` (add `--cache some/folder`
to keep the raw downloads while experimenting). Wikidata's query service is
rate-limited, so the script waits a minute between its queries.

## Online version (GitHub Pages)

Every push to this branch builds Black Box Atlas and publishes it into the
`crashes/` folder of the `gh-pages` branch (`.github/workflows/pages.yml`).
It's live at **https://espnlol.github.io/map/crashes/**, next to SkyWatch at
`/map/`. Each site's publish step only replaces its own files: this one only
touches `crashes/`, and SkyWatch's leaves `crashes/` alone.
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
