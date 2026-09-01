import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { scanSecrets } from "@lorapok/cursor-monitor-shared";
import type { ActiveAccountStoragePaths } from "./accountStore";
import {
  discoverTranscripts,
  indexConversationRecord,
  reindexMissingConversations,
  type ParsedTranscript,
  type ReindexProgressUpdate,
} from "./conversationReindex";
import { detectEditorHost, isEditorProcessRunning, validateDatabaseIntegrity } from "./cursorAuth";
import { lookbackLabel, type CursorIndexPolicy } from "./cursorIndexConfig";

export const CIP_FORMAT_VERSION = 1;

export type CipTurn = { role: "user" | "assistant"; text: string; createdAt: number };

export type CipRecord = {
  originalId: string;
  contentHash: string;
  title: string;
  body: string;
  branch: string;
  createdAt: number;
  updatedAt: number;
  turns: CipTurn[];
  workspaceLabel: string;
  redactions?: number;
};

export type CipHeader = {
  cipVersion: number;
  exporterVersion: string;
  exportedAt: string;
  sourceKind: "agent-transcripts";
  ownerHash: string;
  ownerLabel?: string | null;
  productFolder?: string | null;
  itemCount: number;
  sanitized: boolean;
  lookbackDays: number;
};

export type CipPackage = { header: CipHeader; records: CipRecord[] };

export type CipExportResult = {
  success: boolean;
  error?: string;
  path?: string;
  recordCount: number;
};

export type CipImportResult = {
  success: boolean;
  error?: string;
  imported: number;
  skipped: number;
  searchIndexed: string[];
  sidebarRestored: string[];
  backups: string[];
};

function validateCipRecord(record: unknown, index: number): string | null {
  if (!record || typeof record !== "object") {
    return `Record ${index} is not an object.`;
  }
  const entry = record as Partial<CipRecord>;
  if (!entry.originalId || typeof entry.originalId !== "string") {
    return `Record ${index} is missing originalId.`;
  }
  if (!entry.title || typeof entry.title !== "string") {
    return `Record ${index} is missing title.`;
  }
  if (typeof entry.body !== "string") {
    return `Record ${index} is missing body.`;
  }
  if (!Array.isArray(entry.turns) || entry.turns.length === 0) {
    return `Record ${index} must include at least one turn.`;
  }
  for (let turnIndex = 0; turnIndex < entry.turns.length; turnIndex++) {
    const turn = entry.turns[turnIndex];
    if (!turn || typeof turn !== "object") {
      return `Record ${index} turn ${turnIndex} is invalid.`;
    }
    if (turn.role !== "user" && turn.role !== "assistant") {
      return `Record ${index} turn ${turnIndex} has invalid role.`;
    }
    if (typeof turn.text !== "string" || !turn.text.trim()) {
      return `Record ${index} turn ${turnIndex} is missing text.`;
    }
    if (!Number.isFinite(Number(turn.createdAt))) {
      return `Record ${index} turn ${turnIndex} has invalid createdAt.`;
    }
  }
  if (!Number.isFinite(Number(entry.createdAt)) || !Number.isFinite(Number(entry.updatedAt))) {
    return `Record ${index} has invalid timestamps.`;
  }
  return null;
}

/** Validate a parsed CIP package before import. */
export function validateCipPackage(input: unknown): { ok: true; pkg: CipPackage } | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Index package must be a JSON object." };
  }
  const pkg = input as Partial<CipPackage>;
  if (!pkg.header || typeof pkg.header !== "object") {
    return { ok: false, error: "Index package is missing header." };
  }
  if (pkg.header.cipVersion !== CIP_FORMAT_VERSION) {
    return {
      ok: false,
      error: `Unsupported index package version (${String(pkg.header.cipVersion)}). Expected ${CIP_FORMAT_VERSION}.`,
    };
  }
  if (pkg.header.sourceKind !== "agent-transcripts") {
    return { ok: false, error: "Index package sourceKind must be agent-transcripts." };
  }
  if (!Array.isArray(pkg.records)) {
    return { ok: false, error: "Index package is missing records array." };
  }
  if (pkg.records.length === 0) {
    return { ok: false, error: "Index package contains no records." };
  }
  for (let index = 0; index < pkg.records.length; index++) {
    const recordError = validateCipRecord(pkg.records[index], index);
    if (recordError) {
      return { ok: false, error: recordError };
    }
  }
  return { ok: true, pkg: pkg as CipPackage };
}

