import { describe, test, expect } from 'vitest';
import { replaceStoryblokMediaUrlsWithCDN } from './replaceStoryblokMediaUrlsWithCDN';

describe('Replace Storyblok media urls with CDN', () => {
	const SPACE_ID = '178460';
	const storyblokUrl = `https://a.storyblok.com/f/${SPACE_ID}/100x/abcde12345/some-image-1200x1200.jpg`;
	const tomtomUrl = `https://media.tomtom.com/f/${SPACE_ID}/100x/abcde12345/some-image-1200x1200.jpg`;
	const originalJson = { foo: 'bar', visualUrl: storyblokUrl };

	test('Should replace storyblok asset urls in json with media.tomtom.com', () => {
		const resultJson = replaceStoryblokMediaUrlsWithCDN(originalJson);

		expect(resultJson?.visualUrl).toMatch(tomtomUrl);
	});

	test('Should not replace storyblok asset urls for invalid spaces', () => {
		const otherUrl = storyblokUrl.replace(SPACE_ID, '123456');
		const otherJson = { foo: 'bar', visualUrl: otherUrl };
		const resultJson = replaceStoryblokMediaUrlsWithCDN(otherJson);

		expect(resultJson?.visualUrl).toMatch(otherUrl);
	});

	test('Should return null when input is null', () => {
		const result = replaceStoryblokMediaUrlsWithCDN(null);

		expect(result).toBeNull();
	});

	test('Should return undefined when input is undefined', () => {
		const result = replaceStoryblokMediaUrlsWithCDN(undefined);

		expect(result).toBeUndefined();
	});

	test('Should handle null values within object', () => {
		const jsonWithNull = { foo: 'bar', visualUrl: null };
		const result = replaceStoryblokMediaUrlsWithCDN(jsonWithNull);

		expect(result).toEqual(jsonWithNull);
		expect(result?.visualUrl).toBeNull();
	});

	test('Should handle undefined values within object', () => {
		const jsonWithUndefined = { foo: 'bar', visualUrl: undefined };
		const result = replaceStoryblokMediaUrlsWithCDN(jsonWithUndefined);

		//* Note: undefined values are lost during JSON.stringify/parse
		expect(result).toEqual({ foo: 'bar' });
		expect(result?.visualUrl).toBeUndefined();
	});
});
