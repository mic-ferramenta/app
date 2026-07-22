// scripts/sync-bling-debug.js
//
// Script SÓ DE DIAGNÓSTICO. Não mexe em produtos_pai nem em
// produtos_variacoes -- busca todos os produtos no Bling exatamente
// como a API devolve e joga o JSON bruto em produtos_raw_debug, sem
// nenhuma lógica de agrupamento/tratamento.
//
// Rode manualmente (não faz parte do cron):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-bling-debug.js
//
// Depois é só consultar produtos_raw_debug direto no SQL editor pra
// ver o formato real que o Bling está mandando.

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
    throw new Error("Nenhum token encontrado no Supabase.");
  }

  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (expiresAt - Date.now() > 5 * 60 * 1000) {
    return tokenRow.access_token;
  }

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
  if (!resp.ok) throw new Error(`Falha ao renovar token: ${JSON.stringify(data)}`);

  await supabase
    .from("bling_tokens")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  return data.access_token;
}

async function blingFetch(path, accessToken) {
  const resp = await fetch(`${BLING_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (resp.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    return blingFetch(path, accessToken);
  }
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Erro Bling ${path}: ${JSON.stringify(data)}`);
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const accessToken = await getValidAccessToken();

  console.log("Buscando lista de produtos...");
  let pagina = 1;
  const limite = 100;
  let products = [];
  while (true) {
    const data = await blingFetch(`/produtos?pagina=${pagina}&limite=${limite}`, accessToken);
    const items = data.data || [];
    products = products.concat(items);
    if (items.length < limite) break;
    pagina += 1;
    await sleep(350);
  }
  console.log(`Encontrados ${products.length} produtos. Buscando detalhes (cru, sem tratamento)...`);

  const rows = [];
  for (const p of products) {
    const detail = await blingFetch(`/produtos/${p.id}`, accessToken);
    rows.push({
      bling_id: p.id,
      raw_data: detail.data,
      updated_at: new Date().toISOString(),
    });
    await sleep(350);
  }

  console.log(`Salvando ${rows.length} registros brutos em produtos_raw_debug...`);
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase
      .from("produtos_raw_debug")
      .upsert(chunk, { onConflict: "bling_id" });
    if (error) {
      console.error(`Erro ao salvar lote ${i}-${i + chunk.length}:`, error.message);
    }
  }

  console.log("Concluído. Consulte a tabela produtos_raw_debug no SQL editor.");
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});