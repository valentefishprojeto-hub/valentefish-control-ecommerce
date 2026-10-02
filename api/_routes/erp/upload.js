import {createClient} from '@supabase/supabase-js';
import {body,fail,method} from '../../_lib/http.js';

const allowed=/^(image\/(jpeg|jpg|png|webp|gif|avif)|video\/(mp4|webm|quicktime|ogg))$/i;

function admin(){
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!url||!key) throw new Error('Upload ainda não configurado');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export default async function handler(req,res){
  if(!method(req,res,['POST'])) return;
  try{
    const input=body(req);
    const name=String(input.name||'arquivo').replace(/[^\w.\-]+/g,'-').slice(0,80)||'arquivo';
    const type=String(input.contentType||'');
    if(!allowed.test(type)) return res.status(422).json({error:'Envie uma imagem (JPG, PNG, WEBP) ou um vídeo (MP4, WEBM)'});
    const supabase=admin();
    const path=`products/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${name}`;
    const {data,error}=await supabase.storage.from('product-media').createSignedUploadUrl(path);
    if(error) throw error;
    const {data:pub}=supabase.storage.from('product-media').getPublicUrl(path);
    res.status(200).json({
      path,
      token:data.token,
      signedUrl:data.signedUrl,
      publicUrl:pub.publicUrl,
      kind:type.startsWith('video/')?'video':'image',
      name
    });
  }catch(error){
    fail(res,error);
  }
}
