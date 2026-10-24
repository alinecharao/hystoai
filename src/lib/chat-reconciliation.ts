import type { UIMessage } from "ai";

/**
 * Only persisted rows may restore the SDK state after regeneration or delete.
 * Never reapply a render-time "initial" array once the server has refreshed.
 */
export type PersistedMessageSnapshot = {
  id: string;
  role: string;
  content: string;
};

export function toPersistedChatMessages(rows: readonly PersistedMessageSnapshot[]): UIMessage[] {
  return rows.map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant",
    parts: [{ type: "text" as const, text: row.content }],
  }));
}
