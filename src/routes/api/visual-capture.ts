import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/chat-validation";
import type { Database } from "@/integrations/supabase/types";

const asJson=(status:number, data:object)=>new Response(JSON.stringify(data),{
  status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"},
});
const imageEnabled=()=>process.env["HYSTO_VISUAL_GENERATION_ENABLED"]==="true"
  && process.env["HYSTO_VISUAL_BILLABLE_OPT_IN"]==="true"
  && process.env["HYSTO_VISUAL_QUOTA_INSTALLED"]==="true"
  && Boolean(process.env["GEMINI_API_KEY"]);
const IMAGE_MODEL="gemini-3.1-flash-image";

export const Route=createFileRoute("/api/visual-capture")({
  server:{
    handlers:{
      GET:async()=>asJson(200,{
        imageEnabled:imageEnabled(),
        videoEnabled:false,
        model:IMAGE_MODEL,
        notice:"Uma imagem por confirmação. Cobrança variável na conta do Gemini; não são créditos do Hysto.",
      }),
      POST:async({request})=>{
        if(!imageEnabled())return asJson(503,{error:"Geração visual indisponível até a configuração segura do provedor."});
        if(request.headers.get("content-type")?.split(";")[0]!=="application/json")
          return asJson(415,{error:"Formato de solicitação inválido."});
        const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
        if(!token)return asJson(401,{error:"Faça login para gerar uma imagem."});
        const raw:unknown=await request.json().catch(()=>null);
        if(!raw||typeof raw!=="object"||Array.isArray(raw))return asJson(400,{error:"Dados inválidos."});
        const body=raw as Record<string,unknown>;
        const storyId=body["storyId"]===null||body["storyId"]===undefined?null:body["storyId"];
        const aspect=body["aspectRatio"];
        if(body["type"]!=="image"||body["confirmed"]!==true||
          !isUuid(body["characterId"])||!isUuid(body["messageId"])||!isUuid(body["requestId"])||
          (storyId!==null&&!isUuid(storyId))||
          !["1:1","16:9","9:16"].includes(String(aspect))||
          typeof body["prompt"]!=="string"||body["prompt"].trim().length<20||
          body["prompt"].length>1800
        )return asJson(400,{error:"Revise a cena, escolha o formato e confirme novamente."});
        if(process.env["HYSTO_MULTI_STORIES"]==="true" && !storyId)
          return asJson(400,{error:"Selecione a história original da imagem antes de gerar."});

        const supabase=createClient<Database>(process.env["SUPABASE_URL"]!,process.env["SUPABASE_PUBLISHABLE_KEY"]!,{
          global:{headers:{Authorization:`Bearer ${token}`}},
          auth:{persistSession:false,autoRefreshToken:false},
        });
        const {data:auth,error:authError}=await supabase.auth.getClaims(token);
        const uid=auth?.claims?.sub;
        if(authError||!uid)return asJson(401,{error:"Sessão inválida."});

        const {data:character,error:characterError}=await supabase.from("characters")
          .select("id,user_id").eq("id",body["characterId"]).maybeSingle();
        if(characterError||!character||(character.user_id!==uid&&character.user_id!==null))
          return asJson(404,{error:"Personagem não encontrado."});
        if(storyId){
          const {data:story}=await supabase.from("stories")
            .select("id").eq("id",storyId).eq("character_id",body["characterId"])
            .eq("user_id",uid).is("archived_at",null).maybeSingle();
          if(!story)return asJson(404,{error:"História não encontrada."});
        }
        let query=supabase.from("messages")
          .select("id").eq("id",body["messageId"]).eq("role","assistant")
          .eq("character_id",body["characterId"]).eq("user_id",uid);
        if(storyId)query=query.eq("story_id",storyId);
        const {data:message,error:messageError}=await query.maybeSingle();
        if(messageError||!message)return asJson(404,{error:"A cena escolhida ainda não foi salva nesta história."});

        // Reserve a durable idempotent quota BEFORE any paid provider call.
        // If the budget migration has not been installed, fail closed.
        // Reservations are intentionally not refunded after uncertain provider
        // errors: a timeout may still have incurred a bill.
        const {data:reserved,error:quotaError}=await supabase.rpc("reserve_visual_generation",{
          p_request_id:String(body["requestId"]),
        });
        if(quotaError){
          console.warn("visual_quota_unavailable",{code:quotaError.code});
          return asJson(503,{error:"Limites seguros de geração indisponíveis. Nenhuma imagem foi solicitada."});
        }
        if(!reserved)return asJson(429,{error:"Limite diário de imagens atingido ou solicitação repetida."});
        try{
          const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`,{
            method:"POST",
            headers:{
              "x-goog-api-key":process.env["GEMINI_API_KEY"]!,
              "Content-Type":"application/json",
            },
            signal:AbortSignal.timeout(110000),
            body:JSON.stringify({
              contents:[{role:"user",parts:[{text:body["prompt"].trim()}]}],
              generationConfig:{
                responseModalities:["IMAGE"],
                imageConfig:{aspectRatio:aspect,imageSize:"1K"},
              },
            }),
          });
          if(!response.ok){
            console.warn("visual_image_provider_failed",{status:response.status});
            return asJson(response.status===429?429:502,{
              error:response.status===429
                ?"Limite do provedor atingido. Confira seus créditos ou tente novamente."
                :"O provedor não conseguiu gerar a imagem. Confira sua conta e tente mais tarde.",
            });
          }
          const data=await response.json() as {
            candidates?:Array<{content?:{parts?:Array<{inlineData?:{mimeType?:string;data?:string}}>} }>;
          };
          const image=data.candidates?.flatMap(c=>c.content?.parts??[])
            .map(part=>part.inlineData).find(part=>part?.data&&/image\/(png|jpeg|webp)/.test(part.mimeType??""));
          if(!image?.data||!image.mimeType||image.data.length>12_000_000)
            return asJson(502,{error:"O provedor não retornou uma imagem válida."});
          return asJson(200,{mimeType:image.mimeType,data:image.data,model:IMAGE_MODEL,
            note:"Prévia temporária. Salve a imagem antes de fechar ou recarregar a página."});
        }catch(error){
          console.warn("visual_image_generation_unavailable",error instanceof Error?error.name:"error");
          return asJson(502,{error:"Não foi possível concluir a geração. Verifique a conta do provedor."});
        }
      },
    },
  },
});
