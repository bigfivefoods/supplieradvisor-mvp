-- Tie accounting legal entities to Company group profiles (holding, association, etc.).
-- Safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'accounting_entities'
  ) THEN
    ALTER TABLE public.accounting_entities
      ADD COLUMN IF NOT EXISTS linked_profile_id bigint;

    BEGIN
      ALTER TABLE public.accounting_entities
        DROP CONSTRAINT IF EXISTS accounting_entities_linked_profile_id_fkey;
      ALTER TABLE public.accounting_entities
        ADD CONSTRAINT accounting_entities_linked_profile_id_fkey
        FOREIGN KEY (linked_profile_id)
        REFERENCES public.profiles(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- One entity row per linked company profile within a workspace
    CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_entities_profile_linked
      ON public.accounting_entities (profile_id, linked_profile_id)
      WHERE linked_profile_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_acc_entities_linked
      ON public.accounting_entities (linked_profile_id)
      WHERE linked_profile_id IS NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.accounting_entities.linked_profile_id IS
  'Optional SupplierAdvisor company (profiles.id) this legal entity represents — usually from company_group_links.';
