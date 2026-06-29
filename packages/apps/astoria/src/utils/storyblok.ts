import { useStoryblokApi } from '@storyblok/astro';
import { bindStoryblokHelpers } from '@drumkit/storyblok/api/bindStoryblokHelpers';

export const contentVersion =
	(import.meta.env.STORYBLOK_CONTENT_VERSION as 'draft' | 'published') ?? 'draft';

export type Audience = 'b2b' | 'b2c' | 'other';

export type StoryContent = {
	component: string;
	components?: SbBlok[];
	[key: string]: unknown;
};

export type SbBlok = { component: string; _uid?: string; [key: string]: unknown };

export type Story = { name: string; full_slug: string; content: StoryContent };

export type Multilink = {
	url?: string;
	cached_url?: string;
	linktype?: string;
	title?: string;
	story?: { full_slug?: string };
};

export type Asset = { filename?: string | null; alt?: string | null };

type StoryblokClientArg = Parameters<typeof bindStoryblokHelpers>[0];

export const getStoryblok = () =>
	// eslint-disable-next-line react-hooks/rules-of-hooks -- useStoryblokApi is an Astro helper, not a React hook
	bindStoryblokHelpers(useStoryblokApi() as unknown as StoryblokClientArg, contentVersion);

//* All pages live under the b2b and b2c folders, which stay invisible in the app
//* URLs (like the kenai app strips its b2b prefix). A public path is resolved by
//* trying the b2b folder first, then b2c; the first hit wins. The prefixless root
//* holds only _components, so it is never served as a page.
const CANDIDATE_PREFIXES = ['b2b/', 'b2c/'];

const cleanPath = (path: string): string => path.replace(/^\/+|\/+$/g, '');

const hasAudiencePrefix = (slug: string): boolean => /^b2[bc](\/|$)/.test(slug);

const candidatesFor = (clean: string): string[] => {
	if (!clean) {
		return ['b2b'];
	}

	//* A full slug (b2b/... or b2c/...) is used as-is so the Storyblok live preview
	//* URL renders, while a stripped public path is tried under both folders.
	if (hasAudiencePrefix(clean)) {
		return [clean];
	}

	return CANDIDATE_PREFIXES.map(prefix => `${prefix}${clean}`);
};

export const resolveStory = async (path: string): Promise<Story | undefined> => {
	const candidates = candidatesFor(cleanPath(path));
	const storyblok = getStoryblok();

	for (const candidate of candidates) {
		const { story } = await storyblok.fetchStory<StoryContent>(candidate, {
			resolve_links: 'url',
		});

		if (story) {
			return story as Story;
		}
	}

	return undefined;
};

export const audienceOf = (fullSlug: string): Audience => {
	if (fullSlug.startsWith('b2b/') || fullSlug === 'b2b') {
		return 'b2b';
	}

	if (fullSlug.startsWith('b2c/') || fullSlug === 'b2c') {
		return 'b2c';
	}

	return 'other';
};

export const withProtocol = (source?: string | null): string =>
	source?.startsWith('//') ? `https:${source}` : (source ?? '');

export const assetUrl = (asset?: Asset | null): string => withProtocol(asset?.filename);

//* Strips the b2b/b2c folder prefix so internal links match the public routing.
export const publicHref = (target?: string | Multilink | null): string => {
	if (!target) {
		return '#';
	}

	const raw =
		typeof target === 'string'
			? target
			: target.story?.full_slug || target.url || target.cached_url || '';

	if (!raw) {
		return '#';
	}

	if (/^(https?:)?\/\//.test(raw) || raw.startsWith('mailto:') || raw.startsWith('tel:')) {
		return raw;
	}

	const stripped = cleanPath(raw).replace(/^(b2b|b2c)(\/|$)/, '');

	return stripped ? `/${stripped}` : '/';
};

export const linkLabel = (link: Multilink | undefined, fallback: string): string =>
	link?.title?.trim() || fallback;

export const labelForStory = (name: string, fullSlug: string): string => {
	if (name?.trim()) {
		return name;
	}

	const lastSegment = fullSlug.split('/').filter(Boolean).pop() ?? fullSlug;

	return lastSegment.replace(/[_-]+/g, ' ').replace(/^\w/, character => character.toUpperCase());
};

export const audienceLabels: Record<Audience, string> = {
	b2b: 'Business',
	b2c: 'Consumer',
	other: 'Other',
};
