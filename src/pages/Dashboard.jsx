import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList,
  Legend, Line, LineChart, Pie, PieChart, Radar, RadarChart,
  PolarGrid, PolarAngleAxis, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis
} from 'recharts';
import { analisarAvancado, ENQUADRAMENTOS, TIPOS_ANALISE, resumoParticipantes } from '../lib/analiseAvancada';
import { criarEvolucao, contarDistribuicao, PREVISAO_INICIAL, FORCA_INICIAL } from '../lib/previsaoPesquisa';
import { supabase } from '../lib/supabase';
import RankingMateriais from '../components/RankingMateriais';

const META=100;
const p100=v=>v == null || !Number.isFinite(Number(v)) ? '—' : `${Number(v).toFixed(1).replace('.',',')}%`;
const nfmt=(v,dec=1)=>v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(dec).replace('.',',');
const ci=arr=>arr && arr.length===2 ? `${p100(arr[0])} a ${p100(arr[1])}` : 'Indisponível';
const COLORS=['#5B3DF5','#C6F432','#FFC247','#FF7D86','#36B9AE','#A1A1D5'];
const BASE_GRID={stroke:'#E6E2F0',strokeDasharray:'4 4'};
const hoverStyle={border:'2px solid #14122B',borderRadius:10,background:'#fff',fontSize:13};
const NAMES={ IA:'IA', real:'Humano' };
const TABS=[
  ['visao','Visão geral'],['diagnostico','IA × humano'],['formatos','Formatos e perguntas'],
  ['comportamento','Escuta e confiança'],['projecao','Evolução e projeção'],
  ['materiais','Análise por conteúdo'],['calculos','Como calculamos'],['auditoria','Tabelas e auditoria']
];
function Painel({titulo,sub,children,wide=false}){
  return <section className={`painel v5-painel ${wide?'v5-wide':''}`}><div className="v5-painel-head"><h2>{titulo}</h2>{sub&&<p className="mut">{sub}</p>}</div>{children}</section>;
}
const GUIA_METRICAS = {
  'Sensibilidade para IA': 'Entre as peças realmente geradas por IA, qual porcentagem foi reconhecida corretamente? Quanto maior, melhor o reconhecimento de IA.',
  'Reconhecimento de humano': 'Entre os materiais de autoria humana, qual porcentagem foi identificada corretamente? Quanto maior, menos humanos foram confundidos com IA.',
  'Taxa de chamar algo de IA': 'Entre todas as respostas, quantas escolheram IA? Isso mede uma tendência de escolha e não é uma taxa de acertos.',
  'Taxa de conclusão': 'Porcentagem de sessões iniciadas que foram concluídas. Não mede habilidade em identificar IA.',
  'Acurácia individual média': 'Média das porcentagens de acerto das pessoas; cada participante contribui com uma nota.',
  'Média': 'Resultado obtido somando as notas dos participantes e dividindo pelo total de pessoas.',
  'Mediana': 'Nota que fica no centro quando ordenamos os resultados. Metade das notas está de cada lado.',
  'Mediana individual': 'Pontuação central entre os participantes, menos afetada por valores extremos do que a média.',
  'Desvio padrão amostral': 'Indica o quanto as notas variaram de pessoa para pessoa. Quanto maior, mais diferentes foram os resultados.',
  'Erro padrão': 'Medida da incerteza da média estimada, baseada no desvio padrão e no tamanho da amostra.',
  'Intervalo 95%': 'Faixa estimada para a média sob hipóteses estatísticas. Não significa que 95% dos participantes estão nessa faixa.',
  'Primeiro quartil (Q1)': 'Valor abaixo do qual está aproximadamente um quarto das notas individuais.',
  'Terceiro quartil (Q3)': 'Valor abaixo do qual está aproximadamente três quartos das notas individuais.',
  'Amplitude interquartil': 'Diferença entre Q3 e Q1: mostra a variação da metade central das notas.',
  'Coeficiente de variação': 'Compara o tamanho do desvio padrão com a média; avalia a dispersão relativa.',
  'Dupla totalmente correta': 'Porcentagem de comparações em que as duas peças foram classificadas corretamente.',
  'Acertos por peça': 'Porcentagem de peças classificadas corretamente dentro das comparações.',
  'Pedidos para ouvir mais': 'Quantas vezes os participantes solicitaram acesso a mais alguns segundos de áudio.',
  'Trecho mediano liberado': 'Ponto central da porcentagem de áudio disponibilizada aos participantes, não necessariamente ouvida.',
  'Escuta mediana': 'Tempo central efetivamente reproduzido nos áudios que possuem registro de escuta.',
  'Viés médio da estimativa': 'Diferença média entre o palpite inicial de desempenho e o resultado observado.',
  'Média observada da amostra': 'Média calculada somente com os participantes já concluídos, sem a hipótese inicial.',
  'Média observada atual': 'Média dos dados realmente coletados até o momento.',
  'Estimativa antes da próxima resposta': 'Previsão ilustrativa feita com as respostas existentes e uma hipótese inicial.',
  'Estimativa ajustada após as respostas': 'Projeção descritiva atualizada após incluir as respostas coletadas.',
  'Hipótese inicial configurada': 'Ponto de partida escolhido para a projeção. Não é resultado da pesquisa.',
  'Resultados observados': 'Quantidade de participantes já incluídos no cálculo.',
  'Decisões registradas': 'Total de respostas efetivamente registradas nas sessões analisadas.',
  'Áudios com telemetria': 'Quantidade de respostas de áudio com informações de escuta registradas.'
};
function Numero({rotulo,valor,legenda,formula,destaque=false}){
  return <div className={`v5-numero ${destaque?'v5-numero-destaque':''}`}>
    <span className="v5-numero-rotulo">{rotulo}</span><strong>{valor}</strong>
    {legenda&&<p>{legenda}</p>}{formula&&<code>{formula}</code>}{GUIA_METRICAS[rotulo]&&<details className="v8-metrica-ajuda"><summary>O que significa?</summary><p>{GUIA_METRICAS[rotulo]}</p></details>}
  </div>;
}
function Nota({children}){return <div className="v5-nota">{children}</div>;}
function Empty({children='Ainda não existem dados válidos suficientes para exibir este gráfico.'}){return <p className="v5-empty">{children}</p>;}
function Explica({titulo,formula,conta,resultado,descricao,nota}){
  return <article className="v5-equacao">
    <div className="v5-equacao-titulo"><h3>{titulo}</h3><strong>{resultado}</strong></div>
    <p>{descricao}</p><div className="v5-formula"><div><span>Fórmula</span><code>{formula}</code></div><div><span>Com os seus dados</span><code>{conta}</code></div></div>
    {nota&&<small>{nota}</small>}
  </article>;
}
function Exportar(nome,colunas,registros){
  const proteger=v=>{let s=v==null?'':String(v);if(/^\s*[=+@\-]/.test(s))s="'"+s;return `"${s.replaceAll('"','""')}"`;};
  const csv='\ufeff'+[colunas.map(c=>c[1]),...registros.map(row=>colunas.map(c=>row[c[0]]))].map(r=>r.map(proteger).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=nome;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function LinhaVaria({data,yKey='acerto',nome='nome',titulo='Acertos'}){
  const list=data.filter(x=>x[yKey]!=null);
  if(!list.length)return <Empty/>;
  return <div className="v5-grafico" role="img" aria-label={`${titulo} por grupo`}><ResponsiveContainer width="100%" height={290}>
    <LineChart data={list} margin={{top:20,right:22,bottom:22,left:0}}>
      <CartesianGrid {...BASE_GRID}/><XAxis dataKey={nome} tick={{fontSize:12}} interval={0}/><YAxis domain={[0,100]} tickFormatter={x=>`${x}%`} width={48}/>
      <Tooltip contentStyle={hoverStyle} formatter={x=>[p100(x),titulo]}/>
      <Line type="monotone" dataKey={yKey} name={titulo} stroke={COLORS[0]} strokeWidth={3} dot={{r:5,fill:'#fff',strokeWidth:3}} activeDot={{r:7}}/>
    </LineChart></ResponsiveContainer></div>;
}
function PieComposicao({composicao}){
  const rows=[{name:'IA',valor:composicao.IA||0},{name:'Humano',valor:composicao.real||0}];
  const total=rows.reduce((s,x)=>s+x.valor,0);
  if(!total)return <Empty/>;
  return <><div className="v5-donut"><ResponsiveContainer height={250} width="100%"><PieChart>
    <Pie data={rows} dataKey="valor" nameKey="name" innerRadius={66} outerRadius={104} paddingAngle={3}>
      {rows.map((x,i)=><Cell key={x.name} fill={COLORS[i]}/>)}</Pie>
    <Tooltip formatter={v=>[`${v} respostas`,'Exposições']} contentStyle={hoverStyle}/>
    <Legend verticalAlign="bottom" formatter={(value)=><span style={{color:'#14122B'}}>{value}</span>}/>
  </PieChart></ResponsiveContainer></div><p className="v5-center">Total de classificações individuais: <strong>{total}</strong>. O gráfico mostra os conteúdos sorteados, não os cadastrados.</p></>;
}
function Matriz({q}){
  const total=q.vv+q.vf+q.fv+q.ff, ia=q.vv+q.vf, humano=q.ff+q.fv;
  const items=[{label:'IA → respondeu IA',v:q.vv,base:ia,ok:true},{label:'IA → respondeu humano',v:q.vf,base:ia,ok:false},{label:'Humano → respondeu IA',v:q.fv,base:humano,ok:false},{label:'Humano → respondeu humano',v:q.ff,base:humano,ok:true}];
  return <><div className="v5-matriz-titulos"><span>Origem verdadeira ↓</span><span>Respondeu IA</span><span>Respondeu humano</span></div>
    <div className="v5-matriz"><span className="v5-matriz-rotulo">IA</span>{items.slice(0,2).map(x=><div key={x.label} className={`v5-matriz-cel ${x.ok?'acerto':'erro'}`} style={{'--forca':String(Math.max(.14,x.base?x.v/x.base:.14))}}><strong>{x.v}</strong><span>{p100(x.base?100*x.v/x.base:null)}</span></div>)}
      <span className="v5-matriz-rotulo">Humano</span>{items.slice(2).map(x=><div key={x.label} className={`v5-matriz-cel ${x.ok?'acerto':'erro'}`} style={{'--forca':String(Math.max(.14,x.base?x.v/x.base:.14))}}><strong>{x.v}</strong><span>{p100(x.base?100*x.v/x.base:null)}</span></div>)}
    </div><p className="mut v5-menor">Cada célula mostra a contagem e a porcentagem dentro da origem verdadeira daquela linha ({total} classificações com origem e resposta conhecidas).</p></>;
}
function Histograma({pessoas}){
  const dados=contarDistribuicao(pessoas);if(!pessoas.length)return <Empty/>;
  return <div className="v5-grafico"><ResponsiveContainer width="100%" height={280}><BarChart data={dados} margin={{top:20,right:15,bottom:16,left:0}}>
    <CartesianGrid {...BASE_GRID} vertical={false}/><XAxis dataKey="nome" tick={{fontSize:11}}/><YAxis allowDecimals={false}/>
    <Tooltip contentStyle={hoverStyle} formatter={v=>[v,'Participantes']}/><Bar dataKey="quantidade" fill={COLORS[0]} radius={[8,8,0,0]}><LabelList dataKey="quantidade" position="top"/></Bar>
  </BarChart></ResponsiveContainer></div>;
}
function Evolucao({pessoas}){
  const [marco,setMarco]=useState(0),[tocando,setTocando]=useState(false);
  const [hipotese,setHipotese]=useState(PREVISAO_INICIAL),[peso,setPeso]=useState(FORCA_INICIAL);
  const dados=useMemo(()=>criarEvolucao(pessoas,{mediaInicial:hipotese,forca:peso}),[pessoas,hipotese,peso]);
  const maximo=dados.length-1;
  useEffect(()=>{setMarco(m=>Math.min(m,maximo));},[maximo]);
  useEffect(()=>{if(!tocando)return;const t=setInterval(()=>setMarco(m=>{if(m>=maximo){setTocando(false);return m;}return m+1;}),550);return()=>clearInterval(t);},[tocando,maximo]);
  const selecionado=dados[Math.min(marco,maximo)]||dados[0];
  const serie=dados.slice(0,Math.min(marco,maximo)+1).map(x=>({...x,faixa:x.limiteInferior==null?null:[x.limiteInferior,x.limiteSuperior]}));
  const ultimo=dados[maximo];
  return <div className="v5-forecast">
    <div className="v5-projecao-grande"><Numero rotulo="Estimativa ajustada após as respostas" valor={p100(selecionado.previsao)} legenda={`${selecionado.n} participantes observados`}/>
      <Numero rotulo="Média observada da amostra" valor={p100(selecionado.observada)} legenda={selecionado.n?'Calculada apenas com respostas efetivas':'Nenhuma resposta ainda'}/>
      <Numero rotulo="Estimativa antes da próxima resposta" valor={p100(selecionado.previsao)} legenda={`Hipótese inicial: ${hipotese}% · peso ${peso}`}/>
    </div>
    <div className="v5-grafico"><ResponsiveContainer height={350} width="100%"><AreaChart data={serie} margin={{top:20,right:20,bottom:12,left:0}}>
      <CartesianGrid {...BASE_GRID}/><XAxis dataKey="n" type="number" domain={[0,Math.max(1,maximo)]} allowDecimals={false} label={{value:'Participantes válidos concluídos',position:'insideBottom',offset:-7}}/>
      <YAxis domain={[0,100]} width={48} tickFormatter={v=>`${v}%`}/>
      <Tooltip contentStyle={hoverStyle} formatter={(val,name)=>name==='Intervalo ilustrativo'?['faixa','Intervalo ilustrativo']:[p100(val),name]}/>
      <Legend verticalAlign="top" height={35}/>
      <Area dataKey="faixa" name="Intervalo ilustrativo" stroke="none" fill={COLORS[2]} fillOpacity={.18} legendType="rect" connectNulls={false} isAnimationActive={false}/>
      <Line dataKey="previsao" name="Projeção ilustrativa" stroke={COLORS[0]} strokeWidth={3} type="monotone" dot={false} isAnimationActive={false}/>
      <Line dataKey="observada" name="Média observada" stroke="#078E79" strokeWidth={3} type="monotone" dot={{r:3}} isAnimationActive={false}/>
    </AreaChart></ResponsiveContainer></div>
    <div className="v5-playback"><button className="cta" type="button" disabled={!maximo} onClick={()=>{if(marco>=maximo)setMarco(0);setTocando(x=>!x);}}>{tocando?'Pausar evolução':'▶ Reproduzir evolução'}</button>
      <button type="button" className="v5-btn-sec" onClick={()=>{setTocando(false);setMarco(maximo);}}>Ver todos</button>
      <input type="range" aria-label="Número de participantes já considerados" min="0" max={Math.max(1,maximo)} step="1" value={marco} onChange={e=>{setTocando(false);setMarco(Number(e.target.value));}} disabled={!maximo}/>
      <span>{marco} / {maximo}</span></div>
    <details className="v5-hipotese"><summary>Premissas da projeção (personalizáveis)</summary><div className="v5-config-grid">
      <label>Hipótese inicial da taxa de acerto: <strong>{hipotese}%</strong><input type="range" min="20" max="80" value={hipotese} onChange={e=>{setTocando(false);setMarco(0);setHipotese(Number(e.target.value));}}/></label>
      <label>Peso fictício da hipótese (equivalente a participantes): <strong>{peso}</strong><input type="range" min="1" max="30" value={peso} onChange={e=>{setTocando(false);setMarco(0);setPeso(Number(e.target.value));}}/></label>
    </div></details>
    <Nota>Esta curva é uma <strong>projeção descritiva ilustrativa</strong>, não um modelo validado de previsão. Começa em {hipotese}% (referência de palpite aleatório na classificação binária) com peso fictício {peso}; a linha observada contém apenas resultados reais. A faixa amarela é uma aproximação de incerteza da média observada, não um intervalo de previsão para o próximo participante. Os resultados excluem pilotos conforme o filtro.</Nota>
    {maximo>0&&<details className="v5-formulas"><summary>Ver a conta do último ponto</summary><code>Estimativa = ({peso} × {hipotese} + soma das notas individuais) ÷ ({peso} + {maximo}) = {p100(ultimo.previsao)}</code></details>}
  </div>;
}
function Tabela({cabecalhos,linhas}){return <div className="rolagem v5-tabela-scroll"><table><thead><tr>{cabecalhos.map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{linhas.length?linhas.map((c,i)=><tr key={i}>{c.map((v,j)=><td key={j}>{v}</td>)}</tr>):<tr><td colSpan={cabecalhos.length}>Sem registros neste recorte.</td></tr>}</tbody></table></div>;}
function ResumoFonte({d}){
  return <div className="v5-resumo-fonte"><span>Incluídas: <b>{d.coleta.validas}</b> sessões completas válidas</span><span>Excluídas: <b>{d.coleta.pilotos}</b> pilotos completos</span><span>Fora do protocolo: <b>{d.coleta.foraProtocolo}</b></span><span>Não finalizadas: <b>{d.coleta.incompletas}</b></span></div>;
}
export default function Dashboard({dados,atual,avancado,atualizar,comparacoesItens=[],comparacoesDisponiveis=false}){
  const [incluirPilotos,setIncluirPilotos]=useState(false);
  const [aba,setAba]=useState('visao');
  const [mudando,setMudando]=useState('');
  const [erro,setErro]=useState('');
  const [perfilTipo,setPerfilTipo]=useState('faixa');
  const d=useMemo(()=>analisarAvancado(avancado,incluirPilotos),[avancado,incluirPilotos]);
  const q=d.quad;
  const ia=q.vv+q.vf,humano=q.ff+q.fv,N=ia+humano;
  const sensibil=ia?100*q.vv/ia:null;
  const espec=humano?100*q.ff/humano:null;
  const taxaIA=N?100*(q.vv+q.fv)/N:null;
  const taxaAcerto=N?100*(q.vv+q.ff)/N:null;
  const faixaDiag=[{chave:'Sensibilidade IA',valor:sensibil},{chave:'Reconhecimento humano',valor:espec},{chave:'Taxa de rotular IA',valor:taxaIA}];
  const dadosConfianca=useMemo(()=>d.pessoas.filter(p=>Number.isFinite(Number(p.confianca)) && Number.isFinite(p.pct_ind)).map(p=>({confianca:Number(p.confianca),nota:p.pct_ind})),[d.pessoas]);
  const xComp=d.porFrame.map(x=>({nome:x.nome,acerto:x.acerto,disseIa:x.disseIa}));
  const v=d.coleta.validas;
  const perfilRows=useMemo(()=>{
    const grupos=new Map();
    for(const pessoa of d.pessoas){
      const nome=String(pessoa[perfilTipo]||'Não informado').trim();
      if(!grupos.has(nome))grupos.set(nome,[]);
      grupos.get(nome).push(pessoa.pct_ind);
    }
    return [...grupos.entries()].map(([nome,notas])=>({nome,...resumoParticipantes(notas)}))
      .sort((a,b)=>b.n-a.n || a.nome.localeCompare(b.nome,'pt-BR'));
  },[d.pessoas,perfilTipo]);
  const quartil=proporcao=>{const a=d.pessoas.map(p=>p.pct_ind).filter(Number.isFinite).sort((a,b)=>a-b);if(!a.length)return null;const pos=(a.length-1)*proporcao;return a[Math.floor(pos)]*(1-(pos%1))+a[Math.ceil(pos)]*(pos%1);};
  const q1=quartil(.25),q3=quartil(.75);
  const cv=d.notas.media>0&&d.notas.desvio!=null ? 100*d.notas.desvio/d.notas.media : null;
  const distribuicaoDia=d.coleta.porDia.map(x=>({...x,dia:x.nome.slice(5)}));
  const pessoasCSV=d.pessoas.map(p=>({id:p.id,faixa:p.faixa,genero:p.genero,escolaridade:p.escolaridade,frequencia:p.freq,confianca:p.confianca,estimativa:p.estimativa,n_ind:p.n_ind,acertos:p.acertos,pct_ind:p.pct_ind,n_comp:p.n_comp,acertos_comp:p.acertosPares,pct_comp:p.pct_comp,tempo_med_s:p.tempo_med_s}));
  const individuaisCSV=d.ri.map(r=>({participante:r.participante_id,conteudo:r.conteudo_id,tipo:r.tipo,enquadramento:r.enquadramento,origem_ia:r.origem_ia,resposta_ia:r.resposta_ia,acertou:r.acertou,tempo_ms:r.tempo_ms,segundos_reproduzidos:r.segundos_reproduzidos,pedidos_mais:r.pedidos_mais,duracao_audio_s:r.duracao_audio_s,trecho_liberado_s:r.trecho_liberado_s,repeticoes_audio:r.repeticoes_audio,data:r.data}));
  const compCSV=d.rc.map(r=>({participante:r.participante_id,comparacao:r.comparacao_id,tipo:r.tipo,enquadramento:r.enquadramento,acertou:r.acertou,acertos_itens:r.acertos_itens,n_itens:r.n_itens,n_reais_ia:r.n_reais_ia,n_marcados_ia:r.n_marcados_ia,tempo_ms:r.tempo_ms,data:r.data}));
  async function piloto(p){setErro('');setMudando(p.id);try{const {error}=await supabase.rpc('admin_classificar_piloto_v4',{p_participante:p.id,p_excluir:!p.excluir_analise});if(error)throw error;await atualizar?.();}catch(e){setErro(e.message||'Falha ao classificar piloto.');}finally{setMudando('');}}
  return <div className="dash dash-v5">
    <div className="v5-cabecalho"><div><span className="v5-eyebrow">REAL OU IA? · PAINEL ESTATÍSTICO</span><h1>O que os dados estão mostrando?</h1><p className="mut">Atualizado {atual?.toLocaleString('pt-BR')||'—'} · Resultado oficial usa exclusivamente sessões completas de 30 decisões.</p></div><div className="v5-contador"><strong>{v}<span>/{META}</span></strong><small>participantes válidos</small><div className="barra"><i style={{width:`${Math.min(100,100*v/META)}%`}}/></div></div></div>
    <nav className="v5-abas" aria-label="Seções das estatísticas">{TABS.map(([key,label])=><button type="button" key={key} aria-current={aba===key?'page':undefined} className={aba===key?'ativa':''} onClick={()=>setAba(key)}>{label}</button>)}</nav>
    <div className="v5-filtro"><label><input type="checkbox" checked={incluirPilotos} onChange={e=>setIncluirPilotos(e.target.checked)}/> Incluir sessões piloto na análise</label><span>{incluirPilotos?'Exibindo também pilotos completos. Não usar esta opção no relatório final.':'Sessões piloto excluídas dos indicadores oficiais.'}</span></div>
    {erro&&<p role="alert" className="erro">{erro}</p>}
    <ResumoFonte d={d}/>
    {aba==='visao'&&<>
      <div className="v5-hero-numeros"><Numero destaque rotulo="Acurácia individual média" valor={p100(d.notas.media)} legenda="Média das porcentagens de acerto por participante" formula={v?`${v} participantes · IC 95%: ${ci(d.notas.ic)}`:'Aguardando sessões válidas'}/>
        <Numero rotulo="Mediana individual" valor={p100(d.notas.mediana)} legenda="Metade dos participantes fica de cada lado deste valor"/>
        <Numero rotulo="Decisões registradas" valor={d.coleta.volume} legenda="Soma de questões individuais e rodadas de comparação"/>
        <Numero rotulo="Taxa de conclusão" valor={p100(d.coleta.total?100*d.coleta.finalizadas/d.coleta.total:null)} legenda={`${d.coleta.finalizadas} finalizados entre ${d.coleta.total} iniciados (todas as versões)`}/></div>
      <div className="v5-grid"><Painel titulo="Como as pontuações se distribuem" sub="Histograma: quantidade de pessoas em cada faixa de acerto, sem tratar respostas como participantes."><Histograma pessoas={d.pessoas}/></Painel>
        <Painel titulo="Quanto de IA e humano apareceu?" sub="Proporção real dos conteúdos individuais exibidos aos participantes."><PieComposicao composicao={d.composicao}/></Painel>
        <Painel titulo="Acurácia por modalidade" sub="Cada ponto é a média por participante naquele formato."><LinhaVaria data={d.tipo}/></Painel>
        <Painel titulo="Sessões ao longo do tempo" sub="Inícios e finalizações, incluindo pilotos e versões antigas; são volumes de coleta, não acertos.">
          {distribuicaoDia.length?<div className="v5-grafico"><ResponsiveContainer width="100%" height={275}><AreaChart data={distribuicaoDia} margin={{top:18,right:18,bottom:14,left:0}}><CartesianGrid {...BASE_GRID}/><XAxis dataKey="dia" tick={{fontSize:11}}/><YAxis allowDecimals={false}/><Tooltip contentStyle={hoverStyle}/><Legend/>
            <Area dataKey="iniciadas" name="Iniciadas" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={.16}/><Area dataKey="completas" name="Concluídas" stroke="#039786" fill="#42C4AB" fillOpacity={.16}/>
          </AreaChart></ResponsiveContainer></div>:<Empty/>}
        </Painel></div>
      <div className="v5-destaque-link"><p><b>Indicadores importantes que merecem destaque</b><span> Sensibilidade para IA, reconhecimento de humano e tendência de acusar IA têm contagens e fórmulas individuais.</span></p><button className="cta" type="button" onClick={()=>setAba('diagnostico')}>Explorar IA × humano →</button></div>
    </>}
    {aba==='diagnostico'&&<>
      <div className="v5-intro"><h2>Como as pessoas diferenciam IA de humano?</h2><p>Três indicadores fundamentais, mostrados com o cálculo aberto. Base: <b>{N}</b> respostas individuais com origem e decisão conhecidas.</p></div>
      <div className="v5-hero-numeros v5-tres"><Numero destaque rotulo="Sensibilidade para IA" valor={p100(sensibil)} legenda="De tudo que era IA, quanto foi reconhecido como IA?" formula={`${q.vv} ÷ (${q.vv} + ${q.vf}) × 100`}/>
        <Numero destaque rotulo="Reconhecimento de humano" valor={p100(espec)} legenda="De tudo que era humano, quanto foi corretamente reconhecido?" formula={`${q.ff} ÷ (${q.ff} + ${q.fv}) × 100`}/>
        <Numero destaque rotulo="Taxa de chamar algo de IA" valor={p100(taxaIA)} legenda="De todas as classificações, quantas receberam o rótulo IA?" formula={`(${q.vv} + ${q.fv}) ÷ ${N} × 100`}/></div>
      <div className="v5-grid"><Painel titulo="Mapa de calor dos acertos e confusões" sub="Tons mais intensos significam maior proporção na mesma origem verdadeira."><Matriz q={q}/></Painel>
        <Painel titulo="Entenda os três indicadores" sub="Cada linha representa UM resultado. A faixa colorida vai de 0% (nada) até 100% (tudo); as marcas de 25%, 50% e 75% não são dados novos.">
          <div className="v8-tres-indicadores">{[
            {nome:'Sensibilidade para IA',valor:sensibil,texto:'De tudo que era IA, quanto as pessoas reconheceram?',conta:`${q.vv} acertos ÷ ${ia} materiais IA × 100`},
            {nome:'Reconhecimento de humano',valor:espec,texto:'De tudo que era humano, quanto foi reconhecido?',conta:`${q.ff} acertos ÷ ${humano} materiais humanos × 100`},
            {nome:'Taxa de marcar IA',valor:taxaIA,texto:'De todas as respostas, em quantas escolheram IA? Não mede acerto.',conta:`${q.vv+q.fv} votos IA ÷ ${N} respostas × 100`}
          ].map(x=><div className="v8-indicador" key={x.nome}>
            <div className="v8-indicador-topo"><strong>{x.nome}</strong><b>{p100(x.valor)}</b></div>
            <div className="v8-indicador-trilha" role="img" aria-label={`${x.nome}: ${p100(x.valor)} em uma escala de zero a cem`}><span style={{width:`${Math.max(0,Math.min(100,x.valor||0))}%`}}/></div>
            <p>{x.texto}</p><details><summary>Ver de onde veio o número</summary><code>{x.conta} = {p100(x.valor)}</code></details>
          </div>)}</div>
        </Painel></div>
      <Painel titulo="Confira cada uma das contas" sub="Os numeradores e denominadores vêm da matriz de confusão, não de estimativas.">
        <div className="v5-explicacoes">
          <Explica titulo="1. Sensibilidade (recall) para IA" formula="VP / (VP + FN) × 100" conta={`${q.vv} / (${q.vv} + ${q.vf}) × 100`} resultado={p100(sensibil)} descricao="VP: IA reconhecida como IA. FN: IA classificada incorretamente como humana."/>
          <Explica titulo="2. Especificidade / reconhecimento de humano" formula="VN / (VN + FP) × 100" conta={`${q.ff} / (${q.ff} + ${q.fv}) × 100`} resultado={p100(espec)} descricao="VN: humano reconhecido como humano. FP: humano classificado incorretamente como IA."/>
          <Explica titulo="3. Tendência de chamar algo de IA" formula="(VP + FP) / (VP + FN + FP + VN) × 100" conta={`(${q.vv} + ${q.fv}) / (${q.vv} + ${q.vf} + ${q.fv} + ${q.ff}) × 100`} resultado={p100(taxaIA)} descricao="É a frequência da escolha 'IA', correta ou incorreta. Não significa sensibilidade ou acerto."/>
          <Explica titulo="4. Acurácia geral por resposta individual" formula="(VP + VN) / N × 100" conta={`(${q.vv} + ${q.ff}) / ${N} × 100`} resultado={p100(taxaAcerto)} descricao="Proporção geral de acertos entre respostas individuais. Diferente da média dos percentuais por participante quando cada pessoa responde quantidades distintas."/>
        </div><Nota>Esses percentuais da matriz descrevem as <strong>respostas</strong>, que não são observações independentes entre si: uma pessoa faz várias classificações. Para inferência, use os resultados por participante. Nenhum indicador sozinho prova que as pessoas sabem ou não reconhecer IA.</Nota>
      </Painel>
    </>}
    {aba==='formatos'&&<>
      <div className="v5-intro"><h2>O formato e a pergunta fazem diferença?</h2><p>Veja imagens, textos, áudios e vídeos e como mudam as decisões diante de perguntas neutras, sobre IA ou sobre autoria humana.</p></div>
      <div className="v5-grid"><Painel titulo="Perfil por modalidade" sub="Gráfico radar de acertos médios. A forma não representa uma escala contínua entre tipos distintos.">
        {d.tipo.some(x=>x.acerto!=null)?<div className="v5-grafico"><ResponsiveContainer width="100%" height={310}><RadarChart data={d.tipo.map(x=>({nome:x.nome,acerto:x.acerto??0}))} outerRadius="68%"><PolarGrid/><PolarAngleAxis dataKey="nome"/><Radar name="Acertos (%)" dataKey="acerto" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={.23}/><Tooltip formatter={v=>[p100(v),'Média']} contentStyle={hoverStyle}/></RadarChart></ResponsiveContainer></div>:<Empty/>}
      </Painel><Painel titulo="Influência da formulação" sub="Linhas para taxa de acerto e frequência de rotular como IA. Associação exploratória, não efeito causal identificado.">
          {xComp.some(x=>x.acerto!=null)?<div className="v5-grafico"><ResponsiveContainer width="100%" height={295}><LineChart data={xComp} margin={{top:16,right:22,bottom:15,left:0}}><CartesianGrid {...BASE_GRID}/><XAxis dataKey="nome" tick={{fontSize:11}}/><YAxis domain={[0,100]} tickFormatter={v=>`${v}%`}/><Tooltip contentStyle={hoverStyle} formatter={v=>p100(v)}/><Legend/><Line name="Acertos" dataKey="acerto" stroke={COLORS[0]} strokeWidth={3}/><Line name="Respostas IA" dataKey="disseIa" stroke="#F08A29" strokeWidth={3}/></LineChart></ResponsiveContainer></div>:<Empty/>}
      </Painel></div>
      <div className="v5-dados-diretos">{d.tipo.map(x=><Numero key={x.tipo} rotulo={x.nome} valor={p100(x.acerto)} legenda={`${x.n} respostas · ${x.participantes} pessoas`} formula={`IC 95%: ${ci(x.ic)}`}/>)}</div>
      <Painel titulo="Resultados por perfil dos participantes" sub="As diferenças por idade, escolaridade e frequência de uso de IA são descritivas. Os intervalos podem ser instáveis quando há poucos participantes.">
        <div className="v5-seletor"><label htmlFor="v5-perfil">Agrupar por:</label><select id="v5-perfil" value={perfilTipo} onChange={e=>setPerfilTipo(e.target.value)}><option value="faixa">Faixa etária</option><option value="escolaridade">Escolaridade</option><option value="freq">Frequência de uso de IA</option></select></div>
        <div className="v5-grid"><div>{perfilRows.length?<div className="v5-grafico"><ResponsiveContainer width="100%" height={300}><BarChart data={perfilRows} layout="vertical" margin={{top:15,bottom:10,right:24,left:15}}><CartesianGrid {...BASE_GRID} horizontal={false}/><XAxis type="number" domain={[0,100]} tickFormatter={x=>`${x}%`}/><YAxis type="category" width={115} dataKey="nome" tick={{fontSize:11}}/><Tooltip contentStyle={hoverStyle} formatter={v=>[p100(v),'Média']}/><Bar dataKey="media" fill={COLORS[0]} radius={[0,7,7,0]}/></BarChart></ResponsiveContainer></div>:<Empty/>}</div>
          <div><Tabela cabecalhos={['Grupo','Participantes','Média','IC 95%']} linhas={perfilRows.map(x=>[x.nome,x.n,p100(x.media),ci(x.ic)])}/></div></div>
      </Painel>
      <Painel titulo="Comparações entre dois conteúdos" sub="Acertar os dois conteúdos é diferente de acertar cada um separadamente."><div className="v5-dados-diretos"><Numero rotulo="Dupla totalmente correta" valor={p100(d.comparacaoExata.media)} legenda="Média de acertos exatos por participante"/><Numero rotulo="Acertos por peça" valor={p100(d.comparacaoItens.media)} legenda="Média por participante dos itens da comparação"/></div><Nota>Com duas decisões independentes e quatro configurações possíveis, o palpite uniforme tem referência de 25% para acertar a dupla inteira; já por peça, 50%. Essa referência pressupõe escolhas uniformes, não necessariamente o comportamento real.</Nota></Painel>
      <Painel titulo="Formulação dentro de cada modalidade"><Tabela cabecalhos={['Modalidade','Pergunta','Respostas','Pessoas','Média de acertos','Marcou IA']} linhas={d.fTipo.map(x=>[x.nome,ENQUADRAMENTOS[x.frame],x.n,x.pessoas,p100(x.acerto),p100(x.disseIA)])}/></Painel>
    </>}
    {aba==='comportamento'&&<>
      <div className="v5-intro"><h2>Como as pessoas decidem?</h2><p>Confiança declarada, resultado observado e quanto foi necessário ouvir antes de responder.</p></div>
      <div className="v5-grid"><Painel titulo="Confiança inicial × desempenho" sub="Cada ponto corresponde a um participante válido. Confiança de 1 a 5 (pergunta inicial).">
        {dadosConfianca.length?<div className="v5-grafico"><ResponsiveContainer width="100%" height={300}><ScatterChart margin={{top:16,right:22,bottom:22,left:10}}><CartesianGrid {...BASE_GRID}/><XAxis type="number" dataKey="confianca" name="Confiança" domain={[1,5]} ticks={[1,2,3,4,5]} label={{value:'Confiança (1–5)',position:'insideBottom',offset:-9}}/><YAxis type="number" dataKey="nota" name="Acerto" domain={[0,100]} unit="%"/><ZAxis range={[65,65]}/><Tooltip contentStyle={hoverStyle} cursor={{strokeDasharray:'3 3'}} formatter={(v,n)=>[n==='Acerto'?p100(v):v,n]}/><Scatter data={dadosConfianca} fill={COLORS[0]} fillOpacity={.7}/></ScatterChart></ResponsiveContainer></div>:<Empty/>}
      </Painel><Painel titulo="Escuta progressiva" sub="Pedidos para desbloquear mais áudio e o percentual acertado em cada grupo. É associação exploratória.">
        {d.audio.etapas.some(x=>x.n)?<div className="v5-grafico"><ResponsiveContainer width="100%" height={300}><LineChart data={d.audio.etapas.filter(x=>x.n)} margin={{top:16,right:16,bottom:14,left:0}}><CartesianGrid {...BASE_GRID}/><XAxis dataKey="nome" label={{value:'Pedidos para ouvir mais',position:'insideBottom',offset:-7}}/><YAxis domain={[0,100]} tickFormatter={v=>`${v}%`}/><Tooltip contentStyle={hoverStyle} formatter={v=>p100(v)}/><Line type="monotone" dataKey="acerto" stroke={COLORS[0]} strokeWidth={3} dot={{r:5}} name="Acertos"/></LineChart></ResponsiveContainer></div>:<Empty/>}
      </Painel></div>
      <div className="v5-dados-diretos"><Numero rotulo="Áudios com telemetria" valor={`${d.audio.medidos} / ${d.audio.n}`} legenda="Gravações com duração e trecho disponíveis"/><Numero rotulo="Escuta mediana" valor={`${nfmt(d.audio.ouvidoMed)} s`} legenda="Segundos reproduzidos; repetições contam"/><Numero rotulo="Trecho mediano liberado" valor={p100(d.audio.fraçãoMed)} legenda="Parte do arquivo disponibilizada à pessoa"/><Numero rotulo="Pedidos para ouvir mais" valor={nfmt(d.audio.maisMed)} legenda="Média de solicitações"/></div>
      <Painel titulo="Estimativa após o teste" sub="Diferença entre a estimativa do participante e seu desempenho individual medido."><Numero rotulo="Viés médio da estimativa" valor={p100(d.viesConfianca.media)} legenda={`${d.viesConfianca.n} participantes com estimativa numérica`}/><Nota>Valor positivo = superestimou a própria nota; negativo = subestimou. A pergunta de estimativa pode envolver todas as 30 decisões; antes de usar esta métrica como resultado final, confira se o denominador da estimativa corresponde ao mesmo conjunto de questões da nota individual.</Nota></Painel>
    </>}
    {aba==='projecao'&&<>
      <div className="v5-intro"><h2>Como a estimativa muda durante a coleta?</h2><p>Reprodução da trajetória conforme cada participante termina. A hipótese inicial é exibida separadamente do que foi observado.</p></div>
      <Painel titulo="Evolução animada da pesquisa" sub="Você pode voltar ao começo, avançar manualmente ou reproduzir todos os participantes em sequência."><Evolucao pessoas={d.pessoas}/></Painel>
      <Painel titulo="Interpretação correta" sub="Como o processo é atualizado a cada novo participante"><div className="v5-dados-diretos"><Numero rotulo="Hipótese inicial configurada" valor={`${PREVISAO_INICIAL}%`} legenda="Referência para palpite aleatório individual"/><Numero rotulo="Resultados observados" valor={String(d.pessoas.length)} legenda="Amostra realmente coletada"/><Numero rotulo="Média observada atual" valor={p100(d.notas.media)} legenda={`IC 95% descritivo: ${ci(d.notas.ic)}`}/></div><Nota>Alterar a hipótese inicial modifica apenas a linha de projeção. Nunca modifica os dados observados. A análise final deve priorizar os dados coletados, o intervalo de confiança e possíveis diferenças por modalidade, não a precisão aparente da curva.</Nota></Painel>
    </>}
    {aba==='materiais'&&<RankingMateriais d={d} comparacoesDetalhes={comparacoesItens} comparacoesDisponiveis={comparacoesDisponiveis}/>}
    {aba==='calculos'&&<>
      <div className="v5-intro"><h2>Todas as contas, sem esconder as fórmulas</h2><p>Os resultados abaixo usam o recorte atual. Cada fórmula indica qual é a unidade de análise e mostra a operação com os números reais disponíveis.</p></div>
      <details className="v8-glossario"><summary>Glossário simples: o que cada termo mede?</summary><div className="v8-glossario-grid">{Object.entries(GUIA_METRICAS).map(([nome,descricao])=><div key={nome}><strong>{nome}</strong><p>{descricao}</p></div>)}</div></details>
      <Painel titulo="Indicadores de reconhecimento"><div className="v5-explicacoes">
        <Explica titulo="Sensibilidade para IA" formula="VP ÷ (VP + FN) × 100" conta={`${q.vv} ÷ (${q.vv} + ${q.vf}) × 100`} resultado={p100(sensibil)} descricao="Proporção de conteúdos artificiais corretamente classificados. VP: IA marcada IA; FN: IA marcada humano."/>
        <Explica titulo="Reconhecimento de humano" formula="VN ÷ (VN + FP) × 100" conta={`${q.ff} ÷ (${q.ff} + ${q.fv}) × 100`} resultado={p100(espec)} descricao="Proporção de conteúdos humanos corretamente classificados. VN: humano marcado humano; FP: humano marcado IA."/>
        <Explica titulo="Taxa de chamar algo de IA" formula="(VP + FP) ÷ N × 100" conta={`(${q.vv} + ${q.fv}) ÷ ${N} × 100`} resultado={p100(taxaIA)} descricao="Frequência total de respostas que apontam IA, independentemente do gabarito."/>
        <Explica titulo="Acurácia por resposta" formula="(VP + VN) ÷ N × 100" conta={`(${q.vv} + ${q.ff}) ÷ ${N} × 100`} resultado={p100(taxaAcerto)} descricao="Corretas / classificações individuais. Este é um resumo por resposta, não uma média por pessoa."/>
      </div></Painel>
      <Painel titulo="Resumo estatístico por participante"><div className="v5-dados-diretos"><Numero rotulo="Média" valor={p100(d.notas.media)} legenda="Soma das porcentagens pessoais ÷ pessoas"/><Numero rotulo="Mediana" valor={p100(d.notas.mediana)} legenda="Valor central das porcentagens pessoais"/><Numero rotulo="Desvio padrão amostral" valor={p100(d.notas.desvio)} legenda="Dispersão das porcentagens individuais"/><Numero rotulo="Erro padrão" valor={p100(d.notas.se)} legenda="Desvio padrão ÷ raiz quadrada de n"/><Numero rotulo="Intervalo 95%" valor={ci(d.notas.ic)} legenda="Intervalo t aproximado da média"/><Numero rotulo="Primeiro quartil (Q1)" valor={p100(q1)} legenda="25% das notas ficam até este nível"/><Numero rotulo="Terceiro quartil (Q3)" valor={p100(q3)} legenda="75% das notas ficam até este nível"/><Numero rotulo="Amplitude interquartil" valor={q1==null||q3==null?'—':`${nfmt(q3-q1)} p.p.`} legenda="Q3 − Q1"/><Numero rotulo="Coeficiente de variação" valor={p100(cv)} legenda="Desvio padrão ÷ média × 100"/></div>
        <div className="v5-explicacoes"><Explica titulo="Média individual de acerto" formula="[Σ (100 × acertosᵢ / questões individuaisᵢ)] ÷ n" conta={`Soma das ${v} porcentagens individuais ÷ ${v}`} resultado={p100(d.notas.media)} descricao="Cada participante contribui com uma porcentagem para a média, independentemente do número de cliques."/>
          <Explica titulo="Desvio padrão amostral" formula="s = √[Σ(xᵢ − média)² / (n − 1)]" conta={`n = ${d.notas.n}; variância = ${d.notas.desvio==null?'—':nfmt(d.notas.desvio**2,2)} pontos percentuais²`} resultado={p100(d.notas.desvio)} descricao="Dispersão das pontuações individuais em pontos percentuais."/>
          <Explica titulo="Quartis e amplitude interquartil" formula="Q1 = percentil 25; Q3 = percentil 75; AIQ = Q3 − Q1" conta={`${nfmt(q3,2)} − ${nfmt(q1,2)} = ${nfmt(q3==null||q1==null?null:q3-q1,2)} p.p.`} resultado={q1==null||q3==null?'—':`${nfmt(q3-q1)} p.p.`} descricao="Quartis calculados por interpolação linear sobre pontuações individuais ordenadas."/>
          <Explica titulo="Coeficiente de variação" formula="CV = desvio padrão ÷ média × 100" conta={`${nfmt(d.notas.desvio,2)} ÷ ${nfmt(d.notas.media,2)} × 100`} resultado={p100(cv)} descricao="Variação relativa das notas individuais; só definido quando a média é positiva."/>
          <Explica titulo="Erro padrão e intervalo de confiança" formula="EP = s / √n; IC 95% ≈ média ± t₀,₉₇₅;ₙ₋₁ × EP" conta={`EP = ${nfmt(d.notas.desvio,2)} ÷ √${d.notas.n} = ${nfmt(d.notas.se,2)}`} resultado={ci(d.notas.ic)} descricao="Aproximação por distribuição t; os limites são truncados em 0% e 100%. Requer ao menos 2 participantes." nota="Intervalo para a média sob pressupostos amostrais; não é margem garantida para amostras de conveniência."/>
        </div></Painel>
      <Painel titulo="Comparações e áudio"><div className="v5-explicacoes"><Explica titulo="Acerto exato nas comparações" formula="Média individual de [duplas inteiramente corretas ÷ duplas respondidas × 100]" conta={`${d.comparacaoExata.n} participantes com comparações`} resultado={p100(d.comparacaoExata.media)} descricao="A rodada só vale como correta quando os dois conteúdos são classificados corretamente."/>
        <Explica titulo="Acerto por peça em comparações" formula="Média individual de [peças corretas ÷ peças avaliadas × 100]" conta={`${d.comparacaoItens.n} participantes com comparações`} resultado={p100(d.comparacaoItens.media)} descricao="Conta o acerto em cada um dos dois itens, independentemente do acerto do par inteiro."/>
        <Explica titulo="Porcentagem de áudio liberada" formula="Trecho liberado (s) ÷ duração total (s) × 100" conta={`Mediana das porcentagens registradas nos ${d.audio.medidos} áudios com telemetria`} resultado={p100(d.audio.fraçãoMed)} descricao="É o quanto ficou disponível para ouvir; não é o tempo reproduzido. Reproduzir novamente pode fazer o tempo ouvido superar o limite liberado."/>
      </div></Painel>
      <Nota>Os indicadores de diferentes formatos usam denominadores e referências de acerto ao acaso diferentes. Não misture comparações com classificações individuais para calcular uma única nota sem um critério de ponderação declarado. Estatísticas por faixa demográfica são exploratórias, especialmente com grupos pequenos.</Nota>
    </>}
    {aba==='auditoria'&&<>
      <div className="v5-intro"><h2>Dados completos e auditoria</h2><p>Tabelas detalhadas, exportações e controle de sessões piloto. Esta aba preserva a rastreabilidade dos resultados, sem poluir a apresentação principal.</p></div>
      <Painel titulo="Exportar bases analisadas" sub="Somente sessões incluídas no filtro. Não divulgue as planilhas brutas com identificadores de participantes."><div className="v5-botoes-exportar">
        <button className="cta" onClick={()=>Exportar('participantes_analise.csv',Object.keys(pessoasCSV[0]||{id:''}).map(k=>[k,k]),pessoasCSV)}>CSV participantes</button>
        <button className="cta" onClick={()=>Exportar('respostas_individuais.csv',Object.keys(individuaisCSV[0]||{participante:''}).map(k=>[k,k]),individuaisCSV)}>CSV individuais</button>
        <button className="cta" onClick={()=>Exportar('comparacoes.csv',Object.keys(compCSV[0]||{participante:''}).map(k=>[k,k]),compCSV)}>CSV comparações</button>
        <button className="cta" onClick={()=>Exportar('itens.csv',Object.keys(d.exportItens[0]||{id:''}).map(k=>[k,k]),d.exportItens)}>CSV conteúdos</button>
      </div></Painel>
      <Painel titulo="Modalidades: tabela completa"><Tabela cabecalhos={['Modalidade','Respostas','Pessoas','Acertos médios','IC 95%','Tempo mediano']} linhas={d.tipo.map(r=>[r.nome,r.n,r.participantes,p100(r.acerto),ci(r.ic),`${nfmt(r.tempo_med_s)} s`])}/></Painel>
      <Painel titulo="Formulações: tabela completa"><Tabela cabecalhos={['Formulação','Respostas','Pessoas','Média','IC 95%','Chamou IA','Tempo mediano']} linhas={d.porFrame.map(r=>[r.nome,r.n,r.participantes,p100(r.acerto),ci(r.ic),p100(r.disseIa),`${nfmt(r.tempoMed)} s`])}/></Painel>
      <Painel titulo="Escuta progressiva: tabela completa"><Tabela cabecalhos={['Pedidos para ouvir mais','Respostas','Acertos']} linhas={d.audio.etapas.map(r=>[r.nome,r.n,p100(r.acerto)])}/></Painel>
      <Painel titulo="Conteúdos que mais confundiram" sub="Ranking de conteúdos individuais com pelo menos cinco exposições válidas; ordens são instáveis com amostras pequenas."><Tabela cabecalhos={['Título interno','Tipo','Origem','Exibições','Acertos','Marcado IA']} linhas={d.difficult.slice(0,35).map(r=>[r.nome||r.id.slice(0,8),TIPOS_ANALISE[r.tipo]||r.tipo,r.origem_ia?'IA':'Humano',r.n_exibicoes,p100(r.pct_acerto),p100(r.marca_ia)])}/></Painel>
      <Painel titulo="Controle de sessões piloto" sub="Marcar como piloto exclui a sessão das análises oficiais, mas preserva os dados e permite reverter."><Tabela cabecalhos={['Identificador','Início','Decisões','Status','Origem','Ação']} linhas={[...d.sessoes].reverse().slice(0,120).map(p=>[
        <span title={p.id}>{String(p.id).slice(0,8)}…</span>,p.inicio?new Date(p.inicio).toLocaleString('pt-BR'):'—',
        `${(p.individuais_respondidas||0)+(p.comparacoes_respondidas||0)}/${p.sorteadas||'?'}`,p.finalizado?'Finalizado':'Em andamento',p.excluir_analise?'Piloto':'Pesquisa',
        <button className="link" disabled={mudando===p.id} onClick={()=>piloto(p)}>{p.excluir_analise?'Reincluir':'Marcar piloto'}</button>
      ])}/>{d.sessoes.length>120&&<p className="mut">Exibindo as 120 sessões mais recentes; os cálculos incluem todas as elegíveis.</p>}</Painel>
    </>}
    <footer className="v5-rodape">As médias e os intervalos são descritivos; a independência costuma estar no participante, não em cada clique. A amostra de conveniência e a exposição desigual aos arquivos limitam a generalização. {v<20?'Com menos de 20 sessões válidas, evite conclusões definitivas.':''}</footer>
  </div>;
}
