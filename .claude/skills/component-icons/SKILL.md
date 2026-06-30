---
name: component-icons
description: >-
  Set a Storyblok component's Block icon (the `icon` field on the component, space `293515734262231`) by
  matching the component to the best-fitting icon from Storyblok's built-in picker set. Given a component
  name — the Storyblok blok technical name in PascalCase (e.g. `FaqList`, `NewsletterForm`, `ConsumerProduct`)
  — it works out what the blok *is* (from its name, plus how similarly-named components in the space are
  already iconed), matches that to an icon by meaning, and writes the icon. The picker uses lucide-style names
  (`mail`, `shopping-cart`, `briefcase`, `message-square`, …); most existing components still store the old
  `block-*` names (`block-email`, `block-cart`, …) — the skill writes the new names and treats `block-*` as
  read-only aliases. You can only pick from the built-in set — custom icon upload is not possible (a custom
  image goes in the separate Preview-screenshot field, handled by `component-screenshots`). Use whenever
  someone wants to set, choose, auto-pick, match, or suggest the Block icon / library icon of a site component
  — e.g. "set the icon for FaqList", "pick a Block icon for NewsletterForm", "icon-match ConsumerProduct",
  "what Block icon should HeroSlider use", "give the Article component an icon".
---

# Component Icons

Given a **component name**, choose the best **Block icon** from Storyblok's built-in picker set and write it to
the component's `icon` field. This is the third sibling of the component-library trio, all keyed off the same
blok name and the same space:

- **`component-colors`** sets the Block-icon **`color`** (tint), derived from which apps use the blok.
- **`component-screenshots`** sets the **`image`** (Preview screenshot), a custom uploaded PNG.
- **`component-icons`** (this skill) sets the **`icon`** (the glyph), matched to what the blok *is*.

All three are independent fields on the component object — `Article`, for instance, carries `icon`,
`color`, and `image` simultaneously.

## You can only pick from the built-in set

The Block icon is **not** an uploadable image. The picker offers a fixed grid of icons (the 39 in the palette
below); the `icon` field stores the chosen icon's **id** (a short name like `shopping-cart`, **not** a URL).
The Management API doesn't enforce an enum, so it will silently accept any string — but a name that isn't in
the set renders **blank**. Only ever write an id from the palette. If someone wants a *custom* picture on a
component, that's the **Preview screenshot** (`image` field) — point them at `component-screenshots`.

## Argument

A single argument — the **component name** (`$1` / `$ARGUMENTS`):

- It is the **Storyblok blok technical name** (PascalCase): `FaqList`, `NewsletterForm`, `ConsumerProduct`, …
  — the same value `data-component-name` carries on the rendered page and the name shown in the component
  library. Not the React/file name.
- Optionally the user may name an **explicit icon** ("set FaqList to `list-todo`"). If they do, validate it
  against the palette and skip the matching — go straight to write.

Invoke as `/component-icons <ComponentName>`, or trigger from prose like "pick an icon for FaqList". If no name
was given, ask for one. If the name doesn't resolve (step 1), say so rather than guessing.

## How the icon is matched

The icon is chosen by matching the **component's name/purpose** to the **icon's meaning**, using two signals —
precedent first, semantics as fallback:

1. **Precedent (decisive).** The space already has ~60 components iconed, which is effectively a labelled
   training set: every `*Form` uses an envelope, every `Consumer*` a cart, every `Comparison*` a table, every
   `Job*` an at-sign, articles a text/image layout, and so on. For the target, find the icon that
   similarly-named / similarly-purposed components already use and reuse it. This keeps the library
   internally consistent. Two precedent shapes:
   - **Family / sibling inheritance** — a `<Parent>Item` (or `…Group`, `…List`) inherits its parent's icon
     (`DoubleArticle` + `DoubleArticleItem` both use the same layout icon; `SocialMediaItem` → its
     `SocialMediaGroup` icon).
   - **Type convention** — the head noun/role of the name maps to an established icon (see the convention
     list in step 3).
