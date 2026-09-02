import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  createFullBackup,
  detectEditorHost,
  getConversationSearchDbPath,
  getCursorGlobalStoragePath,
  getWorkspaceStorageDir,
  isEditorProcessRunning,
  resolveAgentProjectsRoot,
  validateDatabaseIntegrity,
} from "./cursorAuth";
import { resolveCursorIndexPolicy, transcriptCutoffMs, type CursorIndexPolicy } from "./cursorIndexConfig";
import type { ActiveAccountStoragePaths } from "./accountStore";

type SqliteDb = InstanceType<typeof import("node:sqlite").DatabaseSync>;

export type ReindexResult = {
  success: boolean;
  error?: string;
  searchIndexed: string[];
  sidebarRestored: string[];
  skipped: string[];
  backups: string[];
};

type WorkspaceMeta = {
  workspaceId: string;
  workspacePath: string;
  fingerprint: string;
};

type TranscriptTurn = {
  role: "user" | "assistant";
  text: string;
  createdAt: number;
};

export type ParsedTranscript = {
  id: string;
  path: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  turns: TranscriptTurn[];
  branch: string;
  workspace: WorkspaceMeta;
};

const TS_RE = /<timestamp>([^<]+)<\/timestamp>/;
const QUERY_RE = /<user_query>\s*([\s\S]*?)\s*<\/user_query>/;
const TAG_RE = /<[^>]+>/g;

function loadSqlite(): typeof import("node:sqlite") {
  return require("node:sqlite") as typeof import("node:sqlite");
}

function stripText(raw: string): string {
  return raw.replace(TAG_RE, " ").replace(/\s+/g, " ").trim();
}

function parseTimestamp(raw: string): number | null {
  const cleaned = raw.replace("(UTC+6)", "+0600").replace("(UTC)", "+0000");
  const formats = [
    /^[A-Za-z]+, ([A-Za-z]+) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}) ([AP]M) ([+-]\d{4})$/,
  ];
  for (const pattern of formats) {
    const match = cleaned.match(pattern);
    if (!match) continue;
    const [, month, day, year, hour, minute, ampm, offset] = match;
    if (!offset) continue;
    const monthIndex = new Date(`${month} 1, 2000`).getMonth();
    let hour24 = Number(hour) % 12;
    if (ampm === "PM") hour24 += 12;
    const sign = offset.startsWith("-") ? -1 : 1;
    const offHours = Number(offset.slice(1, 3));
    const offMinutes = Number(offset.slice(3, 5));
    const utcMs = Date.UTC(
      Number(year),
      monthIndex,
      Number(day),
      hour24 - sign * offHours,
      Number(minute) - sign * offMinutes
    );
    return utcMs;
  }
  return null;
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

function randomKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

function workspaceUri(workspacePath: string) {
  return {
    $mid: 1,
    fsPath: workspacePath,
    external: `file://${workspacePath}`,
    path: workspacePath,
    scheme: "file",
  };
}

function readWorkspaceCatalog(host: ReturnType<typeof detectEditorHost>, appName: string): WorkspaceMeta[] {
  const root = getWorkspaceStorageDir(host, appName);
  const catalog: WorkspaceMeta[] = [];
  if (!fs.existsSync(root)) return catalog;

  for (const entry of fs.readdirSync(root)) {
    const workspaceJson = path.join(root, entry, "workspace.json");
    if (!fs.existsSync(workspaceJson)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(workspaceJson, "utf8")) as { folder?: string };
      const folder = parsed.folder?.replace(/^file:\/\//, "") ?? "";
      if (!folder) continue;
      catalog.push({
        workspaceId: entry,
        workspacePath: folder,
        fingerprint: "",
      });
    } catch {
      // ignore malformed workspace metadata
    }
  }
  return catalog;
}

