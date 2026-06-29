import type { BaseFetchStories } from '../types/api';
import { replaceStoryblokMediaUrlsWithCDN } from '../utils/replaceStoryblokMediaUrlsWithCDN';
import { fetchMultiple } from './fetch';
import { getLocalCacheVersion, syncCacheVersions } from './cache';

const STORIES_PER_PAGE_LIMIT = 100; // default is 25, max is 100

export const baseFetchStories: BaseFetchStories = async params => {
	const { storyblokApi, options } = params;

	await syncCacheVersions(storyblokApi, options?.version);

	const { dataArray, total, perPage } = await fetchMultiple({
		storyblokApi,
		slug: 'cdn/stories',
		options: {
			per_page: STORIES_PER_PAGE_LIMIT,
			...options,
			cv: getLocalCacheVersion(),
		},
	});
	const stories = dataArray.map(data => replaceStoryblokMediaUrlsWithCDN(data.stories)).flat();

	return { stories, total, perPage };
};
