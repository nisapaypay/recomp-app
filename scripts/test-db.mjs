#!/usr/bin/env node
/**
 * Offline database test: runs every migration in supabase/migrations/ and
 * then supabase/tests/rls_test.sql against PGlite (real Postgres 17 compiled
 * to WebAssembly), in memory.
 *
 * Supabase's `auth` and `storage` schemas are replaced by a minimal stand-in
 * (auth.users, auth.uid(), storage.buckets/objects, storage.foldername and
 * the anon / authenticated roles). This verifies our SQL, constraints, seeds
 * and RLS logic — it is NOT a test of the hosted Supabase project.
 *
 * Usage: pnpm test:db
 */
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

const SUPABASE_STUB = /* sql */ `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (
    id uuid primary key,
    email text,
    created_at timestamptz default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated;

  create schema storage;
  grant usage on schema storage to anon, authenticated;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text,
    owner uuid default auth.uid(),
    created_at timestamptz default now()
  );
  alter table storage.objects enable row level security;
  -- Like hosted Supabase: buckets has RLS on and no policies, so users cannot
  -- list buckets via SQL (Storage's own service reads them with elevated rights).
  alter table storage.buckets enable row level security;
  grant select on storage.buckets to anon, authenticated;
  grant all on storage.objects to anon, authenticated;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant execute on function storage.foldername(text) to anon, authenticated;
`;

async function runFile(db, file, label) {
  const sql = await readFile(file, "utf8");
  const started = performance.now();
  try {
    const results = await db.exec(sql);
    const ms = Math.round(performance.now() - started);
    console.log(`  ✓ ${label} (${ms} ms)`);
    return results;
  } catch (error) {
    console.error(`  ✗ ${label}\n    ${error.message}`);
    // Make sure a failed file doesn't leave an open transaction behind.
    await db.exec("rollback").catch(() => {});
    throw error;
  }
}

/** Compare seeded reference data with tests/fixtures/master-program.mjs. */
async function verifyProgramAgainstSpec(db) {
  const spec = await import(path.join(root, "tests", "fixtures", "master-program.mjs"));
  const errors = [];

  const days = (await db.query(`
    select week_number, day_of_week, activity_type, walking_target_min_minutes as wmin, walking_target_max_minutes as wmax
    from public.program_days order by 1, 2`)).rows;
  const rows = (await db.query(`
    select pe.week_number, pe.day_of_week, pe.order_index, e.name, pe.sets, pe.target_min, pe.target_max,
           coalesce(pe.tempo_eccentric_s, e.tempo_eccentric_s) as te,
           coalesce(pe.tempo_pause_s, e.tempo_pause_s) as tp,
           coalesce(pe.tempo_concentric_s, e.tempo_concentric_s) as tc,
           e.side_mode, e.measure_type
    from public.program_exercises pe join public.exercise_library e on e.id = pe.exercise_id
    order by 1, 2, 3`)).rows;

  for (let week = 1; week <= 12; week++) {
    const weekDays = days.filter((d) => d.week_number === week);
    const activities = weekDays.map((d) => d.activity_type);
    if (JSON.stringify(activities) !== JSON.stringify(spec.SCHEDULE)) {
      errors.push(`week ${week}: schedule ${activities.join(",")}`);
    }
    const walking = spec.walkingForWeek(week);
    for (const dow of [2, 6]) {
      const d = weekDays.find((x) => x.day_of_week === dow);
      if (!d || d.wmin !== walking[dow][0] || d.wmax !== walking[dow][1]) {
        errors.push(`week ${week} day ${dow}: walking ${d?.wmin}-${d?.wmax}, expected ${walking[dow].join("-")}`);
      }
    }
    const strength = spec.strengthDaysForWeek(week);
    for (const dow of [1, 3, 5]) {
      const actual = rows
        .filter((r) => r.week_number === week && r.day_of_week === dow)
        .map((r) => [r.name, r.sets, r.target_min, r.target_max]);
      if (JSON.stringify(actual) !== JSON.stringify(strength[dow])) {
        errors.push(`week ${week} day ${dow}:\n      seed ${JSON.stringify(actual)}\n      spec ${JSON.stringify(strength[dow])}`);
      }
    }
    for (const dow of [2, 4, 6, 7]) {
      if (rows.some((r) => r.week_number === week && r.day_of_week === dow)) {
        errors.push(`week ${week} day ${dow}: has strength prescriptions`);
      }
    }
  }

  for (const [name, tempo] of Object.entries(spec.SPEC_TEMPOS)) {
    const r = rows.find((x) => x.week_number === 1 && x.day_of_week === 1 && x.name === name);
    if (!r || `${r.te}-${r.tp}-${r.tc}` !== tempo.join("-")) {
      errors.push(`tempo ${name}: ${r ? `${r.te}-${r.tp}-${r.tc}` : "missing"}, expected ${tempo.join("-")}`);
    }
  }

  const library = (await db.query(`
    select name, side_mode, measure_type, description, starting_position, breathing,
           cardinality(execution_steps) as steps, cardinality(common_mistakes) as mistakes,
           concat_ws(' ', description, starting_position, breathing,
                     array_to_string(execution_steps, ' '), array_to_string(common_mistakes, ' ')) as text
    from public.exercise_library`)).rows;
  // Beginner wording: jargon replaced by migration 7 must not come back.
  const JARGON = /\b(hinge|hinging|brace|bracing|momentum|stacked|soft bend|drive the hips)\b/i;
  for (const e of library) {
    if (!e.starting_position) errors.push(`${e.name}: missing starting position`);
    if (!e.breathing) errors.push(`${e.name}: missing breathing`);
    if (e.mistakes < 2) errors.push(`${e.name}: fewer than 2 common mistakes`);
    const jargon = JARGON.exec(e.text);
    if (jargon) errors.push(`${e.name}: jargon "${jargon[0]}"`);
    if (/\bglutes\b/i.test(e.text) && !/\(glutes\)/i.test(e.text)) errors.push(`${e.name}: "glutes" without explanation`);
  }
  for (const e of library) {
    const expectedSide = spec.UNILATERAL.includes(e.name) ? "per_side" : spec.PER_DIRECTION.includes(e.name) ? "per_direction" : "none";
    if (e.side_mode !== expectedSide) errors.push(`${e.name}: side_mode ${e.side_mode}, expected ${expectedSide}`);
    if ((e.name === "Plank") !== (e.measure_type === "seconds")) errors.push(`${e.name}: measure_type ${e.measure_type}`);
    if (!e.description || e.steps === 0) errors.push(`${e.name}: missing instructions`);
    if (e.name === "Lateral Raise" && /use no weight/i.test(e.text)) errors.push("Lateral Raise: modification listed in steps");
  }
  const used = new Set(rows.map((r) => r.name));
  for (const e of library) if (!used.has(e.name)) errors.push(`${e.name}: in library but unused by the program`);

  if (errors.length) {
    for (const e of errors) console.error(`  ✗ ${e}`);
    throw new Error(`${errors.length} program/spec mismatches`);
  }
  console.log(`  ✓ 12 weeks × 7 days schedule, walking targets, ${rows.length} prescriptions, spec tempos, ${library.length} exercises (sides, timed holds, instructions complete, plain language)`);
}

