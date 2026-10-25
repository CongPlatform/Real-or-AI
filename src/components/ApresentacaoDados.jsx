import { useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, LabelList, Legend } from 'recharts';

const ROXO='#6745F5';
const VERDE='#BCF13E';
const AMARELO='#FFBF4C';
const ROSA='#FF859A';
const pct=v=>v==null || !Number.isFinite(Number(v))?'—':`${Number(v).toFixed(1).replace('.',',')}%`;
const num=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('pt-BR'):'—';
const safe=v=>v==null||!Number.isFinite(Number(v))?null:Math.max(0,Math.min(100,Number(v)));

function GraficoAnel({valor,cor=ROXO}){
  const v=safe(valor);
  if(v==null)return <div className="v15-slide-sem-dados">Sem observações neste recorte</div>;
  return <div className="v15-anel-wrap">
    <ResponsiveContainer width="100%" height="100%"><PieChart>
      <Pie data={[{nome:'Resultado',valor:Math.max(.001,v)},{nome:'Restante',valor:Math.max(.001,100-v)}]}
        dataKey="valor" innerRadius="75%" outerRadius="96%" startAngle={90} endAngle={-270} paddingAngle={0} stroke="none" isAnimationActive>
        <Cell fill={cor}/><Cell fill="#E9E6F4"/>
      </Pie>
    </PieChart></ResponsiveContainer>
    <div className="v15-anel-centro"><strong>{pct(v)}</strong><small>de 100%</small></div>
  </div>;
}
function GraficoBarras({linhas,cor=ROXO}){
  const pontos=(linhas||[]).filter(x=>x.valor!=null&&Number.isFinite(Number(x.valor)));
  if(!pontos.length)return <div className="v15-slide-sem-dados">Sem avaliações suficientes para o gráfico.</div>;
  return <div className="v15-grafico-container"><ResponsiveContainer width="100%" height="100%">
    <BarChart data={pontos} layout="vertical" margin={{top:12,right:42,bottom:12,left:8}} barSize={32}>
      <CartesianGrid strokeDasharray="4 9" horizontal={false} stroke="#E7E3F3"/>
      <XAxis type="number" domain={[0,100]} tickFormatter={x=>`${x}%`} tick={{fontSize:12}}/>
      <YAxis dataKey="nome" type="category" width={118} tick={{fontSize:13,fontWeight:650}}/>
      <Tooltip formatter={x=>pct(x)} contentStyle={{borderRadius:14,border:'2px solid #17132E'}}/>
      <Bar dataKey="valor" name="Resultado" radius={[0,10,10,0]} fill={cor}>
        {pontos.map((r,i)=><Cell key={r.nome+i} fill={[cor,VERDE,AMARELO,ROSA][i%4]}/>)}
        <LabelList dataKey="valor" position="right" formatter={x=>pct(x)} style={{fontSize:13,fontWeight:750,fill:'#17132E'}}/>
      </Bar>
    </BarChart>
  </ResponsiveContainer></div>;
}
function GraficoCenarios({cenarios}){
  const dados=(cenarios||[]).filter(x=>x.n>0).map(x=>({nome:x.nome,acertou:x.exatas,errou:x.erros,n:x.n}));
  if(!dados.length)return <div className="v15-slide-sem-dados">Ainda não há comparações respondidas.</div>;
  return <div className="v15-grafico-container"><ResponsiveContainer width="100%" height="100%">
    <BarChart data={dados} margin={{top:14,right:20,bottom:30,left:10}}>
      <CartesianGrid stroke="#EEEAF6" vertical={false} strokeDasharray="4 6"/>
      <XAxis dataKey="nome" tick={{fontSize:12}} interval={0}/>
      <YAxis allowDecimals={false}/>
      <Tooltip contentStyle={{border:'2px solid #17132E',borderRadius:12}}/>
      <Legend/>
      <Bar dataKey="acertou" stackId="r" name="Dupla correta" fill={VERDE} radius={[0,0,0,0]}/>
      <Bar dataKey="errou" stackId="r" name="Ao menos um erro" fill={ROSA} radius={[7,7,0,0]}/>
    </BarChart>
  </ResponsiveContainer></div>;
}
function GraficoTempo({linhas}){
  const dados=(linhas||[]).filter(x=>x.iniciadas||x.completas).map(x=>({...x,nome:String(x.nome||'').slice(5)}));
  if(!dados.length)return <div className="v15-slide-sem-dados">Sem histórico diário disponível.</div>;
  return <div className="v15-grafico-container"><ResponsiveContainer width="100%" height="100%">
    <AreaChart data={dados} margin={{top:20,right:16,bottom:10,left:5}}>
      <CartesianGrid strokeDasharray="3 7" stroke="#EEEAF6"/>
      <XAxis dataKey="nome" tick={{fontSize:11}}/>
      <YAxis allowDecimals={false}/>
      <Tooltip contentStyle={{border:'2px solid #17132E',borderRadius:12}}/><Legend/>
      <Area name="Iniciadas" type="monotone" dataKey="iniciadas" stroke={ROXO} strokeWidth={3} fill={ROXO} fillOpacity={.18}/>
      <Area name="Concluídas" type="monotone" dataKey="completas" stroke="#168F82" strokeWidth={3} fill={VERDE} fillOpacity={.16}/>
    </AreaChart>
  </ResponsiveContainer></div>;
}
function GraficoMatriz({q}){
  const ia=q.vv+q.vf,h=q.ff+q.fv;
  const cells=[
    {nome:'IA reconhecida como IA',v:q.vv,base:ia,ok:true},
    {nome:'IA confundida com humano',v:q.vf,base:ia,ok:false},
    {nome:'Humano confundido com IA',v:q.fv,base:h,ok:false},
    {nome:'Humano reconhecido',v:q.ff,base:h,ok:true},
  ];
  return <div className="v15-matriz-grande">{cells.map(x=><div key={x.nome} className={x.ok?'v15-celula-certa':'v15-celula-erro'}>
    <span>{x.nome}</span><strong>{num(x.v)}</strong><small>{x.base?pct(100*x.v/x.base):'—'} da origem</small>
  </div>)}</div>;
}

