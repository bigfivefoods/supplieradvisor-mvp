-- Company group relationships: holding/subsidiary, association membership,
-- corporate groups, franchise, JV, affiliates.
-- Safe to re-run. Complements profiles.parent_profile_id (synced for active holdings).

CREATE TABLE IF NOT EXISTS public.company_group_links (
  id bigserial PRIMARY KEY,
  -- Parent side: holding company, association, or group head
  parent_profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Child side: subsidiary or member company
  child_profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- holding | association | group | franchise | joint_venture | affiliate | other
  link_type text NOT NULL DEFAULT 'holding',
  -- pending | active | rejected | left | revoked
  status text NOT NULL DEFAULT 'pending',
  -- Optional ownership for holding subsidiaries (0–100)
  ownership_pct numeric(8,4),
  role_label text,
  notes text,
  -- request = child asked parent; invite = parent invited child
  direction text NOT NULL DEFAULT 'request',
  requested_by_user_id text,
  requested_by_profile_id bigint REFERENCES public.profiles(id) ON DELETE SET NULL,
  responded_by_user_id text,
  responded_at timestamptz,
  effective_from date,
  effective_to date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_group_links_no_self
    CHECK (parent_profile_id <> child_profile_id),
  CONSTRAINT company_group_links_type_chk
    CHECK (link_type IN (
      'holding', 'association', 'group', 'franchise',
      'joint_venture', 'affiliate', 'other'
    )),
  CONSTRAINT company_group_links_status_chk
    CHECK (status IN ('pending', 'active', 'rejected', 'left', 'revoked')),
  CONSTRAINT company_group_links_direction_chk
    CHECK (direction IN ('request', 'invite')),
  CONSTRAINT company_group_links_unique_pair
    UNIQUE (parent_profile_id, child_profile_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_cgl_parent
  ON public.company_group_links (parent_profile_id);
CREATE INDEX IF NOT EXISTS idx_cgl_child
  ON public.company_group_links (child_profile_id);
CREATE INDEX IF NOT EXISTS idx_cgl_status
  ON public.company_group_links (status);
CREATE INDEX IF NOT EXISTS idx_cgl_type
  ON public.company_group_links (link_type);
CREATE INDEX IF NOT EXISTS idx_cgl_parent_active
  ON public.company_group_links (parent_profile_id, status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_cgl_child_active
  ON public.company_group_links (child_profile_id, status)
  WHERE status = 'active';

COMMENT ON TABLE public.company_group_links IS
  'Corporate group links: holding↔subsidiary, association membership, franchise, JV, affiliates. Bidirectional accept flow.';

COMMENT ON COLUMN public.company_group_links.link_type IS
  'holding=subsidiary under holding co; association=member of industry body; group=generic corporate group; franchise; joint_venture; affiliate; other';

COMMENT ON COLUMN public.company_group_links.direction IS
  'request=child asked to join parent; invite=parent invited child';

-- Ensure parent_profile_id exists for simple holding tree (world_class_schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS parent_profile_id bigint;
    BEGIN
      ALTER TABLE public.profiles
        DROP CONSTRAINT IF EXISTS profiles_parent_profile_id_fkey;
      ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_parent_profile_id_fkey
        FOREIGN KEY (parent_profile_id)
        REFERENCES public.profiles(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    CREATE INDEX IF NOT EXISTS idx_profiles_parent
      ON public.profiles (parent_profile_id)
      WHERE parent_profile_id IS NOT NULL;
  END IF;
END $$;
