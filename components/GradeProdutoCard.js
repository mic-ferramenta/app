// components/GradeProdutoCard.js
//
// Card de seleção pro modo "grade": em vez dos badges por tamanho,
// mostra qual grade bate com o estoque atual e a composição dela.

import { COLORS } from "../lib/theme";
import { composicaoTexto } from "../lib/grades";

export default function GradeProdutoCard({ grupo, selecionado, onToggle }) {
  const grade = grupo.grade_disponivel;

  return (
    <div
      style={{
        ...styles.card,
        borderColor: selecionado ? COLORS.accent : COLORS.border,
        cursor: "pointer",
      }}
      onClick={() => onToggle(grupo)}
    >
      <div style={styles.top}>
        <input
          type="checkbox"
          checked={!!selecionado}
          onChange={() => onToggle(grupo)}
          onClick={(e) => e.stopPropagation()}
          style={styles.checkbox}
        />

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
      </div>

      {grade && (
        <div style={styles.gradeBox}>
          <span style={styles.gradeBadge}>{grade.nome} disponível</span>
          <span style={styles.composicao}>{composicaoTexto(grade)}</span>
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
  gradeBox: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    borderTop: `1px solid ${COLORS.border}`,
    paddingTop: 8,
  },
  gradeBadge: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    color: COLORS.stockOk,
    background: COLORS.stockOkBg,
  },
  composicao: { fontSize: 12, color: COLORS.muted, fontFamily: "monospace" },
};