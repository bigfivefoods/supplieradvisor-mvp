import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

// Use SERVICE ROLE key for server-side inserts (more reliable)
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

    const inviteToken = randomUUID();

    // Insert into profiles table
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
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('=== SUPABASE INSERT ERROR ===');
      console.error(insertError);
      return NextResponse.json({ 
        error: 'Failed to create supplier record', 
        details: insertError.message,
        code: insertError.code 
      }, { status: 500 });
    }

    // Send email
    const inviteLink = `https://supplieradvisor-mvp.vercel.app/onboarding?invite=${inviteToken}`;

    const { error: emailError } = await resend.emails.send({
      from: 'SupplierAdvisor <invites@supplieradvisor.co.za>',
      to: contact_email,
      subject: `${invitedBy} has invited you to join SupplierAdvisor`,
      html: `... same beautiful email template as before ...`,
    });

    if (emailError) {
      console.error('Resend error:', emailError);
      return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 });
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