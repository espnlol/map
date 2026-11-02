# SkyWatch — Live Flight Tracker

A live map of the aircraft around any airport or location. Filter by
aircraft category and click a plane to see everything about it.

## What it shows

For every aircraft in range:

- **Callsign**, registration and ICAO hex
- **Aircraft model**, e.g. "Boeing 737-800" (from the feed, or a built-in table of ~150 common ICAO type codes)
- **Altitude** in ft (and m), shown as a flight level above 18,000 ft
- **Speed**: ground speed in knots and mph, plus vertical rate and heading
- **Route**: where it's coming from and going to, with a progress bar
- **Emergencies**: squawk 7500/7600/7700 and the ADS-B emergency status (general, medical/lifeguard,
  minimum fuel, no comms, unlawful interference, downed). These go in a red banner, get pulsing
  red markers, and sort to the top of the list.
- **Takeoff and touchdown times**, each labelled as one of:
  - **observed**: SkyWatch saw the aircraft leave or touch the ground while you were watching
  - **estimated**: worked out from the distance to/from the airports at the current or typical cruise
    speed. These are *not* airline schedules.

## Starting it on Windows (double-click)

1. Install Node.js once from https://nodejs.org (the LTS version).
2. Double-click **Start SkyWatch.bat**. The first run installs everything, then your browser
   opens on the app. Keep the black window open while you use it; close it to stop.
3. To get the latest version, double-click **Update SkyWatch.bat**, then start it again.

## On your iPhone (free)

With Start SkyWatch running and the phone on the same Wi-Fi, click **📱 Phone** in the app and
scan the QR code with the iPhone camera. In Safari, tap Share, then **Add to Home Screen** to
get a full-screen SkyWatch icon. It only works while the computer is on and on the same network.
"Near me" doesn't work this way, because iPhones only share location with HTTPS sites. The app
remembers the last airport or spot you picked.

## Filtering

- **Aircraft category** chips (multi-select, with live counts), using the ADS-B emitter category the
  aircraft broadcasts itself: Light, Small, Large, B757 (high vortex), Heavy, High performance,
  Rotorcraft, Glider, Balloon, Ultralight, Drone, Ground vehicle, Unknown
- **Who's flying** chips:
  - **Military / Gov**: air forces, navies, coast guards, police, customs, NASA and similar.
    Matched by the aircraft database's military flag, the US/UK military transponder address
    blocks, known callsigns (RCH, SAM, SPAR, CNV, RRR…) or the registered operator.
  - **Sports**: likely sports-team flights. Matched by team-owned jets, charter airlines that
    mostly fly teams (GlobalX, iAero) or the operator name. Many team flights go out on regular
    airline charters with ordinary callsigns, so this group misses some.
  Every match shows the reason it matched on the aircraft's detail panel.
- Search by callsign, registration, type, model or airport code
- "Emergencies only" and "Hide on ground" toggles
- Sort by emergencies first, callsign, altitude or speed
- A **Takeoffs & landings** tab lists every departure, arrival and emergency seen this session

## Data sources

- **Aircraft positions**: [adsb.lol](https://adsb.lol), with [airplanes.live](https://airplanes.live)
  as a fallback. Both are free, unfiltered community ADS-B networks with no API key. The app polls
  every 6 s within the chosen radius (25–250 nm).
- **Routes**: adsb.lol's route database (`/api/0/routeset`), looked up by callsign. Private,
  military and some cargo flights often have no route.
- **Map tiles**: OpenStreetMap / CARTO.

**Demo mode** (the LIVE/DEMO switch) runs a built-in traffic simulator with departures, arrivals,
overflights, helicopters, light aircraft and an emergency, so the app also works offline or when
the feeds are unreachable. Demo data is always labelled as such.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build on :4173
```

`dev` and `preview` proxy the ADS-B APIs through Vite (see `vite.config.ts`), so browser CORS
rules don't matter. A static deploy of `dist/` calls the APIs directly.

## Code map

| Path | What it does |
| --- | --- |
| `src/lib/api.ts` | Live feed fetching with source fallback, plus the route lookup and cache |
| `src/lib/useTraffic.ts` | Polling, flight-phase detection, observed takeoff/landing events, time estimates |
| `src/lib/demo.ts` | Traffic simulator for demo mode |
| `src/lib/categories.ts` | ADS-B emitter categories, their colours and descriptions |
| `src/lib/emergency.ts` | Squawk and ADS-B emergency decoding |
| `src/lib/aircraftTypes.ts` | ICAO type code → model name |
| `src/components/MapView.tsx` | Leaflet map, rotated plane icons, trail and route line |
| `src/components/DetailPanel.tsx` | The per-aircraft detail view |
