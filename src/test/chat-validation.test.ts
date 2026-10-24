import { describe, expect, it } from "vitest";
import { isUuid, parseChatDeletion } from "@/lib/chat-validation";

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
