import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/personas")({
  head: () => ({ meta: [
    { title: "Personas — Hysto" },
    { name: "description", content: "Gerencie suas personas para as histórias do Hysto." },
    { property: "og:title", content: "Personas — Hysto" },
    { property: "og:description", content: "Gerencie suas personas para as histórias do Hysto." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PersonasPage,
});
type Persona = { id: string; name: string; description: string; photo_url: string; gender: string; age: number | null; role_description: string; likes: string; dislikes: string; boundaries: string; is_default: boolean };

function PersonasPage() {
  const { user } = Route.useRouteContext();
  const [items, setItems] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [likes, setLikes] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [boundaries, setBoundaries] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const reload = async () => {
    const { data, error: loadError } = await supabase.from("personas")
      .select("*").eq("user_id", user.id).order("created_at");
    setError(loadError?.message ?? "");
    if (!loadError) setItems((data ?? []) as Persona[]);
    setLoading(false);
  };
  useEffect(() => { void reload(); }, [user.id]);
  const edit = (persona?: Persona) => {
    setFormError("");
    setEditing(persona?.id ?? null);
    setName(persona?.name ?? "");
    setDescription(persona?.description ?? "");
    setPhotoUrl(persona?.photo_url ?? "");
    setPhotoFile(null);
    setPhotoPreview(null);
    setGender(persona?.gender ?? "");
    setAge(persona?.age?.toString() ?? "");
    setRoleDescription(persona?.role_description ?? persona?.description ?? "");
    setLikes(persona?.likes ?? "");
    setDislikes(persona?.dislikes ?? "");
    setBoundaries(persona?.boundaries ?? "");
    setIsDefault(persona?.is_default ?? false);
    setOpen(true);
  };
  const save = async () => {
    if (!name.trim() || saving) return;
    setFormError("");

    // Validate before uploading any file or changing the selected default.
    const parsedAge = age.trim() ? Number(age) : null;
    if (parsedAge !== null && (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120)) {
      setFormError("Informe uma idade válida entre 1 e 120 anos.");
      return;
    }
    if (photoFile && (!["image/jpeg", "image/png", "image/webp"].includes(photoFile.type) || photoFile.size > 5 * 1024 * 1024)) {
      setFormError("Escolha uma foto JPG, PNG ou WebP com até 5 MB.");
      return;
    }

    setSaving(true);
    let uploadedPath: string | null = null;
    let saved = false;
    let clearedOldDefault = false;
    const previousDefault = isDefault ? items.find((persona) => persona.is_default && persona.id !== editing) : null;

    try {
      let resolvedPhotoUrl = photoUrl.trim();
      if (photoFile) {
        const extension = photoFile.type === "image/png" ? "png" : photoFile.type === "image/webp" ? "webp" : "jpg";
        const path = user.id + "/" + crypto.randomUUID() + "." + extension;
        const { error: uploadError } = await supabase.storage.from("persona-photos")
          .upload(path, photoFile, { contentType: photoFile.type, upsert: false });
        if (uploadError) throw new Error("Falha no upload da foto: " + uploadError.message);
        uploadedPath = path;
        resolvedPhotoUrl = supabase.storage.from("persona-photos").getPublicUrl(path).data.publicUrl;
      }

      const payload = {
        name: name.trim(), description: roleDescription.trim(), photo_url: resolvedPhotoUrl,
        gender: gender.trim(), age: parsedAge, role_description: roleDescription.trim(),
        likes: likes.trim(), dislikes: dislikes.trim(), boundaries: boundaries.trim(),
        is_default: isDefault, user_id: user.id,
      };

      if (previousDefault) {
        const { error: unsetError } = await supabase.from("personas")
          .update({ is_default: false } as never).eq("id", previousDefault.id).eq("user_id", user.id);
        if (unsetError) throw unsetError;
        clearedOldDefault = true;
      }
      const query = editing
        ? supabase.from("personas").update(payload as never).eq("id", editing).eq("user_id", user.id)
        : supabase.from("personas").insert(payload as never);
      const { error: saveError } = await query;
      if (saveError) throw saveError;
      saved = true;
      setOpen(false);
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha de conexão ao salvar a persona.";
      let restoreError = "";
      // A failed save must not silently discard the previous default persona.
      if (!saved && clearedOldDefault && previousDefault) {
        try {
          const { error: rollbackError } = await supabase.from("personas")
            .update({ is_default: true } as never).eq("id", previousDefault.id).eq("user_id", user.id);
          if (rollbackError) restoreError = " Não foi possível restaurar a persona padrão anterior.";
        } catch {
          restoreError = " Não foi possível restaurar a persona padrão anterior.";
        }
      }
      if (!saved && uploadedPath) {
        try { await supabase.storage.from("persona-photos").remove([uploadedPath]); }
        catch (cleanupError) { console.warn("persona_photo_cleanup_failed", cleanupError); }
      }
      setFormError("Não foi possível salvar a persona. " + message + restoreError);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (persona: Persona) => {
    if (!confirm(`Excluir a persona "${persona.name}"? As conversas não serão apagadas.`)) return;
    const { error: deleteError } = await supabase.from("personas").delete().eq("id", persona.id).eq("user_id", user.id);
    if (deleteError) { setError(deleteError.message); return; }
    await reload();
  };
  return (
    <div className="h-full overflow-y-auto bg-background">
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-7 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div><h1 className="font-display text-3xl">Persona</h1><p className="text-sm text-muted-foreground">Crie e gerencie as protagonistas que você interpreta nas histórias.</p></div>
          <Button onClick={() => edit()}><Plus className="size-4" /> Nova persona</Button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {loading ? <p>Carregando personas...</p> : items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground"><UserRound className="mx-auto mb-3 size-8" />Nenhuma persona cadastrada. Você também pode jogar sem persona.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((persona) => (
              <article key={persona.id} className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-3">{persona.photo_url && <img src={persona.photo_url} alt="" className="size-14 rounded-full object-cover" />}<div><h2 className="font-semibold">{persona.name}</h2><p className="text-xs text-muted-foreground">{[persona.gender, persona.age ? `${persona.age} anos` : ""].filter(Boolean).join(" · ")} {persona.is_default ? "· Padrão" : ""}</p></div></div>
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{persona.role_description || persona.description || "Sem descrição."}</p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => edit(persona)}><Pencil className="size-4" /> Editar</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void remove(persona)}><Trash2 className="size-4" /> Excluir</Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogTitle>{editing ? "Editar persona" : "Nova persona"}</DialogTitle>
          <DialogDescription>Essas informações ajudam a IA a reconhecer sua protagonista, sem controlar suas ações.</DialogDescription>
          {formError && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{formError}</p>}
          <label className="block space-y-2 text-sm">Foto da persona
            <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
                setError("Escolha uma imagem JPG, PNG ou WebP de até 5 MB.");
                e.target.value = "";
                return;
              }
              setError("");
              setPhotoFile(file);
              setPhotoPreview(URL.createObjectURL(file));
            }} />
            <span className="block text-xs text-muted-foreground">JPG, PNG ou WebP, até 5 MB.</span>
          </label>
          {(photoPreview || photoUrl) && <img src={photoPreview || photoUrl} alt="Prévia da persona" className="size-20 rounded-full object-cover" />}
          <label className="space-y-1 text-sm">Ou use uma URL de imagem<Input value={photoUrl} onChange={(e) => { setPhotoUrl(e.target.value); setPhotoFile(null); setPhotoPreview(null); }} placeholder="https://..." /></label>
          <label className="space-y-1 text-sm">Nome<Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">Gênero<Input value={gender} onChange={(e) => setGender(e.target.value)} /></label>
            <label className="space-y-1 text-sm">Idade<Input type="number" min={1} max={120} value={age} onChange={(e) => setAge(e.target.value)} /></label>
          </div>
          <label className="space-y-1 text-sm">Função, personalidade e relação com o personagem<Textarea rows={5} maxLength={6000} value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} /></label>
          <label className="space-y-1 text-sm">Gostos<Textarea rows={3} value={likes} onChange={(e) => setLikes(e.target.value)} /></label>
          <label className="space-y-1 text-sm">Não gosta<Textarea rows={3} value={dislikes} onChange={(e) => setDislikes(e.target.value)} /></label>
          <label className="space-y-1 text-sm">Limites e restrições<Textarea rows={4} value={boundaries} onChange={(e) => setBoundaries(e.target.value)} /></label>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"><span>Usar como padrão nos novos chats</span><Switch checked={isDefault} onCheckedChange={setIsDefault} /></label>
          <Button disabled={saving || !name.trim()} onClick={() => void save()}>{saving ? "Salvando..." : "Salvar persona"}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
