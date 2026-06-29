/**
 * Fixes broken story links in hackathon space content.
 *
 * Handles two reference types:
 * 1. multilink fields: {fieldtype:"multilink", linktype:"story", id, cached_url}
 *    → fixed using cached_url as stable identifier
 * 2. bare story UUID fields: "67fb01b2-..." (e.g. CommercialCardGroupItem.product)
 *    → fixed using production-uuid→slug→hackathon-uuid cross-reference map
 *
 * Usage:
 *   cd storyblok-migration
 *   tsx fix-story-links.ts [story-slug]
 *
 * With no argument: processes all b2c stories.
 * With a slug: processes only stories under that prefix, e.g. b2c/navigation/car-gps
 */

import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const envMap: Map<string, string> = new Map(
	readFileSync(path.join(__dirname, '.env'), 'utf8')
		.split('\n')
		.filter(line => line.includes('='))
		.map(line => {
			const eqIndex = line.indexOf('=')
			return [line.slice(0, eqIndex), line.slice(eqIndex + 1).trim()] as [string, string]
		}),
)

const SOURCE_TOKEN = envMap.get('TOMTOM_STORYBLOK_TOKEN') ?? ''
const SOURCE_SPACE = envMap.get('TOMTOM_SPACE_ID') ?? ''
const TARGET_TOKEN = envMap.get('HACKATHON_STORYBLOK_TOKEN') ?? ''
const TARGET_SPACE = envMap.get('HACKATHON_SPACE_ID') ?? ''
const MAPI = 'https://mapi.storyblok.com/v1/spaces'

const PREFIX = process.argv[2] ?? 'b2c/navigation/car-gps'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type StoryMeta = {
	id: number
	uuid: string
	full_slug: string
	is_folder: boolean
}

type StoryFull = StoryMeta & {
	content: Record<string, unknown>
}

async function mapiGetWithToken(token: string, url: string): Promise<Response> {
	const res = await fetch(url, { headers: { Authorization: token } })
	if (res.status === 429) {
		await delay(2000)
		return mapiGetWithToken(token, url)
	}
	return res
}

const mapiGet = (url: string) => mapiGetWithToken(TARGET_TOKEN, url)

