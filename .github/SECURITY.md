# Security Policy

## Reporting Security Issues

If you believe you have found a security vulnerability affecting the deployment, configuration, infrastructure, integrations, or operation of **Cursor Curse Monitor by Lorapok** — including the VS Code / Cursor extension, marketing site, Mission Control admin panel, or Cloudflare Pages Functions — please report it through coordinated disclosure.

**Do not report security vulnerabilities through public GitHub issues, discussions, pull requests, or other public channels.**

For security issues related to this repository, report the issue by email to:

<cursor-contact@lorapok.tech>

Use subject line **Security** so the report is routed correctly. You may also use [GitHub Security Advisories](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/security/advisories/new) (**Report a vulnerability** on the New Issue chooser).

Lorapok Labs aims to acknowledge reports within **3 business days** and will keep you updated on remediation.

## What To Include

Please include as much relevant information as reasonably possible, such as:

- A description of the issue;
- The affected service area, component, configuration, URL, or workflow (extension, `website/`, `website/admin/`, admin API, analytics, etc.);
- Steps to reproduce the issue, if applicable;
- The observed or potential impact;
- Relevant logs, screenshots, request/response details, or other supporting evidence;
- Any proof-of-concept material, only where necessary and safe to provide.

Please do not include credentials, secrets, personal data, confidential information, or production data unless it is strictly necessary to understand and investigate the issue.

## Other Security Reports

| Concern | Where to report |
|---------|-----------------|
| Non-security bugs in the extension | [Extension bug report](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/new?template=extension-bug.yml) |
| Marketing site or admin panel bugs (non-security) | [Website issue](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/new?template=website-issue.yml) |
| Vulnerabilities in Cursor IDE or VS Code | Report to [Cursor](https://cursor.com) or [Microsoft VS Code](https://github.com/microsoft/vscode/security) |
| Open VSX registry or namespace policy | [Open VSX Security Policy](https://researcher-recognition.open-vsx.org/open-vsx-security-policy/) |
| VS Code Marketplace listing policy | [Microsoft Marketplace support](https://aka.ms/vsmarketplace-help) |

If you are unsure how to classify a report, report it privately rather than publicly.

## Supported Versions

Security fixes are provided for the latest release on [GitHub Releases](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases), Open VSX, and the VS Code Marketplace. Older releases may receive fixes at Lorapok Labs' discretion.

## Built-in credential scanner

Cursor Curse Monitor includes a **local-only** secret scanner across the IDE extension, browser extension Options paste fields, and repository tooling:

| Surface | Behavior |
|---------|----------|
| **IDE extension** | Scans open files on save (configurable), debounced edits, workspace scan command, and on-demand clipboard scan. Findings open in a Manage Processes–style Security Alert panel with redacted previews only. |
| **Browser extension** | Scans token paste in Options; warns if additional secrets appear in the same paste. |
| **Pre-commit** | Husky hook runs `secretlint` on staged files. |
| **CI** | `npm run security:scan` (secretlint) on every PR and push. |

**What is not scanned:** live Cursor Composer / agent chat (no public API; aligns with our privacy stance). Secrets that never touch disk cannot be detected — use scan-on-save and pre-commit for files you share or commit.

**Reporting scanner false positives:** open a private security report (see above) with the file pattern and a redacted example. Do not paste full secrets in public issues.

## Safe Harbor

Lorapok Labs appreciates responsible disclosure. We will not pursue legal action against researchers who follow this policy and act in good faith.
