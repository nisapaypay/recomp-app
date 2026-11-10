-- =============================================================================
-- RECOMP · OPTIONAL manual script · Save your baseline profile
-- -----------------------------------------------------------------------------
-- NOT a migration. Run once in Supabase → SQL Editor after migrations 1–5
-- and after your account exists. It writes the initial measurements from the
-- master specification into YOUR profile row.
--
-- 1. Replace the email below with your login email.
-- 2. Check the values (edit them if your baseline differs).
-- 3. Run. It must report "1 row updated"; 0 means the email didn't match.
--
-- BMI (23.3) is not stored: it is calculated from height and weight.
-- These values can later be changed from Settings → Profile.
-- =============================================================================

update public.profiles p
set
  height_cm                  = 152.0,
  initial_weight_kg          = 53.90,
  initial_body_fat_pct       = 32.4,
  initial_skeletal_muscle_kg = 20.0,
  initial_visceral_fat       = 4.5
from auth.users u
where u.id = p.user_id
  and u.email = 'YOUR_EMAIL_HERE';
