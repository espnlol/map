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
> of any specific product. "Leafly-style" here means the search-and-browse
> *pattern* (search by name/effect/flavor, dropdown detail sections,
> related strains) — not Leafly's data or code. **213 strains** are
> covered: 28 written by hand with full research (description, dominant
> terpenes, the works), plus 185 pulled from a real open dataset — see
> [Where the 213 strains come from](#where-the-213-strains-come-from)
> below for exactly which is which and why. Genetic parentage mentioned
> in a hand-written strain's description is noted as "commonly cited"
> where the actual cross is disputed or was never formally documented,
> rather than stated as settled fact.

## Features

- **213 strains** to search and browse (see
  [Where the 213 strains come from](#where-the-213-strains-come-from)).
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
    strains.ts                  # 213 strains: 28 hand-written in full
                                  # depth, 185 imported (see below) with
                                  # everything except dominantTerpenes
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

## Where the 213 strains come from

`src/data/terpenes.ts` (all 8 entries) and the first 28 strains in
`src/data/strains.ts` are hand-written reference content — not pulled
from any API or site. The remaining 185 strains were imported from
[kushyapp/cannabis-dataset](https://github.com/kushyapp/cannabis-dataset),
a real, MIT-licensed open dataset published by Kushy (a cannabis app/API
company) — a 2017 snapshot of their own API, not a scrape of a
competitor. That distinction mattered: a search for open strain datasets
also turned up at least one GitHub repo that openly describes itself as
scraped from a commercial site, which was not used here for the same
reason this project has never scraped Weedmaps, Leafly, or any dispensary
site directly — reusing someone else's unauthorized scrape doesn't make
it authorized.

What actually happened to those 185, in order:

1. Pulled the dataset's `name`, `type` (→ lineage), `effects`, `ailment`
   (→ helpsWith), and `flavor` fields — not its free-text `description`
   field, so nothing here is copied prose from that dataset; every
   description in this app was generated fresh from the structured
   fields, or (for the original 28) written by hand.
2. Dropped rows with no real effects/flavor data (many entries in a
   community-sourced 2017 snapshot are little more than a bare name) and
   rows whose lineage wasn't a clean Indica/Sativa/Hybrid — about half
   the ~440-row file didn't clear this bar.
3. Removed side-effect tags (Dry Mouth, Paranoid, Anxious) that the
   source mixes into the same field as genuine subjective effects, to
   match this app's existing style of listing only the latter.
4. Deduplicated against the 28 hand-written strains by name.

A few honesty notes, consistent with how the rest of this project has
handled unverified data:

- **The imported 185 have no `dominantTerpenes`** — the source dataset's
  terpene field was empty for nearly every row, so rather than guess,
  the strain detail view shows an explicit "not documented" note for
  these instead of a fabricated terpene profile. Only the original 28
  have a real terpene breakdown.
- **Their descriptions are templated**, e.g. "A hybrid commonly reported
  for relaxed, happy, euphoric effects, with a citrus, sweet flavor
  profile" — directly derived from the same effects/flavor/helpsWith
  data shown elsewhere on the page, not extra research. The original 28
  have real, individually-researched paragraphs (history, genetics,
  what makes them notable).
- **"Commonly reported to help with"** tags are shown with an explicit
  disclaimer in the UI — user-reported association, not medical advice,
  for either group.
- **Terpene boiling points** are labeled approximate, since published
  vaporization guides vary by a few degrees depending on source and
  measurement method.
- **Strain parentage** mentioned in the hand-written 28's descriptions is
  hedged ("commonly cited as...") wherever a strain's actual genetic
  cross is disputed or was never formally documented — true for a
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
