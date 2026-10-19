import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meu Site" },
      { name: "description", content: "Um site em branco pronto para começar." },
      { property: "og:title", content: "Meu Site" },
      { property: "og:description", content: "Um site em branco pronto para começar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return <main className="min-h-screen bg-background" />;
}
