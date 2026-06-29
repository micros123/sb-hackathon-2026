import basedrumPreset from 'basedrum/basedrum.preset';

/** @type {import('tailwindcss').Config} */
export default {
	presets: [basedrumPreset],
	content: ['./src/**/*.{js,ts,jsx,tsx,astro}'],
	theme: {
		extend: {},
	},
	plugins: [],
};
