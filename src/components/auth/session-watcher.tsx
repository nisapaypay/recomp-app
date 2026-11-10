"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Keeps the browser session fresh while the app is open (token auto-refresh)
 * and sends the user to /login when the session ends in this tab — e.g. the
 * refresh token expired or was revoked by a sign-out elsewhere.
 * Renders nothing.
 */
export function SessionWatcher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login?reason=expired");
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  return null;
}
