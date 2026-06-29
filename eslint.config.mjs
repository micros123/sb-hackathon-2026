import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Shared TypeScript rules for all file types (JS/TS, Astro)
const sharedTypeScriptRules = {
	'@typescript-eslint/no-unused-vars': [
		'warn',
		{
			argsIgnorePattern: 'res|next|^err|on|config|^_',
			varsIgnorePattern: '^_',
			ignoreRestSiblings: true,
		},
	],
	'@typescript-eslint/consistent-type-definitions': ['error', 'type'],
	'@typescript-eslint/consistent-type-imports': [
		'warn',
		{
			prefer: 'type-imports',
			disallowTypeAnnotations: false,
		},
	],
	'@typescript-eslint/no-explicit-any': 'warn',
	'@typescript-eslint/no-shadow': ['error'],
	'no-unused-vars': 'off',
};

// Shared code quality rules for all file types (JS/TS, Astro)
const sharedCodeQualityRules = {
	'no-mixed-spaces-and-tabs': ['error', 'smart-tabs'],
	'no-tabs': ['warn', { allowIndentationTabs: true }],
	'default-param-last': 'off',
	'no-debugger': 'off',
	'no-else-return': 'off',
	'no-alert': 'off',
	'no-await-in-loop': 'off',
	'no-return-assign': ['error', 'except-parens'],
	'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
	'prefer-const': ['error', { destructuring: 'all' }],
	'arrow-body-style': ['error', 'as-needed'],
	'no-unused-expressions': ['error', { allowTaggedTemplates: true }],
	'no-param-reassign': ['error', { props: false }],
	'no-console': 'off',
	'func-names': 'off',
	'space-before-function-paren': 'off',
	'comma-dangle': 'off',
	'max-len': 'off',
	'no-underscore-dangle': 'off',
	'consistent-return': 'off',
	'no-use-before-define': 'off',
	'no-shadow': 'off',
	'no-prototype-builtins': 'off',
	radix: 'off',
	quotes: ['error', 'single', { avoidEscape: true }],
	'newline-per-chained-call': 'off',
};

export default defineConfig([
	globalIgnores([
		'**/dist/**',
		'**/node_modules/**',
		'**/out/**',
		'**/.cache/**',
		'**/coverage/**',
		'**/*.config.js',
		'**/*.config.mjs',
		'**/*.config.ts',
		'**/storyblok.d.ts',
		'**/storyblok-generated/**',
		'**/.astro/**',
	]),

	// Main configuration
	{
		files: ['**/*.{js,mjs,cjs,jsx,ts,tsx}'],

		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: {
				...globals.browser,
				...globals.es2021,
				...globals.node,
			},
		},

		plugins: {
			react,
			'react-hooks': reactHooks,
			'jsx-a11y': jsxA11y,
			sonarjs,
			'no-relative-import-paths': noRelativeImportPaths,
			prettier: prettierPlugin,
		},

		extends: [
			js.configs.recommended,
			...tseslint.configs.recommended,
			reactHooks.configs.flat.recommended,
			prettierConfig,
		],

		settings: {
			react: {
				version: 'detect',
			},
		},

		rules: {
			// Shared rules
			...sharedTypeScriptRules,
			...sharedCodeQualityRules,

			// React rules
			...react.configs.recommended.rules,
			...reactHooks.configs.recommended.rules,
			'react/function-component-definition': [
				'warn',
				{
					namedComponents: 'arrow-function',
					unnamedComponents: 'arrow-function',
				},
			],
			'react/display-name': 'off',
			'react/no-array-index-key': 'off',
			'react/no-danger': 'off',
			'react/react-in-jsx-scope': 'off',
			'react/prefer-stateless-function': 'off',
			'react/forbid-prop-types': 'off',
			'react/no-unescaped-entities': 'off',
			'react/require-default-props': 'off',
			'react/jsx-props-no-spreading': 'off',
			'react/jsx-no-target-blank': 'off',
			'react/jsx-filename-extension': [
				'warn',
				{
					extensions: ['.js', '.jsx', '.tsx'],
				},
			],
			'react/prop-types': 'off',
			'react/button-has-type': ['error', { reset: true }],
			'react-hooks/set-state-in-effect': 'warn',

			// JSX a11y rules
			'jsx-a11y/accessible-emoji': 'off',
			'jsx-a11y/href-no-hash': 'off',
			'jsx-a11y/anchor-is-valid': [
				'warn',
				{
					aspects: ['invalidHref'],
				},
			],
			'jsx-a11y/click-events-have-key-events': 'off',
			'jsx-a11y/no-noninteractive-element-interactions': 'off',
			'jsx-a11y/no-static-element-interactions': 'off',
			'jsx-a11y/label-has-associated-control': [
				'error',
				{
					required: {
						some: ['nesting', 'id'],
					},
				},
			],

			// SonarJS rules
			'sonarjs/prefer-immediate-return': 'off',
			'sonarjs/no-duplicate-string': 'warn',

			// No relative import paths
			'no-relative-import-paths/no-relative-import-paths': [
				'error',
				{
					allowSameFolder: true,
				},
			],

			// Prettier rules
			'prettier/prettier': 'error',
		},
	},

	// Astro files configuration
	...astro.configs.recommended,
	{
		files: ['**/*.astro'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser,
			},
		},
		plugins: {
			'@typescript-eslint': tseslint.plugin,
		},
		rules: {
			...sharedTypeScriptRules,
			...sharedCodeQualityRules,
			'react/jsx-filename-extension': 'off',
			'react/no-unknown-property': 'off',
		},
	},

	// Libraries use relative imports
	{
		files: ['packages/libs/basedrum/**/*', 'packages/libs/storyblok/**/*'],
		rules: {
			'no-relative-import-paths/no-relative-import-paths': 'off',
		},
	},
]);
