// Evolução descritiva por participante, NÃO previsão validada nem série sintética.
// Só entram sessões completas e válidas, já filtradas por analisarAvancado.
export const PREVISAO_INICIAL = 50;
export const FORCA_INICIAL = 8;

export function criarEvolucao(pessoas, {mediaInicial=PREVISAO_INICIAL, forca=FORCA_INICIAL}={}) {
  const ordenadas = [...(pessoas || [])]
    .filter(p=>Number.isFinite(p.pct_ind) && (p.fim || p.inicio))
    .sort((a,b) => (new Date(a.fim||a.inicio) - new Date(b.fim||b.inicio)) || String(a.id).localeCompare(String(b.id)));
  const serie = [{ n:0, observada:null, previsao:mediaInicial, limiteInferior:null, limiteSuperior:null, data:null, antes:mediaInicial }];
  let soma=0, somaQuadrados=0;
  for (let i=0;i<ordenadas.length;i++) {
    const p=ordenadas[i], n=i+1, nota=p.pct_ind;
    const antes=(forca*mediaInicial+soma)/(forca+n-1);
    soma+=nota; somaQuadrados+=nota*nota;
    const media=soma/n;
    const variancia=n>1?Math.max(0,(somaQuadrados-n*media*media)/(n-1)):null;
    const se=n>1?Math.sqrt(variancia/n):null;
    serie.push({n, observada:media, previsao:(forca*mediaInicial+soma)/(forca+n),
      limiteInferior:se==null?null:Math.max(0,media-1.96*se),
      limiteSuperior:se==null?null:Math.min(100,media+1.96*se),
      antes, data:p.fim||p.inicio, nota});
  }
  return serie;
}

export function contarDistribuicao(pessoas) {
  const limites=[0,20,40,60,80,100];
  const n=Array(5).fill(0);
  for (const p of pessoas||[]) {
    if (!Number.isFinite(p.pct_ind)) continue;
    n[Math.min(4,Math.max(0,Math.floor(p.pct_ind/20)))]+=1;
  }
  return n.map((v,i)=>({nome:`${limites[i]}–${limites[i+1]}%`,quantidade:v}));
}
