// Teste local sem navegador: verifica que só imagens sorteadas entram na fila
// e que nunca há mais de dois downloads simultâneos.
const vistas = []; let ativas = 0, maxAtivas = 0;
globalThis.window = {};
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { connection: { effectiveType: '4g', saveData: false } } });
globalThis.Image = class {
  constructor(){this.decoding='async';this.fetchPriority='auto';}
  set src(url){
    vistas.push(url);ativas++;maxAtivas=Math.max(maxAtivas,ativas);
    setTimeout(async()=>{ativas--;await this.onload?.();},12);
  }
  async decode(){return undefined;}
};
const { prepararImagensDaSessao } = await import('./src/lib/precarregarMidias.js');
const individuais = [
  {tipo:'imagem',url:'https://exemplo.local/1.webp'},
  {tipo:'texto',texto:'Um texto'},
  {tipo:'imagem',url:'https://exemplo.local/2.webp'},
  {tipo:'audio',url:'https://exemplo.local/nao-deve-baixar.mp3'},
  {tipo:'imagem',url:'https://exemplo.local/3.webp'},
];
const comparacoes=[{conteudos:[{tipo:'imagem',url:'https://exemplo.local/4.webp'},{tipo:'imagem',url:'https://exemplo.local/2.webp'}]}];
prepararImagensDaSessao(individuais,comparacoes);
await new Promise(r=>setTimeout(r,1050));
const esperado=['https://exemplo.local/1.webp','https://exemplo.local/2.webp','https://exemplo.local/3.webp','https://exemplo.local/4.webp'];
for (const url of esperado) if(!vistas.includes(url))throw Error('Não foi pré-carregado: '+url);
if(maxAtivas>2)throw Error('Muitos downloads simultâneos: '+maxAtivas);
if(vistas.some(url=>url.endsWith('mp3')))throw Error('Áudio indevidamente carregado');
if(vistas.length!==4)throw Error('Download duplicado: '+vistas);
console.log('OK: 4 imagens únicas da sessão, 0 áudios, paralelismo máximo: '+maxAtivas);
