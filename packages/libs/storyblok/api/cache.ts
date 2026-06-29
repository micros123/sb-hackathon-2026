import type { StoryblokClient } from '@storyblok/react/rsc';
import { fetchSingle } from './fetch';
import { baseFlushCache } from './baseFlushCache';

const CACHE_TTL_SECONDS = 600;
export const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;

const getCurrentTimestamp = () => Math.floor(Date.now() / 1000);

let localCacheVersion = getCurrentTimestamp();

const fetchSpaceCacheVersion = async (storyblokApi: StoryblokClient) => {
	const { data } = await fetchSingle({
		storyblokApi,
		slug: 'cdn/spaces/me',
	});

	const cv: number = data?.space?.version;

	if (!cv) {
		console.warn('No cache version found in cdn/spaces/me');
	}

	return { cv };
};

export const getLocalCacheVersion = () => localCacheVersion;

export const syncCacheVersions = async (
	storyblokApi: StoryblokClient,
	contentVersion?: 'draft' | 'published'
) => {
	const isCacheEnabled = contentVersion === 'published';

	if (!isCacheEnabled) {
		localCacheVersion = getCurrentTimestamp();

		return;
	}

	const isLocalCacheStale = getCurrentTimestamp() - localCacheVersion > CACHE_TTL_SECONDS;

	if (!isLocalCacheStale) {
		return;
	}

	const { cv: spaceCacheVersion } = await fetchSpaceCacheVersion(storyblokApi);

	if (spaceCacheVersion === localCacheVersion) {
		return;
	}

	localCacheVersion = spaceCacheVersion;

	await baseFlushCache({ storyblokApi });
};
