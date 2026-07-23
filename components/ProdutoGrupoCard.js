// components/ProdutoGrupoCard.js
//
// Card consolidado de um produto: nome/imagem em cima e, embaixo, um
// badge por tamanho -- verde se tem estoque, cinza se não tem. Clicar
// no corpo do card expande uma tabelinha com o estoque exato por
// tamanho. O checkbox (quando existe) seleciona o produto pra lista e
// não conflita com o clique de expandir (para propagação do evento).

import { useState, memo } from "react";
import { COLORS } from "../lib/theme";
import { limparTamanho, ordenarVariacoes } from "../lib/tamanhos";

function ProdutoGrupoCard({
  grupo,
  selecionado,
  onToggle,
  rightSlot,
}) {
  const [expandido, setExpandido] = useState(false);
  const clicavel = typeof onToggle === "function";
  const variacoes = ordenarVariacoes(grupo.variacoes);

  return (
    <div
      style={{
        ...styles.card,
        borderColor: selecionado ? COLORS.accent : COLORS.border,
      }}
    >
      <div
        style={{ ...styles.top, cursor: "pointer" }}
        onClick={() => setExpandido((e) => !e)}
      >
        {clicavel && (
          <input
            type="checkbox"
            checked={!!selecionado}
            onChange={() => onToggle(grupo)}
            onClick={(e) => e.stopPropagation()}
            style={styles.checkbox}
          />
        )}

        <div style={styles.imageWrap}>
          {grupo.imagem_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={grupo.imagem_url} alt="" style={styles.image} />
          ) : (
            <div style={styles.imagePlaceholder} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={styles.nome}>{grupo.nome}</p>
          {grupo.codigo && <p style={styles.codigo}>{grupo.codigo}</p>}
        </div>

        {rightSlot}

        <span style={styles.expandIcon}>{expandido ? "▲" : "▼"}</span>
      </div>

      <div style={styles.tamanhos}>
        {variacoes.length === 0 && (
          <span style={styles.semTamanho}>sem variações cadastradas</span>
        )}
        {variacoes.map((v) => {
          const comEstoque = Number(v.estoque) > 0;
          const rotulo = limparTamanho(v.tamanho) || "Único";
          return (
            <span
              key={v.id}
              title={`Estoque: ${v.estoque ?? 0}`}
              style={{
                ...styles.badge,
                color: comEstoque ? COLORS.stockOk : COLORS.stockOut,
                background: comEstoque ? COLORS.stockOkBg : COLORS.stockOutBg,
              }}
            >
              {rotulo}
            </span>
          );
        })}
      </div>

      {expandido && (
        <div style={styles.expandBox}>
          <table style={styles.expandTable}>
            <thead>
              <tr>
                <th style={styles.expandTh}>Tamanho</th>
                <th style={styles.expandTh}>Estoque</th>
              </tr>
            </thead>
            <tbody>
              {variacoes.length === 0 && (
                <tr>
                  <td style={styles.expandTd} colSpan={2}>
                    Sem variações cadastradas.
                  </td>
                </tr>
              )}
              {variacoes.map((v) => (
                <tr key={v.id}>
                  <td style={styles.expandTd}>{limparTamanho(v.tamanho) || "Único"}</td>
                  <td style={styles.expandTd}>{v.estoque ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    border: "1px solid",
    borderRadius: 10,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    background: "#fff",
  },
  top: { display: "flex", alignItems: "center", gap: 10 },
  checkbox: { width: 18, height: 18, flexShrink: 0 },
  imageWrap: {
    width: 44,
    height: 44,
    borderRadius: 6,
    overflow: "hidden",
    background: "#fafafa",
    flexShrink: 0,
  },
  image: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  imagePlaceholder: { width: "100%", height: "100%", background: "#f2f2f2" },
  nome: { margin: 0, fontWeight: 600, fontSize: 14, overflowWrap: "anywhere" },
  codigo: { margin: "2px 0 0", fontSize: 12, color: COLORS.muted },
  expandIcon: { fontSize: 10, color: COLORS.muted, flexShrink: 0 },
  tamanhos: { display: "flex", flexWrap: "wrap", gap: 6 },
  semTamanho: { fontSize: 12, color: COLORS.muted },
  badge: {
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 999,
  },
  expandBox: {
    borderTop: `1px solid ${COLORS.border}`,
    paddingTop: 8,
  },
  expandTable: { width: "100%", borderCollapse: "collapse" },
  expandTh: {
    textAlign: "left",
    fontSize: 11,
    color: COLORS.muted,
    padding: "4px 6px",
  },
  expandTd: {
    fontSize: 13,
    padding: "4px 6px",
    borderTop: `1px solid ${COLORS.border}`,
  },
};

export default memo(ProdutoGrupoCard);