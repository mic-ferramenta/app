// pages/lista/[slug].js
//
// Página pública, renderizada no servidor. O slug pertence à LISTA
// (price_lists), não ao cliente -- um mesmo cliente pode ter várias
// listas, cada uma com seu próprio link.

import { useState } from "react";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { limparTamanho, ordenarVariacoes } from "../../lib/tamanhos";
import { estoquePorTamanho, gradesQueCabem } from "../../lib/grades";

const LOGO_URL =
  "https://miccamisasdetime.com.br/cdn/shop/files/Design_sem_nome_-_2026-02-01T085034.319.png?v=1770226222&width=90";

function ItemLista({ item, mostrarPreco }) {
  const [expandido, setExpandido] = useState(false);
  const variacoes = ordenarVariacoes(item.variacoes);
  const isGrade = item.tipo === "grade";

  return (
    <div style={styles.card}>
      <div
        style={styles.cardClicavel}
        onClick={() => setExpandido((e) => !e)}
      >
        <div style={styles.imageWrap}>
          {item.imagem_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imagem_url} alt={item.nome} style={styles.image} />
          ) : (
            <div style={styles.imagePlaceholder}>sem imagem</div>
          )}
        </div>

        <div style={styles.cardBody}>
          <h2 style={styles.productName}>{item.nome}</h2>

          {isGrade ? (
            <div style={styles.gradeInfo}>
              {item.gradesDisponiveisCount > 0 ? (
                <span style={styles.gradeDisponivelBadge}>
                  {item.gradesDisponiveisCount}{" "}
                  {item.gradesDisponiveisCount === 1 ? "grade disponível" : "grades disponíveis"}
                </span>
              ) : (
                <span style={styles.gradeIndisponivelBadge}>Grade indisponível</span>
              )}
            </div>
          ) : (
            <div style={styles.tamanhos}>
              {variacoes.length === 0 && (
                <span style={styles.semTamanho}>tamanho único</span>
              )}
              {variacoes.map((v) => {
                const comEstoque = Number(v.estoque) > 0;
                return (
                  <span
                    key={v.id}
                    style={{
                      ...styles.badge,
                      color: comEstoque ? AZUL : "#9ca3af",
                      borderColor: comEstoque ? AZUL : "#e5e5e5",
                      background: comEstoque ? "#eef2ff" : "#f5f5f5",
                    }}
                  >
                    {limparTamanho(v.tamanho) || "Único"}
                  </span>
                );
              })}
            </div>
          )}

          {mostrarPreco && (!isGrade || item.gradesDisponiveisCount > 0) && (
            <p style={styles.price}>
              {Number(item.preco).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </p>
          )}

          <span style={styles.expandHint}>
            {expandido ? "▲ ocultar estoque por tamanho" : "▼ ver estoque por tamanho"}
          </span>
        </div>
      </div>

      {expandido && (
        <div style={styles.expandBox}>
          <table style={styles.expandTable}>
            <thead>
              <tr>
                <th style={styles.expandTh}>Tamanho</th>
                <th style={styles.expandTh}>Estoque</th>
              </tr>
            </thead>
            <tbody>
              {variacoes.length === 0 && (
                <tr>
                  <td style={styles.expandTd} colSpan={2}>
                    Sem variações cadastradas.
                  </td>
                </tr>
              )}
              {variacoes.map((v) => (
                <tr key={v.id}>
                  <td style={styles.expandTd}>{limparTamanho(v.tamanho) || "Único"}</td>
                  <td style={styles.expandTd}>{v.estoque ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ListaDePrecos({ cliente, itens, mostrarPreco }) {
  return (
    <div style={styles.page}>
      <div style={styles.tarja}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_URL} alt="MIC Camisas de Time" style={styles.logo} />
      </div>

      <div style={styles.content}>
        <header style={styles.header}>
          <h1 style={styles.title}>Lista de preços</h1>
          <p style={styles.subtitle}>{cliente.nome}</p>
        </header>

        <div style={styles.aviso}>
          O estoque exibido pode variar. Clique em um produto para ver o
          estoque por tamanho.
        </div>

        <main style={styles.grid}>
          {itens.map((item) => (
            <ItemLista key={item.id} item={item} mostrarPreco={mostrarPreco} />
          ))}

          {itens.length === 0 && (
            <p style={styles.empty}>Nenhum item cadastrado nesta lista ainda.</p>
          )}
        </main>
      </div>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const { slug } = params;

  const { data: lista } = await supabaseAdmin
    .from("price_lists")
    .select("id, ativo, titulo, mostrar_preco, client:client_id ( nome )")
    .eq("slug", slug)
    .eq("ativo", true)
    .single();

  // slug inválido, inexistente ou lista inativa -> 404 genérico
  if (!lista) {
    return { notFound: true };
  }

  const { data: itensRaw } = await supabaseAdmin
    .from("price_list_items")
    .select(
      "id, preco, ordem, tipo, grupo:pai_id ( id, nome, imagem_url, variacoes:produtos_variacoes ( id, tamanho, estoque ) )"
    )
    .eq("price_list_id", lista.id)
    .order("ordem", { ascending: true });

  // Só busca as grades cadastradas se realmente tiver algum item do
  // tipo "grade" nesta lista -- evita uma consulta à toa nas listas
  // que só têm itens por unidade (a grande maioria).
  const temItemGrade = (itensRaw || []).some((i) => i.tipo === "grade");
  let grades = [];
  if (temItemGrade) {
    const { data: gradesData } = await supabaseAdmin
      .from("grades")
      .select("id, nome, prioridade, composicao")
      .eq("ativo", true)
      .order("prioridade", { ascending: true });
    grades = gradesData || [];
  }

  const itens = (itensRaw || [])
    .filter((i) => i.grupo)
    .map((i) => {
      const variacoes = i.grupo.variacoes || [];
      const isGrade = i.tipo === "grade";

      // A disponibilidade da grade é recalculada AGORA, com o estoque
      // atual -- nunca lida de um valor salvo. É por isso que o link
      // nunca fica "desatualizado": cada acesso reavalia do zero.
      const gradesDisponiveisCount = isGrade
        ? gradesQueCabem(estoquePorTamanho(variacoes), grades).length
        : 0;

      return {
        id: i.id,
        preco: i.preco,
        tipo: i.tipo,
        nome: i.grupo.nome,
        imagem_url: i.grupo.imagem_url,
        variacoes,
        gradesDisponiveisCount,
      };
    });

  return {
    props: {
      cliente: { nome: lista.client?.nome || lista.titulo },
      itens,
      mostrarPreco: lista.mostrar_preco,
    },
  };
}

const AZUL = "#1d4ed8";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#ffffff",
    color: "#000000",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
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
  content: { padding: "32px 20px 60px" },
  header: {
    maxWidth: 1000,
    margin: "0 auto 16px",
    borderBottom: `3px solid ${AZUL}`,
    paddingBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: "#000000",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: 16,
    color: AZUL,
    fontWeight: 600,
  },
  aviso: {
    maxWidth: 1000,
    margin: "0 auto 24px",
    padding: "10px 14px",
    borderRadius: 8,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    fontSize: 13,
  },
  grid: {
    maxWidth: 1000,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 20,
  },
  card: {
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    overflow: "hidden",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
  },
  cardClicavel: {
    display: "flex",
    flexDirection: "column",
    cursor: "pointer",
  },
  imageWrap: {
    width: "100%",
    aspectRatio: "1 / 1",
    background: "#fafafa",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#999",
    fontSize: 13,
  },
  cardBody: {
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  productName: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: "#000000",
  },
  tamanhos: { display: "flex", flexWrap: "wrap", gap: 6 },
  semTamanho: { fontSize: 12, color: "#666" },
  gradeInfo: { display: "flex", flexDirection: "column", gap: 4 },
  gradeDisponivelBadge: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    color: "#15803d",
    background: "#dcfce7",
  },
  gradeIndisponivelBadge: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    color: "#9ca3af",
    background: "#f3f4f6",
  },
  gradeComposicao: { fontSize: 12, color: "#666", fontFamily: "monospace" },
  badge: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid",
    borderRadius: 999,
    padding: "2px 10px",
    width: "fit-content",
  },
  price: {
    margin: "6px 0 0",
    fontSize: 20,
    fontWeight: 700,
    color: AZUL,
  },
  expandHint: {
    marginTop: 2,
    fontSize: 12,
    color: "#666",
  },
  expandBox: {
    borderTop: "1px solid #e5e5e5",
    padding: "10px 14px 14px",
  },
  expandTable: { width: "100%", borderCollapse: "collapse" },
  expandTh: {
    textAlign: "left",
    fontSize: 11,
    color: "#666",
    padding: "4px 6px",
  },
  expandTd: {
    fontSize: 13,
    padding: "4px 6px",
    borderTop: "1px solid #e5e5e5",
  },
  empty: {
    gridColumn: "1 / -1",
    textAlign: "center",
    color: "#666",
    padding: 40,
  },
};