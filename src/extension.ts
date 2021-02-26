import * as vscode from "vscode";
import { run, stop } from "./commands/run";

const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);

item.text = "∴Ellx∴";

type CommandDefinition = [string, (...args: any[]) => any];

const commands: CommandDefinition[] = [
  ["ellx.run", run],
  ["ellx.stop", deactivate]
];

export function activate(context: vscode.ExtensionContext) {
  for (const [name, cb] of commands) {
    context.subscriptions.push(vscode.commands.registerCommand(name, cb));
  }

  item.show();
}

export function deactivate() {
  vscode.commands.executeCommand("setContext", "ellx:running", false);
  stop();
  item.hide();
}
