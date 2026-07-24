// lib/grades.js
//
// Lógica de "grade" (kit fechado de tamanhos do mesmo modelo). É a
// MESMA função usada na tela de criação (pra saber quais produtos
// podem virar opção de grade) e na página pública (recalculada em
// TODO acesso -- nunca fica "congelada" do momento da criação da
// lista). Isso é de propósito: evita qualquer problema de a
// disponibilidade ficar desatualizada -- ela nunca é armazenada,
// sempre é derivada do estoque atual.

import { limparTamanho, indiceOrdemTamanho } from "./tamanhos";

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

// Recebe o estoque por tamanho e a lista de grades e devolve TODAS as
// que cabem no estoque atual (não só a primeira) -- usado na página
// pública pra mostrar "quantas grades" estão disponíveis.
export function gradesQueCabem(estoque, gradesOrdenadas) {
  return (gradesOrdenadas || []).filter((grade) => {
    const composicao = grade.composicao || {};
    return Object.entries(composicao).every(
      ([tamanho, qtd]) => (estoque[tamanho.toUpperCase()] || 0) >= Number(qtd)
    );
  });
}

// Total de peças de uma grade (ex: 1+2+3+3+2 = 11)
export function totalPecasGrade(grade) {
  return Object.values(grade?.composicao || {}).reduce(
    (soma, qtd) => soma + Number(qtd),
    0
  );
}

// Texto tipo "P:1  M:2  G:3  GG:3  2GG:2" pra exibir a composição.
// O Postgres NÃO preserva a ordem das chaves de um jsonb (reordena por
// tamanho da string e depois alfabeticamente) -- por isso a ordem de
// exibição é sempre a mesma lista P/M/G/GG/2GG/3GG usada no resto do
// app, nunca a ordem crua que vem do banco.
export function composicaoTexto(grade) {
  return Object.entries(grade?.composicao || {})
    .sort(([tamA], [tamB]) => {
      const ia = indiceOrdemTamanho(tamA);
      const ib = indiceOrdemTamanho(tamB);
      if (ia === -1 && ib === -1) return tamA.localeCompare(tamB, "pt-BR");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    })
    .map(([tam, qtd]) => `${tam}:${qtd}`)
    .join("  ");
}