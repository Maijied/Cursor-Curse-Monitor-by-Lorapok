import {
  Activity,
  BookOpen,
  Contact,
  FileBarChart,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Network,
  Package,
  Rocket,
  Search,
  Settings,
  Store,
  Terminal,
  Users,
  ScrollText,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NavPermission } from "./lib/nav-permissions";

export type AppRoute = {
  path: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Minimum permission to show this nav item (any one if array). Omit = all admins. */
  permission?: NavPermission;
};

export const APP_ROUTES: AppRoute[] = [
  { path: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { path: "/dashboard/marketplace", label: "Marketplace", icon: Store, permission: "settings.read" },
  { path: "/dashboard/releases", label: "Releases", icon: Package, permission: "settings.read" },
  { path: "/dashboard/activity", label: "Activity", icon: Activity, permission: "logs.read" },
  { path: "/dashboard/logs", label: "Logs", icon: ScrollText, permission: "logs.read" },
  { path: "/dashboard/mailbox", label: "Mailbox", icon: Mail, permission: "mail.read" },
  { path: "/dashboard/subscribers", label: "Subscribers", icon: Contact, permission: "subscribers.write" },
  { path: "/dashboard/api-explorer", label: "API Explorer", icon: Terminal, permission: "integrations.read" },
  { path: "/dashboard/reports", label: "Reports", icon: FileBarChart, permission: "settings.read" },
  { path: "/dashboard/discussions", label: "Community", icon: MessageSquare, permission: "integrations.read" },
  { path: "/dashboard/architecture", label: "Architecture", icon: Network, permission: "settings.read" },
  { path: "/dashboard/deployments", label: "Deployments", icon: Rocket, permission: "deploy.run" },
  { path: "/dashboard/notices", label: "Notices", icon: Megaphone, permission: "notices.write" },
  { path: "/dashboard/docs", label: "Docs", icon: BookOpen, permission: "settings.read" },
  { path: "/dashboard/seo", label: "SEO", icon: Search, permission: "settings.read" },
  { path: "/dashboard/settings", label: "Settings", icon: Settings, permission: "settings.read" },
  { path: "/dashboard/team", label: "Team Access", icon: Users, permission: "team.manage" },
];
