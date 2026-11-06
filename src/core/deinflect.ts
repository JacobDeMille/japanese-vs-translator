/**
 * Deinflection engine modelled on the rule-chain approach used by 10ten /
 * Yomichan-style readers: reduce an inflected surface form back to its
 * dictionary form and remember which inflections were undone.
 */
export type WordType =
  | "v1"
  | "v5u"
  | "v5k"
  | "v5g"
  | "v5s"
  | "v5t"
  | "v5n"
  | "v5b"
  | "v5m"
  | "v5r"
  | "vs"
  | "vk"
  | "adj-i"
  | "adj-na"
  | "n";

export interface Deinflection {
  surface: string;
  type: WordType;
  reasons: string[];
}

interface Rule {
  from: string;
  to: string;
  type: WordType;
  label: string;
}

const rules: Rule[] = [];

function add(from: string, to: string, type: WordType, label: string): void {
  rules.push({ from, to, type, label });
}

interface GodanRow {
  type: WordType;
  dict: string;
  a: string;
  i: string;
  e: string;
  o: string;
  te: string;
  ta: string;
}

const GODAN_ROWS: GodanRow[] = [
  { type: "v5u", dict: "う", a: "わ", i: "い", e: "え", o: "お", te: "って", ta: "った" },
  { type: "v5k", dict: "く", a: "か", i: "き", e: "け", o: "こ", te: "いて", ta: "いた" },
  { type: "v5g", dict: "ぐ", a: "が", i: "ぎ", e: "げ", o: "ご", te: "いで", ta: "いだ" },
  { type: "v5s", dict: "す", a: "さ", i: "し", e: "せ", o: "そ", te: "して", ta: "した" },
  { type: "v5t", dict: "つ", a: "た", i: "ち", e: "て", o: "と", te: "って", ta: "った" },
  { type: "v5n", dict: "ぬ", a: "な", i: "に", e: "ね", o: "の", te: "んで", ta: "んだ" },
  { type: "v5b", dict: "ぶ", a: "ば", i: "び", e: "べ", o: "ぼ", te: "んで", ta: "んだ" },
  { type: "v5m", dict: "む", a: "ま", i: "み", e: "め", o: "も", te: "んで", ta: "んだ" },
  { type: "v5r", dict: "る", a: "ら", i: "り", e: "れ", o: "ろ", te: "って", ta: "った" },
];

for (const row of GODAN_ROWS) {
  const d = row.dict;
  const t = row.type;
  add(`${row.a}ない`, d, t, "negative");
  add(`${row.a}なかった`, d, t, "negative past");
  add(`${row.a}なくて`, d, t, "negative te-form");
  add(`${row.a}なければ`, d, t, "negative conditional");
  add(`${row.a}れる`, d, t, "passive");
  add(`${row.a}れた`, d, t, "passive past");
  add(`${row.a}れて`, d, t, "passive te-form");
  add(`${row.a}せる`, d, t, "causative");
  add(`${row.a}せた`, d, t, "causative past");
  add(`${row.a}せられる`, d, t, "causative passive");
  add(`${row.a}せられた`, d, t, "causative passive past");
  add(`${row.a}される`, d, t, "causative passive");
  add(`${row.a}された`, d, t, "causative passive past");
  add(`${row.e}ば`, d, t, "conditional");
  add(`${row.e}る`, d, t, "potential");
  add(`${row.e}た`, d, t, "potential past");
  add(`${row.e}ない`, d, t, "potential negative");
  add(`${row.o}う`, d, t, "volitional");
  add(row.e, d, t, "imperative");
  add(row.te, d, t, "te-form");
  add(row.ta, d, t, "past");
  add(`${row.i}ます`, d, t, "polite");
  add(`${row.i}ました`, d, t, "polite past");
  add(`${row.i}ません`, d, t, "polite negative");
  add(`${row.i}ませんでした`, d, t, "polite negative past");
  add(`${row.i}ましょう`, d, t, "polite volitional");
  add(`${row.i}まして`, d, t, "polite te-form");
  add(`${row.i}たい`, d, t, "tai-form");
  add(`${row.i}たかった`, d, t, "tai-form past");
  add(`${row.i}たくない`, d, t, "tai-form negative");
  add(`${row.i}たくなかった`, d, t, "tai-form negative past");
  add(`${row.i}たくて`, d, t, "tai-form te-form");
  add(`${row.i}たければ`, d, t, "tai-form conditional");
  add(`${row.te}いる`, d, t, "progressive");
  add(`${row.te}いた`, d, t, "progressive past");
  add(`${row.te}いない`, d, t, "progressive negative");
  add(`${row.te}います`, d, t, "progressive polite");
  add(`${row.te}いました`, d, t, "progressive polite past");
  add(`${row.a}れている`, d, t, "passive progressive");
  add(`${row.a}れていた`, d, t, "passive progressive past");
  add(`${row.a}されている`, d, t, "causative passive progressive");
  add(`${row.a}せている`, d, t, "causative progressive");
}

