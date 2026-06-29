import type { StoryblokClient } from '@storyblok/react/rsc';
import type { ISbStoryParams } from '@storyblok/react/rsc';
import type {
	DatasourceEntriesParamsWithPage,
	DatasourcesParamsWithPage,
	LinksParamsWithPage,
	StoriesParamsWithPage,
	TagsParams,
} from '../types/api';
import { baseFlushCache } from './baseFlushCache';
import { baseFetchStory } from './baseFetchStory';
import { baseFetchStories } from './baseFetchStories';
import { baseFetchLinks } from './baseFetchLinks';
import { baseFetchTags } from './baseFetchTags';
import { baseFetchDatasources } from './baseFetchDatasources';
import { baseFetchDatasourceEntries } from './baseFetchDatasourceEntries';

export const bindStoryblokHelpers = (
	storyblokApi: StoryblokClient,
	defaultContentVersion?: 'draft' | 'published'
) => ({
	flushCache: async () => baseFlushCache({ storyblokApi }),

	fetchStory: async <ContentType>(slug: string, options?: ISbStoryParams) =>
		baseFetchStory<ContentType>({
			storyblokApi,
			slug,
			options: { ...options, version: options?.version ?? defaultContentVersion },
		}),

	fetchStories: async <ContentType>(options: StoriesParamsWithPage) =>
		baseFetchStories<ContentType>({
			storyblokApi,
			options: { ...options, version: options?.version ?? defaultContentVersion },
		}),

	fetchLinks: async (options: LinksParamsWithPage) =>
		baseFetchLinks({
			storyblokApi,
			options: { ...options, version: options?.version ?? defaultContentVersion },
		}),

	fetchTags: async (options?: TagsParams) =>
		baseFetchTags({
			storyblokApi,
			options: { ...options, version: options?.version ?? defaultContentVersion },
		}),

	fetchDatasources: async (options: DatasourcesParamsWithPage) =>
		baseFetchDatasources({
			storyblokApi,
			options: { ...options, version: options?.version ?? defaultContentVersion },
		}),

	fetchDatasourceEntries: async (options: DatasourceEntriesParamsWithPage) =>
		baseFetchDatasourceEntries({
			storyblokApi,
			options: { ...options, version: options?.version ?? defaultContentVersion },
		}),
});
