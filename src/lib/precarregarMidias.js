// Cache de sessão: só imagens sorteadas para este participante.
// Não baixa as 120 imagens do banco, nem seus áudios/vídeos.
const imagens = new Map();
const fila = [];
const MAX_EM_MEMORIA = 12;
const PARALELOS = 2;
let emAndamento = 0;

function reduzirCache() {
  for (const [url, registro] of imagens) {
    if (imagens.size <= MAX_EM_MEMORIA) break;
    if (registro.status === 'pronto' || registro.status === 'erro') imagens.delete(url);
  }
}

function processarFila() {
  while (emAndamento < PARALELOS && fila.length) {
    const trabalho = fila.shift();
    if (!trabalho || trabalho.status !== 'pendente') continue;
    emAndamento += 1;
    trabalho.status = 'carregando';
    const img = new Image();
    trabalho.img = img;
    img.decoding = 'async';
    if ('fetchPriority' in img) img.fetchPriority = trabalho.urgente ? 'high' : 'low';
    const terminar = (ok) => {
      trabalho.status = ok ? 'pronto' : 'erro';
      if (!ok) imagens.delete(trabalho.url); // permite nova tentativa normal pelo <img>
      emAndamento -= 1;
      trabalho.resolver(ok);
      reduzirCache();
      processarFila();
    };
    img.onload = async () => {
      // Decodifica antecipadamente as primeiras imagens. As demais só são baixadas.
      if (trabalho.urgente && typeof img.decode === 'function') {
        try { await img.decode(); } catch { /* download concluído; renderização tentará decodificar */ }
      }
      terminar(true);
    };
    img.onerror = () => terminar(false);
    img.src = trabalho.url;
  }
}

function adicionar(url, urgente = false) {
  if (!url || typeof Image === 'undefined') return Promise.resolve(false);
  const atual = imagens.get(url);
  if (atual) {
    if (urgente && atual.status === 'pendente') {
      atual.urgente = true;
      const indice = fila.indexOf(atual);
      if (indice >= 0) { fila.splice(indice, 1); fila.unshift(atual); }
    }
    return atual.promessa;
  }
  const registro = { url, urgente, status: 'pendente', img: null, resolver: null, promessa: null };
  registro.promessa = new Promise((resolver) => { registro.resolver = resolver; });
  imagens.set(url, registro);
  if (urgente) fila.unshift(registro); else fila.push(registro);
  processarFila();
  return registro.promessa;
}

const urlsDaSessao = (individuais, comparacoes) => {
  const urls = [];
  for (const item of individuais) if (item.tipo === 'imagem' && item.url) urls.push(item.url);
  for (const par of comparacoes) {
    for (const item of par.conteudos || []) if (item.tipo === 'imagem' && item.url) urls.push(item.url);
  }
  return [...new Set(urls)];
};

export function prepararImagensDaSessao(individuais, comparacoes) {
  if (typeof window === 'undefined') return;
  const urls = urlsDaSessao(individuais, comparacoes);
  // As duas primeiras começam imediatamente enquanto o participante lê as instruções.
  urls.slice(0, 2).forEach((url) => adicionar(url, true));
  const conexao = navigator.connection;
  const economia = conexao?.saveData || /(?:slow-2g|2g)/.test(conexao?.effectiveType || '');
  // Evita gastar os dados móveis do participante em uma conexão muito lenta.
  const maximo = economia ? 4 : conexao?.effectiveType === '3g' ? 10 : urls.length;
  // As demais entram numa fila de baixa prioridade, nunca todas em paralelo.
  setTimeout(() => urls.slice(2, maximo).forEach((url) => adicionar(url)), 900);
}

export function anteciparProximasImagens(individuais, comparacoes, indice = 0) {
  if (typeof window === 'undefined') return;
  const proximas = urlsDaSessao(individuais.slice(indice, indice + 7), indice >= individuais.length ? comparacoes : []);
  proximas.slice(0, 3).forEach((url) => adicionar(url, true));
}
