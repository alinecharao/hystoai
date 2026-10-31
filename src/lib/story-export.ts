import { supabase } from "@/integrations/supabase/client";

export type ExportMessage = { id: string; role: string; content: string; created_at: string; reply_to_message_id: string | null; client_message_id: string | null };
export type ExportVersion = { id: string; assistant_message_id: string; content: string; is_selected: boolean; created_at: string };
export type ExportNote = { id: string; category: string; body: string; source_message_id: string | null };
export type ExportCheckpoint = {
  summary: string;
  scene: string;
  known_facts: string;
  last_processed_message_id: string | null;
  updated_at: string;
};
export type StoryExport = {
  schema: "hysto-story-export-v1" | "hysto-story-export-v2";
  exported_at: string;
  character: { id: string; name: string };
  story_id?: string;
  story?: { id: string; title: string; is_legacy: boolean; archived_at: string | null };
  memory_checkpoint?: ExportCheckpoint | null;
  messages: ExportMessage[];
  assistant_versions: ExportVersion[];
  curated_notes: ExportNote[];
};

const PAGE_SIZE = 400;
const MAX_PAGES = 100;

/** Always paginate oldest-to-newest and fail rather than silently truncate. */
export async function readStoryExport(
  userId: string,
  character: { id: string; name: string },
  storyId?: string,
): Promise<StoryExport> {
  const snapshotAt = new Date().toISOString();
  const messages: ExportMessage[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    let query=supabase.from("messages")
      .select("id, role, content, created_at, reply_to_message_id, client_message_id")
      .eq("user_id",userId).eq("character_id",character.id)
      .lte("created_at",snapshotAt);
    if(storyId)query=query.eq("story_id",storyId);
    const {data,error}=await query.order("created_at",{ascending:true})
      .order("id",{ascending:true}).range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
    if (error) throw new Error("Falha ao consultar o histórico completo para exportação.");
    messages.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) {
      throw new Error("A história excede o limite seguro de exportação. Nenhum arquivo incompleto será gerado.");
    }
  }
  // A JSON export must also retain the selected story identity and its
  // consolidated memory. Never silently produce a "complete" export after
  // an unreadable memory row or a missing requested story.
  let storyMetadata: StoryExport["story"];
  if (storyId) {
    const { data, error } = await supabase.from("stories")
      .select("id, title, is_legacy, archived_at")
      .eq("id", storyId).eq("user_id", userId)
      .eq("character_id", character.id).single();
    if (error || !data) throw new Error("Falha ao incluir os dados da história na exportação.");
    storyMetadata = data;
  }
  const memoryTable = storyId ? "story_memory_checkpoints" : "story_memories";
  let memoryQuery = supabase.from(memoryTable)
    .select("summary, scene, known_facts, last_processed_message_id, updated_at")
    .eq("user_id", userId).eq("character_id", character.id);
  if (storyId) memoryQuery = memoryQuery.eq("story_id", storyId);
  const { data: memoryCheckpoint, error: memoryError } = await memoryQuery.maybeSingle();
  if (memoryError) throw new Error("Falha ao incluir a memória consolidada na exportação.");

  const assistantIds = messages.filter((item) => item.role === "assistant").map((item) => item.id);
  const assistantVersions: ExportVersion[] = [];
  for (let start = 0; start < assistantIds.length; start += 100) {
    let query=supabase.from("assistant_response_versions")
      .select("id, assistant_message_id, content, is_selected, created_at")
      .eq("user_id",userId).eq("character_id",character.id)
      .in("assistant_message_id",assistantIds.slice(start,start+100));
    if(storyId)query=query.eq("story_id",storyId);
    const {data,error}=await query.order("created_at",{ascending:true}).order("id",{ascending:true});
    if (error) throw new Error("Falha ao incluir as versões alternativas; exportação interrompida.");
    assistantVersions.push(...(data ?? []));
  }
  let curatedNotes: ExportNote[] = [];
  if (messages[0]) {
    let query=supabase.from("story_memory_notes")
      .select("id, category, body, source_message_id")
      .eq("user_id",userId).eq("character_id",character.id)
      .eq("anchor_message_id",messages[0].id);
    if(storyId)query=query.eq("story_id",storyId);
    const {data,error}=await query.order("created_at",{ascending:true}).order("id",{ascending:true});
    if (error) throw new Error("Falha ao incluir as memórias manuais; exportação interrompida.");
    curatedNotes = data ?? [];
  }
  return {
    schema: "hysto-story-export-v2",
    exported_at: snapshotAt,
    character,
    ...(storyId && storyMetadata ? { story_id: storyId, story: storyMetadata } : {}),
    memory_checkpoint: memoryCheckpoint,
    messages,
    assistant_versions: assistantVersions,
    curated_notes: curatedNotes,
  };
}

export function formatStoryAsText(snapshot: StoryExport): string {
  const chosen = new Map(
    snapshot.assistant_versions.filter((version) => version.is_selected)
      .map((version) => [version.assistant_message_id, version.content]),
  );
  const output: string[] = [
    `HYSTO — ${snapshot.character.name}`,
    ...(snapshot.story?.title ? [`História: ${snapshot.story.title}`] : []),
    `Exportado em: ${snapshot.exported_at}`,
    `Mensagens: ${snapshot.messages.length}`,
    "Texto reflete a versão selecionada de cada resposta.",
    "Para conservar TODAS as versões alternativas, exporte também o arquivo JSON.",
    "",
  ];
  for (const message of snapshot.messages) {
    output.push(`--- ${message.created_at} | ${message.role === "user" ? "Você" : snapshot.character.name} ---`);
    output.push(chosen.get(message.id) ?? message.content);
    output.push("");
  }
  if (snapshot.curated_notes.length) {
    output.push("--- MEMÓRIA MANUAL ---");
    for (const note of snapshot.curated_notes) output.push(`[${note.category}] ${note.body}`);
  }
  if (snapshot.memory_checkpoint) {
    output.push("");
    output.push("--- MEMÓRIA CONSOLIDADA ---");
    output.push(snapshot.memory_checkpoint.summary || "Sem resumo.");
    output.push("--- CENA ATUAL ---");
    output.push(snapshot.memory_checkpoint.scene || "Não registrada.");
    output.push("--- CONHECIMENTO DOS PERSONAGENS ---");
    output.push(snapshot.memory_checkpoint.known_facts || "Não registrado.");
  }
  return output.join("\n");
}

export function saveStoryExportFile(snapshot: StoryExport, format: "txt" | "json"): void {
  const safeName = snapshot.character.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 55) || "historia";
  const text = format === "json" ? JSON.stringify(snapshot, null, 2) : formatStoryAsText(snapshot);
  const blob = new Blob([text], { type: format === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const element = document.createElement("a");
  element.href = url;
  element.download = `hysto-${safeName}-${snapshot.exported_at.slice(0, 10)}.${format}`;
  document.body.appendChild(element);
  element.click();
  element.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
