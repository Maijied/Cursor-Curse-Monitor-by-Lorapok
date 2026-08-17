import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ExternalLink, LayoutDashboard, MessageSquare, MessagesSquare, PenLine, Settings2 } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import DataTable, { type DataTableColumn } from "../ui/DataTable";
import { useDiscussions } from "../../hooks/useDiscussions";
import { useSiteData } from "../../hooks/useSiteData";
import {
  createDiscussionApi,
  fetchCommunityConfigApi,
  putCommunityConfigApi,
  type CommunityConfig,
  type DiscussionCategory,
  type DiscussionItem,
} from "../../lib/api";
import { auth } from "../../lib/firebase";
import { isMasterAdmin } from "../../lib/admin-config";

type Tab = "overview" | "compose" | "manage";

function formatBadge(format?: string): { label: string; variant: "synced" | "warn" | "neutral" } {
  if (format === "qa") return { label: "Q&A", variant: "synced" };
  if (format === "announcement") return { label: "Announcement", variant: "warn" };
  return { label: "Discussion", variant: "neutral" };
}

function categoryFormat(cat: DiscussionCategory | undefined, name: string) {
  if (cat?.format) return formatBadge(cat.format);
  const lower = (cat?.slug || name || "").toLowerCase();
  if (cat?.isAnswerable || lower.includes("q&a") || lower.includes("qa")) return formatBadge("qa");
  if (lower.includes("announce")) return formatBadge("announcement");
  return formatBadge("discussion");
}

const ADMIN_ORIGIN =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? window.location.origin
    : "https://cursor-dev.lorapok.tech";

