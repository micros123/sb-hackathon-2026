---
name: component-screenshots
description: >-
  Screenshot a named site component as it renders live on www.tomtom.com, and pick the best-looking instance.
  Given a component name — the `data-component-name` value, which equals the Storyblok blok technical name
  (PascalCase, e.g. `HeroSlider`, `FaqList`, `Article`) — it finds which TomTom app renders the blok, captures
  up to 5 instances from published pages (found via the Storyblok `contain_component` API), and opens an
  interactive Playwright gallery where you click the one you like; on selection it closes the browser and
  saves that screenshot. Use whenever someone names a site component and wants to see, compare, or screenshot
  how it looks on the live site — e.g. "screenshot the HeroSlider component", "grab the FaqList component",
  "show me a few Article bloks to pick from", "capture the FooterCta section from kenai".
---

# Component Screenshots

Given a **component name**, find which TomTom app renders it, resolve the `www.tomtom.com` URL(s), then
capture **up to 5 instances** of that one component on live pages, render them as an **interactive gallery**
in the Playwright browser, and let the user **click the one they like best** — on selection the browser
closes, the chosen index is read back, and that instance is saved as the canonical screenshot. The capture itself reuses the Playwright MCP browser: prepare each page once (correct
width, lazy content loaded, overlays removed), then take clean element shots.

## Argument

The skill takes a single argument — the **component name** (`$1` / `$ARGUMENTS`):

- It is the `data-component-name` value the element carries on the rendered page, which is the **Storyblok
  blok technical name** (PascalCase): `HeroSlider`, `FaqList`, `Article`, `CardsSet`, …
- It is **not** necessarily the React component or file name. Aliases exist (e.g. `ArticleItem: Article`
  maps blok `ArticleItem` → React `Article`); always key off the blok name, which is what renders as
  `data-component-name`.

Invoke as `/component-screenshots <ComponentName>`, or trigger from prose like "screenshot the FaqList
component". If the user didn't give a name, ask for one.

## Workflow

**query Storyblok for pages → resolve URLs → capture 5 instances → render an interactive gallery → user
clicks their pick → close browser → save the chosen one → upload as Storyblok component preview.**

### 1. Resolve the www.tomtom.com URL(s)

**Go straight to Storyblok — don't check the local monorepo code.** The apps are Storyblok catch-alls; the
content (not code) determines which pages render the blok. Take the **first 5** published pages in the order
the query returns them — don't curate or ask.

**App URL space** reference — each app's slug prefix maps to a www.tomtom.com path:

| App (dir)         | www.tomtom.com URL space                                              |
| ----------------- | -------------------------------------------------------------------- |
| `kenai`           | `/` and most root paths (`/products/…`, `/discover/…`) — default app |
| `goldnext`        | locale-prefixed: `/en-gb/…`, `/fr-fr/…`, `/b2c/…`                     |
| `sterling`        | `/newsroom/…`                                                        |
| `noorvik`         | `/legal/…`, `/privacy/…` (also locale-prefixed, e.g. `/en-gb/legal/…`) |
| `developer-blog`  | `/blog/…`                                                            |
| `knowledge-base`  | `/knowledgebase/…`                                                   |
| `gatedorbis`      | `/orbis-package-coverage/…`                                          |
| `tvmap`           | `/tvmap/…`                                                           |
| `openlr`          | separate subdomain, **not** under a `www.tomtom.com` path            |

If unsure or the table looks stale, confirm against `.kaap/helm/gateway.yaml` and the app's `next.config.mjs`.

**Query Storyblok for pages that use the blok.** Use the **Storyblok MCP** `listStories` operation
(space `293515734262231`, region `eu`):

```
mcp__storyblok__execute_readonly(
  operation: 'listStories',
  parameters: {
    space_id: 293515734262231,
    contain_component: '<ComponentName>',
    story_only: true,
    per_page: 25,
    sort_by: 'published_at:desc'
  },
  fields: ['stories.full_slug', 'stories.name', 'stories.published']
)
```

**Do not filter by `is_published`.** Stories with `published: false` in MAPI simply have unpublished
changes — they still have a live published version accessible on www.tomtom.com.

