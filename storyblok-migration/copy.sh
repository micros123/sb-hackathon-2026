#!/usr/bin/env bash
#
# Source this file to get two wrappers that run the Storyblok CLI as the right
# account:
#   storyblok_tomtom     -> source: TomTom production space
#   storyblok_hackathon  -> target: hackathon space
#
#   source copy.sh
#
# Each wrapper authenticates with `storyblok login --token` (a Personal Access
# Token needs no email), then runs the command. credentials.json holds one token
# per region, so the wrappers re-login per call: pull everything as one account,
# then push as the other. Tokens are read from .env without executing it, so
# values may contain spaces.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

# read a single key from .env: everything after the first '=', spaces preserved
read_env() {
	grep -E "^$1=" "$SCRIPT_DIR/.env" | head -1 | cut -d= -f2-
}

export TOMTOM_SPACE_ID="$(read_env TOMTOM_SPACE_ID)"
export HACKATHON_SPACE_ID="$(read_env HACKATHON_SPACE_ID)"

storyblok_login_as() {
	storyblok logout --no-ui-enabled >/dev/null 2>&1
	storyblok login --token "$(read_env "$1")" --region "$(read_env "$2")" --no-ui-enabled >/dev/null 2>&1 \
		|| { echo "Storyblok login failed for $1 (check token and region in .env)"; return 1; }
}

storyblok_tomtom() {
	storyblok_login_as TOMTOM_STORYBLOK_TOKEN TOMTOM_STORYBLOK_REGION && storyblok "$@"
}

storyblok_hackathon() {
	storyblok_login_as HACKATHON_STORYBLOK_TOKEN HACKATHON_STORYBLOK_REGION && storyblok "$@"
}
