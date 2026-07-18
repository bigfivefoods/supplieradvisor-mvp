/**
 * Per-email invite funnel: sent → opened → accepted → first trade signal.
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';

export type InviteFunnelRow = {
  email: string;
  sent: number;
  resent: number;
  opened: number;
  accepted: number;
  lastAction: string | null;
  lastAt: string | null;
  personalNote: boolean;
  status: 'sent' | 'opened' | 'accepted' | 'stale';
  quality: 'high' | 'medium' | 'low';
};

export async function loadInviteFunnel(
  companyId: number,
  limit = 100
): Promise<{ rows: InviteFunnelRow[]; tableWarning?: string }> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('activity_log')
      .select('action, metadata, created_at')
      .eq('profile_id', companyId)
      .in('action', [
        'directory.invite_sent',
        'directory.invite_resent',
        'network.invite_sent',
        'network.invite_opened',
        'network.invite_accepted',
        'network.invite_seq_3',
        'network.invite_seq_7',
      ])
      .order('created_at', { ascending: false })
      .limit(Math.min(400, limit * 4));

    if (error) {
      return { rows: [], tableWarning: error.message };
    }

    const byEmail = new Map<
      string,
      {
        sent: number;
        resent: number;
        opened: number;
        accepted: number;
        lastAction: string | null;
        lastAt: string | null;
        personalNote: boolean;
      }
    >();

    for (const r of data || []) {
      const meta =
        r.metadata && typeof r.metadata === 'object'
          ? (r.metadata as Record<string, unknown>)
          : {};
      const email = meta.email ? String(meta.email).toLowerCase().trim() : '';
      if (!email.includes('@')) continue;
      let row = byEmail.get(email);
      if (!row) {
        row = {
          sent: 0,
          resent: 0,
          opened: 0,
          accepted: 0,
          lastAction: null,
          lastAt: null,
          personalNote: false,
        };
        byEmail.set(email, row);
      }
      const a = String(r.action || '');
      if (a.includes('invite_sent') && !a.includes('resent')) row.sent += 1;
      if (a.includes('invite_resent') || a.includes('seq_')) row.resent += 1;
      if (a.includes('invite_opened')) row.opened += 1;
      if (a.includes('invite_accepted')) row.accepted += 1;
      if (meta.personalNote || meta.note || meta.message) row.personalNote = true;
      if (!row.lastAt) {
        row.lastAction = a;
        row.lastAt = r.created_at ? String(r.created_at) : null;
      }
    }

    const rows: InviteFunnelRow[] = [];
    for (const [email, r] of byEmail) {
      let status: InviteFunnelRow['status'] = 'sent';
      if (r.accepted > 0) status = 'accepted';
      else if (r.opened > 0) status = 'opened';
      else if (
        r.lastAt &&
        Date.now() - Date.parse(r.lastAt) > 14 * 86400000 &&
        r.sent + r.resent >= 2
      ) {
        status = 'stale';
      }

      let quality: InviteFunnelRow['quality'] = 'medium';
      if (r.accepted > 0 || (r.opened > 0 && r.personalNote)) quality = 'high';
      if (
        (r.sent + r.resent >= 3 && r.opened === 0 && r.accepted === 0) ||
        (!r.personalNote && r.sent + r.resent >= 2 && r.opened === 0)
      ) {
        quality = 'low';
      }

      rows.push({
        email,
        ...r,
        status,
        quality,
      });
    }

    rows.sort((a, b) => {
      const ta = a.lastAt ? Date.parse(a.lastAt) : 0;
      const tb = b.lastAt ? Date.parse(b.lastAt) : 0;
      return tb - ta;
    });

    return { rows: rows.slice(0, limit) };
  } catch (e: unknown) {
    return {
      rows: [],
      tableWarning: e instanceof Error ? e.message : 'funnel error',
    };
  }
}

/** Count bulk sends in last 24h for throttle. */
export async function countRecentInviteSends(
  companyId: number
): Promise<number> {
  try {
    const supabase = getSupabaseServer();
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId)
      .in('action', [
        'directory.invite_sent',
        'directory.invite_resent',
        'network.invite_sent',
      ])
      .gte('created_at', since);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export const INVITE_BULK_DAILY_CAP = 40;
export const INVITE_BULK_BATCH_MAX = 15;
