-- Strong DBE claim approval: email notification + secure token review
SELECT public.sa_add_column('nsnp_claim_packs', 'approval_token', 'text');
SELECT public.sa_add_column('nsnp_claim_packs', 'approval_token_expires_at', 'timestamptz');
SELECT public.sa_add_column('nsnp_claim_packs', 'dbe_notified_at', 'timestamptz');
SELECT public.sa_add_column('nsnp_claim_packs', 'dbe_notified_email', 'text');
SELECT public.sa_add_column('nsnp_claim_packs', 'dbe_approver_email', 'text');
SELECT public.sa_add_column('nsnp_claim_packs', 'dbe_approved_at', 'timestamptz');
SELECT public.sa_add_column('nsnp_claim_packs', 'school_declaration', 'boolean');
SELECT public.sa_add_column('nsnp_claim_packs', 'school_declaration_name', 'text');
SELECT public.sa_add_column('nsnp_claim_packs', 'school_declaration_at', 'timestamptz');
SELECT public.sa_add_column('nsnp_claim_packs', 'rejection_reason', 'text');

CREATE UNIQUE INDEX IF NOT EXISTS idx_nsnp_claims_approval_token
  ON public.nsnp_claim_packs (approval_token)
  WHERE approval_token IS NOT NULL AND btrim(approval_token) <> '';

COMMENT ON COLUMN public.nsnp_claim_packs.approval_token IS
  'Secure token emailed to DBE for one-click approve/reject';
COMMENT ON COLUMN public.nsnp_claim_packs.dbe_approver_email IS
  'Email address of DBE official who approved/rejected';
