import type { BaseFetchStory } from '../types/api';
import { replaceStoryblokMediaUrlsWithCDN } from '../utils/replaceStoryblokMediaUrlsWithCDN';
import { fetchSingle } from './fetch';
import { syncCacheVersions, getLocalCacheVersion } from './cache';

export const baseFetchStory: BaseFetchStory = async params => {
	const { storyblokApi, slug, options } = params;

	await syncCacheVersions(storyblokApi, options?.version);

	const { data } = await fetchSingle({
		storyblokApi,
		slug: `cdn/stories/${slug}`,
		options: {
			...options,
			cv: getLocalCacheVersion(),
		},
	});

	//* Storyblok will return the default language for fictional locales like xx_xx.
	const isLocaleProvided = Boolean(options?.language);
	const isFallbackReturned = data?.story.lang === 'default';
	const isNonexistentLocale = isLocaleProvided && isFallbackReturned;

	if (isNonexistentLocale) {
		return { story: undefined };
	}

	const story = replaceStoryblokMediaUrlsWithCDN(data?.story);

	return { story };
};
