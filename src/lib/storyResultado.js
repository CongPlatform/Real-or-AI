const esc = (s='') => String(s)
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'",'&#39;');

function pct(acertos,total){
  return total ? Math.round((100*acertos)/total) : 0;
}

function limitar(n,min,max){
  const valor = Number(n);
  if (!Number.isFinite(valor)) return min;
  return Math.max(min, Math.min(max, valor));
}

function modoLabel(total, totalInd, totalComp){
  if (totalInd === 20 && totalComp === 20) return 'Teste completo';
  if (totalComp === 0 && totalInd > 0) return 'Etapa individual';
  if (total > 0) return `${total} decisões respondidas`;
  return 'Resultado do teste';
}

export function nomeArquivoStories(info={}){
  const parte = (modoLabel(info.totalGeral, info.totalInd, info.totalComp) || 'resultado')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  return `real-ou-ia-${parte}-stories.png`;
}

const QR_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASgAAAEoCAIAAABkZftOAAAFfUlEQVR4nO3dQW5jNxBAwTjI/a88WWTNARiQ85pS1dqQZFsPXDSa/+fXr19/AX/W3/UHgG8kPAgIDwLCg4DwICA8CAgPAsKDgPAgIDwICA8CwoOA8CAgPAgIDwLCg4DwICA8CAgPAsKDgPAgIDwICA8CwoOA8CAgPAgIDwLCg4DwICA8CAgPAv/cfoOfn5/bb3HE6jmBu5//1Ovs2n3fUz+/6/XvwylOPAgIDwLCg4DwICA8CAgPAsKDwPU53srtOcnK7blcNae6Pa879Xc79fOnVP8vJx4EhAcB4UFAeBAQHgSEBwHhQSCb462cmqtUc6Hb7/tt+3Kvfx9WnHgQEB4EhAcB4UFAeBAQHgSEB4Fxc7xpbu+traxe/9Q8avd1bs8Pv40TDwLCg4DwICA8CAgPAsKDgPAgYI73h1TPzVu5fU8mv+fEg4DwICA8CAgPAsKDgPAgIDwIjJvjfdu8qLqHc+XU8/RO+dTvgxMPAsKDgPAgIDwICA8CwoOA8CCQzfGmPYetcurezt1516nXP/V5vu374MSDgPAgIDwICA8CwoOA8CAgPAj8fOq+0ym351S352m7Tr2+79XvOfEgIDwICA8CwoOA8CAgPAgIDwLX9/Fu38dYzbtWXrl/8vZ9m9V+3e356ilOPAgIDwLCg4DwICA8CAgPAsKDwLjn492eq7x+n2S117f6+Wovcff1p3HiQUB4EBAeBIQHAeFBQHgQEB4Evu75eNPmSNPun7w9l7s9F91VfQ+deBAQHgSEBwHhQUB4EBAeBIQHgez5eNPuXazmb6/sAa5M28eb9v9dceJBQHgQEB4EhAcB4UFAeBAQHgSuz/Fuz4umzYWq5/KdcvvzT5sbV5/HiQcB4UFAeBAQHgSEBwHhQUB4EMj28Xa9fu/i6/dJ3t4/nMY+Hnwg4UFAeBAQHgSEBwHhQUB4EMiej7dyas5zak41bX9s16nn1J1SzQOn7Uk68SAgPAgIDwLCg4DwICA8CAgPAs/fq7n7vq881+71eztf+X+t2MeDDyQ8CAgPAsKDgPAgIDwICA8C4+7VfGU+dmpOtauaQ+6+zsq0/UbPx4MvIjwICA8CwoOA8CAgPAgIDwLX79Ws9sRe2Wfb/Ty3f69pe3G7pu0BrjjxICA8CAgPAsKDgPAgIDwICA8C1+d4t+cht+dgu6bNzSq39xtXXpnfOvEgIDwICA8CwoOA8CAgPAgIDwLX53i7Tt3T+Mpz/0697+7fYdo9n6dMm9etOPEgIDwICA8CwoOA8CAgPAgIDwLXn493ai437d7LlWn7YNP+nre5VxNYEh4EhAcB4UFAeBAQHgSEB4Fn7tWs9r6q/bdpe267qnsyX+HEg4DwICA8CAgPAsKDgPAgIDwIXJ/jvbL3Vc2Fqnsvqz29U3O51+eiTjwICA8CwoOA8CAgPAgIDwLCg0D2fLxp+3Uru/Ou28/rq/bcpj1Pb9rr7HLiQUB4EBAeBIQHAeFBQHgQEB4EsjneyrR50e17HU/9vtPun5y21zdtf8+JBwHhQUB4EBAeBIQHAeFBQHgQGDfHm+b2fY+771u9/qmfn8Y+HnwR4UFAeBAQHgSEBwHhQUB4EDDH+59u389Z7enZY/yPfTz4QMKDgPAgIDwICA8CwoOA8CAwbo73qXtc1Z7b7pyweu7cK3uMpzjxICA8CAgPAsKDgPAgIDwICA8C2Rxv2lxlZdrnfOUey1N7gNPmjac48SAgPAgIDwLCg4DwICA8CAgPAj/T5j/wDZx4EBAeBIQHAeFBQHgQEB4EhAcB4UFAeBAQHgSEBwHhQUB4EBAeBIQHAeFBQHgQEB4EhAcB4UFAeBAQHgSEBwHhQUB4EBAeBIQHAeFBQHgQEB4EhAeBfwHL2jBigMD6kAAAAABJRU5ErkJggg==";

