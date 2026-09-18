/**
 * WEB-09 — hydrate releases.html / community.html from site-data.json.
 */
(function () {
  function fmt(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return Number(n).toLocaleString();
  }

  function el(tag, attrs, html) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "className") node.className = v;
        else node.setAttribute(k, v === true ? "" : String(v));
      }
    }
    if (html != null) node.innerHTML = html;
    return node;
  }

  function renderReleases(data, mount) {
    const version = data.version ?? data.packageVersion ?? "—";
    const gh = data.github ?? {};
    const ovsx = data.ovsx ?? {};
    const vscode = data.vscode ?? {};
    const fx = data.browserExtension?.firefox ?? {};
    const chrome = data.browserExtension?.chrome ?? {};
    const highlights = data.releaseHighlights?.message;

    mount.replaceChildren();
    mount.appendChild(el("h2", null, `Current release · v${version}`));
    const dl = el("dl", { className: "public-kv" });
    const rows = [
      ["GitHub tag", gh.releaseTag ?? `v${version}`],
      ["Published", gh.publishedAt ? new Date(gh.publishedAt).toLocaleDateString() : "—"],
      ["Open VSX", ovsx.version ?? "—"],
      ["VS Code Marketplace", vscode.version ?? "—"],
      ["Firefox AMO", fx.version ?? (fx.published ? "published" : "—")],
    ];
    for (const [k, v] of rows) {
      dl.appendChild(el("dt", null, k));
      dl.appendChild(el("dd", null, String(v)));
    }
    mount.appendChild(dl);

    const links = el("ul", { className: "public-download-list" });
    const items = [
      ["GitHub release", gh.releaseUrl || gh.latestReleaseUrl],
      ["VSIX download", gh.vsixUrl],
      ["Open VSX", data.install?.ovsxUrl || ovsx.url],
      ["VS Code Marketplace", data.install?.vscodeUrl || vscode.url],
      ["Firefox Add-ons", fx.url],
      ["Chrome zip", chrome.zipUrl || gh.chromeZipUrl],
    ];
    for (const [label, href] of items) {
      if (!href) continue;
      const li = el("li");
      li.appendChild(el("a", { href, target: "_blank", rel: "noopener" }, label));
      links.appendChild(li);
    }
    mount.appendChild(el("h3", null, "Downloads"));
    mount.appendChild(links);

    if (highlights) {
      mount.appendChild(el("h3", null, "Highlights"));
      mount.appendChild(el("pre", { className: "public-changelog" }, escapeText(highlights)));
    }
  }

  function renderCommunity(data, mount) {
    const gc = data.githubCommunity ?? {};
    const notice = data.notice;
    mount.replaceChildren();

    if (notice?.message) {
      mount.appendChild(el("h2", null, "Latest notice"));
      mount.appendChild(el("p", null, escapeText(notice.message)));
    }

    mount.appendChild(el("h2", null, "GitHub pulse"));
    const dl = el("dl", { className: "public-kv" });
    const traffic = gc.traffic ?? {};
    const rows = [
      ["Open issues (tracked)", fmt(gc.openIssues)],
      ["Stars", fmt(gc.stars)],
      ["Forks", fmt(gc.forks)],
      ["Clones (14d)", fmt(traffic.clones?.total)],
      ["Views (14d)", fmt(traffic.views?.total)],
      ["CI avg job", gc.ci?.avgJobRunSeconds != null ? `${gc.ci.avgJobRunSeconds}s` : "—"],
    ];
    for (const [k, v] of rows) {
      dl.appendChild(el("dt", null, k));
      dl.appendChild(el("dd", null, String(v)));
    }
    mount.appendChild(dl);

    const links = el("ul");
    const board = gc.project?.url || "https://github.com/users/Maijied/projects/4";
    const repo = gc.repositoryUrl || data.repository || "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok";
    for (const [label, href] of [
      ["Project #4 board", board],
      ["Repository", repo],
      ["Discussions", data.productContext?.collaborateUrl || `${repo}/discussions`],
      ["Issues", `${repo}/issues`],
    ]) {
      const li = el("li");
      li.appendChild(el("a", { href, target: "_blank", rel: "noopener" }, label));
      links.appendChild(li);
    }
    mount.appendChild(el("h3", null, "Links"));
    mount.appendChild(links);
  }

  function escapeText(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function apply(data) {
    const releases = document.getElementById("public-releases");
    const community = document.getElementById("public-community");
    if (releases) renderReleases(data || {}, releases);
    if (community) renderCommunity(data || {}, community);
  }

  if (window.__CCM_SITE_DATA__) apply(window.__CCM_SITE_DATA__);
  document.addEventListener("ccm:site-data", (e) => apply(e.detail));
})();
