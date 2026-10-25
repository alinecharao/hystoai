# Hysto — Fase 2B inicial: memória manual sem IA (25/10/2026)

## Objetivo
O jogador decide quais fatos guardar. Não inferir automaticamente o que é importante, não passar as últimas 36 mensagens a um resumidor nem gerar despesas adicionais de IA ao salvar notas.

## Interface
- Conversa → `...` → `Memória da história`: seção **Memórias escolhidas por você**, com botão Adicionar, tipo de informação, até 280 caracteres por nota, editar e remover. Até 24 notas por história.
- Ações sob as mensagens persistidas: **Guardar na memória**. Caso o usuário selecione explicitamente um trecho do texto, ele aparece no editor quando tem até 280 caracteres. Sem seleção válida, o editor abre vazio para que a pessoa escreva exatamente o fato que quer fixar. Nada é gravado automaticamente.
- Tipos: Fato importante, Linha do tempo, Quem sabe o quê, Informação privada. Exemplo: "Christopher não sabe que Aline teve aquele sonho".
- **Resumo automático (opcional, usa IA)** continua disponível somente por clique e confirmação, não é obrigatório para usar notas manuais.

## Servidor e consumo
- Por padrão, desativar a segunda chamada de IA após cada resposta; só ativar se o proprietário definir `HYSTO_AUTO_STORY_MEMORY=true` como variável de ambiente do servidor.
- Cada turno do chat ainda utiliza um modelo para **responder**; as notas não eliminam este custo. Adicionar, editar e remover fatos faz somente leituras/escritas no Supabase, não chama modelo.
- Se houver notas manuais, o prompt da história usa **somente elas como memória resumida**, ignorando o resumo automático antigo. Histórico recente e cânone ainda são usados para continuidade e têm precedência quando houver contradição.
- Conteúdo limitado no cliente, no SQL e no prompt (máximo 24 notas, 280 caracteres por nota, prompt com teto de caracteres). Textos manuais são dados e não comandos ao modelo.

## Banco
- Migração aditiva `supabase/migrations/20261025_curated_memory_notes.sql` cria `story_memory_notes` com RLS: cada nota pertence a um usuário e personagem. Instalar primeiro no **banco de testes** do Lovable/Supabase.
- `anchor_message_id` é a primeira mensagem do histórico da conversa. Isso evita que notas de uma conversa apagada sejam carregadas por uma conversa nova do mesmo personagem. As notas antigas não são apagadas quando o início da conversa é removido; elas deixam de ser consideradas no novo contexto.
- A migração **não** modifica `story_memories`, `messages`, respostas alternativas, personagens ou personas.

## Teste
1. Aplicar a migração somente em ambiente de teste/Preview com backup e verificar que a tabela aparece, RLS ativo e usuário 1 não lê ou escreve notas de usuário 2.
2. Abrir a ficha de uma conversa de teste, Adicionar uma nota de 50–100 caracteres, Salvar, atualizar a página e confirmar persistência.
3. Editar categoria/texto, remover nota e confirmar que as mensagens originais não são alteradas.
4. Selecionar texto na mensagem de teste, clicar Guardar na memória, editar e salvar o trecho; testar também sem seleção no celular.
5. Enviar mensagem nova de teste e confirmar que o personagem respeita a nota e NÃO ganha conhecimento privado indevido.
6. Conferir no backend que nenhuma geração `updateStoryMemory` ocorre por padrão. A resposta normal do chat ainda consome IA.
7. Testar resposta alternativa; notas devem refletir o que o usuário confirmou, independentemente de versões que não foram escolhidas.
8. Apagar conversa descartável e reiniciar com o mesmo personagem; a memória manual antiga não deve ser inserida no prompt do novo diálogo.

## Limitações
- O primeiro modelo de dados ainda é uma conversa por personagem. Quando o aplicativo aceitar **várias histórias simultâneas** por personagem, será preciso migrar as notas para uma chave `story_id` real.
- Apagar a primeira mensagem de uma conversa antiga impede a exibição das notas vinculadas ao primeiro ID; nenhuma nota é apagada da tabela. Este MVP não inclui religação de notas a outro início.
- Se a migração ainda não estiver instalada, o editor explica a indisponibilidade e o chat funciona sem as novas notas. Não corrigir com SQL manual no banco de produção sem revisão prévia.
- Ao desativar resumos automáticos, dados NÃO selecionados pelo jogador podem deixar de estar no contexto depois que mensagens antigas saem da janela recente — isso é intencional. As memórias escritas à mão têm limite e são interpretadas pelo modelo, não são garantias absolutas de comportamento.
