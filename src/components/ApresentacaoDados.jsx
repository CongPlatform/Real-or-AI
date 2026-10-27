import { useEffect, useMemo, useRef, useState, Component } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList,
  Legend, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid,
  Radar, RadarChart, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis
} from 'recharts';
import { montarSlidesPesquisa } from '../lib/slidesPesquisa';

const PALETA=['#6545F6','#B7ED36','#FFBB43','#FF8198','#2BAAA0','#8B8ED0'];
const fnum=(v,dec=0)=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('pt-BR',{minimumFractionDigits:dec,maximumFractionDigits:dec});
const fpct=v=>v==null||!Number.isFinite(Number(v))?'—':`${fnum(v,1)}%`;
const clip=v=>v==null||!Number.isFinite(Number(v))?null:Math.min(100,Math.max(0,Number(v)));
const tipStyle={border:'2px solid #201B36',borderRadius:12,backgroundColor:'#fff',fontSize:13};
const grade={stroke:'#E7E3F2',strokeDasharray:'4 5'};
const nomes={acerto:'Acertos',disseIa:'Marcou IA',porcentagemExata:'Duplas certas',porcentagemPeca:'Peças certas',
  observada:'Média observada',previsao:'Projeção ilustrativa',exatas:'Duplas certas',erros:'Duplas com erro',
  marcou0:'Marcou 0 IA',marcou1:'Marcou 1 IA',marcou2:'Marcou 2 IA',iniciadas:'Iniciadas',completas:'Concluídas'};
