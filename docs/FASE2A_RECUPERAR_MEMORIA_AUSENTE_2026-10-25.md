# Recuperação manual de memória em histórias anteriores — 25/10/2026

## Problema encontrado
A ficha de memória introduzida na Fase 2A apenas faz SELECT em `story_memories`, verifica a origem e apresenta o resumo. Quando a atualização automática pós-resposta não foi persistida (por exemplo, término do processo após o streaming, quota/JSON inválido, política RLS ou ausência do checkpoint), a ficha exibia "Ainda não há memória consolidada". O botão rotulado "Atualizar memória" apenas repetia a leitura: **não gerava memória**. A imagem do Preview é compatível com essa situação, mas a causa exata do banco não pode ser determinada apenas pela captura.

## Alteração
- A ficha diferencia resumo ausente, checkpoint removido e checkpoint ligado a resposta substituída.
- O botão existente passa a chamar **Recarregar ficha** (somente leitura).
- Quando não há memória válida, aparece **Criar memória recente**. O clique exige confirmação de possível consumo de quota; **não** executa sozinho ao abrir o chat.
- Endpoint protegido por autenticação e `user_id + character_id`. Lê até as **36 mensagens mais recentes** (com uma linha extra para sinalizar histórico mais antigo), nunca outras conversas.
- Respeita as versões selecionadas para os turnos anteriores; por segurança, ainda bloqueia construção quando a **última** mensagem usa resposta alternativa selecionada, pois o atual RPC atômico não suporta associar o checkpoint à versão escolhida. Não recomenda desfazer a alternativa.
- Gera JSON de `summary, scene, known_facts`, com validação e baixo limite de tentativas/cotas. Rotula o resumo como **parcial** se houver mensagens anteriores. Um registro parcial nunca será apresentado como memória da história inteira.
- Antes de salvar, confere o último turno e as versões novamente. Se `HYSTO_ATOMIC_MEMORY_CHECKPOINT=true` e RPC instalado, usa gravação transacional. Sem a flag, usa a gravação legada condicionada à revisão anterior da linha; neste modo ainda existe uma pequena janela de concorrência multi-aba, que demanda migração/feature flag antes de ser considerada totalmente fechada.
- Nenhuma migração, exclusão de mensagens, alteração de persona ou processamento automático em massa.

## Teste no Preview
1. Abrir história antiga e menu `...` → `Memória da história`.
2. Se vazia, clicar `Criar memória recente` e confirmar. Verificar resposta ou erro legível.
3. Se gerar com sucesso, conferir os **fatos no contexto recente**, ciente de que 36 mensagens não cobrem necessariamente a história inteira. O marcador **MEMÓRIA PARCIAL** deve aparecer quando o histórico for maior.
4. Fechar, reabrir e `Recarregar ficha`: a memória deve continuar visível. A alteração da história deve continuar com os dados salvos; testar também no iPhone.
5. Na conversa de testes com resposta alternativa escolhida, o botão deve explicar a limitação sem perder mensagens ou versões.
6. Simular somente falhas naturais de quota/rede; nunca modificar credenciais ou apagar histórias reais para tentar reproduzir.

## Limitações de escopo
- A reconstrução de longo prazo por toda a cronologia, com proveniência verificável e memórias por ramificação, pertence à **Fase 2B**.
- Memória derivada de um modelo pode conter erros e deve ser conferida com as mensagens fonte.
- O backend precisa de IA configurada e de permissão de leitura/escrita na tabela; testes unitários/build não validam cotas nem RLS em produção.
- A atualização automática pós-resposta continua best-effort; a presente funcionalidade adiciona caminho manual de recuperação síncrona, não substitui uma fila durável.
