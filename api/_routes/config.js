import {method} from '../_lib/http.js';

export default function handler(req,res){
  if(!method(req,res,['GET'])) return;
  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||null;
  const supabaseKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||null;
  res.setHeader('Cache-Control','public, max-age=300');
  res.status(200).json({
    supabase:{url:supabaseUrl,key:supabaseKey&&supabaseKey!=='[SENSITIVE]'?supabaseKey:null},
    features:{
      payments:Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN),
      shipping:Boolean(process.env.MELHOR_ENVIO_TOKEN&&process.env.STORE_POSTAL_CODE)
    }
  });
}
