import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Story = Database["public"]["Tables"]["stories"]["Row"];

export const storiesForCharacterQuery = (userId: string, characterId: string) => queryOptions({
  queryKey: ["stories", userId, characterId],
  queryFn: async () => {
    const { data, error } = await supabase.from("stories")
      .select("*").eq("user_id", userId).eq("character_id", characterId)
      .order("updated_at", { ascending: false }).order("id", { ascending: false });
    if (error) throw error;
    return data;
  },
  staleTime: 0,
});

export const storyQuery = (userId: string, storyId: string) => queryOptions({
  queryKey: ["story", userId, storyId],
  queryFn: async () => {
    const { data, error } = await supabase.from("stories")
      .select("*").eq("id", storyId).eq("user_id", userId).single();
    if (error) throw error;
    return data;
  },
});

export const storyMessagesQuery = (userId: string, storyId: string) => queryOptions({
  queryKey: ["story-messages", userId, storyId],
  queryFn: async () => {
    const { data, error } = await supabase.from("messages")
      .select("id, role, content, reply_to_message_id")
      .eq("user_id", userId).eq("story_id", storyId)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(100);
    if (error) throw error;
    return [...(data ?? [])].reverse();
  },
  staleTime: 0,
});

/** New stories never clone messages or notes from the source character. */
export async function createIndependentStory(userId: string, characterId: string, title: string): Promise<Story> {
  const cleaned = title.trim();
  if (cleaned.length < 1 || cleaned.length > 100) throw new Error("Digite um título de até 100 caracteres.");
  const { data, error } = await supabase.from("stories")
    .insert({ user_id: userId, character_id: characterId, title: cleaned, is_legacy: false })
    .select("*").single();
  if (error || !data) throw new Error("Não foi possível criar a história.");
  return data;
}

export function storyDestination(story: Pick<Story, "id" | "character_id" | "is_legacy">) {
  return story.is_legacy
    ? { type: "legacy" as const, characterId: story.character_id }
    : { type: "independent" as const, storyId: story.id };
}

export function hasValidStoryIdentity(storyId: string, characterId: string, expectedStoryId: string, expectedCharacterId: string): boolean {
  return storyId === expectedStoryId && characterId === expectedCharacterId;
}
