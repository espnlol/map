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
