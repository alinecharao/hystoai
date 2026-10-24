# Gemini no Hysto — modelos de texto e fallback (24/10/2026)

## Escopo
O chat continua mostrando **Gemini** e **Automático** no seletor de provedor. Ao selecionar Gemini, o roteador tenta modelos de texto do Google em ordem de prioridade, sem trocar a persona, o histórico ou as regras narrativas. Os modelos que realmente funcionam são determinados pela **chave e cota do projeto Google**, e não apenas pela listagem pública de nomes.

Modelos padrão (Flash estáveis, ordem de tentativa):
1. `gemini-3.8-flash`
2. `gemini-3.6-flash`
3. `gemini-3.5-flash-lite`
4. `gemini-3.1-flash-lite`

A versão anterior incluía `gemini-3.5-flash`, que não consta na lista atual de modelos estáveis da documentação oficial. Pro e preview ficam fora da lista automática por padrão, pois podem ter restrições de disponibilidade, preço e quota distintas.

## Configuração opcional
- `GEMINI_MODEL`: primeiro modelo a tentar. Se ausente, padrão `gemini-3.8-flash`.
- `GEMINI_MODELS`: modelos adicionais separados por vírgulas, inseridos entre o preferido e a lista padrão. Exemplo: `gemini-3.1-pro-preview,gemini-3.5-flash-lite`. Ative modelos pagos **somente após conferir faturamento/cota**, nunca automaticamente por suposição.
- Uma lista deduplicada limita tentativas a no máximo 8 modelos. Se o usuário definir um modelo que não tem acesso, o roteador tentará as alternativas padrão após a falha reconhecida como modelo indisponível.

## Tratamento de erros
- Erro HTTP 400 **específico de modelo inexistente/indisponível** passa para o próximo modelo Gemini.
- Erro HTTP 400 genérico (payload inválido) não passa automaticamente para outro modelo.
- Bloqueio/moderação permanece um bloqueio; não há bypass.
- Limite diário 429 mantém a lógica de bloqueio temporário por modelo já existente.
- Na opção Automático, a sequência atual de provedores continua intacta.
- Nenhuma chave é exposta ao navegador ou incluída em logs desta alteração.

## Verificação segura
1. CI: TypeScript, testes Vitest e build.
2. No Preview, selecionar **Gemini** e enviar um trecho simples de conversa de teste.
3. Confirmar resposta e logs com o identificador do modelo escolhido (não logar prompt ou chave).
4. Se o Gemini retornar erro, verificar o status/classificação do log sem copiar credenciais.
5. Usar **Automático** para garantir fallback aos outros provedores quando a lista Gemini falhar.
6. Testar a continuidade de 2–3 turnos. Não excluir conversas nem alterar o banco.

Fontes oficiais:
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/openai
- https://ai.google.dev/gemini-api/docs/rate-limits

**Limitação**: aprovação do CI não comprova que a chave do projeto tenha acesso a todos os modelos; isto exige execução real no Lovable e pode gerar consumo/cobrança conforme a conta.
