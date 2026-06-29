module.exports = {
	plugins: [
		'prettier-plugin-astro',
		'prettier-plugin-tailwindcss', // Must be last
	],
	singleQuote: true,
	printWidth: 100,
	arrowParens: 'avoid',
	useTabs: true,
	tabWidth: 4,
	trailingComma: 'es5',
	tailwindConfig: require.resolve('./packages/libs/basedrum/tailwind.config.js'),
	overrides: [
		{
			files: '*.astro',
			options: {
				parser: 'astro',
			},
		},
	],
};
