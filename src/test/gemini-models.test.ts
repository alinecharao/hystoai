import { describe, expect, it } from "vitest";
import { DEFAULT_GEMINI_MODELS, getGeminiModelCandidates, isGeminiModelUnavailableError } from "@/lib/ai/gemini-models";

describe("Gemini fallback model selection", () => {
  it("includes only documented stable Flash text models by default", () => {
    expect(getGeminiModelCandidates()).toEqual([
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
    ]);
    expect(DEFAULT_GEMINI_MODELS).not.toContain("gemini-3.5-flash");
  });

  it("allows explicit model priority without duplicate attempts", () => {
    expect(getGeminiModelCandidates("gemini-3.1-flash-lite", "gemini-3.6-flash, gemini-3.1-pro-preview, gemini-3.6-flash")).toEqual([
      "gemini-3.1-flash-lite",
      "gemini-3.6-flash",
      "gemini-3.1-pro-preview",
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite",
    ]);
  });

  it("ignores empty and malformed configuration entries", () => {
    expect(getGeminiModelCandidates("", " , not-a-model, gemini-3.5-flash-lite,\ngemini-3.8-flash ")).toEqual([
      "gemini-3.5-flash-lite",
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3.1-flash-lite",
    ]);
  });
});

describe("Gemini model unavailable fallback", () => {
  it("retries a known missing-model HTTP 400", () => {
    expect(isGeminiModelUnavailableError(400, '{"error":{"message":"models/gemini-3.8-flash is not found for API version v1beta"}}')).toBe(true);
    expect(isGeminiModelUnavailableError(400, "The model is not available in this project")).toBe(true);
  });

  it("does not retry a generic bad request or a safety error", () => {
    expect(isGeminiModelUnavailableError(400, "Bad Request: Invalid JSON payload")).toBe(false);
    expect(isGeminiModelUnavailableError(400, "Content blocked by safety")).toBe(false);
    expect(isGeminiModelUnavailableError(400, "Invalid API key")).toBe(false);
    expect(isGeminiModelUnavailableError(403, "Model not available")).toBe(false);
  });
});
