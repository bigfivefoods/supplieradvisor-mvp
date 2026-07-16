import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
  assertCronSecret,
} from '@/lib/auth/api-auth';
import {
  applyLocationDefaults,
  continentFromCountry,
} from '@/lib/geo/continent-from-country';
import { logApi } from '@/lib/logging/logger';

/**
 * POST — backfill profiles.continent from country (and canonicalize country).
 *
 * Modes:
 *  1. Company member: { companyId } → fix only that company
 *  2. Cron: Authorization Bearer CRON_SECRET + optional { limit }
 *     → batch fix profiles missing continent but with country
 *
 * GET — same batch mode for Vercel Cron (Authorization: Bearer CRON_SECRET).
 */

async function runBatchBackfill(limit: number) {
  const supabase = getSupabaseServer();
  const { data: rows, error } = await supabase
    .from('profiles')
    .select('id, country, continent')
    .not('country', 'is', null)
    .neq('country', '')
    .limit(limit * 3);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  let updated = 0;
  let skipped = 0;
  const samples: Array<{ id: number; country: string; continent: string }> =
    [];

  for (const row of rows || []) {
    if (updated >= limit) break;
    const country = String(row.country || '').trim();
    if (!country) {
      skipped += 1;
      continue;
    }
    const loc = applyLocationDefaults({
      country,
      continent: row.continent,
    });
    const nextCountry = loc.country || country;
    const nextContinent =
      loc.continent || continentFromCountry(nextCountry) || null;
    if (!nextContinent) {
      skipped += 1;
      continue;
    }
    if (
      String(row.continent || '').trim() === nextContinent &&
      String(row.country || '').trim() === nextCountry
    ) {
      skipped += 1;
      continue;
    }
    const { error: upErr } = await supabase
      .from('profiles')
      .update({
        country: nextCountry,
        continent: nextContinent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (!upErr) {
      updated += 1;
      if (samples.length < 10) {
        samples.push({
          id: Number(row.id),
          country: nextCountry,
          continent: nextContinent,
        });
      }
    } else {
      skipped += 1;
    }
  }

  logApi('/api/business/location-backfill', 'info', 'batch complete', {
    updated,
    skipped,
  });

  return { ok: true as const, updated, skipped, samples };
}

export async function GET(request: NextRequest) {
  const cron = assertCronSecret(request);
  if (!cron.ok) return cron.response;
  const limit = Math.min(
    500,
    Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 200) || 200)
  );
  const result = await runBatchBackfill(limit);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, ...result });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = body.companyId != null ? Number(body.companyId) : null;
    const limit = Math.min(500, Math.max(1, Number(body.limit || 100) || 100));

    const supabase = getSupabaseServer();

    // Single-company path (authenticated member)
    if (companyId && Number.isFinite(companyId) && companyId > 0) {
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (!gate.ok) return gate.response;

      const { data: row, error } = await supabase
        .from('profiles')
        .select('id, country, continent')
        .eq('id', companyId)
        .maybeSingle();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!row) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
      }

      const loc = applyLocationDefaults({
        country: row.country,
        continent: row.continent,
      });
      if (!loc.country && !row.country) {
        return NextResponse.json({
          success: true,
          updated: false,
          reason: 'No country on profile',
        });
      }
      const nextCountry = loc.country || row.country;
      const nextContinent =
        loc.continent ||
        continentFromCountry(String(nextCountry || '')) ||
        row.continent;

      if (
        String(row.country || '') === String(nextCountry || '') &&
        String(row.continent || '') === String(nextContinent || '')
      ) {
        return NextResponse.json({
          success: true,
          updated: false,
          country: nextCountry,
          continent: nextContinent,
        });
      }

      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          country: nextCountry,
          continent: nextContinent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        updated: true,
        country: nextCountry,
        continent: nextContinent,
      });
    }

    // Batch path — cron only
    const cron = assertCronSecret(request);
    if (!cron.ok) return cron.response;

    const result = await runBatchBackfill(limit);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
