import { supabase } from './supabase';

// Salva mídia com nome único no Storage e registra o gabarito separadamente.
// Mantém o mesmo comportamento do cadastro individual e dos lotes anteriores.
async function subir(tipo, arq) {
  const ext = arq.name.split('.').pop().toLowerCase();
  const path = `${tipo}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('midia').upload(path, arq, {
    contentType: arq.type || ({
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
