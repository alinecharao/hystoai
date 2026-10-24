# Fase 1 — Sincronização persistente e proteção de ações (24/10/2026)

## Escopo e limite
Revisão da `main` do Hysto no commit `0c21fa1`. Ajustes limitados ao chat cliente; não alteram banco, Secrets, RPCs, permissões nem conteúdo de conversas reais. Sem acesso ao runtime/DB Lovable para reproduzir concorrência multi-abas. Usar conversa descartável em Preview antes da publicação.

## Problema reproduzido na revisão
Depois de `useChat.regenerate()`, os callbacks `onFinish/onError` invalidavam as consultas mas chamavam `setMessages(initial)`, onde `initial` podia ser um *snapshot antigo* capturado pelo React. Isso podia restaurar IDs e mensagens desatualizados depois de uma resposta alternativa. Além disso, `sendingLock.current` era liberado antes do refresh persistido para envios normais e operações de exclusão não impediam outra ação durante o `await`.

## Implementado
- `src/lib/chat-reconciliation.ts`: converte linhas persistidas em mensagens do SDK, preservando a identidade por ID mesmo para textos duplicados.
- Após finalizar ou falhar uma geração, consulta o histórico no banco antes de liberar o bloqueio local.
- Regeneração restaura o histórico **recém-buscado**, nunca a variável `initial` do render antigo.
- Ao apagar mensagem ou conversa, o cliente só altera a UI depois de confirmação do servidor + nova leitura do banco; elimina a exclusão otimista.
- Exclusão individual e total agora mantêm `sendingLock` e estado visível de exclusão durante toda a operação. Erro de sincronização após exclusão confirmada não é apresentado como falha de exclusão.
- A recuperação consulta um único snapshot das últimas mensagens persistidas, em vez de duas queries conflitantes ou de buscar o histórico inteiro.
- Se o envio for rejeitado antes de salvar a mensagem do usuário, o rascunho é restaurado no campo de digitação **apenas após confirmar no banco que o UUID não existe**. Se a persistência não puder ser verificada, não induzir reenvio de possível duplicata.
- Testes unitários da conversão: IDs persistidos, duplicatas, reset vazio, imutabilidade, turno pendente e confirmação de envio por UUID.

## Teste recomendado no Preview
1. Na história de teste, enviar duas mensagens e confirmar que cada resposta aparece **uma vez** após atualizar a página.
2. Na última resposta, gerar alternativa duas vezes; alternar 1/3, 2/3 e 3/3 e atualizar a página. As versões devem permanecer; nenhuma mensagem desaparece ou reaparece.
3. Apagar uma mensagem de teste e confirmar que a UI corresponde ao histórico persistido após atualizar.
4. Apagar a conversa descartável e tentar clicar rapidamente em enviar/apagar enquanto a exclusão está em processamento; não deve enviar ou excluir duas vezes.
5. Forçar um erro de provedor em conversa **descartável**, nunca danificar intencionalmente mensagens pessoais. Após falha real, conferir se a última mensagem do usuário permanece para recuperação.
6. Testar em iPhone PWA e desktop. Registrar comportamento ao trocar de aba durante uma geração.

## Pendências para próximas iterações
- Exclusão transacional multi-dispositivo ainda **não está garantida** apenas com bloqueio de UI; precisa de RPC no banco e verificação de RLS no Lovable antes de ativação.
- Persistência de `streamText.onFinish` precisa de testes com queda real do DB e do provedor. CI não testa comportamento de produção.
- A memória narrativa e a divisão em histórias independentes são próximas fases; não modificar histórico atual nem resetar dados.
- Testes de ponta a ponta automatizados exigem ambiente Supabase de teste isolado com credenciais de testes, nunca dados de produção.
