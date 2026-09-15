# LeafMap — Dispensary Price Tracker

A client-side app for tracking dispensaries you actually shop at: add one
(with its real website), log the prices you see there for the products you
care about, and favorite the ones worth remembering. Everything in it is
real data you typed in yourself — there's no demo catalog, no scraping, and
no data pulled automatically from anywhere.

## Feature checklist

- **Manage tab — add a dispensary and build its price list.** Name,
  address, phone, hours, website, license number, and an exact location
  picked by clicking/dragging a pin on a map (not a geocoded guess). Then
  add products one at a time: category (flower, cartridges, concentrates
  incl. rosin, edibles, tinctures, accessories), an optional strain tag,
  THC%/terpene%, and the sizes/prices you saw — including the exact
  cartridge (0.5g/1g/2g) and rosin (0.5g/1g/2g/3g/4g) unit sizes you'd
  expect. Edit or delete any dispensary or product later.
- **Websites tab — every dispensary's prices in one place.** The primary
  screen: search your dispensaries, and see each one's linked website
  alongside every price you've logged for it, grouped by dispensary.
- **Favorites**, persisted in the browser (`localStorage`), for products
  you want to find again fast — favorite from either the Websites tab or
  Favorites itself.
- **Everything saved to this browser only** (`localStorage`, via Zustand).
  There's no server, no account, no sync across devices — and nothing
  synced *to* anyone else either.

## Why prices are manual, not pulled from the website automatically

Nearly every dispensary's site runs a third-party menu platform (Dutchie,
Jane, Tymber, etc.) whose terms of service explicitly prohibit automated
scraping — and inventory changes constantly, so even a "just this once"
pull would go stale immediately. So "porting in a website" here means:
you link it, you look at it, you type in what you see. That's real data,
attributed to where it came from, without violating anyone's terms or
pretending to have a live feed this app doesn't have.

## Stack

React 18 + TypeScript + Vite, Tailwind CSS, Zustand (state +
`localStorage` persistence). Leaflet is a dependency purely for the
click-to-place location picker in the Manage tab's "add a dispensary"
form — there's no dispensary-wide map, just that one small picker. The
whole app is a static SPA: `npm run build` outputs `dist/` and that's the
entire deployable artifact, no backend of any kind.

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
    strains.ts               # real strain-name taxonomy, for optionally
                               # tagging a product you log (lineage only —
                               # no fabricated effects/flavor claims)
    index.ts                  # exports strains/strainById
  store/
    useAppStore.ts            # the entire app's state: favorites,
                                # activeTab, userDispensaries, userProducts,
                                # and CRUD actions for all of it — this IS
                                # the data layer, persisted to localStorage
  utils/
    pricing.ts                # representativePrice() — lowest size price
  components/
    map/LocationPickerMap.tsx # the only map in the app — minimal
                               # single-marker click/drag picker used by
                               # the "add a dispensary" form
    products/                # ProductCard / ProductGrid
    manage/
      DispensaryForm.tsx      # add/edit a dispensary (incl. LocationPickerMap)
      ProductForm.tsx         # add/edit a logged product, category-aware sizing
  pages/
    WebsitesPage.tsx           # primary tab: dispensaries + their linked
                                # website + logged prices, all in one place
    FavoritesPage.tsx
    ManagePage.tsx             # add/edit dispensaries + their price lists
```

There's no separate "demo vs. real" data distinction anymore, no merge
layer, and no product-filtering system — `userDispensaries`/`userProducts`
in the Zustand store *is* the whole dataset, and every screen reads it
directly.

## Removed since earlier versions

This app used to also have: a dispensary map (Leaflet + OpenStreetMap
pins, radius/polygon area search), a Menu tab with a full filter panel
(category/size/price/sort, a strain searcher with effect/flavor search, a
terpene reference guide), a generated demo product catalog across 10
sample dispensaries, an OpenStreetMap-based real-dispensary import script,
and a small `/api/menu` serverless endpoint. All of that has been removed
— the app is now scoped specifically to tracking your own real
dispensaries' prices, not browsing/filtering a larger catalog. If you want
any of that back, it's in this branch's git history.

## Deploying

Zero config needed — `npm run build` outputs `dist/`, and that's the whole
deployable artifact. Any static host works:
[Vercel](https://vercel.com), Netlify, Cloudflare Pages, GitHub Pages —
import the repo, build command `npm run build`, output directory `dist`.
No environment variables, no database.

## Known dev-only advisory

`npm audit` flags advisories in `esbuild`/`vite` (dev server only — they
let a malicious page make requests to, or reach paths outside, the local
dev server while `npm run dev` is running). They don't affect `npm run
build` output. Fixing them requires a Vite 8 major upgrade; left as-is
here to avoid an unvetted breaking change, but worth doing before
real-world use.
