// pages/admin/lists/[id].js
import { useState } from "react";
import { requireAdmin } from "../../../lib/adminSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { COLORS } from "../../../lib/theme";

const fmtMoeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ManageList({ lista, cliente, itensIniciais, listUrl }) {
  const [itens, setItens] = useState(itensIniciais); // array: [{ pai_id, nome, codigo, preco, ordem }]
  const [copiado, setCopiado] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [salvandoId, setSalvandoId] = useState(null);

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
    const novaOrdem = itens.length; // vai pro final da lista
    const precoInicial = grupo.preco_venda || 0;

    await fetch("/api/admin/price-list-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price_list_id: lista.id,
        pai_id: grupo.id,
        preco: precoInicial,
        ordem: novaOrdem,
      }),
    });

    setItens((prev) => [
      ...prev,
      {
        pai_id: grupo.id,
        nome: grupo.nome,
        codigo: grupo.codigo,
        preco: String(precoInicial),
        ordem: novaOrdem,
      },
    ]);
    setSalvandoId(null);
    setBusca("");
    setResultadosBusca([]);
  }

  function handlePriceChange(paiId, value) {
    setItens((prev) =>
      prev.map((i) => (i.pai_id === paiId ? { ...i, preco: value } : i))
    );
  }

  async function salvarPreco(paiId) {
    const item = itens.find((i) => i.pai_id === paiId);
    if (!item || item.preco === undefined || item.preco === "") return;
    setSalvandoId(paiId);
    await fetch("/api/admin/price-list-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price_list_id: lista.id, pai_id: paiId, preco: item.preco }),
    });
    setSalvandoId(null);
  }

  async function removerItem(paiId) {
    setSalvandoId(paiId);
    await fetch("/api/admin/price-list-items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price_list_id: lista.id, pai_id: paiId }),
    });
    setItens((prev) => prev.filter((i) => i.pai_id !== paiId));
    setSalvandoId(null);
  }

  async function moverItem(paiId, direcao) {
    const idx = itens.findIndex((i) => i.pai_id === paiId);
    const novoIdx = idx + direcao;
    if (idx === -1 || novoIdx < 0 || novoIdx >= itens.length) return;

    const reordenados = [...itens];
    [reordenados[idx], reordenados[novoIdx]] = [reordenados[novoIdx], reordenados[idx]];
    // recalcula a ordem sequencial (0, 1, 2, ...) pra bater com a posição na tela
    const comOrdemNova = reordenados.map((item, i) => ({ ...item, ordem: i }));
    setItens(comOrdemNova);

    setSalvandoId(paiId);
    const a = comOrdemNova[idx < novoIdx ? idx : novoIdx];
    const b = comOrdemNova[idx < novoIdx ? novoIdx : idx];
    await Promise.all([
      fetch("/api/admin/price-list-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_list_id: lista.id, pai_id: a.pai_id, ordem: a.ordem }),
      }),
      fetch("/api/admin/price-list-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_list_id: lista.id, pai_id: b.pai_id, ordem: b.ordem }),
      }),
    ]);
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
              <th style={styles.th}>Ordem</th>
              <th style={styles.th}>Produto</th>
              <th style={styles.th}>Preço na lista</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, index) => (
              <tr key={item.pai_id} style={styles.tr}>
                <td style={styles.td}>
                  <div style={styles.ordemButtons}>
                    <button
                      onClick={() => moverItem(item.pai_id, -1)}
                      disabled={index === 0 || salvandoId === item.pai_id}
                      title="Mover para cima"
                      style={styles.ordemButton}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moverItem(item.pai_id, 1)}
                      disabled={index === itens.length - 1 || salvandoId === item.pai_id}
                      title="Mover para baixo"
                      style={styles.ordemButton}
                    >
                      ▼
                    </button>
                  </div>
                </td>
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
                    onChange={(e) => handlePriceChange(item.pai_id, e.target.value)}
                    style={styles.priceInput}
                  />
                </td>
                <td style={styles.td}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => salvarPreco(item.pai_id)}
                      disabled={salvandoId === item.pai_id}
                      style={styles.saveButton}
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => removerItem(item.pai_id)}
                      disabled={salvandoId === item.pai_id}
                      style={styles.removeButton}
                    >
                      Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td style={styles.td} colSpan={4}>
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
    .select("preco, ordem, grupo:pai_id ( id, nome, codigo )")
    .eq("price_list_id", id);

  // Ordena pela "ordem" salva; itens antigos sem ordem definida (null)
  // caem no fim, ordenados por nome -- e a primeira vez que alguém
  // mexer nas setas já fixa uma ordem sequencial de verdade.
  const itensOrdenados = (itensRaw || [])
    .filter((i) => i.grupo)
    .sort((a, b) => {
      if (a.ordem == null && b.ordem == null) {
        return a.grupo.nome.localeCompare(b.grupo.nome, "pt-BR");
      }
      if (a.ordem == null) return 1;
      if (b.ordem == null) return -1;
      return a.ordem - b.ordem;
    });

  const itensIniciais = itensOrdenados.map((i, index) => ({
    pai_id: i.grupo.id,
    nome: i.grupo.nome,
    codigo: i.grupo.codigo,
    preco: String(i.preco),
    ordem: i.ordem ?? index,
  }));

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
    boxSizing: "border-box",
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
    boxSizing: "border-box",
    width: 110,
    padding: "6px 8px",
    borderRadius: 6,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
  },
  ordemButtons: { display: "flex", flexDirection: "column", gap: 2 },
  ordemButton: {
    width: 26,
    height: 22,
    borderRadius: 4,
    border: `1px solid ${COLORS.border}`,
    background: "#fff",
    color: COLORS.text,
    fontSize: 11,
    cursor: "pointer",
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