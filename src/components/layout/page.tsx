import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Width-constrained, responsive page gutter. */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-content px-4 pt-5 sm:px-6 md:px-8 md:pt-8 lg:px-10 lg:pt-10",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-overline uppercase text-accent-600">{eyebrow}</p>
        ) : null}
        <h1 className="text-title md:text-display">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[0.9375rem] text-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </header>
  );
}

/** Titled group of content inside a page. */
export function PageSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-8 first:mt-0", className)}>
      <div className="mb-3">
        <h2 className="text-heading">{title}</h2>
        {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
