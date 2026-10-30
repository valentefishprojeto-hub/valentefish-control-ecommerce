import OpenAI from 'openai';
import {draftProduct} from '../../_lib/ai/productDraft.js';
import {body,fail,method} from '../../_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['POST'])) return;
  try{
    const input=body(req);
    const draft=await draftProduct({images:input.images,notes:input.notes});
    res.status(200).json({draft});
  }catch(error){
    if(error instanceof OpenAI.RateLimitError){
      const semCredito=error.code==='insufficient_quota';
      return res.status(429).json({error:semCredito?'A conta da OpenAI está sem créditos: adicione saldo em platform.openai.com':'Muitas requisições à IA agora. Espere um minuto e tente de novo.'});
    }
    if(error instanceof OpenAI.AuthenticationError) return res.status(503).json({error:'Chave da IA inválida: confira OPENAI_API_KEY na Vercel'});
    if(error instanceof OpenAI.BadRequestError) return res.status(422).json({error:'A IA recusou a requisição (confira se as fotos abrem e o modelo em AI_PRODUCT_MODEL)'});
    if(error instanceof OpenAI.APIError) return res.status(502).json({error:'A IA está indisponível no momento. Tente de novo.'});
    if(error?.status&&error.status!==500) return res.status(error.status).json({error:error.message});
    fail(res,error);
  }
}
