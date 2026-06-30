# LightBlok — get the most out of Storyblok

> **Storyblok × AWS Hackathon 2026 · Team TomTom**

**LightBlok is a Lighthouse-style audit for a Storyblok space, plus AI autofixes.** It scores
how much of Storyblok's component-UX you actually use — the icons, colors, preview images,
presets and SEO that teams skip under deadline — and then fixes the gaps live.

The loop is the whole product:

**Detect → Suggest → Approve → Apply → Re-measure**

- **Detect** — a deterministic, reproducible audit of the space (no AI, same result every run).
- **Suggest** — AI proposes the fix as a concrete change.
- **Approve** — a human gate (governance; "apply all" is available for the demo).
- **Apply** — written back **live** through the **Storyblok MCP Server** (and a **Storyblok FlowMotion** webhook for screenshots).
- **Re-measure** — the coverage score climbs after the fixes land.

## 1. The audit dashboard (`packages/apps/astoria`)

An Astro SSR app that turns the raw space into a single, scannable view.

- **Route:** `/space-health` (the LightBlok dashboard). Loads a committed snapshot
  (`public/space-health.json`) by default, or refreshes **live** from Storyblok via
  `GET /api/space-health`.
- **Audit engine:** `src/utils/spaceHealth.ts` — deterministic. Reads every component schema
  (Management API) and walks every story's content (Delivery API) to compute usage.
- **Setup coverage** — one headline % = the mean of four categories, each grounded in real signals:

  | Category | Built from |
  | --- | --- |
  | **Schema** | per-component `icon` 🎨, `color` 🌈, preview image 📷, presets 🧩 |
  | **Content** | adoption — share of components actually used in content |
  | **SEO** | per-story meta `title` / `description` 🔍 |
  | **Hygiene** | components scoped correctly (not "allowed everywhere") + unused cleanup |

  Color-coded as opportunity (≥80 well configured · 40–79 room to grow · <40 lots of upside),
  not a pass/fail health verdict.
- **Quick-win tiles** — each gap is an actionable tile with a **Fix** button that opens the
  detect → suggest → approve → apply wizard. The **Previews** fix is live end-to-end: it calls
  a Storyblok **FlowMotion** webhook (`/api/screenshot?componentName=…`) that screenshots the
  component and writes the preview image back.
- Snapshot in this repo: **340 components, 3,712 stories** (space `178460`).

**Run it:**

```bash
cd packages/apps/astoria
pnpm install
pnpm dev            # http://localhost:3000/space-health  (static snapshot, no token needed)
# live mode + autofix need: PUBLIC_STORYBLOK_ACCESS_TOKEN, SPACE_HEALTH_TOKEN, SPACE_HEALTH_SPACE_ID
# screenshot webhook is overridable via SCREENSHOT_WEBHOOK_URL
```

Deploys to **Netlify** out of the box (`netlify.toml`); the Astro adapter is env-conditional
(`DEPLOY_TARGET=netlify` → serverless, otherwise the standalone Node server for local/Docker).

## 2. The autofixes (Claude Code skills, write back via the Storyblok MCP Server)

The **Apply** step lives as three Claude Code skills under `.claude/skills/` that write to the
space through the official **Storyblok MCP Server** (`mcp__storyblok__execute*`, `upload_asset`).
This is the **MCP Innovation** angle: a developer tool built on the Storyblok MCP Server that
turns audit findings into live config changes. Three live recordings are in
`packages/apps/astoria/public/` (`component-{screenshots,icons,colors}-skill.mp4`).

## Judging & prizes

