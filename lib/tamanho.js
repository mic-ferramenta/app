// lib/tamanhos.js
//
// Regra única de ordenação/limpeza de tamanho, usada tanto na área
// admin quanto na página pública -- garante que P/M/G/GG/2GG/3GG
// apareçam sempre na mesma ordem em qualquer tela.

const ORDEM_TAMANHOS = ["P", "M", "G", "GG", "2GG", "3GG"];

// Blindagem: tira um eventual prefixo "Tamanho:" que tenha vindo cru do
// Bling, não importa a caixa ou os espaços ao redor.
export function limparTamanho(v) {
  if (!v) return v;
  return String(v).replace(/^\s*tamanho\s*:\s*/i, "").trim();
}

// Ordena uma lista de variações (cada uma com .tamanho) na ordem
// P, M, G, GG, 2GG, 3GG. Qualquer tamanho fora dessa lista (ex: um
// "Único", ou algo novo que apareça no catálogo) vai pro final, em
// ordem alfabética entre si -- nunca some, só fica no fim da fila.
export function ordenarVariacoes(variacoes) {
  return [...(variacoes || [])].sort((a, b) => {
    const ta = (limparTamanho(a.tamanho) || "").toUpperCase();
    const tb = (limparTamanho(b.tamanho) || "").toUpperCase();
    const ia = ORDEM_TAMANHOS.indexOf(ta);
    const ib = ORDEM_TAMANHOS.indexOf(tb);
    if (ia === -1 && ib === -1) return ta.localeCompare(tb, "pt-BR");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}