/**
 * Visual capture is opt-in and never calls a model when merely suggesting.
 * Suggestions are heuristic and deliberately modest, not statements of fact.
 */
export type VisualType = "image" | "video";
export type VisualSuggestionMode = "off" | "image" | "image-video";
export type VisualFrequency = "rare" | "normal" | "frequent";
export type VisualAspectRatio = "1:1" | "16:9" | "9:16";
export type VisualAnchor = { id: string; text: string; role: "assistant" | "user" };

export function buildVisualPrompt(characterName: string, scene: string, type: VisualType): string {
  const compact = scene
    .replace(/\[pensamento\][\s\S]*?\[\/pensamento\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1300);
  const lead = type === "image"
    ? "Ilustração cinematográfica de um único instante da cena fictícia."
    : "Clipe cinematográfico breve da cena fictícia, com movimento natural e continuidade visual.";
  return [
    lead,
    "Preserve a identidade visual dos personagens conforme o contexto confirmado; não invente detalhes físicos desconhecidos.",
    "Sem textos, legendas ou marcas-d'água editoriais.",
    `Personagem: ${characterName.trim().slice(0, 100) || "personagem da história"}.`,
    `Cena: ${compact || "Descreva aqui a cena que deseja visualizar."}`,
  ].join("\n");
}

const VISUAL_SIGNALS = [
  /\b(?:olhos?|olhar|sorriso|lágrimas?|rosto|vestido|roupa|cabelo|terno|mãos?)\b/gi,
  /\b(?:janela|chuva|noite|amanhecer|pôr do sol|luz|sombra|floresta|cidade|salão|jardim)\b/gi,
  /\b(?:abraç|beij|reencontr|revel|surpres|danç|chor|confront|descob|desped)\w*/gi,
  /\b(?:aproxim|toc|ergue|abriu|correu|parou|segur|observ|entrou)\w*/gi,
];

/** True only for a fairly visual scene, not for every assistant response. */
export function isVisualMoment(text: string): boolean {
  const clean = text.replace(/\[pensamento\][\s\S]*?\[\/pensamento\]/gi, "").trim();
  if (clean.length < 135 || clean.length > 6500) return false;
  let signals = 0;
  for (const re of VISUAL_SIGNALS) {
    const matches = clean.match(re)?.length ?? 0;
    signals += Math.min(matches, 2);
  }
  return signals >= 4;
}

/** Spacing is per assistant turn, never a new IA call. */
export function shouldSuggestVisual(
  text: string, assistantTurnIndex: number, mode: VisualSuggestionMode, frequency: VisualFrequency,
): boolean {
  if (mode === "off" || assistantTurnIndex < 1) return false;
  const interval = frequency === "rare" ? 12 : frequency === "frequent" ? 4 : 8;
  return assistantTurnIndex % interval === 0 && isVisualMoment(text);
}

export function visualStorageKey(userId: string, chatId: string): string {
  return `hysto-visual-preferences-v1:${encodeURIComponent(userId)}:${encodeURIComponent(chatId)}`;
}

export function readVisualPrefs(text: string | null): {
  mode: VisualSuggestionMode; frequency: VisualFrequency;
} {
  try {
    const candidate = text ? JSON.parse(text) as Record<string, unknown> : {};
    return {
      mode: candidate["mode"] === "off" || candidate["mode"] === "image-video" ? candidate["mode"] : "image",
      frequency: candidate["frequency"] === "rare" || candidate["frequency"] === "frequent"
        ? candidate["frequency"] : "normal",
    };
  } catch {
    return { mode: "image", frequency: "normal" };
  }
}
