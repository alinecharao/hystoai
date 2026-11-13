/** Fixed-size, bounded pagination for old story messages.
 * The extra row is used only to determine whether another page exists.
 */
export const STORY_HISTORY_PAGE_SIZE = 30;

export function historyPageRange(page: number): { from: number; to: number } {
  if (!Number.isSafeInteger(page) || page < 0 ||
      page > Math.floor((Number.MAX_SAFE_INTEGER - STORY_HISTORY_PAGE_SIZE) / STORY_HISTORY_PAGE_SIZE)) {
    throw new Error("Página do histórico inválida.");
  }
  const from = page * STORY_HISTORY_PAGE_SIZE;
  return { from, to: from + STORY_HISTORY_PAGE_SIZE };
}

export function historyPageRows<T>(records: readonly T[]): { rows: T[]; hasMore: boolean } {
  return {
    rows: records.slice(0, STORY_HISTORY_PAGE_SIZE),
    hasMore: records.length > STORY_HISTORY_PAGE_SIZE,
  };
}
