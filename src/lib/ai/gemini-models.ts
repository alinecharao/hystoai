/**
 * Text/chat-only Gemini model candidates. Keep stable Flash variants as the
 * default set; Pro/preview/paid models are explicit opt-ins via GEMINI_MODEL(S).
 * Actual access and quotas are decided by the Google API project.
 */
export const DEFAULT_GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
] as const;

const GEMINI_MODEL_ID = /^gemini-[a-z0-9][a-z0-9.-]{1,80}$/i;

export function getGeminiModelCandidates(preferred?: string, additional?: string): string[] {
  const models = [preferred ?? "", ...(additional?.split(",") ?? []), ...DEFAULT_GEMINI_MODELS];
  return [...new Set(models.map((model) => model.trim()).filter((model) => GEMINI_MODEL_ID.test(model)))].slice(0, 8);
}

/**
 * Only retry a Gemini HTTP 400 when Google specifically reports a missing or
 * unavailable model. Malformed prompts, safety refusals and auth errors must
 * NOT be treated as opportunities to route around restrictions.
 */
export function isGeminiModelUnavailableError(status: number, errorBody: string): boolean {
  if (status !== 400) return false;
  const body = errorBody.slice(0, 2000);
  return /(?:\bmodel\b|\bmodels\/)[\s\S]{0,180}(?:not found|not available|not supported|does not exist|unknown model|unsupported model|deprecated)|(?:not found|not available|not supported|does not exist)[\s\S]{0,180}\bmodel\b/i.test(body);
}
