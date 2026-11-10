"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

const tabs = NAV_ITEMS.filter((item) => item.inMobileTabBar);

/**
 * iPhone tab bar: five primary sections in the thumb zone, ≥44px targets,
 * respects the home-indicator safe area. Settings is in the mobile header.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-safe shadow-nav backdrop-blur-lg md:hidden"
    >
      <ul className="mx-auto grid h-tabbar max-w-lg grid-cols-5">
        {tabs.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                  active ? "text-accent-700" : "text-ink-muted active:text-ink",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-14 place-items-center rounded-chip transition-colors",
                    active && "bg-accent-100",
                  )}
                >
                  <Icon aria-hidden className="size-[1.375rem]" strokeWidth={active ? 2.25 : 2} />
                </span>
                {item.shortLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
