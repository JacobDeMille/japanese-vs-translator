# AGENTS.md — Japanese VS Dictionary

Project instructions and durable memory for future OpenCode sessions. Read this
before changing the extension.

## What this is

An offline, inline Japanese popup dictionary for VS Code, inspired by the
10ten Japanese Reader architecture: local dictionary data, longest-match
compound tokenization, deinflection, and a native `HoverProvider` rendering
Markdown cards.

- Repo: `/home/jbat4/code/japanese-vs-translator` (WSL), git repo on `main`.
- VS Code extension id: `local.japanese-vs-translator`.
- Current version: `0.1.3`.
- Initial commit: `4407d8d` "Build offline Japanese hover dictionary".
- Git identity is configured locally (Jacob DeMille / GitHub noreply email).
- Build session id: `ses_e50f12dd1ffe5ui4cX4BpOoSz8` (OpenCode persists sessions;
  resume with `opencode --session ses_e50f12dd1ffe5ui4cX4BpOoSz8`).

## Commands

```bash
npm install
npm run build:dict    # download + compile JMdict/JMnedict/KANJIDIC2 (cached, idempotent)
npm run typecheck     # tsc --noEmit
npm run compile       # esbuild -> dist/extension.js (clears dist first)
npm run watch         # esbuild watch
npm run smoke         # parser/lookup assertions + hover card sample + benchmark
npm run vsix          # typecheck + package .vsix (includes data/dict if present)
```

Packaging/install on Windows from WSL:

```bash
npm run vsix
cp japanese-vs-translator-0.1.3.vsix /mnt/c/Users/jbat4/Downloads/
code --install-extension 'C:\Users\jbat4\Downloads\japanese-vs-translator-0.1.3.vsix'
```

Windows VS Code cannot open a VSIX from `\\wsl.localhost\...`
(`ERR_UNC_HOST_NOT_ALLOWED`), so the copy to a Windows path is mandatory.
After changing code, rebuild, repackage, reinstall, then **Developer: Reload
Window**. An installed VSIX does not hot-reload from WSL.

## Layout

```
src/core/types.ts          tuple data formats shared with the build script
src/core/deinflect.ts      conjugation rules + BFS deinflection with type chaining
src/core/dictionary.ts     loads words.json/kanji.json, builds surface -> id Map
src/core/lookup.ts         direct + deinflected lookup, POS compatibility filter
src/core/tokenizer.ts      cursor-centred longest match, katakana run helpers
src/core/format.ts         theme-aware Markdown/HTML hover card rendering
src/providers/hoverProvider.ts  VS Code HoverProvider + kanji/unknown fallbacks
src/extension.ts           activation, provider/commands, dictionary lifecycle
scripts/build-dictionary.mjs    streaming EDRDG XML -> compact JSON + seed
scripts/smoke.ts                node:assert smoke test + lookup benchmark
data/seed/                 committed fallback (900 words / 400 kanji)
data/dict/                 generated full data (gitignored, ~25 MB)
data/cache/                downloaded .gz files (gitignored)
AI_DISCLOSURE.md           AI provenance statement (shipped in the VSIX)
PUBLISHING.md              Marketplace/licensing checklist (dev-only)
```

Core modules must stay free of `vscode` imports so `scripts/smoke.ts` can run
them under plain Node via `tsx`.

## Data format

```ts
RawEntry = [kanjiForms: string[], kanaForms: string[], pos: string[],
            glosses: string[], priority: number]
RawKanji = [strokes: number, grade: number, frequency: number,
            on: string[], kun: string[], meanings: string[]]
```

- One `glosses` item per JMdict sense; multiple glosses in a sense are joined
  with `"; "`.
- `priority`: 3 = `ichi1`/`news1`/`spec1`, 2 = `nfXX`/`ichi2`/`news2`/`spec2`/
  `gai1`, 0 otherwise. Used for ordering and the `common` tag. JMnedict name
  entries always use 0.
- Entry id is its array index in `words.json`. The surface index is rebuilt at
  load, so editing/reordering the JSON is safe, but keep it consistent.
- Full build currently yields **290,057 entries (219,028 JMdict + 71,029
  JMnedict names) / 13,108 kanji**; the seed is 900 common entries + 400 kanji
  (includes a `MUST_INCLUDE` demo word list plus six katakana names).
- JMnedict filter: keep only entries with a katakana form of length >= 2 and a
  surface not already in JMdict. `name_type` entities become the entry's `pos`
  (e.g. `work`, `masc`, `fem`, `place`, `company`), rendered as badges.
- Loader resolution order: `japaneseReader.dictionaryPath` → `data/dict` when
  `manifest.json` exists → `data/seed`.

## Tokenization / deinflection invariants

- `findWordAt` is line-scoped and cursor-centred. It scans starts up to
  `maxWordLength` before the cursor and picks the **longest span covering the
  cursor**; ties prefer direct dictionary hits, then priority, then fewer
  deinflection steps.
