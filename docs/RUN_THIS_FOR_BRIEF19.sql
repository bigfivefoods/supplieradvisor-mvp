-- Brief 19 — portal document share. Safe to re-run.
-- Paste in the Supabase SQL editor.
-- Public buckets so guest portal View / PDF links open. Uploads from the
-- app also try to create these buckets and fall back to a signed URL (≥ 7 days).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-documents',
  'company-documents',
  true,
  12582912,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('product-documents', 'product-documents', true, 12582912)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "brief19 portal docs read" ON storage.objects;
CREATE POLICY "brief19 portal docs read"
ON storage.objects FOR SELECT
USING (bucket_id IN ('company-documents', 'product-documents'));

DROP POLICY IF EXISTS "brief19 portal docs insert" ON storage.objects;
CREATE POLICY "brief19 portal docs insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id IN ('company-documents', 'product-documents'));

DROP POLICY IF EXISTS "brief19 portal docs update" ON storage.objects;
CREATE POLICY "brief19 portal docs update"
ON storage.objects FOR UPDATE
USING (bucket_id IN ('company-documents', 'product-documents'));
