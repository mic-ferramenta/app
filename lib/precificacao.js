// lib/precificacao.js
//
// Lógica de cálculo de preço compartilhada entre a criação
// (nova-lista.js) e a edição (admin/lists/[id].js) de listas -- as
// duas telas usam exatamente essas mesmas funções, pra nunca
// divergir no cálculo.

import { indiceOrdemTamanho } from "./tamanhos";

// Tamanhos de uma grade, na ordem P/M/G/GG/2GG/3GG.
export function tamanhosOrdenados(quantidades) {
  return Object.keys(quantidades || {}).sort(
    (a, b) => indiceOrdemTamanho(a) - indiceOrdemTamanho(b)
  );
}

// Total em R$ de um item -- soma (preço do tamanho × quantidade do
// tamanho) pra grade, ou é só o valor final direto pra unidade.
export function totalItem(item, tipo) {
  if (!item) return 0;
  if (tipo === "grade") {
    return Object.entries(item.precos || {}).reduce(
      (soma, [tam, p]) => soma + Number(p.final || 0) * Number(item.quantidades?.[tam] || 0),
      0
    );
  }
  return Number(item.final || 0);
}

export function custoTotalItem(item, tipo) {
  if (!item) return 0;
  if (tipo === "grade") {
    return Object.entries(item.precos || {}).reduce(
      (soma, [tam, p]) => soma + Number(p.custo || 0) * Number(item.quantidades?.[tam] || 0),
      0
    );
  }
  return Number(item.custo || 0);
}

// Monta { P: preco, M: preco, ... } pronto pra salvar em
// price_list_items.precos_por_tamanho a partir do estado de edição.
export function precosPorTamanhoParaSalvar(item) {
  const out = {};
  for (const tam of Object.keys(item.precos || {})) {
    out[tam] = Number(item.precos[tam].final || 0);
  }
  return out;
}