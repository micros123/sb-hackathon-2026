# Storyblok

This package contains utilities for Storyblok CMS:

- Generated types from the Storyblok spaces.
- API helper functions enriching the Storyblok API with TS typings.

## Types

### Generating Types

Set up Storyblok CLI with SSO once:  
https://www.storyblok.com/faq/how-to-use-the-storyblok-cli-with-an-sso-account

Generate types after Storyblok schema updates:

```bash
pnpm generate-types
```

### Using generated types

Add import from the declaration file to use the generated types in your code:

```ts
import { MyComponentProps } from '@drumkit/storyblok/types/storyblok.d';
```

## API Helper Functions

The helper functions provide:

- Type-safe API calls with TypeScript generics
- Automatic pagination (when fetching multiple items)
- Built-in cache management

### Setup

Initialize local helpers by binding them with your Storyblok API instance:

```ts
const getStoryblokApi = storyblokInit({
	/* config */
});
const DEFAULT_CONTENT_VERSION = process.env.STORYBLOK_CONTENT_VERSION as 'draft' | 'published';

export const {
	flushCache,
	fetchStory,
	fetchStories,
	fetchLinks,
	fetchTags,
	fetchDatasources,
	fetchDatasourceEntries,
} = bindStoryblokHelpers(getStoryblokApi(), DEFAULT_CONTENT_VERSION);
```

### Usage

Fetch a single story with type safety:

```ts
const { story } = await fetchStory<BlogPostProps>('blog-posts/my-post');
```

Fetch multiple stories with pagination:

```ts
const { stories } = await fetchStories<BlogPostProps>({
	by_slugs: 'blog-posts/*',
	page: 'all',
});
```

### Caching

The Storyblok API uses a `cv` (cache version) parameter that requires manual management. The helper functions handle this automatically:

- for `draft` content version, the cache is bypassed and the latest content is always fetched.
- for `published` content version, the cache is used and automatically flushed every 10 minutes.

You can also flush the cache manually by calling the `flushCache` function (in a webhook, for example).
