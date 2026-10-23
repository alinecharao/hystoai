# Hysto AI — auditoria de estabilidade e integridade (23/10/2026)

**Escopo:** inspeção estática de `main` e da branch `audit/2026-10-23-stability`, fluxos de login, personagens/personas, chat, regeneração, RLS declarada, provedores de IA, memória e CI. Inspecionamos a árvore do repositório, fontes TS/TSX, migrações e workflow. **Não tivemos acesso direto ao banco Lovable Cloud, aos Secrets nem ao runtime de produção.** O histórico real de usuários não foi lido nem alterado.

## Resultado e riscos

| Prioridade | Área | Achado | Tratamento |
| --- | --- | --- | --- |
| P1 | Login | Exceção de rede durante login podia impedir `setBusy(false)` e deixar a tela bloqueada | Corrigido na branch de auditoria usando `try/catch/finally`; aplicado também ao login Google |
| P1 | Exclusão | A API aceitava qualquer valor verdadeiro em `all`; por exemplo `"false"` seria interpretado como exclusão total | Corrigido: somente `all === true`, UUID validado e operações conflitantes recusadas |
| P1 | API chat | JSON inválido e `text` não textual podiam causar exceção do servidor; texto arbitrariamente grande aumentava erros/quota | Validações antes da gravação, mensagens de erro 400/413 |
| P1 | Memória | Resumos assíncronos podem terminar fora de ordem; comparação do último ID antes de um `upsert` não é transacional | Preparada migração aditiva `20261024_atomic_story_memory_checkpoint.sql`, chamada apenas se `HYSTO_ATOMIC_MEMORY_CHECKPOINT=true`; não habilitar antes de aplicar SQL |
| P1 | Persona | Upload acontecia antes de validar idade; falha após desmarcar persona padrão podia perder a seleção anterior | Corrigido: validação prévia, tratamento de exceções, rollback de melhor esforço da seleção anterior, limpeza de upload ao falhar |
| P2 | Personagem | Upload aceitava extensão do nome enviado e podia deixar imagem órfã caso falhasse assinatura; formulário podia continuar bloqueado | Corrigido: MIME/tamanho validados, extensão derivada de MIME, limpeza e `finally` |
| P1 | Qualidade CI | Workflow compilava mas não executava testes existentes | Adicionado `bunx vitest run` e testes de narração/pensamentos/comandos |
| P2 | Permissões | Migração inicial `messages` permite `INSERT` de `role=assistant` pelo próprio usuário via cliente autenticado; integridade do fluxo depende também da API | **Pendente de reforço arquitetural**: migração de permissões e escrita de respostas pelo servidor exigem planejamento/teste em ambiente isolado |
| P2 | Credenciais | `.env` existe no histórico Git com nomes de variáveis de projeto e chave publicável | Chave *publishable* não é segredo privilegiado, mas convém remover o arquivo rastreado e revisar histórico por segredos. Não reproduzir valores em relatórios |
| P2 | Memória/background | A geração de resumos é iniciada de forma assíncrona após salvar a resposta. No servidor, tarefas pós-resposta podem ser interrompidas dependendo do runtime | **Pendente de observação** em logs reais; o chat não depende desse resumo para persistir a resposta |
| P2 | Limites do provedor | Groq, Gemini e OpenRouter continuam sujeitos a cota, indisponibilidade e modelos permitidos por conta | Não são preveníveis por compilação; preservação/retry já testada, acompanhar erros do provedor |
| P2 | Mobile/PWA | Layout e travamentos precisam de testes em dispositivo instalado (especialmente barra de status e sessões longas) | Não verificável por revisão estática |

## Segurança verificada apenas no código

- `/api/chat` exige bearer token e valida claims para mutações.
- Exclusões de mensagens associam `id`, `character_id` e `user_id`. O uso de service role aumenta a importância desses filtros.
- Envio atômico bloqueia turnos simultâneos; reserva de geração impede duas respostas concorrentes para uma mesma mensagem pendente.
- Alternativas são armazenadas fora de `messages.content`; a resposta original não é substituída.
- O SQL de versões verifica proprietário e se a resposta ainda é a última; alternativas antigas são somente para consulta.
- RLS *declarada nas migrações* de mensagens, personagens, personas e memória restringe por `auth.uid()`. **Falta verificar o estado efetivo do banco Lovable.**
- Ausência de necessidade de reset, `DROP`, `TRUNCATE` ou migração de dados históricos.

## Validações já realizadas

- Testes manuais comunicados pela usuária: envio normal, atualização forçada, recuperação de mensagem pendente e gerações alternativas (incluindo seleção, persistência e continuidade) funcionaram no Preview.
- CI da branch de auditoria: instalação, TypeScript, Vitest e build aprovados no GitHub Actions após as correções iniciais.
- Compilação **não** comprova integridade de produção, políticas RLS efetivas, concorrência de múltiplos dispositivos, custos ou indisponibilidade de provedores.

## Consultas somente de leitura para validar RLS e integridade no Lovable

Não executar `DELETE`, `UPDATE`, `DROP` nem `TRUNCATE` durante auditoria.

```sql
select c.relname as tabela, c.relrowsecurity as rls_ativa
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
and c.relname in ('characters','messages','personas','story_memories',
'assistant_response_versions','assistant_regeneration_claims','chat_generation_claims')
order by c.relname;
```

```sql
select count(*) as respostas_com_vinculo_invalido
from public.messages a
left join public.messages u on u.id = a.reply_to_message_id
where a.reply_to_message_id is not null
and (a.role <> 'assistant' or u.id is null or u.role <> 'user'
or u.user_id is distinct from a.user_id
or u.character_id is distinct from a.character_id);
```

```sql
select to_regprocedure(
  'public.commit_chat_story_memory(uuid,uuid,text,text,text)'
) is not null as checkpoint_rpc_instalada;
```

`checkpoint_rpc_instalada=false` é esperado **antes** de aplicar a migração opcional.

## Rollout seguro desta auditoria

1. Validar CI no PR de auditoria com TypeScript, Vitest e build.
2. Testar login, envio e exclusão de **uma mensagem de teste** no Preview da branch; nenhuma conversa pessoal deve ser usada como material descartável.
3. Se aprovado, integrar as correções de código à `main`.
4. Para ativar a proteção transacional da memória: aplicar a migração SQL aditiva, confirmar RPC com consulta somente de leitura, adicionar `HYSTO_ATOMIC_MEMORY_CHECKPOINT=true` nos Secrets e verificar duas ou três respostas de uma história de teste. Se a RPC falhar, desativar a flag — o histórico original permanece inalterado.
5. Testar novamente após atualizar o Preview da `main` antes de publicar.

**Observação:** nenhum sistema complexo fica "à prova de qualquer erro" apenas com auditoria estática. O objetivo aqui é reduzir falhas conhecidas com proteção de dados, testes repetíveis e implantação reversível.
