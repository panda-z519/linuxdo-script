# Repository Guidelines

## Project Structure & Module Organization

This repository ships two independent linux.do userscripts: saving topics into Obsidian through the Local REST API, and reading topics in an in-page dialog.

- `userscripts/<script>/<name>.user.js`: current source of each userscript, one script per folder. These paths are the install URLs, so released scripts must not move.
  - `userscripts/save-obsidian/`: metadata, UI, settings, scraping, Markdown generation, Obsidian API calls.
  - `userscripts/topic-reader/`: link click interception, dialog chrome, native route handoff, closing navigation.
- `versions/<script>/<version>/`: immutable release snapshots, written by `npm run archive-version` whenever `@version` is bumped.
- `tests/`: `node --test` suites covering pure functions, Safari Userscripts metadata, cross-script layering, and the version archive contract.
- `docs/`: user guides, UI spec, screenshots, and the HTML prototype; `docs/README.md` is the index.
- `.agents/notes/`: decision notes under `implemented/` and `proposed/`; read them before changing architecture, cross-script contracts, or document formats.
- `tools/`: repository maintenance scripts.
- `README.md`, `AGENTS.md`, `package.json`, `.gitignore`, `LICENSE`: repository metadata.

Keep changes inside the affected userscript unless a new directory clearly reduces complexity.

## Build, Test, and Development Commands

- `npm run check`: runs `node --check` against both userscripts to catch JavaScript syntax errors.
- `npm test`: runs the `node --test` suites in `tests/`.
- `npm run format`: formats both userscripts, the tests, the tools, `README.md`, `docs/*.md`, and `package.json` with Prettier via `npx`.
- `npm run archive-version`: copies each current userscript into `versions/<script>/<@version>/`. Run it as part of a release, after bumping `@version`; existing snapshots are only overwritten with `--force`.

For manual testing, install or update the userscripts in Tampermonkey or Userscripts, open linux.do, and verify the affected flow: saving against a local Obsidian vault with the Local REST API plugin, or opening topics in the reader dialog.

## Coding Style & Naming Conventions

Use plain JavaScript compatible with userscript managers. Follow the existing style:

- 2-space indentation.
- Double quotes for strings.
- `snake_case` for settings keys and local state, matching existing names such as `api_url` and `is_saving`.
- `const` by default; use `let` only for mutable state.
- Keep helper functions small and colocated with related behavior.
- Script folders use lowercase English slugs (`save-obsidian`, `topic-reader`); userscript filenames keep the Chinese `@name` wording.
- Bump `@version` in the userscript for every released change, then run `npm run archive-version` so `versions/` and `userscripts/` stay identical.

Run `npm run format` before submitting changes that touch formatted files.

## Testing Guidelines

Run both before submitting:

```sh
npm run check
npm test
```

Add a `node --test` case in `tests/` when changing pure logic, userscript metadata, the layering contract between the two scripts, or the version archive layout. For behavior changes, manually test the affected flow on a real linux.do page: cover the relevant save modes, image options, preview, reader dialog behavior, and error handling for the areas you touched.

## Commit & Pull Request Guidelines

Use concise, descriptive commit messages and keep the userscript change, its archived version, and its docs in one commit. Prefer a clear imperative form, for example:

```text
Fix markdown image attachment paths
```

Pull requests should include a short summary, manual test notes, and screenshots or screen recordings for UI changes. Link related issues when available, and call out any changes to Obsidian Local REST API behavior or userscript permissions.

## Security & Configuration Tips

Do not hardcode API keys, vault-specific paths, or personal data. Keep credentials in userscript settings. When adding network access, update the userscript metadata grants and document the reason in `README.md`.
