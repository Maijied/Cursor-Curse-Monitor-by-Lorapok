import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { auth } from "../../lib/firebase";
import { APP_ROUTES } from "../../routes";

export default function Sidebar() {
  const user = auth.currentUser;

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex flex-col justify-between">
      <div>
        <div className="h-20 flex items-center px-6 border-b border-[var(--color-border)] gap-3">
          <img src="/assets/welcome-animation.svg" alt="" className="w-9 h-9" />
          <div>
            <h1 className="font-bold text-base bg-gradient-to-r from-[var(--color-accent-2)] to-[var(--color-accent)] bg-clip-text text-transparent">
              Cursor Monitor
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Mission Control</p>
          </div>
        </div>

        <nav className="p-4 space-y-1" aria-label="Main navigation">
          {APP_ROUTES.map(({ path, label, icon: Icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                  isActive
                    ? "bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)] border-[color-mix(in_srgb,var(--color-accent)_25%,transparent)] font-medium shadow-[inset_3px_0_0_var(--color-neon)]"
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

      <div className="p-4 border-t border-[var(--color-border)]">
        {user && (
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] flex items-center justify-center text-[var(--color-accent)] font-bold border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]">
              {user.email?.[0].toUpperCase()}
            </div>
            <div className="overflow-hidden min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)] truncate">{user.email}</p>
              <p className="text-xs text-[var(--color-muted)]">Administrator</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => auth.signOut()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5 rounded-xl transition-colors border border-[var(--color-border)]"
        >
          <LogOut size={16} aria-hidden="true" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
