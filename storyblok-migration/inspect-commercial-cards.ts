/**
 * Inspects CommercialCardGroup blocks in production to understand how
 * they reference products, so we can fix broken links in the hackathon space.
 *
 * Usage:
 *   cd storyblok-migration
 *   tsx inspect-commercial-cards.ts [prefix]
 *
 * Default prefix: b2c/navigation/car-gps
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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function mapiGet(token: string, space: string, path: string): Promise<Record<string, unknown>> {
	const res = await fetch(`${MAPI}/${space}/${path}`, { headers: { Authorization: token } })
	if (res.status === 429) {
		await delay(2000)
		return mapiGet(token, space, path)
	}
	return res.json() as Promise<Record<string, unknown>>
}

type StoryMeta = { id: number; full_slug: string; is_folder: boolean; uuid: string }

async function listStories(token: string, space: string, prefix: string): Promise<StoryMeta[]> {
	const stories: StoryMeta[] = []
	let page = 1
	while (true) {
		const data = await mapiGet(token, space, `stories?starts_with=${prefix}&per_page=100&page=${page}`)
		const batch = (data.stories ?? []) as StoryMeta[]
		if (!batch.length) break
		stories.push(...batch)
		page++
		await delay(150)
	}
	return stories
}

function findComponent(obj: unknown, name: string, pathStr = 'root'): Array<{ path: string; block: Record<string, unknown> }> {
	const results: Array<{ path: string; block: Record<string, unknown> }> = []
	if (Array.isArray(obj)) {
		obj.forEach((item, i) => results.push(...findComponent(item, name, `${pathStr}[${i}]`)))
	} else if (obj && typeof obj === 'object') {
		const block = obj as Record<string, unknown>
		if (block.component === name) results.push({ path: pathStr, block })
		for (const [k, v] of Object.entries(block)) {
			results.push(...findComponent(v, name, `${pathStr}.${k}`))
		}
	}
	return results
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function describeValue(v: unknown, indent = '      '): string {
	if (typeof v === 'string') {
		if (UUID_RE.test(v)) return `UUID string: ${v}`
		return `string: "${v.slice(0, 60)}"`
	}
	if (Array.isArray(v)) {
		if (v.length === 0) return 'empty array'
		const first = v[0]
		if (typeof first === 'string' && UUID_RE.test(first)) return `UUID array (${v.length}): [${v.slice(0, 3).join(', ')}]`
		return `array of ${v.length}`
	}
	if (v && typeof v === 'object') {
		const block = v as Record<string, unknown>
		if (block.fieldtype === 'multilink') return `multilink linktype=${block.linktype} id=${block.id} cached_url=${block.cached_url}`
		return `object keys=[${Object.keys(block).join(', ')}]`
	}
	return String(v)
}

async function main() {
	console.log(`=== Inspect CommercialCardGroup ===`)
	console.log(`Prefix: ${PREFIX}`)
	console.log()

	// List stories in production
	const srcStories = await listStories(SOURCE_TOKEN, SOURCE_SPACE, PREFIX)
	const contentStories = srcStories.filter(s => !s.is_folder)
	console.log(`Production: ${contentStories.length} content stories under ${PREFIX}`)

	// Build target slug→uuid map
	console.log('Building hackathon slug→uuid map...')
	const tgtAll = await listStories(TARGET_TOKEN, TARGET_SPACE, 'b2c/navigation')
	const tgtSlugToUuid = new Map<string, string>()
	for (const s of tgtAll) tgtSlugToUuid.set(s.full_slug.replace(/\/$/, ''), s.uuid)
	console.log(`Hackathon map: ${tgtSlugToUuid.size} entries`)
	console.log()

	// Also build source uuid→slug map for cross-referencing
	const srcAll = await listStories(SOURCE_TOKEN, SOURCE_SPACE, 'b2c/navigation')
	const srcUuidToSlug = new Map<string, string>()
	for (const s of srcAll) srcUuidToSlug.set(s.uuid, s.full_slug.replace(/\/$/, ''))
	console.log(`Production uuid→slug: ${srcUuidToSlug.size} entries`)
	console.log()

	let foundCount = 0
	for (const meta of contentStories) {
		const data = await mapiGet(SOURCE_TOKEN, SOURCE_SPACE, `stories/${meta.id}`)
		const story = (data.story ?? {}) as { content: Record<string, unknown>; full_slug: string }
		await delay(100)

		const blocks = findComponent(story.content, 'CommercialCardGroup')
		if (blocks.length === 0) continue

		foundCount++
		console.log(`\n=== ${meta.full_slug} ===`)
		console.log(`  CommercialCardGroup blocks: ${blocks.length}`)

		for (const { path: blockPath, block } of blocks.slice(0, 3)) {
			console.log(`\n  Block at: ${blockPath}`)
			const nonMeta = Object.entries(block).filter(([k]) => !k.startsWith('_') && k !== 'component' && k !== 'uid')
			for (const [k, v] of nonMeta) {
				const desc = describeValue(v)
				console.log(`    ${k}: ${desc}`)

				// If it's a UUID string, show what slug it resolves to
				if (typeof v === 'string' && UUID_RE.test(v)) {
					const slug = srcUuidToSlug.get(v)
					const tgtUuid = slug ? tgtSlugToUuid.get(slug) : undefined
					console.log(`      → production slug: ${slug ?? '(not found)'}`)
					console.log(`      → hackathon uuid: ${tgtUuid ?? '(missing!)'}`)
				}

				// If it's a UUID array
				if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string' && UUID_RE.test(v[0] as string)) {
					for (const uuid of v as string[]) {
						const slug = srcUuidToSlug.get(uuid)
						const tgtUuid = slug ? tgtSlugToUuid.get(slug) : undefined
						console.log(`      UUID ${uuid} → slug: ${slug ?? '?'} → hackathon: ${tgtUuid ?? '(missing!)'}`)
					}
				}

				// If it's an array of objects, inspect each
				if (Array.isArray(v)) {
					for (const [i, item] of v.slice(0, 2).entries()) {
						if (item && typeof item === 'object') {
							const itemBlock = item as Record<string, unknown>
							const comp = itemBlock.component ?? '?'
							console.log(`      [${i}] ${comp}:`)
							for (const [ik, iv] of Object.entries(itemBlock)) {
								if (ik.startsWith('_') || ik === 'component' || ik === 'uid') continue
								const idesc = describeValue(iv)
								console.log(`        ${ik}: ${idesc}`)
								if (typeof iv === 'string' && UUID_RE.test(iv)) {
									const slug = srcUuidToSlug.get(iv)
									const tgtUuid = slug ? tgtSlugToUuid.get(slug) : undefined
									console.log(`          → slug: ${slug ?? '?'} → hackathon: ${tgtUuid ?? '(missing!)'}`)
								}
							}
						}
					}
				}
			}
		}
	}

	if (foundCount === 0) {
		console.log('No CommercialCardGroup blocks found under this prefix.')

		// Also check the category startpage (may be indexed differently)
		console.log('\nTrying direct slug fetch...')
		try {
			const data = await mapiGet(SOURCE_TOKEN, SOURCE_SPACE, `stories?with_slug=${PREFIX}`)
			const stories = (data.stories ?? []) as StoryMeta[]
			for (const s of stories) {
				const full = await mapiGet(SOURCE_TOKEN, SOURCE_SPACE, `stories/${s.id}`)
				const story = (full.story ?? {}) as { content: Record<string, unknown>; full_slug: string }
				const blocks = findComponent(story.content, 'CommercialCardGroup')
				console.log(`  ${s.full_slug}: ${blocks.length} CommercialCardGroup blocks`)
				// Show all components on this page
				const allComponents = new Set<string>()
				function collectComponents(obj: unknown): void {
					if (Array.isArray(obj)) obj.forEach(collectComponents)
					else if (obj && typeof obj === 'object') {
						const block = obj as Record<string, unknown>
						if (block.component) allComponents.add(block.component as string)
						Object.values(block).forEach(collectComponents)
					}
				}
				collectComponents(story.content)
				console.log(`  Components used: ${[...allComponents].join(', ')}`)
			}
		} catch (e) {
			console.log(`  Error: ${e}`)
		}
	}
}

main().catch(err => {
	console.error('Fatal:', err)
	process.exit(1)
})
