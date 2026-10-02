import react from '@vitejs/plugin-react';
import {defineConfig,loadEnv} from 'vite';

const routes={
  '/api/catalog':'./api/catalog.js',
  '/api/erp/dashboard':'./api/erp/dashboard.js',
  '/api/erp/categories':'./api/erp/categories.js',
  '/api/erp/products':'./api/erp/products.js',
  '/api/erp/stock':'./api/erp/stock.js',
  '/api/erp/customers':'./api/erp/customers.js',
  '/api/erp/sales':'./api/erp/sales.js',
  '/api/erp/finance':'./api/erp/finance.js',
  '/api/erp/commerce':'./api/erp/commerce.js',
  '/api/track':'./api/track.js',
  '/api/products':'./api/products.js',
  '/api/cart':'./api/cart.js',
  '/api/checkout':'./api/checkout.js',
  '/api/account':'./api/account.js',
  '/api/orders':'./api/orders.js',
  '/api/config':'./api/config.js',
  '/api/shipping/quote':'./api/shipping/quote.js',
  '/api/shipping/tracking':'./api/shipping/tracking.js'
};

function readBody(req){
  return new Promise(resolve=>{
    const chunks=[];
    req.on('data',chunk=>chunks.push(chunk));
    req.on('end',()=>{
      const raw=Buffer.concat(chunks).toString();
      try{resolve(raw?JSON.parse(raw):{})}catch{resolve({})}
    });
  });
}

function localApi(){
  return {
    name:'local-api',
    apply:'serve',
    async configureServer(server){
      const {fileURLToPath,pathToFileURL}=await import('node:url');
      server.middlewares.use(async(req,res,next)=>{
        const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
        const file=routes[url.pathname];
        if(!file) return next();
        try{
          req.query=Object.fromEntries(url.searchParams);
          req.body=await readBody(req);
          const href=`${pathToFileURL(fileURLToPath(new URL(file,import.meta.url))).href}?t=${Date.now()}`;
          const mod=await import(href);
          const reply={
            statusCode:200,
            setHeader:(key,value)=>res.setHeader(key,value),
            status(code){this.statusCode=code;res.statusCode=code;return this},
            json(data){res.statusCode=this.statusCode||200;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return this},
            end(data){res.end(data);return this}
          };
          await mod.default(req,reply);
        }catch(error){
          res.statusCode=500;
          res.setHeader('Content-Type','application/json');
          res.end(JSON.stringify({error:error.message||'Falha na API local'}));
        }
      });
    }
  };
}

export default defineConfig(({command,mode})=>{
  if(command==='serve'){
    const env=loadEnv(mode,process.cwd(),'');
    for(const key of ['DATABASE_URL','SUPABASE_URL','SUPABASE_ANON_KEY','VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY']){
      if(env[key]&&!process.env[key]) process.env[key]=env[key];
    }
  }
  return {
    plugins:[react(),localApi()],
    build:{
      chunkSizeWarningLimit:700
    }
  };
});
