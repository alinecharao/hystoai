/**
 * Server-only AES-256-GCM encryption for Hysto story data.
 *
 * DO NOT import from a browser component or expose the key through VITE_*.
 * The browser and the model API may receive plaintext only through an
 * authenticated, owner-checked server route, not via direct Supabase columns.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const STORY_CIPHER_PREFIX = "hystoenc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const MAX_PLAINTEXT_BYTES = 128 * 1024;

export type StoryCipherEntity =
  | "message"
  | "assistant_version"
  | "manual_note"
  | "checkpoint_summary"
  | "checkpoint_scene"
  | "checkpoint_facts";

export type StoryCipherContext = Readonly<{
  userId: string;
  storyId: string;
  recordId: string;
  entity: StoryCipherEntity;
}>;

/**
 * Secret format: a 32-byte base64url-encoded cryptographically random key.
 * Configure only on the server, as HYSTO_MESSAGE_ENCRYPTION_KEY_V1.
 */
export function requireServerMessageKey(): Buffer {
  if (typeof window !== "undefined") {
    throw new Error("Message decryption is server-only.");
  }
  const encoded = process.env["HYSTO_MESSAGE_ENCRYPTION_KEY_V1"];
  if (!encoded) throw new Error("Hysto message encryption key is not configured.");
  return parseServerMessageKey(encoded);
}

export function parseServerMessageKey(encoded: string): Buffer {
  if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) {
    throw new Error("Invalid Hysto message encryption key format.");
  }
  const key = Buffer.from(encoded, "base64url");
  if (key.length !== KEY_BYTES || key.toString("base64url") !== encoded) {
    throw new Error("Invalid Hysto message encryption key length.");
  }
  return key;
}

const validUuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const validEntities: readonly StoryCipherEntity[] = [
  "message", "assistant_version", "manual_note",
  "checkpoint_summary", "checkpoint_scene", "checkpoint_facts",
];

function authenticatedContext(context: StoryCipherContext): Buffer {
  if (![context.userId, context.storyId, context.recordId].every((value) => validUuid.test(value))) {
    throw new Error("Invalid story encryption identity.");
  }
  if (!validEntities.includes(context.entity)) {
    throw new Error("Invalid encrypted content type.");
  }
  // Authenticated additional data means moving a ciphertext to a different
  // owner, story, row or entity invalidates its GCM authentication tag.
  return Buffer.from(JSON.stringify([
    "hysto-v1", context.userId.toLowerCase(), context.storyId.toLowerCase(),
    context.recordId.toLowerCase(), context.entity,
  ]), "utf8");
}

function decodeSegment(value: string): Buffer {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Invalid encrypted message envelope.");
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value) {
    throw new Error("Invalid encrypted message envelope.");
  }
  return bytes;
}

function validateKey(key: Buffer): void {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new Error("AES-256-GCM requires a 32-byte server key.");
  }
}

export function isEncryptedStoryText(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(STORY_CIPHER_PREFIX);
}

export function encryptStoryText(
  plaintext: string,
  context: StoryCipherContext,
  key: Buffer = requireServerMessageKey(),
): string {
  validateKey(key);
  if (typeof plaintext !== "string" || Buffer.byteLength(plaintext, "utf8") > MAX_PLAINTEXT_BYTES) {
    throw new Error("Invalid encrypted message size.");
  }
  if (isEncryptedStoryText(plaintext)) {
    throw new Error("Refusing to encrypt an existing ciphertext as plaintext.");
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(authenticatedContext(context));
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return STORY_CIPHER_PREFIX + [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    data.toString("base64url"),
  ].join(":");
}

export function decryptStoryText(
  ciphertext: string,
  context: StoryCipherContext,
  key: Buffer = requireServerMessageKey(),
): string {
  validateKey(key);
  if (typeof ciphertext !== "string" || !isEncryptedStoryText(ciphertext)) {
    throw new Error("Encrypted message required; plaintext fallback is forbidden.");
  }
  const parts = ciphertext.slice(STORY_CIPHER_PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted message envelope.");
  const [encodedIv, encodedTag, encodedData] = parts;
  const iv = decodeSegment(encodedIv!);
  const tag = decodeSegment(encodedTag!);
  const encrypted = decodeSegment(encodedData!);
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES ||
      encrypted.length > MAX_PLAINTEXT_BYTES + TAG_BYTES) {
    throw new Error("Invalid encrypted message envelope.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(authenticatedContext(context));
  decipher.setAuthTag(tag);
  // Any modified ciphertext, IV, tag, row ID, owner, or story fails closed.
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
