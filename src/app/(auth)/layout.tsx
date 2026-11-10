import { BrandMark } from "@/components/layout/brand";

/** Centered, chrome-free frame for sign-in and password screens. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 pt-safe pb-safe">
      <div className="w-full max-w-[25rem]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-12 rounded-[0.9rem] [&_svg]:size-6" />
          <p className="text-[1.0625rem] font-bold tracking-[0.14em] text-ink">RECOMP</p>
        </div>
        <main id="main" className="rounded-card border border-line/70 bg-surface p-6 shadow-card sm:p-8">
          {children}
        </main>
        <p className="mt-6 text-center text-caption text-ink-muted">
          Private app · accounts are created by the owner
        </p>
      </div>
    </div>
  );
}
