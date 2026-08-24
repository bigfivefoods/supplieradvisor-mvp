/**
 * Private-label / customer-brand SKUs on Core Inventory.
 * Tagged products appear in that customer's guest portal PO list.
 */

export type CustomerBrandTag = {
  customer_brand: boolean;
  customer_id: number | null;
  customer_name: string | null;
};

export function readCustomerBrand(
  metadata: Record<string, unknown> | null | undefined
): CustomerBrandTag {
  const meta = metadata && typeof metadata === 'object' ? metadata : {};
  const id = Number(meta.customer_id);
  const branded =
    meta.customer_brand === true || (Number.isFinite(id) && id > 0);
  return {
    customer_brand: branded,
    customer_id: Number.isFinite(id) && id > 0 ? id : null,
    customer_name:
      meta.customer_name != null && String(meta.customer_name).trim()
        ? String(meta.customer_name).trim()
        : null,
  };
}

export function writeCustomerBrand(
  metadata: Record<string, unknown> | null | undefined,
  tag: CustomerBrandTag
): Record<string, unknown> {
  const next = { ...(metadata && typeof metadata === 'object' ? metadata : {}) };
  if (tag.customer_brand && tag.customer_id && tag.customer_id > 0) {
    next.customer_brand = true;
    next.customer_id = tag.customer_id;
    next.customer_name = tag.customer_name || null;
  } else {
    delete next.customer_brand;
    delete next.customer_id;
    delete next.customer_name;
  }
  return next;
}

export function productAssignedToCustomer(
  metadata: Record<string, unknown> | null | undefined,
  customerId: number
): boolean {
  const tag = readCustomerBrand(metadata);
  return tag.customer_brand && tag.customer_id === customerId;
}