function resolveFingerprint(searchDbPath: string): string {
  if (!fs.existsSync(searchDbPath)) return "";
  try {
    const { DatabaseSync } = loadSqlite();
    const db = new DatabaseSync(searchDbPath, { readOnly: true, timeout: 5000 });
    try {
      const row = db
        .prepare(
          `SELECT root_fingerprint AS fp FROM conversations
           WHERE root_fingerprint IS NOT NULL AND root_fingerprint <> ''
           ORDER BY updated_at DESC LIMIT 1`
        )
        .get() as { fp?: string } | undefined;
      return row?.fp ?? "";
    } finally {
      db.close();
    }
  } catch {
    return "";
  }
}

function resolveWorkspaceForPath(
  workspacePath: string,
  searchDbPath: string,
  host: ReturnType<typeof detectEditorHost>,
  appName: string
): WorkspaceMeta | null {
  const catalog = readWorkspaceCatalog(host, appName);
  const exact = catalog.find((item) => item.workspacePath === workspacePath);
  if (exact) {
    exact.fingerprint = resolveFingerprint(searchDbPath) || exact.fingerprint;
    return exact;
  }
  return null;
}

function currentWorkspaceMeta(
  searchDbPath: string,
  host: ReturnType<typeof detectEditorHost>,
  appName: string
): WorkspaceMeta | null {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!folder) return null;
  const resolved = resolveWorkspaceForPath(folder, searchDbPath, host, appName);
  if (resolved) return resolved;
  return {
    workspaceId: crypto.createHash("sha256").update(folder).digest("hex").slice(0, 32),
    workspacePath: folder,
    fingerprint: resolveFingerprint(searchDbPath),
  };
}

function inferWorkspacePath(
  projectDir: string,
  host: ReturnType<typeof detectEditorHost>,
  appName: string
): string | null {
  const slug = path.basename(projectDir);
  if (slug.startsWith("home-")) {
    const parts = slug.split("-");
    if (parts.length >= 2) {
      return path.join(os.homedir(), ...parts.slice(1));
    }
  }
  const catalog = readWorkspaceCatalog(host, appName);
  const match = catalog.find((item) => projectDir.includes(path.basename(item.workspacePath)));
  return match?.workspacePath ?? null;
}

export function discoverTranscripts(
  searchDbPath: string,
  host: ReturnType<typeof detectEditorHost>,
  appName: string,
  options: { minUpdatedAtMs?: number | null; maxRecords?: number } = {}
): ParsedTranscript[] {
  const projectsRoot = resolveAgentProjectsRoot(host, appName);
  const fallbackWorkspace = currentWorkspaceMeta(searchDbPath, host, appName);
  const results: ParsedTranscript[] = [];

  if (!fs.existsSync(projectsRoot)) return results;

  for (const projectEntry of fs.readdirSync(projectsRoot)) {
    const transcriptsRoot = path.join(projectsRoot, projectEntry, "agent-transcripts");
    if (!fs.existsSync(transcriptsRoot)) continue;

    const workspacePath = inferWorkspacePath(path.join(projectsRoot, projectEntry), host, appName);
    const workspace =
      (workspacePath ? resolveWorkspaceForPath(workspacePath, searchDbPath, host, appName) : null) ??
      fallbackWorkspace;
    if (!workspace) continue;

    for (const convId of fs.readdirSync(transcriptsRoot)) {
      if (convId === "subagents") continue;
      const jsonlPath = path.join(transcriptsRoot, convId, `${convId}.jsonl`);
      if (!fs.existsSync(jsonlPath)) continue;

      const parsed = loadTranscript(jsonlPath, convId, workspace);
      if (!parsed) continue;
      if (options.minUpdatedAtMs != null && parsed.updatedAt < options.minUpdatedAtMs) continue;
      results.push(parsed);
    }
  }

  const sorted = results.sort((a, b) => a.createdAt - b.createdAt);
  if (options.maxRecords && options.maxRecords > 0) {
    return sorted.slice(-options.maxRecords);
  }
  return sorted;
}

