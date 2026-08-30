-- Brief 17 — PO thread on trade portal messages. Safe to re-run.
-- Paste in the Supabase SQL editor.

ALTER TABLE public.trade_portal_messages
  ADD COLUMN IF NOT EXISTS purchase_order_id int;

CREATE INDEX IF NOT EXISTS idx_trade_portal_messages_po
  ON public.trade_portal_messages (purchase_order_id);
