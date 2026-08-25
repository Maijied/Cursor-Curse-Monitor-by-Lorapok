/**
 * VS Code–compatible AI IDEs and editors that can install this extension
 * from Open VSX and/or the Visual Studio Code Marketplace.
 */
export type SupportedIdeWrapper = {
  id: string;
  name: string;
  tagline: string;
  /** Primary install channel for this editor */
  marketplace: "open-vsx" | "vscode-marketplace" | "both";
  /** Short label for marketplace pill */
  marketplaceLabel: string;
  website?: string;
  /** Slug for website/assets/ides/{icon}.svg */
  icon: string;
  featured?: boolean;
};

export const SUPPORTED_IDE_WRAPPERS_HEADLINE =
  "Works with every major VS Code–based AI IDE";

export const SUPPORTED_IDE_WRAPPERS_SUBLINE =
  "Install from Open VSX or the VS Code Marketplace — the same extension runs in Cursor, Windsurf, VSCodium, and every VS Code wrapper IDE listed below.";

export const SUPPORTED_IDE_WRAPPERS: SupportedIdeWrapper[] = [
  {
    id: "cursor",
    name: "Cursor",
    tagline: "AI-native code editor (primary target)",
    marketplace: "both",
    marketplaceLabel: "Open VSX · VS Code MP",
    website: "https://cursor.com",
    icon: "cursor",
    featured: true,
  },
  {
    id: "vscode",
    name: "Visual Studio Code",
    tagline: "Microsoft's official editor",
    marketplace: "vscode-marketplace",
    marketplaceLabel: "VS Code Marketplace",
    website: "https://code.visualstudio.com",
    icon: "vscode",
    featured: true,
  },
  {
    id: "windsurf",
    name: "Windsurf",
    tagline: "Codeium's VS Code–based AI IDE",
    marketplace: "open-vsx",
    marketplaceLabel: "Open VSX",
    website: "https://codeium.com/windsurf",
    icon: "windsurf",
    featured: true,
  },
  {
    id: "vscodium",
    name: "VSCodium",
    tagline: "Open-source VS Code build",
    marketplace: "open-vsx",
    marketplaceLabel: "Open VSX",
    website: "https://vscodium.com",
    icon: "vscodium",
    featured: true,
  },
  {
    id: "void",
    name: "Void",
    tagline: "Open-source AI code editor",
    marketplace: "open-vsx",
    marketplaceLabel: "Open VSX",
    website: "https://voideditor.com",
    icon: "void",
  },
  {
    id: "gitpod",
    name: "Gitpod / Ona",
    tagline: "Cloud & desktop dev environments",
    marketplace: "open-vsx",
    marketplaceLabel: "Open VSX",
    website: "https://www.gitpod.io",
    icon: "gitpod",
  },
  {
    id: "positron",
    name: "Positron",
    tagline: "Posit's data-science IDE",
    marketplace: "open-vsx",
    marketplaceLabel: "Open VSX",
    website: "https://posit.co/products/ide/positron",
    icon: "positron",
  },
  {
    id: "trae",
    name: "Trae",
    tagline: "ByteDance AI IDE (VS Code fork)",
    marketplace: "open-vsx",
    marketplaceLabel: "Open VSX",
    website: "https://www.trae.ai",
    icon: "trae",
  },
  {
    id: "kiro",
    name: "Kiro",
    tagline: "AWS agentic IDE (VS Code based)",
    marketplace: "open-vsx",
    marketplaceLabel: "Open VSX",
    website: "https://kiro.dev",
    icon: "kiro",
  },
  {
    id: "qoder",
    name: "Qoder",
    tagline: "Alibaba AI coding IDE",
    marketplace: "open-vsx",
    marketplaceLabel: "Open VSX",
    website: "https://qoder.com",
    icon: "qoder",
  },
  {
    id: "pearai",
    name: "PearAI",
    tagline: "Open AI editor fork",
    marketplace: "open-vsx",
    marketplaceLabel: "Open VSX",
    website: "https://trypear.ai",
    icon: "pearai",
  },
  {
    id: "code-server",
    name: "code-server",
    tagline: "VS Code in the browser / remote",
    marketplace: "open-vsx",
    marketplaceLabel: "Open VSX",
    website: "https://github.com/coder/code-server",
    icon: "code-server",
  },
  {
    id: "theia",
    name: "Eclipse Theia",
    tagline: "Extensible cloud & desktop IDE",
    marketplace: "open-vsx",
    marketplaceLabel: "Open VSX",
    website: "https://theia-ide.org",
    icon: "theia",
  },
  {
    id: "azure-data-studio",
    name: "Azure Data Studio",
    tagline: "Microsoft data platform IDE",
    marketplace: "vscode-marketplace",
    marketplaceLabel: "VS Code Marketplace",
    website: "https://azure.microsoft.com/products/data-studio",
    icon: "azure-data-studio",
  },
  {
    id: "coder",
    name: "Coder",
    tagline: "Self-hosted dev workspaces",
    marketplace: "open-vsx",
    marketplaceLabel: "Open VSX",
    website: "https://coder.com",
    icon: "coder",
  },
];

export const SUPPORTED_IDE_WRAPPER_NAMES = SUPPORTED_IDE_WRAPPERS.map((i) => i.name);

export function formatSupportedIdeList(max = 6): string {
  const names = SUPPORTED_IDE_WRAPPER_NAMES;
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")}, and more`;
}
