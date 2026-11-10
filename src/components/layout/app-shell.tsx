import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { MobileHeader } from "./mobile-header";
import { SidebarNav } from "./sidebar-nav";

/**
 * Main application frame.
 * - Phone (<768px): sticky header, content, bottom tab bar.
 * - Tablet / small window (768–1023px): icon rail + content.
 * - Desktop (≥1024px): full sidebar + content.
 *
 * Kept free of request data so it can be part of the static shell.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow-raised"
      >
        Skip to content
      </a>
      <SidebarNav />
      <MobileHeader />
      <div className="md:pl-rail lg:pl-sidebar">
        <main
          id="main"
          className="pb-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+1.5rem)] md:pb-12"
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
