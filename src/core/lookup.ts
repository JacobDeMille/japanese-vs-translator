import type { DictionaryEntry, DictionaryIndex } from "./dictionary";
import { deinflect, type WordType } from "./deinflect";

export interface LookupResult {
  base: string;
  type: WordType | null;
  reasons: string[];
  entries: DictionaryEntry[];
}

/**
 * POS codes each deinflection type may resolve to. An empty list means the
 * candidate is accepted without a POS check (noun/copula rules).
 */
const TYPE_POS: Record<WordType, string[]> = {
  v1: ["v1", "v1-s"],
  v5u: ["v5u", "v5u-s", "v5aru"],
  v5k: ["v5k", "v5k-s"],
  v5g: ["v5g", "v5g-s"],
  v5s: ["v5s", "v5s-s"],
  v5t: ["v5t"],
  v5n: ["v5n"],
  v5b: ["v5b"],
  v5m: ["v5m"],
  v5r: ["v5r", "v5r-i"],
  vs: ["vs", "vs-i", "vs-s"],
  vk: ["vk"],
  "adj-i": ["adj-i", "adj-ix"],
  "adj-na": ["adj-na"],
  n: [],
};

export interface LookupOptions {
  deinflectedOnly?: boolean;
}

function matchesType(entry: DictionaryEntry, type: WordType): boolean {
  const allowed = TYPE_POS[type];
  if (allowed.length === 0) {
    return true;
  }
  return entry.pos.some((pos) => allowed.includes(pos));
}

export function lookupAll(
  dictionary: DictionaryIndex,
  surface: string,
  maxEntries: number,
  options: LookupOptions = {},
): LookupResult[] {
  const results = new Map<string, LookupResult>();

  if (!options.deinflectedOnly) {
    const directIds = dictionary.lookup(surface);
    if (directIds.length > 0) {
      results.set(surface, {
        base: surface,
        type: null,
        reasons: [],
        entries: dictionary.getEntries(directIds, maxEntries),
      });
    }
  }

  for (const candidate of deinflect(surface)) {
    if (candidate.surface === surface) {
      continue;
    }

    const ids = dictionary.lookup(candidate.surface);
    if (ids.length === 0) {
      continue;
    }

    const matching = ids.filter((id) => matchesType(dictionary.getEntry(id), candidate.type));
    if (matching.length === 0) {
      continue;
    }

    const existing = results.get(candidate.surface);
    if (!existing) {
      results.set(candidate.surface, {
        base: candidate.surface,
        type: candidate.type,
        reasons: [...candidate.reasons],
        entries: dictionary.getEntries(matching, maxEntries),
      });
    } else if (candidate.reasons.length < existing.reasons.length) {
      existing.reasons = [...candidate.reasons];
      existing.type = candidate.type;
    }
  }

  return [...results.values()].sort((a, b) => {
    const directA = a.type === null ? 1 : 0;
    const directB = b.type === null ? 1 : 0;
    if (directA !== directB) {
      return directB - directA;
    }
    const priorityA = a.entries[0]?.priority ?? 0;
    const priorityB = b.entries[0]?.priority ?? 0;
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }
    if (a.reasons.length !== b.reasons.length) {
      return a.reasons.length - b.reasons.length;
    }
    return b.base.length - a.base.length;
  });
}
