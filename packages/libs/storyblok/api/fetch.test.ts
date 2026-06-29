import type { StoryblokClient } from '@storyblok/react/rsc';
import { describe, test, expect, vi } from 'vitest';
import { fetchSingle } from './fetch';

const createStoryblokApi = (response: unknown = { data: { story: { id: 1 } } }) => {
	const get = vi.fn().mockResolvedValue(response);
	const storyblokApi = { get } as unknown as StoryblokClient;

	return { storyblokApi, get };
};

const forbiddenSlugs = [
	'cdn/stories/openlr/favicon.ico',
	'cdn/stories/openlr/apple-touch-icon.png',
	'cdn/stories/openlr/robots.txt',
	'cdn/stories/openlr/sitemap.xml',
	'cdn/stories/openlr/_next/static/chunks/main.js',
	'cdn/stories/openlr/wp-admin',
];

const validSlugs = ['cdn/stories/openlr/', 'cdn/stories/openlr/release-v1.2', 'cdn/spaces/me'];

describe('fetchSingle', () => {
	forbiddenSlugs.forEach(slug => {
		test(`blocks ${slug} without calling Storyblok`, async () => {
			const { storyblokApi, get } = createStoryblokApi();

			const result = await fetchSingle({ storyblokApi, slug });

			expect(get).not.toHaveBeenCalled();
			expect(result).toEqual({ data: null });
		});
	});

	validSlugs.forEach(slug => {
		test(`fetches the valid slug ${slug} from Storyblok`, async () => {
			const response = { data: { story: { id: 1 } } };
			const { storyblokApi, get } = createStoryblokApi(response);

			const result = await fetchSingle({ storyblokApi, slug });

			expect(get).toHaveBeenCalledWith(slug, undefined);
			expect(result).toEqual(response);
		});
	});
});
