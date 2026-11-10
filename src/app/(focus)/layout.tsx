import { FocusShell } from "@/components/layout/focus-shell";

/** Distraction-free frame (no navigation) for the active workout. */
export default function FocusLayout({ children }: LayoutProps<"/">) {
  return <FocusShell>{children}</FocusShell>;
}
