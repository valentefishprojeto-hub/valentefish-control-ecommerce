import React from 'react';

const UPDATED_AT='27 de outubro de 2026';
const WHATSAPP='https://api.whatsapp.com/send/?phone=5521987128089';

const sections=[
  ['quem-somos','Quem somos',<>
    <p>A Valente Fish é uma loja especializada em aquarismo marinho localizada no Jardim Sulacap, Rio de Janeiro – RJ, com envio para todo o Brasil. Esta política explica quais dados pessoais tratamos na loja online (valentefish-control-ecommerce.vercel.app), no atendimento pelo Instagram (@valentefish) e nos demais canais, por que tratamos e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).</p>
  </>],
  ['dados','Quais dados coletamos',<>
    <ul>
      <li><b>Cadastro e conta:</b> nome, e-mail, telefone e senha (guardada de forma criptografada pelo nosso provedor de autenticação). Se você entrar com o Google, recebemos nome, e-mail e foto do perfil.</li>
      <li><b>Pedidos e entrega:</b> itens comprados, valores, endereço de entrega e CEP, além do status do pagamento e do envio.</li>
      <li><b>Pagamento:</b> o pagamento é feito no Mercado Pago. Não recebemos nem armazenamos números de cartão; recebemos apenas a confirmação e o status da transação.</li>
      <li><b>Navegação na loja:</b> páginas e produtos visitados, buscas, itens adicionados ao carrinho e a origem da visita (por exemplo, Instagram ou Google), associados a um identificador aleatório guardado no seu navegador.</li>
      <li><b>Atendimento pelo Instagram:</b> seu nome de usuário e identificador no Instagram, o texto das mensagens enviadas ao @valentefish e as respostas enviadas pela loja. De anexos, guardamos apenas o tipo (por exemplo, "imagem"), não o arquivo.</li>
      <li><b>Orçamentos e contato:</b> as informações que você preencher no formulário de orçamento ou enviar pelo WhatsApp.</li>
    </ul>
  </>],
  ['finalidades','Para que usamos os dados',<>
    <ul>
      <li>Criar e manter sua conta e permitir o acesso aos seus pedidos (execução de contrato).</li>
      <li>Processar pagamentos, separar, enviar e acompanhar pedidos, calcular frete e prestar suporte pós-venda (execução de contrato).</li>
      <li>Responder dúvidas no Instagram, no WhatsApp e pelo formulário de orçamento (execução de contrato e procedimentos preliminares a pedido seu).</li>
      <li>Entender como a loja é usada para melhorar o catálogo e a navegação (legítimo interesse).</li>
      <li>Cumprir obrigações legais, fiscais e regulatórias e nos defender em processos (obrigação legal e exercício regular de direitos).</li>
    </ul>
    <p>Não vendemos seus dados e não os usamos para enviar publicidade sem a sua autorização.</p>
  </>],
  ['instagram','Atendimento automático no Instagram',<>
    <p>Mensagens enviadas ao @valentefish podem ser respondidas por um assistente automático, que consulta o catálogo da loja para informar preço, disponibilidade e o link do produto. Sempre que você pedir, ou quando o assunto exigir (saúde de animais, reclamações, trocas), a conversa é encaminhada para uma pessoa da nossa equipe. Você pode pedir para falar com um atendente a qualquer momento escrevendo "atendente".</p>
    <p>O assistente só responde a quem iniciou a conversa, dentro do prazo permitido pelo Instagram, e não envia mensagens promocionais.</p>
  </>],
  ['compartilhamento','Com quem compartilhamos',<>
    <p>Compartilhamos dados apenas com fornecedores necessários para operar a loja, que os tratam conforme as nossas instruções:</p>
    <ul>
      <li><b>Supabase</b> – banco de dados, autenticação e armazenamento de arquivos.</li>
      <li><b>Vercel</b> – hospedagem do site.</li>
      <li><b>Mercado Pago</b> – processamento de pagamentos.</li>
      <li><b>Melhor Envio</b> e transportadoras – cotação de frete e entrega.</li>
      <li><b>Meta (Instagram)</b> – envio e recebimento de mensagens diretas.</li>
      <li><b>Google</b> – login com conta Google, quando você escolhe essa opção.</li>
    </ul>
    <p>Alguns desses fornecedores podem armazenar dados fora do Brasil, com as garantias previstas na LGPD. Também podemos compartilhar dados quando exigido por lei ou por ordem de autoridade competente.</p>
  </>],
  ['armazenamento','Armazenamento no navegador',<>
    <p>A loja guarda no seu navegador o conteúdo do carrinho, a sessão de login e um identificador aleatório de visitante usado nas estatísticas de navegação. Você pode apagar esses dados a qualquer momento limpando os dados do site nas configurações do navegador; o carrinho e o login serão perdidos.</p>
  </>],
  ['retencao','Por quanto tempo guardamos',<>
    <ul>
      <li>Dados de conta: enquanto a conta estiver ativa ou até você pedir a exclusão.</li>
      <li>Pedidos e documentos fiscais: pelo prazo exigido pela legislação fiscal e de defesa do consumidor.</li>
      <li>Conversas do Instagram: até 180 dias após a última mensagem.</li>
      <li>Estatísticas de navegação: pelo tempo necessário para análise, de forma agregada sempre que possível.</li>
    </ul>
  </>],
  ['direitos','Seus direitos',<>
    <p>Pela LGPD, você pode pedir a confirmação de que tratamos seus dados, acesso, correção, anonimização, portabilidade, informações sobre compartilhamento, revogação de consentimento e exclusão dos dados, além de se opor a tratamentos feitos com base em legítimo interesse. Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).</p>
  </>],
  ['exclusao','Como pedir a exclusão dos seus dados',<>
    <p>Para excluir seus dados, inclusive as conversas com o @valentefish no Instagram:</p>
    <ol>
      <li>Envie uma mensagem para o nosso <a href={WHATSAPP} target="_blank" rel="noreferrer">WhatsApp</a> ou uma mensagem direta para o <a href="https://www.instagram.com/valentefish/" target="_blank" rel="noreferrer">@valentefish</a> com o texto "excluir meus dados".</li>
      <li>Informe o e-mail da sua conta na loja e/ou o seu usuário do Instagram.</li>
      <li>Confirmaremos a solicitação e concluiremos a exclusão em até 15 dias, exceto os dados que a lei nos obriga a manter (por exemplo, registros fiscais de compras).</li>
    </ol>
    <p>Se você usou "Entrar com Google", também pode remover o acesso da Valente Fish nas configurações de aplicativos conectados da sua Conta Google.</p>
  </>],
  ['seguranca','Segurança',<>
    <p>Usamos conexão criptografada (HTTPS), controle de acesso restrito à equipe autorizada e fornecedores com práticas reconhecidas de segurança. Nenhum sistema é totalmente imune a incidentes; caso ocorra algum que possa causar risco relevante, comunicaremos os afetados e a ANPD conforme a lei.</p>
  </>],
  ['contato','Contato e atualizações',<>
    <p>Dúvidas sobre esta política ou sobre seus dados: fale com a gente pelo <a href={WHATSAPP} target="_blank" rel="noreferrer">WhatsApp</a> ou pelo Instagram <a href="https://www.instagram.com/valentefish/" target="_blank" rel="noreferrer">@valentefish</a>.</p>
    <p>Podemos atualizar esta política para refletir mudanças na loja ou na legislação. A data da última atualização aparece no topo desta página.</p>
  </>]
];

export function PrivacyPage(){
  return <main className="privacy-page">
    <article>
      <span className="eyebrow">TRANSPARÊNCIA</span>
      <h1>Política de Privacidade</h1>
      <p className="privacy-updated">Última atualização: {UPDATED_AT}</p>
      <nav aria-label="Seções">{sections.map(([id,title])=><a key={id} href={`#${id}`}>{title}</a>)}</nav>
      {sections.map(([id,title,body])=><section key={id} id={id}><h2>{title}</h2>{body}</section>)}
    </article>
  </main>;
}
