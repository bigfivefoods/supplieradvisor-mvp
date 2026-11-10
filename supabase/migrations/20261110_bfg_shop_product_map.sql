-- bigfivegroup.africa shop product map (contract v1.0, section 3.2 and plan 4.4).
-- AWAITING APPROVAL. NOT APPLIED. This is a DATA change on production profile 102
-- (Big Five Foods): it only merges a "shop_product_id" key into products.metadata
-- for the ids below. No price, name or other column is touched.
-- Review the ids against the live catalogue before applying.
--
-- Not mapped on purpose: Boxer Soya and "Film" items (private), NSNP 25 kg
-- (not sold on the web) and the six UMTHOMBO(TM) waters (no SupplierAdvisor®
-- product yet). The endpoint rejects them with 422 unmapped_product.

UPDATE public.products p
SET metadata = COALESCE(p.metadata, '{}'::jsonb) || jsonb_build_object('shop_product_id', m.shop_product_id)
FROM (VALUES
  (2,  'onepot-chicken'),
  (3,  'onepot-beef'),
  (4,  'onepot-chakalaka'),
  (5,  'onepot-chilli-beef'),
  (6,  'porridge-original'),
  (7,  'porridge-chocolate'),
  (8,  'porridge-banana'),
  (9,  'porridge-strawberry'),
  (10, 'soup-brown-onion'),
  (11, 'soup-chicken'),
  (12, 'soup-minestrone'),
  (13, 'soup-oxtail'),
  (14, 'soya-beef-onion'),
  (15, 'soya-beef'),
  (16, 'soya-chilli-beef'),
  (17, 'soya-mutton'),
  (42, 'nsnp-beef-soya-5kg'),
  (46, 'nsnp-enriched-porridge-5kg')
) AS m(id, shop_product_id)
WHERE p.id = m.id
  AND p.profile_id = 102;