**Use only `en_gb` pages.** After fetching results, discard any slug whose second segment (after `b2b/`
or `b2c/`) is a locale or language code — e.g. `b2b/zh/…`, `b2b/ja/…`, `b2b/ko/…`, `b2c/ar/…`. Keep only
plain English slugs (no locale subfolder). Request `per_page: 25` so you have enough after filtering.

Map a kept `full_slug` to its www URL:
- `b2b/<path>` → **kenai** at root: `https://www.tomtom.com/<path>` (strip `b2b/` — e.g. `b2b/solutions/ai-at-tomtom` → `/solutions/ai-at-tomtom`).
- `b2c/<path>` → **goldnext** with `en_gb` prefix: `https://www.tomtom.com/en_gb/<path>` (strip `b2c/`, add `/en_gb/` — e.g. `b2c/navigation/promo/go-camper-max` → `/en_gb/navigation/promo/go-camper-max`). Goldnext redirects to the locale prefix anyway; hitting it directly avoids the redirect.
- Stories carry no real-path override, so the URL comes purely from the full_slug via app routing.

**Take the first 5 English results in order — don't curate.** Take the first 5 after locale filtering,
one instance per page; don't hand-pick for variety and don't ask the user to choose. Each page's app comes
from its slug prefix (`b2b/*` → kenai, `b2c/*` → goldnext). If the homepage `/` is among them, **skip it**
(its custom scroll container breaks capture — see step 2) and take the next result instead. If fewer than 5
pages use the blok, step 2 tops up from multiple instances on the pages you have.

**Zero results → blok is truly unused.** If the query returns no stories at all, the blok isn't placed
anywhere in this space (orphaned component, or config-only — e.g. goldnext `BannerSpecs` banners that map
a banner to a path; an unreferenced one renders nowhere). Report it and stop. It may still be viewable in
**Storybook** — offer that, but the live-www capture can't be done.

**Ask the user** only as a last resort — when the query returns zero results and you've confirmed the
component name. Ask which page(s) under the app's URL space show the component, then build
`https://www.tomtom.com<prefix>/<slug>`.

> **www = published content only.** A component that lives solely on draft/unpublished pages won't appear on
> www.tomtom.com. If you can't find it live, that's a likely reason — say so.

### 2. Capture up to 5 instances

Goal: collect **up to 5** clean screenshots of the component to compare. Uses the **Playwright MCP** browser
tools. If they aren't loaded (often deferred), fetch their schemas first:

```
ToolSearch: select:mcp__playwright__browser_navigate,mcp__playwright__browser_resize,mcp__playwright__browser_evaluate,mcp__playwright__browser_take_screenshot
```

**Gather strategy — the first 5 pages in order, then top up within a page:**

1. Start from the first 5 pages (step 1), in the order the query returned them. Keep a running counter `NN`
   starting at `00`.
2. For each candidate page, in turn:
   - `browser_navigate('https://www.tomtom.com/<path>')`
   - `browser_resize(width=960, height=1080)` — 960px is a good content width; height generous so more renders
     per scroll. Use a different width if the user asks (mobile 390, desktop 1280).
   - Run the **prepare** evaluate below (it sets `WANTED`, dismisses overlays, warms lazy content, and tags
     each matching instance with `data-shot-index`). `browser_evaluate` takes no parameters, so **write the
     component name into `WANTED`** before running.
   - **Check `windowScrolls`.** If `false`, this page uses a custom scroll container (the homepage) and shots
     come back blank — skip it and move to the next candidate.
   - If `instances` is empty, the slug/name is off for this page — run the names-dump diagnostic (below) and
     move on.
   - Capture the page's **first** instance to a numbered file:
     ```
     browser_take_screenshot(target='[data-shot-index="0"]', filename='.playwright-mcp/<ComponentName>-<NN>.png', type='png')
     ```
     then increment `NN`.
3. **Stop at 5.** If you've gone through every candidate page and have fewer than 5, top up: revisit pages
   that reported more than one instance and capture their further instances (`data-shot-index="1"`, `"2"`, …)
   into the next numbered files until you reach 5 or run dry. Re-run the prepare step after each navigation
   before capturing (tags live on the DOM and are lost on reload).
