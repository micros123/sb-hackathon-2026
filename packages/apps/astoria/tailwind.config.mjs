import basedrumPreset from 'basedrum/basedrum.preset';

/** @type {import('tailwindcss').Config} */
export default {
	presets: [basedrumPreset],
	content: [
		'./src/**/*.{js,ts,jsx,tsx,astro}',
		'./node_modules/basedrum/components/**/*.{js,ts,jsx,tsx,html}',
	],
	theme: {
		extend: {},
	},
	plugins: [],
};
