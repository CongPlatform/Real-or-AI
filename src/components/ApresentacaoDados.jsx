import { useEffect, useMemo, useRef, useState, Component } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList,
  Legend, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
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
  return <div className="v16-chart"><ResponsiveContainer width="100%" height="100%"><PieChart>
    <Pie data={rows} nameKey="nome" dataKey="valor" innerRadius="52%" outerRadius="73%" paddingAngle={2} isAnimationActive={false}>
      {rows.map((r,i)=><Cell key={r.nome} fill={PALETA[i%PALETA.length]}/>)}</Pie>
    <Legend verticalAlign="bottom" height={55} formatter={s=><span className="v16-legend">{s}</span>}/>
    <Tooltip contentStyle={tipStyle} formatter={v=>[fnum(v),'Quantidade']}/>
  </PieChart></ResponsiveContainer></div>;
}
function Barras({slide}){
  const {dados=[],chaves=[],eixoMax}=slide;
  const keys=chaves.length?chaves:['acerto'];
  const rows=dados.filter(row=>keys.some(k=>row[k]!=null && Number.isFinite(Number(row[k]))));
  if(!rows.length)return <SemDados/>;
  const height=Math.max(260,Math.min(570,rows.length*48+80));
  return <div className="v16-chart" style={{height:'100%',minHeight:height<320?240:undefined}}>
    <ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={rows} margin={{top:12,right:45,bottom:12,left:10}} barSize={Math.max(14,Math.min(33,240/rows.length))}>
      <CartesianGrid {...grade} horizontal={false}/><XAxis type="number" domain={[0,eixoMax||'auto']} tickFormatter={v=>eixoMax===100?`${v}%`:fnum(v)} tick={{fontSize:11}}/>
      <YAxis type="category" dataKey="nome" width={125} tick={{fontSize:11}}/>
      <Tooltip contentStyle={tipStyle} formatter={(v,k)=>[eixoMax===100?fpct(v):fnum(v),nomes[k]||k]}/>
      {keys.map((k,i)=><Bar key={k} name={nomes[k]||k} dataKey={k} fill={PALETA[i%PALETA.length]} radius={[0,8,8,0]} isAnimationActive={false}>
        {keys.length===1&&<LabelList dataKey={k} position="right" formatter={v=>eixoMax===100?fpct(v):fnum(v)} style={{fontSize:11,fill:'#201B36'}}/>}
      </Bar>)}
      {keys.length>1&&<Legend/>}
    </BarChart></ResponsiveContainer>
  </div>;
}
function Linhas({slide}){
  const {dados=[],chaves=[],eixoMax}=slide;
  if(!dados.some(row=>chaves.some(k=>row[k]!=null&&Number.isFinite(Number(row[k])))))return <SemDados/>;
  return <div className="v16-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={dados} margin={{top:28,right:28,bottom:18,left:8}}>
    <CartesianGrid {...grade}/><XAxis dataKey={slide.vis==='evolucao'?'n':'nome'} tick={{fontSize:11}} interval="preserveStartEnd"/>
    <YAxis domain={[0,eixoMax||'auto']} tickFormatter={v=>eixoMax===100?`${v}%`:fnum(v)}/>
    <Tooltip contentStyle={tipStyle} formatter={(v,k)=>[eixoMax===100?fpct(v):fnum(v,1),nomes[k]||k]}/><Legend/>
    {chaves.map((k,i)=><Line key={k} name={nomes[k]||k} dataKey={k} stroke={PALETA[i===1?4:i]} strokeWidth={3} dot={dados.length<35?{r:3}:false} type="monotone" connectNulls={false} isAnimationActive={false}/>)}
  </LineChart></ResponsiveContainer></div>;
}
function Areas({slide}){
  const dados=slide.dados||[];
  if(!dados.length)return <SemDados/>;
  return <div className="v16-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dados} margin={{top:22,right:20,bottom:18,left:8}}>
    <CartesianGrid {...grade}/><XAxis dataKey="nome" tick={{fontSize:10}} interval="preserveStartEnd"/>
    <YAxis tickFormatter={fnum} allowDecimals={false}/><Tooltip contentStyle={tipStyle}/><Legend/>
    {(slide.chaves||['iniciadas','completas']).map((k,i)=><Area key={k} dataKey={k} name={nomes[k]||k} stroke={PALETA[i===1?4:i]} fill={PALETA[i===1?4:i]} fillOpacity={.15} strokeWidth={3} type="monotone" isAnimationActive={false}/>)}
  </AreaChart></ResponsiveContainer></div>;
}
function Empilhado({slide}){
  const dados=slide.dados||[];
  if(!dados.some(x=>slide.chaves?.some(k=>Number(x[k])>0)))return <SemDados/>;
  return <div className="v16-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={dados} margin={{top:20,right:15,bottom:30,left:0}}>
    <CartesianGrid {...grade}/><XAxis dataKey="nome" tick={{fontSize:11}} interval={0}/><YAxis allowDecimals={false}/>
    <Legend/><Tooltip contentStyle={tipStyle}/>
    {(slide.chaves||[]).map((k,i)=><Bar key={k} dataKey={k} name={nomes[k]||k} stackId="s" fill={PALETA[i%PALETA.length]} isAnimationActive={false}/>)}
  </BarChart></ResponsiveContainer></div>;
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
  return <div className="v16-chart"><ResponsiveContainer width="100%" height="100%"><RadarChart data={values} outerRadius="70%">
    <PolarGrid/><PolarAngleAxis dataKey="nome"/><PolarRadiusAxis domain={[0,100]} tick={{fontSize:11}}/>
    {chaves.map((k,i)=><Radar key={k} name={nomes[k]||k} dataKey={k} stroke={PALETA[i===1?4:i]} fill={PALETA[i===1?4:i]} fillOpacity={i===0?.17:.05} strokeWidth={3} dot/>) }
    {chaves.length>1&&<Legend verticalAlign="bottom"/>}<Tooltip contentStyle={tipStyle} formatter={fpct}/>
  </RadarChart></ResponsiveContainer></div>;
}
function Nuvem({dados}){
  if(!dados?.length)return <SemDados/>;
  return <div className="v16-chart"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{top:20,right:30,bottom:40,left:5}}>
    <CartesianGrid {...grade}/><XAxis type="number" dataKey="x" domain={[1,5]} ticks={[1,2,3,4,5]} name="Confiança" label={{value:'Confiança (1 a 5)',position:'insideBottom',offset:-10}}/>
    <YAxis type="number" dataKey="y" domain={[0,100]} unit="%" name="Nota"/><ZAxis range={[70,70]}/>
    <Tooltip contentStyle={tipStyle} formatter={(v,n)=>[n==='Nota'?fpct(v):fnum(v),n]}/><Scatter data={dados} fill={PALETA[0]} fillOpacity={.7}/>
  </ScatterChart></ResponsiveContainer></div>;
}

