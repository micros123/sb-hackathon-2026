/**
 ** Prepare a www.tomtom.com page for component capture, then tag the target component's instances.
 ** Usage: read this file, set WANTED to the component name (e.g. ['HeroSlider']), and paste the whole
 ** function into the Playwright MCP `browser_evaluate` `function` argument. Run once per page, after every
 ** navigation/reload (the data-shot-index tags live on the DOM and are lost on reload).
 ** Returns { windowScrolls, instances: [{ i, name, w, h }] }:
 **  - windowScrolls=false → custom scroll container (the homepage); element shots come back blank — skip the page.
 **  - instances=[] → wrong slug, or the name isn't the live data-component-name — use the names-dump diagnostic.
 */
async () => {
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const main = document.querySelector('main') || document.body;

	//* COMPONENT-NAME ARGUMENT — set this to the name passed to the skill, e.g. ['HeroSlider'].
	//* Case-insensitive; an exact data-component-name match wins, substring is the fallback.
	//* ([] would capture every top-level component — not the normal path for this skill.)
	const WANTED = [];

	//* Dismiss geo-detection modal ("Hello! Looks like you are in: …") — click "Continue in <country>"
	//* then hide any leftover fixed overlay so it can't bleed into element screenshots.
	const geoBtn = Array.from(document.querySelectorAll('button, a, [role="button"]')).find((el) =>
		/continue in|shop in/i.test(el.textContent || '')
	);
	if (geoBtn) { geoBtn.click(); await sleep(300); }
	Array.from(document.querySelectorAll('div, section, dialog, aside'))
		.filter((el) => {
			const cs = getComputedStyle(el);
			return (cs.position === 'fixed' || Number(cs.zIndex) > 100) &&
				/looks like you are in|continue in/i.test(el.textContent || '');
		})
		.filter((el, _, arr) => !arr.some((o) => o !== el && o.contains(el)))
		.forEach((el) => el.style.setProperty('display', 'none', 'important'));

	//* Dismiss cookie consent (click "Accept all", then hide any leftover fixed banner)
	const accept = Array.from(document.querySelectorAll('button, a, [role="button"]')).find((el) =>
		/accept all/i.test(el.textContent || '')
	);
	if (accept) accept.click();
	await sleep(400);
	Array.from(document.querySelectorAll('div, section, aside'))
		.filter((el) => {
			const cs = getComputedStyle(el);
			return (
				(cs.position === 'fixed' || cs.position === 'sticky') &&
				/cookie|accept all|preferences/i.test(el.textContent || '') &&
				el.offsetHeight > 60
			);
		})
		.filter((el, _, arr) => !arr.some((o) => o !== el && o.contains(el))) // outermost only
		.forEach((el) => el.style.setProperty('display', 'none', 'important'));

	//* Hide the feedback widget (fixed tab whose label is exactly "Feedback", e.g. Mopinion)
	Array.from(document.querySelectorAll('button, a, div, span'))
		.filter((el) => (el.textContent || '').trim().toLowerCase() === 'feedback')
		.forEach((label) => {
			let node = label,
				fixed = null;
			while (node && node !== document.body) {
				if (getComputedStyle(node).position === 'fixed') {
					fixed = node;
					break;
				}
				node = node.parentElement;
			}
			(fixed || label).style.setProperty('display', 'none', 'important');
		});

	//* Hide the sticky secondary nav so it can't overlap the top of the component.
	const spy = main.querySelector('[data-component-name="SecondaryNavSpyBar"]');
	if (spy) spy.style.setProperty('display', 'none', 'important');

	//* Warm up lazy-loaded images/sections by scrolling the full height, then return to top.
	//* Track whether the window actually scrolls: if scrollY never moves, this page uses a custom scroll
	//* container (e.g. the homepage's HomePageOverlay) and BOTH warm-up and element capture fail (blank
	//* shots). The returned `windowScrolls: false` is your signal to bail to a normal content page.
	let maxScroll = 0;
	for (let y = 0; y <= document.body.scrollHeight; y += window.innerHeight) {
		window.scrollTo(0, y);
		await sleep(120);
		maxScroll = Math.max(maxScroll, window.scrollY);
	}
	window.scrollTo(0, 0);
	await sleep(300);

	//* Tag every element matching WANTED, keeping the outermost when same-name matches nest.
	const pool = Array.from(main.querySelectorAll('[data-component-name]'));
	const nameOf = (el) => (el.getAttribute('data-component-name') || '').toLowerCase();
	const wantedLower = WANTED.map((n) => n.toLowerCase());

	let hits = pool.filter((el) => wantedLower.includes(nameOf(el)));
	if (!hits.length) hits = pool.filter((el) => wantedLower.some((w) => nameOf(el).includes(w)));
	const targets = hits.filter((el) => !hits.some((other) => other !== el && other.contains(el)));

	targets.forEach((el, i) => el.setAttribute('data-shot-index', String(i)));

	return {
		windowScrolls: maxScroll > 0,
		instances: targets.map((el, i) => {
			const r = el.getBoundingClientRect();
			return {
				i,
				name: el.getAttribute('data-component-name'),
				w: Math.round(r.width),
				h: Math.round(r.height),
			};
		}),
	};
};
