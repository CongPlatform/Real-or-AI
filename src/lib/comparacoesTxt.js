// Importa grupos de quatro textos rotulados no arquivo administrativo.
// Exemplo: --- C1.0 - IA --- / --- C1.1 - HUMANO --- ... C1.3
// Cada grupo com 2 IA + 2 humanos gera dois pares IA × humano,
// porque o protocolo do app aceita duas peças por comparação.
const RE_MARCADOR = /^(?:---\s*)?(?:TEXTO\s+)?C0*(\d+)\.(\d+)\s*[-–—:]\s*(IA|REAL|HUMANO|HUMANA)(?:\s*---)?$/i;
const RE_GRUPO = /^---\s*GRUPO\s*#?\s*(\d+)\s*---$/i;
const RE_PARECE_MARCADOR = /^(?:---\s*)?(?:TEXTO\s+)?C\d+\./i;

export function analisarComparacoesTxt(entrada) {
  const linhas = String(entrada || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const familias = new Map();
  const erros = [];
  let bloco = null;
  let grupoAtual = null;
  let antesDoPrimeiroMarcador = true;

  function finalizar() {
    if (!bloco) return;
    bloco.texto = bloco.linhas.join('\n').trim();
    delete bloco.linhas;
    if (!bloco.texto) erros.push(`${bloco.id}: conteúdo vazio.`);
    if (!familias.has(bloco.numero)) familias.set(bloco.numero, []);
    familias.get(bloco.numero).push(bloco);
    bloco = null;
  }

  linhas.forEach((raw, indice) => {
    const linha = raw.trim();
    const mGrupo = RE_GRUPO.exec(linha);
    if (mGrupo) {
      finalizar();
      grupoAtual = Number(mGrupo[1]);
      return;
    }
    const m = RE_MARCADOR.exec(linha);
    if (m) {
      finalizar();
      antesDoPrimeiroMarcador = false;
      const numero = Number(m[1]);
      const posicao = Number(m[2]);
      if (!Number.isSafeInteger(numero) || numero < 1 || numero > 999999 || !Number.isInteger(posicao) || posicao > 3) {
        erros.push(`Linha ${indice + 1}: código inválido (use C1.0 a C1.3).`);
        return;
      }
      if (grupoAtual !== null && numero !== grupoAtual) {
        erros.push(`Linha ${indice + 1}: C${numero}.${posicao} está dentro do GRUPO #${grupoAtual}.`);
      }
      bloco = {
        id: `C${numero}.${posicao}`, numero, posicao,
        ia: m[3].toUpperCase() === 'IA', linhas: [],
      };
      return;
    }
    if (/^---/.test(linha) || RE_PARECE_MARCADOR.test(linha)) {
      erros.push(`Linha ${indice + 1}: marcador não reconhecido: ${linha.slice(0, 100)}. Informe IA, REAL ou HUMANO no marcador.`);
      return;
    }
    if (bloco) bloco.linhas.push(raw);
    else if (linha && !antesDoPrimeiroMarcador) {
      erros.push(`Linha ${indice + 1}: texto solto fora de um marcador.`);
    }
    // Cabeçalhos e instruções antes do primeiro marcador são ignorados.
  });
  finalizar();

  if (!familias.size) erros.push('Nenhum texto identificado. Use --- C1.0 - IA --- e --- C1.1 - HUMANO --- em linhas próprias.');

  const grupos = [...familias.entries()].sort((a, b) => a[0] - b[0]).map(([numero, originais]) => {
    const itens = [...originais].sort((a, b) => a.posicao - b.posicao);
    const problemas = [];
    const posicoes = itens.map((it) => it.posicao);
    if (itens.length !== 4 || ![0, 1, 2, 3].every((p) => posicoes.includes(p))) {
      problemas.push(`São necessários os quatro códigos C${numero}.0, .1, .2 e .3, uma vez cada.`);
    }
    if (new Set(posicoes).size !== posicoes.length) problemas.push('Há posições repetidas.');
    const ias = itens.filter((it) => it.ia);
    const humanos = itens.filter((it) => !it.ia);
    if (ias.length !== 2 || humanos.length !== 2) problemas.push(`Esperados 2 IA e 2 humanos, encontrados ${ias.length} IA e ${humanos.length} humanos.`);
    if (itens.some((it) => !it.texto)) problemas.push('Existe pelo menos um texto vazio.');
    const pares = problemas.length ? [] : [0, 1].map((i) => ({
      codigo: `C${numero}.P${i + 1}`,
      key: `texto:C${numero}.P${i + 1}`,
      tipo: 'texto',
      itens: [ias[i], humanos[i]].sort((a, b) => a.posicao - b.posicao),
    }));
    return { numero, codigo: `C${numero}`, itens, pares, erros: problemas };
  });
  for (const grupo of grupos) for (const erro of grupo.erros) erros.push(`${grupo.codigo}: ${erro}`);
  return { grupos, erros, totalTextos: grupos.reduce((n, g) => n + g.itens.length, 0), totalPares: grupos.reduce((n, g) => n + g.pares.length, 0) };
}
