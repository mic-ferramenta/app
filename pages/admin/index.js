// pages/admin/index.js
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { requireAdmin } from "../../lib/adminSession";
import { COLORS, FONT } from "../../lib/theme";

const fmtData = (iso) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "-";

function statusLista(l) {
  if (!l.ativo) return { label: "Inativa", color: COLORS.muted, bg: COLORS.stockOutBg };
  if (l.vencimento && new Date(l.vencimento) < new Date().setHours(0, 0, 0, 0)) {
    return { label: "Vencida", color: COLORS.danger, bg: COLORS.dangerSoft };
  }
  return { label: "Ativa", color: COLORS.success, bg: COLORS.successSoft };
}

export default function AdminDashboard({ baseUrl }) {
  const router = useRouter();
  const [lists, setLists] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [excluindoId, setExcluindoId] = useState(null);

  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  async function carregarListas() {
    setCarregando(true);
    const params = new URLSearchParams();
    if (filtroCliente) params.set("cliente", filtroCliente);
    if (filtroDataInicio) params.set("data_inicio", filtroDataInicio);
    if (filtroDataFim) params.set("data_fim", filtroDataFim);

    const resp = await fetch(`/api/admin/price-lists?${params.toString()}`);
    const data = await resp.json().catch(() => ({}));
    setLists(data.lists || []);
    setCarregando(false);
  }

  useEffect(() => {
    const t = setTimeout(carregarListas, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroCliente, filtroDataInicio, filtroDataFim]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  async function handleExcluir(lista) {
    const confirmado = confirm(
      `Excluir a lista de "${lista.client?.nome}"? Essa ação não pode ser desfeita.`
    );
    if (!confirmado) return;

    setExcluindoId(lista.id);
    await fetch(`/api/admin/price-lists/${lista.id}`, { method: "DELETE" });
    setLists((prev) => prev.filter((l) => l.id !== lista.id));
    setExcluindoId(null);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.brand}>MIC · PAINEL</p>
          <h1 style={styles.title}>Listas de preço</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/nova-lista" style={styles.ctaButton}>
            + Nova lista
          </Link>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Sair
          </button>
        </div>
      </header>

      <div style={styles.filters}>
        <input
          type="text"
          placeholder="Filtrar por cliente..."
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          style={styles.filterInput}
        />
        <div style={styles.dateRow}>
          <label style={styles.dateLabel}>
            De
            <input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              style={styles.dateInput}
            />
          </label>
          <label style={styles.dateLabel}>
            Até
            <input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              style={styles.dateInput}
            />
          </label>
          {(filtroCliente || filtroDataInicio || filtroDataFim) && (
            <button
              onClick={() => {
                setFiltroCliente("");
                setFiltroDataInicio("");
                setFiltroDataFim("");
              }}
              style={styles.clearButton}
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <main style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Cliente</th>
              <th style={styles.th}>Data criação</th>
              <th style={styles.th}>Vencimento</th>
              <th style={styles.th}>Status</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && (
              <tr>
                <td style={styles.td} colSpan={5}>
                  Carregando...
                </td>
              </tr>
            )}

            {!carregando && lists.length === 0 && (
              <tr>
                <td style={{ ...styles.td, color: COLORS.muted }} colSpan={5}>
                  Nenhuma lista encontrada.
                </td>
              </tr>
            )}

            {!carregando &&
              lists.map((l) => {
                const status = statusLista(l);
                return (
                  <tr key={l.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 600 }}>{l.client?.nome}</div>
                      <div style={{ fontSize: 12, color: COLORS.muted }}>
                        {baseUrl}/lista/{l.slug}
                      </div>
                    </td>
                    <td style={styles.td}>{fmtData(l.created_at)}</td>
                    <td style={styles.td}>{fmtData(l.vencimento)}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.pill,
                          color: status.color,
                          background: status.bg,
                        }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <div style={styles.actions}>
                        <a
                          href={`/lista/${l.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.actionButtonGhost}
                        >
                          Visualizar
                        </a>
                        <Link
                          href={`/admin/lists/${l.id}`}
                          style={styles.actionButtonGhost}
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => handleExcluir(l)}
                          disabled={excluindoId === l.id}
                          style={styles.actionButtonDanger}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </main>
    </div>
  );
}

export async function getServerSideProps({ req }) {
  if (!requireAdmin(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }

  const proto = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${proto}://${req.headers.host}`;

  return { props: { baseUrl } };
}

const styles = {
  page: {
    minHeight: "100vh",
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: FONT,
    padding: "32px 24px 60px",
  },
  header: {
    maxWidth: 1100,
    margin: "0 auto 24px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderBottom: `1px solid ${COLORS.border}`,
    paddingBottom: 20,
  },
  brand: {
    margin: "0 0 4px",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 3,
    color: COLORS.accent,
    textTransform: "uppercase",
  },
  title: { margin: 0, fontSize: 26, fontWeight: 700 },
  ctaButton: {
    background: COLORS.accent,
    color: "#fff",
    padding: "10px 18px",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 700,
  },
  logoutButton: {
    background: "transparent",
    border: `1px solid ${COLORS.border}`,
    color: COLORS.textDim,
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 14,
    cursor: "pointer",
  },
  filters: {
    maxWidth: 1100,
    margin: "0 auto 20px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  filterInput: {
    padding: "11px 14px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.bgAlt,
    color: COLORS.text,
    fontSize: 14,
    outline: "none",
  },
  dateRow: { display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" },
  dateLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 12,
    color: COLORS.muted,
  },
  dateInput: {
    padding: "9px 10px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.bgAlt,
    color: COLORS.text,
    fontSize: 13,
  },
  clearButton: {
    background: "transparent",
    border: "none",
    color: COLORS.accent,
    fontSize: 13,
    cursor: "pointer",
    padding: "9px 0",
  },
  tableWrap: {
    maxWidth: 1100,
    margin: "0 auto",
    overflowX: "auto",
    background: COLORS.bgCard,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: COLORS.muted,
    borderBottom: `1px solid ${COLORS.border}`,
    padding: "14px 16px",
  },
  tr: { borderBottom: `1px solid ${COLORS.borderSoft}` },
  td: { padding: "14px 16px", fontSize: 14, verticalAlign: "middle" },
  pill: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 12px",
    borderRadius: 999,
  },
  actions: { display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" },
  actionButtonGhost: {
    padding: "7px 12px",
    borderRadius: 7,
    border: `1px solid ${COLORS.border}`,
    background: "transparent",
    color: COLORS.textDim,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  },
  actionButtonDanger: {
    padding: "7px 12px",
    borderRadius: 7,
    border: `1px solid ${COLORS.dangerSoft}`,
    background: COLORS.dangerSoft,
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};