import './apresentacao.css';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart,
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import { f1 } from '../lib/formatos';
import { TIPOS, FAIXAS, GENEROS } from '../lib/opcoes';
import { resumo } from '../lib/stats';

const C = { ink:'#202039', muted:'#77758A', violet:'#6545F6', lime:'#B7ED36', amber:'#FFBB43', pink:'#FF8198', teal:'#2BAAA0', pale:'#F2EFFB', white:'#FFFFFF' };
const COLORS = [C.violet, C.lime, C.amber, C.pink, C.teal, '#8B8ED0'];
const fmt = (v,d=1) => v == null || v === '' || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const pct = v => v == null || v === '' || !Number.isFinite(Number(v)) ? '—' : `${fmt(v,1)}%`;
const tooltipStyle = {border:'1px solid #DCD7EA',borderRadius:12,background:'#fff',fontSize:13,boxShadow:'0 8px 24px #21164b12'};

function Topo({t,sub}) { return <header className="deck-topo"><span className="deck-kicker">REAL OU IA? / PESQUISA</span><h2>{t}</h2>{sub&&<p>{sub}</p>}</header>; }
function Rodape({s}) { return <footer className="deck-footer"><span>REAL OU IA?</span><span>{s.totais.participantes} participantes · {s.totais.respostas} respostas individuais · {s.totais.rodadas} comparações</span></footer>; }
function KPI({valor,label,accent}) { return <div className={`deck-kpi ${accent?'accent':''}`}><strong>{valor}</strong><span>{label}</span></div>; }
function Nota({children}) { return <p className="deck-nota">{children}</p>; }
function Painel({children, className=''}) { return <div className={`deck-chart-panel ${className}`}>{children}</div>; }
function Vazio({texto='Não há respostas suficientes para esta visualização.'}) { return <div className="deck-empty">{texto}</div>; }

function Histograma({dados, dataKey='valor'}) {
  if (!dados?.length) return <Vazio/>;
  return <ResponsiveContainer width="100%" height="100%"><BarChart data={dados} margin={{top:22,right:22,bottom:10,left:0}}>
    <CartesianGrid stroke="#EAE7F2" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="nome" tick={{fontSize:11,fill:C.muted}}/><YAxis allowDecimals={false} tick={{fontSize:11,fill:C.muted}} width={34}/>
    <Tooltip contentStyle={tooltipStyle} formatter={v=>[`${fmt(v,0)} participantes`,'Quantidade']}/>
    <Bar dataKey={dataKey} fill={C.violet} radius={[7,7,0,0]} isAnimationActive={false}><LabelList dataKey={dataKey} position="top" style={{fontSize:11,fill:C.ink,fontWeight:800}}/></Bar>
  </BarChart></ResponsiveContainer>;
}
function BarrasPerfil({dados, dataKey='media', cor=C.violet, domain=[0,100], formatPercent=true}) {
  const rows=(dados||[]).filter(x=>Number.isFinite(Number(x[dataKey])));
  if (!rows.length) return <Vazio/>;
  const h=Math.max(245,Math.min(470,rows.length*54+55));
  return <div className="deck-bars" style={{height:h}}><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} layout="vertical" margin={{top:8,right:54,bottom:8,left:8}} barSize={25}>
    <CartesianGrid stroke="#EAE7F2" strokeDasharray="3 5" horizontal={false}/><XAxis type="number" domain={domain} tickFormatter={v=>formatPercent?`${v}%`:fmt(v,0)} tick={{fontSize:11,fill:C.muted}}/><YAxis type="category" dataKey="nome" width={178} tickFormatter={nome=>{const row=rows.find(x=>x.nome===nome);return row?.n!=null?`${nome} (n=${row.n})`:nome;}} tick={{fontSize:11,fill:C.ink}}/><Tooltip contentStyle={tooltipStyle} formatter={v=>[formatPercent?pct(v):fmt(v,0),formatPercent?'Média por participante':'Participantes / valor']}/>
    <Bar dataKey={dataKey} radius={[0,8,8,0]} isAnimationActive={false}>{rows.map((r,i)=><Cell key={r.nome} fill={r.n<10? '#BEB8D0':cor}/>)}<LabelList dataKey={dataKey} position="right" formatter={v=>formatPercent?pct(v):fmt(v,0)} style={{fontSize:11,fill:C.ink,fontWeight:800}}/></Bar>
  </BarChart></ResponsiveContainer></div>;
}
function Donut({dados}) {
  const rows=(dados||[]).filter(x=>x.valor>0);
  if(!rows.length)return <Vazio/>;
  const total=rows.reduce((a,x)=>a+x.valor,0);
  return <div className="deck-donut-wrap"><div className="deck-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} dataKey="valor" nameKey="nome" innerRadius="66%" outerRadius="91%" paddingAngle={2} stroke="none" isAnimationActive={false}>{rows.map((r,i)=><Cell key={r.nome} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(v,n)=>[`${fmt(v,0)} (${pct(100*v/total)})`,n]}/></PieChart></ResponsiveContainer><div className="deck-donut-center"><b>{fmt(total,0)}</b><span>pessoas</span></div></div><div className="deck-legend">{rows.map((r,i)=><div key={r.nome}><i style={{background:COLORS[i%COLORS.length]}}/><span>{r.nome}</span><b>{r.valor}</b></div>)}</div></div>;
}
function RadarTipos({dados}) {
  if(!dados?.length)return <Vazio/>;
  const rows=dados.map(x=>({nome:x.nome,acerto:x.pct}));
  return <ResponsiveContainer width="100%" height="100%"><RadarChart data={rows} outerRadius="72%"><PolarGrid stroke="#E6E1F0"/><PolarAngleAxis dataKey="nome" tick={{fontSize:13,fill:C.ink}}/><Radar name="Acerto" dataKey="acerto" stroke={C.violet} fill={C.violet} fillOpacity={.18} strokeWidth={3}/><Tooltip contentStyle={tooltipStyle} formatter={pct}/></RadarChart></ResponsiveContainer>;
}
function Dispersao({pontos, xLabel='Resultado observado (%)', yLabel='Resultado estimado (%)'}) {
  const validos=(pontos||[]).filter(p=>Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y)));
  if(!validos.length)return <Vazio/>;
  return <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{top:18,right:22,bottom:42,left:10}}>
    <CartesianGrid stroke="#EAE7F2" strokeDasharray="3 5"/><XAxis type="number" dataKey="x" domain={[0,100]} tick={{fontSize:11,fill:C.muted}} tickFormatter={v=>`${v}%`} label={{value:xLabel,position:'insideBottom',offset:-24,fontSize:11,fill:C.muted}}/><YAxis type="number" dataKey="y" domain={[0,100]} tick={{fontSize:11,fill:C.muted}} tickFormatter={v=>`${v}%`} width={42}/><ZAxis range={[65,65]}/>
    <ReferenceLine segment={[{x:0,y:0},{x:100,y:100}]} stroke={C.pink} strokeWidth={2} strokeDasharray="6 5"/><Tooltip contentStyle={tooltipStyle} formatter={v=>pct(v)}/><Scatter data={validos} fill={C.violet} fillOpacity={.62} stroke={C.ink} strokeWidth={.6}/>
  </ScatterChart></ResponsiveContainer>;
}
function Matriz({q}) {
  const cells=[['Era IA','Marcou IA',q.ia_ia,true],['Era IA','Marcou real',q.ia_real,false],['Era real','Marcou IA',q.real_ia,false],['Era real','Marcou real',q.real_real,true]];
  return <div className="deck-matrix">{cells.map(([a,b,v,ok])=><div className={ok?'hit':'miss'} key={a+b}><span>{a}</span><small>{b}</small><strong>{fmt(v,0)}</strong><em>{ok?'acerto':'confusão'}</em></div>)}</div>;
}
function BoxPlot({stats}) {
  if(!stats||![stats.min,stats.max,stats.q1,stats.q3,stats.mediana].every(Number.isFinite))return <Vazio/>;
  const pos=v=>`${Math.max(0,Math.min(100,v))}%`;
  return <div className="deck-boxplot"><div className="deck-boxplot-track"><div className="deck-boxplot-whisker" style={{left:pos(stats.min),width:pos(stats.max-stats.min)}}/><div className="deck-boxplot-box" style={{left:pos(stats.q1),width:pos(stats.q3-stats.q1)}}/><i className="deck-boxplot-median" style={{left:pos(stats.mediana)}}/><i className="deck-boxplot-mean" style={{left:pos(stats.media)}}/></div><div className="deck-boxplot-scale"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><div className="deck-boxplot-legend"><span><i className="median"/>Mediana {pct(stats.mediana)}</span><span><i className="mean"/>Média {pct(stats.media)}</span></div><div className="deck-boxplot-values"><div><small>Mínimo</small><b>{pct(stats.min)}</b></div><div><small>Q1</small><b>{pct(stats.q1)}</b></div><div><small>Q3</small><b>{pct(stats.q3)}</b></div><div><small>Máximo</small><b>{pct(stats.max)}</b></div></div></div>;
}

