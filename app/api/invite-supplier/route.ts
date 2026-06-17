import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabase } from '@/lib/supabase';
import { randomUUID } from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email, invitedBy = 'SupplierAdvisor Team' } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate unique invite token
    const inviteToken = randomUUID();

    // 1. Create pending supplier record with invite token
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        email: email,
        legal_name: 'Pending Supplier',
        relationship_type: 'supplier',
        supplier_status: 'pending',
        invite_token: inviteToken,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create supplier record' }, { status: 500 });
    }

    // 2. Build branded invitation email
    const inviteLink = `https://supplieradvisor-mvp.vercel.app/onboarding?invite=${inviteToken}`;

    const { error: emailError } = await resend.emails.send({
      from: 'SupplierAdvisor <invites@supplieradvisor.co.za>', // ← Update with your verified domain
      to: email,
      subject: 'You’ve been invited to join SupplierAdvisor',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #00b4d8 0%, #0077b6 100%); padding: 40px 40px 30px; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">SupplierAdvisor</h1>
            <p style="margin: 8px 0 0; opacity: 0.9; font-size: 15px;">The Operating System for African Supply Chains</p>
          </div>

          <!-- Body -->
          <div style="padding: 40px;">
            <h2 style="color: #111827; font-size: 22px; margin: 0 0 16px;">You've been invited</h2>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
              Hello,<br><br>
              You have been invited to join <strong>SupplierAdvisor</strong> as a verified supplier.
            </p>

            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 32px;">
              SupplierAdvisor helps trusted suppliers connect with buyers across Africa, manage purchase orders, and build a strong reputation through verified performance.
            </p>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${inviteLink}" 
                 style="background-color: #00b4d8; color: white; padding: 16px 36px; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgb(0 180 216 / 0.2);">
                Complete Your Supplier Profile →
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
              This link will take you through a quick onboarding process.
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">
            <p style="margin: 0 0 8px;">Invited by <strong>${invitedBy}</strong></p>
            <p style="margin: 0;">If you have any questions, simply reply to this email.</p>
          </div>

        </div>
      `,
    });

    if (emailError) {
      console.error('Resend error:', emailError);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Invitation sent successfully',
      profileId: newProfile?.id,
      inviteToken 
    });

  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}