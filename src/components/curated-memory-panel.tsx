import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookMarked, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  CURATED_NOTE_CATEGORIES, CURATED_NOTE_LABELS, CURATED_NOTE_LENGTH,
  CURATED_NOTE_LIMIT, validateCuratedNote, type CuratedCategory, type CuratedNote,
} from "@/lib/curated-story-memory";

export type MemoryMessageSelection = { id: string; text: string } | null;

export function CuratedMemoryPanel({
  characterId, userId, open, selectedMessage, onSelectionConsumed,
}: {
  characterId: string;
  userId: string;
  open: boolean;
  selectedMessage: MemoryMessageSelection;
  onSelectionConsumed: () => void;
}) {
  const qc = useQueryClient();
  const [noteId, setNoteId] = useState<string | null>(null);
  const [category, setCategory] = useState<CuratedCategory>("fact");
  const [body, setBody] = useState("");
  const [sourceMessageId, setSourceMessageId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: anchor, error: anchorError, isPending: anchorPending } = useQuery({
    queryKey: ["story-notes-anchor", characterId, userId],
    enabled: open,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("messages")
        .select("id").eq("user_id", userId).eq("character_id", characterId)
        .order("created_at", { ascending: true }).order("id", { ascending: true })
        .limit(1).maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });

  const { data: notes = [], error: notesError, isPending: notesPending } = useQuery({
    queryKey: ["story-curated-notes", characterId, userId, anchor],
    enabled: open && Boolean(anchor),
    staleTime: 0,
    queryFn: async (): Promise<CuratedNote[]> => {
      if (!anchor) return [];
      const { data, error } = await supabase.from("story_memory_notes")
        .select("id, category, body, source_message_id, created_at")
        .eq("user_id", userId).eq("character_id", characterId)
        .eq("anchor_message_id", anchor)
        .order("created_at", { ascending: true }).order("id", { ascending: true })
        .limit(CURATED_NOTE_LIMIT + 1);
      if (error) throw error;
      return (data ?? []) as CuratedNote[];
    },
  });

  useEffect(() => {
    if (!open || !selectedMessage) return;
    const excerpt = selectedMessage.text.trim();
    setNoteId(null);
    setBody(excerpt.length <= CURATED_NOTE_LENGTH ? excerpt : "");
    setSourceMessageId(selectedMessage.id);
    setCategory("fact");
    setFormError(null);
    setEditing(true);
    onSelectionConsumed();
  }, [open, selectedMessage, onSelectionConsumed]);

  const reset = () => {
    setNoteId(null);
    setBody("");
    setCategory("fact");
    setSourceMessageId(null);
    setFormError(null);
    setEditing(false);
  };
  const editExisting = (note: CuratedNote) => {
    setNoteId(note.id);
    setCategory(note.category);
    setBody(note.body);
    setSourceMessageId(note.source_message_id);
    setFormError(null);
    setEditing(true);
  };
  const save = async () => {
    if (!anchor || saving) return;
    const content = validateCuratedNote(body);
    if (!content) {
      setFormError(`Escreva uma informação de 1 a ${CURATED_NOTE_LENGTH} caracteres.`);
      return;
    }
    if (!noteId && notes.length >= CURATED_NOTE_LIMIT) {
      setFormError(`Limite de ${CURATED_NOTE_LIMIT} fatos atingido. Edite ou remova um antes de adicionar outro.`);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const now = new Date().toISOString();
      if (noteId) {
        const { data, error } = await supabase.from("story_memory_notes")
          .update({ category, body: content, updated_at: now })
          .eq("id", noteId).eq("user_id", userId)
          .eq("character_id", characterId).eq("anchor_message_id", anchor)
          .select("id").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Esta anotação não está mais disponível. Recarregue a ficha.");
      } else {
        const { error } = await supabase.from("story_memory_notes").insert({
          user_id: userId, character_id: characterId,
          anchor_message_id: anchor, source_message_id: sourceMessageId,
          category, body: content,
        });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["story-curated-notes", characterId, userId] });
      reset();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível salvar a nota.");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (note: CuratedNote) => {
    if (!anchor || saving || !window.confirm("Excluir apenas este fato da memória? O histórico permanecerá intacto.")) return;
    setSaving(true);
    setFormError(null);
    try {
      const { error } = await supabase.from("story_memory_notes").delete()
        .eq("id", note.id).eq("user_id", userId)
        .eq("character_id", characterId).eq("anchor_message_id", anchor);
      if (error) throw error;
      if (noteId === note.id) reset();
      await qc.invalidateQueries({ queryKey: ["story-curated-notes", characterId, userId] });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível remover a nota.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-primary/30 bg-card/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><BookMarked className="size-4" /> Memórias escolhidas por você</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Só o que você salvar aqui entra como memória manual. Não consome créditos de IA.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={saving || !anchor || notes.length >= CURATED_NOTE_LIMIT}
          onClick={() => { reset(); setEditing(true); }}>
          <Plus className="size-3.5" /> Adicionar
        </Button>
      </div>
      {(anchorPending || (anchor && notesPending)) && <p className="text-xs text-muted-foreground">Carregando suas anotações...</p>}
      {anchorError && <p className="text-xs text-destructive">Não foi possível verificar esta conversa.</p>}
      {!anchorPending && !anchor && !anchorError && (
        <p className="text-xs text-muted-foreground">Envie a primeira mensagem da história para começar a guardar fatos.</p>
      )}
      {notesError && (
        <p role="alert" className="text-xs text-destructive">
          Memória manual indisponível neste ambiente. É necessário instalar a migração story_memory_notes no banco de testes antes de usar.
        </p>
      )}
      {anchor && !notesError && !notesPending && notes.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum fato selecionado. Você controla o que merece ser lembrado.</p>
      )}
      {!notesError && notes.map((note) => (
        <div key={note.id} className="rounded-lg border border-border/50 bg-background/40 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-muted-foreground">{CURATED_NOTE_LABELS[note.category]}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{note.body}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button aria-label="Editar fato" title="Editar fato" variant="ghost" size="icon" className="size-7"
                disabled={saving} onClick={() => editExisting(note)}><Pencil className="size-3.5" /></Button>
              <Button aria-label="Remover fato" title="Remover fato" variant="ghost" size="icon" className="size-7 text-destructive"
                disabled={saving} onClick={() => void remove(note)}><Trash2 className="size-3.5" /></Button>
            </div>
          </div>
        </div>
      ))}
      {editing && anchor && !notesError && (
        <div className="space-y-2 rounded-lg border border-primary/40 p-3">
          <p className="text-sm font-semibold">{noteId ? "Editar memória" : "Guardar informação"}</p>
          <Select value={category} onValueChange={(value) => setCategory(value as CuratedCategory)}>
            <SelectTrigger aria-label="Tipo de memória" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURATED_NOTE_CATEGORIES.map((item) => (
                <SelectItem key={item} value={item}>{CURATED_NOTE_LABELS[item]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea value={body} maxLength={CURATED_NOTE_LENGTH} onChange={(e) => setBody(e.target.value)}
            rows={3} placeholder="Ex.: Christopher só sabe que Aline trabalha na Sonne porque ela contou." />
          <p className="text-right text-[11px] text-muted-foreground">{body.length}/{CURATED_NOTE_LENGTH}</p>
          {formError && <p role="alert" className="text-xs text-destructive">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={reset}>Cancelar</Button>
            <Button type="button" size="sm" disabled={saving || !validateCuratedNote(body)} onClick={() => void save()}>
              {saving ? "Salvando..." : "Salvar na memória"}
            </Button>
          </div>
        </div>
      )}
      {formError && !editing && <p role="alert" className="text-xs text-destructive">{formError}</p>}
      <p className="text-[11px] text-muted-foreground">
        Até {CURATED_NOTE_LIMIT} anotações por história. Se apagar o começo da conversa ou iniciar outra história,
        estas notas não serão inseridas automaticamente no novo contexto.
      </p>
    </section>
  );
}
