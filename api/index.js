import {adminOnly} from './_lib/auth.js';
import account from './_routes/account.js';
import cart from './_routes/cart.js';
import catalog from './_routes/catalog.js';
import checkout from './_routes/checkout.js';
import config from './_routes/config.js';
import orders from './_routes/orders.js';
import products from './_routes/products.js';
import track from './_routes/track.js';
import categories from './_routes/erp/categories.js';
import commerce from './_routes/erp/commerce.js';
import customers from './_routes/erp/customers.js';
import dashboard from './_routes/erp/dashboard.js';
import finance from './_routes/erp/finance.js';
import erpProducts from './_routes/erp/products.js';
import sales from './_routes/erp/sales.js';
import stock from './_routes/erp/stock.js';
import upload from './_routes/erp/upload.js';
import quote from './_routes/shipping/quote.js';
import tracking from './_routes/shipping/tracking.js';
import mercadoPago from './_routes/webhooks/mercado-pago.js';
import instagram from './_routes/webhooks/instagram.js';
import instagramMarketing,{cron as instagramPublisher,maintenance as instagramMaintenance} from './_routes/marketing/instagram.js';

const routes={
  account,
  cart,
  catalog,
  checkout,
  config,
  orders,
  products,
  track,
  'webhooks/instagram':instagram,
  'marketing/instagram':instagramMarketing,
  'marketing/instagram/run':instagramPublisher,
  'instagram/maintenance':instagramMaintenance,
  'erp/categories':adminOnly(categories),
  'erp/commerce':adminOnly(commerce),
  'erp/customers':adminOnly(customers),
  'erp/dashboard':adminOnly(dashboard),
  'erp/finance':adminOnly(finance),
  'erp/products':adminOnly(erpProducts),
  'erp/sales':adminOnly(sales),
  'erp/stock':adminOnly(stock),
  'erp/upload':adminOnly(upload),
  'shipping/quote':quote,
  'shipping/tracking':tracking,
  'webhooks/mercado-pago':mercadoPago
};

function routeKey(req){
  const raw=req.query?.route;
  if(raw!=null&&raw!==''){
    const value=Array.isArray(raw)?raw.filter(Boolean).join('/'):String(raw);
    return value.replace(/^\/api\/?/,'').replace(/^\/+|\/+$/g,'');
  }
  const path=String(req.url||'').split('?')[0];
  return path.replace(/^\/api\/?/,'').replace(/^\/+|\/+$/g,'');
}

export default async function handler(req,res){
  const route=routes[routeKey(req)];
  if(!route) return res.status(404).json({error:'Rota não encontrada'});
  return route(req,res);
}