- **MCP Innovation** — autofixes apply live via the Storyblok MCP Server `execute` tools.
- **FlowMotion** — the component-screenshot autofix runs as a Storyblok FlowMotion workflow,
  triggered from the dashboard. Workflows:
  - Screenshot a single component (**working**, wired into the dashboard's Previews fix) — <https://c3rvcnlibg9rlwvsaxrllxbyzc1ldwmx.flowmotion.storyblok.com/workflow/N9JbB0HISbQHf5Be>
  - Screenshot all components (**in progress**) — <https://c3rvcnlibg9rlwvsaxrllxbyzc1ldwmx.flowmotion.storyblok.com/workflow/l20unY3t7s_WsFnMy_Coc>

  The dashboard calls the single-component workflow's production webhook
  (`/webhook/screenshot-single-component`, overridable via `SCREENSHOT_WEBHOOK_URL`).
- Maps to all four criteria: deterministic audit + AI fixes (**Innovation**), live MCP/FlowMotion
  write-back + headless screenshots (**Execution**), built natively on Storyblok APIs/MCP/FlowMotion
  (**Use of Storyblok**), one-click quick-win tiles (**Ease of Use**).

## Repo layout

| Path | What |
| --- | --- |
| `packages/apps/astoria/` | the LightBlok dashboard + deterministic audit engine |
| `packages/apps/astoria/src/utils/spaceHealth.ts` | the audit (detect) engine |
| `packages/apps/astoria/src/pages/space-health.astro` | the dashboard UI |
| `packages/apps/astoria/src/pages/api/` | `space-health` (live audit) + `screenshot` (FlowMotion proxy) |
| `.claude/skills/component-*` | the apply skills (icons / colors / screenshots) |

---

## Component-library skills

Three sibling skills set the three independent fields on a Storyblok component (space `293515734262231`, region `eu`). All are keyed off the **blok technical name** — PascalCase, matching the `data-component-name` attribute on the rendered page (e.g. `HeroSlider`, `FaqList`, `Article`).

| Skill                                       | Sets                          | Decided by                                  |
| ------------------------------------------- | ----------------------------- | ------------------------------------------- |
| [`component-icons`](#component-icons)       | `icon` — the Block-icon glyph | what the blok *is* (name + space precedent) |
| [`component-colors`](#component-colors)     | `color` — the Block-icon tint | which app(s) place the blok                 |
| [`component-screenshots`](#component-screenshots) | `image` — the Preview screenshot | a live screenshot you pick from a gallery   |

A single component (e.g. `Article`) can carry all three at once. Each skill writes only its own field and leaves the others untouched.

## Prerequisites — MCP servers & credentials

These skills drive external services through MCP; none ship a bundled key. Each person running them configures the access locally — **nothing here is auto-installed and no credential lives in the repo.** Set these up once before invoking any skill:

| Dependency        | Used by                  | Credential you must provide                                                                                   | How to configure                                                                                       |
| ----------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **Storyblok MCP** | all three                | A **Storyblok personal access token** (Management API) reaching space `293515734262231` (region `eu`) — needs read, component **write**, and **asset upload** | `claude mcp add …` — see below                                                                         |
| **GitHub**        | `component-colors` only  | Read access to the **private** repo `tomtom-internal/drumkit-monorepo`                                        | The connected **claude.ai GitHub** MCP (authorize the `tomtom-internal` org via SAML SSO) **or** `gh auth login` |
| **Playwright MCP**| `component-screenshots` only | none (local browser)                                                                                     | `claude mcp add playwright npx @playwright/mcp@latest` — must be **headed** so you can click the gallery |

`component-screenshots` also uploads the captured PNG to Storyblok via a **pre-signed S3 URL** that the Storyblok `upload_asset` call returns — that needs no separate key beyond the Storyblok token above. No Algolia, TomTom Maps, or other credentials are used by these three skills.

### Storyblok MCP (required by every skill)

The skills call `mcp__storyblok__*` (`execute_readonly`, `execute_mutating`, `upload_asset`, `upload_asset_finish`, `search`, `describe`) — the official Storyblok Management MCP. It is **not** declared in this repo and is **not** auto-installed. Add it yourself, named **exactly `storyblok`** (lowercase) so the `mcp__storyblok__…` tool ids the skills use resolve:

```bash
claude mcp add --transport http storyblok https://mcp.labs.storyblok.com/mcp \
  --header "Authorization: Bearer <YOUR_STORYBLOK_PERSONAL_ACCESS_TOKEN>"
```

- Get the token from Storyblok → **My account → Personal access tokens** (or a space-scoped Management API token). It must reach space `293515734262231` and be allowed to **write components** and **upload assets** — read-only is not enough for `component-icons`/`-colors` (they call `updateComponent`) or `component-screenshots` (it uploads an asset).
- Verify with `claude mcp list`: `storyblok` should report **Connected**.
- This is a **write-capable secret** — it edits live component config and uploads assets. Keep it out of the repo.

## component-icons

Pick the best **Block icon** from Storyblok's built-in (lucide-based) picker set and write it to the component's `icon` field, matched to what the blok is.

### Usage

```
/component-icons <ComponentName>
```

`ComponentName` is the **Storyblok blok technical name** (PascalCase, e.g. `FaqList`, `NewsletterForm`, `ConsumerProduct`). You may also name an explicit icon (`/component-icons FaqList list-todo`) to skip matching and write it directly.

### What it does

1. Resolves the component to its numeric `id` (and reads its current `icon`)
2. Loads every component's icon from the space to learn its conventions (the `*Form` → envelope, `Consumer*` → cart, `Comparison*` → table precedents)
3. Matches the component to the best-fitting icon — precedent first (family/sibling inheritance, type conventions), semantics as fallback
4. Proposes the top pick plus one or two alternatives with reasons, and writes the chosen `icon` once you confirm

### Notes

- **Pick-from-set only** — the picker offers a fixed grid (~39 lucide icons); there's no custom upload. The API silently accepts any string but renders unknown names blank, so only ids from the palette are written. For a *custom* image, use `component-screenshots` (the Preview-screenshot field).
- Writes the new lucide ids (`mail`, `shopping-cart`, …) and treats the legacy `block-*` names stored on older components (`block-email`, `block-cart`, …) as read-only aliases of the same glyph.

### Example

```
/component-icons FaqList
/component-icons NewsletterForm
/component-icons ConsumerProduct mail
```

### Requirements

- Storyblok MCP connected (space `293515734262231`, region `eu`)

## component-colors

Work out which TomTom app(s) place a blok, then set the component's **Block-icon color** to the matching GitHub label color.

### Usage

```
/component-colors <ComponentName>
```

`ComponentName` is the **Storyblok blok technical name** (PascalCase, e.g. `HeroSlider`, `FaqList`, `ConsumerProduct`).

### What it does

1. Resolves the component to its numeric `id` (and reads its current `color`)
2. Finds every story that places the blok and classifies each by the first segment of its slug — `b2b/` = Kenai, `b2c/` = GoldNext, `_components/` = shared
3. Decides the matching GitHub label (the color rule below)
4. Fetches that label's live hex color from `tomtom-internal/drumkit-monorepo`
5. Writes it (`#`-prefixed) to the component's `color` field

### The color rule

| Where the blok is used                           | GitHub label | Color (ref) |
| ------------------------------------------------- | ------------ | ----------- |
| **Both** Kenai (`b2b/`) **and** GoldNext (`b2c/`) | `basedrum`   | `#C20B83`   |
| **Shared** folder only (`_components/`)           | `basedrum`   | `#C20B83`   |
| **GoldNext only** (`b2c/`)                        | `goldnext`   | `#EFBF04`   |
| **Kenai only** (`b2b/`)                           | `kenai`      | `#b4d455`   |
| **Nowhere** (0 stories)                           | —            | report as unused, don't set |

Colors are fetched live, so the skill tracks the labels page; the hexes above are reference values at creation time.

### Example

```
/component-colors FaqList
/component-colors ConsumerProduct
/component-colors HeroSlider
```

### Requirements

- Storyblok MCP connected (space `293515734262231`, region `eu`)
- GitHub MCP connected (or `gh` CLI) — for the live label colors from `tomtom-internal/drumkit-monorepo`

## component-screenshots

Screenshot a live Storyblok component from www.tomtom.com and set it as the component's preview image in the Storyblok UI.

### Usage

```
/component-screenshots <ComponentName>
```

`ComponentName` is the **Storyblok blok technical name** — PascalCase, matching the `data-component-name` attribute on the rendered element (e.g. `HeroSlider`, `FaqList`, `ResponsiveVisual`).

### What it does

1. Queries Storyblok for published pages that use the blok
2. Navigates to up to 5 of those pages and captures a clean element screenshot from each
3. Opens an interactive gallery in the browser — click the instance you like best, then click **Save this one**
4. Uploads the chosen screenshot as the component's **Preview screenshot** in Storyblok (`image` field)

### Example

```
/component-screenshots HeroSlider
/component-screenshots FaqList
/component-screenshots ResponsiveVisual
```

### Output

The final screenshot is saved to `.playwright-mcp/<ComponentName>.png` (gitignored scratch directory).

### Requirements

- Storyblok MCP connected (space `293515734262231`, region `eu`)
- Playwright MCP available (headed browser — the gallery must be visible to click)
