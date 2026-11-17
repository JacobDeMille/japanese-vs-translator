#!/usr/bin/env node
/**
 * Builds the offline dictionary from JMdict (English) and KANJIDIC2.
 *
 * Output:
 *   data/dict/words.json   full entry set used by the extension
 *   data/dict/kanji.json   character profiles
 *   data/dict/manifest.json
 *   data/seed/words.json   small committed fallback (~900 common entries)
 *   data/seed/kanji.json
 *
 * Downloads are cached in data/cache so re-runs are cheap.
 */
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CACHE_DIR = join(ROOT, "data", "cache");
const FULL_DIR = join(ROOT, "data", "dict");
const SEED_DIR = join(ROOT, "data", "seed");

const JMdict_URL = "https://www.edrdg.org/pub/Nihongo/JMdict_e.gz";
const KANJIDIC_URL = "https://www.edrdg.org/pub/Nihongo/kanjidic2.xml.gz";
const JMNEDICT_URL = "https://www.edrdg.org/pub/Nihongo/JMnedict.xml.gz";
const JMdict_FILE = join(CACHE_DIR, "JMdict_e.gz");
const KANJIDIC_FILE = join(CACHE_DIR, "kanjidic2.xml.gz");
const JMNEDICT_FILE = join(CACHE_DIR, "JMnedict.xml.gz");

const MUST_INCLUDE = [
  "食べる", "飲む", "行く", "来る", "する", "見る", "聞く", "話す", "読む", "書く",
  "買う", "待つ", "死ぬ", "遊ぶ", "泳ぐ", "貸す", "日本語", "日本", "学生", "学校",
  "先生", "勉強", "猫", "犬", "本", "水", "人", "私", "今日", "明日", "昨日",
  "時間", "友達", "電車", "東京", "漢字", "言葉", "意味", "翻訳", "辞書", "大きい",
  "小さい", "高い", "安い", "新しい", "古い", "良い", "悪い", "静か", "元気", "美味しい",
  "面白い", "可愛い", "ありがとう", "こんにちは", "は", "が", "を", "に", "で", "と",
  "も", "の", "から", "まで", "ね", "よ",
  // Katakana names demonstrate the JMnedict supplement in the seed fallback.
  "ナルト", "ミッキー", "マリオ", "ゼルダ", "ピカチュウ", "ソニック",
];

async function ensureDownload(url, file) {
  if (existsSync(file)) {
    console.log(`cache: ${file}`);
    return file;
  }
  await mkdir(dirname(file), { recursive: true });
  console.log(`download: ${url}`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`download failed: ${response.status} ${response.statusText}`);
  }
  const partial = `${file}.part`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  await rename(partial, file);
  console.log(`saved: ${file}`);
  return file;
}

async function readHead(file, limit = 512 * 1024) {
  const chunks = [];
  let size = 0;
  const stream = createReadStream(file).pipe(createGunzip());
  for await (const chunk of stream) {
    chunks.push(chunk);
    size += chunk.length;
    if (size >= limit) {
      break;
    }
  }
  stream.destroy();
  return Buffer.concat(chunks).toString("utf8");
}

function parseEntities(head) {
  const entities = new Map();
  for (const match of head.matchAll(/<!ENTITY\s+([A-Za-z][\w.-]*)\s+["']([^"']*)["']\s*>/g)) {
    entities.set(match[1], match[2]);
  }
  return entities;
}

function decode(text, entities) {
  if (!text.includes("&")) {
    return text;
  }
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[A-Za-z][\w.-]*);/g, (whole, name) => {
    if (name.startsWith("#x")) {
      return String.fromCodePoint(parseInt(name.slice(2), 16));
    }
    if (name.startsWith("#")) {
      return String.fromCodePoint(parseInt(name.slice(1), 10));
    }
    if (name === "amp") return "&";
    if (name === "lt") return "<";
    if (name === "gt") return ">";
    if (name === "quot") return '"';
    if (name === "apos") return "'";
    return entities.get(name) ?? whole;
  });
}

async function* xmlBlocks(file, tag) {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const decoder = new TextDecoder("utf-8");
  const stream = createReadStream(file).pipe(createGunzip());
  let buffer = "";

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    let consumed = 0;
    while (true) {
      const start = buffer.indexOf(open, consumed);
      if (start === -1) break;
      const end = buffer.indexOf(close, start + open.length);
      if (end === -1) break;
      yield buffer.slice(start + open.length, end);
      consumed = end + close.length;
    }
    if (consumed > 0) {
      buffer = buffer.slice(consumed);
    }
  }
}

function priorityScore(priorities) {
  let score = 0;
  for (const priority of priorities) {
    if (priority === "ichi1" || priority === "news1" || priority === "spec1") {
      score = Math.max(score, 3);
    } else if (/^(ichi2|news2|spec2|gai1|nf\d{2})$/.test(priority)) {
      score = Math.max(score, 2);
    }
  }
  return score;
}

