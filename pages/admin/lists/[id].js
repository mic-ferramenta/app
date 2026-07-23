// pages/admin/lists/[id].js
import { useState } from "react";
import { requireAdmin } from "../../../lib/adminSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { COLORS } from "../../../lib/theme";

const fmtMoeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ManageList({ lista, cliente, itensIniciais, listUrl, mostrarPreco }) {
  const [itens, setItens] = useState(itensIniciais); // array: [{ pai_id, nome, codigo, custo, preco, ordem }]
  const [copiado, setCopiado] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [salvandoId, setSalvandoId] = useState(null);
  const [salvandoTudo, setSalvandoTudo] = useState(false);
  const [modoAplicar, setModoAplicar] = useState("percentual"); // percentual | valor
  const [valorAplicar, setValorAplicar] = useState("");

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
    const novaOrdem = itens.length;
    const custoBase = Number(grupo.preco_venda ?? grupo.preco_custo ?? 0);

    await fetch("/api/admin/price-list-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price_list_id: lista.id,
        pai_id: grupo.id,
        preco: custoBase,
        ordem: novaOrdem,
      }),
    });

    setItens((prev) => [
      ...prev,
      {
        pai_id: grupo.id,
        nome: grupo.nome,
        codigo: grupo.codigo,
        custo: custoBase,
        preco: String(custoBase),
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

  // Aplica % ou R$ em cima do valor base de TODOS os itens da lista de
  // uma vez -- só muda localmente; "Salvar alterações" que grava.
  function aplicarEmMassa() {
    const valor = Number(valorAplicar);
    if (Number.isNaN(valor)) return;

    setItens((prev) =>
      prev.map((item) => {
        const custo = Number(item.custo || 0);
        const novoPreco =
          modoAplicar === "percentual"
            ? custo + custo * (valor / 100)
            : custo + valor;
        return { ...item, preco: String(Number(novoPreco.toFixed(2))) };
      })
    );
  }

  async function salvarTodos() {
    setSalvandoTudo(true);
    await Promise.all(
      itens.map((item) =>
        fetch("/api/admin/price-list-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            price_list_id: lista.id,
            pai_id: item.pai_id,
            preco: item.preco,
          }),
        })
      )
    );
    setSalvandoTudo(false);
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

      {mostrarPreco && (
        <div style={styles.aplicarBox}>
          <select
            value={modoAplicar}
            onChange={(e) => setModoAplicar(e.target.value)}
            style={styles.select}
          >
            <option value="percentual">% sobre o valor base</option>
            <option value="valor">R$ sobre o valor base</option>
          </select>
          <input
            type="number"
            step="0.01"
            placeholder={modoAplicar === "percentual" ? "ex: 100" : "ex: 25,00"}
            value={valorAplicar}
            onChange={(e) => setValorAplicar(e.target.value)}
            style={styles.aplicarInput}
          />
          <button onClick={aplicarEmMassa} style={styles.aplicarButton}>
            Aplicar a todos
          </button>
          <button
            onClick={salvarTodos}
            disabled={salvandoTudo}
            style={styles.salvarTudoButton}
          >
            {salvandoTudo ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      )}

      <main style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Ordem</th>
              <th style={styles.th}>Produto</th>
              {mostrarPreco && (
                <>
                  <th style={styles.th}>Valor base</th>
                  <th style={styles.th}>Preço na lista</th>
                  <th style={styles.th}>% de lucro</th>
                </>
              )}
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, index) => {
              const custo = Number(item.custo || 0);
              const preco = Number(item.preco || 0);
              const lucro = custo > 0 ? ((preco - custo) / custo) * 100 : null;

              return (
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
                  {mostrarPreco && (
                    <>
                      <td style={styles.td}>{fmtMoeda(item.custo)}</td>
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
                        {lucro === null ? (
                          <span style={{ color: COLORS.muted }}>-</span>
                        ) : (
                          <span
                            style={{
                              ...styles.lucroBadge,
                              color: lucro > 0 ? COLORS.stockOk : COLORS.danger,
                              background: lucro > 0 ? COLORS.stockOkBg : "#fee2e2",
                            }}
                          >
                            {lucro.toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </>
                  )}
                  <td style={styles.td}>
                    <button
                      onClick={() => removerItem(item.pai_id)}
                      disabled={salvandoId === item.pai_id}
                      style={styles.removeButton}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              );
            })}
            {itens.length === 0 && (
              <tr>
                <td style={styles.td} colSpan={mostrarPreco ? 6 : 3}>
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
    .select("id, slug, titulo, mostrar_preco, client:client_id ( id, nome )")
    .eq("id", id)
    .single();

  if (!lista) return { notFound: true };

  const { data: itensRaw } = await supabaseAdmin
    .from("price_list_items")
    .select(
      "preco, ordem, grupo:pai_id ( id, nome, codigo, preco_venda, preco_custo )"
    )
    .eq("price_list_id", id);

  // Ordena pela "ordem" salva; itens antigos sem ordem definida (null)
  // caem no fim, ordenados por nome.
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
    custo: Number(i.grupo.preco_venda ?? i.grupo.preco_custo ?? 0),
    preco: String(i.preco),
    ordem: i.ordem ?? index,
  }));

  const proto = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${proto}://${req.headers.host}`;

  return {
    props: {
      lista: { id: lista.id },
      cliente: lista.client || { nome: lista.titulo },
      itensIniciais,
      listUrl: `${baseUrl}/lista/${lista.slug}`,
      mostrarPreco: lista.mostrar_preco,
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
  addBox: { maxWidth: 1100, margin: "0 auto 16px", position: "relative" },
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
  aplicarBox: {
    maxWidth: 1100,
    margin: "0 auto 20px",
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  select: {
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
  },
  aplicarInput: {
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
    width: 140,
  },
  aplicarButton: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: COLORS.accent,
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  salvarTudoButton: {
    padding: "10px 16px",
    borderRadius: 8,
    border: `1px solid ${COLORS.stockOk}`,
    background: COLORS.stockOkBg,
    color: COLORS.stockOk,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
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
  lucroBadge: {
    display: "inline-block",
    fontSize: 13,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
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