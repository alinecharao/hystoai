/** User-curated story facts: no model calls and no automatic extraction. */
export const CURATED_NOTE_LIMIT = 24;
export const CURATED_NOTE_LENGTH = 280;
export const CURATED_PROMPT_CHAR_LIMIT = 5500;
export const CURATED_NOTE_CATEGORIES = ["fact", "timeline", "knowledge", "private"] as const;
export type CuratedCategory = (typeof CURATED_NOTE_CATEGORIES)[number];
export type CuratedNote = { id: string; category: CuratedCategory; body: string; source_message_id: string | null; created_at: string };
export const CURATED_NOTE_LABELS: Record<CuratedCategory, string> = {
  fact: "Fato importante",
  timeline: "Linha do tempo",
  knowledge: "Quem sabe o quê",
  private: "Informação privada",
};

export function isCuratedCategory(value: unknown): value is CuratedCategory {
  return typeof value === "string" && CURATED_NOTE_CATEGORIES.some((kind) => kind === value);
}

export function validateCuratedNote(content: string): string | null {
  const trimmed = content.trim();
  return trimmed.length > 0 && trimmed.length <= CURATED_NOTE_LENGTH ? trimmed : null;
}

/** Source is data, not a new directive. No cross-character facts or examples. */
export function formatCuratedNotes(notes: readonly Pick<CuratedNote, "category" | "body">[]): string {
  const sections: string[] = [];
  for (const note of notes.slice(0, CURATED_NOTE_LIMIT)) {
    if (!isCuratedCategory(note.category)) continue;
    const body = validateCuratedNote(note.body);
    if (!body) continue;
    // Avoid an injected closing tag turning user content into system markup.
    const plain = body.replaceAll("<", "‹").replaceAll(">", "›");
    const text = `- [${CURATED_NOTE_LABELS[note.category]}] ${plain}`;
    if (sections.join("\n").length + text.length > CURATED_PROMPT_CHAR_LIMIT) break;
    sections.push(text);
  }
  return sections.join("\n");
}
