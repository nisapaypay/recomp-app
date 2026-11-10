"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";
import { Brand } from "./brand";

const primary = NAV_ITEMS.filter((item) => item.href !== "/settings");
const secondary = NAV_ITEMS.filter((item) => item.href === "/settings");

/**
 * Desktop navigation.
 * - ≥1024px: full sidebar with labels.
 * - 768–1023px: compact icon rail (labels shown as tooltips / a11y names).
 * Hidden below 768px, where the mobile header + tab bar take over.
 */
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface/80 backdrop-blur",
        "md:flex md:w-rail lg:w-sidebar",
      )}
    >
      <div className="flex h-18 items-center justify-center px-5 lg:justify-start">
        <Brand className="lg:hidden" showWordmark={false} />
        <Brand className="hidden lg:flex" />
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col justify-between px-3 pb-5 lg:px-4">
        <ul className="space-y-1">
          {primary.map((item) => (
            <SidebarLink key={item.href} item={item} active={isNavItemActive(pathname, item.href)} />
          ))}
        </ul>
        <ul className="space-y-1 border-t border-line pt-4">
          {secondary.map((item) => (
            <SidebarLink key={item.href} item={item} active={isNavItemActive(pathname, item.href)} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={item.label}
        className={cn(
          "group flex h-11 items-center gap-3 rounded-control px-3 text-[0.9375rem] font-medium transition-colors",
          "justify-center lg:justify-start",
          active
            ? "bg-accent-50 text-accent-700"
            : "text-ink-soft hover:bg-surface-muted hover:text-ink",
        )}
      >
        <Icon
          aria-hidden
          className={cn("size-5 shrink-0", active ? "text-accent-600" : "text-ink-muted group-hover:text-ink")}
          strokeWidth={active ? 2.25 : 2}
        />
        <span className="sr-only lg:not-sr-only">{item.label}</span>
      </Link>
    </li>
  );
}
