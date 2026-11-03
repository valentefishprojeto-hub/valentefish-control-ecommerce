import {currentUser,isAdmin} from '../../_lib/auth.js';
import {db} from '../../_lib/db.js';
import {body,method} from '../../_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['GET','POST'])) return;
  res.setHeader('Cache-Control','no-store');
  try{
    const user=await currentUser(req,{required:true});
    if(!isAdmin(user)) return res.status(403).json({error:'Apenas administradores podem confirmar animais'});
    const sql=db();
    if(req.method==='GET') return res.status(200).json({animals:await sql`select m.*,p.name as product_name from public.animal_memory m join public.products p on p.id=m.product_id order by p.name`});
    const input=body(req);
    const name=String(input.scientificName||'').trim();
    const names=[...new Set((Array.isArray(input.popularNames)?input.popularNames:[]).map(x=>String(x).trim()).filter(Boolean))];
    const notes=String(input.confirmedNotes||'').trim();
    if(!/^[0-9a-f-]{36}$/i.test(input.productId||'')||name.length<3||name.length>180||names.length>20||names.some(x=>x.length>120)||notes.length>1500)
      return res.status(422).json({error:'Confira produto, identificação e nomes populares'});
    const [product]=await sql`select id from public.products where id=${input.productId} and category in ('peixes','corais','invertebrados')`;
    if(!product) return res.status(422).json({error:'Selecione um animal cadastrado'});
    const [saved]=await sql`insert into public.animal_memory(product_id,scientific_name,popular_names,confirmed_notes,approved_by)
      values (${product.id},${name},${names},${notes},${user.id})
      on conflict(product_id) do update set scientific_name=excluded.scientific_name,popular_names=excluded.popular_names,
        confirmed_notes=excluded.confirmed_notes,approved_by=excluded.approved_by returning id`;
    return res.status(200).json({ok:true,id:saved.id});
  }catch(error){return res.status(error.status||500).json({error:error.status?error.message:'Não foi possível atualizar a memória dos animais'});}
}
