// Reconhece cabeçalhos em linhas isoladas, por exemplo: --- TEXTO #12 ---
// Aceita espaços extras, letras minúsculas e quebras de linha do Windows.
export function analisarTextosEmLote(entrada) {
  const fonte = String(entrada || '').replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  const marcador = /^[ \t]*---[ \t]*TEXTO[ \t]*#[ \t]*(\d+)[ \t]*---[ \t]*$/gim;
  const encontrados = [...fonte.matchAll(marcador)];
  const erros = [];
  // Um cabeçalho quase correto não pode ser incorporado silenciosamente ao texto anterior.
  const candidatos = [...fonte.matchAll(/^[ \t]*-{2,}[ \t]*TEXTO[ \t]*#[^\n]*$/gim)];
  for (const candidato of candidatos) {
    if (!/^[ \t]*---[ \t]*TEXTO[ \t]*#[ \t]*\d+[ \t]*---[ \t]*$/i.test(candidato[0])) {
      erros.push(`Marcador com formato inválido: ${candidato[0].trim()}`);
    }
  }

  if (!encontrados.length) {
    return { itens: [], erros: ['Nenhum marcador encontrado. Use --- TEXTO #1 --- em uma linha separada.'] };
  }

  if (fonte.slice(0, encontrados[0].index).trim()) {
    erros.push('Há conteúdo antes do primeiro marcador. Coloque --- TEXTO #1 --- antes do primeiro texto.');
  }

  const numeros = new Set();
  const itens = encontrados.map((encontrado, i) => {
    const numero = Number(encontrado[1]);
    const inicio = encontrado.index + encontrado[0].length;
    const fim = i + 1 < encontrados.length ? encontrados[i + 1].index : fonte.length;
    const texto = fonte.slice(inicio, fim).trim();

    if (!Number.isSafeInteger(numero) || numero < 1) {
      erros.push(`O marcador ${encontrado[1]} precisa ter um número inteiro positivo válido.`);
    }
    if (numeros.has(numero)) {
      erros.push(`O marcador TEXTO #${numero} está repetido. Use números diferentes para evitar confusão.`);
    }
    numeros.add(numero);
    if (!texto) erros.push(`O TEXTO #${numero} está vazio.`);

    return { numero, titulo: `Texto #${numero}`, texto };
  });

  return { itens, erros };
}
