# Marketing → Instagram

Escopo aprovado: tela dentro do ERP para modelos personalizáveis e publicação automática sem aprovação individual. Preservar bot de DM, checkout e demais módulos.

Decisões: começar com feed de imagem e Stories de imagem, três layouts reutilizáveis; usar fotos reais do catálogo, logo existente e renderização JPEG no servidor. Reels requerem produção de vídeo e não fazem parte desses modelos de imagem. Não gerar animais fictícios. Horário America/Sao_Paulo, agenda configurável, desativada por padrão. Nenhuma publicação real sem credenciais/configuração.

- [ ] Migration com templates, agendas, configuração e fila persistente; RLS/service_role.
- [ ] Validação compartilhada, seleção sem repetição, slots idempotentes e revalidação de estoque/preço.
- [ ] Renderizador de JPEG com imagens de origens autorizadas; upload privado no backend para bucket de leitura pública.
- [ ] Graph create/status/publish; claim atômico e estados de entrega incerta sem reenvio automático.
- [ ] API administrativa autenticada, prévia e worker protegido por CRON_SECRET.
- [ ] Tela com login, modelos, prévia, agenda e histórico, seguindo os estilos do ERP.
- [ ] Testes node:test com Postgres embutido/provedores mockados, build, inspeção visual e revisão independente.

Agendamento: worker externo invoca endpoint a cada minuto. Não ativar cron remoto nesta entrega. Documentar Vercel Pro ou Supabase Cron; não adicionar cron por minuto que impeça deploy em plano Hobby. A tela mostra a ausência de execução recente do agendador.

Autorização: Supabase usuário autenticado + app_metadata.role=admin ou UUID em IG_PUBLISH_ADMIN_IDS. Não herdar falta de autenticação das rotas ERP existentes. Segredos permanecem no servidor.

Riscos/revisão: timeout após media_publish (marcar incerto), processos simultâneos, pause durante execução, alteração de preço entre render/publicação, URLs arbitrárias/SSRF, placeholders não reconhecidos, agenda atrasada, modelo editado, indisponibilidade da Meta.
