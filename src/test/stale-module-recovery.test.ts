import { describe, expect, it } from "vitest";
import { canAttemptModuleReload, isStaleModuleImportFailure } from "@/lib/stale-module-recovery";

describe("Lovable preview route module recovery", () => {
  it("recognizes the dynamic-import error shown by the Preview", () => {
    expect(isStaleModuleImportFailure(new TypeError(
      "Failed to fetch dynamically imported module: https://preview/src/routes/_authenticated/chat.$id.tsx?tsr-split=component",
    ))).toBe(true);
    expect(isStaleModuleImportFailure("Importing a module script failed.")).toBe(true);
  });

  it("does not reload the chat for provider or authentication failures", () => {
    expect(isStaleModuleImportFailure(new Error("Gemini: Bad Request"))).toBe(false);
    expect(isStaleModuleImportFailure(new Error("Supabase connection failed"))).toBe(false);
    expect(isStaleModuleImportFailure(null)).toBe(false);
  });

  it("throttles attempts to a single reload per five-minute period", () => {
    const now = 1_800_000_000_000;
    expect(canAttemptModuleReload(null, now)).toBe(true);
    expect(canAttemptModuleReload(String(now - 2_000), now)).toBe(false);
    expect(canAttemptModuleReload(String(now - 300_000), now)).toBe(true);
  });
});
