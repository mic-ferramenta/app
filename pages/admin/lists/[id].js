// pages/admin/lists/[id].js
import { useMemo, useState } from "react";
import { requireAdmin } from "../../../lib/adminSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { COLORS } from "../../../lib/theme";

const fmtMoeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ManageList({ lista, cliente, itensIniciais, listUrl }) {
  const [itens, setItens] = useState(itensIniciais); // { [group_id]: { nome, codigo, preco } }
  const [copiado, setCopiado] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [salvandoId, setSalvandoId] = useState(null);

  const itensLista = useMemo(() => Object.entries(itens), [itens]);

  function handleCopyLink() {
    navigator.clipboard.writeText(listUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function buscarProdutos(termo) {
    setBusca(termo);
    if (!termo.trim()) {
      setResultadosBusca([]);
      return;
    }
    const resp = await fetch(`/api/admin/product-groups?search=${encodeURIComponent(termo)}`);
    const data = await resp.json().catch(() => ({}));
    setResultadosBusca(data.groups || []);
  }

  async function adicionarProduto(grupo) {
    setSalvandoId(grupo.id);
    await fetch("/api/admin/price-list-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price_list_id: lista.id,
        pai_id: grupo.id,
        preco: grupo.preco_venda || 0,
      }),
    });
    setItens((prev) => ({
      ...prev,
      [grupo.id]: { nome: grupo.nome, codigo: grupo.codigo, preco: String(grupo.preco_venda || 0) },
    }));
    setSalvandoId(null);
    setBusca("");
    setResultadosBusca([]);
  }

  function handlePriceChange(groupId, value) {
    setItens((prev) => ({ ...prev, [groupId]: { ...prev[groupId], preco: value } }));
  }

  async function salvarPreco(groupId) {
    const preco = itens[groupId]?.preco;
    if (preco === undefined || preco === "") return;
    setSalvandoId(groupId);
    await fetch("/api/admin/price-list-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price_list_id: lista.id, pai_id: groupId, preco }),
    });
    setSalvandoId(null);
  }

  async function removerItem(groupId) {
    setSalvandoId(groupId);
    await fetch("/api/admin/price-list-items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price_list_id: lista.id, pai_id: groupId }),
    });
    setItens((prev) => {
      const copy = { ...prev };
      delete copy[groupId];
      return copy;
    });
    setSalvandoId(null);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>{cliente.nome}</h1>
          <div style={styles.linkRow}>
            <span style={styles.linkText}>{listUrl}</span>
            <button onClick={handleCopyLink} style={styles.copyButton}>
              {copiado ? "Copiado!" : "Copiar link"}
            </button>
          </div>
        </div>
        <a href="/admin" style={styles.backLink}>← Voltar</a>
      </header>

      <div style={styles.addBox}>
        <input
          type="text"
          placeholder="Adicionar produto a esta lista..."
          value={busca}
          onChange={(e) => buscarProdutos(e.target.value)}
          style={styles.search}
        />
        {resultadosBusca.length > 0 && (
          <div style={styles.dropdown}>
            {resultadosBusca.map((g) => (
              <div
                key={g.id}
                onClick={() => adicionarProduto(g)}
                style={styles.dropdownItem}
              >
                {g.nome} {g.codigo ? `(${g.codigo})` : ""}
              </div>
            ))}
          </div>
        )}
      </div>

      <main style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Produto</th>
              <th style={styles.th}>Preço na lista</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {itensLista.map(([groupId, item]) => (
              <tr key={groupId} style={styles.tr}>
                <td style={styles.td}>
                  <div style={{ fontWeight: 600 }}>{item.nome}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>{item.codigo}</div>
                </td>
                <td style={styles.td}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.preco ?? ""}
                    onChange={(e) => handlePriceChange(groupId, e.target.value)}
                    style={styles.priceInput}
                  />
                </td>
                <td style={styles.td}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => salvarPreco(groupId)}
                      disabled={salvandoId === groupId}
                      style={styles.saveButton}
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => removerItem(groupId)}
                      disabled={salvandoId === groupId}
                      style={styles.removeButton}
                    >
                      Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {itensLista.length === 0 && (
              <tr>
                <td style={styles.td} colSpan={3}>
                  Nenhum item nesta lista ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  );
}

export async function getServerSideProps({ req, params }) {
  if (!requireAdmin(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }

  const { id } = params;

  const { data: lista } = await supabaseAdmin
    .from("price_lists")
    .select("id, slug, client:client_id ( id, nome )")
    .eq("id", id)
    .single();

  if (!lista) return { notFound: true };

  const { data: itensRaw } = await supabaseAdmin
    .from("price_list_items")
    .select("preco, grupo:pai_id ( id, nome, codigo )")
    .eq("price_list_id", id);

  const itensIniciais = {};
  (itensRaw || []).forEach((i) => {
    if (!i.grupo) return;
    itensIniciais[i.grupo.id] = {
      nome: i.grupo.nome,
      codigo: i.grupo.codigo,
      preco: String(i.preco),
    };
  });

  const proto = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${proto}://${req.headers.host}`;

  return {
    props: {
      lista: { id: lista.id },
      cliente: lista.client,
      itensIniciais,
      listUrl: `${baseUrl}/lista/${lista.slug}`,
    },
  };
}

const styles = {
  page: {
    minHeight: "100vh",
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: "system-ui, sans-serif",
    padding: "28px 24px 60px",
  },
  header: {
    maxWidth: 1000,
    margin: "0 auto 20px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderBottom: `3px solid ${COLORS.accent}`,
    paddingBottom: 16,
  },
  title: { margin: 0, fontSize: 22 },
  linkRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 6 },
  linkText: { fontSize: 12, color: COLORS.muted },
  copyButton: {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${COLORS.accent}`,
    background: COLORS.accentSoft,
    color: COLORS.accent,
    cursor: "pointer",
  },
  backLink: { color: COLORS.accent, fontSize: 14, textDecoration: "none" },
  addBox: { maxWidth: 1000, margin: "0 auto 16px", position: "relative" },
  search: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    background: "#fff",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 220,
    overflowY: "auto",
    zIndex: 10,
  },
  dropdownItem: {
    padding: "8px 12px",
    fontSize: 14,
    cursor: "pointer",
    borderBottom: `1px solid ${COLORS.border}`,
  },
  tableWrap: { maxWidth: 1000, margin: "0 auto", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: COLORS.muted,
    borderBottom: `1px solid ${COLORS.border}`,
    padding: "8px 10px",
  },
  tr: { borderBottom: `1px solid ${COLORS.border}` },
  td: { padding: "8px 10px", fontSize: 14, verticalAlign: "middle" },
  priceInput: {
    width: 110,
    padding: "6px 8px",
    borderRadius: 6,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
  },
  saveButton: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "none",
    background: COLORS.accent,
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  removeButton: {
    padding: "6px 10px",
    borderRadius: 6,
    border: `1px solid ${COLORS.danger}`,
    background: "transparent",
    color: COLORS.danger,
    fontSize: 12,
    cursor: "pointer",
  },
};