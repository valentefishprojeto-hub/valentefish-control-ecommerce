export const productUnits={
  peca:{name:'Peça',price:'por peça',plural:'peças'},
  boca:{name:'Boca',option:'Bocas',price:'por boca',plural:'bocas'},
  colonia:{name:'Colônia',price:'por colônia',plural:'colônias'}
};

export const saleUnit=value=>Object.hasOwn(productUnits,value)?value:'peca';
export const priceUnit=value=>productUnits[saleUnit(value)].price;
export const stockUnit=(value,quantity)=>quantity===1?productUnits[saleUnit(value)].name.toLowerCase():productUnits[saleUnit(value)].plural;
