import { describe, expect, it } from "vitest";
import { formatStoryAsText, type StoryExport } from "@/lib/story-export";

const exportSample: StoryExport = {
  schema: "hysto-story-export-v1",
  exported_at: "2026-10-24T18:00:00.000Z",
  character: { id: "chr", name: "Christopher Willians" },
  messages: [
    { id: "u1", role: "user", content: "Minha fala", created_at: "2026-10-24T18:00:00Z" },
    { id: "a1", role: "assistant", content: "Texto original", created_at: "2026-10-24T18:00:01Z" },
  ],
  assistant_versions: [
    { id: "v1", assistant_message_id: "a1", content: "Versão descartada", is_selected: false, created_at: "2026-10-24T18:00:02Z" },
    { id: "v2", assistant_message_id: "a1", content: "Versão escolhida", is_selected: true, created_at: "2026-10-24T18:00:03Z" },
  ],
  curated_notes: [{ id: "n1", category: "private", body: "Ele não sabe o segredo", source_message_id: "u1" }],
};

describe("Story export", () => {
  it("exports selected assistant version, preserving user text and manual notes", () => {
    const content = formatStoryAsText(exportSample);
    expect(content).toContain("Minha fala");
    expect(content).toContain("Versão escolhida");
    expect(content).not.toContain("Texto original\n");
    expect(content).not.toContain("Versão descartada\n");
    expect(content).toContain("Ele não sabe o segredo");
    expect(content).toContain("JSON");
  });
  it("preserves immutable original when no alternative is selected", () => {
    const content = formatStoryAsText({ ...exportSample, assistant_versions: [] });
    expect(content).toContain("Texto original");
  });
  it("leaves the original export structure untouched", () => {
    formatStoryAsText(exportSample);
    expect(exportSample.messages[1]?.content).toBe("Texto original");
    expect(exportSample.assistant_versions).toHaveLength(2);
  });
});
