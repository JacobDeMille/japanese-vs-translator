/** Compact tuple layouts shared by the build script, the loader, and the UI. */
export type RawEntry = [
  kanji: string[],
  kana: string[],
  pos: string[],
  glosses: string[],
  priority: number,
];

export type RawKanji = [
  strokes: number,
  grade: number,
  frequency: number,
  on: string[],
  kun: string[],
  meanings: string[],
];
