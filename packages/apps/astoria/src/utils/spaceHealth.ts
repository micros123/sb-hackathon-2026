import StoryblokClient from 'storyblok-js-client';

export type ComponentClassification = 'page' | 'nested' | 'universal' | 'unclassified';

export type ComponentRole = 'page' | 'section' | 'subcomponent' | 'unused';

export type StylingCompleteness = 'full' | 'partial' | 'none';

export type ComponentRow = {
	name: string;
	displayName: string;
	classification: ComponentClassification;
	role: ComponentRole;
	styling: StylingCompleteness;
	icon: string | null;
	color: string | null;
	hasIcon: boolean;
	hasColor: boolean;
	hasPreview: boolean;
	hasPreset: boolean;
	totalUsage: number;
	asRootUsage: number;
	nestedUsage: number;
	pageSectionUsage: number;
	storyCount: number;
};

export type SpaceHealthReport = {
	spaceId: string;
	contentVersion: string;
	storiesAnalysed: number;
	generatedAt: string;
	summary: {
		totalComponents: number;
		usedComponents: number;
		unusedComponents: number;
		pageComponents: number;
		nestedComponents: number;
		universalComponents: number;
		unclassifiedComponents: number;
		pageSectionComponents: number;
		rolePage: number;
		roleSection: number;
		roleSubcomponent: number;
		roleUnused: number;
		stylingFull: number;
		stylingPartial: number;
		stylingNone: number;
		withIcon: number;
		withColor: number;
		withPreview: number;
		withPreset: number;
	};
	components: ComponentRow[];
};

type ComponentSchema = {
	name: string;
	display_name: string | null;
	is_root: boolean;
	is_nestable: boolean;
	icon: string | null;
	color: string | null;
	image: string | null;
	preview_field: string | null;
	preview_tmpl: string | null;
	content_type_asset_preview: string | null;
	all_presets: unknown[] | null;
};

type Story = {
	full_slug: string;
	content: Record<string, unknown>;
};

const classify = (schema: ComponentSchema): ComponentClassification => {
	if (schema.is_root && schema.is_nestable) return 'universal';
	if (schema.is_root) return 'page';
	if (schema.is_nestable) return 'nested';
	return 'unclassified';
};

const hasPreview = (schema: ComponentSchema): boolean =>
	Boolean(
		schema.image ||
		schema.preview_field ||
		(schema.preview_tmpl && schema.preview_tmpl.trim()) ||
		schema.content_type_asset_preview
	);

export async function fetchComponentSchemas(
	managementToken: string,
	spaceId: string
): Promise<ComponentSchema[]> {
	const client = new StoryblokClient({ oauthToken: managementToken });
	const schemas: ComponentSchema[] = [];
	let page = 1;

	while (true) {
		const response = await client.get(`spaces/${spaceId}/components`, {
			per_page: 100,
			page,
		});
		const batch = (response.data.components ?? []) as ComponentSchema[];
		if (!batch.length) break;
		schemas.push(...batch);
		if (batch.length < 100) break;
		page++;
	}

	return schemas;
}

export async function fetchAllStories(
	deliveryToken: string,
	contentVersion: 'draft' | 'published'
): Promise<Story[]> {
	const client = new StoryblokClient({ accessToken: deliveryToken });
	const stories = (await client.getAll('cdn/stories', {
		per_page: 100,
		version: contentVersion,
		excluding_fields: 'seo',
	})) as Story[];

	return stories.filter(story => story.content);
}

type UsageCounts = {
	total: number;
	asRoot: number;
	nested: number;
	pageSection: number;
	stories: Set<string>;
};

const emptyCounts = (): UsageCounts => ({
	total: 0,
	asRoot: 0,
	nested: 0,
	pageSection: 0,
	stories: new Set<string>(),
});

