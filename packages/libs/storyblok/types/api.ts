import type { ISbStoriesParams, ISbStoryParams, StoryblokClient } from '@storyblok/react/rsc';
import type { ISbDimensions, ISbStoryData } from 'storyblok-js-client';

export type StoryblokLink = {
	id: number;
	uuid: string;
	slug: string;
	path: string;
	parent_id: number;
	name: string;
	is_folder: boolean;
	published: boolean;
	is_startpage: boolean;
	position: number;
	real_path: string;
};

export type StoryblokTag = {
	name: string;
	taggings_count: number;
};

export type StoryblokDatasource = ISbDimensions & {
	id: number;
	name: string;
	slug: string;
};

export type StoryblokDatasourceEntry = {
	id: number;
	name: string;
	value: string;
	dimension_value: string | null;
};

export type StoriesParamsWithPage = Omit<ISbStoriesParams, 'page'> & { page: number | 'all' };

export type StoriesParamsWithOptionalPage = Omit<ISbStoriesParams, 'page'> & {
	page?: number | 'all';
};

export type StoriesParamsWithPageAndLanguage = Omit<ISbStoriesParams, 'page' | 'language'> & {
	page: number | 'all';
	language: string;
};

export type LinksParamsWithPage = {
	page: number | 'all';
	token?: string;
	starts_with?: string;
	version?: 'draft' | 'published';
	cv?: number;
	with_parent?: number;
	per_page?: number;
	paginated?: number;
};

export type TagsParams = {
	token?: string;
	starts_with?: string;
	version?: 'draft' | 'published';
	with_parent?: number;
};

export type DatasourcesParamsWithPage = {
	page: number | 'all';
	per_page?: number;
	version?: 'draft' | 'published';
};

export type DatasourceEntriesParamsWithPage = {
	datasource: string;
	dimension?: string;
	page: number | 'all';
	per_page?: number;
	version?: 'draft' | 'published';
};

export type FetchSingleParams = {
	storyblokApi: StoryblokClient;
	slug: string;
	options?: ISbStoryParams;
};

export type FetchMultipleByPageParams = {
	storyblokApi: StoryblokClient;
	slug: string;
	options?: ISbStoriesParams;
};

export type FetchMultipleParams = {
	storyblokApi: StoryblokClient;
	slug: string;
	options?: StoriesParamsWithOptionalPage;
};

export type BaseFlushCache = (params: {
	storyblokApi: StoryblokClient;
}) => Promise<StoryblokClient>;

export type BaseFetchStory = <ContentType>(params: {
	storyblokApi: StoryblokClient;
	slug: string;
	options?: ISbStoryParams;
}) => Promise<{
	story: ISbStoryData<ContentType>;
}>;

export type BaseFetchStories = <ContentType>(params: {
	storyblokApi: StoryblokClient;
	options: StoriesParamsWithPage;
}) => Promise<{
	stories: ISbStoryData<ContentType>[];
	total: number;
	perPage: number;
}>;

export type BaseFetchLinks = (params: {
	storyblokApi: StoryblokClient;
	options: LinksParamsWithPage;
}) => Promise<{
	links: StoryblokLink[];
	total: number;
	perPage: number;
}>;

export type BaseFetchTags = (params: {
	storyblokApi: StoryblokClient;
	options?: TagsParams;
}) => Promise<{
	tags: StoryblokTag[];
}>;

export type BaseFetchDatasources = (params: {
	storyblokApi: StoryblokClient;
	options?: DatasourcesParamsWithPage;
}) => Promise<{
	datasources: StoryblokDatasource[];
	total: number;
	perPage: number;
}>;

export type BaseFetchDatasourceEntries = (params: {
	storyblokApi: StoryblokClient;
	options?: DatasourceEntriesParamsWithPage;
}) => Promise<{
	datasourceEntries: StoryblokDatasourceEntry[];
	total: number;
	perPage: number;
}>;
