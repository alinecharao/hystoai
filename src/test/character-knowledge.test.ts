import { describe, expect, it } from "vitest";
import {
  buildCharacterKnowledgePolicy,
  characterKnowledgeStorageKey,
  parseCharacterKnowledgeMode,
  DEFAULT_CHARACTER_KNOWLEDGE_MODE,
} from "@/lib/character-knowledge";

describe("Character knowledge calibration", () => {
  it("defaults safely for missing, invalid and manipulated client values", () => {
    expect(parseCharacterKnowledgeMode(undefined)).toBe(DEFAULT_CHARACTER_KNOWLEDGE_MODE);
    expect(parseCharacterKnowledgeMode(null)).toBe("cautious");
    expect(parseCharacterKnowledgeMode("encyclopedia")).toBe("cautious");
    expect(parseCharacterKnowledgeMode(["natural"])).toBe("cautious");
  });
  it("accepts the three explicit modes", () => {
    for (const mode of ["cautious", "natural", "established"]) {
      expect(parseCharacterKnowledgeMode(mode)).toBe(mode);
    }
  });
  it("requires uncertainty for unsupported cultural details in all modes", () => {
    for (const mode of ["cautious", "natural", "established"]) {
      const prompt = buildCharacterKnowledgePolicy(mode);
      expect(prompt).toContain("nunca preencha lacunas");
      expect(prompt).toContain("Informação privada");
      expect(prompt).toContain("CORREÇÃO DE INFORMAÇÕES");
      expect(prompt).toContain(`mode="${mode}"`);
    }
  });
  it("distinguishes strict and plausible cultural familiarity", () => {
    expect(buildCharacterKnowledgePolicy("established")).toContain("só afirma familiaridade");
    expect(buildCharacterKnowledgePolicy("cautious")).toContain("MODO CAUTELOSO");
    expect(buildCharacterKnowledgePolicy("natural")).toContain("MODO NATURAL");
    expect(buildCharacterKnowledgePolicy("natural")).not.toContain("mode=\"established\"");
  });
  it("separates preferences by account and character", () => {
    expect(characterKnowledgeStorageKey("user-a","christopher")).not.toBe(
      characterKnowledgeStorageKey("user-b","christopher"),
    );
    expect(characterKnowledgeStorageKey("user-a","christopher")).not.toBe(
      characterKnowledgeStorageKey("user-a","serena"),
    );
  });
});
