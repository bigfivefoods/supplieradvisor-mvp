/**
 * Advisor workforce: desk + employed staff (B2B) and contractors (B2C PWA).
 * GET  ?companyId=&module=
 * POST { companyId, module, action, ... }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  sendTeamWorkspaceInvite,
  revokeTeamWorkspaceInvite,
} from '@/lib/invites/send-team-invite';
import { issueCoachPortalToken } from '@/lib/fitness/fitgraph';
import { issueClinicianPortalToken } from '@/lib/services/clinician-portal';
import { loadAdvisorWorkforce } from '@/lib/services/advisor-workforce-store';
import {
  accessLaneForEngagement,
  advisorWorkforceLabel,
  buildAdvisorStaffTodayPath,
  advisorWorkInviteShareText,
  buildAdvisorWorkJoinLink,
  buildAdvisorWorkPortalPath,
  isAdvisorWorkforceModule,
  issueAdvisorWorkInviteToken,
  resolveAdvisorEngagement,
  sendContractorWorkInviteEmail,
  type AdvisorWorkforceModule,
} from '@/lib/services/advisor-workforce';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function roleLabel(module: AdvisorWorkforceModule, kind: 'desk' | 'staff' | 'contractor') {
  if (kind === 'desk') return 'Front desk';
  if (kind === 'staff') return 'Staff';
  if (module === 'fitgraph') return 'Coach';
  if (module === 'dentalgraph') return 'Clinician';
  return 'Practitioner';
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const moduleRaw = String(request.nextUrl.searchParams.get('module') || '');
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (!isAdvisorWorkforceModule(moduleRaw)) {
      return NextResponse.json({ error: 'Unknown Advisor module' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const bundle = await loadAdvisorWorkforce(companyId, moduleRaw);
    if (!bundle) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      module: moduleRaw,
      brand: bundle.brand,
      desk: {
        has_front_desk: bundle.settings.has_front_desk !== false,
        name: bundle.settings.desk_name || '',
        email: bundle.settings.desk_email || '',
        invite_status: bundle.settings.desk_invite_status || 'none',
        invite_sent_at: bundle.settings.desk_invite_sent_at || null,
        last_invited_email: bundle.settings.desk_last_invited_email || null,
      },
      people: bundle.people.map((p) => {
        const engagement = resolveAdvisorEngagement(p);
        return {
          id: p.id,
          name: p.name,
          email: p.email || '',
          engagement,
          lane: accessLaneForEngagement(engagement),
          invite_status: p.work_invite_status || 'none',
          invite_email: p.work_invite_email || null,
          invite_sent_at: p.work_invite_sent_at || null,
          portal_token: p.portal_token || null,
          portal_path: p.portal_token
            ? buildAdvisorWorkPortalPath(moduleRaw, p.portal_token)
            : null,
          staff_today_path: p.portal_token
            ? buildAdvisorStaffTodayPath(moduleRaw, p.portal_token)
            : null,
          active: p.active !== false,
        };
      }),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const moduleRaw = String(body.module || '');
    const action = String(body.action || '');
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (!isAdvisorWorkforceModule(moduleRaw)) {
      return NextResponse.json({ error: 'Unknown Advisor module' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const bundle = await loadAdvisorWorkforce(companyId, moduleRaw);
    if (!bundle) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const inviterName = String(body.inviterName || '').trim() || 'The owner';

    if (action === 'save_desk') {
      const email = body.email != null ? String(body.email).trim().toLowerCase() : undefined;
      bundle.applyDesk({
        has_front_desk:
          body.has_front_desk !== undefined
            ? body.has_front_desk !== false
            : bundle.settings.has_front_desk,
        desk_name:
          body.name != null ? String(body.name).trim() : bundle.settings.desk_name,
        desk_email:
          email !== undefined ? email || null : bundle.settings.desk_email,
      });
      await bundle.persist();
      return NextResponse.json({ success: true, message: 'Desk details saved' });
    }

    if (action === 'invite_desk' || action === 'resend_desk') {
      const email = String(
        body.email || bundle.settings.desk_email || ''
      )
        .trim()
        .toLowerCase();
      if (!email.includes('@')) {
        return NextResponse.json(
          { error: 'Add a desk email first' },
          { status: 400 }
        );
      }
      const prevEmail = String(
        bundle.settings.desk_last_invited_email ||
          bundle.settings.desk_email ||
          ''
      ).toLowerCase();
      if (prevEmail && prevEmail !== email) {
        await revokeTeamWorkspaceInvite({
          companyId,
          memberId: bundle.settings.desk_team_member_id,
          email: prevEmail,
        });
      }
      const invited = await sendTeamWorkspaceInvite({
        companyId,
        email,
        name: String(body.name || bundle.settings.desk_name || 'Front desk'),
        role: 'operations',
        inviterUserId: gate.userId,
        inviterName,
        companyName: bundle.brand,
        roleLabel: 'Front desk',
      });
      if (!invited.ok) {
        return NextResponse.json(
          { error: invited.error },
          { status: invited.status }
        );
      }
      const now = new Date().toISOString();
      bundle.applyDesk({
        has_front_desk: true,
        desk_name: String(body.name || bundle.settings.desk_name || 'Front desk'),
        desk_email: email,
        desk_invite_status: invited.warning?.includes('already an active')
          ? 'accepted'
          : 'pending',
        desk_invite_sent_at: now,
        desk_last_invited_email: email,
        desk_team_member_id: invited.memberId,
        desk_invite_accepted_at: invited.warning?.includes('already an active')
          ? now
          : null,
      });
      await bundle.persist();
      return NextResponse.json({
        success: true,
        invite_link: invited.inviteLink,
        email_sent: invited.emailSent,
        warning: invited.warning,
        message: invited.emailSent
          ? `Desk invitation sent to ${email}`
          : invited.warning || 'Desk invitation saved',
      });
    }

    if (action === 'revoke_desk') {
      await revokeTeamWorkspaceInvite({
        companyId,
        memberId: bundle.settings.desk_team_member_id,
        email: bundle.settings.desk_last_invited_email || bundle.settings.desk_email,
      });
      bundle.applyDesk({
        desk_invite_status: 'revoked',
        desk_team_member_id: null,
      });
      await bundle.persist();
      return NextResponse.json({
        success: true,
        message: 'Desk invitation revoked',
      });
    }

    if (
      action === 'invite_person' ||
      action === 'resend_person' ||
      action === 'share_person' ||
      action === 'revoke_person' ||
      action === 'set_engagement'
    ) {
      const personId = String(body.person_id || body.id || '');
      const person = bundle.people.find((p) => p.id === personId);
      if (!person) {
        return NextResponse.json({ error: 'Person not found' }, { status: 404 });
      }

      if (action === 'set_engagement') {
        const engagement =
          String(body.engagement || '') === 'employed'
            ? 'employed'
            : 'contractor';
        if (person.work_team_member_id) {
          await revokeTeamWorkspaceInvite({
            companyId,
            memberId: person.work_team_member_id,
            email: person.work_invite_email || person.email,
          });
        }
        bundle.applyPerson(personId, {
          engagement,
          work_team_member_id: null,
        });
        await bundle.persist();
        return NextResponse.json({
          success: true,
          engagement,
          lane: accessLaneForEngagement(engagement),
          message:
            engagement === 'employed'
              ? 'Marked employed — they stay on the work app. Payroll and leave stay in People. Only the owner opens SupplierAdvisor.'
              : 'Marked contractor — they use the work app for diary and clients.',
        });
      }

      if (action === 'revoke_person') {
        await revokeTeamWorkspaceInvite({
          companyId,
          memberId: person.work_team_member_id,
          email: person.work_invite_email || person.email,
        });
        bundle.applyPerson(personId, {
          work_invite_status: 'revoked',
          work_invite_token: null,
          work_team_member_id: null,
        });
        await bundle.persist();
        return NextResponse.json({
          success: true,
          message: 'Invitation revoked',
        });
      }

      const email = String(body.email || person.email || '')
        .trim()
        .toLowerCase();
      const shareOnly = action === 'share_person';
      const engagement = resolveAdvisorEngagement({
        ...person,
        engagement: body.engagement || person.engagement,
      });
      const now = new Date().toISOString();

      if (!email.includes('@') && !(shareOnly && accessLaneForEngagement(engagement) === 'b2c')) {
        return NextResponse.json(
          { error: 'Add an email on this person first' },
          { status: 400 }
        );
      }

      if (person.work_team_member_id) {
        await revokeTeamWorkspaceInvite({
          companyId,
          memberId: person.work_team_member_id,
          email: person.work_invite_email || person.email || email,
        });
      }

      const token = issueAdvisorWorkInviteToken(moduleRaw, companyId);
      let portalToken = person.portal_token || null;
      if (!portalToken) {
        portalToken =
          moduleRaw === 'fitgraph'
            ? issueCoachPortalToken(companyId)
            : issueClinicianPortalToken(
                companyId,
                moduleRaw as
                  | 'physiograph'
                  | 'dentalgraph'
                  | 'medicalgraph'
                  | 'psychiatrygraph'
                  | 'vetgraph'
              );
      }
      const joinLink = buildAdvisorWorkJoinLink(moduleRaw, token);
      const inviteRole = roleLabel(
        moduleRaw,
        engagement === 'employed' ? 'staff' : 'contractor'
      );
      let mailed: { sent: boolean; warning?: string } = {
        sent: false,
      };
      if (!shareOnly && email.includes('@')) {
        mailed = await sendContractorWorkInviteEmail({
          to: email,
          inviteeName: person.name,
          businessName: bundle.brand,
          invitedBy: inviterName,
          inviteLink: joinLink,
          module: moduleRaw,
          roleLabel: inviteRole,
        });
      }
      bundle.applyPerson(personId, {
        engagement,
        email: email.includes('@') ? email : person.email,
        portal_token: portalToken,
        work_invite_token: token,
        work_invite_email: email.includes('@') ? email : person.work_invite_email,
        work_invite_status: 'pending',
        work_invite_sent_at: now,
        work_team_member_id: null,
      });
      await bundle.persist();
      return NextResponse.json({
        success: true,
        lane: 'b2c',
        invite_link: joinLink,
        share_text: advisorWorkInviteShareText({
          personName: person.name,
          businessName: bundle.brand,
          inviteLink: joinLink,
          lane: 'b2c',
          roleLabel: inviteRole,
        }),
        portal_path: buildAdvisorWorkPortalPath(moduleRaw, portalToken),
        email_sent: mailed.sent,
        warning: mailed.warning,
        message: shareOnly
          ? 'Work app invite link ready to share'
          : mailed.sent
            ? `Work app invitation sent to ${email}`
            : mailed.warning || 'Work app invitation saved',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    console.error('[advisors/workforce]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
