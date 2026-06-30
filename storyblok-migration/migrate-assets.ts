/**
 * Migrates assets referenced by stories from TomTom production Storyblok
 * space to the hackathon space. Updates each story's content to reference
 * the new asset URLs.
 *
 * Usage:
 *   cd storyblok-migration
 *   tsx migrate-assets.ts
 *
 * Idempotent: skips assets already present in the target space (matched by
 * filename). Stories that still reference source URLs are re-processed; stories
 * whose content already has no source URLs are skipped.
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

// Source URL pattern: a.storyblok.com/f/<source-space-id>/
const SOURCE_ASSET_PATTERN = new RegExp(
	`https://a\\.storyblok\\.com/f/${SOURCE_SPACE_ID}/[^\\s"'<>]+`,
	'g',
)

// Prefixes to process — override with CLI args (e.g. tsx migrate-assets.ts b2c)
const STORY_PREFIXES = process.argv.length > 2 ? process.argv.slice(2) : ['b2b', 'b2c']

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type StoryMeta = {
	id: number
	full_slug: string
	is_folder: boolean
}

type StoryFull = StoryMeta & {
	content: Record<string, unknown>
}

type AssetSignResponse = {
	id: number
	post_url: string
	fields: Record<string, string>
	filename: string
}

async function mapiGet(token: string, url: string, attempt = 0): Promise<Response> {
	try {
		const res = await fetch(url, { headers: { Authorization: token } })
		if (res.status === 429) { await delay(2000); return mapiGet(token, url, attempt) }
		return res
	} catch (err) {
		if (attempt >= 4) throw err
		await delay(3000 * (attempt + 1))
		return mapiGet(token, url, attempt + 1)
	}
}

async function mapiPut(token: string, url: string, body: unknown, attempt = 0): Promise<Response> {
	try {
		const res = await fetch(url, {
			method: 'PUT',
			headers: { Authorization: token, 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		if (res.status === 429) { await delay(2000); return mapiPut(token, url, body, attempt) }
		return res
	} catch (err) {
		if (attempt >= 4) throw err
		await delay(3000 * (attempt + 1))
		return mapiPut(token, url, body, attempt + 1)
	}
}

async function listAllStories(prefix: string): Promise<StoryMeta[]> {
	const stories: StoryMeta[] = []
	let page = 1
	while (true) {
		const res = await mapiGet(
			TARGET_TOKEN,
			`${MAPI}/${TARGET_SPACE}/stories?starts_with=${prefix}&per_page=100&page=${page}`,
		)
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

function replaceUrls(obj: unknown, urlMap: Map<string, string>): unknown {
	if (typeof obj === 'string') {
		let result = obj
		for (const [oldUrl, newUrl] of urlMap) result = result.replaceAll(oldUrl, newUrl)
		return result
	}
	if (Array.isArray(obj)) return obj.map(item => replaceUrls(item, urlMap))
	if (obj && typeof obj === 'object') {
		return Object.fromEntries(
			Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, replaceUrls(v, urlMap)]),
		)
	}
	return obj
}

const EMPTY_RICHTEXT = { type: 'doc', content: [] }

// Some components (e.g. CenteredCards) have richtext title fields that hold
// "" in production content. The hackathon schema rejects empty strings for
// richtext fields — patch to an empty prosemirror document.
function patchEmptyRichtextFields(obj: unknown): unknown {
	if (Array.isArray(obj)) return obj.map(patchEmptyRichtextFields)
	if (obj && typeof obj === 'object') {
		return Object.fromEntries(
			Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
				k,
				k === 'title' && v === '' ? EMPTY_RICHTEXT : patchEmptyRichtextFields(v),
			]),
		)
	}
	return obj
}

// bare filename from a Storyblok CDN URL (last path segment)
const basenameFromUrl = (url: string) => url.split('/').pop() ?? url

async function loadExistingTargetAssets(): Promise<Map<string, string>> {
	const byBasename = new Map<string, string>()
	let page = 1
	while (true) {
		const res = await mapiGet(TARGET_TOKEN, `${MAPI}/${TARGET_SPACE}/assets?per_page=100&page=${page}`)
		if (!res.ok) break
		const data = await res.json() as { assets: Array<{ id: number; filename: string }> }
		if (!data.assets?.length) break
		for (const asset of data.assets) {
			byBasename.set(basenameFromUrl(asset.filename), asset.filename)
		}
		process.stdout.write(`\r  Loaded ${byBasename.size} existing assets...`)
		page++
		await delay(200)
	}
	console.log()
	return byBasename
}

async function downloadAsset(url: string): Promise<{ buffer: Buffer; contentType: string }> {
	const res = await fetch(url)
	if (!res.ok) throw new Error(`HTTP ${res.status}`)
	return {
		buffer: Buffer.from(await res.arrayBuffer()),
		contentType: res.headers.get('content-type') ?? 'application/octet-stream',
	}
}

async function uploadAsset(buffer: Buffer, filename: string, contentType: string): Promise<string | null> {
	const signRes = await fetch(`${MAPI}/${TARGET_SPACE}/assets`, {
		method: 'POST',
		headers: { Authorization: TARGET_TOKEN, 'Content-Type': 'application/json' },
		body: JSON.stringify({ filename, size: buffer.length, content_type: contentType }),
	})
	if (!signRes.ok) {
		console.log(`  ✗ sign failed ${filename}: ${signRes.status}`)
		return null
	}
	const sign = await signRes.json() as AssetSignResponse

	const form = new FormData()
	for (const [key, value] of Object.entries(sign.fields)) form.append(key, value)
	form.append('file', new Blob([buffer], { type: contentType }), filename)

	const s3Res = await fetch(sign.post_url, { method: 'POST', body: form })
	if (!s3Res.ok && s3Res.status !== 204) {
		console.log(`  ✗ S3 upload failed ${filename}: ${s3Res.status}`)
		return null
	}

	const finishRes = await mapiGet(TARGET_TOKEN, `${MAPI}/${TARGET_SPACE}/assets/${sign.id}/finish_upload`)
	if (!finishRes.ok) {
		console.log(`  ✗ finish_upload failed ${filename}: ${finishRes.status}`)
		return null
	}
	const finishData = await finishRes.json() as { filename: string }
	return finishData.filename
}

async function main() {
	if (!TARGET_TOKEN || !TARGET_SPACE) {
		console.error('Missing required env vars.')
		process.exit(1)
	}

	console.log('=== Asset migration (all b2b + b2c) ===')
	console.log(`Target space: ${TARGET_SPACE}`)
	console.log()

	// Step 1: list all stories
	console.log('Listing stories...')
	const allStories: StoryMeta[] = []
	for (const prefix of STORY_PREFIXES) {
		const stories = await listAllStories(prefix)
		allStories.push(...stories)
	}
	// Exclude folders — they have no content
	const contentStories = allStories.filter(s => !s.is_folder)
	console.log(`Total: ${allStories.length} stories, ${contentStories.length} content stories (excl. folders)`)
	console.log()

	// Step 2: load existing target assets (filename → new CDN URL)
	console.log('Loading existing target assets...')
	const existingAssets = await loadExistingTargetAssets()
	console.log(`Target has ${existingAssets.size} existing assets`)
	console.log()

	// Step 3: process each story
	let storiesWithAssets = 0
	let storiesUpdated = 0
	let storiesSkipped = 0
	let storiesFailed = 0
	let assetsUploaded = 0
	let assetsSkipped = 0
	let assetsFailed = 0

	const globalUrlMap = new Map<string, string>()

	console.log('Processing stories...')
	for (let i = 0; i < contentStories.length; i++) {
		const meta = contentStories[i]

		// Fetch full content
		let res: Response
		try {
			res = await mapiGet(TARGET_TOKEN, `${MAPI}/${TARGET_SPACE}/stories/${meta.id}`)
		} catch (err) {
			console.log(`  ✗ fetch network error ${meta.full_slug}: ${err}`)
			storiesFailed++
			continue
		}
		if (!res.ok) {
			storiesFailed++
			continue
		}
		const data = await res.json() as { story: StoryFull }
		const story = data.story
		await delay(150)

		// Find source asset URLs in content
		const sourceUrls = extractSourceUrls(story.content)
		if (sourceUrls.size === 0) {
			storiesSkipped++
			continue
		}

		storiesWithAssets++
		const urlMap = new Map<string, string>()

		// Upload any assets not yet in target
		for (const sourceUrl of sourceUrls) {
			if (globalUrlMap.has(sourceUrl)) {
				urlMap.set(sourceUrl, globalUrlMap.get(sourceUrl)!)
				assetsSkipped++
				continue
			}

			const basename = basenameFromUrl(sourceUrl)
			if (existingAssets.has(basename)) {
				const newUrl = existingAssets.get(basename)!
				urlMap.set(sourceUrl, newUrl)
				globalUrlMap.set(sourceUrl, newUrl)
				assetsSkipped++
				continue
			}

			try {
				const { buffer, contentType } = await downloadAsset(sourceUrl)
				await delay(100)
				const newUrl = await uploadAsset(buffer, basename, contentType)
				await delay(300)
				if (newUrl) {
					existingAssets.set(basename, newUrl)
					urlMap.set(sourceUrl, newUrl)
					globalUrlMap.set(sourceUrl, newUrl)
					assetsUploaded++
				} else {
					assetsFailed++
				}
			} catch (err) {
				console.log(`  ✗ asset ${basename}: ${err}`)
				assetsFailed++
			}
		}

		if (urlMap.size === 0) {
			storiesSkipped++
			continue
		}

		// Update story content
		const updatedContent = replaceUrls(story.content, urlMap)
		const patchedContent = patchEmptyRichtextFields(updatedContent)

		try {
			const updateRes = await mapiPut(TARGET_TOKEN, `${MAPI}/${TARGET_SPACE}/stories/${story.id}`, {
				story: { content: patchedContent },
				publish: false,
				force_update: 1,
			})
			await delay(200)

			if (updateRes.ok) {
				storiesUpdated++
			} else {
				const errText = await updateRes.text()
				console.log(`  ✗ update failed ${story.full_slug}: ${updateRes.status} ${errText.slice(0, 100)}`)
				storiesFailed++
			}
		} catch (err) {
			console.log(`  ✗ update network error ${story.full_slug}: ${err}`)
			storiesFailed++
		}

		if ((i + 1) % 50 === 0 || storiesUpdated % 25 === 0 && storiesUpdated > 0) {
			console.log(
				`  [${i + 1}/${contentStories.length}] updated=${storiesUpdated} skipped=${storiesSkipped} failed=${storiesFailed} | assets uploaded=${assetsUploaded} skipped=${assetsSkipped}`,
			)
		}
	}

	console.log()
	console.log('=== Done ===')
	console.log(`Stories: ${storiesUpdated} updated, ${storiesSkipped} skipped (no source assets), ${storiesFailed} failed`)
	console.log(`Assets:  ${assetsUploaded} uploaded, ${assetsSkipped} skipped (already exist), ${assetsFailed} failed`)
}

main().catch(err => {
	console.error('Fatal error:', err)
	process.exit(1)
})
