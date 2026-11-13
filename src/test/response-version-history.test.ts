import { describe, expect, it } from "vitest";
import { responseVersionEntries } from "@/lib/response-version-history";

describe("Version history for old and current assistant messages", () => {
  const versions = [
    { id: "v1", content: "Primeira alternativa", is_selected: false },
    { id: "v2", content: "Segunda alternativa", is_selected: true },
  ];

  it("keeps the exact original answer even when an alternative is selected", () => {
    const rows = responseVersionEntries("Texto original\n\nCom parágrafos.", versions);
    expect(rows).toEqual([
      { id: "original", content: "Texto original\n\nCom parágrafos.", selected: false },
      { id: "v1", content: "Primeira alternativa", selected: false },
      { id: "v2", content: "Segunda alternativa", selected: true },
    ]);
  });

  it("marks the original selected if no alternative is currently selected", () => {
    const rows = responseVersionEntries("Resposta original", versions.map((v) => ({ ...v, is_selected: false })));
    expect(rows[0].selected).toBe(true);
    expect(rows.slice(1).every((row) => !row.selected)).toBe(true);
  });

  it("shows the original alone when there are no alternatives", () => {
    expect(responseVersionEntries("Uma única resposta", [])).toEqual([
      { id: "original", content: "Uma única resposta", selected: true },
    ]);
  });

  it("does not mutate downloaded version records", () => {
    const originals = versions.map((v) => ({ ...v }));
    responseVersionEntries("Original", versions);
    expect(versions).toEqual(originals);
  });
});
