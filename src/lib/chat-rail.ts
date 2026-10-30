import type { Character } from "@/lib/characters";

export type ChatRailItem = {
  id: string;
  characterId: string;
  characterName: string;
  imageUrl: string | null;
  avatar: string;
  storyTitle?: string;
  mode: "legacy" | "story";
  updatedAt: string;
};

export type RecentCharacter = { characterId: string; updatedAt: string };
export type RailStory = {
  id: string;
  character_id: string;
  title: string;
  updated_at: string;
  archived_at: string | null;
};

const newestFirst = (a: ChatRailItem, b: ChatRailItem) =>
  b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);

export function buildLegacyRailItems(
  characters: readonly Character[],
  recent: readonly RecentCharacter[],
  activeCharacterId?: string,
): ChatRailItem[] {
  const characterById = new Map(characters.map((character) => [character.id, character]));
  const result: ChatRailItem[] = [];
  for (const { characterId, updatedAt } of recent) {
    const character = characterById.get(characterId);
    if (!character) continue;
    result.push({
      id: character.id,
      characterId: character.id,
      characterName: character.name,
      imageUrl: character.image_url,
      avatar: character.avatar,
      mode: "legacy",
      updatedAt,
    });
  }
  result.sort(newestFirst);

  // A chat opened for the first time must remain accessible in the rail even
  // before the first message is persisted; it is NOT a newly created story.
  if (activeCharacterId && !result.some((item) => item.characterId === activeCharacterId)) {
    const character = characterById.get(activeCharacterId);
    if (character) {
      result.unshift({
        id: character.id, characterId: character.id, characterName: character.name,
        imageUrl: character.image_url, avatar: character.avatar, mode: "legacy", updatedAt: "",
      });
    }
  }
  return result;
}

export function buildStoryRailItems(
  characters: readonly Character[],
  stories: readonly RailStory[],
): ChatRailItem[] {
  const byId = new Map(characters.map((character) => [character.id, character]));
  return stories
    .filter((story) => !story.archived_at)
    .flatMap((story) => {
      const character = byId.get(story.character_id);
      return character ? [{
        id: story.id,
        characterId: character.id,
        characterName: character.name,
        imageUrl: character.image_url,
        avatar: character.avatar,
        storyTitle: story.title,
        mode: "story" as const,
        updatedAt: story.updated_at,
      }] : [];
    })
    .sort(newestFirst);
}

export function activeRailItem(pathname: string, item: ChatRailItem): boolean {
  if (item.mode === "story") return pathname === `/stories/${item.id}`;
  return pathname === `/chat/${item.characterId}`;
}

export function railNewConversationTarget(
  pathname: string,
  items: readonly ChatRailItem[],
  multiStoryEnabled: boolean,
): { kind: "dashboard" } | { kind: "library"; characterId: string } {
  if (!multiStoryEnabled) return { kind: "dashboard" };
  const active = items.find((item) => activeRailItem(pathname, item));
  return active ? { kind: "library", characterId: active.characterId } : { kind: "dashboard" };
}
