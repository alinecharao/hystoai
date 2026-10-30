import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { BookOpen, Plus, Archive, Pencil, ArrowLeft, RotateCcw } from "lucide-react";
import { useState } from "react";
import { characterQuery } from "@/lib/characters";
import { createIndependentStory, storiesForCharacterQuery, type Story } from "@/lib/stories";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/library/$characterId")({
  loader: async ({ context, params }) => {
    if (import.meta.env["VITE_HYSTO_MULTI_STORIES"] !== "true") throw redirect({ to:"/dashboard" });
    await Promise.all([
      context.queryClient.ensureQueryData(characterQuery(params.characterId)),
      context.queryClient.fetchQuery(storiesForCharacterQuery(context.user.id,params.characterId)),
    ]);
  },
  component: LibraryPage,
});

function LibraryPage() {
  const { characterId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const { data: character } = useSuspenseQuery(characterQuery(characterId));
  const { data: stories } = useSuspenseQuery(storiesForCharacterQuery(user.id,characterId));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [creating,setCreating] = useState(false);
  const [title,setTitle] = useState("");
  const [saving,setSaving] = useState(false);
  const [renaming,setRenaming] = useState<string | null>(null);
  const [renameText,setRenameText] = useState("");
  const [showArchived,setShowArchived] = useState(false);
  const [error,setError] = useState<string | null>(null);
  const refresh=()=>qc.invalidateQueries({queryKey:["stories",user.id,characterId]});

  async function createStory() {
    if(saving)return;
    setSaving(true);setError(null);
    try {
      const story = await createIndependentStory(user.id, characterId, title || "Nova história");
      await refresh();
      navigate({to:"/stories/$storyId",params:{storyId:story.id}});
    } catch(err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a história.");
    } finally {setSaving(false);}
  }

  async function updateStory(story: Story, values: Partial<Pick<Story,"title"|"archived_at">>) {
    if(saving)return;
    setSaving(true);setError(null);
    try {
      const {data, error:writeError}=await supabase.from("stories")
        .update({...values,updated_at:new Date().toISOString()})
        .eq("id",story.id).eq("user_id",user.id)
        .eq("character_id",characterId).select("id").maybeSingle();
      if(writeError)throw writeError;
      if(!data)throw new Error("Esta história não está mais disponível.");
      await refresh();
      setRenaming(null);
    } catch(err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a história.");
    } finally {setSaving(false);}
  }

  const filtered=stories.filter(story=>showArchived || !story.archived_at);

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-4 py-7 sm:px-8">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4"/> Voltar
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-primary">Histórias independentes</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">{character.name}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Cada história tem suas próprias mensagens, memórias, respostas alternativas e rascunhos.
            Sua conversa original permanece preservada.
          </p>
        </div>
        <Button onClick={()=>setCreating(value=>!value)} variant="outline">
          <Plus className="size-4"/> Nova história
        </Button>
      </div>

      {creating && (
        <div className="mt-5 rounded-xl border border-primary/30 bg-card p-4">
          <label className="text-sm font-medium" htmlFor="new-story-title">Título da história</label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input id="new-story-title" maxLength={100} placeholder="Ex.: Um novo começo"
              value={title} onChange={event=>setTitle(event.target.value)} className="min-w-48 flex-1"/>
            <Button disabled={saving} onClick={()=>void createStory()}>
              {saving?"Criando...":"Criar história"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Não copia mensagens nem memórias de outra narrativa.
          </p>
        </div>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

      <label className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>
        Mostrar histórias arquivadas
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {filtered.map((story)=>(
          <div key={story.id} className="rounded-2xl border border-border bg-card p-4">
            {renaming===story.id ? (
              <div className="flex gap-2">
                <Input maxLength={100} value={renameText} onChange={e=>setRenameText(e.target.value)}/>
                <Button disabled={saving||!renameText.trim()} size="sm" onClick={()=>void updateStory(story,{title:renameText.trim()})}>Salvar</Button>
                <Button variant="ghost" size="sm" onClick={()=>setRenaming(null)}>Cancelar</Button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{story.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {story.is_legacy ? "Conversa original preservada" : "Narrativa independente"}
                    {story.archived_at?" · Arquivada":""}
                  </p>
                </div>
                <BookOpen className="size-5 text-primary"/>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Última atividade: {new Date(story.updated_at).toLocaleDateString("pt-BR")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {!story.archived_at && <Button asChild size="sm">
                <Link to="/stories/$storyId" params={{storyId:story.id}}>Continuar</Link>
              </Button>}
              <Button variant="ghost" size="sm" onClick={()=>{setRenaming(story.id);setRenameText(story.title);}}>
                <Pencil className="size-4"/> Renomear
              </Button>
              <Button variant="ghost" size="sm" disabled={saving}
                onClick={()=>void updateStory(story,{archived_at:story.archived_at?null:new Date().toISOString()})}>
                {story.archived_at?<RotateCcw className="size-4"/>:<Archive className="size-4"/>}
                {story.archived_at?"Restaurar":"Arquivar"}
              </Button>
            </div>
          </div>
        ))}
      </div>
      {!filtered.length&&<p className="mt-8 text-sm text-muted-foreground">
        Nenhuma história nesta seção. Crie uma nova narrativa para começar.
      </p>}
    </div>
  );
}
