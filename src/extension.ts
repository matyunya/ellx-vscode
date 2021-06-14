import * as vscode from "vscode";
import { run, stop, open } from "./commands";

const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);

item.text = "∴Ellx∴";

type CommandDefinition = [string, (...args: any[]) => any];

let unsubs: vscode.Disposable[] = [];

const commands: CommandDefinition[] = [
  [
    "ellx.run",
    async () => {
      try {
        unsubs = await run();
      } catch (e) {
        console.error("Couldn't launch server", e);
      }
      item.show();
    },
  ],
  ["ellx.stop", deactivate],
  ["ellx.open", open],
];

export function activate(context: vscode.ExtensionContext) {
  for (const [name, cb] of commands) {
    context.subscriptions.push(vscode.commands.registerCommand(name, cb));
  }
}

export async function deactivate() {
  vscode.commands.executeCommand("setContext", "ellx:running", false);
  unsubs.forEach((u) => u.dispose());
  await stop();
  item.hide();
}