async function mapiPut(url: string, body: unknown): Promise<Response> {
	const res = await fetch(url, {
		method: 'PUT',
		headers: { Authorization: TARGET_TOKEN, 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
	if (res.status === 429) {
		await delay(2000)
		return mapiPut(url, body)
	}
	return res
}

async function listAllStories(token: string, space: string, prefix: string): Promise<StoryMeta[]> {
	const stories: StoryMeta[] = []
	let page = 1
	while (true) {
		const res = await mapiGetWithToken(
			token,
			`${MAPI}/${space}/stories?starts_with=${prefix}&per_page=100&page=${page}`,
		)
		const data = await res.json() as { stories: StoryMeta[] }
		if (!data.stories?.length) break
		stories.push(...data.stories)
		process.stdout.write(`\r  ${prefix}: ${stories.length} stories...`)
		page++
		await delay(200)
	}
	console.log()
	return stories
}

// Walk content and find all broken story links (multilink + bare UUID fields).
// slugToUuid: hackathon slug→uuid map for multilink cached_url resolution.
// srcUuidToTgtUuid: production-uuid→hackathon-uuid cross-reference for bare UUID fields.
function findBrokenLinks(
	obj: unknown,
	slugToUuid: Map<string, string>,
	srcUuidToTgtUuid: Map<string, string>,
	fixes: Array<{ path: string; cachedUrl: string; oldUuid: string; newUuid: string }>,
	pathStr = 'root',
	parentKey = '',
): void {
	if (Array.isArray(obj)) {
		obj.forEach((item, i) => findBrokenLinks(item, slugToUuid, srcUuidToTgtUuid, fixes, `${pathStr}[${i}]`))
	} else if (obj && typeof obj === 'object') {
		const block = obj as Record<string, unknown>
		if (
			block.fieldtype === 'multilink' &&
			block.linktype === 'story' &&
			typeof block.id === 'string' &&
			typeof block.cached_url === 'string' &&
			block.cached_url !== ''
		) {
			const cachedUrl = (block.cached_url as string).replace(/\/$/, '')
			const correctUuid = slugToUuid.get(cachedUrl)
			if (correctUuid && correctUuid !== block.id) {
				fixes.push({ path: pathStr, cachedUrl, oldUuid: block.id as string, newUuid: correctUuid })
			}
		} else {
			for (const [key, value] of Object.entries(block)) {
				if (key === '_uid') continue
				if (typeof value === 'string' && UUID_RE.test(value)) {
					const correctUuid = srcUuidToTgtUuid.get(value)
					if (correctUuid && correctUuid !== value) {
						fixes.push({ path: `${pathStr}.${key}`, cachedUrl: key, oldUuid: value, newUuid: correctUuid })
					}
				} else {
					findBrokenLinks(value, slugToUuid, srcUuidToTgtUuid, fixes, `${pathStr}.${key}`, key)
				}
			}
		}
	}
}

// Walk content and replace all story link UUIDs.
// Handles both multilink objects (via cached_url) and bare UUID strings (via srcUuidToTgtUuid).
function fixLinks(
	obj: unknown,
	slugToUuid: Map<string, string>,
	srcUuidToTgtUuid: Map<string, string>,
): unknown {
	if (Array.isArray(obj)) return obj.map(item => fixLinks(item, slugToUuid, srcUuidToTgtUuid))
	if (obj && typeof obj === 'object') {
		const block = obj as Record<string, unknown>
		if (
			block.fieldtype === 'multilink' &&
			block.linktype === 'story' &&
			typeof block.id === 'string' &&
			typeof block.cached_url === 'string'
		) {
			const cachedUrl = (block.cached_url as string).replace(/\/$/, '')
			const correctUuid = slugToUuid.get(cachedUrl)
			if (correctUuid) return { ...block, id: correctUuid }
			return block
		}
		return Object.fromEntries(
			Object.entries(block).map(([k, v]) => {
				if (k === '_uid') return [k, v]
				if (typeof v === 'string' && UUID_RE.test(v)) {
					const correctUuid = srcUuidToTgtUuid.get(v)
					return [k, correctUuid ?? v]
				}
				return [k, fixLinks(v, slugToUuid, srcUuidToTgtUuid)]
			}),
		)
	}
	return obj
}

const EMPTY_RICHTEXT = { type: 'doc', content: [] }

// Patch content data quality issues that Storyblok schema validation rejects:
// 1. Richtext fields holding "" instead of a prosemirror document
// 2. Array fields holding [null] instead of []
function patchContentForValidation(obj: unknown): unknown {
	if (Array.isArray(obj)) {
		// [null] → [] (array with only null entries is invalid for blok array fields)
		if (obj.every(item => item === null)) return []
		return obj.map(patchContentForValidation)
	}
	if (obj && typeof obj === 'object') {
		return Object.fromEntries(
			Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
				k,
				k === 'title' && v === '' ? EMPTY_RICHTEXT : patchContentForValidation(v),
			]),
		)
	}
	return obj
}

async function main() {
	if (!TARGET_TOKEN || !TARGET_SPACE) {
		console.error('Missing required env vars.')
		process.exit(1)
	}

	console.log('=== Fix story links ===')
	console.log(`Target space: ${TARGET_SPACE}`)
	console.log(`Processing prefix: ${PREFIX}`)
	console.log()

	// Step 1: build slug→uuid map for all stories in target (hackathon) space
	console.log('Building hackathon slug→uuid map...')
	const tgtAllStories: StoryMeta[] = []
	for (const prefix of ['b2b', 'b2c', '_components']) {
		const stories = await listAllStories(TARGET_TOKEN, TARGET_SPACE, prefix)
		tgtAllStories.push(...stories)
	}
	const slugToUuid = new Map<string, string>()
	for (const story of tgtAllStories) {
		const slug = story.full_slug.replace(/\/$/, '')
		slugToUuid.set(slug, story.uuid)
	}
	console.log(`Hackathon map: ${slugToUuid.size} slug→uuid entries`)
	console.log()

	// Step 2: build production uuid→slug map, then derive srcUuid→tgtUuid cross-reference
	// This fixes bare story UUID fields (e.g. CommercialCardGroupItem.product) that have no
	// cached_url to use as lookup key.
	let srcUuidToTgtUuid = new Map<string, string>()
	if (SOURCE_TOKEN && SOURCE_SPACE) {
		console.log('Building production uuid→slug cross-reference...')
		const srcAllStories: StoryMeta[] = []
		for (const prefix of ['b2b', 'b2c', '_components']) {
			const stories = await listAllStories(SOURCE_TOKEN, SOURCE_SPACE, prefix)
			srcAllStories.push(...stories)
		}
		let crossRefCount = 0
		for (const srcStory of srcAllStories) {
			const slug = srcStory.full_slug.replace(/\/$/, '')
			const tgtUuid = slugToUuid.get(slug)
			if (tgtUuid && tgtUuid !== srcStory.uuid) {
				srcUuidToTgtUuid.set(srcStory.uuid, tgtUuid)
				crossRefCount++
			}
		}
		console.log(`Cross-reference: ${crossRefCount} production→hackathon UUID pairs`)
		console.log()
	}

	// Step 3: list stories to process
	console.log(`Listing stories under ${PREFIX}...`)
	const toProcess = await listAllStories(TARGET_TOKEN, TARGET_SPACE, PREFIX)
	const contentStories = toProcess.filter(s => !s.is_folder)
	console.log(`${contentStories.length} content stories to process`)
	console.log()

	let fixed = 0
	let skipped = 0
	let failed = 0

	// Step 4: process each story
	for (const meta of contentStories) {
		const res = await mapiGet(`${MAPI}/${TARGET_SPACE}/stories/${meta.id}`)
		if (!res.ok) { failed++; continue }
		const data = await res.json() as { story: StoryFull }
		const story = data.story
		await delay(150)

		// Dry-run: find broken links
		const brokenLinks: Array<{ path: string; cachedUrl: string; oldUuid: string; newUuid: string }> = []
		findBrokenLinks(story.content, slugToUuid, srcUuidToTgtUuid, brokenLinks)

		if (brokenLinks.length === 0) {
			skipped++
			continue
		}

		console.log(`  ${story.full_slug}: ${brokenLinks.length} broken links`)
		for (const fix of brokenLinks.slice(0, 3)) {
			console.log(`    ${fix.cachedUrl}: ${fix.oldUuid.slice(0, 8)}... → ${fix.newUuid.slice(0, 8)}...`)
		}
		if (brokenLinks.length > 3) console.log(`    ... (${brokenLinks.length - 3} more)`)

		// Apply fix
		const fixedContent = fixLinks(story.content, slugToUuid, srcUuidToTgtUuid)
		const patchedContent = patchContentForValidation(fixedContent)

		const updateRes = await mapiPut(`${MAPI}/${TARGET_SPACE}/stories/${story.id}`, {
			story: { content: patchedContent },
			publish: false,
			force_update: 1,
		})
		await delay(200)

		if (updateRes.ok) {
			fixed++
		} else {
			const err = await updateRes.text()
			console.log(`  ✗ update failed ${story.full_slug}: ${updateRes.status} ${err.slice(0, 120)}`)
			failed++
		}
	}

	console.log()
	console.log('=== Done ===')
	console.log(`Fixed: ${fixed}`)
	console.log(`Skipped (no broken links): ${skipped}`)
	console.log(`Failed: ${failed}`)
}

main().catch(err => {
	console.error('Fatal error:', err)
	process.exit(1)
})
