import { describe, expect, it } from "vitest";
import { readPlatformConfig } from "./config";

describe("readPlatformConfig", () => {
  it("uses demo mode when public Supabase values are absent", () => {
    expect(readPlatformConfig({})).toMatchObject({ mode: "demo", configured: false });
  });

  it("uses production mode only when both public values exist", () => {
    expect(
      readPlatformConfig({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toMatchObject({ mode: "production", configured: true });
  });

  it("does not activate production with a partial configuration", () => {
    expect(readPlatformConfig({ VITE_SUPABASE_URL: "https://example.supabase.co" }).configured).toBe(false);
  });
});
