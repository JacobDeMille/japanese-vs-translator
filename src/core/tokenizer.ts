import type { DictionaryEntry, DictionaryIndex } from "./dictionary";
import type { WordType } from "./deinflect";
import { lookupAll } from "./lookup";

const JAPANESE_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u30fc\u3005\u3006]/u;

export function isJapaneseChar(character: string | undefined): boolean {
  return character !== undefined && JAPANESE_CHAR.test(character);
}

export function containsJapanese(text: string): boolean {
  return JAPANESE_CHAR.test(text);
}

export function isKanjiChar(character: string): boolean {
  return /\p{Script=Han}/u.test(character);
}

const KATAKANA_RUN_CHAR = /[\p{Script=Katakana}\u30fc]/u;

export interface KatakanaRun {
  start: number;
  end: number;
  surface: string;
}

/** The maximal run of katakana (including the long-vowel mark) around a cursor. */
export function katakanaRunAt(text: string, character: number): KatakanaRun | undefined {
  const position = Math.min(Math.max(character, 0), text.length - 1);
  if (position < 0 || !KATAKANA_RUN_CHAR.test(text[position])) {
    return undefined;
  }

  let start = position;
  while (start > 0 && KATAKANA_RUN_CHAR.test(text[start - 1])) {
    start--;
  }
  let end = position + 1;
  while (end < text.length && KATAKANA_RUN_CHAR.test(text[end])) {
    end++;
  }
  return { start, end, surface: text.slice(start, end) };
}

export interface WordMatch {
  start: number;
  end: number;
  matched: string;
  base: string;
  type: WordType | null;
  reasons: string[];
  entries: DictionaryEntry[];
}

export interface SearchOptions {
  maxWordLength: number;
  maxEntries: number;
}

export interface Token extends WordMatch {
  known: boolean;
}

function makeMatch(
  start: number,
  end: number,
  matched: string,
  base: string,
  type: WordType | null,
  reasons: string[],
  entries: DictionaryEntry[],
): WordMatch {
  return { start, end, matched, base, type, reasons, entries };
}

/** Prefer the longest span; then direct dictionary hits over deinflections. */
function choose(current: WordMatch | undefined, candidate: WordMatch): WordMatch {
  if (!current) {
    return candidate;
  }

  const currentLength = current.end - current.start;
  const candidateLength = candidate.end - candidate.start;
  if (candidateLength !== currentLength) {
    return candidateLength > currentLength ? candidate : current;
  }

  const currentDirect = current.type === null ? 1 : 0;
  const candidateDirect = candidate.type === null ? 1 : 0;
  if (currentDirect !== candidateDirect) {
    return candidateDirect > currentDirect ? candidate : current;
  }

  const currentPriority = current.entries[0]?.priority ?? 0;
  const candidatePriority = candidate.entries[0]?.priority ?? 0;
  if (currentPriority !== candidatePriority) {
    return candidatePriority > currentPriority ? candidate : current;
  }

  if (candidate.reasons.length !== current.reasons.length) {
    return candidate.reasons.length < current.reasons.length ? candidate : current;
  }

  return current;
}

function directMatch(
  dictionary: DictionaryIndex,
  text: string,
  start: number,
  end: number,
  options: SearchOptions,
): WordMatch | undefined {
  const surface = text.slice(start, end);
  const ids = dictionary.lookup(surface);
  if (ids.length === 0) {
    return undefined;
  }
  const entries = dictionary.getEntries(ids, options.maxEntries);
  return entries.length > 0
    ? makeMatch(start, end, surface, surface, null, [], entries)
    : undefined;
}

function deinflectedMatch(
  dictionary: DictionaryIndex,
  text: string,
  start: number,
  end: number,
  options: SearchOptions,
): WordMatch | undefined {
  const surface = text.slice(start, end);
  const candidates = lookupAll(dictionary, surface, options.maxEntries, {
    deinflectedOnly: true,
  });
  if (candidates.length === 0) {
    return undefined;
  }
  const best = candidates[0];
  return makeMatch(start, end, surface, best.base, best.type, [...best.reasons], best.entries);
}

/**
 * Cursor-centred longest-match search. A compound such as 日本語 is preferred
 * over its single characters, and an inflected span (食べさせられた) is
 * preferred over a shorter dictionary word it contains (いる).
 */
export function findWordAt(
  dictionary: DictionaryIndex,
  text: string,
  character: number,
  options: SearchOptions,
): WordMatch | undefined {
  const maxLength = Math.max(1, options.maxWordLength);
  const position = Math.min(Math.max(character, 0), text.length - 1);
  if (position < 0 || !isJapaneseChar(text[position])) {
    return undefined;
  }

  let best: WordMatch | undefined;
  const minStart = Math.max(0, position - maxLength + 1);

  for (let start = position; start >= minStart; start--) {
    if (!isJapaneseChar(text[start])) {
      break;
    }
    for (let end = Math.min(text.length, start + maxLength); end > position; end--) {
      const match = directMatch(dictionary, text, start, end, options);
      if (match) {
        best = choose(best, match);
        break;
      }
    }
  }

  const minDeinflectedStart = Math.max(0, position - Math.min(maxLength, 12) + 1);
  for (let start = position; start >= minDeinflectedStart; start--) {
    if (!isJapaneseChar(text[start])) {
      break;
    }
    for (let end = Math.min(text.length, start + maxLength); end > position; end--) {
      const match = deinflectedMatch(dictionary, text, start, end, options);
      if (match) {
        best = choose(best, match);
        break;
      }
    }
  }

  return best;
}

/**
 * Detects a misleading short match inside a longer unknown katakana word.
 * For example, スポティファイ is in neither JMdict nor JMnedict, so the
 * longest direct match is スポ. Returning the full run lets the hover show a
 * "no entry" card instead of a wrong 2-character definition. Common short
 * words (priority >= 2) and genuine compounds such as テレビゲーム are kept.
 */
export function weakKatakanaPrefix(
  dictionary: DictionaryIndex,
  text: string,
  character: number,
  match: WordMatch | undefined,
): KatakanaRun | undefined {
  if (!match || match.type !== null) {
    return undefined;
  }
  const run = katakanaRunAt(text, character);
  if (!run || run.surface.length < 4) {
    return undefined;
  }
  if (match.start !== run.start || match.end >= run.end) {
    return undefined;
  }
  if (match.end - match.start > 2) {
    return undefined;
  }
  if ((match.entries[0]?.priority ?? 0) >= 2) {
    return undefined;
  }
  if (dictionary.lookup(run.surface).length > 0) {
    return undefined;
  }
  return run;
}

/** Greedy longest-match tokenizer used by the debug command and tests. */
export function tokenizeLine(
  dictionary: DictionaryIndex,
  text: string,
  options: SearchOptions,
): Token[] {
  const maxLength = Math.max(1, options.maxWordLength);
  const tokens: Token[] = [];
  let index = 0;

  while (index < text.length) {
    if (!isJapaneseChar(text[index])) {
      index++;
      continue;
    }

    let token: Token | undefined;
    for (let end = Math.min(text.length, index + maxLength); end > index; end--) {
      const match =
        directMatch(dictionary, text, index, end, options) ??
        deinflectedMatch(dictionary, text, index, end, options);
      if (match) {
        token = { ...match, known: true };
        break;
      }
    }

    if (token) {
      tokens.push(token);
      index = token.end;
    } else {
      tokens.push({
        start: index,
        end: index + 1,
        matched: text[index],
        base: text[index],
        type: null,
        reasons: [],
        entries: [],
        known: false,
      });
      index++;
    }
  }

  return tokens;
}
