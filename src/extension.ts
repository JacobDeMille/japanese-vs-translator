import * as vscode from "vscode";
import { DictionaryIndex } from "./core/dictionary";
import { tokenizeLine } from "./core/tokenizer";
import { JapaneseHoverProvider } from "./providers/hoverProvider";

let output: vscode.OutputChannel;
let extensionUri: vscode.Uri;
let dictionaryPromise: Promise<DictionaryIndex> | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  output = vscode.window.createOutputChannel("Japanese Reader");
  extensionUri = context.extensionUri;
  output.appendLine(`[${new Date().toISOString()}] Activating Japanese VS Dictionary`);

  const provider = new JapaneseHoverProvider(getDictionary, output);

  context.subscriptions.push(
    output,
    vscode.languages.registerHoverProvider(
      [{ scheme: "file" }, { scheme: "untitled" }, { scheme: "vscode-notebook-cell" }],
      provider,
    ),
    vscode.commands.registerCommand("japaneseReader.reloadDictionary", reloadDictionary),
    vscode.commands.registerCommand("japaneseReader.tokenizeLine", showTokens),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("japaneseReader.dictionaryPath")) {
        dictionaryPromise = undefined;
        output.appendLine("Dictionary path changed; the dictionary will reload on next use.");
      }
    }),
  );

  output.appendLine("HoverProvider registered for file, untitled, and notebook-cell documents.");

  // Warm the index in the background so the first real hover is fast.
  void getDictionary().catch((error: unknown) => {
    output.appendLine(`Dictionary load failed: ${errorMessage(error)}`);
  });
}

export function deactivate(): void {
  // Disposables are owned by the extension context.
}

function getDictionary(): Promise<DictionaryIndex> {
  if (!dictionaryPromise) {
    dictionaryPromise = loadDictionary().catch((error: unknown) => {
      dictionaryPromise = undefined;
      throw error;
    });
  }
  return dictionaryPromise;
}

async function loadDictionary(): Promise<DictionaryIndex> {
  const directory = await resolveDictionaryDirectory();
  const startedAt = Date.now();
  output.appendLine(`Loading dictionary from ${directory} ...`);
  const dictionary = await DictionaryIndex.load(directory);
  output.appendLine(
    `Loaded ${dictionary.entryCount} entries and ${dictionary.kanjiCount} kanji in ${
      Date.now() - startedAt
    }ms`,
  );
  return dictionary;
}

async function resolveDictionaryDirectory(): Promise<string> {
  const configured = vscode.workspace
    .getConfiguration("japaneseReader")
    .get<string>("dictionaryPath", "")
    .trim();
  if (configured) {
    return configured;
  }

  const fullDirectory = vscode.Uri.joinPath(extensionUri, "data", "dict");
  if (await pathExists(vscode.Uri.joinPath(fullDirectory, "manifest.json"))) {
    return fullDirectory.fsPath;
  }

  return vscode.Uri.joinPath(extensionUri, "data", "seed").fsPath;
}

async function pathExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function reloadDictionary(): Promise<void> {
  dictionaryPromise = undefined;
  try {
    const dictionary = await getDictionary();
    void vscode.window.showInformationMessage(
      `Japanese Reader: ${dictionary.entryCount} entries, ${dictionary.kanjiCount} kanji loaded.`,
    );
  } catch (error: unknown) {
    void vscode.window.showErrorMessage(`Japanese Reader: ${errorMessage(error)}`);
  }
}

async function showTokens(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage("Japanese Reader: open a file first.");
    return;
  }

  const line = editor.document.lineAt(editor.selection.active.line);
  const dictionary = await getDictionary();
  const config = vscode.workspace.getConfiguration("japaneseReader");
  const tokens = tokenizeLine(dictionary, line.text, {
    maxWordLength: config.get<number>("maxWordLength", 16),
    maxEntries: 1,
  });

  output.appendLine("");
  output.appendLine(`Tokens for line ${line.lineNumber + 1}: ${line.text}`);
  for (const token of tokens) {
    const arrow =
      token.base !== token.matched
        ? ` -> ${token.base} (${[...token.reasons].reverse().join(" + ")})`
        : "";
    output.appendLine(
      `  ${String(token.start).padStart(3)}-${String(token.end).padEnd(3)} ${token.matched}${arrow}${
        token.known ? "" : " [unknown]"
      }`,
    );
  }
  output.show(true);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
