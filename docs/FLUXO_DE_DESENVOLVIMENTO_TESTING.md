# Hysto — fluxo único de desenvolvimento (31/10/2026)

## Branches

- `main`: somente versões revisadas, aprovadas e prontas para publicação. Não fazer alterações diretas aqui durante os testes.
- `testing`: **única branch ativa de desenvolvimento**. Toda mudança posterior deve ser implementada, corrigida e validada nela, sem abrir uma nova branch/PR para cada ajuste.
- As branches `feature/phase3b-story-isolation-foundation-20261029` e `feature/phase3b-message-encryption-foundation-20261029` são históricas/superadas. Não fazer novos commits nelas.

## O que está incluído em testing

1. Fase 3B — biblioteca e múltiplas histórias por personagem, isolamento de mensagens e memórias, migrações SQL em três etapas.
2. UI — menu em duas abas, barra global de chats à direita (mobile horizontal), navegação por avatar.
3. Captura visual — botões de imagem/vídeo e sugestões sem geração automática; chamadas pagas desativadas por padrão.
4. Personalização narrativa — pensamentos, repertório e diálogos de personagens secundários.
5. Preparação da criptografia AES-256-GCM para mensagens (PR #18). **Ainda não ativada em produção**, depende de gateway seguro e migração verificada.

## Qualidade e liberação

- As verificações de build, TypeScript, Vitest e testes SQL devem passar após cada atualização em `testing`.
- As migrações precisam ser aplicadas e validadas em banco **isolado**, com dados fictícios e teste de permissão entre duas contas.
- O projeto principal do Lovable **não** é banco de testes: a presença do código não autoriza aplicar SQL, ativar flags ou gerar cobrança.
- Confirmar no Lovable que a branch selecionada é **testing**. A conexão do Lovable deve acompanhar esta branch; a mudança na seleção do Git é uma ação separada da criação da branch.
- Não ativar `HYSTO_MULTI_STORIES`, `VITE_HYSTO_MULTI_STORIES`, `HYSTO_VISUAL_GENERATION_ENABLED` ou criptografia até passar pelos testes pertinentes.
- Antes de liberar em `main`, exigir backup restaurável do histórico original e testes de regressão no Preview desktop/mobile.
- **Somente depois da aprovação da usuária**, abrir um PR `testing -> main`, revisar as diferenças e fazer merge. Publicação é decisão distinta do merge.

## Estado dos PRs antigos

- PR #18 (criptografia): incluído em `testing` por merge com dois pais, resolvendo a divergência de workflows.
- PR #17 (Fase 3B): substituído pelo processo `testing -> main`, sem efetuar merge para `main` nesta fase.
- Os PRs #19–#25 de ajustes menores já estavam integrados à Fase 3B antes da consolidação.

## Observação sobre banco de testes Lovable

A cópia isolada `15c50d1c-507b-4669-9cb9-359b62d16c06` recebeu somente as migrações 1 e 2 antes de o limite temporário de consultas voltar a bloquear a conexão. A migração de cutover e a criptografia não foram aplicadas no banco principal. Necessário sincronizar o código da cópia de testes e concluir os ensaios autenticados antes de aprovar `main`.
