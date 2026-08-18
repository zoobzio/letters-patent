# letters-patent monorepo orchestration.
#
# Thin wrappers over the pnpm workspace scripts (package.json stays the source
# of truth) plus a few targets that span the whole repo: cleaning build output
# and the aggregate gates run in CI.

# Show this help by default.
.DEFAULT_GOAL := help

.PHONY: help install stub build typecheck test lint format inspect clean check verify ci

help: ## List available targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install workspace dependencies
	pnpm install

stub: ## Link packages to source for dev (jiti stubs, preserves live types)
	pnpm stub

build: ## Build every package to its .dist
	pnpm build

typecheck: ## Type-check every package
	pnpm typecheck

test: ## Run the test suite
	pnpm test

lint: ## Lint with eslint
	pnpm lint

format: ## Format the repo with prettier
	pnpm format

inspect: ## Check formatting without writing (prettier --check)
	pnpm inspect

clean: ## Remove build output and coverage (.dist, .coverage)
	rm -rf .coverage
	find packages integrations -maxdepth 2 -name .dist -type d -prune -exec rm -rf {} +

check: lint typecheck test ## Run lint/typecheck/test against existing build output

verify: clean install build typecheck test ## Full cold rebuild and verification

ci: build typecheck test lint inspect ## Cold CI gate: build first, then every check
