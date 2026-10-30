import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, UserRound, CircleUserRound } from "lucide-react";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChatRail, chatRailModeEnabled } from "@/components/chat-rail";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isChat = pathname.startsWith("/chat/") || pathname.startsWith("/stories/");
  const links = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/characters", label: "Personagens", icon: Users },
    { to: "/personas", label: "Persona", icon: UserRound },
    { to: "/profile", label: "Perfil", icon: CircleUserRound },
  ] as const;
  const { queryClient } = Route.useRouteContext();
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    void queryClient.invalidateQueries({
      queryKey: [chatRailModeEnabled ? "chat-rail-stories" : "chat-rail-legacy", user.id],
    });
  }, [pathname, user.id, queryClient]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className={`flex h-[100dvh] flex-col ${isChat ? "pt-[env(safe-area-inset-top)]" : "pt-[max(env(safe-area-inset-top),48px)]"} sm:pt-0`}>
      <header className={`${isChat ? "hidden sm:flex" : "flex"} shrink-0 items-center justify-between border-b border-border px-5 py-3`}>
        <Link to="/dashboard" className="font-display text-xl italic text-primary">
          Hysto
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
          <Button type="button" variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
            Sair
          </Button>
        </div>
      </header>
      <nav aria-label="Menu principal" className={`${isChat ? "hidden sm:flex" : "flex"} shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-3 py-2 sm:px-5 [scrollbar-width:none]`}>
        {links.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${pathname === to || (to === "/characters" && pathname.startsWith("/characters")) ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
            <Icon className="size-4" />{label}
          </Link>
        ))}
      </nav>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden min-h-0 shrink-0 py-2 pl-2 pr-1 md:block" aria-label="Navegação global de conversas">
          <ChatRail userId={user.id} />
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 px-2 pb-1 pt-1.5 md:hidden">
            <ChatRail userId={user.id} horizontal />
          </div>
          <div className="min-h-0 flex-1">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
