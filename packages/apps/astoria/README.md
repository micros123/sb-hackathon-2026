# Astoria

A simple Astro SSR app that visualises the Storyblok hackathon-space content with
the TomTom design system. It renders both **b2b** and **b2c** pages. Forms are
cosmetic (they do not submit).

## Routing

All pages live under the `b2b/` and `b2c/` folders in Storyblok, but those
prefixes stay invisible in the app URLs (like the kenai app strips its `b2b/`
prefix):

- `/` renders the b2b home (story slug `b2b`).
- `/navigation` renders the b2c navigation root (`b2c/navigation`).
- Any other path is resolved by trying `b2b/<path>` first, then `b2c/<path>`;
  the first story that exists wins (`src/utils/storyblok.ts` → `resolveStory`).
- `/overview` lists every b2b and b2c story for quick navigation.
- Add `?inspect` to any page to outline the bloks rendered by the generic
  fallback and reveal their component names.

The prefixless space root holds only `_components`, so it is never served.

## Components

The b2b homepage bloks have hand-built Astro + Tailwind components that
approximate the live tomtom.com layout (`src/components/storyblok/`):
`HomePageOverlay`, `Article`, `ArticleGroup`, `TaglineWithCards`, `TripleBlocks`,
`CardsSet`, `VisualsReel`, `DividerLine`. Every other Storyblok component falls
back to `Blok.astro`, a generic recursive renderer that classifies fields
(rich text, assets, links, headings, body) and renders nested bloks. Add new
components by creating an Astro file here and registering it in
`astro.config.mjs`.

Content is fetched through the `@drumkit/storyblok` helpers (`getStoryblok`),
and styling comes entirely from the Basedrum Tailwind preset and fonts; there
are no brand overrides.

## Setup

Set the Storyblok content-delivery (preview) token in
`environments/.env.development`:

```
PUBLIC_STORYBLOK_ACCESS_TOKEN=<token for the space to visualise>
PUBLIC_STORYBLOK_REGION=eu
STORYBLOK_CONTENT_VERSION=draft
```

## Commands

```bash
pnpm dev          # dev server on http://localhost:3000
pnpm build:dev    # standalone SSR build (Node adapter)
pnpm preview      # serve the build locally
```