async function parseJmdict(file) {
  const entities = parseEntities(await readHead(file));
  const entries = [];
  let total = 0;

  for await (const block of xmlBlocks(file, "entry")) {
    total++;
    if (total % 50000 === 0) {
      console.log(`  JMdict: ${total} entries`);
    }

    const kanji = [...block.matchAll(/<keb>([\s\S]*?)<\/keb>/g)]
      .map((match) => decode(match[1], entities).trim())
      .filter(Boolean);
    const kana = [...block.matchAll(/<reb>([\s\S]*?)<\/reb>/g)]
      .map((match) => decode(match[1], entities).trim())
      .filter(Boolean);
    if (kanji.length === 0 && kana.length === 0) {
      continue;
    }

    const pos = new Set();
    for (const match of block.matchAll(/<pos>(.*?)<\/pos>/g)) {
      const raw = match[1].trim();
      const entity = /^&([A-Za-z][\w-]*);$/.exec(raw);
      const value = entity ? entity[1] : decode(raw, entities).trim();
      if (value) {
        pos.add(value);
      }
    }

    const glosses = [];
    for (const sense of block.split("<sense>").slice(1)) {
      const senseGlosses = [];
      for (const match of sense.matchAll(/<gloss([^>]*)>([\s\S]*?)<\/gloss>/g)) {
        const language = /xml:lang="([^"]+)"/.exec(match[1])?.[1];
        if (language && language !== "eng") {
          continue;
        }
        const text = decode(match[2], entities).trim();
        if (text) {
          senseGlosses.push(text);
        }
      }
      if (senseGlosses.length > 0) {
        glosses.push(senseGlosses.join("; "));
      }
    }
    if (glosses.length === 0) {
      continue;
    }

    const priorities = [];
    for (const pattern of [/<ke_pri>([\s\S]*?)<\/ke_pri>/g, /<re_pri>([\s\S]*?)<\/re_pri>/g]) {
      for (const match of block.matchAll(pattern)) {
        priorities.push(match[1].trim());
      }
    }

    entries.push([
      kanji,
      kana.length > 0 ? kana : kanji,
      [...pos],
      glosses,
      priorityScore(priorities),
    ]);
  }

  console.log(`JMdict: parsed ${total} entries, kept ${entries.length}`);
  return entries;
}

const KATAKANA_FORM = /^[\p{Script=Katakana}\u30fc]+$/u;

/**
 * Builds a katakana-only supplement from JMnedict. Proper nouns (characters,
 * works, brands, places) are almost entirely absent from JMdict, which made
 * lookups fall back to an unrelated short prefix. Keeping only entries with a
 * katakana form adds real names without pulling in the full 700k-entry names
 * dictionary.
 */
async function parseNedict(file, existingSurfaces) {
  const entities = parseEntities(await readHead(file));
  const entries = [];
  let total = 0;

  for await (const block of xmlBlocks(file, "entry")) {
    total++;
    const katakana = [...block.matchAll(/<(?:keb|reb)>([\s\S]*?)<\/(?:keb|reb)>/g)]
      .map((match) => decode(match[1], entities).trim())
      .filter(
        (form) =>
          form.length >= 2 &&
          KATAKANA_FORM.test(form) &&
          !existingSurfaces.has(form),
      );
    if (katakana.length === 0) {
      continue;
    }

    const kanji = [...block.matchAll(/<keb>([\s\S]*?)<\/keb>/g)]
      .map((match) => decode(match[1], entities).trim())
      .filter(
        (form) =>
          form &&
          !KATAKANA_FORM.test(form) &&
          !existingSurfaces.has(form),
      );

    const nameTypes = new Set();
    for (const match of block.matchAll(/<name_type>([\s\S]*?)<\/name_type>/g)) {
      const raw = match[1].trim();
      const entity = /^&([A-Za-z][\w-]*);$/.exec(raw);
      const value = entity ? entity[1] : decode(raw, entities).trim();
      if (value) {
        nameTypes.add(value);
      }
    }

    const glosses = [];
    for (const trans of block.split("<trans>").slice(1)) {
      const details = [...trans.matchAll(/<trans_det>([\s\S]*?)<\/trans_det>/g)]
        .map((match) => decode(match[1], entities).trim())
        .filter(Boolean);
      if (details.length > 0) {
        glosses.push(details.join("; "));
      }
    }
    if (glosses.length === 0) {
      continue;
    }

    entries.push([
      [...new Set(kanji)],
      [...new Set(katakana)],
      nameTypes.size > 0 ? [...nameTypes] : ["name"],
      glosses,
      0,
    ]);
  }

  console.log(`JMnedict: parsed ${total} entries, kept ${entries.length} katakana names`);
  return entries;
}