function hashOwner(label: string, productFolder?: string): string {
  return crypto
    .createHash("sha256")
    .update(`cip:${label}:${productFolder ?? "unknown"}`)
    .digest("hex")
    .slice(0, 16);
}

function recordHash(record: Pick<CipRecord, "title" | "turns">): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ title: record.title, turns: record.turns }))
    .digest("hex");
}

function sanitizeText(text: string): { text: string; redactions: number } {
  const findings = scanSecrets(text, { context: "workspace" });
  if (!findings.length) return { text, redactions: 0 };

  const patterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/g,
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    /\b(?:sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36,}|gho_[A-Za-z0-9]{36,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g,
    /(?:password|api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*['"]?([^\s'"]{8,})['"]?/gi,
  ];

  let next = text;
  let redactions = 0;
  for (const pattern of patterns) {
    next = next.replace(pattern, () => {
      redactions++;
      return "[REDACTED]";
    });
  }
  return { text: next, redactions: redactions || findings.length };
}

function parsedToCipRecord(parsed: ParsedTranscript, policy: CursorIndexPolicy): CipRecord {
  let redactions = 0;
  const turns = parsed.turns.map((turn) => {
    const sanitized = sanitizeText(turn.text);
    redactions += sanitized.redactions;
    return { ...turn, text: sanitized.text };
  });
  const titleSanitized = sanitizeText(parsed.title);
  redactions += titleSanitized.redactions;
  const bodySanitized = sanitizeText(parsed.body);
  redactions += bodySanitized.redactions;
  return {
    originalId: parsed.id,
    contentHash: recordHash({ title: titleSanitized.text, turns }),
    title: titleSanitized.text,
    body: bodySanitized.text,
    branch: parsed.branch,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
    turns,
    workspaceLabel: path.basename(parsed.workspace.workspacePath) || parsed.workspace.workspacePath,
    redactions,
  };
}

export async function exportConversationIndexPackage(
  extensionVersion: string,
  storage: ActiveAccountStoragePaths,
  policy: CursorIndexPolicy,
  onProgress?: (update: ReindexProgressUpdate) => void
): Promise<CipExportResult> {
  if (!policy.cipExportEnabled) {
    return { success: false, error: "Export is disabled by Mission Control policy.", recordCount: 0 };
  }

  onProgress?.({ phase: "preparing", message: "Preparing export…" });
  const host = detectEditorHost(vscode.env.appName);
  const minUpdatedAtMs =
    policy.transcriptLookbackDays > 0
      ? Date.now() - policy.transcriptLookbackDays * 24 * 60 * 60 * 1000
      : null;
  onProgress?.({ phase: "scan", message: `Scanning ${lookbackLabel(policy)}…` });
  const parsed = discoverTranscripts(storage.searchDbPath, host, vscode.env.appName, {
    minUpdatedAtMs,
    maxRecords: policy.maxExportRecords > 0 ? policy.maxExportRecords : undefined,
  });
  if (!parsed.length) {
    return { success: false, error: "No transcripts matched the configured lookback window.", recordCount: 0 };
  }

  onProgress?.({ phase: "scan", message: "Sanitizing export records…", total: parsed.length });
  const records = parsed.map((entry) => parsedToCipRecord(entry, policy));
  if (policy.cipRequireSanitization && records.some((record) => (record.redactions ?? 0) > 0)) {
    onProgress?.({ phase: "scan", message: "Secrets redacted from export payload." });
  }

  const pkg: CipPackage = {
    header: {
      cipVersion: CIP_FORMAT_VERSION,
      exporterVersion: extensionVersion,
      exportedAt: new Date().toISOString(),
      sourceKind: "agent-transcripts",
      ownerHash: hashOwner(storage.accountLabel, storage.productFolder),
      ownerLabel: storage.accountLabel,
      productFolder: storage.productFolder,
      itemCount: records.length,
      sanitized: true,
      lookbackDays: policy.transcriptLookbackDays,
    },
    records,
  };

  onProgress?.({ phase: "done", message: `Packaged ${records.length} conversation(s).`, total: records.length });

  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(os.homedir(), "cursor-index-export.cip.json")),
    filters: { "Cursor Index Package": ["cip.json", "json"] },
    saveLabel: "Export index package",
  });
  if (!target) {
    return { success: false, error: "Export cancelled.", recordCount: records.length };
  }

  fs.writeFileSync(target.fsPath, JSON.stringify(pkg, null, 2), "utf8");
  return { success: true, path: target.fsPath, recordCount: records.length };
}

