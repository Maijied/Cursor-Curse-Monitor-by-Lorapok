/** Shared license wording for marketing site (keep aligned with LICENSING.md). */

export const LICENSING_DOC_URL =
  "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/LICENSING.md";
export const GPL_LICENSE_URL =
  "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/LICENSE";
export const MPL_BROWSER_URL =
  "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/browser-extension/LICENSE.mpl-2.0.txt";

/** Short hero / index license note (HTML). */
export const LICENSE_HERO_NOTE_HTML = `The Firefox browser extension is licensed under <strong>MPL-2.0</strong>. The IDE extension is licensed under <strong>GPL-3.0-or-later</strong>. See the <a href="${LICENSING_DOC_URL}" target="_blank" rel="noopener">source repository</a> component-specific licensing notices and third-party notices for details. <a href="terms.html">Terms</a>.`;

/** Footer one-liner (HTML). prefix = "./" or "../" etc. */
export function licenseFooterLineHtml(prefix = "./") {
  return `IDE: <a href="${GPL_LICENSE_URL}" target="_blank" rel="noopener">GPL-3.0-or-later</a> · Firefox: <a href="${MPL_BROWSER_URL}" target="_blank" rel="noopener">MPL-2.0</a> · <a href="${prefix}terms.html">Terms</a>`;
}

/** Terms page — License section body (HTML fragments). */
export const LICENSE_TERMS_SECTION_HTML = `
      <p>
        <strong>Cursor Curse Monitor by Lorapok</strong> is open source from
        <a href="https://lorapok.tech" target="_blank" rel="noopener">Lorapok Labs</a>,
        founded by <strong>Mohammad Maizied Hasan Majumder</strong>.
        <strong>Component licenses differ by product surface</strong> — do not assume one license covers every download channel.
      </p>
      <p>
        The <strong>Firefox browser extension</strong> (and matching Chrome zip built from the same
        <code>browser-extension/</code> tree) is licensed under the
        <a href="${MPL_BROWSER_URL}" target="_blank" rel="noopener">Mozilla Public License 2.0 (MPL-2.0)</a>.
        Signed Firefox packages include MPL license text, notices, and a source-code offer.
      </p>
      <p>
        The <strong>IDE extension</strong> for VS Code–compatible hosts (Open VSX, VS Code Marketplace, GitHub Releases VSIX)
        is licensed under the
        <a href="${GPL_LICENSE_URL}" target="_blank" rel="noopener">GNU General Public License v3.0 or later (GPL-3.0-or-later)</a>.
        You may use, study, modify, and redistribute it under GPL terms; derivative works of that component must remain under GPL.
      </p>
      <p>
        Shared library code compiled into both products is dual-licensed by Lorapok Labs for those distributions.
        Bundled third-party dependencies retain their own licenses (see browser package
        <code>THIRD_PARTY_NOTICES</code> and repository <a href="${LICENSING_DOC_URL}" target="_blank" rel="noopener">LICENSING.md</a>).
      </p>
      <p>
        Official channels: Open VSX, VS Code Marketplace, Firefox AMO, GitHub Releases, and this website.
        Licensing inquiries:
        <a href="mailto:lorapokdev@gmail.com">lorapokdev@gmail.com</a> ·
        <a href="mailto:cursor.curse.help@lorapok.tech">cursor.curse.help@lorapok.tech</a> ·
        <a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/CODE_OF_CONDUCT.md">Code of Conduct</a>.
      </p>`;
