// Slides são derivados das mesmas estatísticas que alimentam as abas do dashboard.
// Cada slide descreve a unidade da base para impedir a leitura de cliques como pessoas.
import { analisarMateriais, ordenarGrupo } from './analiseMateriais.js';
import { criarEvolucao, contarDistribuicao, FORCA_INICIAL, PREVISAO_INICIAL } from './previsaoPesquisa.js';
import { resumoParticipantes } from './analiseAvancada.js';

const pct=(a,b)=>b?100*a/b:null;
const decimal=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
const MODALIDADES=[['imagem','Imagens'],['texto','Textos'],['audio','Áudios'],['video','Vídeos']];
const CENARIOS=[{id:'ia_ia',titulo:'IA corretamente reconhecida',verdadeiro:true,voto:'ia'},
  {id:'hum_ia',titulo:'Humano confundido com IA',verdadeiro:false,voto:'ia'},
  {id:'hum_hum',titulo:'Humano corretamente reconhecido',verdadeiro:false,voto:'humano'},
  {id:'ia_hum',titulo:'IA confundida com humano',verdadeiro:true,voto:'humano'}];
const COMP_PREFIX='Parte 2 · Comparações';
const BASE_COMP='comparações respondidas (cada dupla conta uma vez)';
const BASE_PESSOAS='participantes válidos concluídos';
export function montarSlidesPesquisa({d,comparacoes,media40,amostra40,comparacoesDetalhes=[],meta=100}) {
  const s=[];
  const add=(secao,titulo,config={})=>s.push({id:`s${s.length+1}`,secao,titulo,...config});
  const metric=(secao,titulo,valor,unidade,base,descricao,extra={})=>add(secao,titulo,{vis:'anel',valor,unidade,base,descricao,...extra});
  const graf=(secao,titulo,vis,dados,base,descricao,extra={})=>add(secao,titulo,{vis,dados,base,descricao,...extra});
  const tab=(secao,titulo,linhas,base,descricao)=>{
    for(let inicio=0;inicio<linhas.length;inicio+=7){
      add(secao,linhas.length>7?`${titulo} · ${Math.floor(inicio/7)+1}/${Math.ceil(linhas.length/7)}`:titulo,
        {vis:'tabela',dados:linhas.slice(inicio,inicio+7),base,descricao});
    }
    if(!linhas.length)add(secao,titulo,{vis:'vazio',base,descricao});
  };
  const q=d.quad||{vv:0,vf:0,fv:0,ff:0};
  const ai=q.vv+q.vf,hum=q.fv+q.ff,total=ai+hum;
  const p=d.pessoas||[];
  const notaGeral=p.map(x=>x.pct_geral).filter(Number.isFinite);
  const histGeral=[0,20,40,60,80].map((start,i)=>({nome:`${start}–${start+20}%`,quantidade:notaGeral.filter(n=>n>=start&&(i===4?n<=100:n<start+20)).length}));
  const histComp=[0,20,40,60,80].map((start,i)=>({nome:`${start}–${start+20}%`,quantidade:p.filter(x=>Number.isFinite(x.pct_comp)&&x.pct_comp>=start&&(i===4?x.pct_comp<=100:x.pct_comp<start+20)).length}));
  const co=d.coleta||{};
  const notas=d.notas||{};
  const comps=comparacoes||{total:{},cenarios:[],tipos:[],perguntas:[],contagens:[]};
  const formatoRows=(rows,chaves)=>rows.map(x=>({nome:x.nome,...Object.fromEntries(chaves.map(k=>[k,x[k]]))}));
  const fc=(n)=>Number(n)||0;
  const completo=(co.validas||0);

  // COLETA E VISÃO GERAL
  metric('01 · Pesquisa','Quantos participantes válidos temos?',pct(completo,meta),'percentual da meta de participantes',`${completo} pessoas de ${meta} previstas`,
    'A meta é uma referência de planejamento; não garante representatividade.');
  const pilotosIncluidos=(d.validas||[]).filter(x=>x.excluir_analise).length;
  graf('01 · Pesquisa','Situação de todas as sessões','donut',[
    {nome:'Válidas (sem pilotos)',valor:Math.max(0,fc(co.validas)-pilotosIncluidos)},{nome:'Pilotos completos',valor:fc(co.pilotos)},
    {nome:'Fora do protocolo',valor:fc(co.foraProtocolo)},{nome:'Não finalizadas',valor:fc(co.incompletas)}],
    `${co.total||0} sessões iniciadas`,'As categorias são do estoque de sessões; pilotos e versões antigas não entram nos resultados oficiais.');
  metric('01 · Pesquisa','Quantas pessoas concluem?',pct(co.finalizadas,co.total),'taxa de conclusão (todos os protocolos)',
    `${co.finalizadas||0} concluídas / ${co.total||0} iniciadas`,'Não mede acerto; mede a passagem entre início e término.');
  metric('01 · Pesquisa','Quantas decisões foram registradas?',co.volume,'respostas da amostra oficial',
    `${co.validas||0} participantes válidos`,'Soma das respostas individuais e das decisões de comparar duplas.',{vis:'numero'});
  graf('01 · Pesquisa','Como as sessões se distribuem por dia?','area',co.porDia||[],`${co.total||0} sessões (inclusive antigas/pilotos)`,
    'Volume de inícios e conclusões, sem inferir acerto a partir de uma linha temporal.',{chaves:['iniciadas','completas'],unidadeGrafico:'quantidade'});
  graf('01 · Pesquisa','Como se distribuem as notas individuais?','histograma',contarDistribuicao(p),`${completo} pessoas`,
    'As colunas mostram pessoas, não respostas. A última faixa inclui 100%.');
  metric('02 · Desempenho','Qual é a média da Parte 1?',notas.media,'acertos individuais médios por pessoa',`${notas.n||0} pessoas`,
    'Cada participante contribui com uma porcentagem para a média, não com 20 observações independentes.');
  graf('02 · Desempenho','Notas das 40 decisões: distribuição completa','histograma',histGeral,
    `${notaGeral.length} pessoas que completaram as duas etapas`,'Cada pessoa entra apenas uma vez. A nota geral conta acertos individuais e duplas inteiramente corretas.');
  graf('02 · Desempenho','Notas da Parte 2: distribuição de acertos integrais','histograma',histComp,
    `${p.length} participantes válidos`, 'Cada pessoa contribui uma vez; uma dupla só é acertada se as duas classificações forem corretas.');
  graf('02 · Desempenho','Acertos individuais × acertos nos pares','dispersao-flex',p.filter(x=>Number.isFinite(x.pct_ind)&&Number.isFinite(x.pct_comp)).map((x,i)=>({
    nome:`Participante ${i+1}`,x:x.pct_ind,y:x.pct_comp,z:100,grupo:'Participantes'})),
    `${p.length} participantes válidos`,'Cada ponto é uma pessoa. O eixo horizontal mede a Parte 1; o vertical mede a Parte 2.',
    {rotuloX:'Acertos na Parte 1 (%)',rotuloY:'Pares corretos na Parte 2 (%)',maxX:100});
  tab('02 · Desempenho','Pontuações anônimas de todos os participantes',p.map((x,i)=>({
    nome:`Participante ${i+1}`,individuais:x.acertos,comparacoes:x.acertosPares,total:x.acertos+x.acertosPares,
    porcentagem:x.pct_geral,estimativa:x.estimativa,confianca:x.confianca})),
    `${p.length} participantes válidos`, 'Uma linha por participante, sem identificadores pessoais. Comparações acertadas por inteiro são contabilizadas.');
  metric('02 · Desempenho','Qual é a mediana individual?',notas.mediana,'nota central na Parte 1',`${notas.n||0} pessoas`,
    'Metade das notas fica de cada lado da mediana; ela é menos influenciada por extremos.');
  metric('02 · Desempenho','Qual é o acerto descritivo nas 40 decisões?',media40,'20 classificações + 20 duplas por pessoa',`${amostra40} sessões completas das duas etapas`,
    'Nota mista: uma dupla só vale um acerto quando as duas peças foram reconhecidas. O acaso difere: 50% em item binário, 25% em dupla.');
  const stats=[['Menor nota',notas.min],['Maior nota',notas.max],['Desvio padrão',notas.desvio],['Erro padrão',notas.se],
    ['Limite inferior do IC de 95%',notas.ic?.[0]],['Limite superior do IC de 95%',notas.ic?.[1]]];
  stats.forEach(([nome,valor])=>metric('02 · Desempenho',nome,valor,'porcentagem da nota individual',`${notas.n||0} participantes`,
    nome.includes('IC')?'Intervalo estatístico aproximado por participante; depende de pressupostos amostrais e não garante representatividade.':'Estatística de dispersão calculada usando a nota de cada pessoa.'));
  const sorted=p.map(x=>x.pct_ind).filter(Number.isFinite).sort((a,b)=>a-b);
  const quantil=f=>{if(!sorted.length)return null;const i=f*(sorted.length-1);return sorted[Math.floor(i)]*(1-i%1)+sorted[Math.ceil(i)]*(i%1);};
  const q1=quantil(.25),q3=quantil(.75);
  [['Primeiro quartil (Q1)',q1],['Terceiro quartil (Q3)',q3],['Amplitude interquartil',q1!=null&&q3!=null?q3-q1:null],
    ['Coeficiente de variação',notas.media>0&&notas.desvio!=null?100*notas.desvio/notas.media:null]].forEach(([nome,valor])=>
    metric('02 · Desempenho',nome,valor,'resumo da distribuição de notas',`${notas.n||0} pessoas`,'Medida descritiva: compare com a distribuição e com o tamanho da amostra.'));

  // RECONHECIMENTO INDIVIDUAL
  graf('03 · IA × humano','Matriz completa de reconhecimento','matriz',q,`${total} respostas individuais`,'As contagens dizem quantas vezes o material foi reconhecido ou confundido.');
  graf('03 · IA × humano','Proporção verdadeira exibida','donut',[
    {nome:'IA',valor:fc(d.composicao?.IA)},{nome:'Humano',valor:fc(d.composicao?.real)}],
    `${total} respostas individuais`,'Exposição de materiais sorteados, não quantidades cadastradas.');
  metric('03 · IA × humano','Sensibilidade: quantas IAs foram reconhecidas?',pct(q.vv,ai),'IA marcada IA',`${q.vv} de ${ai} respostas com origem IA`,
    'Sensibilidade = IA reconhecida ÷ total que realmente era IA × 100.');
  metric('03 · IA × humano','Reconhecimento de conteúdo humano',pct(q.ff,hum),'humano marcado humano',`${q.ff} de ${hum} respostas com origem humana`,
    'Especificidade = humanos corretamente reconhecidos ÷ todos os humanos exibidos × 100.');
  metric('03 · IA × humano','Qual é a tendência de marcar IA?',pct(q.vv+q.fv,total),'respostas IA, incluindo as erradas',`${q.vv+q.fv} de ${total} respostas`,
    'Esta taxa não mede acerto. Mostra a frequência de escolha IA, mesmo quando a resposta estava errada.');
  metric('03 · IA × humano','Acurácia das classificações por resposta',pct(q.vv+q.ff,total),'acertos entre todas as respostas individuais',`${q.vv+q.ff} acertos / ${total} respostas`,
    'Resumo por resposta; não confunda com média por participante.');
  [['IA reconhecida como IA',q.vv,ai],['IA confundida com humana',q.vf,ai],['Humano confundido com IA',q.fv,hum],['Humano reconhecido',q.ff,hum]].forEach(([nome,valor,base])=>
    metric('03 · IA × humano',nome,pct(valor,base),'porcentagem dentro da origem verdadeira',`${valor} em ${base} respostas dessa origem`,
      'Uma mesma pessoa pode ter respondido a vários materiais.'));

  // MODALIDADES E FORMULAÇÕES
  graf('04 · Formatos','Comparativo das quatro modalidades','barras',formatoRows(d.tipo||[],['acerto']),
    'médias individuais por participante em cada modalidade','Cada barra usa apenas pessoas que avaliaram aquele formato.',{chaves:['acerto'],eixoMax:100});
  graf('04 · Formatos','Perfil conjunto das modalidades','radar',formatoRows(d.tipo||[],['acerto']),
    'quatro modalidades','Radar ilustrativo: modalidades são categorias, não dimensões contínuas.');
  graf('04 · Formatos','Radar comparativo: Parte 1, duplas inteiras e peças','radar',MODALIDADES.map(([tipo,nome])=>({
    nome,acerto:(d.tipo||[]).find(x=>x.tipo===tipo)?.acerto??null,
    porcentagemExata:(comps.tipos||[]).find(x=>x.tipo===tipo)?.porcentagemExata??null,
    porcentagemPeca:(comps.tipos||[]).find(x=>x.tipo===tipo)?.porcentagemPeca??null,
  })),`${p.length} participantes`, 'Três medidas distintas sobre os mesmos formatos; compare padrões, não some porcentagens.',
  {chaves:['acerto','porcentagemExata','porcentagemPeca']});
  graf('04 · Formatos','Velocidade de decisão × acerto por modalidade','dispersao-flex',(d.tipo||[])
    .filter(x=>Number.isFinite(x.tempo_med_s)&&Number.isFinite(x.acerto)).map(x=>({nome:x.nome,x:x.tempo_med_s,y:x.acerto,z:x.n,grupo:x.nome})),
    'modalidades com tempo e acerto disponíveis', 'Cada ponto é uma modalidade agregada; não são pontos individuais de participantes.',
    {rotuloX:'Tempo mediano (segundos)',rotuloY:'Acerto individual (%)'});
  for(const m of d.tipo||[]){
    metric('04 · Formatos',`Taxa de acerto em ${m.nome.toLowerCase()}`,m.acerto,'média por participante nessa modalidade',
      `${m.n} respostas / ${m.participantes} pessoas`,'Intervalos por modalidade podem ser largos se poucas pessoas receberam esse formato.');
    metric('04 · Formatos',`Tempo mediano: ${m.nome.toLowerCase()}`,m.tempo_med_s,'segundos até decidir',`${m.n} respostas nesta modalidade`,
      'Mediana de tempo entre os cliques, quando registrado.',{vis:'numero',sufixo:' s'});
    graf('04 · Formatos',`Composição verdadeira: ${m.nome}`,'donut',[
      {nome:'IA',valor:fc(m.ia)},{nome:'Humano',valor:fc(m.real)}],`${m.n} respostas`,'Origem real dos conteúdos exibidos nesta modalidade.');
  }
  graf('05 · Enunciados','Como a formulação altera respostas e acertos?','multilinha',formatoRows(d.porFrame||[],['acerto','disseIa']),
    'respostas individuais com enquadramento registrado','Acerto e frequência de chamar IA não são a mesma coisa. Diferenças observadas não provam causalidade.',
    {chaves:['acerto','disseIa'],eixoMax:100});
  for(const f of d.porFrame||[]){
    metric('05 · Enunciados',`Acerto: ${f.nome}`,f.acerto,'média de acerto por pessoa',`${f.n} respostas / ${f.participantes} pessoas`,
      'Pergunta muda o enquadramento, não o gabarito do conteúdo.');
    metric('05 · Enunciados',`Marcado como IA: ${f.nome}`,f.disseIa,'taxa de seleção IA',`${f.n} respostas`,
      'Frequência de voto IA, independentemente de estar correto.');
    metric('05 · Enunciados',`Tempo: ${f.nome}`,f.tempoMed,'segundos (mediana)',`${f.n} respostas`,
      'Tempo central antes de decidir.',{vis:'numero',sufixo:' s'});
  }
  tab('05 · Enunciados','Matriz: modalidade × formulação',(d.fTipo||[]).map(x=>({nome:`${x.nome} · ${x.frame}`,acerto:x.acerto,n:x.n,marcouIA:x.disseIA})),
    'respostas por modalidade e pergunta','Tabela completa das combinações existentes.');
  const frames=['neutro','ia','humano'];
  const linhasCalor=MODALIDADES.map(([tipo,nome])=>{
    const linha={nome};
    for(const fr of frames){const x=(d.fTipo||[]).find(r=>r.tipo===tipo&&r.frame===fr);
      linha[fr]=x?.acerto??null;linha[`${fr}_n`]=x?.n??0;}
    return linha;
  });
  graf('05 · Enunciados','Mapa de calor: acerto por formato e pergunta','calor',linhasCalor,
    'respostas individuais classificadas por modalidade e formulação',
    'Cada célula compara uma modalidade com um tipo de enunciado; n mostra a quantidade de respostas.',
    {chaves:frames,rotulos:{neutro:'Pergunta neutra',ia:'Pergunta IA',humano:'Pergunta humano'}});
  // PERFIS — idem seleção do painel, mas percorre todos os filtros de uma vez.
  for(const [campo,nome] of [['faixa','Faixa etária'],['genero','Gênero'],['escolaridade','Escolaridade'],['freq','Frequência de uso de IA']]){
    const grupos=new Map();
    for(const x of p){const label=String(x[campo]||'Não informado');if(!grupos.has(label))grupos.set(label,[]);grupos.get(label).push(x.pct_ind);}
    const rows=[...grupos.entries()].map(([label,notasGrupo])=>({nome:label,...resumoParticipantes(notasGrupo)})).sort((a,b)=>b.n-a.n);
    graf('06 · Perfis',`Notas por ${nome.toLowerCase()}`,'barras',rows.map(x=>({nome:x.nome,acerto:x.media,n:x.n})),
      `${p.length} participantes agrupados`, 'Associação descritiva; diferenças entre perfis não demonstram relação causal.',{chaves:['acerto'],eixoMax:100});
    tab('06 · Perfis',`Detalhamento de ${nome.toLowerCase()}`,rows.map(x=>({nome:x.nome,n:x.n,media:x.media,mediana:x.mediana,ic:x.ic})),
      `${p.length} participantes`, 'Médias por grupo podem ser instáveis com amostras pequenas.');
  }

  // ÁUDIO E CONFIANÇA
  const au=d.audio||{};
  const audioNums=[['Áudios com telemetria',au.medidos,'materiais de áudio com dados de escuta'],
    ['Escuta mediana',au.ouvidoMed,'segundos reproduzidos; repetições contam'],
    ['Trecho liberado',au.limiteMed,'segundos disponibilizados'],
    ['Trecho liberado (% da duração)',au.fraçãoMed,'fração mediana do áudio liberado'],
    ['Pedidos para ouvir mais',au.maisMed,'média de solicitações de novos trechos'],
    ['Repetições do áudio',au.repeticoesMed,'média de repetições registradas']];
  for(const [nome,valor,desc] of audioNums)metric('07 · Escuta e confiança',nome,valor,desc,`${au.medidos||0} respostas com telemetria`,
    'A quantidade liberada não equivale necessariamente ao tempo efetivamente ouvido.',
    {vis:nome.includes('(%)')?'anel':'numero',sufixo:nome.includes('Escuta')||nome==='Trecho liberado'?' s':''});
  graf('07 · Escuta e confiança','Acurácia × número de pedidos para ouvir mais','barras',(au.etapas||[]).filter(x=>x.n>0),
    `${au.medidos||0} registros de escuta`, 'Agrupamento exploratório; pessoas podem ouvir de formas diferentes.',{chaves:['acerto'],eixoMax:100});
  tab('07 · Escuta e confiança','Todos os níveis de solicitação de áudio',(au.etapas||[]).map(x=>({nome:x.nome,n:x.n,acerto:x.acerto})),
    `${au.medidos||0} respostas`, 'Inclui os níveis sem observações.');
  const confianca=p.filter(x=>x.confianca!=null&&Number.isFinite(x.pct_ind)).map(x=>({x:Number(x.confianca),y:x.pct_ind}));
  graf('07 · Escuta e confiança','Confiança × nota individual','dispersao',confianca,
    `${confianca.length} participantes`, 'Cada ponto corresponde a uma pessoa; não implica que a confiança cause desempenho.');
  graf('07 · Escuta e confiança','Estimativa × acertos reais nas 40 decisões','dispersao-flex',p
    .filter(x=>Number.isFinite(x.estimativa_pct)&&Number.isFinite(x.pct_geral))
    .map((x,i)=>({nome:`Participante ${i+1}`,x:x.estimativa_pct,y:x.pct_geral,z:90,grupo:'Participantes'})),
    `${p.filter(x=>x.estimativa_pct!=null).length} pessoas com estimativa`,
    'Cada ponto é uma pessoa. Ambos os eixos usam as 40 decisões; discrepâncias indicam superestimação ou subestimação.',
    {rotuloX:'Acertos que imaginou (%)',rotuloY:'Acertos efetivos (%)',maxX:100});
  metric('07 · Escuta e confiança','Viés na estimativa da própria nota',d.viesConfianca?.media,
    'diferença em pontos percentuais',`${d.viesConfianca?.n||0} pessoas com estimativa`,
    'Estimativa e desempenho observado usam as mesmas 40 decisões. Um par conta como certo apenas com as duas peças corretas.',{vis:'numero'});

  // COMPARAÇÕES
  const ct=comps.total||{};
  metric(COMP_PREFIX,'Acerto integral das duplas por participante',ct.mediaPorParticipante,'média da taxa individual de duplas totalmente corretas',
    `${ct.participantes||0} participantes`,'Uma comparação acertada exige acertar a origem das duas peças.');
  metric(COMP_PREFIX,'Acerto integral por comparação respondida',ct.porcentagemExata,'taxa por dupla',
    `${ct.exatas||0} de ${ct.n||0} duplas`, 'Não equivale à média por participante quando os números de duplas variam.');
  metric(COMP_PREFIX,'Acertos por peça nas comparações',ct.porcentagemPeca,'taxa por material individual dentro do par',
    `${ct.pecas||0} de ${ct.itens||0} peças`, 'Uma dupla tem duas peças: esta taxa conta cada classificação isoladamente.');
  metric(COMP_PREFIX,'Tempo mediano para decidir em duplas',comps.tempoMediano,'segundos por comparação',
    `${ct.n||0} respostas de pares`,'Tempo transcorrido até confirmar as duas classificações.',{vis:'numero',sufixo:' s'});
  graf(COMP_PREFIX,'Frequência dos três tipos de dupla','donut',(comps.cenarios||[]).map(x=>({nome:x.nome,valor:x.n})),
    `${ct.n||0} pares respondidos`, 'A proporção de cenários depende do sorteio e do acervo.');
  graf(COMP_PREFIX,'Duplas totalmente corretas × com erro','empilhado',(comps.cenarios||[]).map(x=>({nome:x.nome,exatas:x.exatas,erros:x.erros})),
    `${ct.n||0} pares`, 'As barras contam duplas, não pessoas.',{chaves:['exatas','erros']});
  graf(COMP_PREFIX,'Quantas peças foram marcadas como IA?','empilhado',(comps.contagens||[]).map(x=>({nome:x.nome,marcou0:x.marcou0,marcou1:x.marcou1,marcou2:x.marcou2})),
    `${ct.n||0} pares`, 'Mostra quantos marcaram zero, uma ou duas peças IA conforme a composição real.',{chaves:['marcou0','marcou1','marcou2']});
  graf(COMP_PREFIX,'Acerto completo e por peça em cada modalidade','multilinha',(comps.tipos||[]).filter(x=>x.n>0),
    `${ct.n||0} duplas`, 'Duas séries diferentes: acerto de todas as peças e acerto item por item.',{chaves:['porcentagemExata','porcentagemPeca'],eixoMax:100});
  graf(COMP_PREFIX,'Acerto conforme a pergunta da Parte 2','multilinha',(comps.perguntas||[]).filter(x=>x.n>0),
    `${ct.n||0} duplas`, 'Compara o acerto integral e por peça conforme o enunciado.',{chaves:['porcentagemExata','porcentagemPeca'],eixoMax:100});
  const mapaComps=MODALIDADES.map(([tipo,nome])=>{
    const row={nome};
    for(const c of [0,1,2]){
      const a=(d.rc||[]).filter(x=>x.tipo===tipo&&Number(x.n_reais_ia)===c);
      row[`c${c}`]=a.length?pct(a.filter(x=>x.acertou).length,a.length):null;
      row[`c${c}_n`]=a.length;
    }
    return row;
  });
  graf(COMP_PREFIX,'Mapa de calor: duplas inteiramente certas por cenário e formato','calor',mapaComps,
    `${d.rc?.length||0} comparações respondidas`,
    'Cada célula é o percentual de duplas com AMBAS as origens acertadas naquele cenário e modalidade.',
    {chaves:['c0','c1','c2'],rotulos:{c0:'Ambas humanas',c1:'Mistas',c2:'Ambas IA'}});
  graf(COMP_PREFIX,'Radar das comparações por modalidade','radar',(comps.tipos||[]).map(x=>({nome:x.nome,
    porcentagemExata:x.porcentagemExata,porcentagemPeca:x.porcentagemPeca})),
    `${ct.n||0} comparações respondidas`,'Distingue acertar a dupla inteira de acertar cada peça separadamente.',
    {chaves:['porcentagemExata','porcentagemPeca']});
  for(const x of comps.cenarios||[]){
    metric(COMP_PREFIX,`Dupla correta quando: ${x.nome}`,x.porcentagemExata,'acerto integral nesse cenário',
      `${x.exatas} duplas certas entre ${x.n} respostas`,x.explicacao||'Composição real dos dois conteúdos.');
    metric(COMP_PREFIX,`Acerto por peça quando: ${x.nome}`,x.porcentagemPeca,'origens acertadas separadamente',
      `${x.pecas} peças corretas em ${x.itens} avaliações`,'Taxa baseada nas peças apresentadas neste cenário.');
  }
  for(const x of comps.tipos||[]){
    metric(COMP_PREFIX,`Comparações de ${x.nome.toLowerCase()}: par inteiro`,x.porcentagemExata,
      'duplas inteiramente certas',`${x.exatas} certas / ${x.n} respondidas`,'Métrica por dupla, não por peça.');
    metric(COMP_PREFIX,`Comparações de ${x.nome.toLowerCase()}: cada peça`,x.porcentagemPeca,
      'classificações corretas dentro dos pares',`${x.pecas} certas / ${x.itens} peças`,'Métrica por peça em pares.');
  }
  for(const x of comps.perguntas||[]){
    metric(COMP_PREFIX,`Comparações ${x.nome.toLowerCase()}: dupla`,x.porcentagemExata,'duplas totalmente corretas',
      `${x.exatas} de ${x.n} duplas`,'Enunciados distintos podem gerar tendências distintas.');
    metric(COMP_PREFIX,`Comparações ${x.nome.toLowerCase()}: peças`,x.porcentagemPeca,'peças corretas',
      `${x.pecas} de ${x.itens} peças`,'A média por peça pode ser maior que a taxa por dupla inteira.');
  }
  tab(COMP_PREFIX,'Todas as composições de pares',(comps.cenarios||[]).map(x=>({nome:x.nome,n:x.n,duplasCertas:x.exatas,acerto:x.porcentagemExata,pecas:x.porcentagemPeca})),
    BASE_COMP,'Numeradores, denominadores e taxas lado a lado.');

  // EVOLUÇÃO
  const evol=criarEvolucao(p);
  graf('08 · Evolução','Média observada e projeção descritiva','evolucao',evol,
    `${p.length} participantes em ordem de conclusão`, 'A linha projetada é ilustrativa, com hipótese 50% e peso fictício de oito participantes.',{chaves:['observada','previsao'],eixoMax:100});
  metric('08 · Evolução','Hipótese usada na projeção',PREVISAO_INICIAL,'percentual anterior fictício',
    `${FORCA_INICIAL} pseudoparticipantes de peso`, 'Parâmetro de um exercício ilustrativo, não dado observado.');
  metric('08 · Evolução','Última projeção ilustrativa',evol.at(-1)?.previsao,'resultado descritivo ajustado',
    `${p.length} pessoas observadas`, 'Nunca substituir a média observada por esta linha para falar do resultado da pesquisa.');
  metric('08 · Evolução','Última média observada',evol.at(-1)?.observada,'nota baseada somente nas respostas reais',
    `${p.length} pessoas observadas`,'Média real dos participantes válidos, sem pseudoparticipantes.');
  graf('08 · Evolução','Trajetória da amostra por participante','area',evol.slice(1).map(x=>({nome:String(x.n),iniciadas:x.n,completas:x.n})),
    `${p.length} participantes válidos`, 'Crescimento acumulado de participantes válidos do protocolo atual.',{chaves:['iniciadas'],unidadeGrafico:'quantidade'});

  // RANKING: todos os materiais avaliados em lotes legíveis de sete.
  const mat=analisarMateriais(d,comparacoesDetalhes,'todos');
  metric('09 · Conteúdos','Quantos materiais foram avaliados?',mat.usados,'materiais com pelo menos uma classificação',
    `${mat.itens.length} conteúdos cadastrados`,'Materiais sem votos não devem ser classificados como fáceis ou difíceis.',{vis:'numero'});
  metric('09 · Conteúdos','Quantas avaliações existem por material?',mat.votos,'total de classificações por peça',
    `${mat.usados} materiais avaliados`,'Pode incluir a mesma peça em vários participantes ou comparações.',{vis:'numero'});
  graf('09 · Conteúdos','Dispersão: quantidade de avaliações × taxa de erro','dispersao-flex',mat.itens
    .filter(x=>x.n>0&&Number.isFinite(x.pctErro)).map(x=>({nome:x.nome,x:x.n,y:x.pctErro,z:Math.max(60,x.n*15),grupo:x.origem_ia?'IA':'Humano'})),
    `${mat.usados} materiais avaliados`,
    'Cada ponto é um material. Uma taxa de erro extrema baseada em uma única avaliação é incerta.',
    {rotuloX:'Número de avaliações',rotuloY:'Taxa de erro (%)'});
  for(const [tipo,titulo] of MODALIDADES){
    const itens=mat.itens.filter(x=>x.tipo===tipo);
    const avaliados=itens.filter(x=>x.n>0);
    const sem=itens.filter(x=>x.n===0);
    graf('09 · Conteúdos',`${titulo}: dispersão de avaliações e votos IA`,'dispersao-flex',avaliados
      .map(x=>({nome:x.nome,x:x.n,y:x.pctIA,z:Math.max(50,x.n*10),grupo:x.origem_ia?'IA':'Humano'})),
      `${avaliados.length} materiais com votos`,
      'Pontos acima indicam materiais mais frequentemente apontados como IA, incluindo falsos positivos.',
      {rotuloX:'Número de avaliações',rotuloY:'Porcentagem marcada IA (%)'});
    tab('09 · Conteúdos',`${titulo}: inventário completo dos materiais`,itens.map(x=>({nome:x.nome,
      origem:x.origem_ia?'IA':'Humano',avaliacoes:x.n,votosIA:x.ia,votosHumano:x.humano,
      acertos:x.acertos,erros:x.erros,taxaErro:x.pctErro,participantes:x.participantes})),
      `${itens.length} materiais cadastrados`,'Todos os materiais, com e sem avaliação, com números absolutos para auditoria.');
    graf('09 · Conteúdos',`${titulo}: origem dos materiais avaliados`,'donut',[
      {nome:'IA',valor:avaliados.filter(x=>x.origem_ia).length},
      {nome:'Humano',valor:avaliados.filter(x=>!x.origem_ia).length}],
      `${avaliados.length} materiais com votos`,'Não misture materiais cadastrados com exposições recebidas.');
    for(const g of CENARIOS){
      const sortedGroup=ordenarGrupo(itens,g,'votos',1,'');
      tab('09 · Conteúdos',`${titulo} · ${g.titulo}`,sortedGroup.map(x=>({nome:x.nome,n:x.n,votos:g.voto==='ia'?x.ia:x.humano,
        porcentagem:g.voto==='ia'?x.pctIA:x.pctHumano,participantes:x.participantes})),
        `${sortedGroup.length} materiais com votos nesse cenário`,
        'Todos os materiais com votos são apresentados; uma alta taxa com n=1 é apenas uma observação.');
    }
    tab('09 · Conteúdos',`${titulo} · inventário sem avaliação`,sem.map(x=>({nome:x.nome,origem:x.origem_ia?'IA':'Humano',exibicoes:0})),
      `${sem.length} materiais sem respostas`, 'Não atribuir resultados aos materiais ainda não apresentados.');
  }
  // AUDITORIA: não expõe identificadores nem respostas pessoais na projeção.
  metric('10 · Auditoria','Total de sessões históricas',co.total,'sessões registradas em todos os protocolos',
    `${co.finalizadas||0} finalizadas / ${co.total||0} iniciadas`,
    'Inclui versões anteriores. Não é o tamanho da amostra oficial.',{vis:'numero'});
  metric('10 · Auditoria','Sessões fora do protocolo oficial',co.foraProtocolo,'sessões completas de formato anterior',
    `${co.total||0} sessões históricas`, 'Permanecem no banco para conferência, mas não são misturadas com o protocolo 20+20.',{vis:'numero'});
  metric('10 · Auditoria','Sessões piloto excluídas da análise',co.pilotos,'testes de validação concluídos',
    `${co.total||0} sessões históricas`, 'A apresentação respeita o filtro de pilotos da aba Estatísticas.',{vis:'numero'});
  graf('10 · Auditoria','Quantidade de materiais avaliados por modalidade','barras',MODALIDADES.map(([tipo,nome])=>({
    nome,avaliados:mat.itens.filter(x=>x.tipo===tipo&&x.n>0).length,
    semVotos:mat.itens.filter(x=>x.tipo===tipo&&x.n===0).length
  })),`${mat.itens.length} conteúdos cadastrados`,
    'Distribuição do acervo já avaliado e ainda sem observações.',{chaves:['avaliados','semVotos']});
  tab('10 · Auditoria','Modalidades: contagens, médias e intervalos',(d.tipo||[]).map(x=>({nome:x.nome,n:x.n,
    participantes:x.participantes,media:x.acerto,ic:x.ic,tempo:x.tempo_med_s})),
    'respostas individuais elegíveis','Tabela equivalente aos recortes completos do painel administrativo.');
  tab('10 · Auditoria','Perguntas: contagens, médias e intervalos',(d.porFrame||[]).map(x=>({nome:x.nome,n:x.n,
    participantes:x.participantes,media:x.acerto,ic:x.ic,marcouIA:x.disseIa})),
    'respostas individuais elegíveis','Os intervalos são descritivos e podem ser instáveis com amostras pequenas.');
  tab('10 · Auditoria','Materiais difíceis (mínimo de cinco avaliações)',(d.difficult||[]).map(x=>({nome:x.nome||String(x.id).slice(0,8),
    origem:x.origem_ia?'IA':'Humano',n:x.n_exibicoes,acerto:x.pct_acerto,marcouIA:x.marca_ia})),
    'materiais com no mínimo cinco avaliações','Lista completa dos materiais difíceis no recorte oficial.');
  tab('10 · Auditoria','Sessões: andamento e classificação', (d.sessoes||[]).map(x=>({
    nome:x.finalizado?'Finalizado':'Em andamento',
    categoria:x.excluir_analise?'Piloto':Number(x.sorteadas)===40?'Protocolo 40':'Outro protocolo',
    individuais:x.individuais_respondidas||0,comparacoes:x.comparacoes_respondidas||0,
    protocolo:x.sorteadas||'—'
  })), `${co.total||0} sessões`,
    'Visão sem identificadores pessoais; os registros completos continuam no Admin e nas exportações CSV.');

  // CONTAS E LEITURA
  const formulas=[
    ['Média individual','Soma das notas (%) de cada participante ÷ quantidade de pessoas',notas.media,`${notas.n||0} pessoas`],
    ['Sensibilidade IA','IA corretamente marcada IA ÷ total de IA × 100',pct(q.vv,ai),`${q.vv} ÷ ${ai}`],
    ['Reconhecimento humano','Humano corretamente marcado humano ÷ total de humanos × 100',pct(q.ff,hum),`${q.ff} ÷ ${hum}`],
    ['Taxa de marcar IA','Todas as escolhas IA ÷ todas as respostas individuais × 100',pct(q.vv+q.fv,total),`${q.vv+q.fv} ÷ ${total}`],
    ['Acurácia por resposta','Acertos individuais ÷ respostas individuais × 100',pct(q.vv+q.ff,total),`${q.vv+q.ff} ÷ ${total}`],
    ['Duplas inteiramente corretas','Duplas com as duas peças certas ÷ duplas respondidas × 100',ct.porcentagemExata,`${ct.exatas||0} ÷ ${ct.n||0}`],
    ['Acerto por peça nas duplas','Peças corretas ÷ todas as peças exibidas em comparação × 100',ct.porcentagemPeca,`${ct.pecas||0} ÷ ${ct.itens||0}`],
    ['Nota mista 40 decisões','(Acertos individuais + duplas inteiramente certas) ÷ 40 × 100; média das pessoas',media40,`${amostra40} sessões 20+20`],
    ['Erro padrão','Desvio padrão ÷ raiz quadrada do número de participantes',notas.se,`n = ${notas.n||0}`],
    ['Intervalo de confiança','Média ± t de Student × erro padrão',notas.ic,`n = ${notas.n||0}`],
    ['Desvio padrão','Raiz quadrada da variância das notas individuais',notas.desvio,`n = ${notas.n||0}`],
    ['Mediana','Nota central após ordenar os resultados',notas.mediana,`n = ${notas.n||0}`],
    ['Trecho liberado (%)','Segundos disponíveis ÷ duração total × 100',au.fraçãoMed,`${au.medidos||0} registros de áudio`],
    ['Projeção ilustrativa','(8 × 50 + soma das notas observadas) ÷ (8 + n)',evol.at(-1)?.previsao,`n = ${p.length}`],
  ];
  formulas.forEach(([nome,formula,valor,base])=>add('11 · Como calculamos',nome,{vis:'formula',valor,formula,base,
    descricao:'A fórmula explicita o que entra no numerador e no denominador. Resultados da pesquisa não são palpites ou projeções.'}));
  add('11 · Como calculamos','Como interpretar a pesquisa?',{vis:'conclusao',base:`${p.length} pessoas válidas`,
    descricao:'Priorize médias por participante, indique sempre a base de cada gráfico e separe classificação individual de comparação. Participação voluntária não implica amostra representativa.'});
  return s;
}
