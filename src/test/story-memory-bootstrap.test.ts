import { describe, expect, it } from "vitest";
import {
  MEMORY_BOOTSTRAP_MAX_TURNS,
  prepareMemoryBootstrapTurns,
  classifyMemoryCheckpoint,
} from "@/lib/story-memory-bootstrap";

describe("manual story memory bootstrap", () => {
  it("retains recent turn order, message ID and role while truncating long content explicitly", () => {
    const turns = [
      { id: "a2", role: "assistant", content: "fim" },
      { id: "u2", role: "user", content: "X".repeat(800) },
      { id: "a1", role: "assistant", content: "início" },
    ];
    const result = prepareMemoryBootstrapTurns(turns, false);
    expect(result.turns.map((t) => t.id)).toEqual(["a1", "u2", "a2"]);
    expect(result.turns[1]?.content).toContain("[TRECHO OMITIDO]");
    expect(result.turns[1]?.content.length).toBeLessThan(450);
    expect(result.partial).toBe(false);
    expect(turns[1]?.content).toHaveLength(800);
  });

  it("never claims a full history when older turns are known to exist", () => {
    const rows = Array.from({ length: MEMORY_BOOTSTRAP_MAX_TURNS + 1 }, (_, i) => ({
      id: String(i), role: "user", content: "texto",
    }));
    const result = prepareMemoryBootstrapTurns(rows, true);
    expect(result.partial).toBe(true);
    expect(result.turns).toHaveLength(MEMORY_BOOTSTRAP_MAX_TURNS);
    expect(result.turns.at(-1)?.id).toBe("0");
  });
});

describe("memory card reason", () => {
  it("distinguishes absence, deleted origin, an abandoned answer and a valid row", () => {
    expect(classifyMemoryCheckpoint(false, null, false, false)).toBe("missing");
    expect(classifyMemoryCheckpoint(true, "a", false, false)).toBe("checkpoint_missing");
    expect(classifyMemoryCheckpoint(true, "a", true, true)).toBe("alternative_selected");
    expect(classifyMemoryCheckpoint(true, "a", true, false)).toBe("ready");
  });
});