- Do not return early after direct matches: longer deinflected spans must win
  (食べている → 食べる beats the particle/verb いる).
- Rules are flattened for stacked forms (passive + past, causative passive,
  progressive, tai-form) and chained with a strict `WordType` check. Add rules
  for both the flattened form and any chainable intermediate when extending.
- `suru` verbs need both `する` rules and the bare-noun `suruNoun` rules, because
  JMdict lists 勉強 as `n,vs` rather than 勉強する. Without this, 勉強しています
  resolves only to 勉強 via the short direct match instead of the whole span.
- `TYPE_POS` in `lookup.ts` filters deinflection candidates by POS; keep it in
  sync when adding a `WordType`.
- `deinflect` is cached (4096 entries, depth 3). Hover performance relies on
  the surface `Map` lookup (measured ~0.1 µs) plus this cache.
- `tokenizeLine` is a greedy longest-match over direct **and** deinflected spans,
  used by the debug command and smoke test, not by hover.
- Katakana fallback: `katakanaRunAt` returns the maximal katakana run around the
  cursor. `weakKatakanaPrefix` flags a direct match that is only 1–2 characters
  at the start of a 4+ character run, has priority < 2, and whose full run is
  not indexed. Hover then shows `renderUnknownWord` ("No dictionary entry
  found.") over the whole run instead of a wrong prefix such as スポ for
  スポティファイ. Genuine longer prefixes (テレビ in テレビゲーム) are kept.

## Hover behaviour and rendering

- Provider is registered for `file`, `untitled`, `vscode-notebook-cell`; it
  returns nothing unless the character at the cursor is Japanese.
- Hover range is the matched surface, so only that span is highlighted.
- Card layout: `**headword**（reading）`, optional inflected-form note, POS tags
  (+ `common`, or a JMnedict name type), numbered definitions, then KANJIDIC
  profiles for up to 4 kanji.
- Kanji-only fallback shows the KANJIDIC card when no word entry exists;
  unknown katakana runs show the full run with "No dictionary entry found."
- Theme-aware colors: the palette is chosen per hover from
  `vscode.window.activeColorTheme.kind` (`Light`/`HighContrastLight` → light,
  otherwise dark). Dark mirrors 10ten's black theme (headword `#4bbffb`,
  reading `#7beb7e`, definitions `#ffffff`, note `#c1a4a0`, muted `#9d9d9d`);
  light mirrors the light-blue theme (`#17588e`, `#2e7d32`, `#1d1a19`,
  `#817470`, `#6b6b6b`). POS badges use `var(--vscode-badge-*)`.
- Rendering uses `MarkdownString.supportHtml = true` with VS Code's sanitized
  `<span style>` subset. The sanitizer only keeps `style` on `<span>` with
  `color:` first, then optional `background-color:`, `display:inline-block;`,
  and `border-radius:Npx;`, `#hex`/`var(--vscode-...)` values, and no spaces.
  Markdown itself stays untrusted (`isTrusted = false`); escape glosses and
  readings before injecting them.
- Activation is language-scoped in `package.json` (`onLanguage:...` list). New
  file types need an activation entry, otherwise hover never activates there.

## Settings

`dictionaryPath`, `maxWordLength` (16), `maxResults` (3), `maxDefinitions` (8),
`showKanjiDetails` (true). Changing `dictionaryPath` invalidates the cached
promise; **Reload Dictionary** forces a fresh load.

## Licensing — do not remove

- Code: MIT (`LICENSE`).
- Generated data: JMdict/JMnedict/KANJIDIC2 © EDRDG, CC BY-SA 4.0. See
  `data/NOTICE.md` and `README.md`. Any redistribution must keep attribution.
- 10ten is inspiration only; this code is original and not affiliated. 10ten is
  GPL-3.0. Because no 10ten code is copied, MIT is valid here; relicensing to
  GPL-3.0 is only required if GPL code is ever incorporated. See
  `PUBLISHING.md` for the full checklist.
- AI provenance: `AI_DISCLOSURE.md` records the agent (OpenCode) and model
  (Big Pickle, `opencode/big-pickle`). Keep it in published packages alongside
  the README.

## Known limitations / likely next work

- JMnedict coverage is katakana-only; kanji-written names and names with no
  katakana form are not included. No pitch accents, no per-kanji furigana
  alignment (whole-word reading is shown instead).
- Homographs are ranked by priority only; no sense-level disambiguation.
- Hover is single-line; words split across lines are not matched.
- Only the listed language IDs activate the extension.
- No VS Code integration-test harness; `npm run smoke` covers core logic only.
- Marketplace: publisher is `jacobdemille` and repository metadata is set, but
  there is no icon yet and the first publish still needs a Marketplace PAT. See
  `PUBLISHING.md`.
- Optional: add an `install:windows` npm script to automate the copy + install
  flow documented above.
