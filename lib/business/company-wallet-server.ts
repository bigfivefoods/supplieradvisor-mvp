import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCompanyMembership } from '@/lib/business/access';
import { normalizeTeamRole } from '@/lib/business/permissions';
import { auditLog } from '@/lib/audit/log';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import {
  COMPANY_WALLET_MIGRATION,
  WALLET_CHALLENGE_TTL_MS,
  buildWalletControlMessage,
  canChangeCompanyWallet,
  commitCompanyWalletChange,
  isCompanyWalletReady,
  presentCompanyWallet,
  type WalletAudience,
  type WalletChallenge,
} from '@/lib/business/company-wallet';
import { randomBytes } from 'crypto';

export async function walletAudienceForMember(
  userId: string | null | undefined,
  companyId: number
): Promise<Extract<WalletAudience, 'owner' | 'member'>> {
  if (!userId) return 'member';
  const mem = await getCompanyMembership(userId, companyId);
  if (!mem.ok || !canChangeCompanyWallet(mem.role)) return 'member';
  return 'owner';
}

export function applyCompanyWalletAudience<
  T extends { company?: { wallet_address?: unknown; wallet_ready?: boolean } | null },
>(payload: T, audience: Extract<WalletAudience, 'owner' | 'member'>): T {
  if (!payload?.company) return payload;
  const raw = payload.company.wallet_address;
  const presented = presentCompanyWallet(typeof raw === 'string' ? raw : null, audience);
  return {
    ...payload,
    company: {
      ...payload.company,
      wallet_address: presented.wallet_address ?? null,
      wallet_ready: presented.wallet_ready,
    },
  };
}

export async function loadStoredCompanyWallet(companyId: number): Promise<string | null> {
  if (!Number.isFinite(companyId) || companyId <= 0) return null;
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select('wallet_address')
    .eq('id', companyId)
    .maybeSingle();
  if (error) {
    console.error('loadStoredCompanyWallet:', error.message);
    return null;
  }
  const address = data?.wallet_address ? String(data.wallet_address).trim() : '';
  return isCompanyWalletReady(address) ? address : null;
}

function migrationHint(message: string): boolean {
  return /does not exist|schema cache|company_wallet_/i.test(message);
}

export async function createWalletChallenge(input: {
  companyId: number;
  userId: string;
  role: string;
  newAddress: string;
}): Promise<
  | { ok: true; nonce: string; expiresAt: string; message: string }
  | { ok: false; status: number; error: string }
> {
  if (!canChangeCompanyWallet(input.role)) {
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
  const nonce = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + WALLET_CHALLENGE_TTL_MS).toISOString();
  const message = buildWalletControlMessage({
    companyId: input.companyId,
    newAddress,
    nonce,
    expiresAt,
  });
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('company_wallet_challenges').insert({
    profile_id: input.companyId,
    nonce,
    new_address: newAddress,
    expires_at: expiresAt,
    created_by: input.userId,
  });
  if (error) {
    return {
      ok: false,
      status: migrationHint(error.message) ? 503 : 500,
      error: migrationHint(error.message)
        ? `Apply supabase/migrations/${COMPANY_WALLET_MIGRATION} before changing a payout wallet.`
        : error.message,
    };
  }
  return { ok: true, nonce, expiresAt, message };
}

async function ownerAdminEmails(companyId: number): Promise<string[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('business_users')
    .select('email, invited_email, role, status')
    .eq('profile_id', companyId)
    .eq('status', 'active');
  if (error || !data) return [];
  const out = new Set<string>();
  for (const row of data) {
    const role = normalizeTeamRole(row.role);
    if (role !== 'owner' && role !== 'admin') continue;
    const email = String(row.email || row.invited_email || '')
      .trim()
      .toLowerCase();
    if (email.includes('@')) out.add(email);
  }
  return [...out];
}

export async function changeCompanyWallet(input: {
  companyId: number;
  userId: string;
  role: string;
  actorName?: string | null;
  newAddress: string;
  nonce: string;
  signature: string;
}): Promise<
  | { ok: true; wallet_address: string; emailWarning?: string }
  | { ok: false; status: number; error: string }
> {
  const supabase = getSupabaseServer();
  const { data: challenge, error: challengeError } = await supabase
    .from('company_wallet_challenges')
    .select('profile_id, nonce, new_address, expires_at, used_at')
    .eq('profile_id', input.companyId)
    .eq('nonce', input.nonce)
    .maybeSingle();
  if (challengeError) {
    return {
      ok: false,
      status: migrationHint(challengeError.message) ? 503 : 500,
      error: migrationHint(challengeError.message)
        ? `Apply supabase/migrations/${COMPANY_WALLET_MIGRATION} before changing a payout wallet.`
        : challengeError.message,
    };
  }

  const { data: company } = await supabase
    .from('profiles')
    .select('wallet_address, trading_name')
    .eq('id', input.companyId)
    .maybeSingle();
  const current = company?.wallet_address ? String(company.wallet_address) : null;

  const result = await commitCompanyWalletChange(
    {
      role: input.role,
      challenge: (challenge as WalletChallenge | null) ?? null,
      currentWallet: current,
      companyName: company?.trading_name ? String(company.trading_name) : null,
      actorName: input.actorName,
      recipientEmails: await ownerAdminEmails(input.companyId),
      setWallet: async (address) => {
        const { error } = await supabase
          .from('profiles')
          .update({ wallet_address: address, updated_at: new Date().toISOString() })
          .eq('id', input.companyId);
        if (error) throw new Error(error.message);
      },
      restoreWallet: async (address) => {
        await supabase
          .from('profiles')
          .update({ wallet_address: address, updated_at: new Date().toISOString() })
          .eq('id', input.companyId);
      },
      insertAudit: async (row) => {
        const { error } = await supabase.from('company_wallet_audit').insert({
          profile_id: row.profile_id,
          actor_user_id: row.actor_user_id,
          previous_address: row.previous_address,
          new_address: row.new_address,
          nonce: row.nonce,
        });
        if (error) throw new Error(error.message);
        await auditLog({
          companyId: row.profile_id,
          actorUserId: row.actor_user_id,
          action: 'company.wallet_changed',
          entityType: 'profiles',
          entityId: row.profile_id,
          summary: 'Company payout wallet changed',
          metadata: {
            nonce: row.nonce,
            previous_address: row.previous_address,
            new_address: row.new_address,
          },
        });
      },
      markChallengeUsed: async () => {
        const { error } = await supabase
          .from('company_wallet_challenges')
          .update({ used_at: new Date().toISOString() })
          .eq('profile_id', input.companyId)
          .eq('nonce', input.nonce);
        if (error) console.error('mark wallet challenge used:', error.message);
      },
      sendEmail: async (message) => {
        const resend = getResend();
        const { error } = await resend.emails.send({
          from: getResendFrom(),
          replyTo: getResendReplyTo(),
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        });
        if (error) throw new Error(error.message);
      },
    },
    {
      companyId: input.companyId,
      actorUserId: input.userId,
      newAddress: input.newAddress,
      nonce: input.nonce,
      signature: input.signature,
    }
  );
  return result;
}
