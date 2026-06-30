// @ts-check
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import netlify from '@astrojs/netlify';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import { storyblok } from '@storyblok/astro';
import { loadEnv } from 'vite';

const mode = process.env.MODE ?? 'development';
const env = loadEnv(mode, 'environments', '');
const accessToken = env.PUBLIC_STORYBLOK_ACCESS_TOKEN;
const region = env.PUBLIC_STORYBLOK_REGION || 'eu';

//* Adapter is chosen per deploy target: Netlify serverless when
//* DEPLOY_TARGET=netlify (set in netlify.toml), otherwise the standalone Node
//* server (local preview, Docker/KAAP).
const adapter = process.env.DEPLOY_TARGET === 'netlify' ? netlify() : node({ mode: 'standalone' });

export default defineConfig({
	output: 'server',
	server: { port: 3000 },
	adapter,
	trailingSlash: 'ignore',

	//* Disable image optimisation so the native `sharp` dependency is not needed.
	image: { service: { entrypoint: 'astro/assets/services/noop' } },

	env: {
		schema: {
			PUBLIC_STORYBLOK_ACCESS_TOKEN: envField.string({ context: 'server', access: 'public' }),
			PUBLIC_STORYBLOK_REGION: envField.string({
				context: 'server',
				access: 'public',
				default: 'eu',
			}),
			STORYBLOK_CONTENT_VERSION: envField.string({
				context: 'server',
				access: 'public',
				default: 'draft',
			}),
		},
	},

	vite: {
		envDir: 'environments',
		resolve: {
			alias: {
				components: '/src/components',
				layouts: '/src/layouts',
				utils: '/src/utils',
				styles: '/src/styles',
			},
		},
	},

	integrations: [
		tailwind(),
		react(),
		storyblok({
			accessToken,
			apiOptions: { region },
			componentsDir: 'src/components/storyblok',
			components: {
				Page: 'Page',
				HomePageOverlay: 'HomePageOverlay',
				TaglineWithCards: 'TaglineWithCards',
				Article: 'Article',
				ArticleGroup: 'ArticleGroup',
				TripleBlocks: 'TripleBlocks',
				CardsSet: 'CardsSet',
				VisualsReel: 'VisualsReel',
				DividerLine: 'DividerLine',
				HeroSlider: 'HeroSlider',
				DoubleArticle: 'DoubleArticle',
				CommercialCardGroup: 'CommercialCardGroup',
			},
			enableFallbackComponent: true,
			customFallbackComponent: 'Blok',
		}),
	],
});
