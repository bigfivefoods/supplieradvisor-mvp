import { serve } from "std/http/server.ts";
import { Resend } from "resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "SupplierAdvisor <noreply@supplieradvisor.com>";

serve(async (req) => {
  try {
    const { to_email, to_name, company_name, role, inviter_name } = await req.json();

    if (!to_email || !to_name) {
      return new Response(JSON.stringify({ error: "Missing required fields: to_email or to_name" }), { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to_email],
      subject: `You've been invited to join ${company_name} on SupplierAdvisor`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #111827;">Hello ${to_name},</h2>
          
          <p style="color: #374151; line-height: 1.6;">
            <strong>${inviter_name}</strong> has invited you to join 
            <strong>${company_name}</strong> on <strong>SupplierAdvisor®</strong> as a <strong>${role}</strong>.
          </p>
          
          <p style="color: #374151; line-height: 1.6;">
            SupplierAdvisor is the platform for verified, transparent, and ethical supply chains across Africa.
          </p>
          
          <div style="margin: 32px 0;">
            <a href="https://www.supplieradvisor.com" 
               style="background-color: #00b4d8; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
              Accept Invitation & Get Started
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            If you have any questions, feel free to reply to this email.
          </p>
          
          <p style="color: #374151; margin-top: 32px;">
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