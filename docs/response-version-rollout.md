# Hysto — safe rollout for alternative assistant responses

This feature is **disabled by default** and remains isolated on `feature/response-versions`.
Never turn it on or merge to the production branch before checking the migration and Preview.

## Before enabling the feature

1. Verify TypeScript and the production build via GitHub Actions on the feature branch.
2. In Lovable: Project settings → Git → GitHub → branch picker → `feature/response-versions`.
   Switching the editor's active branch does not publish it. Do not click **Publish**.
3. Open More → Database → SQL Editor and run the **complete**
   `supabase/migrations/20261023_assistant_response_versions.sql` file.
   It creates new tables and RPCs and updates the atomic user-append function.
   It never rewrites or deletes existing conversation messages.
4. Verify the SQL install with the **read-only** query below:

```sql
select
  to_regclass('public.assistant_response_versions') is not null as versions_table,
  to_regclass('public.assistant_regeneration_claims') is not null as leases_table,
  to_regprocedure('public.claim_assistant_regeneration(uuid,uuid)') is not null as claim_rpc,
  to_regprocedure('public.release_assistant_regeneration(uuid,uuid)') is not null as release_rpc,
  to_regprocedure('public.finish_assistant_regeneration(uuid,uuid,text)') is not null as finish_rpc,
  to_regprocedure('public.select_assistant_response_version(uuid,uuid)') is not null as select_rpc;
```

All six fields must be true. If any are false, **leave the feature disabled**.

5. Confirm `HYSTO_ATOMIC_APPEND=true` is already configured in Lovable Secrets.
6. Add `HYSTO_RESPONSE_VERSIONS=true` in Lovable Secrets (Preview only until publishing).
   Refresh Preview. The **Gerar nova resposta** button should now be available on the
   latest persisted assistant reply.

## Acceptance tests — use only a disposable conversation

- Send one user message and wait for the normal assistant response.
- Click **Gerar nova resposta** once; verify that exactly one alternative appears.
- Switch to **1/2**, then **2/2**, and force-refresh the Preview. Both texts should survive.
- Generate a third version; navigate between 1/3, 2/3, 3/3, refresh again.
- Send a new user message after selecting the preferred version. Verify that
  the narrative continues from that version, not the unused alternative.
- Previously generated versions may be viewed but not switched after subsequent
  turns. No old user or assistant message should be removed.
- If generation fails, confirm the original response and previously stored
  alternatives remain available; do not delete them.
- Existing **Gerar resposta** recovery for a pending user message must still work
  when a real failure occurs; do not intentionally corrupt messages.

## Rollback

Set `HYSTO_RESPONSE_VERSIONS` to anything other than `true` to disable
new regeneration in the server. The old conversation rows remain intact.
Do not drop the new tables or modify existing messages to roll back. Published
apps change only after an explicit **Publish**.

After Preview tests pass, review the PR, merge into `main`, switch Lovable
back to `main`, verify the Preview again, and then publish.
