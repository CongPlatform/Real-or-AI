import { supabase } from './supabase';

// Recompacta imagens grandes no próprio navegador antes do envio.
// Não estica nem recorta, preserva a proporção e o original fica no computador.
async function otimizarImagem(arquivo) {
  if (arquivo.size < 500_000 || typeof document === 'undefined') return arquivo;
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const escala = Math.min(1, 1200 / img.naturalWidth, 900 / img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.79));
    if (!blob || blob.size >= arquivo.size) return arquivo;
    return new File([blob], arquivo.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
  } catch { return arquivo; }
  finally { URL.revokeObjectURL(url); }
}

// Salva mídia com nome único no Storage e registra o gabarito separadamente.
// Mantém o mesmo comportamento do cadastro individual e dos lotes anteriores.
async function subir(tipo, arq) {
  const arquivo = tipo === 'imagem' ? await otimizarImagem(arq) : arq;
  const ext = arquivo.name.split('.').pop().toLowerCase();
  const path = `${tipo}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('midia').upload(path, arquivo, {
    cacheControl: '31536000',
    contentType: arquivo.type || ({
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
      m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm',
    }[ext] || 'application/octet-stream'),
  });
  if (error) throw error;
  return { path, url: supabase.storage.from('midia').getPublicUrl(path).data.publicUrl };
}

export async function criarItem(tipo, it, titulo, extra = {}) {
  let path = null;
  let conteudoId = null;
  try {
    let url = null;
    if (tipo !== 'texto') ({ path, url } = await subir(tipo, it.arq));
    const { data, error } = await supabase.from('conteudos')
      .insert({ tipo, titulo: titulo || null, url, texto: tipo === 'texto' ? it.texto.trim() : null, ...extra })
      .select('id').single();
    if (error) throw error;
    conteudoId = data.id;
    const { error: erroGabarito } = await supabase.from('gabarito')
      .insert({ conteudo_id: conteudoId, eh_ia: it.ia });
    if (erroGabarito) throw erroGabarito;
    return conteudoId;
  } catch (erro) {
    // Em caso de falha, tenta remover o registro e o arquivo desta tentativa.
    if (conteudoId) await supabase.from('conteudos').delete().eq('id', conteudoId);
    if (path) await supabase.storage.from('midia').remove([path]);
    throw erro;
  }
}
