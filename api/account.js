import {currentUser} from './_lib/auth.js';
import {db} from './_lib/db.js';
import {body,fail,method} from './_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['GET','POST','PATCH','DELETE'])) return;
  try{
    const user=await currentUser(req,{required:true});
    const sql=db();
    const input=body(req);

    if(req.method==='POST'){
      const address=input.address||{};
      if(!address.recipientName||!address.postalCode||!address.street||!address.number||!address.district||!address.city||!address.state){
        return res.status(422).json({error:'Endereço incompleto'});
      }
      await sql.begin(async tx=>{
        if(address.isDefault) await tx`update public.addresses set is_default=false where user_id=${user.id}`;
        await tx`
          insert into public.addresses
            (user_id,label,recipient_name,phone,postal_code,street,number,complement,district,city,state,is_default)
          values
            (${user.id},${address.label||'Principal'},${address.recipientName},${address.phone||null},
             ${String(address.postalCode).replace(/\D/g,'')},${address.street},${address.number},${address.complement||null},
             ${address.district},${address.city},${String(address.state).toUpperCase()},${Boolean(address.isDefault)})
        `;
      });
    }

    if(req.method==='PATCH'){
      if(input.profile){
        await sql`
          update public.profiles set full_name=${input.profile.fullName||null},phone=${input.profile.phone||null},updated_at=timezone('utc',now())
          where id=${user.id}
        `;
      }
      if(input.address?.id){
        const address=input.address;
        await sql.begin(async tx=>{
          if(address.isDefault) await tx`update public.addresses set is_default=false where user_id=${user.id}`;
          await tx`
            update public.addresses
            set label=coalesce(${address.label||null},label),recipient_name=coalesce(${address.recipientName||null},recipient_name),
                phone=${address.phone||null},postal_code=coalesce(${address.postalCode?String(address.postalCode).replace(/\D/g,''):null},postal_code),
                street=coalesce(${address.street||null},street),number=coalesce(${address.number||null},number),
                complement=${address.complement||null},district=coalesce(${address.district||null},district),
                city=coalesce(${address.city||null},city),state=coalesce(${address.state?String(address.state).toUpperCase():null},state),
                is_default=coalesce(${address.isDefault??null},is_default),updated_at=timezone('utc',now())
            where id=${address.id} and user_id=${user.id}
          `;
        });
      }
    }

    if(req.method==='DELETE'){
      const addressId=req.query.addressId||input.addressId;
      if(!addressId) return res.status(422).json({error:'Endereço não informado'});
      await sql`delete from public.addresses where id=${addressId} and user_id=${user.id}`;
    }

    const [profile]=await sql`select id,full_name,phone,avatar_url,created_at from public.profiles where id=${user.id}`;
    const addresses=await sql`select * from public.addresses where user_id=${user.id} order by is_default desc,created_at desc`;
    res.status(200).json({user:{id:user.id,email:user.email},profile:profile||null,addresses});
  }catch(error){
    fail(res,error,error.status||500);
  }
}
