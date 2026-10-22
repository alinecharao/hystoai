# Hysto — plano de validação funcional isolada

## Objetivo e estado atual

Verificar o envio completo, persistência única, vínculo da resposta, concorrência, falhas e recuperação sem atingir o Hysto principal.

- A prévia atual e o aplicativo publicado compartilham o mesmo Lovable Cloud. **A prévia atual não é um ambiente de testes isolado.** Uma branch do GitHub também não separa os dados.
- A consulta às superfícies do projeto mostrou apenas o projeto principal, sem drafts disponíveis neste momento.
- Nesta etapa foram feitas somente consultas e análise de arquivos; nenhum teste foi executado e nenhum ambiente foi criado.

## Ambiente seguro proposto

**Opção principal: um projeto Lovable separado, como cópia de testes do Hysto, com Lovable Cloud próprio.** O remix é documentado como uma cópia da estrutura sem os dados das tabelas. Não importar backup, contas, mensagens, personagens ou memórias reais.

Antes de qualquer teste, confirmar por leitura que:

1. O destino tem identidade de projeto, banco, autenticação e configurações independentes do principal.
2. O código do chat corresponde à versão selecionada do Hysto; nenhuma alteração de interface ou lógica de produção será necessária.
3. Não há dados reais no destino. Não presumir que contas, arquivos ou segredos ficaram isolados só porque o projeto foi copiado.
4. Já existem `messages`, `characters`, `story_memories`, `chat_generation_claims`, as funções de claim/release, o vínculo e o índice único de respostas, com permissões equivalentes às atuais.
5. As configurações do destino não apontam para banco, armazenamento ou provedor de IA do principal.

**Condição obrigatória: não executar migrações, nem permitir reprodução automática de migrações pendentes durante a preparação.** A documentação consultada não garante como a cópia provisiona cada objeto nem se aplica arquivos pendentes automaticamente. Confirmar esse comportamento antes de criar a cópia. Se a estrutura não puder ser disponibilizada respeitando essa condição, interromper a preparação e informar o impedimento; a aprovação deste plano não autoriza migrações.

Se houver um ambiente Test ou draft com isolamento efetivamente confirmado, ele poderá substituir o projeto separado. A disponibilidade e a independência de configurações desses recursos não foram comprovadas para este projeto.

## Recursos necessários

- Projeto de testes com banco próprio e estrutura já disponível, sem migrações.
- Uma conta exclusiva de testes, com endereço controlado para confirmação de cadastro; não reutilizar a sessão ou credenciais de Aline.
- Personagens privados fictícios, criados somente nessa conta de testes, um para cada cenário. Como o histórico é separado por usuário/personagem, isso mantém as conversas independentes sem adicionar tabelas.
- Configurações e credenciais de teste independentes; nunca copiar segredos ou dados de outros usuários.
- Um provedor real já suportado pelo Hysto, com chave exclusiva de teste, modelo existente e limite de custo autorizado, para comprovar geração real.
- Um simulador de IA controlável, fora do aplicativo, para atrasar uma resposta, produzir falha e contar chamadas com determinismo. Ele não substitui o teste com IA real.
- Navegador automatizado, cliente HTTP autenticado e consultas de leitura ao banco de testes para registrar evidências.

Não adicionar funções, alterar políticas, editar mensagens nem adaptar a interface para viabilizar os testes. Manter os registros sintéticos para auditoria; não programar limpeza destrutiva.

## Cenários e critérios de aprovação

### 1. Mensagem nova e geração completa — IA real

- Abrir a conversa fictícia vazia e enviar um texto sintético pelo campo atual de mensagem.
- Aguardar o término da resposta, não apenas o aparecimento dos primeiros caracteres.
- Consultar os registros e recarregar a conversa.
- **Aprovação:** exatamente uma mensagem do usuário e uma resposta não vazia persistidas; ambas reaparecem após recarga. O conteúdo original e o identificador do usuário permanecem iguais.
- **Vínculo:** `assistant.reply_to_message_id = user.id`; mesmo usuário e personagem; `user.id = user.client_message_id`.

### 2. Envios repetidos e simultâneos com o mesmo identificador

- Em outra conversa fictícia, enviar duas requisições simultâneas com o mesmo `clientMessageId` e conteúdo.
- Repetir esse identificador após a conclusão.
- **Aprovação:** uma única mensagem do usuário, no máximo uma resposta vinculada, e rejeição de envio repetido com 409. Contar chamadas de geração no simulador para verificar se a requisição perdedora realmente não chegou à IA.
- Não tratar esse resultado como prova de segurança para dois envios distintos com UUIDs diferentes; esse é outro cenário.

