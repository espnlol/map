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

`public/data/crashes.json` holds every aviation accident on English Wikipedia
that has a date and a location we can place (about 2,800). `scripts/build-crashes.mjs`
builds it:

1. **Which crashes:** every accident Wikidata (Wikipedia's structured-data
   twin) knows about, plus every Wikipedia article that uses the
   aircraft-occurrence infobox (this catches crashes like MH370 and Lion Air 610
   that Wikidata doesn't tag as accidents).
2. **The facts** come from each article's infobox: date, crash site,
   coordinates, aircraft, operator, tail number, flight number, route, people
   aboard, deaths, survivors and the one-line summary. Wikidata fills gaps.
3. **Airline and aircraft names** use the article each infobox links to, with
   Wikipedia's redirects resolved, so "United Air Lines" and "United Airlines"
   count as one airline and a "Boeing 747-206B" belongs to the Boeing 747 family.
   A short alias list in the script handles the rest.
4. **Flight type** (commercial, cargo, military, private) comes from what
   Wikidata says each operator is, with flight numbers and military aircraft
   types as hints. **Cause** and **phase of flight** are sorted from the
   one-line summary.
5. **Countries** use today's names (Nazi Germany becomes Germany, the Kazakh SSR
   becomes Kazakhstan). Soviet-era crashes get the present-day country of their
   crash site where Wikidata knows it. Crashes over water get their ocean or sea.
6. **Positions:** crashes without coordinates of their own are placed at the
   most precise place their crash site links to (an airport before a town,
   before a river or region) and marked "approximate" in the app.

The 80 hand-written entries in `src/data/crashes.ts` sit on top with longer
summaries. Their dates and casualty numbers were checked against Wikipedia's
infoboxes, and their summaries against each article's opening paragraph.

### How accurate is it?

Spot checks against the Wikipedia articles (50 random crashes, three samples):

| Field | Result |
|---|---|
| Date, deaths, survivors, aircraft | Correct in all 50 |
| Airline | 49 of 50 (one fixed: a country code read as the operator) |
| Cause | 27 of 30 in the first two samples; 20 of 20 in the third, after fixing the rules |
| Flight type | The weakest field. 5 of 30 wrong in the first two samples, 2 of 20 in the third; those cases are now fixed |
| Country | 46 of 50 right; the misses were "Unknown" (87 of ~2,800 overall) or duplicate names, now merged |

Known limits:

- **Only crashes on Wikipedia.** That covers most airliner crashes but few
  small-plane ones. Databases such as the Aviation Safety Network list tens of
  thousands more, but their terms don't allow copying their data, so it isn't
  used here. The US NTSB database is public domain and could be added for US
  accidents.
- **About 1,050 accidents on Wikidata have no location at all** and are
  skipped.
- **Counts aren't risk.** Nothing is adjusted for how much an airline or
  aircraft flew.
- **Causes and phases are automatic,** so roughly a quarter are "Unknown" and
  some are simplified. Death tolls follow Wikipedia, so some include people on
  the ground (the 9/11 flights especially) and about 150 crashes have no toll.
  Those are left out of totals rather than counted as zero.

### Automatic refresh

- `.github/workflows/refresh-crashes.yml` (this branch) rebuilds the data,
  commits it if anything changed, and republishes the site. Run it any time
  from **Actions → Refresh crash data → Run workflow**.
- GitHub only runs *scheduled* workflows from the repository's default branch,
  so `.github/workflows/scheduled-refreshes.yml` lives on the default branch and
  starts the refresh every Monday at 04:23 UTC.

To rebuild locally: `node scripts/build-crashes.mjs`. Add `--cache some/folder`
to keep the raw downloads while experimenting, and `--offline` to rebuild from
that cache without any network. Wikidata's query service is rate-limited, so
the script waits a minute between its queries. A full refresh takes about
10–15 minutes.

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
