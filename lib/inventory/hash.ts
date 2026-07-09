import { createHash } from 'crypto';

/** Deterministic product identity hash for on-chain anchoring (SHA-256 hex). */
export function hashProductIdentity(input: {
  profileId: number | string;
  publicId: string;
  sku?: string | null;
  name: string;
  uom?: string | null;
}) {
  const payload = [
    String(input.profileId),
    input.publicId,
    (input.sku || '').trim().toUpperCase(),
    input.name.trim().toLowerCase(),
    (input.uom || 'unit').trim().toLowerCase(),
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}

export function hashMovement(input: {
  profileId: number | string;
  productId: number | string;
  movementType: string;
  quantity: number;
  at: string;
  reference?: string | null;
}) {
  const payload = [
    String(input.profileId),
    String(input.productId),
    input.movementType,
    String(input.quantity),
    input.at,
    input.reference || '',
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}
