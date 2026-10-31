import { useEffect, useState } from "react";
import { Film, ImageIcon, Download, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { buildVisualPrompt, type VisualAnchor, type VisualAspectRatio, type VisualType } from "@/lib/visual-capture";

type Props={
  open:boolean;
  onOpenChange:(open:boolean)=>void;
  type:VisualType;
  anchor:VisualAnchor|null;
  characterName:string;
  characterId:string;
  storyId?:string;
};

export function VisualCaptureDialog({
  open,onOpenChange,type,anchor,characterName,characterId,storyId,
}:Props){
  const [prompt,setPrompt]=useState("");
  const [aspectRatio,setAspectRatio]=useState<VisualAspectRatio>("16:9");
  const [available,setAvailable]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [result,setResult]=useState<{mimeType:string;data:string}|null>(null);
  const [checking,setChecking]=useState(false);

  useEffect(()=>{
    if(!open)return;
    setPrompt(buildVisualPrompt(characterName,anchor?.text??"",type));
    setError(null);setResult(null);setAvailable(false);setChecking(true);
    let alive=true;
    void fetch("/api/visual-capture",{cache:"no-store"})
      .then(async(r)=>r.ok ? await r.json() as {imageEnabled?:boolean} : {})
      .then(c=>{if(alive)setAvailable(c.imageEnabled===true);})
      .catch(()=>{if(alive)setAvailable(false);})
      .finally(()=>{if(alive)setChecking(false);});
    return ()=>{alive=false;};
  },[open,anchor?.id,anchor?.text,characterName,type]);

  const canGenerate=type==="image"&&available&&!!anchor&&prompt.trim().length>=20&&!busy;
  async function generate(){
    if(!canGenerate||!anchor||busy)return;
    setBusy(true);setError(null);setResult(null);
    try{
      const {data}=await supabase.auth.getSession();
      const token=data.session?.access_token;
      if(!token)throw new Error("Sua sessão expirou. Faça login novamente.");
      const response=await fetch("/api/visual-capture",{
        method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({
          type:"image",confirmed:true,characterId,messageId:anchor.id,
          requestId:crypto.randomUUID(),
          ...(storyId?{storyId}:{}),prompt:prompt.trim(),aspectRatio,
        }),
      });
      const payload=await response.json() as {error?:string;mimeType?:string;data?:string};
      if(!response.ok)throw new Error(payload.error??"Falha ao gerar imagem.");
      if(!payload.data||!payload.mimeType)throw new Error("Imagem vazia.");
      setResult({data:payload.data,mimeType:payload.mimeType});
    }catch(e){setError(e instanceof Error?e.message:"Falha ao gerar imagem.");}
    finally{setBusy(false);}
  }
  const url=result?`data:${result.mimeType};base64,${result.data}`:null;
  function save(){
    if(!url)return;
    const a=document.createElement("a");
    a.href=url;a.download=`hysto-cena-${anchor?.id.slice(0,8)??"imagem"}.${result?.mimeType==="image/jpeg"?"jpg":"png"}`;
    document.body.appendChild(a);a.click();a.remove();
  }

  return (
    <Dialog open={open} onOpenChange={(next)=>{if(!busy)onOpenChange(next);}}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.25rem)] max-w-xl overflow-y-auto rounded-2xl border-border bg-background px-5 py-6 sm:px-6">
        <DialogTitle className="flex items-center gap-2 text-xl">
          {type==="image"?<ImageIcon className="size-5 text-primary"/>:<Film className="size-5 text-primary"/>}
          {type==="image"?"Capturar imagem da cena":"Criar vídeo da cena"}
        </DialogTitle>
        <DialogDescription>
          Revise o texto antes de gerar. Nenhuma IA é chamada apenas por abrir esta janela.
        </DialogDescription>
        <div className="space-y-2">
          <label htmlFor="visual-capture-prompt" className="text-sm font-semibold">Descrição editável</label>
          <Textarea id="visual-capture-prompt" rows={6} value={prompt}
            onChange={e=>setPrompt(e.target.value.slice(0,1800))}
            placeholder="Descreva a cena, cenário e aparência dos personagens." disabled={busy}/>
          <p className="text-xs text-muted-foreground">{prompt.length}/1800 caracteres. Revise os detalhes antes de enviar ao provedor.</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="visual-capture-ratio" className="text-sm font-medium">Formato</label>
          <Select value={aspectRatio} onValueChange={(v)=>setAspectRatio(v as VisualAspectRatio)} disabled={busy}>
            <SelectTrigger id="visual-capture-ratio" className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="16:9">Paisagem 16:9</SelectItem>
              <SelectItem value="1:1">Quadrado 1:1</SelectItem>
              <SelectItem value="9:16">Retrato 9:16</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {type==="video" ? (
          <p className="rounded-xl border border-border bg-secondary/35 p-3 text-sm text-muted-foreground">
            A geração de vídeo exige processamento assíncrono, salvamento e controle de cobranças. O editor está preparado, mas a geração permanecerá indisponível até a integração segura do provedor.
          </p>
        ) : (
          <p className="rounded-xl border border-border bg-secondary/35 p-3 text-xs text-muted-foreground">
            Gemini 3.1 Flash Image (1K): referência de US$ 0,067 por imagem de saída, além de possíveis custos de entrada e impostos. Valor estimado, não saldo de créditos do Hysto.
            {checking?" Verificando disponibilidade…":!available?" A geração paga ainda não está habilitada neste ambiente.":""}
          </p>
        )}
        {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
        {url&&(
          <div className="space-y-2 rounded-xl border border-primary/30 p-2">
            <img src={url} alt="Imagem gerada da cena" className="max-h-[45dvh] w-full rounded-lg object-contain"/>
            <p className="text-xs text-muted-foreground">Prévia temporária: salve antes de recarregar ou sair da conversa.</p>
            <Button type="button" size="sm" variant="outline" onClick={save}><Download className="size-4"/> Salvar imagem</Button>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={()=>onOpenChange(false)} disabled={busy}><X className="size-4"/> Fechar</Button>
          <Button type="button" onClick={()=>void generate()} disabled={!canGenerate}>
            <Sparkles className="size-4"/>{busy?"Gerando…":"Confirmar e gerar imagem"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function VisualMomentCard({onImage,onVideo,allowVideo}:{
  onImage:()=>void;onVideo:()=>void;allowVideo:boolean;
}){
  return (
    <div className="my-3 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
      <Sparkles aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Capturar este momento?</p>
        <p className="text-xs text-muted-foreground">Sugestão visual — nenhuma geração automática.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onImage}>Preparar imagem</Button>
          {allowVideo&&<Button type="button" size="sm" variant="outline" onClick={onVideo}>Preparar vídeo</Button>}
        </div>
      </div>
    </div>
  );
}
