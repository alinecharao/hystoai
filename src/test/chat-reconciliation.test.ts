import { describe, expect, it } from "vitest";
import { draftAfterFailedSubmission, hasPersistedUserTurn, latestPendingUserTurn, toPersistedChatMessages } from "@/lib/chat-reconciliation";

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

describe("Safe pending response recovery", () => {
  it("returns the newest user turn, never an earlier one", () => {
    expect(latestPendingUserTurn([
      { id: "u1", role: "user", content: "Primeira" },
      { id: "a1", role: "assistant", content: "Resposta" },
      { id: "u2", role: "user", content: "Última" },
    ])?.id).toBe("u2");
  });

  it("does not retry a user turn once an assistant response is saved", () => {
    expect(latestPendingUserTurn([
      { id: "u1", role: "user", content: "Primeira" },
      { id: "a1", role: "assistant", content: "Resposta" },
    ])).toBeNull();
  });

  it("returns null for empty conversations", () => {
    expect(latestPendingUserTurn([])).toBeNull();
  });
});

describe("Unsaved draft safety", () => {
  it("does not restore a draft if this user's client UUID was saved", () => {
    expect(hasPersistedUserTurn([
      { id: "other-id", role: "user", content: "Igual" },
      { id: "client-123", role: "user", content: "Igual" },
    ], "client-123")).toBe(true);
  });

  it("does not confuse identical text or an assistant UUID for a saved user turn", () => {
    expect(hasPersistedUserTurn([
      { id: "other-id", role: "user", content: "Igual" },
      { id: "client-123", role: "assistant", content: "Igual" },
    ], "client-123")).toBe(false);
  });
});


describe("Recovery of text after a streaming failure", () => {
  const submitted = "Mensagem longa da persona com diálogos e ações próprias.";

  it("restores original text when a provider fails before the server saves the turn", () => {
    expect(draftAfterFailedSubmission([], "client-1", submitted, "")).toBe(submitted);
  });

  it("never reconstructs a draft for a turn already persisted, even if text repeats", () => {
    const persisted = [{ id: "client-1", role: "user", content: submitted }];
    expect(draftAfterFailedSubmission(persisted, "client-1", submitted, "")).toBe("");
    expect(draftAfterFailedSubmission([{ id: "other-id", role: "user", content: submitted }], "client-1", submitted, "")).toBe(submitted);
  });

  it("never replaces a newer user draft with a failed earlier submission", () => {
    expect(draftAfterFailedSubmission([], "client-1", submitted, "Nova mensagem")).toBe("Nova mensagem");
  });
});
