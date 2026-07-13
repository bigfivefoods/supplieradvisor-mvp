-- Link container stock lines to central products catalogue

SELECT public.sa_add_column('container_inventory', 'product_id', 'bigint');

CREATE INDEX IF NOT EXISTS idx_container_inventory_product
  ON public.container_inventory (product_id);
