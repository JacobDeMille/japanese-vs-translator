import * as vscode from "vscode";
import type { DictionaryIndex } from "../core/dictionary";
import { renderKanjiOnly, renderUnknownWord, renderWord, type ThemeKind } from "../core/format";
import { findWordAt, isJapaneseChar, weakKatakanaPrefix } from "../core/tokenizer";

function activeTheme(): ThemeKind {
  const kind = vscode.window.activeColorTheme.kind;
  return kind === vscode.ColorThemeKind.Light ||
    kind === vscode.ColorThemeKind.HighContrastLight
    ? "light"
    : "dark";
}

export class JapaneseHoverProvider implements vscode.HoverProvider {
  constructor(
    private readonly getDictionary: () => Promise<DictionaryIndex>,
    private readonly log: vscode.OutputChannel,
  ) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Hover | undefined> {
    try {
      const line = document.lineAt(position.line).text;
      const character = Math.min(position.character, line.length - 1);
      if (character < 0 || !isJapaneseChar(line[character])) {
        return undefined;
      }

      const config = vscode.workspace.getConfiguration("japaneseReader");
      const maxEntries = config.get<number>("maxResults", 3);
      const dictionary = await this.getDictionary();
      if (token.isCancellationRequested) {
        return undefined;
      }

      const match = findWordAt(dictionary, line, character, {
        maxWordLength: config.get<number>("maxWordLength", 16),
        maxEntries,
      });
      const theme = activeTheme();

      const unknownRun = weakKatakanaPrefix(dictionary, line, character, match);
      if (unknownRun) {
        const markdown = new vscode.MarkdownString(
          renderUnknownWord(unknownRun.surface, theme),
        );
        markdown.supportHtml = true;
        markdown.isTrusted = false;
        return new vscode.Hover(
          markdown,
          new vscode.Range(position.line, unknownRun.start, position.line, unknownRun.end),
        );
      }

      if (match) {
        const markdown = new vscode.MarkdownString(
          renderWord(match, dictionary, {
            maxDefinitions: config.get<number>("maxDefinitions", 8),
            maxResults: maxEntries,
            showKanjiDetails: config.get<boolean>("showKanjiDetails", true),
            theme,
          }),
        );
        // The card uses theme-colored <span> tags from a sanitized whitelist.
        markdown.supportHtml = true;
        markdown.isTrusted = false;
        return new vscode.Hover(
          markdown,
          new vscode.Range(position.line, match.start, position.line, match.end),
        );
      }

      const profile = dictionary.kanjiFor(line[character]);
      if (profile) {
        const markdown = new vscode.MarkdownString(
          renderKanjiOnly(line[character], profile, theme),
        );
        markdown.supportHtml = true;
        markdown.isTrusted = false;
        return new vscode.Hover(
          markdown,
          new vscode.Range(position.line, character, position.line, character + 1),
        );
      }

      return undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.appendLine(`Hover failed: ${message}`);
      return undefined;
    }
  }
}
