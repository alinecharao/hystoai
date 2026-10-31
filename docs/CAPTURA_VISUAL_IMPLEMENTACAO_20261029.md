# Hysto — Captura visual de cenas | Primeira integração

## Objetivo
Registrar um prompt editável para imagem ou vídeo a partir de uma resposta salva. Sugerir alguns momentos visualmente marcantes sem chamadas adicionais de IA, mas nunca gerar mídia de modo automático.

## Nesta implementação
- Botões manuais de imagem e vídeo próximos de **Guie a sua história**.
- Modal único com descrição editável, proporção e confirmação explícita.
- Sugestões heurísticas locais, sem custo de IA, somente em intervalos configuráveis e em mensagens de assistente já persistidas.
- Configurações por usuário + história: desativado/somente imagem/imagem e vídeo; frequência rara/normal/frequente.
- API de imagem restrita a mensagem e personagem pertencentes ao usuário autenticado, com validação opcional de `story_id`, dimensão de prompt e proporção.
- Provedor de imagem fixo `gemini-3.1-flash-image` (1K) via Gemini REST, sem envio de token/chave ao navegador.
- Resultado de imagem apenas temporário no diálogo, com botão de salvamento local. **Não existe galeria persistente de mídias ainda.**
- Interface de vídeo apenas prepara o prompt; **não inicia chamadas ao Veo**.
- Sem migração SQL, sem alteração de mensagens, respostas alternativas, histórico, memórias ou regra de geração de texto.

## Geração paga desativada por padrão
O GET `/api/visual-capture` somente reporta disponibilidade; nunca gera. O POST exige `type=image`, `confirmed=true`, ID UUID de mensagem existente do próprio usuário e uma sessão autenticada.

Só habilitar o POST quando, **após testes**, um operador configurar no servidor:
- `GEMINI_API_KEY` em segredo de servidor (já usada na geração narrativa quando configurada)
- `HYSTO_VISUAL_GENERATION_ENABLED=true`
- `HYSTO_VISUAL_BILLABLE_OPT_IN=true`

**Não configure essas flags nesta entrega**. Requer antes limite de gasto durável por usuário, telemetria de custos e testes reais de provedor; o limite em memória de 90s é apenas uma barreira adicional de melhor esforço e não é robusto em ambientes com múltiplas instâncias.

O modal mostra valor **referencial** da geração em 1K (US$ 0,067 por saída em 29/10/2026); custos de entrada, impostos, alteração de preços e créditos da conta externa podem variar. Consultar a página oficial: https://ai.google.dev/gemini-api/docs/pricing?hl=pt-br

## Próximas etapas bloqueadas
1. Confirmar modelo de vídeo, acesso faturável do projeto e duração/resolução; implementar job assíncrono e polling com escopo de usuário e história.
2. Criar bucket privado, RLS, tabela de mídia, statuses, armazenamento e links assinados antes de salvar mídia como parte permanente da história.
3. Evitar duplicação de cobrança com chave de idempotência persistente em banco, limite diário e travas por usuário.
4. Criar teste de integração com provedor em projeto de testes separado, sem dados de histórias reais; confirmar custo real.
5. Captura por imagem/avatar de referência como fonte visual, preservando personalidade e aparência de personagens; não confundir descrição inventada com fato canônico.
6. Compatibilidade com a futura criptografia: notas e prompts visuais não devem vazar conteúdo por tabelas públicas.

## Roteiro de testes
- Clicar manualmente nos ícones: abrir modal, editar prompt e mudar proporção não pode emitir chamada de geração.
- Verificar disponibilidade da imagem como desativada por padrão.
- Confirmar que botão gerar fica desativado até haver habilitação explícita, cena persistida e prompt válido.
- Ativar/desativar sugestões em Configurações e trocar entre diferentes chats: sem preferências vazando.
- Uma cena curta não sugere; cena visual com frequência definida pode sugerir; clicar na sugestão abre modal da mensagem certa.
- Mensagem temporária do streaming não pode ser usada como âncora para uma geração cobrável.
- Botão de vídeo não deve iniciar chamada ao provedor.
- Build, typecheck e testes unitários nas duas rotas (legado e Fase 3B).

## Situação
Entrega em branch separada; não publicar nem ativar chamadas pagas sem finalizar os itens de segurança e armazenamento.
