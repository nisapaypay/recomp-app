import {
  ChartLine,
  Dumbbell,
  Footprints,
  History,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: `/${string}`;
  label: string;
  /** Shorter label for the mobile tab bar. */
  shortLabel: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom tab bar. Settings lives in the mobile header. */
  inMobileTabBar: boolean;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, inMobileTabBar: true },
  { href: "/workout", label: "Workout", shortLabel: "Workout", icon: Dumbbell, inMobileTabBar: true },
  { href: "/walking", label: "Walking", shortLabel: "Walking", icon: Footprints, inMobileTabBar: true },
  { href: "/progress", label: "Progress", shortLabel: "Progress", icon: ChartLine, inMobileTabBar: true },
  { href: "/history", label: "History", shortLabel: "History", icon: History, inMobileTabBar: true },
  { href: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings, inMobileTabBar: false },
] as const;

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
