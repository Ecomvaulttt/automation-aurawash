import { createHash, timingSafeEqual } from "node:crypto";
import { createServiceClient, safeApiError } from "../../server/supabase-admin.mjs";
import { runPlatformAutomation } from "../../server/platform-automation.mjs";

export function secretMatches(received, expected) {
  if (!received || !expected) return false;
  const digest = (value) => createHash("sha256").update(String(value)).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(request.method)) return safeApiError(response, 405, "method_not_allowed");
  const token = String(request.headers?.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!secretMatches(token, process.env.CRON_SECRET)) return safeApiError(response, 401, "invalid_cron_secret");
  try {
    const result = await runPlatformAutomation(createServiceClient(), { sinceDays: Number(process.env.INBOX_SINCE_DAYS || 45) });
    return response.status(result.failures ? 207 : 200).json({ ok: result.failures === 0, ...result });
  } catch {
    return safeApiError(response, 500, "automation_run_failed");
  }
}
