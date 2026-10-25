// Traduz a escolha visual "nenhum / primeiro / segundo / ambos" para o contrato
// de enviar_comparacao_v3: array contendo APENAS os IDs classificados como IA.
// Não depende do gabarito; o participante não tem acesso à origem verdadeira.
export function idsEscolhidosComoIA(itens, escolha, enquadramento) {
  const escolhidos = {
    nenhum: [],
    primeiro: [0],
    segundo: [1],
    ambos: [0,1],
  }[escolha];
  if (!Array.isArray(itens) || itens.length !== 2 || !escolhidos) {
    throw new Error('Comparação incompleta ou escolha inválida.');
  }
  const buscaHumano = enquadramento === 'humano';
  return itens.filter((_c, indice) => buscaHumano
    ? !escolhidos.includes(indice)
    : escolhidos.includes(indice)).map(c => c.id);
}
