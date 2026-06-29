import type { StoryblokRichtext } from '@drumkit/storyblok/types/storyblok.d';

const SKIP_KEYS = new Set([
	'_uid',
	'_editable',
	'component',
	'seo',
	'noIndex',
	'sitemapExclusion',
	'canonicalUrl',
	'TestAISEO',
	'hasDarkBackground',
	'spacer',
	'anchorId',
	'theme',
	'backgroundColor',
	'sizing',
]);

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)(\?|$)/i;
const TITLE_KEYS = /(title|headline|heading|tagline)/i;
const BODY_KEYS = /^(body|description|intro|subtitle|paragraph|content|text)/i;

export type ClassifiedField =
	| { kind: 'richtext'; value: StoryblokRichtext }
	| { kind: 'image'; src: string; alt: string }
	| { kind: 'video'; src: string }
	| { kind: 'link'; href: string; label: string }
	| { kind: 'bloks'; value: SbBlok[] }
	| { kind: 'heading'; text: string }
	| { kind: 'body'; text: string }
	| { kind: 'text'; label: string; text: string }
	| { kind: 'skip' };

export type SbBlok = { component: string; _uid?: string; [key: string]: unknown };

const isRichtext = (value: unknown): value is StoryblokRichtext =>
	!!value && typeof value === 'object' && (value as { type?: string }).type === 'doc';

const isAsset = (value: unknown): value is { filename: string; alt?: string } => {
	const filename = (value as { filename?: unknown })?.filename;
	return (
		!!value && typeof value === 'object' && typeof filename === 'string' && filename.length > 0
	);
};

const isMultilink = (value: unknown): boolean =>
	!!value &&
	typeof value === 'object' &&
	('linktype' in (value as object) ||
		(value as { fieldtype?: string }).fieldtype === 'multilink');

const isBlokArray = (value: unknown): value is SbBlok[] =>
	Array.isArray(value) &&
	value.length > 0 &&
	value.every(item => !!item && typeof item === 'object' && 'component' in item);

const linkHref = (value: Record<string, unknown>): string => {
	const url = (value.url as string) || (value.cached_url as string) || '';
	const story = value.story as { full_slug?: string } | undefined;

	if (story?.full_slug) {
		return `/${story.full_slug}`;
	}

	if (value.linktype === 'email' && url) {
		return `mailto:${url}`;
	}

	return url;
};

export const humanize = (key: string): string =>
	key
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.replace(/^\w/, character => character.toUpperCase());

const isEnumLikeString = (text: string): boolean => !text.includes(' ') && text.length < 24;

export const classifyField = (key: string, value: unknown): ClassifiedField => {
	if (SKIP_KEYS.has(key) || value === null || value === undefined || value === '') {
		return { kind: 'skip' };
	}

	if (isRichtext(value)) {
		return { kind: 'richtext', value };
	}

	if (isBlokArray(value)) {
		return { kind: 'bloks', value };
	}

	if (isAsset(value)) {
		const src = value.filename;

		if (VIDEO_EXTENSIONS.test(src)) {
			return { kind: 'video', src };
		}

		return { kind: 'image', src, alt: value.alt ?? '' };
	}

	if (isMultilink(value)) {
		const href = linkHref(value as Record<string, unknown>);
		return href ? { kind: 'link', href, label: humanize(key) } : { kind: 'skip' };
	}

	if (typeof value === 'string') {
		if (TITLE_KEYS.test(key)) {
			return { kind: 'heading', text: value };
		}

		if (BODY_KEYS.test(key)) {
			return { kind: 'body', text: value };
		}

		if (isEnumLikeString(value)) {
			return { kind: 'skip' };
		}

		return { kind: 'text', label: humanize(key), text: value };
	}

	return { kind: 'skip' };
};

export const classifyBlok = (blok: SbBlok): { key: string; field: ClassifiedField }[] =>
	Object.entries(blok)
		.map(([key, value]) => ({ key, field: classifyField(key, value) }))
		.filter(({ field }) => field.kind !== 'skip');
