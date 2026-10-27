# Valente Fish — Ecossistema Digital

Protótipo navegável em React + Vite para apresentar o ecossistema integrado da Valente Fish.

## Executar

```bash
npm install
npm run dev
```

## Gerar versão de produção

```bash
npm run build
```

## Telas incluídas

- Visão geral do ecossistema
- Automação de comentários e DM no Instagram
- ChatBô e caixa de entrada omnichannel
- ERP, estoque e cadastro assistido por IA
- E-commerce integrado
- Arquitetura e fases do projeto

Os dados e integrações desta versão são simulados para validação comercial e funcional.

## Bot do Instagram

O backend do bot atende DMs de @valentefish em `/api/webhooks/instagram`, pelo mapa de `api/index.js`. O bot consulta o banco diretamente; não chama `/api/erp/*`, não cria cobrança, reserva ou pedido. Este módulo usa integrações reais quando configurado; o simulador abaixo usa o seed e provedores mockados. Nenhuma migration ou configuração remota é aplicada automaticamente.

### Instalação e variáveis

Requer Node 22+, `npm install` (ou `npm ci` com o lockfile atualizado). Aplique `supabase/migrations/20261023184307_instagram_bot.sql` após as migrations existentes, no processo habitual de deploy. Ela cria apenas `ig_conversations`, `ig_messages` e `ig_handoffs`, com RLS, revogação de acesso público e grants para `service_role`; reutiliza `private.set_updated_at()`.

Configure no servidor, nunca no frontend nem em arquivos versionados:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão Postgres existente; use credencial de backend autorizada, nunca anon/authenticated. |
| `APP_URL` | URL HTTPS pública da loja, sem path, usada nos links rastreados. |
| `META_APP_SECRET` | Segredo do app para validar HMAC SHA-256. |
| `META_VERIFY_TOKEN` | Valor aleatório escolhido pela equipe para o handshake. |
| `IG_ACCESS_TOKEN` | Instagram User access token long-lived. |
| `IG_BUSINESS_ID` | ID da conta profissional que recebe as DMs. |
| `META_GRAPH_VERSION` | Versão habilitada no app, por exemplo `v26.0`; não há versão fixa no código. |
| `ANTHROPIC_API_KEY` | Chave da API Anthropic. |
| `ANTHROPIC_MODEL` | ID de modelo autorizado na conta. O briefing sugere `claude-sonnet-5-5`; valide sua disponibilidade antes de configurar. Não há fallback silencioso para outro modelo. |
| `IG_BOT_ENABLED` | Somente `true` habilita respostas; `false` ou ausência apenas registra mensagens. |
| `IG_HUMAN_PAUSE_HOURS` | Padrão 12; aceito entre 1 e 168 horas. |
| `IG_DRY_RUN` | `true` somente em desenvolvimento; imprime mensagens sem chamar Graph. Bloqueado em `VERCEL_ENV=production`. |
| `MELHOR_ENVIO_TOKEN`, `STORE_POSTAL_CODE` | Configuração existente de frete. |
| `MELHOR_ENVIO_BASE_URL`, `MELHOR_ENVIO_USER_AGENT` | Opcionais, mesmos valores e formato da integração existente. |

O único acréscimo ao `vercel.json` é `functions.api/index.js.maxDuration=120`. Os rewrites permanecem iguais. `@vercel/functions` é dependência de execução; `@electric-sql/pglite` e `@vercel/node` são dependências de desenvolvimento para testar SQL e o runtime oficial. O lockfile acompanha as dependências.

### App Meta

