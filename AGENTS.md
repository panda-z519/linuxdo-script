# Repository Guidelines

## Project Structure & Module Organization

This repository contains a browser userscript that saves linux.do topics into Obsidian through the Local REST API.

- `linux.do 帖子保存到 Obsidian.user.js`: main userscript, including metadata, UI, settings, scraping, Markdown generation, and Obsidian API calls.
- `README.md`: user-facing installation, configuration, and troubleshooting guide.
- `package.json`: project metadata and maintenance scripts.
- `.gitignore`: local ignore rules.

There is currently no dedicated `src/`, `tests/`, or assets directory. Keep changes close to the userscript unless a new directory clearly reduces complexity.

## Build, Test, and Development Commands

- `npm run check`: runs `node --check` against the userscript to catch JavaScript syntax errors.
- `npm run format`: formats the userscript, `README.md`, and `package.json` with Prettier via `npx`.

For manual testing, install or update the userscript in Tampermonkey or Userscripts, open a linux.do topic page, and verify saving against a local Obsidian vault with the Local REST API plugin enabled.

## Coding Style & Naming Conventions

Use plain JavaScript compatible with userscript managers. Follow the existing style:

- 2-space indentation.
- Double quotes for strings.
- `snake_case` for settings keys and local state, matching existing names such as `api_url` and `is_saving`.
- `const` by default; use `let` only for mutable state.
- Keep helper functions small and colocated with related behavior.

Run `npm run format` before submitting changes that touch formatted files.

## Testing Guidelines

There is no automated test suite yet. At minimum, run:

```sh
npm run check
```

For behavior changes, manually test the affected flow on a real linux.do topic page. Cover the relevant save modes, image options, preview behavior, and error handling when touching those areas.

## Commit & Pull Request Guidelines

No Git history is available in this checkout, so use concise, descriptive commit messages. Prefer a clear imperative form, for example:

```text
Fix markdown image attachment paths
```

Pull requests should include a short summary, manual test notes, and screenshots or screen recordings for UI changes. Link related issues when available, and call out any changes to Obsidian Local REST API behavior or userscript permissions.

## Security & Configuration Tips

Do not hardcode API keys, vault-specific paths, or personal data. Keep credentials in userscript settings. When adding network access, update the userscript metadata grants and document the reason in `README.md`.
