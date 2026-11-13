# Hysto — etapa 2: preparo seguro do banco e restauração (13/11/2026)

## Escopo e estado
- Ambiente de código: branch `testing`. A `main` não deve ser editada nesta etapa.
- Banco principal: **somente leitura**, sem alterações de esquema, de dados, flags ou permissões.
- O banco principal observado possui o esquema legado. As tabelas `stories` e
  `story_memory_checkpoints`, as colunas `story_id` e as RPCs modernas não
  estão instaladas. A UI multi-história e o servidor devem permanecer **desligados**.
- A cópia Lovable de testes previamente documentada está inacessível (404).
  Não utilizar o banco principal como banco de testes substituto.
- Verificação de integridade de leitura em 13/11: 4.526 mensagens, 269
  respostas alternativas, 24 notas, sem referências órfãs nos principais
  relacionamentos. Foi identificado **um checkpoint automático legado inválido**;
  o motivo exato não foi consultado após o limite de requisições da integração.
  Esses números não comprovam uma cópia de segurança.

## Correção incluída no testing
A migração `20261029_story_isolation_stage1.sql` antes copiava
`story_memories.last_processed_message_id` diretamente para uma coluna
`story_memory_checkpoints.last_processed_message_id` com chave estrangeira.
Uma referência removida, privada de outro dono, de outro personagem, ou
apontando para uma mensagem do usuário podia abortar toda a migração.

A nova regra mantém o registro e o identificador originais **inalterados** em
`story_memories`, transfere o resumo e os campos de memória e copia o ponteiro
para o checkpoint **apenas se corresponder a uma mensagem de assistente válida
do mesmo usuário, personagem e história**. Caso contrário, o novo ponteiro é
`NULL`; nenhuma mensagem, nota ou resumo é apagado. Esse checkpoint exige
revalidação antes de ser considerado atual.

## Guardas SQL somente de leitura
1. `supabase/verification/20261113_story_migration_preflight.sql`: antes
   do Stage 1, verifica esquema legado, vínculos, identidades e permissões
   básicas. Referências inválidas de checkpoints são reportadas como aviso
   e preservadas; outros vínculos inválidos bloqueiam a migração.
2. `supabase/verification/20261113_story_cutover_readiness.sql`: após
   Stages 1 e 2, mas antes de revogar RPCs legadas, verifica tabelas/RLS,
   colunas obrigatórias, integridade, permissões de funções e ausência de
   gerações em andamento. Uma falha **bloqueia o cutover**.

O workflow `.github/workflows/story-isolation-db.yml` executa ambos sobre
um PostgreSQL descartável com somente dados sintéticos, incluindo o novo
caso de memória antiga com referência inválida. Isso não substitui o teste
em uma cópia fiel do banco real.

## Bloqueadores antes de qualquer migração de produção
1. Disponibilizar uma cópia PostgreSQL **isolada** do ambiente real,
   com usuários fictícios ou dados protegidos. Verificar que projeto,
   credenciais, variáveis e instância não apontam para produção.
2. Criar um **backup criptografado e restaurável**, abrangendo esquema e
   dados PostgreSQL, identidades necessárias, configurações relevantes e
   objetos de storage associados, conforme a infraestrutura utilizada.
   Guardar segredos fora de GitHub, logs, documentos e tickets.
3. **Restaurar** esse backup em um destino descartável e conferir
   verificações de integridade, contagens e consultas com uma conta
   autorizada. Não basta existir um arquivo `.sql` ou `.dump`.
4. Executar o preflight legado no clone. Corrigir divergências antes de
   executar a migração; não remediar apagando mensagens ou notas.
5. Aplicar apenas Stages 1 e 2 no clone e executar os testes de isolamento
   com dois usuários e duas histórias do mesmo personagem.
6. Executar o readiness gate; testar envio, recuperação de resposta,
   regeneração, seleção de alternativas, notas, memória, exportação,
   arquivamento, exclusão e acesso negado entre histórias/usuários.
7. Planejar **janela de manutenção sem gerações ativas** e verificar
   correspondência de `HYSTO_MULTI_STORIES` (servidor) com
   `VITE_HYSTO_MULTI_STORIES` (client). Só depois de autorizar a
   mudança, planejar Stage 3 no banco real e publicação coordenada.
8. Definir procedimento de rollback com restauração do backup e
   reversão consciente das permissões revogadas. **Desligar flags depois
   de Stage 3 não restaura automaticamente as permissões legadas.**
9. Manter desligadas até aprovação separada as flags de imagens faturáveis
   e criptografia; essas funcionalidades têm critérios próprios.

## Status desta etapa
- Corrigida a migração para checkpoints legados inválidos.
- Adicionados teste sintético e duas verificações de bloqueio somente
  de leitura ao pipeline de CI.
- Ajustado o dashboard para não oferecer exclusão geral legada quando
  `VITE_HYSTO_MULTI_STORIES` estiver habilitado.
- **Não executado**: backup real, prova de restauração, migrações no banco
  principal, ativação de flags, cutover ou testes autenticados no clone
  indisponível. Não declarar a implantação concluída sem esses itens.
