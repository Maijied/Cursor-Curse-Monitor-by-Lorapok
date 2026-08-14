import {
  Activity,
  LayoutDashboard,
  MessageSquare,
  Package,
  Rocket,
  Search,
  Settings,
  Store,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AppRoute = {
  path: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

export const APP_ROUTES: AppRoute[] = [
  { path: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { path: "/dashboard/marketplace", label: "Marketplace", icon: Store },
  { path: "/dashboard/releases", label: "Releases", icon: Package },
  { path: "/dashboard/activity", label: "Activity", icon: Activity },
  { path: "/dashboard/discussions", label: "Community", icon: MessageSquare },
  { path: "/dashboard/deployments", label: "Deployments", icon: Rocket },
  { path: "/dashboard/seo", label: "SEO", icon: Search },
  { path: "/dashboard/settings", label: "Settings", icon: Settings },
  { path: "/dashboard/team", label: "Team Access", icon: Users },
];
