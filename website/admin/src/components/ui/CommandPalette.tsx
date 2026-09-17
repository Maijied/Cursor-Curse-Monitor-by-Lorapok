import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Search } from "lucide-react";
import { useAuthSession } from "../../lib/use-auth-session";
import {
  buildCommandPaletteItems,
  rankCommandPaletteItems,
  type CommandPaletteGroup,
  type RankedCommandItem,
} from "../../lib/command-palette-catalog";
import { persistSettingsTab } from "./settings-tab-storage";

const GROUP_ORDER: CommandPaletteGroup[] = ["Navigation", "Settings", "API", "Docs", "Tasks"];

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * ACL-aware Mission Control command palette (⌘K / Ctrl+K).
 */
export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { hasPermission } = useAuthSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo(
    () => buildCommandPaletteItems(hasPermission),
    [hasPermission]
  );
  const ranked = useMemo(() => rankCommandPaletteItems(items, query), [items, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const runItem = useCallback(
    (item: RankedCommandItem) => {
      if (item.settingsTab) persistSettingsTab(item.settingsTab);
      if (item.path) {
        navigate(item.path);
        onClose();
        return;
      }
      if (item.href) {
        window.open(item.href, "_blank", "noopener,noreferrer");
        onClose();
      }
    },
    [navigate, onClose]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(ranked.length - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && ranked[activeIndex]) {
        e.preventDefault();
        runItem(ranked[activeIndex]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, ranked, activeIndex, runItem]);

  if (!open) return null;

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    rows: ranked
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.group === group),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center pt-[min(12vh,6rem)] px-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        aria-label="Close command palette"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] animate-fade-slide-up overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <Search size={18} className="text-[var(--color-muted)] shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, settings, APIs, docs, tasks…"
            className="flex-1 min-w-0 bg-transparent text-[var(--color-text)] outline-none text-sm placeholder:text-[var(--color-muted)]"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            autoComplete="off"
          />
          <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-muted)] font-[family-name:var(--font-mono)]">
            esc
          </kbd>
        </div>

        <div
          id="command-palette-results"
          role="listbox"
          aria-label="Results"
          className="max-h-[min(60vh,28rem)] overflow-y-auto py-2"
        >
          {ranked.length === 0 ? (
            <p className="px-4 py-8 text-sm text-center text-[var(--color-muted)]">No matches</p>
          ) : (
            grouped.map(({ group, rows }) => (
              <div key={group} className="mb-1">
                <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                  {group}
                </p>
                <ul className="space-y-0.5">
                  {rows.map(({ item, index }) => {
                    const active = index === activeIndex;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => runItem(item)}
                          className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors ${
                            active
                              ? "bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[var(--color-text)]"
                              : "text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-text)]"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-[var(--color-muted)] truncate mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                          {active && (
                            <CornerDownLeft
                              size={14}
                              className="shrink-0 mt-1 opacity-70"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-[var(--color-border)] flex flex-wrap gap-3 text-[10px] text-[var(--color-muted)] font-[family-name:var(--font-mono)]">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>⌘K / Ctrl+K toggle</span>
        </div>
      </div>
    </div>
  );
}

/** Global ⌘K / Ctrl+K listener for AppShell. */
export function useCommandPaletteHotkey(onToggle: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
          // Still allow ⌘K to open palette from inputs (VS Code style)
        }
        e.preventDefault();
        onToggle();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onToggle]);
}
