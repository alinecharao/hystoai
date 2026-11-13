# Hysto — Fase 3B: implementação de histórias independentes

## Estado de entrega
Implementação de código e migrações na branch `feature/phase3b-story-isolation-foundation-20261029`, PR #17 **em rascunho**, sem publicação e **sem migração executada no banco principal do Lovable**.

O aplicativo atual permanece operando exatamente no modo anterior; `HYSTO_MULTI_STORIES` e `VITE_HYSTO_MULTI_STORIES` **não estão configuradas** e por padrão não ativam as novas rotas.

## Componentes criados
- Tabela `stories`, com ID distinto de personagem, RLS, título, histórico legado e arquivamento.
- Backfill de todas as linhas existentes de mensagens, versões alternativas, memória automática, notas manuais e claims para exatamente uma história legada por usuário/personagem; IDs e conteúdos preservados.
- `story_id` validado por FK composta com dono e personagem, triggers para impedir vínculos entre histórias.
- Histórico consolidado antigo copiado também para `story_memory_checkpoints`, sem apagar a memória original.
- O primeiro envio de personagens novos no fluxo legado ainda cria sua história legada automaticamente.
- RPCs atômicas por `story_id` para envio, reclamação de geração, regeneração, seleção de versão, atualização de memória e exclusão. Nenhuma operação de exclusão calcula o alvo pelo nome do personagem.
- Rota `/api/story-chat` com o roteador de IA existente e o mesmo sistema de personas, contexto, posicionamento dos pensamentos e regras narrativas, mas **filtros obrigatórios por história**.
- Biblioteca `/library/$characterId`: criar, renomear e arquivar histórias, com História original preservada.
- Chat `/stories/$storyId`: mesmas opções de envio e regeneração, mensagens, rascunho, versões, memória manual e exportação **por história**.
- Na ativação, links antigos `/chat/$id` levam à biblioteca. Endpoint legado POST/DELETE não aceita operações sem `story_id` enquanto o modo multi-história estiver ativo.
- Extração de memória automática legada bloqueada durante modo multi-história; não utilizar memória de outra história.

## Terceira migração obrigatória na ativação

A auditoria de 29/10 identificou que os RPCs legados em `user_id + character_id` permaneceriam acessíveis mesmo depois de atualizar o front-end, permitindo operações ambíguas quando o mesmo personagem tivesse duas histórias. Para resolver:

1. Aplicar `20261029_story_isolation_stage1.sql` e `stage2_rpcs.sql` **no banco isolado de teste**.
2. Validar a nova API e a biblioteca com contas fictícias.
3. Como etapa de **cutover**, aplicar `20261029_story_isolation_stage3_cutover.sql` no ambiente testado. Ela revoga acesso dos usuários autenticados aos seis RPCs legados de escrita, preservando os releases de leases por token e os RPCs novos por história.
4. Confirmar com `has_function_privilege` que os RPCs antigos estão inacessíveis; o CI em PostgreSQL descartável executa essa prova.
5. Na implantação principal, aplicar a etapa 3 somente no instante da troca para a API de histórias com a flag ativa. Não executar com o chat antigo atendendo envios.

**ATENÇÃO:** desativar as flags depois da etapa 3 sem restaurar explicitamente as permissões dos RPCs antigos deixará o chat legado sem escrita. Uma volta controlada precisa ser preparada e testada separadamente antes de produção; nunca prometer rollback completo apenas desligando as flags.

## Flags de ativação
Definir somente APÓS migrar e testar um banco de teste separado:
- Servidor: `HYSTO_MULTI_STORIES=true`.
- Front-end/Vite: `VITE_HYSTO_MULTI_STORIES=true`.
- Manter as flags já aprovadas de recuperação e versões; o novo chat exige RPCs da segunda migração.
- Se qualquer etapa falhar: manter/desligar as flags. **Não reverter a migração eliminando story_id ou tabelas**.

## Arquivos SQL
1. `supabase/migrations/20261029_story_isolation_stage1.sql`.
2. `supabase/migrations/20261029_story_isolation_stage2_rpcs.sql`.
3. `supabase/verification/20261029_story_isolation_checks.sql` (somente leitura).
4. Testes de banco sintético em `.github/workflows/story-isolation-db.yml`.

## Garantias e limitações
- Implementação sem exclusão de mensagens antigas ou de backups.
- Postgres de teste no GitHub Actions valida sintaxe das migrações, RLS básico, histórico original, duas histórias do mesmo personagem, versões alternativas, notas privadas de fontes de outras histórias, exclusão isolada e conta de outro usuário.
- O CI NÃO reproduz todas as permissões do banco Lovable, configurações JWT reais, falhas de rede durante streaming, cotas de Gemini/Groq nem concorrência de duas abas com dados reais.
- Uma cópia isolada do banco e validação funcional do Preview com usuários descartáveis continuam obrigatórias **antes de executar SQL no projeto principal**.
- Não há API para importar arquivos JSON de backup como conversa. Exportar permanece uma função de segurança, não um recurso de restauração por enquanto.
- Conversas originais continuam com seus mesmos IDs; a navegação só muda após ativação das duas flags.

## Critérios finais antes de liberar no projeto principal
1. Capturar e comparar contagens existentes por tabela (sem exibir conteúdo): no momento inicial do planejamento havia 1.936 mensagens, 79 alternativas, 18 notas e 1 resumo; os totais podem aumentar com o uso.
2. Fazer backup verificável de produção e executar migrações em clone realmente isolado.
3. Executar consultas do arquivo de verificação: zero vínculos inválidos; zero `story_id` nulos; uma história legada por par com dados; RLS habilitada.
4. Conta de teste A: duas histórias de Christopher com memórias e mensagens distintas. Reabrir ambas várias vezes; conferir isolamento.
5. Testar regeneração em A, escolha de alternativa, continuidade e exclusão, garantindo que B e História original não mudam.
6. Conta de teste B: tentar adivinhar o ID de história/mensagem de A; RLS e RPC devem negar.
7. Testar celular: rascunho por história, teclado, rolagem, nova ficha de memória e TXT/JSON apenas da história selecionada.
8. Confirmar que o GitHub está sincronizado no Lovable e só então ativar flags em teste.
9. Realizar rollout gradual no projeto principal após aprovação. Em caso de incidente, desligar as flags sem remover dados.
