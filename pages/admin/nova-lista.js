// pages/admin/nova-lista.js
//
// Fluxo de 3 telas (tudo em uma página só, trocando por estado):
//   1) selecionar   -> escolhe o cliente (contato do Bling) e os produtos
//   2) precificar   -> mostra os itens escolhidos com o custo, e deixa
//                      aplicar % ou R$ em cima do custo, ou digitar o
//                      valor final direto
//   3) sucesso      -> mostra o link gerado, com botão de copiar

import { useEffect, useMemo, useState } from "react";
import { requireAdmin } from "../../lib/adminSession";
import { COLORS } from "../../lib/theme";
import ProdutoGrupoCard from "../../components/ProdutoGrupoCard";

const fmtMoeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function NovaLista() {
  const [step, setStep] = useState("selecionar");

  // --- passo 1: seleção -------------------------------------------------
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientes, setClientes] = useState([]);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);

  const [buscaProduto, setBuscaProduto] = useState("");
  const [grupos, setGrupos] = useState([]);
  const [gruposSelecionados, setGruposSelecionados] = useState({}); // { [group_id]: grupo }

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/admin/bling-customers?search=${encodeURIComponent(buscaCliente)}`)
        .then((r) => r.json())
        .then((d) => setClientes(d.customers || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [buscaCliente]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/admin/product-groups?search=${encodeURIComponent(buscaProduto)}`)
        .then((r) => r.json())
        .then((d) => setGrupos(d.groups || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [buscaProduto]);

  function toggleGrupo(grupo) {
    setGruposSelecionados((prev) => {
      const copy = { ...prev };
      if (copy[grupo.id]) delete copy[grupo.id];
      else copy[grupo.id] = grupo;
      return copy;
    });
  }

  const listaSelecionados = useMemo(
    () => Object.values(gruposSelecionados),
    [gruposSelecionados]
  );

  const podeAvancar = !!clienteSelecionado && listaSelecionados.length > 0;

  // --- passo 2: precificação --------------------------------------------
  // itensPreco: { [group_id]: { custo, final } }
  const [itensPreco, setItensPreco] = useState({});
  const [modoAplicar, setModoAplicar] = useState("percentual"); // percentual | valor
  const [valorAplicar, setValorAplicar] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erroGeracao, setErroGeracao] = useState("");

  function irParaPrecificacao() {
    const inicial = {};
    listaSelecionados.forEach((g) => {
      const custo = Number(g.preco_custo || 0);
      inicial[g.id] = { custo, final: g.preco_venda ?? custo };
    });
    setItensPreco(inicial);
    setStep("precificar");
  }

  function aplicarEmMassa() {
    const valor = Number(valorAplicar);
    if (Number.isNaN(valor)) return;

    setItensPreco((prev) => {
      const copy = { ...prev };
      for (const id of Object.keys(copy)) {
        const custo = Number(copy[id].custo || 0);
        const final =
          modoAplicar === "percentual"
            ? custo + custo * (valor / 100)
            : custo + valor;
        copy[id] = { ...copy[id], final: Number(final.toFixed(2)) };
      }
      return copy;
    });
  }

  function handleFinalManual(groupId, value) {
    setItensPreco((prev) => ({
      ...prev,
      [groupId]: { ...prev[groupId], final: value },
    }));
  }

  // --- passo 3: gerar / sucesso -------------------------------------------
  const [resultado, setResultado] = useState(null);

  async function gerarLista() {
    setErroGeracao("");
    setGerando(true);

    const items = listaSelecionados.map((g) => ({
      group_id: g.id,
      preco_final: itensPreco[g.id]?.final,
    }));

    const resp = await fetch("/api/admin/price-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bling_customer: {
          bling_id: clienteSelecionado.bling_id,
          nome: clienteSelecionado.nome,
        },
        items,
      }),
    });

    const data = await resp.json().catch(() => ({}));
    setGerando(false);

    if (!resp.ok) {
      setErroGeracao(data.error || "Erro ao gerar a lista.");
      return;
    }

    setResultado(data);
    setStep("sucesso");
  }

  function comecarDeNovo() {
    setStep("selecionar");
    setClienteSelecionado(null);
    setGruposSelecionados({});
    setItensPreco({});
    setValorAplicar("");
    setResultado(null);
  }

  // =========================================================================
  if (step === "sucesso") return <TelaSucesso resultado={resultado} onNovaLista={comecarDeNovo} />;

  if (step === "precificar") {
    return (
      <TelaPrecificacao
        cliente={clienteSelecionado}
        selecionados={listaSelecionados}
        itensPreco={itensPreco}
        modoAplicar={modoAplicar}
        setModoAplicar={setModoAplicar}
        valorAplicar={valorAplicar}
        setValorAplicar={setValorAplicar}
        onAplicar={aplicarEmMassa}
        onFinalManual={handleFinalManual}
        onVoltar={() => setStep("selecionar")}
        onGerar={gerarLista}
        gerando={gerando}
        erro={erroGeracao}
      />
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Nova lista de preços</h1>
        <a href="/admin" style={styles.backLink}>← Voltar</a>
      </header>

      <section style={styles.section}>
        <h2 style={styles.colTitle}>1. Cliente</h2>
        {!clienteSelecionado && (
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={buscaCliente}
            onChange={(e) => setBuscaCliente(e.target.value)}
            style={styles.search}
          />
        )}

        {clienteSelecionado && (
          <div style={styles.clienteSelecionadoBox}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
                {clienteSelecionado.nome}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: COLORS.muted }}>
                {clienteSelecionado.telefone || "sem telefone cadastrado"}
                {clienteSelecionado.documento ? ` · ${clienteSelecionado.documento}` : ""}
              </p>
            </div>
            <button
              onClick={() => setClienteSelecionado(null)}
              style={styles.trocarClienteButton}
            >
              Trocar
            </button>
          </div>
        )}

        {!clienteSelecionado && (
          <div style={styles.listBoxClientes}>
            {clientes.map((c) => (
              <div
                key={c.id}
                onClick={() => setClienteSelecionado(c)}
                style={styles.clienteRow}
              >
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{c.nome}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: COLORS.muted }}>
                  {c.telefone || "sem telefone"}
                  {c.documento ? ` · ${c.documento}` : ""}
                </p>
              </div>
            ))}
            {clientes.length === 0 && (
              <p style={styles.vazio}>
                Nenhum cliente encontrado. Confira se a sincronização com o Bling já rodou.
              </p>
            )}
          </div>
        )}
      </section>

      <hr style={styles.divider} />

      <section style={styles.section}>
        <h2 style={styles.colTitle}>2. Produtos ({listaSelecionados.length} selecionados)</h2>
        <input
          type="text"
          placeholder="Buscar produto por nome ou código..."
          value={buscaProduto}
          onChange={(e) => setBuscaProduto(e.target.value)}
          style={styles.search}
        />
        <div style={styles.gridProdutos}>
          {grupos.map((g) => (
            <ProdutoGrupoCard
              key={g.id}
              grupo={g}
              selecionado={!!gruposSelecionados[g.id]}
              onToggle={toggleGrupo}
            />
          ))}
          {grupos.length === 0 && (
            <p style={styles.vazio}>Nenhum produto encontrado.</p>
          )}
        </div>
      </section>

      <footer style={styles.footer}>
        <button
          onClick={irParaPrecificacao}
          disabled={!podeAvancar}
          style={{
            ...styles.avancarButton,
            opacity: podeAvancar ? 1 : 0.5,
            cursor: podeAvancar ? "pointer" : "not-allowed",
          }}
        >
          Avançar →
        </button>
      </footer>
    </div>
  );
}

