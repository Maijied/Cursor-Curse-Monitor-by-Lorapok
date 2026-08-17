// Minimal vscode stub for tests that import modules which reference vscode.
// Only the shapes actually touched at module-load time need to exist.
module.exports = {
  workspace: {
    getConfiguration: () => ({
      get: () => undefined,
    }),
    onDidChangeConfiguration: () => ({ dispose: () => {} }),
  },
  window: {
    createStatusBarItem: () => ({
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
    registerWebviewViewProvider: () => ({ dispose: () => {} }),
  },
  commands: {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: async () => {},
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  Uri: {
    joinPath: (...args) => ({ fsPath: args.join("/") }),
    file: (p) => ({ fsPath: p }),
  },
  ViewColumn: { One: 1 },
  EventEmitter: class {
    event = () => {};
    fire() {}
    dispose() {}
  },
};
