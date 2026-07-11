/**
 * Container writes that tolerate missing optional columns (e.g. continent)
 * until migrations are applied on the live Supabase project.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const OPTIONAL_COLUMNS = [
  'continent',
  'capacity_units',
  'monthly_target',
  'wifi_portal_url',
  'container_type',
  'photo_url',
  'tags',
  'is_active',
  'deployed_date',
  'purchase_date',
  'cost',
] as const;

function isMissingColumnError(message: string): boolean {
  return /column|schema cache|does not exist|could not find/i.test(message);
}

function stripOptional(row: Record<string, unknown>): Record<string, unknown> {
  const next = { ...row };
  for (const col of OPTIONAL_COLUMNS) {
    delete next[col];
  }
  return next;
}

/**
 * Update a container row; if Supabase rejects unknown columns, retry without optionals.
 */
export async function updateContainerTolerant(
  supabase: SupabaseClient,
  id: number,
  updates: Record<string, unknown>
): Promise<
  | { ok: true; container: Record<string, unknown> }
  | { ok: false; error: string; status: number }
> {
  const { data, error } = await supabase
    .from('containers')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (!error && data) {
    return { ok: true, container: data as Record<string, unknown> };
  }

  const msg = error?.message || 'Update failed';
  if (!isMissingColumnError(msg)) {
    return { ok: false, error: msg, status: 500 };
  }

  const slim = stripOptional(updates);
  // If continent was the only issue, slim may still work with other fields
  const retry = await supabase
    .from('containers')
    .update(slim)
    .eq('id', id)
    .select('*')
    .single();

  if (retry.error) {
    // Last resort: strip any field mentioned in the error
    const m = /'([^']+)' column/i.exec(retry.error.message + ' ' + msg);
    if (m?.[1] && slim[m[1]] !== undefined) {
      const again = { ...slim };
      delete again[m[1]];
      const r2 = await supabase
        .from('containers')
        .update(again)
        .eq('id', id)
        .select('*')
        .single();
      if (!r2.error && r2.data) {
        return { ok: true, container: r2.data as Record<string, unknown> };
      }
      return {
        ok: false,
        error: r2.error?.message || retry.error.message,
        status: 500,
      };
    }
    return {
      ok: false,
      error: `${retry.error.message}. Hint: run supabase/migrations/20260709_containers_continent.sql`,
      status: 500,
    };
  }

  return { ok: true, container: retry.data as Record<string, unknown> };
}

export async function insertContainerTolerant(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
): Promise<
  | { ok: true; container: Record<string, unknown> }
  | { ok: false; error: string; status: number }
> {
  const { data, error } = await supabase
    .from('containers')
    .insert(payload)
    .select('*')
    .single();

  if (!error && data) {
    return { ok: true, container: data as Record<string, unknown> };
  }

  const msg = error?.message || 'Insert failed';
  if (!isMissingColumnError(msg)) {
    return { ok: false, error: msg, status: 500 };
  }

  const slim = stripOptional(payload);
  const retry = await supabase.from('containers').insert(slim).select('*').single();
  if (retry.error || !retry.data) {
    return {
      ok: false,
      error: `${retry.error?.message || msg}. Hint: run supabase/migrations/20260709_containers_continent.sql`,
      status: 500,
    };
  }
  return { ok: true, container: retry.data as Record<string, unknown> };
}