function loadTranscript(
  jsonlPath: string,
  convId: string,
  workspace: WorkspaceMeta
): ParsedTranscript | null {
  const userSnippets: string[] = [];
  const bodyParts: string[] = [];
  const turns: TranscriptTurn[] = [];
  let createdAt = Math.trunc(fs.statSync(jsonlPath).mtimeMs);
  let updatedAt = createdAt;
  let pendingAssistant: string[] = [];

  const flushAssistant = (ts: number) => {
    if (!pendingAssistant.length) return;
    const text = pendingAssistant.join("\n\n").trim();
    pendingAssistant = [];
    if (!text) return;
    turns.push({ role: "assistant", text, createdAt: ts });
    bodyParts.push(text);
  };

  for (const line of fs.readFileSync(jsonlPath, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    let row: { role?: string; message?: { content?: Array<{ text?: string }> } };
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const role = row.role;
    const text = row.message?.content?.[0]?.text ?? "";
    if (!text) continue;

    let ts = updatedAt;
    const tsMatch = text.match(TS_RE);
    if (tsMatch?.[1]) {
      const parsedTs = parseTimestamp(tsMatch[1]);
      if (parsedTs) {
        ts = parsedTs;
        updatedAt = Math.max(updatedAt, parsedTs);
        createdAt = Math.min(createdAt, parsedTs);
      }
    }

    if (role === "user") {
      flushAssistant(ts);
      const queryMatch = text.match(QUERY_RE);
      const snippet = stripText(queryMatch?.[1] ?? text);
      if (!snippet) continue;
      userSnippets.push(snippet);
      bodyParts.push(snippet);
      turns.push({ role: "user", text: snippet, createdAt: ts });
    } else if (role === "assistant") {
      const snippet = stripText(text);
      if (snippet && snippet !== "[REDACTED]") pendingAssistant.push(snippet);
    }
  }

  flushAssistant(updatedAt);
  if (!turns.length) return null;

  const titleSource = userSnippets[0] ?? "Recovered conversation";
  const title = titleSource.length > 80 ? `${titleSource.slice(0, 80)}…` : titleSource;
  return {
    id: convId,
    path: jsonlPath,
    title,
    body: bodyParts.slice(0, 40).join("\n").slice(0, 12000),
    createdAt,
    updatedAt,
    turns,
    branch: "master",
    workspace,
  };
}

function emptyBubbleShell(bubbleId: string, bubbleType: 1 | 2, createdAtMs: number) {
  return {
    _v: 3,
    type: bubbleType,
    approximateLintErrors: [],
    lints: [],
    codebaseContextChunks: [],
    commits: [],
    pullRequests: [],
    attachedCodeChunks: [],
    assistantSuggestedDiffs: [],
    gitDiffs: [],
    interpreterResults: [],
    images: [],
    attachedFolders: [],
    attachedFoldersNew: [],
    bubbleId,
    userResponsesToSuggestedCodeBlocks: [],
    suggestedCodeBlocks: [],
    diffsForCompressingFiles: [],
    relevantFiles: [],
    toolResults: [],
    notepads: [],
    capabilities: [],
    multiFileLinterErrors: [],
    diffHistories: [],
    recentLocationsHistory: [],
    recentlyViewedFiles: [],
    isAgentic: bubbleType === 2,
    fileDiffTrajectories: [],
    existedSubsequentTerminalCommand: false,
    existedPreviousTerminalCommand: false,
    docsReferences: [],
    webReferences: [],
    aiWebSearchResults: [],
    requestId: crypto.randomUUID(),
    attachedFoldersListDirResults: [],
    humanChanges: [],
    attachedHumanChanges: false,
    summarizedComposers: [],
    cursorRules: [],
    cursorCommands: [],
    cursorCommandsExplicitlySet: false,
    pastChats: [],
    pastChatsExplicitlySet: false,
    contextPieces: [],
    editTrailContexts: [],
    allThinkingBlocks: [],
    diffsSinceLastApply: [],
    deletedFiles: [],
    supportedTools: [],
    tokenCount: { inputTokens: 0, outputTokens: 0 },
    attachedFileCodeChunksMetadataOnly: [],
    consoleLogs: [],
    uiElementPicked: [],
    isRefunded: false,
    knowledgeItems: [],
    documentationSelections: [],
    externalLinks: [],
    projectLayouts: [],
    unifiedMode: 2,
    capabilityContexts: [],
    todos: [],
    createdAt: msToIso(createdAtMs),
    mcpDescriptors: [],
    workspaceUris: [],
    conversationState: "~",
    codeBlocks: [],
    text: "",
    richText: "",
  };
}

function buildBubbles(composerId: string, turns: TranscriptTurn[]) {
  const headers: Array<Record<string, unknown>> = [];
  const bubbleRows: Array<{ key: string; value: Record<string, unknown> }> = [];

  for (const turn of turns) {
    const bubbleId = crypto.randomUUID();
    const bubbleType = turn.role === "user" ? 1 : 2;
    const bubble = emptyBubbleShell(bubbleId, bubbleType as 1 | 2, turn.createdAt);
    bubble.text = turn.text;
    if (bubbleType === 1) {
      bubble.richText = JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: turn.text }] }],
      });
    }
    headers.push({
      bubbleId,
      type: bubbleType,
      grouping: {
        isRenderable: true,
        hasText: true,
        isShortPlainText: turn.text.length < 200,
        toolDisplayComputed: bubbleType === 2,
      },
      contentHeightHint: 44,
      createdAt: msToIso(turn.createdAt),
    });
    bubbleRows.push({
      key: `bubbleId:${composerId}:${bubbleId}`,
      value: bubble,
    });
  }

  return { headers, bubbleRows };
}