### 3. Falha da IA sem perda da mensagem

- Usar uma conversa fictícia nova e configurar o simulador para falhar antes de produzir texto.
- Enviar uma mensagem pelo fluxo normal.
- **Aprovação:** a mensagem original fica salva uma única vez; não há resposta vinculada; o erro é observado e o estado de envio deixa de estar ativo. A recarga preserva a mensagem.
- Tentar um novo envio com outro UUID.
- **Aprovação do bloqueio:** 409 por mensagem pendente e nenhuma nova mensagem gravada.
- Não criar falha usando credencial real inválida, recusas de segurança, esgotamento de créditos ou indisponibilidade intencional do serviço principal.

### 4. Recuperação e bloqueio de geração — somente no destino isolado

- Primeiro comprovar, no destino, que a recuperação desativada rejeita uma tentativa sem alterar mensagens.
- Somente após confirmar todas as barreiras de isolamento, permitir `HYSTO_ENABLE_CHAT_RECOVERY=true` **no servidor do projeto de testes**. Não alterar essa configuração no principal.
- Usar a mensagem pendente criada pelo cenário de falha; não criar outra mensagem do usuário.
- Fazer duas tentativas de recuperação simultâneas com `retryMessageId` igual ao ID original e identificadores de requisição novos e distintos.
- Manter a primeira geração em espera no simulador, enquanto a segunda tenta obter a trava.
- **Aprovação:** somente uma tentativa obtém a trava e inicia a geração; a outra recebe 409. A função de claim e a contagem de chamadas do simulador comprovam o bloqueio, não apenas o índice de respostas.
- Liberar a resposta da primeira tentativa.
- **Aprovação:** uma resposta vinculada à mensagem original, nenhuma duplicação do usuário e liberação da trava. Recarga exibe os dois registros.
- Tentar recuperar novamente o turno já concluído: deve ser rejeitado sem nova resposta.
- Repetir em uma conversa fictícia separada com falha antes de texto durante a recuperação: a mensagem original permanece, a trava é liberada e uma tentativa posterior pode obter nova trava.

## Detalhes técnicos do simulador e evidências

- O código atual permite configurar `KIMI_BASE_URL` e `KIMI_MODEL`. Avaliar essa opção **apenas no destino** para direcionar o servidor a um simulador compatível com `/chat/completions`, usando credencial fictícia. Não presumir que interceptar chamadas no navegador controla as chamadas de IA feitas pelo servidor.
- O simulador precisa oferecer streaming compatível, atraso controlado, falha antes do texto e contagem por cenário. Também precisa responder à chamada complementar de memória; separar essa contagem da geração da resposta.
- Verificar a acessibilidade do simulador a partir do servidor de testes. Se não for possível controlá-lo sem editar o aplicativo, classificar os testes determinísticos como bloqueados e pedir autorização específica para uma solução de teste; não modificar o código silenciosamente.
- Os claims têm validade de cinco minutos. Manter o teste de concorrência dentro desse período. Expiração e interrupção abrupta não serão consideradas comprovadas pelos testes de liberação normal; não falsificar `claimed_at` nem interromper o ambiente principal.
- Registrar IDs sintéticos, códigos HTTP, eventos de conclusão, contagens de chamadas, consultas antes/depois e leitura da conversa após recarga. Não registrar tokens, senhas ou segredos.
- No relatório, separar: **executado com IA real**, **executado com simulador**, **confirmado por consulta**, **analisado no código** e **bloqueado/não executado**.

## Limitações do Lovable Cloud e condições de parada

- Remix não é uma clonagem dos dados; autenticação, segredos e objetos necessários precisam ser conferidos separadamente. Isso favorece testes sintéticos, mas não garante que o destino esteja pronto.
- Não foi comprovada a disponibilidade de Test/Live ou drafts isolados neste projeto, nem isolamento de segredos nesses recursos.
- Um backup restaurado no principal altera os dados existentes; não será usado. Exportações completas também incluem contas reais, portanto não serão usadas neste plano.
- O fluxo atual usa provedores externos configurados por segredo; não há garantia de chave de teste ou geração gratuita. Uso real pode gerar custos, e falhas previsíveis exigem o simulador.
- Se faltar estrutura no destino, isolamento verificável, conta de teste, configuração independente ou controle seguro da IA, parar antes de enviar mensagens e apresentar o impedimento.

## Escopo da aprovação

A aprovação autoriza a preparação isolada e, somente depois das verificações de segurança, os cenários acima. Não autoriza migrações, mudanças de interface, alterações no principal, importação de dados reais, habilitação de recuperação no principal, publicação, exclusão de registros nem aceitação de uma cópia de testes sobre o projeto principal.