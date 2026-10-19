# Hysto — auditoria inicial da reconstrução (2026-10-19)

## Escopo
Inspeção **estática** do repositório `alinecharao/hystoai`, branch `main`. Não houve acesso ao banco de dados em execução, execução de SQL, testes automatizados ou inspeção dos registros migrados.

## Constatações verificadas

1. A branch principal contém `src/routes/api/chat.ts` e `src/routes/_authenticated/chat.$id.tsx`, ainda com a lógica anterior de chat e operações de exclusão. A reconstrução do chat **não está concluída**.
2. A migração `supabase/migrations/20261019_hysto_v2_foundation.sql` cria tabelas `v2_*`; a aplicação atual ainda referencia tabelas legadas. A presença do arquivo **não prova** que a migração foi aplicada no Supabase.
3. Existem dois conjuntos de migrações: `supabase/migrations/` e `drizzle/migrations/`. É preciso determinar qual ferramenta realmente controla a evolução do banco antes de aplicar qualquer migração.
4. `src/integrations/supabase/client.server.ts` oferece cliente administrativo com chave de serviço. Confirmar que só é importado em rotas de servidor e que toda operação administrativa tem validação de identidade e propriedade.
5. Há um arquivo `.env` versionado no repositório (não inspecionar nem reproduzir valores em relatórios). `.gitignore` foi ajustado para impedir novos arquivos `.env`, mas isso **não retira** o arquivo já rastreado nem elimina dados do histórico Git. Revisar os valores e rotacionar qualquer segredo real exposto.
6. `supabase/config.toml` contém um identificador de projeto. Confirmar que corresponde ao novo projeto de testes, sem inferir pela existência do arquivo que o Lovable já está conectado ao projeto correto.

## Prioridade de execução

- **P0:** confirmar o projeto Supabase conectado e obter inventário real de tabelas, constraints, índices, políticas RLS e contagem de registros. Fazer backup antes de qualquer migração.
- **P0:** verificar se `.env` versionado contém segredos e rotacioná-los quando necessário; não enviar credenciais ao chat.
- **P1:** mapear todas as operações de DELETE e garantir que só respondam a ações explícitas, com ID exato e validação de propriedade.
- **P1:** definir o modelo de conversas e versões de resposta, sem excluir ou sobrescrever respostas existentes durante regeneração.
- **P2:** revisar RLS e grants por operação (SELECT, INSERT, UPDATE, DELETE) e testar acesso cruzado entre dois usuários.
- **P2:** migrar a lógica gradualmente mantendo o layout existente.

## Critério de segurança

Não executar `db reset`, `DROP`, `TRUNCATE`, migrações destrutivas ou substituições de tabelas antes de validar os dados reais e aprovar um plano de migração. Não presumir que o banco corresponde ao esquema do GitHub.

## Referência técnica

Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
