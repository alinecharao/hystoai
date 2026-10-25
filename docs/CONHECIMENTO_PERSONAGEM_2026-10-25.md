# Hysto — conhecimento plausível do personagem e correções factuais (25/10/2026)

## Problema
Mesmo com instruções para limitar o conhecimento do personagem, o modelo tende a **reconhecer automaticamente todas as referências** a cantores, bandas, músicas, pessoas, filmes e lugares. Isso pode gerar detalhes factuais incorretos e memórias falsas (por exemplo, fingir ter estado em um show). O conhecimento do modelo **não** equivale ao repertório plausível do personagem.

## Solução sem custo extra de IA
Novo seletor de **repertório** na barra inferior do chat, com três modos:
- **Cauteloso** (padrão): conhece o que faz sentido conforme biografia e contexto. Não deve reconhecer automaticamente músicas, celebridades e referências pouco familiares; pode admitir desconhecimento parcial ou completo.
- **Natural**: repertório cultural plausível, com uma mistura de familiaridade e desconhecimento, mas sem detalhamento não confiável.
- **Só estabelecido**: para referências específicas, declara conhecer somente se houver evidência de familiaridade no cânone ou nesta história. Conhecimentos cotidianos básicos continuam permitidos.

A escolha é armazenada localmente por usuário + personagem. Não exige nenhuma nova tabela, não edita nem apaga mensagens e não faz chamada adicional de IA. Aplica-se **às próximas respostas**; não reescreve diálogos já salvos. Em outro dispositivo, o padrão é Cauteloso até escolher novamente.

## Precisão e privacidade
- Instrução de alto peso posicionada ao fim do contexto do sistema: não inventar discografia, ano, integrantes, letras, eventos ou experiências pessoais para parecer conhecedor.
- Correções factuais feitas pelo usuário como autora da história devem ser aceitas sem criar justificativas retroativas. Uma correção editorial não é automaticamente uma fala audível ou um conhecimento do personagem.
- Notas manuais da categoria `Informação privada` mantêm restrição de acesso; o conhecimento da IA ou do narrador não torna o personagem onisciente.
- Três blocos redundantes de instruções culturais antigos foram substituídos pela regra de calibração, evitando expansão desnecessária do prompt.
- O seletor influencia comportamento, **não** verifica fatos em fonte externa. Modelos ainda podem alucinar; não há garantia absoluta, especialmente em referências específicas sem acesso a ferramentas de checagem.

## Testes no Preview (conversa descartável)
1. Deixar **Cauteloso**. Mencionar um artista pouco conhecido sem dizer nada sobre ele; personagem deve poder perguntar quem é ou mostrar conhecimento parcial, sem inventar biografia/discografia.
2. Trocar para **Natural**: uma referência muito conhecida e plausível para o personagem pode ser reconhecida, sem afirmar que foi a shows ou repetir fatos incertos.
3. Trocar para **Só estabelecido** e mencionar uma banda específica não discutida anteriormente. O personagem deve evitar afirmar familiaridade, salvo se estiver na biografia ou histórico.
4. Dizer em narração privada algo que o personagem não presenciou; ele não pode responder diretamente ao segredo.
5. Corrigir como autora o nome/ano errado e continuar: o personagem deve deixar de repetir o erro, sem fingir que o soube antes.
6. Atualizar a página, confirmar que a escolha continua. Abrir outro personagem e verificar que o ajuste não vazou para ele.
7. Confirmar que envio, regeneração, exportação e memória manual da Fase 3A seguem funcionando.

## Critérios de entrega
TypeScript, Vitest e build aprovados. Nenhuma migração SQL, alteração de banco, dados da história ou publicação automática. Testes narrativos reais continuam necessários para verificar comportamento, pois testes unitários não provam qualidade do modelo.
