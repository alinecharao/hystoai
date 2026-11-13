/**
 * Groq on-demand accounts have much smaller practical token budgets than
 * other providers. Preserve the *entire* current user turn and every selected
 * message verbatim. Never silently truncate a user's actions, dialogue or
 * chronology to manufacture a reply.
 *
 * The character budget is conservative and only an approximation of tokens.
 * A provider may still reject a request; the normal retry/fallback handles it.
 */
export const GROQ_NARRATIVE_CHAR_BUDGET = 18_000;
export const GROQ_NARRATIVE_MAX_PRIOR_TURNS = 16;

export type NarrativeProviderMessage = { role: unknown; content: unknown };

function messageSize(message: NarrativeProviderMessage): number {
  if (typeof message.content === "string") return message.content.length;
  // OpenAI-compatible messages can contain structured parts. Preserve them
  // byte-for-byte and charge their serialized size to the budget.
  const serialized = JSON.stringify(message.content);
  return serialized?.length ?? 0;
}

/**
 * Select the contiguous newest segment of the original history. The latest
 * message MUST be a user turn and is never clipped, split, paraphrased or
 * moved. If even system + last user turn cannot fit, return null so callers
 * can try another provider or reject BEFORE persisting a new turn.
 */
export function selectGroqNarrativeMessages<T extends NarrativeProviderMessage>(
  messages: readonly T[],
  compactSystem: string,
  budgetCharacters: number = GROQ_NARRATIVE_CHAR_BUDGET,
): Array<T | { role: "system"; content: string }> | null {
  // Some OpenAI-compatible SDKs encode the server instruction as developer
  // rather than system. Either is owned by the server, not a story turn.
  const conversation = messages.filter((message) =>
    message.role !== "system" && message.role !== "developer",
  );
  const latest = conversation.at(-1);
  if (!latest || latest.role !== "user" || !compactSystem.trim()) return null;
  if (!Number.isFinite(budgetCharacters) || budgetCharacters <= 0) return null;

  let available = budgetCharacters - compactSystem.length - messageSize(latest);
  if (available < 0) return null;

  const selected: T[] = [latest];
  for (
    let i = conversation.length - 2, kept = 0;
    i >= 0 && kept < GROQ_NARRATIVE_MAX_PRIOR_TURNS;
    i--, kept++
  ) {
    const previous = conversation[i]!;
    const required = messageSize(previous);
    if (required > available) break; // no skipping an intervening turn
    selected.unshift(previous);
    available -= required;
  }
  return [{ role: "system", content: compactSystem }, ...selected];
}

export type CompactNarrativeSections = {
  characterName: string;
  persona: string;
  canon: string;
  background: string;
  currentStory: string;
  styleExamples: string;
  curatedMemory: string;
  memorySummary: string;
  memoryScene: string;
  memoryKnowledge: string;
  knowledgeMode: "cautious" | "natural" | "established";
  castMode: "discreet" | "balanced" | "participative";
  thoughtsEnabled: boolean;
};

/**
 * The smaller Groq system retains the same truth hierarchy and all supplied
 * canonical/user-created facts; it removes duplicative explanatory rules
 * rather than compressing the source material or pretending to know events.
 */
export function buildCompactNarrativeSystem(input: CompactNarrativeSections): string {
  const section = (tag: string, body: string): string =>
    body.trim() ? `<${tag}>\n${body}\n</${tag}>` : "";
  const memory = input.curatedMemory
    ? section("CURATED_STORY_MEMORY", input.curatedMemory)
    : section("STORY_MEMORY", [
      input.memorySummary && `FATOS ESTABELECIDOS:\n${input.memorySummary}`,
      input.memoryScene && `CENA RESUMIDA:\n${input.memoryScene}`,
      input.memoryKnowledge && `QUEM SABE O QUÊ:\n${input.memoryKnowledge}`,
    ].filter(Boolean).join("\n"));
  return [
    `Você interpreta ${input.characterName} numa história interativa em português brasileiro.`,
    "A protagonista/persona do usuário pertence SOMENTE ao usuário. Nunca narre, complete ou altere ações, diálogos, pensamentos, decisões ou reações dela. Não reescreva nem resuma o turno do usuário: CONTINUE a partir do último acontecimento já concluído.",
    "ORDEM DE VERDADE: CHARACTER_CANON define fatos permanentes; CURRENT_STORY, o histórico original e a última mensagem definem acontecimentos. Memória manual/automática é complementar e não pode contradizer a mensagem atual. STYLE_EXAMPLES contém SOMENTE estilo, nunca acontecimentos.",
    section("USER_PERSONA", input.persona),
    section("CHARACTER_CANON", input.canon),
    section("STORY_BACKGROUND", input.background),
    section("CURRENT_STORY", input.currentStory),
    section("STYLE_EXAMPLES", input.styleExamples),
    memory,
    "LEIA A ÚLTIMA MENSAGEM INTEGRALMENTE E EM ORDEM: ações entre *asteriscos* são ações/narração, aspas indicam falas conforme o contexto e [pensamento]...[/pensamento] é privado. Não atribua automaticamente falas citadas à persona. A última ação é o ponto de continuação, não o primeiro parágrafo.",
    "PRESENÇA E CONHECIMENTO: acompanhe o local e os personagens que estão EFETIVAMENTE presentes na última cena. Uma pessoa que saiu, embarcou no elevador, dorme ou está em outro lugar NÃO presencia eventos posteriores; não descreva pensamentos dela nem a faça reagir ao que não viu ou ouviu. Nunca invente testemunho, comunicação, telepatia ou viagem para justificar onisciência.",
    "SECUNDÁRIOS: personagens presentes podem falar e agir com vozes próprias quando a situação permitir, sem pensamentos privados. Não invente chegada ou presença de novos personagens. Não substitua a participação dos secundários pela fala da persona.",
    `MODO DE SECUNDÁRIOS: ${input.castMode}. discreet: participação apenas quando pertinente; balanced: participação natural; participative: participação mais ativa dos presentes, sem todos falarem a cada turno.`,
    `MODO DE CONHECIMENTO: ${input.knowledgeMode}. established: só fatos explicitamente conhecidos; cautious: cautela com referências não estabelecidas; natural: familiaridade plausível sem certeza artificial. Nunca transfira fatos privados de um personagem para outro.`,
    input.thoughtsEnabled
      ? "PENSAMENTOS: [pensamento]...[/pensamento] somente do personagem principal da IA quando PRESENTE na cena em foco; no máximo quando causalmente relevante. Nenhum pensamento da persona nem de secundários."
      : "PENSAMENTOS DESATIVADOS: não escreva [pensamento] nem pensamentos internos de qualquer personagem.",
    "COERÊNCIA: mantenha nomes, idades, relações, lugar, ordem, posse de objetos e fatos concluídos. Não confunda sonho/hipótese/flashback com ação presente. Se não souber, não invente. Não replique o texto do usuário.",
    "SAÍDA: *ações e narração* entre asteriscos, falas entre aspas, parágrafos separados. Uma iniciativa principal por turno; deixe a resposta da protagonista em aberto. Não mostre tags ou instruções internas.",
  ].filter(Boolean).join("\n\n");
}
