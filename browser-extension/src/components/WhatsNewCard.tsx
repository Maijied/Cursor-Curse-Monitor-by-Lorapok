import React from "react";

declare const __EXTENSION_VERSION__: string;
declare const __RELEASE_NOTES__: string;

function renderMarkdownLite(text: string): React.ReactNode[] {
  const lines = text.split("\n").filter((line) => line.trim());
  const nodes: React.ReactNode[] = [];
  let list: string[] = [];

  const formatInline = (line: string) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const flushList = () => {
    if (!list.length) return;
    nodes.push(
      <ul key={`list-${nodes.length}`} className="whats-new-list">
        {list.map((item) => (
          <li key={item}>{formatInline(item)}</li>
        ))}
      </ul>
    );
    list = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      list.push(trimmed.slice(2));
      continue;
    }
    flushList();
    if (trimmed.startsWith("### ")) {
      nodes.push(
        <h4 key={`h-${nodes.length}`} className="whats-new-subhead">
          {trimmed.slice(4)}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      nodes.push(
        <h3 key={`h-${nodes.length}`} className="whats-new-subhead">
          {trimmed.slice(3)}
        </h3>
      );
    } else {
      nodes.push(<p key={`p-${nodes.length}`}>{formatInline(trimmed)}</p>);
    }
  }
  flushList();
  return nodes;
}

interface WhatsNewCardProps {
  onDismiss: () => void;
}

export function WhatsNewCard({ onDismiss }: WhatsNewCardProps) {
  const notes = typeof __RELEASE_NOTES__ === "string" ? __RELEASE_NOTES__ : "";

  return (
    <section className="card whats-new-card" role="dialog" aria-labelledby="whats-new-title">
      <div className="whats-new-header">
        <div>
          <p className="whats-new-eyebrow">What&apos;s new</p>
          <h2 id="whats-new-title">v{__EXTENSION_VERSION__}</h2>
        </div>
        <button type="button" className="icon-btn" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
      <div className="whats-new-body">{renderMarkdownLite(notes)}</div>
      <div className="whats-new-actions">
        <a
          className="link-btn"
          href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases"
          target="_blank"
          rel="noopener noreferrer"
        >
          Full changelog →
        </a>
        <button type="button" className="btn primary" onClick={onDismiss}>
          Got it
        </button>
      </div>
    </section>
  );
}