// Gráfico de pontos sobre uma régua comum de 0 a 100: legível mesmo projetado em telão.
function Pontos({dados=[],chaves=['acerto']}) {
  const rows=dados.filter(x=>chaves.some(k=>x[k]!=null&&Number.isFinite(Number(x[k]))));
  if(!rows.length)return <SemDados/>;
  return <div className="v18-pontos" role="img" aria-label="Comparativo em pontos sobre uma escala de zero a cem">
    <div className="v18-pontos-escala"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
    {rows.map((row,i)=><div className="v18-pontos-linha" key={`${row.nome}-${i}`}>
      <strong title={row.nome}>{row.nome}</strong>
      <div className="v18-pontos-trilho">{chaves.map((k,j)=>row[k]!=null&&Number.isFinite(Number(row[k]))
        ?<span key={k} className="v18-ponto" style={{left:`${clip(row[k])}%`,background:PALETA[j===1?4:j]}} title={`${nomes[k]||k}: ${fpct(row[k])}`}/>:null)}</div>
      <small>{chaves.map(k=>row[k]==null?'—':fpct(row[k])).join(' · ')}</small>
    </div>)}
    {chaves.length>1&&<div className="v18-pontos-legenda">{chaves.map((k,j)=><span key={k}><i style={{background:PALETA[j===1?4:j]}}/>{nomes[k]||k}</span>)}</div>}
  </div>;
}
// Cada célula indica acerto naquele cruzamento entre modalidade e origem verdadeira.
function Calor({dados=[]}) {
  if(!dados.some(x=>x.ia?.n||x.humano?.n))return <SemDados/>;
  return <div className="v18-calor">
    <div className="v18-calor-cab"><span>Modalidade</span><b>Era IA</b><b>Era humano</b></div>
    {dados.map((r,i)=><div className="v18-calor-linha" key={`${r.nome}-${i}`}><strong>{r.nome}</strong>
      {['ia','humano'].map(k=>{const x=r[k]||{};const v=x.n?clip(100*x.acertos/x.n):null;
        return <div key={k} className="v18-calor-cel" style={{background:v==null?'#F0EDF7':`rgba(91,61,245,${.10+.75*(v/100)})`,color:v!=null&&v>67?'#fff':'#201B36'}}>
          <strong>{v==null?'—':fpct(v)}</strong><span>{x.acertos||0} / {x.n||0} respostas</span>
        </div>;})}
    </div>)}
    <p className="v18-calor-nota">Quanto mais escura a célula, maior a taxa de acerto. Uma célula vazia indica ausência de respostas.</p>
  </div>;
}
// Nuvem: o tamanho da bolha indica a quantidade de classificações recebidas.
function Bolhas({dados=[]}) {
  const rows=dados.filter(x=>x.n>0&&x.pctIA!=null).map(x=>({x:x.n,y:x.pctIA,z:x.n,nome:x.nome,origem:x.origem_ia}));
  if(!rows.length)return <SemDados/>;
  const ia=rows.filter(x=>x.origem===true),hum=rows.filter(x=>x.origem===false);
  return <div className="v16-chart"><ResponsiveContainer width="100%" height="100%">
    <ScatterChart margin={{top:25,right:42,bottom:46,left:8}}><CartesianGrid {...grade}/>
      <XAxis type="number" dataKey="x" name="Avaliações" allowDecimals={false} domain={[0,'dataMax+1']} label={{value:'Quantidade de avaliações por material',position:'insideBottom',offset:-12}}/>
      <YAxis type="number" dataKey="y" name="Votos IA (%)" domain={[0,100]} unit="%"/>
      <ZAxis type="number" dataKey="z" name="Exibições" range={[60,470]}/>
      <Tooltip contentStyle={tipStyle} cursor={{strokeDasharray:'3 3'}} content={({active,payload})=>active&&payload?.[0]?.payload
        ?<div className="v18-tooltip"><b>{payload[0].payload.nome}</b><span>{payload[0].payload.x} avaliações · {fpct(payload[0].payload.y)} votos IA</span><span>Origem: {payload[0].payload.origem?'IA':'Humano'}</span></div>:null}/>
      <Legend/><Scatter name="Era IA" data={ia} fill={PALETA[0]} fillOpacity={.65}/>
      <Scatter name="Era humano" data={hum} fill={PALETA[4]} fillOpacity={.65}/>
    </ScatterChart></ResponsiveContainer></div>;
}
function Quartis({dados=[]}) {
  const values=dados.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!values.length)return <SemDados/>;
  const q=f=>{const pos=(values.length-1)*f,low=Math.floor(pos),high=Math.ceil(pos);return values[low]+(values[high]-values[low])*(pos-low);};
  const min=clip(values[0]),q1=clip(q(.25)),md=clip(q(.5)),q3=clip(q(.75)),max=clip(values.at(-1));
  return <div className="v18-quartis" role="img" aria-label={`Distribuição de ${values.length} notas. Mínimo ${fpct(min)}, mediana ${fpct(md)}, máximo ${fpct(max)}`}>
    <div className="v18-quartis-eixo"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
    <div className="v18-quartis-trilho"><div className="v18-quartis-bigode" style={{left:`${min}%`,width:`${max-min}%`}}/>
      <div className="v18-quartis-caixa" style={{left:`${q1}%`,width:`${q3-q1}%`}}/>
      <i className="v18-quartis-mediana" style={{left:`${md}%`}}/>
    </div><div className="v18-quartis-valores">{[['Mínimo',min],['Q1',q1],['Mediana',md],['Q3',q3],['Máximo',max]].map(([l,v])=><div key={l}><small>{l}</small><b>{fpct(v)}</b></div>)}</div>
    <p>Metade das notas está dentro da caixa (entre Q1 e Q3). A linha escura representa a mediana. Base: {values.length} pessoas.</p>
  </div>;
}
function Mosaico({valor}) {
  const v=clip(valor);if(v==null)return <SemDados/>;
  const squares=Math.round(v);
  return <div className="v18-mosaico"><div className="v18-mosaico-celulas" role="img" aria-label={`${fpct(v)} de acerto, mostrado como cem quadrados`}>
    {Array.from({length:100},(_,i)=><span key={i} className={i<squares?'aceso':''}/>)}</div>
    <p><b>{fpct(v)}</b><span>Cada quadradinho representa aproximadamente 1 ponto percentual.</span></p>
  </div>;
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
    case 'dispersao':return <Nuvem dados={slide.dados}/>;
    case 'matriz':return <Matriz q={slide.dados}/>;
    case 'pontos':return <Pontos dados={slide.dados} chaves={slide.chaves||['acerto']}/>;
    case 'calor':return <Calor dados={slide.dados}/>;
    case 'bolhas':return <Bolhas dados={slide.dados}/>;
    case 'quartis':return <Quartis dados={slide.dados}/>;
    case 'mosaico':return <Mosaico valor={slide.valor}/>;
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
