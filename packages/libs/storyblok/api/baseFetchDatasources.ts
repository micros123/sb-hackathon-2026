import type { BaseFetchDatasources } from '../types/api';
import { fetchMultiple } from './fetch';

const DATASOURCES_PER_PAGE_LIMIT = 100; // default is 25, max is 1000

export const baseFetchDatasources: BaseFetchDatasources = async params => {
	const { storyblokApi, options } = params;

	const { dataArray, total, perPage } = await fetchMultiple({
		storyblokApi,
		slug: 'cdn/datasources',
		options: {
			per_page: DATASOURCES_PER_PAGE_LIMIT,
			...options,
		},
	});
	const datasources = dataArray.map(data => data.datasources).flat();

	return { datasources, total, perPage };
};
