import { describe, expect, it } from "vitest";
import {
  parseCommand,
  parseNarrativeSegments,
  stripNarrativeControlTags,
} from "@/lib/characters";

describe("Narrative display safety", () => {
  it("keeps closed thoughts separate from narration and dialogue", () => {
    expect(parseNarrativeSegments('Ela sorriu. [pensamento]Preciso lembrar.[/pensamento] "Tudo bem."')).toEqual([
      { type: "body", text: "Ela sorriu." },
      { type: "thought", text: "Preciso lembrar." },
      { type: "body", text: '"Tudo bem."' },
    ]);
  });

  it("does not hide subsequent dialogue after an unclosed thought", () => {
    const result = parseNarrativeSegments('"Olá!" [pensamento]Ainda estou pensando');
    expect(result.every((segment) => segment.type === "body")).toBe(true);
    expect(result.map((segment) => segment.text).join(" ")).toContain("Ainda estou pensando");
  });

  it("strips internal transport markup without changing the written text", () => {
    expect(stripNarrativeControlTags('<DIALOGUE speaker="protagonist">Olá</DIALOGUE>')).toBe("Olá");
    expect(stripNarrativeControlTags("<CHARACTER_CANON>Fato</CHARACTER_CANON>")).toBe("Fato");
  });

  it("recognizes only exact scene control messages", () => {
    expect(parseCommand("[[cmd:advance]]")?.id).toBe("advance");
    expect(parseCommand("Faça [[cmd:advance]]")).toBeNull();
  });
});
