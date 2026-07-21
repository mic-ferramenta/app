// scripts/sync-bling.js
// Executado pelo GitHub Actions a cada 5 minutos.
// 1. Lê o token atual do Supabase
// 2. Renova o access_token se estiver perto de expirar (usando o refresh_token)
// 3. Busca a lista de produtos no Bling (paginado)
// 4. Para cada produto, busca o detalhe (custo, estoque, imagem)
// 5. Faz upsert na tabela public.products do Supabase

const { createClient } = require("@supabase/supabase-js");

const BLING_BASE_URL = "https://api.bling.com.br/Api/v3";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getValidAccessToken() {
  const { data: tokenRow, error } = await supabase
    .from("bling_tokens")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !tokenRow) {
    throw new Error(
      "Nenhum token encontrado no Supabase. Rode o fluxo de conexão (/api/bling/connect) primeiro."
    );
  }

  const expiresAt = new Date(tokenRow.expires_at).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  // Se o token ainda é válido por mais de 5 minutos, usa ele direto
  if (expiresAt - now > fiveMinutes) {
    return tokenRow.access_token;
  }

  // Caso contrário, renova usando o refresh_token
  console.log("Access token expirando, renovando com o refresh_token...");

  const basicAuth = Buffer.from(
    `${process.env.BLING_CLIENT_ID}:${process.env.BLING_CLIENT_SECRET}`
  ).toString("base64");

  const resp = await fetch(`${BLING_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenRow.refresh_token,
    }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(`Falha ao renovar token: ${JSON.stringify(data)}`);
  }

  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("bling_tokens")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token, // o Bling costuma rotacionar o refresh_token também
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (updateError) {
    throw new Error(`Falha ao salvar novo token no Supabase: ${updateError.message}`);
  }

  return data.access_token;
}

async function blingFetch(path, accessToken) {
  const resp = await fetch(`${BLING_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (resp.status === 429) {
    // Limite de requisições por segundo do Bling atingido: espera e tenta de novo
    console.log("Rate limit do Bling atingido, aguardando 2s...");
    await new Promise((r) => setTimeout(r, 2000));
    return blingFetch(path, accessToken);
  }

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Erro Bling ${path}: ${JSON.stringify(data)}`);
  }
  return data;
}

// Lista todos os produtos (paginado, 100 por página é o máximo permitido pela API)
async function listAllProducts(accessToken) {
  let pagina = 1;
  const limite = 100;
  let allProducts = [];

  while (true) {
    const data = await blingFetch(
      `/produtos?pagina=${pagina}&limite=${limite}`,
      accessToken
    );
    const items = data.data || [];
    allProducts = allProducts.concat(items);

    if (items.length < limite) break; // última página
    pagina += 1;

    // pequena pausa para não estourar o rate limit
    await new Promise((r) => setTimeout(r, 350));
  }

  return allProducts;
}

// Busca o detalhe de um produto específico (custo, estoque, imagem)
// IMPORTANTE: confira no seu próprio teste (ex: no console.log abaixo) os nomes
// exatos dos campos retornados pela sua conta/plano do Bling, pois alguns
// campos (fornecedor/custo, mídia) podem variar conforme o módulo contratado.
async function getProductDetail(id, accessToken) {
  const data = await blingFetch(`/produtos/${id}`, accessToken);
  return data.data;
}

function extractCost(detail) {
  // Caminho mais comum no retorno da v3: fornecedor.precoCusto
  return detail?.fornecedor?.precoCusto ?? detail?.precoCusto ?? null;
}

function extractStock(detail) {
  // Estoque "saldo virtual total" costuma vir em estoque.saldoVirtualTotal
  return (
    detail?.estoque?.saldoVirtualTotal ??
    detail?.estoque?.saldoFisicoTotal ??
    null
  );
}

function extractImage(detail) {
  const imagens = detail?.midia?.imagens;
  if (imagens?.externas?.length) return imagens.externas[0].link;
  if (imagens?.internas?.length) return imagens.internas[0].link;
  return null;
}

async function main() {
  const startedAt = new Date().toISOString();
  let syncedCount = 0;

  try {
    const accessToken = await getValidAccessToken();

    console.log("Buscando lista de produtos...");
    const products = await listAllProducts(accessToken);
    console.log(`Encontrados ${products.length} produtos. Buscando detalhes...`);

    for (const p of products) {
      const detail = await getProductDetail(p.id, accessToken);

      const row = {
        bling_id: detail.id,
        codigo: detail.codigo ?? null,
        nome: detail.nome ?? null,
        preco_venda: detail.preco ?? null,
        preco_custo: extractCost(detail),
        estoque: extractStock(detail),
        situacao: detail.situacao ?? null,
        imagem_url: extractImage(detail),
        raw_data: detail,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("products")
        .upsert(row, { onConflict: "bling_id" });

      if (error) {
        console.error(`Erro ao salvar produto ${detail.id}:`, error.message);
      } else {
        syncedCount += 1;
      }

      // pequena pausa entre chamadas de detalhe para respeitar o rate limit
      await new Promise((r) => setTimeout(r, 350));
    }

    await supabase.from("sync_logs").insert({
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: "success",
      products_synced: syncedCount,
    });

    console.log(`Sincronização concluída: ${syncedCount} produtos atualizados.`);
  } catch (err) {
    console.error("Erro na sincronização:", err);
    await supabase.from("sync_logs").insert({
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: "error",
      products_synced: syncedCount,
      error_message: String(err.message || err),
    });
    process.exit(1);
  }
}

main();