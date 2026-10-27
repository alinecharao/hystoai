# Hysto — pensamentos em posição narrativa contextual (27/10/2026)

## Problema
Com pensamentos ativados, alguns modelos começam frequentemente cada resposta com `[pensamento]...` mesmo quando o pensamento só faz sentido após uma fala, observação ou reação. O parser da interface já preserva a ordem original: não há uma regra de UI que mova pensamentos para o topo. A questão é de composição do texto pelo modelo e reprodução de padrões das respostas anteriores.

## Correção
- Substituir as duas instruções antigas, genéricas e redundantes, por uma política de **posição causal** colocada ao final do prompt de sistema, depois das outras regras.
- Explicitar que pensamento **não é prólogo obrigatório** nem deve ser sempre escrito no início.
- Instruir a manter estímulo → percepção/reação → pensamento → ação/fala, permitindo pensamento primeiro apenas quando cronologicamente apropriado.
- Incluir exemplos curtos de pensamentos entre ações e falas, e de respostas sem pensamento, marcados como **exemplos de forma, nunca acontecimentos da história**.
- Pensamentos opcionais e breves (1–3 frases) em primeira pessoa, apenas do personagem controlado pela IA; nunca controlar a protagonista.
- Se a opção estiver desligada, não gerar blocos de pensamento.
- Não reordenar programaticamente pensamentos após gerar, pois isso poderia alterar a causalidade e tornar a história incoerente.
- Testes verificam as instruções e a ordem renderizada para pensamento intermediário, múltiplos pensamentos, pensamento inicial legitimamente contextual e ausência de pensamento.

## Validação no Preview
1. Em conversa descartável, manter **Mostrar pensamentos** habilitado.
2. Apresentar ao personagem uma revelação no meio de uma cena. Confirmar que ele reage ao estímulo antes de formular o pensamento que depende dela.
3. Testar uma troca de falas com uma mudança de ação. Pensamento deve surgir após sua causa, não sempre na abertura.
4. Testar um turno simples (cumprimento ou passagem tranquila) e verificar que a IA pode responder sem pensamento.
5. Desativar pensamentos, enviar mensagem e confirmar que não aparecem novos blocos.
6. Regenerar duas respostas e verificar que o posicionamento é contextual sem alterar as versões antigas nem a ordem da conversa.
7. Conferir desktop e iPhone para blocos visuais separados e rolagem normal.

## Limitações
Regras de prompt aumentam a probabilidade de bom posicionamento, mas diferentes modelos ainda podem ocasionalmente abrir com monólogos. Testes automatizados confirmam formatação e código, não comportamento narrativo real. Alterações se aplicam somente a respostas futuras; mensagens persistidas não são reescritas.

Sem migração SQL, mudança de Secrets, chamada de IA extra, alteração de histórico ou publicação automática.