function makeHeader(
  composerId: string,
  title: string,
  createdAt: number,
  updatedAt: number,
  branch: string,
  workspace: WorkspaceMeta
) {
  return {
    type: "head",
    composerId,
    name: title,
    lastUpdatedAt: updatedAt,
    createdAt,
    unifiedMode: "agent",
    forceMode: "edit",
    hasUnreadMessages: false,
    totalLinesAdded: 0,
    totalLinesRemoved: 0,
    filesChangedCount: 0,
    subtitle: "Recovered from agent transcript",
    hasBlockingPendingActions: false,
    hasPendingPlan: false,
    isDraft: false,
    isWorktree: false,
    worktreeStartedReadOnly: false,
    isSpec: false,
    isProject: false,
    isBestOfNSubcomposer: false,
    numSubComposers: 0,
    referencedPlans: [],
    trackedGitRepos: [
      {
        repoPath: workspace.workspacePath,
        branches: [{ branchName: branch, lastInteractionAt: updatedAt }],
      },
    ],
    workspaceIdentifier: { id: workspace.workspaceId, uri: workspaceUri(workspace.workspacePath) },
    conversationCheckpointLastUpdatedAt: updatedAt,
  };
}

function makeComposerData(
  template: Record<string, unknown>,
  composerId: string,
  createdAt: number,
  headers: Array<Record<string, unknown>>,
  workspace: WorkspaceMeta
) {
  const data = JSON.parse(JSON.stringify(template)) as Record<string, unknown>;
  data.composerId = composerId;
  data.createdAt = createdAt;
  data.fullConversationHeadersOnly = headers;
  data.conversationMap = {};
  data.unifiedMode = "agent";
  data.forceMode = "edit";
  data.isAgentic = true;
  data.agentBackend = "cursor-agent";
  data.isNAL = false;
  data.speculativeSummarizationEncryptionKey = randomKey();
  data.blobEncryptionKey = randomKey();
  data.workspaceIdentifier = {
    id: workspace.workspaceId,
    uri: workspaceUri(workspace.workspacePath),
  };
  data.status = "completed";
  return data;
}

