import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DictionaryIndex } from "../src/core/dictionary";
import { deinflect } from "../src/core/deinflect";
import { renderUnknownWord, renderWord } from "../src/core/format";
import { findWordAt, katakanaRunAt, tokenizeLine, weakKatakanaPrefix } from "../src/core/tokenizer";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

async function main(): Promise<void> {
  const directory = existsSync(join(ROOT, "data", "dict", "manifest.json"))
    ? join(ROOT, "data", "dict")
    : join(ROOT, "data", "seed");

  const startedAt = Date.now();
  const dictionary = await DictionaryIndex.load(directory);
  console.log(
    `loaded ${dictionary.entryCount} entries / ${dictionary.kanjiCount} kanji from ${directory} in ${
      Date.now() - startedAt
    }ms`,
  );

  const cases: Array<[text: string, at: number, base: string]> = [
    ["日本語を勉強しています。", 0, "日本語"],
    ["日本語を勉強しています。", 5, "勉強"],
    ["食べさせられた", 0, "食べる"],
    ["買わされた", 0, "買う"],
    ["高くなかった", 0, "高い"],
    ["静かだった", 0, "静か"],
    ["学生です", 0, "学生"],
    ["見ている", 0, "見る"],
    ["来ました", 0, "来る"],
    ["行きました", 0, "行く"],
    ["食べています", 0, "食べる"],
    // Katakana proper nouns come from the JMnedict supplement.
    ["ナルト", 0, "ナルト"],
    ["ミッキー", 0, "ミッキー"],
    ["マリオ", 0, "マリオ"],
    ["ゼルダ", 0, "ゼルダ"],
  ];

  let failures = 0;
  for (const [text, at, expected] of cases) {
    const match = findWordAt(dictionary, text, at, { maxWordLength: 16, maxEntries: 3 });
    const actual = match?.base ?? "(none)";
    const ok = actual === expected;
    if (!ok) {
      failures++;
    }
    console.log(`${ok ? "ok  " : "FAIL"} ${text} @${at} -> ${actual} (expected ${expected})`);
    if (match && match.reasons.length > 0) {
      console.log(`       ${match.matched} · ${[...match.reasons].reverse().join(" + ")}`);
    }
  }

  const tokens = tokenizeLine(dictionary, "私は日本語を勉強しています。", {
    maxWordLength: 16,
    maxEntries: 1,
  });
  const surfaces = tokens.map((token) => token.matched);
  console.log(`tokens: ${tokens.map((token) => token.matched).join(" | ")}`);
  assert.ok(surfaces.includes("日本語"), "tokenizer should find 日本語");
  assert.ok(surfaces.includes("勉強しています"), "tokenizer should keep the inflected span");

  assert.ok(deinflect("食べさせられた").some((item) => item.surface === "食べる"));

  const sample = findWordAt(dictionary, "日本語", 0, { maxWordLength: 16, maxEntries: 3 });
  assert.ok(sample);
  const card = renderWord(sample, dictionary, {
    maxDefinitions: 5,
    maxResults: 3,
    showKanjiDetails: true,
    theme: "dark",
  });
  const lightCard = renderWord(sample, dictionary, {
    maxDefinitions: 5,
    maxResults: 3,
    showKanjiDetails: true,
    theme: "light",
  });

  const inflected = findWordAt(dictionary, "食べさせられた", 0, {
    maxWordLength: 16,
    maxEntries: 3,
  });
  assert.ok(inflected);
  const inflectedCard = renderWord(inflected, dictionary, {
    maxDefinitions: 5,
    maxResults: 3,
    showKanjiDetails: false,
    theme: "dark",
  });
  assert.ok(inflectedCard.includes("<em>"), "inflected card should note the conjugation");

  // 10ten-style hierarchy: cyan headword, green reading, white definitions.
  assert.ok(card.includes("#4bbffb"), "dark card should use the cyan headword color");
  assert.ok(card.includes("#7beb7e"), "dark card should use the green reading color");
  assert.ok(card.includes("#ffffff"), "dark card definitions should be white");
  assert.ok(lightCard.includes("#17588e"), "light card should use the blue headword color");
  assert.ok(lightCard.includes("#2e7d32"), "light card should use the green reading color");
  assert.ok(lightCard.includes("#1d1a19"), "light card definitions should be near-black");

  const nameMatch = findWordAt(dictionary, "ナルト", 0, {
    maxWordLength: 16,
    maxEntries: 3,
  });
  assert.ok(nameMatch, "katakana name should be found");
  assert.equal(nameMatch.matched, "ナルト", "katakana name should match as a whole");
  assert.equal(nameMatch.entries[0]?.kana[0], "ナルト");
  assert.ok(
    nameMatch.entries[0]?.glosses.some((gloss) => gloss.includes("Naruto")),
    "name entry should carry the JMnedict gloss",
  );

  // Unknown katakana runs should not masquerade as a low-value short prefix.
  const unknownWord = "スポヷヷ";
  const shortMatch = findWordAt(dictionary, unknownWord, 0, {
    maxWordLength: 16,
    maxEntries: 3,
  });
  assert.ok(shortMatch);
  assert.equal(shortMatch.matched, "スポ");
  assert.equal(katakanaRunAt(unknownWord, 0)?.surface, unknownWord);
  assert.equal(
    weakKatakanaPrefix(dictionary, unknownWord, 0, shortMatch)?.surface,
    unknownWord,
  );
  const unknownCard = renderUnknownWord(unknownWord, "dark");
  assert.ok(unknownCard.includes(unknownWord));
  assert.ok(unknownCard.includes("No dictionary entry found."));

  // A longer prefix (テレビ in テレビヷ) is a genuine match and is kept.
  const compound = findWordAt(dictionary, "テレビヷ", 0, {
    maxWordLength: 16,
    maxEntries: 3,
  });
  assert.ok(compound);
  assert.equal(compound.matched, "テレビ");
  assert.equal(weakKatakanaPrefix(dictionary, "テレビヷ", 0, compound), undefined);

  // VS Code's hover renderer only keeps span styles matching this whitelist.
  const allowedStyle =
    /^(color:(#[0-9a-fA-F]+|var\(--vscode(-[a-zA-Z0-9]+)+\));)?(background-color:(#[0-9a-fA-F]+|var\(--vscode(-[a-zA-Z0-9]+)+\));)?(display:inline-block;)?(border-radius:[0-9]+px;)?$/;
  const cards = `${card}\n\n${inflectedCard}`;
  const styles = [...cards.matchAll(/style="([^"]*)"/g)].map((match) => match[1]);
  assert.ok(styles.length > 0, "hover cards should contain styled spans");
  for (const style of styles) {
    assert.ok(allowedStyle.test(style), `style is not on VS Code's hover whitelist: ${style}`);
  }
  assert.equal(
    (cards.match(/<span/g) ?? []).length,
    (cards.match(/<\/span>/g) ?? []).length,
    "span tags should be balanced",
  );

  console.log("--- rendered hover markdown ---");
  console.log(card);
  console.log("");
  console.log(lightCard);
  console.log("");
  console.log(inflectedCard);
  console.log("-------------------------------");

  const lookups = 20000;
  const lookupStarted = performance.now();
  let found = 0;
  for (let index = 0; index < lookups; index++) {
    found += dictionary.lookup("日本語").length;
  }
  const average = (performance.now() - lookupStarted) / lookups;
  console.log(`${lookups} lookups, ${found} hits, avg ${(average * 1000).toFixed(1)}µs`);

  assert.equal(failures, 0, `${failures} lookup case(s) failed`);
  console.log("smoke test passed");
}

void main();
