import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, name, email, role, companyName, invitedBy } = body;

    if (!email || !companyId) {
      return NextResponse.json({ 
        error: 'Email and companyId are required' 
      }, { status: 400 });
    }

    const token = randomUUID();

    // Insert into business_users
    const { error: insertError } = await supabaseAdmin
      .from('business_users')
      .insert({
        profile_id: String(companyId),
        name: name || null,                    // ← FIX: allow null for invitations
        invited_email: email.toLowerCase(),
        role: role || 'member',
        status: 'invited',
        invited_by: invitedBy || null,
        invite_token: token,
      });

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      return NextResponse.json({ 
        error: 'Failed to create invitation',
        details: insertError.message,
        code: insertError.code
      }, { status: 500 });
    }

    const inviteLink = `https://supplieradvisor-mvp.vercel.app/onboarding?invite=${token}`;

    // Send invitation email
    const { error: emailError } = await resend.emails.send({
      from: 'Big Five Foods <onboarding@resend.dev>',
      to: email,
      subject: `You've been invited to join ${companyName} on SupplierAdvisor`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You've been invited to join <strong>${companyName}</strong></h2>
          <p>Hello ${name || ''},</p>
          <p>You have been invited to join <strong>${companyName}</strong> as a <strong>${role || 'team member'}</strong> on SupplierAdvisor.</p>
          <p>Click the button below to accept the invitation and create your account:</p>
          <a href="${inviteLink}" style="background: #00b4d8; color: white; padding: 14px 32px; border-radius: 9999px; text-decoration: none; display: inline-block; margin: 20px 0;">
            Accept Invitation →
          </a>
          <p style="color: #666; font-size: 13px;">This invitation will expire in 7 days.</p>
        </div>
      `,
    });

    if (emailError) {
      console.error('Email error:', emailError);
      // Invitation record was created successfully, so we still return success
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Invitation sent successfully' 
    });

  } catch (error: any) {
    console.error('Team invite error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}