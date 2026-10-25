// Inventário administrativo, independente do JSON da RPC admin_dados.
// Consulta as três tabelas reais em páginas, para não truncar resultados
// quando o PostgREST tiver limite padrão de 1.000 linhas.
const TAMANHO_PAGINA = 500;

export async function consultarTabelaPaginada(supabase, tabela, campos, ordem) {
  const resultado = [];
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    let consulta = supabase.from(tabela).select(campos)
      .order(ordem, { ascending: true })
      .range(inicio, inicio + TAMANHO_PAGINA - 1);
    const { data, error } = await consulta;
    if (error) throw new Error(`Falha na leitura de ${tabela}: ${error.message}`);
    if (!Array.isArray(data)) throw new Error(`Leitura de ${tabela} não retornou uma lista.`);
    resultado.push(...data);
    if (data.length < TAMANHO_PAGINA) break;
  }
  return resultado;
}

export async function consultarInventario(supabase) {
  // Cada tabela é lida diretamente usando a sessão admin (RLS).
  // Nunca utilizar [] como fallback silencioso em caso de erro.
  const [comparacoes, conteudos, gabaritos] = await Promise.all([
    consultarTabelaPaginada(supabase, 'comparacoes', 'id,tipo,ativo,created_at', 'created_at'),
    consultarTabelaPaginada(supabase, 'conteudos', 'id,tipo,ativo,titulo,comparacao_id,posicao,created_at', 'created_at'),
    consultarTabelaPaginada(supabase, 'gabarito', 'conteudo_id,eh_ia', 'conteudo_id'),
  ]);
  const respostas = new Map(gabaritos.map((g) => [g.conteudo_id, g.eh_ia]));
  return {
    comparacoes,
    conteudos: conteudos.map((c) => ({ ...c, eh_ia: respostas.has(c.id) ? respostas.get(c.id) : null })),
  };
}

export function agruparInventario(conteudos, comparacoes) {
  const porComparacao = new Map();
  for (const c of conteudos) {
    if (!c.comparacao_id) continue;
    const itens = porComparacao.get(c.comparacao_id) || [];
    itens.push(c);
    porComparacao.set(c.comparacao_id, itens);
  }
  const completos = comparacoes.map((c) => {
    const itens = porComparacao.get(c.id) || [];
    const nIA = itens.filter((x) => x.eh_ia === true).length;
    const nReais = itens.filter((x) => x.eh_ia === false).length;
    const nSemGabarito = itens.length - nIA - nReais;
    return { ...c, itens, nItens: itens.length, nIA, nReais, nSemGabarito,
      completo: itens.length === 2 && nSemGabarito === 0 && itens.every((x) => x.tipo === c.tipo),
    };
  });
  return {
    individuais: conteudos.filter((c) => c.comparacao_id === null),
    comparacoes: completos,
    orfaos: [...porComparacao.keys()].filter((id) => !comparacoes.some((c) => c.id === id)),
  };
}
