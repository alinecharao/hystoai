# Hysto — Correção de formatação dos pensamentos (27/10/2026)

## Sintoma confirmado
Algumas respostas do personagem são geradas com `[pensamento]texto[pensamento]` em vez do par correto `[pensamento]texto[/pensamento]`. O parser anterior reconhecia **apenas** blocos com barra de fechamento; por isso, mesmo após a correção da posição narrativa, parte dos pensamentos aparecia misturada com a narração e com a marcação técnica visível.

## Mudanças
- O parser da apresentação reconhece tanto `[pensamento]...[/pensamento]` quanto o fechamento incorreto com um segundo `[pensamento]`.
- Preserva a sequência exata de narração, pensamentos e falas. Não reordena o conteúdo nem altera o texto que está salvo no banco.
- Ao encontrar um bloco sem fechamento, mantém seu texto legível como narração; não oculta inadvertidamente as falas seguintes.
- Também preserva suporte a `<thought>...</thought>`/`<thinking>...</thinking>` quando o modelo usa outra sintaxe.
- Diferencia pensamentos visualmente por margem, fundo sutil, borda lateral e espaçamento, com boa leitura em dispositivos móveis.
- O prompt reforça o fechamento com barra, a separação entre parágrafos e que a IA nunca deve emitir `[pensamento]` como tag de encerramento.
- Testes: formato correto, formato incorreto da IA, múltiplos pensamentos, bloco não encerrado, marcação XML e ausência de monólogo.

## Roteiro Preview
1. Atualizar o Preview sincronizado com a `main`; abrir a conversa onde o pensamento vinha como texto comum. O parser deve corrigir inclusive mensagens antigas **na exibição**, sem editar as mensagens salvas.
2. Conferir que o pensamento aparece onde já está escrito na narrativa (no meio, depois de uma ação ou antes de uma fala), com formato de bloco e sem tags técnicas.
3. Gerar resposta nova com pensamentos ativados; confirmar que a IA fecha `[/pensamento]` e utiliza blocos separados.
4. Desativar Mostrar pensamentos e confirmar que os blocos fechados deixam de aparecer; falas e ações devem continuar legíveis.
5. Conferir rolagem, tamanho de fonte e espaçamento no iPhone e desktop.
6. Testar regeneração e versões alternativas. O parser deve mostrar corretamente qualquer versão sem modificar IDs ou o histórico.

## Limites
A IA ainda pode ocasionalmente gerar marcações incorretas, mas a interface ficou tolerante ao fechamento repetido. Esta correção não requer SQL, mudança de dados, novos custos de IA ou publicação automática.

## Nota de sincronização com o Lovable (27/10/2026)
O arquivo armazenado no Lovable pode permanecer numa revisão anterior ao PR #16 mesmo quando a `main` já passou por build e testes. Em tal caso, o parser antigo exibe `[pensamento]texto[pensamento]` como texto comum. Esta atualização documental no ramo sincronizado serve também para emitir um novo evento de push e solicitar ao Git Sync do Lovable que atualize os commits pendentes. Ela **não** muda o aplicativo, banco, Secrets nem histórico. Verificar `Project settings → Git` para confirmar que o projeto recebeu o commit mais recente antes de testar novamente no Preview.