export default function ApresentacaoDados({d,comparacoes,media40,amostra40,meta=100,atual,aoFechar}){
  const root=useRef(null);
  const [pagina,setPagina]=useState(0);
  const q=d.quad;
  const ia=q.vv+q.vf,hum=q.fv+q.ff;
  const N=ia+hum;
  const slides=useMemo(()=>[
    {grupo:'PESQUISA',titulo:'Quantas pessoas participaram?',valor:num(d.coleta.validas),unidade:`de ${meta} participantes previstos`,descricao:'Sessões completas e válidas, seguindo o protocolo atual de 40 decisões.',n:d.coleta.validas,vis:'meta'},
    {grupo:'PARTE 1 · CLASSIFICAÇÃO INDIVIDUAL',titulo:'Qual foi o desempenho médio?',valor:pct(d.notas.media),unidade:'de respostas individuais corretas, em média por pessoa',descricao:`${d.notas.n||0} participantes; cada pessoa tem o mesmo peso na média. IC de 95%: ${d.notas.ic?.length===2?`${pct(d.notas.ic[0])} a ${pct(d.notas.ic[1])}`:'ainda indisponível'}.`,n:d.notas.n||0,vis:'anel',valorNumerico:d.notas.media,cor:ROXO},
    {grupo:'PROTOCOLO · 40 DECISÕES',titulo:'Como foi o desempenho nas 40 decisões?',valor:pct(media40),unidade:'nota mista das 20 individuais + 20 comparações',descricao:'Uma comparação só conta como correta se as duas peças estiverem certas. Referências de acaso diferentes: 50% individual e 25% por dupla.',n:amostra40,vis:'anel',valorNumerico:media40,cor:VERDE},
    {grupo:'PARTE 1 · RECONHECIMENTO',titulo:'As pessoas reconheceram conteúdos gerados por IA?',valor:pct(ia?100*q.vv/ia:null),unidade:'sensibilidade para IA',descricao:`${q.vv} de ${ia} materiais IA foram marcados corretamente como IA. Esta taxa usa apenas os materiais que eram IA.`,n:ia,vis:'anel',valorNumerico:ia?100*q.vv/ia:null,cor:ROXO},
    {grupo:'PARTE 1 · RECONHECIMENTO',titulo:'E os conteúdos feitos por pessoas?',valor:pct(hum?100*q.ff/hum:null),unidade:'reconhecimento de humano',descricao:`${q.ff} de ${hum} materiais humanos foram corretamente classificados. Quando esse valor cai, mais humanos são confundidos com IA.`,n:hum,vis:'anel',valorNumerico:hum?100*q.ff/hum:null,cor:'#138A78'},
    {grupo:'PARTE 1 · TENDÊNCIA',titulo:'Com que frequência escolheram “IA”?',valor:pct(N?100*(q.vv+q.fv)/N:null),unidade:'taxa de rotular IA (não significa acerto)',descricao:`${q.vv+q.fv} marcações IA em ${N} respostas individuais, independentemente da origem verdadeira.`,n:N,vis:'anel',valorNumerico:N?100*(q.vv+q.fv)/N:null,cor:AMARELO},
    {grupo:'PARTE 1 · CONFUSÕES',titulo:'Onde ocorreram os acertos e erros?',valor:null,unidade:'quatro caminhos possíveis',descricao:'As porcentagens são calculadas dentro de cada origem verdadeira; não confunda contagem de respostas com número de participantes.',n:N,vis:'matriz'},
    {grupo:'PARTE 1 · MODALIDADES',titulo:'Quais formatos foram mais difíceis?',valor:null,unidade:'acerto médio por imagem, texto, áudio e vídeo',descricao:'Cada barra representa a média de participantes que avaliaram aquela modalidade; as bases podem ter tamanhos diferentes.',n:d.ri.length,vis:'barras',linhas:d.tipo.map(x=>({nome:x.nome,valor:x.acerto,n:x.n}))},
    {grupo:'PARTE 2 · COMPARAÇÕES',titulo:'Quantas duplas foram classificadas totalmente certo?',valor:pct(comparacoes.total.mediaPorParticipante),unidade:'média de acerto de duplas por participante',descricao:`${comparacoes.total.exatas} de ${comparacoes.total.n} comparações tiveram as duas peças corretas. A taxa destacada é a média por pessoa; palpite aleatório uniforme: 25%.`,n:comparacoes.total.participantes,vis:'anel',valorNumerico:comparacoes.total.mediaPorParticipante,cor:ROXO},
    {grupo:'PARTE 2 · COMPARAÇÕES',titulo:'O cenário da dupla influencia os erros?',valor:null,unidade:'duplas corretas × duplas com erro',descricao:'Os três cenários são: ambas humanas, origens diferentes e ambas IA. O gráfico usa contagens de duplas respondidas.',n:comparacoes.total.n,vis:'cenarios'},
    {grupo:'PARTE 2 · COMPARAÇÕES',titulo:'Em quais modalidades acertaram mais as duplas?',valor:null,unidade:'porcentagem de duplas inteiramente corretas',descricao:'Uma dupla exige acertar os dois materiais. Não compare diretamente esta taxa com a classificação individual.',n:comparacoes.total.n,vis:'barras',linhas:comparacoes.tipos.map(x=>({nome:x.nome,valor:x.porcentagemExata,n:x.n}))},
    {grupo:'COLETA',titulo:'Como a participação evoluiu ao longo do tempo?',valor:null,unidade:'sessões iniciadas e concluídas por dia',descricao:'Este gráfico conta sessões em diferentes estados e versões; não é uma medida de reconhecimento de IA.',n:d.coleta.total,vis:'tempo'},
    {grupo:'LEITURA DOS RESULTADOS',titulo:'O que podemos concluir — e o que ainda não?',valor:null,unidade:'Interprete as diferenças com cuidado',descricao:'Estes resultados descrevem as pessoas que participaram. Uma amostra pequena ou por conveniência não permite generalizar automaticamente para toda a população. Uma dupla correta e uma decisão individual possuem dificuldades distintas.',n:d.coleta.validas,vis:'conclusao'},
  ],[d,comparacoes,media40,amostra40,meta,ia,hum,N,q]);
  const ultima=slides.length-1;
  const ir=n=>setPagina(Math.max(0,Math.min(ultima,n)));
  const sair=()=>{if(document.fullscreenElement){document.exitFullscreen?.().catch(()=>{});}aoFechar();};
  useEffect(()=>{
    const key=e=>{
      if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){e.preventDefault();setPagina(i=>Math.min(i+1,ultima));}
      if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();setPagina(i=>Math.max(0,i-1));}
      if(e.key==='Home'){e.preventDefault();setPagina(0);}
      if(e.key==='End'){e.preventDefault();setPagina(ultima);}
      if(e.key==='Escape'){e.preventDefault();sair();}
    };
    document.addEventListener('keydown',key);
    const prev=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return ()=>{document.removeEventListener('keydown',key);document.body.style.overflow=prev;};
  },[ultima]);
  const slide=slides[pagina];
  return <div ref={root} className="v15-apresentacao" role="dialog" aria-modal="true" aria-label="Apresentação dos resultados da pesquisa">
    <div className="v15-slide-fundo" aria-hidden="true"/>
    <header className="v15-slide-header">
      <span className="v15-marca">REAL OU IA? <small>APRESENTAÇÃO</small></span>
      <div className="v15-slide-acoes">
        <button type="button" onClick={()=>root.current?.requestFullscreen?.().catch(()=>{})} title="Ocupar a tela inteira">⛶ Tela cheia</button>
        <button type="button" onClick={sair} title="Voltar para o painel">✕ Sair</button>
      </div>
    </header>
    <main key={pagina} className="v15-slide-main">
      <div className="v15-slide-texto">
        <span className="v15-slide-etiqueta">{slide.grupo}</span>
        <h1>{slide.titulo}</h1>
        {slide.valor!=null&&<strong className="v15-slide-valor">{slide.valor}</strong>}
        <p className="v15-slide-unidade">{slide.unidade}</p>
        <p className="v15-slide-explicacao">{slide.descricao}</p>
        <div className="v15-slide-base">Base: {num(slide.n)} {slide.vis==='meta'||slide.vis==='conclusao'?'participantes/sessões':slide.vis==='anel'?'participantes ou avaliações (veja explicação)':'registros no recorte'}</div>
      </div>
      <section className="v15-slide-visual" aria-label="Gráfico de apoio">
        {slide.vis==='anel'&&<GraficoAnel valor={slide.valorNumerico} cor={slide.cor}/>}
        {slide.vis==='meta'&&<div className="v15-meta-visual"><b>{num(d.coleta.validas)}</b><span>pessoas válidas</span><div className="v15-meta-linha"><i style={{width:`${Math.min(100,100*d.coleta.validas/meta)}%`}}/></div><small>{pct(100*d.coleta.validas/meta)} da meta de {meta}</small></div>}
        {slide.vis==='matriz'&&<GraficoMatriz q={q}/>}
        {slide.vis==='barras'&&<GraficoBarras linhas={slide.linhas}/>}
        {slide.vis==='cenarios'&&<GraficoCenarios cenarios={comparacoes.cenarios}/>}
        {slide.vis==='tempo'&&<GraficoTempo linhas={d.coleta.porDia}/>}
        {slide.vis==='conclusao'&&<div className="v15-conclusao-visual"><span>01</span><b>Descrever</b><p>O que os participantes responderam</p><span>02</span><b>Comparar</b><p>Individual × pares, sem misturar as referências</p><span>03</span><b>Contextualizar</b><p>Tamanho e características da amostra</p></div>}
      </section>
    </main>
    <footer className="v15-slide-footer">
      <span>{pagina+1} / {slides.length}</span>
      <div className="v15-slide-progresso" aria-label={`Slide ${pagina+1} de ${slides.length}`}><i style={{width:`${100*(pagina+1)/slides.length}%`}}/></div>
      <div className="v15-slide-navegacao">
        <button type="button" onClick={()=>ir(pagina-1)} disabled={pagina===0} aria-label="Slide anterior">← Anterior</button>
        <button type="button" onClick={()=>ir(pagina+1)} disabled={pagina===ultima} aria-label="Próximo slide">Próximo →</button>
      </div>
    </footer>
    <div className="v15-slide-dica">Use ← → para navegar · Esc para sair · Dados do painel {atual?.toLocaleTimeString('pt-BR')||''}</div>
  </div>;
}