1. Configure um app Meta com **Instagram API with Instagram Login**, vincule a conta profissional @valentefish e habilite acesso às mensagens nas configurações da conta. Não misture tokens/permissões do fluxo Facebook Login.
2. Solicite `instagram_business_basic` e `instagram_business_manage_messages`. Faça os testes com usuários autorizados no modo de desenvolvimento; para clientes reais, conclua os requisitos de App Review/acesso exigidos pelo painel Meta.
3. Configure callback HTTPS `https://SEU_DOMINIO/api/webhooks/instagram` e o mesmo `META_VERIFY_TOKEN`. O GET só devolve `hub.challenge` quando token e `hub.mode=subscribe` conferem.
4. Assine `messages` para a conta vinculada. `messaging_postbacks` é opcional, mas o bot deste escopo não processa postbacks. Confirme a assinatura da conta no painel ou via `/{IG_BUSINESS_ID}/subscribed_apps`, conforme a versão da API.
5. No fluxo oficial de login, obtenha o token curto e troque por long-lived em `https://graph.instagram.com/access_token`, com `grant_type=ig_exchange_token`, o app secret e o token curto. Armazene somente o resultado no gerenciador de segredos. Não cole URLs com tokens em logs, histórico de shell ou tickets.
6. Registre a expiração retornada pela Meta e renove antes dela. A renovação usa `https://graph.instagram.com/refresh_access_token`, `grant_type=ig_refresh_token` e token ainda válido. Use o procedimento oficial vigente e substitua `IG_ACCESS_TOKEN` no ambiente; se expirado/revogado, refaça o login. A renovação não é automatizada neste escopo.
7. Faça homologação com DMs reais antes de habilitar o bot em produção: envio/echo, permissões, disponibilidade do modelo, frete e status de pedido. Os testes locais não substituem a aprovação da Meta.

Referências: [Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login), [Messaging API](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api), [Tokens](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login), [Claude tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview).

### Testes e simulador

```bash
npm ci
node --test api/_lib/instagram/*.test.js
npm run build
node scripts/ig-simulate.mjs --offline "Quanto custa o yellow tang?"
node scripts/ig-simulate.mjs --offline "Meu peixe está com pontos brancos, quanto de remédio coloco?"
```

O modo `--offline` cria um Postgres efêmero em memória, aplica as migrations/seed, executa webhook assinado, handler, agente e tools; mocka Anthropic e usa Graph em dry-run. Não acessa nem altera o banco remoto. A saída inclui HTTP 200 e as mensagens que seriam enviadas. O mock Anthropic é uma fixture simples para catálogo/pagamento; não é uma avaliação do comportamento de um modelo real.

Para manter um servidor de teste local aberto:

```bash
node scripts/ig-simulate.mjs --serve
```

Em outro terminal PowerShell, use os valores exclusivos desse simulador:

```powershell
$env:META_APP_SECRET='somente-simulacao-local'
$env:IG_BUSINESS_ID='17841400000000000'
$env:IG_DRY_RUN='true'
node scripts/ig-simulate.mjs "Quanto custa o yellow tang?"
```

Para testar integrações reais em desenvolvimento, use o servidor Node da Vercel (`npx vercel dev --listen 3000`) com as variáveis reais e `IG_DRY_RUN=true`; rode o mesmo script sem `--offline`. `npm run dev` inicia apenas o Vite, não a API. As mensagens dry-run aparecem no terminal do servidor. Use dados fictícios; não publique esse servidor de simulação. `IG_SIMULATOR_SENDER_ID` opcional muda a conversa de teste.

