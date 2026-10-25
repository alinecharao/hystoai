import { describe, expect, it } from "vitest";
import {
  buildStoryMemoryHistory,
  readStoryMemoryJson,
  selectSafeStoryMemory,
  type StoryMemorySnapshot,
} from "@/lib/story-memory";

const previous: StoryMemorySnapshot = {
  summary: "Christopher é fundador da Sonne.",
  scene: "Na cafeteria.",
  known_facts: "Christopher sabe que Aline é designer porque ela contou.",
  last_processed_message_id: "assistant-old",
};

describe("Long-term continuity", () => {
  it("keeps durable biography and per-character knowledge when checkpoint leaves the recent window", () => {
    const safe = selectSafeStoryMemory(previous, true, false, null);
    expect(safe?.summary).toBe(previous.summary);
    expect(safe?.known_facts).toBe(previous.known_facts);
    expect(safe?.scene).toBe("");
  });

  it("does not carry a stale scene when the story has advanced", () => {
    expect(selectSafeStoryMemory(previous, true, false, 5)?.scene).toBe("");
    expect(selectSafeStoryMemory(previous, true, false, 0)?.scene).toBe("Na cafeteria.");
  });

  it("rejects checkpoints referencing deleted messages or discarded alternatives", () => {
    expect(selectSafeStoryMemory(previous, false, false, 1)).toBeNull();
    expect(selectSafeStoryMemory(previous, true, true, 0)).toBeNull();
    expect(selectSafeStoryMemory({ ...previous, last_processed_message_id: null }, true, false, 0)).toBeNull();
  });
});

describe("Memory update provenance", () => {
  it("records the latest user turn once, even when already persisted in history", () => {
    const history = [
      { id: "user-1", role: "user", content: "Antes" },
      { id: "assistant-1", role: "assistant", content: "Certo" },
      { id: "user-2", role: "user", content: "Agora" },
    ];
    const latest = buildStoryMemoryHistory(
      history,
      { id: "user-2", role: "user", content: "Agora" },
      { id: "assistant-2", role: "assistant", content: "Seguimos" },
    );
    expect(latest.map((item) => item.id)).toEqual(["user-1", "assistant-1", "user-2", "assistant-2"]);
    expect(latest.filter((turn) => turn.id === "user-2")).toHaveLength(1);
  });

  it("keeps message IDs and order when recovering a pending response", () => {
    const result = buildStoryMemoryHistory(
      [{ id: "a1", role: "assistant", content: "Oi" }],
      { id: "pending-u2", role: "user", content: "Olá" },
      { id: "saved-a2", role: "assistant", content: "Bom dia" },
    );
    expect(result.at(-2)?.id).toBe("pending-u2");
    expect(result.at(-1)?.id).toBe("saved-a2");
  });

  it("bounds only the sent history, not the underlying stored history", () => {
    const history = Array.from({ length: 30 }, (_, index) => ({
      id: String(index), role: "assistant", content: "Texto",
    }));
    expect(buildStoryMemoryHistory(history,
      { id: "u", role: "user", content: "Pergunta" },
      { id: "a", role: "assistant", content: "Resposta" },
    )).toHaveLength(24);
    expect(history).toHaveLength(30);
  });
});

describe("Validated legacy memory fields", () => {
  it("accepts the three existing text columns without schema migration", () => {
    expect(readStoryMemoryJson('{"summary":"FATOS: Aline é designer","scene":"No escritório","known_facts":"Christopher ouviu a apresentação"}')).toEqual({
      summary: "FATOS: Aline é designer",
      scene: "No escritório",
      known_facts: "Christopher ouviu a apresentação",
    });
  });

  it("rejects invalid/malformed/oversized model output", () => {
    expect(readStoryMemoryJson("not JSON")).toBeNull();
    expect(readStoryMemoryJson("[]")).toBeNull();
    expect(readStoryMemoryJson('{"summary":"ok","scene":"ok"}')).toBeNull();
    expect(readStoryMemoryJson(JSON.stringify({ summary: "a".repeat(2401), scene: "", known_facts: "" }))).toBeNull();
  });
});
