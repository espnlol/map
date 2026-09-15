# StrainGuide — Strain & Terpene Explorer

A Leafly-style strain explorer: search and filter cannabis strains by
lineage, effects, or flavor; open a strain to see a full breakdown —
effects, flavor/aroma, dominant terpenes (with their own deep-dive:
aroma, commonly-reported effects, approximate boiling point, and what
else they're found in), what people commonly report using it for, and
related strains. A dedicated Terpenes tab covers the same compounds in
more depth, cross-linked back to which strains are commonly high in each
one.

> **This is reference content, not live or lab data.** Every strain's
> effects/flavors/dominant terpenes/"helps with" tags are the kind of
> commonly-reported, industry-general information you'd see on a seed
> bank listing or dispensary placard for that genetic — not a lab assay
> of any specific product, and not scraped from Leafly or any other
> commercial platform. "Leafly-style" here means the search-and-browse
> *pattern* (search by name/effect/flavor, dropdown detail sections,
> related strains), built with this app's own hand-written data.
> Genetic parentage mentioned in a strain's description is noted as
> "commonly cited" where the actual cross is disputed or was never
> formally documented, rather than stated as settled fact.

## Features

- **Search** strains by name, effect ("relaxed"), or flavor ("citrus").
- **Filter by lineage** — Indica / Sativa / Hybrid, multi-select.
- **Strain detail view** with collapsible dropdown sections: Effects,
  Flavor & aroma, Terpene breakdown, and Commonly reported to help with
  (clearly labeled as user-reported, not medical advice).
- **Terpene breakdown, in depth** — each dominant terpene on a strain's
  page shows its aroma, a top effect, and links to a full entry with a
  longer description, every commonly-reported effect, an approximate
  boiling point, other foods/plants it's found in, and which other
  strains are commonly high in it.
- **Related strains** — a similarity score based on shared lineage,
  effects, flavors, and dominant terpenes (see `utils/related.ts`).
  Explicitly not a claim about real genetic relation.
- **Terpenes tab** — browse all 8 terpenes covered, cross-linked back to
  Strains in both directions (click a strain from a terpene's page,
  click a terpene from a strain's page).

## Stack

React 18 + TypeScript + Vite + Tailwind CSS. No backend, no database, no
persisted state at all — every screen just reads the static reference
data in `src/data/`. `npm run build` outputs a fully static `dist/`.

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
  types.ts                     # Strain / Terpene / StrainLineage
  data/
    strains.ts                  # 28 real strain genetics: lineage,
                                  # effects, flavors, dominant terpenes,
                                  # "helps with" tags, a description
    terpenes.ts                  # 8 terpenes: aroma, effects, boiling
                                  # point, also-found-in, a description
    index.ts                     # exports + id-keyed lookup maps
  utils/
    related.ts                   # relatedStrains() similarity scoring
  components/
    ui.tsx                       # Card/Chip/GhostButton/EmptyState +
                                  # Dropdown (native <details>-based)
    strains/
      StrainDetail.tsx            # the detail view + its dropdowns
      lineageStyle.ts              # shared indica/sativa/hybrid badge colors
  pages/
    StrainsPage.tsx               # search + lineage filter + grid,
                                    # or a selected strain's detail
    TerpenesPage.tsx              # the 8 terpenes, each expandable
  App.tsx                        # 2-tab shell (Strains, Terpenes) +
                                   # the cross-tab "jump to X" plumbing
```

There's no client-side router — `App.tsx` holds `activeTab` plus a
one-shot `focusStrainId`/`focusTerpeneId` used only when a cross-link
(a terpene tag on a strain's page, or a strain chip on a terpene's page)
asks to jump to a specific entry on the other tab. A plain nav-button
click clears both, so it never "sticks" on an old jump target.

## The data

Both `src/data/strains.ts` and `src/data/terpenes.ts` are hand-written
reference content, not pulled from any API or site. A few honesty notes,
consistent with how the rest of this project has handled unverified data:

- **Dominant terpenes per strain** reflect what's commonly and widely
  cited for that genetic (e.g. Blue Dream as myrcene-dominant), not a
  lab COA for a specific batch.
- **"Commonly reported to help with"** tags are shown with an explicit
  disclaimer in the UI — user-reported association, not medical advice.
- **Terpene boiling points** are labeled approximate, since published
  vaporization guides vary by a few degrees depending on source and
  measurement method.
- **Strain parentage** mentioned in descriptions is hedged ("commonly
  cited as...") wherever a strain's actual genetic cross is disputed or
  was never formally disclosed by its breeder — which is true for a
  surprising number of famous strains, OG Kush chief among them.

## Deploying

Fully static — `npm run build` outputs `dist/`, and that's the whole
deployable artifact. Any static host works: [Vercel](https://vercel.com),
Netlify, Cloudflare Pages, GitHub Pages. No environment variables, no
database.

## Known dev-only advisory

`npm audit` flags advisories in `esbuild`/`vite` (dev server only — they
let a malicious page make requests to, or reach paths outside, the local
dev server while `npm run dev` is running). They don't affect `npm run
build` output. Fixing them requires a Vite 8 major upgrade; left as-is
here to avoid an unvetted breaking change.
