import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrations = [
  "20261029_story_isolation_stage1.sql",
  "20261029_story_isolation_stage2_rpcs.sql",
].map((name) => readFileSync(join(process.cwd(),"supabase/migrations",name),"utf8"));

describe("Phase 3B staged database safety", () => {
  it("keeps the legacy message data and fails instead of discarding unmapped rows", () => {
    expect(migrations[0]).toContain("update public.messages m set story_id");
    expect(migrations[0]).toContain("unmapped legacy records exist");
    expect(migrations[0]).toContain("hysto_assign_message_story");
    expect(migrations[0]).toContain("story_memory_checkpoints");
    expect(migrations[0]).not.toMatch(/\bdrop\s+table\b|\btruncate\s+table\b/i);
    expect(migrations[0]).not.toMatch(/\bdelete\s+from\s+public\.messages\b/i);
    expect(migrations[0]).not.toMatch(/\bupdate\s+public\.messages\s+set\s+content\b/i);
  });

  it("uses owner/story identity and a transaction lock for each new writer", () => {
    for (const name of [
      "append_story_user_message","claim_story_generation",
      "claim_story_regeneration","finish_story_regeneration",
      "select_story_response_version","commit_story_memory_checkpoint",
      "clear_story_messages","delete_story_message",
    ]) expect(migrations[1]).toContain(name);
    expect(migrations[1]).toContain("pg_advisory_xact_lock");
    expect(migrations[1]).toContain("m.story_id = p_story_id");
    expect(migrations[0]).toContain("stories_owner_insert");
    expect(migrations[0]).toContain("enable row level security");
  });

  it("does not silently activate new stories, touch secrets or alter production config", () => {
    expect(migrations.join("\n")).not.toContain("HYSTO_MULTI_STORIES=true");
    expect(migrations.join("\n")).toContain("notify pgrst");
  });
});
