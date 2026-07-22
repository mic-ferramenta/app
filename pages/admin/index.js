// pages/admin/index.js
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { requireAdmin } from "../../lib/adminSession";
import { COLORS } from "../../lib/theme";

const fmtData = (iso) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "-";

function statusLista(l) {
  if (!l.ativo) return { label: "Inativa", color: COLORS.muted, bg: "#f3f4f6" };
  if (l.vencimento && new Date(l.vencimento) < new Date().setHours(0, 0, 0, 0)) {
    return { label: "Vencida", color: COLORS.danger, bg: "#fee2e2" };
  }
  return { label: "Ativa", color: COLORS.stockOk, bg: COLORS.stockOkBg };
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
        <h1 style={styles.title}>Listas de preço</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/nova-lista" style={styles.buttonLink}>
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
    fontFamily: "system-ui, sans-serif",
    padding: "32px 24px 60px",
  },
  header: {
    maxWidth: 1100,
    margin: "0 auto 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `3px solid ${COLORS.accent}`,
    paddingBottom: 16,
  },
  title: { margin: 0, fontSize: 24 },
  buttonLink: {
    background: COLORS.accent,
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 6,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
  },
  logoutButton: {
    background: "transparent",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    padding: "8px 14px",
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
    padding: "10px 14px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
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
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: COLORS.muted,
    borderBottom: `1px solid ${COLORS.border}`,
    padding: "8px 10px",
  },
  tr: { borderBottom: `1px solid ${COLORS.border}` },
  td: { padding: "10px", fontSize: 14, verticalAlign: "middle" },
  pill: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
  },
  actions: { display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" },
  actionButtonGhost: {
    padding: "6px 10px",
    borderRadius: 6,
    border: `1px solid ${COLORS.border}`,
    background: "transparent",
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  },
  actionButtonDanger: {
    padding: "6px 10px",
    borderRadius: 6,
    border: `1px solid ${COLORS.danger}`,
    background: "transparent",
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
};