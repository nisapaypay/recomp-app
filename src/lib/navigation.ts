import {
  ChartLine,
  Dumbbell,
  FileText,
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
  // On phones the report is reached from Dashboard / Progress / History (tab bar is full).
  { href: "/progress/report", label: "12-Week Report", shortLabel: "Report", icon: FileText, inMobileTabBar: false },
  { href: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings, inMobileTabBar: false },
] as const;

const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Active when the path is inside `href` and no more specific nav item matches (e.g. Progress vs Report). */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (!matches(pathname, href)) return false;
  return !NAV_ITEMS.some((item) => item.href !== href && item.href.startsWith(`${href}/`) && matches(pathname, item.href));
}