function ichidan(from: string, label: string): void {
  add(from, "る", "v1", label);
}

ichidan("ない", "negative");
ichidan("なかった", "negative past");
ichidan("なくて", "negative te-form");
ichidan("なければ", "negative conditional");
ichidan("られる", "passive/potential");
ichidan("られた", "passive/potential past");
ichidan("られて", "passive/potential te-form");
ichidan("させる", "causative");
ichidan("させた", "causative past");
ichidan("させられる", "causative passive");
ichidan("させられた", "causative passive past");
ichidan("よう", "volitional");
ichidan("ろ", "imperative");
ichidan("れば", "conditional");
ichidan("て", "te-form");
ichidan("た", "past");
ichidan("ます", "polite");
ichidan("ました", "polite past");
ichidan("ません", "polite negative");
ichidan("ませんでした", "polite negative past");
ichidan("ましょう", "polite volitional");
ichidan("まして", "polite te-form");
ichidan("たい", "tai-form");
ichidan("たかった", "tai-form past");
ichidan("たくない", "tai-form negative");
ichidan("たくなかった", "tai-form negative past");
ichidan("たくて", "tai-form te-form");
ichidan("たければ", "tai-form conditional");
ichidan("ている", "progressive");
ichidan("ていた", "progressive past");
ichidan("ていない", "progressive negative");
ichidan("ています", "progressive polite");
ichidan("ていました", "progressive polite past");
ichidan("られている", "passive progressive");
ichidan("させられている", "causative passive progressive");

function suru(from: string, label: string): void {
  add(from, "する", "vs", label);
}

/**
 * JMdict often lists suru verbs as a noun tagged `vs` (勉強, not 勉強する),
 * so also reduce suru forms to the bare noun stem.
 */
function suruNoun(from: string, label: string): void {
  add(from, "", "vs", label);
}

suru("した", "past");
suru("して", "te-form");
suru("しない", "negative");
suru("しなかった", "negative past");
suru("しなくて", "negative te-form");
suru("します", "polite");
suru("しました", "polite past");
suru("しません", "polite negative");
suru("しませんでした", "polite negative past");
suru("しよう", "volitional");
suru("しろ", "imperative");
suru("すれば", "conditional");
suru("される", "passive");
suru("された", "passive past");
suru("させる", "causative");
suru("させた", "causative past");
suru("させられる", "causative passive");
suru("せられる", "causative passive");
suru("できる", "potential");
suru("できた", "potential past");
suru("したい", "tai-form");
suru("したかった", "tai-form past");
suru("している", "progressive");
suru("していた", "progressive past");
suru("しています", "progressive polite");

suruNoun("する", "suru verb");
suruNoun("した", "past");
suruNoun("して", "te-form");
suruNoun("しない", "negative");
suruNoun("しなかった", "negative past");
suruNoun("しなくて", "negative te-form");
suruNoun("します", "polite");
suruNoun("しました", "polite past");
suruNoun("しません", "polite negative");
suruNoun("しませんでした", "polite negative past");
suruNoun("しよう", "volitional");
suruNoun("しろ", "imperative");
suruNoun("すれば", "conditional");
suruNoun("される", "passive");
suruNoun("された", "passive past");
suruNoun("させる", "causative");
suruNoun("させた", "causative past");
suruNoun("させられる", "causative passive");
suruNoun("せられる", "causative passive");
suruNoun("できる", "potential");
suruNoun("できた", "potential past");
suruNoun("したい", "tai-form");
suruNoun("したかった", "tai-form past");
suruNoun("している", "progressive");
suruNoun("していた", "progressive past");
suruNoun("しています", "progressive polite");

