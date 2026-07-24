// pages/admin/nova-lista.js
//
// Fluxo de 3 telas (tudo em uma página só, trocando por estado):
//   1) selecionar   -> escolhe o cliente (contato do Bling), a validade
//                      da lista e os produtos (por unidade ou por grade)
//   2) precificar   -> mostra os itens escolhidos. No modo grade, um
//                      preço por TAMANHO (P a 2GG), multiplicado pela
//                      quantidade daquele tamanho na grade. Dá pra
//                      arrastar os itens pra reordenar.
//   3) sucesso      -> mostra o link gerado, com botão de copiar

import { useEffect, useMemo, useRef, useState } from "react";
import { requireAdmin } from "../../lib/adminSession";
import { COLORS } from "../../lib/theme";
import { totalItem, custoTotalItem, tamanhosOrdenados, precosPorTamanhoParaSalvar } from "../../lib/precificacao";
import { composicaoTexto } from "../../lib/grades";
import ProdutoGrupoCard from "../../components/ProdutoGrupoCard";
import GradeProdutoCard from "../../components/GradeProdutoCard";

const LOGO_URL =
  "https://miccamisasdetime.com.br/cdn/shop/files/Design_sem_nome_-_2026-02-01T085034.319.png?v=1770226222&width=90";

const fmtMoeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function NovaLista() {
  const [step, setStep] = useState("selecionar");

  // --- passo 1: seleção -------------------------------------------------
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientes, setClientes] = useState([]);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [usarTitulo, setUsarTitulo] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [mostrarPreco, setMostrarPreco] = useState(true);

  const [buscaProduto, setBuscaProduto] = useState("");
  const [modoProduto, setModoProduto] = useState("unidade"); // unidade | grade
  const [grupos, setGrupos] = useState([]);
  const [gruposSelecionados, setGruposSelecionados] = useState({}); // { [pai_id]: grupo }

  useEffect(() => {
    if (!buscaCliente.trim()) {
      setClientes([]);
      return;
    }
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
      fetch(`/api/admin/product-groups?search=${encodeURIComponent(buscaProduto)}&modo=${modoProduto}`)
        .then((r) => r.json())
        .then((d) => setGrupos(d.groups || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [buscaProduto, modoProduto]);

  // Trocar de modo limpa a seleção -- uma lista é ou toda de unidades,
  // ou toda de grades, pra não misturar duas lógicas de preço diferentes.
  function trocarModoProduto(novoModo) {
    if (novoModo === modoProduto) return;
    setModoProduto(novoModo);
    setGruposSelecionados({});
    setBuscaProduto("");
  }

  function toggleGrupo(grupo) {
    setGruposSelecionados((prev) => {
      const copy = { ...prev };
      if (copy[grupo.id]) delete copy[grupo.id];
      else copy[grupo.id] = grupo;
      return copy;
    });
  }

  const todosVisiveisSelecionados =
    grupos.length > 0 && grupos.every((g) => gruposSelecionados[g.id]);

  function marcarTodosVisiveis() {
    setGruposSelecionados((prev) => {
      const copy = { ...prev };
      if (todosVisiveisSelecionados) {
        grupos.forEach((g) => delete copy[g.id]);
      } else {
        grupos.forEach((g) => {
          copy[g.id] = g;
        });
      }
      return copy;
    });
  }

  const listaSelecionados = useMemo(
    () =>
      Object.values(gruposSelecionados).sort((a, b) =>
        (a.nome || "").localeCompare(b.nome || "", "pt-BR")
      ),
    [gruposSelecionados]
  );

  const nomeParaExibicao = clienteSelecionado?.nome || titulo;

  const podeAvancar =
    (!!clienteSelecionado || (usarTitulo && titulo.trim())) &&
    listaSelecionados.length > 0;

  // --- passo 2: precificação --------------------------------------------
  // itensPreco no modo grade:  { [pai_id]: { quantidades: {P:1,M:2,...}, precos: { P:{custo,final}, ... } } }
  // itensPreco no modo unidade: { [pai_id]: { custo, final } }
  const [itensPreco, setItensPreco] = useState({});
  const [ordemManual, setOrdemManual] = useState([]); // array de pai_id, na ordem de exibição
  const [modoAplicar, setModoAplicar] = useState("percentual"); // percentual | valor
  const [valorAplicar, setValorAplicar] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erroGeracao, setErroGeracao] = useState("");

  const selecionadosOrdenados = useMemo(
    () => ordemManual.map((id) => gruposSelecionados[id]).filter(Boolean),
    [ordemManual, gruposSelecionados]
  );

  function irParaPrecificacao() {
    const inicial = {};
    listaSelecionados.forEach((g) => {
      if (modoProduto === "grade") {
        const custoUnitario = Number(g.preco_venda ?? 0);
        const quantidades = g.grade_disponivel?.composicao || {};
        const precos = {};
        Object.keys(quantidades).forEach((tam) => {
          precos[tam] = { custo: custoUnitario, final: custoUnitario };
        });
        inicial[g.id] = { quantidades, precos };
      } else {
        const custo = Number(g.preco_venda ?? g.preco_custo ?? 0);
        inicial[g.id] = { custo, final: custo };
      }
    });
    setItensPreco(inicial);
    setOrdemManual(listaSelecionados.map((g) => g.id)); // começa em ordem alfabética
    setStep("precificar");
  }

  // Reordenação por arrastar-e-soltar: pega o item arrastado e coloca
  // na posição do item onde soltou.
  function reordenarPara(idArrastado, idAlvo) {
    if (idArrastado === idAlvo) return;
    setOrdemManual((prev) => {
      const from = prev.indexOf(idArrastado);
      const to = prev.indexOf(idAlvo);
      if (from === -1 || to === -1) return prev;
      const copy = [...prev];
      const [movido] = copy.splice(from, 1);
      copy.splice(to, 0, movido);
      return copy;
    });
  }

  // Aplica % ou R$ sobre o preço-base de cada tamanho (no modo grade)
  // ou sobre o valor base do item (no modo unidade).
  function aplicarEmMassa() {
    const valor = Number(valorAplicar);
    if (Number.isNaN(valor)) return;

    setItensPreco((prev) => {
      const copy = { ...prev };
      for (const id of Object.keys(copy)) {
        const item = copy[id];

        if (modoProduto === "grade") {
          const novosPrecos = {};
          for (const tam of Object.keys(item.precos)) {
            const custo = Number(item.precos[tam].custo || 0);
            const final =
              modoAplicar === "percentual" ? custo * (1 + valor / 100) : custo + valor;
            novosPrecos[tam] = { ...item.precos[tam], final: Number(final.toFixed(2)) };
          }
          copy[id] = { ...item, precos: novosPrecos };
        } else {
          const custo = Number(item.custo || 0);
          const final =
            modoAplicar === "percentual" ? custo * (1 + valor / 100) : custo + valor;
          copy[id] = { ...item, final: Number(final.toFixed(2)) };
        }
      }
      return copy;
    });
  }

  function handleFinalManualUnidade(paiId, value) {
    setItensPreco((prev) => ({
      ...prev,
      [paiId]: { ...prev[paiId], final: value },
    }));
  }

  function handleFinalManualGrade(paiId, tamanho, value) {
    setItensPreco((prev) => ({
      ...prev,
      [paiId]: {
        ...prev[paiId],
        precos: {
          ...prev[paiId].precos,
          [tamanho]: { ...prev[paiId].precos[tamanho], final: value },
        },
      },
    }));
  }

  // --- passo 3: gerar / sucesso -------------------------------------------
  const [resultado, setResultado] = useState(null);

  async function gerarLista() {
    setErroGeracao("");
    setGerando(true);

    const items = selecionadosOrdenados.map((g) => ({
      pai_id: g.id,
      preco_final: totalItem(itensPreco[g.id], modoProduto),
      tipo: modoProduto,
      grade_id: modoProduto === "grade" ? g.grade_disponivel?.id : undefined,
      precos_por_tamanho:
        modoProduto === "grade" ? precosPorTamanhoParaSalvar(itensPreco[g.id]) : undefined,
    }));

    const resp = await fetch("/api/admin/price-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bling_customer: clienteSelecionado
          ? { bling_id: clienteSelecionado.bling_id, nome: clienteSelecionado.nome }
          : undefined,
        titulo: clienteSelecionado ? undefined : titulo,
        vencimento: vencimento || null,
        mostrar_preco: mostrarPreco,
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
    setBuscaCliente("");
    setClientes([]);
    setClienteSelecionado(null);
    setUsarTitulo(false);
    setTitulo("");
    setVencimento("");
    setMostrarPreco(true);
    setBuscaProduto("");
    setModoProduto("unidade");
    setGruposSelecionados({});
    setItensPreco({});
    setOrdemManual([]);
    setValorAplicar("");
    setResultado(null);
  }

  // =========================================================================
  if (step === "sucesso") return <TelaSucesso resultado={resultado} onNovaLista={comecarDeNovo} />;

  if (step === "precificar") {
    return (
      <TelaPrecificacao
        nomeExibicao={nomeParaExibicao}
        mostrarPreco={mostrarPreco}
        modoProduto={modoProduto}
        selecionados={selecionadosOrdenados}
        itensPreco={itensPreco}
        modoAplicar={modoAplicar}
        setModoAplicar={setModoAplicar}
        valorAplicar={valorAplicar}
        setValorAplicar={setValorAplicar}
        onAplicar={aplicarEmMassa}
        onFinalManualUnidade={handleFinalManualUnidade}
        onFinalManualGrade={handleFinalManualGrade}
        onReorder={reordenarPara}
        onVoltar={() => setStep("selecionar")}
        onGerar={gerarLista}
        gerando={gerando}
        erro={erroGeracao}
      />
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.tarja}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_URL} alt="MIC Camisas de Time" style={styles.logo} />
      </div>

      <div style={styles.content}>
        <header style={styles.header}>
          <h1 style={styles.title}>Nova lista de preços</h1>
          <a href="/admin" style={styles.backLink}>← Voltar</a>
        </header>

        <section style={styles.section}>
          <h2 style={styles.colTitle}>1. Cliente e validade</h2>

          {!clienteSelecionado && (
            <button
              onClick={() => {
                setUsarTitulo((v) => !v);
                setBuscaCliente("");
              }}
              style={styles.toggleModoButton}
            >
              {usarTitulo
                ? "← Selecionar um cliente"
                : "Gerar sem cliente específico (usar um título)"}
            </button>
          )}

          <div style={styles.clienteEValidade}>
            <div style={{ minWidth: 0, position: "relative" }}>
              {usarTitulo && !clienteSelecionado && (
                <input
                  type="text"
                  placeholder='Título da lista, ex: "Preços de promoção - Julho"'
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  style={styles.search}
                />
              )}

              {!usarTitulo && !clienteSelecionado && (
                <>
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                    style={styles.search}
                  />
                  {buscaCliente.trim() && (
                    <div style={styles.listBoxClientes}>
                      {clientes.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setClienteSelecionado(c);
                            setBuscaCliente("");
                          }}
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
                        <p style={styles.vazio}>Nenhum cliente encontrado.</p>
                      )}
                    </div>
                  )}
                </>
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
            </div>

            <label style={styles.validadeLabel}>
              Validade da lista
              <input
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                style={styles.validadeInput}
              />
            </label>

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={!mostrarPreco}
                onChange={(e) => setMostrarPreco(!e.target.checked)}
              />
              Gerar sem preço (só catálogo/disponibilidade)
            </label>
          </div>
        </section>

        <hr style={styles.divider} />

        <section style={styles.section}>
          <h2 style={styles.colTitle}>2. Produtos ({listaSelecionados.length} selecionados)</h2>

          <div style={styles.modoProdutoRow}>
            <button
              onClick={() => trocarModoProduto("unidade")}
              style={{
                ...styles.modoButton,
                ...(modoProduto === "unidade" ? styles.modoButtonAtivo : {}),
              }}
            >
              Por unidade
            </button>
            <button
              onClick={() => trocarModoProduto("grade")}
              style={{
                ...styles.modoButton,
                ...(modoProduto === "grade" ? styles.modoButtonAtivo : {}),
              }}
            >
              Por grade
            </button>
          </div>

          {modoProduto === "grade" && (
            <p style={styles.gradeAviso}>
              Só aparecem produtos que têm pelo menos 1 das grades cadastradas
              possível com o estoque de hoje (tenta Grade 1, depois 2, depois 3).
            </p>
          )}

          <div style={styles.buscaProdutoRow}>
            <input
              type="text"
              placeholder="Buscar produto por nome ou código..."
              value={buscaProduto}
              onChange={(e) => setBuscaProduto(e.target.value)}
              style={{ ...styles.search, flex: 1 }}
            />
            <button
              onClick={marcarTodosVisiveis}
              disabled={grupos.length === 0}
              style={styles.marcarTodosButton}
            >
              {todosVisiveisSelecionados ? "Desmarcar todos" : "Marcar todos"}
            </button>
          </div>

          <div style={styles.gridProdutos}>
            {grupos.map((g) =>
              modoProduto === "grade" ? (
                <GradeProdutoCard
                  key={g.id}
                  grupo={g}
                  selecionado={!!gruposSelecionados[g.id]}
                  onToggle={toggleGrupo}
                />
              ) : (
                <ProdutoGrupoCard
                  key={g.id}
                  grupo={g}
                  selecionado={!!gruposSelecionados[g.id]}
                  onToggle={toggleGrupo}
                />
              )
            )}
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
    </div>
  );
}