function EscalaNotas({min,max,marcadores=[],faixas=[]}) {
  const lo=Math.max(0,Math.min(100,min)), hi=Math.max(lo+0.01,Math.min(100,max));
  const x=v=>`${Math.max(0,Math.min(100,v))}%`;
  return <div className="deck-scale-visual">
    <div className="deck-scale-track">
      {faixas.map((f,i)=><div key={i} className={`deck-scale-band ${f.classe||''}`} style={{left:x(f.ini),width:`${Math.max(0,f.fim-f.ini)}%`}}/>)}
      {marcadores.map((m,i)=><div key={i} className={`deck-scale-marker ${m.classe||''}`} style={{left:x(m.valor)}}><i/><b>{m.rotulo}</b><small>{pct(m.valor)}</small></div>)}
    </div>
    <div className="deck-scale-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
  </div>;
}
function MedianaVisual({stats,linhas=[]}) {
  const xs=linhas.map(x=>x.pct).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!xs.length)return <Vazio/>;
  const mid=Math.floor(xs.length/2), val=xs[mid];
  const left=xs.slice(0,mid), right=xs.slice(mid+1);
  return <div className="deck-median-visual">
    <div className="deck-median-summary"><div><b>{left.length}</b><span>abaixo</span></div><div className="central"><b>{pct(val)}</b><span>posição central · {mid+1}ª de {xs.length}</span></div><div><b>{right.length}</b><span>acima</span></div></div>
    <div className="deck-median-dots" aria-label="Distribuição ordenada das notas">{xs.map((v,i)=><i key={i} className={i===mid?'is-median':''} title={`${i+1}ª nota: ${pct(v)}`} style={{left:`${v}%`}}/>)}</div>
    <div className="deck-median-scale"><span>0%</span><span>50%</span><span>100%</span></div>
    <p>Com as notas em ordem crescente, a mediana é o valor que ocupa a posição central.</p>
  </div>;
}
function AmplitudeVisual({stats}) {
  return <div className="deck-amplitude-visual">
    <div className="deck-amplitude-number"><span>Distância entre os extremos</span><b>{fmt(stats.amplitude,2)} <small>p.p.</small></b></div>
    <EscalaNotas min={stats.min} max={stats.max} faixas={[{ini:stats.min,fim:stats.max,classe:'range'}]} marcadores={[{valor:stats.min,rotulo:'Mínimo',classe:'low'},{valor:stats.max,rotulo:'Máximo',classe:'high'}]}/>
    <div className="deck-amplitude-equation"><b>{pct(stats.max)}</b><span>−</span><b>{pct(stats.min)}</b><span>=</span><strong>{fmt(stats.amplitude,2)} p.p.</strong></div>
    <p>A amplitude considera somente o menor e o maior resultado.</p>
  </div>;
}
function VarianciaVisual({linhas,media,variancia}) {
  const xs=linhas.map(x=>x.pct).filter(Number.isFinite);
  const buckets=Array.from({length:10},(_,i)=>({nome:`${i*10}–${i*10+10}`,n:xs.filter(v=>v>=i*10&&(i===9?v<=100:v<(i+1)*10)).length}));
  return <div className="deck-variance-visual">
    <div className="deck-variance-head"><span>Média do grupo</span><b>{pct(media)}</b><small>cada barra mostra quantos participantes ficaram em cada faixa</small></div>
    <div className="deck-variance-bars">{buckets.map((b,i)=><div key={b.nome}><span>{b.n}</span><i style={{height:`${Math.max(3,100*b.n/Math.max(1,...buckets.map(x=>x.n)))}%`}}/><small>{b.nome}</small></div>)}</div>
    <div className="deck-variance-deviation"><span>Distância de cada nota até a média</span><strong>desvios² → média dos quadrados = {fmt(variancia,2)} p.p.²</strong></div>
    <p>A variância aumenta quando os resultados ficam mais afastados da média. Como os desvios são elevados ao quadrado, a unidade também fica ao quadrado.</p>
  </div>;
}
function DesvioVisual({stats}) {
  const lo=Math.max(0,stats.media-stats.desvio),hi=Math.min(100,stats.media+stats.desvio);
  return <div className="deck-sd-visual">
    <div className="deck-sd-head"><span>Faixa de um desvio padrão ao redor da média</span><b>±{fmt(stats.desvio,2)} p.p.</b></div>
    <EscalaNotas min={lo} max={hi} faixas={[{ini:lo,fim:hi,classe:'sd-band'}]} marcadores={[{valor:lo,rotulo:'Média − s',classe:'low'},{valor:stats.media,rotulo:'Média',classe:'mean'},{valor:hi,rotulo:'Média + s',classe:'high'}]}/>
    <div className="deck-sd-equation"><span>{pct(stats.media)} − {fmt(stats.desvio,2)} p.p.</span><b>{pct(lo)} a {pct(hi)}</b><span>{pct(stats.media)} + {fmt(stats.desvio,2)} p.p.</span></div>
    <p>O desvio padrão expressa a dispersão na mesma unidade das notas. A faixa é uma referência de distância, não uma garantia de que todos os resultados estejam nela.</p>
  </div>;
}
function QuartisVisual({stats}) {
  const vals=[stats.min,stats.q1,stats.mediana,stats.q3,stats.max];
  const labels=['Mínimo','Q1 · 25%','Mediana · 50%','Q3 · 75%','Máximo'];
  return <div className="deck-quartile-visual">
    <div className="deck-quartile-track">
      <div className="q-whisker" style={{left:`${vals[0]}%`,width:`${vals[4]-vals[0]}%`}}/>
      <div className="q-segment q-a" style={{left:`${vals[0]}%`,width:`${vals[1]-vals[0]}%`}}/>
      <div className="q-segment q-b" style={{left:`${vals[1]}%`,width:`${vals[2]-vals[1]}%`}}/>
      <div className="q-segment q-c" style={{left:`${vals[2]}%`,width:`${vals[3]-vals[2]}%`}}/>
      <div className="q-segment q-d" style={{left:`${vals[3]}%`,width:`${vals[4]-vals[3]}%`}}/>
    </div>
    <div className="deck-quartile-values">{vals.map((v,i)=><div key={labels[i]}><small>{labels[i]}</small><b>{pct(v)}</b></div>)}</div>
    <div className="deck-iqr-callout"><span>50% central das notas</span><b>{pct(stats.q1)} — {pct(stats.q3)}</b><strong>IIQ = {fmt(stats.iqr,2)} p.p.</strong></div>
    <p>Os quartis dividem a série ordenada em quatro partes. O intervalo interquartil contém a metade central dos resultados.</p>
  </div>;
}