// Legendas externas ao SVG: evitam a sobreposição do Recharts com eixos e rótulos.
function LegendaExterna({itens=[]}){
  if(itens.length<2)return null;
  return <div className="v31-legenda" role="list" aria-label="Legenda do gráfico">{itens.map((it,i)=><span role="listitem" key={it.nome} className="v31-legenda-item"><i style={{background:it.cor||PALETA[i%PALETA.length]}}/>{it.nome}</span>)}</div>;
}
function MolduraGrafico({children,legenda=[],compacta=false}){
 return <div className={'v31-grafico'+(compacta?' v31-grafico-compacto':'')}><div className="v31-grafico-corpo">{children}</div><LegendaExterna itens={legenda}/></div>;
}
const legendaChaves=(chaves,cores)=>chaves.map((k,i)=>({nome:nomes[k]||k,cor:cores?.[i]||PALETA[i%PALETA.length]}));
function SemDados({texto='Ainda não existem observações suficientes para este gráfico.'}){
  return <div className="v16-sem-dados">{texto}</div>;
}
function Anel({valor}){
  const p=clip(valor);
  if(p===null)return <SemDados/>;
  return <div className="v16-anel"><ResponsiveContainer width="100%" height="100%"><PieChart>
    <Pie data={[{nome:'Resultado',v:Math.max(.0001,p)},{nome:'Restante',v:Math.max(.0001,100-p)}]}
      dataKey="v" nameKey="nome" innerRadius="77%" outerRadius="96%" startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
      <Cell fill={PALETA[0]}/><Cell fill="#E9E5F4"/>
    </Pie>
  </PieChart></ResponsiveContainer><div className="v16-anel-centro"><strong>{fpct(p)}</strong><span>de 100%</span></div></div>;
}
function Donut({dados}){
  const rows=(dados||[]).filter(x=>Number(x.valor)>0);
  if(!rows.length)return <SemDados/>;
  return <MolduraGrafico legenda={rows.map((r,i)=>({nome:r.nome,cor:PALETA[i%PALETA.length]}))}><ResponsiveContainer width="100%" height="100%"><PieChart>
    <Pie data={rows} nameKey="nome" dataKey="valor" innerRadius="52%" outerRadius="73%" paddingAngle={2} isAnimationActive={false}>
      {rows.map((r,i)=><Cell key={r.nome} fill={PALETA[i%PALETA.length]}/>)}</Pie>
    <Tooltip contentStyle={tipStyle} formatter={v=>[fnum(v),'Quantidade']}/>
  </PieChart></ResponsiveContainer></MolduraGrafico>;
}
function Barras({slide}){
  const {dados=[],chaves=[],eixoMax}=slide;
  const keys=chaves.length?chaves:['acerto'];
  const rows=dados.filter(row=>keys.some(k=>row[k]!=null && Number.isFinite(Number(row[k]))));
  if(!rows.length)return <SemDados/>;
  const height=Math.max(260,Math.min(570,rows.length*48+80));
  return <MolduraGrafico legenda={keys.length>1?legendaChaves(keys):[]}>
    <ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={rows} margin={{top:12,right:45,bottom:12,left:10}} barSize={Math.max(14,Math.min(33,240/rows.length))}>
      <CartesianGrid {...grade} horizontal={false}/><XAxis type="number" domain={[0,eixoMax||'auto']} tickFormatter={v=>eixoMax===100?`${v}%`:fnum(v)} tick={{fontSize:11}}/>
      <YAxis type="category" dataKey="nome" width={125} tick={{fontSize:11}}/>
      <Tooltip contentStyle={tipStyle} formatter={(v,k)=>[eixoMax===100?fpct(v):fnum(v),nomes[k]||k]}/>
      {keys.map((k,i)=><Bar key={k} name={nomes[k]||k} dataKey={k} fill={PALETA[i%PALETA.length]} radius={[0,8,8,0]} isAnimationActive={false}>
        {keys.length===1&&<LabelList dataKey={k} position="right" formatter={v=>eixoMax===100?fpct(v):fnum(v)} style={{fontSize:11,fill:'#201B36'}}/>}
      </Bar>)}
    </BarChart></ResponsiveContainer>
  </MolduraGrafico>;
}
function Linhas({slide}){
  const {dados=[],chaves=[],eixoMax}=slide;
  if(!dados.some(row=>chaves.some(k=>row[k]!=null&&Number.isFinite(Number(row[k])))))return <SemDados/>;
  return <MolduraGrafico legenda={legendaChaves(chaves,chaves.map((k,i)=>PALETA[i===1?4:i]))}><ResponsiveContainer width="100%" height="100%"><LineChart data={dados} margin={{top:28,right:28,bottom:18,left:8}}>
    <CartesianGrid {...grade}/><XAxis dataKey={slide.vis==='evolucao'?'n':'nome'} tick={{fontSize:11}} interval="preserveStartEnd"/>
    <YAxis domain={[0,eixoMax||'auto']} tickFormatter={v=>eixoMax===100?`${v}%`:fnum(v)}/>
    <Tooltip contentStyle={tipStyle} formatter={(v,k)=>[eixoMax===100?fpct(v):fnum(v,1),nomes[k]||k]}/>
    {chaves.map((k,i)=><Line key={k} name={nomes[k]||k} dataKey={k} stroke={PALETA[i===1?4:i]} strokeWidth={3} dot={dados.length<35?{r:3}:false} type="monotone" connectNulls={false} isAnimationActive={false}/>)}
  </LineChart></ResponsiveContainer></MolduraGrafico>;
}
function Areas({slide}){
  const dados=slide.dados||[];
  if(!dados.length)return <SemDados/>;
  return <MolduraGrafico legenda={legendaChaves(slide.chaves||['iniciadas','completas'],(slide.chaves||['iniciadas','completas']).map((k,i)=>PALETA[i===1?4:i]))}><ResponsiveContainer width="100%" height="100%"><AreaChart data={dados} margin={{top:22,right:20,bottom:18,left:8}}>
    <CartesianGrid {...grade}/><XAxis dataKey="nome" tick={{fontSize:10}} interval="preserveStartEnd"/>
    <YAxis tickFormatter={fnum} allowDecimals={false}/><Tooltip contentStyle={tipStyle}/>
    {(slide.chaves||['iniciadas','completas']).map((k,i)=><Area key={k} dataKey={k} name={nomes[k]||k} stroke={PALETA[i===1?4:i]} fill={PALETA[i===1?4:i]} fillOpacity={.15} strokeWidth={3} type="monotone" isAnimationActive={false}/>)}
  </AreaChart></ResponsiveContainer></MolduraGrafico>;
}
function Empilhado({slide}){
  const dados=slide.dados||[];
  if(!dados.some(x=>slide.chaves?.some(k=>Number(x[k])>0)))return <SemDados/>;
  return <MolduraGrafico legenda={legendaChaves(slide.chaves||[])}><ResponsiveContainer width="100%" height="100%"><BarChart data={dados} margin={{top:20,right:15,bottom:30,left:0}}>
    <CartesianGrid {...grade}/><XAxis dataKey="nome" tick={{fontSize:11}} interval={0}/><YAxis allowDecimals={false}/><Tooltip contentStyle={tipStyle}/>
    {(slide.chaves||[]).map((k,i)=><Bar key={k} dataKey={k} name={nomes[k]||k} stackId="s" fill={PALETA[i%PALETA.length]} isAnimationActive={false}/>)}
  </BarChart></ResponsiveContainer></MolduraGrafico>;
}
function Histograma({dados}){
  if(!dados?.length)return <SemDados/>;
  return <div className="v16-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={dados} margin={{top:20,right:16,bottom:20,left:0}}>
    <CartesianGrid {...grade} vertical={false}/><XAxis dataKey="nome" tick={{fontSize:11}}/>
    <YAxis allowDecimals={false}/><Tooltip contentStyle={tipStyle} formatter={v=>[`${fnum(v)} pessoas`,'Participantes']}/>
    <Bar dataKey="quantidade" fill={PALETA[0]} radius={[8,8,0,0]} isAnimationActive={false}>
      <LabelList dataKey="quantidade" position="top"/>
    </Bar>
  </BarChart></ResponsiveContainer></div>;
}
function RadarModalidade({dados,chaves=['acerto']}){
  const values=(dados||[]).filter(x=>chaves.some(k=>x[k]!=null&&Number.isFinite(Number(x[k]))));
  if(!values.length)return <SemDados/>;
  return <MolduraGrafico legenda={legendaChaves(chaves)}><ResponsiveContainer width="100%" height="100%"><RadarChart data={values} outerRadius="69%">
    <PolarGrid/><PolarAngleAxis dataKey="nome" tick={{fontSize:12}}/>
    {chaves.map((k,i)=><Radar key={k} name={nomes[k]||k} dataKey={k} stroke={PALETA[i%PALETA.length]} fill={PALETA[i%PALETA.length]} fillOpacity={i===0?.12:.045} strokeWidth={2.7}/>)}<Tooltip contentStyle={tipStyle} formatter={fpct}/>
  </RadarChart></ResponsiveContainer></MolduraGrafico>;
}
function DispersaoGenerica({slide}){
  const validos=(slide.dados||[]).filter(x=>Number.isFinite(Number(x.x))&&Number.isFinite(Number(x.y)));
  if(!validos.length)return <SemDados/>;
  const grupos=slide.grupos||[...new Set(validos.map(x=>x.grupo||'Observações'))];
  const limiteX=Math.max(1,...validos.map(x=>Number(x.x)));
  return <MolduraGrafico legenda={grupos.length>1?grupos.map((g,i)=>({nome:g,cor:PALETA[i%PALETA.length]})):[]}><ResponsiveContainer width="100%" height="100%">
    <ScatterChart margin={{top:24,right:24,bottom:66,left:15}}>
      <CartesianGrid {...grade}/>
      <XAxis type="number" dataKey="x" name={slide.rotuloX||'Quantidade'} domain={slide.maxX===100?[0,100]:[0,Math.ceil(limiteX*1.08)]} allowDecimals={false} label={{value:slide.rotuloX||'Quantidade',position:'insideBottom',offset:-20}}/>
      <YAxis type="number" dataKey="y" name={slide.rotuloY||'Acerto (%)'} domain={[0,100]} unit="%"/>
      <ZAxis dataKey="z" range={[80,210]}/>
      <Tooltip cursor={{strokeDasharray:'3 3'}} content={({active,payload})=>!active||!payload?.length?null:<div className="v18-tooltip"><strong>{payload[0]?.payload?.nome||'Observação'}</strong><span>{slide.rotuloX||'Eixo X'}: {fnum(payload[0]?.payload?.x,1)}</span><span>{slide.rotuloY||'Eixo Y'}: {fpct(payload[0]?.payload?.y)}</span></div>}/>
      {grupos.map((g,i)=><Scatter key={g} name={g} data={validos.filter(x=>(x.grupo||'Observações')===g)} fill={PALETA[i%PALETA.length]} fillOpacity={.82}/>)}
    </ScatterChart>
  </ResponsiveContainer></MolduraGrafico>;
}
function MapaCalor({slide}){
  const rows=slide.dados||[], cols=slide.chaves||[];
  if(!rows.length||!cols.length)return <SemDados/>;
  const color=v=>v==null?'#F0EDF7':`rgba(101,69,246,${Math.min(.94,.12+.79*Math.max(0,Math.min(100,Number(v)))/100)})`;
  return <div className="v18-calor" role="table" aria-label={slide.titulo}>
    <div className="v18-calor-head" style={{gridTemplateColumns:`minmax(100px,1.4fr) repeat(${cols.length},minmax(85px,1fr))`}}><span>Modalidade</span>{cols.map(x=><strong key={x}>{slide.rotulos?.[x]||x}</strong>)}</div>
    {rows.map(row=><div className="v18-calor-row" key={row.nome} style={{gridTemplateColumns:`minmax(100px,1.4fr) repeat(${cols.length},minmax(85px,1fr))`}}>
      <strong>{row.nome}</strong>{cols.map(k=><div key={k} style={{background:color(row[k]),color:row[k]>=57?'white':'#16122D'}} title={`${row.nome}, ${slide.rotulos?.[k]||k}: ${fpct(row[k])}`}>
        {fpct(row[k])}<small>{row[`${k}_n`]!=null?`n=${fnum(row[`${k}_n`])}`:''}</small>
      </div>)}
    </div>)}<p>Quanto mais intenso o roxo, maior a porcentagem. Uma célula sem respostas aparece como —.</p>
  </div>;
}
function Nuvem({dados}){
  if(!dados?.length)return <SemDados/>;
  return <div className="v16-chart"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{top:20,right:30,bottom:40,left:5}}>
    <CartesianGrid {...grade}/><XAxis type="number" dataKey="x" domain={[1,5]} ticks={[1,2,3,4,5]} name="Confiança" label={{value:'Confiança (1 a 5)',position:'insideBottom',offset:-10}}/>
    <YAxis type="number" dataKey="y" domain={[0,100]} unit="%" name="Nota"/><ZAxis range={[70,70]}/>
    <Tooltip contentStyle={tipStyle} formatter={(v,n)=>[n==='Nota'?fpct(v):fnum(v),n]}/><Scatter data={dados} fill={PALETA[0]} fillOpacity={.7}/>
  </ScatterChart></ResponsiveContainer></div>;
}
function Matriz({q={}}){
  const ia=(q.vv||0)+(q.vf||0),hum=(q.ff||0)+(q.fv||0);
  return <div className="v16-matriz">{[
    {nome:'IA → votou IA',v:q.vv,b:ia,ok:true},
    {nome:'IA → votou humano',v:q.vf,b:ia,ok:false},
    {nome:'Humano → votou IA',v:q.fv,b:hum,ok:false},
    {nome:'Humano → votou humano',v:q.ff,b:hum,ok:true}
  ].map(x=><div className={x.ok?'certo':'errado'} key={x.nome}><small>{x.nome}</small><strong>{fnum(x.v)}</strong><span>{x.b?fpct(100*x.v/x.b):'—'} desta origem</span></div>)}</div>;
}
function Tabela({dados}){
  if(!dados?.length)return <SemDados/>;
  const colunas=[...new Set(dados.flatMap(x=>Object.keys(x)))];
  const cab={nome:'Grupo / material',n:'Avaliações',votos:'Votos',acerto:'Acerto',media:'Média',porcentagem:'Taxa',marcouIA:'Marcou IA',participantes:'Pessoas',
    duplasCertas:'Duplas certas',pecas:'Peças',exibicoes:'Exibições',origem:'Origem',mediana:'Mediana',ic:'IC 95%',n_exibicoes:'Exibições'};
  const form=(v,k)=>Array.isArray(v)?`${fpct(v[0])} a ${fpct(v[1])}`:typeof v==='number'&&(/^(acerto|media|porcentagem|marcouIA|mediana)$/.test(k))?fpct(v):typeof v==='number'?fnum(v):v==null?'—':String(v);
  return <div className="v16-table-scroll"><table className="v16-table"><thead><tr>{colunas.map(k=><th key={k}>{cab[k]||k}</th>)}</tr></thead><tbody>
    {dados.map((row,i)=><tr key={i}>{colunas.map(k=><td key={k} title={String(row[k]??'')}>{form(row[k],k)}</td>)}</tr>)}
  </tbody></table></div>;
}
function Visual({slide}){
  switch(slide.vis){
    case 'anel':return <Anel valor={slide.valor}/>;
    case 'numero':return <div className="v16-numero"><strong>{fnum(slide.valor,Number(slide.valor)%1?1:0)}{slide.sufixo||''}</strong><span>{slide.unidade}</span></div>;
    case 'donut':return <Donut dados={slide.dados}/>;
    case 'barras':return <Barras slide={slide}/>;
    case 'multilinha':case 'evolucao':return <Linhas slide={slide}/>;
    case 'area':return <Areas slide={slide}/>;
    case 'empilhado':return <Empilhado slide={slide}/>;
    case 'histograma':return <Histograma dados={slide.dados}/>;
    case 'radar':return <RadarModalidade dados={slide.dados} chaves={slide.chaves||['acerto']}/>;
    case 'dispersao-flex':return <DispersaoGenerica slide={slide}/>;
    case 'calor':return <MapaCalor slide={slide}/>;
    case 'dispersao':return <Nuvem dados={slide.dados}/>;
    case 'matriz':return <Matriz q={slide.dados}/>;
    case 'tabela':return <Tabela dados={slide.dados}/>;
    case 'formula':return <div className="v16-formula"><span>FÓRMULA</span><p>{slide.formula}</p><strong>{Array.isArray(slide.valor)?`${fpct(slide.valor[0])} a ${fpct(slide.valor[1])}`:fpct(slide.valor)}</strong><small>{slide.base}</small></div>;
    case 'conclusao':return <div className="v16-conclusao"><b>01 · Descrever</b><span>O que cada medida realmente representa</span><b>02 · Comparar</b><span>Parte 1 versus Parte 2, sem misturar bases</span><b>03 · Contextualizar</b><span>Limites de amostra, exposição e participação</span></div>;
    default:return <SemDados/>;
  }
}
class VisualSeguro extends Component {
  constructor(props){super(props);this.state={erro:false};}
  static getDerivedStateFromError(){return {erro:true};}
  componentDidCatch(error){console.error('Falha no gráfico de apresentação:',error);}
  componentDidUpdate(prevProps){if(prevProps.chave!==this.props.chave && this.state.erro)this.setState({erro:false});}
  render(){return this.state.erro?<SemDados texto="Este gráfico não pôde ser desenhado. Avance para os próximos slides; os demais dados permanecem disponíveis."/>:this.props.children;}
}
export default function ApresentacaoDados({d,comparacoes,comparacoesDetalhes=[],media40,amostra40,meta=100,atual,aoFechar}){
  const [pagina,setPagina]=useState(0);
  const [indice,setIndice]=useState(false);
  const root=useRef(null);
  const slides=useMemo(()=>montarSlidesPesquisa({d,comparacoes,comparacoesDetalhes,media40,amostra40,meta}),
    [d,comparacoes,comparacoesDetalhes,media40,amostra40,meta]);
  const max=Math.max(0,slides.length-1);
  const slide=slides[Math.min(pagina,max)];
  const secoes=useMemo(()=>slides.reduce((s,x,i)=>{if(!s.some(y=>y.nome===x.secao))s.push({nome:x.secao,i});return s;},[]),[slides]);
  const ir=i=>{setPagina(Math.max(0,Math.min(max,i)));setIndice(false);};
  const sair=()=>{
    if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});
    aoFechar();
  };
  useEffect(()=>{
    const key=e=>{
      if(e.target instanceof HTMLElement && ['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName))return;
      if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){e.preventDefault();setPagina(n=>Math.min(n+1,max));}
      if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();setPagina(n=>Math.max(n-1,0));}
      if(e.key==='Home'){e.preventDefault();setPagina(0);}
      if(e.key==='End'){e.preventDefault();setPagina(max);}
      if(e.key==='Escape'){setIndice(false);sair();}
    };
    document.addEventListener('keydown',key);
    const prev=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return ()=>{document.removeEventListener('keydown',key);document.body.style.overflow=prev;};
  },[max,aoFechar]);
  return <div className="v15-apresentacao v16-apresentacao" ref={root} role="dialog" aria-modal="true" aria-label="Apresentação completa dos dados">
    <header className="v15-slide-header v16-header">
      <span className="v15-marca">REAL OU IA? <small>APRESENTAÇÃO COMPLETA</small></span>
      <div className="v15-slide-acoes">
        <button type="button" onClick={()=>setIndice(v=>!v)} aria-expanded={indice}>☰ Índice ({secoes.length} seções)</button>
        <button type="button" onClick={()=>root.current?.requestFullscreen?.().catch(()=>{})}>⛶ Tela cheia</button>
        <button type="button" onClick={sair}>✕ Sair</button>
      </div>
    </header>
    {indice?<div className="v16-indice" role="navigation" aria-label="Índice das seções">
      <h2>Navegar pelos dados</h2><p>Selecione uma seção. Cada gráfico, tabela e indicador tem seu próprio slide.</p>
      <div className="v16-indice-grid">{secoes.map((sec,k)=><button type="button" key={sec.nome} onClick={()=>ir(sec.i)}>
        <span>{fnum(k+1).padStart(2,'0')}</span><strong>{sec.nome.replace(/^\d+ · /,'')}</strong><small>Começa no slide {sec.i+1}</small>
      </button>)}</div>
    </div>:<main className="v15-slide-main v16-main" key={slide.id}>
      <section className="v15-slide-texto v16-texto"><span className="v15-slide-etiqueta">{slide.secao}</span>
        <h1>{slide.titulo}</h1>
        {(slide.vis==='anel'||slide.vis==='numero')&&<strong className="v16-destaque">{slide.vis==='anel'?fpct(slide.valor):`${fnum(slide.valor,Number(slide.valor)%1?1:0)}${slide.sufixo||''}`}</strong>}
        {slide.unidade&&<p className="v15-slide-unidade">{slide.unidade}</p>}
        <p className="v15-slide-explicacao">{slide.descricao}</p>
        <div className="v15-slide-base">Base: {slide.base||'Amostra válida do protocolo atual'}</div>
      </section>
      <section className="v15-slide-visual v16-visual" aria-label={`Visualização: ${slide.titulo}`}>
        <VisualSeguro chave={slide.id}><Visual slide={slide}/></VisualSeguro>
      </section>
    </main>}
    <footer className="v15-slide-footer"><span>{pagina+1} / {slides.length}</span>
      <div className="v15-slide-progresso"><i style={{width:`${slides.length?100*(pagina+1)/slides.length:0}%`}}/></div>
      <div className="v15-slide-navegacao"><button type="button" disabled={pagina===0} onClick={()=>ir(pagina-1)}>← Anterior</button>
        <button type="button" disabled={pagina===max} onClick={()=>ir(pagina+1)}>Próximo →</button></div>
    </footer>
    <div className="v15-slide-dica">← → para navegar · Índice por seção · Atualizado {atual?.toLocaleString('pt-BR')||'—'}</div>
  </div>;
}
