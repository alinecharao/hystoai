/** Only UUID-shaped identifiers are accepted as client-supplied database IDs. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Omitted and explicit null are both valid for an inactive retry/regeneration.
 * Reject all other non-UUID input instead of interpreting truthy values.
 */
export function isOptionalUuid(value: unknown): value is string | null | undefined {
  return value == null || isUuid(value);
}

/** Omit inactive operations from outbound requests (for cached/older servers). */
export function activeChatTurnIds(regenerateMessageId: string | null, retryMessageId: string | null) {
  return {
    ...(regenerateMessageId ? { regenerateMessageId } : {}),
    ...(retryMessageId ? { retryMessageId } : {}),
  };
}

type ChatDeletion =
  | { type: "conversation"; characterId: string }
  | { type: "message"; characterId: string; messageId: string };

/**
 * A destructive request is valid only if exactly one explicit action is given.
 * In particular, JSON "all": "false" must NEVER become a truthy bulk delete.
 */
export function parseChatDeletion(value: unknown): ChatDeletion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (!isUuid(body["characterId"])) return null;
  if (body["all"] === true && body["messageId"] === undefined) {
    return { type: "conversation", characterId: body["characterId"] };
  }
  if (body["all"] === undefined && isUuid(body["messageId"])) {
    return { type: "message", characterId: body["characterId"], messageId: body["messageId"] };
  }
  return null;
}
