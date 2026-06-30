import type { APIRoute } from 'astro';

export const prerender = false;

const readEnv = (key: string): string | undefined =>
	process.env[key] ?? (import.meta.env[key] as string | undefined);

// Maksim's flowmotion/n8n webhook that screenshots a single component and uploads
// it as the component's preview image. Server-side proxy so the browser is not
// blocked by CORS and the URL can be overridden per environment.
const DEFAULT_WEBHOOK =
	'https://c3rvcnlibg9rlwvsaxrllxbyzc1ldwmx.flowmotion.storyblok.com/webhook-test/screenshot-single-component';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
	});

export const GET: APIRoute = async ({ url }) => {
	const componentName = url.searchParams.get('componentName');
	if (!componentName) return json({ ok: false, error: 'componentName is required' }, 400);

	const base = readEnv('SCREENSHOT_WEBHOOK_URL') || DEFAULT_WEBHOOK;
	const target =
		base +
		(base.includes('?') ? '&' : '?') +
		'componentName=' +
		encodeURIComponent(componentName);

	try {
		const response = await fetch(target, { method: 'GET' });
		const body = await response.text();
		return json({
			ok: response.ok,
			status: response.status,
			componentName,
			body: body.slice(0, 400),
		});
	} catch (error) {
		return json(
			{
				ok: false,
				componentName,
				error: error instanceof Error ? error.message : String(error),
			},
			502
		);
	}
};
