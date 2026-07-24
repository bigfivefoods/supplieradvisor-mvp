import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { MIGRATION_HINT as PM_HINT } from '@/lib/projects/types';

/**
 * POST — turn an Intelligence insight into a durable action.
 * body: {
 *   companyId, privyUserId,
 *   insight: { id, title, detail, domain, severity, href? },
 *   action: 'riad' | 'task' | 'collection' | 'activity'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const action = String(body.action || 'riad').toLowerCase();
    const insight = body.insight || {};
    const title = String(insight.title || body.title || 'Intelligence follow-up').trim();
    const detail = String(insight.detail || body.detail || '').trim();
    const domain = String(insight.domain || 'ops');
    const severity =
      insight.severity === 'critical'
        ? 'critical'
        : insight.severity === 'warning'
          ? 'high'
          : 'medium';
    const href = insight.href || body.href || '/dashboard/intelligence/neural-insights';
    const owner_name = body.owner_name
      ? String(body.owner_name).trim()
      : null;
    const due_date = body.due_date ? String(body.due_date).slice(0, 10) : null;

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    // Always audit
    await supabase.from('activity_log').insert({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'intelligence.action',
      entity_type: 'insight',
      entity_id: String(insight.id || 'manual'),
      metadata: {
        action,
        title,
        domain,
        href,
        owner_name,
        due_date,
      },
    });

    if (action === 'collection') {
      return NextResponse.json({
        success: true,
        action: 'collection',
        href: '/dashboard/customers/money',
        message: 'Open Money hub to chase AR / confirm claims.',
      });
    }

    if (action === 'activity') {
      return NextResponse.json({
        success: true,
        action: 'activity',
        message: 'Logged to activity feed.',
        href,
      });
    }

    if (action === 'task') {
      // Prefer first active project; else soft-create planning project
      let projectId: number | null = null;
      const { data: projects } = await supabase
        .from('pm_projects')
        .select('id')
        .eq('profile_id', companyId)
        .in('status', ['active', 'planning'])
        .order('updated_at', { ascending: false })
        .limit(1);
      if (projects?.[0]?.id) {
        projectId = projects[0].id;
      } else {
        const { data: created } = await supabase
          .from('pm_projects')
          .insert({
            profile_id: companyId,
            name: 'Intelligence actions',
            description: 'Auto-created from Intelligence insights',
            status: 'active',
            methodology: 'standard',
            project_type: 'initiative',
            created_by: mem.userId,
            updated_at: now,
          })
          .select('id')
          .single();
        projectId = created?.id ?? null;
      }

      if (!projectId) {
        return NextResponse.json(
          {
            error: 'Could not create task — projects table missing?',
            hint: 'Run 20260711_haccp_esg_pm_suite.sql',
            href: '/dashboard/projects',
          },
          { status: 503 }
        );
      }

      const taskRow: Record<string, unknown> = {
        profile_id: companyId,
        project_id: projectId,
        title,
        description: [
          detail || `From insight (${domain}).`,
          owner_name ? `Owner: ${owner_name}` : '',
          due_date ? `Due: ${due_date}` : '',
          href ? `Open: ${href}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        status: 'todo',
        column_key: 'backlog',
        created_by: mem.userId,
        updated_at: now,
      };
      if (owner_name) taskRow.owner_name = owner_name;
      if (due_date) taskRow.due_date = due_date;

      const { data: task, error } = await supabase
        .from('pm_tasks')
        .insert(taskRow)
        .select('id')
        .single();

      if (error) {
        // Retry without optional columns
        const { data: soft, error: softErr } = await supabase
          .from('pm_tasks')
          .insert({
            profile_id: companyId,
            project_id: projectId,
            title,
            description: taskRow.description,
            status: 'todo',
            column_key: 'backlog',
            created_by: mem.userId,
            updated_at: now,
          })
          .select('id')
          .single();
        if (softErr) {
          return NextResponse.json(
            { error: softErr.message || error.message, href: '/dashboard/projects/kanban-boards' },
            { status: 503 }
          );
        }
        return NextResponse.json({
          success: true,
          action: 'task',
          task_id: soft?.id,
          project_id: projectId,
          href: '/dashboard/projects/kanban-boards',
          message: `Task created${owner_name ? ` · owner ${owner_name}` : ''}${due_date ? ` · due ${due_date}` : ''}.`,
        });
      }
      return NextResponse.json({
        success: true,
        action: 'task',
        task_id: task?.id,
        project_id: projectId,
        href: '/dashboard/projects/kanban-boards',
        message: `Task created${owner_name ? ` · owner ${owner_name}` : ''}${due_date ? ` · due ${due_date}` : ''}.`,
      });
    }

    // Default: RIAD
    // Prefer project RIAD; fall back to supplier RIAD book-level entry
    let projectId: number | null = null;
    const { data: projects } = await supabase
      .from('pm_projects')
      .select('id')
      .eq('profile_id', companyId)
      .in('status', ['active', 'planning'])
      .order('updated_at', { ascending: false })
      .limit(1);
    if (projects?.[0]?.id) {
      projectId = projects[0].id;
    } else {
      const { data: created } = await supabase
        .from('pm_projects')
        .insert({
          profile_id: companyId,
          name: 'Intelligence actions',
          description: 'Auto-created from Intelligence insights',
          status: 'active',
          methodology: 'standard',
          created_by: mem.userId,
          updated_at: now,
        })
        .select('id')
        .single();
      projectId = created?.id ?? null;
    }

    if (projectId) {
      const riadType =
        domain === 'finance'
          ? 'action'
          : domain === 'quality'
            ? 'issue'
            : 'risk';
      const riadRow: Record<string, unknown> = {
        profile_id: companyId,
        project_id: projectId,
        title,
        riad_type: riadType,
        status: 'open',
        severity,
        description: [detail, href ? `Source: ${href}` : '']
          .filter(Boolean)
          .join('\n'),
        owner_name: owner_name || null,
        due_date: due_date || null,
        created_by: mem.userId,
        updated_at: now,
      };
      const { data: riad, error } = await supabase
        .from('pm_project_riads')
        .insert(riadRow)
        .select('id')
        .single();

      if (!error && riad) {
        return NextResponse.json({
          success: true,
          action: 'riad',
          riad_id: riad.id,
          project_id: projectId,
          href: '/dashboard/projects/risk-register',
          message: `RIAD logged${owner_name ? ` · ${owner_name}` : ''}${due_date ? ` · due ${due_date}` : ''}.`,
        });
      }
    }

    // Supplier RIAD fallback (no project FK required for book-level)
    const { data: srm } = await supabase
      .from('srm_suppliers')
      .select('id')
      .eq('profile_id', companyId)
      .limit(1);
    const supplierId = srm?.[0]?.id ?? null;

    const { data: sRiad, error: sErr } = await supabase
      .from('supplier_riad')
      .insert({
        profile_id: companyId,
        supplier_id: supplierId,
        title,
        entry_type: domain === 'finance' ? 'action' : 'risk',
        status: 'open',
        severity,
        description: detail || null,
        created_by: mem.userId,
      })
      .select('id')
      .single();

    if (sErr) {
      return NextResponse.json(
        {
          error: sErr.message,
          hint: PM_HINT,
          href: '/dashboard/suppliers/riad-log',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      action: 'riad',
      riad_id: sRiad?.id,
      href: '/dashboard/suppliers/riad-log',
      message: 'RIAD logged on supplier register.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
