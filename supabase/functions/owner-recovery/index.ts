import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const secret = typeof body.secret === "string" ? body.secret : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (secret.length < 16 || newPassword.length < 12) {
      return new Response(JSON.stringify({ error: "A valid recovery secret and a new password of at least 12 characters are required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Recovery service is not configured");

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: ownerId, error: verifyError } = await admin.rpc("owner_recovery_verify_secret", {
      p_secret: secret,
    });
    if (verifyError || !ownerId) {
      return new Response(JSON.stringify({ error: "Recovery verification failed. Check the secret or try again later." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(ownerId, {
      password: newPassword,
    });
    if (updateError) {
      return new Response(JSON.stringify({ error: "Password could not be reset. Contact the system administrator." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: auditError } = await admin.rpc("owner_recovery_log_password_reset", {
      p_user_id: ownerId,
    });
    if (auditError) throw auditError;

    return new Response(JSON.stringify({ success: true, message: "Owner password reset. Sign in using the new password." }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Recovery service could not complete the request." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