4. **Only one instance exists anywhere?** Then there's nothing to compare — capture it as
   `<ComponentName>-00.png`, skip the gallery (step 5), and save it directly (step 6). Say so to the user.

**Prepare evaluate** — read the skill's `scripts/prepare.js`, set `WANTED = ['<ComponentName>']` near the top
of the function, and paste the whole function into `browser_evaluate`. It dismisses cookie/feedback/sticky-nav
overlays, warms lazy content by scrolling, tags each matching instance with `data-shot-index`, and returns
`{ windowScrolls, instances: [{ i, name, w, h }] }`. Run it once per page, after every navigation (the tags
live on the DOM and are lost on reload).

**If a shot comes back blank** on a page where `windowScrolls` is true, scroll the target into view
explicitly (Playwright's auto-scroll can mis-fire) and retry the screenshot:

```js
async () => {
  const el = document.querySelector('[data-shot-index="0"]'); // or the index you're capturing
  el.scrollIntoView({ block: 'center' });
  await new Promise(r => setTimeout(r, 500));
}
```

**Names-dump diagnostic** — if a page reports zero instances, list what's actually rendered there so you can
spot a wrong name or a bad slug before moving on:

```js
() => [...new Set(Array.from(
  (document.querySelector('main') || document.body).querySelectorAll('[data-component-name]'),
  el => el.getAttribute('data-component-name')
))]
```

**Track each shot's provenance** as you go — keep a small list of `{ index, file, page, w, h }` (page slug
and dimensions come from the URL and the `instances` entry). You'll need it to label the gallery in step 5.

### 3. Render an interactive gallery and let the user click their pick

Build a **clickable** gallery, open it in the (headed) Playwright browser, and let the user select by
clicking — the rendered page itself is the selector. The selection drives the rest: the page records the
chosen index, you read it, then close the browser. (Don't screenshot-and-ask in chat — the user wants to
click in the page.)

1. **Write the interactive gallery HTML** to `.playwright-mcp/<ComponentName>-gallery.html` — one clickable
   `<figure data-index="N">` per shot (index, page slug, dimensions; `<img>` by **bare filename** so the
   relative `src` resolves over HTTP). The inline script highlights the clicked card, records the choice on
   `window.__confirmed`, and renders the sentinel text `SELECTION_CONFIRMED:<index>` that Playwright waits
   for. Fill the `<figure>` list and the `labels` map from your provenance list:

   Copy the skill's `templates/gallery.html`, substitute `<ComponentName>`, fill the `<figure>` list (one
   `<figure data-index="N">` per shot, with its page slug + dimensions) and the `labels` map from your
   provenance list, then write the result to `.playwright-mcp/<ComponentName>-gallery.html`. The template
   already wires the click/double-click selection, the blue `selected` highlight, `window.__confirmed`, and
   the `SELECTION_CONFIRMED:<index>` sentinel that step 3 waits for — you only fill in the cards and labels.

2. **Serve `.playwright-mcp/` over localhost and open the gallery** (the MCP blocks `file:`). Leave the
   server running until after the pick (kill it in step 6):

   ```bash
   python3 -m http.server 8765 --directory .playwright-mcp    # run_in_background: true
   ```

   ```
   browser_navigate('http://localhost:8765/<ComponentName>-gallery.html')
   browser_resize(width=1280, height=1080)
   ```

3. **Wait for the click, then read the index.** Tell the user to click a card + "Save this one" (or
   double-click). `browser_wait_for` times out at **30s** — re-arm it until the sentinel appears:

   ```
   browser_wait_for(text='SELECTION_CONFIRMED')
   browser_evaluate(() => window.__confirmed)    // -> the chosen index (NN)
   ```

   If two windows pass with the status still "No selection yet" (check with `browser_evaluate` reading
   `document.getElementById('status').textContent`), the Playwright browser may be headless / not visible to
   the user — confirm they can see the window, and offer the index-in-prose fallback (then close + save the
   same way).

4. **Close the browser** — selection closes it, as the user asked — then go save:

   ```
   browser_close()
   ```

### 4. Save the chosen instance, clean up & verify

