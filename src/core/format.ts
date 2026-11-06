import type { DictionaryEntry, DictionaryIndex } from "./dictionary";
import type { RawKanji } from "./types";
import { isKanjiChar, type WordMatch } from "./tokenizer";

export interface RenderOptions {
  maxDefinitions: number;
  maxResults: number;
  showKanjiDetails: boolean;
}

const POS_LABELS: Record<string, string> = {
  n: "noun",
  "n-adv": "adverbial noun",
  "n-t": "temporal noun",
  "n-suf": "noun suffix",
  "n-pref": "noun prefix",
  v1: "ichidan verb",
  "v1-s": "ichidan verb",
  v5u: "godan verb",
  "v5u-s": "godan verb",
  "v5aru": "godan verb",
  v5k: "godan verb",
  "v5k-s": "godan verb",
  v5g: "godan verb",
  v5s: "godan verb",
  "v5t": "godan verb",
  v5n: "godan verb",
  v5b: "godan verb",
  v5m: "godan verb",
  v5r: "godan verb",
  "v5r-i": "godan verb",
  vs: "suru verb",
  "vs-i": "suru verb",
  "vs-s": "suru verb",
  vk: "kuru verb",
  "adj-i": "i-adjective",
  "adj-ix": "i-adjective",
  "adj-na": "na-adjective",
  "adj-no": "no-adjective",
  "adj-pn": "pre-noun adjective",
  "adj-f": "pre-noun adjective",
  adv: "adverb",
  exp: "expression",
  prt: "particle",
  ctr: "counter",
  pref: "prefix",
  suf: "suffix",
  conj: "conjunction",
  int: "interjection",
  pn: "pronoun",
  num: "numeral",
  vt: "transitive",
  vi: "intransitive",
  aux: "auxiliary",
  "aux-v": "auxiliary verb",
  "aux-adj": "auxiliary adjective",
  uk: "usually kana",
};

function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_[\]<>]/g, "\\$&");
}

function renderKanji(char: string, raw: RawKanji): string {
  const [strokes, grade, frequency, on, kun, meanings] = raw;
  const facts: string[] = [];
  if (strokes > 0) {
    facts.push(`${strokes} strokes`);
  }
  if (grade >= 1 && grade <= 6) {
    facts.push(`grade ${grade}`);
  } else if (grade === 8) {
    facts.push("jinmeiyou");
  }
  if (frequency > 0) {
    facts.push(`freq #${frequency}`);
  }

  const lines = [`**${char}**${facts.length > 0 ? ` · ${facts.join(" · ")}` : ""}`];
  const readings: string[] = [];
  if (on.length > 0) {
    readings.push(`on ${on.join("、")}`);
  }
  if (kun.length > 0) {
    readings.push(`kun ${kun.join("、")}`);
  }
  if (readings.length > 0) {
    lines.push(readings.join(" · "));
  }
  if (meanings.length > 0) {
    lines.push(escapeMarkdown(meanings.slice(0, 6).join(", ")));
  }
  return lines.join("\n");
}

function renderEntry(entry: DictionaryEntry, match: WordMatch, options: RenderOptions): string {
  const headword = entry.kanji[0] ?? entry.kana[0] ?? match.base;
  const reading = entry.kana[0] ?? "";
  const title = reading && reading !== headword
    ? `**${escapeMarkdown(headword)}**（${escapeMarkdown(reading)}）`
    : `**${escapeMarkdown(headword)}**`;

  const lines = [title];

  if (match.matched !== headword) {
    const labels = [...new Set(match.reasons)].reverse().join(" + ");
    lines.push(
      labels
        ? `_${escapeMarkdown(match.matched)} · ${escapeMarkdown(labels)}_`
        : `_matched: ${escapeMarkdown(match.matched)}_`,
    );
  }

  const tags = [...new Set(entry.pos.map((pos) => POS_LABELS[pos] ?? pos))].slice(0, 5);
  if (entry.priority >= 3) {
    tags.push("common");
  }
  if (tags.length > 0) {
    lines.push(tags.map((tag) => `\`${tag}\``).join(" "));
  }

  const definitions = entry.glosses
    .slice(0, options.maxDefinitions)
    .map((gloss, index) => `${index + 1}. ${escapeMarkdown(gloss)}`);
  if (definitions.length > 0) {
    lines.push(definitions.join("\n"));
  }

  return lines.join("\n\n");
}

/** Render a word lookup in the 10ten-style card layout. */
export function renderWord(
  match: WordMatch,
  dictionary: DictionaryIndex,
  options: RenderOptions,
): string {
  const entries = match.entries.slice(0, options.maxResults);
  const parts = entries.map((entry) => renderEntry(entry, match, options));

  if (options.showKanjiDetails) {
    const characters = new Set<string>();
    for (const entry of entries) {
      for (const char of entry.kanji[0] ?? "") {
        if (isKanjiChar(char)) {
          characters.add(char);
        }
      }
    }

    const profiles: string[] = [];
    let count = 0;
    for (const char of characters) {
      const raw = dictionary.kanjiFor(char);
      if (raw) {
        profiles.push(renderKanji(char, raw));
        count++;
      }
      if (count >= 4) {
        break;
      }
    }
    if (profiles.length > 0) {
      parts.push(profiles.join("\n\n"));
    }
  }

  return parts.join("\n\n---\n\n");
}

/** Fallback card when the cursor is on a kanji with no word entry. */
export function renderKanjiOnly(char: string, raw: RawKanji): string {
  return renderKanji(char, raw);
}
