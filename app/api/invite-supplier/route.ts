import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { randomUUID } from 'crypto';
import { getAppUrl, getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const resend = getResend();

  try {
    const body = await request.json();
    
    const {
      trading_name,
      contact_name,
      contact_email,
      invitedBy = 'SupplierAdvisor Team',
      category,
      contact_phone,
      website,
    } = body;

    if (!contact_email || !trading_name) {
      return NextResponse.json(
        { error: 'Trading name and contact email are required' },
        { status: 400 }
      );
    }

    // Generate unique invite token
    const inviteToken = randomUUID();

    // Create supplier record
    // TODO: Replace 'profiles' with your dedicated 'suppliers' table when ready
    const { data: newSupplier, error: insertError } = await supabase
      .from('profiles')
      .insert({
        trading_name,
        legal_name: trading_name,
        email: contact_email,
        contact_name,
        contact_phone,
        category,
        website,
        relationship_type: 'supplier',
        supplier_status: 'invited',
        invite_token: inviteToken,
        invited_by: invitedBy,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create supplier record' }, { status: 500 });
    }

    // Build personalized invite link
    const inviteLink = `${getAppUrl()}/onboarding?invite=${inviteToken}`;

    // Send beautiful branded email
    const { error: emailError } = await resend.emails.send({
      from: getResendFrom(),
        replyTo: getResendReplyTo(),
      to: contact_email,
      subject: `${invitedBy} has invited you to join SupplierAdvisor`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #00b4d8 0%, #0077b6 100%); padding: 40px 40px 30px; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">SupplierAdvisor</h1>
            <p style="margin: 8px 0 0; opacity: 0.9; font-size: 15px;">The Operating System for African Supply Chains</p>
          </div>

          <!-- Body -->
          <div style="padding: 40px 40px 20px;">
            <h2 style="color: #111827; font-size: 22px; margin: 0 0 16px;">You've been invited to join SupplierAdvisor</h2>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.7; margin: 0 0 20px;">
              Hello${contact_name ? ` ${contact_name}` : ''},<br><br>
              <strong>${invitedBy}</strong> has invited <strong>${trading_name}</strong> to join SupplierAdvisor as a verified supplier.
            </p>

            <p style="color: #374151; font-size: 16px; line-height: 1.7; margin: 0 0 32px;">
              SupplierAdvisor helps suppliers across Africa manage purchase orders, build reputation through verified performance, and connect with serious buyers.
            </p>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0 40px;">
              <a href="${inviteLink}" 
                 style="background-color: #00b4d8; color: white; padding: 16px 42px; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgb(0 180 216 / 0.25);">
                Complete Your Supplier Profile →
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
              This link will take you through a quick, guided onboarding process.
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">
            <p style="margin: 0 0 6px;">Invited by <strong>${invitedBy}</strong></p>
            <p style="margin: 0;">If you have any questions, simply reply to this email.</p>
          </div>

        </div>
      `,
    });

    if (emailError) {
      console.error('Resend error:', emailError);
      return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 });
    }

    // Optional company context for golden path (body.companyId / inviterProfileId)
    const companyId = Number(
      (body as { companyId?: number; inviterProfileId?: number }).companyId ||
        (body as { inviterProfileId?: number }).inviterProfileId
    );
    let goldenPath = { newlyMarked: [] as string[], progressPercent: 0 };
    if (Number.isFinite(companyId) && companyId > 0) {
      goldenPath = await import('@/lib/onboarding/checklist').then(
        ({ markOnboardingSteps }) =>
          markOnboardingSteps(companyId, 'invite_partners')
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      supplierId: newSupplier?.id,
      inviteToken,
      goldenPath,
    });

  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}