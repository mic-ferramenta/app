// scripts/sync-bling.js
// Executado pelo GitHub Actions a cada 5 minutos.
//
// Grava o catálogo em duas tabelas enxutas, sem nenhum dado duplicado:
//   produtos_pai        -> nome, imagem, preço de venda, custo (1 por produto)
//   produtos_variacoes  -> tamanho + estoque (1 por tamanho vendável)
// O app lê tudo através da view produtos_catalogo (ver migração SQL).
//
// Também sincroniza os CLIENTES (contatos) do Bling -> public.bling_customers

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

  if (expiresAt - now > fiveMinutes) {
    return tokenRow.access_token;
  }

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
      refresh_token: data.refresh_token,
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Upsert em lotes -- muito mais rápido que 1 chamada por linha, e é o
// que garante que isso não fica lento conforme o catálogo cresce.
async function upsertInChunks(table, rows, onConflict, chunkSize = 500) {
  let synced = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error, count } = await supabase
      .from(table)
      .upsert(chunk, { onConflict, count: "exact" });

    if (error) {
      console.error(`Erro ao salvar lote em ${table} (linhas ${i}-${i + chunk.length}):`, error.message);
    } else {
      synced += count ?? chunk.length;
    }
  }
  return synced;
}

// Igual ao upsertInChunks, mas devolve o id gerado/existente de cada
// linha (precisamos disso pra ligar cada variação ao seu pai).
async function upsertInChunksComRetorno(table, rows, onConflict, returning, chunkSize = 500) {
  const resultados = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict })
      .select(returning);

    if (error) {
      throw new Error(`Erro ao salvar lote em ${table} (linhas ${i}-${i + chunk.length}): ${error.message}`);
    }
    resultados.push(...(data || []));
  }
  return resultados;
}

// ================================================================
// CLIENTES (contatos) do Bling
// ================================================================

async function listAllCustomers(accessToken) {
  let pagina = 1;
  const limite = 100;
  let all = [];

  while (true) {
    const data = await blingFetch(
      `/contatos?pagina=${pagina}&limite=${limite}`,
      accessToken
    );
    const items = data.data || [];
    all = all.concat(items);

    if (items.length < limite) break;
    pagina += 1;
    await sleep(300);
  }

  return all;
}

function extractDocumento(c) {
  return c?.numeroDocumento ?? c?.documento ?? null;
}

async function syncCustomers(accessToken) {
  console.log("Buscando clientes (contatos) no Bling...");
  const customers = await listAllCustomers(accessToken);
  console.log(`Encontrados ${customers.length} contatos. Salvando em lote...`);

  const rows = customers.map((c) => ({
    bling_id: c.id,
    nome: c.nome ?? null,
    documento: extractDocumento(c),
    email: c.email ?? null,
    telefone: c.telefone ?? c.celular ?? null,
    situacao: c.situacao ?? null,
    raw_data: c,
    updated_at: new Date().toISOString(),
  }));

  const synced = await upsertInChunks("bling_customers", rows, "bling_id");

  console.log(`Clientes sincronizados: ${synced}.`);
  return synced;
}

// ================================================================
// PRODUTOS: produtos_pai + produtos_variacoes
// ================================================================

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

    if (items.length < limite) break;
    pagina += 1;
    await sleep(350);
  }

  return allProducts;
}

async function getProductDetail(id, accessToken) {
  const data = await blingFetch(`/produtos/${id}`, accessToken);
  return data.data;
}

function extractCost(detail) {
  // ATENÇÃO: o schema oficial do produto no Bling v3 não expõe custo
  // diretamente -- ele mora na entidade separada "Produtos - Fornecedores".
  // Isso aqui é best-effort (funciona se a sua conta retornar esse campo
  // "extra"); se os custos aparecerem sempre nulos/zerados, o próximo
  // passo é buscar em /produtos/{id}/fornecedores.
  return detail?.fornecedor?.precoCusto ?? detail?.precoCusto ?? null;
}

