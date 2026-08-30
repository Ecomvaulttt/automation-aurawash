export type PlatformConfig = {
  mode: "demo" | "production";
  configured: boolean;
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export function readPlatformConfig(env: Record<string, string | undefined>): PlatformConfig {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() ?? "";
  const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  const configured = Boolean(supabaseUrl && supabasePublishableKey);

  return {
    mode: configured ? "production" : "demo",
    configured,
    supabaseUrl,
    supabasePublishableKey,
  };
}

export const platformConfig = readPlatformConfig(import.meta.env);
