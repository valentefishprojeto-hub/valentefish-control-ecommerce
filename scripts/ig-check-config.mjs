import {inspectConfig} from '../api/_lib/instagram/config.js';
const scope=process.argv[2]||'dm';
try{
  const report=inspectConfig(process.env,{scope});
  console.log(JSON.stringify(report,null,2));
  console.log('Este diagnóstico não acessa a rede nem valida tokens, permissões, migrations ou a identidade da conta.');
  process.exitCode=report.configured?0:1;
}catch{console.error('Use: node scripts/ig-check-config.mjs [dm|publishing]');process.exitCode=1;}
