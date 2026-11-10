/**
 * Public (browser-safe) environment configuration.
 *
 * Only NEXT_PUBLIC_* values belong here. Server-only secrets must never be
 * read from this module, because it is imported by client components.
 *
 * `process.env.NEXT_PUBLIC_*` must be referenced literally so Next.js can
 * inline the values at build time.
 */

export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

export function readSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function isSupabaseConfigured(): boolean {
  return readSupabasePublicEnv() !== null;
}

export function requireSupabasePublicEnv(): SupabasePublicEnv {
  const env = readSupabasePublicEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return env;
}
