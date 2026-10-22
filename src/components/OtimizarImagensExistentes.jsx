import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const bucket = supabase.storage.from('midia');
const PREFIXO = bucket.getPublicUrl('imagem/').data.publicUrl;

async function converterImagem(antiga) {
  const resposta = await fetch(antiga, { mode: 'cors', cache: 'default' });
  if (!resposta.ok) throw new Error(`Não foi possível baixar a imagem (HTTP ${resposta.status}).`);
  const original = await resposta.blob();
  if (!original.type.startsWith('image/')) throw new Error('O endereço não retornou uma imagem.');
  const bitmap = await createImageBitmap(original);
  try {
    const escala = Math.min(1, 1200 / bitmap.width, 900 / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    canvas.getContext('2d', { alpha: true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const otimizacao = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.77));
    if (!otimizacao || otimizacao.type !== 'image/webp') throw new Error('O navegador não conseguiu produzir WebP.');
    return { antes: original.size, depois: otimizacao.size, arquivo: otimizacao };
  } finally { bitmap.close?.(); }
}

export default function OtimizarImagensExistentes({ recarregar }) {
  const [lista, setLista] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [situacao, setSituacao] = useState('');
  const [erros, setErros] = useState([]);
  const [total, setTotal] = useState(0);
  const [processados, setProcessados] = useState(0);
  const pararRef = useRef(false);

  async function buscar() {
    setOcupado(true); setErros([]); setSituacao('Consultando o cadastro…');
    try {
      const { data, error } = await supabase.from('conteudos').select('id, titulo, url')
        .eq('tipo', 'imagem').not('url', 'is', null).order('created_at', { ascending: true });
      if (error) throw error;
      const candidatos = (data || []).filter((c) => c.url && c.url.startsWith(PREFIXO) && /\.(?:png|jpe?g)(?:\?|$)/i.test(c.url));
      setLista(candidatos);
      setSituacao(`${candidatos.length} imagens antigas em formatos que podem ser otimizados.`);
    } catch (e) { setSituacao(`Erro ao consultar: ${e.message}`); }
    finally { setOcupado(false); }
  }

  async function otimizar() {
    if (!lista?.length) return;
    if (!confirm('Otimizar as imagens antigas? O cadastro e o gabarito serão preservados. Os arquivos originais NÃO serão apagados.')) return;
    setOcupado(true); pararRef.current = false; setErros([]);
    setTotal(lista.length); setProcessados(0);
    let otimizadas = 0, ignoradas = 0, economizados = 0;
    const falhas = [];
    const restantes = [];
    for (let indice = 0; indice < lista.length; indice++) {
      const item = lista[indice];
      if (pararRef.current) { restantes.push(...lista.slice(indice)); break; }
      setSituacao(`Otimizando ${indice + 1} de ${lista.length}: ${item.titulo || 'Imagem sem nome'}`);
      let novoCaminho = null;
      try {
        const { antes, depois, arquivo } = await converterImagem(item.url);
        if (depois >= antes * 0.93) {
          ignoradas++; // Conservar original se não houver ganho real de tamanho.
        } else {
          novoCaminho = `imagem/otimizadas/${crypto.randomUUID()}.webp`;
          const { error: uploadErro } = await bucket.upload(novoCaminho, arquivo,
            { cacheControl: '31536000', contentType: 'image/webp' });
          if (uploadErro) throw uploadErro;
          const novaUrl = bucket.getPublicUrl(novoCaminho).data.publicUrl;
          const { data: atualizado, error: bancoErro } = await supabase.from('conteudos')
            .update({ url: novaUrl }).eq('id', item.id).eq('url', item.url).select('id');
          if (bancoErro || !atualizado?.length) throw bancoErro || new Error('O cadastro foi alterado durante a otimização.');
          novoCaminho = null; // A imagem nova já pertence ao cadastro.
          otimizadas++;
          economizados += antes - depois;
        }
      } catch (e) {
        falhas.push(`${item.titulo || item.id}: ${e.message || 'falha desconhecida'}`);
        restantes.push(item);
        // Nunca deixe arquivos novos órfãos se a atualização do cadastro falhar.
        if (novoCaminho) await bucket.remove([novoCaminho]);
      }
      setProcessados(indice + 1);
    }
    setErros(falhas);
    setLista(restantes);
    setSituacao(`${otimizadas} imagem(ns) otimizada(s), ${ignoradas} já eficiente(s), ${falhas.length} falha(s). ` +
      `Economia aproximada: ${(economizados / 1024 / 1024).toFixed(2)} MB. ` +
      (pararRef.current ? 'Interrompido por solicitação.' : 'Concluído.'));
    setOcupado(false);
    if (otimizadas) recarregar();
  }

  return <section className="painel larga">
    <h2>Otimizar imagens já cadastradas</h2>
    <p className="mut">Reduz imagens antigas para no máximo 1200 × 900 px, mantendo a proporção e o cadastro original. Cria versões WebP leves e altera apenas o endereço da imagem. O gabarito, os títulos, as respostas e os arquivos originais permanecem intactos.</p>
    <p className="mut">Execute uma vez antes de aplicar a pesquisa de verdade. É necessário manter esta página aberta até concluir. Se uma imagem externa ou com restrição de leitura falhar, ela não será modificada.</p>
    <div className="otimizacao-acoes">
      <button type="button" className="chip" onClick={buscar} disabled={ocupado}>Buscar imagens antigas</button>
      <button type="button" className="cta" onClick={otimizar} disabled={ocupado || !lista?.length}>
        Otimizar {lista?.length || 0} imagens
      </button>
      {ocupado && <button type="button" className="chip" onClick={() => { pararRef.current = true; }}>
        Parar depois desta imagem
      </button>}
    </div>
    {ocupado && total > 0 && <progress max={total} value={processados} style={{ width: '100%' }} />}
    {situacao && <p className="mut" role="status">{situacao}</p>}
    {erros.length > 0 && <details><summary>{erros.length} erro(s) — ver detalhes</summary>
      <ul>{erros.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </details>}
  </section>;
}
