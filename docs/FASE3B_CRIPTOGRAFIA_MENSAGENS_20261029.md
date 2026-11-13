# Hysto — Criptografia de mensagens (projeto, etapa preparatória)

**Status: não ativado.** A infraestrutura do Supabase já criptografa dados em repouso e via TLS. Esta implementação adiciona a fundação de proteção AES-256-GCM para conteúdo narrativo no nível da aplicação, mas o texto plano continuará disponível no banco até a migração final. Não prometer proteção nova antes dessa etapa.

## Implementado no código
- Módulo `src/lib/server/story-message-crypto.ts`, somente para servidor, com AES-256-GCM, nonce aleatório 12 bytes e tag de autenticação de 16 bytes.
- Chave de 32 bytes base64url em segredo de servidor `HYSTO_MESSAGE_ENCRYPTION_KEY_V1`. **Nunca** colocar em `VITE_*`, código, banco, repositório ou logs.
- Envelope `hystoenc:v1:<iv>:<tag>:<ciphertext>`; AAD vincula dono, storyId, recordId e tipo.
- Falhas de autenticação e falta de chave não retornam texto plano nem criam chaves novas.
- Testes de integridade, privacidade entre histórias/usuários, aleatoriedade e formatação dos pensamentos.
- Migração aditiva `20261029_story_encryption_prepare.sql`, criando tabela de envelopes para acesso exclusivo do servidor, sem reescrever mensagens.

## O que ainda deve ser implementado antes de criptografar uma mensagem real
1. Criar gateway **autenticado** de leitura/escrita para mensagens, versões alternativas, memórias, notas e exportação. A UI atual usa consultas Supabase diretas. Se criptografássemos agora, ela mostraria texto cifrado e a IA perderia contexto.
2. Ajustar o pipeline de geração, regeneração, retomada, resumos e seleção de versões para descriptografar temporariamente no servidor apenas após verificar proprietário e história. Modelos recebem texto legível do contexto enviado.
3. Concluir uma migração verificada de todo o legado, com `dual write` apenas em clone, contagem e digest de equivalência por registro, backup **restaurável** e nenhuma perda de ID ou ordem.
4. Bloquear leituras diretas de conteúdos em texto plano, substituir/eliminar plaintext de todas as colunas (mensagens, versões, notas e checkpoints), e auditar backups/snapshots/logs existentes. Até isso acontecer, NÃO considerar criptografia de aplicação efetiva.
5. Testar duas contas, várias histórias, resposta alternativa, notas, exportação e falha de conexão. Falhar fechado quando chave estiver ausente; nunca tentar leitura de texto plano como alternativa silenciosa.
6. Planejar rotação e backup offline seguro da chave, além de procedimento de recuperação. Se a chave for perdida sem backup, mensagens cifradas ficam irrecuperáveis.

## Limite de privacidade
Não é criptografia de ponta a ponta: o servidor do Hysto precisa descriptografar para preparar o prompt e os provedores Gemini, Groq, OpenRouter etc. recebem os trechos necessários em texto legível. A criptografia de aplicação não esconde metadados, nem protege o texto contra um servidor comprometido com acesso à chave.

Nenhuma migração SQL foi aplicada ao Lovable e nenhum conteúdo real foi alterado nesta etapa. A ativação depende de validação em cópia isolada, da Fase 3B e de auditoria de segurança antes de produção.
