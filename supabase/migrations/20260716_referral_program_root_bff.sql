-- Big Five Foods (profile 102) is the top of the supply-chain referral tree.
-- Programme root stays rootless; companies with no inviter default under BFF.

-- 1) Ensure root has no parent
UPDATE public.profiles
SET referred_by_profile_id = NULL
WHERE id = 102
  AND referred_by_profile_id IS NOT NULL;

-- 2) First-touch backfill: orphan companies → Big Five Foods
--    (only where referred_by is null and not the root itself)
UPDATE public.profiles
SET referred_by_profile_id = 102
WHERE id <> 102
  AND referred_by_profile_id IS NULL
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = 102);

-- Optional: clear self-referrals if any
UPDATE public.profiles
SET referred_by_profile_id = NULL
WHERE referred_by_profile_id = id;
