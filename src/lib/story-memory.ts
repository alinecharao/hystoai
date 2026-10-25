/**
 * One-character, one-story checkpoint guard. The persisted checkpoint is a
 * compressed summary, not an authority to invent missing events.
 */
export type StoryMemorySnapshot = {
  summary: string;
  scene: string;
  known_facts: string;
  last_processed_message_id?: string | null;
};

export type NarrativeTurn = {
  id: string;
  role: string;
  content: string;
};

export function selectSafeStoryMemory(
  memory: StoryMemorySnapshot | null,
  checkpointExists: boolean,
  checkpointHasAlternative: boolean,
  turnsAfterCheckpoint: number | null,
): StoryMemorySnapshot | null {
  if (!memory?.last_processed_message_id || !checkpointExists || checkpointHasAlternative) return null;
  // Long-running stories must not forget durable facts merely because the
  // checkpoint is beyond the last 80/32 messages. An old *scene* is never current.
  return {
    ...memory,
    scene: turnsAfterCheckpoint === 0 ? memory.scene : "",
  };
}

/** Ensure each last user turn appears exactly once in the memory model input. */
export function buildStoryMemoryHistory(
  history: readonly NarrativeTurn[],
  latestUserTurn: NarrativeTurn,
  latestAssistantTurn: NarrativeTurn,
  limit = 24,
): NarrativeTurn[] {
  const previous = history.filter((turn) =>
    turn.id !== latestUserTurn.id && turn.id !== latestAssistantTurn.id,
  );
  return [...previous, latestUserTurn, latestAssistantTurn].slice(-limit);
}

export function readStoryMemoryJson(value: string): Pick<StoryMemorySnapshot, "summary" | "scene" | "known_facts"> | null {
  let parsed: unknown;
  try {
    const raw = value.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const fields = parsed as Record<string, unknown>;
  for (const key of ["summary", "scene", "known_facts"]) {
    if (typeof fields[key] !== "string" || (fields[key] as string).length > 2400) return null;
  }
  return {
    summary: fields["summary"] as string,
    scene: fields["scene"] as string,
    known_facts: fields["known_facts"] as string,
  };
}
