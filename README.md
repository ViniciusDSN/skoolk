# Skoolk

App de clube do livro em React Native, Expo e TypeScript, conectado ao Supabase. A anfitriã cria um encontro; os leitores entram com um código de seis caracteres, apelido e avatar, sem preencher cadastro.

## Executar

Use Node.js 22 ou superior e pnpm. Neste computador, as dependências e o `.env` público já estão configurados.

```sh
pnpm install --frozen-lockfile
pnpm start
```

Abra o QR Code do terminal no Expo Go compatível com o SDK 57, com celular e computador na mesma rede. Para a prévia no navegador, execute `pnpm web`. Veja o [guia oficial do Expo](https://docs.expo.dev/get-started/start-developing/).

Em outra máquina, copie `.env.example` para `.env` e preencha a chave **publishable** do Supabase. Reinicie o Expo depois de alterar variáveis de ambiente.

## Usar o clube

1. Entre em **Sou anfitriã**, crie uma conta e confirme o e-mail. Depois entre com sua senha.
2. Adicione um livro à estante, com autoria e o arquivo da obra. O seletor aceita qualquer formato e arquivos de até 50 MB; o arquivo fica privado e é a fonte usada pelo Gemini. A sinopse e a imagem da capa, por URL HTTPS, são opcionais.
3. Crie um encontro, selecione os capítulos e escolha 3, 6, 9 ou 12 perguntas. No card **Plano das perguntas**, toque em cada pergunta para definir o assunto (Personagens, Enredo, Temas, Ambientação, Narrativa ou Você leitor) e o momento do livro (Começo, Meio, Desfecho ou Tudo). Os slots deixados em branco ficam por conta da IA. Compartilhe o código ou o QR Code da sala.
4. Os leitores digitam o código e um apelido. Os participantes aparecem na sala em tempo real.
5. Gere perguntas com Gemini 3.5 Flash-Lite ou escreva suas próprias perguntas. A IA recebe o arquivo do livro, o trecho selecionado e o plano; ela preenche apenas os slots vazios, respeitando a posição de cada pergunta escrita à mão. Revise antes de iniciar.
6. A anfitriã conduz a discussão, abre a avaliação de 1 a 5 estrelas e avança. Ao avançar, a votação anterior é encerrada para todos.
7. Ao terminar, os participantes avaliam o livro e a conversa. A anfitriã vê as perguntas mais bem avaliadas.

O app restaura a sessão e o último encontro no mesmo dispositivo. Sair da tela da sala preserva a participação; não remove o leitor nem encerra o encontro. Apagar os dados do app elimina o acesso à identidade anônima anterior. A demonstração da tela inicial usa somente dados locais fictícios.

## Supabase e IA

O projeto `xsvrgnqgkiorwiluwvvw` está configurado com login anônimo, seis migrações aplicadas, Realtime e a Edge Function `generate-questions`. O servidor MCP foi adicionado e autenticado via OAuth.

O cadastro de anfitriãs depende da entrega do e-mail de confirmação. Não foi configurado SMTP próprio nesta entrega: o [serviço padrão do Supabase](https://supabase.com/docs/guides/auth/auth-smtp) limita o projeto a dois e-mails por hora e só envia para endereços da equipe. Configure SMTP próprio antes de abrir cadastros para outros endereços. Os testes automatizados criam contas isoladas já confirmadas pela API administrativa; não validam a entrega de e-mails. A entrada anônima dos leitores não envia e-mail.

As tabelas `skoolk_books`, `skoolk_rooms`, `skoolk_members`, `skoolk_questions`, `skoolk_ratings` e `skoolk_feedback` têm RLS. O bucket privado `skoolk-books` só permite que cada anfitriã leia e envie seus próprios arquivos. Operações de sala usam RPCs com validação de identidade, participação, anfitriã e fase do encontro. A versão da sala impede avanços duplicados; cada pessoa só pode registrar um voto por pergunta.

A chave do Gemini fica no secret `GEMINI_API_KEY` da Edge Function. O modelo é `gemini-3.5-flash-lite`, configurável pelo secret `GEMINI_MODEL`. O aplicativo recebe apenas a URL e a chave pública do Supabase. Nunca coloque chaves Gemini, `service_role` ou secret em variáveis `EXPO_PUBLIC_*`.

A função valida o token com `auth.getUser`, confirma a anfitriã e reserva a geração no banco antes de chamar o Gemini. Ela baixa o arquivo privado em nome da anfitriã, envia-o temporariamente para a Files API do Gemini e o remove após a geração. Por isso `verify_jwt = false` na configuração do gateway não representa acesso público à geração. Uma sala permite até cinco tentativas de geração; chamadas simultâneas são bloqueadas. Há uma repetição limitada para erros temporários do provedor e uma alternativa editorial explícita.

A coluna `question_plan` da sala guarda o plano como lista posicional: o índice é a posição da pergunta, e um item vazio significa tema livre. A posição é preservada de ponta a ponta — `save_questions` grava as perguntas escritas à mão na posição escolhida e `publish_questions` encaixa as da IA nas lacunas restantes, em ordem.

As perguntas usam o arquivo enviado como fonte principal, o contexto opcional e instruções para evitar spoilers. O Gemini aceita o envio de qualquer formato pelo seletor, mas a qualidade de leitura depende de o formato ser compatível com o modelo — PDFs normalmente preservam melhor a estrutura. Revise as perguntas antes de iniciar a conversa.

Para reproduzir o backend em outro projeto, autentique o Supabase CLI, vincule o projeto, aplique os arquivos em `supabase/migrations`, habilite o login anônimo em Authentication e publique `generate-questions` com os secrets descritos em `supabase/functions/.env.example`. Configure também as URLs de confirmação de e-mail para seu ambiente. O arquivo `supabase/config.toml` configura o ambiente local; não altera sozinho as configurações de Auth hospedadas.

## Estrutura

- `App.tsx`: entrada, autenticação, estante e criação de encontros.
- `src/screens/RoomScreen.tsx`: sala, perguntas, avaliações e resultado.
- `src/hooks/useRoom.ts`: Realtime, reconexão e atualização periódica de recuperação.
- `src/lib/`: cliente Supabase, persistência de sessão e API.
- `src/components/`, `src/theme.ts`: componentes e identidade visual.
- `supabase/`: migrações e geração de perguntas no servidor.
- `tests/`: regras de domínio, verificações SQL e integração real.

## Validação

```sh
pnpm typecheck
pnpm test
pnpm exec expo export --platform all
```

O teste `tests/database.sql` cria dados temporários em uma transação e desfaz tudo no final. Execute-o pelo SQL Editor ou por uma conexão administrativa de desenvolvimento. Ele verifica isolamento de salas, controles da anfitriã, apelidos únicos, versões, janela de avaliação e votos duplicados.

O teste `tests/live-integration.mjs` usa `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY` apenas no processo de teste. Execute `node --env-file=.env tests/live-integration.mjs` com a chave administrativa fornecida por um gerenciador de secrets ou variável de ambiente. Ele cria três usuários isolados, testa a IA e o ciclo da sala, encerra sessões e remove os dados ao terminar. `SKOOLK_SKIP_AI_TEST=1` omite a geração para testar somente salas e Realtime; o padrão exige geração real bem-sucedida.

Verificado em 10/09/2026: testes de domínio e SQL; geração real de três perguntas com Gemini 3.8 Flash; entrega ao leitor; mudanças via Realtime; discussão, votos e feedback final; login e criação de sala pela interface; perguntas editoriais e revisão; demonstração completa na prévia web. O Gemini respondeu 503 em tentativas anteriores e depois passou no teste, então o tratamento de indisponibilidade permanece.

O advisor do Supabase aponta acesso anônimo nas políticas — necessário para os leitores, restrito por participação e RLS; também aponta a proteção de senhas vazadas desativada no projeto. A estante exige conta permanente confirmada e a tabela privada de tentativas nega acesso direto.

## Design e entrega mobile

A interface foi adaptada do [protótipo do Figma](https://www.figma.com/design/3g2GTK93OwkUGAsZtLmbvy/Projeto-Deep-Learning?node-id=0-1): roxo em degradê, cartões brancos arredondados, pilha de perguntas, sinopse e estrelas. A inspeção foi feita pelo visualizador do Figma; o mascote e as capas originais não foram exportados. O ícone do app tem um livro vetorial próprio, com fonte editável em `assets/skoolk-mark.svg`.

Os bundles JavaScript de Android, iOS e web foram gerados. Ainda não há APK/IPA, publicação em loja ou teste em dispositivo físico. O simulador iOS deste Mac depende da licença pendente do Xcode. Para distribuição, ainda serão necessários build nativo, assinatura e configuração das contas das lojas. O convite por código já permite reunir aparelhos; links e QR Codes usam o endereço do ambiente em execução.
