import { describe, expect, it } from "vitest";
import { activeChatTurnIds, isOptionalUuid, isUuid, parseChatDeletion } from "@/lib/chat-validation";

const characterId = "11111111-1111-4111-8111-111111111111";
const messageId = "22222222-2222-4222-8222-222222222222";

describe("Destructive chat API request validation", () => {
  it("accepts an exact message identifier without any bulk-delete instruction", () => {
    expect(parseChatDeletion({ characterId, messageId })).toEqual({
      type: "message", characterId, messageId,
    });
  });

  it("requires the literal JSON boolean true to delete a conversation", () => {
    expect(parseChatDeletion({ characterId, all: true })).toEqual({
      type: "conversation", characterId,
    });
    expect(parseChatDeletion({ characterId, all: "false" })).toBeNull();
    expect(parseChatDeletion({ characterId, all: "true" })).toBeNull();
    expect(parseChatDeletion({ characterId, all: 1 })).toBeNull();
    expect(parseChatDeletion({ characterId, all: false })).toBeNull();
  });

  it("rejects ambiguous deletion requests even if both fields look valid", () => {
    expect(parseChatDeletion({ characterId, all: true, messageId })).toBeNull();
    expect(parseChatDeletion({ characterId, all: false, messageId })).toBeNull();
  });

  it("rejects malformed, missing, or unscoped identifiers", () => {
    expect(isUuid(characterId)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(parseChatDeletion(null)).toBeNull();
    expect(parseChatDeletion([])).toBeNull();
    expect(parseChatDeletion({ messageId })).toBeNull();
    expect(parseChatDeletion({ characterId, messageId: "invalid" })).toBeNull();
  });
});

describe("Chat generation request compatibility", () => {
  it("accepts missing and null operation IDs from older mobile clients", () => {
    expect(isOptionalUuid(undefined)).toBe(true);
    expect(isOptionalUuid(null)).toBe(true);
  });

  it("accepts active UUIDs while rejecting malformed optional identifiers", () => {
    expect(isOptionalUuid(messageId)).toBe(true);
    for (const value of ["", "null", "undefined", "false", 0, false, {}, []]) {
      expect(isOptionalUuid(value)).toBe(false);
    }
  });

  it("omits inactive IDs for a normal new message", () => {
    expect(activeChatTurnIds(null, null)).toEqual({});
    const serialized = JSON.stringify({ clientMessageId: messageId, ...activeChatTurnIds(null, null) });
    expect(serialized).not.toContain("retryMessageId");
    expect(serialized).not.toContain("regenerateMessageId");
  });

  it("sends only the regeneration ID when requesting a different assistant version", () => {
    expect(activeChatTurnIds(messageId, null)).toEqual({ regenerateMessageId: messageId });
  });

  it("sends only the pending user ID when recovering a failed response", () => {
    expect(activeChatTurnIds(null, messageId)).toEqual({ retryMessageId: messageId });
  });
});