2. **Semantics (fallback).** When there's no precedent, split the PascalCase name into words and match those
   to what an icon *depicts* — using the "good for" column of the palette. E.g. `MapHeader` → `map-pin`,
   `DeviceCompatibility` → `smartphone`.

Because the right icon is subjective, the default flow is **propose, then write on confirm** (unlike the
objective color rule, which writes immediately). Offer the top pick plus one or two alternatives, each with a
one-line reason, and write the chosen one. If the user passed an explicit icon, or says "just set it" / "don't
ask", write directly.

## The palette (39 icons — the only valid ids)

Storyblok's current picker is **lucide-based**. These are the complete set, grouped by theme. The **alias**
column is the legacy `block-*` value you'll see stored on existing components — read those as the same icon,
but **write the new id**.

| id (write this)            | looks like              | good for                                              | legacy alias        |
| -------------------------- | ----------------------- | ----------------------------------------------------- | ------------------- |
| `mail`                     | envelope                | forms, contact, newsletter, subscribe                 | `block-email`       |
| `message-square`           | speech bubble           | comments, quotes, press releases, dialog/modal        | `block-comment`     |
| `at-sign`                  | @                       | jobs, careers, handles, mentions                      | `block-@`           |
| `shopping-cart`            | cart                    | products, shop, accessories, commerce                 | `block-cart`        |
| `dollar-sign`              | $                       | pricing, money, commercial, plans                     | `block-dollar-sign` |
| `credit-card`              | card                    | payment, checkout, pricing card                       | `block-paycard`     |
| `wallet`                   | wallet                  | wallet, account, billing                              | —                   |
| `tag`                      | price tag               | tags, categories, labels, sticky bar                  | `block-tag`         |
| `image`                    | picture                 | image, video, visual, media, gallery                  | `block-image`       |
| `gallery-horizontal`       | side panels             | horizontal gallery / carousel; hero, header           | `block-text-img-c`  |
| `gallery-vertical`         | box + bottom bar        | vertical gallery / stack                              | —                   |
| `gallery-horizontal-end`   | horizontal gallery      | gallery with media at the end / image-right           | `block-text-img-r`  |
| `gallery-vertical-end`     | box + top bar           | vertical gallery, end-aligned                         | —                   |
| `file`                     | document                | document, download, article, doc                      | `block-doc`         |
| `layout-panel-left`        | panel, left section     | text+image (image left), article, sidebar layout      | `block-text-img-l`  |
| `layout-panel-top`         | panel, top section      | banner / hero over content; top-image layout          | `block-text-img-t-l`|
| `layout-list`              | bulleted list           | overview, list, table of contents                     | `block-table`       |
| `list-todo`                | checklist               | FAQ, steps, features, checklist                       | `block-text-l`      |
| `columns-2`                | two columns             | two-column / side-by-side / alternating layout        | `block-text-img-r-l`|
| `columns-3`                | three columns           | comparison table, multi-column grid                   | `block-table-2`     |
| `align-center`             | centered lines          | centered text/content                                 | `block-center-m`    |
| `align-left`               | left-aligned lines      | left-aligned text                                     | —                   |
| `align-right`              | right-aligned lines     | right-aligned text                                    | —                   |
| `between-horizontal-start` | arrow into bracket      | insert / divider / spacer between blocks              | —                   |
| `briefcase`                | briefcase               | business, careers, press overview, board              | `block-suitcase`    |
| `building-2`               | office building         | company, office, corporate                            | `block-buildin`     |
| `cuboid`                   | 3D cube                 | generic block, 3D object, tile grid                   | `block-block`       |
| `share-2`                  | share nodes             | social, share                                         | `block-share`       |
| `lock`                     | closed padlock          | secure, gated, private                                | —                   |
| `lock-open`                | open padlock            | open access, support, unlocked                        | `block-unlocked`    |
| `shield`                   | shield                  | security, protection, privacy                         | —                   |
| `shield-check`             | shield + check          | verified, trust, safety                               | —                   |
| `map-pin`                  | location pin            | map, location, place, POI                             | —                   |
| `smartphone`               | phone                   | mobile, app, device                                   | —                   |
| `monitor`                  | desktop monitor         | desktop, screen, display                              | —                   |
| `keyboard`                 | keyboard                | input, typing                                         | —                   |
| `mouse-pointer`            | cursor                  | interaction, click, CTA, switch                       | `block-arrow-pointer`|
| `scaling`                  | resize box              | resize, scale, dimensions                             | —                   |
| `sticker`                  | sticker w/ face         | badge, promo, sticker, fun                            | `block-add`         |

