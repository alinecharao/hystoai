/**
 * In-story monologue must follow the sequence of events, not a template.
 *
 * The UI already renders [pensamento] blocks in their authored position.
 * Reordering text after generation could reverse cause and effect, so this
 * policy guides composition BEFORE text is generated instead.
 */
export function buildThoughtPlacementPolicy(enabled: boolean): string {
  if (!enabled) {
    return [
      "PENSAMENTOS DESATIVADOS: não escreva blocos [pensamento]...[/pensamento],",
      "nem monólogos internos separados. Mostre apenas ações, narração e falas.",
      "Não altere fatos ou a ordem dos acontecimentos por causa desta opção.",
    ].join(" ");
  }

  return [
    "PENSAMENTOS — POSIÇÃO CAUSAL E NATURAL (INSTRUÇÃO FINAL DE FORMATO):",
    "Os blocos [pensamento]...[/pensamento] são parte da narrativa, não um prólogo obrigatório.",
    "PRESENÇA NA CENA — REGRA PRIORITÁRIA: antes de gerar qualquer [pensamento], determine quem está fisicamente presente no local e momento que a última ação do usuário estabeleceu como cena em foco.",
    "Se o personagem principal da IA estiver AUSENTE, em outro cômodo, dormindo sem acompanhar a cena, tiver saído ou ainda não tiver chegado, não gere pensamentos dele nem sua perspectiva privada. A opção de pensamentos ativa NÃO autoriza cortar para uma cena paralela.",
    "Mesmo que o personagem apareça em CHARACTER_CANON, CURRENT_STORY, memória ou mensagens anteriores, isso não prova presença no instante atual. Uma mera menção ao personagem ausente NÃO o torna observador.",
    "Só acompanhe pensamentos do personagem principal fora da cena anterior se o usuário mudar explicitamente o foco narrativo para o local em que ele está. Não invente cortes de câmera, telepatia, observação remota nem comunicação para justificar interioridade.",
    "Personagens secundários e a persona do usuário nunca recebem pensamentos gerados pela IA, independentemente de estarem presentes. Em cenas sem o personagem principal, continue com ações e falas observáveis dos secundários realmente presentes, sem pensamentos.",
    "Primeiro identifique o que o personagem percebe, faz, ou ouve NESTE turno.",
    "Insira um pensamento APÓS o acontecimento, fala ou percepção que o provocou, no ponto exato em que ele surge.",
    "Se o pensamento motiva uma decisão ou fala seguinte, coloque-o imediatamente ANTES dessa ação; mantenha causa antes da consequência.",
    "Nunca reúna todos os pensamentos no início, nem abra toda resposta com pensamento por hábito, nem copie a posição dos pensamentos de mensagens anteriores.",
    "Iniciar com pensamento só é adequado quando o personagem já estava refletindo antes da primeira ação observável e isso faz sentido na continuidade.",
    "Pensamentos são opcionais: se não houver motivo narrativo real, não escreva nenhum. Evite pensamentos genéricos que repetem a narração ou antecipam fatos ainda não observados.",
    "Cada pensamento deve ser breve (1 a 3 frases), em primeira pessoa, e pertencer exclusivamente ao personagem controlado pela IA.",
    "FORMATAÇÃO OBRIGATÓRIA: abra cada pensamento com [pensamento] e feche com [/pensamento] (a barra / do fechamento é indispensável). NUNCA repita [pensamento] para encerrar o bloco.",
    "Cada pensamento deve ser um bloco próprio separado das ações e falas por uma linha em branco. Não deixe marcadores literais aparecendo no texto narrativo e não coloque narração, diálogos nem asteriscos dentro do bloco.",
    "Exemplo exato de delimitadores: [pensamento]Preciso entender o que aconteceu.[/pensamento]",
    "EXEMPLOS DE POSIÇÃO (APENAS FORMATO, NÃO FATOS DA HISTÓRIA):",
    "Exemplo A — reação após uma fala: *Ele ouve a pergunta e hesita.*",
    "[pensamento]Não esperava que ela perguntasse isso agora.[/pensamento]",
    "\"Preciso pensar um instante.\"",
    "Exemplo B — percepção no meio da cena: \"Pode entrar.\"",
    "*Ele repara que a porta está entreaberta.*",
    "[pensamento]Achei que tivesse fechado.[/pensamento]",
    "*Ele se aproxima da porta.*",
    "Exemplo C — sem pensamento necessário: *Ele afasta a cadeira.* \"Sente-se, por favor.\"",
    "Não reproduza os acontecimentos desses exemplos na história. Preserve sempre a ordem real dos eventos e a autonomia da protagonista.",
  ].join("\n");
}
