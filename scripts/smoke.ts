import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DictionaryIndex } from "../src/core/dictionary";
import { deinflect } from "../src/core/deinflect";
import { renderWord } from "../src/core/format";
import { findWordAt, tokenizeLine } from "../src/core/tokenizer";

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
  console.log("--- rendered hover sample ---");
  console.log(
    renderWord(sample, dictionary, {
      maxDefinitions: 5,
      maxResults: 3,
      showKanjiDetails: true,
    }),
  );
  console.log("-----------------------------");

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