function backupDbPaths(dbPath: string): string[] {
  const bundle = createFullBackup(dbPath);
  return bundle?.files.map((file) => file.backup) ?? [];
}

export function indexConversationRecord(options: {
  searchDb?: SqliteDb | null;
  stateDb: SqliteDb;
  template: Record<string, unknown>;
  parsed: ParsedTranscript;
  composerId?: string;
  source?: "local" | "cip-import";
  importMeta?: Record<string, unknown>;
}): { searchIndexed: boolean; sidebarRestored: boolean } {
  const composerId = options.composerId ?? options.parsed.id;
  const source = options.source ?? "local";
  let searchIndexed = false;
  if (options.searchDb) {
    searchIndexed = reindexSearch(options.searchDb, options.parsed, source, composerId);
  }
  const sidebarRestored = restoreSidebar(
    options.stateDb,
    options.template,
    options.parsed,
    composerId,
    options.importMeta
  );
  return { searchIndexed, sidebarRestored };
}

function reindexSearch(
  db: SqliteDb,
  parsed: ParsedTranscript,
  source: "local" | "cip-import" = "local",
  composerId = parsed.id
): boolean {
  const existing = db
    .prepare("SELECT 1 FROM conversations WHERE id = ?")
    .get(composerId) as { 1?: number } | undefined;
  if (existing) return false;

  const nextRowid =
    (
      db.prepare("SELECT COALESCE(MAX(fts_rowid), 0) + 1 AS next FROM conversations").get() as
        | { next?: number }
        | undefined
    )?.next ?? 1;

  db.prepare("INSERT INTO conversation_fts(rowid, title, body, branches) VALUES (?, ?, ?, ?)").run(
    nextRowid,
    parsed.title,
    parsed.body,
    parsed.branch
  );
  db.prepare(
    `INSERT INTO conversations(
      fts_rowid, source, scope, id, title, branches,
      updated_at, is_archived, root_fingerprint, cache_fingerprint
    ) VALUES (?, ?, '', ?, ?, ?, ?, 0, ?, NULL)`
  ).run(
    nextRowid,
    source,
    composerId,
    parsed.title,
    parsed.branch,
    parsed.updatedAt,
    parsed.workspace.fingerprint || null
  );
  db.prepare(
    `INSERT INTO conversation_search_candidates(id, updated_at)
     VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`
  ).run(composerId, parsed.updatedAt);
  return true;
}

function restoreSidebar(
  db: SqliteDb,
  template: Record<string, unknown>,
  parsed: ParsedTranscript,
  composerId = parsed.id,
  importMeta?: Record<string, unknown>
): boolean {
  const headerExists = db
    .prepare("SELECT 1 FROM composerHeaders WHERE composerId = ?")
    .get(composerId);
  const dataExists = db
    .prepare("SELECT 1 FROM cursorDiskKV WHERE key = ?")
    .get(`composerData:${composerId}`);
  if (headerExists || dataExists) return false;

  const { headers, bubbleRows } = buildBubbles(composerId, parsed.turns);
  const header = makeHeader(
    composerId,
    parsed.title,
    parsed.createdAt,
    parsed.updatedAt,
    parsed.branch,
    parsed.workspace
  );
  if (importMeta) {
    (header as Record<string, unknown>).importMeta = importMeta;
    (header as Record<string, unknown>).subtitle = "Imported conversation index";
  }
  const composerData = makeComposerData(
    template,
    composerId,
    parsed.createdAt,
    headers,
    parsed.workspace
  );

  db.prepare(
    `INSERT INTO composerHeaders(
      composerId, workspaceId, createdAt, lastUpdatedAt,
      isArchived, isSubagent, recency, checkpointAt, value
    ) VALUES (?, ?, ?, ?, 0, 0, ?, NULL, ?)`
  ).run(
    composerId,
    parsed.workspace.workspaceId,
    parsed.createdAt,
    parsed.updatedAt,
    parsed.updatedAt,
    JSON.stringify(header)
  );
  db.prepare("INSERT INTO cursorDiskKV(key, value) VALUES (?, ?)").run(
    `composerData:${composerId}`,
    JSON.stringify(composerData)
  );
  for (const bubble of bubbleRows) {
    db.prepare("INSERT INTO cursorDiskKV(key, value) VALUES (?, ?)").run(
      bubble.key,
      JSON.stringify(bubble.value)
    );
  }
  return true;
}

