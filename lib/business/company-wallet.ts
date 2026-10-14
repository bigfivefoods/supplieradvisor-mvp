/**
 * Company payout wallets on SupplierAdvisor®.
 * Changing one is an owner action with a signed proof of control.
 * It is separate from profile:write, which members and admins also have.
 */
import { canWrite, normalizeTeamRole } from '@/lib/business/permissions';

export const COMPANY_WALLET_MIGRATION = '20261014_company_wallet_control.sql';
export const COMPANY_WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
export const WALLET_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export type WalletAudience = 'owner' | 'member' | 'external' | 'paying_buyer';

export function canChangeCompanyWallet(role: string | null | undefined): boolean {
  return normalizeTeamRole(role) === 'owner';
}

export function isCompanyWalletReady(address: string | null | undefined): boolean {
  return COMPANY_WALLET_RE.test(String(address || '').trim());
}

/** 0x1234…abcd — first 4 hex digits and the last 4. Already-masked values stay masked. */
export function maskWalletAddress(address: string | null | undefined): string | null {
  const raw = String(address || '').trim();
  if (!raw) return null;
  if (raw.includes('…') || raw.includes('...')) return raw;
  if (raw.length < 10) return '••••';
  return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
}

export function presentCompanyWallet(
  address: string | null | undefined,
  audience: WalletAudience
): { wallet_address?: string | null; wallet_ready: boolean } {
  const ready = isCompanyWalletReady(address);
  if (audience === 'external') {
    return { wallet_ready: ready };
  }
  if (audience === 'owner' || audience === 'paying_buyer') {
    const full = String(address || '').trim();
    return { wallet_address: full || null, wallet_ready: ready };
  }
  return { wallet_address: maskWalletAddress(address), wallet_ready: ready };
}

export function redactExternalWallet<T extends Record<string, unknown>>(
  row: T,
  key = 'wallet_address'
): T & { wallet_ready: boolean } {
  const address = row[key];
  const ready = isCompanyWalletReady(typeof address === 'string' ? address : null);
  const next = { ...row, wallet_ready: ready } as T & { wallet_ready: boolean };
  delete (next as Record<string, unknown>)[key];
  return next;
}

export function hidePoPayee<T extends object>(
  po: T
): Omit<T, 'supplier_wallet'> & { supplier_wallet_ready: boolean } {
  const address = (po as { supplier_wallet?: unknown }).supplier_wallet;
  const ready = isCompanyWalletReady(typeof address === 'string' ? address : null);
  const next = {
    ...po,
    supplier_wallet_ready: ready,
  } as Omit<T, 'supplier_wallet'> & { supplier_wallet_ready: boolean };
  delete (next as { supplier_wallet?: unknown }).supplier_wallet;
  return next;
}

/** Dossier and other cross-company views never print the address. */
export function externalWalletLabel(supplier: {
  wallet_address?: string | null;
  wallet_ready?: boolean | null;
}): string {
  if (typeof supplier.wallet_ready === 'boolean') {
    return supplier.wallet_ready ? 'Ready' : 'Not set';
  }
  return isCompanyWalletReady(supplier.wallet_address) ? 'Ready' : 'Not set';
}

/**
 * Profile PATCH cannot change the payout wallet, including for owners.
 * An unchanged value is ignored so a normal profile save still succeeds.
 */
export function profileWalletPatchDecision(input: {
  incoming: unknown;
  current: string | null | undefined;
}): 'absent' | 'ignore' | 'reject' {
  if (input.incoming === undefined) return 'absent';
  const next =
    input.incoming == null || input.incoming === ''
      ? null
      : String(input.incoming).trim();
  const current = input.current ? String(input.current).trim() : null;
  if ((next || '').toLowerCase() === (current || '').toLowerCase()) return 'ignore';
  return 'reject';
}

