# Pockode

[![Server](https://github.com/sijiaoh/pockode/actions/workflows/server.yml/badge.svg)](https://github.com/sijiaoh/pockode/actions/workflows/server.yml)
[![Web](https://github.com/sijiaoh/pockode/actions/workflows/web.yml/badge.svg)](https://github.com/sijiaoh/pockode/actions/workflows/web.yml)

**Your dev machine in your pocket.**

Pockode connects your phone to your dev machine running Claude Code. Chat with AI, browse files, review diffs, and manage worktrees — on your local network.

| Chat | Sessions | File | Diff |
|:----:|:--------:|:----:|:----:|
| <img src="site/static/images/screenshot-chat.jpg" alt="Chat" width="200"> | <img src="site/static/images/screenshot-sessions.jpg" alt="Sessions" width="200"> | <img src="site/static/images/screenshot-file.jpg" alt="File" width="200"> | <img src="site/static/images/screenshot-diff.jpg" alt="Diff" width="200"> |

## Why Pockode?

Your powerful dev machine sits at home. With Pockode, you can use it locally without a cloud relay.

- **Local companion** — Use your phone as a second screen for your dev box
- **Quick checks** — Review diffs or files without opening your laptop
- **Same-network access** — Connect from your phone on the same Wi-Fi
- **Stay in flow** — Keep context without switching devices

## Features

| Feature | Description |
|---------|-------------|
| **AI Chat** | Natural language coding with Claude Code |
| **File Browser** | Navigate and edit your codebase |
| **Diff Viewer** | Review changes with syntax highlighting |
| **Session Management** | Switch between projects and conversations |
| **Worktree Support** | Manage multiple branches simultaneously |

## Quick Start

```bash
# Install
curl -fsSL https://pockode.com/install.sh | sh

# Run (on your dev machine)
pockode -auth-token YOUR_PASSWORD
```

Open http://localhost:9870 on your dev machine (or http://<dev-machine-ip>:9870 on the same network). Done.

## Status

Early-stage. Actively developed. APIs may change.

## Feedback

Ideas? Bugs? [Open an issue](https://github.com/sijiaoh/pockode/issues).

> Not accepting code contributions yet (heavy refactoring in progress), but feedback shapes the roadmap.

## Links

- **Website:** [pockode.com](https://pockode.com)
- **Issues:** [GitHub Issues](https://github.com/sijiaoh/pockode/issues)

## License

[O'Saasy License](LICENSE.md) — Free for personal use.