function TelaPrecificacao({
  nomeExibicao,
  mostrarPreco,
  modoProduto,
  selecionados,
  itensPreco,
  modoAplicar,
  setModoAplicar,
  valorAplicar,
  setValorAplicar,
  onAplicar,
  onFinalManualUnidade,
  onFinalManualGrade,
  onReorder,
  onVoltar,
  onGerar,
  gerando,
  erro,
}) {
  const arrastandoIdRef = useRef(null);

  function handleDragStart(id) {
    arrastandoIdRef.current = id;
  }
  function handleDragEnter(id) {
    if (arrastandoIdRef.current && arrastandoIdRef.current !== id) {
      onReorder(arrastandoIdRef.current, id);
    }
  }
  function handleDragEnd() {
    arrastandoIdRef.current = null;
  }

  return (
    <div style={styles.page}>
      <div style={styles.tarja}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_URL} alt="MIC Camisas de Time" style={styles.logo} />
      </div>

      <div style={styles.content}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>{mostrarPreco ? "Precificar lista" : "Ordenar itens da lista"}</h1>
            <p style={styles.clienteHeader}>{nomeExibicao}</p>
          </div>
          <button onClick={onVoltar} style={styles.backLinkButton}>← Voltar</button>
        </header>

        {mostrarPreco && (
          <div style={styles.aplicarBox}>
            <select
              value={modoAplicar}
              onChange={(e) => setModoAplicar(e.target.value)}
              style={styles.select}
            >
              <option value="percentual">% sobre o valor base</option>
              <option value="valor">
                {modoProduto === "grade" ? "R$ sobre o preço de cada tamanho" : "R$ sobre o valor base"}
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
            <button onClick={onAplicar} style={styles.aplicarButton}>
              Aplicar a todos
            </button>
          </div>
        )}

        <p style={styles.arrastarDica}>Segure e arraste um item pela alça (⠿) para reordenar.</p>

        <main style={styles.listaItens}>
          {selecionados.map((g) => {
            const item = itensPreco[g.id];
            const custoTotal = custoTotalItem(item, modoProduto);
            const finalTotal = totalItem(item, modoProduto);
            const lucro = custoTotal > 0 ? ((finalTotal - custoTotal) / custoTotal) * 100 : null;

            return (
              <div
                key={g.id}
                draggable
                onDragStart={() => handleDragStart(g.id)}
                onDragEnter={() => handleDragEnter(g.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                style={styles.itemCard}
              >
                <div style={styles.itemCardHeader}>
                  <span style={styles.dragHandle} title="Arraste para reordenar">⠿</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{g.nome}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      {modoProduto === "grade"
                        ? `${g.grade_disponivel?.nome} · ${composicaoTexto(g.grade_disponivel)}`
                        : g.codigo}
                    </div>
                  </div>
                  {mostrarPreco && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>Total</div>
                      <div style={{ fontWeight: 700 }}>{fmtMoeda(finalTotal)}</div>
                    </div>
                  )}
                </div>

                {mostrarPreco && modoProduto === "grade" && (
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
                      {tamanhosOrdenados(item?.quantidades).map((tam) => {
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
                                onChange={(e) => onFinalManualGrade(g.id, tam, e.target.value)}
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

                {mostrarPreco && modoProduto === "unidade" && (
                  <div style={styles.unidadeRow}>
                    <span style={{ fontSize: 13, color: COLORS.muted }}>
                      Valor base: {fmtMoeda(item?.custo)}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item?.final ?? ""}
                      onChange={(e) => onFinalManualUnidade(g.id, e.target.value)}
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
        </main>

        {erro && <p style={{ color: COLORS.danger, textAlign: "center" }}>{erro}</p>}

        <footer style={styles.footer}>
          <button onClick={onGerar} disabled={gerando} style={styles.avancarButton}>
            {gerando ? "Gerando..." : "Gerar lista"}
          </button>
        </footer>
      </div>
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
    <div style={styles.page}>
      <div style={styles.tarja}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_URL} alt="MIC Camisas de Time" style={styles.logo} />
      </div>

      <div style={styles.sucessoWrap}>
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
  },
  tarja: {
    width: "100%",
    background: "#000000",
    padding: "16px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  logo: { height: 32, width: "auto" },
  content: { padding: "28px 24px 100px" },
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
  toggleModoButton: {
    alignSelf: "flex-start",
    background: "transparent",
    border: "none",
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    textAlign: "left",
  },
  clienteEValidade: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 20,
    alignItems: "start",
  },
  validadeLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 12,
    color: COLORS.muted,
  },
  validadeInput: {
    boxSizing: "border-box",
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: COLORS.text,
    marginTop: 4,
  },
  search: {
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
    width: "100%",
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
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    zIndex: 20,
    background: "#fff",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 8,
    maxHeight: 240,
    overflowY: "auto",
  },
  clienteRow: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "10px 12px",
    cursor: "pointer",
  },
  vazio: { fontSize: 13, color: COLORS.muted },
  modoProdutoRow: { display: "flex", gap: 8 },
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
  gradeAviso: {
    margin: 0,
    fontSize: 12,
    color: COLORS.muted,
  },
  buscaProdutoRow: { display: "flex", gap: 10, alignItems: "center" },
  marcarTodosButton: {
    padding: "10px 16px",
    borderRadius: 8,
    border: `1px solid ${COLORS.accent}`,
    background: "transparent",
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  gridProdutos: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 12,
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
  sucessoWrap: {
    minHeight: "calc(100vh - 64px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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