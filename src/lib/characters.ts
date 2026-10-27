import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Character = Database["public"]["Tables"]["characters"]["Row"];

export const SCENE_COMMANDS = [
  { id: "advance", label: "/Algo Acontece", description: "Introduza um desenvolvimento lógico que se encaixe na cena atual.", icon: "💗" },
  { id: "new-scene", label: "/Pular adiante", description: "Avance o tempo até a próxima cena interessante.", icon: "💗" },
  { id: "closer", label: "/Aproxime a gente", description: "Aprofunde a conexão por meio da vulnerabilidade, da confiança ou de um momento pessoal.", icon: "💗" },
  { id: "lead", label: "/Você lidera", description: "Inicie o que acontece em seguida.", icon: "💗" },
  { id: "emotion", label: "/Adicione uma emoção", description: "Introduza um risco ou perigo empolgante que se encaixe na cena atual.", icon: "💗" },
  { id: "admirer", label: "/Conheça um admirador", description: "Alguém novo aparece e se interessa por você.", icon: "💗" },
  { id: "luck", label: "/Rolagem da Sorte", description: "Role os dados — a sorte decide o que acontece em seguida.", icon: "💗" },
] as const;

export type SceneCommandId = (typeof SCENE_COMMANDS)[number]["id"];

export const commandMarker = (id: SceneCommandId) => `[[cmd:${id}]]`;

export function parseCommand(text: string) {
  const m = text.match(/^\[\[cmd:([a-z-]+)\]\]$/);
  if (!m) return null;
  return SCENE_COMMANDS.find((c) => c.id === m[1]) ?? null;
}

// Model-facing structure tags must never be shown as narrative text.
export function stripNarrativeControlTags(value: string): string {
  return value
    .replace(/<\/?(?:USER_TEXT|DIALOGUE|MENTAL_SPEECH|MEMORY_OR_DREAM|CHARACTER_CANON|CURRENT_STORY|STORY_BACKGROUND|STYLE_EXAMPLES|USER_PERSONA|STORY_MEMORY)(?:\s+[^<>]*?)?\s*\/?>/gi, "")
    .replace(/<\/?(?:thought|thinking)\s*>/gi, (tag) => tag.toLowerCase().startsWith("</") ? "</thought>" : "<thought>");
}

export type NarrativeSegment = { type: "body" | "thought"; text: string };

export function parseNarrativeSegments(text: string): NarrativeSegment[] {
  // The model sometimes closes a thought by repeating [pensamento] instead
  // of [/pensamento]. Parse marker pairs in their original order so both
  // forms render as a thought WITHOUT moving any part of the story.
  //
  // Unpaired openings are treated as ordinary body text, never as a thought
  // that would swallow all subsequent dialogue.
  const normalized = stripNarrativeControlTags(text);
  const markers = /\[\s*\/?\s*pensamento\s*\]|<\s*\/?\s*thought\s*>/gi;
  const segments: NarrativeSegment[] = [];
  let body = "";
  let thought = "";
  let insideThought = false;
  let cursor = 0;

  const emit = (type: NarrativeSegment["type"], value: string) => {
    const content = value.trim();
    if (!content) return;
    if (type === "body" && segments.at(-1)?.type === "body") {
      segments[segments.length - 1]!.text += "\n" + content;
    } else {
      segments.push({ type, text: content });
    }
  };

  for (const match of normalized.matchAll(markers)) {
    const position = match.index ?? cursor;
    if (insideThought) thought += normalized.slice(cursor, position);
    else body += normalized.slice(cursor, position);

    const marker = match[0];
    const closing = /^\[\s*\/|^<\s*\//i.test(marker);
    if (insideThought) {
      // Explicit closing marker OR a repeated opening marker: both close
      // the currently open thought; the second case fixes Gemini/Groq output.
      emit("thought", thought);
      thought = "";
      insideThought = false;
    } else if (!closing) {
      emit("body", body);
      body = "";
      insideThought = true;
    }
    // Ignore unmatched closing tokens; do not expose transport tags.
    cursor = position + marker.length;
  }

  if (insideThought) {
    // One orphan opening tag is not a thought. Preserve readable text
    // without exposing the tag or reinterpreting following dialogue.
    body += thought + normalized.slice(cursor);
  } else {
    body += normalized.slice(cursor);
  }
  emit("body", body);

  return segments.length ? segments : [{ type: "body", text: normalized.replace(markers, "").trim() }];
}

export const charactersQuery = queryOptions({
  queryKey: ["characters"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("characters")
      .select("*")
      .order("user_id", { nullsFirst: false })
      .order("created_at");
    if (error) throw error;
    return data;
  },
});

export const characterQuery = (id: string) =>
  queryOptions({
    queryKey: ["character", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("characters").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

export const messagesQuery = (characterId: string) =>
  queryOptions({
    queryKey: ["messages", characterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, role, content, reply_to_message_id")
        .eq("character_id", characterId)
        // Supabase returns at most 1,000 rows by default. Fetch newest first,
        // otherwise long stories display only old messages and appear to lose history.
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);
      if (error) throw error;
      return [...(data ?? [])].reverse();
    },
    staleTime: 0,
  });
