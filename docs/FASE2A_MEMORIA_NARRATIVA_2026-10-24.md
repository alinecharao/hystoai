# Hysto — Fase 2A: continuidade narrativa sem migração (24/10/2026)

## Contexto e escopo
Esta mudança parte da `main` no commit `8f793916`, com Fase 1 previamente testada no Preview. Não modifica histórias ou memórias existentes diretamente e não instala migração SQL. A primeira etapa da Fase 2 mantém o armazenamento atual `story_memories(summary, scene, known_facts, last_processed_message_id)`.

## Falhas concretas corrigidas
- **Esquecimento em histórias longas:** o servidor descartava resumo/known_facts quando o checkpoint saía da última janela de 80 mensagens ou ficava mais de 24 mensagens atrás. Agora confirma o checkpoint por `id + user_id + character_id` mesmo fora dessa janela e retém fatos duradouros. **Nunca reutiliza a cena antiga** depois de a narrativa avançar. Se a origem foi deletada ou é uma alternativa descartada, não a injeta.
- **Último turno duplicado na memória:** a mensagem de usuário já havia sido inserida no banco antes da atualização, mas o prompt de memória anexava o mesmo texto outra vez. Agora a atualização usa o mesmo ID original do turno e elimina a duplicata.
- **Confusão de cronologia/identidades/conhecimento:** o prompt do resumidor diferencia IDENTIDADES E VÍNCULOS, LINHA DO TEMPO, MARCOS ESTABELECIDOS, CENA PRESENTE e CONHECIMENTO DOS PERSONAGENS; explicita que um pensamento privado ou fato do leitor não é conhecimento público, e pede origem identificável para novas afirmações.
- **Validação:** JSON da memória é validado em módulo testável (três campos texto, até 2.400 caracteres cada), preservando compatibilidade com o esquema atual.

## Novo painel
Na conversa, menu `...` → `Memória da história`: mostra resumo, linha do tempo e conhecimento individual salvos. Somente leitura. Oculta o campo "cena atual" quando o checkpoint não corresponde à última mensagem salva. Há botão de atualização manual. O painel **não reescreve** memórias, não representa uma garantia de verdade e não mostra uma nova linha temporal estruturada se o registro antigo ainda for texto simples.

## Limitações e próximas entregas
1. Memória ainda é um resumo gerado por IA. Solicitar IDs de origem não prova semanticamente cada fato. Uma versão futura pode usar ledger por-fato e confirmação editável com trilha de proveniência.
2. A atualização continua assíncrona; se a chamada do modelo falhar, os registros anteriores são preservados e o resumo pode ficar atrasado.
3. O checkpoint pode ser invalidado quando a alternativa foi selecionada sobre a própria resposta original. Isso é intencional para evitar "lembranças" de versões descartadas. Uma versão futura pode manter snapshots por branch.
4. Para cronologia de milhares de mensagens, ainda é necessária uma futura estratégia de checkpoint/versionamento com migração aditiva, índices e teste de RLS em um banco de testes isolado.
5. O painel **não** edita memórias; dados reais permanecem intocados.

## Roteiro de teste no Preview
1. Abrir uma conversa de teste com mais de 80 mensagens, selecionar `...` > `Memória da história`, conferir que fatos antigos confirmados ainda aparecem (se o resumidor tiver gerado um checkpoint válido).
2. Inserir um fato privado em `[lembrança]` ou `*pensamento*`; o personagem não deve demonstrar conhecimento que não recebeu.
3. Usar idades/datas consistentes e verificar que o resumo não as modifica; comparar com o histórico real.
4. Mudar de local/cena e abrir a ficha; se ainda não consolidada, não mostrar como atual a cena anterior.
5. Regenerar a última resposta e selecionar uma alternativa, continuar a história e conferir que fatos exclusivos da resposta descartada não retornam.
6. Confirmar envio, recuperação, exclusão, alternância 1/2 e sincronização no iPhone, preservando aprovação da Fase 1.

## Critério de conclusão
CI TypeScript + Vitest + build verde; teste manual em Preview; checagem de dados de continuidade e do painel no iPhone. Sem deploy automático nem alterações destrutivas.