O teste `runtime.test.js` inicia o runtime publicado `@vercel/node` com helpers ativos e passa pelo roteador real. Ele valida HMAC sobre JSON com espaços, acentos e emoji. O runtime restaura os eventos `data/end`, mas mantém o estado do stream original; por isso a leitura usa eventos e **não** o iterador assíncrono. Não acessamos `req.body`. Se outro middleware consumir os bytes, só aceitamos `rawBody` original em Buffer; sem bytes crus devolvemos 400. Nunca usamos `JSON.stringify(req.body)` para validar assinatura. Referências: [runtime Node](https://vercel.com/docs/functions/runtimes/node-js), [implementação dos helpers](https://github.com/vercel/vercel/blob/main/packages/node/src/serverless-functions/helpers.ts).

### Atendimento, pausa e segurança

`atendente`, `humano` e `pessoa` encaminham sem LLM. Saúde/dosagem e fotos também encaminham. Outros anexos pedem texto. Handoff cria um registro pendente, pausa a conversa e oferece o WhatsApp com UTM. A equipe acompanha o Direct e os registros de `ig_handoffs`; não há painel novo nem notificação externa.

Echo de `mid` enviado pelo bot é ignorado. Echo desconhecido durante envio suspende novas partes enquanto é reconciliado, para não competir com o atendente. Uma intervenção humana não pode ser sobrescrita por resultado tardio do LLM. Após a pausa expirar, a próxima mensagem elegível pode reabrir o bot. `closed` permanece silencioso até intervenção manual.

Para pausar tudo: `IG_BOT_ENABLED=false` e publique a configuração. As mensagens continuam sendo registradas. Para controlar uma conversa via conexão administrativa segura, use parâmetros SQL, nunca e-mail/ID concatenados:

```sql
-- Pausa manual por 12 horas
update public.ig_conversations
set status='human', paused_until=now()+interval '12 hours', handoff_reason='humano_no_instagram'
where igsid = '<IGSID>';
-- Retomada explícita
update public.ig_conversations
set status='bot', paused_until=null, handoff_reason=null where igsid = '<IGSID>';
update public.ig_handoffs set resolved_at=now()
where conversation_id=(select id from public.ig_conversations where igsid='<IGSID>') and resolved_at is null;
```

Não há envio após 24 horas da última mensagem do cliente nem mensagem ativa/promocional. Atendentes podem precisar da permissão/tag **Human Agent** para atendimento humano na janela de até 7 dias, conforme regras Meta. Esse envio estendido não é implementado pelo bot.

Preço/estoque são lidos por consulta, sem cache de conversa. O agente não recebe respostas comerciais antigas como fonte. Respostas comerciais são formatadas pelos resultados das ferramentas; estoque exato nunca sai. Consulta de pedido exige número e e-mail fornecidos pelo cliente e iguais aos do banco, com contador atômico de cinco tentativas por hora. O sexto acesso encaminha. Só status, serviço, rastreio e status/data do último evento são devolvidos; descrição/local do evento são omitidos porque podem conter dados pessoais.

### Retenção e limites operacionais

Agende diariamente em infraestrutura administrativa (por exemplo Supabase Cron/pg_cron, após habilitação consciente) a limpeza abaixo. A rotina não está instalada automaticamente:

```sql
delete from public.ig_messages where created_at < now()-interval '180 days';
delete from public.ig_handoffs where created_at < now()-interval '180 days';
delete from public.ig_conversations c
where c.updated_at < now()-interval '180 days'
  and not exists(select 1 from public.ig_messages m where m.conversation_id=c.id);
```

Defina retenção compatível também nos backups e logs. O texto necessário da conversa pode conter dados que o cliente digitou; restringir acesso é obrigatório. Anexos guardam apenas tipo, sem URLs/payloads. Tool calls guardam apenas nomes, sem e-mail, CEP, argumentos ou resultados. Resumos de handoff são operacionais, sem copiar texto livre do cliente. Não se persistem tokens. Duplicatas são bloqueadas enquanto o `mid` estiver retido; eventos muito antigos ficam fora da janela de resposta.

O POST confirma antes do processamento, como solicitado, usando `waitUntil`. Todos os eventos do lote são persistidos antes de iniciar o LLM. **Isso não é uma fila durável:** queda da função/banco após o 200 pode perder processamento; lotes grandes podem exceder `maxDuration`. Monitore falhas e mensagens sem resposta, encaminhe manualmente e não reenvie eventos cegamente. Para garantia de recuperação seria necessário ampliar o escopo com fila durável/outbox e workers. Uma falha de rede depois de a Meta aceitar um envio também pode deixar entrega incerta; não existe promessa de exactly-once no Graph. Retries automáticos ficam limitados a respostas 429/5xx, com backoff; falhas de transporte não são reenviadas automaticamente.

`pending:` identifica envio em curso e `failed:` identifica tentativa sem confirmação. O bot não implementa retry administrativo dessas linhas. A transição para humano também fica registrada em caso de falha de envio. A API ERP existente está sem autenticação, conforme o briefing: é um risco independente, não corrigido nem usado pelo bot. A revisão de dependências identificou alertas no Vite existente e em dependências transitivas do runtime de teste `@vercel/node`; não foi feita atualização geral do projeto neste escopo.

### Confirmações pendentes com a loja

Os campos abaixo ficam `null` em `knowledge.js` até confirmação; o bot encaminha em vez de repetir banners fixos do site:

- Parcelamento: quantas parcelas, mínimo, juros e quais meios/bandeiras?
- Garantia de chegada: quais condições, prazo para reclamar, provas/unboxing e solução oferecida?
- Retirada: existe retirada, qual endereço exato e como combinar?
- Horário de atendimento: dias, horários e feriados?
- Trocas/devoluções: qual política para animais e demais produtos?
- Prazo de postagem: por produto/modalidade e dias de despacho?
- Regiões sem envio de animais: quais restrições por CEP, localidade ou transportadora?

## Publicações automáticas no Instagram

### Conversas e respostas a Stories

O bot reconhece agradecimentos, despedidas, “tudo bem?” e interesse em comprar. Resposta a Story com “quanto custa esse?” pede o nome do produto: o conteúdo do Story não é interpretado nem associado automaticamente ao catálogo. Depois que o cliente informar o produto por mensagem normal, a consulta segue pelo agente e suas ferramentas. Uma reação enviada como texto (por exemplo 🔥) recebe agradecimento e pergunta sobre interesse. Eventos de reação sem `message.mid` não são tratados como mensagens neste módulo.

Pedidos de atendente, saúde animal e reclamações mantêm prioridade sobre o bate-papo. Fotos seguem para especialista; outros anexos pedem texto. Comentários públicos, menções de Story e análise visual não são implementados. A permissão de publicar pertence à área administrativa: clientes não podem publicar conteúdo enviando comandos por Direct.

```bash
npm run instagram:simulate -- "Tudo bem?"
npm run instagram:simulate -- "Quero comprar"
npm run instagram:simulate -- "Muito obrigado!"
npm run instagram:simulate -- --story "Quanto custa esse?"
npm run instagram:simulate -- --story "🔥"
npm run instagram:simulate -- --story "Meu peixe está doente"
npm run instagram:test-posts
```

O último comando testa renderização de feed/Story, criação de container, consulta de processamento, publicação simulada, pausa, mudanças de preço/agenda e prevenção de reenvio em entrega incerta. Não publica na Meta. Para editar modelos e ver a imagem, use a tela `/admin/instagram` configurada conforme as instruções abaixo.

### Preparação antes das conexões

O arquivo `docs/instagram.env.example` contém somente nomes e valores seguros. Copie para `.env.instagram.local` na raiz e preencha apenas a cópia, que está coberta por `.gitignore`. Não coloque tokens em variáveis `VITE_*`, no código, no Git ou em conversas. Na Vercel, cadastre os valores nas variáveis do ambiente correspondente; o arquivo local não configura o deploy.

Com Node 22, confira a configuração local sem acessar serviços externos:

```bash
node --env-file=.env.instagram.local scripts/ig-check-config.mjs dm
node --env-file=.env.instagram.local scripts/ig-check-config.mjs publishing
npm run test:instagram
npm run instagram:simulate -- "Quanto custa o yellow tang?"
```

O diagnóstico mostra apenas nomes e estados, retorna código 1 para campos obrigatórios ausentes/inválidos e não exibe os valores. `configured=true` significa formato preenchido, nunca conexão validada: `connectionVerified` permanece `false`. Ele é uma checagem operacional local, não uma nova rota pública nem um substituto dos controles do runtime. Verifique também Supabase Auth, permissão administrativa, migrations e acesso ao bucket antes de ativar publicações.

Para @tironitech, use seu ID numérico e token próprios em ambiente de teste separado. O assistente continua atendendo como Valente Fish, usando o catálogo configurado. Não use o banco de produção para simulações: o simulador offline já cria banco temporário. Mantenha `IG_BOT_ENABLED=false` e `IG_PUBLISH_ENABLED=false` até conferir a identidade da conta, permissões, versão Graph, modelo Anthropic disponível e endpoint HTTPS. Nenhuma credencial, migration remota, conexão ou agendador é provisionado automaticamente. A integração real e a entrega pela Meta só podem ser comprovadas após essas conexões.

A área `/admin/instagram` oferece três modelos editáveis, prévia JPEG, programação e histórico. Usa fotos reais, nome e preço do catálogo. Esta versão gera imagem para feed (1080×1350) e Story (1080×1920); não gera Reels, vídeos, carrosséis ou stickers de link. A legenda do feed contém UTM; Stories usam somente a imagem. Links em legendas do Instagram não se tornam automaticamente clicáveis.

### Configuração e acesso

1. Aplique `20261023192507_instagram_publishing.sql` após as migrations existentes. Ela cria tabelas com RLS e acesso service_role, três modelos e o bucket `instagram-publishing`, de leitura pública para a Meta buscar o JPEG. Upload é feito somente pelo backend.
2. Configure `APP_URL`, `DATABASE_URL`, `SUPABASE_URL`, chave pública Supabase usada pelo Auth e `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SECRET_KEY`) no servidor. Nunca exponha a chave administrativa no frontend.
3. Autorize o usuário do Supabase Auth com `app_metadata.role=admin`, por operação administrativa, ou coloque seu UUID em `IG_PUBLISH_ADMIN_IDS` (lista separada por vírgulas). `user_metadata` não concede privilégios. A senha é administrada pelo Supabase Auth, não pelo módulo.
4. Configure `IG_ACCESS_TOKEN`, `IG_BUSINESS_ID`, `META_GRAPH_VERSION`, `CRON_SECRET` e `IG_PUBLISH_ENABLED=true`. A presença dessas variáveis não comprova validade do token ou das permissões. Mantenha a publicação pausada na tela durante o setup.
5. No app Meta, use Instagram Login e conceda `instagram_business_basic` e `instagram_business_content_publish`, além de `instagram_business_manage_messages` para o Direct. Confirme a conta profissional e os requisitos de Stories, papéis de teste e acesso do app no painel Meta. Referência: [documentação oficial Meta no Postman](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api).
6. Configure um agendador autorizado para chamar `POST /api/marketing/instagram/run` a cada minuto com `Authorization: Bearer <CRON_SECRET>`. O segredo fica no cofre do agendador. Pode ser um serviço externo ou infraestrutura compatível; a frequência precisa caber no plano contratado. Nenhum cron remoto foi ativado por esta implementação.

