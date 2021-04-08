import * as vscode from "vscode";
import { run, stop, open } from "./commands";

const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);

item.text = "∴Ellx∴";

type CommandDefinition = [string, (...args: any[]) => any];

const commands: CommandDefinition[] = [
  ["ellx.run", () => {
    run();
    item.show();
  }],
  ["ellx.stop", deactivate],
  ["ellx.open", open],
];

export function activate(context: vscode.ExtensionContext) {
  for (const [name, cb] of commands) {
    context.subscriptions.push(vscode.commands.registerCommand(name, cb));
  }
}

export function deactivate() {
  vscode.commands.executeCommand("setContext", "ellx:running", false);
  stop();
  item.hide();
}
