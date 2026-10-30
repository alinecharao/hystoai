import { describe, expect, it } from "vitest";
import { hasValidStoryIdentity, storyDestination } from "@/lib/stories";
describe("Independent story identity", () => {
  it("routes old conversations to the original chat, not to a new empty story", () => {
    expect(storyDestination({ id:"history-1",character_id:"chr-1",is_legacy:true })).toEqual({
      type:"legacy",characterId:"chr-1",
    });
  });
  it("separates two narratives with the same character by story ID", () => {
    const a=storyDestination({id:"story-a",character_id:"chr-1",is_legacy:false});
    const b=storyDestination({id:"story-b",character_id:"chr-1",is_legacy:false});
    expect(a).not.toEqual(b);
    expect(hasValidStoryIdentity("story-a","chr-1","story-a","chr-1")).toBe(true);
    expect(hasValidStoryIdentity("story-a","chr-1","story-b","chr-1")).toBe(false);
    expect(hasValidStoryIdentity("story-a","chr-2","story-a","chr-1")).toBe(false);
  });
});
