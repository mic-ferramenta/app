// pages/admin/lists/[id].js
//
// Tela de edição de uma lista já gerada. A lógica de precificação
// aqui é EXATAMENTE a mesma de pages/admin/nova-lista.js (mesmas
// funções importadas de lib/precificacao.js) -- a única diferença é
// que aqui cada mudança salva na hora, em vez de só no final.

import { useRef, useState } from "react";
import { requireAdmin } from "../../../lib/adminSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { COLORS } from "../../../lib/theme";
import { totalItem, custoTotalItem, tamanhosOrdenados, precosPorTamanhoParaSalvar } from "../../../lib/precificacao";
import { composicaoTexto } from "../../../lib/grades";

const fmtMoeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ManageList({ lista, cliente, itensIniciais, listUrl, mostrarPreco }) {
  // itens: array, na ordem de exibição. Cada item:
  //   unidade -> { pai_id, nome, codigo, tipo:'unidade', custo, final }
  //   grade   -> { pai_id, nome, codigo, tipo:'grade', gradeNome, gradeId, quantidades, precos }
  const [itens, setItens] = useState(itensIniciais);
  const [copiado, setCopiado] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [salvandoTudo, setSalvandoTudo] = useState(false);
  const [modoAplicar, setModoAplicar] = useState("percentual"); // percentual | valor
  const [valorAplicar, setValorAplicar] = useState("");
  const [modoNovoItem, setModoNovoItem] = useState("unidade"); // só usado se a lista estiver vazia

  // Uma lista é ou toda de unidades, ou toda de grades -- o modo é
  // travado pelo que já existe; só é editável se a lista estiver vazia.
  const modoLista = itens.length > 0 ? itens[0].tipo : modoNovoItem;

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
    const resp = await fetch(
      `/api/admin/product-groups?search=${encodeURIComponent(termo)}&modo=${modoLista}`
    );
    const data = await resp.json().catch(() => ({}));
    setResultadosBusca(data.groups || []);
  }

  async function adicionarProduto(grupo) {
    const novaOrdem = itens.length;
    let novoItem;

    if (modoLista === "grade") {
      const custoUnitario = Number(grupo.preco_venda ?? 0);
      const quantidades = grupo.grade_disponivel?.composicao || {};
      const precos = {};
      Object.keys(quantidades).forEach((tam) => {
        precos[tam] = { custo: custoUnitario, final: custoUnitario };
      });
      novoItem = {
        pai_id: grupo.id,
        nome: grupo.nome,
        codigo: grupo.codigo,
        tipo: "grade",
        gradeNome: grupo.grade_disponivel?.nome,
        gradeId: grupo.grade_disponivel?.id,
        quantidades,
        precos,
      };
    } else {
      const custo = Number(grupo.preco_venda ?? grupo.preco_custo ?? 0);
      novoItem = { pai_id: grupo.id, nome: grupo.nome, codigo: grupo.codigo, tipo: "unidade", custo, final: custo };
    }

    await fetch("/api/admin/price-list-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price_list_id: lista.id,
        pai_id: grupo.id,
        preco: totalItem(novoItem, modoLista),
        ordem: novaOrdem,
        tipo: modoLista,
        grade_id: modoLista === "grade" ? novoItem.gradeId : null,
        precos_por_tamanho: modoLista === "grade" ? precosPorTamanhoParaSalvar(novoItem) : null,
      }),
    });

    setItens((prev) => [...prev, novoItem]);
    setBusca("");
    setResultadosBusca([]);
  }

  function handleFinalManualUnidade(paiId, value) {
    setItens((prev) => prev.map((i) => (i.pai_id === paiId ? { ...i, final: value } : i)));
  }

  function handleFinalManualGrade(paiId, tamanho, value) {
    setItens((prev) =>
      prev.map((i) =>
        i.pai_id === paiId
          ? { ...i, precos: { ...i.precos, [tamanho]: { ...i.precos[tamanho], final: value } } }
          : i
      )
    );
  }

  // Aplica % ou R$ sobre o preço-base de cada tamanho (grade) ou sobre
  // o valor base do item (unidade) -- mesma lógica da criação.
  function aplicarEmMassa() {
    const valor = Number(valorAplicar);
    if (Number.isNaN(valor)) return;

    setItens((prev) =>
      prev.map((item) => {
        if (item.tipo === "grade") {
          const novosPrecos = {};
          for (const tam of Object.keys(item.precos)) {
            const custo = Number(item.precos[tam].custo || 0);
            const final =
              modoAplicar === "percentual" ? custo * (1 + valor / 100) : custo + valor;
            novosPrecos[tam] = { ...item.precos[tam], final: Number(final.toFixed(2)) };
          }
          return { ...item, precos: novosPrecos };
        }
        const custo = Number(item.custo || 0);
        const final = modoAplicar === "percentual" ? custo * (1 + valor / 100) : custo + valor;
        return { ...item, final: Number(final.toFixed(2)) };
      })
    );
  }

  async function salvarTodos() {
    setSalvandoTudo(true);
    await Promise.all(
      itens.map((item, index) =>
        fetch("/api/admin/price-list-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            price_list_id: lista.id,
            pai_id: item.pai_id,
            preco: totalItem(item, item.tipo),
            ordem: index,
            precos_por_tamanho: item.tipo === "grade" ? precosPorTamanhoParaSalvar(item) : null,
          }),
        })
      )
    );
    setSalvandoTudo(false);
  }

  async function removerItem(paiId) {
    await fetch("/api/admin/price-list-items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price_list_id: lista.id, pai_id: paiId }),
    });
    setItens((prev) => prev.filter((i) => i.pai_id !== paiId));
  }

  // Arrastar-e-soltar pra reordenar -- mesma lógica da criação. Depois
  // de soltar, persiste a ordem sequencial de todo mundo de uma vez.
  const arrastandoIdRef = useRef(null);

  function handleDragStart(id) {
    arrastandoIdRef.current = id;
  }
  function handleDragEnter(id) {
    if (!arrastandoIdRef.current || arrastandoIdRef.current === id) return;
    setItens((prev) => {
      const from = prev.findIndex((i) => i.pai_id === arrastandoIdRef.current);
      const to = prev.findIndex((i) => i.pai_id === id);
      if (from === -1 || to === -1) return prev;
      const copy = [...prev];
      const [movido] = copy.splice(from, 1);
      copy.splice(to, 0, movido);
      return copy;
    });
  }
  async function handleDragEnd() {
    arrastandoIdRef.current = null;
    await Promise.all(
      itens.map((item, index) =>
        fetch("/api/admin/price-list-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ price_list_id: lista.id, pai_id: item.pai_id, ordem: index }),
        })
      )
    );
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

      {itens.length === 0 && (
        <div style={styles.modoProdutoRow}>
          <button
            onClick={() => setModoNovoItem("unidade")}
            style={{
              ...styles.modoButton,
              ...(modoNovoItem === "unidade" ? styles.modoButtonAtivo : {}),
            }}
          >
            Por unidade
          </button>
          <button
            onClick={() => setModoNovoItem("grade")}
            style={{
              ...styles.modoButton,
              ...(modoNovoItem === "grade" ? styles.modoButtonAtivo : {}),
            }}
          >
            Por grade
          </button>
        </div>
      )}

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
              <div key={g.id} onClick={() => adicionarProduto(g)} style={styles.dropdownItem}>
                {g.nome} {g.codigo ? `(${g.codigo})` : ""}
                {modoLista === "grade" && g.grade_disponivel && (
                  <span style={{ color: COLORS.muted }}> · {g.grade_disponivel.nome}</span>
                )}
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
            <option value="valor">
              {modoLista === "grade" ? "R$ sobre o preço de cada tamanho" : "R$ sobre o valor base"}
            </option>
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
          <button onClick={salvarTodos} disabled={salvandoTudo} style={styles.salvarTudoButton}>
            {salvandoTudo ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      )}

      <p style={styles.arrastarDica}>Segure e arraste um item pela alça (⠿) para reordenar.</p>

      <main style={styles.listaItens}>
        {itens.map((item) => {
          const custoTotal = custoTotalItem(item, item.tipo);
          const finalTotal = totalItem(item, item.tipo);
          const lucro = custoTotal > 0 ? ((finalTotal - custoTotal) / custoTotal) * 100 : null;

          return (
            <div
              key={item.pai_id}
              draggable
              onDragStart={() => handleDragStart(item.pai_id)}
              onDragEnter={() => handleDragEnter(item.pai_id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              style={styles.itemCard}
            >
              <div style={styles.itemCardHeader}>
                <span style={styles.dragHandle} title="Arraste para reordenar">⠿</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{item.nome}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>
                    {item.tipo === "grade"
                      ? `${item.gradeNome} · ${composicaoTexto({ composicao: item.quantidades })}`
                      : item.codigo}
                  </div>
                </div>
                {mostrarPreco && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>Total</div>
                    <div style={{ fontWeight: 700 }}>{fmtMoeda(finalTotal)}</div>
                  </div>
                )}
                <button onClick={() => removerItem(item.pai_id)} style={styles.removeButton}>
                  Remover
                </button>
              </div>

              {mostrarPreco && item.tipo === "grade" && (
                <table style={styles.miniTable}>
                  <thead>
                    <tr>
                      <th style={styles.miniTh}>Tamanho</th>
                      <th style={styles.miniTh}>Qtd</th>
                      <th style={styles.miniTh}>Preço</th>
                      <th style={styles.miniTh}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tamanhosOrdenados(item.quantidades).map((tam) => {
                      const qtd = Number(item.quantidades[tam] || 0);
                      const precoFinal = Number(item.precos[tam]?.final || 0);
                      return (
                        <tr key={tam}>
                          <td style={styles.miniTd}>{tam}</td>
                          <td style={styles.miniTd}>{qtd}</td>
                          <td style={styles.miniTd}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.precos[tam]?.final ?? ""}
                              onChange={(e) =>
                                handleFinalManualGrade(item.pai_id, tam, e.target.value)
                              }
                              style={styles.priceInputSmall}
                            />
                          </td>
                          <td style={styles.miniTd}>{fmtMoeda(precoFinal * qtd)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {mostrarPreco && item.tipo === "unidade" && (
                <div style={styles.unidadeRow}>
                  <span style={{ fontSize: 13, color: COLORS.muted }}>
                    Valor base: {fmtMoeda(item.custo)}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.final ?? ""}
                    onChange={(e) => handleFinalManualUnidade(item.pai_id, e.target.value)}
                    style={styles.priceInput}
                  />
                </div>
              )}

              {mostrarPreco && (
                <div style={styles.lucroRow}>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>% de lucro:</span>
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
                </div>
              )}
            </div>
          );
        })}

        {itens.length === 0 && <p style={styles.vazio}>Nenhum item nesta lista ainda.</p>}
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
      "preco, ordem, tipo, precos_por_tamanho, grade:grade_id ( id, nome, composicao ), grupo:pai_id ( id, nome, codigo, preco_venda, preco_custo )"
    )
    .eq("price_list_id", id);

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

  const itensIniciais = itensOrdenados.map((i) => {
    if (i.tipo === "grade") {
      const quantidades = i.grade?.composicao || {};
      const custoUnitario = Number(i.grupo.preco_venda ?? 0);
      const precos = {};
      Object.keys(quantidades).forEach((tam) => {
        const salvo = i.precos_por_tamanho?.[tam];
        precos[tam] = {
          custo: custoUnitario,
          final: salvo !== undefined && salvo !== null ? Number(salvo) : custoUnitario,
        };
      });
      return {
        pai_id: i.grupo.id,
        nome: i.grupo.nome,
        codigo: i.grupo.codigo,
        tipo: "grade",
        gradeNome: i.grade?.nome || "Grade",
        gradeId: i.grade?.id,
        quantidades,
        precos,
      };
    }

    return {
      pai_id: i.grupo.id,
      nome: i.grupo.nome,
      codigo: i.grupo.codigo,
      tipo: "unidade",
      custo: Number(i.grupo.preco_venda ?? i.grupo.preco_custo ?? 0),
      final: Number(i.preco),
    };
  });

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
  modoProdutoRow: { maxWidth: 1100, margin: "0 auto 16px", display: "flex", gap: 8 },
  modoButton: {
    padding: "8px 16px",
    borderRadius: 999,
    border: `1px solid ${COLORS.border}`,
    background: "#fff",
    color: COLORS.text,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  modoButtonAtivo: {
    borderColor: COLORS.accent,
    background: COLORS.accentSoft,
    color: COLORS.accent,
  },
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
    margin: "0 auto 12px",
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  arrastarDica: {
    maxWidth: 1100,
    margin: "0 auto 16px",
    fontSize: 12,
    color: COLORS.muted,
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
  listaItens: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  itemCard: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    padding: 12,
    background: "#fff",
  },
  itemCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  dragHandle: {
    cursor: "grab",
    fontSize: 18,
    color: COLORS.muted,
    userSelect: "none",
  },
  miniTable: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 10,
  },
  miniTh: {
    textAlign: "left",
    fontSize: 11,
    color: COLORS.muted,
    borderBottom: `1px solid ${COLORS.border}`,
    padding: "4px 6px",
  },
  miniTd: {
    fontSize: 13,
    padding: "4px 6px",
    borderBottom: `1px solid ${COLORS.border}`,
  },
  priceInputSmall: {
    boxSizing: "border-box",
    width: 90,
    padding: "5px 7px",
    borderRadius: 6,
    border: `1px solid ${COLORS.border}`,
    fontSize: 13,
  },
  unidadeRow: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  priceInput: {
    boxSizing: "border-box",
    width: 110,
    padding: "6px 8px",
    borderRadius: 6,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
  },
  lucroRow: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
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
  vazio: { maxWidth: 1100, margin: "0 auto", fontSize: 13, color: COLORS.muted },
};