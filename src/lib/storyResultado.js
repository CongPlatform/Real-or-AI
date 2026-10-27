const esc = (s='') => String(s)
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'",'&#39;');

function pct(acertos,total){
  return total ? Math.round((100*acertos)/total) : 0;
}

function modoLabel(total, totalInd, totalComp){
  if (totalInd === 20 && totalComp === 20) return 'Teste completo';
  if (total > 0) return `Teste ${totalInd}+${totalComp}`;
  return 'Resultado do teste';
}

export function nomeArquivoStories(info={}){
  const parte = (modoLabel(info.totalGeral, info.totalInd, info.totalComp) || 'resultado')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  return `real-ou-ia-${parte}-stories.png`;
}

function svgResultado(info={}){
  const totalGeral = Number(info.totalGeral) || 0;
  const acertosGerais = Number(info.acertosGerais) || 0;
  const totalInd = Number(info.totalInd) || 0;
  const acertosInd = Number(info.acertosInd) || 0;
  const totalComp = Number(info.totalComp) || 0;
  const acertosComp = Number(info.acertosComp) || 0;
  const estimativa = Number.isFinite(Number(info.estimativa)) ? Number(info.estimativa) : null;
  const estimativaBase = Number.isFinite(Number(info.estimativaBase)) ? Number(info.estimativaBase) : totalGeral;
  const estimativaPct = estimativa != null && estimativaBase ? Math.round((100*estimativa)/estimativaBase) : null;
  const geralPct = pct(acertosGerais,totalGeral);
  const indPct = pct(acertosInd,totalInd);
  const compPct = pct(acertosComp,totalComp);
  const modo = modoLabel(totalGeral,totalInd,totalComp);
  const subtitulo = totalComp > 0
    ? 'Pontuação separada da Parte 1 e da Parte 2'
    : 'Pontuação da Parte 1';
  const url = esc(info.url || 'real-ou-ia.cong.com.br');
  const estimativaTxt = estimativa != null ? `${estimativa}/${estimativaBase} (${estimativaPct}%)` : '—';
  const comparacaoLegenda = totalComp > 0
    ? 'comparações totalmente corretas'
    : 'comparações';
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#14082D"/>
        <stop offset="52%" stop-color="#2A0F5E"/>
        <stop offset="100%" stop-color="#120820"/>
      </linearGradient>
      <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#26174A"/>
        <stop offset="100%" stop-color="#181329"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#05040a" flood-opacity="0.38"/>
      </filter>
    </defs>
    <rect width="1080" height="1920" fill="url(#bg)"/>
    <circle cx="870" cy="190" r="220" fill="#C6F432" opacity="0.12"/>
    <circle cx="180" cy="1560" r="180" fill="#7E54FF" opacity="0.18"/>
    <circle cx="920" cy="1620" r="150" fill="#C6F432" opacity="0.08"/>
    <g opacity="0.16" stroke="#ffffff" fill="none">
      <path d="M58 118 L188 118"/><path d="M58 158 L158 158"/><path d="M864 114 L1016 114"/><path d="M862 154 L968 154"/>
      <rect x="62" y="182" width="84" height="84" rx="18"/><rect x="924" y="187" width="86" height="86" rx="18"/>
      <circle cx="960" cy="342" r="24"/><circle cx="118" cy="1414" r="20"/>
    </g>
    <g filter="url(#shadow)">
      <rect x="70" y="96" width="940" height="1728" rx="42" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)"/>
    </g>
    <text x="110" y="190" font-family="Arial, Helvetica, sans-serif" font-size="38" fill="#C6F432" font-weight="700">REAL OU IA?</text>
    <text x="110" y="240" font-family="Arial, Helvetica, sans-serif" font-size="66" fill="#FFFFFF" font-weight="800">Meu resultado</text>
    <text x="110" y="290" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#D8D5E8">${esc(modo)} · ${esc(subtitulo)}</text>

    <g filter="url(#shadow)">
      <rect x="110" y="360" width="860" height="360" rx="42" fill="#C6F432"/>
      <text x="540" y="452" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" fill="#23113D" font-weight="700">Pontuação geral</text>
      <text x="540" y="595" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="170" fill="#1B1335">${geralPct}%</text>
      <text x="540" y="665" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#271B4A" font-weight="700">${acertosGerais} acertos em ${totalGeral} decisões</text>
    </g>

    <g filter="url(#shadow)">
      <rect x="110" y="780" width="400" height="270" rx="32" fill="url(#card)" stroke="rgba(255,255,255,0.08)"/>
      <text x="148" y="850" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#FFFFFF" font-weight="700">Parte 1</text>
      <text x="148" y="895" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#D8D5E8">Classificações individuais</text>
      <text x="148" y="988" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="110" fill="#FFFFFF">${indPct}%</text>
      <text x="148" y="1030" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#C6F432">${acertosInd}/${totalInd}</text>
    </g>
    <g filter="url(#shadow)">
      <rect x="570" y="780" width="400" height="270" rx="32" fill="url(#card)" stroke="rgba(255,255,255,0.08)"/>
      <text x="608" y="850" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#FFFFFF" font-weight="700">Parte 2</text>
      <text x="608" y="895" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#D8D5E8">${esc(comparacaoLegenda)}</text>
      <text x="608" y="988" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="110" fill="#FFFFFF">${compPct}%</text>
      <text x="608" y="1030" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#C6F432">${acertosComp}/${totalComp}</text>
    </g>

    <g filter="url(#shadow)">
      <rect x="110" y="1110" width="860" height="200" rx="32" fill="url(#card)" stroke="rgba(255,255,255,0.08)"/>
      <text x="150" y="1182" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#FFFFFF" font-weight="700">Quanto eu achei que acertaria</text>
      <text x="150" y="1232" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#D8D5E8">Estimativa antes de ver o resultado</text>
      <text x="150" y="1282" font-family="Arial, Helvetica, sans-serif" font-size="48" fill="#C6F432" font-weight="700">${esc(estimativaTxt)}</text>
    </g>

    <g filter="url(#shadow)">
      <rect x="110" y="1370" width="860" height="250" rx="32" fill="#FFFFFF" opacity="0.96"/>
      <text x="150" y="1450" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#20143C" font-weight="700">Quer tentar também?</text>
      <text x="150" y="1510" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#3B2A64">Descubra se você consegue diferenciar conteúdos</text>
      <text x="150" y="1550" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#3B2A64">reais daqueles produzidos com inteligência artificial.</text>
      <text x="150" y="1605" font-family="Arial, Helvetica, sans-serif" font-size="36" fill="#6A43FF" font-weight="800">${url}</text>
    </g>

    <text x="540" y="1750" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#D8D5E8">Imagem pronta para compartilhar nos Stories</text>
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
