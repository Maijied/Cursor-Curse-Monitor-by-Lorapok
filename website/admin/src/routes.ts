import { LayoutDashboard, MessageSquare, Rocket, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AppRoute = {
  path: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

export const APP_ROUTES: AppRoute[] = [
  { path: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { path: "/dashboard/discussions", label: "Community", icon: MessageSquare },
  { path: "/dashboard/deployments", label: "Deployments", icon: Rocket },
  { path: "/dashboard/team", label: "Team Access", icon: Users },
];
