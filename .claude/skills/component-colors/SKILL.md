---
name: component-colors
description: >-
  Set a Storyblok component's Block-icon color (the `color` field on the component, space `293515734262231`)
  based on which TomTom apps use it. Given a component name — the Storyblok blok technical name in PascalCase
  (e.g. `HeroSlider`, `FaqList`, `ConsumerProduct`) — it finds every story that places the blok via the
  Storyblok `contain_component` API, classifies each story by app from its slug's first segment (`b2b/` = Kenai,
  `b2c/` = GoldNext, `_components/` = shared), then picks a GitHub label color from
  `tomtom-internal/drumkit-monorepo`: used in **both** apps (or shared) → `basedrum` (#C20B83), only GoldNext →
  `goldnext` (#EFBF04), only Kenai → `kenai` (#b4d455). It fetches the live color via the GitHub MCP and writes
  it to the component. Use whenever someone wants to color-code, recolor, or set the library color of a site
  component by which app(s) use it — e.g. "color the FaqList component", "set the app color for ConsumerProduct",
  "color-code components by app", "what color should HeroSlider be".
---

# Component Colors

Given a **component name**, work out which TomTom app(s) place it (GoldNext, Kenai, or both), pick the matching
**GitHub label color** from `tomtom-internal/drumkit-monorepo`, and write that color to the component's
**Block icon** color field in Storyblok. This is the color sibling of `component-screenshots`: that skill sets a
component's preview *image*, this one sets its *color*. Both read app ownership from **content** (which stories
place the blok), not from monorepo code.

## Argument

A single argument — the **component name** (`$1` / `$ARGUMENTS`):

- It is the **Storyblok blok technical name** (PascalCase): `HeroSlider`, `FaqList`, `ConsumerProduct`, … — the
  same value `data-component-name` carries on the rendered page, and the same name shown in the Storyblok
  component library.
- It is **not** the React/file name. If the name doesn't resolve to a component (step 1) or isn't placed on any
  story (step 2), say so rather than guessing.

Invoke as `/component-colors <ComponentName>`, or trigger from prose like "color the FaqList component". If no
name was given, ask for one.

## The color rule

Determined by which app(s) place the blok (step 2), colored from the GitHub label of the same meaning (step 4):

| Where the blok is used                          | GitHub label | Color (ref) | Meaning                          |
| ----------------------------------------------- | ------------ | ----------- | -------------------------------- |
| **Both** Kenai (`b2b/`) **and** GoldNext (`b2c/`) | `basedrum`   | `#C20B83`   | shared / core storyblok component |
| **Shared** folder only (`_components/`)          | `basedrum`   | `#C20B83`   | shared component / menu           |
| **GoldNext only** (`b2c/` slugs)                 | `goldnext`   | `#EFBF04`   | GoldNext app                     |
| **Kenai only** (`b2b/` slugs)                    | `kenai`      | `#b4d455`   | tomtom.com B2B pages             |
| **Nowhere** (0 stories)                          | —            | —           | unused → report, don't set       |

Colors above are the values at skill-creation time — **fetch them live** in step 4 so the skill tracks the labels
page. `basedrum` wins whenever the blok is shared: either it appears in both apps, or it lives in the top-level
shared `_components/` folder.

## Workflow

**resolve component (→ id) → classify stories by app → decide label → fetch its color from GitHub → write the
component's `color` → report.**

Constants: Storyblok **space `293515734262231`**, region **`eu`**. GitHub repo **`tomtom-internal/drumkit-monorepo`**.

### 1. Resolve the component → its numeric `id`

The write in step 5 needs the component's numeric `id`. Look it up and grab the current color too (to report the
before/after):

```
mcp__storyblok__execute_readonly(
  operation: 'listManagementComponents',
  parameters: { space_id: 293515734262231, search: '<ComponentName>' },
  fields: ['components.id', 'components.name', 'components.color']
)
```

`search` is fuzzy and matches on display name too, so it can return several rows (e.g. `HeroSlider` also returns
`ShowcaseOverviewHeroSlider`). **Filter for the exact `name === '<ComponentName>'`** to get the right `id`. If
there's no exact match, the name is wrong — stop and report it (optionally list the close matches the search
returned so the user can pick).

### 2. Classify which apps place the blok

Find every story that uses the blok and read each story's app from its `full_slug`:

```
mcp__storyblok__execute_readonly(
  operation: 'listStories',
  parameters: {
    space_id: 293515734262231,
    contain_component: '<ComponentName>',
    story_only: true,
    per_page: 1000
  },
  fields: ['stories.full_slug']
)
```

For each `full_slug`, look only at the **first path segment**:

- `b2b/…`  → **Kenai**  (root folder "B2B – Kenai")
- `b2c/…`  → **GoldNext** (root folder "B2C – GoldNext")
- `_components/…` → **shared** (root folder "Shared components and menus")

Compute three booleans: `inKenai`, `inGoldnext`, `inShared`. Keep a small tally per app (counts make a good
report line). Notes:

