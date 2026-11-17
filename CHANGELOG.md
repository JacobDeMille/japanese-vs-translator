# Changelog

## 0.1.3

- Added a filtered JMnedict supplement with 71k katakana proper nouns, so names
  and titles such as ナルト, ミッキー, マリオ, and ゼルダ resolve as whole words
  instead of falling back to an unrelated short prefix.
- Name entries show their type as a badge (work title, male/female name, place
  name, company, organization, character, and so on).
- Deduplicated name entries against JMdict surfaces so common loanwords and
  brands are not shown twice.
- Unknown katakana runs now render the full word with "No dictionary entry
  found." instead of a misleading one- or two-character definition.
- Seed fallback includes six katakana names for the no-build experience.
- Added `AI_DISCLOSURE.md` (agent/model provenance) and `PUBLISHING.md`
  (Marketplace publisher and licensing checklist); the disclosure ships in the
  VSIX and is linked from the README.

## 0.1.2

- Matched 10ten's card palette more closely: in dark themes the headword is
  bright cyan, the kana reading is bright green, and definitions are pure white.
- Added a light-theme palette (blue headword, green reading, near-black body)
  selected from the active VS Code color theme.
- Kanji profile readings now use the same green reading color as word readings.
- Conjugation notes use a muted warm tone instead of gray.

## 0.1.1

- Restyled hover cards with theme-aware colors: the Japanese headword uses the
  theme link accent, the kana reading is muted, and definitions use the editor
  foreground.
- Part-of-speech tags now render as theme-colored badges instead of inline code.
- KANJIDIC profiles use the same accent/muted/body hierarchy.
- Uses the sanitized `supportHtml` subset with CSS variables so cards adapt to
  light and dark themes.

## 0.1.0

- Replaced the translator scaffold with an offline hover dictionary.
- Added cursor-centred longest-match tokenization for Japanese compounds.
- Added deinflection rules for godan, ichidan, suru, kuru, i-/na-adjectives,
  and noun/copula forms (past, negative, polite, passive, causative,
  causative-passive, potential, volitional, conditional, imperative, te-form,
  progressive, tai-form).
- Added an in-memory dictionary index over JMdict surfaces.
- Added a streaming JMdict/KANJIDIC2 data builder with a committed seed.
- Added a native `HoverProvider` with Markdown cards (headword, reading, POS,
  numbered definitions, kanji profiles).
- Added reload-dictionary and tokenize-line commands, settings, and output logs.

## 0.0.1

- Initial translator scaffold.
