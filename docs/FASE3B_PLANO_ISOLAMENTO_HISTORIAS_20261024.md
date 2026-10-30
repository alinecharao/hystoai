# Hysto · Fase 3B — desenho de isolamento de histórias (24/10/2026)

## Estado verificado
A Fase 3A e a recuperação de Preview estão integradas à `main` (SHA `cf2bae8`), com build, TypeScript e testes aprovados. O Lovable aponta para essa mesma SHA. A usuária confirmou que o chat voltou a funcionar.

**Esta entrega é um desenho de migração, não uma ativação de múltiplas histórias.** O banco do Lovable consultado é o banco do projeto principal; nenhuma migração nova deve ser aplicada nele antes de validação transacional em um banco de testes realmente separado.

## O que torna a mudança sensível
A conversa não possui um identificador de história independente. São usadas consultas por `user_id + character_id` em:
- `messages` e todas as leituras de chat/histórico.
- `story_memories`, cuja PK atual é precisamente `(user_id, character_id)`.
- `story_memory_notes`, que tenta isolar cada conversa antiga pelo `anchor_message_id` da primeira mensagem.
- `assistant_response_versions`, incluindo versão selecionada.
- `chat_generation_claims` e `assistant_regeneration_claims`.
- RPCs `append_chat_user_message`, `claim_chat_generation`, `release_chat_generation`, `claim_assistant_regeneration`, `release_assistant_regeneration`, `finish_assistant_regeneration` e `select_assistant_response_version`.
- Rota DELETE que apaga todas as mensagens de um usuário por personagem.
- Dashboard, `messagesQuery`, exportador TXT/JSON, ficha de memória e rascunho local.

A alteração só da interface ou apenas da tabela `messages` criaria **vazamento de continuidade entre histórias**, versões de respostas ligadas à história errada ou exclusão involuntária.

## Contrato proposto
1. `stories`: `id uuid`, `user_id uuid`, `character_id uuid`, `title text`, `created_at`, `updated_at`, `archived_at?`, `is_legacy boolean`. Acesso exclusivamente ao dono e personagem visível/autorizado.
2. Mensagens usam `story_id` além de `character_id`, com vínculo obrigatório ao dono da história. Um mesmo personagem poderá ter diversas histórias.
3. Cada versão de resposta e cada claim guarda `story_id`, sempre conferido contra a mensagem original.
4. Cada memória automática/nota manual usa `story_id`, nunca a combinação isolada `user_id + character_id`. Preservar todos os campos e fontes atuais.
5. O app navega por `/stories/$storyId` (ou rota equivalente) sem confundir `characterId` com `storyId`. As rotas antigas `/chat/$id` redirecionam **apenas** para a história legada existente daquele usuário, evitando ambiguidades.
6. Criar nova história nunca faz `DELETE`, nem reutiliza mensagens, memórias, claims ou versões de outra.
7. Rascunhos locais e chaves de cache usam `userId + storyId`; exportação recebe `storyId`.
8. Permissões RLS impedem acessar mensagens, versões e memórias de histórias pertencentes a outro usuário — mesmo quando o personagem é público.

## Implantação progressiva, sem apagar dados

### Etapa A — preparar o banco (em clone de testes)
- Criar a tabela `stories` com RLS.
- Gerar **exatamente uma história legada por par usuário/personagem existente** em mensagens, memórias e notas. Preservar os IDs de mensagens atuais.
- Adicionar colunas `story_id` opcionais nas tabelas dependentes e preencher em lote, em transação, por par legado.
- Criar índices, chaves compostas/validações de referência e resolver `story_memories`: a PK `(user_id, character_id)` impede duplicidade de memória para o mesmo personagem; substituir por unicidade por `story_id` **somente após** backfill e verificação.
- Conferir contagem total de linhas/IDs de cada tabela antes e depois (sem consultar conteúdos privados no relatório). Nenhuma exclusão/truncamento.
- A migração aditiva sozinha não habilita botão de criar histórias.

### Etapa B — isolamento do servidor
- Criar versões transacionais de cada RPC que exigem `story_id`, checando `auth.uid()` e o personagem autorizado.
- Travar geração/regeneração por `user_id + story_id`, não por personagem; rejeitar respostas se a versão ou a última mensagem mudou.
- As rotas de envio, retry e DELETE devem obrigatoriamente receber o `storyId` válido. Sem fornecimento, usar apenas fluxo legado explicitamente permitido (nunca adivinhar qual história excluir).
- Incluir `story_id` nas checagens de origem de memória, seleção de versões e fontes de fatos curados.
- Testes transacionais multi-história e multi-usuário antes de disponibilizar a função.

### Etapa C — interface e ativação controlada
- Biblioteca de histórias por personagem, nome da história e atividade recente.
- Botão `Nova história` disponível somente depois de serviço e RLS validados.
- Botões `Renomear`, `Arquivar`, `Exportar`; exclusão definitiva apenas com confirmação específica da história.
- Rascunhos, cache e painel de memória independentes por história.
- Ativar gradualmente com flag `HYSTO_MULTI_STORIES`; manter rollback fácil para ocultar UI nova **sem reverter o backfill ou perder mensagens**.

## Provas de segurança exigidas
- Histórias A/B do mesmo personagem: mensagens, fatos escolhidos, cenário atual, alternativas e rascunhos não aparecem na outra.
- Persona padrão e características do personagem podem ser compartilhadas, mas fatos específicos de A não entram no prompt de B.
- Gerar simultaneamente em A e B funciona; duas gerações em A continuam serializadas.
- Excluir mensagem em A não apaga nada de B; limpar A mantém B e personagem intactos.
- Selecionar alternativa em A não muda versões em B.
- Usuário 2 não consegue ler ou alterar `story_id` do usuário 1, mesmo com IDs conhecidos.
- Exportação de A não inclui conteúdo de B.
- Backfill: todos os IDs de mensagens existentes permanecem; contagem sem perdas; registros órfãos tratados explicitamente e nunca descartados silenciosamente.
- Navegadores mobile/desktop: rota antiga, nova rota, recarga, teclado, login e sincronização.

## Decisão de risco
**Não criar uma segunda história em produção usando a estrutura atual.** A Fase 3B precisa ser implementada e testada num banco Lovable isolado antes de qualquer migração do projeto principal. O Preview atual usa o banco do projeto principal, e CI TypeScript/Vitest sozinho não valida isolamento transacional/RLS.

Status: **auditoria concluída; migração não aplicada; funcionalidades atuais preservadas**.