The legacy mappings for the **layout/text-image** family (`block-text-img-*`) are approximate — the old set
encoded specific left/right/center compositions, the new set has `layout-panel-*`, `gallery-*`, `columns-*`,
and `align-*`. For those, lean on precedent and let the user confirm.

## Workflow

**resolve component (→ id, current icon) → load palette + precedent → match → propose & confirm → write `icon`
→ report.** Constants: Storyblok **space `293515734262231`**, region **`eu`**.

### 1. Resolve the component → its numeric `id`

The write in step 5 needs the component's numeric `id`. Grab the current `icon` too (to report before/after
and to skip a no-op):

```
mcp__storyblok__execute_readonly(
  operation: 'listManagementComponents',
  parameters: { space_id: 293515734262231, search: '<ComponentName>' },
  fields: ['components.id', 'components.name', 'components.icon']
)
```

`search` is fuzzy and matches display names and prefixes, so it can return several rows (e.g. `HeroSlider`
also returns `ShowcaseOverviewHeroSlider`). **Filter for the exact `name === '<ComponentName>'`** to get the
right `id`. If there's no exact match, the name is wrong — stop and report it (optionally list the close
matches so the user can pick).

### 2. Load the palette and learn the space's precedent

Pull every component's `icon` so you can (a) see which icons are actually in use and (b) read the conventions
straight from the data rather than only from the table above:

```
mcp__storyblok__execute_readonly(
  operation: 'listManagementComponents',
  parameters: { space_id: 293515734262231, per_page: 100 },
  fields: ['components.name', 'components.icon']
)
```

Group the non-null `icon`s by value to recover the convention (translate any `block-*` to its new id via the
alias column). What this reveals today, for reference:

- `*Form`, `Newsletter*`, `*Contact*`, `multiStepForm` → **`mail`** (`block-email`)
- `Consumer*` (Product/Accessory/Feature/Specification/Variation) → **`shopping-cart`** (`block-cart`)
- `Comparison*`, `MarkdownTable`, `FeaturesGridRtf` → **`columns-3`** (`block-table-2`)
- `Job*`, `SimilarJobs` → **`at-sign`** (`block-@`)
- `Article`, `RichArticle`, `SixColumnImageArticle`, `ContentBlocksItem` → **`layout-panel-left`** (`block-text-img-l`)
- `DoubleArticle*`, `ParallaxCards`, `VisualsReel` → **`columns-2`** (`block-text-img-r-l`)
- `Pricing*`, `CommercialCard*` → **`dollar-sign`** (`block-dollar-sign`)
- `Video`, `ResponsiveVisual`, `SprinklrGallery`, `ProductPage` → **`image`** (`block-image`)
- `Press*` → **`message-square`** (`block-comment`); `PressReleasesOverview`, `Boards…` → **`briefcase`** (`block-suitcase`)
- `Header`, `Footer`, `Hero*`, `Spacer`, `MultiAccordion*` → **`gallery-horizontal`** (`block-text-img-c`)
- `Faq` → **`list-todo`** (`block-text-l`); `TableOfContents` → **`layout-list`** (`block-table`)
- `Download*` → **`file`** (`block-doc`); `SocialMediaGroup` → **`share-2`** (`block-share`)

### 3. Match the component to an icon

Work out what the blok is, then pick its icon:

1. **Explicit icon given?** Validate it's in the palette (or is a `block-*` alias → translate). Use it; skip to
   step 4's write.
