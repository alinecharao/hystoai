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

  it("renders a thought correctly when the AI repeats [pensamento] as its closing tag", () => {
    const input = '*Ele escutou a pergunta.*\n\n[pensamento]Ela percebeu o problema.[pensamento]\n\n"Vou explicar."';
    expect(parseNarrativeSegments(input)).toEqual([
      { type: "body", text: "*Ele escutou a pergunta.*" },
      { type: "thought", text: "Ela percebeu o problema." },
      { type: "body", text: '"Vou explicar."' },
    ]);
  });

  it("preserves both a properly closed thought and a second malformed thought in their authored positions", () => {
    const input = '[pensamento]Preciso escolher.[/pensamento]\n\n*Ele hesita.*\n\n[pensamento]Talvez agora.[pensamento]\n\n"Tudo bem."';
    expect(parseNarrativeSegments(input)).toEqual([
      { type: "thought", text: "Preciso escolher." },
      { type: "body", text: "*Ele hesita.*" },
      { type: "thought", text: "Talvez agora." },
      { type: "body", text: '"Tudo bem."' },
    ]);
  });

  it("preserves the readable narrative without exposed delimiters when an orphan thought marker is emitted", () => {
    const input = '*Ele observou.*\n[pensamento]Uma ideia sem encerramento.\n"Vamos embora."';
    const output = parseNarrativeSegments(input);
    expect(output.every((part) => part.type === "body")).toBe(true);
    expect(output.map((part) => part.text).join(" ")).toContain('Vamos embora.');
    expect(output.map((part) => part.text).join(" ")).not.toContain("[pensamento]");
  });

  it("handles XML thought tags and avoids styling a missing opening tag as an internal monologue", () => {
    expect(parseNarrativeSegments("*Ele para.*<thought>Algo mudou.</thought>\"Tudo certo.\"")).toEqual([
      { type: "body", text: "*Ele para.*" },
      { type: "thought", text: "Algo mudou." },
      { type: "body", text: '"Tudo certo."' },
    ]);
    expect(parseNarrativeSegments("Olá.[/pensamento]")).toEqual([{ type: "body", text: "Olá." }]);
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
