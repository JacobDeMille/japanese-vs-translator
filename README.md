# Japanese VS Dictionary

An offline, inline Japanese popup dictionary for VS Code, modelled after the
[10ten Japanese Reader](https://github.com/birchill/10ten-ja-reader) ecosystem:
local dictionary data, longest-match compound tokenization, deinflection of
verbs and adjectives, and a native hover card.

Hover any Japanese word in a file and get the headword, kana reading, part of
speech tags, and numbered English definitions. Kanji profiles from KANJIDIC can
be appended to the card.

Proper nouns are covered too: a filtered **JMnedict** supplement adds katakana
names, characters, works, brands, and places (ナルト, ミッキー, マリオ, ゼルダ)
that are absent from JMdict. When a longer katakana run is in neither
dictionary, the card shows the whole run with "No dictionary entry found."
instead of a misleading two-character prefix.

## Install

Once published, install **Japanese VS Dictionary** from the VS Code
Marketplace, or run:

```bash
code --install-extension <publisher>.japanese-vs-translator
```

For local development and packaging, see [Development](#development).

## Architecture

```
data/seed/                 committed ~900-entry fallback (works out of the box)
data/dict/                 generated full JMdict + JMnedict + KANJIDIC2 data (gitignored)

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
npm run build:dict    # downloads JMdict_e.gz + JMnedict.xml.gz + kanjidic2.xml.gz (~52 MB, cached)
npm run compile
```

`build:dict` streams the XML files (no SAX dependency), writes
`data/dict/{words,kanji,manifest}.json`, and also regenerates the committed
seed in `data/seed/`. Only JMnedict entries with a katakana form and a surface
not already in JMdict are kept, so the supplement adds names without pulling in
the full 743k-entry names dictionary or duplicating common words. The extension
automatically prefers `data/dict` when a manifest is present, otherwise it
falls back to `data/seed`.

The full JSON is large (~25 MB, 290k entries), so `data/dict` is gitignored. If
you package a VSIX after building, the data directory is included in the VSIX.

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

See [`PUBLISHING.md`](PUBLISHING.md) for the Marketplace publisher, metadata,
and licensing checklist.

## AI development disclosure

This project was developed with the assistance of an AI coding agent under
human direction and review. The agent was **OpenCode**, using the **Big Pickle**
model (`opencode/big-pickle`). The maintainer set requirements, reviewed the
output, tested the extension, and made the final product decisions.

See [`AI_DISCLOSURE.md`](AI_DISCLOSURE.md) for the full provenance statement,
including the division of work between the agent and the human maintainer.

## Licensing

The extension source code outside `data/` is licensed under the **MIT License**;
see [`LICENSE`](LICENSE).

Dictionary data is derived from **JMdict**, **JMnedict**, and **KANJIDIC2**,
copyright the Electronic Dictionary Research and Development Group (EDRDG), and
is licensed under [CC BY-SA 4.0](https://www.edrdg.org/edrdg/licence.html).
Generated files under `data/` inherit that license; see
[`data/NOTICE.md`](data/NOTICE.md). Attribution must be preserved when
redistributing the data or a packaged extension that contains it.

This project is inspired by [10ten Japanese Reader](https://github.com/birchill/10ten-ja-reader)
but contains **no code from it** and is not affiliated with the 10ten project.
10ten is licensed under GPL-3.0; this project does not need to use GPL-3.0
because it is an independent implementation. If code is ever copied from 10ten
or another GPL project, the project must be relicensed under GPL-3.0.
