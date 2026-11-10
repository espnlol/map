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

## Online version (GitHub Pages)

Every push to this branch builds SkyWatch and publishes it to the `gh-pages` branch
(`.github/workflows/pages.yml`). With **Settings → Pages → Deploy from a branch → gh-pages**
turned on once, it's live at **https://espnlol.github.io/map/**. It works on any phone with
internet, no computer needed, and "Near me" works because the site is HTTPS. 
The flight-data services don't allow web pages on other sites to call them, so the hosted version
goes through a small relay: `worker/skywatch-relay.js`, pasted into a free Cloudflare Worker. Its
address goes in `RELAY_URL` in `src/lib/upstream.ts`. To try a relay before it's built in, open
`https://espnlol.github.io/map/?relay=<worker address>`; SkyWatch remembers it.

## On your iPhone (free)

With Start SkyWatch running and the phone on the same Wi-Fi, click **📱 Phone** in the app and
scan the QR code with the iPhone camera. In Safari, tap Share, then **Add to Home Screen** to
get a full-screen SkyWatch icon. It only works while the computer is on and on the same network.
"Near me" doesn't work this way, because iPhones only share location with HTTPS sites. The app
remembers the last airport or spot you picked.

## Flight paths, photos and links

- **Trails**: every aircraft draws a thin trail of where it has been since SkyWatch opened
  (turn them off with the *Trails* checkbox).
- **Full flight path**: click an aircraft to load its whole flight so far from the adsb.lol
  (or airplanes.live) history files, coloured by altitude, with a dot where it took off.
  It refreshes every minute.
- **Photo**: a photo of that exact airframe from Planespotters.net, credited to its
  photographer. Not every aircraft has one.
- **Find this plane**: links to FlightAware, Flightradar24, ADS-B Exchange, adsb.lol,
  Planespotters, JetPhotos and Wikipedia for the aircraft or its model.

## Owner tab

Click a plane, then **Owner**:

