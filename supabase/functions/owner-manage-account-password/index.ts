import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return respond({ error: "Authentication required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return respond({ error: "The secure account-management service is not configured." }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return respond({ error: "Your session is invalid. Please sign in again." }, 401);

  const { data: access, error: accessError } = await userClient.rpc("get_my_admin_access");
  if (accessError || access?.is_owner !== true) {
    return respond({ error: "Only the Owner account can manage account passwords." }, 403);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid request body." }, 400);
  }

  if (body.action === "list_accounts") {
    const { data: adminRows, error: adminRowsError } = await adminClient
      .from("admin_users")
      .select("user_id,is_active");
    if (adminRowsError) return respond({ error: "Could not load account roles." }, 500);

    const adminMap = new Map((adminRows || []).map((row: { user_id: string; is_active: boolean }) => [row.user_id, row.is_active]));
    const accounts: Array<{ user_id: string; email: string; account_type: "admin" | "client"; is_active: boolean | null }> = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
      if (error) return respond({ error: "Could not load Auth accounts." }, 500);
      for (const user of data.users) {
        if (!user.email) continue;
        const isAdmin = adminMap.has(user.id);
        accounts.push({
          user_id: user.id,
          email: user.email,
          account_type: isAdmin ? "admin" : "client",
          is_active: isAdmin ? Boolean(adminMap.get(user.id)) : null,
        });
      }
      if (data.users.length < 100) break;
    }
    accounts.sort((a, b) => a.email.localeCompare(b.email));
    return respond({ accounts });
  }

  if (body.action !== "reset_password") return respond({ error: "Unsupported action." }, 400);

  const targetUserId = typeof body.target_user_id === "string" ? body.target_user_id : "";
  const newPassword = typeof body.new_password === "string" ? body.new_password : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
    return respond({ error: "Select a valid account." }, 400);
  }
  if (newPassword.length < 12 || newPassword.length > 128) {
    return respond({ error: "The new password must contain 12 to 128 characters." }, 400);
  }

  const { data: targetAdmin, error: targetAdminError } = await adminClient
    .from("admin_users")
    .select("id,user_id,is_active")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (targetAdminError) return respond({ error: "Could not verify the target account type." }, 500);

  const requestedType = body.account_type;
  if (requestedType !== "admin" && requestedType !== "client") {
    return respond({ error: "Invalid account type." }, 400);
  }
  if ((requestedType === "admin") !== Boolean(targetAdmin)) {
    return respond({ error: "The selected account type does not match the account record. Refresh and try again." }, 409);
  }

  const { data: targetData, error: targetError } = await adminClient.auth.admin.getUserById(targetUserId);
  if (targetError || !targetData.user?.email) return respond({ error: "The selected account could not be found." }, 404);

  const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, { password: newPassword });
  if (updateError) return respond({ error: "Password could not be updated. " + updateError.message, }, 400);

  const { error: auditError } = await adminClient.from("admin_audit_logs").insert({
    admin_user_id: targetAdmin?.id || null,
    actor_user_id: authData.user.id,
    action: "account.password.overwrite",
    target_type: requestedType === "admin" ? "admin_account" : "client_account",
    target_id: targetUserId,
    old_values: { email: targetData.user.email },
    new_values: { password_changed: true },
    reason: "Owner directly overwrote the account password",
  });

  return respond({
    success: true,
    email: targetData.user.email,
    audit_logged: !auditError,
    warning: auditError ? "The password was updated, but the audit record could not be saved. Please check Admin Audit Logs." : null,
  });
});
