import type { MiddlewareHandler } from 'astro';

//* Hackathon preview: keep every response out of search engines.
export const onRequest: MiddlewareHandler = async (_context, next) => {
	const response = await next();
	response.headers.set('X-Robots-Tag', 'noindex, nofollow');

	return response;
};
