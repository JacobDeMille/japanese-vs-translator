import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RawEntry, RawKanji } from "./types";

export interface DictionaryEntry {
  id: number;
  kanji: string[];
  kana: string[];
  pos: string[];
  glosses: string[];
  priority: number;
}

const EMPTY_IDS: number[] = [];

/**
 * In-memory index over the generated JMdict data. All surface forms are mapped
 * to entry ids once at load time so a lookup is a single Map access.
 */
export class DictionaryIndex {
  private readonly surfaces = new Map<string, number[]>();

  private constructor(
    private readonly entries: RawEntry[],
    private readonly kanji: Record<string, RawKanji>,
    public readonly source: string,
  ) {
    for (let id = 0; id < entries.length; id++) {
      const entry = entries[id];
      for (const form of entry[0]) {
        this.addSurface(form, id);
      }
      for (const form of entry[1]) {
        this.addSurface(form, id);
      }
    }
  }

  static async load(directory: string): Promise<DictionaryIndex> {
    const [wordsJson, kanjiJson] = await Promise.all([
      readFile(join(directory, "words.json"), "utf8"),
      readFile(join(directory, "kanji.json"), "utf8"),
    ]);

    const entries = JSON.parse(wordsJson) as RawEntry[];
    const kanji = JSON.parse(kanjiJson) as Record<string, RawKanji>;
    return new DictionaryIndex(entries, kanji, directory);
  }

  private addSurface(form: string, id: number): void {
    if (!form) {
      return;
    }
    const ids = this.surfaces.get(form);
    if (!ids) {
      this.surfaces.set(form, [id]);
    } else if (ids[ids.length - 1] !== id) {
      ids.push(id);
    }
  }

  get entryCount(): number {
    return this.entries.length;
  }

  get kanjiCount(): number {
    return Object.keys(this.kanji).length;
  }

  lookup(surface: string): readonly number[] {
    return this.surfaces.get(surface) ?? EMPTY_IDS;
  }

  getEntry(id: number): DictionaryEntry {
    const raw = this.entries[id];
    return {
      id,
      kanji: raw[0],
      kana: raw[1],
      pos: raw[2],
      glosses: raw[3],
      priority: raw[4],
    };
  }

  getEntries(ids: readonly number[], limit: number): DictionaryEntry[] {
    if (ids.length === 0 || limit <= 0) {
      return [];
    }
    return [...ids]
      .sort((a, b) => this.entries[b][4] - this.entries[a][4] || a - b)
      .slice(0, limit)
      .map((id) => this.getEntry(id));
  }

  kanjiFor(character: string): RawKanji | undefined {
    return this.kanji[character];
  }
}
