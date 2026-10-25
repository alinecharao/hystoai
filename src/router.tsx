import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { installStaleModuleRecovery } from "./lib/stale-module-recovery";

export const getRouter = () => {
  // Register a bounded recovery for stale lazy-route assets in Lovable Preview.
  // Safe on the server: this helper checks that a browser window exists.
  installStaleModuleRecovery();
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
