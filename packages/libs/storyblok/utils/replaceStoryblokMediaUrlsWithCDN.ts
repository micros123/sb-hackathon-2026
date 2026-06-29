const STORYBLOK_ASSETS_WITH_TOMTOM_SPACE_ID = /a\.storyblok\.com\/f\/(178460|272540|311760)\//g;

export const replaceStoryblokMediaUrlsWithCDN = <T>(
	json: T | null | undefined
): T | null | undefined => {
	if (json == null) {
		return json;
	}

	const jsonString = JSON.stringify(json);
	const replacedString = jsonString.replace(
		STORYBLOK_ASSETS_WITH_TOMTOM_SPACE_ID,
		'media.tomtom.com/f/$1/'
	);

	return JSON.parse(replacedString) as T;
};
