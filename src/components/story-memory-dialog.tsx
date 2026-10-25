import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Brain, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { classifyMemoryCheckpoint, type BootstrapStatus } from "@/lib/story-memory-bootstrap";
import { CuratedMemoryPanel, type MemoryMessageSelection } from "@/components/curated-memory-panel";

type MemoryLookup = { status: BootstrapStatus; memory: StoryMemoryRow | null };

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
  latestSavedRole,
  selectedMessage,
  onSelectionConsumed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: string;
  userId: string;
  latestSavedMessageId: string | null;
  responseVersionsEnabled: boolean;
  latestSavedRole: string | null;
  selectedMessage: MemoryMessageSelection;
  onSelectionConsumed: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { data: lookup, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["story-memory", characterId, userId, responseVersionsEnabled],
    enabled: open,
    staleTime: 0,
    queryFn: async (): Promise<MemoryLookup> => {
      const { data, error } = await supabase.from("story_memories")
        .select("summary, scene, known_facts, last_processed_message_id, updated_at")
        .eq("character_id", characterId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.last_processed_message_id) return { status: "missing", memory: null };
      // A cleared/new story or deleted checkpoint must never display
      // continuity facts from a past conversation with the same character.
      const { data: anchor, error: anchorError } = await supabase.from("messages")
        .select("id, role")
        .eq("id", data.last_processed_message_id)
        .eq("user_id", userId)
        .eq("character_id", characterId)
        .maybeSingle();
      if (anchorError) throw anchorError;
      if (anchor?.role !== "assistant") return { status: "checkpoint_missing", memory: null };
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
        if (discardedOriginal) return { status: "alternative_selected", memory: null };
      }
      return { status: classifyMemoryCheckpoint(true, data.last_processed_message_id, true, false), memory: data };
    },
  });
  const data = lookup?.memory;
  const showCurrentScene = Boolean(
    latestSavedMessageId && data?.last_processed_message_id === latestSavedMessageId,
  );
  const needsBootstrap = Boolean(lookup && lookup.status !== "ready");
  const generateMemory = async () => {
    if (creating || isFetching || latestSavedRole !== "assistant") return;
    if (!window.confirm(
      "Criar memória a partir das últimas 36 mensagens? Em histórias maiores, o resumo será parcial e poderá consumir sua cota de IA. Nenhuma mensagem será apagada.",
    )) return;
    setCreating(true);
    setCreateError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/story-memory", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      const result = await response.json() as { ok?: boolean; error?: string; partial?: boolean };
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Não foi possível gerar a memória.");
      }
      await refetch();
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : "Não foi possível criar a memória.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden">
        <DialogTitle className="flex items-center gap-2"><Brain className="size-5" /> Memória da história</DialogTitle>
        <DialogDescription>
          Escolha os fatos que merecem ser lembrados. As notas manuais são salvas sem usar IA;
          resumos automáticos são opcionais e podem consumir créditos.
        </DialogDescription>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2">
          <CuratedMemoryPanel
            open={open}
            characterId={characterId}
            userId={userId}
            selectedMessage={selectedMessage}
            onSelectionConsumed={onSelectionConsumed}
          />
          <div className="border-t border-border/60 pt-3">
            <h3 className="mb-2 text-sm font-semibold">Resumo automático (opcional, usa IA)</h3>
          {isPending && <p className="text-sm text-muted-foreground">Carregando memória...</p>}
          {error && <p className="text-sm text-destructive">Não foi possível ler a memória. A história foi preservada.</p>}
          {!isPending && !error && needsBootstrap && (
            <p className="text-sm text-muted-foreground">
              {lookup?.status === "checkpoint_missing"
                ? "Existe um resumo antigo, mas a mensagem que o originou não está mais no histórico. Ele não será reutilizado."
                : lookup?.status === "alternative_selected"
                  ? "O resumo salvo pertence a uma resposta substituída. Ele foi ocultado para não misturar versões da história."
                  : "Ainda não existe um resumo de memória salvo para esta conversa. Recarregar não cria uma nova memória."}
            </p>
          )}
          {createError && <p role="alert" className="text-sm text-destructive">{createError}</p>}
          {needsBootstrap && latestSavedRole !== "assistant" && (
            <p className="text-xs text-muted-foreground">Conclua a mensagem pendente antes de criar a memória.</p>
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
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {needsBootstrap && (
            <Button type="button" size="sm" disabled={creating || isFetching || latestSavedRole !== "assistant"}
              onClick={() => void generateMemory()}>
              <Brain className="size-4" /> {creating ? "Criando memória..." : "Gerar resumo com IA"}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" disabled={isFetching || creating}
            onClick={() => { setCreateError(null); void refetch(); }}>
            <RefreshCw className="size-4" /> Recarregar ficha
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