function extractStock(detail) {
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

// Confirmado no schema oficial da API v3: a variação traz o id do pai
// no campo "idProdutoPai" (número direto, não um objeto aninhado). O
// produto "pai" (quando existe de fato) traz um array "variacoes".
function extractParentId(detail) {
  return detail?.idProdutoPai ?? null;
}

function isParentProduct(detail) {
  return Array.isArray(detail?.variacoes) && detail.variacoes.length > 0;
}

// Fallback para contas onde o Bling não expõe idProdutoPai/variacoes:
// separa "Nome do produto Tamanho:XX" em base + tamanho.
function splitNomeTamanho(nomeCompleto) {
  const nome = String(nomeCompleto || "");
  const match = nome.match(/^(.*?)\s*Tamanho\s*:\s*(\S+)\s*$/i);
  if (match) {
    return { base: match[1].trim(), tamanho: match[2].trim() };
  }
  return { base: nome.trim(), tamanho: null };
}

function chaveGrupoPorNome(baseNome) {
  return String(baseNome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function syncProducts(accessToken) {
  console.log("Buscando lista de produtos...");
  const products = await listAllProducts(accessToken);
  console.log(`Encontrados ${products.length} produtos. Buscando detalhes...`);

  const details = [];
  for (const p of products) {
    const detail = await getProductDetail(p.id, accessToken);
    details.push(detail);
    await sleep(350);
  }

  const now = new Date().toISOString();

  // ------------------------------------------------------------
  // Passo 1: monta as linhas de produtos_pai (chave -> linha)
  // ------------------------------------------------------------
  const paisPorChave = new Map();

  function registrarPaiSeNecessario(key, dadosCompletos) {
    if (paisPorChave.has(key)) return;
    paisPorChave.set(key, { chave_grupo: key, updated_at: now, ...dadosCompletos });
  }

  // 1a) produtos "pai" de verdade, vindos com array variacoes
  for (const detail of details) {
    if (extractParentId(detail)) continue; // é filho, tratado no passo 2
    if (!isParentProduct(detail)) continue; // não é pai puro

    registrarPaiSeNecessario(`bling-${detail.id}`, {
      bling_id: detail.id,
      nome: detail.nome ?? null,
      codigo: detail.codigo ?? null,
      imagem_url: extractImage(detail),
      preco_venda: detail.preco ?? null,
      preco_custo: extractCost(detail),
      situacao: detail.situacao ?? null,
    });
  }

  // ------------------------------------------------------------
  // Passo 2: monta as linhas de produtos_variacoes, garantindo que
  // cada uma tenha um pai (criando um mínimo se ainda não existir).
  // ------------------------------------------------------------
  const variacoesPendentes = [];

  for (const detail of details) {
    const parentId = extractParentId(detail);
    if (!parentId && isParentProduct(detail)) continue; // já é o pai, tratado acima

    const { base, tamanho: tamanhoDoNome } = splitNomeTamanho(detail.nome);
    let key;
    let tamanho;

    if (parentId) {
      // variação real, ligada por idProdutoPai
      key = `bling-${parentId}`;
      tamanho = detail?.variacao?.nome || tamanhoDoNome || null;
      registrarPaiSeNecessario(key, { bling_id: parentId, nome: base });
    } else if (tamanhoDoNome !== null) {
      // sem vínculo estruturado, mas o nome segue "... Tamanho:XX"
      key = `nome-${chaveGrupoPorNome(base)}`;
      tamanho = tamanhoDoNome;
      registrarPaiSeNecessario(key, {
        nome: base,
        codigo: detail.codigo ?? null,
        imagem_url: extractImage(detail),
        preco_venda: detail.preco ?? null,
        preco_custo: extractCost(detail),
        situacao: detail.situacao ?? null,
      });
    } else {
      // produto totalmente simples, sem nenhuma variação de tamanho
      key = `bling-${detail.id}`;
      tamanho = null;
      registrarPaiSeNecessario(key, {
        bling_id: detail.id,
        nome: detail.nome ?? null,
        codigo: detail.codigo ?? null,
        imagem_url: extractImage(detail),
        preco_venda: detail.preco ?? null,
        preco_custo: extractCost(detail),
        situacao: detail.situacao ?? null,
      });
    }

    variacoesPendentes.push({
      key,
      bling_id: detail.id,
      codigo: detail.codigo ?? null,
      tamanho,
      estoque: extractStock(detail),
      situacao: detail.situacao ?? null,
      updated_at: now,
    });
  }

  // ------------------------------------------------------------
  // Grava produtos_pai primeiro (em lotes) e pega os ids de volta,
  // pra poder ligar cada variação ao pai certo.
  // ------------------------------------------------------------
  const paiRows = Array.from(paisPorChave.values());
  const paisSalvos = await upsertInChunksComRetorno(
    "produtos_pai",
    paiRows,
    "chave_grupo",
    "id, chave_grupo"
  );

  const idPaiPorChave = new Map(paisSalvos.map((p) => [p.chave_grupo, p.id]));

  console.log(`Produtos (pai) sincronizados: ${paisSalvos.length}.`);

  // ------------------------------------------------------------
  // Grava produtos_variacoes em lotes, já com o pai_id resolvido.
  // ------------------------------------------------------------
  const variacaoRows = variacoesPendentes
    .map((v) => ({
      bling_id: v.bling_id,
      pai_id: idPaiPorChave.get(v.key),
      codigo: v.codigo,
      tamanho: v.tamanho,
      estoque: v.estoque,
      situacao: v.situacao,
      updated_at: v.updated_at,
    }))
    .filter((v) => v.pai_id); // segurança: nunca deveria faltar

  const syncedCount = await upsertInChunks("produtos_variacoes", variacaoRows, "bling_id");

  console.log(`Variações sincronizadas: ${syncedCount}.`);
  return paisSalvos.length + syncedCount;
}

async function main() {
  const startedAt = new Date().toISOString();

  const accessToken = await getValidAccessToken();

  // Clientes e produtos rodam de forma independente: se um dos dois
  // falhar, o outro continua rodando normalmente em vez de derrubar a
  // sincronização inteira.
  const resultados = await Promise.allSettled([
    syncCustomers(accessToken),
    syncProducts(accessToken),
  ]);

  const [customersResult, productsResult] = resultados;
  const customersSynced =
    customersResult.status === "fulfilled" ? customersResult.value : 0;
  const productsSynced =
    productsResult.status === "fulfilled" ? productsResult.value : 0;

  const erros = resultados
    .filter((r) => r.status === "rejected")
    .map((r) => String(r.reason?.message || r.reason));

  if (erros.length > 0) {
    console.error("Erro(s) na sincronização:", erros.join(" | "));
  }

  await supabase.from("sync_logs").insert({
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status: erros.length > 0 ? "error" : "success",
    products_synced: customersSynced + productsSynced,
    error_message: erros.length > 0 ? erros.join(" | ") : null,
  });

  console.log(
    `Sincronização finalizada: ${customersSynced} clientes, ${productsSynced} registros de produto.` +
      (erros.length > 0 ? ` (com erro em ${erros.length} etapa(s))` : "")
  );

  if (erros.length === resultados.length) {
    process.exit(1);
  }
}

main();