export function anchorCompanyWallet(input: {
  role: string | null | undefined;
  stored: string | null | undefined;
}): { ok: true; companyWallet: string } | { ok: false; status: number; error: string } {
  if (!canWrite(input.role, 'inventory')) {
    return {
      ok: false,
      status: 403,
      error: 'Inventory write permission is required to anchor a product.',
    };
  }
  const stored = String(input.stored || '').trim();
  if (!isCompanyWalletReady(stored)) {
    return {
      ok: false,
      status: 400,
      error: 'Set the company payout wallet before anchoring a product.',
    };
  }
  return { ok: true, companyWallet: stored };
}

/**
 * Full address only when the caller is the paying buyer at an on-chain payment.
 * Every other caller gets wallet_ready.
 */
export function disclosePayeeWallet(input: {
  callerIsPayingBuyer: boolean;
  atOnchainPayment: boolean;
  stored: string | null | undefined;
}): { wallet_address?: string; wallet_ready: boolean } {
  const ready = isCompanyWalletReady(input.stored);
  if (input.callerIsPayingBuyer && input.atOnchainPayment && ready) {
    return { wallet_address: String(input.stored).trim(), wallet_ready: true };
  }
  return { wallet_ready: ready };
}

export function buildWalletControlMessage(input: {
  companyId: number;
  newAddress: string;
  nonce: string;
  expiresAt: string;
}): string {
  return [
    'SupplierAdvisor® company wallet change',
    `Company ID: ${input.companyId}`,
    `New wallet: ${input.newAddress.trim()}`,
    `Nonce: ${input.nonce}`,
    `Expires: ${input.expiresAt}`,
  ].join('\n');
}

export type WalletChallenge = {
  profile_id: number;
  nonce: string;
  new_address: string;
  expires_at: string;
  used_at?: string | null;
};

export function assertWalletChallengeUsable(
  row: WalletChallenge,
  expected: { companyId: number; nonce: string; address: string },
  now = new Date()
): { ok: true } | { ok: false; error: string } {
  if (Number(row.profile_id) !== expected.companyId) {
    return { ok: false, error: 'Wallet challenge is for a different company' };
  }
  if (row.nonce !== expected.nonce) {
    return { ok: false, error: 'Wallet challenge nonce does not match' };
  }
  if (row.new_address.toLowerCase() !== expected.address.trim().toLowerCase()) {
    return { ok: false, error: 'Wallet challenge is for a different address' };
  }
  if (row.used_at) {
    return { ok: false, error: 'This wallet challenge was already used' };
  }
  const exp = Date.parse(row.expires_at);
  if (!Number.isFinite(exp) || exp <= now.getTime()) {
    return { ok: false, error: 'Wallet challenge has expired' };
  }
  return { ok: true };
}

