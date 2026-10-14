import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  TRADE_MAGIC_DAYS,
  TRADE_OTP_MINUTES,
  TRADE_SESSION_DAYS,
  hashSecret,
  newOtp,
  newSecret,
} from './customer-session';
import { isMissingTradeSchema, TradeSchemaMissingError } from './tradegraph-db';

export async function issueCustomerInvite(opts: {
  companyId: number;
  customerId: string;
  email: string;
}): Promise<{ otp: string; magic: string; expiresAt: string }> {
  const supabase = getSupabaseServer();
  const otp = newOtp();
  const magic = newSecret();
  const expiresAt = new Date(Date.now() + TRADE_MAGIC_DAYS * 864e5).toISOString();
  const inserted = await supabase.from('trade_customer_invites').insert({
    id: `ti_${newSecret(8)}`,
    company_id: opts.companyId,
    customer_id: opts.customerId,
    email: opts.email.trim().toLowerCase(),
    otp_hash: hashSecret(otp),
    magic_hash: hashSecret(magic),
    expires_at: expiresAt,
  });
  if (isMissingTradeSchema(inserted.error)) throw new TradeSchemaMissingError();
  if (inserted.error) throw new Error(inserted.error.message);
  return { otp, magic, expiresAt };
}

export async function openCustomerSession(opts: {
  companyId: number;
  email?: string;
  otp?: string;
  magic?: string;
}): Promise<{ token: string; customerId: string } | null> {
  const supabase = getSupabaseServer();
  const email = String(opts.email || '').trim().toLowerCase();
  let query = supabase
    .from('trade_customer_invites')
    .select('id, customer_id, otp_hash, magic_hash, expires_at, used_at, email, created_at')
    .eq('company_id', opts.companyId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(8);
  if (email) query = query.eq('email', email);
  const found = await query;
  if (isMissingTradeSchema(found.error)) throw new TradeSchemaMissingError();
  if (found.error) throw new Error(found.error.message);
  const rows = (found.data || []) as Array<{
      id: string;
    customer_id: string;
    otp_hash: string | null;
    magic_hash: string | null;
    email: string;
    created_at?: string;
  }>;
  const otpHash = opts.otp ? hashSecret(opts.otp.trim()) : '';
  const magicHash = opts.magic ? hashSecret(opts.magic.trim()) : '';
  const match = rows.find((row) => {
    if (otpHash && row.otp_hash === otpHash) {
      const created = Date.parse(String(row.created_at || ''));
      const fresh =
        Number.isFinite(created) &&
        Date.now() - created <= TRADE_OTP_MINUTES * 60 * 1000;
      return fresh && (!email || row.email === email);
    }
    if (magicHash && row.magic_hash === magicHash) return true;
    return false;
  });
  if (!match) return null;
  const token = newSecret();
  const session = await supabase.from('trade_customer_sessions').insert({
    id: `ts_${newSecret(8)}`,
    company_id: opts.companyId,
    customer_id: match.customer_id,
    token_hash: hashSecret(token),
    expires_at: new Date(Date.now() + TRADE_SESSION_DAYS * 864e5).toISOString(),
  });
  if (session.error) throw new Error(session.error.message);
  await supabase
    .from('trade_customer_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', match.id);
  return { token, customerId: match.customer_id };
}

export async function recentInviteCount(companyId: number, email: string): Promise<number> {
  const supabase = getSupabaseServer();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const found = await supabase
    .from('trade_customer_invites')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('email', email.trim().toLowerCase())
    .gte('created_at', since);
  if (found.error) return 0;
  return found.count || 0;
}

export async function customerPushSubs(customerId: string): Promise<
  Array<{ endpoint: string; p256dh: string; auth: string }>
> {
  const supabase = getSupabaseServer();
  const found = await supabase
    .from('trade_customer_push')
    .select('endpoint, p256dh, auth')
    .eq('customer_id', customerId);
  if (found.error || !found.data) return [];
  return found.data.map((row) => ({
    endpoint: String(row.endpoint),
    p256dh: String(row.p256dh),
    auth: String(row.auth),
  }));
}
