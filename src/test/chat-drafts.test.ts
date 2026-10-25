import { describe, expect, it } from "vitest";
import { draftKey, readDraft, saveDraft, type DraftStorage } from "@/lib/chat-drafts";

function memoryStorage(): DraftStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, value); },
    removeItem: (key) => { store.delete(key); },
  };
}

describe("Per-account and per-character unsent drafts", () => {
  it("keeps each chat isolated and supports resuming and clearing text", () => {
    const store = memoryStorage();
    saveDraft(store, "account1", "christopher", "Uma mensagem inacabada");
    saveDraft(store, "account1", "serena", "Outro universo");
    expect(readDraft(store, "account1", "christopher")).toBe("Uma mensagem inacabada");
    expect(readDraft(store, "account1", "serena")).toBe("Outro universo");
    expect(readDraft(store, "account2", "christopher")).toBe("");
    saveDraft(store, "account1", "christopher", "");
    expect(readDraft(store, "account1", "christopher")).toBe("");
    expect(readDraft(store, "account1", "serena")).toBe("Outro universo");
  });

  it("handles browser storage being blocked gracefully", () => {
    const store: DraftStorage = {
      getItem: () => { throw new Error("Denied"); },
      setItem: () => { throw new Error("Denied"); },
      removeItem: () => { throw new Error("Denied"); },
    };
    expect(readDraft(store, "u", "c")).toBe("");
    expect(() => saveDraft(store, "u", "c", "teste")).not.toThrow();
  });

  it("does not persist oversized drafts silently", () => {
    const store = memoryStorage();
    saveDraft(store, "u", "c", "A".repeat(30001));
    expect(readDraft(store, "u", "c")).toBe("");
  });

  it("uses unambiguous per-user key names", () => {
    expect(draftKey("one", "two")).not.toBe(draftKey("onet", "wo"));
  });
});
