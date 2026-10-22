// Análise aproximada de RMS e pico. Não substitui EBU R128 / ITU-R BS.1770 (LUFS).
// O ganho é aplicado na reprodução: originais permanecem intactos no Storage.
const db = (v) => v>0 ? 20*Math.log10(v) : -100;
const arredondar = (n) => Math.round(n*100)/100;
export async function medirAudio(url) {
  const resposta=await fetch(url, { mode:'cors' });
  if (!resposta.ok) throw new Error(`Arquivo indisponível (HTTP ${resposta.status}).`);
  const tipo=resposta.headers.get('content-type') || '';
  if (tipo.includes('text/html')) throw new Error('URL não retornou um arquivo de áudio.');
  const buffer=await resposta.arrayBuffer();
  if (buffer.byteLength>35*1024*1024) throw new Error('Arquivo acima de 35 MB: otimizar separadamente.');
  const Context=window.AudioContext||window.webkitAudioContext;
  if (!Context) throw new Error('Navegador sem Web Audio API.');
  const ctx=new Context();
  let decoded;
  try { decoded=await ctx.decodeAudioData(buffer); }
  finally { await ctx.close(); }
  if (!decoded.length) throw new Error('Arquivo de áudio sem amostras.');
  let energy=0, n=0, peak=0;
  const salto=Math.max(1,Math.floor(decoded.sampleRate/12000));
  for (let c=0;c<decoded.numberOfChannels;c++) {
    const amostras=decoded.getChannelData(c);
    for(let i=0;i<amostras.length;i++){
      const x=amostras[i]; if(!Number.isFinite(x))continue;
      peak=Math.max(peak,Math.abs(x));
      if (i % salto === 0) { energy+=x*x; n++; }
    }
  }
  const rms=Math.sqrt(energy/Math.max(n,1));
  const rmsDB=db(rms), picoDB=db(peak);
  // Alvo conservador para fala/música mista; somente eleva faixas baixas.
  const elevar=Math.max(0, Math.min(12, -20-rmsDB, -1-picoDB));
  return { rmsDB:arredondar(rmsDB), picoDB:arredondar(picoDB),
    ganhoDB:rmsDB < -48 || peak < 0.005 ? 0 : arredondar(elevar),
    duracao:arredondar(decoded.duration), tamanhoMB:arredondar(buffer.byteLength/1024/1024) };
}