function Perfil(s,campo,ordem) {
  const rows=Array.isArray(s.linhas)?s.linhas:[];
  const labels=[...ordem,...new Set(rows.map(x=>String(x[campo]||'Não informado')).filter(v=>!ordem.includes(v)))];
  return labels.map(nome=>{const xs=rows.filter(x=>String(x[campo]||'Não informado')===nome).map(x=>x.pct).filter(Number.isFinite);const r=resumo(xs);return {nome,n:r.n,media:r.media,mediana:r.mediana,min:r.min,max:r.max,desvio:r.desvio,ic:r.ic};}).filter(x=>x.n>0);
}
function Insight({titulo,children,tipo='neutral'}) { return <div className={`deck-insight ${tipo}`}><b>{titulo}</b><p>{children}</p></div>; }
function Matematica({titulo,definicao,formula,aplicacao,resultado,leitura,base,visual}) {
  return <><Topo t={titulo} sub="Uma ideia estatística, aplicada aos resultados da pesquisa."/><div className="deck-math-layout"><div className="deck-math-copy"><div><span>EM POUCAS PALAVRAS</span><p>{definicao}</p></div><div className="deck-equation"><span>FÓRMULA</span><strong>{formula}</strong></div><div className="deck-equation applied"><span>COM OS DADOS DA PESQUISA</span><strong>{aplicacao}</strong></div><div className="deck-result"><span>RESULTADO</span><b>{resultado}</b></div><p className="deck-reading">{leitura}</p><small>{base}</small></div><div className="deck-math-visual">{visual}</div></div></>;
}
function grupoInsight(rows, nome) {
  const valid=rows.filter(x=>x.n>0&&Number.isFinite(x.media));
  if(!valid.length)return 'Não há grupos com resultados suficientes para comparação.';
  const comparaveis=valid.filter(x=>x.n>=10);
  const base=comparaveis.length>=2?comparaveis:valid;
  const ordenados=[...base].sort((a,b)=>b.media-a.media), top=ordenados[0], low=ordenados.at(-1);
  const pequenos=valid.filter(x=>x.n<10).map(x=>`${x.nome} (n=${x.n})`);
  return `Entre os grupos com base mais consistente, ${top.nome} teve a maior média (${pct(top.media)}; n=${top.n}) e ${low.nome} a menor (${pct(low.media)}; n=${low.n}). ${pequenos.length?`Grupos com menos de 10 participantes: ${pequenos.join(', ')}; os resultados são apenas exploratórios.`:''} A comparação é descritiva e não indica que ${nome.toLowerCase()} cause diferenças no desempenho.`;
}

