import type {
	FetchMultipleByPageParams,
	FetchMultipleParams,
	FetchSingleParams,
} from '../types/api';

const FORBIDDEN_SLUG_PARTS = [
	'_next',
	'%',
	'..',
	'.ini',
	'WEB-INF',
	'web.xml',
	'push-worker.js',
	'/readme.txt',
	'/wp-content',
	'/wp-admin',
	'/basket.dcp',
	'/basket-update.dcp',
	'/checkall.dcp',
	'/city.dcp',
	'/price.dcp',
	'/stock.dcp',
	'/chunks/',
	'/static/',
	'/ready/',
	'/healthz/',
	'/metrics/',
];

const FORBIDDEN_SLUG_EXTENSIONS = [
	'.ico',
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.webp',
	'.svg',
	'.css',
	'.js',
	'.map',
	'.json',
	'.xml',
	'.txt',
	'.woff',
	'.woff2',
	'.ttf',
];

const isForbiddenSlug = (slug: string) =>
	FORBIDDEN_SLUG_PARTS.some(part => slug.includes(part)) ||
	FORBIDDEN_SLUG_EXTENSIONS.some(extension => slug.endsWith(extension));

export const fetchSingle = async ({ storyblokApi, slug, options }: FetchSingleParams) => {
	if (isForbiddenSlug(slug)) {
		console.error(
			JSON.stringify({
				fetchSingle: `Preventing fetch of invalid story '${slug}'`,
				language: options?.language,
			})
		);

		return { data: null };
	}

	const normalizedSlug = slug.replace('//', '/');

	try {
		return await storyblokApi.get(normalizedSlug, options);
	} catch (error) {
		console.error(
			JSON.stringify({
				fetchSingle: `Error fetching story '${normalizedSlug}'`,
				language: options?.language,
				hadDoubleSlash: slug !== normalizedSlug,
				error,
			})
		);

		return { data: null };
	}
};

const fetchMultipleByPage = async ({ storyblokApi, slug, options }: FetchMultipleByPageParams) => {
	const { data, total, perPage } = await storyblokApi.get(slug, options);

	return {
		dataArray: [data],
		total,
		perPage,
	};
};

export const fetchMultiple = async (params: FetchMultipleParams) => {
	const { storyblokApi, slug, options } = params;
	const { page } = options ?? {};

	if (page !== 'all') {
		return fetchMultipleByPage({
			storyblokApi,
			slug,
			options: { ...options, page },
		});
	}

	const firstPage = await fetchMultipleByPage({
		storyblokApi,
		slug,
		options: { ...options, page: 1 },
	});

	const otherPagesRequests: Promise<{ dataArray: any[]; total: number; perPage: number }>[] = [];
	const maxPage = Math.ceil(firstPage.total / firstPage.perPage);

	for (let currentPage = 2; currentPage <= maxPage; currentPage += 1) {
		otherPagesRequests.push(
			fetchMultipleByPage({
				storyblokApi,
				slug,
				options: { ...options, page: currentPage },
			})
		);
	}

	const otherPages = await Promise.all(otherPagesRequests);
	const otherPagesDataArray = otherPages.map(response => response.dataArray).flat();

	return {
		dataArray: firstPage.dataArray.concat(otherPagesDataArray),
		total: firstPage.total,
		perPage: firstPage.perPage,
	};
};
