let customConfig = {};
const configChangeListeners = new Set();
const notifications = [];
const executedCommands = [];
const registeredCommands = new Map();

const mockVscode = {
  _reset() {
    customConfig = {};
    configChangeListeners.clear();
    notifications.length = 0;
    executedCommands.length = 0;
    registeredCommands.clear();
  },
  _setConfig(section, values) {
    if (typeof section === "string" && values !== undefined) {
      customConfig[section] = { ...(customConfig[section] || {}), ...values };
    } else if (typeof section === "object") {
      customConfig = { ...customConfig, ...section };
    }
  },
  _fireConfigChange(sectionName) {
    for (const listener of configChangeListeners) {
      try {
        listener({
          affectsConfiguration: (sec) =>
            !sectionName || sec === sectionName || sectionName.startsWith(sec) || sec.startsWith(sectionName),
        });
      } catch (err) {
        console.error("Config change listener error:", err);
      }
    }
  },
  _getNotifications() {
    return [...notifications];
  },
  _clearNotifications() {
    notifications.length = 0;
  },
  _getExecutedCommands() {
    return [...executedCommands];
  },
  workspace: {
    getConfiguration: (section) => ({
      get: (key, fallback) => {
        if (section && customConfig[section] && customConfig[section][key] !== undefined) {
          return customConfig[section][key];
        }
        if (customConfig[key] !== undefined) {
          return customConfig[key];
        }
        return fallback;
      },
    }),
    onDidChangeConfiguration: (listener) => {
      configChangeListeners.add(listener);
      return {
        dispose: () => configChangeListeners.delete(listener),
      };
    },
  },
  window: {
    createStatusBarItem: () => ({
      show: () => {},
      hide: () => {},
      dispose: () => {},
      text: "",
      tooltip: "",
    }),
    registerWebviewViewProvider: () => ({ dispose: () => {} }),
    showInformationMessage: async (text, ...items) => {
      notifications.push({ type: "info", text, items });
      return undefined;
    },
    showWarningMessage: async (text, ...items) => {
      notifications.push({ type: "warning", text, items });
      return undefined;
    },
    showErrorMessage: async (text, ...items) => {
      notifications.push({ type: "error", text, items });
      return undefined;
    },
  },
  commands: {
    registerCommand: (cmd, handler) => {
      registeredCommands.set(cmd, handler);
      return { dispose: () => registeredCommands.delete(cmd) };
    },
    executeCommand: async (cmd, ...args) => {
      executedCommands.push({ cmd, args });
      const handler = registeredCommands.get(cmd);
      if (handler) {
        return handler(...args);
      }
      return undefined;
    },
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  Uri: {
    joinPath: (...args) => ({ fsPath: args.join("/") }),
    file: (p) => ({ fsPath: p }),
  },
  ViewColumn: { One: 1, Beside: 2 },
  EventEmitter: class {
    constructor() {
      this.listeners = new Set();
      this.event = (listener) => {
        this.listeners.add(listener);
        return { dispose: () => this.listeners.delete(listener) };
      };
    }
    fire(data) {
      for (const l of this.listeners) l(data);
    }
    dispose() {
      this.listeners.clear();
    }
  },
  Disposable: class {
    constructor(fn) {
      this.dispose = typeof fn === "function" ? fn : () => {};
    }
  },
  env: {
    appName: "Cursor",
  },
};

module.exports = mockVscode;
