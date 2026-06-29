import type { BaseFetchTags } from '../types/api';
import { fetchMultiple } from './fetch';

export const baseFetchTags: BaseFetchTags = async params => {
	const { storyblokApi, options } = params;

	const { dataArray } = await fetchMultiple({
		storyblokApi,
		slug: 'cdn/tags',
		options,
	});
	const tags = dataArray.map(data => data.tags).flat();

	return { tags };
};
