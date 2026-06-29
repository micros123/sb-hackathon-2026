/**
 ** Storyblok CLI v4 config. Non-secret defaults only.
 ** Credentials (login / token / region) live in .env (gitignored) and are
 ** injected per command by the storyblok_tomtom / storyblok_hackathon wrappers
 ** in copy.sh, because two separate accounts cannot share one
 ** ~/.storyblok/credentials.json (it holds a single token per region).
 ** The target space is chosen per command with -s/--space, so it is not set here.
 ** region here is only a fallback; STORYBLOK_REGION from .env overrides it.
 */
export default {
	region: 'eu',
};
