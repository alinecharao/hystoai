import { useQuery } from "@tanstack/react-query";
import { Brain, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type StoryMemoryRow = {
  summary: string;
  scene: string;
  known_facts: string;
  last_processed_message_id: string | null;
  updated_at: string;
};

function MemorySection({ title, content, empty }: { title: string; content: string; empty: string }) {
  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-3">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
        {content.trim() || empty}
      </p>
    </section>
  );
}

/** Read-only inspection of the existing memory row. Does not change story events. */
export function StoryMemoryDialog({
  open,
  onOpenChange,
  characterId,
  userId,
  latestSavedMessageId,
  responseVersionsEnabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: string;
  userId: string;
  latestSavedMessageId: string | null;
  responseVersionsEnabled: boolean;
}) {
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["story-memory", characterId, userId, responseVersionsEnabled],
    enabled: open,
    staleTime: 0,
    queryFn: async (): Promise<StoryMemoryRow | null> => {
      const { data, error } = await supabase.from("story_memories")
        .select("summary, scene, known_facts, last_processed_message_id, updated_at")
        .eq("character_id", characterId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.last_processed_message_id) return null;
      // A cleared/new story or deleted checkpoint must never display
      // continuity facts from a past conversation with the same character.
      const { data: anchor, error: anchorError } = await supabase.from("messages")
        .select("id, role")
        .eq("id", data.last_processed_message_id)
        .eq("user_id", userId)
        .eq("character_id", characterId)
        .maybeSingle();
      if (anchorError) throw anchorError;
      if (anchor?.role !== "assistant") return null;
      if (responseVersionsEnabled) {
        const { data: discardedOriginal, error: versionError } = await supabase
          .from("assistant_response_versions")
          .select("id")
          .eq("assistant_message_id", anchor.id)
          .eq("user_id", userId)
          .eq("character_id", characterId)
          .eq("is_selected", true)
          .maybeSingle();
        if (versionError) throw versionError;
        if (discardedOriginal) return null;
      }
      return data;
    },
  });
  const showCurrentScene = Boolean(
    latestSavedMessageId && data?.last_processed_message_id === latestSavedMessageId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden">
        <DialogTitle className="flex items-center gap-2"><Brain className="size-5" /> Memória da história</DialogTitle>
        <DialogDescription>
          Resumo automático desta conversa. Informações não confirmadas pelo histórico não devem ser tratadas como fatos.
          Esta visualização não edita suas mensagens.
        </DialogDescription>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2">
          {isPending && <p className="text-sm text-muted-foreground">Carregando memória...</p>}
          {error && <p className="text-sm text-destructive">Não foi possível ler a memória. A história foi preservada.</p>}
          {!isPending && !error && !data && (
            <p className="text-sm text-muted-foreground">Ainda não há memória consolidada para esta conversa.</p>
          )}
          {!isPending && !error && data && (
            <>
              <MemorySection title="Fatos e linha do tempo" content={data.summary} empty="Nenhum fato duradouro registrado." />
              <MemorySection title="Conhecimento dos personagens" content={data.known_facts} empty="Nenhum conhecimento individual registrado." />
              <MemorySection
                title="Cena atual"
                content={showCurrentScene ? data.scene : ""}
                empty={showCurrentScene ? "Cena ainda não registrada." : "A cena avançou desde este registro; consulte as mensagens recentes."}
              />
              <p className="text-xs text-muted-foreground">
                Último registro: {new Date(data.updated_at).toLocaleString("pt-BR")}
              </p>
            </>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" disabled={isFetching}
          onClick={() => void refetch()} className="shrink-0 self-start">
          <RefreshCw className="size-4" /> Atualizar memória
        </Button>
      </DialogContent>
    </Dialog>
  );
}
