// Restringe o upload aos formatos compatíveis com os players HTML5 usados no site.
export const FORMATOS = {
  audio: ['mp3', 'wav', 'ogg', 'm4a'],
  video: ['mp4', 'webm'],
};

export const ACCEPT = {
  audio: '.mp3,.wav,.ogg,.m4a,audio/mpeg,audio/wav,audio/ogg,audio/mp4',
  video: '.mp4,.webm,video/mp4,video/webm',
};

export function extensao(nome) {
  return (nome.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
}

// Ex.: "minha.musica.MP3" -> "minha.musica".
export function nomeArquivoSemExtensao(nome) {
  return nome.replace(/\.[^.]+$/, '').trim();
}

export function arquivoValido(tipo, arquivo) {
  const ext = extensao(arquivo.name);
  if (!FORMATOS[tipo]?.includes(ext) || arquivo.size === 0) return false;
  // Navegadores nem sempre preenchem o MIME, e alguns usam application/octet-stream.
  if (!arquivo.type || arquivo.type === 'application/octet-stream') return true;
  return tipo === 'audio' ? arquivo.type.startsWith('audio/') : arquivo.type.startsWith('video/');
}

export function tamanhoFormatado(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
