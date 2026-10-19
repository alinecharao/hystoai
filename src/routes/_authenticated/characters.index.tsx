import { createFileRoute } from "@tanstack/react-router";
import { charactersQuery } from "@/lib/characters";
import { Catalog } from "./dashboard";

export const Route = createFileRoute("/_authenticated/characters/")({
  head: () => ({ meta: [
    { title: "Meus personagens — Hysto" },
    { name: "description", content: "Acesse seus personagens e histórias no Hysto." },
    { property: "og:title", content: "Meus personagens — Hysto" },
    { property: "og:description", content: "Acesse seus personagens e histórias no Hysto." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(charactersQuery),
  component: () => <Catalog mineOnly />,
});