export function countComponentUsage(stories: Story[]): Map<string, UsageCounts> {
	const counts = new Map<string, UsageCounts>();

	const bump = (name: string, isRoot: boolean, slug: string) => {
		const entry = counts.get(name) ?? emptyCounts();
		entry.total++;
		if (isRoot) entry.asRoot++;
		else entry.nested++;
		entry.stories.add(slug);
		counts.set(name, entry);
	};

	const walk = (node: unknown, slug: string, isRoot: boolean) => {
		if (Array.isArray(node)) {
			node.forEach(child => walk(child, slug, false));
			return;
		}
		if (!node || typeof node !== 'object') return;

		const record = node as Record<string, unknown>;
		if (typeof record.component === 'string') bump(record.component, isRoot, slug);

		for (const value of Object.values(record)) {
			if (value && typeof value === 'object') walk(value, slug, false);
		}
	};

	const countPageSections = (rootContent: Record<string, unknown>) => {
		const sections = rootContent.components;
		if (!Array.isArray(sections)) return;
		for (const section of sections) {
			const component = (section as Record<string, unknown>)?.component;
			if (typeof component === 'string') {
				const entry = counts.get(component) ?? emptyCounts();
				entry.pageSection++;
				counts.set(component, entry);
			}
		}
	};

	for (const story of stories) {
		walk(story.content, story.full_slug, true);
		if (typeof story.content?.component === 'string') countPageSections(story.content);
	}

	return counts;
}

export function buildReport(
	schemas: ComponentSchema[],
	usage: Map<string, UsageCounts>,
	context: {
		spaceId: string;
		contentVersion: string;
		storiesAnalysed: number;
		generatedAt: string;
	}
): SpaceHealthReport {
	const components: ComponentRow[] = schemas
		.map(schema => {
			const counts = usage.get(schema.name);
			const totalUsage = counts?.total ?? 0;
			const asRootUsage = counts?.asRoot ?? 0;
			const pageSectionUsage = counts?.pageSection ?? 0;

			const role: ComponentRole =
				totalUsage === 0
					? 'unused'
					: asRootUsage > 0
						? 'page'
						: pageSectionUsage > 0
							? 'section'
							: 'subcomponent';

			const componentHasIcon = Boolean(schema.icon);
			const componentHasColor = Boolean(schema.color);
			const componentHasPreview = hasPreview(schema);
			const styledCount = [componentHasIcon, componentHasColor, componentHasPreview].filter(
				Boolean
			).length;
			const styling: StylingCompleteness =
				styledCount === 3 ? 'full' : styledCount > 0 ? 'partial' : 'none';

			return {
				name: schema.name,
				displayName: schema.display_name ?? schema.name,
				classification: classify(schema),
				role,
				styling,
				icon: schema.icon || null,
				color: schema.color || null,
				hasIcon: componentHasIcon,
				hasColor: componentHasColor,
				hasPreview: componentHasPreview,
				hasPreset: (schema.all_presets?.length ?? 0) > 0,
				totalUsage,
				asRootUsage,
				nestedUsage: counts?.nested ?? 0,
				pageSectionUsage,
				storyCount: counts?.stories.size ?? 0,
			};
		})
		.sort((first, second) => second.pageSectionUsage - first.pageSectionUsage);

	const summary = {
		totalComponents: components.length,
		usedComponents: components.filter(row => row.totalUsage > 0).length,
		unusedComponents: components.filter(row => row.totalUsage === 0).length,
		pageComponents: components.filter(row => row.classification === 'page').length,
		nestedComponents: components.filter(row => row.classification === 'nested').length,
		universalComponents: components.filter(row => row.classification === 'universal').length,
		unclassifiedComponents: components.filter(row => row.classification === 'unclassified')
			.length,
		pageSectionComponents: components.filter(row => row.pageSectionUsage > 0).length,
		rolePage: components.filter(row => row.role === 'page').length,
		roleSection: components.filter(row => row.role === 'section').length,
		roleSubcomponent: components.filter(row => row.role === 'subcomponent').length,
		roleUnused: components.filter(row => row.role === 'unused').length,
		stylingFull: components.filter(row => row.styling === 'full').length,
		stylingPartial: components.filter(row => row.styling === 'partial').length,
		stylingNone: components.filter(row => row.styling === 'none').length,
		withIcon: components.filter(row => row.hasIcon).length,
		withColor: components.filter(row => row.hasColor).length,
		withPreview: components.filter(row => row.hasPreview).length,
		withPreset: components.filter(row => row.hasPreset).length,
	};

	return { ...context, summary, components };
}
