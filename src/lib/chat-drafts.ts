/** Client-only unsent drafts; never sent to an API or shared between accounts. */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const DRAFT_PREFIX = "hysto-unsent-draft-v1";
const MAX_DRAFT_LENGTH = 30_000;

export function draftKey(userId: string, characterId: string): string {
  return `${DRAFT_PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(characterId)}`;
}

export function readDraft(storage: DraftStorage, userId: string, characterId: string): string {
  try {
    const found = storage.getItem(draftKey(userId, characterId));
    return found && found.length <= MAX_DRAFT_LENGTH ? found : "";
  } catch {
    return "";
  }
}

export function saveDraft(storage: DraftStorage, userId: string, characterId: string, text: string): void {
  try {
    const key = draftKey(userId, characterId);
    if (!text) storage.removeItem(key);
    else if (text.length <= MAX_DRAFT_LENGTH) storage.setItem(key, text);
  } catch {
    // Private browsing/storage quota cannot prevent the user from typing.
  }
}
