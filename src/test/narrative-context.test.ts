import { describe, expect, it } from "vitest";
import {
  buildCompactNarrativeSystem,
  GROQ_NARRATIVE_CHAR_BUDGET,
  selectGroqNarrativeMessages,
} from "@/lib/ai/narrative-context";

describe("Lossless Groq narrative context", () => {
  const system = "Preserve chronological events and persona ownership.";

  it("retains the exact full latest user narrative, even across many paragraphs", () => {
    const original =
      'Assim que as portas do elevador se fecharam, Christopher partiu.\n\n' +
      'As quatro crianças ficaram comigo.\n\n' +
      '“Vamos pra sala da mamãe?”\n\n' +
      '*Eu guiei as quatro crianças pelo corredor.*\n\n' +
      '“Vão reto que vocês chegam.”\n\n' +
      "Eles chegaram antes de mim e entrei na reunião.";
    const messages = [
      { role: "system", content: "Long general prompt that gets replaced" },
      { role: "user", content: "Introdução" },
      { role: "assistant", content: "Resposta inicial" },
      { role: "user", content: original },
    ];
    const selected = selectGroqNarrativeMessages(messages, system, 2000)!;
    expect(selected.at(-1)).toBe(messages.at(-1));
    expect(selected.at(-1)?.content).toBe(original);
    expect(selected[0]).toEqual({ role: "system", content: system });
    expect(selected.filter((m) => m.role === "user")).toHaveLength(2);
    expect(selected.at(-1)?.content).toContain("Eles chegaram antes de mim");
  });

  it("never trims a long current message to fit the budget", () => {
    const latest = "X".repeat(GROQ_NARRATIVE_CHAR_BUDGET);
    expect(selectGroqNarrativeMessages([{ role: "user", content: latest }], system)).toBeNull();
  });

  it("keeps chronological contiguous history rather than skipping large intervening turns", () => {
    const messages = [
      { role: "assistant", content: "first" },
      { role: "user", content: "O".repeat(300) },
      { role: "assistant", content: "recent answer" },
      { role: "user", content: "new action" },
    ];
    const selected = selectGroqNarrativeMessages(messages, system, system.length + 30)!;
    expect(selected.map((m) => m.content)).toEqual([system, "recent answer", "new action"]);
    expect(selected[1]?.content).toBe("recent answer");
  });

  it("does not change structured message parts, and requires a final user turn", () => {
    const last = { role: "user", content: [{ type: "text", text: "Mensagem íntegra" }] };
    const result = selectGroqNarrativeMessages([last], system, 1000);
    expect(result?.at(-1)).toBe(last);
    expect(selectGroqNarrativeMessages([{ role: "assistant", content: "fim" }], system)).toBeNull();
  });

  it("replaces an SDK developer instruction without treating it as story history", () => {
    const latest = { role: "user", content: "Última fala" };
    const data = [
      { role: "developer", content: "OLD HUGE SERVER PROMPT" },
      { role: "assistant", content: "An earlier reply" },
      latest,
    ];
    const selected = selectGroqNarrativeMessages(data, system, 2000);
    expect(selected?.[0]).toEqual({ role: "system", content: system });
    expect(selected?.filter((m) => m.role === "developer")).toHaveLength(0);
    expect(selected?.at(-1)).toBe(latest);
  });

  it("rejects an empty system or malformed budget", () => {
    expect(selectGroqNarrativeMessages([{ role: "user", content: "ola" }], "", 20)).toBeNull();
    expect(selectGroqNarrativeMessages([{ role: "user", content: "ola" }], system, Number.NaN)).toBeNull();
  });
});

describe("Compact narrative truth hierarchy", () => {
  const config = {
    characterName: "Christopher Willians",
    persona: "Aline: somente a usuária decide o que faz e pensa.",
    canon: "Christopher fundou Sonne.",
    background: "Ambientação sem eventos comprovados.",
    currentStory: "Christopher saiu de elevador. Aline ficou com quatro crianças.",
    styleExamples: "Somente linguagem; nunca fatos da história.",
    curatedMemory: "Aline não contou a Christopher o que aconteceu após a partida.",
    memorySummary: "Resumo antigo divergente.",
    memoryScene: "Elevador antigo.",
    memoryKnowledge: "Suposição antiga.",
    knowledgeMode: "established" as const,
    castMode: "participative" as const,
    thoughtsEnabled: true,
  };

  it("keeps the persona, canon and recent story without promoting style examples to events", () => {
    const prompt = buildCompactNarrativeSystem(config);
    expect(prompt).toContain("Christopher Willians");
    expect(prompt).toContain("Christopher fundou Sonne");
    expect(prompt).toContain("Christopher saiu de elevador");
    expect(prompt).toContain("<CURATED_STORY_MEMORY>");
    expect(prompt).not.toContain("Resumo antigo divergente");
    expect(prompt).toContain("STYLE_EXAMPLES contém SOMENTE estilo");
    expect(prompt).toContain("Não reescreva nem resuma o turno");
    expect(prompt).toContain("SECUNDÁRIOS: personagens presentes");
    expect(prompt).toContain("efetivamente".toUpperCase().slice(0, 4));
    expect(prompt).toContain("somente do personagem principal da IA");
  });

  it("retains memory checkpoint when no curated notes exist", () => {
    const prompt = buildCompactNarrativeSystem({
      ...config, curatedMemory: "", thoughtsEnabled: false,
    });
    expect(prompt).toContain("FATOS ESTABELECIDOS:");
    expect(prompt).toContain("Resumo antigo divergente");
    expect(prompt).toContain("PENSAMENTOS DESATIVADOS");
  });
});
