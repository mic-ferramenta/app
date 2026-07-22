// pages/admin/clients/[id].js
import { useMemo, useState } from "react";
import { requireAdmin } from "../../../lib/adminSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { COLORS } from "../../../lib/theme";

export default function ManageClient({ cliente, produtos, itensIniciais, listUrl }) {
  // itens: { [product_id]: preco (string) }
  const [itens, setItens] = useState(itensIniciais);
  const [busca, setBusca] = useState("");
  const [salvandoId, setSalvandoId] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter(
      (p) =>
        p.nome?.toLowerCase().includes(termo) ||
        p.codigo?.toLowerCase().includes(termo)
    );
  }, [busca, produtos]);

  function handlePriceChange(productId, value) {
    setItens((prev) => ({ ...prev, [productId]: value }));
  }

  async function handleSave(productId) {
    const preco = itens[productId];
    if (preco === undefined || preco === "") return;

    setSalvandoId(productId);
    await fetch("/api/admin/price-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: cliente.id,
        product_id: productId,
        preco,
      }),
    });
    setSalvandoId(null);
  }

  async function handleRemove(productId) {
    setSalvandoId(productId);
    await fetch("/api/admin/price-items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: cliente.id, product_id: productId }),
    });
    setItens((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
    setSalvandoId(null);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(listUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
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
        <a href="/admin" style={styles.backLink}>
          ← Voltar
        </a>
      </header>

      <input
        type="text"
        placeholder="Buscar produto por nome ou código..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        style={styles.search}
      />

      <main style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}></th>
              <th style={styles.th}>Produto</th>
              <th style={styles.th}>Tamanho</th>
              <th style={styles.th}>Custo</th>
              <th style={styles.th}>Preço na lista</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {produtosFiltrados.map((p) => {
              const naLista = itens[p.id] !== undefined;
              return (
                <tr key={p.id} style={styles.tr}>
                  <td style={styles.tdImg}>
                    {p.imagem_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagem_url} alt="" style={styles.thumb} />
                    ) : (
                      <div style={styles.thumbPlaceholder} />
                    )}
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 600 }}>{p.nome}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      {p.codigo}
                    </div>
                  </td>
                  <td style={styles.td}>{p.tamanho || "-"}</td>
                  <td style={styles.td}>
                    {p.preco_custo != null
                      ? Number(p.preco_custo).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })
                      : "-"}
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itens[p.id] ?? ""}
                      onChange={(e) => handlePriceChange(p.id, e.target.value)}
                      style={styles.priceInput}
                      placeholder="0,00"
                    />
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => handleSave(p.id)}
                        disabled={salvandoId === p.id}
                        style={styles.saveButton}
                      >
                        {naLista ? "Atualizar" : "Adicionar"}
                      </button>
                      {naLista && (
                        <button
                          onClick={() => handleRemove(p.id)}
                          disabled={salvandoId === p.id}
                          style={styles.removeButton}
                        >
                          Remover
                        </button>
                      )}
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

export async function getServerSideProps({ req, params }) {
  if (!requireAdmin(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }

  const { id } = params;

  const { data: cliente } = await supabaseAdmin
    .from("clients")
    .select("id, nome, slug")
    .eq("id", id)
    .single();

  if (!cliente) return { notFound: true };

  const { data: produtos } = await supabaseAdmin
    .from("products")
    .select("id, nome, codigo, imagem_url, tamanho, preco_custo")
    .order("nome", { ascending: true });

  const { data: itensExistentes } = await supabaseAdmin
    .from("price_list_items")
    .select("product_id, preco")
    .eq("client_id", id);

  const itensIniciais = {};
  (itensExistentes || []).forEach((i) => {
    itensIniciais[i.product_id] = String(i.preco);
  });

  const proto = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${proto}://${req.headers.host}`;

  return {
    props: {
      cliente,
      produtos: produtos || [],
      itensIniciais,
      listUrl: `${baseUrl}/lista/${cliente.slug}`,
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
    maxWidth: 1100,
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
  search: {
    maxWidth: 1100,
    margin: "0 auto 16px",
    display: "block",
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
  },
  tableWrap: { maxWidth: 1100, margin: "0 auto", overflowX: "auto" },
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
  tdImg: { padding: "8px 10px", width: 48 },
  thumb: {
    width: 40,
    height: 40,
    objectFit: "cover",
    borderRadius: 6,
    display: "block",
  },
  thumbPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    background: "#f2f2f2",
  },
  priceInput: {
    width: 90,
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