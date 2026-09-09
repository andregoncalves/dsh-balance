# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Every release is also published on [GitHub Releases](https://github.com/andregoncalves/dsh-balance/releases)
and on [npm](https://www.npmjs.com/package/@andrecgoncalves/dsh-balance).

## [0.4.1] — 2026-09-09

### Fixed

- Provider detection in the browser half. The chip read the active session's provider through a
  `connection.api.sessions.models(...)` call that does not exist in DSH (the `connection` service is
  a `ConnectionHandle` with `rpc`, not a session API), so the lookup always threw and the chip
  silently fell back to the DeepSeek balance in every session, including OpenRouter, Moonshot, Zhipu,
  and MiniMax sessions. It now reads `ctx.modelDirectories.directoryFor(sessionId).store` — the same
  shared state the composer's model seat writes — and keeps the model-directory subscription that
  re-polls on a model switch. `scripts/verify-client.mjs` now asserts the resolved `kind` for each
  provider route, the OpenRouter regression included.

## [0.4.0] — 2026-09-09

First public release.

### Added

- Provider-aware balance chip in the sidebar foot (`sidebar.footer.action`) for the active model's
  provider: DeepSeek, OpenRouter, Moonshot/Kimi, Zhipu/GLM (Z.ai), and MiniMax.
- DeepSeek peak/off-peak status dot — peak is Monday–Friday, Beijing time (UTC+8) 09:00–12:00 and
  14:00–18:00 (01:00–04:00 and 06:00–10:00 UTC); every other hour, including the whole weekend, is
  off-peak at half the peak price.
- Host route `GET /plugins/balance?kind=…`; the API key is resolved on the host through the
  credentials seam and never reaches the browser.
- Automatic refresh every 60 seconds, on click, on session change, and on model switch.
- `dsh.bundle` manifest, so `dsh plugin --profile web add @andrecgoncalves/dsh-balance` wires the
  sidebar row without a manual profile patch.
- Mock mode (`DSH_BALANCE_MOCK=1` or `?mock=1`) for previewing any provider without an account.
- Bilingual README (English and Chinese), light/dark screenshots, and a `screenshots.json`
  declaration for plugin storefronts.

[0.4.1]: https://github.com/andregoncalves/dsh-balance/releases/tag/v0.4.1
[0.4.0]: https://github.com/andregoncalves/dsh-balance/releases/tag/v0.4.0
