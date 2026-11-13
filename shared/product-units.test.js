import test from 'node:test';
import assert from 'node:assert/strict';
import {mapProduct} from '../api/_lib/erp.js';
import {mapStoreProduct} from '../src/catalog.js';
import {upsertCartItem} from '../src/commerce.js';
import {testDatabase} from '../api/_lib/instagram/test-db.js';
import {priceUnit,saleUnit,stockUnit} from './product-units.js';

test('unidade de venda acompanha produto do banco até o carrinho',()=>{
  for(const [unit,price,plural] of [
    ['peca','por peça','peças'],
    ['boca','por boca','bocas'],
    ['colonia','por colônia','colônias']
  ]){
    const product=mapProduct({id:'p',slug:'coral',name:'Coral',price_cents:10000,stock_quantity:3,metadata:{sale_unit:unit}});
    const store=mapStoreProduct(product);
    const [cart]=upsertCartItem([],store);
    assert.equal(cart.saleUnit,unit);
    assert.equal(priceUnit(cart.saleUnit),price);
    assert.equal(stockUnit(cart.saleUnit,3),plural);
    assert.equal(upsertCartItem([{...cart,saleUnit:'peca'}],store)[0].saleUnit,unit);
  }
  assert.equal(saleUnit(undefined),'peca');
  assert.equal(saleUnit('invalida'),'peca');
  assert.equal(stockUnit('peca',1),'peça');
});

test('unidade persiste nos metadados sem apagar outros dados do produto',async t=>{
  const database=await testDatabase();
  t.after(()=>database.close());
  const {sql}=database;
  const [product]=await sql`update public.products
    set metadata=jsonb_set(jsonb_set(metadata,'{origem}','"loja"'::jsonb),'{sale_unit}',to_jsonb(${'colonia'}::text),true)
    where slug='coral-hammer-green' returning *`;
  assert.equal(product.metadata.origem,'loja');
  assert.equal(mapProduct(product).saleUnit,'colonia');
});
