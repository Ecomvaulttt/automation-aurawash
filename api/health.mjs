import { createServiceClient } from "../server/supabase-admin.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") return response.status(405).json({ ok: false, status: "method_not_allowed" });
  const required = ["VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TOKEN_ENCRYPTION_KEY", "CRON_SECRET"];
  if (required.some((name) => !process.env[name])) return response.status(503).json({ ok: false, status: "configuration_incomplete" });
  try {
    const { error } = await createServiceClient().from("organizations").select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw error;
    return response.status(200).json({ ok: true, status: "healthy", time: new Date().toISOString() });
  } catch {
    return response.status(503).json({ ok: false, status: "database_unavailable" });
  }
}
