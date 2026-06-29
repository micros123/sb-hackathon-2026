import type { BaseFlushCache } from '../types/api';

export const baseFlushCache: BaseFlushCache = async params => {
	const { storyblokApi } = params;

	return storyblokApi.flushCache();
};
