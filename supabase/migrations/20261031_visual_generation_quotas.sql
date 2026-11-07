-- Hysto: billable visual generation hard cap (additive, disabled by default).
-- Deploy only in a clone until a paid Gemini integration has been approved.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.visual_generation_reservations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  utc_day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS visual_reservations_day_user_idx
  ON public.visual_generation_reservations(utc_day,user_id);

ALTER TABLE public.visual_generation_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visual_generation_reservations FROM PUBLIC,anon,authenticated;
-- This is server-side reservation metadata. Do not store prompts or images.

CREATE OR REPLACE FUNCTION public.reserve_visual_generation(p_request_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $quota$
DECLARE
  v_uid uuid := auth.uid();
  v_day date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF v_uid IS NULL OR p_request_id IS NULL THEN RETURN false; END IF;
  -- Serialize all daily reservations globally, including across instances.
  PERFORM pg_advisory_xact_lock(191981, (v_day - date '2000-01-01')::int);
  IF EXISTS (SELECT 1 FROM public.visual_generation_reservations
    WHERE id = p_request_id) THEN RETURN false; END IF;
  -- Conservative hard limits until billing/usage telemetry is complete.
  IF (SELECT count(*) FROM public.visual_generation_reservations
    WHERE utc_day = v_day AND user_id = v_uid) >= 3 THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.visual_generation_reservations
    WHERE utc_day = v_day) >= 30 THEN RETURN false; END IF;
  INSERT INTO public.visual_generation_reservations(id,user_id,utc_day)
  VALUES (p_request_id,v_uid,v_day);
  RETURN true;
END
$quota$;

REVOKE ALL ON FUNCTION public.reserve_visual_generation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reserve_visual_generation(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