function svgResultado(info={}) {
  const n = v => Math.max(0, Number(v) || 0);
  const ti=n(info.totalInd), tc=n(info.totalComp);
  const ai=Math.min(ti,n(info.acertosInd)), ac=Math.min(tc,n(info.acertosComp));
  const total=ti+tc, certos=ai+ac;
  const porcento=(a,t)=>t?Math.round(100*a/t):0;
  const modalidade = info.modo === 'completo' ? 'DESAFIO COMPLETO' :
    info.modo === 'reduzido' ? 'DESAFIO RÁPIDO' : 'MEU DESAFIO';
  const estimativa = info.estimativa === null || info.estimativa === undefined ||
    info.estimativa === '' || !Number.isFinite(Number(info.estimativa)) ||
    Number(info.estimativa) > total || Number(info.estimativa) < 0
      ? null : Math.round(Number(info.estimativa));
  const media = info.porTipo || {};
  const nomes = {audio:'Áudio', texto:'Texto',video:'Vídeo', imagem:'Imagem'};
  const campos=Object.entries(nomes).filter(([k])=>Number(media[k]?.total)>0);
  const p1=tc>0? {x:92,w:420}:{x:92,w:896};
  const cards = `
    <g filter="url(#shadow)">
      <rect x="${p1.x}" y="770" width="${p1.w}" height="242" rx="28" fill="#fff" stroke="#181329" stroke-width="6"/>
      <text x="126" y="835" class="card-title">PARTE 1 · INDIVIDUAIS</text>
      <text x="126" y="952" class="card-num">${porcento(ai,ti)}%</text>
      <text x="126" y="990" class="card-desc">${ai} de ${ti} acertos</text>
    </g>
    ${tc ? `<g filter="url(#shadow)">
      <rect x="556" y="770" width="432" height="242" rx="28" fill="#fff" stroke="#181329" stroke-width="6"/>
      <text x="590" y="835" class="card-title">PARTE 2 · COMPARAÇÕES</text>
      <text x="590" y="952" class="card-num">${porcento(ac,tc)}%</text>
      <text x="590" y="990" class="card-desc">${ac} de ${tc} acertos</text>
    </g>` : ''}`;
  const barStart=1095, barGap=99;
  const bars=campos.map(([chave,rotulo],i)=>{
    const a=Math.min(n(media[chave].acertos),n(media[chave].total));
    const t=n(media[chave].total);
    const progress=400*a/t;
    const y=barStart+i*barGap;
    return `<text x="118" y="${y+33}" class="bar-label">${rotulo}</text>
      <rect x="360" y="${y}" width="430" height="47" rx="23" fill="#fff" stroke="#181329" stroke-width="5"/>
      <rect x="364" y="${y+4}" width="${Math.max(0,Math.min(422,422*a/t))}" height="39" rx="19" fill="#CBFF38"/>
      <text x="946" y="${y+34}" text-anchor="end" class="bar-value">${a}/${t}</text>`;
  }).join('');
  const dadosFim=barStart+campos.length*barGap+10;
  const mensagemY=Math.max(1100,Math.min(1480,dadosFim+20));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
    <defs>
      <pattern id="dots" width="36" height="36" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="2.2" fill="#9B8AC9" opacity=".38"/>
      </pattern>
      <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
        <feDropShadow dx="7" dy="9" stdDeviation="0" flood-color="#181329"/>
      </filter>
      <style>
        text{font-family:Arial,Helvetica,sans-serif;fill:#181329}
        .eyebrow{font-size:31px;font-weight:800;letter-spacing:3px;fill:#6745ED}
        .big{font-size:99px;font-weight:900;letter-spacing:-3px}
        .sub{font-size:43px;font-weight:800}
        .card-title{font-size:25px;font-weight:900}
        .card-num{font-size:108px;font-weight:900;fill:#6D43F5}
        .card-desc{font-size:26px;font-weight:700}
        .bar-label,.bar-value{font-size:36px;font-weight:800}
        .subtle{font-size:28px;font-weight:700;fill:#695E7B}
      </style>
    </defs>
    <rect width="1080" height="1920" fill="#F3EEFF"/>
    <rect width="1080" height="1920" fill="url(#dots)"/>
    <rect x="53" y="76" width="974" height="1725" rx="45" fill="#fff" stroke="#181329" stroke-width="7" filter="url(#shadow)"/>
    <rect x="325" y="126" width="430" height="64" rx="32" fill="#E9DEFF" stroke="#181329" stroke-width="5"/>
    <text x="540" y="172" text-anchor="middle" class="eyebrow" font-size="26">${esc(modalidade)}</text>
    <text x="540" y="317" text-anchor="middle" class="big">REAL <tspan fill="#7041F7">OU</tspan> <tspan fill="#A6E924">IA?</tspan></text>
    <text x="540" y="390" text-anchor="middle" class="sub">Meu resultado</text>
    <rect x="92" y="448" width="896" height="280" rx="33" fill="#49228E" stroke="#181329" stroke-width="7" filter="url(#shadow)"/>
    <text x="132" y="525" font-size="39" font-weight="800" style="fill:#fff">Pontuação geral</text>
    <text x="126" y="669" font-size="142" font-weight="900" style="fill:#CBFF38">${porcento(certos,total)}%</text>
    <rect x="560" y="575" width="364" height="45" rx="22" fill="#fff" stroke="#181329" stroke-width="5"/>
    <rect x="564" y="579" width="${Math.round(356*porcento(certos,total)/100)}" height="37" rx="18" fill="#CBFF38"/>
    <text x="560" y="673" font-size="28" font-weight="700" style="fill:#fff">${certos} acertos em ${total} decisões</text>
    ${cards}
    ${bars}
    <rect x="92" y="${mensagemY}" width="896" height="188" rx="28" fill="#EEE5FF" stroke="#181329" stroke-width="5"/>
    <text x="330" y="${mensagemY+62}" text-anchor="middle" font-size="36" font-weight="900">VOCÊ CONSEGUE</text>
    <text x="330" y="${mensagemY+104}" text-anchor="middle" font-size="36" font-weight="900">DIFERENCIAR?</text>
    <text x="330" y="${mensagemY+147}" text-anchor="middle" font-size="25" font-weight="700">Escaneie e participe!</text>
    <rect x="690" y="${mensagemY+9}" width="170" height="170" rx="13" fill="#fff" stroke="#181329" stroke-width="3"/>
    <image x="700" y="${mensagemY+19}" width="150" height="150" href="${QR_DATA}"/>
    <text x="540" y="1740" text-anchor="middle" font-size="42" font-weight="900" style="fill:#6440EB">real-ou-ia.cong.com.br</text>
  </svg>`;
}

export async function gerarStoryResultado(info={}){
  const svg = svgResultado(info);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = svgUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const url = URL.createObjectURL(pngBlob);
    return { blob: pngBlob, url };
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export function baixarBlob(blob, nome='resultado.png'){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function compartilharImagem(blob, nome='resultado.png'){
  if (typeof navigator.share !== 'function' || typeof File === 'undefined') return false;
  const file = new File([blob], nome, { type: 'image/png' });
  try {
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title: 'Meu resultado no Real ou IA?' });
    return true;
  } catch {
    return false;
  }
}