export async function verifyWalletControlSignature(input: {
  address: string;
  message: string;
  signature: string;
}): Promise<boolean> {
  if (!COMPANY_WALLET_RE.test(input.address)) return false;
  if (!/^0x[a-fA-F0-9]+$/.test(input.signature)) return false;
  try {
    const { verifyMessage } = await import('viem');
    return await verifyMessage({
      address: input.address as `0x${string}`,
      message: input.message,
      signature: input.signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function walletChangeEmail(input: {
  companyName: string;
  actorName?: string | null;
  previous: string | null;
  next: string;
}): { subject: string; html: string; text: string } {
  const company = input.companyName.trim() || 'Your company';
  const actor = input.actorName?.trim();
  const previous = input.previous || 'none';
  const subject = `SupplierAdvisor® payout wallet changed for ${company}`;
  const who = actor ? ` by ${actor}` : '';
  const text = [
    `SupplierAdvisor® payout wallet changed for ${company}${who}.`,
    `Previous: ${previous}`,
    `New: ${input.next}`,
    'Only a company owner can change this wallet, and only by signing a message from the new address.',
    'If you did not expect this change, sign in and set the payout wallet back.',
  ].join('\n');
  const html = `<div style="font-family:sans-serif;color:#0f172a;line-height:1.5">
<p style="margin:0 0 8px;color:#00b4d8;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">SupplierAdvisor®</p>
<h1 style="margin:0 0 12px;font-size:20px">Payout wallet changed</h1>
<p>The payout wallet for <strong>${escapeHtml(company)}</strong> was changed${actor ? ` by ${escapeHtml(actor)}` : ''}.</p>
<p>Previous: <code>${escapeHtml(previous)}</code><br/>New: <code>${escapeHtml(input.next)}</code></p>
<p>Only a company owner can change this wallet, and only by signing a message from the new address. If you did not expect this, sign in and set it back.</p>
</div>`;
  return { subject, html, text };
}

export type WalletAuditRow = {
  profile_id: number;
  actor_user_id: string | null;
  previous_address: string | null;
  new_address: string;
  nonce: string;
};

export type CommitWalletChangeInput = {
  companyId: number;
  actorUserId: string | null;
  newAddress: string;
  nonce: string;
  signature: string;
};

export type CommitWalletDeps = {
  now?: Date;
  role: string | null | undefined;
  challenge: WalletChallenge | null;
  currentWallet: string | null;
  companyName?: string | null;
  actorName?: string | null;
  recipientEmails: string[];
  setWallet: (address: string) => Promise<void>;
  restoreWallet: (address: string | null) => Promise<void>;
  insertAudit: (row: WalletAuditRow) => Promise<void>;
  markChallengeUsed: () => Promise<void>;
  sendEmail: (message: { to: string[]; subject: string; html: string; text: string }) => Promise<void>;
};

export async function commitCompanyWalletChange(
  deps: CommitWalletDeps,
  input: CommitWalletChangeInput
): Promise<
  | { ok: true; wallet_address: string; emailWarning?: string }
  | { ok: false; status: number; error: string }
> {
  if (!canChangeCompanyWallet(deps.role)) {
    return {
      ok: false,
      status: 403,
      error: 'Only the company owner can change the payout wallet.',
    };
  }
  const newAddress = input.newAddress.trim();
  if (!isCompanyWalletReady(newAddress)) {
    return { ok: false, status: 400, error: 'Enter a valid 0x wallet address.' };
  }
  if (!deps.challenge) {
    return { ok: false, status: 400, error: 'Wallet challenge was not found.' };
  }
  const now = deps.now ?? new Date();
  const usable = assertWalletChallengeUsable(
    deps.challenge,
    { companyId: input.companyId, nonce: input.nonce, address: newAddress },
    now
  );
  if (!usable.ok) return { ok: false, status: 400, error: usable.error };

  const message = buildWalletControlMessage({
    companyId: input.companyId,
    newAddress,
    nonce: deps.challenge.nonce,
    expiresAt: deps.challenge.expires_at,
  });
  const signed = await verifyWalletControlSignature({
    address: newAddress,
    message,
    signature: input.signature.trim(),
  });
  if (!signed) {
    return {
      ok: false,
      status: 400,
      error: 'Signature does not prove control of the new wallet.',
    };
  }

  await deps.setWallet(newAddress);
  try {
    await deps.insertAudit({
      profile_id: input.companyId,
      actor_user_id: input.actorUserId,
      previous_address: deps.currentWallet,
      new_address: newAddress,
      nonce: deps.challenge.nonce,
    });
  } catch (err) {
    await deps.restoreWallet(deps.currentWallet);
    const messageText = err instanceof Error ? err.message : 'Audit log failed';
    return {
      ok: false,
      status: 500,
      error: `Payout wallet was not changed because the audit log could not be written. ${messageText}`,
    };
  }

  await deps.markChallengeUsed();

  const notice = walletChangeEmail({
    companyName: deps.companyName || 'Your company',
    actorName: deps.actorName,
    previous: deps.currentWallet,
    next: newAddress,
  });
  const recipients = [...new Set(deps.recipientEmails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))];
  if (!recipients.length) {
    return {
      ok: true,
      wallet_address: newAddress,
      emailWarning: 'Wallet saved and audited. No owner or admin email is on file.',
    };
  }
  try {
    await deps.sendEmail({ to: recipients, ...notice });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : 'Email failed';
    return {
      ok: true,
      wallet_address: newAddress,
      emailWarning: `Wallet saved and audited. Owner and admin email failed: ${messageText}`,
    };
  }
  return { ok: true, wallet_address: newAddress };
}
