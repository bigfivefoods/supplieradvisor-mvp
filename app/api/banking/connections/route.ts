import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId } from '@/lib/accounting/server';
import { banklinkConfig } from '@/lib/banking';

/** GET ?companyId= — list bank connections + middleware status */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'view');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const cfg = banklinkConfig();
    const supabase = getSupabaseServer();
    const { data: connections, error } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: true,
        connections: [],
        provider: {
          mode: cfg.mode,
          configured: cfg.configured,
          base: cfg.base,
        },
        warning: error.message,
        hint: 'Run supabase/migrations/20260711_bank_middleware.sql',
      });
    }

    return NextResponse.json({
      success: true,
      connections: connections || [],
      provider: {
        mode: cfg.mode,
        configured: cfg.configured,
        name: 'BankLink',
        docs: 'https://www.banklink.co.za/docs',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** DELETE body: companyId, connectionId, privyUserId — revoke connection */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const connectionId = Number(body.connectionId);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId) || !Number.isFinite(connectionId)) {
      return NextResponse.json(
        { error: 'companyId and connectionId required' },
        { status: 400 }
      );
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'write');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('bank_connections')
      .update({
        status: 'revoked',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId)
      .eq('profile_id', companyId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
