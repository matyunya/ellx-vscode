import {
  TextDocument,
  workspace,
  TextDocumentChangeEvent,
  window,
  TextEditor,
  WorkspaceConfiguration,
  Uri,
  env,
  commands
} from "vscode";

import runServer, { FSOptions } from "../server";

import WebSocket from "ws";

async function promptUsername(
  opts: WorkspaceConfiguration
): Promise<string> {
  const username = await window.showInputBox({
    value: opts.get("user") || "",
    placeHolder: "Ellx username",
  });

  opts.update("user", username, true);

  return username || "";
}

async function checkIfShouldNavigate(
  opts: WorkspaceConfiguration,
  identity: string
): Promise<void> {
  const shouldNavigate = await window.showInformationMessage(
    "Ellx server started successfully.",
    "Open in browser"
  );

  if (shouldNavigate && !opts.get("clientUrl")) {
    window.showErrorMessage("Client URL option is not set");
    return;
  }

  if (shouldNavigate) {
    const clientUrl: Uri = Uri.parse(opts.get("clientUrl") || "");

    // TODO: check if index.md is absent, create empty default?
    env.openExternal(
      Uri.joinPath(clientUrl, "external", identity, "index.md")
    );
  }
}

type EllxAction = "save" | "update" | "open";

let server: WebSocket.Server;

export function notify(action: EllxAction, payload: any) {
  for (const client of server.clients) {
    client.send(JSON.stringify({ action, ...payload }));
  }
}

export async function stop() {
  return server.close((err) => {
    if (err) {
      window.showErrorMessage("Error stopping Ellx server");
      console.error(err);
    } else {
      window.showInformationMessage("Ellx server stopped successfully");
    }
  });
}

export async function run() {
  if (!workspace.workspaceFolders) {
    window.showErrorMessage("Ellx requires root folder to be opened");
    return;
  }
  const root = workspace.workspaceFolders[0].uri.toString();

  const opts = workspace.getConfiguration("ellx");

  const user = await promptUsername(opts);
  if (!user) {
    window.showErrorMessage("Ellx extensions requires username to run");
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

  server = await runServer(options);

  commands.executeCommand("setContext", "ellx:running", true);

  await checkIfShouldNavigate(opts, identity);

  workspace.onDidSaveTextDocument((doc: TextDocument) => {
    const path = doc.uri.toString().slice(root.length);
    notify("save", { body: doc.getText(), path, action: "save" });
  });

  workspace.onDidChangeTextDocument(
    (e: TextDocumentChangeEvent) => {
      const path = e.document.uri.toString().slice(root.length);
      if (path.endsWith(".js")) return; // we don't want to rebundle every stroke atm

      notify("update", { body: e.document.getText(), path });
    }
  );

  window.onDidChangeActiveTextEditor((e: TextEditor | any) => {
    if (e === undefined) return;

    const doc = e.document;
    if (
      !doc.uri.toString().startsWith("file://") ||
      !doc.uri.toString().match(/\.(md|ellx|html)$/)
    )
      return;

    const path = doc.uri.toString().slice(root.length);
    notify("open", { path });
  });
}
