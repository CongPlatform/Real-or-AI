// Grupos de áudio são identificadores administrativos, exclusivos de áudios individuais.
// A classificação de autoria é lida do nome SOMENTE neste importador de humanos.
export const EXTENSOES_AUDIO = ['mp3', 'wav', 'ogg', 'm4a'];

export function nomeAudioHumano(grupo, extensao = 'mp3', versao = null) {
  if (!Number.isSafeInteger(grupo) || grupo < 1 || grupo > 9999) throw new Error('Grupo inválido.');
  return `G${String(grupo).padStart(2, '0')}_HUMANO${versao === null ? '' : `_${String(versao).padStart(2, '0')}`}.${extensao}`;
}

export function grupoDoNome(nome) {
  const m = /^(?:G|GRUPO)[ _-]*0*([1-9]\d*)(?=[ _.-]|$)/i.exec(String(nome || '').trim());
  const n = Number(m?.[1]);
  return n >= 1 && n <= 9999 && Number.isSafeInteger(n) ? n : null;
}

export function identificarArquivoAudioHumano(arquivo) {
  const nome = String(arquivo?.name || '').trim();
  const m = /^G(0*[1-9]\d*)_HUMANO(?:_(0*[1-9]\d*))?\.(mp3|wav|ogg|m4a)$/i.exec(nome);
  if (!m) return { erro: `Nome inválido: ${nome}. Use G01_HUMANO.mp3 (ou WAV, OGG, M4A).` };
  const grupo = Number(m[1]);
  const versao = m[2] ? Number(m[2]) : null;
  if (versao !== null && (!Number.isSafeInteger(versao) || versao > 9999)) return { erro: `Versão inválida: ${nome}.` };
  if (!Number.isSafeInteger(grupo) || grupo > 9999) return { erro: `Grupo fora do limite (1–9999): ${nome}.` };
  if (!arquivo.size) return { erro: `Arquivo vazio: ${nome}.` };
  if (arquivo.type && arquivo.type !== 'application/octet-stream' && !arquivo.type.startsWith('audio/')) {
    return { erro: `Arquivo não reconhecido como áudio: ${nome}.` };
  }
  return { arquivo, grupo, titulo: nomeAudioHumano(grupo, m[3].toLowerCase(), versao).replace(/\.[^.]+$/, ''), ia: false };
}

export function analisarLoteAudioHumano(arquivos, gruposDisponiveis) {
  const grupos = [...new Set((gruposDisponiveis || []).map(Number))].filter(g => Number.isInteger(g) && g >= 1 && g <= 9999).sort((a,b) => a-b);
  const erros = [];
  const itens = [];
  const vistos = new Set();
  if (!grupos.length) erros.push('Nenhum grupo existente identificado. Associe primeiro os áudios atuais aos seus grupos.');
  for (const arquivo of arquivos || []) {
    const analise = identificarArquivoAudioHumano(arquivo);
    if (analise.erro) { erros.push(analise.erro); continue; }
    if (vistos.has(analise.grupo)) { erros.push(`Grupo ${analise.grupo}: há mais de um arquivo neste lote.`); continue; }
    vistos.add(analise.grupo);
    if (!grupos.includes(analise.grupo)) { erros.push(`${arquivo.name}: grupo ${analise.grupo} não existe entre os grupos cadastrados.`); continue; }
    itens.push(analise);
  }
  const faltantes = grupos.filter(g => !vistos.has(g));
  if (faltantes.length) erros.push(`Faltam áudios humanos para os grupos: ${faltantes.map(g => `G${String(g).padStart(2,'0')}`).join(', ')}.`);
  if (arquivos?.length && arquivos.length !== grupos.length) erros.push(`Este lote deve ter exatamente ${grupos.length} arquivo(s), um por grupo; foram selecionados ${arquivos.length}.`);
  return { itens: itens.sort((a,b) => a.grupo-b.grupo), grupos, erros };
}
