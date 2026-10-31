/**
 * Controls the dialogue of supporting cast members without adding new
 * people, reassigning facts or taking over the user's own protagonist.
 * This policy is appended to the system prompt for every model provider.
 */
export const SUPPORTING_CAST_MODES = ["discreet", "balanced", "participative"] as const;
export type SupportingCastMode = (typeof SUPPORTING_CAST_MODES)[number];

export const DEFAULT_SUPPORTING_CAST_MODE: SupportingCastMode = "balanced";

export const SUPPORTING_CAST_LABELS: Record<SupportingCastMode, string> = {
  discreet: "Discreta",
  balanced: "Equilibrada",
  participative: "Participativa",
};

export function parseSupportingCastMode(value: unknown): SupportingCastMode {
  return typeof value === "string" && SUPPORTING_CAST_MODES.some((mode) => mode === value)
    ? value as SupportingCastMode
    : DEFAULT_SUPPORTING_CAST_MODE;
}

export function supportingCastStorageKey(userId: string, conversationId: string): string {
  return `hysto-supporting-cast-v1:${encodeURIComponent(userId)}:${encodeURIComponent(conversationId)}`;
}

const GUARDRAILS = [
  "PERSONAGENS SECUNDÁRIOS: você pode escrever falas, gestos e reações de personagens secundários sob controle da IA, além do personagem principal, quando a presença deles estiver ESTABELECIDA no local e no momento atuais pelo histórico ou cânone aplicável.",
  "ELENCO CONFIRMADO: se só o protagonista da IA e a persona do usuário estiverem presentes, NÃO acrescente terceiros apenas para produzir diálogo. Personagens de outra cena, outro lugar, outra história ou apenas mencionados não podem conversar como se estivessem presentes; não simule chamadas, mensagens, vozes distantes ou chegadas para contornar isso. Só introduza novos participantes se o usuário solicitar ou a cena já tiver uma transição narrativa plausível e explicitamente estabelecida.",
  "IDENTIDADES E VOZES: cada participante tem voz, motivação, relação, idade, conhecimento e maneira de reagir próprios. Não troque nomes, papéis, parentescos, falas ou conhecimentos. Identifique claramente QUEM FALA, por exemplo, *Luca inclinou a cabeça.* seguido num novo parágrafo de \"Você viu isso?\". Use sempre aspas para falas e asteriscos para ações; nunca atribua a fala ao personagem errado.",
  "PONTO DE VISTA E PRIVACIDADE: personagens secundários só respondem ao que efetivamente presenciaram ou ouviram. Não leem pensamentos, memórias privadas ou conversas que ocorreram em sua ausência. Não tratem narração do usuário como diálogo audível.",
  "PROTAGONISTA DO USUÁRIO: NUNCA escreva, complete nem antecipe suas falas, ações, sentimentos, pensamentos, escolhas, consentimento ou reações. Isso permanece exclusivamente sob controle do usuário, mesmo quando vários personagens falam com ela.",
  "RITMO: uma conversa entre personagens pode aprofundar o MESMO acontecimento em curso, mas não iniciar vários acontecimentos, fazer perguntas em cascata nem fechar a cena sem permitir a resposta do usuário. Não coloque todos os presentes falando em cada turno; permita silêncio, naturalidade e pausa.",
].join("\n");

export function buildSupportingCastPolicy(value: unknown): string {
  const mode = parseSupportingCastMode(value);
  const behavior: Record<SupportingCastMode, string> = {
    discreet:
      "MODO DISCRETO: prefira o personagem principal; coadjuvantes já presentes podem dizer algo quando diretamente interpelados ou quando sua participação é necessária para a cena. Não force falas em turnos comuns.",
    balanced:
      "MODO EQUILIBRADO (PADRÃO): quando houver outro personagem legitimamente presente e uma oportunidade real para ele contribuir, distribua organicamente as falas. Em vez de apenas descrevê-lo em silêncio, deixe-o reagir com sua própria voz, comentar, responder ou conversar com o protagonista da IA. Intercale naturalmente, sem exigir uma fala secundária em toda resposta.",
    participative:
      "MODO PARTICIPATIVO: quando houver personagens secundários presentes, favoreça uma cena coral mais ativa: eles podem dialogar uns com os outros e com o protagonista, expressar discordância, humor ou comentários próprios, desde que coerentes com o que sabem. Mantenha o foco no único acontecimento atual e evite monólogos de grupo, falas artificiais ou ultrapassar a vez do usuário.",
  };
  return `<SUPPORTING_CAST_POLICY mode="${mode}">\n${GUARDRAILS}\n${behavior[mode]}\n</SUPPORTING_CAST_POLICY>`;
}
