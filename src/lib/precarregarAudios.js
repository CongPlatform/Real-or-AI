// Prepara só o próximo áudio da sessão. Os navegadores podem ignorar preload.
// Evita baixar antecipadamente dezenas de faixas longas no celular.
let ativo = null;
export function prepararProximoAudio(rodadas, proximoIndice = 0) {
  const prox = rodadas.slice(proximoIndice).find(r => r.tipo === 'audio' && r.url);
  if (!prox) { ativo = null; return; }
  if (ativo?.url === prox.url) return;
  const el = new Audio(); el.preload = 'auto';
  if (Number(prox.audio_gain_db)>0) el.crossOrigin='anonymous';
  el.src = prox.url;
  ativo = { url:prox.url, el };
  // Preferir o cache HTTP do Supabase; sem áudio duplicado tocando em paralelo.
  el.load();
}
