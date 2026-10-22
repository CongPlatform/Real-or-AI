// Ranking de materiais: cada voto se refere a uma peça, não a uma rodada de comparação.
// As sessões elegíveis vêm de analisarAvancado (concluídas, 30 decisões, não piloto por padrão).
const percentual = (numerador, total) => total > 0 ? (100 * numerador / total) : null;
const modalidades = { imagem: 'Imagem', texto: 'Texto', audio: 'Áudio', video: 'Vídeo' };

export function analisarMateriais(dados, comparacoesDetalhes = [], origem = 'todos') {
  const incluidos = new Set((dados?.pessoas || []).map(p => p.id));
  const mapa = new Map();
  for (const item of dados?.itens || []) {
    mapa.set(String(item.id), {
      id: String(item.id), nome: item.nome || `Item ${String(item.id).slice(0, 8)}`,
      tipo: item.tipo, tipoNome: modalidades[item.tipo] || item.tipo,
      origem_ia: item.origem_ia, ativo: item.ativo,
      comparacao_id: item.comparacao_id || null,
      n: 0, ia: 0, humano: 0, acertos: 0, erros: 0,
      nIndividual: 0, nComparacao: 0, participantes: new Set()
    });
  }
  const inserir = (r, fonte) => {
    if (!incluidos.has(r.participante_id)) return;
    if (typeof r.resposta_ia !== 'boolean') return;
    const item = mapa.get(String(r.conteudo_id));
    if (!item || typeof item.origem_ia !== 'boolean') return;
    if (origem !== 'todos' && origem !== fonte) return;
    item.n++;
    item.ia += Number(r.resposta_ia);
    item.humano += Number(!r.resposta_ia);
    item.acertos += Number(r.resposta_ia === item.origem_ia);
    item.erros += Number(r.resposta_ia !== item.origem_ia);
    item.nIndividual += Number(fonte === 'individual');
    item.nComparacao += Number(fonte === 'comparacao');
    item.participantes.add(r.participante_id);
  };
  for (const r of dados?.ri || []) inserir(r, 'individual');
  for (const r of comparacoesDetalhes || []) inserir(r, 'comparacao');
  const itens = [...mapa.values()].map(x => ({
    ...x,
    participantes: x.participantes.size,
    pctIA: percentual(x.ia, x.n), pctHumano: percentual(x.humano, x.n),
    pctErro: percentual(x.erros, x.n), pctAcerto: percentual(x.acertos, x.n),
    // Não interpretar essas taxas como métricas independentes dos participantes.
    erroHumanoComoIA: x.origem_ia === false ? x.ia : 0,
    erroIAComoHumano: x.origem_ia === true ? x.humano : 0
  }));
  const usados = itens.filter(x => x.n > 0);
  return {
    itens, usados: usados.length, semVotos: itens.length - usados.length,
    votos: usados.reduce((s,x) => s+x.n, 0),
    votosIA: usados.reduce((s,x) => s+x.ia, 0),
    votosHumano: usados.reduce((s,x) => s+x.humano, 0),
    erroHumanoComoIA: usados.reduce((s,x) => s+x.erroHumanoComoIA, 0),
    erroIAComoHumano: usados.reduce((s,x) => s+x.erroIAComoHumano, 0),
    respostasComparacao: usados.reduce((s,x) => s+x.nComparacao, 0)
  };
}

// Comparadores determinísticos para desempate; valor absoluto e taxa são métricas distintas.
export const MODOS_RANKING = {
  ia: { titulo: 'Mais marcados como IA', descricao: 'Maior quantidade de votos IA, independentemente da origem.', valor: x => x.ia },
  humano: { titulo: 'Mais marcados como humano', descricao: 'Maior quantidade de votos humano, independentemente da origem.', valor: x => x.humano },
  falsoPositivo: { titulo: 'Humanos confundidos com IA', descricao: 'Materiais humanos classificados incorretamente como IA (falsos positivos).', valor: x => x.erroHumanoComoIA, classe: false },
  falsoNegativo: { titulo: 'IA confundida com humano', descricao: 'Materiais artificiais classificados incorretamente como humanos (falsos negativos).', valor: x => x.erroIAComoHumano, classe: true },
  taxaErro: { titulo: 'Maior taxa de erro', descricao: 'Proporção de erros entre as avaliações recebidas, com amostra mínima.', valor: x => x.pctErro ?? -1 },
  exibicoes: { titulo: 'Mais avaliados', descricao: 'Maior número de classificações registradas.', valor: x => x.n }
};
export function ordenarMateriais(itens, modo, minimo = 1) {
  const regra = MODOS_RANKING[modo] || MODOS_RANKING.ia;
  return (itens || []).filter(x => x.n >= minimo &&
    (regra.classe === undefined || regra.classe === x.origem_ia))
    .sort((a,b) => regra.valor(b)-regra.valor(a) || b.n-a.n || a.nome.localeCompare(b.nome, 'pt-BR'));
}

// Quatro cenários por modalidade: origem verdadeira × voto dado; desempate consistente.
export function ordenarGrupo(itens,grupo,criterio,minimo,busca) {
  const texto=busca.toLocaleLowerCase('pt-BR').trim();
  const votos=x=>grupo.voto==='ia'?x.ia:x.humano;
  const taxa=x=>grupo.voto==='ia'?x.pctIA:x.pctHumano;
  return itens.filter(x=>x.origem_ia===grupo.verdadeiro && x.n>=minimo && votos(x)>0 &&
    (!texto||x.nome.toLocaleLowerCase('pt-BR').includes(texto)))
    .sort((a,b)=>(criterio==='percentual'?(taxa(b)-taxa(a)):(votos(b)-votos(a)))||b.n-a.n||votos(b)-votos(a)||a.nome.localeCompare(b.nome,'pt-BR'));
}