export function conclusoes(s) {
  const g=s.geral,b=s.balanceada,out=[];
  const geralPct=s.geralPool?.pct ?? g.media;
  const delta=geralPct-50;
  out.push(`Na identificação individual, o acerto geral ponderado pelas respostas foi ${pct(geralPct)}, ${fmt(Math.abs(delta),1)} pontos percentuais ${delta>=0?'acima':'abaixo'} da referência de 50% de uma escolha binária aleatória.`);
  if(s.tipoPool.length>1){const a=[...s.tipoPool].sort((x,y)=>y.pct-x.pct);out.push(`${a[0].nome} teve o maior acerto individual (${pct(a[0].pct)}); ${a.at(-1).nome}, o menor (${pct(a.at(-1).pct)}).`);}
  if(Number.isFinite(b.sens)&&Number.isFinite(b.esp))out.push(`O reconhecimento foi de ${pct(b.sens)} para conteúdos de IA e ${pct(b.esp)} para conteúdos humanos. Os erros ocorreram nos dois sentidos.`);
  if(s.comp.nResp>0)out.push(`Nas comparações, ${pct(s.comp.exatoPool.pct)} dos pares foram totalmente corretos no conjunto das respostas. O acerto exige classificar as duas peças corretamente.`);
  if(s.calib.length>2&&Number.isFinite(s.vies.media))out.push(`Na estimativa dos acertos individuais, houve ${s.vies.media>0?'superestimação':'subestimação'} média de ${fmt(Math.abs(s.vies.media),1)} pontos percentuais em relação ao resultado observado.`);
  out.push('A amostra é voluntária e os resultados descrevem apenas os participantes e materiais avaliados. A formulação das perguntas não pôde ser comparada porque esse dado não está identificado na exportação utilizada.');
  return out;
}

const melhorPior=(a,key='pct')=>{const v=[...a].filter(x=>Number.isFinite(x[key])).sort((x,y)=>y[key]-x[key]);return [v[0],v.at(-1)];};
const dadosHist=s=>s.hist.map(x=>({nome:x.nome,valor:x.n}));

