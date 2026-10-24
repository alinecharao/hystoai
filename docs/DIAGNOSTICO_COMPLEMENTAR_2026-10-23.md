# Hysto — diagnóstico complementar de regressões (23/10/2026)

## Método
Inspeção estática da `main` no commit `394ee2d`, incluindo fluxo de mensagens (cliente/servidor), histórico, alternativas, banco e migrações, login e personagens, interface e CI. O pipeline da `main` terminou com sucesso antes desta rodada. **Sem acesso direto ao runtime Lovable, Secrets, registros privados ou banco real**; não há como certificar comportamento de produção sem esses testes. Nenhum registro do usuário foi modificado ou excluído.

## Correções incluídas nesta branch
- **Falas com aspas tipográficas `“...”`:** a serialização para a IA só reconhecia aspas ASCII `"..." `. Uma fala com aspas brasileiras era encaminhada como `USER_TEXT`, aumentando o risco de o personagem não reconhecer que alguém falou em voz alta. Agora ambos os estilos criam `DIALOGUE`; entradas entre colchetes continuam privadas como memória/sonho; asteriscos continuam como fala mental. Testes cobrem casos válidos e delimitadores incompletos.
- **Edição rápida de persona:** a consulta pós-salvamento não retornava `is_default`, então uma persona anteriormente padrão podia perder esse indicador no estado local até o próximo carregamento. A consulta agora o recupera sem alterar o registro no banco.

## Matriz de riscos remanescentes
| Severidade | Componente | Risco / evidência | Próximo passo seguro |
| --- | --- | --- | --- |
| P1 | Continuidade após regenerar | Ao selecionar uma alternativa, `storyMemory` é anulada se seu checkpoint pertence à resposta original (`api/chat.ts`). Isso evita fatos da versão descartada, mas pode temporariamente perder fatos duradouros anteriores até que uma nova memória seja consolidada. | Teste narrativo com conversa longa e alternativa selecionada; desenhar checkpoints versionados sem assumir que a memória original é compatível. |
| P1 | Memória em paralelo | O caminho antigo compara a mensagem mais recente antes do `upsert` (não transacional). RPC aditiva de checkpoint existe, mas depende de migração e flag `HYSTO_ATOMIC_MEMORY_CHECKPOINT=true`. | Aplicar SQL no ambiente de testes, verificar RPC somente leitura e ativar flag apenas após validação. |
| P1 | Exclusão multi-dispositivo | Cliente bloqueia excluir durante geração **na aba atual**, mas DELETE da API não participa da mesma trava transacional da geração. Outra aba pode excluir mensagem/conversa antes de a resposta terminar. | Projetar exclusão transacional/adiamento de exclusão por conversa com teste entre dois dispositivos. Não trocar APIs/migrações em produção sem teste. |
| P2 | Persistência de streaming | `onFinish` grava a resposta após geração, e um erro de rede nessa etapa pode deixar resposta visual não persistida, apesar de a mensagem do usuário ter sido salva. | Simular queda de banco entre geração e gravação, reabrir chat e validar recuperação. |
| P2 | Limites de tokens | Groq reduz histórico mas mantém o system prompt inteiro, que é extenso. O limite de TPM do provedor pode ser ultrapassado mesmo com poucas mensagens. | Medir tokens reais do prompt; compactar instruções redundantes mantendo CANON e fatos do usuário. Testar em Groq real, sem forçar novas tentativas em massa. |
| P2 | Custos de memória | O servidor inicia uma segunda geração de IA em background para atualizar memória em cada resposta, sujeita a cotas, quedas ou término de tarefas pós-resposta. | Instrumentar taxas de sucesso, uso de tokens e latência; considerar fila durável ou política de checkpoint, preservando a continuidade. |
| P2 | Banco/RLS | O SQL histórico concede INSERT de `messages` autenticado sem restringir `role='assistant'`; medidas do endpoint não substituem grants/RLS corretos. | Auditar grants e políticas efetivas no Lovable antes de migração de reforço; executar testes com dois usuários. |
| P2 | Repositório | `.env` ainda é rastreado no Git e contém URL, ID do projeto e chave publicável (não a service role, conforme nomes inspecionados). | Considerar retirar do versionamento quando houver mecanismo de configuração no Lovable/CI confirmado. Não publicar secrets. |
| P2 | PWA | Não foi possível reproduzir em aparelho instalado, em especial safe area, teclado virtual, sessões longas e aquecimento. | Teste físico em Android e iOS após publicar o Preview. |

## Checklist de regressão no Preview
1. Enviar fala com `“aspas curvas”` e confirmar que o personagem reage como fala, não pensamento/narração.
2. Enviar `[lembrança privada]` e `*fala mental*` e confirmar privacidade conforme contexto.
3. Regenerar a última resposta duas vezes, alternar versões, atualizar e continuar a história. Nenhuma resposta deve sumir ou reaparecer indevidamente.
4. Deixar uma mensagem pendente por falha legítima e recuperá-la sem duplicar o turno.
5. Editar uma persona marcada como padrão no chat e confirmar que segue marcada após salvar e atualizar a página.
6. Com conversa de teste em duas abas, evitar exclusões durante geração até ser implementado controle transacional no backend.

## Limites da validação
GitHub Actions faz TypeScript, Vitest e build. Ainda faltam testes de integração com banco real e provedor de IA, políticas RLS em execução, carga de chats longos e concorrência multi-dispositivo. **Build verde não equivale a ausência de bugs.** Nenhuma migração destrutiva, reset, edição de históricos, publicação ou alteração de Secrets foi executada nesta rodada.
