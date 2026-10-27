// Leitor ZIP nativo (sem bibliotecas externas): central directory + DEFLATE.
// O navegador deve suportar DecompressionStream('deflate-raw').
// Limites evitam arquivos maliciosos e descompactação excessiva em memória.
const LIMITE_ZIP = 500 * 1024 * 1024;
const LIMITE_ITEM = 180 * 1024 * 1024;
const LIMITE_TOTAL = 450 * 1024 * 1024;
const LIMITE_ENTRADAS = 300;
const EXTENSOES = {
  png: 'imagem', jpg: 'imagem', jpeg: 'imagem', webp: 'imagem',
  mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio',
  mp4: 'video', webm: 'video', txt: 'texto', md: 'texto',
};
const MIME = { png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',
  mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4',
  mp4:'video/mp4',webm:'video/webm' };

// O número base identifica a família; .1 e .2 identificam variantes adicionais.
// Ex.: C11-IA + C11-REAL formam C11; C11.1-IA + C11-IA formam C11.1.
export function reconhecerMarcador(nome) {
  const semExt = String(nome).split('/').pop().replace(/\.(zip|png|jpe?g|webp|mp3|wav|ogg|m4a|mp4|webm|txt|md)$/i, '');
  const m = /^C0*(\d+)(?:[._](\d+))?[-_\s]*(IA|REAL|HUMANO)$/i.exec(semExt.trim());
  if (!m) return null;
  const numero = Number(m[1]);
  if (!Number.isSafeInteger(numero) || numero < 1 || numero > 999999) return null;
  const posicao = m[2] == null ? null : Number(m[2]);
  if (posicao !== null && ![1,2].includes(posicao)) return null;
  return { codigo: `C${numero}`, posicao, ia: m[3].toUpperCase() === 'IA' };
}

function u16(v,o){return v.getUint16(o,true);}
function u32(v,o){return v.getUint32(o,true);}
function encontrarDiretorio(v){
  for(let i=v.byteLength-22;i>=Math.max(0,v.byteLength-65557);i--){
    if (v.getUint32(i,true)===0x06054b50 && i+22+u16(v,i+20) <= v.byteLength) return i;
  }
  throw new Error('ZIP inválido: diretório central ausente.');
}
function extrairTipo(nome){return EXTENSOES[nome.split('.').pop().toLowerCase()] || null;}
function obterMarcador(caminho,arquivoZip){
  const partes=caminho.split('/').filter(Boolean);
  // Preferir o nome da pasta mais interna (e depois o nome do arquivo).
  for(let i=partes.length-2;i>=0;i--){const m=reconhecerMarcador(partes[i]);if(m)return m;}
  return reconhecerMarcador(partes.at(-1)) || reconhecerMarcador(arquivoZip);
}
function ignoravel(nome){return /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)(\/|$)/i.test(nome)
  || /(^|\/)(readme|leiame|licen[çc]a|license|cr[eé]ditos|credits)(\.[^.\/]+)?$/i.test(nome);}

