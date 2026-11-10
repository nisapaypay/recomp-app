"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavItemActive } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";
import { Brand } from "./brand";

/** Compact top bar for phones: brand + Settings shortcut. */
export function MobileHeader() {
  const pathname = usePathname();
  const settingsActive = isNavItemActive(pathname, "/settings");

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/85 pt-safe backdrop-blur-lg md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Brand />
        <Link
          href="/settings"
          aria-label="Settings"
          aria-current={settingsActive ? "page" : undefined}
          className={cn(
            "grid size-11 place-items-center rounded-full transition-colors",
            settingsActive ? "bg-accent-100 text-accent-700" : "text-ink-soft active:bg-surface-muted",
          )}
        >
          <Settings aria-hidden className="size-[1.375rem]" />
        </Link>
      </div>
    </header>
  );
}