1. **Copy** the confirmed instance to the canonical name (`<NN>` = the `window.__confirmed` index,
   zero-padded):

   ```bash
   cp .playwright-mcp/<ComponentName>-<NN>.png .playwright-mcp/<ComponentName>.png
   ```

2. **Clean up scratch and stop the localhost server**, leaving only `<ComponentName>.png`:

   ```bash
   rm -f .playwright-mcp/<ComponentName>-[0-9][0-9].png .playwright-mcp/<ComponentName>-gallery.html
   pkill -f "http.server 8765"
   ```

3. **`Read` the saved `<ComponentName>.png`** to confirm lazy images rendered, no overlay bled in, and
   nothing got cut off. Tell the user which instance (index + page) was saved and where.

### 5. Upload as Storyblok component preview screenshot

Upload the saved `<ComponentName>.png` to the component's **Preview screenshot** field in Storyblok
(space `293515734262231`, region `eu`). In the Management API this field is `image` on the component object.
It sets the thumbnail shown next to the component in the Storyblok library UI.

1. **Upload the file as a Storyblok asset.** Use the four-step MCP flow (search → describe → execute →
   finish). The filename must be `<ComponentName>.png` so Storyblok stores it under the component name:

   ```
   mcp__storyblok__search('upload asset')           // find uploadAsset operationId
   mcp__storyblok__describe(operationId: '...')     // check required params (space_id, filename, …)
   mcp__storyblok__upload_asset(                    // creates a pre-signed S3 slot
     space_id: 293515734262231,
     filename: '<ComponentName>.png'
   )
   ```

   The response contains a ready-to-run `curl` command. **Adapt it** before running:
   - Prepend `.playwright-mcp/` to the file path so it reads from `.playwright-mcp/<ComponentName>.png`.
   - The MCP-generated command includes `Content-Type=image/png` **twice** as form fields, which causes S3
     to reject it with `Policy Condition failed`. Remove the **second** occurrence and instead append
     `;type=image/png` to the file field:

   ```bash
   # Wrong (MCP-generated, has duplicate Content-Type):
   -F "Content-Type=image/png" ... -F "Content-Type=image/png" -F "file=@./ResponsiveVisual.png"
   # Correct:
   -F "Content-Type=image/png" ... -F "file=@.playwright-mcp/<ComponentName>.png;type=image/png"
   ```

   Then finalize:

   ```
   mcp__storyblok__describe(operationId: 'uploadAssetFinish')
   mcp__storyblok__upload_asset_finish(space_id: 293515734262231, id: <asset_id_from_upload_response>)
   ```

   The finish response contains the `filename` (CDN URL) — that is the value you need for the next step.

2. **Find the component's numeric ID.** Search for the component by name:

   ```
   mcp__storyblok__search('list components')
   mcp__storyblok__describe(operationId: '...')
   mcp__storyblok__execute_readonly(
     operationId: '...',
     parameters: { space_id: 293515734262231 },
     fields: ['components.id', 'components.name']
   )
   ```

   Filter the result for `name === '<ComponentName>'` to get the numeric `id`.

3. **Set the "Preview screenshot" field.** In the Storyblok UI this is labelled *Preview screenshot*; in
   the Management API it is the `image` field on the component object. Update it to the CDN URL from step 1:

   ```
   mcp__storyblok__search('update component')
   mcp__storyblok__describe(operationId: '...')
   mcp__storyblok__execute_mutating(
     operationId: '...',
     parameters: { space_id: 293515734262231, component_id: <id> },
     requestBody: { component: { image: '<cdn_url>' } }
   )
   ```

4. **Confirm** — tell the user the Preview screenshot field was updated and show the CDN URL.

**Diagnostics when capture comes up empty across all candidates:**

- **Every page returned an empty `instances` array** → the name isn't the live `data-component-name`, or all
  the slugs were wrong. Use the names-dump diagnostic (step 4) on one page to pick a real name or slug.
- **Every page returned `windowScrolls: false`** → you only tried custom-scroll pages (the homepage). Pick
  normal content pages (step 3b) and retry.

## Output location