export default function Discussions() {
  const { data: siteData } = useSiteData();
  const fallback = siteData?.community
    ? {
        enabled: siteData.community.discussionsEnabled,
        discussions: siteData.community.discussions,
        categories: [] as DiscussionCategory[],
        topics: siteData.community.topics,
        settingsUrl: siteData.community.settingsUrl,
        repoIssuesUrl: siteData.community.repoIssuesUrl,
        capabilities: {
          canCreatePosts: false,
          canManageCategories: false,
          canCreatePolls: false,
          tokenConfigured: false,
        },
      }
    : undefined;

  const { data, error, loading, refresh } = useDiscussions(fallback);
  const [tab, setTab] = useState<Tab>("overview");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [creating, setCreating] = useState(false);
  const [composeMsg, setComposeMsg] = useState<string | null>(null);
  const [composeErr, setComposeErr] = useState<string | null>(null);

  const [config, setConfig] = useState<CommunityConfig | null>(null);
  const [featuredUrls, setFeaturedUrls] = useState("");
  const [defaultSlug, setDefaultSlug] = useState("announcements");
  const [collaborateUrl, setCollaborateUrl] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<string | null>(null);
  const [configErr, setConfigErr] = useState<string | null>(null);

  const isMaster = isMasterAdmin(auth.currentUser?.email);

  useEffect(() => {
    fetchCommunityConfigApi()
      .then((c) => {
        setConfig(c);
        setFeaturedUrls((c.featuredDiscussionUrls ?? []).join("\n"));
        setDefaultSlug(c.defaultCategorySlug || "announcements");
        setCollaborateUrl(c.collaborateUrl || "");
      })
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (data?.categories?.length && !categoryId) {
      const preferred =
        data.categories.find((c) => c.slug === (config?.defaultCategorySlug || "announcements")) ??
        data.categories[0];
      if (preferred) setCategoryId(preferred.id);
    }
  }, [data?.categories, categoryId, config?.defaultCategorySlug]);

  const categoryByName = useMemo(() => {
    const map = new Map<string, DiscussionCategory>();
    for (const c of data?.categories ?? []) {
      map.set(c.name.toLowerCase(), c);
    }
    return map;
  }, [data?.categories]);

  const filteredDiscussions = useMemo(() => {
    const list = data?.discussions ?? [];
    if (!categoryFilter) return list;
    return list.filter((d) => d.category === categoryFilter);
  }, [data?.discussions, categoryFilter]);

  const discussionColumns: DataTableColumn<DiscussionItem>[] = [
    {
      key: "title",
      header: "Title",
      searchValue: (row) => `${row.title} ${row.category}`,
      render: (row) => (
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--color-text)] hover:text-[var(--color-accent)]"
        >
          {row.title}
        </a>
      ),
    },
    {
      key: "category",
      header: "Category",
      searchValue: (row) => row.category,
      render: (row) => {
        const cat = categoryByName.get(row.category.toLowerCase());
        const badge = categoryFormat(cat, row.category);
        return (
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span>{row.category}</span>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </span>
        );
      },
    },
    {
      key: "comments",
      header: "Comments",
      searchValue: (row) => String(row.comments),
      render: (row) => (
        <span className="font-[family-name:var(--font-mono)]">{row.comments}</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      searchValue: (row) => row.createdAt,
      render: (row) => (
        <span className="text-[var(--color-muted)]">{new Date(row.createdAt).toLocaleDateString()}</span>
      ),
    },
  ];

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setComposeMsg(null);
    setComposeErr(null);
    setCreating(true);
    try {
      const result = await createDiscussionApi({
        title: title.trim(),
        body: body.trim(),
        categoryId,
        repositoryId: data?.repositoryId ?? undefined,
      });
      setComposeMsg(result.discussion?.url ? `Created: ${result.discussion.url}` : "Discussion created.");
      setTitle("");
      setBody("");
      refresh?.();
    } catch (err) {
      setComposeErr(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveConfig(e: FormEvent) {
    e.preventDefault();
    if (!isMaster) return;
    setConfigMsg(null);
    setConfigErr(null);
    setConfigSaving(true);
    try {
      const result = await putCommunityConfigApi({
        featuredDiscussionUrls: featuredUrls
          .split("\n")
          .map((u) => u.trim())
          .filter(Boolean),
        defaultCategorySlug: defaultSlug.trim(),
        collaborateUrl: collaborateUrl.trim(),
      });
      setConfig(result.config);
      setConfigMsg("Community config saved.");
    } catch (err) {
      setConfigErr(err instanceof Error ? err.message : "Save failed");
    } finally {
      setConfigSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <ShimmerSkeleton className="h-16" />
        <ShimmerSkeleton className="h-48" />
      </div>
    );
  }

  if (error && !data) {
    return <ErrorState message={error} />;
  }

  if (!data) return null;

  const canCreate = Boolean(data.capabilities?.canCreatePosts);
  const manageCategoriesUrl =
    data.manageCategoriesUrl ?? `https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/discussions/categories`;
  const discussionsUrl =
    data.discussionsUrl ?? `https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/discussions`;
  const createPollUrl = `${discussionsUrl}/new`;

  const tabs: Array<{ id: Tab; label: string; icon: typeof MessagesSquare }> = [
    { id: "overview", label: "Overview", icon: MessagesSquare },
    { id: "compose", label: "Compose", icon: PenLine },
    { id: "manage", label: "Manage", icon: Settings2 },
  ];

  const categoryChips = data.categories?.length
    ? data.categories
    : Array.from(new Set(data.discussions.map((d) => d.category))).map((name) => ({
        id: name,
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        format: categoryFormat(undefined, name).label.toLowerCase().includes("q")
          ? "qa"
          : name.toLowerCase().includes("announce")
            ? "announcement"
            : "discussion",
      }));

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Community"
        description="GitHub Discussions — overview, compose posts, and manage categories."
        action={
          data.enabled ? (
            <Badge variant="synced" pulse>
              Discussions enabled
            </Badge>
          ) : (
            <Badge variant="warn">Discussions disabled</Badge>
          )
        }
      />

      <div
        className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-3"
        role="tablist"
        aria-label="Community tabs"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all border ${
              tab === id
                ? "bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)] border-[color-mix(in_srgb,var(--color-accent)_25%,transparent)] font-medium"
                : "border-transparent text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-text)]"
            }`}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          {!data.enabled && (
            <Card className="border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)]">
              <h3 className="font-semibold text-[var(--color-text)] mb-2">Enable GitHub Discussions</h3>
              <p className="text-sm text-[var(--color-muted)] mb-4">
                Discussions are not enabled on this repo yet. Enable them to host Q&amp;A, ideas, and announcements.
              </p>
              <a
                href={data.settingsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[var(--color-accent-2)] hover:underline"
              >
                Open repository settings
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </Card>
          )}

          {categoryChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categoryChips.map((c) => {
                const badge = formatBadge(
                  "format" in c ? String((c as DiscussionCategory).format ?? "discussion") : "discussion"
                );
                return (
                  <button
                    key={c.id || c.name}
                    type="button"
                    onClick={() => setCategoryFilter((prev) => (prev === c.name ? "" : c.name))}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                      categoryFilter === c.name
                        ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)]"
                        : "border-[var(--color-border)] hover:bg-white/5"
                    }`}
                  >
                    <span>{c.name}</span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </button>
                );
              })}
              {categoryFilter && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter("")}
                  className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] px-2"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}

          <Card>
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
              <MessagesSquare size={20} className="text-[var(--color-accent)]" aria-hidden="true" />
              Recent discussions
            </h3>
            <DataTable
              columns={discussionColumns}
              rows={filteredDiscussions}
              getRowKey={(row, i) => row.url || `${row.title}-${i}`}
              emptyMessage="No discussions yet."
              filterOptions={[
                { value: "", label: "All categories" },
                ...Array.from(new Set(data.discussions.map((d) => d.category))).map((c) => ({
                  value: c,
                  label: c,
                })),
              ]}
              filterValue={categoryFilter}
              onFilterChange={setCategoryFilter}
              filterLabel="Category"
            />
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
              <MessageSquare size={20} className="text-[var(--color-neon)]" aria-hidden="true" />
              Topics from issues
            </h3>
            {data.topics.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                No labeled issues yet.{" "}
                <a
                  href={data.repoIssuesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent-2)] hover:underline"
                >
                  View issues on GitHub
                </a>
              </p>
            ) : (
              <div className="space-y-6">
                {data.topics.map((topic) => (
                  <div key={topic.topic}>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="neutral">{topic.topic}</Badge>
                      <span className="text-xs text-[var(--color-muted)]">
                        {topic.count} issue{topic.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <ul className="space-y-2 pl-1">
                      {topic.items.map((item) => (
                        <li key={item.url}>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[var(--color-text)] hover:text-[var(--color-accent)] flex items-center gap-2"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.state === "open" ? "bg-[var(--color-neon)]" : "bg-[var(--color-muted)]"
                              }`}
                            />
                            {item.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "compose" && (
        <Card>
          <h3 className="text-lg font-semibold mb-2">Compose discussion</h3>
          <p className="text-sm text-[var(--color-muted)] mb-6">
            Create a new GitHub Discussion post. Categories and polls must be managed on GitHub.
          </p>
          {!canCreate && (
            <p className="text-sm text-[var(--color-warn)] mb-4">
              Posting requires a configured GitHub token on the server. You can still draft below, but Create is disabled.
            </p>
          )}
          <form onSubmit={handleCreate} className="space-y-4 max-w-2xl">
            <div>
              <label htmlFor="disc-title" className="block text-sm text-[var(--color-muted)] mb-1">
                Title
              </label>
              <input
                id="disc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
            <div>
              <label htmlFor="disc-body" className="block text-sm text-[var(--color-muted)] mb-1">
                Body (Markdown)
              </label>
              <textarea
                id="disc-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={10}
                className="w-full px-3 py-2 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-accent)] font-[family-name:var(--font-mono)]"
              />
            </div>
            <div>
              <label htmlFor="disc-cat" className="block text-sm text-[var(--color-muted)] mb-1">
                Category
              </label>
              <select
                id="disc-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                {(data.categories ?? []).length === 0 ? (
                  <option value="">No categories loaded</option>
                ) : (
                  data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ` : ""}
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              type="submit"
              disabled={!canCreate || creating || !title.trim() || !body.trim() || !categoryId}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[var(--color-accent)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            {composeMsg && <p className="text-sm text-[var(--color-neon)] break-all">{composeMsg}</p>}
            {composeErr && <p className="text-sm text-[var(--color-danger)]">{composeErr}</p>}
          </form>
        </Card>
      )}

      {tab === "manage" && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold mb-4">Categories (read-only)</h3>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              Category creation, edits, and polls are GitHub-only. Use the deep links below.
            </p>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Slug</th>
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {(data.categories ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[var(--color-muted)]">
                        Categories unavailable (token may be missing).
                      </td>
                    </tr>
                  ) : (
                    data.categories.map((c) => {
                      const badge = formatBadge(c.format);
                      return (
                        <tr key={c.id}>
                          <td className="py-3 pr-4">
                            {c.emoji ? `${c.emoji} ` : ""}
                            {c.name}
                          </td>
                          <td className="py-3 pr-4 font-[family-name:var(--font-mono)] text-xs">{c.slug}</td>
                          <td className="py-3 pr-4">
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </td>
                          <td className="py-3 text-[var(--color-muted)] text-xs max-w-xs truncate">
                            {c.description || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-4">
              <a
                href={manageCategoriesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[var(--color-accent-2)] hover:underline"
              >
                Manage categories on GitHub
                <ExternalLink size={14} aria-hidden="true" />
              </a>
              <a
                href={createPollUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[var(--color-accent-2)] hover:underline"
              >
                Create poll on GitHub
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold mb-2">Community config</h3>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              Featured discussion URLs and default category slug for the marketing site.
              {isMaster ? " Master admin can save via PUT." : " View-only — master admin required to save."}
            </p>
            <form onSubmit={handleSaveConfig} className="space-y-4 max-w-2xl">
              <div>
                <label htmlFor="featured-urls" className="block text-sm text-[var(--color-muted)] mb-1">
                  Featured discussion URLs (one per line)
                </label>
                <textarea
                  id="featured-urls"
                  value={featuredUrls}
                  onChange={(e) => setFeaturedUrls(e.target.value)}
                  rows={4}
                  disabled={!isMaster}
                  className="w-full px-3 py-2 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-accent)] font-[family-name:var(--font-mono)] disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="default-slug" className="block text-sm text-[var(--color-muted)] mb-1">
                  Default category slug
                </label>
                <input
                  id="default-slug"
                  value={defaultSlug}
                  onChange={(e) => setDefaultSlug(e.target.value)}
                  disabled={!isMaster}
                  className="w-full px-3 py-2 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-accent)] font-[family-name:var(--font-mono)] disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="collab-url" className="block text-sm text-[var(--color-muted)] mb-1">
                  Collaborate URL
                </label>
                <input
                  id="collab-url"
                  value={collaborateUrl}
                  onChange={(e) => setCollaborateUrl(e.target.value)}
                  disabled={!isMaster}
                  className="w-full px-3 py-2 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-60"
                />
              </div>
              {isMaster && (
                <button
                  type="submit"
                  disabled={configSaving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[var(--color-accent)] text-white disabled:opacity-40"
                >
                  {configSaving ? "Saving…" : "Save config"}
                </button>
              )}
              {configMsg && <p className="text-sm text-[var(--color-neon)]">{configMsg}</p>}
              {configErr && <p className="text-sm text-[var(--color-danger)]">{configErr}</p>}
              {config?.updatedAt && (
                <p className="text-xs text-[var(--color-muted)]">
                  Last updated {new Date(config.updatedAt).toLocaleString()}
                  {config.updatedBy ? ` by ${config.updatedBy}` : ""}
                </p>
              )}
            </form>
          </Card>
        </div>
      )}

      <footer className="pt-4 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--color-muted)]">
          Posts via API · categories &amp; polls on GitHub only
        </p>
        <a
          href={ADMIN_ORIGIN}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
        >
          <LayoutDashboard size={16} aria-hidden="true" />
          Admin
        </a>
      </footer>
    </div>
  );
}
