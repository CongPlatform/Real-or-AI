import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { criarItem } from '../lib/conteudosStorage';
import { analisarLoteAudioHumano, nomeAudioHumano } from '../lib/gruposAudio';

const LIMITE_PAGINA = 500;

async function carregarAudiosDoBanco() {
  const retorno = [];
  for (let inicio = 0; ; inicio += LIMITE_PAGINA) {
    const { data, error } = await supabase.from('conteudos')
      .select('id,titulo,grupo_audio,ativo,created_at').eq('tipo', 'audio')
      .is('comparacao_id', null).order('created_at', { ascending: true })
      .range(inicio, inicio + LIMITE_PAGINA - 1);
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error('Falha ao consultar grupos de áudio.');
    retorno.push(...data);
    if (data.length < LIMITE_PAGINA) break;
  }
  return retorno;
}

function nomeGrupo(n) { return `G${String(n).padStart(2, '0')}`; }

export default function ImportarAudiosHumanosPorGrupo({ recarregar }) {
  const [audios, setAudios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroConsulta, setErroConsulta] = useState('');
  const [atribuir, setAtribuir] = useState({});
  const [marcando, setMarcando] = useState(null);
  const [arquivos, setArquivos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroConsulta('');
    try { setAudios(await carregarAudiosDoBanco()); }
    catch (e) { setErroConsulta(`${e.message}. Confira se executou o SQL PATCH_V16_3_GRUPOS_AUDIO_HUMANOS.sql.`); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const grupos = useMemo(() => [...new Set(audios.map(a => a.grupo_audio).filter(n => Number.isInteger(n) && n > 0))].sort((a,b) => a-b), [audios]);
  const semGrupo = useMemo(() => audios.filter(a => a.grupo_audio === null), [audios]);
  const analise = useMemo(() => analisarLoteAudioHumano(arquivos.map(a => a.arquivo), grupos), [arquivos, grupos]);
  const completos = arquivos.filter(a => a.status === 'sucesso').length;
  const pendentes = arquivos.filter(a => a.status !== 'sucesso');
  const podeEnviar = !carregando && !erroConsulta && !enviando && !!arquivos.length && !analise.erros.length && pendentes.length > 0;

  async function vincularGrupo(audio) {
    const numero = Number(atribuir[audio.id] ?? audio.grupo_audio ?? '');
    if (!Number.isInteger(numero) || numero < 1 || numero > 9999) {
      setAviso('Informe um número de grupo entre 1 e 9999.'); return;
    }
    setMarcando(audio.id); setAviso('');
    try {
      const { error } = await supabase.from('conteudos').update({ grupo_audio: numero })
        .eq('id', audio.id).eq('tipo', 'audio').is('comparacao_id', null);
      if (error) throw error;
      await carregar();
      setAviso(`Áudio “${audio.titulo || audio.id}” associado ao grupo ${nomeGrupo(numero)}. Nenhum arquivo foi substituído.`);
      setAtribuir(atual => { const proximo = { ...atual }; delete proximo[audio.id]; return proximo; });
      if (recarregar) await recarregar();
    } catch (e) { setAviso(`Falha ao associar áudio: ${e.message}`); }
    finally { setMarcando(null); }
  }

  function selecionar(e) {
    const selecionados = Array.from(e.target.files || []);
    e.target.value = '';
    setArquivos(selecionados.map((arquivo, i) => ({ id: `${arquivo.name}-${i}`, arquivo, status: 'pendente', erro: '' })));
    setAviso('');
  }

  async function importar() {
    if (!podeEnviar) return;
    setEnviando(true); setAviso('');
    let sucessos = 0, falhas = 0;
    try {
      for (const item of pendentes) {
        const ficha = analise.itens.find(a => a.arquivo === item.arquivo);
        if (!ficha) continue;
        setArquivos(ant => ant.map(x => x.id === item.id ? { ...x, status: 'enviando', erro: '' } : x));
        try {
          // Bloqueia reenvio acidental do mesmo título em uma sessão posterior.
          const { data: repetidos, error: erroBusca } = await supabase.from('conteudos')
            .select('id').eq('tipo', 'audio').is('comparacao_id', null)
            .eq('titulo', ficha.titulo).limit(1);
          if (erroBusca) throw erroBusca;
          if (repetidos?.length) throw new Error(`O áudio “${ficha.titulo}” já foi cadastrado. Para adicionar outra gravação, use ${nomeGrupo(ficha.grupo)}_HUMANO_02.mp3 (ou outro número ainda não usado).`);
          await criarItem('audio', { arq: ficha.arquivo, ia: false }, ficha.titulo,
            { grupo_audio: ficha.grupo });
          setArquivos(ant => ant.map(x => x.id === item.id ? { ...x, status: 'sucesso', erro: '' } : x));
          sucessos++;
        } catch (e) {
          falhas++;
          setArquivos(ant => ant.map(x => x.id === item.id ? { ...x, status: 'erro', erro: e?.message || 'Falha no cadastro' } : x));
        }
      }
      setAviso(`${sucessos} áudio(s) humano(s) adicionado(s) aos grupos.` + (falhas ? ` ${falhas} falha(s); somente os arquivos com erro podem ser reenviados.` : ' Os áudios anteriores foram preservados.'));
      if (sucessos) { await carregar(); if (recarregar) await recarregar(); }
    } finally { setEnviando(false); }
  }

  return <section className="painel larga importacao-grupos-audio">
    <h2>Adicionar 1 áudio humano a cada grupo</h2>
    <p className="mut">Importa somente áudios <strong>individuais</strong>. O nome identifica o grupo e a classificação automaticamente; os novos arquivos são sempre marcados como <strong>Real (humano)</strong>. Nenhum áudio anterior é apagado ou substituído.</p>
    <button type="button" className="chip" disabled={carregando || enviando || !!marcando} onClick={carregar}>{carregando ? 'Consultando grupos…' : 'Atualizar grupos do banco'}</button>
    {erroConsulta && <p role="alert" className="erro">Não foi possível ler os grupos. {erroConsulta}</p>}
    {!carregando && !erroConsulta && <>
      <p className="mut" role="status">{audios.length} áudios individuais encontrados; <strong>{grupos.length} grupos cadastrados</strong>; {semGrupo.length} áudio(s) ainda sem grupo.</p>
      {grupos.length > 0 ? <details open className="lote-detalhes"><summary>Nome exato de cada arquivo (1 por grupo)</summary>
        <div className="nomes-audio-grupo">{grupos.map(g => <code key={g}>{nomeAudioHumano(g)}</code>)}</div>
        <p className="mut">Também aceita WAV, OGG e M4A. Se <code>G01_HUMANO</code> já estiver cadastrado, use <code>G01_HUMANO_02.mp3</code>, mantendo o mesmo número do grupo.</p>
      </details> : <p className="aviso">Ainda não há grupos de áudio cadastrados. Associe os áudios existentes abaixo antes de selecionar o novo lote. Este patch não presume quantos grupos existem.</p>}
      {!!audios.length && <details className="lote-detalhes" open={!grupos.length}>
        <summary>Revisar/associar áudios existentes aos grupos ({semGrupo.length} sem grupo)</summary>
        <p className="mut">O banco antigo não armazenava grupos. Informe ou corrija o número do grupo de cada áudio já existente. A associação não modifica o arquivo nem o gabarito.</p>
        <div className="lote-lista">
          {audios.map(a => <div className="lote-item audio-grupo-vinculo" key={a.id}>
            <span title={a.titulo}>{a.titulo || a.id}</span>
            <label className="lote-nome"><span>Grupo existente deste áudio</span>
              <input type="number" min="1" max="9999" step="1" placeholder="Ex.: 1" value={atribuir[a.id] ?? a.grupo_audio ?? ''}
                disabled={marcando !== null || enviando}
                onChange={e => setAtribuir(p => ({ ...p, [a.id]: e.target.value }))}/>
            </label>
            <button type="button" className="chip" disabled={marcando !== null || enviando || !(atribuir[a.id] ?? a.grupo_audio)}
              onClick={() => vincularGrupo(a)}>{marcando === a.id ? 'Associando…' : 'Associar'}</button>
          </div>)}
        </div>
      </details>}
      <label className="lote-nome"><span>Selecione todos os áudios humanos de uma vez, um por grupo</span>
        <input type="file" multiple accept=".mp3,.wav,.ogg,.m4a,audio/*" disabled={enviando || !!marcando || !grupos.length}
          aria-label="Selecionar um áudio humano para cada grupo" onChange={selecionar}/>
      </label>
      {!!arquivos.length && <>
        <p className="mut">{completos} de {arquivos.length} enviados neste lote. Grupos reconhecidos: {analise.itens.map(a => nomeGrupo(a.grupo)).join(', ') || 'nenhum'}.</p>
        {!!analise.erros.length && <div className="lote-erros" role="alert"><b>Corrija os nomes ou a quantidade de arquivos:</b><ul>{analise.erros.map((e,i) => <li key={i}>{e}</li>)}</ul></div>}
        <div className="lote-lista">{arquivos.map(a => <div className="lote-item" key={a.id}>
          <div className="lote-item-topo"><b>{a.arquivo.name}</b><span className={'lote-status '+a.status}>{a.status === 'sucesso' ? 'Cadastrado' : a.status === 'enviando' ? 'Enviando…' : a.status === 'erro' ? 'Falhou' : 'Pendente'}</span></div>
          {a.erro && <p className="erro">{a.erro}</p>}
        </div>)}</div>
        <button className="cta" type="button" disabled={!podeEnviar} onClick={importar}>{enviando ? 'Enviando áudios…' : `Adicionar ${pendentes.length} áudio(s) humanos aos grupos`}</button>
        <button type="button" className="link" disabled={enviando} onClick={() => { setArquivos([]); setAviso(''); }}>Limpar seleção</button>
      </>}
    </>}
    {aviso && <p className="mut" role="status">{aviso}</p>}
  </section>;
}
