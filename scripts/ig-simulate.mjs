import {createHmac,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';

const args=process.argv.slice(2);
const offline=args.includes('--offline');
const serve=args.includes('--serve');
const story=args.includes('--story');
const text=args.filter(x=>!x.startsWith('--')).join(' ')||'Quanto custa o yellow tang?';
let cleanup=async()=>{};
let target='http://localhost:3000/api/webhooks/instagram';

// Offline mode exercises the same SQL, webhook, handler, tool loop and Graph
// dry-run, using the repository seed and mocks only for external providers.
if(offline||serve){
  process.env.APP_URL='https://valentefish.test';
  process.env.META_APP_SECRET='somente-simulacao-local';
  process.env.META_VERIFY_TOKEN='somente-simulacao-local';
  process.env.IG_BUSINESS_ID='17841400000000000';
  process.env.IG_DRY_RUN='true';process.env.IG_BOT_ENABLED='true';
  process.env.ANTHROPIC_API_KEY='mock';process.env.ANTHROPIC_MODEL='mock';
  const [{testDatabase},{createWebhook},{processPayload},{runAgent},{createGraph}]=await Promise.all([
    import('../api/_lib/instagram/test-db.js'),import('../api/_routes/webhooks/instagram.js'),import('../api/_lib/instagram/handler.js'),import('../api/_lib/instagram/agent.js'),import('../api/_lib/instagram/graph.js')
  ]);
  const database=await testDatabase();const tasks=[];
  const mockAnthropic=async(_url,options)=>{
    const body=JSON.parse(options.body);
    const last=body.messages.at(-1);
    if(Array.isArray(last.content)) return new Response(JSON.stringify({stop_reason:'end_turn',content:[{type:'text',text:'Resultado consultado.'}]}));
    const query=JSON.parse(last.content).mensagem_atual.toLowerCase();
    const name=/pagamento/.test(query)?'info_loja':'buscar_produtos';
    const input=name==='info_loja'?{topico:'pagamento'}:{termo:query.includes('yellow')?'yellow tang':query.includes('coral')?'coral':''};
    return new Response(JSON.stringify({stop_reason:'tool_use',content:[{type:'tool_use',id:'mock-tool',name,input}]}));
  };
  const webhook=createWebhook({waitUntil:promise=>tasks.push(promise),processPayload:payload=>processPayload(payload,{
    sql:database.sql,graph:createGraph(),agent:input=>runAgent({...input,fetch:mockAnthropic})
  })});
  const server=createServer((req,res)=>{
    req.query=Object.fromEntries(new URL(req.url,'http://localhost').searchParams);
    res.status=code=>{res.statusCode=code;return res;};
    res.send=value=>res.end(value);res.json=value=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(value));};
    webhook(req,res).catch(()=>{res.statusCode=500;res.end('Falha na simulação');});
  });
  await new Promise(resolve=>server.listen(serve?3000:0,'127.0.0.1',resolve));
  target=`http://127.0.0.1:${server.address().port}/api/webhooks/instagram`;
  cleanup=async()=>{await Promise.all(tasks);await new Promise(resolve=>server.close(resolve));await database.close();};
  if(serve){console.log('Simulador local em http://localhost:3000. Integrações externas mockadas; mensagens dry-run aparecem aqui.');process.on('SIGINT',async()=>{await cleanup();process.exit(0);});}
}

if(!serve){
  try{
    if(!process.env.META_APP_SECRET||!process.env.IG_BUSINESS_ID) throw new Error('Configure META_APP_SECRET e IG_BUSINESS_ID. Para testar sem credenciais, use --offline.');
    if(process.env.IG_DRY_RUN!=='true') throw new Error('Use IG_DRY_RUN=true no simulador e no servidor local.');
    const mid='sim-'+randomUUID();
    const payload={object:'instagram',entry:[{id:process.env.IG_BUSINESS_ID,time:Date.now(),messaging:[{sender:{id:process.env.IG_SIMULATOR_SENDER_ID||'100000000000001'},recipient:{id:process.env.IG_BUSINESS_ID},timestamp:Date.now(),message:{mid,text}}]}]};
    if(story) payload.entry[0].messaging[0].message.reply_to={story:{id:'simulated-story'}};
    const raw=JSON.stringify(payload);
    const response=await fetch(target,{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':'sha256='+createHmac('sha256',process.env.META_APP_SECRET).update(raw).digest('hex')},body:raw,signal:AbortSignal.timeout(10000)});
    console.log(`Webhook: HTTP ${response.status} — ${await response.text()}`);
    if(!response.ok) process.exitCode=1;
    if(!offline) console.log('As mensagens que seriam enviadas aparecem no terminal do servidor (IG_DRY_RUN=true).');
  }catch(error){console.error(error.message);process.exitCode=1;}
  finally{await cleanup();}
}