function kuru(from: string, label: string): void {
  add(from, "くる", "vk", label);
}

add("た", "る", "vk", "past");
add("て", "る", "vk", "te-form");
add("ます", "る", "vk", "polite");
add("ました", "る", "vk", "polite past");
add("ません", "る", "vk", "polite negative");
add("られる", "る", "vk", "passive/potential");
add("させる", "る", "vk", "causative");
add("よう", "る", "vk", "volitional");
add("れば", "る", "vk", "conditional");
add("い", "る", "vk", "imperative");
kuru("こない", "negative");
kuru("こなかった", "negative past");
kuru("きます", "polite");
kuru("きました", "polite past");
kuru("こられる", "passive/potential");
kuru("こさせる", "causative");
kuru("こよう", "volitional");
kuru("これば", "conditional");

function adjI(from: string, label: string): void {
  add(from, "い", "adj-i", label);
}

adjI("くない", "negative");
adjI("くなかった", "negative past");
adjI("くなくて", "negative te-form");
adjI("くなければ", "negative conditional");
adjI("かった", "past");
adjI("くて", "te-form");
adjI("ければ", "conditional");
adjI("く", "adverbial");
adjI("すぎる", "excessive");
adjI("すぎた", "excessive past");

function adjNa(from: string, label: string): void {
  add(from, "", "adj-na", label);
}

adjNa("だった", "past");
adjNa("じゃない", "negative");
adjNa("ではない", "negative");
adjNa("じゃなかった", "negative past");
adjNa("ではなかった", "negative past");
adjNa("じゃなくて", "negative te-form");
adjNa("ではなく", "negative");
adjNa("なら", "conditional");
adjNa("ならば", "conditional");
adjNa("でしょう", "polite");
adjNa("だったら", "conditional");
adjNa("な", "attributive");
adjNa("に", "adverbial");
adjNa("だ", "copula");
adjNa("です", "polite");

function noun(from: string, label: string): void {
  add(from, "", "n", label);
}

noun("だった", "past");
noun("でした", "polite past");
noun("じゃない", "negative");
noun("ではない", "negative");
noun("じゃなかった", "negative past");
noun("でしょう", "polite");
noun("なら", "conditional");
noun("だ", "copula");
noun("です", "polite");

const rulesByLastChar = new Map<string, Rule[]>();
for (const rule of rules) {
  const last = rule.from.slice(-1);
  const bucket = rulesByLastChar.get(last);
  if (bucket) {
    bucket.push(rule);
  } else {
    rulesByLastChar.set(last, [rule]);
  }
}

interface State {
  surface: string;
  type: WordType | null;
  reasons: string[];
}

const cache = new Map<string, Deinflection[]>();
const CACHE_LIMIT = 4096;
const EMPTY: Deinflection[] = [];

export function deinflect(input: string, maxDepth = 3): Deinflection[] {
  if (!input) {
    return EMPTY;
  }

  const cacheKey = `${maxDepth}:${input}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const results = new Map<string, Deinflection>();
  const visited = new Set<string>();
  let frontier: State[] = [{ surface: input, type: null, reasons: [] }];

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const next: State[] = [];

    for (const state of frontier) {
      const bucket = rulesByLastChar.get(state.surface.slice(-1));
      if (!bucket) {
        continue;
      }

      for (const rule of bucket) {
        if (!state.surface.endsWith(rule.from)) {
          continue;
        }
        if (state.type !== null && state.type !== rule.type) {
          continue;
        }

        const surface = state.surface.slice(0, -rule.from.length) + rule.to;
        if (!surface || surface === state.surface) {
          continue;
        }

        const key = `${surface}|${rule.type}`;
        if (visited.has(key)) {
          continue;
        }
        visited.add(key);

        const reasons = [...state.reasons, rule.label];
        results.set(key, { surface, type: rule.type, reasons });
        next.push({ surface, type: rule.type, reasons });
      }
    }

    frontier = next;
  }

  if (cache.size >= CACHE_LIMIT) {
    cache.clear();
  }

  const list = [...results.values()].sort(
    (a, b) => b.surface.length - a.surface.length || a.reasons.length - b.reasons.length,
  );
  cache.set(cacheKey, list);
  return list;
}
