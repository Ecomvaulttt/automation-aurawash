import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { platformConfig } from "./config";

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!platformConfig.configured) return null;

  if (!browserClient) {
    browserClient = createClient(
      platformConfig.supabaseUrl,
      platformConfig.supabasePublishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
  }

  return browserClient;
}