- **Registered owner** from public registry data (via [hexdb.io](https://hexdb.io)), or the operator
  the ADS-B network reports.
- **Usually flown by**: the airline or operator, from the callsign's 3-letter ICAO code
  (SKW5123 = SkyWest) or the operator on file. Private aircraft show that no airline is linked.
- Registration, country of registration, manufacturer, exact type and transponder code.
- Links to the official registry (FAA for N-numbers; UK, Canada and Australia search pages) and
  Planespotters' airframe history.

Pilots' identities aren't broadcast, so SkyWatch doesn't show them.

## Airports, emergencies, logbook and teams

- **Airports layer**: 5,282 large and medium airports with their runways (from
  [OurAirports](https://ourairports.com), public domain; rebuild with
  `python3 scripts/build-airports.py <dir with airports.csv and runways.csv>`). Large airports show
  from zoom 6, medium from zoom 8, runways from zoom 10. The colour and number show how many
  aircraft are on the ground or low nearby right now; tap one for details and *Track planes here*.
- **Bigger areas**: 400 and 500 nm. The APIs cap one query at 250 nm, so SkyWatch covers bigger
  areas with seven overlapping queries and refreshes every 15 s. Only aircraft near the visible
  part of the map are drawn.
- **Emergencies tab**: every real emergency seen is saved on the device with its codes, path and
  outcome (landed, cleared, or out of range). Tap one to see its path.
- **Logbook tab**: *📒 I saw this* on any plane saves it with its photo, owner and route, and
  tells you when it's a type or airline you've never logged. Stored on the device.
- **Teams tab**: follow a team's planes anywhere in the world by tail number or callsign. Checked
  every minute while SkyWatch is open, with observed takeoff and landing times. The Patriots'
  two team-owned 767s are offered as a preset.
- **Phone layout**: on small screens the map fills the screen and the panel slides up from the
  bottom (drag or tap the handle).

## Alerts, search, settings and background checks

- **🔔 Alerts menu**: *Something's happening* lists aircraft circling one spot (police, news and
  medical helicopters usually), with an orange pulsing area on the map. *Rare planes* lists rare
  aircraft in the air near you and worldwide (Legendary / Rare / Uncommon, see `src/lib/rare.ts`),
  checked every 5 minutes through adsb.lol's `/v2/type/<code>` lookup. New finds pop up and can beep.
- **Worldwide flight search**: type a flight number (DL123), callsign (DAL123), tail number
  (N123DL), transponder code (a1b2c3) or aircraft type (A388) and tap *Search the whole world*.
- **⚙ Settings**: map style, trails, airports, callsign labels, range ring, follow the selected
  plane, ground vehicles, feet/metres, knots/mph/km/h, 24-hour clock, refresh speed, emergency banner,
  sounds, rare spotter levels, circling detector and notifications.
- **Notifications while closed**: the relay (`worker/skywatch-relay.js`) can run on a Cloudflare
  cron trigger with a KV namespace bound as `SKYWATCH`. Every few minutes it checks your team
  planes, emergencies near home and rare planes, sends Web Push notifications (it creates its own
  VAPID keys), and keeps exact team takeoff/landing times that the app pulls in when opened. On an
  iPhone, notifications only work from the Home Screen app (iOS 16.4+).

## Aircraft names and sizes

`public/aircraft-types.json` holds ~2,800 ICAO type codes with a name, ICAO class (e.g. L2J) and
wake category, built by `scripts/build-types.py` from the tar1090-db / Mictronics database. Planes
are named from it (with a hand-tuned list in `src/lib/aircraftTypes.ts` taking priority), planes
that don't broadcast a size category get one worked out from their type, and planes that send no
type code are looked up in the registry (hexdb.io) in the background.

## Insights, patterns and the flight card

- **📊 Insights**: *Records* (fastest, highest, lowest, slowest, steepest climb/descent, longest
  route, highest/fastest helicopter, fastest small plane, highest military, plus today's counts
  and most common airlines/types), *Most tracked* (the most interesting flights near you right
  now, and the planes you open most), *Disruptions* (FAA ground stops/delay programs/delays/closures
  for US airports via the relay, plus holding, go-arounds, nearby emergencies and bad weather at big
  airports in your area) and *Rare list* (every rare type ranked by tier, with what you've logged).
- **Military patterns**: tankers, surveillance aircraft and fighters looping for 12+ minutes are
  outlined on the map and listed under 🔔 (`src/lib/patterns.ts`). Airliners circling near an airport
  count as holding; a plane that drops low near a runway and climbs away is a go-around.
- **Flight card**: origin/destination with city, UTC offset and current weather (Open-Meteo), and
  departure/arrival times in each airport's local time. Scheduled times need paid airline data, so
  the card links to FlightAware for those.

## Military arrival watch

*Insights → 🎖️ Military arrivals* (or 🔔 → Military arrival watch): pick airports and get a pop-up
when a military-labelled aircraft is arriving (descending toward it within 40 nm, below 12,000 ft)
or has landed. While the app is open it checks your map traffic plus adsb.lol's worldwide `/v2/mil`
list every 2 minutes; with notifications on, the relay's 5-minute check sends a push and keeps a log
the app pulls in. Watched airports are saved to your profile.

## Profiles

*Settings → Profile*: create a profile (username + password) to keep your logbook, followed teams,
emergency history and settings on the relay's KV storage and sync them across devices. The password is
stretched on the device (PBKDF2-SHA256, 150,000 rounds) and only that result is sent; the relay
stores a salted SHA-256 of it, and locks a username for 15 minutes after 10 wrong passwords.
Removals are remembered so a sync never brings back a plane or team you deleted.

## Restricted airspace

FAA Temporary Flight Restrictions (TFRs) are outlined on the map, colored by kind: VIP/presidential
(solid red), security, hazards and wildfires, space launches, and stadiums/air shows. Tap one for the
details and a link to the FAA notice. 🔔 lists the ones near you plus any VIP movements in the US.
The shapes come from the FAA's TFR map service and list (tfr.faa.gov) through the relay, refreshed
every 15 minutes. Turn it off in *Settings → Map* or the ⋯ menu. US only.

## Antarctic research stations

47 stations across Antarctica are marked with ice-blue diamonds (filled: staffed year-round; hollow:
summer only). Tap one for who runs it, when it's staffed, how planes get in (Phoenix Airfield at
McMurdo, Wilkins blue-ice runway, Teniente Marsh on King George Island, Union Glacier and more) and a
Track planes here button. McMurdo and King George Island are in the location list. ADS-B coverage is
thin down there, so flights often drop out. The South Pole station sits at the bottom edge of the map,
since the map can't show the pole itself. Turn it off in *Settings → Map*.

## Plane profiles

Open a plane and tap **Profile**, or tap *Profile* next to any Logbook entry. It shows the
registration, owner and country, how many times you've seen and opened it, the callsigns and routes
it flew when you saw it, your last 15 sightings, today's flights, any emergencies or military
arrivals you caught it in, and links to FlightAware, Planespotters, JetPhotos and the adsb.lol replay.
Sightings are saved to your profile like the logbook.

## Behind the scenes

- **Relay lockdown**: the relay only forwards the exact API paths the app uses, allows one profile
  (set the Worker variable `ALLOW_SIGNUPS` to `1` to allow more), and limits "Run a check" to once a
  minute.
- **Fresh databases**: `.github/workflows/refresh-data.yml` rebuilds `public/airports.json`
  (OurAirports) and `public/aircraft-types.json` (tar1090-db) on the 3rd of every month and
  redeploys the site if anything changed. GitHub only runs scheduled workflows from the default
  branch. Run it any time from the Actions tab.
- **Relay auto-deploy**: `.github/workflows/relay.yml` deploys `worker/skywatch-relay.js` with
  Wrangler (`worker/wrangler.toml`) whenever it changes. It stays off until a Cloudflare API token
  (template "Edit Cloudflare Workers") is saved as the repository secret `CLOUDFLARE_API_TOKEN`.

## Filtering

- **Aircraft category** chips (multi-select, with live counts), using the ADS-B emitter category the
  aircraft broadcasts itself: Light, Small, Large, B757 (high vortex), Heavy, High performance,
  Rotorcraft, Glider, Balloon, Ultralight, Drone, Ground vehicle, Unknown
- **Who's flying** chips:
  - **Military / Gov**: air forces, navies, coast guards, customs, NASA and similar.
    Matched by the aircraft database's military flag, the US/UK military transponder address
    blocks, known callsigns (RCH, SAM, SPAR, CNV, RRR…) or the registered operator.
  - **Sports**: likely sports-team flights. Matched by team-owned jets, charter airlines that
    mostly fly teams (GlobalX, iAero) or the operator name. Many team flights go out on regular
    airline charters with ordinary callsigns, so this group misses some.
  - **Police**: police, sheriff and state patrol aircraft, tagged POLICE on the map. Matched by the
    registered owner (police department, sheriff, state patrol, public safety), NYPD/LAPD/CHP-style
    callsigns, tail numbers ending in PD (N414PD), or helicopters owned by a city or county.
  - **Medical**: air ambulances, tagged MEDICAL on the map. Matched by the owner (Air Methods, PHI,
    Air Evac, Med-Trans, Guardian Flight, Life Flight-type programs; hospitals and health systems for
    helicopters only), MEDEVAC/LIFEGUARD callsigns, or "Helimed" (HLE) for UK air ambulances.
  - **News**: TV news helicopters (and station planes), tagged NEWS on the map. Matched by the
    registered owner (TV stations, broadcasters and their parent companies like TEGNA, Nexstar,
    Sinclair, Gray, Scripps, Hearst, Fox, NBC, CBS, ABC, plus Helinet and Angel City Air, which fly
    news helicopters), a "TV" tail number (N7TV) or a NEWS/CHOPPER callsign. Helicopters the feed
    doesn't name an owner for are looked up in the public registry automatically.
  Every match shows the reason it matched on the aircraft's detail panel.
- **Fix the labels** (Owner tab): set who flies an aircraft (any mix of Military / Gov, Police,
  Medical, Sports, News), its size / kind (Light through Heavy, Helicopter, Glider, Balloon, Drone,
  Ground…) and its exact type (search the full ICAO type list, e.g. "747" or "Black Hawk"). Your
  choices beat SkyWatch's guesses everywhere (map, filters, rare spotter, records) and sync to your
  profile.
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
