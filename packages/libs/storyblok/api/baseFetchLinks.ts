import type { BaseFetchLinks } from '../types/api';
import { fetchMultiple } from './fetch';
import { getLocalCacheVersion, syncCacheVersions } from './cache';

const LINKS_PER_PAGE_LIMIT = 1000; // default is 25, max is 1000

export const baseFetchLinks: BaseFetchLinks = async params => {
	const { storyblokApi, options } = params;

	await syncCacheVersions(storyblokApi, options?.version);

	const { dataArray, total, perPage } = await fetchMultiple({
		storyblokApi,
		slug: 'cdn/links',
		options: {
			per_page: LINKS_PER_PAGE_LIMIT,
			cv: getLocalCacheVersion(),
			...options,
		},
	});
	const links = dataArray.reduce(
		(acc, linksData) => [...acc, ...Object.values(linksData.links)],
		[]
	);

	return { links, total, perPage };
};
