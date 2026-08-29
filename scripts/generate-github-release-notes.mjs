#!/usr/bin/env node
/**
 * Build user-facing GitHub Release notes from CHANGELOG.md (preferred) or filtered git history.
 *
 *   node scripts/generate-github-release-notes.mjs --version 1.0.34 --output release-notes.md
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProductContext } from "./lib-product-context.mjs";
import {
  extractReleaseNotes,
} from "../browser-extension/scripts/lib-changelog.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {{ version?: string; from?: string; output?: string }} */
  const out = {};
  for (const arg of argv) {
    if (arg.startsWith("--version=")) out.version = arg.slice("--version=".length);
    else if (arg.startsWith("--from=")) out.from = arg.slice("--from=".length);
    else if (arg.startsWith("--output=")) out.output = arg.slice("--output=".length);
    else if (arg === "--help" || arg === "-h") out.help = true;
  }
  return out;
}

/**
 * @param {string} subject
 */
function isInternalCommit(subject) {
  const s = subject.trim();
  if (/^chore(\(|:)/i.test(s)) return true;
  if (/^fix\(ci\)/i.test(s)) return true;
  if (/^fix\(admin\)/i.test(s)) return true;
  if (/^test(\(|:)/i.test(s)) return true;
  if (/^build(\(|:)/i.test(s)) return true;
  if (/^style(\(|:)/i.test(s)) return true;
  if (/^fix\(release\)/i.test(s) && /land v|prepare-tag|sync/i.test(s)) return true;
  return false;
}

/**
 * @param {string} subject
 */
function humanizeCommit(subject) {
  return subject
    .replace(/^(feat|fix|docs|perf|refactor|ui)(\([^)]+\))?!?:\s*/i, "")
    .replace(/^(.)/, (c) => c.toUpperCase())
    .trim();
}

/**
 * @param {string} version
 * @param {string} [fromTag]
 */
function commitsForRelease(version, fromTag) {
  const toTag = version.startsWith("v") ? version : `v${version}`;
  const from =
    fromTag ??
    (() => {
      const tags = execFileSync("git", ["tag", "--sort=-v:refname"], {
        cwd: repoRoot,
        encoding: "utf8",
      })
        .split("\n")
        .map((t) => t.trim())
        .filter((t) => t.startsWith("v"));
      const idx = tags.indexOf(toTag);
      return idx >= 0 && idx < tags.length - 1 ? tags[idx + 1] : null;
    })();

  if (!from) {
    return [];
  }

  try {
    const lines = execFileSync(
      "git",
      ["log", `${from}..${toTag}`, "--pretty=format:%s"],
      { cwd: repoRoot, encoding: "utf8" },
    )
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    return lines.filter((s) => !isInternalCommit(s)).map(humanizeCommit);
  } catch {
    return [];
  }
}

/**
 * @param {string} body
 */
function hasStructuredChangelog(body) {
  return /###\s+(Added|Changed|Fixed|Removed|Security)/i.test(body);
}

/**
 * @param {string} version
 * @param {{ from?: string }} [opts]
 */
export function generateGithubReleaseNotes(version, opts = {}) {
  const ver = String(version).replace(/^v/, "");
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const ctx = buildProductContext(pkg, { publishedReleaseVersion: ver });
  const changelog = readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8");
  const section = extractReleaseNotes(changelog, ver);
  const placeholder = section.startsWith(`Version ${ver}`);

  const toTag = `v${ver}`;
  const fromTag =
    opts.from ??
    (() => {
      const tags = execFileSync("git", ["tag", "--sort=-v:refname"], {
        cwd: repoRoot,
        encoding: "utf8",
      })
        .split("\n")
        .map((t) => t.trim())
        .filter((t) => t.startsWith("v"));
      const idx = tags.indexOf(toTag);
      return idx >= 0 && idx < tags.length - 1 ? tags[idx + 1] : "v0.0.0";
    })();

  const compareUrl = `https://github.com/${ctx.repo}/compare/${fromTag}...${toTag}`;

  const lines = [
    `Cursor Curse Monitor tracks live Cursor usage, quota, and budget from your IDE and browser.`,
    ``,
    `## Install`,
    ``,
    `| Platform | Get it |`,
    `| --- | --- |`,
    `| **VS Code / Cursor / Windsurf** | [Open VSX](${ctx.ovsxUrl}) · [VS Code Marketplace](${ctx.vscodeUrl}) · **VSIX** below |`,
    `| **Firefox** | [Firefox Add-ons](${ctx.firefoxUrl}) · **Firefox zip** below (temporary install) |`,
    `| **Chrome / Chromium** | **Chrome zip** below → \`chrome://extensions\` → Load unpacked |`,
    `| **Product site** | [cursor.lorapok.tech](${ctx.homepage}) |`,
    ``,
  ];

  if (!placeholder && hasStructuredChangelog(section)) {
    lines.push(`## What's new in v${ver}`, ``, section, ``);
  } else {
    const bullets = commitsForRelease(ver, opts.from);
    lines.push(`## Highlights`, ``);
    if (bullets.length) {
      for (const item of bullets) {
        lines.push(`- ${item}`);
      }
    } else {
      lines.push(`- Maintenance and quality improvements for v${ver}.`);
    }
    lines.push(``);
  }

  lines.push(
    `## Downloads in this release`,
    ``,
    `- **IDE extension** — \`cursor-curse-monitor-by-lorapok-${ver}.vsix\``,
    `- **Chrome** — \`cursor-curse-monitor-chrome-${ver}.zip\``,
    `- **Firefox** — signed \`.xpi\` when AMO publish succeeds, otherwise \`cursor-curse-monitor-firefox-${ver}.zip\` for \`about:debugging\``,
    ``,
    `## Support`,
    ``,
    `- [Report an issue](${ctx.feedbackUrl})`,
    `- [Community discussions](${ctx.collaborateUrl})`,
    `- Email: [${ctx.supportEmail}](mailto:${ctx.supportEmail})`,
    ``,
    `---`,
    ``,
    `[Full commit history](${compareUrl}) · Lorapok Labs`,
  );

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.version) {
    console.error(
      "Usage: node scripts/generate-github-release-notes.mjs --version=1.0.34 [--from=v1.0.33] [--output=release-notes.md]",
    );
    process.exit(args.help ? 0 : 1);
  }

  const notes = generateGithubReleaseNotes(args.version, { from: args.from });
  if (args.output) {
    writeFileSync(args.output, `${notes}\n`, "utf8");
    console.log(`Wrote ${args.output}`);
  } else {
    process.stdout.write(`${notes}\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
