import * as vscode from "vscode";
import runServer, { FSOptions } from "./server";

async function promptUsername(
  opts: vscode.WorkspaceConfiguration
): Promise<string> {
  const username = await vscode.window.showInputBox({
    value: "",
    placeHolder: "Ellx username",
  });

  opts.update("user", username, true);

  return username || "";
}

async function checkIfShouldNavigate(
  opts: vscode.WorkspaceConfiguration,
  identity: string
): Promise<void> {
  const shouldNavigate = await vscode.window.showInformationMessage(
    "Ellx server started successfully.",
    "Open in browser"
  );

  if (shouldNavigate && !opts.get("clientUrl")) {
    vscode.window.showErrorMessage("Client URL option is not set");
    return;
  }

  if (shouldNavigate) {
    const clientUrl: vscode.Uri = vscode.Uri.parse(opts.get("clientUrl") || "");

    // TODO: check if index.md is absent, redirect to any file?
    vscode.env.openExternal(
      vscode.Uri.joinPath(clientUrl, "external", identity, "index.md")
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand("ellx.run", async () => {
    const root = vscode.workspace.workspaceFolders![0].uri.toString();
    if (root === undefined) {
      vscode.window.showErrorMessage("Ellx requires root folder to be opened");
    }

    const opts = vscode.workspace.getConfiguration("ellx");

    const user = await promptUsername(opts);
    if (!user) {
      vscode.window.showErrorMessage(
        "Ellx extensions requires username to run"
      );
      return;
    }

    const port = parseInt(opts.get("port") || "", 10);
    const identity: string = opts.get("identity") || "localhost~" + port;

    const options: FSOptions = {
      root: root.startsWith("file://") ? root.slice("file://".length) : root, // trim schema
      user,
      identity,
      trust: opts.get("trust") || "",
      port,
    };

    const server = await runServer(options);

    await checkIfShouldNavigate(opts, identity);

    vscode.workspace.onDidSaveTextDocument((doc: vscode.TextDocument) => {
      const fileChanged = doc.uri.toString().slice(root.length);
      for (const client of server.clients) {
        client.send(fileChanged);
      }
    });
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {}
