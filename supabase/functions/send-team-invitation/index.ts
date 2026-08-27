import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "SupplierAdvisor <hello@supplieradvisor.com>";

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

    const appUrl = (Deno.env.get("APP_URL") || Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://www.supplieradvisor.com").replace(/\/$/, "");
    // Prefer dedicated team claim path; also works with /onboarding?invite=&kind=team
    const inviteLink = `${appUrl}/onboarding/team?invite=${encodeURIComponent(token)}`;

    if (/^vuka(\s+fitness)?$/i.test(String(company_name || '').trim()) || /\bvuka\s+fitness\b/i.test(String(company_name || ''))) {
      return new Response(JSON.stringify({ success: true, skipped: 'vuka_testing' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to_email,
      subject: `Join ${company_name} on SupplierAdvisor — your join link inside`,
      text: [
        `Hello${to_name ? ` ${to_name}` : ""},`,
        "",
        `${inviter_name || "Your team"} invited you to join ${company_name} as ${role}.`,
        "",
        "Open this join link to accept (expires in 14 days):",
        inviteLink,
        "",
        "— SupplierAdvisor",
      ].join("\n"),
      html: `
        <div data-sa-email-chrome="1" style="font-family: system-ui, sans-serif; max-width: 620px; margin: 0 auto; padding: 40px;">
          <div style="text-align:center;margin-bottom:24px;">
            <img src="${appUrl}/sa-logo.png" alt="SupplierAdvisor" width="83" height="36" style="display:block;margin:0 auto 8px;width:83px;height:36px;max-width:180px;border:0;outline:none;" />
            <p style="margin:0;font-size:11px;letter-spacing:.18em;font-weight:800;text-transform:uppercase;color:#0077b6;">SupplierAdvisor®</p>
            <p style="margin:8px 0 0;font-size:18px;font-weight:800;color:#0f172a;">${company_name}</p>
          </div>
          <h2>Hello ${to_name || ""},</h2>
          <p><strong>${inviter_name || "Your team"}</strong> invited you to join <strong>${company_name}</strong> as <strong>${role}</strong>.</p>
          <p>Click below to accept and complete your profile on the platform:</p>
          <p style="text-align:center;margin:28px 0;">
            <a href="${inviteLink}" style="background:#14b8a6;color:white;padding:16px 40px;text-decoration:none;border-radius:9999px;font-weight:600;display:inline-block;">Accept invitation &amp; join →</a>
          </p>
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:14px 16px;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:0.06em;">Your join link</p>
            <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${inviteLink}" style="color:#0077b6;">${inviteLink}</a></p>
          </div>
          <p style="margin-top:24px;color:#666;font-size:14px;">Link expires in 14 days. Sign in with this email address.</p>
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