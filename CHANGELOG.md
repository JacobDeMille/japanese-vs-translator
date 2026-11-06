# Changelog

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
