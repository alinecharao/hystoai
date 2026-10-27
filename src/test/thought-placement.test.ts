import { describe, expect, it } from "vitest";
import { buildThoughtPlacementPolicy } from "@/lib/thought-placement";
import { parseNarrativeSegments } from "@/lib/characters";

describe("Contextual placement of fictional character thoughts", () => {
  it("prioritizes thoughts after the event that triggers them", () => {
    const instructions = buildThoughtPlacementPolicy(true);
    expect(instructions).toContain("APÓS o acontecimento");
    expect(instructions).toContain("Nunca reúna todos os pensamentos no início");
    expect(instructions).toContain("Pensamentos são opcionais");
    expect(instructions).toContain("APENAS FORMATO, NÃO FATOS DA HISTÓRIA");
    expect(instructions).toContain("Feche o bloco antes de continuar");
  });

  it("does not require monologue while thoughts are disabled", () => {
    const instructions = buildThoughtPlacementPolicy(false);
    expect(instructions).toContain("PENSAMENTOS DESATIVADOS");
    expect(instructions).not.toContain("Exemplo A");
  });

  it("renders a thought between the action that triggers it and the next line of dialogue", () => {
    const narrative = '*Ele hesita.*\n\n[pensamento]Ela percebeu algo?[/pensamento]\n\n"Está tudo bem."';
    expect(parseNarrativeSegments(narrative)).toEqual([
      { type: "body", text: "*Ele hesita.*" },
      { type: "thought", text: "Ela percebeu algo?" },
      { type: "body", text: '"Está tudo bem."' },
    ]);
  });

  it("keeps separate thought blocks at their original positions, including after a dialogue", () => {
    const narrative = '*Ele olha para a janela.*\n[pensamento]Vai chover.[/pensamento]\n"Vamos sair."\n[pensamento]Talvez seja tarde.[/pensamento]';
    expect(parseNarrativeSegments(narrative)).toEqual([
      { type: "body", text: "*Ele olha para a janela.*" },
      { type: "thought", text: "Vai chover." },
      { type: "body", text: '"Vamos sair."' },
      { type: "thought", text: "Talvez seja tarde." },
    ]);
  });

  it("does not move a legitimately opening thought or invent one", () => {
    expect(parseNarrativeSegments('[pensamento]Preciso agir.[/pensamento]\n*Ele se levanta.*')[0]).toEqual({
      type: "thought", text: "Preciso agir.",
    });
    expect(parseNarrativeSegments('*Ele espera em silêncio.*')).toEqual([
      { type: "body", text: "*Ele espera em silêncio.*" },
    ]);
  });
});
