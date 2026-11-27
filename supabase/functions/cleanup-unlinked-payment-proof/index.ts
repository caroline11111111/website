import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin || "null",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const json = (body: Record<string, unknown>, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Authentication required" }, 401, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Server configuration is incomplete" }, 500, origin);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: "Invalid session" }, 401, origin);

  let path: unknown;
  try {
    const body = await req.json();
    path = body?.path;
  } catch {
    return json({ error: "Invalid request body" }, 400, origin);
  }
  if (typeof path !== "string") return json({ error: "Invalid storage path" }, 400, origin);

  const safeUserId = user.id.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
  const allowedPath = new RegExp(`^${safeUserId}/[0-9a-fA-F-]{36}\\\\.(jpg|png|pdf)$`);
  if (!allowedPath.test(path)) return json({ error: "Storage path is not owned by this user" }, 403, origin);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: linkedProofs, error: lookupError } = await admin
    .from("payment_proofs")
    .select("id")
    .eq("storage_path", path)
    .limit(1);
  if (lookupError) return json({ error: "Could not verify payment proof references" }, 500, origin);

  if (linkedProofs && linkedProofs.length > 0) {
    return json({ deleted: false, reason: "payment_proof_is_linked" }, 200, origin);
  }

  const { error: removeError } = await admin.storage.from("payment-proofs").remove([path]);
  if (removeError) return json({ error: "Could not remove unlinked payment proof" }, 500, origin);
  return json({ deleted: true }, 200, origin);
});
