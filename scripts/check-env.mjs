#!/usr/bin/env node
/**
 * Validates environment configuration and probes the hosted Supabase project
 * using ONLY the publishable key (never the secret key).
 *
 *  1. Required variables exist and look right.
 *  2. No secret is exposed through a NEXT_PUBLIC_* variable.
 *  3. Auth API is reachable; reports sign-up setting.
 *  4. For each table, an anonymous REST request must NOT return data.
 *     Also reports whether migrations appear to have been applied.
 *
 * Usage: pnpm check:env   (reads .env.local, then process env)
 */
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.join(root, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const problems = [];
const warnings = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);

console.log("Environment variables:");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

if (!url) problems.push("NEXT_PUBLIC_SUPABASE_URL is missing");
else if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url))
  warnings.push(`NEXT_PUBLIC_SUPABASE_URL has an unexpected format: ${url}`);
else ok("NEXT_PUBLIC_SUPABASE_URL");

if (!key) problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing");
else if (key.startsWith("sb_secret_"))
  problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contains a SECRET key — replace it immediately");
else if (!key.startsWith("sb_publishable_") && !key.startsWith("eyJ"))
  warnings.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY does not look like a publishable or anon key");
else ok("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (publishable)");

if (!siteUrl) warnings.push("NEXT_PUBLIC_SITE_URL is missing (password-reset links fall back to the request origin)");
else ok(`NEXT_PUBLIC_SITE_URL = ${siteUrl}`);

for (const [name, value] of Object.entries(process.env)) {
  if (name.startsWith("NEXT_PUBLIC_") && typeof value === "string" && value.startsWith("sb_secret_")) {
    problems.push(`${name} exposes a secret key to the browser`);
  }
}

if (problems.length === 0 && url && key) {
  const headers = { apikey: key };

  console.log("\nSupabase Auth:");
  try {
    const health = await fetch(`${url}/auth/v1/health`, { headers });
    if (health.ok) ok(`reachable (HTTP ${health.status})`);
    else problems.push(`Auth health returned HTTP ${health.status}`);

    const settings = await (await fetch(`${url}/auth/v1/settings`, { headers })).json();
    if (settings.external?.email) ok("email/password provider enabled");
    else problems.push("Email provider is disabled");
    if (settings.disable_signup) ok("public sign-up disabled");
    else warnings.push("Public sign-up is ENABLED — disable it in Authentication → Sign In / Providers");
  } catch (error) {
    problems.push(`Cannot reach Supabase Auth: ${error.message}`);
  }

  console.log("\nDatabase (anonymous REST access must be denied):");
  const tables = [
    "profiles", "user_programs", "exercise_library", "program_days", "program_exercises",
    "workout_sessions", "workout_exercises", "workout_sets", "workout_feedback",
    "adaptive_adjustments", "walking_activities", "body_measurements", "progress_photos",
    "reminder_settings", "workout_session_state",
  ];
  let missing = 0;
  for (const table of tables) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });
    const body = await res.json().catch(() => ({}));
    if (body?.code === "PGRST205" || res.status === 404) {
      missing += 1;
    } else if (res.ok && Array.isArray(body) && body.length > 0) {
      problems.push(`anon can READ rows from ${table}`);
    } else if (res.ok) {
      warnings.push(`${table}: anon request allowed but returned no rows (expected permission denied)`);
    } else {
      ok(`${table}: denied (${body?.code ?? res.status})`);
    }
  }
  // Migration 8/9 functions: anon must be denied (42501); "not found" means not applied.
  if (missing === 0) {
    const probe = await fetch(`${url}/rest/v1/rpc/start_workout_session`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ p_program_id: "00000000-0000-4000-8000-000000000001", p_scheduled_date: "2026-01-05" }),
    });
    const body = await probe.json().catch(() => ({}));
    if (body?.code === "PGRST202") {
      problems.push("Migration 9 (20261113090000_scheduled_vs_performed.sql) is not applied — run it in SQL Editor");
    } else if (body?.code === "42501") {
      ok("migration 9 applied (start_workout_session(program, scheduled_date) exists, anon denied)");
    } else {
      warnings.push(`start_workout_session probe returned ${probe.status} ${body?.code ?? ""}`);
    }

    const probe10 = await fetch(`${url}/rest/v1/rpc/save_workout_feedback`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_session_id: "00000000-0000-4000-8000-000000000001",
        p_difficulty: "just_right",
        p_pain: false,
        p_notes: null,
        p_adjustment: null,
      }),
    });
    const body10 = await probe10.json().catch(() => ({}));
    if (body10?.code === "PGRST202") {
      problems.push("Migration 10 (20261114090000_adaptive_progression.sql) is not applied — run it in SQL Editor");
    } else if (body10?.code === "42501") {
      ok("migration 10 applied (save_workout_feedback exists, anon denied)");
    } else {
      warnings.push(`save_workout_feedback probe returned ${probe10.status} ${body10?.code ?? ""}`);
    }
  }

  if (missing === tables.length) {
    warnings.push("No RECOMP tables found — migrations have not been run yet (see README → Database setup)");
  } else if (missing > 0) {
    problems.push(`${missing} of ${tables.length} tables are missing — a migration may have failed`);
  }
}

console.log("");
for (const w of warnings) console.log(`  ! ${w}`);
for (const p of problems) console.log(`  ✗ ${p}`);
if (problems.length) {
  console.log("\nEnvironment check FAILED.");
  process.exit(1);
}
console.log(warnings.length ? "\nEnvironment check passed with warnings." : "\nEnvironment check passed.");
