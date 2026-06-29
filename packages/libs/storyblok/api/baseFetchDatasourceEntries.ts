import type { BaseFetchDatasourceEntries } from '../types/api';
import { fetchMultiple } from './fetch';

const DATASOURCE_ENTRIES_PER_PAGE_LIMIT = 100; // default is 25, max is 1000

export const baseFetchDatasourceEntries: BaseFetchDatasourceEntries = async params => {
	const { storyblokApi, options } = params;

	const { dataArray, total, perPage } = await fetchMultiple({
		storyblokApi,
		slug: 'cdn/datasource_entries',
		options: {
			per_page: DATASOURCE_ENTRIES_PER_PAGE_LIMIT,
			...options,
		},
	});
	const datasourceEntries = dataArray.map(data => data.datasource_entries).flat();

	return { datasourceEntries, total, perPage };
};
