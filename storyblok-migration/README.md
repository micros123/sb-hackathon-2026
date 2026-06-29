# Storyblok hackathon content copy

Tooling to copy content from the TomTom production space (`178460`) into a fresh
hackathon space that lives under a **separate Storyblok account**.

## What the CLI v4 can and cannot copy

| Content            | CLI v4.12 | How                                  |
| ------------------ | --------- | ------------------------------------ |
| Component schema   | ✅ yes    | `components pull` + `components push` |
| Datasources        | ✅ yes    | `datasources pull` + `datasources push` |
| Stories / pages    | ❌ no     | Management API script (see below)     |
| Assets             | ❌ no     | Management API script (see below)     |

The v2 `sync` command no longer exists in v4. There is no `stories` command, so
actual content and assets need the Management API, not the CLI.

## One-time setup

1. Create your `.env` from the template and fill in both accounts' Personal
   Access Tokens. The token must come from the same region as the space:
   - EU: https://app.storyblok.com/#/me/account?tab=token
   - US: https://app-us.storyblok.com/#/me/account?tab=token

   ```sh
   cd storyblok-migration
   cp env.sample .env
   # edit .env, paste the two tokens
   ```
2. Load the wrappers:

   ```sh
   source copy.sh
   ```

## Copy component schema

```sh
storyblok_tomtom    components pull -s "$TOMTOM_SPACE_ID" --sf
storyblok_hackathon components push -s "$HACKATHON_SPACE_ID" --from "$TOMTOM_SPACE_ID" --sf
```

`pull` writes one JSON file per component into a folder named after the source
space id; `push --from` reads those files and creates them in the target space.

## Copy datasources

```sh
storyblok_tomtom    datasources pull -s "$TOMTOM_SPACE_ID" --sf
storyblok_hackathon datasources push -s "$HACKATHON_SPACE_ID" --from "$TOMTOM_SPACE_ID" --sf
```

## Copy stories

Copies all stories under `b2b/`, `b2c/`, and `_components/` from the source
space into the target as **drafts** (never published). Excludes newsroom/,
legal/, press-releases/, and careers/ subpaths. Idempotent: safe to re-run
after partial failures.

```sh
cd storyblok-migration
npx tsx migrate-stories.ts
```

Requires `tsx` (Node.js TypeScript runner). Install once: `npm install -g tsx`.

## Assets (not yet built)

Assets referenced by story content keep their original TomTom CDN URLs for now.
A separate asset migration script would need to download, re-upload, and rewrite
the URLs inside story content.
