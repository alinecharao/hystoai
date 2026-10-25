/**
 * When a Lovable/Vite preview changes while a tab is open, its router may
 * request a dynamic import URL from the previous revision. Refresh exactly
 * once within a bounded window rather than leaving the user on a blank chat.
 *
 * This does not handle provider, database, authentication or story errors.
 */
const PREVIEW_RELOAD_KEY = "hysto-stale-module-reload-at-v1";
const RELOAD_COOLDOWN_MS = 5 * 60 * 1000;
let installed = false;

export function isStaleModuleImportFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading chunk [\w-]+ failed|failed to preload (?:css|module)/i.test(message);
}

export function canAttemptModuleReload(lastReload: string | null, now: number): boolean {
  if (!lastReload) return true;
  const previous = Number(lastReload);
  if (!Number.isFinite(previous)) return true;
  return now - previous >= RELOAD_COOLDOWN_MS;
}

export function installStaleModuleRecovery(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  const refreshOnce = (cause: unknown): boolean => {
    if (!isStaleModuleImportFailure(cause)) return false;
    try {
      const now = Date.now();
      const lastReload = window.sessionStorage.getItem(PREVIEW_RELOAD_KEY);
      if (!canAttemptModuleReload(lastReload, now)) return false;
      window.sessionStorage.setItem(PREVIEW_RELOAD_KEY, String(now));
    } catch {
      // Storage blocked: avoid an uncontrolled repeated reload.
      return false;
    }
    window.location.reload();
    return true;
  };

  // Vite emits this event for failed dynamic imports of outdated build assets.
  window.addEventListener("vite:preloadError", (event) => {
    const preloadEvent = event as Event & { payload?: unknown };
    if (refreshOnce(preloadEvent.payload)) preloadEvent.preventDefault();
  });
  // TanStack Router's route-level lazy import may reject independently of
  // the Vite preload hook (especially in the Lovable development preview).
  window.addEventListener("unhandledrejection", (event) => {
    refreshOnce(event.reason);
  });
}
