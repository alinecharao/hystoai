import { describe, expect, it } from "vitest";
import {
  buildSupportingCastPolicy, DEFAULT_SUPPORTING_CAST_MODE,
  parseSupportingCastMode, supportingCastStorageKey, SUPPORTING_CAST_LABELS,
} from "@/lib/supporting-cast";

describe("supporting cast dialogue controls", () => {
  it("defaults to balanced and accepts only known modes", () => {
    expect(DEFAULT_SUPPORTING_CAST_MODE).toBe("balanced");
    expect(parseSupportingCastMode(undefined)).toBe("balanced");
    expect(parseSupportingCastMode(null)).toBe("balanced");
    expect(parseSupportingCastMode("participative")).toBe("participative");
    expect(parseSupportingCastMode("discreet")).toBe("discreet");
    expect(parseSupportingCastMode("unlimited")).toBe("balanced");
    expect(SUPPORTING_CAST_LABELS.balanced).toBe("Equilibrada");
  });

  it("applies secondary dialogue without inventing characters or speaking for the user", () => {
    const prompt=buildSupportingCastPolicy("participative");
    expect(prompt).toContain('mode="participative"');
    expect(prompt).toContain("ESTABELECIDA");
    expect(prompt).toContain("NÃO acrescente terceiros");
    expect(prompt).toContain("NUNCA escreva");
    expect(prompt).toContain("não iniciar vários acontecimentos");
    expect(prompt).toContain("conversar com o protagonista");
  });

  it("preserves labels and does not confuse internal thoughts with audible dialogue", () => {
    const prompt=buildSupportingCastPolicy("balanced");
    expect(prompt).toContain("quem fala".toUpperCase());
    expect(prompt).toContain("aspas para falas");
    expect(prompt).toContain("Não leem pensamentos");
    expect(prompt).toContain("MODO EQUILIBRADO");
    expect(buildSupportingCastPolicy("discreet")).toContain("MODO DISCRETO");
  });

  it("isolates setting across users and independent stories", () => {
    const a=supportingCastStorageKey("user-a","story-a");
    expect(a).not.toBe(supportingCastStorageKey("user-a","story-b"));
    expect(a).not.toBe(supportingCastStorageKey("user-b","story-a"));
  });
});
