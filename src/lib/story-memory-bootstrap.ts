import type { NarrativeTurn } from "@/lib/story-memory";

/** A manual bootstrap is deliberately bounded: never claim full-story coverage. */
export const MEMORY_BOOTSTRAP_MAX_TURNS = 36;
export const MEMORY_BOOTSTRAP_MAX_CHARS = 380;

function compactMessage(value: string): string {
  const text = value.trim();
  if (text.length <= MEMORY_BOOTSTRAP_MAX_CHARS) return text;
  // Truncation is explicit; the model must not infer omitted events.
  return text.slice(0, 250) + "\n[TRECHO OMITIDO]\n" + text.slice(-110);
}

/** Input is most-recent-first, exactly as returned by Supabase. */
export function prepareMemoryBootstrapTurns(
  mostRecentFirst: readonly NarrativeTurn[],
  hasOlderTurns: boolean,
): { turns: NarrativeTurn[]; partial: boolean } {
  const chosen = mostRecentFirst.slice(0, MEMORY_BOOTSTRAP_MAX_TURNS);
  return {
    turns: [...chosen].reverse().map((turn) => ({
      id: turn.id,
      role: turn.role,
      content: compactMessage(turn.content),
    })),
    partial: hasOlderTurns || mostRecentFirst.length > MEMORY_BOOTSTRAP_MAX_TURNS,
  };
}

export type BootstrapStatus = "ready" | "missing" | "checkpoint_missing" | "alternative_selected";

/**
 * Absence of a displayable snapshot has multiple causes. Never conflate an
 * invalidated checkpoint with "no history", or present an abandoned branch.
 */
export function classifyMemoryCheckpoint(
  hasMemoryRow: boolean,
  checkpointId: string | null,
  anchorExists: boolean,
  alternateSelected: boolean,
): BootstrapStatus {
  if (!hasMemoryRow || !checkpointId) return "missing";
  if (!anchorExists) return "checkpoint_missing";
  if (alternateSelected) return "alternative_selected";
  return "ready";
}
