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
import quote from './_routes/shipping/quote.js';
import tracking from './_routes/shipping/tracking.js';
import mercadoPago from './_routes/webhooks/mercado-pago.js';

const routes={
  account,
  cart,
  catalog,
  checkout,
  config,
  orders,
  products,
  track,
  'erp/categories':categories,
  'erp/commerce':commerce,
  'erp/customers':customers,
  'erp/dashboard':dashboard,
  'erp/finance':finance,
  'erp/products':erpProducts,
  'erp/sales':sales,
  'erp/stock':stock,
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
