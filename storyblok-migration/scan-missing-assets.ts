/**
 * Scans hackathon space stories for remaining production asset URLs.
 * Reports which stories still need asset migration.
 *
 * Usage:
 *   cd storyblok-migration
 *   tsx scan-missing-assets.ts [prefix]
 *
 * Default prefix: b2c
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

const TARGET_TOKEN = envMap.get('HACKATHON_STORYBLOK_TOKEN') ?? ''
const TARGET_SPACE = envMap.get('HACKATHON_SPACE_ID') ?? ''
const SOURCE_SPACE_ID = envMap.get('TOMTOM_SPACE_ID') ?? '178460'
const MAPI = 'https://mapi.storyblok.com/v1/spaces'

const PREFIX = process.argv[2] ?? 'b2c'

const SOURCE_ASSET_PATTERN = new RegExp(
	`https://a\\.storyblok\\.com/f/${SOURCE_SPACE_ID}/[^\\s"'<>]+`,
	'g',
)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type StoryMeta = { id: number; full_slug: string; is_folder: boolean }

async function mapiGet(url: string): Promise<Response> {
	const res = await fetch(url, { headers: { Authorization: TARGET_TOKEN } })
	if (res.status === 429) { await delay(2000); return mapiGet(url) }
	return res
}

async function listAllStories(prefix: string): Promise<StoryMeta[]> {
	const stories: StoryMeta[] = []
	let page = 1
	while (true) {
		const res = await mapiGet(`${MAPI}/${TARGET_SPACE}/stories?starts_with=${prefix}&per_page=100&page=${page}`)
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

function extractSourceUrls(obj: unknown, found: Set<string> = new Set()): Set<string> {
	if (typeof obj === 'string') {
		for (const match of obj.matchAll(SOURCE_ASSET_PATTERN)) found.add(match[0])
	} else if (Array.isArray(obj)) {
		for (const item of obj) extractSourceUrls(item, found)
	} else if (obj && typeof obj === 'object') {
		for (const value of Object.values(obj)) extractSourceUrls(value, found)
	}
	return found
}

async function main() {
	console.log(`=== Scan missing assets ===`)
	console.log(`Target space: ${TARGET_SPACE}`)
	console.log(`Prefix: ${PREFIX}`)
	console.log()

	const allStories = await listAllStories(PREFIX)
	const contentStories = allStories.filter(s => !s.is_folder)
	console.log(`${contentStories.length} content stories to check`)
	console.log()

	let withSourceUrls = 0
	let totalSourceUrls = 0
	const affectedStories: Array<{ slug: string; count: number }> = []

	for (let i = 0; i < contentStories.length; i++) {
		const meta = contentStories[i]
		const res = await mapiGet(`${MAPI}/${TARGET_SPACE}/stories/${meta.id}`)
		if (!res.ok) continue
		const data = await res.json() as { story: { content: Record<string, unknown> } }
		await delay(100)

		const sourceUrls = extractSourceUrls(data.story.content)
		if (sourceUrls.size > 0) {
			withSourceUrls++
			totalSourceUrls += sourceUrls.size
			affectedStories.push({ slug: meta.full_slug, count: sourceUrls.size })
		}

		if ((i + 1) % 100 === 0) {
			process.stdout.write(`\r  Checked ${i + 1}/${contentStories.length}, found ${withSourceUrls} stories with source URLs...`)
		}
	}

	console.log(`\r  Done checking ${contentStories.length} stories.                    `)
	console.log()
	console.log(`Stories with remaining source asset URLs: ${withSourceUrls}`)
	console.log(`Total source URL occurrences: ${totalSourceUrls}`)
	console.log()

	if (affectedStories.length > 0) {
		console.log('Affected stories:')
		for (const { slug, count } of affectedStories.slice(0, 30)) {
			console.log(`  ${slug} (${count} URLs)`)
		}
		if (affectedStories.length > 30) {
			console.log(`  ... and ${affectedStories.length - 30} more`)
		}
	}
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