Save into **`.playwright-mcp/`** (which already exists). Screenshot `filename`s resolve against the **repo
root** (the MCP's cwd), so the `.playwright-mcp/` prefix is **required** — without it the PNG lands in the
repo root (move it if that happens). Auto-saved snapshot/console artifacts go to `.playwright-mcp/`
regardless. The screenshot tool will **not** create missing directories — write into a folder that already
exists. The gallery is served over localhost (`file:` is blocked), so its URL is just
`http://localhost:<port>/<ComponentName>-gallery.html` — no absolute path needed.

- Candidate shots: `<ComponentName>-00.png` … `<ComponentName>-04.png` (scratch, removed after selection)
- Gallery: `<ComponentName>-gallery.html` (interactive selector; scratch, removed after selection)
- Final saved screenshot: `<ComponentName>.png` (the instance the user chose)

## Gotchas worth remembering

- **`data-component-name` is the blok name, not the React/file name.** Key the selector off the blok name;
  mind aliases (`ArticleItem: Article`). If the Storyblok query returns pages but the prepare step finds zero
  instances on them, use the names-dump diagnostic to see what `data-component-name` values are actually
  rendered — the name passed in may not match what's live on the DOM.
- **Go straight to Storyblok — skip monorepo code lookups.** The content (not code) determines which pages
  render a blok. Use `listStories` with `contain_component=<blok>` to find pages; `b2b/*` slugs → kenai
  root, `b2c/*` → goldnext with `en_gb` prefix. Asking the user is the fallback for zero-result cases only.
- **Take the first 5, don't ask which app.** Query published pages and take the first 5 in order, inferring
  each page's app from its slug prefix. Don't prompt the user to choose an app or page — only the final
  "which instance to save" choice is theirs. Top up from extra instances on a page only when fewer than 5
  pages use the blok.
- **Selection happens in the browser, not in chat.** The gallery is interactive: the user clicks a card,
  the page sets `window.__confirmed` and renders `SELECTION_CONFIRMED:<index>`; you `browser_wait_for` that
  text, read the index, then `browser_close`. `browser_wait_for` times out at **30s** — re-arm it. If two
  windows pass with the status still "No selection yet", the browser may be headless / not visible — confirm
  the user can see the window, then fall back to asking for the index in prose.
- **The MCP blocks `file:` — serve the gallery over localhost.** Run `python3 -m http.server <port> --directory
  .playwright-mcp` in the background and navigate to `http://localhost:<port>/<ComponentName>-gallery.html`
  (then `pkill` it). Keep the numbered PNGs and `gallery.html` together in `.playwright-mcp/` and reference
  images by **bare filename** so the relative `<img src>` resolves over HTTP.
- **Avoid the homepage `/`.** It renders a `HomePageOverlay` with a custom scroll container, so
  `window.scrollTo`/`scrollIntoView` are no-ops (`scrollY` stays 0) and element screenshots come back blank
  white *even though content is painted* (`opacity:1`, real text). The prepare step returns `windowScrolls`
  — if false, skip that page. Common bloks live on hundreds of pages, so there's always another.
- **`published: false` in MAPI ≠ not on www.** It just means the story has unpublished changes; the last
  published version is still live on www.tomtom.com. Do not filter by `is_published` — query without it and
  try www.tomtom.com directly. Only if the query returns zero stories at all is the blok truly unused.
- **Re-tag after any reload.** `data-shot-index` lives on the live DOM; re-run the prepare step after every
  navigation or reload before capturing — this matters in the per-page capture loop.
- **`scale: 'css'`** keeps 1 CSS pixel = 1 image pixel (the MCP default), so reported widths like 960/880
  match image widths.
- **Element screenshots ignore ancestor scroll**, but a *sticky* element painted over the component's top
  will appear in the shot — that's why the prepare step hides the sticky nav.
- **Don't publish or commit screenshots** unless asked — they're scratch artifacts in `.playwright-mcp/`
  (which is gitignored).
- **Fix the S3 curl command before running it.** `upload_asset` returns a command with a duplicate
  `Content-Type=image/png` form field that causes S3 to reject the upload. Remove the second occurrence and
  append `;type=image/png` to the file field instead. Also prepend `.playwright-mcp/` to the filename so it
  reads the saved file, not the repo root.
