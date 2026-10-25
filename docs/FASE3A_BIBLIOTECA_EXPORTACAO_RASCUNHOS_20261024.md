# Hysto — Fase 3A: biblioteca, exportação e rascunhos

## Objetivo
Melhorar a experiência diária sem mexer em mensagens, memórias ou bancos existentes. Esta é a primeira entrega da Fase 3; ainda **não** altera o modelo de dados para suportar múltiplas histórias do mesmo personagem.

## Implementado
- **Mais recentes:** agora consulta o último horário salvo de cada personagem, limitado a cinco consultas concorrentes, e apresenta primeiro os chats efetivamente usados. Não confunde ordem de criação com última atividade.
- **Rascunhos:** texto ainda não enviado é guardado localmente por usuário e personagem e restaurado ao recarregar o navegador/PWA. Após enviar, limpa; se o envio falhar **antes do salvamento comprovado**, a lógica da Fase 1 recupera o texto. O recurso não realiza requisições de IA e não armazena conteúdo em banco. Navegação em dispositivos diferentes não sincroniza rascunhos. Browsers com armazenamento desabilitado continuam funcionando, porém sem recuperação local.
- **Exportação:** no menu do chat, `Exportar história (.txt)` contém a versão selecionada das respostas; `Exportar backup completo (.json)` inclui **todas as mensagens paginadas**, versões alternativas, IDs de relação entre mensagens e notas de memória manual da história atual.
- Paginação de 400 mensagens por consulta; se houver erro ou limite de segurança, **não** gera arquivo parcial silencioso. O histórico real do usuário nunca é alterado.
- Exportar é um download do próprio navegador (não envia histórico a servidores adicionais).
- Testes unitários: rascunhos isolados entre contas/personagens, indisponibilidade de armazenamento, exportação de resposta selecionada e fallback ao original.

## Teste no Preview
1. Em conversa descartável, escrever texto no chat **sem enviar**; recarregar o Preview, confirmar que o texto reaparece. Verificar em outra conversa que ele não foi copiado.
2. Enviar a mensagem de teste, atualizar e confirmar que o campo permanece vazio. Se houver erro de IA e a mensagem tiver sido salva, continuar a recuperação normal sem duplicar o turno.
3. Na aba **Mais recentes**, confirmar que as conversas realmente usadas aparecem na ordem de última mensagem, incluindo personagens padrão.
4. Menu do chat > **Exportar história (.txt)** e **Exportar backup completo (.json)**. Abrir os arquivos e conferir algumas mensagens antigas, IDs e versões 1/2. Não expor exportações com dados privados publicamente.
5. Repetir rascunho e exportação no iPhone; verificar downloads disponíveis em Arquivos no Safari. Safari/PWA têm limitações próprias para Downloads.

## Pendências arquiteturais da Fase 3B
O estado atual é uma conversa por `character_id + user_id`. O backend utiliza chaves de bloqueio de geração, respostas alternativas, resumos e memórias que pressupõem esse escopo. Para suportar múltiplas histórias ou ramificações reais sem misturar dados, uma migração aditiva precisa introduzir `story_id` em **todas** essas tabelas e RPCs e ligar o chat a `story_id`. A migração requer testes com duas abas, múltiplos personagens, exclusão individual e regeneração. Não criar um botão 'nova história' que apague o histórico atual.

## Rollout
Nenhuma migração SQL, nenhum envio de mensagens e nenhuma publicação automática nesta etapa. Integrar somente após CI (build, TypeScript, Vitest); testar no Preview com dados descartáveis antes de Publish.
