# Japanese VS Dictionary

An offline, inline Japanese popup dictionary for VS Code, modelled after the
[10ten Japanese Reader](https://github.com/birchill/10ten-ja-reader) ecosystem:
local dictionary data, longest-match compound tokenization, deinflection of
verbs and adjectives, and a native hover card.

Hover any Japanese word in a file and get the headword, kana reading, part of
speech tags, and numbered English definitions. Kanji profiles from KANJIDIC can
be appended to the card.

## Architecture

```
data/seed/                 committed ~900-entry fallback (works out of the box)
data/dict/                 generated full JMdict + KANJIDIC2 data (gitignored)

scripts/build-dictionary.mjs   downloads EDRDG data, streams the XML, writes JSON
src/core/deinflect.ts          conjugation rule chains -> dictionary forms
src/core/dictionary.ts         in-memory surface index + entry access
src/core/lookup.ts             direct + deinflected lookup, POS filtering
src/core/tokenizer.ts          cursor-centred longest match, greedy tokenizer
src/core/format.ts             Markdown hover card rendering
src/providers/hoverProvider.ts VS Code HoverProvider
src/extension.ts               activation, commands, dictionary lifecycle
```

Lookups are a single `Map` access over every kanji/kana surface form, so they
run well under 10ms after the index is loaded. The index itself is lazy-loaded
once per session (and warmed in the background after activation).

### Tokenization and deinflection

`findWordAt` scans every start position up to 16 characters before the cursor
and takes the longest dictionary match covering it, so 日本語 wins over 日 and
本. If no dictionary form matches, the same span is pushed through the
deinflection rules and resolved against the index. Rules cover godan, ichidan,
suru, kuru, i-adjectives, na-adjectives, and noun/copula forms: past, negative,
polite, passive, causative, causative-passive, potential, volitional,
conditional, imperative, te-form, progressive, and tai-form, including stacked
forms such as 食べさせられた → 食べる and 買わされている → 買う.

## Build the full dictionary

```bash
npm install
npm run build:dict    # downloads JMdict_e.gz + kanjidic2.xml.gz (~40 MB, cached)
npm run compile
```

`build:dict` streams both XML files (no SAX dependency), writes
`data/dict/{words,kanji,manifest}.json`, and also regenerates the committed
seed in `data/seed/`. The extension automatically prefers `data/dict` when a
manifest is present, otherwise it falls back to `data/seed`.

The full JSON is large (~22 MB), so `data/dict` is gitignored. If you package a
VSIX after building, the data directory is included in the VSIX.

## Commands

- **Japanese Reader: Reload Dictionary** — pick up a newly generated `data/dict`.
- **Japanese Reader: Tokenize Current Line (Debug)** — writes the token stream
  (surface, span, dictionary form, inflections) to the *Japanese Reader* output
  channel. Useful for checking the parser.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `japaneseReader.dictionaryPath` | `""` | Use a specific generated dictionary directory |
| `japaneseReader.maxWordLength` | `16` | Longest compound considered |
| `japaneseReader.maxResults` | `3` | Homographs shown per hover |
| `japaneseReader.maxDefinitions` | `8` | Definitions shown per entry |
| `japaneseReader.showKanjiDetails` | `true` | Append KANJIDIC character profiles |

## Development

```bash
npm install
npm run compile
npm run typecheck
npm run smoke        # parser + lookup assertions and a lookup benchmark
```

Press `F5` for an Extension Development Host. When the project is opened from
WSL, F5 debugs the WSL extension host (Remote-WSL); open it from a Windows path
to debug the Windows side.

## Data licensing

Dictionary data is derived from **JMdict** and **KANJIDIC2**, copyright the
Electronic Dictionary Research and Development Group (EDRDG), and is licensed
under [CC BY-SA 4.0](https://www.edrdg.org/edrdg/licence.html). Generated files
under `data/` inherit that license. The extension source code is MIT licensed;
see `data/NOTICE.md` and `LICENSE`.

This project is inspired by 10ten Japanese Reader but contains no code from it
and is not affiliated with the 10ten project.