2. **Family / sibling?** If the name is `<X>Item` / `<X>Group` / `<X>List` and `<X>` (or a close sibling) has an
   icon, inherit it.
3. **Type convention?** Split the PascalCase name into words and find the established convention for the head
   noun/role (the list in step 2). Use that icon.
4. **Semantic fallback.** No precedent → match the name's words to the "good for" column of the palette.

Pick a **top choice** plus **one or two alternatives** when the call is close (e.g. an FAQ list could be
`list-todo` or `file`; a hero could be `gallery-horizontal` or `image`). If the current `icon` already equals
your pick (after alias translation), note it's already correct and offer only to **modernise** a legacy value
to the new id.

### 4. Propose, then confirm

State the pick and the reasoning in one or two lines — e.g.

> `FaqList` → **`list-todo`** (checklist; matches `Faq`, which uses `block-text-l`). Alternatives: `file`,
> `layout-list`. Set it?

Write once the user confirms. Skip the confirmation only when the user passed an explicit icon or asked you to
set it without asking.

### 5. Write the component's Block icon

The Block icon is the component object's **`icon`** field. Update just that field — a partial body is accepted,
leaving `color`, `image`, `schema`, etc. untouched:

```
mcp__storyblok__execute_mutating(
  operation: 'updateComponent',
  parameters: {
    space_id: 293515734262231,
    id: <numeric id from step 1>,
    body: { component: { icon: '<new-id>' } }
  }
)
```

The request body goes **inside `parameters` under the `body` key** — `execute_mutating` only accepts
`operation` / `parameters` / `region`, so a top-level `requestBody`/`body` arg is silently dropped and the API
rejects it with *"Request body is required"*. `id` is a **path** parameter (the component's numeric id, not its
name). The response echoes the saved `component.icon` — confirm it matches what you sent.

### 6. Report

Tell the user, concisely: the chosen icon and why (e.g. *"matched `mail` — it's a contact form, like every
other `*Form`"*), the old icon → new icon (note if the old value was the legacy alias of the same glyph), and
that the Block icon was updated in Storyblok. If the name didn't resolve (step 1), report that and make no
change.

## Gotchas worth remembering

- **`icon` = the Block-icon glyph; pick-from-set only.** It stores an icon **id** (`shopping-cart`), not a URL,
  and there's no upload. A custom picture is the separate `image` / Preview-screenshot field — that's
  `component-screenshots`, not this skill.
- **Write new (lucide) ids; read `block-*` as aliases.** The current picker uses `mail`, `shopping-cart`,
  `briefcase`, `message-square`, … Existing components mostly store the old `block-email`, `block-cart`, …
  Both render, but write the new id (the picker won't highlight a legacy value as selected). `ModalDialog`
  already uses the new `message-square` — proof the new ids stick.
- **39 icons, nothing else.** The API accepts any string but renders unknown names **blank**. Only write an id
  from the palette table. If nothing fits well, say so and offer the closest two rather than inventing a name.
- **Precedent beats taste.** Match how similar components are already iconed before reaching for a "nicer"
  icon — consistency across the library is the point. Re-derive precedent live (step 2); the library evolves.
- **`*Item` inherits its parent.** Children/items usually share the parent block's icon; don't icon them
  differently without reason.
- **`search` is fuzzy.** `listManagementComponents` `search` matches display names and prefixes — always
  exact-match `name` before taking an `id`.
- **Mutating body lives inside `parameters.body`.** `execute_mutating` takes only `operation`/`parameters`/
  `region`; put `{ body: { component: { icon } } }` *inside* `parameters`. A top-level `requestBody`/`body` is
  dropped → "Request body is required".
- **Don't touch `color` or `image`.** Send only `{ component: { icon } }`; a partial body leaves the other two
  fields (owned by the sibling skills) intact.
- **Icon is subjective — propose first.** Unlike the color rule, default to confirming the pick before
  writing; only auto-write when the user named the icon or said not to ask.
