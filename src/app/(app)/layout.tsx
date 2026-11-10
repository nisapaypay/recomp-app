import { AppShell } from "@/components/layout/app-shell";

/**
 * Layout for all navigable app sections.
 * Route protection (Supabase session check) is added in Phase 2.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
