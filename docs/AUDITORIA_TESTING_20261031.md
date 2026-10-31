# Hysto — Auditoria integral da branch testing
**Data:** 31/10/2026  
**Escopo:** código da branch `testing`, CI, migrações SQL e cópia Lovable de testes.  
**Não são comprovação de aprovação:** build/TypeScript/Vitest sem testes operacionais no navegador, ou testes SQL sem integração com provedores externos.

## Concluído nesta rodada

1. **Histórias arquivadas:** rota `/stories/$storyId` recarrega metadados e redireciona para a biblioteca se a história estiver arquivada, evitando links antigos com cache inconsistente.
2. **Cache de histórias:** renomeação/arquivamento invalida metadados e a barra global.
3. **Memória manual:** edição/exclusão passam a incluir o `story_id` quando disponível; o cache é invalidado com a mesma chave de identidade da história.
4. **Exportações:** formato `hysto-story-export-v2` inclui título/ID da história e checkpoint de memória consolidada, além das mensagens, versões alternativas e notas manuais. Compatibilidade de leitura do tipo v1 preservada nos formatadores. O botão não se chama mais “backup completo”, pois ainda não há função de importação/restauração.
5. **Custo de imagens:** o endpoint agora exige `requestId` UUID, reserva cota persistente **antes** de chamar o Gemini, e falha fechado se a migração de cotas faltar. Teto conservador de 3 tentativas por usuário/dia e 30 tentativas globais por dia; tentativas falhas não são automaticamente ressarcidas por possível cobrança do provedor. Uma terceira flag de servidor é obrigatória para habilitar cobrança.
6. **Identidade visual:** modo multi-história exige `storyId` explícito na geração de imagem. O modal comunica que vídeo ainda está indisponível, sem botão de gerar imagem ambíguo.
7. **Banco isolado:** migrações de histórias (stages 1/2) previamente aplicadas; transação manual com dois usuários fictícios e duas histórias do mesmo personagem comprovou separação, RLS e proibição de escrita cruzada. Teste revertido integralmente; 0 usuários/mensagens/histórias ao término.
8. **Quota na cópia isolada:** migração `20261031_visual_generation_quotas.sql` aplicada e verificada. A tabela está sem permissão de INSERT para `authenticated`, mas a RPC autorizada está disponível. A suíte PostgreSQL descartável verifica cota, idempotência e separação entre usuários.

## Situação atual por área

| Área | Estado | O que ainda falta |
| --- | --- | --- |
| Build, TypeScript, Vitest | CI executado, últimas alterações aguardam revisão final | Verificar último commit da testing e executar teste visual no Preview |
| Fase 3B — banco isolado | Etapas 1 e 2 presentes e testes RLS fictícios aprovados | Compatibilizar o código da cópia Lovable com `testing`; testar app autenticado com duas contas |
| Fase 3B — produção | **Desativada** | Backup restaurável, migrações autorizadas, stage 3 de cutover coordenada, ativação conjunta de servidor+UI e teste de rollback |
| Criptografia AES-256-GCM | Primitivas e armazenamento preparatório | Gateway autenticado para todo conteúdo, migração verificada, remoção de texto claro, rotação/backup da chave. Não está ativa |
| Imagens | UI, prompt, API bloqueada por padrão e quota persistente preparada | Teste faturável com credenciais autorizadas, armazenamento privado, gerenciamento de mídia, limites financeiros explícitos |
| Vídeos | Editor/descrição preparados | Provedor disponível, job assíncrono, limite de custo, storage privado, polling, thumbnail e erro/retry |
| Backup | JSON/TXT com mensagens, versões, notas e checkpoint | Importador, restauração verificada, dados de persona/configuração ainda não incluídos |
| Narrativa | Políticas de pensamentos, cronologia, conhecimento e elenco integradas | Avaliação qualitativa real de modelos com cenas de múltiplos personagens |
| Mobile/PWA | Interface responsiva existente, rotas montam | Regressão manual iOS/Android, teclado, navegação por avatar, rascunho, atualização offline |

## Regras de implantação

- Todos os ajustes novos são diretamente em `testing`. Não abrir PRs intermediários sem necessidade.
- Não executar migrações ou publicar na `main` antes da autorização expressa da usuária.
- Banco de teste: projeto Lovable `15c50d1c-507b-4669-9cb9-359b62d16c06`. Banco principal e histórico não foram modificados por esta rodada.
- **Não ativar** `HYSTO_MULTI_STORIES` / `VITE_HYSTO_MULTI_STORIES` com código e banco dessincronizados.
- **Não ativar** `HYSTO_VISUAL_GENERATION_ENABLED`, `HYSTO_VISUAL_BILLABLE_OPT_IN` ou `HYSTO_VISUAL_QUOTA_INSTALLED` em produção antes de revisão de cobrança, de storage e de credenciais.
- **Não ativar** cifra em banco antes de todos os leitores de mensagens/versões/notas/checkpoints serem substituídos por gateway autenticado.
- Stage 3 revoga RPCs legadas. Após stage 3, desligar flags não reestabelece permissões automaticamente: exige plano de rollback coordenado.

## Testes finais de aceitação no Preview

1. Duas histórias independentes com o mesmo personagem: criar, alternar e renomear. Arquivar e tentar abrir URL antiga; verificar redirecionamento e restauração.
2. História A com fatos exclusivos e História B sem esses fatos: chat, memória manual, alternativas, exclusão, regeneração, rascunho e reabertura.
3. Usuários distintos: tentar acessar ID da história/mensagem alheia; negar leitura e escrita.
4. Exportar .json e .txt e conferir igualdade entre histórico, versão escolhida, memória consolidada e notas manuais.
5. iPhone e desktop: menu de duas abas, barra direita, imagens/sugestões sem cobranças, teclado e rolagem.
6. Simular indisponibilidade Gemini, Groq e falhas de sessão sem deletar mensagens nem confundir personagens.
7. Com backups comprovadamente restauráveis e estágio aprovado, considerar ativação gradual e PR `testing -> main`.

**Conclusão:** a branch está mais consistente, mas a Fase 3B, a criptografia efetiva, imagens faturáveis e vídeo não estão concluídos para produção. Não transformar aprovação de CI em promessa de funcionalidade operacional.