O backend aceita imagens somente em HTTPS, na origem de `APP_URL` ou do Supabase configurado, sem redirecionamentos. Imagens do catálogo hospedadas em outra origem precisam ser migradas antes do uso. A prévia não publica nada.

### Primeiro teste na conta real

Confirme primeiro que o ambiente publicado aponta para o banco da Valente Fish e que o token pertence ao @valentefish. Aplique as migrations e valide o login administrativo. Na tela, escolha um produto, confira preço/foto e gere uma prévia; revise também a legenda. Crie somente uma programação de teste, para o dia e horário desejados, e ative a publicação quando essa peça estiver definida. Observe o histórico até `published`, confirme o post no Instagram e pause a programação após o teste. Repita para Story se desejado.

Para testar o Direct, configure o webhook HTTPS `/api/webhooks/instagram` conforme a seção anterior e use uma conta autorizada a testar o app para enviar uma pergunta ao @valentefish. Confira resposta, link, preço atual e transferência ao solicitar “atendente”. Tokens devem ser cadastrados nas variáveis do ambiente, nunca em mensagens de chat.

### Operação e limites

A agenda usa America/Sao_Paulo, recupera horários dos últimos 15 minutos e não publica jobs com mais de uma hora. Produtos inativos, sem estoque ou sem foto são excluídos. Preço, produto, modelo e programação são conferidos novamente antes do envio. Alterações invalidam a peça pendente; o sistema não publica silenciosamente a versão antiga. Cada horário tem uma única entrada de fila. A pausa pelo painel ou `IG_PUBLISH_ENABLED=false` impede novos envios; uma chamada já aceita pela Meta pode ainda concluir.

Sem confirmação após `media_publish`, o job fica `uncertain` e não é reenviado automaticamente. Confira a conta antes de qualquer intervenção. O histórico guarda os últimos 50 registros na interface; a base mantém os demais. Monitore a última execução do worker e a validade/renovação do token conforme a seção do bot. As rotas antigas do ERP continuam com o risco de autenticação descrito acima; as novas rotas de marketing exigem administrador.

### Validação local

```bash
node --test api/_lib/instagram/*.test.js
npm run build
node scripts/ig-simulate.mjs --offline "Quanto custa o yellow tang?"
```

O teste visual `scripts/ig-publishing-check.mjs` usa Playwright, Edge, Vite local na porta 5173 e Postgres efêmero. Com Playwright disponível, execute `node scripts/ig-publishing-check.mjs`; alternativamente defina `PLAYWRIGHT_MODULE_PATH` para a instalação local do pacote. `IG_UI_URL` permite outro endereço local. Ele intercepta as APIs com o handler real e banco temporário, verifica prévia, salvamento sem duplicação e layout móvel, e salva imagens na pasta temporária `valentefish-instagram-check`. Não valida credenciais, rede Meta, banco de produção ou deploy.
