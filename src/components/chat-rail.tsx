import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircleMore } from "lucide-react";
import { useMemo } from "react";
import lunaPortrait from "@/assets/luna-portrait.jpg";
import rexPortrait from "@/assets/rex-portrait.jpg";
import helenaPortrait from "@/assets/helena-portrait.jpg";
import sherlockPortrait from "@/assets/sherlock-portrait.jpg";
import { charactersQuery } from "@/lib/characters";
import {
  activeRailItem, buildLegacyRailItems, buildStoryRailItems,
  railNewConversationTarget, type ChatRailItem, type RecentCharacter, type RailStory,
} from "@/lib/chat-rail";
import { supabase } from "@/integrations/supabase/client";

const presetPortraits: Record<string, string> = {
  "Luna Corvo": lunaPortrait,
  "Capitão Rex": rexPortrait,
  "Dra. Helena": helenaPortrait,
  Sherlock: sherlockPortrait,
};

export const chatRailModeEnabled = import.meta.env["VITE_HYSTO_MULTI_STORIES"] === "true";

export function ChatRail({ userId, horizontal = false }: { userId: string; horizontal?: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: characters = [], isPending: loadingCharacters, isError: charactersError } = useQuery(charactersQuery);
  const characterKeys = useMemo(() => characters.map((character) => character.id).join("|"), [characters]);

  const { data: recent = [], isPending: loadingRecent, isError: recentError, refetch: refreshLegacy } = useQuery({
    queryKey: ["chat-rail-legacy", userId, characterKeys],
    enabled: !chatRailModeEnabled && !loadingCharacters && !charactersError,
    staleTime: 60_000,
    queryFn: async (): Promise<RecentCharacter[]> => {
      const results: RecentCharacter[] = [];
      // Query only metadata for the signed-in account. Do not retrieve text or
      // infer recency from the character's creation date or a truncated global page.
      for (let i = 0; i < characters.length; i += 5) {
        const batch = await Promise.all(characters.slice(i, i + 5).map(async (character) => {
          const { data, error } = await supabase.from("messages")
            .select("created_at")
            .eq("user_id", userId).eq("character_id", character.id)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false }).limit(1).maybeSingle();
          if (error) throw error;
          return data ? { characterId: character.id, updatedAt: data.created_at } : null;
        }));
        for (const item of batch) if (item) results.push(item);
      }
      return results;
    },
  });

  const { data: stories = [], isPending: loadingStories, isError: storiesError, refetch: refreshStories } = useQuery({
    queryKey: ["chat-rail-stories", userId],
    enabled: chatRailModeEnabled && !loadingCharacters && !charactersError,
    staleTime: 30_000,
    queryFn: async (): Promise<RailStory[]> => {
      const batchSize = 200;
      const all: RailStory[] = [];
      // Every active story belongs in the global rail. Fetch IDs and metadata
      // only, using paged reads rather than silently truncating after 200.
      for (let start = 0; ; start += batchSize) {
        const { data, error } = await supabase.from("stories")
          .select("id, character_id, title, updated_at, archived_at")
          .eq("user_id", userId).is("archived_at", null)
          .order("updated_at", { ascending: false }).order("id", { ascending: false })
          .range(start, start + batchSize - 1);
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < batchSize) break;
      }
      return all;
    },
  });

  const activeCharacterId = pathname.startsWith("/chat/")
    ? decodeURIComponent(pathname.slice("/chat/".length).split("/")[0] ?? "")
    : undefined;
  const items = useMemo(
    () => chatRailModeEnabled
      ? buildStoryRailItems(characters, stories)
      : buildLegacyRailItems(characters, recent, activeCharacterId),
    [characters, stories, recent, activeCharacterId],
  );

  const target = railNewConversationTarget(pathname, items, chatRailModeEnabled);
  const loading = loadingCharacters || (chatRailModeEnabled ? loadingStories : loadingRecent);
  const error = charactersError || (chatRailModeEnabled ? storiesError : recentError);
  const duplicates = new Map<string, number>();
  for (const item of items) duplicates.set(item.characterId, (duplicates.get(item.characterId) ?? 0) + 1);

  const newLabel = target.kind === "library"
    ? "Abrir biblioteca e criar outra história"
    : "Escolher personagem para conversar";

  const railClasses = horizontal
    ? "flex h-12 min-w-0 w-full items-center gap-2 rounded-[1.5rem] border border-border/65 bg-card/40 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "flex h-full min-h-0 w-14 flex-col items-center gap-2 overflow-hidden rounded-[2rem] border border-border/65 bg-card/40 px-1 py-2.5";
  const listClasses = horizontal
    ? "flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "flex min-h-0 w-full flex-1 flex-col items-center gap-2.5 overflow-y-auto overscroll-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  return (
    <nav aria-label="Todas as conversas" className={railClasses}>
      {target.kind === "library" ? (
        <Link to="/library/$characterId" params={{ characterId: target.characterId }}
          title={newLabel} aria-label={newLabel}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-foreground/85 transition hover:border-primary/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <MessageCircleMore className="size-4" aria-hidden="true"/>
        </Link>
      ) : (
        <Link to="/dashboard" title={newLabel} aria-label={newLabel}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-foreground/85 transition hover:border-primary/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <MessageCircleMore className="size-4" aria-hidden="true"/>
        </Link>
      )}
      {!horizontal && <div aria-hidden="true" className="h-px w-7 shrink-0 bg-border/70" />}

      <div className={listClasses}>
        {items.map((item) => {
          const active = activeRailItem(pathname, item);
          const title = item.storyTitle ? `${item.characterName} — ${item.storyTitle}` : item.characterName;
          const duplicatesExist = (duplicates.get(item.characterId) ?? 0) > 1;
          return (
            <div key={`${item.mode}:${item.id}`} className="relative flex shrink-0 flex-col items-center">
              <ChatRailLink item={item} title={title} active={active} duplicated={duplicatesExist} />

            </div>
          );
        })}
        {loading && !items.length && <span className="text-center text-[10px] text-muted-foreground">...</span>}
        {error && <button type="button" className="text-center text-[10px] text-muted-foreground underline"
          aria-label="Recarregar conversas" title="Recarregar conversas"
          onClick={() => { void (chatRailModeEnabled ? refreshStories() : refreshLegacy()); }}>Recarregar</button>}
        {!loading && !error && !items.length && (
          <span className="px-1 text-center text-[10px] leading-4 text-muted-foreground">
            {horizontal ? "Suas conversas aparecerão aqui" : "Sem conversas"}
          </span>
        )}
      </div>
    </nav>
  );
}

