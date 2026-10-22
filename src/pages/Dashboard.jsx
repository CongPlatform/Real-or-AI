import { useMemo, useState } from 'react';
import { BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import { analisarAvancado, ENQUADRAMENTOS, TIPOS_ANALISE } from '../lib/analiseAvancada';
import { supabase } from '../lib/supabase';

const META=100;
const fmt=(x,n=1)=>Number.isFinite(Number(x))&&x!==null&&x!==''?Number(x).toFixed(n).replace('.',','):'—';
const pc=(x)=>x==null?'—':`${fmt(x)}%`;
const intervalo=(a)=>a?`${fmt(a[0])}–${fmt(a[1])}%`:'—';
function downloadCsv(nome, colunas, rows){
  const proteger=v=>{
    if(v==null)return '';
    let s=String(v);
    // Impede interpretações de fórmulas quando aberto em planilhas.
    if(/^[\s]*[=+@\-]/.test(s))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  };
  const linhas=[colunas.map(x=>x[1]),...rows.map(r=>colunas.map(([chave])=>r[chave]))];
  const csv='\ufeff'+linhas.map(l=>l.map(proteger).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=nome;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function Distribuicao({ dados, campo='acerto', nome='nome', limite=100, title='Acertos (%)' }) {
  if(!dados.some(x=>x[campo]!=null)) return <p className="mut">Sem dados válidos para este gráfico.</p>;
  return <ResponsiveContainer width="100%" height={260}>
    <BarChart data={dados.filter(r=>r[campo]!=null)} margin={{top:16,right:14,bottom:15,left:-9}}>
      <CartesianGrid strokeDasharray="3 3" vertical={false}/>
      <XAxis dataKey={nome} tick={{fontSize:11}} interval={0} height={35}/>
      <YAxis domain={[0,limite]} tick={{fontSize:11}} unit={limite===100?'%':''}/>
      <Tooltip formatter={v=>[limite===100?pc(v):fmt(v,0),title]}/>
      <Bar dataKey={campo} fill="#6345e9" radius={[7,7,0,0]} maxBarSize={70}/>
    </BarChart>
  </ResponsiveContainer>;
}
function Kpi({valor, rotulo, detalhe}) { return <div className="kpi-v4"><strong>{valor}</strong><span>{rotulo}</span>{detalhe&&<small>{detalhe}</small>}</div>; }
function Painel({titulo,descricao,children}) {return <section className="painel"><h2>{titulo}</h2>{descricao&&<p className="mut">{descricao}</p>}{children}</section>;}
export default function Dashboard({ dados, atual, avancado, atualizar }) {
  const [incluirPilotos,setIncluirPilotos]=useState(false);
  const [mudando,setMudando]=useState('');
  const [erro,setErro]=useState('');
  const dadosNovos=useMemo(()=>analisarAvancado(avancado,incluirPilotos),[avancado,incluirPilotos]);
  const d=dadosNovos;
  async function piloto(p){
    setMudando(p.id);setErro('');
    try {
      const {error}=await supabase.rpc('admin_classificar_piloto_v4',{
        p_participante:p.id,p_excluir:!p.excluir_analise,
      });
      if(error)throw error;
      await atualizar?.();
    }catch(e){setErro(e.message||'Falha ao alterar a sessão.');}
    finally{setMudando('');}
  }
  const progress=Math.min(100,100*d.coleta.validas/META);
  const q=d.quad;
  const exatas=q.vv+q.vf, reais=q.ff+q.fv;
  const participantesCSV=d.pessoas.map(p=>({
    id:p.id,faixa:p.faixa,genero:p.genero,escolaridade:p.escolaridade,frequencia:p.freq,
    confianca:p.confianca,estimativa:p.estimativa,n_individuais:p.n_ind,acertos_individuais:p.acertos,
    percentual_individual:p.pct_ind,n_comparacoes:p.n_comp,acertos_comparacoes:p.acertosPares,
    percentual_comparacoes:p.pct_comp,tempo_mediano_s:p.tempo_med_s,
  }));
  const individuaisCSV=d.ri.map(r=>({
    participante:r.participante_id,conteudo:r.conteudo_id,tipo:r.tipo,
    enquadramento:r.enquadramento,origem_ia:r.origem_ia,resposta_ia:r.resposta_ia,
    acertou:r.acertou,tempo_ms:r.tempo_ms,segundos_reproduzidos:r.segundos_reproduzidos,
    pedidos_mais:r.pedidos_mais,duracao_audio_s:r.duracao_audio_s,
    trecho_liberado_s:r.trecho_liberado_s,repeticoes_audio:r.repeticoes_audio,
    data:r.data,ordem:r.ordem,
  }));
  const compsCSV=d.rc.map(r=>({participante:r.participante_id,comparacao:r.comparacao_id,
    tipo:r.tipo,enquadramento:r.enquadramento,acertou:r.acertou,
    acertos_itens:r.acertos_itens,n_itens:r.n_itens,n_reais_ia:r.n_reais_ia,
    n_marcados_ia:r.n_marcados_ia,tempo_ms:r.tempo_ms,data:r.data}));
  const resultadoDia=d.coleta.porDia.map(x=>({...x,nome:x.nome.slice(5)}));
  return <div className="dash dash-v4">
    <div className="barra-meta">
      <div className="meta-txt"><b>Pesquisa REAL OU IA?</b> · Painel estatístico v4
        <span className="mut"> Atualizado {atual?.toLocaleString('pt-BR')||'—'}</span></div>
      <div className="barra"><i style={{width:`${progress}%`}}/></div>
      <div className="mut">Meta: {d.coleta.validas} de {META} sessões válidas (30 decisões completas).</div>
    </div>
    <div className="auditoria-filtros">
      <label><input type="checkbox" checked={incluirPilotos} onChange={e=>setIncluirPilotos(e.target.checked)}/> Incluir sessões marcadas como piloto nos cálculos</label>
      <small>Os dados originais não são apagados; os indicadores principais excluem, por padrão, sessões incompletas, versões antigas e pilotos.</small>
    </div>
    {erro&&<p role="alert" className="erro">{erro}</p>}
    <div className="kpis">
      <Kpi valor={String(d.coleta.validas)} rotulo="Sessões válidas" detalhe={`${d.coleta.finalizadas} finalizadas no total`}/>
      <Kpi valor={pc(d.notas.media)} rotulo="Acerto individual médio" detalhe={`${d.notas.n} participantes`}/>
      <Kpi valor={intervalo(d.notas.ic)} rotulo="IC 95% da média" detalhe="Unidade: pessoa, não clique"/>
      <Kpi valor={String(d.coleta.volume)} rotulo="Respostas analisadas" detalhe="Individuais + comparações"/>
    </div>
    <Painel titulo="Qualidade da coleta" descricao="Verificação automática antes de interpretar os resultados. As sessões continuam disponíveis para auditoria.">
      <div className="auditoria-grid">
        <div><strong>{d.coleta.total}</strong><span>iniciadas</span></div>
        <div><strong>{d.coleta.finalizadas}</strong><span>finalizadas</span></div>
        <div><strong>{d.coleta.incompletas}</strong><span>abandonadas/em andamento</span></div>
        <div><strong>{d.coleta.foraProtocolo}</strong><span>fora do protocolo de 30</span></div>
        <div><strong>{d.coleta.pilotos}</strong><span>marcadas como piloto</span></div>
        <div><strong>{d.coleta.validas}</strong><span>incluídas na análise</span></div>
      </div>
      {d.coleta.validas<20&&<p className="aviso">Amostra pequena. Não interprete diferenças entre grupos como conclusões definitivas. Os intervalos são apenas indicativos.</p>}
      {d.coleta.incompletas>0&&<p className="mut">Taxa de conclusão (todas as versões): {pc(100*d.coleta.finalizadas/Math.max(1,d.coleta.total))}.</p>}
      <h3>Inícios e conclusões por dia</h3>
      <Distribuicao dados={resultadoDia} campo="iniciadas" limite={Math.max(1,...resultadoDia.map(x=>x.iniciadas))} title="Sessões iniciadas"/>
    </Painel>
    {d.coleta.validas>0&&<>
      <div className="grade">
        <Painel titulo="Acertos por modalidade" descricao="Cada participante tem o mesmo peso dentro de cada grupo. Exibições por formato são diferentes.">
          <Distribuicao dados={d.tipo}/>
          <div className="rolagem"><table><thead><tr><th>Modalidade</th><th>Respostas</th><th>Pessoas</th><th>Média</th><th>IC 95%</th><th>Tempo mediano</th></tr></thead>
            <tbody>{d.tipo.map(r=><tr key={r.tipo}><td>{r.nome}</td><td>{r.n}</td><td>{r.participantes}</td>
              <td>{pc(r.acerto)}</td><td>{intervalo(r.ic)}</td><td>{fmt(r.tempo_med_s)}s</td></tr>)}</tbody></table></div>
        </Painel>
        <Painel titulo="Distribuição IA / humana" descricao="Mostra a origem correta dos conteúdos efetivamente sorteados; não é a quantidade total cadastrada.">
          <Distribuicao dados={[{nome:'IA',n:d.composicao.IA},{nome:'Humano',n:d.composicao.real}]} campo="n"
            limite={Math.max(1,d.composicao.IA,d.composicao.real)} title="Respostas"/>
          <p className="mut">{d.composicao.IA} questões de origem IA e {d.composicao.real} de origem humana.</p>
        </Painel>
      </div>
      <Painel titulo="Matriz de confusão — classificações individuais" descricao="Diferencia falsas acusações de IA e imagens/áudios artificiais considerados humanos. Contagens por resposta; a inferência deve usar pessoas.">
        <div className="rolagem"><table className="conf"><thead><tr><th>Origem verdadeira</th><th>Participante respondeu IA</th><th>Participante respondeu humano</th></tr></thead>
          <tbody><tr><th>IA</th><td className="ok">{q.vv}</td><td>{q.vf}</td></tr><tr><th>Humano</th><td>{q.fv}</td><td className="ok">{q.ff}</td></tr></tbody></table></div>
        <p className="mut">Sensibilidade para IA: {pc(exatas?100*q.vv/exatas:null)} · Reconhecimento de humano: {pc(reais?100*q.ff/reais:null)} · Taxa de chamar algo de IA: {pc(d.ri.length?100*(q.vv+q.fv)/d.ri.length:null)}.</p>
      </Painel>
      <Painel titulo="A formulação da pergunta muda o resultado?" descricao="Comparação exploratória das formulações. A distribuição por conteúdo e posição também pode influenciar; não prova causalidade.">
        <Distribuicao dados={d.porFrame}/>
        <div className="rolagem"><table><thead><tr><th>Pergunta</th><th>Respostas</th><th>Pessoas</th><th>Média individual</th><th>IC 95%</th><th>Chamou de IA</th><th>Tempo mediano</th></tr></thead>
          <tbody>{d.porFrame.map(r=><tr key={r.chave}><td>{r.nome}</td><td>{r.n}</td><td>{r.participantes}</td><td>{pc(r.acerto)}</td><td>{intervalo(r.ic)}</td><td>{pc(r.disseIa)}</td><td>{fmt(r.tempoMed)}s</td></tr>)}</tbody></table></div>
        <h3>Formulação dentro de cada modalidade</h3>
        <div className="rolagem"><table><thead><tr><th>Formato</th><th>Enquadramento</th><th>Respostas</th><th>Pessoas</th><th>Média de acertos</th><th>Marcou IA</th></tr></thead>
          <tbody>{d.fTipo.map(r=><tr key={`${r.tipo}-${r.frame}`}><td>{r.nome}</td><td>{ENQUADRAMENTOS[r.frame]}</td><td>{r.n}</td><td>{r.pessoas}</td><td>{pc(r.acerto)}</td><td>{pc(r.disseIA)}</td></tr>)}</tbody></table></div>
      </Painel>
      <div className="grade">
        <Painel titulo="Comparações (duas peças)" descricao="Não misturar acerto exato da dupla (25% de chance sob chute uniforme) com acerto por peça (50%).">
          <div className="auditoria-grid"><div><strong>{pc(d.comparacaoExata.media)}</strong><span>dupla inteiramente correta</span></div><div><strong>{pc(d.comparacaoItens.media)}</strong><span>acerto por peça</span></div></div>
          <div className="rolagem"><table><thead><tr><th>Formulação</th><th>Rodadas</th><th>Média exata</th></tr></thead>
            <tbody>{d.porFrameComp.map(r=><tr key={r.chave}><td>{r.nome}</td><td>{r.n}</td><td>{pc(r.acerto)}</td></tr>)}</tbody></table></div>
        </Painel>
        <Painel titulo="Confiança × desempenho" descricao="Estimativa de acertos após o teste, comparada apenas com decisões individuais.">
          <div className="auditoria-grid"><div><strong>{pc(d.viesConfianca.media)}</strong><span>viés médio da estimativa</span></div><div><strong>{d.viesConfianca.n}</strong><span>participantes com estimativa</span></div></div>
          <p className="mut">Viés positivo significa superestimar o desempenho. Viés negativo significa subestimar. Valores obtidos por participante.</p>
        </Painel>
      </div>
      <Painel titulo="Escuta progressiva de áudios" descricao="Trecho liberado ≠ segundos realmente escutados (repetições podem aumentar o total). A decisão de ouvir mais é do participante; não estabelece efeito causal.">
        <div className="auditoria-grid">
          <div><strong>{d.audio.medidos}/{d.audio.n}</strong><span>áudios com telemetria completa</span></div>
          <div><strong>{fmt(d.audio.ouvidoMed)} s</strong><span>reprodução mediana</span></div>
          <div><strong>{fmt(d.audio.fraçãoMed)}%</strong><span>porção mediana liberada</span></div>
          <div><strong>{fmt(d.audio.maisMed)}</strong><span>pedidos de mais (média)</span></div>
          <div><strong>{fmt(d.audio.repeticoesMed)}</strong><span>reinícios (média)</span></div>
        </div>
        <h3>Respostas por quantidade de solicitações de mais áudio</h3>
        <div className="rolagem"><table><thead><tr><th>Pedidos de mais</th><th>Respostas</th><th>Acertos</th></tr></thead>
          <tbody>{d.audio.etapas.map(t=><tr key={t.nome}><td>{t.nome}</td><td>{t.n}</td><td>{pc(t.acerto)}</td></tr>)}</tbody></table></div>
      </Painel>
      <Painel titulo="Conteúdos que mais confundem" descricao="Apenas itens individuais exibidos ao menos cinco vezes. Com poucos participantes, o ranking ainda é instável.">
        <div className="rolagem"><table><thead><tr><th>Conteúdo (somente admin)</th><th>Formato</th><th>Origem</th><th>Exibições válidas</th><th>Acertos</th><th>Chamou de IA</th></tr></thead>
          <tbody>{d.difficult.slice(0,20).map(r=><tr key={r.id}><td>{r.nome||r.id.slice(0,8)}</td><td>{TIPOS_ANALISE[r.tipo]||r.tipo}</td>
            <td>{r.origem_ia?'IA':'Humano'}</td><td>{r.n_exibicoes}</td><td>{pc(r.pct_acerto)}</td><td>{pc(r.marca_ia)}</td></tr>)}</tbody></table></div>
        {!d.difficult.length&&<p className="mut">Ainda não há itens com cinco exposições válidas.</p>}
      </Painel>
    </>}
    <Painel titulo="Exportação e auditoria das sessões" descricao="Exportações usam somente participantes incluídos no filtro acima. Os identificadores são técnicos; não publique arquivos brutos com dados de participantes.">
      <div className="acoes exportacoes-v4">
        <button className="cta" onClick={()=>downloadCsv('participantes_analise.csv',[
          ['id','ID'],['faixa','Faixa etária'],['genero','Gênero'],['escolaridade','Escolaridade'],['frequencia','Frequência de IA'],
          ['confianca','Confiança (1-5)'],['estimativa','Estimativa (acertos)'],['n_individuais','Individuais'],['acertos_individuais','Acertos individuais'],
          ['percentual_individual','Percentual individual'],['n_comparacoes','Comparações'],['acertos_comparacoes','Acertos exatos de comparação'],
          ['percentual_comparacoes','Percentual comparação'],['tempo_mediano_s','Tempo mediano (s)']
        ],participantesCSV)}>CSV participantes</button>
        <button className="cta" onClick={()=>downloadCsv('respostas_individuais.csv',Object.keys(individuaisCSV[0]||{participante:1}).map(k=>[k,k]),individuaisCSV)}>CSV decisões individuais</button>
        <button className="cta" onClick={()=>downloadCsv('respostas_comparacoes.csv',Object.keys(compsCSV[0]||{participante:1}).map(k=>[k,k]),compsCSV)}>CSV comparações</button>
        <button className="cta" onClick={()=>downloadCsv('desempenho_itens.csv',[
          ['id','ID conteúdo'],['nome','Título interno'],['tipo','Tipo'],['origem_ia','Origem IA'],['n_exibicoes','Exibições válidas'],
          ['acertos','Acertos'],['pct_acerto','Acertos (%)'],['marca_ia','Marcado IA (%)'],['mediana_tempo','Tempo mediano (s)']
        ],d.exportItens)}>CSV conteúdos</button>
      </div>
      <h3>Identificação de sessões piloto</h3>
      <p className="mut">Marque testes feitos pela equipe para não entrarem nas estatísticas oficiais. Sessões não são apagadas; para voltar a incluí-las, desmarque piloto.</p>
      <div className="rolagem"><table><thead><tr><th>Identificador</th><th>Iniciada em</th><th>Decisões</th><th>Finalizada?</th><th>Origem</th><th>Ação</th></tr></thead>
        <tbody>{[...d.sessoes].reverse().slice(0,120).map(p=><tr key={p.id}>
          <td title={p.id}>{String(p.id).slice(0,8)}…</td>
          <td>{p.inicio?new Date(p.inicio).toLocaleString('pt-BR'):'—'}</td>
          <td>{(p.individuais_respondidas||0)+(p.comparacoes_respondidas||0)}/{p.sorteadas||'?'}</td>
          <td>{p.finalizado?'Sim':'Não'}</td><td>{p.excluir_analise?'Piloto':'Pesquisa'}</td>
          <td><button className="link" disabled={mudando===p.id} onClick={()=>piloto(p)}>{p.excluir_analise?'Reincluir':'Marcar piloto'}</button></td>
        </tr>)}</tbody></table></div>
      {d.sessoes.length>120&&<p className="mut">Exibindo as 120 sessões mais recentes; os cálculos usam todas as sessões elegíveis.</p>}
    </Painel>
    <p className="mut metodo-v4">**Nota metodológica:** médias e ICs descritivos usam o participante como unidade. Em grupos com n=1 não há IC. Não tratar cliques como observações independentes. Diferenças por faixa etária, formulação e conteúdo são exploratórias; resultados com muitos testes exigem cautela.</p>
  </div>;
}
