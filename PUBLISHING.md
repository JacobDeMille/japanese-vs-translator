# Publishing checklist

This document covers what must change before publishing Japanese VS Dictionary
on the VS Code Marketplace, and what the current license obligations are. It is
a developer checklist, not legal advice.

## 1. Publisher identity

The publisher is registered as **`jacobdemille`**, so `package.json` uses
`"publisher": "jacobdemille"` and the extension id is
`jacobdemille.japanese-vs-translator`.

Remaining steps for a release:

1. Create an Azure DevOps personal access token (PAT) with **Marketplace:
   Manage** scope.
2. Log in and publish:

   ```bash
   npx @vscode/vsce login jacobdemille
   npm run vsix
   npx @vscode/vsce publish
   ```

Repository metadata is already set:

```json
"repository": {
  "type": "git",
  "url": "https://github.com/JacobDeMille/japanese-vs-translator.git"
}
```

Local installs of the old `local.japanese-vs-translator` id will not update
automatically; uninstall it and install the Marketplace build instead.

## 2. Marketplace presentation

- Keep `README.md` as the listing page: it should explain the feature set,
  install steps, settings, data sources, licensing, and AI provenance.
- Keep `CHANGELOG.md` current; the Marketplace shows it in the **Changelog**
  tab.
- Add a 128×128 PNG `icon` and set `"icon": "images/icon.png"` in
  `package.json`. This is optional but strongly recommended.
- Verify what actually ships:

  ```bash
  npx @vscode/vsce ls
  ```

- `.vscodeignore` currently keeps source, tests, build scripts, caches, and
  local VSIX files out of the package. `AI_DISCLOSURE.md`, `README.md`,
  `CHANGELOG.md`, `LICENSE`, `data/NOTICE.md`, `data/seed/`, `data/dict/`, and
  `dist/extension.js` are included.
- Do not include `data/cache/` (downloaded EDRDG archives) in the package.

## 3. License status

### Source code

The source is currently **MIT** (`LICENSE`). That is valid for publishing as
long as the code remains original. This project contains no code from 10ten
Japanese Reader; 10ten is GPL-3.0 and is cited only as design inspiration.
Being "inspired by" a GPL project does not require a GPL license.

If any code is later copied from 10ten or another GPL-3.0 project, the project
must be relicensed under GPL-3.0 (and the copied portions keep their original
copyright notices). Staying MIT is the simpler and more permissive option while
the implementation remains independent.

### Dictionary data

`data/` is derived from JMdict, JMnedict, and KANJIDIC2, all EDRDG datasets
under **CC BY-SA 4.0**. The obligations are:

- Attribute EDRDG and the three datasets.
- Keep the CC BY-SA 4.0 notice and a link to the license.
- Share adaptations of the data under CC BY-SA 4.0.

These obligations are already documented in `data/NOTICE.md` and `README.md`.
The generated JSON files are distributed under CC BY-SA 4.0; the source code can
remain under MIT. Keep `data/NOTICE.md` inside the VSIX (it is included today).

### Optional: switch the code to GPL-3.0

If you intentionally want to match 10ten's license, the mechanical changes are
small:

1. Replace `LICENSE` with the full GNU GPL v3 text.
2. Set `"license": "GPL-3.0-or-later"` in `package.json` (or `GPL-3.0-only` if
   you do not want future GPL versions to apply).
3. Update the licensing section in `README.md`, `data/NOTICE.md`, and
   `AGENTS.md`.
4. Optionally add an SPDX header to each source file, for example
   `// SPDX-License-Identifier: GPL-3.0-or-later`.
5. Rebuild and repackage.

GPL-3.0 is copyleft: anyone who distributes a modified version must provide the
complete corresponding source under GPL-3.0. That is a product decision, not a
compliance requirement for this independent codebase. Because the project is
currently authored by one person, relicensing is straightforward; if outside
contributors are added later, their permission would be needed.

CC BY-SA 4.0 is one-way compatible with GPL-3.0, so the EDRDG data can be
distributed alongside GPL-3.0 code while remaining under CC BY-SA 4.0 and
keeping its attribution. This is a summary, not legal advice; consult the
license texts or a lawyer for edge cases.

## 4. AI provenance

`README.md` links to `AI_DISCLOSURE.md`, which records the coding agent
(OpenCode) and model (Big Pickle, `opencode/big-pickle`) and the human review
process. Keep this file in the published package.

## 5. Pre-publish checks

```bash
npm ci
npm run build:dict
npm run typecheck
npm run smoke
npm run vsix
npx @vscode/vsce ls
```

Then install the generated VSIX on a clean VS Code profile and verify:

- Hover works in each listed language id.
- `data/dict` is preferred over `data/seed`.
- The data attribution and license files are present in the package.
- The Marketplace README and changelog render correctly.
