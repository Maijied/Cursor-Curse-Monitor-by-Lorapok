export type CloudProvider = "google" | "microsoft" | "other";

export type CloudDevEnvironment = {
  id: string;
  provider: CloudProvider;
  name: string;
  tagline: string;
  docsUrl: string;
  consoleUrl?: string;
  installUrl?: string;
  notes: string[];
};

export const CLOUD_DEV_ENVIRONMENTS: CloudDevEnvironment[] = [
  {
    id: "gcp-workstations",
    provider: "google",
    name: "Google Cloud Workstations",
    tagline: "Managed dev environments on GCP with VS Code in the browser",
    docsUrl: "https://cloud.google.com/workstations/docs",
    consoleUrl: "https://console.cloud.google.com/workstations",
    installUrl: "https://open-vsx.org/extension/LorapokLabs/cursor-curse-monitor-by-lorapok",
    notes: [
      "Install the extension from Open VSX inside the workstation image.",
      "Sign in to Cursor in the browser profile used by the workstation, or paste a token in extension Options.",
      "Local Cursor state.vscdb is not available — use saved accounts in the extension.",
    ],
  },
  {
    id: "gcp-cloud-shell",
    provider: "google",
    name: "Google Cloud Shell Editor",
    tagline: "Browser-based VS Code on ephemeral Cloud Shell VMs",
    docsUrl: "https://cloud.google.com/shell/docs/using-cloud-shell-editor",
    consoleUrl: "https://console.cloud.google.com/?cloudshell=true",
    notes: [
      "Ephemeral disk — re-paste token after session reset.",
      "Use Open VSX marketplace in Cloud Shell Editor.",
    ],
  },
  {
    id: "azure-dev-box",
    provider: "microsoft",
    name: "Microsoft Dev Box",
    tagline: "Cloud dev workstations with full VS Code / Cursor installs",
    docsUrl: "https://learn.microsoft.com/azure/dev-box/",
    consoleUrl: "https://portal.azure.com/#view/Microsoft_Azure_DevBox",
    notes: [
      "Install Cursor or VS Code on the dev box; extension reads local state.vscdb when using system account.",
      "For browser-only flows, use the Firefox/Chrome extension with cursor.com sign-in.",
    ],
  },
  {
    id: "azure-data-studio",
    provider: "microsoft",
    name: "Azure Data Studio",
    tagline: "Microsoft data platform IDE (VS Code–compatible)",
    docsUrl: "https://learn.microsoft.com/sql/azure-data-studio/what-is-azure-data-studio",
    consoleUrl: "https://portal.azure.com",
    installUrl: "https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok",
    notes: [
      "Install from VS Code Marketplace.",
      "Usage monitoring uses the same Cursor API token as other VS Code–based editors.",
    ],
  },
  {
    id: "vscode-dev",
    provider: "microsoft",
    name: "vscode.dev / GitHub Codespaces",
    tagline: "Browser VS Code with optional Codespaces backend",
    docsUrl: "https://code.visualstudio.com/docs/editor/vscode-web",
    consoleUrl: "https://github.com/codespaces",
    notes: [
      "Open VSX or VS Code Marketplace depending on host.",
      "Codespaces: persist extension settings in your dotfiles or use saved token accounts.",
    ],
  },
];
