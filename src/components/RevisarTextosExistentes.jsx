import { useState } from 'react';
import { supabase } from '../lib/supabase';

// Indicativo, não correção automática: poemas e canções podem não ter pontuação final.
function revisarFim(texto) {
  const valor = (texto || '').trim();
  return valor.length > 0 && !/[.!?…»”’]$/.test(valor);
}

// Administração: permite conferir o texto COMPLETO que está salvo, sem truncá-lo ou
// inventar palavras para preencher trechos históricos que já vieram incompletos.
export default function RevisarTextosExistentes({ recarregar }) {
  const [itens, setItens] = useState(null);
  const [alteracoes, setAlteracoes] = useState({});
  const [abrirTodos, setAbrirTodos] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(null);
  const [mensagem, setMensagem] = useState('');

  async function buscar() {
    setCarregando(true);setMensagem('');
    const { data, error } = await supabase.from('conteudos')
      .select('id,titulo,texto').eq('tipo', 'texto').order('created_at', { ascending: true });
    setCarregando(false);
    if (error) return setMensagem(error.message);
    setItens(data || []);
    setAlteracoes({});
  }

  async function salvar(item) {
    const valor = alteracoes[item.id];
    if (typeof valor !== 'string' || !valor.trim()) return;
    if (!window.confirm('Salvar o texto revisado? Confira se ele corresponde à fonte original.')) return;
    setSalvando(item.id);setMensagem('');
    const { error } = await supabase.from('conteudos').update({ texto: valor.trim() }).eq('id', item.id);
    setSalvando(null);
    if (error) return setMensagem(error.message);
    setItens((antigos) => antigos.map((t) => t.id === item.id ? { ...t, texto: valor.trim() } : t));
    setAlteracoes((antigas) => { const novo = { ...antigas }; delete novo[item.id]; return novo; });
    setMensagem('Texto atualizado com sucesso.');
    recarregar?.();
  }

  const pendentes = itens?.filter((item) => revisarFim(item.texto)) || [];
  const visiveis = abrirTodos ? (itens || []) : pendentes;

  return <section className="painel larga revisao-textos">
    <h2>Conferir textos já cadastrados</h2>
    <p className="mut">O teste agora mostra o texto completo, incluindo quebras de linha. Alguns trechos podem, porém, já ter sido importados incompletos. Confira aqui o que realmente está no banco e edite apenas depois de consultar a fonte original.</p>
    <div className="revisao-textos-acoes">
      <button className="chip" type="button" disabled={carregando} onClick={buscar}>{carregando ? 'Carregando…' : itens ? 'Atualizar lista' : 'Verificar textos salvos'}</button>
      {itens && <label><input type="checkbox" checked={abrirTodos} onChange={(e) => setAbrirTodos(e.target.checked)} /> Mostrar todos ({itens.length})</label>}
    </div>
    {itens && <p className="mut">{pendentes.length} de {itens.length} textos sinalizados para conferência por não terminarem com pontuação conclusiva. Poemas e letras de música podem ser sinalizados mesmo estando completos.</p>}
    {mensagem && <p role="status" className="mut">{mensagem}</p>}
    <div className="revisao-textos-lista">
      {visiveis.map((item) => {
        const valor = alteracoes[item.id] ?? item.texto ?? '';
        const modificado = valor !== (item.texto || '');
        return <details className="revisao-texto-item" key={item.id}>
          <summary>{item.titulo || 'Texto sem título'}{revisarFim(item.texto) ? ' · conferir final' : ''}</summary>
          <label className="lote-nome">Texto completo no Supabase
            <textarea rows="6" value={valor} onChange={(e) => setAlteracoes((d) => ({ ...d, [item.id]: e.target.value }))}/>
          </label>
          <button className="chip" type="button" onClick={() => salvar(item)} disabled={!modificado || salvando === item.id || !valor.trim()}>{salvando === item.id ? 'Salvando…' : 'Salvar revisão'}</button>
        </details>;
      })}
    </div>
  </section>;
}
