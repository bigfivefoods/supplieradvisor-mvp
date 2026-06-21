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

    const {
      trading_name,
      contact_name,
      contact_email,
      invitedBy = 'Big Five Foods',
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

    const inviteToken = randomUUID();

    const { data: newSupplier, error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        trading_name,
        legal_name: trading_name,
        email: contact_email,
        contact_name: contact_name || null,
        contact_phone: contact_phone || null,
        category: category || null,
        website: website || null,
        relationship_type: 'supplier',
        supplier_status: 'invited',
        invite_token: inviteToken,
        invited_by: invitedBy,
        invited_at: new Date().toISOString(),           // ← Added
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return NextResponse.json({ 
        error: 'Failed to create supplier record', 
        details: insertError.message 
      }, { status: 500 });
    }

    const inviteLink = `https://supplieradvisor-mvp.vercel.app/onboarding?invite=${inviteToken}`;

    const { error: emailError } = await resend.emails.send({
      from: 'Big Five Foods <onboarding@resend.dev>',
      to: contact_email,
      subject: `${invitedBy} has invited you to join SupplierAdvisor`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: linear-gradient(135deg, #00b4d8 0%, #0077b6 100%); padding: 40px 40px 30px; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">SupplierAdvisor</h1>
            <p style="margin: 8px 0 0; opacity: 0.9; font-size: 15px;">The Operating System for African Supply Chains</p>
          </div>
          <div style="padding: 40px 40px 20px;">
            <h2 style="color: #111827; font-size: 22px; margin: 0 0 16px;">You've been invited to join SupplierAdvisor</h2>
            <p style="color: #374151; font-size: 16px; line-height: 1.7; margin: 0 0 24px;">
              Hello${contact_name ? ` ${contact_name}` : ''},<br><br>
              <strong>${invitedBy}</strong> has invited <strong>${trading_name}</strong> to join SupplierAdvisor as a verified supplier.
            </p>
            <div style="text-align: center; margin: 32px 0 40px;">
              <a href="${inviteLink}" 
                 style="background-color: #00b4d8; color: white; padding: 16px 42px; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                Complete Your Supplier Profile →
              </a>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">
            <p style="margin: 0 0 6px;">Invited by <strong>${invitedBy}</strong></p>
            <p style="margin: 0;">If you have any questions, simply reply to this email.</p>
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error('Resend error:', emailError);
      return NextResponse.json({ 
        error: 'Failed to send invitation email', 
        details: emailError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      supplierId: newSupplier?.id,
      inviteToken,
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}