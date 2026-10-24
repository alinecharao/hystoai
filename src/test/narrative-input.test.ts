import { describe, expect, it } from "vitest";
import { serializeUserMessageForModel } from "@/lib/narrative-input";

describe("Story input formatting", () => {
  it("recognizes Brazilian typographic quotation marks as spoken dialogue", () => {
    expect(serializeUserMessageForModel("“Eu estou aqui.”")).toBe(
      '<DIALOGUE speaker="protagonist">\nEu estou aqui.\n</DIALOGUE>',
    );
  });

  it("keeps straight quotation marks working", () => {
    expect(serializeUserMessageForModel('"Tudo bem."')).toBe(
      '<DIALOGUE speaker="protagonist">\nTudo bem.\n</DIALOGUE>',
    );
  });

  it("distinguishes dialogue, private memories, mental speech and narrative text", () => {
    const result = serializeUserMessageForModel(
      "Ela entrou na sala.\n“Olá!”\n[Lembrei do dia anterior.]\n*Não posso contar.*\n‘Uma palavra citada’",
    );
    expect(result).toContain('<USER_TEXT>\nEla entrou na sala.\n</USER_TEXT>');
    expect(result).toContain('<DIALOGUE speaker="protagonist">\nOlá!\n</DIALOGUE>');
    expect(result).toContain('<MEMORY_OR_DREAM speaker="protagonist">\nLembrei do dia anterior.\n</MEMORY_OR_DREAM>');
    expect(result).toContain('<MENTAL_SPEECH speaker="protagonist">\nNão posso contar.\n</MENTAL_SPEECH>');
    expect(result).toContain('<USER_TEXT>\n‘Uma palavra citada’\n</USER_TEXT>');
  });

  it("does not treat partial or unbalanced quotation marks as speech", () => {
    expect(serializeUserMessageForModel("“Oi, pensei.")).toBe(
      "<USER_TEXT>\n“Oi, pensei.\n</USER_TEXT>",
    );
  });

  it("preserves a blank input so the existing API validation can reject it", () => {
    expect(serializeUserMessageForModel("   ")).toBe("   ");
  });
});