function TelaPrecificacao({
  cliente,
  selecionados,
  itensPreco,
  modoAplicar,
  setModoAplicar,
  valorAplicar,
  setValorAplicar,
  onAplicar,
  onFinalManual,
  onVoltar,
  onGerar,
  gerando,
  erro,
}) {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Precificar lista</h1>
          <p style={styles.clienteHeader}>{cliente?.nome}</p>
        </div>
        <button onClick={onVoltar} style={styles.backLinkButton}>← Voltar</button>
      </header>

      <div style={styles.aplicarBox}>
        <select
          value={modoAplicar}
          onChange={(e) => setModoAplicar(e.target.value)}
          style={styles.select}
        >
          <option value="percentual">% sobre o custo</option>
          <option value="valor">R$ sobre o custo</option>
        </select>
        <input
          type="number"
          step="0.01"
          placeholder={modoAplicar === "percentual" ? "ex: 100" : "ex: 25,00"}
          value={valorAplicar}
          onChange={(e) => setValorAplicar(e.target.value)}
          style={styles.aplicarInput}
        />
        <button onClick={onAplicar} style={styles.aplicarButton}>
          Aplicar a todos
        </button>
      </div>

      <main style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Produto</th>
              <th style={styles.th}>Custo</th>
              <th style={styles.th}>Valor final</th>
            </tr>
          </thead>
          <tbody>
            {selecionados.map((g) => (
              <tr key={g.id} style={styles.tr}>
                <td style={styles.td}>
                  <div style={{ fontWeight: 600 }}>{g.nome}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>{g.codigo}</div>
                </td>
                <td style={styles.td}>{fmtMoeda(itensPreco[g.id]?.custo)}</td>
                <td style={styles.td}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={itensPreco[g.id]?.final ?? ""}
                    onChange={(e) => onFinalManual(g.id, e.target.value)}
                    style={styles.priceInput}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>

      {erro && <p style={{ color: COLORS.danger, textAlign: "center" }}>{erro}</p>}

      <footer style={styles.footer}>
        <button
          onClick={onGerar}
          disabled={gerando}
          style={styles.avancarButton}
        >
          {gerando ? "Gerando..." : "Gerar lista"}
        </button>
      </footer>
    </div>
  );
}

function TelaSucesso({ resultado, onNovaLista }) {
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    navigator.clipboard.writeText(resultado.url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div style={styles.sucessoPage}>
      <div style={styles.sucessoCard}>
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Lista gerada! 🎉</h1>
        <p style={{ margin: "0 0 20px", color: COLORS.muted }}>
          Envie esse link para o cliente:
        </p>
        <p style={styles.linkBox}>{resultado?.url}</p>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={copiar} style={styles.aplicarButton}>
            {copiado ? "Copiado!" : "Copiar link"}
          </button>
          <button onClick={onNovaLista} style={styles.backLinkButton}>
            Gerar nova lista
          </button>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps({ req }) {
  if (!requireAdmin(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  return { props: {} };
}

const styles = {
  page: {
    minHeight: "100vh",
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: "system-ui, sans-serif",
    padding: "28px 24px 100px",
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
  clienteHeader: { margin: "4px 0 0", color: COLORS.accent, fontWeight: 600 },
  backLink: { color: COLORS.accent, fontSize: 14, textDecoration: "none" },
  backLinkButton: {
    background: "transparent",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    padding: "8px 14px",
    fontSize: 14,
    cursor: "pointer",
  },
  section: {
    maxWidth: 1100,
    margin: "0 auto 24px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  divider: {
    maxWidth: 1100,
    margin: "0 auto 24px",
    border: "none",
    borderTop: `1px solid ${COLORS.border}`,
  },
  colTitle: { margin: 0, fontSize: 15 },
  search: {
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
  },
  clienteSelecionadoBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    border: `1px solid ${COLORS.accent}`,
    background: COLORS.accentSoft,
    borderRadius: 8,
    padding: "12px 16px",
  },
  trocarClienteButton: {
    background: "transparent",
    border: `1px solid ${COLORS.accent}`,
    color: COLORS.accent,
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  listBoxClientes: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 280,
    overflowY: "auto",
    paddingRight: 4,
  },
  clienteRow: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "10px 12px",
    cursor: "pointer",
  },
  vazio: { fontSize: 13, color: COLORS.muted },
  gridProdutos: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 12,
    maxHeight: 560,
    overflowY: "auto",
    paddingRight: 4,
  },
  footer: {
    maxWidth: 1100,
    margin: "24px auto 0",
    display: "flex",
    justifyContent: "flex-end",
  },
  avancarButton: {
    padding: "12px 22px",
    borderRadius: 8,
    border: "none",
    background: COLORS.accent,
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
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
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
  },
  aplicarInput: {
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
    width: 110,
    padding: "6px 8px",
    borderRadius: 6,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
  },
  sucessoPage: {
    minHeight: "100vh",
    background: COLORS.bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
  },
  sucessoCard: {
    width: 420,
    padding: 28,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    textAlign: "center",
  },
  linkBox: {
    padding: "10px 12px",
    borderRadius: 8,
    background: COLORS.accentSoft,
    color: COLORS.accent,
    fontSize: 13,
    wordBreak: "break-all",
    margin: 0,
  },
};