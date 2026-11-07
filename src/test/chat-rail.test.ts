import { describe, expect, it } from "vitest";
import type { Character } from "@/lib/characters";
import {
  activeRailItem, buildLegacyRailItems, buildStoryRailItems,
  railNewConversationTarget,
} from "@/lib/chat-rail";

const characters = [
  { id: "chr-a", name: "Christopher", avatar: "🖤", image_url: null },
  { id: "chr-b", name: "Alden", avatar: "✨", image_url: "https://example.com/image.png" },
] as Character[];

describe("chat avatar navigation", () => {
  it("shows only characters with a saved chat and orders by last activity", () => {
    const items = buildLegacyRailItems(characters, [
      { characterId: "chr-a", updatedAt: "2026-10-29T09:00:00Z" },
      { characterId: "chr-b", updatedAt: "2026-10-30T11:00:00Z" },
      { characterId: "deleted", updatedAt: "2026-11-01T11:00:00Z" },
    ]);
    expect(items.map((item) => item.characterId)).toEqual(["chr-b", "chr-a"]);
    expect(items.every((item) => item.mode === "legacy")).toBe(true);
  });

  it("keeps the just-opened character visible without claiming a new conversation was created", () => {
    const items = buildLegacyRailItems(characters, [], "chr-a");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ characterId: "chr-a", updatedAt: "", mode: "legacy" });
  });

  it("identifies two stories from the same character as separate destinations", () => {
    const items = buildStoryRailItems(characters, [
      { id: "story-a", character_id: "chr-a", title: "Um começo", archived_at: null, updated_at: "2026-10-30T10:00:00Z" },
      { id: "story-b", character_id: "chr-a", title: "Outro caminho", archived_at: null, updated_at: "2026-10-30T11:00:00Z" },
      { id: "old", character_id: "chr-b", title: "Arquivada", archived_at: "2026-10-30T12:00:00Z", updated_at: "2026-10-30T12:00:00Z" },
    ]);
    expect(items.map((item) => item.id)).toEqual(["story-b", "story-a"]);
    expect(items.map((item) => item.storyTitle)).toEqual(["Outro caminho", "Um começo"]);
    expect(activeRailItem("/stories/story-a", items[1]!)).toBe(true);
    expect(activeRailItem("/stories/story-b", items[1]!)).toBe(false);
  });

  it("never creates another chat when multi-story mode is not activated", () => {
    const legacy = buildLegacyRailItems(characters, [], "chr-a");
    expect(railNewConversationTarget("/chat/chr-a", legacy, false)).toEqual({ kind: "dashboard" });
    expect(railNewConversationTarget("/stories/story-a", [], true)).toEqual({ kind: "dashboard" });
    const stories = buildStoryRailItems(characters, [
      { id: "story-a", character_id: "chr-a", title: "Uma história", archived_at: null, updated_at: "" },
    ]);
    expect(railNewConversationTarget("/stories/story-a", stories, true)).toEqual({ kind: "library", characterId: "chr-a" });
  });
});