// Exportada para testes e para o formulário. Sem upload nesta fase.
export async function lerZipDeComparacoes(zip) {
  if(zip.size > LIMITE_ZIP) throw new Error(`${zip.name}: ZIP maior que 500 MB.`);
  const raw=await zip.arrayBuffer();
  const view=new DataView(raw);
  const eocd=encontrarDiretorio(view);
  const count=u16(view,eocd+10), directoryOffset=u32(view,eocd+16);
  if(count>LIMITE_ENTRADAS || u16(view,eocd+8)!==count) throw new Error(`${zip.name}: ZIP contém muitas entradas ou vários discos.`);
  if(directoryOffset>=raw.byteLength) throw new Error(`${zip.name}: índice do ZIP inválido.`);
  let offset=directoryOffset, total=0;
  const enc=new TextDecoder('utf-8',{fatal:false});
  const itens=[];
  for(let i=0;i<count;i++){
    if(offset+46>raw.byteLength || view.getUint32(offset,true)!==0x02014b50) throw new Error(`${zip.name}: entrada do ZIP inválida.`);
    const flags=u16(view,offset+8), method=u16(view,offset+10);
    const compressed=u32(view,offset+20), size=u32(view,offset+24);
    const nameLen=u16(view,offset+28), extraLen=u16(view,offset+30), commentLen=u16(view,offset+32);
    const local=u32(view,offset+42);
    const next=offset+46+nameLen+extraLen+commentLen;
    if(next>raw.byteLength) throw new Error(`${zip.name}: nome ou cabeçalho inválido.`);
    const caminho=enc.decode(new Uint8Array(raw,offset+46,nameLen));
    offset=next;
    if(caminho.endsWith('/') || ignoravel(caminho))continue;
    const tipo=extrairTipo(caminho);
    if(!tipo)continue;
    const marcador=obterMarcador(caminho,zip.name);
    if(!marcador)throw new Error(`${zip.name}: não reconheci Cn-IA ou Cn-REAL na pasta, arquivo ou nome do ZIP (${caminho}).`);
    if(flags&1)throw new Error(`${caminho}: ZIP com senha não é aceito.`);
    if(![0,8].includes(method))throw new Error(`${caminho}: compressão ZIP não suportada.`);
    if(size>LIMITE_ITEM || (total+=size)>LIMITE_TOTAL)throw new Error('Os arquivos descompactados são grandes demais. Divida em lotes menores.');
    if(local+30>raw.byteLength || view.getUint32(local,true)!==0x04034b50)throw new Error(`${caminho}: cabeçalho local inválido.`);
    const start=local+30+u16(view,local+26)+u16(view,local+28);
    if(start+compressed>raw.byteLength)throw new Error(`${caminho}: conteúdo incompleto.`);
    const bytes=new Uint8Array(raw,start,compressed);
    let extracted;
    if(method===0)extracted=new Uint8Array(bytes);
    else {
      if(typeof DecompressionStream==='undefined')throw new Error('Seu navegador não suporta descompactação de ZIP. Atualize o navegador.');
      try {
        const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        const reader=stream.getReader(),chunks=[];
        let actual=0;
        while(true){
          const {done,value}=await reader.read();
          if(done)break;
          actual+=value.byteLength;
          if(actual>LIMITE_ITEM || actual>size){await reader.cancel();throw new Error('Tamanho excedido');}
          chunks.push(value);
        }
        extracted=new Uint8Array(actual);
        let pos=0;
        for(const chunk of chunks){extracted.set(chunk,pos);pos+=chunk.byteLength;}
      } catch {throw new Error(`${caminho}: falha ao descompactar ou tamanho superior ao permitido.`);}
    }
    if(extracted.byteLength!==size)throw new Error(`${caminho}: tamanho descompactado não confere.`);
    let texto=null,arq=null;
    const nome=caminho.split('/').at(-1);
    if(tipo==='texto')texto=enc.decode(extracted).replace(/^\uFEFF/,'').trim();
    else arq=new File([extracted],nome,{type:MIME[nome.split('.').pop().toLowerCase()]||'application/octet-stream'});
    if(tipo==='texto'&&!texto)throw new Error(`${caminho}: texto vazio.`);
    itens.push({ ...marcador, tipo, titulo:nome.replace(/\.[^.]+$/,''), texto, arq, origemZip:zip.name, arquivo:caminho });
  }
  if(!itens.length)throw new Error(`${zip.name}: não encontrei materiais de imagem, texto, áudio ou vídeo.`);
  return itens;
}

// Um grupo contém quatro peças distintas: C1-REAL, C1-IA, C1.1-REAL, C1.1-IA.
// O sorteio do par é realizado pelo servidor ao criar a sessão.
export function agruparComparacoes(itens) {
  const mapa=new Map();
  for(const item of itens) {
    const key=`${item.tipo}:${item.codigo}`;
    if(!mapa.has(key))mapa.set(key,[]);
    mapa.get(key).push(item);
  }
  const grupos=[],erros=[];
  for(const [key,pecas] of mapa) {
    const [tipo,codigo]=key.split(':');
    const avisos=[];
    const identificadores=new Set();
    for(const item of pecas) {
      const identidade=`${item.posicao===null?'base':item.posicao}:${item.ia?'IA':'REAL'}`;
      if(identificadores.has(identidade))avisos.push(`Material repetido: ${identidade}.`);
      identificadores.add(identidade);
    }
    const esperados=['base:IA','base:REAL','1:IA','1:REAL'];
    if(pecas.length!==4 || esperados.some(x=>!identificadores.has(x)))
      avisos.push(`São necessários quatro arquivos: ${codigo}-REAL, ${codigo}-IA, ${codigo}.1-REAL e ${codigo}.1-IA.`);
    if(avisos.length)erros.push(`${codigo} (${tipo}): ${avisos.join(' ')}`);
    grupos.push({key,tipo,codigo,itens:[...pecas].sort((a,b)=>(a.posicao??0)-(b.posicao??0)||Number(a.ia)-Number(b.ia)),erros:avisos});
  }
  grupos.sort((a,b)=>a.codigo.localeCompare(b.codigo,'pt-BR',{numeric:true})||a.tipo.localeCompare(b.tipo));
  return {grupos,erros};
}
