// Quantos itens CADA PESSOA responde. O app sorteia de dentro do que estiver cadastrado, por tipo.
// Cadastre mais do que isso no admin (o banco de conteúdos) e o sorteio escolhe quais cada pessoa vê.
export const INDIVIDUAIS_POR_TIPO = { imagem: 4, audio: 4, video: 4, texto: 4 };
// Rodadas de comparação (2 conteúdos). Use 0 para tipos que não entram na parte 2.
export const COMPARACOES_POR_TIPO = { imagem: 3, texto: 3, audio: 0, video: 0 };