export type ReindexProgressPhase =
  | "preparing"
  | "backup"
  | "scan"
  | "search"
  | "sidebar"
  | "done";

export type ReindexProgressUpdate = {
  phase: ReindexProgressPhase;
  message: string;
  current?: number;
  total?: number;
};

export type ReindexOptions = {
  policy?: CursorIndexPolicy;
  storage?: ActiveAccountStoragePaths;
  onProgress?: (update: ReindexProgressUpdate) => void;
};

function reportProgress(
  onProgress: ReindexOptions["onProgress"],
  update: ReindexProgressUpdate
): void {
  onProgress?.(update);
}

export async function reindexMissingConversations(
  extensionUri: vscode.Uri,
  options: ReindexOptions = {}
): Promise<ReindexResult> {
  const host = detectEditorHost(vscode.env.appName);
  const appName = vscode.env.appName;
  const onProgress = options.onProgress;
  reportProgress(onProgress, { phase: "preparing", message: "Loading index policy…" });
  const policy = options.policy ?? (await resolveCursorIndexPolicy());

  if (!policy.indexEnabled) {
    return {
      success: false,
      error:
        "Conversation indexing is disabled by Mission Control policy. Ask your admin to re-enable it in Settings → Cursor index.",
      searchIndexed: [],
      sidebarRestored: [],
      skipped: [],
      backups: [],
    };
  }

  if (policy.requireEditorQuit && isEditorProcessRunning(host, appName)) {
    return {
      success: false,
      error:
        "Editor is still running. Quit Cursor/VS Code completely before reindexing — live database writes are disabled to protect your data.",
      searchIndexed: [],
      sidebarRestored: [],
      skipped: [],
      backups: [],
    };
  }

  const stateDbPath = options.storage?.stateDbPath ?? getCursorGlobalStoragePath(host, appName);
  const searchDbPath = options.storage?.searchDbPath ?? getConversationSearchDbPath(host, appName);
  const templatePath = path.join(extensionUri.fsPath, "media", "composer-template.json");

  reportProgress(onProgress, { phase: "preparing", message: "Validating Cursor databases…" });

  if (!fs.existsSync(templatePath)) {
    return {
      success: false,
      error: "Composer template missing from extension media.",
      searchIndexed: [],
      sidebarRestored: [],
      skipped: [],
      backups: [],
    };
  }

  if (!fs.existsSync(stateDbPath)) {
    return {
      success: false,
      error: "Cursor state database not found.",
      searchIndexed: [],
      sidebarRestored: [],
      skipped: [],
      backups: [],
    };
  }

  const stateIntegrity = validateDatabaseIntegrity(stateDbPath);
  if (!stateIntegrity.valid) {
    return {
      success: false,
      error: `Cursor state database looks damaged (${stateIntegrity.reason}).`,
      searchIndexed: [],
      sidebarRestored: [],
      skipped: [],
      backups: [],
    };
  }

  reportProgress(onProgress, { phase: "backup", message: "Creating safety backups…" });
  const backups = [...backupDbPaths(stateDbPath), ...backupDbPaths(searchDbPath)];

  const template = JSON.parse(fs.readFileSync(templatePath, "utf8")) as Record<string, unknown>;
  reportProgress(onProgress, { phase: "scan", message: "Scanning agent transcripts…" });
  const minUpdatedAtMs = transcriptCutoffMs(policy);
  const transcripts = discoverTranscripts(searchDbPath, host, appName, {
    minUpdatedAtMs,
    maxRecords: policy.maxReindexRecords > 0 ? policy.maxReindexRecords : undefined,
  });
  reportProgress(onProgress, {
    phase: "scan",
    message:
      transcripts.length === 0
        ? "No transcripts matched the configured lookback window."
        : `Checking ${transcripts.length} transcript(s)…`,
    total: transcripts.length,
  });
  const searchIndexed: string[] = [];
  const sidebarRestored: string[] = [];
  const skipped: string[] = [];

  const { DatabaseSync } = loadSqlite();

  const stateDb = new DatabaseSync(stateDbPath, { timeout: 15000 });
  try {
    stateDb.exec("BEGIN IMMEDIATE");
    for (let index = 0; index < transcripts.length; index++) {
      const parsed = transcripts[index]!;
      const { sidebarRestored: restored } = indexConversationRecord({
        stateDb,
        template,
        parsed,
        composerId: parsed.id,
        source: "local",
      });
      if (restored) {
        sidebarRestored.push(parsed.id);
      }
      if (
        transcripts.length <= 12 ||
        index === 0 ||
        index === transcripts.length - 1 ||
        (index + 1) % 4 === 0
      ) {
        reportProgress(onProgress, {
          phase: "sidebar",
          message: `Restoring sidebar chats (${index + 1}/${transcripts.length})…`,
          current: index + 1,
          total: transcripts.length,
        });
      }
    }
    stateDb.exec("COMMIT");
  } catch (error) {
    try {
      stateDb.exec("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    stateDb.close();
    return {
      success: false,
      error: error instanceof Error ? error.message : "Sidebar restore failed.",
      searchIndexed,
      sidebarRestored,
      skipped,
      backups,
    };
  }
  stateDb.close();

  if (fs.existsSync(searchDbPath)) {
    const searchDb = new DatabaseSync(searchDbPath, { timeout: 10000 });
    try {
      searchDb.exec("BEGIN IMMEDIATE");
      for (let index = 0; index < transcripts.length; index++) {
        const parsed = transcripts[index]!;
        if (reindexSearch(searchDb, parsed, "local", parsed.id)) searchIndexed.push(parsed.id);
        if (
          transcripts.length <= 12 ||
          index === 0 ||
          index === transcripts.length - 1 ||
          (index + 1) % 4 === 0
        ) {
          reportProgress(onProgress, {
            phase: "search",
            message: `Rebuilding search index (${index + 1}/${transcripts.length})…`,
            current: index + 1,
            total: transcripts.length,
          });
        }
      }
      searchDb.exec("COMMIT");
    } catch (error) {
      try {
        searchDb.exec("ROLLBACK");
      } catch {
        // ignore rollback failure
      }
      searchDb.close();
      const restoredWithoutSearch = sidebarRestored.filter((id) => !searchIndexed.includes(id));
      for (const id of restoredWithoutSearch) {
        if (!skipped.includes(id)) skipped.push(id);
      }
      return {
        success: false,
        error:
          (error instanceof Error ? error.message : "Search reindex failed.") +
          " Sidebar entries were saved; search index may be incomplete until you reindex again.",
        searchIndexed,
        sidebarRestored,
        skipped,
        backups,
      };
    }
    searchDb.close();
  }

  for (const id of sidebarRestored) {
    if (!searchIndexed.includes(id) && !skipped.includes(id)) skipped.push(id);
  }

  reportProgress(onProgress, {
    phase: "done",
    message: `Finished — indexed ${searchIndexed.length}, restored ${sidebarRestored.length}.`,
    current: searchIndexed.length + sidebarRestored.length,
    total: transcripts.length,
  });

  return {
    success: true,
    searchIndexed,
    sidebarRestored,
    skipped,
    backups,
  };
}