async function main() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const version = await db.query("select version()");
  console.log(`PGlite: ${version.rows[0].version.split(",")[0]}`);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  console.log(`\nMigrations (${files.length}):`);
  for (const f of files) await runFile(db, path.join(migrationsDir, f), f);

  console.log("\nIdempotency (re-run seed migrations):");
  for (const f of files.filter((f) => f.includes("seed") || f.includes("instructions"))) {
    await runFile(db, path.join(migrationsDir, f), f);
  }

  const counts = await db.query(`
    select
      (select count(*) from public.exercise_library)::int  as exercises,
      (select count(*) from public.program_days)::int      as days,
      (select count(*) from public.program_exercises)::int as prescriptions,
      (select count(*) from pg_policies where schemaname = 'public')::int  as public_policies,
      (select count(*) from pg_policies where schemaname = 'storage')::int as storage_policies
  `);
  console.log("\nSeed & policy counts:", counts.rows[0]);

  console.log("\nProgram vs master prompt:");
  await verifyProgramAgainstSpec(db);

  console.log("\nRLS test:");
  const results = await runFile(db, path.join(root, "supabase", "tests", "rls_test.sql"), "rls_test.sql");
  const pass = results.flatMap((r) => r.rows ?? []).find((row) => "result" in row);
  console.log(`  → ${pass?.result ?? "no result row"}`);

  console.log("\nWorkout test:");
  const workoutResults = await runFile(db, path.join(root, "supabase", "tests", "workout_test.sql"), "workout_test.sql");
  const workoutPass = workoutResults.flatMap((r) => r.rows ?? []).find((row) => "result" in row);
  console.log(`  → ${workoutPass?.result ?? "no result row"}`);

  console.log("\nAdaptive progression test:");
  const adaptiveResults = await runFile(db, path.join(root, "supabase", "tests", "adaptive_test.sql"), "adaptive_test.sql");
  const adaptivePass = adaptiveResults.flatMap((r) => r.rows ?? []).find((row) => "result" in row);
  console.log(`  → ${adaptivePass?.result ?? "no result row"}`);

  console.log("\nWalking test:");
  const walkingResults = await runFile(db, path.join(root, "supabase", "tests", "walking_test.sql"), "walking_test.sql");
  const walkingPass = walkingResults.flatMap((r) => r.rows ?? []).find((row) => "result" in row);
  console.log(`  → ${walkingPass?.result ?? "no result row"}`);

  console.log("\nProgress (measurements & photos) test:");
  const progressResults = await runFile(db, path.join(root, "supabase", "tests", "progress_test.sql"), "progress_test.sql");
  const progressPass = progressResults.flatMap((r) => r.rows ?? []).find((row) => "result" in row);
  console.log(`  → ${progressPass?.result ?? "no result row"}`);

  const leftovers = await db.query("select count(*)::int as n from auth.users");
  if (leftovers.rows[0].n !== 0) throw new Error("a SQL test did not roll back");
  const today = await db.query("select public.recomp_today() = (now() at time zone 'Asia/Jakarta')::date as ok");
  if (!today.rows[0].ok) throw new Error("recomp_today() override leaked out of a SQL test");
  console.log("  → rollback verified (no test users left)");

  await db.close();
  console.log("\nAll database checks passed.");
}

main().catch((error) => {
  console.error("\nDatabase checks FAILED.");
  console.error(error);
  process.exit(1);
});
