/**
 * Migrates b2b + b2c + _components stories from TomTom production Storyblok
 * space to the hackathon space as drafts. Never publishes. Assets are kept
 * as-is (original TomTom CDN URLs remain in content for now).
 *
 * Usage:
 *   cd storyblok-migration
 *   tsx migrate-stories.ts
 *
 * Idempotent: skips stories whose slug already exists in the target space.
 * Re-run after partial failures to continue from where it left off.
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

const readEnv = (key: string): string => envMap.get(key) ?? ''

const SOURCE_TOKEN = readEnv('TOMTOM_STORYBLOK_TOKEN')
const TARGET_TOKEN = readEnv('HACKATHON_STORYBLOK_TOKEN')
const SOURCE_SPACE = readEnv('TOMTOM_SPACE_ID')
const TARGET_SPACE = readEnv('HACKATHON_SPACE_ID')
const MAPI = 'https://mapi.storyblok.com/v1/spaces'

const EXCLUDED_PREFIXES = [
	'b2b/newsroom',
	'b2b/legal',
	'b2b/press-releases',
	'b2b/careers',
	'b2c/newsroom',
	'b2c/legal',
	'b2c/press-releases',
	'b2c/careers',
]

type StoryMeta = {
	id: number
	name: string
	slug: string
	full_slug: string
	is_folder: boolean
	parent_id: number
}

type StoryFull = StoryMeta & {
	content: Record<string, unknown>
	is_startpage: boolean
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const MAX_RETRIES = 5

async function mapiGet(token: string, url: string, attempt = 0): Promise<Response> {
	const res = await fetch(url, { headers: { Authorization: token } })
	if (res.status === 429) {
		if (attempt >= MAX_RETRIES) throw new Error(`Rate limit exceeded after ${MAX_RETRIES} retries: ${url}`)
		console.log(`  rate limited, waiting 2s... (attempt ${attempt + 1}/${MAX_RETRIES})`)
		await delay(2000)
		return mapiGet(token, url, attempt + 1)
	}
	return res
}

async function mapiPost(token: string, url: string, body: unknown, attempt = 0): Promise<Response> {
	const res = await fetch(url, {
		method: 'POST',
		headers: { Authorization: token, 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
	if (res.status === 429) {
		if (attempt >= MAX_RETRIES) throw new Error(`Rate limit exceeded after ${MAX_RETRIES} retries: ${url}`)
		console.log(`  rate limited, waiting 2s... (attempt ${attempt + 1}/${MAX_RETRIES})`)
		await delay(2000)
		return mapiPost(token, url, body, attempt + 1)
	}
	return res
}

async function listAllStories(token: string, spaceId: string, prefix: string): Promise<StoryMeta[]> {
	const stories: StoryMeta[] = []
	let page = 1
	while (true) {
		const res = await mapiGet(token, `${MAPI}/${spaceId}/stories?starts_with=${prefix}&per_page=100&page=${page}`)
		const data = await res.json() as { stories: StoryMeta[] }
		if (!data.stories?.length) break
		stories.push(...data.stories)
		process.stdout.write(`\r  ${prefix}: ${stories.length} stories listed...`)
		page++
		await delay(200)
	}
	console.log()
	return stories
}

async function fetchFullStory(token: string, spaceId: string, storyId: number): Promise<StoryFull> {
	const res = await mapiGet(token, `${MAPI}/${spaceId}/stories/${storyId}`)
	if (!res.ok) {
		const body = await res.text()
		throw new Error(`Failed to fetch story ${storyId}: ${res.status} ${body.slice(0, 120)}`)
	}
	const data = await res.json() as { story: StoryFull }
	return data.story
}

async function listTargetStories(token: string, spaceId: string): Promise<StoryMeta[]> {
	const [b2b, b2c, components] = await Promise.all([
		listAllStories(token, spaceId, 'b2b'),
		listAllStories(token, spaceId, 'b2c'),
		listAllStories(token, spaceId, '_components'),
	])
	return [...b2b, ...b2c, ...components]
}

async function createStory(
	token: string,
	spaceId: string,
	story: StoryFull,
	targetParentId: number,
): Promise<StoryMeta | null> {
	const payload = {
		story: {
			name: story.name,
			slug: story.slug,
			content: story.content,
			parent_id: targetParentId,
			is_folder: story.is_folder,
			is_startpage: story.is_startpage,
		},
		publish: false,
	}
	const res = await mapiPost(token, `${MAPI}/${spaceId}/stories`, payload)
	if (!res.ok) {
		const err = await res.text()
		if (res.status === 422 && err.includes('already taken')) {
			return null
		}
		console.log(`  ✗ failed to create "${story.full_slug}": ${res.status} ${err.slice(0, 120)}`)
		return null
	}
	const data = await res.json() as { story: StoryMeta }
	return data.story
}

async function main() {
	if (!SOURCE_TOKEN || !TARGET_TOKEN || !SOURCE_SPACE || !TARGET_SPACE) {
		console.error('Missing required env vars. Check .env file.')
		process.exit(1)
	}

	console.log('=== Storyblok story migration ===')
	console.log(`Source: space ${SOURCE_SPACE}  →  Target: space ${TARGET_SPACE}`)
	console.log()

	console.log('Listing source stories...')
	const [b2bStories, b2cStories, componentStories] = await Promise.all([
		listAllStories(SOURCE_TOKEN, SOURCE_SPACE, 'b2b'),
		listAllStories(SOURCE_TOKEN, SOURCE_SPACE, 'b2c'),
		listAllStories(SOURCE_TOKEN, SOURCE_SPACE, '_components'),
	])

	const allSourceStories = [...b2bStories, ...b2cStories, ...componentStories]
	const isExcluded = (story: StoryMeta) =>
		EXCLUDED_PREFIXES.some(prefix => story.full_slug.startsWith(prefix))

	const toMigrate = allSourceStories
		.filter(s => !isExcluded(s))
		.sort((a, b) => {
			const depthA = a.full_slug.split('/').filter(Boolean).length
			const depthB = b.full_slug.split('/').filter(Boolean).length
			if (depthA !== depthB) return depthA - depthB
			if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1
			return 0
		})

	const excluded = allSourceStories.length - toMigrate.length
	console.log(`Total source stories: ${allSourceStories.length}`)
	console.log(`Excluded (newsroom/legal/etc): ${excluded}`)
	console.log(`To migrate: ${toMigrate.length}`)
	console.log()

	console.log('Loading existing stories in target space...')
	const existingTargetStories = await listTargetStories(TARGET_TOKEN, TARGET_SPACE)
	const existingSlugs = new Set(existingTargetStories.map(s => s.full_slug))
	console.log(`Target already has ${existingSlugs.size} stories. Will skip those slugs.`)
	console.log()

	const sourceIdSet = new Set(toMigrate.map(s => s.id))
	const sourceToTargetId = new Map<number, number>()

	for (const sourceMeta of toMigrate) {
		const existingTargetStory = existingTargetStories.find(t => t.full_slug === sourceMeta.full_slug)
		if (existingTargetStory) {
			sourceToTargetId.set(sourceMeta.id, existingTargetStory.id)
		}
	}

	let created = 0
	let skipped = 0
	let failed = 0

	console.log('Migrating stories...')
	for (const sourceMeta of toMigrate) {
		if (existingSlugs.has(sourceMeta.full_slug)) {
			skipped++
			continue
		}

		const resolvedParentId = sourceIdSet.has(sourceMeta.parent_id)
			? (sourceToTargetId.get(sourceMeta.parent_id) ?? 0)
			: 0

		const fullStory = await fetchFullStory(SOURCE_TOKEN, SOURCE_SPACE, sourceMeta.id)
		await delay(200)

		const createdStory = await createStory(TARGET_TOKEN, TARGET_SPACE, fullStory, resolvedParentId)
		await delay(200)

		if (createdStory) {
			sourceToTargetId.set(sourceMeta.id, createdStory.id)
			created++
			if (created % 25 === 0) {
				console.log(`  ${created} created, ${skipped} skipped, ${failed} failed (total processed: ${created + skipped + failed}/${toMigrate.length})`)
			}
		} else {
			failed++
		}
	}

	console.log()
	console.log('=== Done ===')
	console.log(`Created: ${created}`)
	console.log(`Skipped (already exist): ${skipped}`)
	console.log(`Failed: ${failed}`)
	console.log(`Total processed: ${created + skipped + failed} / ${toMigrate.length}`)
}

main().catch(err => {
	console.error('Fatal error:', err)
	process.exit(1)
})