- **Classify by the first segment, not by substring.** Many GoldNext stories live under
  `b2c/navigation/_components/hardware/…` — that's a *nested* `_components`, still GoldNext because it starts with
  `b2c/`. Only a `full_slug` that *begins* with `_components/` is the top-level shared folder.
- **Don't filter by `is_published`.** Placement is placement — a blok on a draft `b2c/` page still means GoldNext
  uses it. (`published: false` in MAPI just means the story has unpublished changes.)
- `per_page: 1000` returns everything in one call for any normal component. If `pagination.total > 1000`, the blok
  is ubiquitous and will already show both `b2b/` and `b2c/` on page 1 → it's `basedrum`; you don't need the rest.
  Once `inKenai && inGoldnext` are both true the answer is settled regardless of remaining pages.
- **Zero stories** → the blok isn't placed anywhere (orphaned or config-only). Report it as unused and **stop** —
  don't invent a color. (It may still exist in the library with an old color; leave it.)

### 3. Decide the label

From the booleans, in this order:

1. `inShared` **or** (`inKenai` && `inGoldnext`) → **`basedrum`**
2. else `inGoldnext` → **`goldnext`**
3. else `inKenai` → **`kenai`**
4. else → unused (handled in step 2)

### 4. Fetch the label's color from GitHub (MCP)

Pull the live hex for the chosen label so the skill stays in sync with the labels page:

```
mcp__claude_ai_GitHub__get_label(
  owner: 'tomtom-internal',
  repo:  'drumkit-monorepo',
  name:  '<basedrum|goldnext|kenai>'
)
```

The response `color` is a **6-digit hex without `#`** (e.g. `C20B83`). **Prepend `#`** before writing to Storyblok
— its `color` field expects `#`-prefixed values (existing components read like `#00b3b0`). Reference values if the
MCP is unavailable: `basedrum #C20B83`, `goldnext #EFBF04`, `kenai #b4d455`.

> The label tools are deferred — if `get_label` isn't loaded, fetch it first:
> `ToolSearch: select:mcp__claude_ai_GitHub__get_label`. As a fallback you can read it from the CLI:
> `gh label list --repo tomtom-internal/drumkit-monorepo --search <label>`.

### 5. Write the component's Block-icon color

The Storyblok "Block icon" color is the component object's **`color`** field. Update just that field (a partial
body is accepted — leave `icon`, `schema`, etc. untouched):

```
mcp__storyblok__execute_mutating(
  operation: 'updateComponent',
  parameters: {
    space_id: 293515734262231,
    id: <numeric id from step 1>,
    body: { component: { color: '#<hex>' } }
  }
)
```

The request body goes **inside `parameters` under the `body` key** — `execute_mutating` only accepts
`operation` / `parameters` / `region`, so a top-level `requestBody`/`body` arg is silently dropped and the API
rejects it with *"Request body is required"*. `id` is a **path** parameter (the component's numeric id, not its
name). The response echoes the saved `component.color` — confirm it matches what you sent; `icon`, `schema`, and
everything else come back unchanged.

### 6. Report

Tell the user, concisely:

- which apps place the blok, with counts (e.g. *"Kenai 9 · GoldNext 4 → both"*),
- the chosen label and color (e.g. *"→ `basedrum` `#C20B83`"*),
- old color → new color, and that the component's Block-icon color was updated in Storyblok.

If the blok was unused (step 2) or the name didn't resolve (step 1), report that instead and make no change.

## Gotchas worth remembering

- **`color` = the Block-icon color.** In the Storyblok component config, the color picker sits in the *Block icon*
  field; in the Management API that's the component's `color` property. Setting `color` alone recolors the chip
  even if no specific icon is chosen.
- **App ownership comes from content, not code.** Use `listStories` + `contain_component` and read the app from
  each `full_slug`'s first segment. Don't grep the monorepo — the apps are Storyblok catch-alls.
- **First segment only.** `b2c/navigation/_components/...` is GoldNext (starts with `b2c/`); only a slug that
  *starts with* `_components/` is the shared folder. Don't match `_components` as a substring.
- **`basedrum` is the "shared" color.** Both-apps or top-level-shared → `basedrum`. It maps to GoldNext+Kenai
  overlap, which is exactly what a base/core storyblok component is.
- **GoldNext, not goldstream.** The B2C root folder is literally "B2C – GoldNext" and the app label is `goldnext`
  (#EFBF04). There's a separate `goldstream` label (#fdc530) — don't use it here.
- **GitHub color has no `#`; Storyblok needs one.** `get_label` returns `EFBF04`; write `#EFBF04`.
- **`search` is fuzzy.** `listManagementComponents` `search` matches display names and prefixes — always exact-match
  the `name` before taking an `id`.
- **Don't filter by publish state** when classifying — a blok on a draft page still counts as used by that app.
- **Zero results ≠ pick a default.** No stories means unused; report and leave the color as-is.
- **Mutating body lives inside `parameters.body`.** `execute_mutating` takes only `operation`/`parameters`/`region`;
  put `{ body: { component: { color } } }` *inside* `parameters`. A top-level `requestBody`/`body` is dropped →
  "Request body is required".
