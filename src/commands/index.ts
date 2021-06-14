import {
  TextDocument,
  workspace,
  TextDocumentChangeEvent,
  window,
  TextEditor,
  WorkspaceConfiguration,
  Uri,
  env,
  commands,
  Disposable,
} from "vscode";

import runServer, { FSOptions } from "../server";

import WebSocket from "ws";

async function promptUsername(opts: WorkspaceConfiguration): Promise<string> {
  const username = await window.showInputBox({
    value: opts.get("user") || "",
    placeHolder: "Ellx username",
  });

  opts.update("user", username, true);

  return username || "";
}

export function open() {
  const opts = workspace.getConfiguration("ellx");
  const clientUrl: Uri = Uri.parse(opts.get("clientUrl") || "");

  // TODO: check if index.md is absent, create empty default?
  return env.openExternal(
    Uri.joinPath(clientUrl, "external", getIdentity(), "index.md")
  );
}

async function checkIfShouldNavigate(
  opts: WorkspaceConfiguration
): Promise<void> {
  const shouldNavigate = await window.showInformationMessage(
    "Ellx server started successfully.",
    "Open in browser"
  );

  if (shouldNavigate && !opts.get("clientUrl")) {
    window.showErrorMessage("Client URL option is not set");
    return;
  }

  if (shouldNavigate) open();
}

type EllxAction = "save" | "update" | "open";

let server: WebSocket.Server;

export function notify(action: EllxAction, payload: any) {
  for (const client of server.clients) {
    client.send(JSON.stringify({ action, ...payload }));
  }
}

export async function stop() {
  console.log("Trying to stop server");
  server.clients.forEach((socket) => {
    socket.close();

    process.nextTick(() => {
      if ([socket.OPEN, socket.CLOSING].includes(socket.readyState)) {
        // Socket still hangs, hard close
        socket.terminate();
      }
    });
  });

  return server.close((err) => {
    if (err) {
      window.showErrorMessage("Error stopping Ellx server");
      console.error(err);
    } else {
      window.showInformationMessage("Ellx server stopped successfully");
    }

    console.log(err || "Stopped successfully");
  });
}

const getPort = (opts: WorkspaceConfiguration) =>
  parseInt(opts.get("port") || "3002", 10);

const getIdentity = (): string => {
  if (!workspace.workspaceFolders) {
    return "untitled-project";
  }

  return workspace.workspaceFolders[0].name.toString();
};

export async function run(): Promise<Disposable[]> {
  if (!workspace.workspaceFolders) {
    window.showErrorMessage("Ellx requires root folder to be opened");
    return [];
  }
  const root = workspace.workspaceFolders[0].uri.toString();

  const opts = workspace.getConfiguration("ellx");

  const user = await promptUsername(opts);
  if (!user) {
    window.showErrorMessage("Ellx extensions requires username to run");
    return [];
  }

  const options: FSOptions = {
    root: root.startsWith("file://") ? root.slice("file://".length) : root, // trim schema
    user,
    identity: getIdentity(),
    trust: opts.get("trust") || "",
    port: getPort(opts),
  };

  try {
    server = await runServer(options);
  } catch (e) {
    window.showErrorMessage("Error running Ellx server", e);
    return [];
  }

  console.log({ server }, 'RNNING');

  commands.executeCommand("setContext", "ellx:running", true);

  await checkIfShouldNavigate(opts);

  return [
    workspace.onDidSaveTextDocument((doc: TextDocument) => {
      const path = doc.uri.toString().slice(root.length);
      if (path.endsWith(".ellx")) return;

      notify("save", { body: doc.getText(), path, action: "save" });
    }),
    workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
      const path = e.document.uri.toString().slice(root.length);
      if (!path.endsWith(".html") && !path.endsWith(".md")) return; // we don't want to rebundle every stroke atm

      notify("update", { body: e.document.getText(), path });
    }),

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
    }),
  ];
}
