import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationMenu, type ConversationMenuTab } from "@/components/conversation-menu";
import { SCENE_COMMANDS, type Character } from "@/lib/characters";

afterEach(() => cleanup());

const character = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Christopher",
  avatar: "C",
  user_id: null,
} as unknown as Character;

function fixture(callbacks: {
  onCommand?: (id: (typeof SCENE_COMMANDS)[number]["id"]) => void;
  onMemory?: () => void;
  onClose?: (open: boolean) => void;
  busy?: boolean;
}) {
  function Harness() {
    const [tab, setTab] = useState<ConversationMenuTab>("guide");
    return (
      <ConversationMenu
        open
        tab={tab}
        onTabChange={setTab}
        onOpenChange={callbacks.onClose ?? (() => {})}
        character={character}
        portraitSrc=""
        personas={[{ id: "persona-1", name: "Aline" }]}
        personaId="persona-1"
        onPersonaChange={() => {}}
        onEditPersona={() => {}}
        aiProvider="auto"
        providerLabels={{ auto: "Automático", gemini: "Gemini" }}
        onProviderChange={() => {}}
        knowledgeMode="cautious"
        knowledgeModeLabels={{ cautious: "Cauteloso", natural: "Natural" }}
        onKnowledgeModeChange={() => {}}
        supportingCastMode="balanced"
        onSupportingCastChange={() => {}}
        showThoughts
        onThoughtsChange={() => {}}
        busy={callbacks.busy ?? false}
        blocked={false}
        exporting={false}
        onCommand={callbacks.onCommand ?? (() => {})}
        onShowCharacter={() => {}}
        onShowHistory={() => {}}
        onShowMemory={callbacks.onMemory ?? (() => {})}
        onExport={() => {}}
        onEditCharacter={() => {}}
        canEditCharacter={false}
        onClearHistory={() => {}}
        visualMode="image"
        onVisualModeChange={() => {}}
        visualFrequency="normal"
        onVisualFrequencyChange={() => {}}
      />
    );
  }
  render(<Harness />);
}

describe("Unified Hysto conversation menu", () => {
  it("has exactly two tabs and only shows commands in the guide panel", () => {
    fixture({});
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Guie a sua história" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: "Comandos rápidos" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Configurações" }));
    expect(screen.getByRole("tab", { name: "Configurações" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: "Bate-papo" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Comandos rápidos" })).toBeNull();
  });

  it("keeps model, persona, thoughts, memory, and backups reachable from settings", () => {
    const onMemory = vi.fn();
    const onClose = vi.fn();
    fixture({ onMemory, onClose });
    fireEvent.click(screen.getByRole("tab", { name: "Configurações" }));
    expect(screen.getByRole("combobox", { name: "Modelo de IA" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Persona da conversa" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Participação dos personagens secundários" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Mostrar pensamentos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Exportar dados da história/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Memória da história/ }));
    expect(onMemory).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("uses the existing scene command and disables it while the chat is busy", () => {
    const callback = vi.fn();
    fixture({ onCommand: callback, busy: true });
    const button = screen.getByRole("button", { name: new RegExp(SCENE_COMMANDS[0]!.label) });
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});
