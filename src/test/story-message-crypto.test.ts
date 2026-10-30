// @vitest-environment node
import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  decryptStoryText, encryptStoryText, isEncryptedStoryText,
  parseServerMessageKey, requireServerMessageKey,
} from "@/lib/server/story-message-crypto";

const userId = "11111111-1111-4111-8111-111111111111";
const storyId = "22222222-2222-4222-8222-222222222222";
const recordId = "33333333-3333-4333-8333-333333333333";
const context = { userId, storyId, recordId, entity: "message" as const };
const key = randomBytes(32);

describe("Story message AES-256-GCM", () => {
  it("round-trips Portuguese prose, thoughts, and punctuation without losing formatting", () => {
    const original = '*Ele hesitou.*\n\n[pensamento]E agora?[/pensamento]\n\n"Bom dia!" 😄';
    const sealed = encryptStoryText(original, context, key);
    expect(sealed).toMatch(/^hystoenc:v1:/);
    expect(sealed).not.toContain("Bom dia");
    expect(decryptStoryText(sealed, context, key)).toBe(original);
    expect(isEncryptedStoryText(sealed)).toBe(true);
  });

  it("uses a fresh random IV even for repeated messages", () => {
    const x = encryptStoryText("texto", context, key);
    const y = encryptStoryText("texto", context, key);
    expect(x).not.toBe(y);
    expect(decryptStoryText(x, context, key)).toBe("texto");
    expect(decryptStoryText(y, context, key)).toBe("texto");
  });

  it("rejects cross-story, cross-user, cross-row, and cross-field reassociation", () => {
    const sealed = encryptStoryText("segredo", context, key);
    for (const altered of [
      { ...context, userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      { ...context, storyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      { ...context, recordId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
      { ...context, entity: "manual_note" as const },
    ]) expect(() => decryptStoryText(sealed, altered, key)).toThrow();
  });

  it("rejects tampering, wrong keys and broken authentication tags", () => {
    const sealed = encryptStoryText("mensagem", context, key);
    const parts = sealed.split(":");
    const modified = [...parts];
    modified[modified.length-1] = modified.at(-1)!.replace(/.$/, c => c === "A" ? "B" : "A");
    expect(() => decryptStoryText(modified.join(":"), context, key)).toThrow();
    expect(() => decryptStoryText(sealed, context, randomBytes(32))).toThrow();
    expect(() => decryptStoryText("mensagem", context, key)).toThrow();
    expect(() => decryptStoryText("hystoenc:v1:garbage", context, key)).toThrow();
  });

  it("validates keys, avoids double encryption and rejects invalid identifiers", () => {
    const encoded = key.toString("base64url");
    expect(parseServerMessageKey(encoded)).toEqual(key);
    expect(() => parseServerMessageKey("123456")).toThrow();
    const sealed = encryptStoryText("uma vez", context, key);
    expect(() => encryptStoryText(sealed, context, key)).toThrow();
    expect(() => encryptStoryText("x", {...context, storyId: "not-a-uuid"}, key)).toThrow();
    expect(() => encryptStoryText("x".repeat(129*1024), context, key)).toThrow();
  });

  it("never silently generates a replacement key", () => {
    const original=process.env["HYSTO_MESSAGE_ENCRYPTION_KEY_V1"];
    try {
      delete process.env["HYSTO_MESSAGE_ENCRYPTION_KEY_V1"];
      expect(() => requireServerMessageKey()).toThrow("not configured");
    } finally {
      if(original === undefined) delete process.env["HYSTO_MESSAGE_ENCRYPTION_KEY_V1"];
      else process.env["HYSTO_MESSAGE_ENCRYPTION_KEY_V1"]=original;
    }
  });
});
