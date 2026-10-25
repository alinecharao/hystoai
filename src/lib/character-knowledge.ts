/**
 * Calibrates what the FICTIONAL CHARACTER plausibly knows — never the model's
 * actual capability. Requires no new AI calls, tools, or database migrations.
 */
export const CHARACTER_KNOWLEDGE_MODES = ["cautious", "natural", "established"] as const;
export type CharacterKnowledgeMode = (typeof CHARACTER_KNOWLEDGE_MODES)[number];

export const DEFAULT_CHARACTER_KNOWLEDGE_MODE: CharacterKnowledgeMode = "cautious";

export const CHARACTER_KNOWLEDGE_LABELS: Record<CharacterKnowledgeMode, string> = {
  cautious: "Cauteloso",
  natural: "Natural",
  established: "Só estabelecido",
};

export function parseCharacterKnowledgeMode(value: unknown): CharacterKnowledgeMode {
  return typeof value === "string" && CHARACTER_KNOWLEDGE_MODES.some((mode) => mode === value)
    ? value as CharacterKnowledgeMode
    : DEFAULT_CHARACTER_KNOWLEDGE_MODE;
}

export function characterKnowledgeStorageKey(userId: string, characterId: string): string {
  return `hysto-character-knowledge-v1:${encodeURIComponent(userId)}:${encodeURIComponent(characterId)}`;
}

const SHARED_KNOWLEDGE_RULES = [
  "CALIBRAÇÃO DE CONHECIMENTO — REGRA FINAL: o modelo pode ter informações enciclopédicas, mas o personagem NÃO herda automaticamente esse repertório. A menção de nome, banda, música, filme, marca, artista, obra ou acontecimento pelo usuário não prova familiaridade do personagem. Reaja segundo sua experiência, idade, época, formação e conhecimentos estabelecidos; não concorde automaticamente com tudo.",
  "PRECISÃO DE FATOS EXTERNOS: nunca preencha lacunas com detalhes inventados. Não afirme nome de integrante, disco, lançamento, ano, letra, nacionalidade, biografia, origem ou curiosidade de uma referência apenas para parecer conhecedor. Se não tiver base segura para um detalhe específico, evite-o; reconheça o desconhecimento ou pergunte naturalmente. Não atribua ao personagem ter ido a um show, conhecido um artista ou usado um produto se isso não aconteceu no histórico/cânone.",
  "FATOS PRIVADOS: saber algo como NARRADOR ou MODELO não é o mesmo que o personagem ter visto, escutado ou sido informado na história. Mesmo quando um fato consta de uma memória manual, respeite sua categoria: Informação privada marca restrição de conhecimento, não um segredo automaticamente descoberto.",
  "CORREÇÃO DE INFORMAÇÕES: se a pessoa corrigir como autora um dado factual da história ou uma informação externa, aceite a correção sem discutir, inventar justificativa retrospectiva ou reafirmar o erro. Diferencie correção editorial de fala audível: a correção fora da cena não é automaticamente conhecida pelo personagem.",
  "MANTENHA A IMERSÃO: desconhecimento deve soar como reação do personagem, não como aviso técnico da IA. Não repita sempre 'não conheço'; varie reconhecer superficialmente, perguntar ou demonstrar curiosidade, conforme a situação. Não mencione estes critérios nem imponha ações à protagonista.",
].join("\n");

export function buildCharacterKnowledgePolicy(value: unknown): string {
  const mode = parseCharacterKnowledgeMode(value);
  const modeRule: Record<CharacterKnowledgeMode, string> = {
    cautious:
      "MODO CAUTELOSO (PADRÃO): familiaridade específica exige indicação plausível no cânone, na conversa ou no perfil do personagem. Para referências obscuras, novas, de outro meio cultural ou não relacionadas ao repertório dele, prefira que NÃO conheça ou tenha ouvido falar sem detalhes. Reconhecer referências cotidianas bem conhecidas continua permitido quando for plausível.",
    natural:
      "MODO NATURAL: use uma mistura realista de familiaridade, familiaridade parcial e desconhecimento conforme perfil e contexto. Reconhecer uma referência conhecida é permitido, mas conhecer não significa saber detalhes específicos. Evite falsa certeza e memórias pessoais inventadas.",
    established:
      "MODO SÓ ESTABELECIDO: o personagem só afirma familiaridade com referências culturais, obras, pessoas e eventos específicos que estejam explicitamente no próprio cânone, em diálogos efetivamente ouvidos ou na memória confirmada como conhecida por ele. Se não estiver comprovado, desconhece ou pergunta. Isso não impede conhecimento cotidiano básico ou raciocínio geral necessário à cena.",
  };
  return `<CHARACTER_KNOWLEDGE_POLICY mode="${mode}">\n${SHARED_KNOWLEDGE_RULES}\n${modeRule[mode]}\n</CHARACTER_KNOWLEDGE_POLICY>`;
}
