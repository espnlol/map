# LeafMap — Dispensary Menu Finder

A client-side web app for browsing dispensary menus across multiple
locations at once, filtering down to exactly the product you want, and
saving favorites. Built as a from-scratch, self-hosted alternative to
Leafly/Weedmaps-style menu browsing rather than an embed of either.

> **This ships with a generated demo catalog, not live inventory.** There's
> no public API for pulling real Leafly/Weedmaps listings, so
> `src/data/` contains fictional-but-realistic dispensaries, brands, and a
> deterministically-generated product catalog. See
> [Wiring up real data](#wiring-up-real-data) below for what it'd take to
> point this at real menus.

## Feature checklist

- **Filters:** product type, brand, strain, unit size, price, dispensary
  (multi-select) — all combinable.
- **Category-correct sizing:** cartridges offer 0.5g / 1g / 2g; rosin
  offers 0.5g / 1g / 2g / 3g / 4g; other concentrates 0.5g / 1g / 2g;
  flower 1g / 3.5g / 7g / 14g / 28g.
- **Multi-dispensary search:** select any combination of locations at
  once; the menu merges their catalogs.
- **THC% / terpene% range filters**, plus a **price high→low** sort
  (and low→high, THC%, terpene%, name — since a sort dropdown makes the
  reverse direction essentially free).
- **Favorites**, persisted in the browser (`localStorage`) with a
  dedicated Favorites tab.
- **Product types:** flower, cartridges, concentrates (incl. rosin),
  edibles, tinctures, and accessories.
- **Accessories category** with grinders, lighters, dab rigs, bongs,
  nectar collectors, batteries, rolling papers, pre-rolled cones, and an
  "other" catch-all.
- **Dispensary map** (Leaflet + OpenStreetMap) with a **distance/radius**
  setting *and* a **custom-shape draw tool** (polygon/rectangle) so you're
  not limited to a circle — trace along specific roads or a neighborhood
  instead.
- **Progressive filter disclosure:** strain, brand, THC%, and terpene%
  filters stay locked (with an explanation) until you've narrowed your
  search to 5 or fewer dispensaries, exactly as requested — narrowing
  can happen either by drawing/radius-filtering the map or by checking
  dispensaries directly.

## Stack

React 18 + TypeScript + Vite, Tailwind CSS, Zustand (state +
`localStorage` persistence for favorites/selection), and Leaflet +
Leaflet.Draw for the map — no API key required since it renders on
OpenStreetMap tiles. Everything is a static SPA; there is no backend.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build       # typecheck + production build to dist/
npm run preview     # serve the production build locally
npm run typecheck
```

## Architecture

```
src/
  types.ts                 # domain types + fixed size/category enums
  data/
    dispensaries.ts        # sample locations (Denver, CO metro)
    brands.ts / strains.ts # reference data
    generateProducts.ts    # deterministic (seeded) catalog generator
    index.ts                # <- swap this module out for real API calls
  store/useAppStore.ts      # Zustand store: filters, selection, favorites
  utils/
    geo.ts                  # haversine distance + point-in-polygon
    filters.ts               # scoping/filtering/sorting, the unlock rule
  components/
    map/DispensaryMap.tsx    # imperative Leaflet wrapper (markers, radius
                              # circle, draw toolbar) — framework-agnostic
                              # Leaflet is used directly instead of
                              # react-leaflet to avoid version churn and to
                              # get first-class Leaflet.Draw support
    filters/FilterPanel.tsx  # all filter UI, including the lock/unlock state
    products/                # ProductCard / ProductGrid
  pages/
    MapPage.tsx               # search-area controls + dispensary picker + map
    MenuPage.tsx               # filters + results grid
    FavoritesPage.tsx
```

The dispensary "in scope" for the menu is computed as: the map boundary
(circle or drawn shape) narrows the field first, then explicit checkbox
picks narrow further within it. Once that scoped count is between 1 and 5,
`detailFiltersUnlocked()` (in `utils/filters.ts`) flips on the strain/
brand/THC%/terpene% controls — change `DETAIL_UNLOCK_THRESHOLD` there to
adjust the cutoff.

## Importing real dispensary listings

`scripts/import-osm-dispensaries.mjs` is a standalone, dependency-free Node
script you run **on your own machine** (this repo may have been assembled
in a sandbox with no general internet access, so it can't be run from
there) to replace the demo dispensaries with real ones from
[OpenStreetMap](https://www.openstreetmap.org) — the same free, keyless,
open (ODbL-licensed) map data this app's map already renders on. There's
no public API for pulling real Google Maps/Apple Maps/Leafly/Weedmaps
listings without a paid developer key (Google/Apple) or violating a
site's terms of service (Leafly/Weedmaps explicitly prohibit scraping),
so OSM is the legitimate free option.

```bash
npm run import:osm -- "Denver, CO"
# or an explicit bounding box:
npm run import:osm -- --bbox 39.55,-105.3,39.9,-104.6
# options: --limit N (default 40), --out path, --overpass-url <mirror>
```

This overwrites `src/data/dispensaries.ts` with real names, addresses, and
coordinates (git-tracked, so `git checkout -- src/data/dispensaries.ts`
reverts it). A few things it deliberately does **not** do:

- **It does not invent a menu.** The product catalog
  (`src/data/generateProducts.ts`) is still 100% synthetic no matter which
  dispensary it's attached to — real business name or not, don't present
  its prices/THC%/strains/stock as anyone's actual live inventory. The app
  flags any OpenStreetMap-sourced listing in the Map tab's sidebar as a
  "real location — sample menu" for exactly this reason.
- **It does not invent a star rating.** OpenStreetMap has no rating field,
  so `rating` is simply left unset for imported listings instead of made
  up — the UI hides the star display when it's absent.
- **Coverage depends on volunteer OSM mapping.** A 0-result run means
  nothing is tagged `shop=cannabis` in that area on OSM yet, not that
  there are no real dispensaries there.

The element→`Dispensary` mapping logic (`toDispensary`,
`elementsToDispensaries`) is exported and was verified against fixture
Overpass responses (missing tags, missing name, missing coordinates,
duplicate elements) without needing live network access — see them for the
exact fallback behavior before trusting the output.

## Wiring up real data

To move this from demo to production you'd primarily touch
`src/data/index.ts` and `src/data/dispensaries.ts`:

- **Menu/inventory data** — a real deployment would pull from a dispensary
  POS/menu platform's API (e.g. Dutchie, Jane/Meadow, Treez, Blaze, Leaf
  Logix) or your own backend aggregating them, rather than the local
  generator. The `Product`/`Dispensary`/`Brand`/`Strain` shapes in
  `types.ts` are designed to be an adapter target for that.
- **Live sync** would need a real backend (inventory changes constantly);
  this app currently has none by design, to stay a static, key-free demo.
- **Nicer map tiles** — swap the OpenStreetMap tile layer in
  `DispensaryMap.tsx` for Mapbox/MapTiler/Google if you have an API key;
  the rest of the map logic (markers, radius, draw tool) is
  provider-agnostic.
- **True "along roads" boundaries** — right now "not just a circle"
  is solved with a freehand polygon/rectangle draw tool (trace along the
  roads shown on the basemap yourself). A drive-time/isochrone boundary
  (e.g. via OpenRouteService or Mapbox Isochrone APIs) would need an API
  key this environment doesn't have; `BoundaryShape` in `types.ts` already
  models an arbitrary polygon, so an isochrone response could be dropped
  in as another boundary source with no changes to the filtering logic.
- **Compliance** — a real cannabis-menu app needs state licensing checks,
  an age gate (21+/medical card), and per-state product/potency
  regulations, none of which are in scope for this demo.

## Known dev-only advisory

`npm audit` flags a moderate advisory in `esbuild` (via `vite`'s dev
server only — it lets a malicious page make requests to the local dev
server while `npm run dev` is running). It doesn't affect `npm run build`
output. Fixing it requires a Vite 8 major upgrade; left as-is here to
avoid an unvetted breaking change, but worth doing before real-world use.
