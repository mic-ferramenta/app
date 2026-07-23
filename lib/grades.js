// lib/grades.js
//
// Lógica de "grade" (kit fechado de tamanhos do mesmo modelo). É a
// MESMA função usada na tela de criação (pra saber quais produtos
// podem virar opção de grade) e na página pública (recalculada em
// TODO acesso -- nunca fica "congelada" do momento da criação da
// lista). Isso é de propósito: evita qualquer problema de a
// disponibilidade ficar desatualizada -- ela nunca é armazenada,
// sempre é derivada do estoque atual.

import { limparTamanho } from "./tamanhos";

// Soma o estoque de todas as variações por tamanho: [{tamanho:"P",estoque:5}, ...] -> { P: 5, M: 12 }
export function estoquePorTamanho(variacoes) {
  const mapa = {};
  for (const v of variacoes || []) {
    const tam = (limparTamanho(v.tamanho) || "").toUpperCase();
    if (!tam) continue;
    mapa[tam] = (mapa[tam] || 0) + Number(v.estoque || 0);
  }
  return mapa;
}

// Recebe o estoque por tamanho e a lista de grades (ordenadas por
// prioridade, menor primeiro) e devolve a PRIMEIRA que cabe no
// estoque atual, ou null se nenhuma couber.
export function gradeQueCabe(estoque, gradesOrdenadas) {
  for (const grade of gradesOrdenadas || []) {
    const composicao = grade.composicao || {};
    const cabe = Object.entries(composicao).every(
      ([tamanho, qtd]) => (estoque[tamanho.toUpperCase()] || 0) >= Number(qtd)
    );
    if (cabe) return grade;
  }
  return null;
}

// Total de peças de uma grade (ex: 1+2+3+3+2 = 11)
export function totalPecasGrade(grade) {
  return Object.values(grade?.composicao || {}).reduce(
    (soma, qtd) => soma + Number(qtd),
    0
  );
}

// Texto tipo "P:1  M:2  G:3  GG:3  2GG:2" pra exibir a composição
export function composicaoTexto(grade) {
  return Object.entries(grade?.composicao || {})
    .map(([tam, qtd]) => `${tam}:${qtd}`)
    .join("  ");
}