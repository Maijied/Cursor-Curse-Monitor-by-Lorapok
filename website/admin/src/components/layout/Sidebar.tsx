import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronDown, ChevronUp, LogOut, X } from "lucide-react";
import { auth } from "../../lib/firebase";
import { APP_ROUTES } from "../../routes";
import OnlineStatus from "../ui/OnlineStatus";
import ActiveUsersLive from "../ui/ActiveUsersLive";
import InstallAppButton from "../ui/InstallAppButton";
import BackToWebsiteButton from "../ui/BackToWebsiteButton";

export default function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const user = auth.currentUser;
  const [footerOpen, setFooterOpen] = useState(true);

  return (
    <aside
      className={`
        w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex flex-col justify-between
        fixed md:static inset-y-0 left-0 z-50 md:z-auto
        transform transition-transform duration-200 ease-out
        pb-[env(safe-area-inset-bottom)]
        ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
    >
      <div className="min-h-0 flex-1 flex flex-col">
        <div className="shrink-0 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-base)_55%,transparent)]">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--color-neon)_14%,transparent)] border border-[color-mix(in_srgb,var(--color-neon)_28%,transparent)] flex items-center justify-center overflow-hidden shadow-[0_0_24px_color-mix(in_srgb,var(--color-neon)_12%,transparent)]">
                <img
                  src="/assets/logo.svg"
                  alt=""
                  className="w-7 h-7 object-contain"
                  aria-hidden="true"
                />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Mission Control
              </p>
              <h1 className="font-semibold text-[15px] leading-tight text-[var(--color-text)] truncate">
                Cursor Curse Monitor
              </h1>
              <p className="text-[10px] text-[var(--color-muted)] truncate">Lorapok Labs</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-2.5 min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-white/5 text-[var(--color-muted)]"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
          <div className="hidden md:flex flex-col gap-2 px-5 pb-3">
            <OnlineStatus />
            <ActiveUsersLive compact />
          </div>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto flex-1" aria-label="Main navigation">
          {APP_ROUTES.map(({ path, label, icon: Icon, end }, index) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              onClick={onClose}
              style={{ animationDelay: `${index * 0.04}s` }}
              className={({ isActive }) =>
                `animate-fade-slide-up flex items-center gap-3 px-4 py-3 rounded-xl transition-all border relative ${
                  isActive
                    ? "bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)] border-[color-mix(in_srgb,var(--color-accent)_25%,transparent)] font-medium shadow-[inset_3px_0_0_var(--color-neon),0_0_20px_color-mix(in_srgb,var(--color-accent)_15%,transparent)]"
                    : "border-transparent text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-text)]"
                }`
              }
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="shrink-0 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-base)_40%,transparent)]">
        <button
          type="button"
          onClick={() => setFooterOpen((open) => !open)}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/[0.03] transition-colors"
          aria-expanded={footerOpen}
        >
          <span>Account &amp; links</span>
          {footerOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronUp size={16} aria-hidden="true" />}
        </button>
        {footerOpen ? (
          <div className="px-4 pb-4 space-y-3">
            <BackToWebsiteButton />

            {user ? (
              <div className="flex items-center gap-3 px-1">
                <div className="w-9 h-9 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] flex items-center justify-center text-[var(--color-accent)] font-bold border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] text-sm">
                  {user.email?.[0].toUpperCase()}
                </div>
                <div className="overflow-hidden min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">{user.email}</p>
                  <p className="text-[11px] text-[var(--color-muted)]">Administrator</p>
                </div>
              </div>
            ) : null}
            <InstallAppButton className="w-full" />
            <button
              type="button"
              onClick={() => auth.signOut()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5 rounded-xl transition-colors border border-[var(--color-border)]"
            >
              <LogOut size={16} aria-hidden="true" />
              Sign Out
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