export const SLIDES = [
  {id:'capa',nome:'Capa',padrao:true,semRodape:true,ok:()=>true,render:s=><div className="deck-cover"><span className="deck-cover-tag">PESQUISA · MATEMÁTICA APLICADA</span><div className="deck-cover-mark">REAL <i>OU</i> IA?</div><p>Como reconhecemos conteúdos criados por inteligência artificial?</p><div className="deck-cover-meta"><b>{s.totais.participantes}</b> participantes <i/> <b>{s.totais.respostas}</b> respostas individuais <i/> <b>{s.totais.rodadas}</b> comparações</div><div className="deck-cover-orbit orbit-one"/><div className="deck-cover-orbit orbit-two"/></div>},

  {id:'metodo',nome:'Como funciona a pesquisa',padrao:true,ok:()=>true,semRodape:false,render:s=><><Topo t="Como funciona a atividade?" sub="Duas etapas, com quantidades que podem variar conforme a modalidade realizada por cada participante."/><div className="deck-analysis-grid"><div><span>01</span><p><b>Identificação individual</b><br/>Cada pessoa classifica os conteúdos individuais que recebeu como produzidos por IA ou por uma pessoa.</p></div><div><span>02</span><p><b>Comparação em duplas</b><br/>Cada pessoa avalia os pares apresentados, identificando a origem das duas peças.</p></div><div><span>03</span><p><b>Quantidades variáveis</b><br/>Existiram modalidades com diferentes quantidades de questões. Isso não invalida as respostas realizadas.</p></div><div><span>04</span><p><b>Taxa por participante</b><br/>O percentual individual usa como denominador somente as questões que aquela pessoa respondeu.</p></div><div><span>05</span><p><b>Acerto integral</b><br/>Na comparação, o par só é considerado correto quando as duas classificações estão certas.</p></div><div><span>06</span><p><b>Análise conjunta</b><br/>As respostas válidas são reunidas e vinculadas ao participante, sem exigir o mesmo número de questões para todos.</p></div></div></>},

  {id:'amostra',nome:'Quem participou',padrao:true,ok:s=>s.totais.participantes>0,render:s=><><Topo t="Quem entrou na análise?" sub="Participantes com sessões finalizadas e não excluídas, independentemente da quantidade de questões da modalidade realizada."/><div className="deck-content two-col"><div className="deck-stat-stack"><KPI valor={fmt(s.totais.cadastrados,0)} label="registros cadastrados"/><KPI valor={fmt(s.totais.finalizados,0)} label="sessões finalizadas"/><KPI valor={fmt(s.totais.incompletos,0)} label="sessões não finalizadas"/><div className="deck-hero-number compact"><strong>{fmt(s.totais.participantes,0)}</strong><span>participantes incluídos na análise</span></div></div><div className="deck-stat-stack"><Insight titulo="Critério de inclusão">São consideradas as respostas válidas das sessões finalizadas e não marcadas para exclusão. Cada participante é avaliado com base na quantidade de questões que efetivamente respondeu; não é necessário que todos tenham recebido a mesma quantidade.</Insight><Insight titulo="Limite da amostra">A participação foi voluntária. Os resultados descrevem este grupo e não representam automaticamente a população brasileira.</Insight></div></div></>},

  {id:'geral',nome:'Desempenho geral',padrao:true,ok:s=>s.geral.n>1,render:s=>{const g=s.geral,global=s.geralPool?.pct??g.media;return <><Topo t="Quantos conteúdos conseguimos reconhecer?" sub="Taxa geral calculada sobre todas as respostas individuais válidas; a distribuição mostra a nota de cada participante."/><div className="deck-content two-col"><div className="deck-stat-stack"><div className="deck-hero-number"><strong>{pct(global)}</strong><span>acerto geral · {fmt(s.geralPool?.acertos??0,0)} de {fmt(s.geralPool?.respostas??0,0)} respostas</span></div><div className="deck-mini-grid"><KPI valor={pct(g.media)} label="média das taxas individuais"/><KPI valor={pct(g.mediana)} label="mediana individual"/></div><Insight titulo="Referência de comparação">Uma escolha binária aleatória tem expectativa de 50% de acertos. A taxa geral ficou {fmt(Math.abs(global-50),1)} pontos percentuais {global>=50?'acima':'abaixo'} dessa referência. Isso não transforma a amostra voluntária em representativa da população.</Insight></div><Painel><Histograma dados={dadosHist(s)}/><div className="deck-chart-caption">Distribuição das taxas individuais · uma pessoa por observação</div></Painel></div></>;}},

  {id:'tipo',nome:'Desempenho por formato',padrao:true,ok:s=>s.tipoPool.length>1,render:s=>{const [top,low]=melhorPior(s.tipoPool);const rows=s.tipoPool.map(x=>({nome:x.nome,media:x.pct,n:x.respostas}));return <><Topo t="O formato faz diferença?" sub="Taxa de acerto na identificação individual, separada por modalidade."/><div className="deck-content two-col"><Painel><BarrasPerfil dados={rows} dataKey="media"/></Painel><div className="deck-stat-stack"><KPI valor={pct(top.pct)} label={`maior acerto · ${top.nome}`} accent/><KPI valor={pct(low.pct)} label={`menor acerto · ${low.nome}`}/><Insight titulo="Leitura">A distância entre os formatos foi de {fmt(top.pct-low.pct,1)} pontos percentuais. O resultado depende dos materiais específicos utilizados, não apenas da modalidade.</Insight></div></div></>; }},

  {id:'ia_real',nome:'IA × conteúdo humano',padrao:true,ok:s=>s.balanceada.nIA>0&&s.balanceada.nReal>0,render:s=>{const b=s.balanceada;return <><Topo t="Que tipo de conteúdo confundiu mais?" sub="A matriz separa acertos e confusões conforme a origem verdadeira."/><div className="deck-content two-col"><Painel><Matriz q={s.conf}/></Painel><div className="deck-stat-stack"><KPI valor={pct(b.sens)} label={`IA reconhecida · ${b.nIA} respostas`} accent/><KPI valor={pct(b.esp)} label={`conteúdo humano reconhecido · ${b.nReal} respostas`}/><Insight titulo="Diferença entre as duas taxas">{Math.abs(b.sens-b.esp)>=5?`Houve uma diferença de ${fmt(Math.abs(b.sens-b.esp),1)} pontos percentuais entre reconhecer IA e reconhecer conteúdo humano.`:'As taxas de reconhecimento ficaram próximas nesta amostra.'}</Insight></div></div></>;}},

  {id:'idade',nome:'Resultados por idade',padrao:true,ok:s=>Perfil(s,'faixa_etaria',FAIXAS).length>1,render:s=>{const rows=Perfil(s,'faixa_etaria',FAIXAS);return <><Topo t="Como o desempenho varia por idade?" sub="Média da nota individual em cada faixa etária."/><div className="deck-content two-col"><Painel><BarrasPerfil dados={rows}/></Painel><div className="deck-stat-stack"><Insight titulo="O que aparece nos dados">{grupoInsight(rows,'faixa etária')}</Insight><Nota>As faixas com poucos participantes aparecem em tom neutro. Compare sempre a média junto do tamanho de cada grupo.</Nota></div></div></>;}},
    {id:'freq',nome:'Frequência de uso de IA',padrao:true,ok:s=>s.porFreq.length>1,render:s=><><Topo t="Usar IA com frequência muda o acerto?" sub={`Correlação codificada entre frequência e nota: r = ${f1(s.rFreq,2)}.`}/><div className="deck-content two-col"><Painel><BarrasPerfil dados={s.porFreq.map(x=>({nome:x.rotulo||x.nome.replace(/ \(n=.*\)/,''),media:x.media,n:x.n}))}/></Painel><Insight titulo="Interpretação">As médias variam entre categorias, mas isso não demonstra que usar IA provoque mudança no desempenho. Outros fatores também podem influenciar.</Insight></div></>},
    {id:'esc',nome:'Escolaridade',padrao:true,ok:s=>s.porEsc.length>1,render:s=><><Topo t="Desempenho por escolaridade" sub="Média individual em cada grupo."/><div className="deck-content two-col"><Painel><BarrasPerfil dados={s.porEsc.map(x=>({nome:x.rotulo||x.nome.replace(/ \(n=.*\)/,''),media:x.media,n:x.n}))}/></Painel><Nota>Diferenças descritivas não demonstram que escolaridade cause maior ou menor reconhecimento.</Nota></div></>},

  {id:'genero',nome:'Resultados por gênero',padrao:false,ok:s=>Perfil(s,'genero',GENEROS).length>1,render:s=>{const rows=Perfil(s,'genero',GENEROS);return <><Topo t="E quando comparamos por gênero?" sub="Média de acerto por participante, sem ponderar quem respondeu mais questões."/><div className="deck-content two-col"><Painel><BarrasPerfil dados={rows}/></Painel><div className="deck-stat-stack"><Insight titulo="Leitura dos grupos">{grupoInsight(rows,'gênero')}</Insight><Nota>Grupos pequenos são mantidos, mas suas médias não devem ser generalizadas. A comparação não indica relação causal.</Nota></div></div></>;}},

  {id:'perfil_distribuicao',nome:'Perfil da amostra',padrao:false,ok:s=>s.totais.participantes>0,render:s=>{const age=Perfil(s,'faixa_etaria',FAIXAS),gen=Perfil(s,'genero',GENEROS);return <><Topo t="Quem compõe a amostra?" sub="Distribuição dos participantes por idade e gênero."/><div className="deck-content two-col"><div className="deck-demographic"><h3>Faixa etária</h3><BarrasPerfil dados={age.map(x=>({...x,media:x.n}))} dataKey="media" domain={[0,'auto']} cor={C.teal} formatPercent={false}/></div><div className="deck-demographic"><h3>Gênero</h3><Donut dados={gen.map(x=>({nome:x.nome,valor:x.n}))}/></div></div></>;}},

  {id:'nivel_confianca',nome:'Confiança × desempenho',padrao:true,ok:s=>(s.porConf||[]).length>1,render:s=>{const rows=s.porConf.map(x=>({nome:`Confiança ${x.rotulo||x.nome}`,media:x.media,n:x.n}));return <><Topo t="Confiança significa reconhecer melhor?" sub="Média de acertos individuais conforme a confiança declarada, de 1 a 5."/><div className="deck-content two-col"><Painel><BarrasPerfil dados={rows}/></Painel><div className="deck-stat-stack"><Insight titulo="Leitura">Compare a média de cada nível com o número de participantes. Uma confiança maior não garante, por si só, um desempenho maior.</Insight><Nota>Os grupos pequenos tornam as médias mais instáveis. Esta é uma associação descritiva, não uma relação de causa e efeito.</Nota></div></div></>;}},


  {id:'confianca',nome:'Estimativa × resultado',padrao:true,ok:s=>s.calib.length>2,render:s=>{const dif=s.vies.media;return <><Topo t="Nossa percepção combina com o resultado?" sub="Cada ponto representa uma pessoa: nota real e nota que imaginou ter alcançado."/><div className="deck-content two-col"><Painel><Dispersao pontos={s.calib} xLabel="Acerto real (%)" yLabel="Acerto estimado (%)"/></Painel><div className="deck-stat-stack"><div className="deck-hero-number compact"><strong>{fmt(Math.abs(dif),1)} p.p.</strong><span>{dif>0?'superestimação média':'subestimação média'}</span></div><Insight titulo="Como ler">Pontos próximos à diagonal indicam estimativas próximas do resultado. Acima dela, a pessoa estimou uma nota maior; abaixo, menor.</Insight><Nota>Correlação e proximidade não significam que confiança cause desempenho.</Nota></div></div></>;}},

  {id:'comparacao',nome:'Comparações em duplas',padrao:true,ok:s=>s.comp.cenPool.length>0,render:s=>{const g=s.comp.cenPool;return <><Topo t="Acertar duas peças é mais difícil" sub="Uma dupla só conta como correta quando as duas classificações estão certas."/><div className="deck-content two-col"><Painel><BarrasPerfil dados={g.map(x=>({nome:x.nome,media:x.pct,n:x.respostas}))} dataKey="media"/></Painel><div className="deck-stat-stack"><KPI valor={pct(s.comp.exatoPool?.pct)} label={`pares totalmente corretos · ${s.comp.exatoPool?.acertos ?? 0}/${s.comp.exatoPool?.respostas ?? 0}`} accent/><KPI valor={pct(s.comp.itemPool?.pct)} label="acerto por peça"/><Insight titulo="Referência matemática">No chute aleatório entre duas opções por peça, a chance de acertar as duas é 25% (½ × ½).</Insight></div></div></>;}},

  {id:'comparacao_formatos',nome:'Comparações por modalidade',padrao:true,ok:s=>(s.comp.tipoPool||[]).filter(x=>x.respostas>0).length>1,render:s=>{const rows=(s.comp.tipoPool||[]).filter(x=>x.respostas>0).map(x=>({nome:x.nome,media:x.pct,n:x.respostas}));return <><Topo t="Em quais formatos as duplas foram mais difíceis?" sub="Percentual de pares totalmente corretos, separado por modalidade."/><div className="deck-content two-col"><Painel><BarrasPerfil dados={rows} dataKey="media"/></Painel><div className="deck-stat-stack"><Insight titulo="Como interpretar">Cada barra representa comparações em que as duas peças foram classificadas corretamente. Não é a taxa de acerto por peça.</Insight><Nota>O tamanho da base aparece ao lado de cada modalidade. Diferenças devem ser lidas considerando também a quantidade de pares.</Nota></div></div></>;}},

  {id:'cenarios',nome:'Composição dos pares',padrao:true,ok:s=>(s.comp.cenPool||[]).length>1,render:s=><><Topo t="A composição do par muda o desafio?" sub="Comparações separadas pela quantidade real de conteúdos gerados por IA."/><div className="deck-content two-col"><Painel><BarrasPerfil dados={(s.comp.cenPool||[]).map(x=>({nome:x.nome,media:x.pct,n:x.respostas}))} dataKey="media"/></Painel><div className="deck-stat-stack"><KPI valor={fmt(s.comp.cenPool.reduce((a,x)=>a+x.respostas,0),0)} label="comparações analisadas" accent/><Insight titulo="Os três cenários">Nenhuma peça de IA; uma peça de IA; ou duas peças de IA. O percentual considera o par inteiro como correto somente quando ambas as origens foram identificadas.</Insight></div></div></>},

    {id:'tempo',nome:'Tempo de decisão',padrao:true,ok:s=>s.porTipo.some(x=>Number.isFinite(x.tempoMed)),render:s=><><Topo t="Quanto tempo levamos para decidir?" sub="Mediana do tempo de resposta por modalidade."/><div className="deck-content"><Painel><BarrasPerfil dados={s.porTipo.filter(x=>Number.isFinite(x.tempoMed)).map(x=>({nome:x.nome,media:x.tempoMed,n:x.n}))} dataKey="media" domain={[0,'auto']} cor={C.teal} formatPercent={false}/></Painel><Nota>Tempo mediano em segundos; não é uma medida direta de certeza ou qualidade.</Nota></div></>},

  {id:'enganosos',nome:'Materiais mais difíceis',padrao:true,ok:s=>s.itens.length>=2,render:s=>{const sorted=[...s.itens].sort((a,b)=>a.pct-b.pct),k=Math.min(4,Math.floor(sorted.length/2));return <><Topo t="Quais materiais mais enganaram?" sub="Ranking de conteúdos da etapa individual com pelo menos cinco avaliações."/><div className="deck-content two-col"><div className="deck-rank"><h3>Mais difíceis</h3>{sorted.slice(0,k).map((x,i)=><div className="deck-rank-row" key={x.id}><b>0{i+1}</b><span>{x.tipo==='imagem'?'Imagem':TIPOS[x.tipo]||x.tipo} · {x.eh_ia?'Origem IA':'Origem humana'}<small>{x.n} avaliações</small></span><strong>{pct(x.pct)}</strong></div>)}</div><div className="deck-rank"><h3>Mais reconhecidos</h3>{sorted.slice(-k).reverse().map((x,i)=><div className="deck-rank-row" key={x.id}><b>0{i+1}</b><span>{TIPOS[x.tipo]||x.tipo} · {x.eh_ia?'Origem IA':'Origem humana'}<small>{x.n} avaliações</small></span><strong>{pct(x.pct)}</strong></div>)}</div></div></>;}},

  {id:'dispersao',nome:'Distribuição e dispersão',padrao:true,ok:s=>s.geral.n>2,render:s=><><Topo t="A média não conta a história inteira" sub="A distribuição mostra como as notas individuais se espalham — não apenas onde está o centro."/><div className="deck-content two-col"><div className="deck-stat-stack"><KPI valor={`${fmt(s.geral.desvio,1)} p.p.`} label="desvio padrão" accent/><KPI valor={`${fmt(s.geral.q1,1)}% – ${fmt(s.geral.q3,1)}%`} label="50% central das notas"/><KPI valor={`${fmt(s.geral.min,1)}% – ${fmt(s.geral.max,1)}%`} label="menor e maior nota"/><Insight titulo="Duas leituras complementares">O histograma mostra onde as notas se concentram. O resumo de cinco números mostra extremos, quartis e mediana.</Insight></div><div className="deck-overview-visual"><Painel><h3>Frequência das notas</h3><div className="deck-overview-hist"><Histograma dados={dadosHist(s)}/></div></Painel><Painel><h3>Resumo da distribuição</h3><BoxPlot stats={s.geral}/></Painel></div></div></>},

  {id:'doque',nome:'Análise dos resultados',padrao:true,ok:s=>s.geral.n>1,render:s=><><Topo t="O que os resultados sugerem?" sub="Síntese interpretativa: desempenho, diferenças e limites da pesquisa."/><div className="deck-analysis-grid">{conclusoes(s).slice(0,6).map((x,i)=><div key={i}><span>0{i+1}</span><p>{x}</p></div>)}</div></>},
  {id:'conclusao',nome:'Conclusão',padrao:true,ok:s=>s.geral.n>1,render:s=><div className="deck-ending"><span>EM RESUMO</span><h2>Reconhecer IA não é tão simples quanto parece.</h2><p>Os resultados mostram padrões nesta amostra — e também revelam onde ainda precisamos investigar mais.</p><div><b>{pct(s.geralPool?.pct ?? s.geral.media)}</b><small>acerto geral</small><i/><b>{s.totais.participantes}</b><small>participantes</small></div><small className="deck-caveat">Amostra voluntária: os resultados descrevem os participantes e materiais avaliados, não toda a população.</small></div>},

  {id:'usos',nome:'Para que usam IA',padrao:false,ok:s=>s.usos.some(x=>x.n>0),render:s=><><Topo t="Para que as pessoas usam IA?" sub="Era possível selecionar mais de uma finalidade."/><div className="deck-content"><Painel><BarrasPerfil dados={s.usos.map(x=>({nome:x.nome,media:x.n,n:x.n}))} dataKey="media" domain={[0,'auto']} cor={C.amber} formatPercent={false}/></Painel></div></>},
  {id:'tabela',nome:'Tabela de estatísticas',padrao:false,ok:s=>s.geral.n>1,render:s=><><Topo t="Resumo numérico" sub="Estatísticas descritivas das notas individuais."/><div className="deck-content"><table className="deck-table"><thead><tr><th>Grupo</th><th>n</th><th>Média</th><th>Mediana</th><th>Desvio</th><th>Q1–Q3</th><th>Amplitude</th></tr></thead><tbody>{[{nome:'Geral',...s.geral},...s.porTipo].map(x=><tr key={x.nome}><td>{x.nome}</td><td>{fmt(x.n,0)}</td><td>{pct(x.media)}</td><td>{pct(x.mediana)}</td><td>{fmt(x.desvio,1)}</td><td>{pct(x.q1)}–{pct(x.q3)}</td><td>{fmt(x.amplitude,1)} p.p.</td></tr>)}</tbody></table></div></>},

  {id:'mat_media',nome:'Matemática · Média',padrao:true,ok:s=>s.linhas.length>1,render:s=>{const xs=s.linhas.map(x=>x.pct).filter(Number.isFinite),n=xs.length,sum=xs.reduce((a,b)=>a+b,0),m=sum/n;return <Matematica titulo="Média aritmética" definicao="Soma dos resultados dividida pela quantidade de participantes." formula="x̄ = Σxᵢ ÷ n" aplicacao={`${fmt(sum,2)} ÷ ${n} = ${fmt(m,2)}%`} resultado={pct(m)} leitura="A média resume o desempenho do grupo, dando o mesmo peso à nota de cada participante." base={`n = ${n} notas válidas.`} visual={<><div className="deck-math-big">{pct(m)}</div><Histograma dados={dadosHist(s)}/></>}/>;}},
  {id:'mat_mediana',nome:'Matemática · Mediana',padrao:true,ok:s=>s.linhas.length>1,render:s=>{const xs=s.linhas.map(x=>x.pct).filter(Number.isFinite).sort((a,b)=>a-b),n=xs.length,a=xs[Math.floor((n-1)/2)],b=xs[Math.floor(n/2)],m=(a+b)/2,app=n%2?`x(${(n+1)/2}) = ${fmt(a,2)}%`:`(${fmt(a,2)} + ${fmt(b,2)}) ÷ 2 = ${fmt(m,2)}%`;return <Matematica titulo="Mediana" definicao="Valor central depois de ordenar as notas da menor para a maior." formula={n%2?'Md = x((n + 1) ÷ 2)':'Md = [x(n ÷ 2) + x(n ÷ 2 + 1)] ÷ 2'} aplicacao={app} resultado={pct(m)} leitura="A mediana divide a série ordenada: metade das observações fica antes dela e metade depois. É menos sensível a valores extremos que a média." base={`Série ordenada · n = ${n}.`} visual={<MedianaVisual linhas={s.linhas} stats={s.geral}/>}/>;}},

    {id:'mat_amplitude',nome:'Matemática · Amplitude',padrao:true,ok:s=>s.geral.n>1,render:s=><Matematica titulo="Amplitude total" definicao="Distância entre o maior e o menor resultado observado." formula="A = máximo − mínimo" aplicacao={`${fmt(s.geral.max,2)} − ${fmt(s.geral.min,2)} = ${fmt(s.geral.amplitude,2)} p.p.`} resultado={`${fmt(s.geral.amplitude,2)} p.p.`} leitura="A amplitude mostra a extensão total dos resultados, mas depende apenas dos dois extremos." base={`Base: ${s.geral.n} participantes.`} visual={<AmplitudeVisual stats={s.geral}/>}/>},

    {id:'mat_variancia',nome:'Matemática · Variância',padrao:true,ok:s=>s.geral.n>1,render:s=>{const xs=s.linhas.map(x=>x.pct).filter(Number.isFinite),n=xs.length,m=s.geral.media,sum=xs.reduce((a,x)=>a+(x-m)**2,0),v=sum/(n-1);return <Matematica titulo="Variância amostral" definicao="Média dos quadrados das diferenças entre cada nota e a média, usando n − 1." formula="s² = Σ(xᵢ − x̄)² ÷ (n − 1)" aplicacao={`${fmt(sum,2)} ÷ (${n} − 1) = ${fmt(v,2)} p.p.²`} resultado={`${fmt(v,2)} p.p.²`} leitura="Quanto maior a variância, mais dispersos estão os resultados em torno da média. A unidade fica ao quadrado." base={`Variância amostral · n = ${n}.`} visual={<VarianciaVisual linhas={s.linhas} media={m} variancia={v}/>}/>;}},

    {id:'mat_desvio',nome:'Matemática · Desvio padrão',padrao:true,ok:s=>s.geral.n>1,render:s=><Matematica titulo="Desvio padrão" definicao="Raiz quadrada da variância; mede a dispersão na mesma unidade das notas." formula="s = √s²" aplicacao={`s = √${fmt(s.geral.variancia,2)} = ${fmt(s.geral.desvio,2)} p.p.`} resultado={`${fmt(s.geral.desvio,2)} p.p.`} leitura={`O desvio padrão é de ${fmt(s.geral.desvio,1)} pontos percentuais em torno da média de ${pct(s.geral.media)}. Ele resume o espalhamento, não significa que toda nota esteja exatamente nessa distância.`} base={`Base: ${s.geral.n} participantes.`} visual={<DesvioVisual stats={s.geral}/>}/>},

    {id:'mat_quartis',nome:'Matemática · Quartis',padrao:true,ok:s=>s.geral.n>3,render:s=><Matematica titulo="Quartis e intervalo interquartil" definicao="Q1 marca 25% da distribuição; Q3 marca 75%. Entre eles ficam os 50% centrais." formula="IIQ = Q3 − Q1" aplicacao={`${fmt(s.geral.q3,2)} − ${fmt(s.geral.q1,2)} = ${fmt(s.geral.iqr,2)} p.p.`} resultado={`${fmt(s.geral.iqr,2)} p.p.`} leitura={`A metade central das notas está entre ${pct(s.geral.q1)} e ${pct(s.geral.q3)}.`} base={`Quartis por interpolação · n = ${s.geral.n}.`} visual={<QuartisVisual stats={s.geral}/>}/>},
  {id:'mat_erro_padrao',nome:'Matemática · Erro padrão',padrao:true,ok:s=>s.geral.n>1,render:s=>{const ep=s.geral.desvio/Math.sqrt(s.geral.n),m=s.geral.media;return <Matematica titulo="Erro padrão da média" definicao="Estima a variabilidade da média amostral entre possíveis amostras do mesmo tamanho." formula="EP = s ÷ √n" aplicacao={`${fmt(s.geral.desvio,2)} ÷ √${s.geral.n} = ${fmt(ep,2)} p.p.`} resultado={`${fmt(ep,2)} p.p.`} leitura="O erro padrão tende a diminuir quando o tamanho da amostra aumenta. Ele mede a precisão da média amostral, não a dispersão das notas individuais." base={`Aproximação baseada em n = ${s.geral.n}; amostra voluntária.`} visual={<div className="deck-ep-visual"><div><span>Média observada</span><b>{pct(m)}</b></div><div className="deck-ep-bar"><i style={{left:`${Math.max(0,m-1.96*ep)}%`,width:`${Math.min(100,m+1.96*ep)-Math.max(0,m-1.96*ep)}%`}}/><strong style={{left:`${m}%`}}/></div><div className="deck-ep-labels"><span>{pct(m-1.96*ep)}</span><b>IC aproximado de 95%</b><span>{pct(m+1.96*ep)}</span></div><p>Faixa ilustrativa: média ± 1,96 × erro padrão. Não corrige o viés de uma amostra voluntária.</p></div>}/>;}},

  ];

export function Slide({def,s}) { return <section className="slide deck-slide">{def.render(s)}{!def.semRodape&&<Rodape s={s}/>}</section>; }
