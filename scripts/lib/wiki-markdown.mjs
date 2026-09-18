/**
 * Minimal Markdown → HTML for docs/wiki pages (WEB-09).
 * No runtime dependency — enough for headers, lists, tables, code, links.
 */
export function wikiMarkdownToHtml(markdown, { linkMapper } = {}) {
  const mapLink = typeof linkMapper === "function" ? linkMapper : (href) => href;
  const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let inCode = false;
  let codeLang = "";
  let codeBuf = [];
  let listType = null;
  let para = [];

  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(" ").trim();
    para = [];
    if (text) out.push(`<p>${inline(text, mapLink)}</p>`);
  };

  const flushList = () => {
    if (!listType) return;
    out.push(listType === "ol" ? "</ol>" : "</ul>");
    listType = null;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      flushPara();
      flushList();
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeBuf = [];
      } else {
        const langClass = codeLang ? ` class="language-${escapeAttr(codeLang)}"` : "";
        out.push(`<pre><code${langClass}>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
        inCode = false;
        codeLang = "";
        codeBuf = [];
      }
      i += 1;
      continue;
    }

    if (inCode) {
      codeBuf.push(line);
      i += 1;
      continue;
    }

    if (/^\s*$/.test(line)) {
      flushPara();
      flushList();
      i += 1;
      continue;
    }

    if (isTableStart(lines, i)) {
      flushPara();
      flushList();
      const { html, next } = renderTable(lines, i, mapLink);
      out.push(html);
      i = next;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushPara();
      flushList();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text);
      out.push(`<h${level} id="${escapeAttr(id)}">${inline(text, mapLink)}</h${level}>`);
      i += 1;
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    if (ul) {
      flushPara();
      if (listType !== "ul") {
        flushList();
        listType = "ul";
        out.push("<ul>");
      }
      out.push(`<li>${inline(ul[1], mapLink)}</li>`);
      i += 1;
      continue;
    }

    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ol) {
      flushPara();
      if (listType !== "ol") {
        flushList();
        listType = "ol";
        out.push("<ol>");
      }
      out.push(`<li>${inline(ol[1], mapLink)}</li>`);
      i += 1;
      continue;
    }

    flushList();
    para.push(line.trim());
    i += 1;
  }

  flushPara();
  flushList();
  if (inCode) {
    out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
  }
  return out.join("\n");
}

function isTableStart(lines, i) {
  const row = lines[i];
  const sep = lines[i + 1];
  return (
    Boolean(row) &&
    row.includes("|") &&
    Boolean(sep) &&
    /^\s*\|?[\s-:|]+\|?\s*$/.test(sep)
  );
}

function renderTable(lines, start, mapLink) {
  const rows = [];
  let i = start;
  while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) {
    if (i === start + 1 && /^\s*\|?[\s-:|]+\|?\s*$/.test(lines[i])) {
      i += 1;
      continue;
    }
    rows.push(
      lines[i]
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split("|")
        .map((c) => c.trim())
    );
    i += 1;
  }
  if (!rows.length) return { html: "", next: start + 1 };
  const [head, ...body] = rows;
  const thead = `<thead><tr>${head.map((c) => `<th>${inline(c, mapLink)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${body
    .map((r) => `<tr>${r.map((c) => `<td>${inline(c, mapLink)}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  return { html: `<table>${thead}${tbody}</table>`, next: i };
}

function inline(text, mapLink) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const mapped = mapLink(href.trim());
    const external = /^https?:\/\//i.test(mapped);
    const rel = external ? ' target="_blank" rel="noopener"' : "";
    return `<a href="${escapeAttr(mapped)}"${rel}>${label}</a>`;
  });
  return s;
}

export function mapWikiHref(href, { fromFile } = {}) {
  const raw = String(href || "").trim();
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || /^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (raw.startsWith("../") || raw.startsWith("./") || raw.startsWith("/")) {
    return raw;
  }
  // GitHub wiki style: Installation or Installation.md
  const base = raw.replace(/\.md$/i, "").split("#");
  const page = base[0];
  const hash = base[1] ? `#${base[1]}` : "";
  if (!page || page === "Home") return `index.html${hash}`;
  // Relative within wiki/
  if (fromFile && fromFile.includes("/docs/")) {
    return `../wiki/${page}.html${hash}`;
  }
  return `${page}.html${hash}`;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
