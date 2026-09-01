import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "SupplierAdvisor <team@supplieradvisor.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to_email, to_name, company_name = "Your Company", role = "Team Member", inviter_name, token } = await req.json();

    if (!to_email || !token) {
      return new Response(JSON.stringify({ error: "Missing to_email or token" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const inviteLink = `https://supplieradvisor-mvp.vercel.app/onboarding?token=${token}`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to_email,
      subject: `You've been invited to join ${company_name} on SupplierAdvisor`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 620px; margin: 0 auto; padding: 40px;">
          <h2>Hello ${to_name},</h2>
          <p><strong>${inviter_name}</strong> invited you to join <strong>${company_name}</strong> as <strong>${role}</strong>.</p>
          <p>Click below to accept and complete your profile on the platform:</p>
          <a href="${inviteLink}" style="background:#14b8a6;color:white;padding:16px 40px;text-decoration:none;border-radius:9999px;font-weight:600;display:inline-block;">Accept Invitation →</a>
          <p style="margin-top:30px;color:#666;font-size:14px;">Link expires in 7 days.</p>
        </div>
      `,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" }, 
      status: 200 
    });

  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" }, 
      status: 500 
    });
  }
});