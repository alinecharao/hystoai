import { describe, expect, it } from "vitest";
import { toPersistedChatMessages } from "@/lib/chat-reconciliation";

describe("Authoritative chat recovery", () => {
  it("restores server message IDs rather than temporary regeneration IDs", () => {
    const saved = [
      { id: "user-persisted", role: "user", content: "Olá" },
      { id: "assistant-persisted", role: "assistant", content: "Oi!" },
    ];
    const restored = toPersistedChatMessages(saved);
    expect(restored.map((message) => message.id)).toEqual(["user-persisted", "assistant-persisted"]);
    expect(restored[1]?.parts).toEqual([{ type: "text", text: "Oi!" }]);
  });

  it("preserves duplicate text as distinct messages with distinct persisted IDs", () => {
    const restored = toPersistedChatMessages([
      { id: "a", role: "assistant", content: "Resposta repetida" },
      { id: "b", role: "assistant", content: "Resposta repetida" },
    ]);
    expect(restored).toHaveLength(2);
    expect(restored.map((message) => message.id)).toEqual(["a", "b"]);
  });

  it("returns a new empty SDK history when the server confirms a cleared conversation", () => {
    expect(toPersistedChatMessages([])).toEqual([]);
  });

  it("does not mutate incoming persisted records", () => {
    const records = [{ id: "u1", role: "user", content: "Teste" }];
    toPersistedChatMessages(records);
    expect(records).toEqual([{ id: "u1", role: "user", content: "Teste" }]);
  });
});
