import { describe, expect, it } from "vitest";
import { serializeUserMessageForModel } from "@/lib/narrative-input";

describe("Story input formatting", () => {
  it("preserves typographic and straight dialogue without claiming who spoke", () => {
    const source = '“Vamos pra sala da mamãe?”\n"Vão reto que vocês chegam."';
    expect(serializeUserMessageForModel(source)).toContain(source);
    expect(serializeUserMessageForModel(source)).not.toContain('speaker="protagonist"');
  });

  it("preserves every paragraph and action in a long mixed narrative", () => {
    const source = 'Assim que as portas do elevador se fecharam.\n\n*Eu me abaixei.*\n\n“Vamos pra sala?”\n\n[Não posso contar.]\n\nOs quatro chegaram antes de mim.';
    const result = serializeUserMessageForModel(source);
    expect(result).toBe(`<USER_NARRATIVE role="user" source="verbatim">\n${source}\n</USER_NARRATIVE>`);
    expect(result).not.toContain("<MENTAL_SPEECH");
    expect(result.indexOf("elevador")).toBeLessThan(result.indexOf("Os quatro chegaram"));
  });

  it("does not transform actions into private thoughts or bracketed text into memory", () => {
    const source = "*Ela entrou na sala.*\n[pensamento]Preciso ir.[/pensamento]";
    expect(serializeUserMessageForModel(source)).toContain(source);
    expect(serializeUserMessageForModel(source)).not.toContain("<MEMORY_OR_DREAM");
  });

  it("leaves empty content unchanged for API validation", () => {
    expect(serializeUserMessageForModel("   ")).toBe("   ");
  });
});
