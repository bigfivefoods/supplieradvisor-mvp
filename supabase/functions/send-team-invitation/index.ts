import { serve } from "std/http/server.ts";
import { Resend } from "resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "SupplierAdvisor <noreply@supplieradvisor.com>";

serve(async (req) => {
  try {
    const { 
      to_email, 
      to_name, 
      company_name, 
      role, 
      inviter_name,
      token                    // ← New: secure invitation token
    } = await req.json();

    if (!to_email || !to_name || !token) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const inviteLink = `https://www.supplieradvisor.com/invite?token=${token}`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to_email],
      subject: `You've been invited to join ${company_name} on SupplierAdvisor`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Hello ${to_name},</h2>
          
          <p><strong>${inviter_name}</strong> has invited you to join <strong>${company_name}</strong> on SupplierAdvisor® as a <strong>${role}</strong>.</p>
          
          <p>SupplierAdvisor is the platform for verified, transparent, and ethical supply chains across Africa.</p>
          
          <div style="margin: 32px 0; text-align: center;">
            <a href="${inviteLink}" 
               style="background-color: #00b4d8; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
              Accept Invitation & Join Company
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            This invitation link will expire in 7 days. If you already have an account, you can also log in and accept the invitation from your dashboard.
          </p>

          <p style="margin-top: 40px; color: #374151;">
            Best regards,<br>
            <strong>The SupplierAdvisor Team</strong>
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});