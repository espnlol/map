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
- **Multi-dispensary search:** check off any combination of locations in
  the dispensary picker; the menu merges their catalogs.
- **Strain search** — search strains by name, by effect ("relaxed",
  "energetic"), or by flavor ("citrus", "berry"), the way a strain
  explorer like Leafly's works, not just a plain name filter. Each result
  shows its lineage (indica/sativa/hybrid) and top effects/flavors right
  in the list. See [Strain search & terpene guide](#strain-search--terpene-guide).
- **Terpene guide** — a "What do terpenes do & taste like?" dropdown next
  to the terpene% filter explaining the aroma, commonly-reported effects,
  and everyday sources (e.g. myrcene → earthy/mango, often linked to
  relaxation) of the terpenes found across cannabis.
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
- **Progressive filter disclosure:** strain, brand, THC%, and terpene%
  filters stay locked (with an explanation) until you've checked 5 or
  fewer dispensaries in the picker — exactly as requested, so you narrow
  by location first and only then see the finer-grained controls.
- **Manage tab — add your own dispensaries and menus.** A real in-app
  form (not a scraper, not fabricated data) lets you add a dispensary —
  pick its exact location by clicking/dragging a pin on a map, plus
  name/address/phone/hours/website/license — and build a real menu for
  it, product by product, using the same category/size/THC%/terpene%
  fields as the demo catalog. Saved to **this browser only**
  (`localStorage`, via the Zustand store — see below), and merged into
  every other feature automatically: it shows up in the dispensary
  picker/search/filters, in the Menu tab once selected, and can be
  favorited. See
  [Adding your own dispensaries](#adding-your-own-dispensaries-manage-tab)
  below.

## Stack

React 18 + TypeScript + Vite, Tailwind CSS, Zustand (state +
`localStorage` persistence for favorites/selection). The app is a plain
static SPA — no backend, no serverless functions, nothing to deploy but
`dist/`. Leaflet is still a dependency, but only for the small
click-to-place location picker in the Manage tab's "add a dispensary"
form (see below) — there's no dispensary map or Leaflet.Draw anymore
(see [Removed: the dispensary map](#removed-the-dispensary-map)).

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
    brands.ts / strains.ts # reference data — strains include effects/flavors
    terpenes.ts             # terpene reference data (aroma/effects/sources)
    generateProducts.ts    # deterministic (seeded) catalog generator
    index.ts                # <- swap this module out for real API calls
  store/
    useAppStore.ts            # Zustand store: filters, selection, favorites,
                                # AND userDispensaries/userProducts (Manage tab)
    useCombinedData.ts         # merges the static catalog + userDispensaries/
                                # userProducts — every screen reads through
                                # this instead of importing ../data directly,
                                # so anything added via Manage shows up
                                # everywhere the demo catalog already does
  utils/
    filters.ts               # scoping/filtering/sorting, the unlock rule
  components/
    map/LocationPickerMap.tsx # the only map left — minimal single-marker
                               # click/drag map used by the "add a
                               # dispensary" form to set real coordinates
    filters/
      DispensaryPicker.tsx    # search + checkbox list — the "which
                                # locations" scope control (no map)
      FilterPanel.tsx          # product filters + the gated strain/brand/
                                # potency card (strain search, terpene guide)
    products/                # ProductCard / ProductGrid
    manage/
      DispensaryForm.tsx      # add/edit a dispensary (incl. LocationPickerMap)
      ProductForm.tsx         # add/edit a menu item, category-aware sizing
  pages/
    MenuPage.tsx               # DispensaryPicker + FilterPanel + results grid
    FavoritesPage.tsx
    ManagePage.tsx             # add/edit your own dispensaries + their menus
```

The dispensary "in scope" for the menu is whatever's checked in the
`DispensaryPicker` list — with nothing checked, every known dispensary is
in scope. Once that scoped count is between 1 and
`DETAIL_UNLOCK_THRESHOLD` (5), `detailFiltersUnlocked()` (in
`utils/filters.ts`) flips on the strain/brand/THC%/terpene% controls in
`FilterPanel`. `activeTab` lives in the Zustand store (not component
state), and the whole Menu tab is always live — there's no separate
"confirm your search" gate to click through first.

## Removed: the dispensary map

Earlier versions of this app had a **Map** tab (Leaflet + OpenStreetMap
pins, a radius/circle search, and a custom polygon/rectangle draw tool
for "not just a circle" area search). That's been removed entirely, along
with the `/api/menu` serverless endpoint that existed solely to feed its
popup. Multi-location search still works exactly as before — it's a
checkbox list (`DispensaryPicker`) instead of pins on a map — but
"search a geographic area" and "sort/filter by distance" are gone with
it; there's currently no replacement for those two specifically. The
Manage tab's "add a dispensary" form still shows a small map
(`LocationPickerMap.tsx`) purely to let you click/drag a pin to set a new
dispensary's real coordinates — that's unrelated to the removed feature.

## Strain search & terpene guide

Both are **general reference info, not live or per-product lab data**,
and neither is pulled from Leafly or any other commercial platform —
"using Leafly's system" here means the search *pattern* (search by name,
effect, or flavor; see tagged results) rather than any of Leafly's actual
data or code.

- **Strain effects/flavors** (`src/data/strains.ts`) are the
  commonly-reported characteristics for each real strain genetic — the
  kind of thing you'd see on a seed bank listing or dispensary placard —
  not a lab assay of any specific product on the menu. `Product.strainId`
  links a menu item to one of these; the strain's own effects/flavors are
  what the search matches against and what a result tag shows.
- **The terpene guide** (`src/data/terpenes.ts`) is general, widely-known
  aromatic-chemistry background (aroma, commonly-reported effects, other
  foods/plants that share the compound) for the terpenes most often
  discussed in cannabis. Products only carry a single overall
  `terpenePercent` number, not a breakdown by compound, so the guide is
  shown as a dropdown next to the terpene% filter rather than attached to
  individual products — there's no per-product terpene-type data in this
  app to attach it to.

## Adding your own dispensaries (Manage tab)

The **Manage** tab is a real, working "add your own data" flow — for
when you want to track a specific dispensary (yours, or one you
actually shop at) with its real menu, without waiting on an import
script or public dataset to cover it.

- **Add a dispensary**: name, address/city/state/zip, phone, hours,
  website, license number, and an exact location picked by clicking (or
  dragging the marker) on an embedded map — not a geocoded guess.
- **Build its menu**: add products one at a time with the same
  category/subtype/size/price/THC%/terpene% fields the demo catalog
  uses (including the exact cartridge/rosin/flower unit sizes from the
  feature checklist above), plus a free-text brand name and an optional
  strain.
- **Saved to this browser only.** There's no server-side database here
  — it's `localStorage`, via `userDispensaries`/`userProducts` in
  `useAppStore.ts` (persisted the same way favorites already are). It
  won't sync across devices or be visible to anyone else, and clearing
  your browser's site data clears it too.
- **Fully merged, not a separate silo.** Everything added here flows
  through `useCombinedData.ts`, so it appears in the dispensary
  picker/search/sort, counts toward the progressive-filter unlock, is
  selectable/favoritable, and shows up in the Menu tab's filters and
  results exactly like the built-in catalog. Adding a product priced
  outside the current price-filter range automatically widens that
  filter so it isn't silently hidden.

This is the honest way to add real data without scraping: you're
typing in what you actually know, not this app inventing it or pulling
it from a site that prohibits automated access.

## Bringing in a different region (e.g. statewide data)

The dispensary picker and every filter just read whatever's in
`src/data/dispensaries.ts` — importing a different city, or an entire
state's worth of locations, is immediately visible without editing any
component code.

For Florida specifically: it's a medical-only market (Medical Marijuana Treatment Centers, regulated by the state's Office of Medical Marijuana Use), not the walk-in recreational retail model OSM contributors have mapped heavily in states like Colorado, so `shop=cannabis` coverage there may be sparse — a 0/low-result run reflects OSM mapping gaps, not reality. The state's own public MMTC locator (knowthefactsmmj.com / mmuregistry.flhealth.gov) is the authoritative source; there's no importer for it here yet since its actual data format hasn't been inspected (this repo's sandbox can't fetch external sites — see the egress notes below) — happy to build one against a real sample of its output.

**Deliberately out of scope**: pulling real product/menu/pricing data from individual dispensaries' own websites. Nearly all of them embed a third-party menu platform (Dutchie, Jane, Tymber, etc.) whose terms of service prohibit scraping, inventory changes constantly (this would mean running an ongoing scraper against dozens of separate companies, not a one-time import), and it isn't technically possible from this sandbox anyway (its network egress is fully blocked — see below). Product data stays the synthetic demo catalog regardless of which dispensaries are loaded.

## Importing real dispensary listings

`scripts/import-osm-dispensaries.mjs` is a standalone, dependency-free Node
script you run **on your own machine** (this repo may have been assembled
in a sandbox with no general internet access, so it can't be run from
there) to replace the demo dispensaries with real ones from
[OpenStreetMap](https://www.openstreetmap.org) — the same free, keyless,
open (ODbL-licensed) map data the Manage tab's location picker renders
on. There's no public API for pulling real Google Maps/Apple
Maps/Leafly/Weedmaps listings without a paid developer key (Google/Apple)
or violating a site's terms of service (Leafly/Weedmaps explicitly
prohibit scraping), so OSM is the legitimate free option.

```bash
npm run import:osm -- "Denver, CO"
# or an explicit bounding box:
npm run import:osm -- --bbox 39.55,-105.3,39.9,-104.6
# or a point + radius (meters, default 10000 = 10km):
npm run import:osm -- --near 26.6771,-80.0370 --radius 10000
# options: --limit N (default 40), --out path, --overpass-url <mirror>
```

This overwrites `src/data/dispensaries.ts` with real names, addresses, and
coordinates (git-tracked, so `git checkout -- src/data/dispensaries.ts`
reverts it). A few things it deliberately does **not** do:

- **It does not invent a menu.** The product catalog
  (`src/data/generateProducts.ts`) is still 100% synthetic no matter which
  dispensary it's attached to — real business name or not, don't present
  its prices/THC%/strains/stock as anyone's actual live inventory. The app
  flags any OpenStreetMap-sourced listing in the dispensary picker as a
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
- **Live sync** would need a real backend with a database (inventory
  changes constantly) — there's no server component in this app at all
  right now to build that into; it'd be a new piece.
- **Real strain effects/flavors and terpene data** — `src/data/strains.ts`
  and `src/data/terpenes.ts` are general reference info written by hand,
  not sourced from a licensed database; a production app would want a
  proper data source (or a licensing deal) for anything presented as
  authoritative.
- **Compliance** — a real cannabis-menu app needs state licensing checks,
  an age gate (21+/medical card), and per-state product/potency
  regulations, none of which are in scope for this demo.

## Deploying

This is a 100% static site now — `npm run build` outputs `dist/`, and
that's the entire deployable artifact. No serverless functions, no
database, no environment variables to provision. Any static host works:
[Vercel](https://vercel.com), Netlify, Cloudflare Pages, GitHub Pages —
import the repo, build command `npm run build`, output directory `dist`.

## Known dev-only advisory

`npm audit` flags advisories in `esbuild`/`vite` (dev server only — they
let a malicious page make requests to, or reach paths outside, the local
dev server while `npm run dev` is running). They don't affect `npm run
build` output. Fixing them requires a Vite 8 major upgrade; left as-is
here to avoid an unvetted breaking change, but worth doing before
real-world use.
