// Type mapping for the "Plugin" field variants
// https://github.com/dohomi/storyblok-generate-ts/issues/60
// 'seo-metatags' variant is included in the package by default

const storyblokCustomParser = (key, obj) => {
	switch (obj.field_type) {
		case 'tt-seo':
			return {
				[key]: {
					type: 'object',
					properties: {
						_uid: {
							type: 'string',
						},
						title: {
							type: 'string',
						},
						plugin: {
							type: 'string',
						},
						og_image: {
							type: 'string',
						},
						og_title: {
							type: 'string',
						},
						description: {
							type: 'string',
						},
						twitter_image: {
							type: 'string',
						},
						twitter_title: {
							type: 'string',
						},
						og_description: {
							type: 'string',
						},
						twitter_description: {
							type: 'string',
						},
					},
				},
			};
		case 'storyblok-palette':
			return {
				[key]: {
					type: 'object',
					properties: {
						value: {
							type: 'string',
						},
						plugin: {
							const: 'storyblok-palette',
						},
					},
				},
			};
		case 'storyblok-colorpicker':
			return {
				[key]: {
					type: 'object',
					properties: {
						color: {
							type: 'string',
						},
						plugin: {
							const: 'official-colorpicker',
						},
					},
				},
			};
		default:
			return {};
	}
};

module.exports = storyblokCustomParser;
