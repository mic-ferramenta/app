// pages/lista/[slug].js
//
// Página renderizada no SERVIDOR (getServerSideProps). O navegador do
// cliente recebe só o HTML pronto -- nunca tem acesso à service_role key
// nem consegue consultar o Supabase diretamente. Cada slug só enxerga
// os itens ligados ao client_id daquele slug.

import { supabaseAdmin } from "../../lib/supabaseAdmin";

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
              {item.produto.imagem_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.produto.imagem_url}
                  alt={item.produto.nome}
                  style={styles.image}
                />
              ) : (
                <div style={styles.imagePlaceholder}>sem imagem</div>
              )}
            </div>

            <div style={styles.cardBody}>
              <h2 style={styles.productName}>{item.produto.nome}</h2>
              {item.produto.tamanho && (
                <span style={styles.badge}>Tamanho: {item.produto.tamanho}</span>
              )}
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

  const { data: cliente } = await supabaseAdmin
    .from("clients")
    .select("id, nome, ativo")
    .eq("slug", slug)
    .eq("ativo", true)
    .single();

  // slug inválido, inexistente ou cliente inativo -> 404 genérico
  // (não revela se o slug existe ou não, nem se está só inativo)
  if (!cliente) {
    return { notFound: true };
  }

  const { data: itensRaw } = await supabaseAdmin
    .from("price_list_items")
    .select(
      "id, preco, ordem, produto:product_id ( id, nome, imagem_url, tamanho )"
    )
    .eq("client_id", cliente.id)
    .order("ordem", { ascending: true });

  const itens = (itensRaw || []).map((i) => ({
    id: i.id,
    preco: i.preco,
    produto: i.produto,
  }));

  return {
    props: { cliente: { nome: cliente.nome }, itens },
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
    gap: 6,
  },
  productName: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: "#000000",
  },
  badge: {
    display: "inline-block",
    fontSize: 12,
    color: AZUL,
    border: `1px solid ${AZUL}`,
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