// pages/lista/[slug].js
//
// Página pública, renderizada no servidor. O slug agora pertence à
// LISTA (price_lists), não ao cliente -- então um mesmo cliente pode
// ter várias listas, cada uma com seu próprio link.

import { supabaseAdmin } from "../../lib/supabaseAdmin";

// Blindagem: tira um eventual prefixo "Tamanho:" que tenha vindo cru do
// Bling, não importa a caixa ou os espaços ao redor.
function limparTamanho(v) {
  if (!v) return v;
  return String(v).replace(/^\s*tamanho\s*:\s*/i, "").trim();
}

export default function ListaDePrecos({ cliente, itens }) {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Lista de preços</h1>
        <p style={styles.subtitle}>{cliente.nome}</p>
      </header>

      <main style={styles.grid}>
        {itens.map((item) => (
          <div key={item.id} style={styles.card}>
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

              <div style={styles.tamanhos}>
                {item.variacoes.length === 0 && (
                  <span style={styles.semTamanho}>tamanho único</span>
                )}
                {item.variacoes.map((v) => {
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

              <p style={styles.price}>
                {Number(item.preco).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
            </div>
          </div>
        ))}

        {itens.length === 0 && (
          <p style={styles.empty}>Nenhum item cadastrado nesta lista ainda.</p>
        )}
      </main>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const { slug } = params;

  const { data: lista } = await supabaseAdmin
    .from("price_lists")
    .select("id, ativo, client:client_id ( nome )")
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
      "id, preco, ordem, grupo:group_id ( id, nome, imagem_url, variacoes:products ( id, tamanho, estoque ) )"
    )
    .eq("price_list_id", lista.id)
    .order("ordem", { ascending: true });

  const itens = (itensRaw || [])
    .filter((i) => i.grupo)
    .map((i) => ({
      id: i.id,
      preco: i.preco,
      nome: i.grupo.nome,
      imagem_url: i.grupo.imagem_url,
      variacoes: i.grupo.variacoes || [],
    }));

  return {
    props: { cliente: { nome: lista.client.nome }, itens },
  };
}

const AZUL = "#1d4ed8";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#ffffff",
    color: "#000000",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    padding: "32px 20px 60px",
  },
  header: {
    maxWidth: 1000,
    margin: "0 auto 32px",
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
  empty: {
    gridColumn: "1 / -1",
    textAlign: "center",
    color: "#666",
    padding: 40,
  },
};