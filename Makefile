# Pockode — dev target
# See docs/CONTRIB.md for full workflow.

.PHONY: dev

# Agent: claude (default) or cursor-agent
AGENT ?= claude

# Start development environment (server + web with hot reload)
dev:
	npm install
	AGENT=$(AGENT) ./scripts/dev.sh
