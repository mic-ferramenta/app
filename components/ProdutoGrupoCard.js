// components/ProdutoGrupoCard.js
//
// Card consolidado de um produto: nome/imagem na parte de cima e,
// embaixo, um badge por tamanho -- verde se tem estoque, cinza se não
// tem. Usado tanto na tela de seleção de produtos do admin (com
// checkbox) quanto na lista pública do cliente (sem checkbox).

import { COLORS } from "../lib/theme";

export default function ProdutoGrupoCard({
  grupo,
  selecionado,
  onToggle,
  rightSlot,
}) {
  const clicavel = typeof onToggle === "function";

  return (
    <div
      style={{
        ...styles.card,
        borderColor: selecionado ? COLORS.accent : COLORS.border,
        cursor: clicavel ? "pointer" : "default",
      }}
      onClick={clicavel ? () => onToggle(grupo) : undefined}
    >
      <div style={styles.top}>
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
      </div>

      <div style={styles.tamanhos}>
        {(grupo.variacoes || []).length === 0 && (
          <span style={styles.semTamanho}>sem variações cadastradas</span>
        )}
        {(grupo.variacoes || []).map((v) => {
          const comEstoque = Number(v.estoque) > 0;
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
              {v.tamanho || "Único"}
            </span>
          );
        })}
      </div>
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
  tamanhos: { display: "flex", flexWrap: "wrap", gap: 6 },
  semTamanho: { fontSize: 12, color: COLORS.muted },
  badge: {
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 999,
  },
};
