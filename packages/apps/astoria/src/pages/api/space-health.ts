import type { APIRoute } from 'astro';

import {
	buildReport,
	computeSeoSignal,
	countComponentUsage,
	fetchAllStories,
	fetchComponentSchemas,
	type SpaceHealthReport,
} from 'utils/spaceHealth';

export const prerender = false;

const CACHE_TTL_MS = 10 * 60 * 1000;

let cachedReport: { report: SpaceHealthReport; expiresAt: number } | null = null;

const readEnv = (key: string): string | undefined =>
	process.env[key] ?? (import.meta.env[key] as string | undefined);

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json',
			'cache-control': 'no-store',
		},
	});

export const GET: APIRoute = async ({ url }) => {
	const managementToken = readEnv('SPACE_HEALTH_TOKEN');
	const spaceId = readEnv('SPACE_HEALTH_SPACE_ID');
	const deliveryToken = readEnv('PUBLIC_STORYBLOK_ACCESS_TOKEN');
	const contentVersion = readEnv('STORYBLOK_CONTENT_VERSION') === 'draft' ? 'draft' : 'published';

	if (!managementToken || !spaceId) {
		return json(
			{
				error: 'Space health is not configured.',
				missing: [
					!managementToken && 'SPACE_HEALTH_TOKEN',
					!spaceId && 'SPACE_HEALTH_SPACE_ID',
				].filter(Boolean),
			},
			503
		);
	}
	if (!deliveryToken) {
		return json({ error: 'Missing PUBLIC_STORYBLOK_ACCESS_TOKEN.' }, 503);
	}

	const skipCache = url.searchParams.get('refresh') === 'true';
	if (!skipCache && cachedReport && cachedReport.expiresAt > Date.now()) {
		return json(cachedReport.report);
	}

	try {
		const schemas = await fetchComponentSchemas(managementToken, spaceId);
		const stories = await fetchAllStories(deliveryToken, contentVersion);
		const usage = countComponentUsage(stories);
		const signals = { seo: computeSeoSignal(stories) };

		const report = buildReport(schemas, usage, signals, {
			spaceId,
			contentVersion,
			storiesAnalysed: stories.length,
			generatedAt: new Date().toISOString(),
		});

		cachedReport = { report, expiresAt: Date.now() + CACHE_TTL_MS };
		return json(report);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: 'Failed to build space health report.', detail: message }, 500);
	}
};