async function parseKanjidic(file) {
  const entities = parseEntities(await readHead(file));
  const kanji = {};
  let total = 0;

  for await (const block of xmlBlocks(file, "character")) {
    total++;
    const literal = /<literal>(.*?)<\/literal>/.exec(block)?.[1]?.trim();
    if (!literal) {
      continue;
    }

    const number = (value) => (value ? parseInt(value, 10) : 0);
    const strokes = number(/<stroke_count>(\d+)<\/stroke_count>/.exec(block)?.[1]);
    const grade = number(/<grade>(\d+)<\/grade>/.exec(block)?.[1]);
    const frequency = number(/<freq>(\d+)<\/freq>/.exec(block)?.[1]);
    const on = [...block.matchAll(/<reading[^>]*r_type="ja_on"[^>]*>(.*?)<\/reading>/g)]
      .map((match) => decode(match[1], entities).trim())
      .filter(Boolean);
    const kun = [...block.matchAll(/<reading[^>]*r_type="ja_kun"[^>]*>(.*?)<\/reading>/g)]
      .map((match) => decode(match[1], entities).trim())
      .filter(Boolean);

    const meanings = [];
    for (const match of block.matchAll(/<meaning([^>]*)>([\s\S]*?)<\/meaning>/g)) {
      const language = /m_lang="([^"]+)"/.exec(match[1])?.[1];
      if (language && language !== "en") {
        continue;
      }
      const text = decode(match[2], entities).trim();
      if (text) {
        meanings.push(text);
      }
    }

    kanji[literal] = [strokes, grade, frequency, on, kun, meanings];
  }

  console.log(`KANJIDIC: parsed ${total} characters`);
  return kanji;
}

async function writeFullDictionary(entries, kanji, nameCount) {
  await mkdir(FULL_DIR, { recursive: true });
  await writeFile(join(FULL_DIR, "words.json"), JSON.stringify(entries));
  await writeFile(join(FULL_DIR, "kanji.json"), JSON.stringify(kanji));
  await writeFile(
    join(FULL_DIR, "manifest.json"),
    JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        sources: { words: JMdict_URL, kanji: KANJIDIC_URL, names: JMNEDICT_URL },
        license: "JMdict/KANJIDIC2/JMnedict (c) EDRDG, CC BY-SA 4.0",
        entries: entries.length,
        names: nameCount,
        kanji: Object.keys(kanji).length,
      },
      null,
      2,
    ),
  );
}

function buildSeed(entries, kanji) {
  const surfaceToEntry = new Map();
  for (let id = 0; id < entries.length; id++) {
    for (const form of [...entries[id][0], ...entries[id][1]]) {
      if (!surfaceToEntry.has(form)) {
        surfaceToEntry.set(form, id);
      }
    }
  }

  const picked = new Set();
  for (const word of MUST_INCLUDE) {
    const id = surfaceToEntry.get(word);
    if (id !== undefined) {
      picked.add(id);
    }
  }

  const ranked = entries
    .map((entry, id) => ({ id, priority: entry[4] }))
    .filter((item) => item.priority >= 2)
    .sort((a, b) => b.priority - a.priority || a.id - b.id);
  for (const item of ranked) {
    if (picked.size >= 900) {
      break;
    }
    picked.add(item.id);
  }

  const seedEntries = [...picked].sort((a, b) => a - b).map((id) => entries[id]);

  const characters = new Set();
  for (const entry of seedEntries) {
    for (const char of entry[0][0] ?? "") {
      if (kanji[char]) {
        characters.add(char);
      }
    }
  }

  const byFrequency = Object.entries(kanji)
    .filter(([, raw]) => raw[1] >= 1 && raw[1] <= 8 && raw[2] > 0)
    .sort((a, b) => a[1][2] - b[1][2]);
  for (const [char] of byFrequency) {
    if (characters.size >= 400) {
      break;
    }
    characters.add(char);
  }

  const seedKanji = {};
  for (const char of characters) {
    seedKanji[char] = kanji[char];
  }
  return { entries: seedEntries, kanji: seedKanji };
}

async function main() {
  console.log("Japanese VS Dictionary - data builder");
  console.log(`workspace: ${ROOT}`);

  await ensureDownload(JMdict_URL, JMdict_FILE);
  await ensureDownload(KANJIDIC_URL, KANJIDIC_FILE);
  await ensureDownload(JMNEDICT_URL, JMNEDICT_FILE);

  const words = await parseJmdict(JMdict_FILE);
  const jmdictSurfaces = new Set();
  for (const entry of words) {
    for (const form of [...entry[0], ...entry[1]]) {
      jmdictSurfaces.add(form);
    }
  }
  const names = await parseNedict(JMNEDICT_FILE, jmdictSurfaces);
  const entries = [...words, ...names];
  const kanji = await parseKanjidic(KANJIDIC_FILE);

  await writeFullDictionary(entries, kanji, names.length);
  const seed = buildSeed(entries, kanji);
  await mkdir(SEED_DIR, { recursive: true });
  await writeFile(join(SEED_DIR, "words.json"), JSON.stringify(seed.entries));
  await writeFile(join(SEED_DIR, "kanji.json"), JSON.stringify(seed.kanji));

  console.log(
    `full: ${entries.length} words (${words.length} JMdict + ${names.length} names), ` +
      `${Object.keys(kanji).length} kanji -> ${FULL_DIR}`,
  );
  console.log(
    `seed: ${seed.entries.length} words, ${Object.keys(seed.kanji).length} kanji -> ${SEED_DIR}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
