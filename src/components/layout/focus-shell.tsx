import type { ReactNode } from "react";

/**
 * Distraction-free frame for the active workout session (Phase 4).
 * No navigation chrome: only a top bar slot (exit / progress) and the stage.
 */
export function FocusShell({
  topBar,
  children,
}: {
  topBar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas pt-safe pb-safe">
      {topBar ? (
        <div className="flex h-16 items-center justify-between gap-4 px-4 md:h-20 md:px-8">
          {topBar}
        </div>
      ) : null}
      <main id="main" className="flex flex-1 flex-col px-4 pb-6 md:px-8 md:pb-8">
        {children}
      </main>
    </div>
  );
}
