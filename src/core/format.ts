import type { DictionaryEntry, DictionaryIndex } from "./dictionary";
import type { RawKanji } from "./types";
import { isKanjiChar, type WordMatch } from "./tokenizer";

export type ThemeKind = "dark" | "light";

export interface RenderOptions {
  maxDefinitions: number;
  maxResults: number;
  showKanjiDetails: boolean;
  theme: ThemeKind;
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
  v5t: "godan verb",
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
  // JMnedict name types (katakana proper-noun supplement).
  name: "name",
  surname: "surname",
  given: "given name",
  masc: "male name",
  fem: "female name",
  person: "person name",
  place: "place name",
  product: "product name",
  company: "company",
  organization: "organization",
  group: "group",
  work: "work title",
  char: "character",
  creat: "creature",
  dei: "deity",
  myth: "mythology",
  leg: "legend",
  fict: "fiction",
  obj: "object",
  relig: "religion",
  serv: "service",
  ship: "ship name",
  station: "station",
  doc: "document",
  ev: "event",
  oth: "other name",
  unclass: "name",
};

interface CardPalette {
  /** Kanji headword. */
  headword: string;
  /** Kana reading. */
  reading: string;
  /** Definitions and kanji meanings. */
  body: string;
  /** Secondary facts and metadata. */
  muted: string;
  /** Deinflection/conjugation notes. */
  note: string;
}

/**
 * 10ten-style palettes. Dark values mirror 10ten's black theme; light values
 * mirror its light-blue theme. Hex values are on the hover renderer's
 * whitelist (it only keeps `color`, `background-color`, `display:inline-block`,
 * and `border-radius` on spans), and the hover provider picks the palette from
 * the active VS Code theme.
 */
const PALETTES: Record<ThemeKind, CardPalette> = {
  dark: {
    headword: "#4bbffb",
    reading: "#7beb7e",
    body: "#ffffff",
    muted: "#9d9d9d",
    note: "#c1a4a0",
  },
  light: {
    headword: "#17588e",
    reading: "#2e7d32",
    body: "#1d1a19",
    muted: "#6b6b6b",
    note: "#817470",
  },
};

function colored(text: string, color: string): string {
  return `<span style="color:${color};">${text}</span>`;
}

/** A small pill for part-of-speech tags, using the theme's badge colors. */
function badge(text: string): string {
  return (
    '<span style="color:var(--vscode-badge-foreground);' +
    "background-color:var(--vscode-badge-background);" +
    'display:inline-block;border-radius:4px;">' +
    `&nbsp;${text}&nbsp;</span>`
  );
}

function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_[\]<>]/g, "\\$&");
}

function renderKanji(char: string, raw: RawKanji, palette: CardPalette): string {
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

  const header =
    colored(`<strong>${escapeMarkdown(char)}</strong>`, palette.headword) +
    (facts.length > 0 ? colored(` · ${facts.join(" · ")}`, palette.muted) : "");
  const lines = [header];

  const readings: string[] = [];
  if (on.length > 0) {
    readings.push(`on ${on.join("、")}`);
  }
  if (kun.length > 0) {
    readings.push(`kun ${kun.join("、")}`);
  }
  if (readings.length > 0) {
    lines.push(colored(readings.join(" · "), palette.reading));
  }
  if (meanings.length > 0) {
    lines.push(colored(escapeMarkdown(meanings.slice(0, 6).join(", ")), palette.body));
  }
  return lines.join("\n");
}

function renderEntry(
  entry: DictionaryEntry,
  match: WordMatch,
  options: RenderOptions,
  palette: CardPalette,
): string {
  const headword = entry.kanji[0] ?? entry.kana[0] ?? match.base;
  const reading = entry.kana[0] ?? "";
  const headwordHtml = colored(`<strong>${escapeMarkdown(headword)}</strong>`, palette.headword);
  const title = reading && reading !== headword
    ? `${headwordHtml}（${colored(escapeMarkdown(reading), palette.reading)}）`
    : headwordHtml;

  const lines = [title];

  if (match.matched !== headword) {
    const labels = [...new Set(match.reasons)].reverse().join(" + ");
    const note = labels
      ? `${escapeMarkdown(match.matched)} · ${escapeMarkdown(labels)}`
      : `matched: ${escapeMarkdown(match.matched)}`;
    lines.push(colored(`<em>${note}</em>`, palette.note));
  }

  const tags = [...new Set(entry.pos.map((pos) => POS_LABELS[pos] ?? pos))].slice(0, 5);
  if (entry.priority >= 3) {
    tags.push("common");
  }
  if (tags.length > 0) {
    lines.push(tags.map((tag) => badge(escapeMarkdown(tag))).join(" "));
  }

  const definitions = entry.glosses
    .slice(0, options.maxDefinitions)
    .map((gloss, index) => `${index + 1}. ${colored(escapeMarkdown(gloss), palette.body)}`);
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
  const palette = PALETTES[options.theme];
  const entries = match.entries.slice(0, options.maxResults);
  const parts = entries.map((entry) => renderEntry(entry, match, options, palette));

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
        profiles.push(renderKanji(char, raw, palette));
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
export function renderKanjiOnly(char: string, raw: RawKanji, theme: ThemeKind): string {
  return renderKanji(char, raw, PALETTES[theme]);
}

/** Card for a katakana run that is in neither dictionary. */
export function renderUnknownWord(surface: string, theme: ThemeKind): string {
  const palette = PALETTES[theme];
  return (
    colored(`<strong>${escapeMarkdown(surface)}</strong>`, palette.headword) +
    "\n\n" +
    colored("No dictionary entry found.", palette.muted)
  );
}