function ChatRailLink({
  item, title, active, duplicated,
}: { item: ChatRailItem; title: string; active: boolean; duplicated: boolean }) {
  const className = `group relative block size-9 shrink-0 overflow-visible rounded-full border-[1.5px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${active ? "border-primary ring-2 ring-primary/35" : "border-border/80 hover:border-primary/70"}`;
  const image = item.imageUrl || presetPortraits[item.characterName];
  const content = (
    <>
      {image ? (
        <img src={image} alt="" loading="lazy" className="size-full rounded-full object-cover object-top" />
      ) : (
        <span aria-hidden="true" className="flex size-full items-center justify-center rounded-full bg-secondary text-xl">{item.avatar || "✦"}</span>
      )}
      {duplicated && item.storyTitle && (
        <span aria-hidden="true" className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full border border-background bg-primary text-[8px] font-bold text-primary-foreground">
          {item.storyTitle.slice(0, 1).toUpperCase()}
        </span>
      )}
    </>
  );
  return item.mode === "story" ? (
    <Link to="/stories/$storyId" params={{ storyId: item.id }}
      title={title} aria-label={`Abrir conversa: ${title}`} aria-current={active ? "page" : undefined} className={className}>
      {content}
    </Link>
  ) : (
    <Link to="/chat/$id" params={{ id: item.characterId }}
      title={title} aria-label={`Abrir conversa: ${title}`} aria-current={active ? "page" : undefined} className={className}>
      {content}
    </Link>
  );
}
