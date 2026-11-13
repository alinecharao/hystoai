import { describe, expect, it } from "vitest";
import { historyPageRange, historyPageRows, STORY_HISTORY_PAGE_SIZE } from "@/lib/history-pagination";

describe("Long chat history pagination", () => {
  it("requests the extra sentinel row without overlapping adjacent displayed pages", () => {
    expect(historyPageRange(0)).toEqual({ from: 0, to: 30 });
    expect(historyPageRange(1)).toEqual({ from: 30, to: 60 });
    expect(historyPageRange(12)).toEqual({ from: 360, to: 390 });
  });

  it("displays only 30 and flags more pages only when the sentinel is present", () => {
    const thirty = Array.from({ length: STORY_HISTORY_PAGE_SIZE }, (_, i) => "message-" + i);
    expect(historyPageRows(thirty)).toEqual({ rows: thirty, hasMore: false });
    const thirtyOne = [...thirty, "next page sentinel"];
    const result = historyPageRows(thirtyOne);
    expect(result.rows).toEqual(thirty);
    expect(result.hasMore).toBe(true);
  });

  it("does not mutate loaded rows or drop distinct messages sharing identical content", () => {
    const messages = [{ id: "one", content: "Igual" }, { id: "two", content: "Igual" }];
    expect(historyPageRows(messages).rows).toEqual(messages);
    expect(messages).toHaveLength(2);
  });

  it("rejects impossible page requests before issuing a database query", () => {
    for (const invalid of [-1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
      expect(() => historyPageRange(invalid)).toThrow("Página do histórico inválida.");
    }
  });
});
