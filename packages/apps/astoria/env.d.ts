/// <reference path="../../../node_modules/@storyblok/astro/storyblok.d.ts" />
/// <reference types="astro/client" />

declare global {
	interface Window {
		StoryblokBridge: new (config?: Record<string, unknown>) => {
			on: (events: string | string[], callback: (event?: unknown) => void) => void;
		};
	}
}

export {};
