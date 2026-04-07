// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.1.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.supplieradvisor.com",   // ← exact production domain
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to_email, to_name, company_name, role, inviter_name } = await req.json();

    const emailHtml = `
      <h2>Welcome to SupplierAdvisor®</h2>
      <p>Hi ${to_name},</p>
      <p><strong>${inviter_name}</strong> from <strong>${company_name}</strong> has invited you to join the verified B2B supply-chain network.</p>
      <p>Connect instantly, share certificates, raise POs, and trade with full transparency and trust.</p>
      <a href="https://www.supplieradvisor.com/onboarding" style="background:#00b4d8;color:white;padding:16px 32px;border-radius:9999px;text-decoration:none;display:inline-block;margin:20px 0;">
        Accept Invitation &amp; Verify Your Business
      </a>
      <p>Best regards,<br>The SupplierAdvisor Team</p>
    `;

    await resend.emails.send({
      from: "SupplierAdvisor <no-reply@supplieradvisor.com>",
      to: to_email,
      subject: `Invitation to join SupplierAdvisor from ${company_name}`,
      html: emailHtml,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Invitation email sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge Function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});