function cipRecordToParsed(record: CipRecord, workspacePath: string): ParsedTranscript {
  return {
    id: record.originalId,
    path: "",
    title: record.title,
    body: record.body,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    turns: record.turns,
    branch: record.branch,
    workspace: {
      workspaceId: crypto.createHash("sha256").update(workspacePath).digest("hex").slice(0, 32),
      workspacePath,
      fingerprint: "",
    },
  };
}

export async function importConversationIndexPackage(
  extensionUri: vscode.Uri,
  storage: ActiveAccountStoragePaths,
  policy: CursorIndexPolicy,
  onProgress?: (update: ReindexProgressUpdate) => void
): Promise<CipImportResult> {
  if (!policy.cipImportEnabled) {
    return {
      success: false,
      error: "Import is disabled by Mission Control policy.",
      imported: 0,
      skipped: 0,
      searchIndexed: [],
      sidebarRestored: [],
      backups: [],
    };
  }

  const host = detectEditorHost(vscode.env.appName);
  if (policy.requireEditorQuit && isEditorProcessRunning(host, vscode.env.appName)) {
    return {
      success: false,
      error:
        "Editor is still running. Quit Cursor/VS Code completely before importing — live database writes are disabled to protect your data.",
      imported: 0,
      skipped: 0,
      searchIndexed: [],
      sidebarRestored: [],
      backups: [],
    };
  }

  const source = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { "Cursor Index Package": ["cip.json", "json"] },
    openLabel: "Import index package",
  });
  if (!source?.[0]) {
    return {
      success: false,
      error: "Import cancelled.",
      imported: 0,
      skipped: 0,
      searchIndexed: [],
      sidebarRestored: [],
      backups: [],
    };
  }

  onProgress?.({ phase: "preparing", message: "Reading index package…" });
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(fs.readFileSync(source[0].fsPath, "utf8"));
  } catch {
    return {
      success: false,
      error: "Invalid index package JSON.",
      imported: 0,
      skipped: 0,
      searchIndexed: [],
      sidebarRestored: [],
      backups: [],
    };
  }

  const validated = validateCipPackage(parsedJson);
  if (!validated.ok) {
    return {
      success: false,
      error: validated.error,
      imported: 0,
      skipped: 0,
      searchIndexed: [],
      sidebarRestored: [],
      backups: [],
    };
  }
  const pkg = validated.pkg;

  const limit = policy.maxImportRecords > 0 ? policy.maxImportRecords : pkg.records.length;
  const records = pkg.records.slice(0, limit);
  if (!records.length) {
    return {
      success: false,
      error: "Import limit reduced the package to zero records.",
      imported: 0,
      skipped: 0,
      searchIndexed: [],
      sidebarRestored: [],
      backups: [],
    };
  }
  const importBatchId = crypto.randomUUID();
  const workspacePath =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? storage.globalStorageDir;

  onProgress?.({
    phase: "scan",
    message: `Importing ${records.length} record(s) into ${storage.accountLabel}…`,
    total: records.length,
  });

  const templatePath = path.join(extensionUri.fsPath, "media", "composer-template.json");
  if (!fs.existsSync(templatePath)) {
    return {
      success: false,
      error: "Composer template missing from extension media.",
      imported: 0,
      skipped: 0,
      searchIndexed: [],
      sidebarRestored: [],
      backups: [],
    };
  }

  if (!fs.existsSync(storage.stateDbPath)) {
    return {
      success: false,
      error: "Cursor state database not found.",
      imported: 0,
      skipped: 0,
      searchIndexed: [],
      sidebarRestored: [],
      backups: [],
    };
  }

  const stateIntegrity = validateDatabaseIntegrity(storage.stateDbPath);
  if (!stateIntegrity.valid) {
    return {
      success: false,
      error: `Cursor state database looks damaged (${stateIntegrity.reason}).`,
      imported: 0,
      skipped: 0,
      searchIndexed: [],
      sidebarRestored: [],
      backups: [],
    };
  }

  onProgress?.({ phase: "backup", message: "Creating safety backups…" });
  const suffix = ".bak-pre-ccm-import";
  const backups: string[] = [];
  if (fs.existsSync(storage.stateDbPath)) {
    const backupPath = `${storage.stateDbPath}${suffix}`;
    fs.copyFileSync(storage.stateDbPath, backupPath);
    backups.push(backupPath);
  }
  if (fs.existsSync(storage.searchDbPath)) {
    const backupPath = `${storage.searchDbPath}${suffix}`;
    fs.copyFileSync(storage.searchDbPath, backupPath);
    backups.push(backupPath);
  }

  const template = JSON.parse(fs.readFileSync(templatePath, "utf8")) as Record<string, unknown>;
  const searchIndexed: string[] = [];
  const sidebarRestored: string[] = [];
  let skipped = 0;
  let imported = 0;

  const ownerHash = pkg.header.ownerHash;
  const importMetaBase = {
    sourceOwnerHash: ownerHash,
    importBatchId,
    importedAt: new Date().toISOString(),
  };

  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  const searchDb = fs.existsSync(storage.searchDbPath)
    ? new DatabaseSync(storage.searchDbPath, { timeout: 10000 })
    : null;
  const stateDb = new DatabaseSync(storage.stateDbPath, { timeout: 15000 });

  try {
    if (searchDb) searchDb.exec("BEGIN IMMEDIATE");
    stateDb.exec("BEGIN IMMEDIATE");

    for (let index = 0; index < records.length; index++) {
      const record = records[index]!;
      const parsed = cipRecordToParsed(record, workspacePath);
      const composerId = crypto.randomUUID();
      const importMeta = {
        ...importMetaBase,
        originalId: record.originalId,
        contentHash: record.contentHash,
      };

      const { searchIndexed: didSearch, sidebarRestored: didSidebar } = indexConversationRecord({
        searchDb,
        stateDb,
        template,
        parsed,
        composerId,
        source: "cip-import",
        importMeta,
      });

      if (!didSearch && !didSidebar) {
        skipped++;
      } else {
        imported++;
        if (didSearch) searchIndexed.push(composerId);
        if (didSidebar) sidebarRestored.push(composerId);
      }

      if (
        records.length <= 12 ||
        index === 0 ||
        index === records.length - 1 ||
        (index + 1) % 4 === 0
      ) {
        onProgress?.({
          phase: "sidebar",
          message: `Importing conversations (${index + 1}/${records.length})…`,
          current: index + 1,
          total: records.length,
        });
      }
    }

    if (searchDb) searchDb.exec("COMMIT");
    stateDb.exec("COMMIT");
  } catch (error) {
    try {
      if (searchDb) searchDb.exec("ROLLBACK");
    } catch {
      // ignore
    }
    try {
      stateDb.exec("ROLLBACK");
    } catch {
      // ignore
    }
    if (searchDb) searchDb.close();
    stateDb.close();
    return {
      success: false,
      error: error instanceof Error ? error.message : "Import failed while updating databases.",
      imported,
      skipped,
      searchIndexed,
      sidebarRestored,
      backups,
    };
  }

  if (searchDb) searchDb.close();
  stateDb.close();

  onProgress?.({
    phase: "done",
    message: `Finished — imported ${imported}, skipped ${skipped}.`,
    current: imported,
    total: records.length,
  });

  return {
    success: true,
    imported,
    skipped,
    searchIndexed,
    sidebarRestored,
    backups,
  };
}

/** Re-export local reindex for unified command surface. */
export { reindexMissingConversations };
